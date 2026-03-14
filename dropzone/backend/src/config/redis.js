const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

redis.on('connect', () => {
  console.log('[Redis] Connected successfully');
});

redis.on('error', (err) => {
  console.error('[Redis] Connection error:', err.message);
});

// Graceful shutdown
process.on('SIGTERM', () => redis.disconnect());
process.on('SIGINT', () => redis.disconnect());

module.exports = redis;
