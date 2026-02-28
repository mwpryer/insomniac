# Insomniac

Run AI agents in a loop against a task spec.

## Install

```bash
bun install
bun link    # optional, makes `insomniac` available globally
```

Requires [Bun](https://bun.sh) and at least one supported engine CLI installed and authenticated.

## Usage

```bash
insomniac --spec spec.json
insomniac --gemini --spec spec.json --max-iterations 5
```

### Engines

| Flag                 | Engine      | CLI        |
| -------------------- | ----------- | ---------- |
| `--claude` (default) | Claude Code | `claude`   |
| `--codex`            | Codex       | `codex`    |
| `--opencode`         | OpenCode    | `opencode` |
| `--gemini`           | Gemini CLI  | `gemini`   |

### Options

| Flag                   | Default                     | Description               |
| ---------------------- | --------------------------- | ------------------------- |
| `--spec <path>`        | (required)                  | Spec file path            |
| `--max-iterations <n>` | `10`                        | Stop after n iterations   |
| `--progress <path>`    | `progress.txt`              | Progress file path        |
| `--prompt <path>`      | bundled `prompts/coding.md` | Prompt template path      |
| `--model <name>`       | engine default              | Override the engine model |

## Spec format

```json
{
  "branchName": "feat/setup-project",
  "description": "Initialise the project scaffolding",
  "tasks": [
    {
      "id": "setup",
      "passes": false,
      "category": "infrastructure",
      "description": "Initialise the project",
      "steps": ["package.json exists", "tsconfig.json has strict mode"]
    }
  ]
}
```

The agent is expected to set `passes` to `true` in the spec file when a task is verified complete.

## How it works

Each iteration, insomniac reads the spec from disk, finds remaining incomplete tasks, substitutes the spec and progress file paths into the prompt template, and shells out to the chosen engine. The engine runs with full auto-accept permissions. After each invocation, it re-reads the spec to check progress. The loop exits when all tasks pass or the iteration cap is hit.
