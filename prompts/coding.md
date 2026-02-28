You are implementing tasks from a spec file.

## Setup

1. Read `{{spec}}` to see all tasks
2. Read `{{progress}}` for context from previous iterations (if it exists). Look for a `## Codebase Patterns` section at the top. These are reusable patterns discovered by previous iterations.

## Task selection

Pick ONE task where `"passes": false`, using these priorities:

1. **Infrastructure first, then tracer bullets**: prefer tasks with `category: "infrastructure"` first. After those, prefer tasks that cut a thin vertical slice through the system (e.g. a single end-to-end path). Getting one slice working proves the architecture, then broaden out.
2. Earlier tasks in the array (the spec author ordered them intentionally)
3. If you are stuck on the same task as the previous iteration (check progress file), try a different one

## Implement

1. Implement the task
2. Run the project's lint, format, and test commands. Fix failures before committing.
3. **Verify the task's `steps` array.** Go through each string in `steps` literally:
   - If a step says a file exports something, confirm the export exists in the source.
   - If a step says a command passes, run it and check.
   - If a step says a file exists, confirm it does.
   - If ANY step fails, fix it. Do not mark the task as passing until every step is satisfied.
4. If the task changes UI, verify visually using available browser tools. If no browser tools are available, note in the progress entry that manual UI verification is needed.
5. When done, update `{{spec}}`: set `"passes": true` for your task
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
7. If you discovered durable, reusable knowledge (API conventions, gotchas, file dependencies), consolidate it into the `## Codebase Patterns` section at the top of `{{progress}}` (create the section if absent). Also consider updating nearby CLAUDE.md files with general knowledge. Check with the user before adding.
8. Commit everything including `{{spec}}` and `{{progress}}`

## Rules

- **ONE TASK ONLY.** Implement a single task, commit it, then STOP. Do not continue to the next task. Do not read the spec again. Do not loop. After your single commit, you are done. Exit immediately.
- **Keep changes small and focused.**
  - One logical change per commit
  - If a task feels too large, mentally break it into sequential steps and work through them one at a time (still one spec task per session)
  - Prefer multiple small commits over one large commit
  - Run feedback loops after each change, not at the end
  - Quality over speed. Small steps compound into big progress.
- If something breaks, `git revert` or `git checkout -- .` to recover
- If you cannot complete the task, do NOT mark it as passing
