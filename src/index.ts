#!/usr/bin/env bun
import path from "node:path";
import { appendFile, rm } from "node:fs/promises";
import { parseArgs } from "node:util";
import { $ } from "bun";
import { engineNames, parseEngine, runSession, type Engine } from "@/engines";
import { parseBrief } from "@/brief";
import orchestratorPrompt from "../prompts/orchestrator.md" with { type: "text" };
import workerPrompt from "../prompts/worker.md" with { type: "text" };
import pkg from "../package.json";

const usage = `insomniac: a runner that takes coding agents through a plan, one task per session

Usage:
  insomniac <plan> [options]

Options:
  -o, --orchestrator <engine[:model]>  Engine that picks tasks (default: claude)
  -w, --worker <engine[:model]>        Engine that does tasks (default: claude)
  -n, --sessions <n>                   Cap on worker sessions (default: 10)
  -q, --quiet                          Hide engine output
  -h, --help                           Show this help
  -V, --version                        Print version

Engines: ${engineNames.join(", ")}
`;

function fail(error: unknown, help?: string): never {
  console.error(`Error: ${error instanceof Error ? error.message : error}`);
  if (help) console.error(`\n${help}`);
  process.exit(1);
}

function elapsed(since: number): string {
  const total = Math.round((Date.now() - since) / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

async function isDirty(): Promise<boolean> {
  return (await $`git status --porcelain`.text()) !== "";
}

function parseCliArgs() {
  try {
    return parseArgs({
      args: process.argv.slice(2),
      allowPositionals: true,
      options: {
        orchestrator: { type: "string", short: "o", default: "claude" },
        worker: { type: "string", short: "w", default: "claude" },
        sessions: { type: "string", short: "n", default: "10" },
        quiet: { type: "boolean", short: "q", default: false },
        help: { type: "boolean", short: "h" },
        version: { type: "boolean", short: "V" },
      },
    });
  } catch (e) {
    fail(e, usage);
  }
}

const args = parseCliArgs();

if (args.values.help) {
  console.log(usage);
  process.exit(0);
}
if (args.values.version) {
  console.log(pkg.version);
  process.exit(0);
}

let orchestrator: Engine;
let worker: Engine;
try {
  orchestrator = parseEngine(args.values.orchestrator);
  worker = parseEngine(args.values.worker);
} catch (e) {
  fail(e, usage);
}

const planArg = args.positionals[0];
if (!planArg) fail("Plan path is required", usage);
const plan = path.resolve(planArg);
if (!(await Bun.file(plan).exists())) fail(`Plan not found: ${plan}`);
const maxSessions = parseInt(args.values.sessions, 10);
if (!(maxSessions > 0)) fail("--sessions must be a positive number");
const quiet = args.values.quiet;

for (const engine of [orchestrator, worker]) {
  if (!Bun.which(engine.name)) {
    fail(`Engine "${engine.name}" is not on PATH. Install its CLI first.`);
  }
}

const repo = await $`git rev-parse --show-toplevel`.quiet().nothrow();
if (repo.exitCode !== 0) {
  fail("Not a git repo. insomniac commits each task, so run it inside one.");
}
if (await isDirty()) fail("Working tree is dirty. Commit or stash first.");

const stateDir = path.join(repo.text().trim(), ".insomniac");
const progress = path.join(stateDir, "progress.md");
const briefPath = path.join(stateDir, "brief.md");
const reportPath = path.join(stateDir, "report.md");
await Bun.write(path.join(stateDir, ".gitignore"), "*\n");

console.log(`insomniac ${pkg.version}`);
console.log(`  plan:          ${plan}`);
console.log(`  progress:      ${progress}`);
console.log(`  orchestrator:  ${orchestrator.spec}`);
console.log(`  worker:        ${worker.spec}`);
console.log(`  sessions:      ${maxSessions}`);

const start = Date.now();
let session = 0;

function finish(outcome: string, ok = false): never {
  console.log(`\n${outcome}`);
  const ran = session === 1 ? "1 worker session" : `${session} worker sessions`;
  console.log(`${ran} in ${elapsed(start)}`);
  process.exit(ok ? 0 : 1);
}

async function run(
  role: string,
  engine: Engine,
  template: string,
): Promise<number> {
  const prompt = template
    .replaceAll("{{plan}}", plan)
    .replaceAll("{{progress}}", progress)
    .replaceAll("{{brief}}", briefPath)
    .replaceAll("{{report}}", reportPath)
    .replaceAll("{{session}}", String(session))
    .replaceAll("{{sessions}}", String(maxSessions));
  console.log(`\n=== ${role} ${engine.spec}`);
  const started = Date.now();
  const exit = await runSession(engine, prompt, quiet);
  console.log(`${role} exited ${exit} after ${elapsed(started)}`);
  // Only what an agent commits lands, but stash so nothing is lost
  if (await isDirty()) {
    await $`git stash push -q -u -m ${`insomniac: ${role} left session ${session} uncommitted`}`;
    console.log(`${role} left uncommitted changes, stashed`);
  }
  return exit;
}

while (true) {
  await rm(briefPath, { force: true });
  await rm(reportPath, { force: true });

  const orchestratorExit = await run(
    "orchestrator",
    orchestrator,
    orchestratorPrompt,
  );
  if (orchestratorExit !== 0) finish(`orchestrator exited ${orchestratorExit}`);

  const briefFile = Bun.file(briefPath);
  if (!(await briefFile.exists())) finish("orchestrator wrote no brief");
  const brief = parseBrief(await briefFile.text());
  if (brief.status !== "task") {
    finish(`${brief.status}: ${brief.reason}`, brief.status === "done");
  }
  if (session >= maxSessions) {
    finish(`session cap reached, next task: ${brief.id}`);
  }

  session++;
  console.log(`task ${session}/${maxSessions} ${brief.id}: ${brief.title}`);
  const workerExit = await run("worker", worker, workerPrompt);

  const reportFile = Bun.file(reportPath);
  const report = (await reportFile.exists())
    ? await reportFile.text()
    : `Worker exited ${workerExit} without writing a report.`;
  await appendFile(
    progress,
    `## ${brief.id} (session ${session})\n\n${report.trim()}\n\n`,
  );
}
