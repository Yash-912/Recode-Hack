const fs = require('fs');
const path = require('path');

let scriptSha = null;

/**
 * Load the Lua script into Redis via SCRIPT LOAD.
 * Stores the returned SHA1 hash for use with EVALSHA.
 * Must be called once at server startup before any purchase attempts.
 */
async function loadScript(redis) {
  const luaPath = path.join(__dirname, '..', 'scripts', 'inventory_gate.lua');
  const script = fs.readFileSync(luaPath, 'utf-8');
  scriptSha = await redis.script('LOAD', script);
  console.log(`[InventoryGate] Lua script loaded. SHA: ${scriptSha}`);
  return scriptSha;
}

/**
 * Protected purchase — uses the atomic Lua gate.
 * Check-and-decrement happens as a single, uninterruptible Redis operation.
 *
 * @param {object} redis   - ioredis client
 * @param {string} productId - The product's ID
 * @param {number} qty     - Quantity to purchase (default 1)
 * @returns {{ success: boolean, remaining?: number, reason?: string }}
 */
async function attemptPurchase(redis, productId, qty = 1) {
  if (!scriptSha) {
    throw new Error('Lua script not loaded. Call loadScript() first.');
  }

  const key = `inventory:${productId}`;
  const result = await redis.evalsha(scriptSha, 1, key, qty);

  if (result >= 0) {
    return { success: true, remaining: result };
  } else if (result === -1) {
    return { success: false, reason: 'not_found' };
  } else if (result === -2) {
    return { success: false, reason: 'sold_out' };
  }

  return { success: false, reason: 'unknown_error' };
}

/**
 * Naive purchase — the DELIBERATELY BROKEN implementation.
 * Uses separate GET then DECRBY with a gap between them.
 * This is the "Naive Mode" for the demo — it WILL oversell under concurrency.
 *
 * The gap between GET and DECRBY allows other requests to slip through,
 * causing the counter to go negative (overselling).
 *
 * @param {object} redis   - ioredis client
 * @param {string} productId - The product's ID
 * @returns {{ success: boolean, remaining?: number, reason?: string }}
 */
async function naivePurchase(redis, productId) {
  const key = `inventory:${productId}`;

  // Step 1: READ current stock
  const current = await redis.get(key);

  if (current === null) {
    return { success: false, reason: 'not_found' };
  }

  // ⚠️ THE GAP — between reading and writing, other requests can read
  // the same "current" value and all think there's stock available.
  // This is the classic race condition we're demonstrating.

  if (parseInt(current) > 0) {
    // Step 2: DECREMENT — but by now, stock may already be 0 or negative
    const remaining = await redis.decrby(key, 1);
    return { success: true, remaining };
  }

  return { success: false, reason: 'sold_out' };
}

/**
 * Seed inventory into Redis for a product.
 *
 * @param {object} redis        - ioredis client
 * @param {string} productId    - The product's ID
 * @param {number} stock        - Initial stock count
 * @param {number} dropTimestamp - Unix timestamp (ms) when the drop unlocks
 */
async function seedInventory(redis, productId, stock, dropTimestamp) {
  const pipeline = redis.pipeline();
  pipeline.set(`inventory:${productId}`, stock);
  pipeline.set(`inventory:${productId}:total`, stock);
  pipeline.set(`drop:${productId}:unlock_at`, dropTimestamp);
  await pipeline.exec();

  console.log(`[InventoryGate] Seeded product ${productId}: stock=${stock}, dropAt=${new Date(dropTimestamp).toISOString()}`);
}

module.exports = {
  loadScript,
  attemptPurchase,
  naivePurchase,
  seedInventory,
};
