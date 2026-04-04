import NextAuth, { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text', placeholder: 'admin@insight.os' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (credentials?.email === 'admin@insight.os' && credentials?.password === 'admin') {
          return { id: '1', name: 'Admin', email: 'admin@insight.os' };
        }
        return null;
      },
    }),
  ],
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET || 'fallback-secret-for-demo',
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
