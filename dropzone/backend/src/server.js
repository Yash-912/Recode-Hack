require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const express = require('express');
const cors = require('cors');
const http = require('http');

const { connectDB } = require('./config/db');
const redis = require('./config/redis');
const { initWebSocket } = require('./config/websocket');
const { loadScript } = require('./services/inventoryGate');
const { initCheckoutQueue } = require('./workers/checkoutWorker');
const { globalLimiter } = require('./middleware/ratelimit');

const productRoutes = require('./routes/product');
const checkoutRoutes = require('./routes/checkout');
const queueRoutes = require('./routes/queue');
const adminRoutes = require('./routes/admin');
const waitlistRoutes = require('./routes/waitlist');
const metricsService = require('./services/metricsService');

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  // 1. Middleware
  app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
  app.use(express.json());
  app.use(globalLimiter);

  // 2. Database & Redis Connections
  await connectDB();
  
  // 3. Initialize gate script in Redis
  await loadScript(redis);

  // 4. Initialize WebSocket
  const io = initWebSocket(server);

  // Attach io to app instance so routes can access it
  app.set('io', io);

  // Start metrics broadcast every second
  setInterval(() => {
    const metrics = metricsService.getMetrics();
    io.to('admin').emit('metrics_tick', metrics);
  }, 1000);

  // 5. Initialize Bull Queue Worker
  initCheckoutQueue(io);

  // 6. Routes
  app.use('/api', productRoutes);
  app.use('/api', checkoutRoutes);
  app.use('/api', queueRoutes);
  app.use('/api', waitlistRoutes);
  app.use('/admin', adminRoutes);

  // 7. Start listening
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`[Server] DropZone backend listening on port ${PORT}`);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log('[Server] Shutting down gracefully...');
    server.close(() => {
      console.log('[Server] HTTP server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer().catch(err => {
  console.error('[Server] Failed to start:', err);
  process.exit(1);
});
