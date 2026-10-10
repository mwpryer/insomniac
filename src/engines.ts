import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { constants } from "node:os";
import type { Readable } from "node:stream";

export const engineNames = ["claude", "codex", "opencode", "agy"] as const;
type EngineName = (typeof engineNames)[number];

export type Engine = { spec: string; name: EngineName; model: string | null };

export function parseEngine(spec: string): Engine {
  const colon = spec.indexOf(":");
  const head = colon === -1 ? spec : spec.slice(0, colon);
  const model = colon === -1 ? null : spec.slice(colon + 1);
  const name = engineNames.find((n) => n === head);
  if (!name) {
    throw new Error(
      `Unknown engine "${head}". Expected one of: ${engineNames.join(", ")}`,
    );
  }
  if (model === "") {
    throw new Error(`Engine "${spec}" has an empty model`);
  }

  return { spec, name, model };
}

function args(engine: Engine, prompt: string) {
  const model = engine.model ? ["--model", engine.model] : [];
  switch (engine.name) {
    case "claude":
      return ["-p", "--dangerously-skip-permissions", ...model, prompt];
    case "codex":
      return [
        "exec",
        "--dangerously-bypass-approvals-and-sandbox",
        ...model,
        prompt,
      ];
    case "opencode":
      return ["run", "--auto", ...model, prompt];
    case "agy":
      // Print mode otherwise gives up after 5 minutes
      return [
        "--dangerously-skip-permissions",
        "--print-timeout",
        "24h",
        ...model,
        "-p",
        prompt,
      ];
  }
}

export async function runSession(
  engine: Engine,
  prompt: string,
  logPath: string,
  quiet: boolean,
) {
  const proc = spawn(engine.name, args(engine, prompt), {
    stdio: ["ignore", "pipe", "pipe"],
  });
  const log = createWriteStream(logPath);
  async function tee(stream: Readable, terminal: NodeJS.WriteStream) {
    for await (const chunk of stream) {
      log.write(chunk);
      if (!quiet) {
        terminal.write(chunk);
      }
    }
  }
  const [exit] = await Promise.all([
    new Promise<number>((resolve, reject) => {
      proc.on("error", reject);
      // Signal set when code is null, reported as a shell does: 137 for SIGKILL
      proc.on("close", (code, signal) =>
        resolve(code ?? 128 + constants.signals[signal!]),
      );
    }),
    tee(proc.stdout, process.stdout),
    tee(proc.stderr, process.stderr),
  ]);
  await new Promise((resolve) => log.end(resolve));

  return exit;
}
