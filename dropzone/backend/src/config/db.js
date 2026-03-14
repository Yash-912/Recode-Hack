const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://dropzone:dropzone@localhost:5432/dropzone',
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('neon') ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => {
  console.error('[PostgreSQL] Unexpected error on idle client', err);
  process.exit(-1);
});

async function connectDB() {
  try {
    const client = await pool.connect();
    console.log('[PostgreSQL] Connected successfully');
    client.release();
  } catch (err) {
    console.error('[PostgreSQL] Connection error:', err.message);
    process.exit(1);
  }
}

async function query(text, params) {
  return pool.query(text, params);
}

// Graceful shutdown
async function disconnectDB() {
  await pool.end();
  console.log('[PostgreSQL] Disconnected');
}

process.on('SIGTERM', disconnectDB);
process.on('SIGINT', disconnectDB);

module.exports = { connectDB, disconnectDB, query, pool };
