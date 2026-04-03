// ─── NextAuth Configuration ────────────────────────────────
// Credentials provider for hackathon demo (email + password)

import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'admin@insightos.app' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        // Demo auth — in production, check against a real user table
        if (
          credentials?.email === 'admin@insightos.app' &&
          credentials?.password === 'insight2026'
        ) {
          return { id: '1', name: 'Admin', email: 'admin@insightos.app' };
        }
        return null;
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST };
