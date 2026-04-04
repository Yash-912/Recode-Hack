import { neon } from '@neondatabase/serverless';

export async function GET() {
  const url = process.env.DATABASE_URL!;
  const sql = neon(url);
  const res = await sql`SELECT 1 as test`;
  return Response.json({ success: true, result: res });
}