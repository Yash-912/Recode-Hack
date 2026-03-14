const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/db');

async function createOrder({ userId, productId, idempotencyKey, amountPaise }) {
  const id = uuidv4();
  await query(
    `INSERT INTO orders (id, user_id, product_id, status, idempotency_key, amount_paise)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, userId, productId, 'confirmed', idempotencyKey, amountPaise]
  );
  return id;
}

async function getOrdersByProduct(productId) {
  const { rows } = await query(
    `SELECT * FROM orders WHERE product_id = $1 AND status = 'confirmed' ORDER BY created_at ASC`,
    [productId]
  );
  return rows;
}

async function logCheckoutAttempt({ userId, productId, result, latencyMs }) {
  try {
    const id = uuidv4();
    await query(
      `INSERT INTO checkout_attempts (id, user_id, product_id, result, latency_ms)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, userId, productId, result, latencyMs]
    );
  } catch (err) {
    console.error('[OrderService] Failed to log checkout attempt:', err.message);
  }
}

module.exports = { createOrder, getOrdersByProduct, logCheckoutAttempt };
