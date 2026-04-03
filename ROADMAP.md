# INSIGHT-OS — 12-Hour Sprint Roadmap
### Live Tracker · Update after each task is completed

**Sprint Start:** April 3, 2026  
**Team:** Person A (Tracker + API) · Person B (Backend + Data) · Person C (Frontend + AI)  
**Legend:** ⬜ Not started · 🔄 In progress · ✅ Done · 🚫 Blocked

---

## Overall Progress

| Phase | Name | Duration | Status |
|---|---|---|---|
| Phase 0 | Foundation & Setup | Hour 0–1 | ✅ |
| Phase 1 | Core Systems | Hour 1–4 | ✅ (A+B) · ⬜ (C) |
| Phase 2 | Features | Hour 4–8 | ✅ (A+B) · ⬜ (C) |
| Phase 3 | The Wow Factors | Hour 8–11 | ✅ (A+B) · ⬜ (C) |
| Phase 4 | Ship & Demo | Hour 11–12 | ⬜ |

---

## Phase 0 — Foundation & Setup
**Duration:** Hour 0 → Hour 1  
**All 3 people work together on this. Do not split yet.**

| # | Task | Owner | Status | Notes |
|---|---|---|---|---|
| 0.1 | Create GitHub repo (monorepo), initialise Next.js 14 with App Router | All | ⬜ | `npx create-next-app@latest insight-os` |
| 0.2 | Install dependencies: Tailwind, Recharts, Leaflet, esbuild, Prisma, Upstash, NextAuth | All | ⬜ | One person runs, others watch for errors |
| 0.3 | Create Neon Postgres & Upstash Redis projects, copy URIs into `.env.local` | All | ⬜ | Free tier at neon.tech & upstash.com |
| 0.4 | Initialize Prisma, create schema, run npx prisma db push (sites, events, hourly_stats, funnels) | All | ⬜ | Schema defined in PRD Section 4 |
| 0.5 | Create indexes on `events(site_id, ts)`, `events(session_hash)`, `events(site_id, url)` | All | ⬜ | Critical for funnel query performance |
| 0.6 | Set up Vercel project linked to GitHub repo, confirm auto-deploy works | All | ⬜ | vercel.com → import repo |
| 0.7 | Agree on branch strategy: `main` = production, each person works on feature branch | All | ⬜ | Person A→ `feat/tracker`, B→ `feat/backend`, C→ `feat/dashboard` |
| 0.8 | Add Google Gemini API key to `.env.local` and Vercel environment variables | All | ⬜ | `GEMINI_API_KEY=sk-...` |

**Phase 0 Exit Criteria:** Neon DB & Upstash exist, Next.js runs locally, Vercel deploys successfully.

---

## Phase 1 — Core Systems
**Duration:** Hour 1 → Hour 4  
**Split now. All 3 work simultaneously.**

---

### Phase 1 — Person A: Tracker Script + Collect Endpoint

| # | Task | Owner | Status | Notes |
|---|---|---|---|---|
| 1A.1 | Create `/tracker/tracker.src.js` — vanilla JS source file | A | ✅ | Copy base from PRD Section 7 |
| 1A.2 | Implement `trackPageview()` using `navigator.sendBeacon()` | A | ✅ | Fires on DOMContentLoaded |
| 1A.3 | Implement `trackClick()` with `x_pct` and `y_pct` as viewport percentages | A | ✅ | `e.clientX / window.innerWidth * 100` |
| 1A.4 | Wrap all setup in `requestIdleCallback()` | A | ✅ | Falls back to direct call if not supported |
| 1A.5 | Add esbuild build script in `package.json` → output to `/public/tracker.js` | A | ✅ | `esbuild tracker.src.js --bundle --minify` |
| 1A.6 | Build and verify output is < 5KB: `wc -c public/tracker.js` | A | ✅ | Target: under 5120 bytes |
| 1A.7 | Create `POST /api/collect/route.ts` — receives beacon payload | A | ✅ | Returns 204, no body |
| 1A.8 | Add CORS headers to `/api/collect`: `Access-Control-Allow-Origin: *` | A | ✅ | Required for cross-origin sendBeacon |
| 1A.9 | Parse + validate incoming event payload (site_id, type, url, referrer, x_pct, y_pct, ts) | A | ✅ | Zod schema validation |
| 1A.10 | Test end-to-end: open a browser, paste snippet pointing at localhost, confirm event hits API | A | ✅ | Use curl or browser console |

---

### Phase 1 — Person B: Ingestion Pipeline + Dual-Write

| # | Task | Owner | Status | Notes |
|---|---|---|---|---|
| 1B.1 | Set up Prisma client (`/lib/prisma.ts`) + Upstash Redis (`/lib/redis.ts`) | B | ✅ | Export singleton instances |
| 1B.2 | Implement `insertEvent()` function — writes to `events` table | B | ✅ | All columns from parsed payload |
| 1B.3 | Implement `upsertHourlyStats()` — increments `pageviews` or `clicks` counter | B | ✅ | `ON CONFLICT (site_id, hour) DO UPDATE SET pageviews = hourly_stats.pageviews + 1` |
| 1B.4 | Wire both writes into `/api/collect` as a parallel `Promise.all()` — not sequential | B | ✅ | Both writes happen simultaneously |
| 1B.5 | Implement session hash: `SHA256(ip + userAgent + YYYY-MM-DD)` on server | B | ✅ | Use Node.js `crypto.createHash('sha256')` |
| 1B.6 | Implement Geo-IP lookup: call `http://ip-api.com/json/${ip}` → extract country | B | ✅ | Cache per IP per hour in memory Map to avoid rate limit |
| 1B.7 | Attach `country` and `session_hash` to event before writing | B | ✅ | |
| 1B.8 | Create `GET /api/stats` route — queries `hourly_stats` for given `site_id` + `range` | B | ✅ | Params: `?site_id=X&range=24h|7d|30d` |
| 1B.9 | Create `GET /api/events/recent` route — last 50 events for Live Feed | B | ✅ | Ordered by ts DESC, is_bot = FALSE |
| 1B.10 | Test dual-write: send 5 test events, confirm both rows exist in Prisma Studio | B | ✅ | Run npx prisma studio |

---

### Phase 1 — Person C: Dashboard Shell + Auth ("Reconstruction" Theme)

**Design System (from Person C PRD):**
- **Background:** Deep obsidian (`#000000`) + rich crimson (`#2D0505`) radial gradients
- **Accents:** Glowing red concentric pulse rings
- **Header:** Minimalist nav with glassmorphic badges for "Next.js" and "TypeScript"
- **Phase Tracker:** Vertical sidebar — Phase 1 (Active/Glowing Red), Phase 2 (Active), Final Phase (Locked/Frosted Glass)
- **Locked State:** `backdrop-filter: blur(20px)` over dashboard, faint chart/map outlines behind frost
- **Typography:** High-contrast, razor-sharp white sans-serif

| # | Task | Owner | Status | Notes |
|---|---|---|---|---|
| 1C.1 | Set up NextAuth Credentials provider | C | ⬜ | `/app/api/auth/[...nextauth]/route.ts` |
| 1C.2 | Create `/login` page — dark obsidian theme, crimson accent button | C | ⬜ | Match Reconstruction theme |
| 1C.3 | Protect `/dashboard` route — redirect to `/login` if no session | C | ⬜ | Middleware or layout check |
| 1C.4 | Create Mission Control layout — obsidian bg, crimson radial gradient, 3-col grid | C | ⬜ | Left: feed, Center: chart, Right: signals |
| 1C.5 | Set up Tailwind dark theme: obsidian `#000`, crimson `#2D0505`, accent red pulse | C | ⬜ | CSS vars for Reconstruction palette |
| 1C.6 | Top bar component: Active Now · Today's PVs · Top Country with glassmorphic badges | C | ⬜ | Placeholder data initially |
| 1C.7 | Site registration flow — admin enters domain, gets site_id | C | ⬜ | Writes to `sites` table |
| 1C.8 | Bottom Funnel Health Bar (static placeholder) with 🟢🟡🔴 indicators | C | ⬜ | |
| 1C.9 | Wire dashboard to `GET /api/stats` — loading skeletons → data states | C | ⬜ | Crimson-tinted skeleton pulse |
| 1C.10 | Tab navigation: Overview · Funnels · Heatmap · Sessions · Live Map | C | ⬜ | Glassmorphic tab pills |
| 1C.11 | **Locked Dashboard State** — frosted glass blur over dashboard with faint chart outlines | C | ⬜ | `backdrop-filter: blur(20px)`, red glow map behind frost |
| 1C.12 | **Phase Tracker sidebar** — Phase 1 (Glowing Red), Phase 2, Final Phase (Locked/Frosted) | C | ⬜ | Vertical sidebar or bottom dock |

**Phase 1 Exit Criteria:** Events flow from browser → API → Neon DB. Dashboard shell renders with auth. Stats API returns data.

---

## Phase 2 — Features
**Duration:** Hour 4 → Hour 8  
**Hardest phase. Heads down.**

---

### Phase 2 — Person A: Bot Filtering + Live Feed

| # | Task | Owner | Status | Notes |
|---|---|---|---|---|
| 2A.1 | Create `/lib/bot-detection.ts` utility | A | ✅ | Returns `{ isBot: boolean, reason: string }` |
| 2A.2 | Add UA blocklist — top 50 known bots (Googlebot, bingbot, Slurp, Baiduspider, etc.) | A | ✅ | Static string array, case-insensitive check |
| 2A.3 | Add velocity check — track requests per IP using Redis (Upstash) with 10s TTL | A | ✅ | If > 10 events in 10s → isBot = true |
| 2A.4 | Add referrer spam list — top 20 known spam referrer domains | A | ✅ | Static string array |
| 2A.5 | Integrate bot detection into `/api/collect` — set `is_bot` field before DB write | A | ✅ | Flagged not dropped — stored for audit |
| 2A.6 | Create demo test site HTML page (`/demo/index.html`) — minimal 4-page site with tracker snippet | A | ✅ | Pages: /, /pricing, /checkout, /thank-you |
| 2A.7 | Deploy demo test site as Vercel static deployment (separate from main app) | A | ⬜ | Or host as `/public/demo/` subfolder |
| 2A.8 | Set up Redis Pub/Sub + Server-Sent Events (SSE) for the Live Feed | A | ✅ | Filter by `site_id` |
| 2A.9 | Create Live Event Feed component — new events prepend with fade-in animation | A | ⬜ | Show: icon + url + country flag + time ago |
| 2A.10 | Create Bot Audit panel — shows flagged events with reason (UA/velocity/referrer) | A | ⬜ | In a modal or separate tab |

---

### Phase 2 — Person B: Funnel Engine + Sessions API

| # | Task | Owner | Status | Notes |
|---|---|---|---|---|
| 2B.1 | Create `POST /api/funnels` route — saves funnel definition to `funnels` table | B | ✅ | Validates steps is array of URL paths |
| 2B.2 | Create `GET /api/funnels` route — lists all funnels for a site | B | ✅ | |
| 2B.3 | Implement funnel analysis query — step-by-step session count (see PRD Section 5.5) | B | ✅ | Sequential CTEs, one per funnel step |
| 2B.4 | Create `GET /api/funnels/:id/analysis` route — returns counts per step | B | ✅ | Response: `[{ step, url, sessions, drop_pct }]` |
| 2B.5 | Update `upsertHourlyStats()` to also maintain `top_pages`, `top_referrers`, `top_countries` JSONB fields | B | ✅ | Read-modify-write: fetch current JSONB, update, upsert |
| 2B.6 | Create `GET /api/sessions` route — returns last 20 sessions with ordered events | B | ✅ | Group by `session_hash`, ORDER BY first event ts DESC |
| 2B.7 | Create `GET /api/heatmap` route — returns click events with x_pct + y_pct for a URL | B | ✅ | Filter: type=click, is_bot=false, url LIKE param |
| 2B.8 | Add rate limiting to `/api/collect` — max 100 req/s per site_id using token bucket | B | ✅ | In-memory, resets per second |
| 2B.9 | Write seed script — generates 500 fake events across 4 pages for demo data | B | ✅ | Distribute across 24h, vary referrers + countries |
| 2B.10 | Run seed script against Neon DB, verify `hourly_stats` aggregates correctly | B | ✅ | |

---

### Phase 2 — Person C: Charts + Signal Cards + Heatmap UI

**Visual Requirements (from Person C PRD):**
- Charts styled to match Dark Crimson theme (Tremor or Recharts with custom theme)
- Heatmap uses `<canvas>` with `globalCompositeOperation = 'screen'` for thermal glow
- Signal Cards: skeleton loading → fade-in with severity-colored borders
- Hot Zone colors: glowing red/orange hues on dark background

| # | Task | Owner | Status | Notes |
|---|---|---|---|---|
| 2C.1 | Build Annotated Line Chart (Recharts) — crimson theme, pageviews/hour | C | ⬜ | Data from `GET /api/stats` |
| 2C.2 | Spike detection — `<ReferenceLine>` labels for hours > 2x rolling avg | C | ⬜ | Client-side computation |
| 2C.3 | Time range selector — 24h / 7d / 30d glassmorphic buttons | C | ⬜ | Refetch on change |
| 2C.4 | Top Pages bar chart (Recharts) — horizontal, top 5 URLs | C | ⬜ | From `top_pages` JSONB |
| 2C.5 | Top Referrers bar chart (Recharts) | C | ⬜ | |
| 2C.6 | Wire top bar to real API data (Active Now, Today PVs, Top Country) | C | ⬜ | Active Now = sessions in last 5 min |
| 2C.7 | AI Signal Cards component — XAI-powered with confidence badges | C | ⬜ | Skeleton → fade-in, calls `POST /api/signals` |
| 2C.8 | ~~Create `POST /api/signals` route~~ | ~~C~~ | ✅ | **Already built (Person A Phase 3) with XAI** |
| 2C.9 | Style Signal Cards: severity borders + XAI reasoning + confidence % | C | ⬜ | Red=critical, Yellow=warning, Blue=info |
| 2C.10 | **Heatmap Canvas** — `<canvas>` layered over screenshot, dark bg | C | ⬜ | screenshotone.com or placeholder image |
| 2C.11 | **Canvas Hot Zones** — radial gradient circles at x_pct/y_pct | C | ⬜ | `globalCompositeOperation = 'screen'`, red/orange glow |
| 2C.12 | Funnel visualization — stepped bars with drop-off % badges | C | ⬜ | Green>60%, Yellow 30-60%, Red<30% |

**Phase 2 Exit Criteria:** Events are bot-filtered. Funnel analysis works. Charts load real data. Signal Cards show AI insights. Heatmap renders clicks.

---

## Phase 3 — The Wow Factors
**Duration:** Hour 8 → Hour 11  
**These are your differentiators. Don't skip them.**

---

### Phase 3 — Person A: Session Narratives

| # | Task | Owner | Status | Notes |
|---|---|---|---|---|
| 3A.1 | Create `POST /api/narratives` route — takes session_hash, fetches events, calls Gemini | A | ⬜ | See PRD Section 8 for prompt template |
| 3A.2 | Format event sequence as plain-text journey string for Gemini prompt | A | ⬜ | "Visited / → Clicked Pricing → Visited /checkout → Dropped" |
| 3A.3 | Include device (mobile/desktop from UA) and country in Gemini prompt | A | ⬜ | Parse UA server-side |
| 3A.4 | Build Sessions tab UI — scrollable list of sessions with device icon + country flag + time | A | ⬜ | Click a session → expand narrative |
| 3A.5 | On session click: fetch narrative from API, show loading state, render 2-3 sentence story | A | ⬜ | Lazy-fetch, not pre-generated |
| 3A.6 | Polish: add "Most interesting session" highlight — longest session that dropped at final funnel step | A | ⬜ | The demo money shot |

---

### Phase 3 — Person B: Live Geo Map

| # | Task | Owner | Status | Notes |
|---|---|---|---|---|
| 3B.1 | Install Leaflet.js + react-leaflet | B | ⬜ | `npm i leaflet react-leaflet` |
| 3B.2 | Set up dark tile layer (CartoDB dark matter tiles — free, no key) | B | ⬜ | `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png` |
| 3B.3 | Fetch lat/long from Geo-IP lookup — store on event or look up on-demand | B | ⬜ | ip-api.com returns `lat` and `lon` fields |
| 3B.4 | Create `GET /api/active-locations` — returns lat/long for sessions active in last 5 minutes | B | ⬜ | Query events WHERE ts > NOW() - INTERVAL '5 minutes' |
| 3B.5 | Build Live Geo Map component — Leaflet map with pulsing circle markers | B | ⬜ | CSS animation: `@keyframes pulse` on circle marker |
| 3B.6 | Poll `GET /api/active-locations` every 10 seconds — update markers | B | ⬜ | Or use Redis Pub/Sub push via SSE |
| 3B.7 | Dots fade out after 30 seconds of inactivity | B | ⬜ | Track `lastSeen` per session in component state |

---

### Phase 3 — Person C: UI Polish + Heatmap AI + "Reconstruction" Landing

**Visual Requirements (from Person C PRD):**
- **Animations:** Framer Motion for layout transitions. Content "floats" in weightlessly.
- **Icons:** Lucide-React for all icons (lightweight, Lighthouse-friendly)
- **Empty States:** "Waiting for events..." with animated red pulse on obsidian bg
- **Heatmap Overlay:** Semi-transparent Hot Zones in glowing red/orange
- **Landing Page:** Futuristic "Anti-Gravity" hero with floating crystalline node, orbiting code snippets, dramatic red rim lighting

| # | Task | Owner | Status | Notes |
|---|---|---|---|---|
| 3C.1 | **Heatmap XAI Opinion** — call Gemini with click distribution stats | C | ⬜ | `POST /api/heatmap/opinion` ✅ already built |
| 3C.2 | Render XAI Opinion as callout card below canvas — confidence + reasoning | C | ⬜ | "76% of clicks are top-left. Your CTA is being ignored." |
| 3C.3 | Funnel creation UI — dynamic form (add/remove URL steps) | C | ⬜ | POST to /api/funnels |
| 3C.4 | Wire Funnel Health Bar to real analysis data | C | ⬜ | Green/yellow/red per step |
| 3C.5 | **Framer Motion transitions** — subtle float/fade between tabs | C | ⬜ | Layout wrapper keeps bg gradient consistent |
| 3C.6 | **Live Feed Polish** — Lucide icons (👁 pageview, 🖱 click), auto-scroll | C | ⬜ | Lean frontend for Lighthouse ≥ 95 |
| 3C.7 | **Empty states** — "Waiting for events..." with animated crimson pulse | C | ⬜ | On obsidian bg |
| 3C.8 | Mobile/tablet responsiveness pass | C | ⬜ | Not scored but shows polish |
| 3C.9 | **"Reconstruction" Hero Landing Page** | C | ⬜ | See below |
| 3C.10 | **Session Narratives UI** — scrollable list, click → expand XAI narrative | C | ⬜ | Shows intent + confidence + reasoning |

**3C.9 Landing Page Spec (from Person C PRD):**
- Floating, 3D "Anti-Gravity" crystalline node = the Collector Script
- Orbiting TypeScript/Next.js code snippets (weightless animation)
- High-contrast white sans-serif typography
- Dramatic red rim lighting on a bezel-less floating tablet
- Data viz previews using Recharts styled to Dark Crimson theme
- Use `Next/Image` for bg stability, keep snippet < 5KB

**Phase 3 Exit Criteria:** Session Narratives work end-to-end. Live Geo Map shows pulsing dots. Heatmap AI Opinion renders. Landing page wows judges. UI feels polished.

---

## Phase 4 — Ship & Demo Prep
**Duration:** Hour 11 → Hour 12  
**All 3 together.**

| # | Task | Owner | Status | Notes |
|---|---|---|---|---|
| 4.1 | Final Vercel deploy — confirm all env vars set in production | All | ⬜ | Check: DATABASE_URL, REDIS_URL, GEMINI_API_KEY |
| 4.2 | Run tracker.js on demo site in production — generate real events | All | ⬜ | Click around all 4 pages multiple times |
| 4.3 | Verify Signal Cards load in production (real Gemini API call) | All | ⬜ | |
| 4.4 | Screenshot/screen-record demo flow for backup | All | ⬜ | In case of live demo technical issues |
| 4.5 | Run Lighthouse on demo site with tracker installed — target ≥ 95 performance | A | ⬜ | Chrome DevTools → Lighthouse tab |
| 4.6 | Write README.md — architecture decision section (dual-write, privacy model, bot filtering) | B | ⬜ | 3-4 paragraphs. Judges may read this. |
| 4.7 | Rehearse demo script from PRD Section 12 — time it to 5 minutes | C | ⬜ | One person presents, others support |
| 4.8 | Prepare opening line: "Every analytics tool tells you what happened. Insight-OS tells you what it means." | All | ⬜ | Say it with confidence. |

**Phase 4 Exit Criteria:** App is live on Vercel. Demo flows without errors. Lighthouse ≥ 95. README explains architecture.

---

## Completion Summary

| System | Feature | Status |
|---|---|---|
| **Tracker** | < 5KB JS snippet | ⬜ |
| **Tracker** | sendBeacon non-blocking | ⬜ |
| **Tracker** | Click + Pageview capture | ⬜ |
| **Ingestion** | Dual-write pipeline | ⬜ |
| **Ingestion** | Session hash (privacy-first) | ⬜ |
| **Ingestion** | Geo-IP lookup | ⬜ |
| **Ingestion** | Bot filtering (3 layers) | ⬜ |
| **Dashboard** | Mission Control layout | ⬜ |
| **Dashboard** | Annotated line chart with spike labels | ⬜ |
| **Dashboard** | Live event feed (Redis+SSE) | ⬜ |
| **Dashboard** | AI Signal Cards | ⬜ |
| **Dashboard** | Funnel engine + drop-off chart | ⬜ |
| **Dashboard** | Heatmap canvas | ⬜ |
| **Dashboard** | Heatmap AI Opinion | ⬜ |
| **Dashboard** | Session Narratives | ⬜ |
| **Dashboard** | Live Geo Map | ⬜ |
| **Deploy** | Vercel production deploy | ⬜ |
| **Deploy** | Demo test site live | ⬜ |
| **Demo** | Lighthouse ≥ 95 confirmed | ⬜ |
| **Demo** | README with architecture decisions | ⬜ |

---

*To update this roadmap: tell me which task numbers are done and I'll mark them ✅ and update the phase status.*
