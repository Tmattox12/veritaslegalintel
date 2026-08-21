/**
 * Test script for Veritas AI Chat API
 *
 * Usage:
 *   node test-api.js
 *
 * Make sure the API server is running (npm start) before running this test
 */

const http = require('http');

// Configuration
const API_URL = 'http://localhost:3000';
const TEST_TIMEOUT = 10000; // 10 seconds

console.log('\n========================================');
console.log('Veritas AI Chat API Test Suite');
console.log('========================================\n');

/**
 * Test 1: Health Check
 */
function testHealthCheck() {
  return new Promise((resolve) => {
    console.log('Test 1: Health Check');
    console.log('─────────────────────────────────────');

    const url = new URL(`${API_URL}/api/health`);

    http
      .get(url, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode === 200) {
            console.log('✅ PASSED');
            console.log(`   Status: ${res.statusCode}`);
            console.log(`   Response: ${data}`);
          } else {
            console.log('❌ FAILED');
            console.log(`   Expected 200, got ${res.statusCode}`);
          }
          console.log('\n');
          resolve();
        });
      })
      .on('error', (err) => {
        console.log('❌ FAILED');
        console.log(`   Error: ${err.message}`);
        console.log('   Make sure the API is running: npm start\n');
        resolve();
      });
  });
}

/**
 * Test 2: Chat API (AFI Context)
 */
function testChatAPI() {
  return new Promise((resolve) => {
    console.log('Test 2: Chat API (AFI Context)');
    console.log('─────────────────────────────────────');

    const payload = JSON.stringify({
      message: 'What is the AFI?',
      history: [],
      context: 'Ask me about expense reconciliation, sections, or how to fill out the AFI',
      systemPrompt:
        'You are an expert in family law financial disclosures. Keep answers concise and practical, typically 2-3 sentences max.'
    });

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);

          if (res.statusCode === 200 && response.content) {
            console.log('✅ PASSED');
            console.log(`   Status: ${res.statusCode}`);
            console.log(`   Question: What is the AFI?`);
            console.log(`   Answer: ${response.content.substring(0, 100)}...`);
            if (response.usage) {
              console.log(
                `   Tokens used: ${response.usage.input_tokens} input, ${response.usage.output_tokens} output`
              );
            }
          } else {
            console.log('❌ FAILED');
            console.log(`   Status: ${res.statusCode}`);
            console.log(`   Response: ${data}`);
          }
        } catch (err) {
          console.log('❌ FAILED');
          console.log(`   Parse error: ${err.message}`);
          console.log(`   Response: ${data}`);
        }
        console.log('\n');
        resolve();
      });
    });

    req.on('error', (err) => {
      console.log('❌ FAILED');
      console.log(`   Error: ${err.message}`);
      console.log('   Make sure the API is running: npm start\n');
      resolve();
    });

    // Set timeout
    req.setTimeout(TEST_TIMEOUT, () => {
      req.abort();
      console.log('❌ FAILED');
      console.log(`   Timeout after ${TEST_TIMEOUT}ms`);
      console.log('   Check that ANTHROPIC_API_KEY is set correctly\n');
      resolve();
    });

    req.write(payload);
    req.end();
  });
}

/**
 * Test 3: Chat with History
 */
function testChatWithHistory() {
  return new Promise((resolve) => {
    console.log('Test 3: Chat with History');
    console.log('─────────────────────────────────────');

    const payload = JSON.stringify({
      message: 'How do I reconcile expenses?',
      history: [
        {
          role: 'user',
          content: 'What is the AFI?'
        },
        {
          role: 'assistant',
          content: 'The AFI is an Affidavit of Financial Information used in family law cases.'
        }
      ],
      context: 'Ask me about expense reconciliation, sections, or how to fill out the AFI',
      systemPrompt:
        'You are an expert in family law financial disclosures. Keep answers concise and practical, typically 2-3 sentences max.'
    });

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);

          if (res.statusCode === 200 && response.content) {
            console.log('✅ PASSED');
            console.log(`   Status: ${res.statusCode}`);
            console.log(`   Previous messages: 2 (1 user, 1 assistant)`);
            console.log(`   New question: How do I reconcile expenses?`);
            console.log(`   Answer: ${response.content.substring(0, 100)}...`);
          } else {
            console.log('❌ FAILED');
            console.log(`   Status: ${res.statusCode}`);
            console.log(`   Response: ${data}`);
          }
        } catch (err) {
          console.log('❌ FAILED');
          console.log(`   Parse error: ${err.message}`);
          console.log(`   Response: ${data}`);
        }
        console.log('\n');
        resolve();
      });
    });

    req.on('error', (err) => {
      console.log('❌ FAILED');
      console.log(`   Error: ${err.message}\n`);
      resolve();
    });

    req.setTimeout(TEST_TIMEOUT, () => {
      req.abort();
      console.log('❌ FAILED');
      console.log(`   Timeout after ${TEST_TIMEOUT}ms\n`);
      resolve();
    });

    req.write(payload);
    req.end();
  });
}

/**
 * Test 4: Different Page Contexts
 */
function testDifferentContexts() {
  return new Promise((resolve) => {
    console.log('Test 4: Different Page Contexts');
    console.log('─────────────────────────────────────');

    const tests = [
      {
        name: 'Index (System Overview)',
        context: 'Ask me about the AFI system, how to get started, or what documents you need'
      },
      {
        name: 'Intake (Document Prep)',
        context: 'Ask me about preparing documents, conditional questions, or next steps'
      },
      {
        name: 'Document Management',
        context: 'Ask me about uploading documents, organizing files, or linking to expenses'
      }
    ];

    let completed = 0;

    tests.forEach((test) => {
      const payload = JSON.stringify({
        message: 'What should I do first?',
        history: [],
        context: test.context,
        systemPrompt:
          'You are a helpful assistant for the Veritas AFI system. Keep answers concise, 2-3 sentences max.'
      });

      const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/chat',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      };

      const req = http.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(data);

            if (res.statusCode === 200 && response.content) {
              console.log(`✅ ${test.name}`);
            } else {
              console.log(`❌ ${test.name}`);
            }
          } catch (err) {
            console.log(`❌ ${test.name}`);
          }

          completed++;
          if (completed === tests.length) {
            console.log('\n');
            resolve();
          }
        });
      });

      req.on('error', (err) => {
        console.log(`❌ ${test.name}`);
        completed++;
        if (completed === tests.length) {
          console.log('\n');
          resolve();
        }
      });

      req.setTimeout(TEST_TIMEOUT, () => {
        req.abort();
        console.log(`❌ ${test.name}`);
        completed++;
        if (completed === tests.length) {
          console.log('\n');
          resolve();
        }
      });

      req.write(payload);
      req.end();
    });
  });
}

/**
 * Main Test Runner
 */
async function runTests() {
  try {
    await testHealthCheck();
    await testChatAPI();
    await testChatWithHistory();
    await testDifferentContexts();

    console.log('========================================');
    console.log('Test Suite Complete!');
    console.log('========================================\n');
  } catch (err) {
    console.error('Test suite error:', err);
    process.exit(1);
  }
}

// Run tests
runTests();
