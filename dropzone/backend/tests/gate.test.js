require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const Redis = require('ioredis');
const { loadScript, attemptPurchase, naivePurchase, seedInventory } = require('../src/services/inventoryGate');

/**
 * Gate Unit Tests (Vitest)
 *
 * These tests prove the core thesis of DropZone:
 * - Protected mode (Lua script) is atomic — stock NEVER goes negative
 * - Naive mode (GET-then-DECRBY) DOES oversell under concurrency
 *
 * Test 4 is THE critical test. If it fails, the project's core story breaks.
 */

let redis;

beforeAll(async () => {
  redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  await loadScript(redis);
});

afterAll(async () => {
  await redis.quit();
});

beforeEach(async () => {
  // Clean up all test keys before each test
  const keys = await redis.keys('inventory:test-*');
  const dropKeys = await redis.keys('drop:test-*');
  const allKeys = [...keys, ...dropKeys];
  if (allKeys.length > 0) {
    await redis.del(...allKeys);
  }
});

describe('Atomic Gate — Core Tests', () => {

  it('Test 1: Single decrement from stock=10 returns 9', async () => {
    const productId = 'test-single-decrement';
    await redis.set(`inventory:${productId}`, 10);

    const result = await attemptPurchase(redis, productId, 1);

    expect(result.success).toBe(true);
    expect(result.remaining).toBe(9);

    // Verify Redis counter
    const stock = await redis.get(`inventory:${productId}`);
    expect(parseInt(stock)).toBe(9);
  });

  it('Test 2: Decrement when stock=0 returns sold_out', async () => {
    const productId = 'test-zero-stock';
    await redis.set(`inventory:${productId}`, 0);

    const result = await attemptPurchase(redis, productId, 1);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('sold_out');

    // Counter should still be 0, not negative
    const stock = await redis.get(`inventory:${productId}`);
    expect(parseInt(stock)).toBe(0);
  });

  it('Test 3: Decrement when key does not exist returns not_found', async () => {
    const productId = 'test-nonexistent-product';
    // Deliberately don't set any key

    const result = await attemptPurchase(redis, productId, 1);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('not_found');
  });

  it('Test 4 [CRITICAL]: 1000 concurrent attempts against stock=100 — exactly 100 succeed', async () => {
    // ═══════════════════════════════════════════════════════════
    // THIS IS THE TEST THAT PROVES THE PROJECT'S CORE THESIS.
    //
    // If the Lua gate is truly atomic, then out of 1000 simultaneous
    // purchase attempts against stock=100:
    //   - Exactly 100 will succeed (return remaining >= 0)
    //   - Exactly 900 will be rejected (return sold_out)
    //   - Final counter will be EXACTLY 0 (never negative)
    //
    // If this test fails, the entire project's demo story breaks.
    // ═══════════════════════════════════════════════════════════

    const productId = 'test-atomicity-proof';
    const STOCK = 100;
    const CONCURRENT_REQUESTS = 1000;

    await redis.set(`inventory:${productId}`, STOCK);

    // Fire ALL 1000 requests simultaneously
    const promises = Array.from({ length: CONCURRENT_REQUESTS }, () =>
      attemptPurchase(redis, productId, 1)
    );

    const results = await Promise.all(promises);

    // Count outcomes
    const successes = results.filter(r => r.success === true);
    const soldOuts = results.filter(r => r.reason === 'sold_out');

    // THE ASSERTIONS THAT MATTER:
    expect(successes.length).toBe(STOCK);                            // Exactly 100 succeeded
    expect(soldOuts.length).toBe(CONCURRENT_REQUESTS - STOCK);      // Exactly 900 rejected

    // Final counter must be EXACTLY 0 — never negative
    const finalStock = parseInt(await redis.get(`inventory:${productId}`));
    expect(finalStock).toBe(0);

    console.log(`\n  ✅ ATOMICITY PROVEN:`);
    console.log(`     ${CONCURRENT_REQUESTS} concurrent requests, stock=${STOCK}`);
    console.log(`     Successes: ${successes.length} (expected ${STOCK})`);
    console.log(`     Rejections: ${soldOuts.length} (expected ${CONCURRENT_REQUESTS - STOCK})`);
    console.log(`     Final stock: ${finalStock} (expected 0)\n`);
  });

  it('Test 5 [CONTRAST]: 100 concurrent naive attempts against stock=10 — stock goes NEGATIVE', async () => {
    // ═══════════════════════════════════════════════════════════
    // THIS TEST PROVES THE NAIVE MODE IS BROKEN.
    //
    // The naive GET-then-DECRBY approach has a race condition gap.
    // Under concurrency, multiple requests read the same stock value
    // before any of them decrement, causing overselling.
    //
    // We expect the final counter to be negative (stock < 0).
    // If it IS negative, that proves the race condition EXISTS and
    // the protected mode's Lua script is necessary.
    // ═══════════════════════════════════════════════════════════

    const productId = 'test-naive-race-condition';
    const STOCK = 10;
    const CONCURRENT_REQUESTS = 100;

    await redis.set(`inventory:${productId}`, STOCK);

    // Fire 100 naive purchases simultaneously
    const promises = Array.from({ length: CONCURRENT_REQUESTS }, () =>
      naivePurchase(redis, productId)
    );

    const results = await Promise.all(promises);

    const successes = results.filter(r => r.success === true);
    const finalStock = parseInt(await redis.get(`inventory:${productId}`));

    // The naive approach should oversell — more than STOCK successes
    // and/or the counter goes negative
    console.log(`\n  ⚠️  NAIVE MODE RESULTS (proves the race condition):`);
    console.log(`     ${CONCURRENT_REQUESTS} concurrent requests, stock=${STOCK}`);
    console.log(`     Successes: ${successes.length} (should be > ${STOCK} — OVERSOLD!)`);
    console.log(`     Final stock: ${finalStock} (should be negative — BROKEN!)\n`);

    // Either we got more successes than stock, or stock went negative
    // (Both prove the race condition; the exact behavior depends on timing)
    const hasOversold = successes.length > STOCK || finalStock < 0;
    expect(hasOversold).toBe(true);
  });

});

describe('Inventory Gate — Utility Tests', () => {

  it('seedInventory sets all required Redis keys', async () => {
    const productId = 'test-seed';
    const stock = 50;
    const dropTime = Date.now() + 30000;

    await seedInventory(redis, productId, stock, dropTime);

    const currentStock = await redis.get(`inventory:${productId}`);
    const totalStock = await redis.get(`inventory:${productId}:total`);
    const unlockAt = await redis.get(`drop:${productId}:unlock_at`);

    expect(parseInt(currentStock)).toBe(stock);
    expect(parseInt(totalStock)).toBe(stock);
    expect(parseInt(unlockAt)).toBe(dropTime);
  });

  it('attemptPurchase with qty=3 decrements by 3', async () => {
    const productId = 'test-multi-qty';
    await redis.set(`inventory:${productId}`, 10);

    const result = await attemptPurchase(redis, productId, 3);

    expect(result.success).toBe(true);
    expect(result.remaining).toBe(7);
  });

  it('attemptPurchase with qty=5 against stock=3 returns sold_out', async () => {
    const productId = 'test-insufficient-qty';
    await redis.set(`inventory:${productId}`, 3);

    const result = await attemptPurchase(redis, productId, 5);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('sold_out');

    // Stock unchanged
    const stock = await redis.get(`inventory:${productId}`);
    expect(parseInt(stock)).toBe(3);
  });

});
