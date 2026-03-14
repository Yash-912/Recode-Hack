const rateLimit = require('express-rate-limit');

/**
 * Global rate limiter — 100 requests per second per IP.
 * Applied to all routes as baseline protection.
 */
const globalLimiter = rateLimit({
  windowMs: 1000,       // 1 second window
  max: 100,             // 100 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'rate_limited', message: 'Too many requests, slow down', retryAfter: 1 },
});

/**
 * Checkout-specific rate limiter — 5 requests per second per IP.
 * Applied only to POST /api/checkout for tighter burst control.
 */
const checkoutLimiter = rateLimit({
  windowMs: 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'rate_limited', message: 'Too many checkout attempts', retryAfter: 1 },
});

module.exports = { globalLimiter, checkoutLimiter };
