const engines = ["claude", "codex", "opencode", "gemini"] as const;
export type EngineName = (typeof engines)[number];

export function isEngineName(name: string): name is EngineName {
  return (engines as readonly string[]).includes(name);
}

type SpawnConfig = {
  cmd: string[];
  env?: Record<string, string>;
};

function buildSpawn(
  engine: EngineName,
  prompt: string,
  model?: string,
): SpawnConfig {
  switch (engine) {
    case "claude": {
      const cmd = ["claude", "-p", prompt, "--dangerously-skip-permissions"];
      if (model) cmd.push("--model", model);
      return { cmd };
    }
    case "codex": {
      const cmd = ["codex", "exec", "--full-auto"];
      if (model) cmd.push("--model", model);
      cmd.push(prompt);
      return { cmd };
    }
    case "opencode": {
      const cmd = ["opencode", "run"];
      if (model) cmd.push("--model", model);
      cmd.push(prompt);
      return { cmd, env: { OPENCODE_PERMISSION: '{"*":"allow"}' } };
    }
    case "gemini": {
      const cmd = ["gemini", "--yolo", "-p", prompt];
      if (model) cmd.push("--model", model);
      return { cmd };
    }
  }
}

export async function runEngine(
  engine: EngineName,
  prompt: string,
  model?: string,
): Promise<number> {
  const { cmd, env } = buildSpawn(engine, prompt, model);
  const proc = Bun.spawn(cmd, {
    cwd: process.cwd(),
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
    env: { ...process.env, ...env },
  });
  return proc.exited;
}
