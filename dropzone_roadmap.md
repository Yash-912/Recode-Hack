# DropZone — Build Roadmap

**Reference:** [dropzone_prd.md](file:///C:/Users/yashd/.gemini/antigravity/brain/28e9e0c1-3438-471e-b0e4-eacfb9205f7a/dropzone_prd.md)  
**Total Phases:** 9  
**Total Steps:** 52  

> [!IMPORTANT]
> Each phase ends with a **✅ Gate Check** — a concrete verification step. **Do NOT move to the next phase** until you pass the gate check. This prevents building on a broken foundation.

---

## Dependency Map

```mermaid
graph LR
    P1["Phase 1\nInfra + Gate"] --> P2["Phase 2\nBackend Core"]
    P2 --> P3["Phase 3\nReal-Time Layer"]
    P2 --> P4["Phase 4\nFrontend Setup"]
    P3 --> P5["Phase 5\nDrop Page"]
    P4 --> P5
    P3 --> P6["Phase 6\nDashboard"]
    P5 --> P7["Phase 7\nAdmin Panel"]
    P6 --> P7
    P7 --> P8["Phase 8\nPolish + Demo"]
    P8 --> P9["Phase 9\nArch Improvements"]
```

---

## Phase 1 — Infrastructure & The Atomic Gate

**Goal:** Redis + Postgres running. Lua gate script proven atomic with tests.  
**This is the foundation of everything. Get this right first.**

### Step 1.1 — Project Scaffolding & Docker

**Files to create:**
- `dropzone/docker-compose.yml`
- `dropzone/.env.example`
- `dropzone/backend/package.json`

**What to do:**
1. Create the `dropzone/` root directory
2. Write `docker-compose.yml` with **3 services** (for now — frontend comes later):
   - `redis` — Redis 7 Alpine, port 6379, health check via `redis-cli ping`
   - `postgres` — PostgreSQL 15 Alpine, port 5432, volume for data persistence, health check via `pg_isready`
   - `backend` — Node.js 20, `depends_on` redis + postgres, mounts `./backend` as volume, port 3000
3. Write `.env.example` with all required environment variables:
   ```
   REDIS_URL=redis://localhost:6379
   DATABASE_URL=postgresql://dropzone:dropzone@localhost:5432/dropzone
   JWT_SECRET=your-super-secret-jwt-key-change-in-prod
   ADMIN_TOKEN=dropzone-admin-secret
   PORT=3000
   FRONTEND_URL=http://localhost:5173
   ```
4. Copy `.env.example` to `.env` (gitignored)
5. Create `backend/package.json` with dependencies:
   - **Runtime:** `Express`, `@Express/cors`, `@Express/rate-limit`, `ioredis`, `bull`, `pg`, `socket.io`, `jsonwebtoken`, `zod`, `uuid`, `dotenv`
   - **Dev:** `vitest`, `@faker-js/faker`, `nodemon`
   - **Scripts:** `"start"`, `"dev"` (nodemon), `"test"` (vitest), `"seed"`
6. Run `docker-compose up -d redis postgres` to start infrastructure
7. Run `npm install` in `backend/`

**Verify:** `docker ps` shows redis and postgres healthy. `redis-cli ping` returns `PONG`. `psql` can connect to the database.

---

### Step 1.2 — Database Migrations

**Files to create:**
- `dropzone/db/migrations/001_create_products.sql`
- `dropzone/db/migrations/002_create_users.sql`
- `dropzone/db/migrations/003_create_orders.sql`
- `dropzone/db/migrations/004_create_waitlist.sql`
- `dropzone/db/migrations/005_create_checkout_attempts.sql`
- `dropzone/db/migrations/006_create_inventory_log.sql`

**What to do:**
1. Create each SQL migration file with the exact schemas from the PRD (Section 6)
2. Include all indexes from the PRD
3. Run all migrations against Postgres in order:
   ```bash
   cat db/migrations/*.sql | psql $DATABASE_URL
   ```
4. Verify tables exist: `\dt` in psql should show 6 tables

**Verify:** All 6 tables created. Run `SELECT * FROM products;` — returns empty result, no errors.

---

### Step 1.3 — The Lua Script (The Core Innovation)

**Files to create:**
- `dropzone/backend/src/scripts/inventory_gate.lua`

**What to do:**
1. Write the 8-line Lua script exactly as specified in PRD Section 5.1:
   - `KEYS[1]` = inventory key, `ARGV[1]` = requested quantity
   - If key doesn't exist → return `-1`
   - If current stock >= requested → `DECRBY` and return remaining
   - Else → return `-2` (sold out)
2. Understand **why** this works: Redis is single-threaded. Lua scripts execute atomically. No interleaving possible.

---

### Step 1.4 — Inventory Gate Service

**Files to create:**
- `dropzone/backend/src/services/inventoryGate.js`

**What to do:**
1. Implement 4 functions:
   - `loadScript(redis)` — reads `inventory_gate.lua` from disk, calls `redis.script('LOAD', script)`, stores the returned SHA1 hash
   - `attemptPurchase(redis, productId, qty=1)` — calls `redis.evalsha(sha, 1, 'inventory:${productId}', qty)`, interprets result: `>= 0` = success with remaining, `-1` = not found error, `-2` = sold out
   - `naivePurchase(redis, productId)` — the **deliberately broken** GET-then-DECR with the gap. This is the "Naive Mode" for demo comparison
   - `seedInventory(redis, productId, stock, dropTimestamp)` — sets `inventory:{productId}` to stock, `inventory:{productId}:total` to stock, `drop:{productId}:unlock_at` to timestamp

---

### Step 1.5 — Gate Unit Tests

**Files to create:**
- `dropzone/backend/tests/gate.test.js`

**What to do:**
1. Write 5 Vitest test cases:
   - **Test 1:** Single decrement from stock=10 → returns 9
   - **Test 2:** Decrement when stock=0 → returns -2 (sold out)
   - **Test 3:** Decrement when key doesn't exist → returns -1
   - **Test 4 (THE critical test):** Fire **1000 concurrent** `attemptPurchase()` calls against stock=100 using `Promise.all`. Assert: final Redis counter = exactly 0, exactly 100 calls returned success, exactly 900 returned sold_out. **This proves atomicity.**
   - **Test 5:** Fire 100 concurrent `naivePurchase()` calls against stock=10. Assert: final Redis counter IS negative (proving the race condition exists in naive mode)

### ✅ Gate Check for Phase 1

```bash
npm test
```

- All 5 tests pass
- Test 4 proves exactly 100 successes out of 1000 concurrent calls (stock=100)
- Test 5 proves the naive implementation drives stock negative
- If this fails, **do not proceed**. Debug the Lua script.

---

## Phase 2 — Backend Core API

**Goal:** `POST /api/checkout` accepts a request, enqueues it, worker processes it through the gate, writes order to Postgres. Full pipeline working end-to-end via curl.

### Step 2.1 — Express Plugins

**Files to create:**
- `dropzone/backend/src/plugins/redis.js`
- `dropzone/backend/src/plugins/postgres.js`
- `dropzone/backend/src/plugins/auth.js`
- `dropzone/backend/src/plugins/ratelimit.js`
- `dropzone/backend/src/plugins/websocket.js` *(stub — full implementation in Phase 3)*

**What to do:**
1. **redis.js** — Create `ioredis` client from `REDIS_URL`. Register as Express plugin. Decorate `Express.redis`. Add `onClose` hook to disconnect.
2. **postgres.js** — Create `pg.Pool` from `DATABASE_URL`. Register as plugin. Decorate `Express.pg` with a `query(text, params)` helper. Add `onClose` hook to end pool.
3. **auth.js** — Register as plugin. Add utility methods:
   - `Express.jwt.sign(payload)` — signs JWT with `JWT_SECRET`, 24h expiry
   - `Express.jwt.verify(token)` — verifies and decodes
   - `Express.authenticate` preHandler — extracts `Authorization: Bearer <token>`, verifies, sets `request.user = { userId }`
   - `Express.verifyAdmin` preHandler — checks `X-Admin-Token` header matches `ADMIN_TOKEN` env var
4. **ratelimit.js** — Register `@Express/rate-limit` with global config (100 req/s per IP). Export a `checkoutRateLimit` config object for route-level override (5 req/s per IP).
5. **websocket.js** — For now, just a stub that creates a Socket.io server and decorates `Express.io`. Full room/event logic in Phase 3.

---

### Step 2.2 — Server Entry Point

**Files to create:**
- `dropzone/backend/src/server.js`

**What to do:**
1. Import `dotenv/config` at the top
2. Create Express instance with `logger: true`
3. Register plugins in order: redis → postgres → auth → ratelimit → websocket
4. After plugins ready: call `loadScript(Express.redis)` to load the Lua script into Redis
5. Register all route files (product, checkout, queue, waitlist, admin)
6. Set up graceful shutdown handler (`SIGTERM`, `SIGINT`)
7. Listen on `PORT` (default 3000)
8. Export the Express instance (for testing)

---

### Step 2.3 — Product & Auth Routes

**Files to create:**
- `dropzone/backend/src/routes/product.js`
- `dropzone/backend/src/routes/checkout.js` *(auth portion only)*

**What to do:**
1. **product.js** — Register 3 routes:
   - `GET /api/products/:id` — query products table, enrich with Redis stock (`inventory:{id}`), return JSON
   - `GET /api/products/:id/checkout-token` — generate UUID, store in Redis with 30s TTL, return `{ token, expiresAt, expiresIn: 30000 }`
   - `GET /api/server-time` — return `{ timestamp: Date.now() }`
   - `GET /api/health` — return `{ status: 'ok', timestamp: Date.now() }`
2. **checkout.js** — For now, implement only `POST /api/auth/guest`:
   - Generate a guest email with UUID (e.g., `guest-<uuid>@dropzone.demo`)
   - Insert into `users` table
   - Sign JWT with `{ userId }` and return `{ token, userId }`

---

### Step 2.4 — Queue, Worker, and Order Service

**Files to create:**
- `dropzone/backend/src/services/orderService.js`
- `dropzone/backend/src/workers/checkoutWorker.js`

**What to do:**
1. **orderService.js** — 3 functions:
   - `createOrder(pg, { userId, productId, idempotencyKey, amountPaise })` — `INSERT INTO orders ... RETURNING id`
   - `getOrdersByProduct(pg, productId)` — `SELECT * FROM orders WHERE product_id = $1 AND status = 'confirmed'`
   - `logCheckoutAttempt(pg, { userId, productId, result, latencyMs })` — `INSERT INTO checkout_attempts ...`
2. **checkoutWorker.js** — Create and export a Bull queue processor:
   - Create `new Queue('checkout', { redis: redisConfig })`
   - Set `defaultJobOptions`: `attempts: 1`, `removeOnComplete.age: 3600`, `removeOnFail.age: 86400`, `timeout: 5000`
   - Process with concurrency 1:
     1. Read `gate_mode` from Redis (default: `'protected'`)
     2. Call `attemptPurchase()` or `naivePurchase()` based on mode
     3. On success: fetch product price, insert order via `orderService.createOrder()`, emit `inventory_update` via Socket.io, emit `checkout_result` to user room
     4. On sold out: emit `checkout_result: { success: false }`, emit `sold_out` if remaining=0
     5. On DB error: compensating transaction — `redis.incrby('inventory:${productId}', qty)` to restore stock
     6. Always: `logCheckoutAttempt()` with result and latency

---

### Step 2.5 — Full Checkout Route

**Files to update:**
- `dropzone/backend/src/routes/checkout.js`

**Files to create:**
- `dropzone/backend/src/routes/queue.js`

**What to do:**
1. **checkout.js** — Add `POST /api/checkout` with this pipeline:
   1. Zod validate body: `{ productId: z.string().uuid(), quantity: z.number().int().min(1).max(1) }`
   2. `Express.authenticate` preHandler — extract userId from JWT
   3. Check `Idempotency-Key` header exists (400 if missing)
   4. Check Redis `idempotency:{key}` — if exists, return cached response
   5. Check Redis `checkout_attempt:{userId}:{productId}` — if exists, return 409 `already_attempted`
   6. Check `drop:{productId}:unlock_at` — if drop hasn't started, return 503
   7. Validate `X-Checkout-Token` header — check Redis `checkout_token:{token}`, delete after use (single-use)
   8. Set `checkout_attempt:{userId}:{productId}` in Redis (24h TTL)
   9. Add job to Bull checkout queue: `{ userId, productId, idempotencyKey, enqueuedAt: Date.now() }`
   10. Get `waitingCount` from queue, calculate estimated wait
   11. Cache response in `idempotency:{key}` (24h TTL)
   12. Return `202 { jobId, position, estimatedWait }`
2. **queue.js** — Register `GET /api/queue-status/:jobId`:
   - Get job from Bull by ID
   - If not found → 404
   - If waiting → return `{ status: 'waiting', position, estimatedWait }`
   - If active → return `{ status: 'active', startedAt }`
   - If completed → return `{ status: 'completed', ...result }`
   - If failed → return `{ status: 'failed', reason }`

---

### Step 2.6 — Database Seeder

**Files to create:**
- `dropzone/backend/src/scripts/seed.js`

**What to do:**
1. Connect to Postgres and Redis
2. Create 1 demo product: `name: "Midnight Hoodie Drop"`, `total_stock: 10`, `price_paise: 299900` (₹2,999), `drop_time: 30 seconds from now`
3. Seed Redis inventory: `inventory:{productId}` = 10, `inventory:{productId}:total` = 10, `drop:{productId}:unlock_at` = 30s from now
4. Set `gate_mode` in Redis to `'protected'`
5. Log the product ID and drop time to console
6. Add to package.json: `"seed": "node src/scripts/seed.js"`

### ✅ Gate Check for Phase 2

```bash
# Terminal 1: Start backend
npm run dev

# Terminal 2: Test the flow
# 1. Create a guest user
curl -X POST http://localhost:3000/api/auth/guest
# → { token: "eyJ...", userId: "uuid" }

# 2. Seed the database
npm run seed
# → Product ID: <id>, Drop time: <time>

# 3. Wait for drop to unlock, then checkout
curl -X POST http://localhost:3000/api/checkout \
  -H "Authorization: Bearer <token>" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{"productId":"<id>","quantity":1}'
# → 202 { jobId, position, estimatedWait }

# 4. Check job status
curl http://localhost:3000/api/queue-status/<jobId>
# → { status: "completed", success: true, orderId: "..." }

# 5. Verify in database
psql $DATABASE_URL -c "SELECT * FROM orders;"
# → 1 row with status 'confirmed'
```

If all of the above work, Phase 2 is complete.

---

## Phase 3 — Real-Time WebSocket Layer

**Goal:** Inventory updates, checkout results, and queue positions are broadcast to connected clients in real time.

### Step 3.1 — Full WebSocket Setup

**Files to update:**
- `dropzone/backend/src/plugins/websocket.js`

**What to do:**
1. Replace the stub with full Socket.io implementation:
   - Configure CORS for `FRONTEND_URL`
   - On `connection`:
     - `subscribe_product(productId)` → `socket.join('product:' + productId)`, increment `viewers:{productId}` in Redis
     - `authenticate(token)` → verify JWT, `socket.join('user:' + userId)`, set `socket.userId`
     - `subscribe_admin(adminToken)` → verify against `ADMIN_TOKEN`, `socket.join('admin')`
     - On `disconnect` → decrement viewer count
2. Add viewer count broadcast interval (every 2 seconds):
   - For each active product, get `viewers:{productId}` from Redis
   - Emit `viewer_count` to the product room
3. Add drop scheduler interval (every 1 second):
   - Check Redis sorted set `scheduled_drops` for due drops (`ZRANGEBYSCORE ... -inf <now>`)
   - For each due drop: `ZREM`, emit `drop_unlocked` to the product room

---

### Step 3.2 — Worker WebSocket Integration

**Files to update:**
- `dropzone/backend/src/workers/checkoutWorker.js`

**What to do:**
1. Pass the Socket.io instance (`Express.io`) to the worker
2. After a successful purchase:
   - `io.to('product:' + productId).emit('inventory_update', { productId, remaining, total })`
   - `io.to('user:' + userId).emit('checkout_result', { success: true, orderId, remaining })`
3. After a sold-out result:
   - `io.to('user:' + userId).emit('checkout_result', { success: false, reason: 'sold_out' })`
   - If remaining === 0: `io.to('product:' + productId).emit('sold_out', { productId })`
4. During queue processing, emit position updates:
   - For each waiting job ahead, emit `queue_position` updates to respective user rooms

---

### Step 3.3 — Metrics Service

**Files to create:**
- `dropzone/backend/src/services/metricsService.js`

**What to do:**
1. Track in-memory metrics with rolling windows:
   - `requestTimestamps[]` — last 5 seconds of checkout timestamps for QPS calculation
   - `successCount`, `rejectCount` — running counters
   - `latencies[]` — rolling array of latency values for P50/P99
   - `queueDepth` — updated from Bull queue
2. Export `recordCheckout(result, latencyMs)` — called by the worker after every job
3. Export `getMetrics()` — returns current snapshot `{ qps, successCount, rejectCount, queueDepth, latencyP50, latencyP99 }`
4. Start a `setInterval` (every 1 second): emit `metrics_tick` event to the `admin` Socket.io room

### ✅ Gate Check for Phase 3

1. Start the backend
2. Open a browser console or use a Socket.io test client
3. Connect to Socket.io, emit `subscribe_product` with a product ID
4. From another terminal, run a checkout via curl
5. **Verify:** The browser console logs an `inventory_update` event with the correct remaining stock
6. **Verify:** `viewer_count` events arrive every 2 seconds

---

## Phase 4 — Frontend Foundation

**Goal:** React + Vite + Tailwind project set up, routing works, Socket.io client connects.

### Step 4.1 — Frontend Scaffolding

**Files to create:**
- `dropzone/frontend/package.json`
- `dropzone/frontend/vite.config.js`
- `dropzone/frontend/tailwind.config.js`
- `dropzone/frontend/postcss.config.js`
- `dropzone/frontend/index.html`
- `dropzone/frontend/src/main.jsx`
- `dropzone/frontend/src/index.css`
- `dropzone/frontend/src/App.jsx`

**What to do:**
1. Initialise Vite React project in `frontend/`:
   ```bash
   npx -y create-vite@latest ./ --template react
   ```
2. Install dependencies:
   ```bash
   npm install react-router-dom socket.io-client zustand recharts uuid
   npm install -D tailwindcss postcss autoprefixer
   npx tailwindcss init -p
   ```
3. Configure `vite.config.js`:
   - React plugin
   - Proxy: `/api` → `http://localhost:3000`, `/admin` → `http://localhost:3000`
   - WebSocket proxy for Socket.io
4. Configure `tailwind.config.js`:
   - `content: ['./index.html', './src/**/*.{js,jsx}']`
   - Extend theme with custom colours — dark mode palette, urgency colors (green/amber/red), brand accent
5. Configure `index.css`:
   - `@tailwind base; @tailwind components; @tailwind utilities;`
   - Custom CSS animations: `pulse-stock` (red pulse for low stock), `slide-in` (for feed items), `tick` (for countdown)
   - Dark theme base: `bg-gray-950 text-white`
6. Configure `index.html`:
   - Google Fonts: `<link>` to Inter font family
   - Meta tags for SEO
   - `<div id="root">`
7. Set up `App.jsx` with React Router:
   - `/` or `/drop/:productId` → `DropPage`
   - `/dashboard` → `Dashboard`
   - `/admin` → `Admin`
   - Create Socket.io context: connect to backend, provide via `createContext`

---

### Step 4.2 — Zustand Store & Custom Hooks

**Files to create:**
- `dropzone/frontend/src/stores/dropStore.js`
- `dropzone/frontend/src/hooks/useInventory.js`
- `dropzone/frontend/src/hooks/useCheckout.js`
- `dropzone/frontend/src/hooks/useServerTime.js`

**What to do:**
1. **dropStore.js** — Zustand store with slices:
   - `product: null` + `setProduct(product)`
   - `remaining: 0`, `total: 0`, `isSoldOut: false` + `setInventory(remaining, total)`
   - `viewerCount: 0` + `setViewerCount(count)`
   - `checkoutState: 'LOCKED'` + `setCheckoutState(state)` (LOCKED | UNLOCKED | LOADING | QUEUED | PROCESSING | CONFIRMED | SOLD_OUT | ERROR)
   - `jobId: null`, `orderId: null`, `queuePosition: null`
   - `gateMode: 'protected'` + `setGateMode(mode)` (admin use)
2. **useInventory.js** hook:
   - Takes `productId` and `socket` as params
   - On mount: `socket.emit('subscribe_product', productId)`
   - Listen for `inventory_update` → update store `remaining` and `total`
   - Listen for `sold_out` → set `isSoldOut: true`
   - Cleanup listeners on unmount
   - Return `{ remaining, total, isSoldOut }`
3. **useCheckout.js** hook:
   - Takes `productId`, `socket`, `token` (JWT) as params
   - Manages the BuyButton state machine
   - `submit()` function: generates UUID idempotency key, fetches checkout token, `POST /api/checkout` with all headers, transitions to LOADING → QUEUED (on 202)
   - Listen for `checkout_result` → transition to CONFIRMED or SOLD_OUT
   - Listen for `queue_position` → update `queuePosition`
   - Return `{ state, submit, jobId, orderId, queuePosition, error }`
4. **useServerTime.js** hook:
   - On mount: `fetch('/api/server-time')`, compute `clockOffset = serverTimestamp - Date.now()`
   - Return `{ getAdjustedNow: () => Date.now() + clockOffset, offset }`

### ✅ Gate Check for Phase 4

```bash
cd frontend && npm run dev
```

- App loads in browser at `http://localhost:5173`
- No console errors
- React Router works: `/`, `/dashboard`, `/admin` all render placeholder content
- Socket.io connects to backend (check network tab for WebSocket upgrade)
- Browser console shows Socket.io `connect` event

---

## Phase 5 — The Drop Page (User-Facing)

**Goal:** Complete user journey — countdown → buy → queue position → confirmed/sold out.

### Step 5.1 — Static Components

**Files to create:**
- `dropzone/frontend/src/components/ProductCard.jsx`
- `dropzone/frontend/src/components/ViewerCount.jsx`
- `dropzone/frontend/src/components/SoldOutBanner.jsx`
- `dropzone/frontend/src/components/OrderConfirmation.jsx`
- `dropzone/frontend/src/components/WaitlistForm.jsx`

**What to do:**
1. **ProductCard** — Display product image, name, description, price (format `price_paise / 100` as ₹X,XXX). Dark card with subtle gradient border. Image at top, text below. Impressive layout that looks like a premium e-commerce site.
2. **ViewerCount** — Small badge: `👁 2,847 watching`. Subscribes to `viewer_count` WS event. Number animates on change.
3. **SoldOutBanner** — Full-width red/dark banner: "SOLD OUT" in large text. Subtitle: "This drop has ended." CTA button: "Join Waitlist →"
4. **OrderConfirmation** — Green success card with animated checkmark. Shows order ID. Confetti or celebration animation.
5. **WaitlistForm** — Email input + Submit button. Calls `POST /api/waitlist`. On success, shows position: "You're #14 on the waitlist."

---

### Step 5.2 — Interactive Components

**Files to create:**
- `dropzone/frontend/src/components/CountdownTimer.jsx`
- `dropzone/frontend/src/components/StockIndicator.jsx`
- `dropzone/frontend/src/components/BuyButton.jsx`
- `dropzone/frontend/src/components/QueuePosition.jsx`

**What to do:**
1. **CountdownTimer** — The tension builder:
   - Uses `useServerTime()` to get offset-corrected time
   - `useEffect` with `requestAnimationFrame` or `setInterval(16ms)` for smooth ms countdown
   - Displays: `00:12:347` (seconds : milliseconds) in large monospace font
   - At T=0: shows "DROP IS LIVE" but **does NOT enable buying** until `drop_unlocked` WebSocket event arrives from the server
   - Visual: dark background, glowing numbers, maybe a subtle shake as it approaches zero
2. **StockIndicator** — The urgency bar:
   - Uses `useInventory()` hook for `{ remaining, total }`
   - Progress bar width = `(remaining / total) * 100%`
   - Color logic: `>20%` green, `<20%` amber, `<5 units` red with CSS pulse animation
   - Text: "7 of 10 remaining" or "SOLD OUT"
   - Animate number changes with a brief scale-up effect
3. **BuyButton** — The state machine:
   - Uses `useCheckout()` hook for `{ state, submit }`
   - Render per state:
     - `LOCKED` → disabled, grayed out, shows "WAITING FOR DROP"
     - `UNLOCKED` → enabled, glowing accent colour, "BUY NOW ⚡"
     - `LOADING` → spinner, "SUBMITTING..."
     - `QUEUED` → "IN QUEUE — #12", shows QueuePosition component
     - `CONFIRMED` → green, "ORDER CONFIRMED ✓"
     - `SOLD_OUT` → red, "SOLD OUT"
     - `ERROR` → "RETRY" button
   - On click (when UNLOCKED): calls `submit()`
4. **QueuePosition** — Shows during QUEUED state:
   - "You're #8 in queue"
   - Progress bar or count-down
   - "Estimated wait: ~2 seconds"
   - Updates live via `queue_position` WS events

---

### Step 5.3 — Drop Page Assembly

**Files to create:**
- `dropzone/frontend/src/pages/DropPage/DropPage.jsx`

**Files to create (backend support):**
- `dropzone/backend/src/routes/waitlist.js`
- `dropzone/backend/src/services/waitlistService.js`

**What to do:**
1. **DropPage.jsx** — Orchestrates the full user journey:
   - On mount: fetch product data (`GET /api/products/:id`), store in Zustand
   - Get/create guest auth token (check localStorage, or call `POST /api/auth/guest`)
   - Subscribe to product WebSocket room
   - Authenticate via WebSocket (emit `authenticate` with JWT)
   - **Layout states:**
     - **PRE-DROP:** CountdownTimer (center stage) + ProductCard + ViewerCount
     - **LIVE DROP:** ProductCard + StockIndicator + BuyButton + optional QueuePosition
     - **POST-DROP (confirmed):** OrderConfirmation
     - **POST-DROP (sold out):** SoldOutBanner + WaitlistForm
   - When `drop_unlocked` event arrives → transition checkout state to UNLOCKED
   - Dark theme, single-column centered layout, dramatic typography
2. **waitlist.js route** — `POST /api/waitlist` with JWT auth. Calls `waitlistService.addToWaitlist()`. Returns `{ position, estimatedChance }`.
3. **waitlistService.js** — `addToWaitlist(pg, userId, productId)`: calculate next position (`SELECT MAX(position) + 1`), insert, return position. `estimatedChance` = rough percentage based on typical cancellation rates.

### ✅ Gate Check for Phase 5

1. Seed a product with stock=10, drop time = 30 seconds from now
2. Open `http://localhost:5173` in browser
3. **See:** countdown ticking with ms precision
4. **See:** "X watching" viewer count
5. Wait for countdown to hit zero
6. **See:** BuyButton becomes clickable
7. Click BUY NOW
8. **See:** state transitions: LOADING → QUEUED → CONFIRMED (or SOLD_OUT)
9. **See:** stock indicator decrements in real time
10. Repeat until stock = 0 to see the SOLD OUT flow

---

## Phase 6 — Live Dashboard (War Room View)

**Goal:** The screen you put on the projector during the demo. Large numbers, live charts, scrolling feed.

### Step 6.1 — Dashboard Components

**Files to create:**
- `dropzone/frontend/src/components/LiveFeed.jsx`
- `dropzone/frontend/src/components/MetricsPanel.jsx`

**What to do:**
1. **LiveFeed** — A scrolling log of checkout events:
   - Array of events, max 20, newest at top
   - Each row: `✓ User a3f2 — 47ms` (green) or `✗ User 9b04 — 23ms` (red)
   - New items animate in with `slide-in` CSS animation
   - Auto-scrolls
   - Events come from `checkout_result` or a dedicated `feed_event` WS event
2. **MetricsPanel** — Grid of metric cards:
   - **QPS** — large number, updated every second from `metrics_tick`
   - **Confirmed** — green counter
   - **Rejected** — red counter
   - **Queue Depth** — current depth
   - **P50 / P99 Latency** — in milliseconds
   - **Final Stock** — LARGE number. **RED background if negative** (naive mode proof)

---

### Step 6.2 — Dashboard Page Assembly

**Files to create:**
- `dropzone/frontend/src/pages/Dashboard/Dashboard.jsx`

**What to do:**
1. Layout designed for **projector readability** — large fonts, high contrast, dark background
2. Top bar: "DROP LIVE: [Product Name]" + elapsed time since drop started
3. Row of 4-5 large stat cards (Stock Left, Confirmed, Rejected, Queue Depth)
4. Full-width stock progress bar
5. Bottom half split: Recharts area chart (QPS over last 30 seconds) on left, LiveFeed on right
6. Subscribe to `inventory_update`, `metrics_tick`, `sold_out` WS events
7. For the Recharts chart:
   - X axis: time (last 30 seconds, in 1-second bins)
   - Y axis: requests per second
   - AreaChart with gradient fill
   - Data pushed from `metrics_tick` events

### ✅ Gate Check for Phase 6

1. Open Dashboard on one screen
2. Run 10 manual checkouts from another terminal
3. **See:** stock counter decrement live
4. **See:** confirmed/rejected counts increment
5. **See:** feed entries appear with animations
6. **See:** chart shows request spikes

---

## Phase 7 — Admin Panel & Demo Toggle

**Goal:** The Naive vs Protected toggle works. Load test can be triggered from the UI. This is the demo-winning screen.

### Step 7.1 — Admin Routes (Backend)

**Files to create:**
- `dropzone/backend/src/routes/admin.js`

**What to do:**
1. All routes prefixed with `/admin`, protected by `verifyAdmin` preHandler
2. Implement these endpoints:
   - `POST /admin/products` — create product, seed inventory in Redis, add to `scheduled_drops` sorted set
   - `POST /admin/products/:id/reset` — reset `inventory:{id}` in Redis to specified stock, log to `inventory_log`
   - `POST /admin/products/:id/unlock` — set `drop:{id}:unlock_at` to `Date.now()`, emit `drop_unlocked`
   - `PUT /admin/mode` — set `gate_mode` in Redis to `'naive'` or `'protected'`, return new mode
   - `POST /admin/run-load-test` — spawn Artillery as child process (`child_process.spawn`), stream stdout line-by-line to admin WS room as `load_test_output` events. Return 202 immediately.
   - `GET /admin/metrics` — call `metricsService.getMetrics()`, return JSON
   - `GET /admin/inventory-log/:productId` — query `inventory_log` table, return array sorted by `created_at`
   - `GET /admin/export?format=csv&productId=X` — query `checkout_attempts`, generate CSV string, return with `Content-Type: text/csv` + `Content-Disposition: attachment`

---

### Step 7.2 — Load Test Scripts

**Files to create:**
- `dropzone/load-test/load-test.yml`
- `dropzone/load-test/concurrent-test.js`

**What to do:**
1. **load-test.yml** — Artillery config as specified in PRD Section 13. Fires 500 users in 1 second. Each user creates guest account then checkouts.
2. **concurrent-test.js** — Fallback Node script:
   ```
   1. Create 500 guest users via POST /api/auth/guest (parallel)
   2. Wait for all to complete
   3. Fire 500 POST /api/checkout simultaneously via Promise.all
   4. Collect results
   5. Print: X confirmed, Y rejected, final stock = Z
   ```
   This is the script the admin panel's "Run Load Test" button invokes.

---

### Step 7.3 — Admin Panel Page

**Files to create:**
- `dropzone/frontend/src/pages/Admin/Admin.jsx`

**What to do:**
1. **Auth gate:** On load, check `localStorage.getItem('adminToken')`. If not set, show a simple password input. Store on submit.
2. **Product Section:**
   - Product creation form (name, stock, price, drop time offset in seconds)
   - Submit → `POST /admin/products`
3. **Drop Controls:**
   - "Reset Inventory" button → `POST /admin/products/:id/reset`
   - "Unlock Drop Now" button → `POST /admin/products/:id/unlock`
4. **THE TOGGLE — Gate Mode:**
   - Radio buttons or toggle switch: **Naive** / **Protected**
   - Visual distinction: Naive = red/warning, Protected = green/safe
   - On change → `PUT /admin/mode`
   - Current mode shown prominently
5. **Load Test Button:**
   - "🚀 RUN LOAD TEST (500 requests)" button
   - On click → `POST /admin/run-load-test`
   - Show streaming output in a terminal-like card below
   - Subscribe to `load_test_output` WS events
6. **Metrics Panel:**
   - Reuse `MetricsPanel` component
   - Subscribe to `metrics_tick` WS events in admin room
   - **Final Stock** card: highlighted RED if negative (the naive mode proof!)
7. **Inventory Log:**
   - Fetch `GET /admin/inventory-log/:productId`
   - Render as a Recharts step-chart (StepLine chart): X = time, Y = stock level
   - Shows inventory declining over time during the drop
8. **Export Button:**
   - "📥 Export CSV" → opens `GET /admin/export?format=csv&productId=X` in new tab (downloads)

### ✅ Gate Check for Phase 7

**This is the full demo rehearsal:**

1. Open 3 tabs: Drop Page, Dashboard, Admin
2. In Admin: create a product with stock=10
3. Toggle to **Naive Mode**
4. Reset inventory to 10, set drop time to 10 seconds
5. Click "Run Load Test" with 500 requests
6. **Watch Dashboard:** stock goes negative (e.g., -47). Confirmed orders > 10.
7. Toggle to **Protected Mode**
8. Reset inventory to 10, set drop time to 10 seconds
9. Click "Run Load Test" with same 500 requests
10. **Watch Dashboard:** stock ticks down to exactly 0. Confirmed orders = exactly 10.
11. Take a screenshot of both results side by side. That's your demo.

---

## Phase 8 — Polish, Edge Cases & Demo Prep

**Goal:** Production-quality UI, all edge cases handled, demo rehearsed.

### Step 8.1 — Edge Case Hardening

**Files to update:** Various backend files

**What to do:**
1. **Idempotency replays** — Test: same idempotency key returns same response (already implemented, just verify)
2. **Compensating transaction** — Test: kill Postgres connection after Redis decrement, verify stock is re-incremented in Redis
3. **Checkout token expiry** — Test: wait 31 seconds after getting token, try checkout → 401
4. **Rate limiting** — Test: fire 10 rapid requests from same IP → first 5 succeed (or 1 for per-user), rest get 429
5. **Drop not started** — Test: checkout before drop time → 503 with `unlockAt`
6. **Queue timeout** — Test: a job that takes > 5s gets killed cleanly
7. Add error handling in all routes: try/catch, meaningful error messages, no stack traces in responses

---

### Step 8.2 — UI Polish

**Files to update:** All frontend components and CSS

**What to do:**
1. **Typography** — Ensure Inter font loads. Headlines bold, large. Numbers in monospace variant for countdown/stock.
2. **Animations:**
   - Stock bar should animate width changes smoothly (`transition: width 0.3s ease`)
   - Countdown numbers should have a subtle "tick" animation each second
   - Feed items should slide in from right
   - Buy button should have a subtle glow/pulse when UNLOCKED
   - Confirmed state should have a celebration animation (confetti or checkmark draw)
3. **Responsive** — Drop Page should work on mobile (single column). Dashboard is desktop-only (projector).
4. **Loading states** — Skeleton loaders while product data fetches
5. **Error states** — Meaningful error messages, not just "Error occurred"
6. **Favicon** — Add a simple favicon (⚡ emoji or a custom one)

---

### Step 8.3 — README & Documentation

**Files to create:**
- `dropzone/README.md`

**What to do:**
1. Project title + one-line description
2. Architecture diagram (copy from PRD)
3. Quick Start:
   ```bash
   git clone <repo>
   cd dropzone
   cp .env.example .env
   docker-compose up -d
   cd backend && npm install && npm run seed
   cd ../frontend && npm install && npm run dev
   ```
4. Tech stack badges
5. Demo instructions (summarised from PRD Section 14)
6. Screenshots (take after UI polish)
7. API reference summary (link to PRD for full details)

---

### Step 8.4 — Integration Tests

**Files to create:**
- `dropzone/backend/tests/checkout.integration.js`

**What to do:**
1. Test the full flow end-to-end:
   - Create guest → checkout → poll queue → verify order in DB
   - Duplicate idempotency key → same response
   - Per-user dedup → 409
   - Pre-drop checkout → 503
   - Expired token → 401
   - Rate limit → 429
2. Run the concurrent load test (500 requests, stock=10):
   - Protected mode: assert counter=0, orders=10
   - Naive mode: assert counter < 0, orders > 10

---

### Step 8.5 — Docker Compose Finalisation

**Files to update:**
- `dropzone/docker-compose.yml`

**What to do:**
1. Add the `frontend` service (Vite dev server or `npm run preview` for built assets)
2. Ensure all 4 services start with `docker-compose up`
3. Add `.dockerignore` files
4. Test: fresh `docker-compose up` from scratch should bring up the entire app
5. Optional: add an `init` service that runs migrations + seed automatically

---

### Step 8.6 — Demo Rehearsal

No files to create. This is pure practice.

1. Set up the 3-tab layout: Drop Page, Dashboard, Admin
2. Run through the full demo script (PRD Section 14):
   - **Act 1 (Naive):** Toggle naive → reset → load test → stock goes negative
   - **Act 2 (Protected):** Toggle protected → reset → load test → stock hits exactly 0
   - **Act 3:** Walk through the Lua script, queue, idempotency
   - **Act 4:** Show waitlist, queue position, audit log
3. Time it. Should be under 7 minutes total.
4. Practice recovering from failures:
   - What if Docker crashes? → Restart, re-seed, continue
   - What if the frontend disconnects? → Refresh, WS auto-reconnects
   - What if a judge asks about scaling? → "Horizontal workers, Redis Cluster, the Lua script stays atomic"

### ✅ Final Gate Check

- [ ] `docker-compose up` starts everything in one command
- [ ] Fresh seed → countdown → buy flow works perfectly
- [ ] Naive mode load test: stock goes negative, orders > stock
- [ ] Protected mode load test: stock = exactly 0, orders = exactly stock
- [ ] Dashboard shows everything in real time
- [ ] All edge cases handled gracefully
- [ ] README is clear and complete
- [ ] Demo takes < 7 minutes
- [ ] UI looks **premium**, not prototypey

---

## Phase 9 — Architectural Improvements

**Goal:** Five post-MVP improvements that enhance performance, durability, security, and UX. These build on the completed Phase 1–8 foundation. **The Lua gate script is never modified.**

> [!IMPORTANT]
> Build order matters. Improvement 1 (Worker Pools) must be completed first — it settles the worker structure that Improvements 2, 3, and 5 modify. Improvement 4 (Bot Defense) is independent and can be built in parallel.

### Step 9.1 — Per-Product Worker Pools (Improvement 1)

**Files to create:**
- `dropzone/backend/src/workers/workerManager.js`

**Files to update:**
- `dropzone/backend/src/routes/admin.js` (add drop creation + worker management endpoints)
- `dropzone/backend/src/routes/checkout.js` (route to `checkout-queue:{productId}`)
- `dropzone/backend/src/routes/queue.js` (resolve jobs from product-specific queues)
- `dropzone/backend/src/server.js` (register admin routes, init worker manager)

**What to do:**
1. Create `workerManager.js` with three functions:
   - `spawnWorker(productId)` — creates `new Queue('checkout-queue:{productId}')`, registers processor with concurrency 1, adds to `active_queues` Redis SET
   - `destroyWorker(productId)` — drains queue, closes worker, removes from SET
   - `getWorker(productId)` — returns existing queue or throws
2. Update `checkout.js` enqueue: check for product-specific queue via `workerManager.getWorker(productId)`, fall back to global `checkout-queue` if none exists
3. Add admin endpoints:
   - `POST /api/admin/drop` — creates product, seeds inventory, calls `spawnWorker(productId)`
   - `DELETE /api/admin/drop/:productId` — calls `destroyWorker(productId)`
   - `GET /api/admin/workers` — returns active queues with `waiting`/`active`/`completed` counts
4. Update `queue.js` to resolve jobs from the correct per-product queue

**New Redis key:** `active_queues` (SET, managed lifecycle — no TTL needed, cleaned up on destroy)

---

### Step 9.2 — Transactional Outbox Pattern (Improvement 2)

**Files to create:**
- `dropzone/db/migrations/007_create_outbox.sql`
- `dropzone/backend/src/workers/outboxProcessor.js`

**Files to update:**
- `dropzone/backend/src/workers/checkoutWorker.js` (remove direct `io.emit`, add transactional outbox insert)
- `dropzone/backend/src/server.js` (start outbox processor)

**What to do:**
1. Create migration `007_create_outbox.sql`:
   - `outbox` table with columns: `id` (UUID), `event_type` (TEXT), `payload` (JSONB), `status` (TEXT, default 'pending'), `created_at`, `processed_at`
   - Partial index: `CREATE INDEX idx_outbox_pending ON outbox(status, created_at) WHERE status = 'pending'`
2. Update `checkoutWorker.js`:
   - Remove all direct `io.emit()` calls
   - After Redis gate success, wrap in Postgres transaction:
     ```
     BEGIN
       INSERT INTO orders (...) RETURNING id → orderId
       INSERT INTO outbox (event_type, payload) VALUES ('order.confirmed', {orderId, userId, productId, remaining})
     COMMIT
     ```
   - On transaction failure: compensating `redis.incrby('inventory:{productId}', 1)` to restore stock
3. Create `outboxProcessor.js`:
   - `setInterval` every 500ms
   - `SELECT * FROM outbox WHERE status = 'pending' ORDER BY created_at LIMIT 20 FOR UPDATE SKIP LOCKED`
   - For each row: emit the corresponding Socket.io event, then `UPDATE outbox SET status = 'processed', processed_at = NOW()`
4. Start the outbox processor in `server.js` after plugin registration

---

### Step 9.3 — Multi-Layer Bot Defense (Improvement 4)

**Files to create:**
- `dropzone/backend/src/services/powService.js`
- `dropzone/backend/src/middleware/botDefense.js`
- `dropzone/public/pow-solver.js`

**Files to update:**
- `dropzone/backend/src/routes/checkout.js` (add PoW to guest auth, add bot defense middleware, add junk-job dedup)

**What to do:**
1. Create `powService.js`:
   - `createChallenge()` — generates random 32-byte hex puzzle, stores in Redis with 60s TTL, returns `{ challengeId, puzzle, difficulty: 4 }`
   - `validateChallenge(challengeId, nonce)` — retrieves puzzle from Redis, computes `SHA256(puzzle + nonce)`, verifies it starts with `'0000'` (4 leading zeros), deletes key on success
2. Update `POST /api/auth/guest` — now requires `{ challengeId, nonce }` body. Validates PoW before issuing JWT
3. Add `POST /api/auth/challenge` endpoint — calls `powService.createChallenge()`
4. Create `botDefense.js` middleware:
   - **Velocity check:** `ZADD behavior:{userId} ts ts`, `ZREMRANGEBYSCORE behavior:{userId} -inf (now - 10000)`, if `ZCARD > 3` → 429 suspicious
   - **Reaction time:** if `(Date.now() - dropUnlockAt) < 200ms` → 429 bot detected
5. Add junk-job dedup in checkout enqueue:
   - Before enqueuing: `SISMEMBER queued_users:{productId}:{dropId} userId` → if true, 409 `already_queued`
   - Otherwise: `SADD` with TTL = drop duration + 300s
6. Create `pow-solver.js` (vanilla JS for frontend):
   - Iterates nonces until `SHA256(puzzle + nonce)` has 4 leading zero hex chars
   - Exposes `solvePow(puzzle, difficulty)` function

**New Redis keys:** `pow_challenge:{challengeId}` (60s TTL), `behavior:{userId}` (30s TTL), `queued_users:{productId}:{dropId}` (drop duration + 300s TTL)

---

### Step 9.4 — Payment Layer with Idempotent Webhooks (Improvement 3)

**Files to create:**
- `dropzone/db/migrations/008_payment_status.sql`
- `dropzone/backend/src/routes/webhooks.js`
- `dropzone/backend/src/workers/paymentExpiryListener.js`

**Files to update:**
- `dropzone/backend/src/workers/checkoutWorker.js` (create orders as `pending_payment`, set payment timeout)
- `dropzone/backend/src/services/orderService.js` (add `updateOrderStatus()`)
- `dropzone/backend/src/server.js` (register webhook routes, start expiry listener)
- `dropzone/.env.example` (add `PAYMENT_PROVIDER`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_SECRET_KEY`)

**What to do:**
1. Create migration `008_payment_status.sql`:
   - Widen `orders.status` CHECK constraint to include `pending_payment`, `payment_failed`, `expired`
   - Add `payment_provider` (VARCHAR 20) and `payment_id` (VARCHAR 255) columns
2. Update `checkoutWorker.js`:
   - On gate pass, insert order with `status = 'pending_payment'`
   - Set Redis key `payment_timeout:{orderId}` with 120s TTL
3. Create `webhooks.js` route:
   - `POST /api/webhooks/stripe` — verify `stripe-signature` header using `STRIPE_WEBHOOK_SECRET`, check idempotency via `webhook_processed:{eventId}`, process `payment_intent.succeeded` / `payment_intent.payment_failed`
   - `POST /api/webhooks/mock/confirm` — for demo: instantly confirms order
   - `POST /api/webhooks/mock/fail` — for demo: fails order, releases inventory
4. Create `paymentExpiryListener.js`:
   - Subscribe to Redis keyspace notifications (`__keyevent@0__:expired`)
   - On expiry of `payment_timeout:{orderId}`: check if order is still `pending_payment`, if so → update to `expired`, `INCRBY inventory:{productId} 1`
   - Requires Redis config: `notify-keyspace-events Ex` (add to `docker-compose.yml` Redis command)
5. Add `updateOrderStatus(pg, orderId, status)` to `orderService.js`

**New Redis keys:** `payment_timeout:{orderId}` (120s TTL), `webhook_processed:{eventId}` (86400s TTL)

---

### Step 9.5 — Adaptive Queue ETA (Improvement 5)

**Files to create:**
- `dropzone/backend/src/services/queueStats.js`

**Files to update:**
- `dropzone/backend/src/workers/checkoutWorker.js` (record job duration)
- `dropzone/backend/src/routes/checkout.js` (return adaptive ETA)
- `dropzone/backend/src/routes/queue.js` (recalculate ETA on poll)
- `dropzone/backend/src/server.js` (start periodic `eta_update` broadcast)

**What to do:**
1. Update `checkoutWorker.js`:
   - On job completion, calculate `duration = Date.now() - job.data.enqueuedAt`
   - `LPUSH job_durations:{productId} duration` + `LTRIM job_durations:{productId} 0 49`
   - Set TTL: `EXPIRE job_durations:{productId} 3600`
2. Create `queueStats.js`:
   - `getStats(redis, productId)` — `LRANGE job_durations:{productId} 0 -1`, sort, compute p50 (median) and p95 (95th percentile)
   - If fewer than 5 samples → return `{ p50: 80, p95: 200, confidence: 'low' }` (cold start defaults)
   - Otherwise → return `{ p50, p95, confidence: 'high' }`
3. Update checkout enqueue response:
   - Call `queueStats.getStats()` to calculate `estimatedWait = position × p50`, `worstCase = position × p95`
   - Return `{ jobId, position, estimatedWait, worstCase, confidence }`
4. Update `queue.js` — recalculate current position and adaptive ETA on poll (not stale enqueue-time values)
5. Add `setInterval` in `server.js` (every 2 seconds):
   - For each active product queue: compute stats, emit `eta_update` event to product room
   - `io.to('product:' + productId).emit('eta_update', { productId, p50, p95, queueDepth })`

**New Redis key:** `job_durations:{productId}` (list, 3600s TTL)

---

### ✅ Gate Check for Phase 9

**Per-Product Workers:**
- [ ] Create a drop via `POST /admin/drop` → worker spawns
- [ ] Checkout routes to the correct product-specific queue
- [ ] `GET /admin/workers` shows queue stats
- [ ] Destroying a drop drains the queue cleanly

**Transactional Outbox:**
- [ ] Kill the worker process mid-checkout → inventory is restored (compensating transaction fires)
- [ ] WebSocket events arrive via outbox processor (not direct from worker)
- [ ] `outbox` table shows processed events

**Bot Defense:**
- [ ] `POST /auth/guest` without PoW solution → 400
- [ ] Rapidly firing 5+ checkouts within 10 seconds → velocity check triggers
- [ ] Duplicate enqueue for same user+product → 409 `already_queued`

**Payment Layer:**
- [ ] Order created as `pending_payment` after gate pass
- [ ] Mock webhook confirms order → status becomes `confirmed`
- [ ] Payment timeout (120s) → order expires, inventory slot released
- [ ] Duplicate webhook with same event ID → ignored (idempotent)

**Adaptive ETA:**
- [ ] After 5+ checkouts, `estimatedWait` and `worstCase` reflect actual durations
- [ ] `eta_update` WebSocket events arrive every 2 seconds
- [ ] Cold start returns `confidence: 'low'` with 80ms default

---

> [!CAUTION]
> **The #1 mistake in hackathons is building breadth before depth.** The Atomic Gate (Phase 1) IS the project. If you have a working gate + a curl demo that shows naive vs protected, you have a winning story. Everything else is polish. Don't skip Phase 1's gate check to rush to the UI.
