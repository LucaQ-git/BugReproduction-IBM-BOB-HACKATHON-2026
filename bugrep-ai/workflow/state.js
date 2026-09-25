// workflow/state.js
// Persists workflow run state to disk so each agent stage can read what the
// previous stage produced.  All agents read/write through this module.

'use strict';

const fs   = require('fs');
const path = require('path');

const STATE_FILE = path.resolve(__dirname, '../.workflow-state.json');

/** Return the current state object, or a blank slate if no run exists. */
function load() {
  if (!fs.existsSync(STATE_FILE)) return blank();
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return blank();
  }
}

/** Merge `updates` into the current state and persist to disk. */
function save(updates) {
  const current = load();
  const next = { ...current, ...updates, updatedAt: new Date().toISOString() };
  fs.writeFileSync(STATE_FILE, JSON.stringify(next, null, 2));
  return next;
}

/** Wipe the state file and start fresh. */
function reset() {
  if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE);
}

function blank() {
  return {
    runId:       null,
    startedAt:   null,
    updatedAt:   null,
    stage:       'idle',      // idle | test | fix | report | done | failed
    bugReport:   null,        // raw text of the loaded bug report
    rules:       null,        // raw text of the loaded business rules
    // Test-agent outputs
    testFile:    null,        // relative path to the written test file
    redResult:   null,        // { passed, failed, output } from the first jest run
    bugReproduced: null,      // boolean — did any test actually fail?
    // Fix-agent outputs
    proposedDiff:  null,      // unified diff string shown to the user for approval
    fixApproved:   false,
    patchedFile:   null,      // relative path to the patched implementation
    greenResult:   null,      // { passed, failed, output } from the second jest run
    // Report-agent outputs
    reportMd:    null,        // relative path to the markdown report
    reportJson:  null,        // relative path to the JSON report
    // Any honest failure notes
    notes:       [],
  };
}

module.exports = { load, save, reset };
