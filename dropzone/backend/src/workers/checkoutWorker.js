const Queue = require('bull');
const redis = require('../config/redis');
const { attemptPurchase, naivePurchase } = require('../services/inventoryGate');
const { createOrder, logCheckoutAttempt } = require('../services/orderService');
const { query } = require('../config/db');

let checkoutQueue = null;
let ioInstance = null;

function initCheckoutQueue(io) {
  ioInstance = io;

  checkoutQueue = new Queue('checkout', process.env.REDIS_URL || 'redis://localhost:6379', {
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: { age: 3600 },
      removeOnFail: { age: 86400 },
      timeout: 5000,
    },
  });

  checkoutQueue.process(1, async (job) => {
    const startTime = Date.now();
    const { userId, productId, idempotencyKey, quantity = 1 } = job.data;

    try {
      const gateMode = (await redis.get('gate_mode')) || 'protected';

      let result;
      if (gateMode === 'naive') {
        result = await naivePurchase(redis, productId);
      } else {
        result = await attemptPurchase(redis, productId, quantity);
      }

      const latencyMs = Date.now() - startTime;

      if (result.success) {
        // Fetch product for price
        const { rows } = await query('SELECT price_paise FROM products WHERE id = $1', [productId]);
        const product = rows[0];
        const amountPaise = product ? product.price_paise : 0;

        let orderId;
        try {
          orderId = await createOrder({
            userId,
            productId,
            idempotencyKey,
            amountPaise,
          });
        } catch (dbErr) {
          console.error('[Worker] DB write failed, restoring inventory:', dbErr.message);
          await redis.incrby(`inventory:${productId}`, quantity);

          if (ioInstance) {
            ioInstance.to(`user:${userId}`).emit('checkout_result', {
              success: false,
              reason: 'server_error',
              productId,
            });
          }

          await logCheckoutAttempt({ userId, productId, result: 'error', latencyMs });
          return { success: false, reason: 'server_error' };
        }

        const total = parseInt(await redis.get(`inventory:${productId}:total`)) || 0;

        if (ioInstance) {
          ioInstance.to(`product:${productId}`).emit('inventory_update', {
            productId,
            remaining: result.remaining,
            total,
          });

          ioInstance.to(`user:${userId}`).emit('checkout_result', {
            success: true,
            orderId,
            remaining: result.remaining,
            productId,
          });

          if (result.remaining === 0) {
            ioInstance.to(`product:${productId}`).emit('sold_out', { productId });
          }
        }

        await logCheckoutAttempt({ userId, productId, result: 'confirmed', latencyMs });
        return { success: true, orderId, remaining: result.remaining };

      } else {
        if (ioInstance) {
          ioInstance.to(`user:${userId}`).emit('checkout_result', {
            success: false,
            reason: result.reason,
            productId,
          });

          if (result.reason === 'sold_out') {
            ioInstance.to(`product:${productId}`).emit('sold_out', { productId });
          }
        }

        await logCheckoutAttempt({ userId, productId, result: 'sold_out', latencyMs });
        return { success: false, reason: result.reason };
      }

    } catch (err) {
      const latencyMs = Date.now() - startTime;
      console.error('[Worker] Unexpected error processing job:', err.message);
      await logCheckoutAttempt({ userId, productId, result: 'error', latencyMs });
      throw err;
    }
  });

  checkoutQueue.on('completed', (job, result) => {
    console.log(`[Worker] Job ${job.id} completed:`, result.success ? '✓ confirmed' : '✗ ' + result.reason);
  });

  checkoutQueue.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job.id} failed:`, err.message);
  });

  console.log('[Worker] Checkout queue initialized (concurrency: 1)');
  return checkoutQueue;
}

function getCheckoutQueue() {
  if (!checkoutQueue) {
    throw new Error('Checkout queue not initialized. Call initCheckoutQueue() first.');
  }
  return checkoutQueue;
}

module.exports = { initCheckoutQueue, getCheckoutQueue };
