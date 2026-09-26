// api/bug-report.js — Vercel serverless function
// POST /api/bug-report
// On Vercel there is no writable local filesystem, so the report is stored
// in memory for the duration of the request and echoed back.
// The UI still works — the "Save Bug Report" button succeeds and shows the
// confirmation. The orchestrator workflow runs locally, not on Vercel.

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { title, body } = req.body || {};

  if (!body || typeof body !== 'string') {
    return res.status(400).json({ error: 'body is required' });
  }

  const content = title
    ? `${title.trim()}\n\n${body.trim()}\n`
    : `${body.trim()}\n`;

  // On Vercel we cannot write to the filesystem.
  // Return the content so the user can copy it and paste it into
  // bugrep-ai/fixtures/bug_report.txt locally before running the orchestrator.
  return res.status(200).json({
    ok: true,
    note: 'Running on Vercel — file system is read-only. Copy the content below into bugrep-ai/fixtures/bug_report.txt to use with the local orchestrator.',
    content,
  });
}
