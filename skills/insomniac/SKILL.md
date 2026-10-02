---
name: insomniac
description: Write a plan file for an insomniac run from a PRD, a request, or a codebase. Use when the user mentions insomniac, a ralph loop, or wants work broken into tasks for fresh agent sessions.
---

# Insomniac

A plan is a markdown file an orchestrator agent owns during a run. Each task becomes one fresh worker session with no memory, so the plan carries what a session cannot infer from the codebase: intent, quality bar, verification. The orchestrator ticks, splits and reorders tasks as the run teaches it, so write for a reader who will edit it, not a script.

## Steps

1. Read the source of intent: the PRD, issue or request. Then read the codebase for conventions, tooling and the commands that verify work. A plan written without reading the code produces tasks the code contradicts
2. Write the preamble: goal, quality bar, verification commands, constraints, out of scope
3. Break the work into phases in dependency order, and tasks within them. Phase 1 is a tracer bullet: the thinnest path through every layer, working end to end. Risky and unknown work goes before safe work
4. Size every task against the test below. Split any that fail
5. Save it beside the code it changes, `plan.md` at the repo root unless the user says otherwise, and show the task list. The run needs a clean tree, so commit the plan before `insomniac plan.md` starts

## Sizing test

A task fits when all four hold:

- One fresh session with no prior context can finish it and verify it
- It is one commit a reviewer can read in a few minutes
- Every verification step is literally checkable: a file exports X, a command exits 0, a page shows Y. "Works correctly" is not a step
- It depends only on tasks before it in the plan

Too small is cheaper than too large. A large task fails twice, then the orchestrator spends a turn splitting it.

## Format

```markdown
# <Goal in one line>

<One paragraph: what we are building and why. Link the PRD if one exists.>

## Quality bar

<Prototype or production. Tests expected or not. Conventions the code must follow, or a pointer to the file that states them.>

## Verify

<Commands every task must leave passing, one per line: `bun test`, `bun run lint`, `tsc --noEmit`.>

## Constraints

<Libraries to use or avoid, files not to touch, decisions already made.>

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

Ids are short kebab-case and unique across the plan, since they become commit messages and progress headings. The orchestrator marks a task it cannot finish as `- [ ] <id>: <title> (blocked: <reason>)`.

## Other kinds of run

The format is the same. Only the preamble and the steps change:

- Documentation: quality bar names the doc style to match, verify names the link checker or docs build, constraints forbid source changes, each step names a topic the doc covers, with an example
- Tests: goal names the coverage target, verify is the test command, each task is one module or behaviour, each step names a case the test asserts
- Refactor or cleanup: each task is one mechanical change, verify is the full check suite, steps name the symbols to remove
