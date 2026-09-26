// api/status.js — Vercel serverless function
// GET /api/status
// On Vercel there is no local .workflow-state.json — return a static idle state.

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Workflow state only exists locally — return idle so the UI degrades gracefully.
  return res.status(200).json({ stage: 'idle' });
}
