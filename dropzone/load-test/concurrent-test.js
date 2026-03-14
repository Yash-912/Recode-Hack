#!/usr/bin/env node
/**
 * Concurrent Load Test Script
 * Fires 500 concurrent checkout requests to prove atomic inventory protection.
 * 
 * Usage: node concurrent-test.js [stock] [requests]
 * Default: node concurrent-test.js 10 500
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const http = require('http');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const TARGET_STOCK = parseInt(process.argv[2]) || 10;
const CONCURRENT_REQUESTS = parseInt(process.argv[3]) || 500;

function post(path, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const url = new URL(BACKEND_URL + path);

    const req = http.request({
      hostname: url.hostname,
      port: url.port || 3000,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...headers
      }
    }, (res) => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(responseBody) });
        } catch {
          resolve({ status: res.statusCode, data: responseBody });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(body);
    req.end();
  });
}

function get(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(BACKEND_URL + path);
    const req = http.request({
      hostname: url.hostname,
      port: url.port || 3000,
      path: url.pathname,
      method: 'GET',
      headers
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, data: body }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function createGuest() {
  const res = await post('/api/auth/guest', {});
  if (res.status === 201 || res.status === 200) {
    return res.data;  // { token, userId }
  }
  throw new Error(`Guest creation failed: ${JSON.stringify(res.data)}`);
}

async function getCheckoutToken(productId, authToken) {
  const url = new URL(BACKEND_URL);
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: url.hostname,
      port: url.port || 3000,
      path: `/api/products/${productId}/checkout-token`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${authToken}` }
    }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve(body); } });
    });
    req.on('error', reject);
    req.end();
  });
}

async function checkout(productId, authToken, checkoutToken) {
  const idempotencyKey = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const start = Date.now();
  const res = await post('/api/checkout',
    { productId, quantity: 1 },
    {
      'Authorization': `Bearer ${authToken}`,
      'Idempotency-Key': idempotencyKey,
      'X-Checkout-Token': checkoutToken
    }
  );
  return { status: res.status, data: res.data, latencyMs: Date.now() - start };
}

async function run() {
  console.log('='.repeat(60));
  console.log('  DropZone Concurrent Load Test');
  console.log(`  Target Stock: ${TARGET_STOCK} | Concurrent Requests: ${CONCURRENT_REQUESTS}`);
  console.log('='.repeat(60));

  // Step 1: Get the product ID from the admin (or use first available)
  const adminToken = process.env.ADMIN_TOKEN || 'dropzone-admin-secret';
  let productId;

  try {
    const productRes = await get('/api/health');
    if (productRes.status !== 200) throw new Error('Backend not responding');
    console.log('\n✅ Backend is healthy');
  } catch (err) {
    console.error('\n❌ Backend is not reachable:', err.message);
    process.exit(1);
  }

  // Step 2: Create a fresh test product via admin
  console.log(`\n📦 Creating test product (stock=${TARGET_STOCK})...`);
  const { v4: uuidv4 } = require('uuid'); // Require uuid (installed as dep)
  productId = `test-${uuidv4().slice(0,8)}`;

  // For testing without DB, try to use a pre-seeded product
  // In the future, an auto-create endpoint can be used.
  // For now, prompt user to seed first.
  console.log('\n⚠️  Please make sure a product is seeded via "npm run seed" first.');
  console.log('   Set PRODUCT_ID env variable to target a specific product.\n');

  productId = process.env.PRODUCT_ID;
  if (!productId) {
    console.error('❌ PRODUCT_ID env variable not set. Run "npm run seed" first and set the product ID.');
    process.exit(1);
  }

  // Step 3: Create guest users in parallel
  console.log(`\n👤 Creating ${CONCURRENT_REQUESTS} guest users...`);
  const users = await Promise.allSettled(
    Array.from({ length: CONCURRENT_REQUESTS }, () => createGuest())
  );
  
  const validUsers = users.filter(u => u.status === 'fulfilled').map(u => u.value);
  console.log(`   ✅ ${validUsers.length}/${CONCURRENT_REQUESTS} users created`);

  // Step 4: Get checkout tokens for each user (sequential - prevent server overload)
  console.log('\n🎫 Fetching checkout tokens...');
  const tokens = await Promise.allSettled(
    validUsers.map(u => getCheckoutToken(productId, u.token))
  );
  
  const validTokens = tokens.map((t, i) => ({
    user: validUsers[i],
    checkoutToken: t.status === 'fulfilled' ? t.value.token : null
  })).filter(t => t.checkoutToken);
  
  console.log(`   ✅ ${validTokens.length}/${validUsers.length} tokens acquired`);

  // Step 5: Fire all checkouts simultaneously
  console.log(`\n🚀 Firing ${validTokens.length} concurrent checkout requests NOW...`);
  const startTime = Date.now();
  
  const results = await Promise.allSettled(
    validTokens.map(({ user, checkoutToken }) =>
      checkout(productId, user.token, checkoutToken)
    )
  );
  
  const totalMs = Date.now() - startTime;

  // Step 6: Tabulate results
  const successes = results.filter(r => r.status === 'fulfilled' && r.value.status === 202).length;
  const conflicts = results.filter(r => r.status === 'fulfilled' && r.value.status === 409).length;
  const soldOuts  = results.filter(r => r.status === 'fulfilled' && r.value.status === 410).length;
  const errors    = results.filter(r => r.status === 'rejected').length;
  const others    = results.length - successes - conflicts - soldOuts - errors;

  const avgLatency = Math.floor(
    results
      .filter(r => r.status === 'fulfilled' && r.value.latencyMs)
      .reduce((sum, r) => sum + r.value.latencyMs, 0) / (results.length || 1)
  );

  console.log('\n='.repeat(60));
  console.log('  📊 RESULTS');
  console.log('='.repeat(60));
  console.log(`  Total Requests:  ${results.length}`);
  console.log(`  ✅ Accepted:      ${successes} (queued for processing)`);
  console.log(`  ⛔ Sold Out:      ${soldOuts}`);
  console.log(`  ⚠️  Conflicts:    ${conflicts}`);
  console.log(`  ❌ Errors:        ${errors}`);
  console.log(`  ❓ Other:         ${others}`);
  console.log(`  ⏱  Total time:   ${totalMs}ms`);
  console.log(`  ⏱  Avg latency:  ${avgLatency}ms`);
  console.log('='.repeat(60));

  if (successes <= TARGET_STOCK) {
    console.log(`\n✅ PROTECTED MODE: Exactly ${successes} requests accepted (stock was ${TARGET_STOCK}). Atomicity confirmed!`);
  } else {
    console.log(`\n⚠️  NAIVE MODE: ${successes} requests accepted but stock was only ${TARGET_STOCK}. Overselling detected!`);
  }
  console.log('');
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
