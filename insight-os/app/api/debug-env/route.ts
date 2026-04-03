import { NextResponse } from 'next/server';

export async function GET() {
  const dbUrl = process.env.DATABASE_URL;
  return NextResponse.json({
    DATABASE_URL_EXISTS: !!dbUrl,
    DATABASE_URL_PREFIX: dbUrl ? dbUrl.substring(0, 30) + '...' : 'UNDEFINED',
    ALL_ENV_KEYS: Object.keys(process.env).filter(k => 
      k.includes('DATABASE') || k.includes('REDIS') || k.includes('NEXTAUTH') || k.includes('GEMINI')
    )
  });
}
