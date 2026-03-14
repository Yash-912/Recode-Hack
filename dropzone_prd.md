# DropZone — Product Requirements Document (PRD)

**Project:** DropZone — Flash Sale Infrastructure Platform  
**Hackathon Problem Statement:** PS 2: The Midnight Product Drop  
**Version:** 1.0  
**Date:** 2026-03-14  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Solution Architecture](#3-solution-architecture)
4. [Tech Stack](#4-tech-stack)
5. [Core Concepts](#5-core-concepts)
6. [Database Schema](#6-database-schema)
7. [Redis Key Schema](#7-redis-key-schema)
8. [API Reference](#8-api-reference)
9. [WebSocket Event Catalogue](#9-websocket-event-catalogue)
10. [Frontend Pages & Components](#10-frontend-pages--components)
11. [Bonus Features](#11-bonus-features)
12. [Edge Cases & Handling](#12-edge-cases--handling)
13. [Load Testing Plan](#13-load-testing-plan)
14. [Demo Script](#14-demo-script)
15. [Complete File Manifest](#15-complete-file-manifest)
16. [Build Order](#16-build-order)

---

## 1. Executive Summary

**DropZone** is a production-grade flash sale infrastructure platform that solves the hardest problem in high-demand e-commerce: **what happens when thousands of people try to buy one item at the exact same moment.**

Most flash sale systems fail silently — inventory goes negative, customers pay for items that don't exist. The root cause is a **read-modify-write race condition** in concurrent access to shared inventory state. DropZone eliminates this entirely using:

- A **Redis Lua script** (the "Atomic Gate") that performs check-and-decrement as a single, uninterruptible operation
- A **Bull job queue** for FIFO fairness
- **Real-time WebSocket broadcasts** for live transparency
- **Graceful rejection handling** so no user is left in ambiguity
- A **Naive vs Protected demo mode** that lets you show the failure and the fix side-by-side

> [!IMPORTANT]
> The **killer demo move** is toggling between Naive Mode (race conditions enabled, inventory goes negative) and Protected Mode (atomic gate active, inventory stops exactly at 0) with the same 500-concurrent-user load test — live in front of judges.

---

## 2. Problem Statement

### The Race Condition

A flash sale creates a classic read-modify-write race condition:

```
Thread A reads:  stock = 1  ✓ (passes check)
Thread B reads:  stock = 1  ✓ (passes check — happens before A writes)
Thread A writes: stock = 0  → confirms order A
Thread B writes: stock = -1 → confirms order B  ← OVERSOLD
```

Both threads read the same value, both pass the inventory check, both write. Result: **negative inventory and duplicate confirmations**.

### Why It's Hard

- Application-level locks don't work across horizontally scaled instances
- Database row locks create serialisation bottlenecks under extreme load
- Simple Redis `GET` + `SET` still has a gap between the two operations
- `GET` + conditional `DECR` is two Redis commands — not atomic

### Additional Failure Modes

| Failure | Description |
|---------|-------------|
| **Duplicate orders** | User retries after network drop → charged twice |
| **Unfairness** | Thread scheduling determines winner, not arrival order |
| **No graceful degradation** | Server crashes under load instead of rejecting cleanly |
| **No user feedback** | Users see spinners then errors, no clarity on outcome |
| **Bot advantage** | Automated buyers can fire hundreds of requests/sec |

DropZone solves every one of these.

---

## 3. Solution Architecture

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
│  checkout-queue ──► worker process (1 concurrency)       │
│  Job data: { userId, productId, idempotencyKey, ts }     │
└──────────────────────────┬───────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────┐
│                THE GATE (Redis Lua Script)                │
│  KEYS[1] = "inventory:{productId}"                       │
│  Atomically: if stock > 0 → DECR → return remaining     │
│              else         → return -2 (sold out)         │
└────────────────┬────────────────────┬────────────────────┘
                 │ success             │ failure
┌────────────────▼──────┐    ┌────────▼────────────────────┐
│  PostgreSQL            │    │  Return 409 Sold Out        │
│  INSERT INTO orders    │    │  Offer waitlist slot        │
│  Broadcast WS event    │    │  Broadcast stock=0 event    │
└───────────────────────┘    └─────────────────────────────┘
```

### Data Flow (Happy Path)

1. User clicks **Buy** → `POST /api/checkout` with JWT + Idempotency-Key + Checkout-Token
2. Rate limiter checks (IP + user-level) → pass
3. Drop lock middleware checks `drop:{productId}:unlock_at` → drop is live
4. Per-user dedup check via `checkout_attempt:{userId}:{productId}` → first attempt
5. Job enqueued into Bull checkout queue → `202 Accepted { jobId, position }`
6. Worker dequeues job (FIFO, concurrency 1)
7. Worker calls **Atomic Gate** (Redis `EVALSHA` of Lua script)
8. Gate returns remaining stock ≥ 0 → **success**
9. Worker writes order to PostgreSQL
10. Worker broadcasts `inventory_update` to all clients via Socket.io
11. Worker sends `checkout_result` to the specific user's Socket.io room
12. User sees **"Order Confirmed!"**

### Data Flow (Sold Out Path)

Steps 1–7 same. Gate returns `-2` → **sold out**. Worker broadcasts `sold_out` event. User receives `checkout_result: { success: false, reason: 'sold_out' }`. User is shown the **Waitlist** option.

---

## 4. Tech Stack

### Backend

| Technology | Purpose | Why This Choice |
|---|---|---|
| **Node.js 20** + **Express** | API server | Fastest Node HTTP framework, handles concurrency well |
| **Redis 7** | Atomic counter + queue backend | Lua scripts are single-threaded and atomic by design |
| **Bull** | Job queue | Battle-tested Redis-backed queue with great observability |
| **PostgreSQL 15** | Persistent data store | ACID transactions for order records |
| **Socket.io** | WebSocket server | Handles reconnection, rooms, broadcast elegantly |
| **Zod** | Request validation | Schema validation at the API boundary |
| **ioredis** | Redis client | Required for Bull, supports `EVALSHA` |
| **pg** | PostgreSQL client | Lightweight, pool-based Postgres driver |
| **jsonwebtoken** | Auth | JWT signing/verification for guest + admin tokens |
| **@Express/rate-limit** | Rate limiting | Express-native rate limiting plugin |
| **uuid** | ID generation | For idempotency keys and checkout tokens |
| **dotenv** | Environment config | Load `.env` variables |

### Frontend

| Technology | Purpose | Why This Choice |
|---|---|---|
| **React 18** + **Vite** | UI framework + build tool | Fast HMR, concurrent mode for live updates |
| **Tailwind CSS** | Styling | Rapid UI development with utility classes |
| **Socket.io client** | Real-time updates | Pairs with server-side Socket.io |
| **Recharts** | Live charts in admin dashboard | Simple, React-native charting library |
| **Zustand** | State management | Lightweight, no boilerplate, works great with WebSocket |
| **React Router** | Client-side routing | Navigate between Drop Page, Dashboard, Admin |

### DevOps & Testing

| Technology | Purpose |
|---|---|
| **Docker Compose** | Single-command local setup (Redis + Postgres + API + Frontend) |
| **Artillery** | Load testing (simulate 500 concurrent buyers) |
| **Vitest** | Unit tests for the gate logic |
| **Faker.js** | Seed realistic user + product data |

---

## 5. Core Concepts

### 5.1 The Atomic Gate (Core Innovation)

A Redis Lua script that performs check-and-decrement as a **single, uninterruptible operation**. Redis executes Lua scripts atomically — while a Lua script is running, no other Redis command can execute. This is guaranteed by Redis's single-threaded command processing model.

```lua
-- inventory_gate.lua
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

**Return values:** `>= 0` = success (remaining stock), `-1` = product not found, `-2` = sold out.

The script is loaded into Redis once at startup via `SCRIPT LOAD`, and called subsequently via `EVALSHA` (by its SHA1 hash) for performance.

### 5.2 The Naive Mode (for demo comparison)

When toggled to Naive Mode in the admin panel, the server uses an intentionally broken implementation:

```javascript
async function naivePurchase(productId) {
  const stock = parseInt(await redis.get(`inventory:${productId}`));
  // ← GAP: another request can read the same value before we write
  if (stock > 0) {
    await redis.decr(`inventory:${productId}`); // not atomic with the check
    return { success: true };
  }
  return { success: false, reason: 'sold_out' };
}
```

Under concurrent load, this **will** drive the counter negative. That is intentional for the demo.

### 5.3 The Job Queue (Bull)

Checkout requests don't hit the gate directly. They enter a **Bull job queue** first:

- Requests are enqueued in **FIFO** order (arrival order = service order)
- Worker processes **one job at a time** (concurrency: 1) to preserve fairness
- Queue position is observable and reported to the user via WebSocket
- Failed jobs are tracked and dead-lettered

### 5.4 Rate Limiting (3 Layers)

| Layer | Scope | Limit | Response |
|-------|-------|-------|----------|
| Layer 1 | Global per IP | 100 req/s across all routes | 429 |
| Layer 2 | Checkout endpoint per IP | 5 req/s on `POST /checkout` | 429 with `Retry-After` |
| Layer 3 | Per-user per-product | 1 attempt per user per product per drop | 409 `already_attempted` |

### 5.5 Idempotency Keys

Every checkout request must include an `Idempotency-Key` header (UUID v4 generated client-side). If a request is retried with the same key, the server returns the cached response — no duplicate processing. Keys are stored in Redis with a 24h TTL.

### 5.6 Real-Time Transparency (Socket.io)

Every inventory change is broadcast via WebSocket. Users see the stock counter tick down in real time, their queue position update, and an immediate clear result (confirmed or sold out).

### 5.7 Graceful Rejection

Sold-out users receive a clear, immediate response. No ambiguity, no partial state. Their money is never touched. They are offered a waitlist slot.

---

## 6. Database Schema

### PostgreSQL Tables

#### `products`
```sql
CREATE TABLE products (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  description   TEXT,
  price_paise   INTEGER NOT NULL,        -- stored in smallest currency unit (paise for INR)
  image_url     VARCHAR(512),
  total_stock   INTEGER NOT NULL CHECK (total_stock > 0),
  drop_time     TIMESTAMPTZ NOT NULL,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

#### `users`
```sql
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  name          VARCHAR(255),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

#### `orders`
```sql
CREATE TABLE orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id),
  product_id      UUID NOT NULL REFERENCES products(id),
  status          VARCHAR(20) NOT NULL CHECK (status IN ('confirmed', 'cancelled', 'refunded')),
  idempotency_key VARCHAR(64) UNIQUE NOT NULL,
  amount_paise    INTEGER NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

#### `waitlist`
```sql
CREATE TABLE waitlist (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id),
  product_id  UUID NOT NULL REFERENCES products(id),
  position    INTEGER NOT NULL,
  notified    BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);
```

#### `checkout_attempts`
```sql
CREATE TABLE checkout_attempts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id),
  product_id      UUID NOT NULL REFERENCES products(id),
  result          VARCHAR(20) NOT NULL CHECK (result IN ('confirmed', 'sold_out', 'rate_limited', 'error')),
  latency_ms      INTEGER,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

#### `inventory_log` (Bonus — Audit Trail)
```sql
CREATE TABLE inventory_log (
  id          SERIAL PRIMARY KEY,
  product_id  UUID NOT NULL,
  operation   VARCHAR(20) NOT NULL,    -- 'seed', 'decrement', 'reset'
  old_value   INTEGER,
  new_value   INTEGER NOT NULL,
  triggered_by VARCHAR(50),            -- 'worker', 'admin', 'system'
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### Indexes
```sql
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_product_id ON orders(product_id);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_checkout_attempts_created_at ON checkout_attempts(created_at);
CREATE INDEX idx_waitlist_product_position ON waitlist(product_id, position);
```

---

## 7. Redis Key Schema

| Key Pattern | Value Type | Description | TTL |
|---|---|---|---|
| `inventory:{productId}` | integer | Current stock, decremented atomically by the gate | None |
| `inventory:{productId}:total` | integer | Initial stock, never changes (for UI percentage calc) | None |
| `drop:{productId}:unlock_at` | unix timestamp (ms) | When the drop goes live | None |
| `idempotency:{key}` | JSON string | Cached response for replayed requests | 24h |
| `checkout_attempt:{userId}:{productId}` | `"1"` | Prevents re-purchase per user per product | 24h |
| `ratelimit:{ip}` | integer | Request count for rate limiting | 1s |
| `queue:depth:{productId}` | integer | Denormalised queue depth for fast reads | None |
| `viewers:{productId}` | integer | Live viewer count for a product | None |
| `checkout_token:{token}` | JSON string | Short-lived checkout token data | 30s |
| `scheduled_drops` | sorted set | Upcoming drops (score = timestamp, member = productId) | None |
| `gate_mode` | `"naive"` or `"protected"` | Current gate mode for demo toggle | None |

---

## 8. API Reference

### Public Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/health` | Health check → `{ status: 'ok', timestamp }` | None |
| `GET` | `/api/server-time` | Server timestamp for client clock sync → `{ timestamp }` | None |
| `POST` | `/api/auth/guest` | Create guest user → `{ token, userId }` | None |
| `GET` | `/api/products/:id` | Get product details → `{ id, name, description, pricePaise, imageUrl, totalStock, dropTime }` | None |
| `GET` | `/api/products/:id/checkout-token` | Get short-lived checkout token → `{ token, expiresAt, expiresIn }` | JWT |
| `POST` | `/api/checkout` | Submit checkout → `202 { jobId, position, estimatedWait }` | JWT + Idempotency-Key + X-Checkout-Token |
| `GET` | `/api/queue-status/:jobId` | Poll job status → `{ status, position?, estimatedWait?, result? }` | JWT |
| `POST` | `/api/waitlist` | Join waitlist → `{ position, estimatedChance }` | JWT |

#### `POST /api/checkout` Response Codes

| Code | Body | Meaning |
|------|------|---------|
| `202` | `{ jobId, position, estimatedWait }` | Accepted, enqueued |
| `400` | `{ error: 'invalid_request', details }` | Validation failed (Zod) |
| `401` | `{ error: 'checkout_token_invalid' }` | Checkout token expired or used |
| `409` | `{ error: 'already_attempted' }` | User already tried this product |
| `429` | `{ error: 'rate_limited', retryAfter }` | Rate limit exceeded |
| `503` | `{ error: 'drop_not_started', unlockAt }` | Drop hasn't started yet |

### Admin Endpoints (require `X-Admin-Token` header)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/metrics` | Real-time metrics → `{ qps, successCount, rejectCount, queueDepth, latencyP50, latencyP99, finalStock }` |
| `POST` | `/admin/products` | Create a new product/drop |
| `POST` | `/admin/products/:id/reset` | Reset inventory to specified stock |
| `POST` | `/admin/products/:id/unlock` | Manually trigger drop unlock |
| `PUT` | `/admin/mode` | Toggle gate mode → `{ mode: 'naive' \| 'protected' }` |
| `POST` | `/admin/run-load-test` | Trigger Artillery load test (streams results via WS) |
| `GET` | `/admin/inventory-log/:productId` | Get inventory audit trail |
| `GET` | `/admin/export` | Download CSV of checkout attempts (`?format=csv&productId=...`) |

---

## 9. WebSocket Event Catalogue

### Server → All Clients

| Event | Payload | When |
|-------|---------|------|
| `inventory_update` | `{ productId, remaining, total }` | Every successful purchase |
| `sold_out` | `{ productId }` | Stock hits 0 |
| `drop_unlocked` | `{ productId, timestamp }` | Drop goes live (server-authoritative) |
| `viewer_count` | `{ productId, count }` | Every 2 seconds |

### Server → User Room (`user:{userId}`)

| Event | Payload | When |
|-------|---------|------|
| `checkout_result` | `{ success, orderId?, reason?, remaining }` | Worker finishes processing |
| `queue_position` | `{ jobId, position, estimatedWait }` | Queue position updates |
| `waitlist_confirmed` | `{ productId, position }` | User added to waitlist |

### Server → Admin Room

| Event | Payload | When |
|-------|---------|------|
| `metrics_tick` | `{ qps, successCount, rejectCount, queueDepth, latencyP99 }` | Every 1s during active drop |
| `naive_mode_result` | `{ finalStock, confirmedOrders }` | After load test in naive mode (stock can be negative!) |

### Client → Server

| Event | Payload | Purpose |
|-------|---------|---------|
| `subscribe_product` | `productId` | Join product room for inventory updates |
| `authenticate` | `token` | Join personal room for checkout results |
| `subscribe_admin` | `adminToken` | Join admin room for metrics |

---

## 10. Frontend Pages & Components

### Three Main Pages

| Page | Route | Purpose |
|------|-------|---------|
| **Drop Page** | `/` or `/drop/:productId` | The consumer-facing flash sale page |
| **Live Dashboard** | `/dashboard` | Public "war room" view for the projector during demo |
| **Admin Panel** | `/admin` | Password-protected demo control panel |

### Drop Page Components

| Component | Purpose |
|-----------|---------|
| `CountdownTimer` | Real-time countdown to drop time with ms precision, synced to server time (not client clock) to prevent skew |
| `ProductCard` | Product image, name, price, description |
| `StockIndicator` | Live stock progress bar + "X remaining" label. Amber < 20%, red + pulse < 5 units, frozen at 0 |
| `ViewerCount` | "2,847 watching" live counter updated via WebSocket every 2s |
| `BuyButton` | State machine: LOCKED → UNLOCKED → LOADING → QUEUED → PROCESSING → CONFIRMED / SOLD_OUT / ERROR |
| `QueuePosition` | "You're #12 in queue" with live position countdown via WebSocket |
| `SoldOutBanner` | Shown when stock hits 0, includes waitlist CTA |
| `OrderConfirmation` | Success state with order ID and confirmation details |
| `WaitlistForm` | Email capture for restock notifications |

### Live Dashboard Components

| Component | Purpose |
|-----------|---------|
| `StockCounter` | Large, room-visible stock remaining display |
| `ConfirmedCounter` | Total confirmed orders counter |
| `RejectedCounter` | Total rejected orders counter |
| `QueueDepthIndicator` | Current queue depth |
| `RequestsPerSecChart` | Recharts area chart, 30-second rolling window |
| `LiveFeed` | Scrolling log of checkout results (✓ / ✗ with user ID snippet and latency) |
| `StockProgressBar` | Visual percentage of stock sold |

### Admin Panel Components

| Component | Purpose |
|-----------|---------|
| `ProductCreator` | Form to create a new drop (name, stock, price, drop time) |
| `InventoryResetButton` | Reset stock to original count |
| `DropUnlockButton` | Manually trigger drop unlock |
| `GateModeToggle` | **THE critical toggle** — Naive (race conditions) vs Protected (atomic gate) |
| `LoadTestTrigger` | Button to fire Artillery load test, streams results back |
| `MetricsPanel` | Real-time QPS, confirmed/rejected counts, queue depth, P50/P99 latency, final inventory (RED if negative) |
| `InventoryLogChart` | Step-chart showing inventory declining over time from audit trail |

---

## 11. Bonus Features

### 11.1 Waitlist System
When sold out, users can join a waitlist. If an order is cancelled/refunded, next person is auto-notified with a 10-minute claim window.

### 11.2 Replay Attack Prevention
A short-lived (30-second TTL) checkout token is issued when the user visits the drop page. Must be included in the checkout request. Tokens are single-use. Prevents bots from pre-loading tokens.

### 11.3 Queue Position Visualisation
Live queue position indicator that updates every second via WebSocket. Users feel the system working for them.

### 11.4 Inventory Snapshot / Audit Trail
Every inventory change logged to `inventory_log` table with timestamp, operation type, old/new values, and trigger source. Visualised as a step-chart in admin panel.

### 11.5 Metrics Export
`GET /admin/export?format=csv` downloads a CSV of all checkout attempts with timestamps, results, and latencies.

### 11.6 Drop Scheduling
Drops can be scheduled in advance via a Redis sorted set. A background worker checks every second and emits `drop_unlocked` when due.

---

## 12. Edge Cases & Handling

| Scenario | Handling Strategy |
|----------|-------------------|
| User clicks Buy twice | Pre-queue dedup via `checkout_attempt:{userId}:{productId}` Redis key → immediate 409 |
| Network drops after 202, user retries | Idempotency key lookup returns cached 202 response |
| Worker crashes mid-job | Bull marks job failed; no order written, no stock decremented (gate is checked before DB write) |
| Redis goes down | All checkouts return 503 (fail-safe: no inventory change possible) |
| Postgres goes down after Redis decrement | Compensating transaction: re-increment Redis counter on DB failure |
| Expired checkout token | 401 Unauthorized before entering queue |
| Bot with 100 IPs × 100 req/s | Layer 3 per-user rate limiting triggers on userId after first attempt |
| Client clock skew → early click | Server validates against `drop:{id}:unlock_at` in Redis, not client time |
| Stock accidentally seeded to 0 | Admin can reset from panel with audit log entry |
| Two workers dequeue same job | Bull guarantees exactly-once processing via atomic job locking |
| Load test with stock = 0 | 0 confirmations, 500 clean rejections — gate returns -2, all jobs fail cleanly |

---

## 13. Load Testing Plan

### Primary Tool: Artillery

```yaml
# load-test.yml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 1
      arrivalRate: 500     # 500 users in 1 second = the midnight drop
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
```

### Fallback: Node Script
A simple script using `Promise.all` with 500 `fetch` calls for environments where Artillery is problematic.

### Verification After Load Test (stock = 10, 500 concurrent buyers)

**Protected Mode:**
- `redis.get('inventory:{productId}')` = exactly `0` (never negative)
- `SELECT COUNT(*) FROM orders WHERE product_id = ? AND status = 'confirmed'` = exactly `10`
- No duplicate `idempotency_key` values in orders table
- All 500 requests received a response (no timeouts)

**Naive Mode:**
- `redis.get('inventory:{productId}')` = some negative number
- Order count exceeds 10

**Latency Targets (Protected Mode):**
- P50 < 100ms
- P99 < 500ms
- Zero 5xx errors (all rejections are 409, not 500)

---

## 14. Demo Script

### Setup (2 min before)
- 3 browser tabs: Drop Page, Live Dashboard, Admin Panel
- Load test script ready in terminal
- Product seeded with stock = 10, drop time = T+30 seconds
- Projector shows the Live Dashboard

### Act 1: The Broken System (2 min)
1. Admin → toggle to **Naive Mode**
2. Reset inventory to 10
3. Start countdown (30 seconds)
4. "500 users are about to hit Buy at the exact same moment."
5. Drop unlocks → run load test
6. Dashboard shows inventory plummeting past 0
7. Final stock: **-47** or some negative number
8. "23 confirmed orders for 10 items. That's the bug."

### Act 2: The Fix (2 min)
1. Admin → toggle to **Protected Mode**
2. Reset inventory to 10
3. Same countdown
4. "Same 500 users. Same moment. Different gate."
5. Drop unlocks → run load test
6. Dashboard shows: 9, 8, 7... 3, 2, 1, **0**
7. Exactly 0 stock. Exactly 10 confirmed orders.
8. "490 clean rejections. Inventory never went below zero."

### Act 3: Architecture Walkthrough (1 min)
- Show the Lua script (8 lines)
- Show the queue (FIFO fairness)
- Show idempotency keys (no double-charging)

### Act 4: Extras (1 min)
- Waitlist flow, queue position countdown, inventory audit log

---

## 15. Complete File Manifest

> [!TIP]
> This is every file in the project. Each entry includes what the file does, so you can build the project with zero prior context.

### Root Level

| # | File Path | What It Does |
|---|-----------|-------------|
| 1 | `dropzone/docker-compose.yml` | Defines 4 services — Redis 7, PostgreSQL 15, backend (Node.js/Express), and frontend (React/Vite) — with proper networking, volume mounts, health checks, and environment variable injection for single-command `docker-compose up` startup |
| 2 | `dropzone/.env.example` | Template for all environment variables: `REDIS_URL`, `DATABASE_URL`, `JWT_SECRET`, `ADMIN_TOKEN`, `PORT`, `FRONTEND_URL`, `VITE_API_URL`, `VITE_WS_URL` |
| 3 | `dropzone/README.md` | Project overview with architecture diagram, setup instructions (`docker-compose up`), demo script summary, and tech stack badges |

### Backend — Configuration

| # | File Path | What It Does |
|---|-----------|-------------|
| 4 | `dropzone/backend/package.json` | Backend dependencies: `Express`, `@Express/cors`, `@Express/rate-limit`, `ioredis`, `bull`, `pg`, `socket.io`, `jsonwebtoken`, `zod`, `uuid`, `dotenv`. Dev deps: `vitest`, `@faker-js/faker`, `nodemon` |
| 5 | `dropzone/backend/.env` | Actual environment variables for local development (gitignored) |

### Backend — Entry Point & Plugins

| # | File Path | What It Does |
|---|-----------|-------------|
| 6 | `dropzone/backend/src/server.js` | Creates the Express instance, registers all plugins (Redis, Postgres, Auth, Rate Limit, WebSocket), registers all route files, loads the Lua script into Redis at startup via `SCRIPT LOAD`, starts the checkout worker, starts the drop scheduler background task, and listens on the configured port |
| 7 | `dropzone/backend/src/plugins/redis.js` | Creates and exports a shared `ioredis` client connected to `REDIS_URL`. Decorates the Express instance with `Express.redis`. Handles connection errors and graceful shutdown |
| 8 | `dropzone/backend/src/plugins/postgres.js` | Creates a `pg.Pool` connected to `DATABASE_URL`. Decorates the Express instance with `Express.pg`. Provides a `query()` helper. Handles pool errors and graceful shutdown |
| 9 | `dropzone/backend/src/plugins/auth.js` | Express plugin that adds JWT middleware. Provides `Express.jwt.sign(payload)` and `Express.jwt.verify(token)`. Used to create guest tokens (`POST /api/auth/guest`) and verify them on protected routes. Admin routes check `X-Admin-Token` header against `ADMIN_TOKEN` env var |
| 10 | `dropzone/backend/src/plugins/ratelimit.js` | Configures `@Express/rate-limit` with global burst protection (100 req/s per IP) and exposes a route-level config for the checkout endpoint (5 req/s per IP). Uses Redis as the rate limit store for consistency across instances |
| 11 | `dropzone/backend/src/plugins/websocket.js` | Attaches a Socket.io server to the Express HTTP server. Configures CORS for the frontend origin. Sets up connection handlers: `subscribe_product` (join product room), `authenticate` (join user room via JWT), `subscribe_admin` (join admin room via admin token). Tracks viewer counts in Redis. Decorates Express with `Express.io` |

### Backend — Routes

| # | File Path | What It Does |
|---|-----------|-------------|
| 12 | `dropzone/backend/src/routes/product.js` | `GET /api/products/:id` — Fetches product from PostgreSQL, enriches with current stock from Redis (`inventory:{productId}`), returns product details. `GET /api/products/:id/checkout-token` — Generates a short-lived (30s TTL) checkout token, stores it in Redis, returns token + expiry. `GET /api/server-time` — Returns `{ timestamp: Date.now() }` for client clock sync |
| 13 | `dropzone/backend/src/routes/checkout.js` | `POST /api/checkout` — The main checkout endpoint. Pipeline: (1) Zod validates body `{ productId, quantity }`, (2) verifies JWT auth, (3) validates checkout token from `X-Checkout-Token` header, (4) checks idempotency key — returns cached response if seen before, (5) checks per-user dedup via `checkout_attempt:{userId}:{productId}` Redis key, (6) checks drop lock via `drop:{productId}:unlock_at`, (7) enqueues job into Bull checkout queue, (8) returns `202 { jobId, position, estimatedWait }`. Also handles `POST /api/auth/guest` — creates a guest user in PostgreSQL, returns JWT |
| 14 | `dropzone/backend/src/routes/queue.js` | `GET /api/queue-status/:jobId` — Polls Bull queue for job status. Returns `{ status: 'waiting', position, estimatedWait }` or `{ status: 'active' }` or `{ status: 'completed', success, orderId? }` or `{ status: 'failed', reason }` |
| 15 | `dropzone/backend/src/routes/waitlist.js` | `POST /api/waitlist` — Adds user to the waitlist table for a given product. Calculates position. Returns `{ position, estimatedChance }`. Checks for duplicate entries via `UNIQUE(user_id, product_id)` |
| 16 | `dropzone/backend/src/routes/admin.js` | All admin endpoints behind `X-Admin-Token` verification. `POST /admin/products` — Create a new product/drop, seeds inventory into Redis. `POST /admin/products/:id/reset` — Resets Redis inventory counter and logs to `inventory_log`. `POST /admin/products/:id/unlock` — Sets `drop:{productId}:unlock_at` to now, emits `drop_unlocked` via Socket.io. `PUT /admin/mode` — Toggles between `naive` and `protected` gate mode (stored in Redis key `gate_mode`). `POST /admin/run-load-test` — Triggers the Artillery load test as a child process, streams stdout to admin WebSocket room. `GET /admin/metrics` — Returns aggregated metrics. `GET /admin/inventory-log/:productId` — Returns audit trail from `inventory_log` table. `GET /admin/export` — Generates and returns CSV of `checkout_attempts` |

### Backend — Workers

| # | File Path | What It Does |
|---|-----------|-------------|
| 17 | `dropzone/backend/src/workers/checkoutWorker.js` | The Bull queue processor. Processes 1 job at a time (concurrency: 1). For each job: (1) reads `gate_mode` from Redis to decide naive vs protected, (2) calls `attemptPurchase()` (Lua gate) or `naivePurchase()` (broken version), (3) on success: inserts order into PostgreSQL `orders` table, logs to `inventory_log`, emits `inventory_update` + `checkout_result` via Socket.io, (4) on failure: emits `checkout_result: { success: false, reason: 'sold_out' }`, emits `sold_out` if remaining = 0, (5) on DB failure: runs compensating transaction to re-increment Redis counter, (6) logs checkout attempt to `checkout_attempts` table with result and latency |

### Backend — Services

| # | File Path | What It Does |
|---|-----------|-------------|
| 18 | `dropzone/backend/src/services/inventoryGate.js` | Wraps the Redis Lua script interaction. `loadScript(redis)` — reads `inventory_gate.lua`, calls `SCRIPT LOAD`, stores SHA. `attemptPurchase(redis, productId, qty)` — calls `EVALSHA` with the stored SHA, interprets return values (-1, -2, or remaining stock). `naivePurchase(redis, productId)` — the intentionally broken GET-then-DECR implementation. `seedInventory(redis, productId, stock, dropTimestamp)` — sets `inventory:{productId}`, `inventory:{productId}:total`, and `drop:{productId}:unlock_at` in Redis |
| 19 | `dropzone/backend/src/services/orderService.js` | Database operations for orders. `createOrder(pg, { userId, productId, idempotencyKey, amountPaise })` — inserts into `orders` table, returns order ID. `getOrdersByProduct(pg, productId)` — fetches all confirmed orders for a product. `logCheckoutAttempt(pg, { userId, productId, result, latencyMs })` — inserts into `checkout_attempts` table |
| 20 | `dropzone/backend/src/services/waitlistService.js` | Database operations for the waitlist. `addToWaitlist(pg, userId, productId)` — calculates next position, inserts into `waitlist` table. `processWaitlist(pg, productId, unitsAvailable)` — fetches next N unnotified entries, generates claim tokens, marks as notified. `getWaitlistPosition(pg, userId, productId)` — returns user's current position |
| 21 | `dropzone/backend/src/services/metricsService.js` | Aggregates and caches real-time metrics. Tracks QPS (rolling 5s window), success/reject counts, queue depth, P50/P99 latency. Provides `getMetrics()` for the admin endpoint and `recordCheckout(result, latencyMs)` called by the worker. Emits `metrics_tick` to the admin WebSocket room every 1 second during an active drop |

### Backend — Scripts

| # | File Path | What It Does |
|---|-----------|-------------|
| 22 | `dropzone/backend/src/scripts/inventory_gate.lua` | The Redis Lua script (the Atomic Gate). Takes `KEYS[1]` = inventory key, `ARGV[1]` = requested quantity. Atomically checks current stock and decrements if sufficient. Returns remaining stock (>= 0), -1 (not found), or -2 (sold out). This is the core innovation of the entire project |
| 23 | `dropzone/backend/src/scripts/seed.js` | Database seeder using Faker.js. Creates sample users, a demo product with stock = 10, and sets the drop time to 30 seconds in the future. Seeds Redis inventory keys. Run via `npm run seed` |

### Backend — Tests

| # | File Path | What It Does |
|---|-----------|-------------|
| 24 | `dropzone/backend/tests/gate.test.js` | Vitest unit tests for the atomic gate in isolation. Tests: (1) single decrement returns correct remaining, (2) decrement when stock = 0 returns -2, (3) decrement when key doesn't exist returns -1, (4) **atomicity test**: fires 1000 concurrent `EVALSHA` calls against stock of 100, asserts final counter = 0 and exactly 100 successes, (5) naive mode test: fires 100 concurrent naive purchases against stock of 10, asserts counter goes negative (proving the race condition exists) |
| 25 | `dropzone/backend/tests/checkout.integration.js` | Integration tests for the full checkout flow. Tests: (1) successful checkout returns 202 with jobId, (2) duplicate idempotency key returns cached response, (3) per-user dedup returns 409, (4) checkout before drop returns 503, (5) expired checkout token returns 401, (6) rate limiting returns 429 |

### Frontend — Configuration

| # | File Path | What It Does |
|---|-----------|-------------|
| 26 | `dropzone/frontend/package.json` | Frontend dependencies: `react`, `react-dom`, `react-router-dom`, `socket.io-client`, `zustand`, `recharts`, `uuid`. Dev deps: `vite`, `@vitejs/plugin-react`, `tailwindcss`, `postcss`, `autoprefixer` |
| 27 | `dropzone/frontend/vite.config.js` | Vite configuration. Sets up React plugin, proxy for `/api` and `/admin` routes to backend server (avoids CORS in dev), configures WebSocket proxy for Socket.io |
| 28 | `dropzone/frontend/tailwind.config.js` | Tailwind CSS configuration. Extends theme with custom colors for DropZone brand (dark backgrounds, accent colors for stock urgency indicators, success/error states). Configures `content` paths |
| 29 | `dropzone/frontend/postcss.config.js` | PostCSS config for Tailwind CSS processing |
| 30 | `dropzone/frontend/index.html` | HTML entry point. Includes Google Fonts (Inter), meta tags, root `<div id="root">`, script tag to `main.jsx` |

### Frontend — Entry Point & Routing

| # | File Path | What It Does |
|---|-----------|-------------|
| 31 | `dropzone/frontend/src/main.jsx` | React entry point. Renders `<App />` into `#root` with `StrictMode` |
| 32 | `dropzone/frontend/src/App.jsx` | Root component. Sets up `react-router-dom` with three routes: `/` or `/drop/:productId` → `DropPage`, `/dashboard` → `Dashboard`, `/admin` → `Admin`. Initialises Socket.io connection and provides it via context |
| 33 | `dropzone/frontend/src/index.css` | Global CSS. Imports Tailwind layers (`@tailwind base/components/utilities`). Custom animations for stock pulse, countdown tick, feed item entrance. Dark theme base styles |

### Frontend — Pages

| # | File Path | What It Does |
|---|-----------|-------------|
| 34 | `dropzone/frontend/src/pages/DropPage/DropPage.jsx` | Top-level drop page component. Fetches product data from `GET /api/products/:id`. Subscribes to product WebSocket room. Manages the overall layout: CountdownTimer (before drop), ProductCard + StockIndicator + BuyButton + QueuePosition (during drop), SoldOutBanner + WaitlistForm (after sold out), OrderConfirmation (on success). Fetches a checkout token when the drop unlocks. Handles the full user journey from anticipation → purchase → result |
| 35 | `dropzone/frontend/src/pages/Dashboard/Dashboard.jsx` | The "war room" live dashboard page. Subscribes to product room + admin room via WebSocket. Displays: large stock counter (visible from back of room), confirmed/rejected order counters, queue depth indicator, RequestsPerSec chart (Recharts area chart, 30s rolling window), LiveFeed (scrolling checkout events with ✓/✗ icons, user ID snippets, latency). Designed to be projected during the demo |
| 36 | `dropzone/frontend/src/pages/Admin/Admin.jsx` | Admin control panel page. Password protected (prompts for admin token on load, stores in localStorage). Product creation form. Inventory reset button. Drop unlock button. **Gate Mode Toggle** (Naive vs Protected — the killer demo switch). Load test trigger button with real-time result streaming. Metrics panel (QPS, confirmed/rejected, queue depth, P50/P99, final stock value with RED highlight if negative). Inventory audit log step-chart. CSV export button |

### Frontend — Components

| # | File Path | What It Does |
|---|-----------|-------------|
| 37 | `dropzone/frontend/src/components/CountdownTimer.jsx` | Real-time countdown to drop time with **millisecond precision**. Syncs to server time on mount by calling `GET /api/server-time` and computing a clock offset (`serverTime - Date.now()`). Uses offset-corrected time so client clock skew doesn't cause premature unlocks. At T=0, the countdown zeros out BUT the buy button is only enabled when the server sends `drop_unlocked` via WebSocket — server-authoritative unlock. Creates visual tension with ticking numbers |
| 38 | `dropzone/frontend/src/components/ProductCard.jsx` | Displays product image, name, price (formatted from paise to rupees), and description. Clean, visually appealing card layout |
| 39 | `dropzone/frontend/src/components/StockIndicator.jsx` | Live stock progress bar. Subscribes to `inventory_update` WebSocket events. Shows "X of Y remaining" with a percentage bar. **Urgency states**: normal (green) > 20%, amber < 20%, red + CSS pulse animation < 5 units, frozen "Sold out" at 0. Dramatic visual feedback as stock depletes |
| 40 | `dropzone/frontend/src/components/BuyButton.jsx` | The buy button with a full state machine: LOCKED (countdown showing, disabled) → UNLOCKED (drop is live, enabled, prominent "BUY NOW" CTA) → LOADING (POST /checkout sent, spinner) → QUEUED (202 received, shows "You're in queue") → PROCESSING (job is active) → CONFIRMED (green, "Order Confirmed!") / SOLD_OUT (red, "Sold Out") / ERROR (retry option). Generates a UUID v4 `Idempotency-Key` on click. Sends checkout token in `X-Checkout-Token` header |
| 41 | `dropzone/frontend/src/components/QueuePosition.jsx` | Shows "You're #12 in queue" with a live progress indicator. Subscribes to `queue_position` WebSocket events. Counts down as the worker clears jobs. Shows estimated wait time. Users feel the system working for them |
| 42 | `dropzone/frontend/src/components/SoldOutBanner.jsx` | Displayed when stock hits 0. Clear "SOLD OUT" message. Includes a CTA to join the waitlist. No ambiguity, no spinner |
| 43 | `dropzone/frontend/src/components/OrderConfirmation.jsx` | Success state. Shows "Order Confirmed!" with the order ID, a green checkmark animation, and any relevant details |
| 44 | `dropzone/frontend/src/components/WaitlistForm.jsx` | Email capture form for restock notifications. Calls `POST /api/waitlist`. Shows waitlist position and estimated chance on success |
| 45 | `dropzone/frontend/src/components/ViewerCount.jsx` | Displays "X watching" live counter. Subscribes to `viewer_count` WebSocket events. Updates every 2 seconds |
| 46 | `dropzone/frontend/src/components/LiveFeed.jsx` | Scrolling log of checkout results for the dashboard. Each entry shows ✓ (confirmed, green) or ✗ (rejected, red) + last 4 chars of user ID + latency in ms. New entries animate in from the top. Shows last 20 events |
| 47 | `dropzone/frontend/src/components/MetricsPanel.jsx` | Real-time metrics display for admin panel. Shows QPS, success count, reject count, queue depth, P50/P99 latency. Final inventory value is **highlighted RED if negative** (in naive mode). Subscribes to `metrics_tick` WebSocket events |

### Frontend — Custom Hooks

| # | File Path | What It Does |
|---|-----------|-------------|
| 48 | `dropzone/frontend/src/hooks/useInventory.js` | Custom React hook that subscribes to `inventory_update` and `sold_out` WebSocket events for a given `productId`. Returns `{ remaining, total, isSoldOut }`. Manages cleanup on unmount |
| 49 | `dropzone/frontend/src/hooks/useCheckout.js` | Custom React hook that manages the checkout state machine. Provides `{ state, submit, jobId, orderId, error }`. Handles: generating idempotency keys, calling `POST /api/checkout`, subscribing to `checkout_result` and `queue_position` WebSocket events, transitioning between states (LOCKED → UNLOCKED → LOADING → QUEUED → CONFIRMED / SOLD_OUT) |
| 50 | `dropzone/frontend/src/hooks/useServerTime.js` | Custom React hook that fetches `GET /api/server-time` on mount, computes clock offset, and returns `getAdjustedNow()` function for server-synced time. Used by CountdownTimer |

### Frontend — State Management

| # | File Path | What It Does |
|---|-----------|-------------|
| 51 | `dropzone/frontend/src/stores/dropStore.js` | Zustand store for global drop state. Stores: product data, inventory state, checkout state, viewer count, queue position, WebSocket connection status, gate mode (for admin). Actions to update each slice. Subscribed to by multiple components |

### Load Testing

| # | File Path | What It Does |
|---|-----------|-------------|
| 52 | `dropzone/load-test/load-test.yml` | Artillery load test configuration. Fires 500 virtual users in 1 second. Each user: (1) creates a guest account via `POST /api/auth/guest`, (2) submits a checkout with the received JWT and a generated idempotency key. Uses `PRODUCT_ID` environment variable. This is the config that runs during the live demo |
| 53 | `dropzone/load-test/concurrent-test.js` | Fallback Node.js load test script using `Promise.all` with 500 concurrent `fetch` calls. Does the same thing as the Artillery config but without needing Artillery installed. Each request creates a guest user then attempts checkout. Logs results: total successful, total rejected, final stock |

### Database Migrations

| # | File Path | What It Does |
|---|-----------|-------------|
| 54 | `dropzone/db/migrations/001_create_products.sql` | Creates the `products` table with UUID primary key, name, description, price_paise, image_url, total_stock, drop_time, is_active, created_at |
| 55 | `dropzone/db/migrations/002_create_users.sql` | Creates the `users` table with UUID primary key, email (unique), name, created_at |
| 56 | `dropzone/db/migrations/003_create_orders.sql` | Creates the `orders` table with UUID primary key, user_id FK, product_id FK, status (confirmed/cancelled/refunded), idempotency_key (unique), amount_paise, created_at. Creates indexes on user_id, product_id, created_at |
| 57 | `dropzone/db/migrations/004_create_waitlist.sql` | Creates the `waitlist` table with UUID primary key, user_id FK, product_id FK, position, notified, created_at. Unique constraint on (user_id, product_id). Index on (product_id, position) |
| 58 | `dropzone/db/migrations/005_create_checkout_attempts.sql` | Creates the `checkout_attempts` table with UUID primary key, user_id FK, product_id FK, result, latency_ms, created_at. Index on created_at |
| 59 | `dropzone/db/migrations/006_create_inventory_log.sql` | Creates the `inventory_log` table (bonus feature) with serial primary key, product_id, operation, old_value, new_value, triggered_by, created_at |

---

## 16. Build Order

> [!IMPORTANT]
> Follow this exact order. Do not move to the next phase until the current phase works end-to-end.

### Phase 1: Foundation (Hours 1–2)
**Goal: Redis gate working in isolation**

1. Set up `docker-compose.yml` with Redis 7 + PostgreSQL 15 containers
2. Create `backend/package.json` with all dependencies
3. Write `inventory_gate.lua` — the 8-line Lua script
4. Write `inventoryGate.js` service wrapper with `loadScript`, `attemptPurchase`, `naivePurchase`, `seedInventory`
5. Write `gate.test.js` — unit tests including the 1000-concurrent-calls atomicity test
6. **Prove it works.** Run tests. Counter must reach exactly 0.

### Phase 2: Backend Core (Hours 3–4)
**Goal: POST /checkout returns 202 with job ID**

7. Create `server.js` — Express instance, plugin registration
8. Create all plugins: `redis.js`, `postgres.js`, `auth.js`, `ratelimit.js`, `websocket.js`
9. Run database migrations (all 6 migration files)
10. Create route files: `product.js`, `checkout.js`, `queue.js`
11. Create `checkoutWorker.js` — processes queue, calls gate, writes to Postgres
12. Create `orderService.js` — database operations for orders
13. Create `seed.js` — populate test data
14. Test the full checkout flow via curl/Postman

### Phase 3: Real-Time Layer (Hours 5–6)
**Goal: Inventory updates appear in browser**

15. Wire up Socket.io in `websocket.js` plugin with rooms (product, user, admin)
16. Worker emits `inventory_update` and `checkout_result` events
17. Create `queue.js` route for job status polling
18. Frontend connects to Socket.io, logs events to console

### Phase 4: Frontend Drop Page (Hours 7–9)
**Goal: Full user flow works end to end**

19. Set up frontend with Vite + React + Tailwind
20. Create Zustand store (`dropStore.js`)
21. Create hooks: `useInventory.js`, `useCheckout.js`, `useServerTime.js`
22. Build all Drop Page components: `CountdownTimer`, `ProductCard`, `StockIndicator`, `BuyButton`, `QueuePosition`, `SoldOutBanner`, `OrderConfirmation`, `WaitlistForm`, `ViewerCount`
23. Assemble `DropPage.jsx`

### Phase 5: Live Dashboard (Hours 10–11)
**Goal: War room screen ready for projector**

24. Build dashboard components: `LiveFeed`, counters, chart
25. Assemble `Dashboard.jsx`
26. Create `metricsService.js` for aggregated metrics

### Phase 6: Admin Panel + Demo Toggle (Hours 12–13)
**Goal: Can run the naive vs protected demo live**

27. Build admin components: `GateModeToggle`, `LoadTestTrigger`, `MetricsPanel`, `InventoryLogChart`
28. Assemble `Admin.jsx`
29. Create `admin.js` route with all admin endpoints
30. Wire up load test trigger to Artillery child process
31. Create `load-test.yml` and `concurrent-test.js`

### Phase 7: Bonus Features (Hours 14–15)
Pick 2-3:
32. Waitlist system (`waitlistService.js` + `waitlist.js` route + `WaitlistForm.jsx`)
33. Idempotency key handling (already in checkout flow)
34. Replay attack prevention with checkout tokens
35. Inventory audit log with step-chart

### Phase 8: Testing & Polish (Hours 16–20)
36. Run full demo script end-to-end
37. Load test at 50, 100, 500 concurrency
38. Confirm inventory never goes negative in protected mode
39. Test all edge cases
40. Clean up UI, write README
41. Record backup demo video

---

## 17. Architectural Improvements (Post-MVP)

> [!IMPORTANT]
> These 5 improvements are implemented **after** the base platform (Phases 1–8) is working. They enhance performance, durability, security, and UX. The Lua gate script is **never modified** — all changes are additive.

### 17.1 Per-Product Worker Pools (Improvement 1)

**Problem:** Single global `checkout-queue` with concurrency 1 means a slow product blocks all other products.

**Solution:** One Bull queue per product: `checkout-queue:{productId}`. Each queue gets its own worker with concurrency 1. Queue isolation ensures one product's traffic doesn't starve another.

**New Files:**

| # | File Path | Purpose |
|---|-----------|---------|
| 60 | `backend/src/workers/workerManager.js` | Manages per-product queue lifecycle: `spawnWorker(productId)`, `destroyWorker(productId)`, `getWorker(productId)` |
| 61 | `backend/src/routes/admin.js` | Drop creation (`POST /admin/drop`), worker management (`GET /admin/workers`), gate mode toggle |

**Modified Files:**

| File | Changes |
|------|---------|
| `src/routes/checkout.js` | Enqueue to `checkout-queue:{productId}` instead of global queue |
| `src/routes/queue.js` | Resolve jobs from product-specific queues |
| `src/server.js` | Register admin routes, initialise worker manager |

**New Redis Keys (extends Section 7):**

| Key Pattern | Type | TTL | Purpose |
|-------------|------|-----|---------|
| `active_queues` | SET | Managed lifecycle | Registry of active per-product queue IDs |

**New API Endpoints (extends Section 8):**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/admin/drop` | Admin | Create drop + spawn per-product worker |
| `DELETE` | `/api/admin/drop/:productId` | Admin | End drop + drain and destroy worker |
| `GET` | `/api/admin/workers` | Admin | List active queues with waiting/active/completed counts |

**Backward Compatibility:** The existing `checkout-queue` remains for products without dedicated workers. The `checkout.js` route checks for a product-specific queue first, falls back to the global queue.

---

### 17.2 Transactional Outbox Pattern (Improvement 2)

**Problem:** Worker does (1) Redis Lua DECR, (2) Postgres INSERT. If the process crashes between steps 1 and 2, inventory is decremented in Redis but no order exists in Postgres — a permanent data loss.

**Solution:** Wrap the Postgres INSERT (order) and a new outbox INSERT in a single Postgres transaction. A separate outbox processor polls for pending events and emits WebSocket broadcasts. The worker no longer calls `io.emit` directly.

**New Database Table (extends Section 6):**

```sql
-- Migration: 007_create_outbox.sql
CREATE TABLE outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,       -- 'order.confirmed' | 'inventory.decremented'
  payload JSONB NOT NULL,
  status TEXT DEFAULT 'pending',  -- 'pending' | 'processed' | 'failed'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_outbox_pending
  ON outbox(status, created_at)
  WHERE status = 'pending';
```

**New Files:**

| # | File Path | Purpose |
|---|-----------|---------|
| 62 | `db/migrations/007_create_outbox.sql` | Outbox table + partial index |
| 63 | `backend/src/workers/outboxProcessor.js` | Polls outbox every 500ms, emits WS events, marks processed |

**Modified Files:**

| File | Changes |
|------|---------|
| `src/workers/checkoutWorker.js` | Removes direct `io.emit`. Wraps order INSERT + outbox INSERT in single transaction. On transaction failure: compensating `INCRBY inventory:{productId} 1` |
| `src/server.js` | Starts outbox processor on boot |

**New WebSocket Events (extends Section 9):**

| Event | Direction | Payload | Source |
|-------|-----------|---------|--------|
| `order.confirmed` | Server → Product room | `{ productId, orderId, userId, remaining }` | Outbox processor (replaces direct worker emit) |

**Compensating Transaction Flow:**
```
Redis DECR → Postgres BEGIN → INSERT orders → INSERT outbox → COMMIT
                                                    ↓ (on failure)
                                              Redis INCRBY +1 (restore)
```

---

### 17.3 Payment Layer with Idempotent Webhooks (Improvement 3)

**Problem:** Orders go straight to `status='confirmed'` with no payment step. No revenue, no refund path, no timeout handling.

**Solution:** Order lifecycle: `pending_payment` → `confirmed` | `payment_failed` | `expired`. Payment confirmation arrives via webhook (Stripe/mock). Redis keyspace notifications auto-expire unpaid orders.

**Database Migration (extends Section 6):**

```sql
-- Migration: 008_payment_status.sql
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending_payment','confirmed','payment_failed','expired','cancelled','refunded'));

ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_provider VARCHAR(20);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_id VARCHAR(255);
```

**New Files:**

| # | File Path | Purpose |
|---|-----------|---------|
| 64 | `db/migrations/008_payment_status.sql` | Widens status constraint, adds payment columns |
| 65 | `backend/src/routes/webhooks.js` | Stripe/mock webhook handlers with signature verification |
| 66 | `backend/src/workers/paymentExpiryListener.js` | Listens to Redis keyspace notifications for payment timeout expiry |

**New Redis Keys (extends Section 7):**

| Key Pattern | Type | TTL | Purpose |
|-------------|------|-----|---------|
| `payment_timeout:{orderId}` | string | 120s | Payment window — triggers expiry on timeout |
| `webhook_processed:{eventId}` | string | 86400s (24h) | Webhook idempotency — prevents duplicate processing |

**New API Endpoints (extends Section 8):**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/webhooks/stripe` | Signature | Stripe webhook — verifies `stripe-signature` header |
| `POST` | `/api/webhooks/mock/confirm` | None | Mock confirm payment (demo use) |
| `POST` | `/api/webhooks/mock/fail` | None | Mock fail payment (demo use) |

**New `.env` Variables:**
```
PAYMENT_PROVIDER=mock          # mock | stripe | razorpay
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_SECRET_KEY=sk_test_...
```

**Modified Files:**

| File | Changes |
|------|---------|
| `src/workers/checkoutWorker.js` | Creates orders as `pending_payment`, sets `payment_timeout:{orderId}` with 120s TTL |
| `src/services/orderService.js` | New `updateOrderStatus(pg, orderId, status)` function |
| `src/server.js` | Registers webhook routes, starts expiry listener |
| `.env.example` | Adds payment provider variables |

**Payment Flow:**
```
Gate pass → INSERT order (pending_payment) → SET payment_timeout:{orderId} EX 120
                                                    ↓
              Webhook arrives (within 120s) → UPDATE order (confirmed)
                         OR
              Key expires (after 120s) → UPDATE order (expired) → INCRBY inventory +1
```

---

### 17.4 Multi-Layer Bot Defense (Improvement 4)

**Problem:** `POST /auth/guest` → instant token with zero friction. Any script can generate unlimited guest tokens and exhaust inventory before any human can click.

**Solution:** Three-layer defense stack applied in order (fail-fast):

**Layer A — Proof of Work (PoW) Challenge:**
- Client requests a challenge: `POST /auth/challenge` → `{ challengeId, puzzle, difficulty: 4 }`
- Client must find a `nonce` such that `SHA256(puzzle + nonce)` starts with `'0000'` (4 leading zeros)
- ~200–800ms client-side compute — negligible for humans, expensive for bots at scale
- `POST /auth/guest` now requires `{ challengeId, nonce }` body

**Layer B — Behavioral Velocity Check (checkout middleware):**
- Records timestamps in Redis sorted set: `ZADD behavior:{userId} ts ts`
- If >3 checkouts within 10 seconds → flag as suspicious, require re-challenge
- If checkout arrives <200ms after drop unlock → flag as bot (sub-200ms human reaction is impossible)

**Layer C — Junk Job Deduplication (Bull enqueue):**
- Before enqueuing: check `SISMEMBER queued_users:{productId}:{dropId} userId`
- If already in set → reject with `409 already_queued`
- Otherwise: `SADD` the user with TTL = drop duration + 300s

**New Files:**

| # | File Path | Purpose |
|---|-----------|---------|
| 67 | `backend/src/services/powService.js` | Challenge generation + PoW validation |
| 68 | `backend/src/middleware/botDefense.js` | Velocity check + reaction time check |
| 69 | `public/pow-solver.js` | Client-side PoW solver (vanilla JS, importable by frontend) |

**New Redis Keys (extends Section 7):**

| Key Pattern | Type | TTL | Purpose |
|-------------|------|-----|---------|
| `pow_challenge:{challengeId}` | string | 60s | PoW puzzle storage |
| `behavior:{userId}` | sorted set | 30s | Checkout velocity tracking |
| `queued_users:{productId}:{dropId}` | set | drop duration + 300s | Junk-job deduplication |

**New API Endpoints (extends Section 8):**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/auth/challenge` | None | Issue PoW challenge |

**Modified Endpoints:**

| Method | Path | Changes |
|--------|------|---------|
| `POST` | `/api/auth/guest` | Now requires `{ challengeId, nonce }` body for PoW validation |
| `POST` | `/api/checkout` | Bot defense middleware added before enqueue |

---

### 17.5 Adaptive Queue ETA (Improvement 5)

**Problem:** Current estimate `estimatedWait = waitingCount * 50` uses a static 50ms assumption that is wrong by 10–100x under real load.

**Solution:** Track actual job durations, compute rolling p50/p95 percentiles, and broadcast updated ETAs via WebSocket.

**New Files:**

| # | File Path | Purpose |
|---|-----------|---------|
| 70 | `backend/src/services/queueStats.js` | Calculates rolling p50/p95 from Redis `job_durations:{productId}` list |

**New Redis Keys (extends Section 7):**

| Key Pattern | Type | TTL | Purpose |
|-------------|------|-----|---------|
| `job_durations:{productId}` | list | 3600s (1h) | Last 50 job duration samples |

**New WebSocket Events (extends Section 9):**

| Event | Direction | Payload | When |
|-------|-----------|---------|------|
| `eta_update` | Server → Product room | `{ productId, p50, p95, queueDepth }` | Every 2 seconds |

**Modified Files:**

| File | Changes |
|------|---------|
| `src/workers/checkoutWorker.js` | Records job duration via `LPUSH` + `LTRIM` on completion |
| `src/routes/checkout.js` | Returns `{ jobId, position, estimatedWait, worstCase, confidence }` |
| `src/routes/queue.js` | Recalculates position + adaptive ETA on poll |
| `src/server.js` | Starts periodic `eta_update` WebSocket broadcast (every 2s) |

**ETA Calculation:**
```
LRANGE job_durations:{productId} 0 -1 → sort → p50 = median, p95 = 95th percentile
estimatedWait = position × p50
worstCase = position × p95
confidence = samples ≥ 5 ? 'high' : 'low'
Cold start fallback = 80ms per job
```

---

### 17.6 Implementation Order & Dependencies

```
┌──────────────────┐
│ 1. Worker Pools  │ ← Foundation: settles worker structure
└────────┬─────────┘
         │
    ┌────▼────┐      ┌────────────────┐
    │ 2. Outbox│      │ 4. Bot Defense │ ← Independent, parallel-safe
    └────┬────┘      └────────────────┘
         │
    ┌────▼────────┐
    │ 3. Payments  │ ← Needs outbox for crash-safe events
    └─────────────┘
         
    ┌──────────────┐
    │ 5. Adaptive   │ ← Needs per-product queues
    │    ETA        │
    └──────────────┘
```

| Order | Improvement | Depends On | Breaks If Skipped |
|-------|-------------|------------|-------------------|
| 1st | Worker Pools | Nothing | All products bottleneck through one queue |
| 2nd | Outbox | Imp 1 | Crash between Redis DECR and Postgres INSERT = permanent data loss |
| 3rd | Bot Defense | Nothing | Scripts exhaust inventory instantly |
| 4th | Payments | Imp 2 | Orders confirmed without payment |
| 5th | Adaptive ETA | Imp 1 | Users see wildly inaccurate wait times |

---

### 17.7 Constraints

- **Lua script untouched** — The atomic gate (`inventory_gate.lua`) must not be modified
- **Additive migrations only** — New tables and columns only, no destructive changes
- **All Redis keys have TTLs** — No unbounded key growth
- **Backward-compatible queues** — `checkout-queue` still works for products without a dedicated worker
- **Zod validation** on every new endpoint

---

> [!CAUTION]
> **The gate is everything.** If the Lua script doesn't work in Phase 1, nothing else matters. Prove atomicity with the 1000-concurrent test before writing a single line of UI code.
