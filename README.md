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

Write a plan, start a run, go to bed 😴. An orchestrator agent reads a plan and picks the next task. A worker agent does that one task in a fresh session and reports back. The harness appends the report to a progress file, then repeats until the plan is done. In the morning you have the work and a progress log to review.

If you know the [Ralph loop](https://ghuntley.com/ralph/), this is that idea with an orchestrator between the plan and the worker. It briefs the worker on one task, judges the result from the report and the code, and chooses the next task. The worker works from the brief alone and never needs the plan.

Each role can be a different CLI and model: Claude Code, Codex, OpenCode or Antigravity. A strong model can plan, judge and review while a cheaper one does the typing. A different model judging the worker's diff is less likely to share its blind spots. Splitting the roles across vendors also spreads usage across models and accounts. This also makes evaluating new models easy by trialling them in a known setting.

## Install

Requires [Bun](https://bun.sh) and at least one engine CLI installed and authenticated.

```bash
bun install
bun link
```

## Write a plan

A plan is a markdown file the orchestrator can work from. The bundled [`insomniac`](skills/insomniac/SKILL.md) skill writes one in the recommended shape: a preamble with goal, quality bar and verification commands, then phases of `- [ ] id: title` tasks with checkable steps under each.

The smallest plan is a goal with no tasks. The orchestrator breaks it into tasks on its first turn:

```bash
echo "All tests pass and lint is clean" > plan.md
insomniac plan.md
```

The plan is a living document. Edit it mid-run to add tasks, reopen wrong ones or change the quality bar. The orchestrator reads it fresh every turn.

The plan also sets the rules for version control. insomniac never touches git, so if you want a clean tree to start from, a commit per task or a particular branch, say so in the plan. The orchestrator passes those rules to every worker. Without them, agents do whatever their own configuration says.

Install the skill in your own projects with:

```bash
npx skills add mwpryer/insomniac
```

## Run

From the project directory:

```bash
insomniac plan.md
insomniac plan.md -o claude:fable -w agy -n 30
```

| Flag                                  | Default  | Meaning                              |
| ------------------------------------- | -------- | ------------------------------------ |
| `-o, --orchestrator <engine[:model]>` | `claude` | Engine that picks tasks              |
| `-w, --worker <engine[:model]>`       | `claude` | Engine that does tasks               |
| `-n, --attempts <n>`                  | `10`     | Cap on attempts in this run          |
| `-q, --quiet`                         |          | Hide engine output from the terminal |

Engines: `claude`, `codex`, `opencode`, `agy` (Antigravity). Everything after the first colon goes to the engine's `--model` flag unchanged, so use the form that CLI expects, for example `opencode:anthropic/claude-sonnet-4` or `agy:gemini-3.8-flash`.

> [!WARNING]
> Every session runs with permissions skipped. Run inside a sandbox for unattended work.

Everything a run writes lives in `.insomniac/` in the current directory, which ignores itself in git, so the tool adds nothing to your repo. `progress.md` collects every worker report across runs, each headed with its run folder and attempt number. Each run gets a folder under `runs/`, named by its start time, holding the exchange between orchestrator and worker:

```
.insomniac/runs/2026-10-06_00-37-00/
├── 001-brief.md           # orchestrator's instructions for attempt 1
├── 001-orchestrator-1.log
├── 001-report.md          # worker's feedback on attempt 1
├── 001-worker-1.log       # a retry adds 001-worker-2.log
└── 002-brief.md           # the last brief: done, blocked or the task the cap cut off
```

To resume, rerun the same command. The plan and `progress.md` carry over, and `-n` grants a fresh budget of attempts.

A session that exits non-zero has failed. If its role has not yet succeeded in the run, the run ends at once, since the cause is usually setup, such as a bad model name or missing auth. Later failures, usually a usage limit, get a fresh session with the same prompt. The wait between retries doubles from 1 minute up to 30 minutes, and a session still failing 6 hours after its first failure ends the run. Retries do not count as attempts.

The run ends when the orchestrator declares the plan done or blocked, or when the attempt cap is hit. It also ends with an error when a session fails as above, or the orchestrator writes no brief or an invalid one. Only a done plan exits 0.
