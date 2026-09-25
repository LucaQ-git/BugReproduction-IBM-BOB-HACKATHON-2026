// orchestrator.js
// BugRep-AI — workflow coordinator
//
// This script is a RUNNER, not an agent.  It:
//   - Loads inputs and validates the environment.
//   - Prints the exact Bob task prompts you need to paste into the Bob IDE
//     chat panel for each agent stage.
//   - Reads .workflow-state.json to report what has actually been executed.
//
// The analysis, test writing, fix generation, and report authoring are done
// by IBM Bob (via start_subtask in Agent mode).  This script does NOT simulate
// or fake those steps.
//
// Usage:
//   node orchestrator.js              — print current state + next step guidance
//   node orchestrator.js --reset      — clear run state and start fresh
//   node orchestrator.js --run-tests  — run Jest directly and record result
//                                       (used by the Bob Fix Agent after patching)

'use strict';

require('dotenv').config();

const fs      = require('fs');
const path    = require('path');
const state   = require('./workflow/state');
const inputs  = require('./workflow/inputs');
const runner  = require('./workflow/runner');
const jira    = require('./workflow/jira');

const args = process.argv.slice(2);

// ─── --reset ─────────────────────────────────────────────────────────────────
if (args.includes('--reset')) {
  state.reset();
  console.log('✅ Workflow state cleared.  Run "node orchestrator.js" to begin again.');
  process.exit(0);
}

// ─── --run-tests ─────────────────────────────────────────────────────────────
// Used by the Fix Agent after it has written a patch to src/cart.js.
// Records the result in state and prints a summary.
if (args.includes('--run-tests')) {
  console.log('\n🧪 Running test suite against src/cart.js...\n');
  const result = runner.runJest('src/cart.test.js');

  if (result.error) {
    console.error('❌ Jest could not be launched:', result.error);
    console.error('   Make sure you have run "npm install" in the bugrep-ai/ directory.');
    process.exit(1);
  }

  const stage = state.load().stage;
  const key   = stage === 'fix' ? 'greenResult' : 'redResult';
  const bugReproduced = result.errorType === 'assertion' && result.failed > 0;

  state.save({
    [key]: {
      passed:     result.passed,
      failed:     result.failed,
      errorType:  result.errorType,
      testResults: result.testResults,
      output:     result.output,
    },
    ...(key === 'redResult' ? { bugReproduced } : {}),
  });

  console.log(`  Passed : ${result.passed}`);
  console.log(`  Failed : ${result.failed}`);
  console.log(`  Error  : ${result.errorType}`);

  if (result.errorType === 'dependency') {
    console.error('\n⚠️  Dependency error — this is NOT a bug reproduction.');
    console.error('   Run "npm install" and retry.');
    process.exit(1);
  }
  if (result.errorType === 'syntax') {
    console.error('\n⚠️  Syntax error in test or source file — fix the syntax first.');
    process.exit(1);
  }
  if (result.failed > 0 && result.errorType === 'assertion') {
    console.log('\n🔴 Bug reproduced — assertion failures confirm the defect.');
  } else if (result.failed === 0) {
    console.log('\n🟢 All tests passed.');
  }
  process.exit(result.failed > 0 ? 1 : 0);
}

// ─── Default: show status and guidance ───────────────────────────────────────
console.log('\n🤖 BugRep-AI — IBM Bob Workflow Coordinator');
console.log('═══════════════════════════════════════════\n');

// Load inputs — exit early with a clear message if files are missing
let ctx;
try {
  ctx = inputs.loadInputs();
} catch (err) {
  console.error('❌ Input loading failed:', err.message);
  process.exit(1);
}

const s = state.load();

console.log('📄 Document Understanding inputs loaded:');
console.log(`   Bug report : ${ctx.paths.bugReport}`);
console.log(`   Rules      : ${ctx.paths.rules}`);
console.log(`   Source     : ${ctx.paths.source}`);

console.log('\n🔑 Jira integration:', jira.isConfigured() ? '✅ configured' : '⚠️  not configured (manual entry only)');

console.log('\n─── Current workflow state ───────────────────────────────────');
console.log(`   Stage    : ${s.stage}`);
if (s.startedAt) console.log(`   Started  : ${s.startedAt}`);
if (s.updatedAt) console.log(`   Updated  : ${s.updatedAt}`);
if (s.redResult) {
  console.log(`   RED run  : ${s.redResult.passed} passed, ${s.redResult.failed} failed (${s.redResult.errorType})`);
}
if (s.greenResult) {
  console.log(`   GREEN run: ${s.greenResult.passed} passed, ${s.greenResult.failed} failed (${s.greenResult.errorType})`);
}
if (s.reportMd)   console.log(`   Report   : ${s.reportMd}`);

console.log('\n─── Next step ────────────────────────────────────────────────');

if (s.stage === 'idle' || !s.stage) {
  printStage1Prompt(ctx);
} else if (s.stage === 'test' && !s.bugReproduced && !s.redResult) {
  console.log('▶  Test Agent is in progress.  Check the Bob subtask panel.');
} else if (s.stage === 'test' && s.redResult) {
  if (!s.bugReproduced) {
    console.log('ℹ️  The Test Agent found no assertion failures (bug not reproduced).');
    console.log('   Review src/cart.test.js and the RED run output, then decide whether');
    console.log('   to refine the tests or close the issue.');
  } else {
    printStage2Prompt();
  }
} else if (s.stage === 'fix') {
  if (!s.fixApproved) {
    console.log('⏸  Waiting for your approval of the proposed diff.');
    console.log('   Review the diff shown by the Fix Agent in the Bob chat panel,');
    console.log('   then type "approve" to proceed.');
  } else if (!s.greenResult) {
    console.log('▶  Fix Agent is applying the patch and running tests.');
  } else {
    printStage3Prompt(s);
  }
} else if (s.stage === 'report') {
  console.log('▶  Report Agent is in progress.  Check the Bob subtask panel.');
} else if (s.stage === 'done') {
  console.log('🎉 Workflow complete.');
  if (s.reportMd) console.log(`   Report saved to: ${s.reportMd}`);
  console.log('\n   Run "node orchestrator.js --reset" to start a new run.');
} else if (s.stage === 'failed') {
  console.log('❌ Workflow stopped at a failure.  See .workflow-state.json for details.');
  console.log('   Run "node orchestrator.js --reset" to start a new run.');
}

console.log('');

// ─── Prompt templates ─────────────────────────────────────────────────────────

function printStage1Prompt(ctx) {
  console.log('STAGE 1 — Test Agent');
  console.log('────────────────────');
  console.log('Paste the following into the Bob IDE chat panel (Agent mode):\n');
  console.log('┌──────────────────────────────────────────────────────────────┐');
  console.log('│ Start a new subtask using the instructions in               │');
  console.log('│ bugrep-ai/agents/test-agent.md.                             │');
  console.log('│                                                              │');
  console.log('│ Bug report:                                                  │');
  console.log('│ ' + ctx.bugReport.replace(/\n/g, '\n│ ').padEnd(62) + '│');
  console.log('│                                                              │');
  console.log('│ When done, run in the terminal:                             │');
  console.log('│   cd bugrep-ai && node orchestrator.js --run-tests          │');
  console.log('└──────────────────────────────────────────────────────────────┘');
  console.log('\n   Then re-run "node orchestrator.js" to see the next step.');
}

function printStage2Prompt() {
  console.log('STAGE 2 — Fix Agent');
  console.log('───────────────────');
  console.log('Bug was reproduced.  Paste the following into Bob IDE chat (Agent mode):\n');
  console.log('┌──────────────────────────────────────────────────────────────┐');
  console.log('│ Start a new subtask using the instructions in               │');
  console.log('│ bugrep-ai/agents/fix-agent.md.                              │');
  console.log('│                                                              │');
  console.log('│ IMPORTANT: Show me the proposed diff before applying it.    │');
  console.log('│ I must approve the diff explicitly before you touch any     │');
  console.log('│ source file.                                                 │');
  console.log('│                                                              │');
  console.log('│ After I approve, run:                                        │');
  console.log('│   cd bugrep-ai && node orchestrator.js --run-tests          │');
  console.log('└──────────────────────────────────────────────────────────────┘');
}

function printStage3Prompt(s) {
  console.log('STAGE 3 — Report Agent');
  console.log('──────────────────────');
  if (s.greenResult && s.greenResult.failed === 0) {
    console.log('All tests passed after the fix.  Paste the following into Bob IDE chat:\n');
  } else {
    console.log('⚠️  Some tests still fail after the fix.  The report will document this.\n');
  }
  console.log('┌──────────────────────────────────────────────────────────────┐');
  console.log('│ Start a new subtask using the instructions in               │');
  console.log('│ bugrep-ai/agents/report-agent.md.                           │');
  console.log('│                                                              │');
  console.log('│ Use only actual artifacts from .workflow-state.json and     │');
  console.log('│ the files in src/, docs/, and fixtures/.                    │');
  console.log('│ Do not invent results for any step that did not run.        │');
  console.log('└──────────────────────────────────────────────────────────────┘');
}
