// ─── Insight-OS Tracker Script ──────────────────────────────
// < 5KB after esbuild minification
// Zero dependencies. Non-blocking. Privacy-first.
// Build: npm run build:tracker

(function () {
  'use strict';

  // Capture script element at parse time (before async defer moves it)
  var scripts = document.getElementsByTagName('script');
  var currentScript = scripts[scripts.length - 1];

  var siteId = currentScript.getAttribute('data-site');
  if (!siteId) return;

  var endpoint =
    currentScript.getAttribute('data-endpoint') ||
    new URL('/api/collect', currentScript.src || location.origin).href;

  function send(payload) {
    var data = JSON.stringify({
      site_id: siteId,
      url: location.href,
      referrer: document.referrer || null,
      screen_w: screen.width,
      screen_h: screen.height,
      ts: Date.now(),
      type: payload.type,
      x_pct: payload.x_pct || null,
      y_pct: payload.y_pct || null,
    });

    // sendBeacon — fire-and-forget, never blocks main thread
    if (navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, data);
    }
  }

  // ─── Pageview — fires on load ────────────────────────────
  function trackPageview() {
    send({ type: 'pageview' });
  }

  // ─── Click — viewport percentages (screen-size agnostic) ─
  function trackClick(e) {
    send({
      type: 'click',
      x_pct: parseFloat(((e.clientX / window.innerWidth) * 100).toFixed(2)),
      y_pct: parseFloat(((e.clientY / window.innerHeight) * 100).toFixed(2)),
    });
  }

  // ─── Deferred setup for non-critical listeners ───────────
  function init() {
    document.addEventListener('click', trackClick, { passive: true });
  }

  if (document.readyState === 'complete') {
    trackPageview();
    typeof requestIdleCallback === 'function'
      ? requestIdleCallback(init)
      : init();
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      trackPageview();
      typeof requestIdleCallback === 'function'
        ? requestIdleCallback(init)
        : init();
    });
  }
})();
