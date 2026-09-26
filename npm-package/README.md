# bugrep-ai

> Automated bug reproduction and regression patch generator powered by IBM Bob 2.0

## Usage

```bash
npx bugrep-ai
```

Run this in any Node.js project directory that contains a bug report file.

## Bug report file

Create one of these files in your project:

```
bug_report.txt
fixtures/bug_report.txt
```

Example content:
```
Bug Report: The cart total becomes negative when applying a discount greater
than 100% to a non-empty cart. Expected: total clamped to $0.00.
```

## AI backends

BugRep-AI supports three modes:

### IBM Bob CLI (recommended for hackathon)
Install IBM Bob IDE and set:
```
BOBSHELL_API_KEY=your_bob_api_key
```

### IBM watsonx.ai (Granite)
```
WATSONX_API_KEY=your_ibm_cloud_api_key
WATSONX_PROJECT_ID=your_watsonx_project_id
```

### Demo mode
No configuration needed. Runs a hardcoded demo workflow to show the red→green loop.

## What it does

1. Locates your bug report and source file
2. Writes a strict Jest test that reproduces the bug (RED)
3. Uses AI to generate a patch
4. Re-runs the test suite until it passes (GREEN)

## License

MIT
