// workflow/runner.js
// Runs Jest and returns structured results.  Agents call this; they do not
// invoke Jest directly.  The exit code, stdout, and stderr are all captured
// and stored — never discarded.

'use strict';

const { spawnSync } = require('child_process');
const path          = require('path');

/**
 * Run Jest against `testGlob` from `cwd`.
 *
 * @param {string} testGlob  - Glob or path passed to jest (e.g. 'src/cart.test.js')
 * @param {string} cwd       - Working directory (defaults to bugrep-ai/)
 * @returns {{ exitCode, passed, failed, output, error }}
 */
function runJest(testGlob, cwd) {
  cwd = cwd || path.resolve(__dirname, '..');

  // Use local jest from node_modules so the caller doesn't need a global install
  const jestBin = path.join(cwd, 'node_modules', '.bin', 'jest');

  const result = spawnSync(
    process.platform === 'win32' ? jestBin + '.cmd' : jestBin,
    [testGlob, '--no-coverage', '--json'],
    { cwd, encoding: 'utf8', shell: false }
  );

  const exitCode = result.status ?? 1;
  const stderr   = (result.stderr || '').trim();
  const stdout   = (result.stdout || '').trim();

  // jest --json writes to stdout when run programmatically
  let passed = 0, failed = 0, jsonParsed = false;
  let testResults = [];

  try {
    // jest may prefix json with non-json lines; find the first '{'
    const jsonStart = stdout.indexOf('{');
    if (jsonStart !== -1) {
      const jestJson = JSON.parse(stdout.slice(jsonStart));
      passed      = jestJson.numPassedTests  || 0;
      failed      = jestJson.numFailedTests  || 0;
      testResults = (jestJson.testResults || []).flatMap(s =>
        (s.testResults || []).map(t => ({
          name:    t.fullName,
          status:  t.status,
          message: t.failureMessages ? t.failureMessages.join('\n') : '',
        }))
      );
      jsonParsed = true;
    }
  } catch { /* fall through — raw output is still captured */ }

  // Distinguish dependency / syntax errors from assertion failures
  const errorType = classifyError(exitCode, stderr, stdout, jsonParsed, failed);

  return {
    exitCode,
    passed,
    failed,
    jsonParsed,
    testResults,
    errorType,   // 'none' | 'assertion' | 'syntax' | 'dependency' | 'environment'
    output: [stdout, stderr].filter(Boolean).join('\n---stderr---\n'),
    error:  result.error ? result.error.message : null,
  };
}

function classifyError(exitCode, stderr, stdout, jsonParsed, failed) {
  if (exitCode === 0) return 'none';
  if (result_mentions(stderr + stdout, /Cannot find module|MODULE_NOT_FOUND/))
    return 'dependency';
  if (result_mentions(stderr + stdout, /SyntaxError|Unexpected token/))
    return 'syntax';
  if (!jsonParsed && exitCode !== 0)
    return 'environment';
  if (failed > 0)
    return 'assertion';
  return 'environment';
}

function result_mentions(text, re) { return re.test(text); }

module.exports = { runJest };
