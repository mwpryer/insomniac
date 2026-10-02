<p align="center">
  <img src="assets/insomniac.png" alt="insomniac" width="192">
</p>

<h1 align="center">insomniac</h1>

<p align="center">A runner that takes coding agents through a plan, one task per session.</p>

<p align="center">
  <a href="skills/insomniac/SKILL.md"><img src="https://img.shields.io/badge/agent-ready-brightgreen" alt="agent-ready"></a>
  <a href="https://github.com/mwpryer/insomniac/stargazers"><img src="https://img.shields.io/github/stars/mwpryer/insomniac" alt="GitHub stars"></a>
</p>

> [!IMPORTANT]
> This project is under active development. Expect breaking changes before v1.0.

Write a plan, start a run, go to bed 😴. An orchestrator agent reads a plan and picks the next task. A worker agent does that one task in a fresh session and reports back. The harness commits after each task and appends the report to a progress file, then repeats until the plan is done. In the morning you have a branch of small commits and a progress log to review.

If you know the [Ralph loop](https://ghuntley.com/ralph/), this is that idea with an orchestrator between the plan and the worker. It briefs the worker on one task, judges the result from the report and diff, and chooses the next task. The worker never sees the plan.

Each role can be a different CLI and model: Claude Code, Codex, OpenCode or Antigravity. A strong model can plan, judge and review while a cheaper one does the typing. A different model judging the worker's diff is less likely to share its blind spots. Splitting the roles across vendors also spreads usage across models and accounts. This also makes evaluating new models easy by trialling them in a known setting.

## Install

Requires [Bun](https://bun.sh) and at least one engine CLI installed and authenticated. A run must start inside a git repo with a clean tree.

```bash
bun install
bun link
```

## Write a plan

A plan is a markdown file the orchestrator can work from. The bundled [`insomniac`](skills/insomniac/SKILL.md) skill writes one in the recommended shape: a preamble with goal, quality bar and verification commands, then phases of `- [ ] id: title` tasks with checkable steps under each.

The plan is a living document. Edit it mid-run to add tasks, untick wrong ones or change the quality bar. The orchestrator reads it fresh every turn.

Install the skill in your own projects with:

```bash
npx skills add mwpryer/insomniac
```

## Run

Check out the branch you want the commits on, then:

```bash
insomniac plan.md
insomniac plan.md -o claude:fable -w agy -n 30
```

| Flag                                  | Default  | Meaning                 |
| ------------------------------------- | -------- | ----------------------- |
| `-o, --orchestrator <engine[:model]>` | `claude` | Engine that picks tasks |
| `-w, --worker <engine[:model]>`       | `claude` | Engine that does tasks  |
| `-n, --sessions <n>`                  | `10`     | Cap on worker sessions  |
| `-q, --quiet`                         |          | Hide engine output      |

Engines: `claude`, `codex`, `opencode`, `agy` (Antigravity). The model goes to the engine's `--model` flag unchanged, so use the form that CLI expects, for example `opencode:anthropic/claude-sonnet-4` or `agy:gemini-3.8-flash`.

> [!WARNING]
> Every session runs with permissions skipped. Run inside a sandbox for unattended work.

Agents commit their own work, so commits follow whatever style your agent is configured for. Anything a session leaves uncommitted is stashed, never committed, and the orchestrator treats the task as not done. Everything a run writes lives in `.insomniac/`, which is ignored by git, so the tool adds nothing to your repo: the brief and report passed between sessions, and `progress.md`, where worker reports accumulate.

The run ends when the orchestrator declares the plan done or blocked, when the session cap is hit, or when the orchestrator exits non-zero.
