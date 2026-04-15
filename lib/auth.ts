import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    signIn({ user }) {
      // Only allow @zumasales.com emails
      const email = user.email || '';
      if (!email.endsWith('@zumasales.com')) {
        return false;
      }
      return true;
    },
    session({ session }) {
      return session;
    },
  },
  pages: {
    signIn: '/signin',
    error: '/signin',
  },
});
