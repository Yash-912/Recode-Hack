const { Server } = require('socket.io');

let io = null;

/**
 * Initialize Socket.io and attach to the HTTP server.
 * Phase 2: stub — just creates the server and exports `io`.
 * Phase 3 will add full room/event logic.
 */
function initWebSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log(`[WS] Client connected: ${socket.id}`);

    socket.on('disconnect', () => {
      console.log(`[WS] Client disconnected: ${socket.id}`);
    });
  });

  console.log('[WebSocket] Socket.io server initialized');
  return io;
}

function getIO() {
  if (!io) {
    throw new Error('Socket.io not initialized. Call initWebSocket() first.');
  }
  return io;
}

module.exports = { initWebSocket, getIO };
