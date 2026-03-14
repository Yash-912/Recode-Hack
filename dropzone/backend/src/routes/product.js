const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/db');
const redis = require('../config/redis');

const router = express.Router();

/**
 * GET /api/products/:id
 * Fetch product details from PostgreSQL, enrich with live stock from Redis.
 */
router.get('/products/:id', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    const product = rows[0];

    if (!product) {
      return res.status(404).json({ error: 'not_found', message: 'Product not found' });
    }

    // Enrich with live inventory from Redis
    const remaining = await redis.get(`inventory:${product.id}`);
    const total = await redis.get(`inventory:${product.id}:total`);

    res.json({
      id: product.id,
      name: product.name,
      description: product.description,
      pricePaise: product.price_paise,
      imageUrl: product.image_url,
      totalStock: product.total_stock,
      dropTime: product.drop_time,
      isActive: product.is_active,
      inventory: {
        remaining: remaining !== null ? parseInt(remaining) : product.total_stock,
        total: total !== null ? parseInt(total) : product.total_stock,
      },
    });
  } catch (err) {
    console.error('[Product] Error fetching product:', err.message);
    res.status(500).json({ error: 'server_error', message: 'Failed to fetch product' });
  }
});

/**
 * GET /api/products/:id/checkout-token
 * Generate a short-lived (30s) single-use checkout token.
 */
router.get('/products/:id/checkout-token', async (req, res) => {
  try {
    const { rows } = await query('SELECT id FROM products WHERE id = $1', [req.params.id]);
    const product = rows[0];

    if (!product) {
      return res.status(404).json({ error: 'not_found', message: 'Product not found' });
    }

    const token = uuidv4();
    const expiresIn = 30000; // 30 seconds
    const expiresAt = Date.now() + expiresIn;

    // Store token in Redis with 30s TTL
    await redis.set(
      `checkout_token:${token}`,
      JSON.stringify({ productId: product.id, createdAt: Date.now() }),
      'PX',
      expiresIn
    );

    res.json({ token, expiresAt, expiresIn });
  } catch (err) {
    console.error('[Product] Error generating checkout token:', err.message);
    res.status(500).json({ error: 'server_error', message: 'Failed to generate token' });
  }
});

router.get('/server-time', (req, res) => res.json({ timestamp: Date.now() }));
router.get('/health', (req, res) => res.json({ status: 'ok', timestamp: Date.now() }));

module.exports = router;
