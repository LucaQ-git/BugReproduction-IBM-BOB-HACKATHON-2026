// server.js — Express API server
// Serves the Vite-built React app and handles the /api/bug-report endpoint
// which writes submitted bug reports to bugrep-ai/fixtures/bug_report.txt.
//
// Usage:
//   node server.js           (production — serves built app from dist/)
//   npm run dev:server       (development — Vite runs separately on :5173)

import express from 'express';
import path    from 'path';
import fs      from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app  = express();
const PORT = process.env.PORT || 3001;

// Path to the bug report file (relative to this server.js file)
const BUG_REPORT_PATH = path.resolve(__dirname, '..', 'bugrep-ai', 'fixtures', 'bug_report.txt');

app.use(express.json());

// ── POST /api/bug-report ──────────────────────────────────────────────────
// Body: { title: string, body: string }
// Writes the combined text to bugrep-ai/fixtures/bug_report.txt.
app.post('/api/bug-report', (req, res) => {
  const { title, body } = req.body || {};
  if (!body || typeof body !== 'string') {
    return res.status(400).json({ error: 'body is required' });
  }

  const content = title
    ? `${title.trim()}\n\n${body.trim()}\n`
    : `${body.trim()}\n`;

  try {
    fs.mkdirSync(path.dirname(BUG_REPORT_PATH), { recursive: true });
    fs.writeFileSync(BUG_REPORT_PATH, content, 'utf8');
    console.log(`[bug-report] Saved to ${BUG_REPORT_PATH}`);
    res.json({ ok: true, path: BUG_REPORT_PATH });
  } catch (err) {
    console.error('[bug-report] Write failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/status ───────────────────────────────────────────────────────
// Returns the current workflow state so the UI can show run status.
app.get('/api/status', (req, res) => {
  const statePath = path.resolve(__dirname, '..', 'bugrep-ai', '.workflow-state.json');
  try {
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    res.json({
      stage:         state.stage,
      bugReproduced: state.bugReproduced,
      fixApproved:   state.fixApproved,
      redResult:     state.redResult
        ? { passed: state.redResult.passed, failed: state.redResult.failed }
        : null,
      greenResult:   state.greenResult
        ? { passed: state.greenResult.passed, failed: state.greenResult.failed }
        : null,
      reportMd:      state.reportMd || null,
    });
  } catch {
    res.json({ stage: 'idle' });
  }
});

// ── Serve built React app (production) ───────────────────────────────────
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('/{*path}', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`\n🛒 ShopDemo API server running on http://localhost:${PORT}`);
  console.log(`   Bug reports → ${BUG_REPORT_PATH}`);
  if (!fs.existsSync(distPath)) {
    console.log(`   (No dist/ found — run 'npm run build' for production, or use 'npm run dev' + 'npm run dev:server' for development)\n`);
  }
});
