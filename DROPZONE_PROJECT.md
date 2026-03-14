# DropZone — Flash Sale Platform
### Hackathon Project Blueprint · PS 2: The Midnight Product Drop

---

## Table of Contents

1. [Project Vision](#1-project-vision)
2. [The Problem We're Solving — In Depth](#2-the-problem-were-solving--in-depth)
3. [Solution Overview](#3-solution-overview)
4. [Tech Stack](#4-tech-stack)
5. [System Architecture](#5-system-architecture)
6. [Module 1 — The Atomic Gate (Core Innovation)](#6-module-1--the-atomic-gate-core-innovation)
7. [Module 2 — API Layer & Rate Limiting](#7-module-2--api-layer--rate-limiting)
8. [Module 3 — Job Queue & Checkout Worker](#8-module-3--job-queue--checkout-worker)
9. [Module 4 — Database Design](#9-module-4--database-design)
10. [Module 5 — WebSocket Real-Time Layer](#10-module-5--websocket-real-time-layer)
11. [Module 6 — Frontend: The Drop Page](#11-module-6--frontend-the-drop-page)
12. [Module 7 — Frontend: Live Inventory Dashboard](#12-module-7--frontend-live-inventory-dashboard)
13. [Module 8 — Admin & Demo Control Panel](#13-module-8--admin--demo-control-panel)
14. [Bonus Features (Differentiators)](#14-bonus-features-differentiators)
15. [The Demo Script (How You Win)](#15-the-demo-script-how-you-win)
16. [Build Order & Time Plan](#16-build-order--time-plan)
17. [API Reference](#17-api-reference)
18. [Edge Cases & How We Handle Them](#18-edge-cases--how-we-handle-them)
19. [Load Testing Plan](#19-load-testing-plan)
20. [Judging Criteria Mapping](#20-judging-criteria-mapping)

---

## 1. Project Vision

**DropZone** is a production-grade flash sale infrastructure platform that solves the hardest
problem in high-demand e-commerce: what happens when ten thousand people try to buy one item
at the exact same moment.

Most flash sale systems fail silently. Inventory goes negative. Customers pay for items that
don't exist. The backend is fine — it just processed every request it received. The problem is
architectural. Without a proper gate, the system is broken by design.

DropZone demonstrates this failure mode live, then eliminates it entirely using atomic Redis
operations, a serialised job queue, real-time WebSocket broadcasts, and graceful rejection
handling. The platform is built to be demonstrated — every architectural decision is made
visible in the UI so judges can see exactly what is happening and why it works.

---

## 2. The Problem We're Solving — In Depth

### The Race Condition

A flash sale creates a classic read-modify-write race condition:

```
Thread A reads:  stock = 1  ✓ (passes check)
Thread B reads:  stock = 1  ✓ (passes check — happens before A writes)
Thread A writes: stock = 0  → confirms order A
Thread B writes: stock = -1 → confirms order B  ← WRONG
```

Both threads read the same value. Both pass the inventory check. Both write. The result is
negative inventory and two confirmation emails for one item.

This is not a bug in the code — it is a consequence of unprotected concurrent access to shared
mutable state. You cannot fix it by writing better application code. You need a mechanism that
makes the check and the decrement a single indivisible operation.

### Why This Is Hard

The problem compounds at scale. At midnight during a hyped drop:

- Requests arrive faster than any application-level lock can be acquired and released
- Horizontal scaling (multiple server instances) makes application-level locks completely useless
  because each instance has its own memory
- Database-level row locks work but are expensive and create a serialisation bottleneck
- Simple Redis `GET` + `SET` is still two operations with a gap between them

The correct solution requires either:
1. A Redis Lua script (GET + conditional DECR in a single atomic execution)
2. A Redis `WATCH`/`MULTI`/`EXEC` transaction
3. A database `UPDATE ... WHERE stock > 0 RETURNING *` with row locking

DropZone implements option 1 (primary) with option 3 as a fallback/audit layer.

### The Quieter Failures

Beyond inventory going negative, a naive flash sale system also fails in these ways:

- **Duplicate orders**: A user's network drops after payment but before confirmation. They retry.
  They get charged twice.
- **Unfairness**: The person who clicked first does not necessarily win. Thread scheduling
  determines who wins, not arrival order.
- **No graceful degradation**: Under extreme load, the server crashes instead of rejecting
  excess traffic cleanly.
- **No user feedback**: The user just sees a spinner, then an error. They don't know if they
  got it or not.
- **Bot advantage**: Automated buyers can fire hundreds of requests per second, starving
  legitimate users.

DropZone solves every one of these.

---

## 3. Solution Overview

DropZone is built around five core ideas:

### Idea 1: The Atomic Gate
A Redis Lua script that performs check-and-decrement as a single, uninterruptible operation.
It is physically impossible for two threads to interleave inside a Lua script in Redis.
Inventory cannot go below zero.

### Idea 2: The Queue
Checkout requests don't hit the gate directly. They enter a Bull job queue first. The queue
drains in FIFO order. This gives first-come-first-served fairness regardless of server load,
horizontal scaling, or thread scheduling.

### Idea 3: Real-Time Transparency
Every inventory change is broadcast via WebSocket to all connected clients instantly. Users
see the stock counter tick down in real time. They see their queue position. They see exactly
what is happening.

### Idea 4: Graceful Rejection
Users who don't get the item receive a clear, immediate response: "Sold out." No ambiguity.
No partial state. Their money is never touched. They are offered a waitlist slot.

### Idea 5: The Demonstration Mode
A toggle in the admin panel switches between "Naive Mode" (race conditions enabled) and
"Protected Mode" (full gate active). Running the same load test against both modes, live,
in front of judges is the entire pitch.

---

## 4. Tech Stack

### Backend
| Technology | Purpose | Why |
|---|---|---|
| Node.js 20 + Express | API server | Fastest Node HTTP framework, handles concurrency well |
| Redis 7 | Atomic counter + queue backend | Lua scripts are single-threaded and atomic by design |
| Bull | Job queue | Battle-tested Redis-backed queue, great observability |
| PostgreSQL 15 | Persistent data store | ACID transactions for order records |
| Socket.io | WebSocket server | Handles reconnection, rooms, broadcast elegantly |
| Zod | Request validation | Schema validation at the boundary |

### Frontend
| Technology | Purpose | Why |
|---|---|---|
| React 18 + Vite | UI framework | Fast dev iteration, concurrent mode for live updates |
| Tailwind CSS | Styling | Rapid UI development |
| Socket.io client | Real-time updates | Pairs with server-side Socket.io |
| Recharts | Live charts in admin | Simple, React-native charting |
| Zustand | State management | Lightweight, no boilerplate |

### Dev & Demo
| Technology | Purpose |
|---|---|
| Docker Compose | Single-command local setup (Redis + Postgres + API + Frontend) |
| Artillery | Load testing (simulate 500 concurrent buyers) |
| Vitest | Unit tests for the gate logic |
| Faker.js | Seed realistic user + product data |

---

## 5. System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     CLIENT LAYER                        │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  Drop Page  │  │  Admin Panel │  │  Load Tester  │  │
│  │  React SPA  │  │  React SPA   │  │  Artillery    │  │
│  └──────┬──────┘  └──────┬───────┘  └───────┬───────┘  │
└─────────┼────────────────┼──────────────────┼───────────┘
          │ HTTP + WS       │ HTTP             │ HTTP
┌─────────▼────────────────▼──────────────────▼───────────┐
│                     API LAYER (Express)                  │
│  ┌──────────────────┐  ┌────────────────────────────┐    │
│  │  Rate Limiter    │  │  JWT Auth Middleware        │    │
│  │  5 req/s per IP  │  │  Guest tokens for drop page │    │
│  └──────────────────┘  └────────────────────────────┘    │
│  Routes: /checkout  /product  /queue-status  /admin      │
└──────────────────────────┬───────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────┐
│                    QUEUE LAYER (Bull)                     │
│                                                          │
│  checkout-queue ──► worker process (1 concurrency)       │
│                                                          │
│  Job data: { userId, productId, idempotencyKey, ts }     │
└──────────────────────────┬───────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────┐
│                THE GATE (Redis Lua Script)                │
│                                                          │
│  KEYS[1] = "inventory:{productId}"                       │
│  Atomically: if stock > 0 → DECR → return 1              │
│              else         → return 0                     │
└────────────────┬────────────────────┬────────────────────┘
                 │ success             │ failure
┌────────────────▼──────┐    ┌────────▼────────────────────┐
│  PostgreSQL            │    │  Return 409 Sold Out        │
│  INSERT INTO orders    │    │  Offer waitlist slot        │
│  Broadcast WS event    │    │  Broadcast stock=0 event    │
└───────────────────────┘    └─────────────────────────────┘
```

---

## 6. Module 1 — The Atomic Gate (Core Innovation)

This is the heart of the entire project. Everything else is scaffolding around this.

### The Lua Script

```lua
-- inventory_gate.lua
-- Loaded into Redis once at startup, called by SHA1 hash (EVALSHA)
-- KEYS[1] = inventory key (e.g. "inventory:product_001")
-- ARGV[1] = units requested (usually 1)

local key = KEYS[1]
local requested = tonumber(ARGV[1])
local current = tonumber(redis.call('GET', key))

if current == nil then
  return -1  -- product not found / not initialised
end

if current >= requested then
  local remaining = redis.call('DECRBY', key, requested)
  return remaining  -- returns new stock level (>= 0)
else
  return -2  -- sold out signal
end
```

### Why Lua?

Redis executes Lua scripts atomically. While a Lua script is running, no other Redis command
can execute. This is guaranteed by Redis's single-threaded command processing model. There is
no race condition possible inside this script. Two workers calling EVALSHA simultaneously will
be serialised by Redis — one will run fully, then the other.

This is not optimistic locking. This is not a transaction with retry. This is an
unconditionally atomic operation.

### Loading and Calling

```javascript
// At startup: load the script, store the SHA
const fs = require('fs');
const luaScript = fs.readFileSync('./scripts/inventory_gate.lua', 'utf8');
const scriptSha = await redis.script('LOAD', luaScript);

// In the checkout worker: call atomically
async function attemptPurchase(productId, qty = 1) {
  const result = await redis.evalsha(scriptSha, 1, `inventory:${productId}`, qty);
  
  if (result === -1) throw new Error('Product not found');
  if (result === -2) return { success: false, reason: 'sold_out', remaining: 0 };
  
  return { success: true, remaining: result };
}
```

### Initialising Inventory

When a product drop is scheduled, inventory is seeded into Redis:

```javascript
async function seedInventory(productId, stock) {
  const key = `inventory:${productId}`;
  await redis.set(key, stock);
  await redis.set(`inventory:${productId}:total`, stock); // immutable total for UI
  
  // Also store drop time
  await redis.set(`drop:${productId}:unlock_at`, dropTimestamp);
}
```

### The Naive Mode (for demo comparison)

When "Naive Mode" is toggled on in the admin panel, the server bypasses the Lua script and
uses an intentionally broken implementation:

```javascript
async function naivePurchase(productId) {
  // DELIBERATELY BROKEN — illustrates the race condition
  const stock = parseInt(await redis.get(`inventory:${productId}`));
  
  // Gap here! Another request can read the same value before we write
  if (stock > 0) {
    await redis.decr(`inventory:${productId}`); // too late — not atomic
    return { success: true };
  }
  return { success: false, reason: 'sold_out' };
}
```

Under concurrent load, this will drive the counter negative. That is intentional.

---

## 7. Module 2 — API Layer & Rate Limiting

### Express Setup

```
src/
  server.js          — Express instance, plugin registration, listen
  plugins/
    redis.js         — Redis connection (ioredis), shared instance
    postgres.js      — pg pool, shared instance
    auth.js          — JWT plugin
    ratelimit.js     — Rate limiting config
    websocket.js     — Socket.io attachment
  routes/
    product.js       — GET /product/:id
    checkout.js      — POST /checkout
    queue.js         — GET /queue-status/:jobId
    waitlist.js      — POST /waitlist
    admin.js         — Admin endpoints (protected)
```

### Rate Limiting Strategy

Three-layer rate limiting:

**Layer 1 — Global burst protection** (handled by Nginx / reverse proxy in production)
100 req/s per IP across all routes.

**Layer 2 — Checkout endpoint protection**
5 req/s per IP on `POST /checkout`. Returns HTTP 429 with `Retry-After` header.

**Layer 3 — Per-user checkout limiting**
1 checkout attempt per user per product per drop. Checked via Redis:
```javascript
const attemptKey = `checkout_attempt:${userId}:${productId}:${dropId}`;
const alreadyAttempted = await redis.exists(attemptKey);
if (alreadyAttempted) return reply.status(409).send({ error: 'already_attempted' });
await redis.setex(attemptKey, 86400, '1'); // expires after 24h
```

### Idempotency Keys

Every checkout request must include an `Idempotency-Key` header (UUID v4 generated client-side).
If a request is retried with the same key, the server returns the same response as the first
attempt — no duplicate processing.

```javascript
async function handleCheckout(request, reply) {
  const idempotencyKey = request.headers['idempotency-key'];
  if (!idempotencyKey) return reply.status(400).send({ error: 'idempotency_key_required' });
  
  // Check if we've seen this key before
  const cachedResult = await redis.get(`idempotency:${idempotencyKey}`);
  if (cachedResult) {
    return reply.status(200).send(JSON.parse(cachedResult)); // replay the original response
  }
  
  // Process...
  const result = await processCheckout(request.body);
  
  // Cache the result for 24 hours
  await redis.setex(`idempotency:${idempotencyKey}`, 86400, JSON.stringify(result));
  
  return reply.send(result);
}
```

### Checkout Endpoint

```
POST /checkout
Headers:
  Authorization: Bearer <jwt>
  Idempotency-Key: <uuid>
Body:
  { productId: string, quantity: number }

Responses:
  202 Accepted      → { jobId, position, estimatedWait }
  409 Conflict      → { error: 'already_attempted' }
  429 Too Many      → { error: 'rate_limited', retryAfter: number }
  503 Unavailable   → { error: 'drop_not_started' } (before unlock time)
```

The endpoint returns immediately with a job ID. The actual processing happens asynchronously
in the worker. The client polls `GET /queue-status/:jobId` or listens via WebSocket for the
result.

### Drop Lock Middleware

Before enqueuing, a middleware checks whether the drop has started:

```javascript
async function dropLockMiddleware(request, reply) {
  const { productId } = request.body;
  const unlockAt = await redis.get(`drop:${productId}:unlock_at`);
  
  if (!unlockAt || Date.now() < parseInt(unlockAt)) {
    return reply.status(503).send({ 
      error: 'drop_not_started',
      unlockAt: parseInt(unlockAt) 
    });
  }
}
```

---

## 8. Module 3 — Job Queue & Checkout Worker

### Why a Queue?

Without a queue, requests hit the gate in the order they are scheduled by the OS. That order
has nothing to do with which user clicked first. A user on a fast connection with a nearby
server might jump ahead of someone who clicked 100ms earlier.

With a Bull queue:
- Requests are enqueued in arrival order (FIFO)
- The worker processes one job at a time (concurrency: 1 per product)
- Queue position is observable and reportable to the user
- Failed jobs can be retried or dead-lettered

### Queue Configuration

```javascript
import Queue from 'bull';

const checkoutQueue = new Queue('checkout', {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 1,         // no retries — a checkout attempt is one-shot
    removeOnComplete: {  // keep completed jobs for 1 hour (for status polling)
      age: 3600,
    },
    removeOnFail: {      // keep failed jobs for 24 hours
      age: 86400,
    },
    timeout: 5000,       // kill the job if it takes more than 5 seconds
  },
});
```

### Enqueuing a Checkout

```javascript
async function enqueueCheckout({ userId, productId, idempotencyKey }) {
  const job = await checkoutQueue.add({
    userId,
    productId,
    idempotencyKey,
    enqueuedAt: Date.now(),
  });
  
  // Tell the user their position
  const waitingCount = await checkoutQueue.getWaitingCount();
  
  return {
    jobId: job.id,
    position: waitingCount,
    estimatedWait: waitingCount * 50, // ~50ms per job assumption
  };
}
```

### The Worker

```javascript
checkoutQueue.process(1, async (job) => {
  // 1 = concurrency. One job processed at a time per worker process.
  // Scale workers horizontally for higher throughput, but never > 1 per worker
  // to preserve FIFO ordering within each worker.
  
  const { userId, productId, idempotencyKey } = job.data;
  
  // 1. Attempt the atomic gate
  const gateResult = await attemptPurchase(productId);
  
  if (!gateResult.success) {
    // Broadcast sold-out event if this was the last unit
    if (gateResult.remaining === 0) {
      io.emit('sold_out', { productId });
    }
    return { success: false, reason: 'sold_out' };
  }
  
  // 2. Write the order to Postgres
  const order = await db.query(
    `INSERT INTO orders (user_id, product_id, status, idempotency_key, created_at)
     VALUES ($1, $2, 'confirmed', $3, NOW())
     RETURNING id`,
    [userId, productId, idempotencyKey]
  );
  
  // 3. Broadcast updated inventory to all clients
  const remaining = gateResult.remaining;
  io.emit('inventory_update', { productId, remaining });
  
  // 4. Send confirmation to the specific user
  io.to(`user:${userId}`).emit('checkout_result', {
    success: true,
    orderId: order.rows[0].id,
    remaining,
  });
  
  return { success: true, orderId: order.rows[0].id };
});
```

### Queue Position Polling

```
GET /queue-status/:jobId

Response (pending):   { status: 'waiting', position: 12, estimatedWait: 600 }
Response (active):    { status: 'active', startedAt: timestamp }
Response (confirmed): { status: 'completed', success: true, orderId: 'abc123' }
Response (rejected):  { status: 'completed', success: false, reason: 'sold_out' }
```

---

## 9. Module 4 — Database Design

### Schema

```sql
-- Products
CREATE TABLE products (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  description   TEXT,
  price_paise   INTEGER NOT NULL,  -- store in smallest currency unit (paise for INR)
  image_url     VARCHAR(512),
  total_stock   INTEGER NOT NULL CHECK (total_stock > 0),
  drop_time     TIMESTAMPTZ NOT NULL,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Users (simplified for hackathon)
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  name          VARCHAR(255),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Orders
CREATE TABLE orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id),
  product_id      UUID NOT NULL REFERENCES products(id),
  status          VARCHAR(20) NOT NULL CHECK (status IN ('confirmed', 'cancelled', 'refunded')),
  idempotency_key VARCHAR(64) UNIQUE NOT NULL,  -- prevents duplicate processing
  amount_paise    INTEGER NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Waitlist
CREATE TABLE waitlist (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id),
  product_id  UUID NOT NULL REFERENCES products(id),
  position    INTEGER NOT NULL,
  notified    BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

-- Checkout attempts (for deduplication and analytics)
CREATE TABLE checkout_attempts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id),
  product_id      UUID NOT NULL REFERENCES products(id),
  result          VARCHAR(20) NOT NULL CHECK (result IN ('confirmed', 'sold_out', 'rate_limited', 'error')),
  latency_ms      INTEGER,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_product_id ON orders(product_id);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_checkout_attempts_created_at ON checkout_attempts(created_at);
CREATE INDEX idx_waitlist_product_position ON waitlist(product_id, position);
```

### Redis Key Schema

```
inventory:{productId}              → integer (current stock, decremented atomically)
inventory:{productId}:total        → integer (initial stock, never changes)
drop:{productId}:unlock_at         → unix timestamp ms (when drop goes live)
idempotency:{key}                  → JSON (cached response, TTL 24h)
checkout_attempt:{userId}:{pId}    → "1" (TTL 24h, prevents re-purchase)
ratelimit:{ip}                     → integer (TTL 1s, req count for rate limiting)
queue:depth:{productId}            → integer (denormalised queue depth for fast reads)
```

---

## 10. Module 5 — WebSocket Real-Time Layer

### Event Catalogue

All events flow through Socket.io with rooms for scoping.

```
Server → All clients:
  inventory_update      { productId, remaining, total }
  sold_out              { productId }
  drop_unlocked         { productId, timestamp }
  viewer_count          { productId, count }

Server → User room (user:{userId}):
  checkout_result       { success, orderId?, reason?, remaining }
  queue_position        { jobId, position, estimatedWait }
  waitlist_confirmed    { productId, position }

Server → Admin room:
  metrics_tick          { qps, successCount, rejectCount, queueDepth, latencyP99 }
  naive_mode_result     { finalStock, confirmedOrders }  ← can be negative in naive mode!
```

### Rooms

```javascript
io.on('connection', (socket) => {
  // Join product room for inventory updates
  socket.on('subscribe_product', (productId) => {
    socket.join(`product:${productId}`);
  });
  
  // Join personal room for checkout results
  socket.on('authenticate', (token) => {
    const { userId } = verifyJWT(token);
    socket.join(`user:${userId}`);
    socket.userId = userId;
  });
  
  // Admin room (verified server-side)
  socket.on('subscribe_admin', (adminToken) => {
    if (verifyAdminToken(adminToken)) {
      socket.join('admin');
    }
  });
  
  // Track viewers
  socket.on('subscribe_product', (productId) => {
    incrementViewers(productId);
    socket.on('disconnect', () => decrementViewers(productId));
  });
});
```

### Viewer Count

Viewer counts are stored in Redis and broadcast every 2 seconds:

```javascript
setInterval(async () => {
  const products = await getActiveProducts();
  for (const product of products) {
    const count = await redis.get(`viewers:${product.id}`) || 0;
    io.to(`product:${product.id}`).emit('viewer_count', {
      productId: product.id,
      count: parseInt(count),
    });
  }
}, 2000);
```

---

## 11. Module 6 — Frontend: The Drop Page

This is what users see. It needs to be dramatic, real-time, and trust-inducing.

### Components

```
src/pages/DropPage/
  DropPage.jsx             — top-level, fetches product data
  components/
    CountdownTimer.jsx     — real-time countdown to drop time (ms precision)
    ProductCard.jsx        — product image, name, price, description
    StockIndicator.jsx     — live stock bar + "X remaining" label
    ViewerCount.jsx        — "2,847 watching" live counter
    BuyButton.jsx          — disabled before drop, active after, states: idle/loading/queued/done
    QueuePosition.jsx      — "You're #12 in queue" live position update
    SoldOutBanner.jsx      — shown when stock hits 0, with waitlist CTA
    OrderConfirmation.jsx  — success state with order ID
    WaitlistForm.jsx       — email capture for restock notifications
```

### Countdown Timer

The countdown syncs to server time to prevent client clock skew from causing premature unlocks:

```javascript
// On mount, fetch server time and compute offset
const { serverTime } = await fetch('/api/server-time').then(r => r.json());
const clockOffset = serverTime - Date.now();

// Use offset-corrected time in the countdown
function getAdjustedNow() { return Date.now() + clockOffset; }
```

The timer counts down with millisecond precision to create tension. At T=0, a WebSocket
`drop_unlocked` event from the server (not client clock) actually enables the buy button.
This prevents any client from buying before others due to clock skew.

### Buy Button State Machine

```
LOCKED       → waiting for drop (countdown showing)
UNLOCKED     → drop is live, user can click
LOADING      → POST /checkout sent
QUEUED       → 202 received, showing position
PROCESSING   → job is active in worker
CONFIRMED    → checkout_result: success
SOLD_OUT     → checkout_result: sold_out OR stock hits 0
ERROR        → network or server error
```

### Real-Time Stock Bar

```javascript
function StockIndicator({ productId }) {
  const { remaining, total } = useInventory(productId); // subscribed to WS
  const pct = Math.max(0, (remaining / total) * 100);
  const urgency = pct < 20 ? 'critical' : pct < 50 ? 'low' : 'normal';
  
  return (
    <div className="stock-container">
      <div className={`stock-bar stock-bar--${urgency}`} style={{ width: `${pct}%` }} />
      <span className="stock-label">
        {remaining === 0 ? 'Sold out' : `${remaining} of ${total} remaining`}
      </span>
    </div>
  );
}
```

When stock drops below 20%, the bar turns amber. Below 5 units, it turns red and pulses.
At 0, it freezes and the sold-out state activates.

---

## 12. Module 7 — Frontend: Live Inventory Dashboard

A public-facing "war room" view that shows the drop in progress. This is the screen you put
on the projector during your demo.

### What It Shows

```
┌─────────────────────────────────────────────────────────────┐
│  DROP LIVE: Limited Hoodie 001                      22:43   │
├──────────────┬──────────────┬──────────────┬────────────────┤
│  STOCK LEFT  │  CONFIRMED   │  REJECTED    │  QUEUE DEPTH  │
│     7 / 10   │      3       │     1,204    │      89       │
├──────────────┴──────────────┴──────────────┴────────────────┤
│                                                             │
│  ████████░░░░░░░░░░░░░░░░░░░░░░░░  70% sold                │
│                                                             │
│  REQUESTS/SEC ─────────────────────────────── LIVE FEED    │
│  [Recharts area chart, last 30 seconds]        ✓ User 4821  │
│                                                ✗ User 9203  │
│                                                ✓ User 0034  │
│                                                ✗ User 7712  │
└─────────────────────────────────────────────────────────────┘
```

### Live Feed

A scrolling log of checkout results, updating in real time via WebSocket:

```javascript
function LiveFeed({ events }) {
  return (
    <div className="live-feed">
      {events.slice(0, 20).map(event => (
        <div key={event.id} className={`feed-item feed-item--${event.type}`}>
          <span className="feed-icon">{event.type === 'confirmed' ? '✓' : '✗'}</span>
          <span className="feed-user">User {event.userId.slice(-4)}</span>
          <span className="feed-time">{formatMs(event.latency)}ms</span>
        </div>
      ))}
    </div>
  );
}
```

---

## 13. Module 8 — Admin & Demo Control Panel

This is the panel you control during the demo. Password-protected. Only accessible at
`/admin` with a header token.

### Controls

**Product Management**
- Create a new drop (name, stock, price, drop time)
- Reset inventory (set back to original count)
- Manually trigger drop unlock

**The Critical Toggle: Naive vs Protected Mode**
```
┌─────────────────────────────────────┐
│   GATE MODE                         │
│                                     │
│   ○ Naive (race conditions enabled) │
│   ● Protected (atomic gate active)  │
│                                     │
│   [RUN LOAD TEST: 500 requests]     │
└─────────────────────────────────────┘
```

Flipping this toggle is your killer demo move. Switch to Naive, run the test, watch inventory
go negative. Switch to Protected, run the test, watch exactly 10 succeed and inventory stop
at 0.

**Load Test Trigger**
A button that fires the Artillery load test directly from the UI and streams results back:
```
POST /admin/run-load-test
Body: { mode: 'naive' | 'protected', concurrency: 500, targetStock: 10 }
```

**Metrics Panel**
Real-time metrics streamed via WebSocket to the admin room:
- Requests per second (last 5s rolling)
- Total confirmed orders
- Total rejected orders  
- Queue depth
- P50 / P99 latency
- Final inventory value (highlighted RED if negative in naive mode)

---

## 14. Bonus Features (Differentiators)

These are the details that separate a winning entry from a decent one.

### 14.1 Waitlist System

When a drop sells out, users can join a waitlist. If an order is cancelled or refunded, the
next person in the waitlist is automatically notified.

```
POST /waitlist
Body: { productId, email }
Response: { position: 14, estimatedChance: '12%' }
```

When stock becomes available:
```javascript
async function processWaitlist(productId, unitsAvailable) {
  const next = await db.query(
    `SELECT * FROM waitlist WHERE product_id = $1 AND notified = false
     ORDER BY position ASC LIMIT $2`,
    [productId, unitsAvailable]
  );
  
  for (const entry of next.rows) {
    // Give a 10-minute window to claim
    const claimToken = await generateClaimToken(entry.userId, productId);
    await sendNotification(entry.userId, claimToken);
    await markNotified(entry.id);
  }
}
```

### 14.2 Replay Attack Prevention

A short-lived (30-second TTL) checkout token is issued when the user visits the drop page.
This token must be included in the checkout request. Tokens cannot be reused.

```javascript
// Issued when user loads the product page
GET /product/:id/checkout-token
Response: { token: 'ct_<uuid>', expiresAt: timestamp, expiresIn: 30000 }

// Consumed on first use
// If token is expired or already used → 401 Unauthorized
```

This prevents bots from pre-loading tokens and flooding the endpoint the moment the drop
opens. Each user gets exactly one attempt per token.

### 14.3 Queue Position Visualisation

When a user is in the queue, they see a live queue position indicator that updates every
second via WebSocket:

```
You're #8 in queue
━━━━━━━━░░░░░░░░░░░░  4 people ahead
Estimated wait: ~2 seconds
```

As the worker clears jobs, this number counts down. Users feel the system working for them
rather than being stuck.

### 14.4 Inventory Snapshot / Audit Trail

Every inventory change is logged to a Postgres table with a timestamp and the operation that
caused it. This gives a full audit trail:

```sql
CREATE TABLE inventory_log (
  id          SERIAL PRIMARY KEY,
  product_id  UUID NOT NULL,
  operation   VARCHAR(20) NOT NULL,  -- 'seed', 'decrement', 'reset'
  old_value   INTEGER,
  new_value   INTEGER NOT NULL,
  triggered_by VARCHAR(50),          -- 'worker', 'admin', 'system'
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

In the admin panel, this is visualised as a step-chart showing inventory declining over time.

### 14.5 Metrics Export

```
GET /admin/export?format=csv
```

Downloads a CSV of all checkout attempts with timestamps, results, and latencies.
Useful for post-drop analysis and showing judges a clean data story.

### 14.6 Drop Scheduling

Drops can be scheduled in advance. A Redis sorted set holds upcoming drops:

```javascript
// Schedule a drop
await redis.zadd('scheduled_drops', dropTimestamp, productId);

// Background worker checks every second
setInterval(async () => {
  const now = Date.now();
  const due = await redis.zrangebyscore('scheduled_drops', '-inf', now);
  
  for (const productId of due) {
    await redis.zrem('scheduled_drops', productId);
    io.emit('drop_unlocked', { productId, timestamp: now });
  }
}, 1000);
```

---

## 15. The Demo Script (How You Win)

This is the narrative you deliver to judges. Practice this until it's automatic.

### Setup (2 minutes before demo)
- Open 3 browser tabs: Drop Page, Live Dashboard, Admin Panel
- Have the load test script ready in a terminal
- Product seeded with stock = 10, drop time = T+30 seconds
- Projector shows the Live Dashboard

### The Pitch (30 seconds)
"Flash sales fail in quiet ways. Inventory goes negative. Customers pay for items that are
gone. We built DropZone. Let me show you the failure first."

### Act 1: The Broken System (2 minutes)
1. Admin panel → toggle to Naive Mode
2. Reset inventory to 10
3. Start the countdown (30 seconds)
4. While counting down: "500 users are about to hit Buy at the exact same moment."
5. Drop unlocks → run load test (500 concurrent requests)
6. Live dashboard shows inventory plummeting past 0
7. Final stock: -47 or some negative number. Point at it.
8. "23 people got confirmed orders. 10 items. That's impossible. That's the bug."

### Act 2: The Fix (2 minutes)
1. Admin panel → toggle to Protected Mode
2. Reset inventory to 10
3. Start countdown again
4. "Same 500 users. Same moment. Different gate."
5. Drop unlocks → run load test (same 500 concurrent requests)
6. Live dashboard shows inventory ticking down: 9, 8, 7... 3, 2, 1, 0
7. Final stock: exactly 0. Confirmed orders: exactly 10.
8. "Exactly 10 orders. 490 clean rejections. Inventory never went below zero."

### Act 3: The Architecture (1 minute)
Walk through the system diagram briefly:
- "Here's the Lua script that makes this possible — 8 lines, runs atomically in Redis."
- "Here's the queue — every request is serialised, first-come first-served."
- "Here's the idempotency key — if a user retries, they don't get double-charged."

### Act 4: The Extras (1 minute)
- Show the waitlist joining flow
- Show the queue position countdown on the drop page
- Show the inventory audit log

### The Close
"DropZone doesn't just survive the midnight drop. It makes it fair, transparent, and
bulletproof. The gate is the innovation. Everything else is the product around it."

---

## 16. Build Order & Time Plan

A typical hackathon is 24 hours. Here is how to spend them.

### Hours 1–2: Foundation
**Goal: Redis gate working in isolation**

- [ ] Set up Docker Compose (Redis + Postgres + Node + React containers)
- [ ] Install dependencies, configure environment variables
- [ ] Write and test the Lua script in isolation (Vitest unit tests)
- [ ] Verify atomicity: run 1000 concurrent `evalsha` calls, confirm counter reaches exactly 0

This is the most important step. Do not move on until the gate is proven to work.

### Hours 3–4: Backend Core
**Goal: POST /checkout returns 202 with job ID**

- [ ] Express server with basic routes
- [ ] Bull queue setup with checkout worker
- [ ] Worker calls the Lua gate, writes to Postgres on success
- [ ] JWT auth (simple, use a library — this is not your innovation)
- [ ] Rate limiting plugin

### Hours 5–6: Real-Time Layer
**Goal: Inventory updates appear in browser console**

- [ ] Socket.io attached to Express server
- [ ] Worker emits `inventory_update` and `checkout_result` events
- [ ] Frontend connects to Socket.io, logs events
- [ ] `GET /queue-status/:jobId` working

### Hours 7–9: Frontend Drop Page
**Goal: Full user flow works end to end**

- [ ] Countdown timer component (synced to server time)
- [ ] Product card with live stock indicator
- [ ] Buy button with all state transitions
- [ ] Queue position display
- [ ] Sold-out / waitlist flow
- [ ] Order confirmation view

### Hours 10–11: Demo Dashboard
**Goal: Live metrics visible on the war room screen**

- [ ] Stock counter (large, visible from the back of a room)
- [ ] Confirmed / Rejected counters
- [ ] Requests/sec chart (Recharts, 30s rolling window)
- [ ] Live feed of checkout events
- [ ] Queue depth indicator

### Hours 12–13: Admin Panel + Demo Toggle
**Goal: Can run the naive vs protected demo live**

- [ ] Admin panel (basic auth)
- [ ] Naive / Protected mode toggle
- [ ] Inventory reset button
- [ ] Load test trigger button (fires Artillery, streams results)
- [ ] Drop scheduling control

### Hours 14–15: Bonus Features
Pick 2-3 based on remaining time:
- [ ] Waitlist system (high impact for demo narrative)
- [ ] Idempotency keys (high impact for technical judges)
- [ ] Replay attack prevention with checkout tokens
- [ ] Inventory audit log with chart

### Hours 16–17: Testing & Hardening
- [ ] Run the full demo script end to end
- [ ] Run load tests at different concurrency levels (50, 100, 500)
- [ ] Confirm inventory never goes negative under any load in protected mode
- [ ] Test edge cases (see Section 18)

### Hours 18–20: Polish & Documentation
- [ ] Clean up the UI
- [ ] Write a one-page README with architecture diagram
- [ ] Record a 2-minute demo video as backup
- [ ] Prepare the live demo environment (seeded data, stable network)

### Hours 21–24: Buffer + Presentation Prep
- [ ] Practice the demo script until it's natural
- [ ] Prepare for judge questions (see Section 20)
- [ ] Fix any last-minute issues
- [ ] Deploy to a cloud instance if required (Railway, Fly.io, or Render)

---

## 17. API Reference

### Public Endpoints

```
GET  /api/health
     → { status: 'ok', timestamp }

GET  /api/products/:id
     → { id, name, description, pricePaise, imageUrl, totalStock, dropTime }

GET  /api/products/:id/checkout-token
     → { token, expiresAt, expiresIn }

POST /api/auth/guest
     → { token, userId }  (creates a guest user for demo purposes)

POST /api/checkout
     Headers: Authorization, Idempotency-Key, X-Checkout-Token
     Body:    { productId, quantity }
     → 202   { jobId, position, estimatedWait }
     → 400   { error: 'invalid_request', details }
     → 401   { error: 'checkout_token_invalid' }
     → 409   { error: 'already_attempted' }
     → 429   { error: 'rate_limited', retryAfter }
     → 503   { error: 'drop_not_started', unlockAt }

GET  /api/queue-status/:jobId
     → { status, position?, estimatedWait?, result? }

POST /api/waitlist
     Body: { productId, email }
     → { position, estimatedChance }

GET  /api/server-time
     → { timestamp }  (for client clock sync)
```

### Admin Endpoints (X-Admin-Token required)

```
GET  /admin/metrics
     → { qps, successCount, rejectCount, queueDepth, latencyP50, latencyP99, finalStock }

POST /admin/products
     Body: { name, description, pricePaise, totalStock, dropTime }
     → { id, ...product }

POST /admin/products/:id/reset
     Body: { stock }
     → { ok: true }

POST /admin/products/:id/unlock
     → { ok: true }

PUT  /admin/mode
     Body: { mode: 'naive' | 'protected' }
     → { ok: true, mode }

POST /admin/run-load-test
     Body: { concurrency, productId }
     → 202 (streams results via WebSocket to admin room)

GET  /admin/inventory-log/:productId
     → [{ operation, oldValue, newValue, triggeredBy, createdAt }]

GET  /admin/export
     Query: ?format=csv&productId=...
     → CSV download
```

---

## 18. Edge Cases & How We Handle Them

| Scenario | What Happens | How DropZone Handles It |
|---|---|---|
| User clicks Buy twice | Second request hits `checkout_attempt` Redis key, immediate 409 | Pre-queue deduplication |
| Network drops after 202, user retries | Idempotency key lookup returns same 202 | Idempotency keys with 24h TTL |
| Worker crashes mid-job | Bull marks job failed, no order written, no stock decremented | Atomic gate is checked before DB write |
| Redis goes down | Gate unavailable → all checkouts return 503 | Fail-safe: no inventory change possible |
| Postgres goes down | Redis counter decremented but no order written | Compensating transaction: re-increment Redis counter on DB failure |
| User submits expired checkout token | 401 Unauthorized before even entering queue | Checkout token validation in middleware |
| Bot with 100 IPs fires 100 req/s each | Per-user rate limit triggers on userId after first attempt | Layer 3 rate limiting by userId |
| Clock skew causes user to click before drop | Server validates against `drop:{id}:unlock_at` in Redis, not client time | Server-authoritative unlock |
| Stock seeds to 0 accidentally | Admin can reset from panel | Manual override with audit log entry |
| Two workers dequeue same job | Bull guarantees each job is processed exactly once | Bull's atomic job locking |
| Admin runs load test with stock = 0 | 0 confirmations, 500 clean rejections | Graceful: gate returns -2, all jobs fail cleanly |

---

## 19. Load Testing Plan

### Tools

Primary: Artillery (`npm install -g artillery`)
Fallback: A simple Node script using `Promise.all` with 500 `fetch` calls.

### Artillery Config

```yaml
# load-test.yml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 1
      arrivalRate: 500      # 500 new virtual users in 1 second = the midnight drop
  defaults:
    headers:
      Content-Type: 'application/json'

scenarios:
  - name: Checkout attempt
    flow:
      - post:
          url: '/api/auth/guest'
          capture:
            - json: '$.token'
              as: userToken
            - json: '$.userId'
              as: userId
      - post:
          url: '/api/checkout'
          headers:
            Authorization: 'Bearer {{ userToken }}'
            Idempotency-Key: '{{ $uuid }}'
          json:
            productId: '{{ $env.PRODUCT_ID }}'
            quantity: 1
          capture:
            - json: '$.jobId'
              as: jobId
```

### What to Verify

After running the load test (stock = 10, 500 concurrent buyers):

**In Protected Mode:**
- `redis.get('inventory:{productId}')` returns exactly 0 (never negative)
- `SELECT COUNT(*) FROM orders WHERE product_id = '{id}' AND status = 'confirmed'` = exactly 10
- No duplicate `idempotency_key` values in orders table
- All 500 requests received a response (no timeouts)

**In Naive Mode:**
- `redis.get('inventory:{productId}')` returns some negative number
- Order count exceeds 10

**Latency Targets (Protected Mode):**
- P50 checkout latency: < 100ms
- P99 checkout latency: < 500ms
- Zero 5xx errors (all rejections are 409, not 500)

---

## 20. Judging Criteria Mapping

The problem statement lists specific things judges will observe. Here is how DropZone
addresses each one directly.

### "Whether inventory ever becomes inconsistent"

**Our answer:** Physically impossible in Protected Mode. The Redis Lua script is atomic.
We demonstrate this by running 500 concurrent requests against a stock of 10 and showing
the counter stops exactly at 0.

**How we prove it live:** Show the Redis counter via `redis-cli GET inventory:{id}` in a
terminal after the load test. It will say 0. Show the orders table row count. It will say 10.

### "Whether simultaneous checkouts behave correctly"

**Our answer:** Yes. FIFO queue + atomic gate = exactly the right number of successful
checkouts regardless of concurrency. Users who clicked first are served first.

**How we prove it live:** The load test fires 500 requests tagged with their arrival
timestamp. After the test, the 10 confirmed orders are the 10 with the earliest timestamps.

### "Whether the architecture anticipates real traffic bursts"

**Our answer:** Yes. Rate limiting absorbs the initial spike. The Bull queue buffers the
overflow. The atomic gate serialises writes. The WebSocket layer keeps clients informed
without polling. The architecture has a clear answer at every layer for "what happens when
too many people arrive."

**How we show it:** The Live Dashboard's requests/sec chart shows the burst arriving and
the queue absorbing it. The chart doesn't flatline or spike to error — it rises, processes,
and clears.

### "Whether failure cases remain graceful"

**Our answer:** Every failure path returns a clean, informative response in < 100ms:
- `409 Sold Out` with a waitlist offer
- `429 Rate Limited` with `Retry-After`
- `503 Drop Not Started` with `unlockAt` timestamp
- Queue position shown while waiting
- Explicit `Order Confirmed` or `Sold Out` result delivered via WebSocket

**How we show it:** Click Buy after stock hits 0. Get an immediate, clean "Sold out" with
a waitlist option. No spinner. No ambiguity. No error screen.

---

## Appendix: Project File Structure

```
dropzone/
├── docker-compose.yml
├── .env.example
├── README.md
│
├── backend/
│   ├── package.json
│   ├── src/
│   │   ├── server.js
│   │   ├── plugins/
│   │   │   ├── redis.js
│   │   │   ├── postgres.js
│   │   │   ├── auth.js
│   │   │   ├── ratelimit.js
│   │   │   └── websocket.js
│   │   ├── routes/
│   │   │   ├── product.js
│   │   │   ├── checkout.js
│   │   │   ├── queue.js
│   │   │   ├── waitlist.js
│   │   │   └── admin.js
│   │   ├── workers/
│   │   │   └── checkoutWorker.js
│   │   ├── services/
│   │   │   ├── inventoryGate.js    ← the Lua script wrapper
│   │   │   ├── orderService.js
│   │   │   └── waitlistService.js
│   │   └── scripts/
│   │       └── inventory_gate.lua
│   └── tests/
│       ├── gate.test.js            ← unit tests for atomic gate
│       └── checkout.integration.js
│
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── pages/
│       │   ├── DropPage/
│       │   ├── Dashboard/
│       │   └── Admin/
│       ├── components/
│       │   ├── CountdownTimer.jsx
│       │   ├── StockIndicator.jsx
│       │   ├── BuyButton.jsx
│       │   ├── QueuePosition.jsx
│       │   ├── LiveFeed.jsx
│       │   └── MetricsPanel.jsx
│       ├── hooks/
│       │   ├── useInventory.js      ← subscribes to WS inventory_update
│       │   ├── useCheckout.js       ← manages checkout state machine
│       │   └── useServerTime.js     ← clock sync
│       └── stores/
│           └── dropStore.js         ← Zustand store
│
├── load-test/
│   ├── load-test.yml               ← Artillery config
│   └── concurrent-test.js          ← fallback Node script
│
├── public/
│   └── pow-solver.js               ← [NEW] client-side PoW solver
│
└── db/
    └── migrations/
        ├── 001_create_products.sql
        ├── 002_create_users.sql
        ├── 003_create_orders.sql
        ├── 004_create_waitlist.sql
        ├── 005_create_inventory_log.sql
        ├── 007_create_outbox.sql    ← [NEW] transactional outbox
        └── 008_payment_status.sql   ← [NEW] payment lifecycle
```

---

## Architectural Improvements (Post-MVP)

> These 5 improvements are implemented after the base platform (Phases 1–8) is working. Full specifications are in the PRD (Section 17) and roadmap (Phase 9).

### Overview

| # | Improvement | What It Solves | Key New File |
|---|-------------|---------------|--------------|
| 1 | **Per-Product Worker Pools** | Single-worker bottleneck — all products share one queue | `workerManager.js` |
| 2 | **Transactional Outbox** | Redis-Postgres durability gap — crash loses inventory | `outboxProcessor.js` |
| 3 | **Payment Layer** | No payment step — orders confirmed without payment | `webhooks.js`, `paymentExpiryListener.js` |
| 4 | **Bot Defense** | Instant guest tokens — bots exhaust inventory | `powService.js`, `botDefense.js` |
| 5 | **Adaptive ETA** | Static 50ms estimate — wildly inaccurate under load | `queueStats.js` |

### New Backend Files

```
src/
├── workers/
│   ├── workerManager.js          ← [IMP 1] per-product queue lifecycle
│   ├── outboxProcessor.js        ← [IMP 2] polls outbox, emits WS events
│   └── paymentExpiryListener.js  ← [IMP 3] Redis keyspace notification listener
├── services/
│   ├── powService.js             ← [IMP 4] PoW challenge generation + validation
│   └── queueStats.js             ← [IMP 5] rolling p50/p95 duration stats
├── middleware/
│   └── botDefense.js             ← [IMP 4] velocity check + reaction time check
└── routes/
    ├── admin.js                   ← [IMP 1] drop management, worker status
    └── webhooks.js                ← [IMP 3] Stripe/mock payment webhooks
```

### New Redis Keys

| Key | TTL | Improvement | Purpose |
|-----|-----|-------------|---------|
| `active_queues` | managed | 1 | Per-product queue registry |
| `pow_challenge:{challengeId}` | 60s | 4 | PoW puzzle storage |
| `behavior:{userId}` | 30s | 4 | Checkout velocity tracking |
| `queued_users:{productId}:{dropId}` | drop + 300s | 4 | Junk-job dedup |
| `payment_timeout:{orderId}` | 120s | 3 | Payment window trigger |
| `webhook_processed:{eventId}` | 86400s | 3 | Webhook idempotency |
| `job_durations:{productId}` | 3600s | 5 | Rolling job duration samples |

### New API Endpoints

| Method | Path | Improvement |
|--------|------|-------------|
| `POST` | `/api/admin/drop` | 1 |
| `DELETE` | `/api/admin/drop/:productId` | 1 |
| `GET` | `/api/admin/workers` | 1 |
| `POST` | `/api/auth/challenge` | 4 |
| `POST` | `/api/webhooks/stripe` | 3 |
| `POST` | `/api/webhooks/mock/confirm` | 3 |
| `POST` | `/api/webhooks/mock/fail` | 3 |

### Implementation Order

```
1. Worker Pools → 2. Outbox → 3. Bot Defense (parallel) → 4. Payments → 5. Adaptive ETA
```

### Constraints

- **Lua script untouched** — atomic gate never modified
- **Additive migrations** — new tables/columns only
- **All Redis keys have TTLs** — no unbounded growth
- **Backward-compatible queues** — global `checkout-queue` still works as fallback
- **Zod validation** on every new endpoint

---

*Built for The Midnight Product Drop — PS 2*
*Version 2.0 — Hackathon Edition + Architectural Improvements*

