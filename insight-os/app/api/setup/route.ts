import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
