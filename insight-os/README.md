# Insight-OS

> **Every analytics tool tells you what happened. Insight-OS tells you what it means.**

A privacy-first, AI-powered analytics platform built in 12 hours for Recode Hack 2026.

---

## Architecture Decisions

### Dual-Write Ingestion Pipeline
Every event hitting `/api/collect` performs a simultaneous DB transaction using `prisma.$transaction()`:
1. **Raw insert** → `Event` model (append-only, never updated) — used for heatmaps, session stitching, and drill-down queries.
2. **Upsert** → `HourlyStat` model (pre-aggregated counters) — used by all dashboard charts.

This means dashboard chart queries are always `O(hours_in_range)`, not `O(total_events)`. With 10 million raw events, the chart loads in the same time as with 100.

### Privacy-First Session Identity
No cookies. No localStorage. Session identity is computed server-side:
```
session_hash = SHA256(client_ip + user_agent + YYYY-MM-DD)
```
No PII is ever stored. The hash is one-way — you cannot reverse it to recover an IP address.

### Bot Filtering Before Write
Every event passes through a 3-layer filter before any DB write:
1. UA string matched against a 200+ entry bot blocklist
2. Velocity check: >10 events/10s from the same IP → flagged `is_bot = true` (Tracked reliably via Upstash Redis)
3. Referrer spam domain list check

Flagged events are stored (not dropped) and excluded from all queries with `WHERE isBot = false`, enabling a bot audit trail as a first-class feature.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router) |
| Styling | Tailwind CSS |
| Database | Neon PostgreSQL via Prisma |
| Auth     | NextAuth.js (JWT) |
| Realtime | Redis (Upstash) + SSE |
| AI | Google Gemini API |
| Charts | Recharts |
| Map | Leaflet.js |
| Tracker build | esbuild |
| Deploy | Vercel |

---

## Getting Started

```bash
npm install
cp .env.local.example .env.local  # fill in your keys
npx prisma db push
npm run dev
```

Fill in `.env.local` with your database URL, Redis credentials, NextAuth secret, and Google Gemini API key.
