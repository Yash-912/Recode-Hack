const express = require('express');
const router = express.Router();
const { verifyAdmin } = require('../middleware/auth');
const redis = require('../config/redis');
const { query } = require('../config/db');
const { getMetrics } = require('../services/metricsService');
const { spawn } = require('child_process');
const path = require('path');

// All admin routes require admin token
router.use(verifyAdmin);

// POST /admin/products — Create a product and seed inventory
router.post('/products', async (req, res) => {
  try {
    const { name, totalStock, pricePaise, dropOffsetSeconds = 30 } = req.body;

    if (!name || !totalStock || !pricePaise) {
      return res.status(400).json({ error: 'missing_fields', message: 'name, totalStock, pricePaise required' });
    }

    const dropTime = new Date(Date.now() + dropOffsetSeconds * 1000);

    // Insert to PostgreSQL
    const result = await query(
      `INSERT INTO products (name, total_stock, price_paise, drop_time) VALUES ($1, $2, $3, $4) RETURNING id`,
      [name, totalStock, pricePaise, dropTime]
    );
    const product = result.rows[0];
    const productId = product.id;

    // Seed Redis inventory
    await redis.set(`inventory:${productId}`, totalStock);
    await redis.set(`inventory:${productId}:total`, totalStock);
    await redis.set(`drop:${productId}:unlock_at`, dropTime.getTime());

    // Add to scheduled_drops sorted set (score = unlock timestamp in ms)
    await redis.zadd('scheduled_drops', dropTime.getTime(), productId);

    console.log(`[Admin] Created product "${name}" (${productId}), stock=${totalStock}, drop=${dropTime.toISOString()}`);
    res.status(201).json({ productId, name, totalStock, pricePaise, dropTime });
  } catch (err) {
    console.error('[Admin] Create product error:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// POST /admin/products/:id/reset — Reset inventory in Redis
router.post('/products/:id/reset', async (req, res) => {
  try {
    const { id } = req.params;
    const { stock } = req.body;

    if (stock === undefined) {
      return res.status(400).json({ error: 'missing_stock' });
    }

    const prev = await redis.get(`inventory:${id}`);
    await redis.set(`inventory:${id}`, stock);
    await redis.set(`inventory:${id}:total`, stock);

    // Log to inventory_log if table exists
    try {
      await query(
        `INSERT INTO inventory_log (product_id, stock_before, stock_after, action, created_at)
         VALUES ($1, $2, $3, 'admin_reset', NOW())`,
        [id, parseInt(prev) || 0, stock]
      );
    } catch (_) {
      // Table may not exist yet — non-fatal
    }

    res.json({ productId: id, newStock: stock, previousStock: parseInt(prev) || 0 });
  } catch (err) {
    console.error('[Admin] Reset inventory error:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// POST /admin/products/:id/unlock — Unlock a drop immediately
router.post('/products/:id/unlock', async (req, res) => {
  try {
    const { id } = req.params;
    const now = Date.now();

    await redis.set(`drop:${id}:unlock_at`, now);
    await redis.zrem('scheduled_drops', id);

    // Broadcast unlock over Socket.io if io is attached to app
    const io = req.app.get('io');
    if (io) {
      io.to(`product:${id}`).emit('drop_unlocked', { productId: id, unlockedAt: now });
    }

    res.json({ productId: id, unlockedAt: new Date(now).toISOString() });
  } catch (err) {
    console.error('[Admin] Unlock drop error:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// PUT /admin/mode — Toggle naive vs protected gate mode
router.put('/mode', async (req, res) => {
  try {
    const { mode } = req.body;

    if (!['naive', 'protected'].includes(mode)) {
      return res.status(400).json({ error: 'invalid_mode', message: 'mode must be "naive" or "protected"' });
    }

    await redis.set('gate_mode', mode);
    console.log(`[Admin] Gate mode changed to: ${mode}`);

    // Broadcast to admin WebSocket room
    const io = req.app.get('io');
    if (io) {
      io.to('admin').emit('mode_changed', { mode });
    }

    res.json({ mode });
  } catch (err) {
    console.error('[Admin] Mode change error:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// GET /admin/mode — Get current gate mode
router.get('/mode', async (req, res) => {
  try {
    const mode = await redis.get('gate_mode') || 'protected';
    res.json({ mode });
  } catch (err) {
    res.status(500).json({ error: 'server_error' });
  }
});

// GET /admin/metrics — Get current performance metrics snapshot
router.get('/metrics', (req, res) => {
  try {
    const metrics = getMetrics();
    res.json(metrics);
  } catch (err) {
    res.status(500).json({ error: 'server_error' });
  }
});

// GET /admin/inventory-log/:productId — Retrieve inventory change history
router.get('/inventory-log/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const result = await query(
      `SELECT * FROM inventory_log WHERE product_id = $1 ORDER BY created_at ASC`,
      [productId]
    );
    res.json(result.rows);
  } catch (err) {
    // Return empty if table doesn't exist yet
    res.json([]);
  }
});

// GET /admin/export — Export checkout_attempts as CSV
router.get('/export', async (req, res) => {
  try {
    const { productId } = req.query;

    const result = await query(
      `SELECT user_id, product_id, result, latency_ms, created_at
       FROM checkout_attempts
       WHERE product_id = $1
       ORDER BY created_at ASC`,
      [productId]
    );

    const header = 'user_id,product_id,result,latency_ms,created_at\n';
    const csv = result.rows
      .map(r => `${r.user_id},${r.product_id},${r.result},${r.latency_ms},${r.created_at}`)
      .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="checkout_attempts_${productId}.csv"`);
    res.send(header + csv);
  } catch (err) {
    console.error('[Admin] Export error:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// POST /admin/run-load-test — Spawn the concurrent load test script
router.post('/run-load-test', (req, res) => {
  const io = req.app.get('io');
  const scriptPath = path.resolve(__dirname, '../../../load-test/concurrent-test.js');

  res.status(202).json({ message: 'Load test started', scriptPath });

  // Stream output to admin Socket.io room
  const child = spawn('node', [scriptPath], {
    env: { ...process.env },
    cwd: path.resolve(__dirname, '../../../load-test')
  });

  child.stdout.on('data', (data) => {
    const line = data.toString().trim();
    if (line && io) io.to('admin').emit('load_test_output', { line, type: 'stdout' });
    console.log('[LoadTest]', line);
  });

  child.stderr.on('data', (data) => {
    const line = data.toString().trim();
    if (line && io) io.to('admin').emit('load_test_output', { line, type: 'stderr' });
    console.error('[LoadTest ERROR]', line);
  });

  child.on('close', (code) => {
    const line = `\n--- Load test finished with exit code ${code} ---`;
    if (io) io.to('admin').emit('load_test_output', { line, type: 'done' });
    console.log('[LoadTest] Done, code:', code);
  });

  child.on('error', (err) => {
    if (io) io.to('admin').emit('load_test_output', { line: `ERROR: ${err.message}`, type: 'error' });
  });
});

module.exports = router;
