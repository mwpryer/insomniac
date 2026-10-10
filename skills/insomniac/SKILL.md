---
name: insomniac
description: Plan, start and review insomniac runs. Use when the user mentions insomniac or a ralph loop, wants work broken into tasks for fresh agent sessions, or asks how a run went.
---

# Insomniac

insomniac runs coding agents through a plan, one task per fresh session. An orchestrator owns the plan: it briefs each attempt, judges the result and edits the plan as the run teaches it. A worker does one task from its brief, never sees the plan, and writes a report. The harness only starts sessions and records reports, and never touches git.

## Write a plan

Each attempt is a fresh session with no memory, so the plan carries what nobody can infer from the codebase: intent, quality bar, verification. The orchestrator works the open tasks in plan order, marks them done or blocked, and splits and reorders them as the run teaches it, so write for a reader who will edit it, not a script.

1. Read the source of intent: the PRD, issue or request. Then read the codebase for conventions, tooling and the commands that verify work. A plan written without reading the code produces tasks the code contradicts
2. Write the preamble: goal, quality bar, verification commands, constraints, out of scope
3. Break the work into phases in dependency order, and tasks within them. Phase 1 is a tracer bullet: the thinnest path through every layer, working end to end. Risky and unknown work goes before safe work
4. Size every task against the test below. Split any that fail
5. Save it where the user keeps plans, `plan.md` at the repo root unless they say otherwise, and show the task list

### Sizing test

A task fits when all four hold:

- One attempt can finish it and verify it
- It is one change a reviewer can read in a few minutes
- Every verification step is literally checkable: a file exports X, a command exits 0, a page shows Y. "Works correctly" is not a step
- It depends only on tasks before it in the plan

Too small is cheaper than too large. A large task burns attempts until the orchestrator splits it.

### Format

```markdown
# <Goal in one line>

<One paragraph: what we are building and why. Link the PRD if one exists.>

## Quality bar

<Prototype or production. Tests expected or not. Conventions the code must follow, or a pointer to the file that states them.>

## Verify

<Commands every task must leave passing, one per line: `bun test`, `bun run lint`, `tsc --noEmit`.>

## Constraints

<Libraries to use or avoid, files not to touch, decisions already made. Version control rules, such as a commit per task or a branch to work on, since insomniac never touches git.>

## Out of scope

<What a worker might reasonably add and must not.>

## Phase 1: <tracer bullet>

- [ ] <id>: <title>
  - <verification step>
  - <verification step>
- [ ] <id>: <title>
  - <verification step>

## Phase 2: <name>

- [ ] <id>: <title>
  - <verification step>
```

Ids are short kebab-case and unique across the plan, since they head the briefs and progress entries.

### Other kinds of run

The format is the same. Only the preamble and the steps change:

- Documentation: quality bar names the doc style to match, verify names the link checker or docs build, constraints forbid source changes, each step names a topic the doc covers, with an example
- Tests: goal names the coverage target, verify is the test command, each task is one module or behaviour, each step names a case the test asserts
- Refactor or cleanup: each task is one mechanical change, verify is the full check suite, steps name the symbols to remove

## Start a run

1. Check `.insomniac/progress.md` in the directory the run starts from. If it holds reports from another plan, have the user move it aside. Every run in a directory shares it, so the orchestrator would read those reports as this plan's history
2. Check `git status`. Uncommitted work is exposed to the workers unless the plan's constraints protect it, so point out any before the run
3. Give the user the command to run in their own terminal, inside a sandbox: `insomniac <plan>` with any engines and attempt cap they want, from `insomniac --help`. Every session skips permissions, and a run lasts hours, longer than this session

To resume, the user reruns the same command. The plan and progress carry over and the attempt cap starts fresh.

## Review a run

The orchestrator judged every attempt. The review is the user's check on the orchestrator.

1. Open the run the user names, or the newest folder in `.insomniac/runs/`, which are named by start time. Each attempt's brief, report and session logs share its three-digit prefix
2. Read the last brief for how the run ended: `status: done` with a summary, `status: blocked` with the reason, or the task the attempt cap cut off. A run that ended on an error has no valid last brief, so read the newest log
3. Read the plan for the tasks marked done or blocked and the notes the orchestrator left. Read `.insomniac/progress.md` for the reports, each headed `## <task id> (<run>/<attempt>)`
4. Check every task the run marked done against the code: run the plan's verify commands and read the files its reports name
5. Report to the user by task: verified, blocked with its reason, or marked done but failing a check. Name the tasks that took several attempts and the learnings the reports repeat

Done when every task the run touched has one of those verdicts.
