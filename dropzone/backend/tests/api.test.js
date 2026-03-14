require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const Redis = require('ioredis');
const { query, connectDB, disconnectDB } = require('../src/config/db');

/**
 * API Integration Tests (Vitest)
 *
 * Tests the full checkout flow end-to-end.
 * Requires: backend running on localhost:3000, Redis + Postgres available.
 *
 * Note: These tests hit the live API, so the server must be running.
 * Product ID is fetched dynamically from the database.
 */

const BASE_URL = `http://localhost:${process.env.PORT || 3000}/api`;

let productId;
let guestToken;
let userId;

beforeAll(async () => {
  await connectDB();
  // Fetch the first active product instead of hardcoding
  const { rows } = await query('SELECT id FROM products WHERE is_active = true LIMIT 1');
  if (rows.length === 0) {
    throw new Error('No active products found. Run `npm run seed` first.');
  }
  productId = rows[0].id;
});

afterAll(async () => {
  await disconnectDB();
});

describe('API Integration — Full Checkout Flow', () => {

  it('GET /health returns ok', async () => {
    const res = await fetch(`${BASE_URL}/health`);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe('ok');
    expect(data.timestamp).toBeDefined();
  });

  it('GET /products/:id returns product with inventory', async () => {
    const res = await fetch(`${BASE_URL}/products/${productId}`);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.id).toBe(productId);
    expect(data.name).toBeDefined();
    expect(data.inventory).toBeDefined();
    expect(data.inventory.remaining).toBeGreaterThanOrEqual(0);
    expect(data.inventory.total).toBeGreaterThan(0);
  });

  it('POST /auth/guest creates guest user and returns JWT', async () => {
    const res = await fetch(`${BASE_URL}/auth/guest`, { method: 'POST' });
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.token).toBeDefined();
    expect(data.userId).toBeDefined();

    guestToken = data.token;
    userId = data.userId;
  });

  it('GET /products/:id/checkout-token returns a short-lived token', async () => {
    const res = await fetch(`${BASE_URL}/products/${productId}/checkout-token`);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.token).toBeDefined();
    expect(data.expiresAt).toBeGreaterThan(Date.now());
    expect(data.expiresIn).toBe(30000);
  });

  it('POST /checkout without Idempotency-Key returns 400', async () => {
    const res = await fetch(`${BASE_URL}/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${guestToken}`,
      },
      body: JSON.stringify({ productId, quantity: 1 }),
    });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('missing_idempotency_key');
  });

  it('POST /checkout without auth returns 401', async () => {
    const res = await fetch(`${BASE_URL}/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify({ productId, quantity: 1 }),
    });

    expect(res.status).toBe(401);
  });

  it('POST /checkout with valid auth returns 202 (queued)', async () => {
    // Get a checkout token first
    const tokenRes = await fetch(`${BASE_URL}/products/${productId}/checkout-token`);
    const tokenData = await tokenRes.json();

    const res = await fetch(`${BASE_URL}/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${guestToken}`,
        'Idempotency-Key': crypto.randomUUID(),
        'X-Checkout-Token': tokenData.token,
      },
      body: JSON.stringify({ productId, quantity: 1 }),
    });
    const data = await res.json();

    // Could be 202 (queued) or 503 (drop not started) depending on timing
    expect([202, 503]).toContain(res.status);

    if (res.status === 202) {
      expect(data.jobId).toBeDefined();
      expect(data.position).toBeDefined();

      // Poll queue status
      await new Promise(resolve => setTimeout(resolve, 500));
      const statusRes = await fetch(`${BASE_URL}/queue-status/${data.jobId}`);
      const statusData = await statusRes.json();
      expect(statusData.status).toBeDefined();
    }
  });

  it('POST /checkout with duplicate idempotency key returns cached 202', async () => {
    const idempotencyKey = crypto.randomUUID();

    // Create a new guest to avoid per-user dedup
    const guestRes = await fetch(`${BASE_URL}/auth/guest`, { method: 'POST' });
    const guest = await guestRes.json();

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${guest.token}`,
      'Idempotency-Key': idempotencyKey,
    };
    const body = JSON.stringify({ productId, quantity: 1 });

    const res1 = await fetch(`${BASE_URL}/checkout`, { method: 'POST', headers, body });
    const res2 = await fetch(`${BASE_URL}/checkout`, { method: 'POST', headers, body });

    // Both should return the same status (either 202 or 503)
    expect(res1.status).toBe(res2.status);

    if (res1.status === 202) {
      const data1 = await res1.json();
      const data2 = await res2.json();
      expect(data1.jobId).toBe(data2.jobId);
    }
  });

  it('POST /checkout with per-user dedup returns 409', async () => {
    // The first guest user already attempted a checkout above
    const res = await fetch(`${BASE_URL}/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${guestToken}`,
        'Idempotency-Key': crypto.randomUUID(), // new key
      },
      body: JSON.stringify({ productId, quantity: 1 }),
    });

    // Should be 409 (already_attempted) since this user already checked out
    // OR 503 if the drop hasn't started
    expect([409, 503]).toContain(res.status);
  });

  it('GET /queue-status/:jobId returns 404 for nonexistent job', async () => {
    const res = await fetch(`${BASE_URL}/queue-status/999999`);
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe('not_found');
  });

});
