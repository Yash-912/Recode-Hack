import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const url = process.env.DATABASE_URL!;
    
    // Test raw neon() without Prisma at all
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(url);
    const res = await sql`SELECT 1 as test`;
    
    return NextResponse.json({ 
      works: true,
      result: res
    });
  } catch (error: any) {
    return NextResponse.json({ 
      error: error.message,
    }, { status: 500 });
  }
}
