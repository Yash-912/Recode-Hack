import { prisma } from './prisma';

export async function getMarkovProbabilities(siteId: string, steps: string[], windowDate: Date) {
  // Use Postgres Window Functions to grab the next page viewed in every session
  const query = `
    WITH SessionEvents AS (
      SELECT 
        session_hash,
        url,
        LEAD(url) OVER (PARTITION BY session_hash ORDER BY ts ASC) as next_url
      FROM (
        SELECT 
          session_hash,
          url,
          ts,
          LAG(url) OVER (PARTITION BY session_hash ORDER BY ts ASC) as prev_url
        FROM events
        WHERE site_id = $1 AND ts >= $2 AND is_bot = false AND session_hash IS NOT NULL AND type = 'pageview'
      ) collapsed
      WHERE prev_url IS NULL OR prev_url != url
    )
    SELECT 
      url as "from_url",
      next_url as "to_url",
      COUNT(*) as count
    FROM SessionEvents
    WHERE url IS NOT NULL AND next_url IS NOT NULL
    GROUP BY url, next_url
  `;

  // $queryRawUnsafe requires direct parametrized array input
  const transitions = await prisma.$queryRawUnsafe<any[]>(query, siteId, windowDate);

  const probabilities = [];

  for (let i = 0; i < steps.length - 1; i++) {
    const stepA = steps[i];
    const stepB = steps[i + 1];

    // Find all raw SQL transition rows leaving step A (substring match)
    const leavingA = transitions.filter(t => (t.from_url || '').includes(stepA));
    const totalA = leavingA.reduce((sum, t) => sum + Number(t.count), 0);

    // Find transitions leaving A and specifically hitting B next
    const aToBList = leavingA.filter(t => (t.to_url || '').includes(stepB));
    const aToBCount = aToBList.reduce((sum, t) => sum + Number(t.count), 0);

    const prob = totalA === 0 ? 0 : (aToBCount / totalA) * 100;
    
    probabilities.push({
      from: stepA,
      to: stepB,
      probabilityPct: parseFloat(prob.toFixed(1))
    });
  }

  return probabilities;
}
