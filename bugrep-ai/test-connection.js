// test-connection.js — verify watsonx.ai credentials work before full integration
require('dotenv').config();
const { WatsonXAI } = require('@ibm-cloud/watsonx-ai');
const { IamAuthenticator } = require('ibm-cloud-sdk-core');

async function testConnection() {
  console.log('🔑 Testing watsonx.ai connection...\n');

  const client = new WatsonXAI({
    version: '2024-05-31',
    serviceUrl: 'https://us-south.ml.cloud.ibm.com',
    authenticator: new IamAuthenticator({ apikey: process.env.WATSONX_API_KEY }),
  });

  try {
    const response = await client.generateText({
      modelId: 'ibm/granite-3-8b-instruct',
      projectId: process.env.WATSONX_PROJECT_ID,
      input: 'Reply with exactly three words: connection is working.',
      parameters: { max_new_tokens: 20 },
    });

    const text = response.result.results[0].generated_text.trim();
    console.log('✅ Connection successful!');
    console.log(`   Model responded: "${text}"\n`);
    console.log('You are ready to run the full orchestrator.');
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
    if (err.status === 401) {
      console.error('   → Your API key is invalid or expired. Check WATSONX_API_KEY in .env');
    } else if (err.status === 404) {
      console.error('   → Project ID not found. Check WATSONX_PROJECT_ID in .env');
    } else if (err.status === 403) {
      console.error('   → Access denied. Make sure watsonx.ai Runtime service exists in Dallas.');
    } else {
      console.error('   Full error:', JSON.stringify(err, null, 2));
    }
  }
}

testConnection();
