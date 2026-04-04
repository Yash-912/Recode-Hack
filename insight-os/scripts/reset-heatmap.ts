import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetHeatmap() {
  console.log('Nuking all historic click coordinates from the database...');
  
  // Wipe all click events (which powers the Heatmap coordinate metrics)
  const result = await prisma.event.deleteMany({
    where: {
      type: 'click'
    }
  });

  console.log(`Success! Physically deleted ${result.count} raw click locations from the PostgreSQL system.`);
  console.log('Your Heatmap is now a completely blank slate.');
}

resetHeatmap()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
