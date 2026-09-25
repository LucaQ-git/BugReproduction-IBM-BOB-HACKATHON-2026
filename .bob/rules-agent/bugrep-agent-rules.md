# BugRep-AI Rules — Agent Mode

- When asked to start a BugRep stage, use `start_subtask` with the matching
  instruction file as the message body.
- Use `spawn_subagent` (explore type) only for read-only codebase discovery.
- Always update `.workflow-state.json` via `workflow/state.js` — never hand-edit.
- After running `node orchestrator.js --run-tests`, read the console output and
  the updated state file before reporting results.
- Do not proceed from Stage 1 to Stage 2 unless `bugReproduced` is `true` in state.
- Do not proceed from Stage 2 to Stage 3 unless `fixApproved` is `true` in state.
