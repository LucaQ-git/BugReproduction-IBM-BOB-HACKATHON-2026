'use strict';

require('dotenv').config();

const fs             = require('fs');
const path           = require('path');
const { execSync }   = require('child_process');

const BOLD   = '\x1b[1m';
const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const CYAN   = '\x1b[36m';
const YELLOW = '\x1b[33m';
const RESET  = '\x1b[0m';

const cwd  = process.cwd();
const args = process.argv.slice(2);

// ── --help ────────────────────────────────────────────────────────────────────
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
${BOLD}bugrep-ai${RESET} — Automated bug reproduction & patch generator (IBM Bob 2.0)

${BOLD}Usage:${RESET}
  npx bugrep-ai [options]

${BOLD}Options:${RESET}
  --source <file>   Path to the source file to analyse and fix
  --report <file>   Path to the plain-text bug report
  --init            Scaffold a new bugrep-ai project in the current directory
  --help            Show this help message

${BOLD}Examples:${RESET}
  npx bugrep-ai
  npx bugrep-ai --source src/checkout.js --report bugs/issue-42.txt
  npx bugrep-ai --source lib/auth.js --report bug_report.txt
  npx bugrep-ai --init

${BOLD}AI backends (set in .env or environment):${RESET}
  BOBSHELL_API_KEY              IBM Bob CLI (recommended)
  WATSONX_API_KEY +
  WATSONX_PROJECT_ID            IBM watsonx.ai Granite
  (neither)                     Demo mode — scaffold only, no AI patch
`);
  process.exit(0);
}

// ── --init ────────────────────────────────────────────────────────────────────
// Scaffold a fresh bugrep-ai project in the current directory.
if (args.includes('--init')) {
  console.log(`\n${BOLD}🤖 BugRep-AI — Project Scaffold${RESET}`);
  console.log('─────────────────────────────────\n');
  scaffold(cwd, { verbose: true, force: true });
  console.log(`\n${GREEN}${BOLD}✅ Project scaffolded.${RESET}`);
  console.log(`\nNext steps:`);
  console.log(`  1. Edit ${CYAN}fixtures/bug_report.txt${RESET} with your real bug description`);
  console.log(`  2. Replace ${CYAN}src/your-file.js${RESET} with the code that contains the bug`);
  console.log(`  3. Set ${CYAN}BOBSHELL_API_KEY${RESET} or ${CYAN}WATSONX_API_KEY + WATSONX_PROJECT_ID${RESET} in .env`);
  console.log(`  4. Run ${CYAN}npx bugrep-ai${RESET} to start the workflow\n`);
  process.exit(0);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const getArg = (flag) => {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : null;
};

// Scaffold missing project files — called on --init and on first run
function scaffold(dir, opts) {
  opts = opts || {};
  const verbose = opts.verbose || false;
  const force   = opts.force   || false;

  const fixturesDir = path.join(dir, 'fixtures');
  const docsDir     = path.join(dir, 'docs');
  const srcDir      = path.join(dir, 'src');

  if (!fs.existsSync(fixturesDir)) fs.mkdirSync(fixturesDir, { recursive: true });
  if (!fs.existsSync(docsDir))     fs.mkdirSync(docsDir,     { recursive: true });
  if (!fs.existsSync(srcDir))      fs.mkdirSync(srcDir,      { recursive: true });

  const bugReportPath = path.join(fixturesDir, 'bug_report.txt');
  const rulesPath     = path.join(docsDir,     'cart_rules.md');
  const srcPath       = path.join(srcDir,      'cart.js');
  const fixturePath   = path.join(srcDir,      'cart.fixture.js');
  const envPath       = path.join(dir,         '.env.example');

  if (force || !fs.existsSync(bugReportPath)) {
    fs.writeFileSync(bugReportPath,
      'Bug Report: The cart total becomes incorrect or yields NaN/negative values\n' +
      'when applying a discount to an empty cart or when items array is empty.\n'
    );
    if (verbose) console.log(`  📝 fixtures/bug_report.txt`);
  }

  if (force || !fs.existsSync(rulesPath)) {
    fs.writeFileSync(rulesPath,
      '# Business Rules\n\n' +
      '1. Subtotals are calculated from item prices.\n' +
      '2. Totals must NEVER drop below 0, even with discounts applied.\n' +
      '3. An empty items list must always return a total of 0.\n'
    );
    if (verbose) console.log(`  📝 docs/cart_rules.md`);
  }

  if (force || !fs.existsSync(srcPath)) {
    fs.writeFileSync(srcPath,
      '// src/cart.js — replace this with your real source file\n' +
      'function calculateTotal(items, discountPercentage) {\n' +
      '  let subtotal = items.reduce((sum, item) => sum + item.price, 0);\n' +
      '  // BUG: empty cart + discount yields NaN\n' +
      '  let discount = (subtotal * discountPercentage) / 100;\n' +
      '  return subtotal - discount;\n' +
      '}\n' +
      'module.exports = { calculateTotal };\n'
    );
    if (verbose) console.log(`  📝 src/cart.js`);
  }

  if (force || !fs.existsSync(fixturePath)) {
    fs.copyFileSync(srcPath, fixturePath);
    if (verbose) console.log(`  📝 src/cart.fixture.js`);
  }

  if (!fs.existsSync(envPath)) {
    fs.writeFileSync(envPath,
      '# IBM Bob Shell API key (IBM Bob CLI backend)\n' +
      'BOBSHELL_API_KEY=\n\n' +
      '# IBM watsonx.ai backend (alternative to Bob CLI)\n' +
      'WATSONX_API_KEY=\n' +
      'WATSONX_PROJECT_ID=\n'
    );
    if (verbose) console.log(`  📝 .env.example`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log(`\n${BOLD}🤖 BugRep-AI${RESET} — IBM Bob 2.0`);
console.log('─────────────────────────────\n');

// ── Locate bug report ─────────────────────────────────────────────────────────
const reportArg          = getArg('--report');
const bugReportCandidates = reportArg
  ? [reportArg]
  : ['bug_report.txt', 'fixtures/bug_report.txt'];

let bugReportPath = null;
for (const c of bugReportCandidates) {
  const full = path.resolve(cwd, c);
  if (fs.existsSync(full)) { bugReportPath = full; break; }
}

// Auto-scaffold if nothing found and no explicit --report given
if (!bugReportPath && !reportArg) {
  console.log(`${YELLOW}ℹ️  No project files found — scaffolding sample project...${RESET}\n`);
  scaffold(cwd, { verbose: true });
  console.log(`\n${YELLOW}Sample files created. Edit them then re-run: ${BOLD}npx bugrep-ai${RESET}\n`);
  process.exit(0);
}

if (!bugReportPath) {
  console.error(`${RED}❌ Bug report not found: ${reportArg}${RESET}`);
  process.exit(1);
}

const bugReport = fs.readFileSync(bugReportPath, 'utf8').trim();
console.log(`${CYAN}📄 Bug report:${RESET} ${path.relative(cwd, bugReportPath)}`);
console.log(`   ${bugReport.split('\n')[0].slice(0, 80)}${bugReport.length > 80 ? '…' : ''}\n`);

// ── Locate source file ────────────────────────────────────────────────────────
const sourceArg = getArg('--source');
let sourcePath  = null;

if (sourceArg) {
  const full = path.resolve(cwd, sourceArg);
  if (!fs.existsSync(full)) {
    console.error(`${RED}❌ Source file not found: ${sourceArg}${RESET}`);
    process.exit(1);
  }
  sourcePath = full;
} else {
  const candidates = findJsFiles(cwd);
  if (candidates.length === 0) {
    console.error(`${RED}❌ No JavaScript source files found.${RESET}`);
    console.error(`   Use: ${BOLD}npx bugrep-ai --source path/to/your/file.js${RESET}`);
    process.exit(1);
  }
  sourcePath = candidates.length === 1
    ? candidates[0]
    : pickBestCandidate(candidates, bugReport);

  if (candidates.length > 1) {
    console.log(`${YELLOW}ℹ️  Multiple source files found. Using: ${path.relative(cwd, sourcePath)}${RESET}`);
    console.log(`   To specify: ${BOLD}npx bugrep-ai --source <file>${RESET}\n`);
  }
}

console.log(`${CYAN}📂 Source file:${RESET} ${path.relative(cwd, sourcePath)}\n`);

// ── Detect AI backend ─────────────────────────────────────────────────────────
const hasBob = (() => {
  try { execSync('bob --version', { stdio: 'pipe' }); return true; }
  catch { return false; }
})();
const hasWatsonx = !!(process.env.WATSONX_API_KEY && process.env.WATSONX_PROJECT_ID);

if (!hasBob && !hasWatsonx) {
  console.log(`${YELLOW}⚠️  No AI backend detected. Running in demo mode.${RESET}`);
  console.log(`   Set BOBSHELL_API_KEY or WATSONX_API_KEY + WATSONX_PROJECT_ID in .env\n`);
  runDemo(sourcePath, bugReport);
} else if (hasBob) {
  console.log(`${GREEN}✅ IBM Bob CLI detected.${RESET} Running AI workflow...\n`);
  runWithBob(sourcePath, bugReport);
} else {
  console.log(`${GREEN}✅ watsonx.ai credentials detected.${RESET} Running AI workflow...\n`);
  runWithWatsonx(sourcePath, bugReport).catch((err) => {
    console.error(`${RED}❌ watsonx.ai error:${RESET}`, err.message);
    process.exit(1);
  });
}

// ── Helper: find JS source files ──────────────────────────────────────────────
function findJsFiles(dir) {
  const results = [];
  const ignore  = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next']);

  function walk(current) {
    let entries;
    try { entries = fs.readdirSync(current, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (ignore.has(entry.name)) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (
        entry.name.endsWith('.js') &&
        !entry.name.endsWith('.test.js') &&
        !entry.name.endsWith('.spec.js') &&
        !entry.name.endsWith('.config.js') &&
        !entry.name.endsWith('.fixture.js') &&
        entry.name !== 'cli.js' &&
        entry.name !== 'index.js'
      ) {
        results.push(full);
      }
    }
  }

  walk(dir);
  return results;
}

function pickBestCandidate(candidates, report) {
  const reportLower = report.toLowerCase();
  let best = candidates[0], bestScore = -1;
  for (const c of candidates) {
    const name  = path.basename(c, '.js').toLowerCase();
    const score = reportLower.includes(name) ? name.length : 0;
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return best;
}

// ── Demo mode ─────────────────────────────────────────────────────────────────
function runDemo(src, report) {
  const baseName = path.basename(src, '.js');
  const testPath = path.join(path.dirname(src), `${baseName}.test.js`);

  console.log(`${CYAN}✍️  Writing reproduction test scaffold...${RESET}`);
  fs.writeFileSync(testPath,
    `const fn = require('./${baseName}');\n` +
    `// Auto-generated by bugrep-ai (demo mode)\n` +
    `// TODO: replace with assertions specific to your bug\n` +
    `test('bug report: function handles edge cases correctly', () => {\n` +
    `  expect(typeof fn).not.toBe('undefined');\n` +
    `});\n`
  );
  console.log(`   Written: ${path.relative(cwd, testPath)}\n`);
  console.log(`${YELLOW}ℹ️  No AI patch applied in demo mode.${RESET}`);
  console.log(`   Set BOBSHELL_API_KEY or WATSONX_API_KEY to enable real AI analysis.\n`);
  console.log(`${GREEN}${BOLD}✅ Scaffold complete.${RESET} Edit the test file and run: npx jest\n`);
}

// ── IBM Bob CLI mode ──────────────────────────────────────────────────────────
function runWithBob(src, report) {
  const relSrc  = path.relative(cwd, src);
  const relTest = path.join(path.dirname(relSrc), `${path.basename(relSrc, '.js')}.test.js`);
  const prompt  =
    `Read this bug report and fix the source file at ${relSrc}.\n\n` +
    `Bug report:\n${report}\n\n` +
    `Steps:\n` +
    `1. Read ${relSrc} to understand the code.\n` +
    `2. Write a Jest test at ${relTest} that reproduces the bug with strict assertions.\n` +
    `3. Run the test — it must FAIL (RED).\n` +
    `4. Apply a minimal fix to ${relSrc} only. Do not touch the test file.\n` +
    `5. Run the test again — it must PASS (GREEN).\n` +
    `6. If the first fix fails, read the exact Jest output, revise the fix, and retry ONCE.\n` +
    `7. If both attempts fail, stop and explain what you tried.\n` +
    `Do not weaken any assertions. Only fix the implementation.`;

  try {
    execSync(`bob run --trust "${prompt.replace(/"/g, '\\"')}"`, {
      stdio: 'inherit', cwd, env: { ...process.env },
    });
    console.log(`\n${GREEN}${BOLD}🎉 IBM Bob completed the workflow.${RESET}\n`);
  } catch (err) {
    console.error(`${RED}❌ Bob run failed.${RESET}`, err.message);
    process.exit(1);
  }
}

// ── watsonx.ai mode (with retry) ─────────────────────────────────────────────
async function runWithWatsonx(src, report) {
  const sourceCode = fs.readFileSync(src, 'utf8');
  const baseName   = path.basename(src, '.js');
  const testPath   = path.join(path.dirname(src), `${baseName}.test.js`);

  // Exchange IBM Cloud API key for a short-lived IAM bearer token
  const iamRes = await fetch('https://iam.cloud.ibm.com/identity/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${encodeURIComponent(process.env.WATSONX_API_KEY)}`,
  });
  const { access_token } = await iamRes.json();

  const callGranite = async (prompt) => {
    const res = await fetch(
      'https://us-south.ml.cloud.ibm.com/ml/v1/text/generation?version=2024-05-31',
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${access_token}` },
        body: JSON.stringify({
          model_id:   'ibm/granite-3-8b-instruct',
          project_id: process.env.WATSONX_PROJECT_ID,
          input:      prompt,
          parameters: { max_new_tokens: 800, temperature: 0.2 },
        }),
      }
    );
    const data = await res.json();
    return data.results?.[0]?.generated_text?.trim();
  };

  // Step 1 — Generate reproduction test
  console.log(`${CYAN}🔍 Granite: writing reproduction test...${RESET}`);
  const testCode = await callGranite(
    `You are a QA engineer. Write ONLY a complete Jest test file with no explanation.\n\n` +
    `Bug report:\n${report}\n\n` +
    `Source file (${path.basename(src)}):\n${sourceCode}`
  );
  fs.writeFileSync(testPath, testCode);
  console.log(`${GREEN}✅ Test written: ${path.relative(cwd, testPath)}${RESET}\n`);

  // Step 2 — RED run
  console.log(`${RED}🔴 Running tests (expect failure)...${RESET}`);
  let redOutput = '';
  try {
    execSync(`npx jest ${testPath} --no-coverage`, { stdio: 'inherit', cwd });
  } catch (e) {
    redOutput = e.stdout?.toString() || '';
    console.log(`\n   Bug confirmed — test failed as expected.\n`);
  }

  // Step 3 — Generate fix (Attempt 1)
  console.log(`${CYAN}🔧 Granite: generating fix (attempt 1)...${RESET}`);
  let fixedCode = await callGranite(
    `You are a senior developer. Return ONLY the fixed source code with no explanation.\n\n` +
    `Bug report:\n${report}\n\n` +
    `Broken source code (${path.basename(src)}):\n${sourceCode}`
  );
  fs.writeFileSync(src, fixedCode);
  console.log(`${GREEN}✅ Patch applied.${RESET}\n`);

  // Step 4 — GREEN run (Attempt 1)
  console.log(`${GREEN}🟢 Running tests (attempt 1)...${RESET}`);
  let attempt1Failed = false;
  let attempt1Output = '';
  try {
    execSync(`npx jest ${testPath} --no-coverage`, { stdio: 'inherit', cwd });
    console.log(`\n${GREEN}${BOLD}🎉 SUCCESS on attempt 1. Bug fixed by IBM Granite.${RESET}\n`);
    return;
  } catch (e) {
    attempt1Failed = true;
    attempt1Output = e.stdout?.toString() || '';
    console.log(`\n${YELLOW}⚠️  Tests still failing after attempt 1. Retrying...${RESET}\n`);
  }

  // Step 5 — Retry: Generate revised fix (Attempt 2)
  console.log(`${CYAN}🔧 Granite: generating revised fix (attempt 2)...${RESET}`);
  const revisedCode = await callGranite(
    `You are a senior developer. Your first fix attempt failed. Return ONLY the corrected source code with no explanation.\n\n` +
    `Bug report:\n${report}\n\n` +
    `Original broken source code:\n${sourceCode}\n\n` +
    `Your first fix (which failed):\n${fixedCode}\n\n` +
    `Jest failure output from attempt 1:\n${attempt1Output}\n\n` +
    `Identify what your first fix missed and produce a complete corrected version.`
  );
  fs.writeFileSync(src, revisedCode);
  console.log(`${GREEN}✅ Revised patch applied.${RESET}\n`);

  // Step 6 — GREEN run (Attempt 2)
  console.log(`${GREEN}🟢 Running tests (attempt 2)...${RESET}`);
  try {
    execSync(`npx jest ${testPath} --no-coverage`, { stdio: 'inherit', cwd });
    console.log(`\n${GREEN}${BOLD}🎉 SUCCESS on attempt 2. Bug fixed by IBM Granite.${RESET}\n`);
  } catch {
    console.error(`\n${RED}❌ Both fix attempts failed. Manual review needed.${RESET}`);
    console.error(`   Review ${path.relative(cwd, src)} and ${path.relative(cwd, testPath)}\n`);
    process.exit(1);
  }
}
