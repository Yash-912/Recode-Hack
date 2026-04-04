import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const { domain } = await req.json();
    if (!domain) return NextResponse.json({ error: 'Domain required' }, { status: 400 });

    const site = await prisma.site.create({
      data: { domain }
    });

    return NextResponse.json({ site });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Keep the GET as a fallback injector for test-site-id
export async function GET() {
  try {
    await prisma.site.upsert({
      where: { id: 'test-site-id' },
      update: {},
      create: { id: 'test-site-id', domain: 'localhost:3000' }
    });
    return NextResponse.json({ success: true, message: 'test-site-id injected!' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

