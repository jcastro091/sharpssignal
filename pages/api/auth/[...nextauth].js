// pages/api/auth/[...nextauth].js
import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
//import { verifyUser } from "../../../lib/users"

export default NextAuth({
  providers: [
    CredentialsProvider({
      name: "Email  / Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize({ email, password }) {
        // 1) allow your hard-coded admin
        if (
          email === process.env.ADMIN_EMAIL &&
          password === process.env.ADMIN_PASS
        ) {
          return { id: email, email }
        }
        // 2) fall back to file-based users if you want
        const user = await verifyUser(email, password)
        if (user) return user

        return null
      },
    }),
  ],
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/auth/signin",
    /* newUser: "/auth/signup", */
  },
  callbacks: {
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return baseUrl + url
      if (url.startsWith(baseUrl)) return url
      return baseUrl
    },
  },
})
