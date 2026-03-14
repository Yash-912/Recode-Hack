const Queue = require('bull');
const redis = require('../config/redis');
const { attemptPurchase, naivePurchase } = require('../services/inventoryGate');
const { createOrder, logCheckoutAttempt } = require('../services/orderService');

// Map to store active queues: { [productId]: Queue }
const activeQueues = new Map();

/**
 * Creates and starts a Bull queue for a specific product.
 * @param {string} productId 
 * @returns {Queue} The created or existing queue
 */
async function spawnWorker(productId) {
  if (activeQueues.has(productId)) {
    return activeQueues.get(productId);
  }

  const queueName = `checkout-queue:${productId}`;
  const queue = new Queue(queueName, process.env.REDIS_URL || 'redis://localhost:6379');

  // Register in Redis for cross-instance discovery
  await redis.sadd('active_queues', productId);

  // Process jobs for this specific product
  // Concurrency is 1 per worker pool to maintain strict ordering per product
  queue.process(1, async (job) => {
    const { userId, quantity = 1, idempotencyKey } = job.data;
    const startTime = Date.now();

    try {
      // 1. Check Gate Mode
      const gateMode = await redis.get('gate_mode') || 'protected';
      
      let gateResult;
      if (gateMode === 'naive') {
        gateResult = await naivePurchase(redis, productId);
      } else {
        gateResult = await attemptPurchase(redis, productId, quantity);
      }

      // 2. Handle Gate Result
      if (!gateResult.success) {
        await logCheckoutAttempt({
          userId,
          productId,
          result: `failed_${gateResult.reason}`,
          latencyMs: Date.now() - startTime
        });
        
        // Wait, IO is going to be handled via Outbox in Improvement 2. 
        // For now, keep the IO emit but we will replace it later.
        const { getIO } = require('../config/websocket');
        try {
          const io = getIO();
          io.to(`product:${productId}`).emit('sold_out', { productId });
        } catch (e) { /* WS not ready yet */ }

        return { success: false, reason: gateResult.reason };
      }

      // 3. Create Order
      // Price would normally be fetched securely from DB/Redis
      const amountPaise = 299900; 

      const orderId = await createOrder({
        userId,
        productId,
        idempotencyKey,
        amountPaise
      });

      await logCheckoutAttempt({
        userId,
        productId,
        result: 'success',
        latencyMs: Date.now() - startTime
      });

      // Emit updates (to be replaced by outbox later)
      try {
        const io = getIO();
        io.to(`product:${productId}`).emit('inventory_update', {
          productId,
          remaining: gateResult.remaining
        });
        io.to(`user:${userId}`).emit('checkout_result', {
          success: true,
          orderId,
          productId
        });
      } catch (e) { /* WS not ready yet */ }

      return { success: true, orderId, remaining: gateResult.remaining };

    } catch (error) {
      console.error(`[Worker ${productId}] Error processing job ${job.id}:`, error.message);
      
      // Compensating action: restore inventory if order creation failed
      await redis.incrby(`inventory:${productId}`, quantity);
      
      throw error;
    }
  });

  queue.on('completed', (job, result) => {
    console.log(`[Worker ${productId}] Job ${job.id} completed:`, result.success ? 'Success' : `Failed (${result.reason})`);
  });

  queue.on('failed', (job, err) => {
    console.error(`[Worker ${productId}] Job ${job.id} failed:`, err.message);
  });

  activeQueues.set(productId, queue);
  console.log(`[WorkerManager] Spawned worker pool for product: ${productId}`);
  
  return queue;
}

/**
 * Gets an existing queue for a product, or null if it doesn't exist.
 * @param {string} productId 
 * @returns {Queue|null}
 */
function getWorker(productId) {
  return activeQueues.get(productId) || null;
}

/**
 * Returns all active queues.
 * @returns {Map<string, Queue>}
 */
function getAll() {
  return activeQueues;
}

/**
 * Gracefully shuts down a worker pool and removes it from the registry.
 * @param {string} productId 
 */
async function destroyWorker(productId) {
  const queue = activeQueues.get(productId);
  if (queue) {
    await queue.close();
    activeQueues.delete(productId);
    await redis.srem('active_queues', productId);
    console.log(`[WorkerManager] Destroyed worker pool for product: ${productId}`);
  }
}

/**
 * Initialize queue listeners for already active queues in Redis
 * Useful on server restart
 */
async function initializeFromRedis() {
  const activeIds = await redis.smembers('active_queues');
  for (const productId of activeIds) {
    await spawnWorker(productId);
  }
  if (activeIds.length > 0) {
    console.log(`[WorkerManager] Restored ${activeIds.length} worker pools from Redis`);
  }
}

module.exports = {
  spawnWorker,
  getWorker,
  getAll,
  destroyWorker,
  initializeFromRedis
};
