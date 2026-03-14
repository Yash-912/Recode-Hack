const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { z } = require('zod');
const { query } = require('../config/db');
const redis = require('../config/redis');
const { signToken, authenticate } = require('../middleware/auth');
const { checkoutLimiter } = require('../middleware/ratelimit');
const { getCheckoutQueue } = require('../workers/checkoutWorker');

const router = express.Router();

const checkoutSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(1),
});

/**
 * POST /api/auth/guest
 * Create a guest user in PostgreSQL, return JWT.
 */
router.post('/auth/guest', async (req, res) => {
  try {
    const guestId = uuidv4();
    const email = `guest-${guestId}@dropzone.demo`;

    const { rows } = await query(
      'INSERT INTO users (id, email, name) VALUES ($1, $2, $3) RETURNING id',
      [guestId, email, 'Guest']
    );
    const userId = rows[0].id;
    const token = signToken({ userId });

    res.status(201).json({ token, userId });
  } catch (err) {
    console.error('[Auth] Error creating guest:', err.message);
    res.status(500).json({ error: 'server_error', message: 'Failed to create guest user' });
  }
});

/**
 * POST /api/checkout
 */
router.post('/checkout', authenticate, checkoutLimiter, async (req, res) => {
  const startTime = Date.now();

  try {
    // 1. Validate body
    const parseResult = checkoutSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'invalid_request',
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const { productId, quantity } = parseResult.data;
    const userId = req.user.userId;

    // 2. Check idempotency key
    const idempotencyKey = req.headers['idempotency-key'];
    if (!idempotencyKey) {
      return res.status(400).json({
        error: 'missing_idempotency_key',
        message: 'Idempotency-Key header is required',
      });
    }

    // 3. Cache response for idempotency
    const cachedResponse = await redis.get(`idempotency:${idempotencyKey}`);
    if (cachedResponse) {
      return res.status(202).json(JSON.parse(cachedResponse));
    }

    // 4. Per-user dedup
    const dedupKey = `checkout_attempt:${userId}:${productId}`;
    const alreadyAttempted = await redis.get(dedupKey);
    if (alreadyAttempted) {
      return res.status(409).json({
        error: 'already_attempted',
        message: 'You have already attempted to purchase this product',
      });
    }

    // 5. Drop lock check
    const unlockAt = await redis.get(`drop:${productId}:unlock_at`);
    if (unlockAt && parseInt(unlockAt) > Date.now()) {
      return res.status(503).json({
        error: 'drop_not_started',
        message: 'This drop has not started yet',
        unlockAt: parseInt(unlockAt),
      });
    }

    // 6. Checkout token check
    const checkoutToken = req.headers['x-checkout-token'];
    if (checkoutToken) {
      const tokenData = await redis.get(`checkout_token:${checkoutToken}`);
      if (!tokenData) {
        return res.status(401).json({
          error: 'checkout_token_invalid',
          message: 'Checkout token is expired or already used',
        });
      }
      await redis.del(`checkout_token:${checkoutToken}`);
    }

    await redis.set(dedupKey, '1', 'EX', 86400);

    // Enqueue
    const queue = getCheckoutQueue();
    const job = await queue.add({
      userId,
      productId,
      quantity,
      idempotencyKey,
      enqueuedAt: Date.now(),
    });

    const waitingCount = await queue.getWaitingCount();
    const estimatedWait = waitingCount * 50;

    const response = {
      jobId: job.id,
      position: waitingCount,
      estimatedWait,
      message: 'Checkout request accepted and queued',
    };

    await redis.set(`idempotency:${idempotencyKey}`, JSON.stringify(response), 'EX', 86400);

    res.status(202).json(response);

  } catch (err) {
    console.error('[Checkout] Error:', err.message);
    res.status(500).json({ error: 'server_error', message: 'Checkout failed' });
  }
});

module.exports = router;
