# BugRep-AI Rules — All Modes

- This project uses a three-stage workflow: Test Agent → Fix Agent → Report Agent.
- Each stage has a dedicated instruction file in `bugrep-ai/agents/`.
- Always read the relevant agent instruction file before starting a stage.
- Run state is stored in `.workflow-state.json` — read it before acting, update it after.
- Never weaken test assertions (`toBe`, `toEqual`, `toThrow` must remain strict).
- Never modify `src/cart.fixture.js` — it is the immutable buggy reference.
- Never apply a code fix without showing the diff and receiving explicit user approval.
- Never invent test results — run Jest and report actual output.
- Jira integration is not yet active — do not attempt to connect or fetch issues.
