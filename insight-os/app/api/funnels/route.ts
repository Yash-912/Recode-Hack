import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get('site_id');
  if (!siteId) return NextResponse.json({ error: 'Missing site_id' }, { status: 400 });

  try {
    const funnels = await prisma.funnel.findMany({ where: { siteId } });
    return NextResponse.json({ funnels });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const schema = z.object({
      site_id: z.string(),
      name: z.string(),
      steps: z.array(z.string()), // ['/', '/pricing', '/checkout']
      windowHours: z.number().optional().default(24)
    });
    
    const parsed = schema.parse(body);

    const funnel = await prisma.funnel.create({
      data: {
        siteId: parsed.site_id,
        name: parsed.name,
        steps: parsed.steps,
        windowHours: parsed.windowHours
      }
    });

    return NextResponse.json({ funnel });
  } catch (e) {
    return NextResponse.json({ error: 'Bad Request or Validation Failed' }, { status: 400 });
  }
}
