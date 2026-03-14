const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { query } = require('../config/db');

// POST /api/waitlist — Add authenticated user to waitlist for a product
router.post('/waitlist', authenticate, async (req, res) => {
  try {
    const { productId } = req.body;
    const { userId } = req.user;

    if (!productId) {
      return res.status(400).json({ error: 'missing_productId' });
    }

    // Check if already on the waitlist
    const existing = await query(
      `SELECT id, position FROM waitlist WHERE user_id = $1 AND product_id = $2`,
      [userId, productId]
    );

    if (existing.rows.length > 0) {
      return res.json({
        message: 'already_on_waitlist',
        position: existing.rows[0].position,
        estimatedChance: calculateChance(existing.rows[0].position)
      });
    }

    // Get the next position
    const maxResult = await query(
      `SELECT COALESCE(MAX(position), 0) + 1 AS next_pos FROM waitlist WHERE product_id = $1`,
      [productId]
    );
    const position = maxResult.rows[0].next_pos;

    // Insert
    await query(
      `INSERT INTO waitlist (user_id, product_id, position, created_at) VALUES ($1, $2, $3, NOW())`,
      [userId, productId, position]
    );

    res.status(201).json({
      message: 'added_to_waitlist',
      position,
      estimatedChance: calculateChance(position)
    });
  } catch (err) {
    console.error('[Waitlist] Error:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// GET /api/waitlist/:productId — Get waitlist size for a product
router.get('/waitlist/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const result = await query(
      `SELECT COUNT(*) as count FROM waitlist WHERE product_id = $1`,
      [productId]
    );
    res.json({ productId, waitlistCount: parseInt(result.rows[0].count) });
  } catch (err) {
    res.status(500).json({ error: 'server_error' });
  }
});

function calculateChance(position) {
  // Rough estimate: assume 5-10% cancellation rate per slot
  const cancellationRate = 0.07;
  const chance = Math.min(100, Math.floor((1 / position) * cancellationRate * 100 * 100));
  return `${chance}%`;
}

module.exports = router;
