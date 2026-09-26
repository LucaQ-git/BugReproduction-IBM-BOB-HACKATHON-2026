# bugrep-ai

> Automated bug reproduction and regression patch generator powered by IBM Bob 2.0

## Usage

```bash
npx bugrep-ai
```

Run in any Node.js project directory. Works on any JavaScript file — not just shopping carts.

## Quick start

```bash
# Scaffold a new project with sample files
npx bugrep-ai --init

# Run on your project (auto-detects source file and bug report)
npx bugrep-ai

# Point at specific files
npx bugrep-ai --source src/checkout.js --report bugs/issue-42.txt

# Get help
npx bugrep-ai --help
```

## How it works

1. Reads your bug report and source file
2. Uses AI to write a strict Jest test that reproduces the bug → **RED**
3. Uses AI to generate a minimal fix
4. Re-runs the test suite → **GREEN**
5. If the first fix fails, automatically retries with the Jest failure output as context (max 1 retry)

## Bug report file

Create one of these in your project:

```
bug_report.txt
fixtures/bug_report.txt
```

Example:
```
Bug Report: The checkout total goes negative when a discount code greater
than 100% is applied to a non-empty cart. Expected: total clamped to $0.00.
```

## AI backends

BugRep-AI supports three modes — set credentials in `.env` or as environment variables:

### IBM Bob CLI (recommended for IBM Bob users)
```
BOBSHELL_API_KEY=your_bob_api_key
```

### IBM watsonx.ai (Granite 3 8B Instruct)
```
WATSONX_API_KEY=your_ibm_cloud_api_key
WATSONX_PROJECT_ID=your_watsonx_project_id
```

### Demo mode
No configuration needed. Scaffolds a test file but does not apply an AI patch.

## Options

| Flag | Description |
|------|-------------|
| `--init` | Scaffold a new project with sample files |
| `--source <file>` | Path to the source file to fix |
| `--report <file>` | Path to the plain-text bug report |
| `--help` | Show help |

## First-run behaviour

If no bug report or source file is found, `npx bugrep-ai` automatically creates
sample scaffold files in your project so you always get a working starting point.

## License

MIT
