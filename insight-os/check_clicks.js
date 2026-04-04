const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const c = await prisma.event.findMany({ 
    where: { siteId: 'cmnjoenvi000004jp2ge44k3j', type: 'click' },
    select: { url: true, xPct: true, yPct: true, ts: true }
  });
  console.log("Total Clicks:", c.length);
  console.log(c);
}
main().catch(console.error).finally(() => prisma.$disconnect());
