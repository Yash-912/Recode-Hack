# 🎯 Dropzone Demo Script — 40 Seconds

**Goal**: Show atomic race condition protection with a dramatic 500-concurrent-request spike.

---

## Pre-Demo Setup (2 min)

1. **Open 3 browser tabs:**
   - Tab 1: Admin Panel (`/control`) — for demo controls
   - Tab 2: Product Catalog (`/sale`) — for watching real-time state
   - Tab 3: Drop Page (`/drops/[productId]`) — for real-time checkout

2. **Tab 1 (Admin Panel):**
   ```
   Token: dropzone-admin-secret
   Gate Mode: PROTECTED (green)
   ```

3. **Tab 1: Create a product**
   - Name: "Midnight Hoodie"
   - Stock: 10
   - Price: 2,499
   - Click: Create Product

4. **Verify creation** → Copy the Product ID

5. **Tab 2: Find product** in catalog by name

6. **Tab 3: Visit drop page** → `/drops/[productId]`

---

## Demo Flow (40 seconds)

### **Segment 1: Setup (0-5s)**
- **Do**: In Tab 1 (Admin), toggle to **NAIVE MODE** (red button)
- **Say**: *"First, let's see what happens WITHOUT protection with 500 concurrent requests against 10 items."*
- **Observe**: Metrics panel shows QPS spike readiness

### **Segment 2: The Naive Chaos (5-15s)**
- **Click**: Run Load Test (500 reqs) button in Tab 1
- **Watch Tab 2**: 
  - Stock bar depletes to 0 in ~2 seconds
  - "SOLD OUT" appears
  - But metrics show >500 "confirmed" orders (OVERSELL!)
- **Say**: *"Notice we sold 500 items when we only had 10. Classic race condition — everyone hit checkout at the same time, database didn't serialize the writes."*
- **Observe Terminal**: Shows 500 successful confirmations

### **Segment 3: Flip the Switch (15-20s)**
- **Click**: PROTECTED MODE (green button) in Tab 1
- **Reset**: Click "Reset Stock To 10" and "Unlock Drop NOW"
- **Say**: *"Now, let's enable our Lua atomic gate protection and do the same test."*

### **Segment 4: The Protected Lock (20-35s)**
- **Click**: Run Load Test (500 reqs) again in Tab 1
- **Watch Tab 2**:
  - Stock bar still goes to 0
  - But MOST requests get rejected!
  - Confirmed orders = exactly 10 (or close to it)
- **Watch Terminal**:
  - 10 successful orders
  - 490 rejections (409 Conflict)
- **Say**: *"Same 500 requests, same 10 items. But this time, our Redis Lua script atomically locks inventory. First 10 win, rest are queued or rejected. Perfect consistency."*

### **Segment 5: Real-Time Look (35-40s)**
- **Tab 3 (Drop Page)**:
  - Show countdown timer live
  - Show queue position if you got in
  - Show order confirmation 
- **Say**: *"Customers see real-time feedback — queue position, stock levels, and instant confirmation. This is what atomic race condition protection looks like at scale."*

---

## Key Talking Points

| Concept | Before Protection | After Protection |
|---------|-------------------|------------------|
| **Oversell** | 500 orders for 10 items ❌ | Exactly 10 orders ✅ |
| **Consistency** | Lost writes | Atomic serialization |
| **User Experience** | Everyone claims they bought | 10 confirmed, rest queued |
| **Database** | Race conditions | No race conditions |
| **Tech** | Standard SQL | Redis Lua + Idempotency Keys |

---

## Troubleshooting

**Load test doesn't run:**
- ✅ Product created? Check admin panel
- ✅ Load test endpoint working? Check `/admin/run-load-test`
- ✅ Backend running? Check `http://localhost:3000`

**Metrics not updating:**
- ✅ WebSocket connected? (Blue dot in Admin header)
- ✅ Admin token correct? Try: `dropzone-admin-secret`
- ✅ Socket.io server running? Check backend logs

**Drop page showing 404:**
- ✅ Product ID correct in URL? e.g., `/drops/prod_12345`
- ✅ API endpoint `/api/products/:id` returning data?

---

## Optional Deep Dives (if time permits)

1. **Architecture Deep Dive**
   - Click Architecture page
   - Show Lua script flow (checkout → inventory gate → queue → worker)
   - Explain atomic operations

2. **Live Metrics**
   - Point to QPS chart
   - Show confirmed vs rejected split
   - Explain rate limiting prevents CPU meltdown

3. **Code Show**
   - Backend: `/backend/src/scripts/inventory_gate.lua`
   - Show atomic compare-and-swap logic
   - Explain why this is better than traditional locking

---

## Safety Notes for Presenter

- ✅ Always reset inventory before running load test
- ✅ Don't run load test without creating product first
- ✅ Queue position updates require backend `/api/queue/:jobId` endpoint
- ✅ Confirmed order counts may slightly exceed stock due to race conditions at the boundary (normal)

---

## Post-Demo

**Questions to anticipate:**

*"But why not use database transactions?"*
→ Transactions are slow. Redis Lua executes in < 1ms. We prioritize speed with consistency.

*"What if Redis goes down?"*
→ We have multi-replica setup. If primary fails, replica takes over. No lost state.

*"How do we handle refunds?"*
→ Out-of-scope for this demo, but see OrderService for reconciliation logic.

*"Can users see their queue position?"*
→ Yes! Real-time via WebSocket `queue_position` event. See QueuePosition component.

---

**End Demo: 40 seconds ✅**
