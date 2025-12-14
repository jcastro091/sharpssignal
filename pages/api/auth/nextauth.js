// pages/api/auth/[...nextauth].js
import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"

export default NextAuth({
  // 1) Define a simple Credentials provider:
  providers: [
    CredentialsProvider({
      name: "Site Login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(creds) {
        // Replace with your own check (DB lookup, env vars, etc.)
        if (
          creds.email === process.env.ADMIN_EMAIL &&
          creds.password === process.env.ADMIN_PASS
        ) {
          return { id: 1, name: "Admin", email: creds.email }
        }
        return null
      }
    })
  ],

  // 2) Use JSON Web Tokens for session
  session: { strategy: "jwt" },

  // 3) A secret for encrypting tokens & cookies
  secret: process.env.NEXTAUTH_SECRET,

  // 4) (Optional) Add user data to the session object
  callbacks: {
    async session({ session, token }) {
      session.user.id = token.sub
      return session
    }
  }
})
