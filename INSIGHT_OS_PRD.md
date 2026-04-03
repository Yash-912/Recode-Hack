# INSIGHT-OS — Product Requirements Document
### Privacy-First Analytics Engine | PS 2 — The Signal in the Static
**Version:** 1.0 — Final Sprint Edition  
**Date:** April 3, 2026  
**Sprint Duration:** 12 Hours  
**Team:** 3 Engineers (Person A · Person B · Person C)  
**Benchmark:** Umami · Plausible · Hotjar · Google Analytics

---

## Table of Contents
1. [Product Vision](#1-product-vision)
2. [What Makes Us Different](#2-what-makes-us-different)
3. [System Architecture](#3-system-architecture)
4. [Database Schema](#4-database-schema)
5. [Feature Specifications](#5-feature-specifications)
6. [API Contract](#6-api-contract)
7. [The Tracker Script](#7-the-tracker-script)
8. [AI Layer Design](#8-ai-layer-design)
9. [Tech Stack](#9-tech-stack)
10. [Judging Criteria & How We Win](#10-judging-criteria--how-we-win)
11. [12-Hour Execution Plan](#11-12-hour-execution-plan)
12. [Demo Script](#12-demo-script)

---

## 1. Product Vision

> **Every analytics tool tells you *what* happened. Insight-OS tells you *what it means*.**

Most dashboards are static — you stare at numbers and interpret them yourself. Insight-OS surfaces **signals**: AI-generated plain-English narratives that turn raw event data into decisions. It is not a Umami clone. It is what analytics looks like when you treat data as a story, not a spreadsheet.

### The One-Line Pitch
Paste a `< 5KB` snippet on your site → get a Mission Control dashboard with real-time traffic, funnel analysis, session narratives, heatmaps, and an AI Signal Layer that reads your data every load and tells you exactly what to do next.

### The Three Systems Inside One Product

| System | What it does | Who builds it |
|---|---|---|
| **The Collector** | `tracker.js` — runs on third-party sites | Person A |
| **The Ingestion API** | Receives events, dual-writes to DB | Person B |
| **Mission Control** | Dashboard, charts, AI signals, heatmap | Person C |

---

## 2. What Makes Us Different

### Competitor Comparison

| Feature | Insight-OS | Umami | Plausible | Hotjar |
|---|---|---|---|---|
| AI Signal Cards | ✅ Yes | ❌ No | ❌ No | ❌ No |
| Session Narratives | ✅ Yes | ❌ No | ❌ No | ❌ No |
| Cookie-Free Tracking | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No |
| Heatmap | ✅ Yes | ❌ No | ❌ No | ✅ Yes |
| Heatmap with AI Opinion | ✅ Yes | ❌ No | ❌ No | ❌ No |
| Live Geo Map | ✅ Yes | ❌ No | ❌ No | ❌ No |
| < 5KB Tracker | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No |
| Bot Filtering | ✅ Yes | Partial | Partial | ✅ Yes |
| Annotated Spike Detection | ✅ Yes | ❌ No | ❌ No | ❌ No |

### The 3 Novel Layers

**Layer 1 — Killer UX: Mission Control Layout**  
Ditch the standard sidebar + charts everyone builds. Design it like a command center — dark theme, single screen, no scrolling:
- **Left column:** Live event feed ticking in like a terminal (Supabase Realtime)
- **Center:** Annotated line chart with auto-labelled spikes ("Reddit spike", "Bot cluster")
- **Right column:** AI Signal Cards in plain English
- **Bottom bar:** Funnel health — green/yellow/red per step

**Layer 2 — Technical Depth: Dual-Write Pipeline**  
Every incoming event does two writes simultaneously. Dashboard charts *never* query raw events — always O(hours) not O(events). This is the direct answer to the judge's DB optimization criterion.

**Layer 3 — Unexpected Feature: Session Narratives**  
Each session's event stream is reconstructed into a human-readable story via Claude API. Judges have never seen this in a student analytics project.

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Third-Party Website                       │
│   <script src="https://insightos.app/tracker.js"            │
│           data-site="SITE_ID"></script>                      │
└───────────────────┬─────────────────────────────────────────┘
                    │  navigator.sendBeacon() — non-blocking
                    ▼
┌─────────────────────────────────────────────────────────────┐
│              POST /api/collect  (Hono / Next.js)            │
│                                                              │
│  1. Bot detection (UA blocklist + velocity check)           │
│  2. Geo-IP lookup (ip-api.com)                              │
│  3. Session hash (SHA256 of IP + UA + Date)                 │
│                                                              │
│  Dual-Write ─────────────────────────────────────────────  │
│  ├── INSERT into events (raw, append-only)                  │
│  └── UPSERT into hourly_stats (increment counters)          │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│                    Supabase (Postgres)                       │
│                                                              │
│   events          hourly_stats       funnels                │
│   (raw, indexed)  (pre-aggregated)   (JSONB steps)          │
└───────────────────┬─────────────────────────────────────────┘
                    │  Supabase Realtime (WebSocket)
                    ▼
┌─────────────────────────────────────────────────────────────┐
│                Mission Control Dashboard                     │
│                                                              │
│  ┌──────────┐  ┌─────────────────────┐  ┌───────────────┐  │
│  │  Live    │  │  Annotated Chart    │  │  AI Signal    │  │
│  │  Feed    │  │  + Spike Labels     │  │  Cards        │  │
│  └──────────┘  └─────────────────────┘  └───────────────┘  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Funnel Health Bar  🟢 / 🟡 / 🔴  per step          │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
         Claude API (Signal Cards + Session Narratives + Heatmap Opinion)
```

### Architecture Principles

**Dual-Write on Ingest**  
Every event that hits `/api/collect` performs two DB operations in one transaction:
```sql
-- Write 1: Raw event (for heatmaps, session stitching, drill-down)
INSERT INTO events (...) VALUES (...);

-- Write 2: Pre-aggregated counter (for dashboard charts — always fast)
INSERT INTO hourly_stats (site_id, hour, pageviews)
VALUES ($1, DATE_TRUNC('hour', NOW()), 1)
ON CONFLICT (site_id, hour)
DO UPDATE SET pageviews = hourly_stats.pageviews + 1;
```

Dashboard charts query `hourly_stats` only. Load time is constant regardless of event volume.

**Privacy-First Session Identity**  
No cookies. No localStorage. Session identity is computed server-side:
```
session_hash = SHA256(client_ip + user_agent + YYYY-MM-DD)
```
No PII is stored. The hash is a one-way function — you cannot reverse it to get the IP.

**Bot Filtering Before Write**  
Before any DB write, every event passes through:
1. UA string checked against a 200-entry bot blocklist (Googlebot, bingbot, etc.)
2. Velocity check: >10 events/second from same IP → flagged `is_bot = true`
3. Flagged events are stored but excluded from all dashboard queries and funnel calculations

---

## 4. Database Schema

### `sites`
```sql
CREATE TABLE sites (
  id          TEXT PRIMARY KEY,           -- e.g. "abc123" (generated)
  owner_id    UUID REFERENCES auth.users,
  domain      TEXT NOT NULL,              -- e.g. "mystore.com"
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### `events` (append-only, never updated)
```sql
CREATE TABLE events (
  id            BIGSERIAL PRIMARY KEY,
  site_id       TEXT REFERENCES sites(id),
  type          TEXT NOT NULL,            -- 'pageview' | 'click' | 'custom'
  url           TEXT,
  referrer      TEXT,
  country       TEXT,                     -- 2-letter from Geo-IP
  x_pct         FLOAT,                   -- click X as % of viewport (heatmap)
  y_pct         FLOAT,                   -- click Y as % of viewport (heatmap)
  session_hash  TEXT,                    -- SHA256(IP+UA+Date)
  ua_raw        TEXT,
  is_bot        BOOLEAN DEFAULT FALSE,
  ts            TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes (critical for funnel + heatmap queries)
CREATE INDEX idx_events_site_ts     ON events(site_id, ts);
CREATE INDEX idx_events_session     ON events(session_hash);
CREATE INDEX idx_events_url         ON events(site_id, url);
```

### `hourly_stats` (pre-aggregated — dashboard reads this only)
```sql
CREATE TABLE hourly_stats (
  site_id           TEXT,
  hour              TIMESTAMPTZ,          -- DATE_TRUNC('hour', ts)
  pageviews         INT DEFAULT 0,
  clicks            INT DEFAULT 0,
  unique_sessions   INT DEFAULT 0,
  top_pages         JSONB DEFAULT '[]',  -- [{url, count}] top 5
  top_referrers     JSONB DEFAULT '[]',  -- [{referrer, count}] top 5
  top_countries     JSONB DEFAULT '[]',  -- [{country, count}] top 5
  PRIMARY KEY (site_id, hour)
);
```

### `funnels`
```sql
CREATE TABLE funnels (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       TEXT REFERENCES sites(id),
  name          TEXT NOT NULL,
  steps         JSONB NOT NULL,          -- ["/", "/pricing", "/checkout"]
  window_hours  INT DEFAULT 24,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

### Schema Flexibility Note for Judges
> The `top_pages`, `top_referrers`, and `top_countries` fields are JSONB. Adding a new aggregated dimension (e.g. `top_devices`) requires zero DB migrations — just update the upsert logic and read the new key in the frontend. This is the same principle as FormFlow's JSONB fields approach, applied to analytics aggregation.

---

## 5. Feature Specifications

### 5.1 The Collector (`tracker.js`)

**Constraint:** < 5KB gzipped, zero npm dependencies in output, must not affect Lighthouse score.

**What it captures:**
- `pageview` — fires on DOMContentLoaded (URL, referrer, screen size, language)
- `click` — fires on every click (X/Y as viewport percentages, target tag name)

**Implementation principles:**
- All network calls use `navigator.sendBeacon()` — non-blocking, fire-and-forget
- DOM listeners use `{ passive: true }` — never blocks scroll/interaction
- Non-critical setup wrapped in `requestIdleCallback()`
- Built with `esbuild --bundle --minify` → validates < 5KB with `--analyze`

**Snippet that site owners paste:**
```html
<script async src="https://insightos.app/tracker.js" data-site="SITE_ID"></script>
```

---

### 5.2 Mission Control Dashboard

Single-screen dark-themed command center. Layout:

```
┌─────────────────────────────────────────────────┐
│  TOP BAR: Active Now | Today's PVs | Top Country │
├──────────┬──────────────────────┬────────────────┤
│  LIVE    │  ANNOTATED CHART     │  AI SIGNAL     │
│  FEED    │  (pageviews/time)    │  CARDS         │
│  (ticks) │  with spike labels   │  3-5 insights  │
├──────────┴──────────────────────┴────────────────┤
│  FUNNEL BAR: Step 1 🟢 → Step 2 🟡 → Step 3 🔴  │
└─────────────────────────────────────────────────┘
```

**Live Event Feed**  
Powered by Supabase Realtime. New events push instantly via WebSocket and prepend to the feed list with a fade-in animation. Shows: event type icon + URL + country flag + time ago.

**Annotated Line Chart**  
Built with Recharts. Queries `hourly_stats` for selected time range (24h / 7d / 30d). Spike detection: if an hour's pageviews exceed 2x the rolling average, auto-label with source (detected from `top_referrers` for that hour).

**Tabs available:** Overview · Funnels · Heatmap · Sessions · Live Map

---

### 5.3 AI Signal Layer

One Claude API call per dashboard load. Input is the last 24h of `hourly_stats` + current funnel completion rates. Output is 3–5 structured insight cards.

**Prompt structure:**
```
You are an analytics expert. Given this data for the last 24 hours:
- Hourly pageviews: [...]
- Top pages: [...]
- Top referrers: [...]
- Funnel completion rates: [...]

Return ONLY a JSON array of 3-5 insight objects:
[{ "title": "...", "insight": "...", "severity": "info|warning|critical" }]

Focus on anomalies, drop-offs, and actionable recommendations.
```

**Example output cards:**
- 🔴 CRITICAL: "/pricing got 3x traffic today but checkout conversions dropped 40%. Something broke in the funnel between 2pm–4pm."
- 🟡 WARNING: "89% of mobile users drop at the signup form. Desktop users don't. The form may be broken on mobile."
- 🔵 INFO: "Traffic spike from Reddit at 3pm — 340 users in 20 minutes. Your post is going viral."

**Rendered as:** Color-coded cards in the right column. Severity maps to red/yellow/blue border.

---

### 5.4 Session Narratives

Each session's ordered events are reconstructed into a human-readable story.

**How it works:**
1. Query `events` WHERE `session_hash = X` ORDER BY `ts ASC`
2. Format as a plain text journey: `"Landed on / via Instagram → Scrolled → Clicked Pricing → Dropped at signup"`
3. Pass to Claude with device + country context
4. Render as a 2–3 sentence narrative in the Sessions tab

**Example narrative:**
> "A mobile user from India arrived via Instagram at 4:32pm and spent 1m 42s on the site. They navigated from the homepage to the pricing page and clicked 'Start Free Trial' but abandoned at the third field of the signup form. This session matches the mobile drop-off pattern seen in 89% of similar sessions today."

---

### 5.5 Funnel Engine

Admin defines a funnel from the dashboard UI:

```json
{
  "name": "Purchase Flow",
  "steps": ["/", "/pricing", "/checkout", "/thank-you"],
  "window_hours": 24
}
```

**Query logic:**
```sql
-- Step 1: Sessions that hit step 1
WITH step1 AS (
  SELECT DISTINCT session_hash FROM events
  WHERE site_id = $1 AND url LIKE '%/pricing%'
    AND ts > NOW() - INTERVAL '24 hours'
    AND is_bot = FALSE
),
-- Step 2: Of those, who also hit step 2
step2 AS (
  SELECT DISTINCT e.session_hash FROM events e
  INNER JOIN step1 ON e.session_hash = step1.session_hash
  WHERE e.url LIKE '%/checkout%'
)
-- Count at each step → drop-off % = (prev - current) / prev
```

**Rendered as:** Horizontal stepped bar chart with drop-off % badges between each step. Color: green > 60%, yellow 30–60%, red < 30%.

---

### 5.6 Heatmap with AI Opinion

**Data collection:** Every click stores `x_pct` and `y_pct` as percentages of viewport dimensions (not raw pixels — screen-size agnostic).

**Rendering:**
1. Fetch screenshot of tracked URL via backend (puppeteer or screenshotone.com API)
2. Draw HTML5 Canvas overlay at same dimensions
3. For each click event: draw radial gradient circle at `(x_pct * width, y_pct * height)`
4. Blend with `globalCompositeOperation = 'screen'` — dense areas glow red, sparse areas cool blue

**AI Opinion (the differentiator):**
After rendering, call Claude with:
```
"Here are click coordinates (as %) on ${url}. 
 Viewport: 1440x900. 
 CTA button known to be at approximately (65%, 72%).
 Click distribution: ${summary}.
 Analyze and give one actionable recommendation."
```
Result renders as a callout card below the heatmap.

---

### 5.7 Bot Filtering

Three-layer system applied before every DB write:

**Layer 1 — UA Blocklist**  
Static list of 200+ known bot user-agent strings (Googlebot, bingbot, Slurp, DuckDuckBot, Baiduspider, etc.). If `ua_raw` contains any entry → `is_bot = true`.

**Layer 2 — Velocity Check**  
Track request count per IP per 10-second window in memory (Map with TTL). If > 10 events in 10s → `is_bot = true`. Reset window on expiry.

**Layer 3 — Referrer Spam**  
Static list of known spam referrer domains. If `referrer` matches → `is_bot = true`.

Flagged events are stored (`is_bot = true`) but excluded from all dashboard queries with `WHERE is_bot = FALSE`. This lets you audit bot traffic separately — which is itself a feature you can demo.

---

### 5.8 Live Geo Map

Every pageview event triggers a server-side Geo-IP lookup (ip-api.com, batched per 100ms to stay under rate limit). Lat/long pushed via Supabase Realtime to the dashboard.

**Rendered with Leaflet.js:** World map with pulsing dots at each active user's location. Dot fades out after 30 seconds. Dark map tile theme to match Mission Control aesthetic.

---

## 6. API Contract

### `POST /api/collect`
Receives events from tracker.js. No authentication required (public endpoint).

**Request body:**
```json
{
  "site_id": "abc123",
  "type": "pageview",
  "url": "https://mystore.com/pricing",
  "referrer": "https://reddit.com/r/startup",
  "x_pct": null,
  "y_pct": null,
  "screen_w": 1440,
  "screen_h": 900,
  "ts": 1712150400000
}
```

**Response:** `204 No Content` (sendBeacon doesn't read the response)

**Headers required:**
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: POST, OPTIONS
```

### `GET /api/stats?site_id=X&range=24h`
Returns pre-aggregated data from `hourly_stats`. Dashboard primary data source.

### `GET /api/events/live?site_id=X`
Server-Sent Events stream OR Supabase Realtime subscription. Pushes new events to Live Feed.

### `GET /api/sessions?site_id=X&limit=20`
Returns last 20 sessions with their ordered event list for Session Narratives.

### `POST /api/funnels`
Creates a new funnel definition.

### `GET /api/funnels/:id/analysis?site_id=X`
Returns step-by-step completion counts for funnel visualization.

### `GET /api/heatmap?site_id=X&url=...`
Returns click events with `x_pct` + `y_pct` for the given URL (last 7 days).

---

## 7. The Tracker Script

### Full source (pre-minification, ~60 lines)

```javascript
(function () {
  'use strict';

  const siteId = document.currentScript?.dataset?.site;
  if (!siteId) return;

  const endpoint = 'https://insightos.app/api/collect';

  function send(payload) {
    if (!navigator.sendBeacon) return; // fallback: drop silently
    navigator.sendBeacon(
      endpoint,
      JSON.stringify({
        site_id: siteId,
        url: location.href,
        referrer: document.referrer,
        screen_w: screen.width,
        screen_h: screen.height,
        ts: Date.now(),
        ...payload,
      })
    );
  }

  // Pageview — fire immediately on load
  function trackPageview() {
    send({ type: 'pageview' });
  }

  // Click tracking — viewport percentages (screen-size agnostic)
  function trackClick(e) {
    send({
      type: 'click',
      x_pct: parseFloat(((e.clientX / window.innerWidth) * 100).toFixed(2)),
      y_pct: parseFloat(((e.clientY / window.innerHeight) * 100).toFixed(2)),
      target: e.target.tagName,
    });
  }

  // Defer non-critical setup
  function init() {
    document.addEventListener('click', trackClick, { passive: true });
  }

  if (document.readyState === 'complete') {
    trackPageview();
    requestIdleCallback ? requestIdleCallback(init) : init();
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      trackPageview();
      requestIdleCallback ? requestIdleCallback(init) : init();
    });
  }
})();
```

### Build command
```bash
esbuild tracker.js --bundle --minify --outfile=public/tracker.js
# Target: < 5KB. Check with: wc -c public/tracker.js
```

---

## 8. AI Layer Design

### Signal Cards — Claude API call
```javascript
const stats = await getHourlyStats(siteId, '24h');
const funnelRates = await getFunnelRates(siteId);

const response = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: `You are an expert web analyst. Analyze this 24h data and return ONLY a JSON array.
      
      Hourly pageviews: ${JSON.stringify(stats.hourly)}
      Top pages: ${JSON.stringify(stats.top_pages)}
      Top referrers: ${JSON.stringify(stats.top_referrers)}
      Funnel rates: ${JSON.stringify(funnelRates)}
      
      Return: [{ "title": "...", "insight": "...", "severity": "info|warning|critical" }]
      3-5 items. No markdown. No preamble. Just the JSON array.`
    }]
  })
});
```

### Session Narrative — Claude API call
```javascript
const events = await getSessionEvents(sessionHash);
const journey = events.map(e =>
  e.type === 'pageview' ? `Visited ${e.url}` : `Clicked at (${e.x_pct}%, ${e.y_pct}%)`
).join(' → ');

// Pass journey + device + country → Claude returns 2-3 sentence narrative
```

---

## 9. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 14 (App Router) | API routes + SSR in one repo |
| Styling | Tailwind CSS | Dark theme Mission Control fast |
| Charts | Recharts | Composable, easy annotation layer |
| Map | Leaflet.js | Free, lightweight, dark tile support |
| Heatmap | Canvas API (vanilla) | No library needed, full control |
| Database | Supabase (Postgres) | Free tier, Realtime built-in, Auth |
| Realtime | Supabase Realtime | WebSocket out of the box, no setup |
| AI | Anthropic Claude API | Signal cards + narratives + heatmap opinion |
| Geo-IP | ip-api.com | Free, no key, 45 req/min |
| Tracker build | esbuild | Sub-second builds, tiny output |
| Deploy | Vercel | Free tier, monorepo support |
| Screenshot | Screenshotone.com API | Free tier, for heatmap background |

---

## 10. Judging Criteria & How We Win

### Criterion 1: Performance — Does your tracking script slow down the host site?

**Our answer:**
- `navigator.sendBeacon()` — fire-and-forget, main thread never waits
- `{ passive: true }` on all event listeners — zero scroll jank
- `requestIdleCallback()` for setup — deferred until browser is idle
- `async` script tag — never blocks HTML parse
- `esbuild --minify` output — validate < 5KB with `wc -c`

**Demo move:** Open Lighthouse on demo site with tracker installed. Show Performance score ≥ 95.

### Criterion 2: Database Optimization — How do you aggregate 10,000+ events without making the UI hang?

**Our answer:**
> "The dashboard never queries raw events for charts. Every ingest dual-writes to a pre-aggregated `hourly_stats` table using `INSERT ... ON CONFLICT DO UPDATE SET pageviews = pageviews + 1`. Chart queries are always O(hours_in_range), not O(total_events). We could have 10 million raw events and the dashboard loads in the same time as with 100."

**This is the architectural decision that wins the scorecard.** Say it clearly in the demo.

### Bonus Points We're Targeting
- AI Signal Layer — no one else will have this
- Session Narratives — genuinely novel in student projects
- Heatmap with AI Opinion — Hotjar + GPT in 12 hours
- Mission Control layout — looks nothing like anyone else's submission
- Bot filtering with audit trail — shows maturity

---

## 11. 12-Hour Execution Plan

> Full breakdown is in `ROADMAP.md`. Summary below.

| Phase | Hours | Person A | Person B | Person C |
|---|---|---|---|---|
| **0: Setup** | 0–1 | Repo + Supabase schema | Same | Same |
| **1: Core** | 1–4 | Tracker.js + `/api/collect` | Ingestion pipeline + dual-write | Dashboard shell + auth |
| **2: Features** | 4–8 | Bot filtering + Geo-IP + Live Feed | Funnel engine + Stats API | Charts + Signal Cards + Heatmap |
| **3: Polish** | 8–11 | Session Narratives | Live Geo Map | UI polish + demo site |
| **4: Ship** | 11–12 | All: Deploy + demo rehearsal | | |

---

## 12. Demo Script

**Opening line (say this to the judges):**
> "Every analytics tool tells you what happened. Insight-OS tells you what it means. We built a dual-write ingestion pipeline so the dashboard is always fast regardless of event volume, a sub-5KB tracker that doesn't touch Lighthouse scores, and a Signal Layer that turns raw numbers into plain-English decisions. It's not a Umami clone. It's what analytics looks like when you treat data as a story."

**Demo flow (5 minutes):**
1. Show demo site with tracker installed → open Lighthouse → Performance score ≥ 95
2. Click around the demo site → switch to Mission Control → watch Live Feed tick in real-time
3. Show annotated chart with spike label
4. Open Signal Cards tab → read one AI insight aloud
5. Show Funnel — point to a drop-off → explain the DB query approach
6. Open Sessions tab → read one Session Narrative aloud
7. Show Heatmap with AI Opinion card underneath
8. Show Live Geo Map with pulsing dots
9. Show Bot Filtering panel — "these are excluded from all your real numbers"
10. **Close:** "The schema is designed so adding any new event dimension requires zero migrations. Just update the upsert."

---

*Insight-OS — Built in 12 hours. Designed to win.*
