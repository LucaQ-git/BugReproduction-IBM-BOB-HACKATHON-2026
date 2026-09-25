# BugRep-AI — Project Context for IBM Bob

## What this project does

BugRep-AI is a bug reproduction and patch workflow.  Given a plain-English bug
report and business rules documentation, IBM Bob:

1. Writes regression tests that expose the reported defect (Test Agent).
2. Proposes and applies a minimal implementation fix (Fix Agent).
3. Produces a Markdown + JSON run report from actual artifacts (Report Agent).

## Repository layout

```
bugrep-ai/
├── agents/
│   ├── test-agent.md      ← Full instructions for the Test Agent subtask
│   ├── fix-agent.md       ← Full instructions for the Fix Agent subtask
│   └── report-agent.md    ← Full instructions for the Report Agent subtask
├── docs/
│   └── cart_rules.md      ← Authoritative business rules (source of truth)
├── fixtures/
│   └── bug_report.txt     ← Input bug report
├── reports/               ← Generated after Report Agent runs
├── src/
│   ├── cart.js            ← PRODUCTION implementation (Fix Agent writes here)
│   ├── cart.fixture.js    ← BUGGY reference copy (never edit — Test Agent tests against this)
│   └── cart.test.js       ← Regression tests (Test Agent writes here)
├── workflow/
│   ├── inputs.js          ← Loads bug report, rules, source
│   ├── runner.js          ← Runs Jest and returns structured results
│   ├── state.js           ← Persists run state to .workflow-state.json
│   └── jira.js            ← Jira integration interface (not yet connected)
└── orchestrator.js        ← Workflow coordinator — prints next-step guidance
```

## How to run

```bash
cd bugrep-ai
npm install
node orchestrator.js          # shows current state and next Bob task prompt
node orchestrator.js --reset  # start a fresh run
```

## Custom modes available

| Mode slug      | Name                  | Use for             |
|----------------|-----------------------|---------------------|
| bugrep-test    | 🔴 BugRep Test Agent  | Stage 1 — write and run tests |
| bugrep-fix     | 🔧 BugRep Fix Agent   | Stage 2 — propose and apply fix |
| bugrep-report  | 📋 BugRep Report Agent | Stage 3 — generate run report |

## Non-negotiable rules

- Test assertions must NEVER be weakened to make a failing test pass.
- `src/cart.fixture.js` must NEVER be modified — it is the permanent buggy reference.
- No fix may be applied to `src/cart.js` without user approval of the diff first.
- Test results must come from actual Jest runs — never be invented.
- Jira integration requires explicit user authorisation before any fetch.

## Agreed business rules (shopping cart)

See `docs/cart_rules.md` for the full list.  Summary:
- Empty cart → 0.
- Total never below 0.
- Negative/undefined discount → clamp to 0.
- NaN/Infinity discount → throw RangeError.
- Missing/negative item price → throw TypeError.
- Totals rounded to 2 decimal places.
