// api/analyze-bug.js — Vercel serverless function
// POST /api/analyze-bug
// Accepts the raw cart crash context and uses IBM watsonx.ai (Granite) to
// generate a structured bug report. The API key never leaves the server.

// Step 1: Exchange IBM Cloud API key for a short-lived IAM bearer token
async function getIamToken(apiKey) {
  const res = await fetch('https://iam.cloud.ibm.com/identity/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${encodeURIComponent(apiKey)}`,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`IAM token request failed: ${err}`);
  }
  const data = await res.json();
  return data.access_token;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey    = process.env.WATSONX_API_KEY;
  const projectId = process.env.WATSONX_PROJECT_ID;

  if (!apiKey || !projectId) {
    return res.status(500).json({
      error: 'WATSONX_API_KEY and WATSONX_PROJECT_ID must be configured on the server.',
    });
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
    const iamToken = await getIamToken(apiKey);

    const response = await fetch(
      `https://us-south.ml.cloud.ibm.com/ml/v1/text/generation?version=2024-05-31`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${iamToken}`,
        },
        body: JSON.stringify({
          model_id: 'ibm/granite-3-8b-instruct',
          project_id: projectId,
          input: prompt,
          parameters: {
            max_new_tokens: 600,
            temperature: 0.3,
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.json();
      return res.status(502).json({ error: err.errors?.[0]?.message || 'watsonx.ai request failed' });
    }

    const data = await response.json();
    const report = data.results?.[0]?.generated_text?.trim();

    return res.status(200).json({ ok: true, report });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
