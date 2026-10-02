export const engineNames = ["claude", "codex", "opencode", "agy"] as const;
type EngineName = (typeof engineNames)[number];

export type Engine = { spec: string; name: EngineName; model: string | null };

export function parseEngine(spec: string): Engine {
  const [head, model] = spec.split(":", 2);
  const name = engineNames.find((n) => n === head);
  if (!name) {
    throw new Error(
      `Unknown engine "${head}". Expected one of: ${engineNames.join(", ")}`,
    );
  }
  return { spec, name, model: model ?? null };
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
      return ["agy", "--dangerously-skip-permissions", ...model, "-p", prompt];
  }
}

export async function runSession(
  engine: Engine,
  prompt: string,
  quiet: boolean,
): Promise<number> {
  const io = quiet ? "ignore" : "inherit";
  const proc = Bun.spawn(command(engine, prompt), {
    stdin: "ignore",
    stdout: io,
    stderr: io,
  });
  return proc.exited;
}
