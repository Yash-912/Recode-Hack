import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();
const SITE_ID = 'demo-123'; // Matches standard demo site ID

async function main() {
  console.log(`Seeding database for site: ${SITE_ID}...`);

  // Ensure site exists
  const existingSite = await prisma.site.findUnique({ where: { id: SITE_ID } });
  if (!existingSite) {
    await prisma.site.create({ data: { id: SITE_ID, domain: 'localhost:3000' } });
  }

  const urls = ['/', '/pricing', '/checkout', '/thank-you'];
  const referrers = ['https://google.com', 'https://twitter.com', null];
  const countries = ['US', 'GB', 'IN', 'CA', 'AU'];

  let eventCount = 0;
  for (let i = 0; i < 500; i++) {
    // Distribute across last 24 hours randomly
    const randomHourOffset = Math.floor(Math.random() * 24);
    const ts = new Date(Date.now() - randomHourOffset * 60 * 60 * 1000);

    const ip = `192.168.1.${Math.floor(Math.random() * 255)}`;
    const sessionHash = crypto.createHash('sha256').update(ip + 'Mozilla' + ts.toISOString().slice(0, 10)).digest('hex');
    
    const isBot = Math.random() > 0.9; // 10% bot traffic
    const country = countries[Math.floor(Math.random() * countries.length)];
    const referrer = referrers[Math.floor(Math.random() * referrers.length)];

    // Funnel simulation: Some users drop off
    const stepsToHit = Math.floor(Math.random() * 4) + 1; 

    for (let s = 0; s < stepsToHit; s++) {
      const url = urls[s];
      ts.setMinutes(ts.getMinutes() + s * 2); // 2 minutes between pages

      // 1. Pageview
      await prisma.event.create({
        data: {
          siteId: SITE_ID,
          type: 'pageview',
          url,
          referrer: s === 0 ? referrer : null,
          country,
          sessionHash,
          isBot,
          ts
        }
      });
      eventCount++;

      // 2. Random Clicks on page
      if (!isBot) {
        const clicks = Math.floor(Math.random() * 3);
        const currentHour = new Date(ts);
        currentHour.setMinutes(0, 0, 0);

        for (let c = 0; c < clicks; c++) {
          await prisma.event.create({
            data: {
              siteId: SITE_ID,
              type: 'click',
              url,
              xPct: parseFloat((Math.random() * 100).toFixed(2)),
              yPct: parseFloat((Math.random() * 100).toFixed(2)),
              sessionHash,
              isBot: false,
              ts: new Date(ts.getTime() + 10000 + c * 5000)
            }
          });
          eventCount++;

          // Upsert stats for clicks
          await prisma.hourlyStat.upsert({
            where: { siteId_hour: { siteId: SITE_ID, hour: currentHour } },
            update: { clicks: { increment: 1 } },
            create: { siteId: SITE_ID, hour: currentHour, clicks: 1 }
          });
        }
      }

      // 3. Upsert Stats for Pageviews array logic omitted from seed script to save time,
      // handled natively in collection endpoint
      if (!isBot) {
        const currentHour = new Date(ts);
        currentHour.setMinutes(0, 0, 0);
        await prisma.hourlyStat.upsert({
          where: { siteId_hour: { siteId: SITE_ID, hour: currentHour } },
          update: { pageviews: { increment: 1 } },
          create: { siteId: SITE_ID, hour: currentHour, pageviews: 1 }
        });
      }
    }
  }

  console.log(`✅ Seeding complete. Inserted ${eventCount} events over 24 hours.`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
