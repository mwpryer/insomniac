#!/usr/bin/env bun
import path from "path";
import { parseArgs } from "node:util";
import { runEngine, type EngineName } from "@/engines";
import * as v from "valibot";
import { PlanSchema, readPlan, allTasks } from "@/plan";
import {
  formatTime,
  ensureCleanWorkingTree,
  checkoutOrCreateBranch,
} from "@/utils";
import pkg from "../package.json";

function printUsage(): void {
  console.log(`
insomniac: run AI agents in a loop against a task plan

Usage:
  insomniac [options]

Options:
  -p, --plan <path>         Plan file path (required)
  --progress <path>         Progress file path (default: progress.txt)
  -n, --max-iterations <n>  Cap iterations (default: 10)
  --prompt <path>           Prompt template path (default: bundled prompts/coding.md)
  -q, --quiet               Suppress engine output
  -d, --debug               Show harness diagnostics
  --print-prompt            Print the bundled prompt template to stdout and exit
  -h, --help                Show this help
  -V, --version             Print version and exit

Engine (default: claude):
  --claude                  Use Claude Code
  --codex                   Use Codex
  --opencode                Use OpenCode
  --gemini                  Use Gemini CLI
  -m, --model <name>        Override the default model
`);
}

let values;
try {
  ({ values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      plan: { type: "string", short: "p" },
      progress: { type: "string", default: "progress.txt" },
      "max-iterations": { type: "string", short: "n", default: "10" },
      prompt: { type: "string" },
      model: { type: "string", short: "m" },
      quiet: { type: "boolean", short: "q", default: false },
      debug: { type: "boolean", short: "d", default: false },
      "print-prompt": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
      version: { type: "boolean", short: "V", default: false },
      claude: { type: "boolean", default: false },
      codex: { type: "boolean", default: false },
      opencode: { type: "boolean", default: false },
      gemini: { type: "boolean", default: false },
    },
    strict: true,
  }));
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  printUsage();
  process.exit(1);
}

if (values.help) {
  printUsage();
  process.exit(0);
}

if (values.version) {
  console.log(pkg.version);
  process.exit(0);
}

const promptPath =
  values.prompt ?? path.resolve(import.meta.dir, "..", "prompts", "coding.md");

if (values["print-prompt"]) {
  const bundled = await Bun.file(promptPath).text();
  process.stdout.write(bundled);
  process.exit(0);
}

const engineNames = ["claude", "codex", "opencode", "gemini"] as const;
const engine: EngineName = engineNames.find((name) => values[name]) ?? "claude";
const planPath = values.plan;
const maxIterations = Math.max(1, parseInt(values["max-iterations"]!, 10));
const progressPath = values.progress!;
const model = values.model;
const quiet = values.quiet;
const debug = values.debug;

if (!planPath) {
  console.error("Error: --plan is required\n");
  printUsage();
  process.exit(1);
}

const planFile = Bun.file(planPath);
if (!(await planFile.exists())) {
  console.error(`Plan file not found: ${planPath}`);
  process.exit(1);
}
const promptFile = Bun.file(promptPath);
if (!(await promptFile.exists())) {
  console.error(`Prompt file not found: ${promptPath}`);
  process.exit(1);
}

const promptTemplate = await promptFile.text();

const initialPlan = v.parse(PlanSchema, await planFile.json());

const branch = initialPlan.branchName;
ensureCleanWorkingTree();
checkoutOrCreateBranch(branch);

const totalTasks = allTasks(initialPlan).length;

console.log(`insomniac (${engine})`);
console.log(`\n${initialPlan.description}\n`);
console.log(`  branch:      ${branch}`);
console.log(`  tasks:       ${totalTasks}`);
console.log(`  iterations:  ${maxIterations}`);
console.log(`  model:       ${model ?? "(default)"}`);
console.log(`  quiet:       ${quiet}`);
console.log(`  plan:        ${planPath}`);
console.log(`  prompt:      ${promptPath}`);
console.log(`  progress:    ${progressPath}`);

const loopStart = Date.now();

let stuckCount = 0;

for (let iteration = 1; iteration <= maxIterations; iteration++) {
  const plan = await readPlan(planPath);
  const tasks = allTasks(plan);
  const remaining = tasks.filter((t) => !t.passes);

  if (remaining.length === 0) {
    console.log("All tasks complete!");
    break;
  }

  const before = tasks.filter((t) => t.passes).length;

  console.log(
    `\n[${iteration}/${maxIterations}] ${remaining.length} tasks remaining`,
  );

  const iterStart = Date.now();

  const prompt = promptTemplate
    .replaceAll("{{plan}}", path.resolve(planPath))
    .replaceAll("{{progress}}", path.resolve(progressPath));

  if (debug) {
    const preview = prompt.length > 200 ? prompt.slice(0, 200) + "..." : prompt;
    console.log(`[debug] prompt: ${preview}`);
    console.log(
      `[debug] spawning: ${engine}${model ? ` --model ${model}` : ""}`,
    );
  }

  const exitCode = await runEngine(engine, prompt, model, quiet);

  const iterElapsed = Math.round((Date.now() - iterStart) / 1000);

  if (exitCode !== 0) {
    console.error(`Engine exited ${exitCode} (${formatTime(iterElapsed)})`);
    stuckCount++;
    if (stuckCount >= 3) {
      console.log(`No progress for ${stuckCount} iterations, stopping.`);
      break;
    }
    continue;
  }

  // Check completion and stuck detection
  const after = await readPlan(planPath);
  const afterTasks = allTasks(after);
  const done = afterTasks.filter((t) => t.passes).length;
  console.log(
    `${done}/${afterTasks.length} tasks passing (${formatTime(iterElapsed)})`,
  );

  if (done === before) {
    stuckCount++;
    if (stuckCount >= 3) {
      console.log(`No progress for ${stuckCount} iterations, stopping.`);
      break;
    }
  } else {
    stuckCount = 0;
  }
}

const elapsed = Math.round((Date.now() - loopStart) / 1000);
const finalPlan = await readPlan(planPath);
const finalTasks = allTasks(finalPlan);
const passed = finalTasks.filter((t) => t.passes).length;
const failed = finalTasks.filter((t) => !t.passes);

console.log(
  `\n${passed}/${finalTasks.length} tasks passed in ${formatTime(elapsed)}`,
);
if (failed.length > 0) {
  console.log(`Failed: ${failed.map((t) => t.id).join(", ")}`);
}
