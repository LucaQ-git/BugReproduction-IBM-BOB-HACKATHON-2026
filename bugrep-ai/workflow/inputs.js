// workflow/inputs.js
// Loads all document-understanding inputs: bug report, business rules,
// source file under inspection, and optional Jira issue stub.
// Agents call this to get a clean context object.

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function loadInputs(options) {
  options = options || {};

  const bugReportPath = options.bugReportPath
    || path.join(ROOT, 'fixtures', 'bug_report.txt');
  const rulesPath = options.rulesPath
    || path.join(ROOT, 'docs', 'cart_rules.md');
  const sourceFile = options.sourceFile
    || path.join(ROOT, 'src', 'cart.js');

  const missing = [];
  if (!fs.existsSync(bugReportPath)) missing.push(bugReportPath);
  if (!fs.existsSync(rulesPath))     missing.push(rulesPath);
  if (!fs.existsSync(sourceFile))    missing.push(sourceFile);
  if (missing.length) {
    throw new Error(`Missing required input files:\n  ${missing.join('\n  ')}`);
  }

  return {
    bugReport:  fs.readFileSync(bugReportPath, 'utf8').trim(),
    rules:      fs.readFileSync(rulesPath, 'utf8').trim(),
    sourceCode: fs.readFileSync(sourceFile, 'utf8').trim(),
    paths: {
      bugReport: bugReportPath,
      rules:     rulesPath,
      source:    sourceFile,
    },
    // Jira stub — populated only when Jira integration is configured and user
    // has explicitly authorised a fetch.  See workflow/jira.js.
    jiraIssue: null,
  };
}

module.exports = { loadInputs };
