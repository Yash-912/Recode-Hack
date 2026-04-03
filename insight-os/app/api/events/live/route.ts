import { NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

// Required to prevent Next.js from aggressively caching the SSE stream
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get('site_id');

  if (!siteId) {
    return new NextResponse('Missing site_id', { status: 400 });
  }

  // ─── Task 2A.8: Server-Sent Events (SSE) Stream ──────────
  // Instead of polling the Postgres DB (which kills optimization),
  // we poll the transient Redis List which is O(1) lightning fast.
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: any) => {
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // ─── BROWSER FIX ───────────────────────────────────────
      // Send an initial CSS-style comment ping to force the browser 
      // to commit the navigation and paint the screen, rather than 
      // hanging on the 'New Tab' screen waiting for the first byte.
      controller.enqueue(new TextEncoder().encode(`: connected\n\n`));

      let seenIds = new Set<string>();

      const interval = setInterval(async () => {
        try {
          // Fetch top 5 recent events from Redis list
          const rawEvents = await redis.lrange(`live:${siteId}`, 0, 4);
          if (!rawEvents || rawEvents.length === 0) return;

          // Parse and reverse so oldest (in this batch) broadcast first
          const events = rawEvents.map(e => typeof e === 'string' ? JSON.parse(e) : e).reverse();

          for (const ev of events) {
            // Make sure we don't double-broadcast
            if (!seenIds.has(ev.id)) {
              sendEvent(ev);
              seenIds.add(ev.id);
            }
          }
          if (seenIds.size > 200) seenIds.clear();
        } catch (error) {
           // Silent catch to prevent interval crashes
        }
      }, 2000); // Poll Redis every 2 seconds

      // Cleanup when browser disconnects
      req.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
