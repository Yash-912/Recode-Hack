// Native fetch will be used

const SITE_ID = 'test-site-id';
const URLS = ['/', '/pricing', '/checkout', '/dashboard'];

// We'll use 3001 or 3000 depending on what Next.js bound to, standard is 3000
const PORT = process.env.PORT || 3000;
const API = `http://localhost:${PORT}/api/collect`;

const countries = [
  { c: 'US', ip: '8.8.8.8' },
  { c: 'GB', ip: '81.2.69.142' },
  { c: 'FR', ip: '92.184.105.10' },
  { c: 'JP', ip: '122.208.204.0' },
  { c: 'BR', ip: '177.200.0.0' },
  { c: 'IN', ip: '122.160.0.0' },
  { c: 'ZA', ip: '105.0.0.0' },
];

async function sendEvent() {
  const geoObj = countries[Math.floor(Math.random() * countries.length)];
  const ip = geoObj.ip;
  const country = geoObj.c;
  
  const userAgent = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/${Math.floor(Math.random()*100)}.0.0.0`;
  const path = URLS[Math.floor(Math.random() * URLS.length)];
  
  // MUST MATCH ZOD SCHEMA in route.ts! (No shortcodes here)
  const payload = {
    type: 'pageview',
    url: `http://localhost:${PORT}${path}`,
    site_id: SITE_ID,
    screen_w: 1920,
    referrer: Math.random() > 0.5 ? 'https://google.com' : null,
    ts: Date.now()
  };

  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': userAgent,
        'x-forwarded-for': ip,     // Fake IP to bypass localhost resolution
        'cf-ipcountry': country    // Fake country header (Cloudflare style) for the Geo-IP
      },
      body: JSON.stringify(payload)
    });
    
    if (res.ok) {
      console.log(`[Pulse] Sent traffic from ${country} to ${path}`);
    } else {
      console.log(`[Pulse] Failed: ${res.status}`);
    }
  } catch(e) {
    console.error(`[Pulse] Network Error: ${e.message}`);
  }
}

console.log('Sending live heartbeat traffic for 60 seconds...');

// Send initial burst
for(let i=0; i<15; i++) sendEvent();

// Keep sending 1-2 events every second
const interval = setInterval(() => {
  sendEvent();
  if (Math.random() > 0.5) sendEvent();
}, 1000);

// Stop after 60s
setTimeout(() => {
  clearInterval(interval);
  console.log('Finished sending pulse traffic.');
  process.exit(0);
}, 60000);
