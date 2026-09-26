'use strict';

require('dotenv').config();

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BOLD  = '\x1b[1m';
const GREEN = '\x1b[32m';
const RED   = '\x1b[31m';
const CYAN  = '\x1b[36m';
const RESET = '\x1b[0m';

const cwd = process.cwd();

console.log(`\n${BOLD}🤖 BugRep-AI${RESET} — IBM Bob 2.0 Hackathon`);
console.log('─────────────────────────────────────────\n');

// ── Locate bug report ────────────────────────────────────────────────────────
const bugReportCandidates = [
  'bug_report.txt',
  'fixtures/bug_report.txt',
  'bugrep-ai/fixtures/bug_report.txt',
];

let bugReportPath = null;
for (const candidate of bugReportCandidates) {
  const full = path.join(cwd, candidate);
  if (fs.existsSync(full)) {
    bugReportPath = full;
    break;
  }
}

if (!bugReportPath) {
  console.error(`${RED}❌ No bug report found.${RESET}`);
  console.error(`   Create one of these files in your project:`);
  bugReportCandidates.forEach((c) => console.error(`     ${c}`));
  process.exit(1);
}

const bugReport = fs.readFileSync(bugReportPath, 'utf8').trim();
console.log(`${CYAN}📄 Bug report loaded:${RESET} ${bugReportPath}`);
console.log(`   ${bugReport.split('\n')[0]}...\n`);

// ── Locate source file ───────────────────────────────────────────────────────
const sourceCandidates = [
  'src/cart.js',
  'bugrep-ai/src/cart.js',
  'cart.js',
];

let sourcePath = null;
for (const candidate of sourceCandidates) {
  const full = path.join(cwd, candidate);
  if (fs.existsSync(full)) {
    sourcePath = full;
    break;
  }
}

if (!sourcePath) {
  console.error(`${RED}❌ No source file found.${RESET}`);
  console.error(`   Expected one of: ${sourceCandidates.join(', ')}`);
  process.exit(1);
}

console.log(`${CYAN}📂 Source file:${RESET} ${sourcePath}\n`);

// ── Check for IBM Bob CLI ────────────────────────────────────────────────────
const hasBob = (() => {
  try { execSync('bob --version', { stdio: 'pipe' }); return true; }
  catch { return false; }
})();

const hasWatsonx = !!(process.env.WATSONX_API_KEY && process.env.WATSONX_PROJECT_ID);

if (!hasBob && !hasWatsonx) {
  console.log(`⚠️  ${BOLD}No AI backend detected.${RESET} Running in demo mode.\n`);
  console.log(`   To enable real AI analysis, set one of:`);
  console.log(`     • IBM Bob CLI:    install Bob IDE + set BOBSHELL_API_KEY`);
  console.log(`     • watsonx.ai:     set WATSONX_API_KEY + WATSONX_PROJECT_ID\n`);
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

// ── Demo mode (hardcoded for cart.js bug) ────────────────────────────────────
function runDemo(src, report) {
  const sourceCode = fs.readFileSync(src, 'utf8');

  console.log(`${CYAN}🔍 Step 1: Analysing bug report...${RESET}`);
  console.log(`   Bug: ${report.split('\n')[0]}\n`);

  console.log(`${CYAN}✍️  Step 2: Writing reproduction test...${RESET}`);
  const testPath = path.join(path.dirname(src), 'cart.test.js');
  const testCode = `const { calculateTotal } = require('./${path.basename(src, '.js')}');
test('empty cart returns 0', () => { expect(calculateTotal([], 10)).toBe(0); });
test('extreme discount clamps to 0', () => { expect(calculateTotal([{price:10}], 200)).toBeGreaterThanOrEqual(0); });
`;
  fs.writeFileSync(testPath, testCode);
  console.log(`   Test written to ${testPath}\n`);

  console.log(`${RED}🔴 Step 3: Running tests (expect failure)...${RESET}`);
  try {
    execSync(`npx jest ${testPath} --no-coverage`, { stdio: 'inherit', cwd });
  } catch {
    console.log(`\n   Bug confirmed — test failed as expected.\n`);
  }

  console.log(`${CYAN}🔧 Step 4: Applying patch...${RESET}`);
  const patch = `// Patched by BugRep-AI\nfunction calculateTotal(items, discountPercentage) {\n  if (!items || items.length === 0) return 0;\n  let subtotal = items.reduce((sum, item) => sum + item.price, 0);\n  let discount = (subtotal * (discountPercentage || 0)) / 100;\n  let total = subtotal - discount;\n  return total < 0 ? 0 : Math.round(total * 100) / 100;\n}\nmodule.exports = { calculateTotal };\n`;
  fs.writeFileSync(src, patch);
  console.log(`   Patch applied.\n`);

  console.log(`${GREEN}🟢 Step 5: Re-running tests...${RESET}`);
  try {
    execSync(`npx jest ${testPath} --no-coverage`, { stdio: 'inherit', cwd });
    console.log(`\n${GREEN}${BOLD}🎉 SUCCESS: All tests pass. Bug fixed.${RESET}\n`);
  } catch {
    console.error(`\n${RED}❌ Tests still failing. Manual review needed.${RESET}\n`);
    process.exit(1);
  }
}

// ── Bob CLI mode ─────────────────────────────────────────────────────────────
function runWithBob(src, report) {
  const prompt = `Read this bug report and fix the source file at ${src}.\n\nBug report:\n${report}\n\nWrite a Jest test that reproduces the bug, run it (expect failure), apply a minimal fix to the source file, then re-run the test until it passes. Do not weaken any assertions.`;
  try {
    execSync(`bob run --trust "${prompt.replace(/"/g, '\\"')}"`, {
      stdio: 'inherit',
      cwd,
      env: { ...process.env },
    });
    console.log(`\n${GREEN}${BOLD}🎉 IBM Bob completed the workflow.${RESET}\n`);
  } catch (err) {
    console.error(`${RED}❌ Bob run failed.${RESET}`, err.message);
    process.exit(1);
  }
}

// ── watsonx.ai mode ──────────────────────────────────────────────────────────
async function runWithWatsonx(src, report) {
  const sourceCode = fs.readFileSync(src, 'utf8');

  // Get IAM token
  const iamRes = await fetch('https://iam.cloud.ibm.com/identity/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${encodeURIComponent(process.env.WATSONX_API_KEY)}`,
  });
  const { access_token } = await iamRes.json();

  const callGranite = async (prompt) => {
    const res = await fetch('https://us-south.ml.cloud.ibm.com/ml/v1/text/generation?version=2024-05-31', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${access_token}` },
      body: JSON.stringify({
        model_id: 'ibm/granite-3-8b-instruct',
        project_id: process.env.WATSONX_PROJECT_ID,
        input: prompt,
        parameters: { max_new_tokens: 800, temperature: 0.2 },
      }),
    });
    const data = await res.json();
    return data.results?.[0]?.generated_text?.trim();
  };

  console.log(`${CYAN}🔍 Step 1: Granite analysing bug report...${RESET}`);
  const testCode = await callGranite(
    `You are a QA engineer. Given this bug report and source code, write ONLY a Jest test file (no explanation) that reproduces the bug.\n\nBug report:\n${report}\n\nSource code (${path.basename(src)}):\n${sourceCode}`
  );

  const testPath = path.join(path.dirname(src), 'cart.test.js');
  fs.writeFileSync(testPath, testCode);
  console.log(`${GREEN}✅ Test written.${RESET}\n`);

  console.log(`${RED}🔴 Step 2: Running tests (expect failure)...${RESET}`);
  try {
    execSync(`npx jest ${testPath} --no-coverage`, { stdio: 'inherit', cwd });
  } catch {
    console.log(`\n   Bug confirmed.\n`);
  }

  console.log(`${CYAN}🔧 Step 3: Granite generating fix...${RESET}`);
  const fixedCode = await callGranite(
    `You are a senior developer. Given this bug report and broken source code, return ONLY the fixed source code with no explanation.\n\nBug report:\n${report}\n\nBroken source code:\n${sourceCode}`
  );

  fs.writeFileSync(src, fixedCode);
  console.log(`${GREEN}✅ Patch applied.${RESET}\n`);

  console.log(`${GREEN}🟢 Step 4: Re-running tests...${RESET}`);
  try {
    execSync(`npx jest ${testPath} --no-coverage`, { stdio: 'inherit', cwd });
    console.log(`\n${GREEN}${BOLD}🎉 SUCCESS: All tests pass. Bug fixed by IBM Granite.${RESET}\n`);
  } catch {
    console.error(`\n${RED}❌ Tests still failing. Review the patch.${RESET}\n`);
    process.exit(1);
  }
}
