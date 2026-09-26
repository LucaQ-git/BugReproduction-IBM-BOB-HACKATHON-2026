// workflow/bob-runner.js
// Invokes Bob Shell non-interactively for each workflow stage.
//
// Requires:
//   - Bob Shell installed and on PATH  (bob run --help should work)
//   - BOBSHELL_API_KEY set in the environment
//
// Each stage is driven by:
//   bob run --trust "<agent instructions>"
//
// bob run is already headless — it does not pause for approval.
// Authentication is handled automatically via the BOBSHELL_API_KEY env var —
// no --auth-method flag is required by this version of Bob Shell.
// The fix-approval gate is satisfied by the state file: the orchestrator
// writes proposedDiff + fixApproved:true before running the fix stage,
// which satisfies the Fix Agent's precondition check.

'use strict';

const { spawnSync } = require('child_process');
const fs            = require('path');
const path          = require('path');

const ROOT       = path.resolve(__dirname, '..');
const AGENTS_DIR = path.join(ROOT, 'agents');

/**
 * Run Bob Shell non-interactively with the given prompt.
 *
 * @param {string}  prompt        - The full prompt/instruction string
 * @param {object}  [options]
 * @param {string}  [options.cwd] - Working directory (defaults to bugrep-ai/)
 * @param {number}  [options.timeout] - Timeout in ms (default: 5 minutes)
 * @returns {{ exitCode: number, output: string, error: string|null }}
 */
function runBob(prompt, options) {
  options = options || {};
  const cwd     = options.cwd     || ROOT;
  const timeout = options.timeout || 5 * 60 * 1000; // 5 min default

  const apiKey = process.env.BOBSHELL_API_KEY;
  if (!apiKey) {
    return {
      exitCode: 1,
      output:   '',
      error:    'BOBSHELL_API_KEY environment variable is not set. ' +
                'Set it before running --auto mode.',
    };
  }

  // bob is a Node-installed global; on Windows it resolves fine via shell:true
  const result = spawnSync(
    'bob',
    [
      'run',
      '--trust',   // mark cwd as trusted so file tools are enabled
      prompt,
    ],
    {
      cwd,
      encoding: 'utf8',
      shell:    true,     // needed on Windows for PATH resolution
      timeout,
      env: { ...process.env },   // BOBSHELL_API_KEY is picked up from here
    }
  );

  const exitCode = result.status ?? 1;
  const stdout   = (result.stdout || '').trim();
  const stderr   = (result.stderr || '').trim();
  const output   = [stdout, stderr].filter(Boolean).join('\n---stderr---\n');
  const error    = result.error ? result.error.message : null;

  return { exitCode, output, error };
}

/**
 * Read an agent instruction file and return its contents as a string.
 * @param {'test-agent'|'fix-agent'|'report-agent'} agentName
 */
function loadAgentPrompt(agentName) {
  const filePath = path.join(AGENTS_DIR, `${agentName}.md`);
  if (!require('fs').existsSync(filePath)) {
    throw new Error(`Agent instruction file not found: ${filePath}`);
  }
  return require('fs').readFileSync(filePath, 'utf8').trim();
}

/**
 * Run the Test Agent stage via Bob Shell.
 */
function runTestAgent(options) {
  const prompt = loadAgentPrompt('test-agent');
  return runBob(prompt, options);
}

/**
 * Run the Fix Agent stage via Bob Shell.
 */
function runFixAgent(options) {
  const prompt = loadAgentPrompt('fix-agent') +
    '\n\n<!-- AUTO MODE: fixApproved is already set to true in state. ' +
    'Proceed directly to applying the fix without waiting for user input. -->';
  return runBob(prompt, options);
}

/**
 * Run the Report Agent stage via Bob Shell.
 */
function runReportAgent(options) {
  const prompt = loadAgentPrompt('report-agent');
  return runBob(prompt, options);
}

module.exports = { runBob, runTestAgent, runFixAgent, runReportAgent, loadAgentPrompt };
