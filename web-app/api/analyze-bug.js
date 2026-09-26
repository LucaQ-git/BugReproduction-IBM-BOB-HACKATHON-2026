// api/analyze-bug.js — Vercel serverless function
// POST /api/analyze-bug
// Accepts the raw cart crash context and uses OpenAI to generate a structured
// bug report. The API key never leaves the server.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENAI_API_KEY is not configured on the server.' });
  }

  const { engine, cartItems, discountCode, discountValue, result } = req.body || {};

  if (!result) {
    return res.status(400).json({ error: 'result is required' });
  }

  const itemSummary = cartItems?.length
    ? cartItems.map((i) => `  - ${i.name} x${i.qty} @ $${i.price.toFixed(2)}`).join('\n')
    : '  (empty cart)';

  const prompt = `You are a software QA engineer writing a formal bug report.

A shopping cart application produced an unexpected result. Analyse the context below and write a clear, structured bug report a developer can act on immediately.

## Context
- Cart engine used: ${engine}
- Discount code: ${discountCode} (value: ${discountValue})
- Cart contents:
${itemSummary}
- Observed result: ${result.display}
- Error type: ${result.errorType || 'none'}
- Error message: ${result.message || 'none'}

## Instructions
Write a bug report with these exact sections:
1. **Summary** — one sentence describing the bug
2. **Steps to Reproduce** — numbered list
3. **Expected Behaviour** — what should happen
4. **Actual Behaviour** — what actually happened
5. **Root Cause Analysis** — brief technical explanation of why this happens in the code
6. **Suggested Fix** — concrete code-level suggestion

Be specific, technical, and concise. Do not pad with filler sentences.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 600,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(502).json({ error: err.error?.message || 'OpenAI request failed' });
    }

    const data = await response.json();
    const report = data.choices?.[0]?.message?.content?.trim();

    return res.status(200).json({ ok: true, report });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
