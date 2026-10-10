#!/usr/bin/env node
import { existsSync } from "node:fs";
import { appendFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { parseArgs } from "node:util";

import { parseBrief, type Brief } from "@/brief";
import { engineNames, parseEngine, runSession, type Engine } from "@/engines";
import pkg from "../package.json";
import orchestratorPrompt from "../prompts/orchestrator.md" with { type: "text" };
import workerPrompt from "../prompts/worker.md" with { type: "text" };

const usage = `insomniac: a runner that takes coding agents through a plan, one task per session

Usage:
  insomniac <plan> [options]

Options:
  -o, --orchestrator <engine[:model]>  Engine that picks tasks (default: claude)
  -w, --worker <engine[:model]>        Engine that does tasks (default: claude)
  -n, --attempts <n>                   Cap on attempts in this run (default: 10)
  -q, --quiet                          Hide engine output from the terminal
  -h, --help                           Show this help
  -V, --version                        Print version

Engines: ${engineNames.join(", ")}
`;

function fail(error: unknown, help?: string): never {
  console.error(`Error: ${error instanceof Error ? error.message : error}`);
  if (help) {
    console.error(`\n${help}`);
  }
  process.exit(1);
}

type Role = "orchestrator" | "worker";

const RETRY_FIRST_GAP = 60_000;
const RETRY_MAX_GAP = 30 * 60_000;
const RETRY_BUDGET = 6 * 60 * 60_000;

function duration(ms: number) {
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  const parts = [];
  if (h > 0) {
    parts.push(`${h}h`);
  }
  if (m > 0) {
    parts.push(`${m}m`);
  }
  if (s > 0 || total === 0) {
    parts.push(`${s}s`);
  }

  return parts.join(" ");
}

function parseCliArgs() {
  try {
    return parseArgs({
      args: process.argv.slice(2),
      allowPositionals: true,
      options: {
        orchestrator: { type: "string", short: "o", default: "claude" },
        worker: { type: "string", short: "w", default: "claude" },
        attempts: { type: "string", short: "n", default: "10" },
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

const [planArg, ...extra] = args.positionals;
if (!planArg) {
  fail("Plan path is required", usage);
}
if (extra.length > 0) {
  fail(`Unexpected arguments: ${extra.join(" ")}`, usage);
}
const plan = path.resolve(planArg);
if (!existsSync(plan)) {
  fail(`Plan not found: ${plan}`);
}
if (!/^[1-9]\d*$/.test(args.values.attempts)) {
  fail("--attempts must be a positive integer");
}
const cap = parseInt(args.values.attempts, 10);
const quiet = args.values.quiet;

const pathDirs = (process.env.PATH ?? "").split(path.delimiter);
for (const engine of [orchestrator, worker]) {
  if (!pathDirs.some((dir) => existsSync(path.join(dir, engine.name)))) {
    fail(`Engine "${engine.name}" is not on PATH. Install its CLI first.`);
  }
}

const start = Date.now();
const stateDir = path.resolve(".insomniac");
const progress = path.join(stateDir, "progress.md");
// Swedish locale formats as YYYY-MM-DD HH:MM:SS in local time
const runName = new Date()
  .toLocaleString("sv-SE")
  .replace(" ", "_")
  .replaceAll(":", "-");
const runDir = path.join(stateDir, "runs", runName);
await mkdir(runDir, { recursive: true });
await writeFile(path.join(stateDir, ".gitignore"), "*\n");

console.log(`insomniac ${pkg.version}`);
console.log(`  plan:          ${plan}`);
console.log(`  progress:      ${progress}`);
console.log(`  run:           ${runDir}`);
console.log(`  orchestrator:  ${orchestrator.spec}`);
console.log(`  worker:        ${worker.spec}`);
console.log(`  attempts:      ${cap}`);

let attempts = 0;
const succeeded = new Set<Role>();

function finish(outcome: string, ok = false): never {
  console.log(`\n${outcome}`);
  const made = attempts === 1 ? "1 attempt" : `${attempts} attempts`;
  console.log(`${made} in ${duration(Date.now() - start)}`);
  process.exit(ok ? 0 : 1);
}

async function run(role: Role, engine: Engine, template: string, slot: string) {
  const brief = path.join(runDir, `${slot}-brief.md`);
  const report = path.join(runDir, `${slot}-report.md`);
  const output = role === "orchestrator" ? brief : report;
  const prompt = template
    .replaceAll("{{plan}}", plan)
    .replaceAll("{{progress}}", progress)
    .replaceAll("{{brief}}", brief)
    .replaceAll("{{report}}", report);
  let failingSince: number | null = null;
  for (let tryNumber = 1; ; tryNumber++) {
    console.log(`\n=== ${role} ${engine.spec}`);
    // A failed try may have written its output
    await rm(output, { force: true });
    const started = Date.now();
    const log = path.join(runDir, `${slot}-${role}-${tryNumber}.log`);
    const exit = await runSession(engine, prompt, log, quiet);
    if (exit === 0) {
      console.log(`${role} exited 0 after ${duration(Date.now() - started)}`);
      succeeded.add(role);

      return output;
    }
    // Before the role's first success, a failure is most likely a setup error
    if (!succeeded.has(role)) {
      finish(`${role} exited ${exit}`);
    }
    failingSince ??= Date.now();
    const failing = Date.now() - failingSince;
    if (failing >= RETRY_BUDGET) {
      finish(`${role} still failing after ${duration(failing)}`);
    }
    const wait = Math.min(
      RETRY_FIRST_GAP * 2 ** (tryNumber - 1),
      RETRY_MAX_GAP,
    );
    console.log(`${role} exited ${exit}, retrying in ${duration(wait)}`);
    await sleep(wait);
  }
}

while (true) {
  // Padded so run files sort in attempt order
  const slot = String(attempts + 1).padStart(3, "0");
  const briefPath = await run(
    "orchestrator",
    orchestrator,
    orchestratorPrompt,
    slot,
  );
  if (!existsSync(briefPath)) {
    finish("orchestrator wrote no brief");
  }
  let brief: Brief;
  try {
    brief = parseBrief(await readFile(briefPath, "utf8"));
  } catch (e) {
    finish(e instanceof Error ? e.message : String(e));
  }
  if (brief.status !== "task") {
    finish(`${brief.status}: ${brief.reason}`, brief.status === "done");
  }
  if (attempts >= cap) {
    finish(`attempt cap reached, next task: ${brief.id}`);
  }

  attempts++;
  console.log(`attempt ${attempts}/${cap} ${brief.id}: ${brief.title}`);
  const reportPath = await run("worker", worker, workerPrompt, slot);
  const report = existsSync(reportPath)
    ? await readFile(reportPath, "utf8")
    : "Worker wrote no report.";
  await appendFile(
    progress,
    `## ${brief.id} (${runName}/${slot})\n\n${report.trim()}\n\n`,
  );
}
