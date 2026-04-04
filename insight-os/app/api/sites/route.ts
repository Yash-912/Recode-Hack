import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const sites = await prisma.site.findMany({
    orderBy: { createdAt: 'desc' }
  });
  return NextResponse.json(sites);
}

export async function POST(req: Request) {
  try {
    const { domain } = await req.json();
    
    // Check if domain exists
    const existing = await prisma.site.findFirst({ where: { domain } });
    if (existing) return NextResponse.json({ error: 'Domain already registered' }, { status: 400 });

    const newSite = await prisma.site.create({
      data: {
        domain
      }
    });
    
    return NextResponse.json(newSite);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to create site' }, { status: 500 });
  }
}
