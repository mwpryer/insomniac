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

function command(engine: Engine, prompt: string): string[] {
  const model = engine.model ? ["--model", engine.model] : [];
  switch (engine.name) {
    case "claude":
      return [
        "claude",
        "-p",
        "--dangerously-skip-permissions",
        ...model,
        prompt,
      ];
    case "codex":
      return [
        "codex",
        "exec",
        "--dangerously-bypass-approvals-and-sandbox",
        ...model,
        prompt,
      ];
    case "opencode":
      return ["opencode", "run", "--auto", ...model, prompt];
    case "agy":
      // Print mode otherwise gives up after 5 minutes
      return [
        "agy",
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
): Promise<number> {
  const proc = Bun.spawn(command(engine, prompt), {
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  const log = Bun.file(logPath).writer();
  async function tee(
    stream: ReadableStream<Uint8Array>,
    terminal: NodeJS.WriteStream,
  ) {
    for await (const chunk of stream) {
      log.write(chunk);
      if (!quiet) {
        terminal.write(chunk);
      }
    }
  }
  await Promise.all([
    tee(proc.stdout, process.stdout),
    tee(proc.stderr, process.stderr),
  ]);
  await log.end();

  return proc.exited;
}
