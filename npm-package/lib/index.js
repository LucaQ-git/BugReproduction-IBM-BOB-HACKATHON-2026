'use strict';

require('dotenv').config();

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BOLD  = '\x1b[1m';
const GREEN = '\x1b[32m';
const RED   = '\x1b[31m';
const CYAN  = '\x1b[36m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

const cwd = process.cwd();

// ── Parse CLI arguments ───────────────────────────────────────────────────────
// Usage:
//   npx bugrep-ai
//   npx bugrep-ai --source src/myFile.js --report bug_report.txt
//   npx bugrep-ai --help

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
${BOLD}bugrep-ai${RESET} — Automated bug reproduction & patch generator (IBM Bob 2.0)

${BOLD}Usage:${RESET}
  npx bugrep-ai [options]

${BOLD}Options:${RESET}
  --source <file>   Path to the source file to analyse and fix
  --report <file>   Path to the plain-text bug report
  --help            Show this help message

${BOLD}Examples:${RESET}
  npx bugrep-ai
  npx bugrep-ai --source src/checkout.js --report bugs/issue-42.txt
  npx bugrep-ai --source lib/auth.js --report bug_report.txt

${BOLD}AI backends (set in .env or environment):${RESET}
  BOBSHELL_API_KEY              IBM Bob CLI (recommended)
  WATSONX_API_KEY +
  WATSONX_PROJECT_ID            IBM watsonx.ai Granite
  (neither)                     Demo mode — no AI required
`);
  process.exit(0);
}

const getArg = (flag) => {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : null;
};

console.log(`\n${BOLD}🤖 BugRep-AI${RESET} — IBM Bob 2.0 Hackathon`);
console.log('─────────────────────────────────────────\n');

// ── Locate bug report ─────────────────────────────────────────────────────────
const reportArg = getArg('--report');
const bugReportCandidates = reportArg
  ? [reportArg]
  : [
      'bug_report.txt',
      'fixtures/bug_report.txt',
      'bugrep-ai/fixtures/bug_report.txt',
    ];

let bugReportPath = null;
for (const candidate of bugReportCandidates) {
  const full = path.resolve(cwd, candidate);
  if (fs.existsSync(full)) { bugReportPath = full; break; }
}

if (!bugReportPath) {
  console.error(`${RED}❌ No bug report found.${RESET}`);
  if (reportArg) {
    console.error(`   File not found: ${reportArg}`);
  } else {
    console.error(`   Create a bug_report.txt in your project, or use:`);
    console.error(`   ${BOLD}npx bugrep-ai --report path/to/your/bug_report.txt${RESET}`);
  }
  process.exit(1);
}

const bugReport = fs.readFileSync(bugReportPath, 'utf8').trim();
console.log(`${CYAN}📄 Bug report:${RESET} ${bugReportPath}`);
console.log(`   ${bugReport.split('\n')[0].slice(0, 80)}${bugReport.length > 80 ? '…' : ''}\n`);

// ── Locate source file ────────────────────────────────────────────────────────
const sourceArg = getArg('--source');

let sourcePath = null;

if (sourceArg) {
  const full = path.resolve(cwd, sourceArg);
  if (!fs.existsSync(full)) {
    console.error(`${RED}❌ Source file not found: ${sourceArg}${RESET}`);
    process.exit(1);
  }
  sourcePath = full;
} else {
  // Auto-detect: find all .js files in src/ or project root (exclude node_modules, test files)
  const candidates = findJsFiles(cwd);
  if (candidates.length === 0) {
    console.error(`${RED}❌ No JavaScript source files found.${RESET}`);
    console.error(`   Use: ${BOLD}npx bugrep-ai --source path/to/your/file.js${RESET}`);
    process.exit(1);
  }
  if (candidates.length === 1) {
    sourcePath = candidates[0];
  } else {
    // Pick the most likely candidate — prefer files mentioned in the bug report
    sourcePath = pickBestCandidate(candidates, bugReport, cwd);
    console.log(`${YELLOW}ℹ️  Multiple source files found. Using: ${path.relative(cwd, sourcePath)}${RESET}`);
    console.log(`   To specify a different file: ${BOLD}npx bugrep-ai --source <file>${RESET}\n`);
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
  console.log(`   Set BOBSHELL_API_KEY (IBM Bob) or WATSONX_API_KEY + WATSONX_PROJECT_ID\n`);
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
  const ignore = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next']);

  function walk(current) {
    let entries;
    try { entries = fs.readdirSync(current, { withFileTypes: true }); }
    catch { return; }

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

// ── Helper: pick best candidate based on bug report content ───────────────────
function pickBestCandidate(candidates, report, base) {
  const reportLower = report.toLowerCase();
  // Score each file by how many words from its name appear in the bug report
  let best = candidates[0];
  let bestScore = -1;
  for (const c of candidates) {
    const name = path.basename(c, '.js').toLowerCase();
    const score = reportLower.includes(name) ? name.length : 0;
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return best;
}

// ── Demo mode ─────────────────────────────────────────────────────────────────
function runDemo(src, report) {
  const baseName = path.basename(src, '.js');
  const dir      = path.dirname(src);
  const testPath = path.join(dir, `${baseName}.test.js`);

  console.log(`${CYAN}✍️  Writing reproduction test...${RESET}`);
  const testCode =
    `const fn = require('./${baseName}');\n` +
    `// Auto-generated by bugrep-ai (demo mode)\n` +
    `test('bug report: function handles edge cases correctly', () => {\n` +
    `  // TODO: replace with assertions specific to your bug\n` +
    `  expect(typeof fn).not.toBe('undefined');\n` +
    `});\n`;
  fs.writeFileSync(testPath, testCode);
  console.log(`   Written: ${path.relative(cwd, testPath)}\n`);

  console.log(`${YELLOW}ℹ️  Demo mode: no AI patch applied.${RESET}`);
  console.log(`   Set BOBSHELL_API_KEY or WATSONX_API_KEY to enable real AI analysis.\n`);
  console.log(`${GREEN}${BOLD}✅ BugRep-AI scaffold complete.${RESET}`);
  console.log(`   Review ${path.relative(cwd, testPath)} and run: npx jest\n`);
}

// ── Bob CLI mode ──────────────────────────────────────────────────────────────
function runWithBob(src, report) {
  const relSrc = path.relative(cwd, src);
  const prompt =
    `Read this bug report and fix the source file at ${relSrc}.\n\n` +
    `Bug report:\n${report}\n\n` +
    `Steps:\n` +
    `1. Read ${relSrc} to understand the code.\n` +
    `2. Write a Jest test in ${path.dirname(relSrc)}/${path.basename(relSrc, '.js')}.test.js that reproduces the bug with strict assertions.\n` +
    `3. Run the test — it must fail (RED).\n` +
    `4. Apply a minimal fix to ${relSrc}.\n` +
    `5. Run the test again — it must pass (GREEN).\n` +
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

// ── watsonx.ai mode ───────────────────────────────────────────────────────────
async function runWithWatsonx(src, report) {
  const sourceCode = fs.readFileSync(src, 'utf8');
  const baseName   = path.basename(src, '.js');
  const testPath   = path.join(path.dirname(src), `${baseName}.test.js`);

  // Exchange API key for IAM token
  const iamRes = await fetch('https://iam.cloud.ibm.com/identity/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${encodeURIComponent(process.env.WATSONX_API_KEY)}`,
  });
  const { access_token } = await iamRes.json();

  const callGranite = async (prompt) => {
    const res = await fetch(
      'https://us-south.ml.cloud.ibm.com/ml/v1/text/generation?version=2024-05-31',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${access_token}` },
        body: JSON.stringify({
          model_id: 'ibm/granite-3-8b-instruct',
          project_id: process.env.WATSONX_PROJECT_ID,
          input: prompt,
          parameters: { max_new_tokens: 800, temperature: 0.2 },
        }),
      }
    );
    const data = await res.json();
    return data.results?.[0]?.generated_text?.trim();
  };

  console.log(`${CYAN}🔍 Granite: analysing bug and writing test...${RESET}`);
  const testCode = await callGranite(
    `You are a QA engineer. Given this bug report and source code, write ONLY a complete Jest test file with no explanation.\n\n` +
    `Bug report:\n${report}\n\n` +
    `Source file (${path.basename(src)}):\n${sourceCode}`
  );
  fs.writeFileSync(testPath, testCode);
  console.log(`${GREEN}✅ Test written: ${path.relative(cwd, testPath)}${RESET}\n`);

  console.log(`${RED}🔴 Running tests (expect failure)...${RESET}`);
  try {
    execSync(`npx jest ${testPath} --no-coverage`, { stdio: 'inherit', cwd });
  } catch {
    console.log(`\n   Bug confirmed — test failed as expected.\n`);
  }

  console.log(`${CYAN}🔧 Granite: generating fix...${RESET}`);
  const fixedCode = await callGranite(
    `You are a senior developer. Return ONLY the fixed source code with no explanation.\n\n` +
    `Bug report:\n${report}\n\n` +
    `Broken source code (${path.basename(src)}):\n${sourceCode}`
  );
  fs.writeFileSync(src, fixedCode);
  console.log(`${GREEN}✅ Patch applied.${RESET}\n`);

  console.log(`${GREEN}🟢 Re-running tests...${RESET}`);
  try {
    execSync(`npx jest ${testPath} --no-coverage`, { stdio: 'inherit', cwd });
    console.log(`\n${GREEN}${BOLD}🎉 SUCCESS: All tests pass. Bug fixed by IBM Granite.${RESET}\n`);
  } catch {
    console.error(`\n${RED}❌ Tests still failing. Review the patch manually.${RESET}\n`);
    process.exit(1);
  }
}
