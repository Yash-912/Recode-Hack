require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { faker } = require('@faker-js/faker');
const Redis = require('ioredis');
const { pool, query, connectDB, disconnectDB } = require('../config/db');
const { seedInventory } = require('../services/inventoryGate');

async function runSeed() {
  const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
  const DATABASE_URL = process.env.DATABASE_URL;

  console.log('[Seed] Discovered REDIS_URL:', REDIS_URL ? 'Loaded' : 'Missing');
  console.log('[Seed] Discovered DATABASE_URL:', DATABASE_URL ? 'Loaded' : 'Missing');
  
  console.log('[Seed] Connecting to DB & Redis...');
  const redis = new Redis(REDIS_URL);
  
  try {
    await connectDB();

    // 1. Run migrations
    console.log('[Seed] Running migrations...');
    const migrationFile = path.resolve(__dirname, '../../db/migrations/001_initial.sql');
    const sql = fs.readFileSync(migrationFile, 'utf8');
    await query(sql);

    // 2. Clear data safely
    console.log('[Seed] Clearing existing data...');
    await query('TRUNCATE TABLE waitlist, checkout_attempts, inventory_log, orders CASCADE');
    await query('TRUNCATE TABLE products CASCADE');
    await query('TRUNCATE TABLE users CASCADE');

    const keys = await redis.keys('inventory:*');
    const dropKeys = await redis.keys('drop:*');
    if (keys.length > 0) await redis.del(...keys);
    if (dropKeys.length > 0) await redis.del(...dropKeys);

    // 3. Create demo product
    console.log('[Seed] Creating demo product...');
    const dropTime = Date.now() + 30000; // 30s in the future
    const productId = uuidv4();
    
    await query(
      `INSERT INTO products (id, name, description, price_paise, image_url, total_stock, drop_time)
       VALUES ($1, $2, $3, $4, $5, $6, to_timestamp($7))`,
      [
        productId,
        "Midnight Hoodie Drop",
        "Exclusive limited-edition midnight hoodie. Only 10 in existence.",
        299900,
        "https://via.placeholder.com/400x400.png?text=Midnight+Hoodie",
        10,
        dropTime / 1000
      ]
    );

    console.log(`[Seed] Created Product ID: ${productId}`);
    
    // 4. Mock Users
    for (let i = 0; i < 5; i++) {
        await query(
            `INSERT INTO users (id, email, name) VALUES ($1, $2, $3)`,
            [uuidv4(), faker.internet.email(), faker.person.fullName()]
        );
    }
    console.log(`[Seed] Created 5 mock users.`);

    // 5. Seed Redis
    await seedInventory(redis, productId, 10, dropTime);
    await redis.set('gate_mode', 'protected');

    console.log(`[Seed] Seed complete!`);
    console.log(`\n================================`);
    console.log(`[Demo] PRODUCT_ID=${productId}`);
    console.log(`[Demo] DROP_TIME=${new Date(dropTime).toISOString()}`);
    console.log(`================================\n`);

  } catch (err) {
    console.error('[Seed] Error during seeding:', err);
  } finally {
    await disconnectDB();
    redis.disconnect();
    console.log('[Seed] Disconnected.');
  }
}

runSeed();
