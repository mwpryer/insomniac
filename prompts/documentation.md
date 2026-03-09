You are writing documentation from a plan file.

## Setup

1. Read `{{plan}}` to see all tasks
2. Read `{{progress}}` for context from previous iterations (if it exists). Look for a `## Documentation Conventions` section at the top. These are reusable style/format patterns discovered by previous iterations.

## Task selection

Tasks are grouped into phases. Work through phases in order, completing all tasks in a phase before moving to the next.

Pick ONE task where `"passes": false`:

1. Earlier tasks in the array (the plan author ordered them intentionally)
2. If you are stuck on the same task as the previous iteration (check progress file), try a different one

## Write

1. **Read source code first.** Accuracy depends on understanding the actual implementation. Read every file relevant to the topic before writing a single line of documentation.
2. Write or update doc files. Match existing tone and format if docs already exist. Include concrete examples (code snippets, CLI usage, config samples) — not just descriptions.
3. **Verify the task's `steps` array.** Go through each string in `steps` literally:
   - If a step says a file exists, confirm it does.
   - If a step says a topic is covered, confirm the doc file addresses it.
   - If a step says examples are present, confirm concrete examples exist in the output.
   - If ANY step fails, fix it. Do not mark the task as passing until every step is satisfied.
4. If a docs linter or link checker exists in the project, run it and fix any errors.
5. When done, update `{{plan}}`: set `"passes": true` for your task
6. Append a progress entry to `{{progress}}` using this template:
   ```
   ## iteration N: task-id
   - time: <current date and time>
   - what: <one line>
   - files: <comma-separated>
   - issues: <blockers or "none">
   - learnings: <gotchas, patterns discovered, useful context for future iterations, or "none">
   ```
   Keep entries concise. Sacrifice grammar for the sake of concision. This file helps future iterations skip exploration.
7. If you discovered durable, reusable knowledge (doc style conventions, terminology choices, structural patterns), consolidate it into the `## Documentation Conventions` section at the top of `{{progress}}` (create the section if absent).
8. Commit everything including `{{plan}}` and `{{progress}}`

## Rules

- **ONE TASK ONLY.** Write docs for a single task, commit it, then STOP. Do not continue to the next task. Do not read the plan again. Do not loop. After your single commit, you are done. Exit immediately.
- **Accuracy over speed.** Every claim must match the actual code. If you're unsure, read the source again. Never guess at behavior.
- **Do not modify source code.** Only create or edit documentation files.
- **Match existing doc style.** If docs already exist, follow the same structure, heading levels, and tone.
- **Keep docs concise and scannable.** Use short paragraphs, bullet lists, and code blocks. Avoid walls of text.
- If you cannot complete the task, do NOT mark it as passing
