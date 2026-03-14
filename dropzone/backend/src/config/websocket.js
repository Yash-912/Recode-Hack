const { Server } = require('socket.io');

let io = null;
let viewerInterval = null;

/**
 * Initialize Socket.io and attach to the HTTP server.
 * Phase 3: Handles rooms, subscriptions, and viewer counts.
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

    // Join a product room to receive inventory updates and sold_out events
    socket.on('subscribe_product', ({ productId }) => {
      if (productId) {
        // Leave previous product rooms if any (optional, but good practice for SPAs)
        for (const room of socket.rooms) {
          if (room.startsWith('product:')) {
            socket.leave(room);
          }
        }
        
        const roomName = `product:${productId}`;
        socket.join(roomName);
        console.log(`[WS] ${socket.id} joined ${roomName}`);
      }
    });

    // Authenticate to receive personal checkout_result events
    socket.on('authenticate', ({ token }) => {
      try {
        const jwt = require('jsonwebtoken');
        const JWT_SECRET = process.env.JWT_SECRET || 'dropzone-jwt-secret-dev';
        const decoded = jwt.verify(token, JWT_SECRET);
        
        const roomName = `user:${decoded.userId}`;
        socket.join(roomName);
        console.log(`[WS] ${socket.id} authenticated and joined ${roomName}`);
      } catch (err) {
        socket.emit('error', { message: 'Authentication failed' });
      }
    });

    // Subscribe to admin events
    socket.on('subscribe_admin', ({ adminToken }) => {
      const expectedToken = process.env.ADMIN_TOKEN || 'dropzone-admin-secret';
      if (adminToken === expectedToken) {
        socket.join('admin');
        console.log(`[WS] ${socket.id} joined admin room`);
      } else {
        socket.emit('error', { message: 'Admin authentication failed' });
      }
    });

    socket.on('disconnect', () => {
      console.log(`[WS] Client disconnected: ${socket.id}`);
    });
  });

  // Start broadcasting viewer counts every 2 seconds
  startViewerCountBroadcast();

  console.log('[WebSocket] Socket.io server initialized with rooms');
  return io;
}

function startViewerCountBroadcast() {
  if (viewerInterval) clearInterval(viewerInterval);
  
  viewerInterval = setInterval(() => {
    if (!io) return;
    
    // Get all explicit product rooms (filtering out default socket ID rooms)
    const productRooms = Array.from(io.sockets.adapter.rooms.keys())
      .filter(room => room.startsWith('product:'));

    for (const room of productRooms) {
      const productId = room.split(':')[1];
      const count = io.sockets.adapter.rooms.get(room)?.size || 0;
      
      io.to(room).emit('viewer_count', {
        productId,
        count
      });
    }
  }, 2000);
}

function getIO() {
  if (!io) {
    throw new Error('Socket.io not initialized. Call initWebSocket() first.');
  }
  return io;
}

module.exports = { initWebSocket, getIO };
