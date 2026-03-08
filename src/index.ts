#!/usr/bin/env bun
import path from "path";
import { isEngineName, runEngine, type EngineName } from "@/engines";
import * as v from "valibot";
import { PlanSchema, readPlan, allTasks } from "@/plan";

const engineFlags = ["--claude", "--codex", "--opencode", "--gemini"] as const;

function requireArg(args: string[], i: number, flag: string): string {
  const value = args[i];
  if (value === undefined) {
    console.error(`Missing value for ${flag}`);
    process.exit(1);
  }
  return value;
}

function printUsage(): void {
  console.log(`
insomniac: run AI agents in a loop against a task plan

Usage:
  insomniac [options]

Engine (default: claude):
  --claude               Use Claude Code
  --codex                Use Codex
  --opencode             Use OpenCode
  --gemini               Use Gemini CLI
  --model <name>         Override the default model

Options:
  --plan <path>          Plan file path (required)
  --progress <path>      Progress file path (default: progress.txt)
  --max-iterations <n>   Cap iterations (default: 10)
  --prompt <path>        Prompt template path (default: bundled prompts/coding.md)
`);
}

let engine: EngineName = "claude";
let planPath: string | undefined;
let maxIterations = 10;
let promptPath = path.resolve(import.meta.dir, "..", "prompts", "coding.md");
let progressPath = "progress.txt";
let model: string | undefined;

const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  const arg = args[i]!;
  const engineFlag = engineFlags.find((f) => f === arg);
  if (engineFlag) {
    const name = engineFlag.slice(2);
    if (isEngineName(name)) engine = name;
    continue;
  }
  switch (arg) {
    case "--plan":
    case "--spec":
      planPath = requireArg(args, ++i, "--plan");
      break;
    case "--max-iterations":
      maxIterations = parseInt(requireArg(args, ++i, "--max-iterations"), 10);
      break;
    case "--progress":
      progressPath = requireArg(args, ++i, "--progress");
      break;
    case "--prompt":
      promptPath = requireArg(args, ++i, "--prompt");
      break;
    case "--model":
      model = requireArg(args, ++i, "--model");
      break;
    case "--help":
    case "-h":
      printUsage();
      process.exit(0);
      break;
    default:
      console.error(`Unknown option: ${arg}`);
      printUsage();
      process.exit(1);
  }
}

if (!planPath) {
  console.error("Error: --plan is required\n");
  printUsage();
  process.exit(1);
}

const promptTemplate = await Bun.file(promptPath).text();

const initialPlan = v.parse(PlanSchema, await Bun.file(planPath).json());

const loopStart = Date.now();

const descPreview =
  initialPlan.description.length > 60
    ? initialPlan.description.slice(0, 57) + "..."
    : initialPlan.description;
console.log(
  `insomniac  ${engine}${model ? ` (${model})` : ""}  ${initialPlan.branchName}: ${descPreview}`,
);

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
    `\niteration ${iteration}/${maxIterations}  ${remaining.length} task(s) remaining`,
  );

  const iterStart = Date.now();

  const prompt = promptTemplate
    .replaceAll("{{plan}}", path.resolve(planPath))
    .replaceAll("{{progress}}", path.resolve(progressPath));
  const exitCode = await runEngine(engine, prompt, model);

  const iterElapsed = Math.round((Date.now() - iterStart) / 1000);

  if (exitCode !== 0) {
    console.error(
      `Engine exited ${exitCode} (${Math.floor(iterElapsed / 60)}m ${iterElapsed % 60}s)`,
    );
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
    `Progress: ${done}/${afterTasks.length} tasks passing (${Math.floor(iterElapsed / 60)}m ${iterElapsed % 60}s)`,
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

console.log(`\n--- Summary ---`);
console.log(`Passed: ${passed}/${finalTasks.length}`);
if (failed.length > 0) {
  console.log(`Failed: ${failed.map((t) => t.id).join(", ")}`);
}
console.log(`Elapsed: ${Math.floor(elapsed / 60)}m ${elapsed % 60}s`);
