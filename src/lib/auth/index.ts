import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { db } from "@/lib/db"
import { admins } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import bcrypt from "bcryptjs"

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        // Find admin user
        const [admin] = await db
          .select()
          .from(admins)
          .where(eq(admins.email, credentials.email as string))
          .limit(1)

        if (!admin) {
          return null
        }

        // Check if user is active
        if (!admin.isActive) {
          return null
        }

        // Verify password
        const isValid = await bcrypt.compare(
          credentials.password as string,
          admin.passwordHash
        )

        if (!isValid) {
          return null
        }

        // Return user object
        return {
          id: admin.id,
          email: admin.email,
          name: admin.name,
        }
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isOnAdminRoute = nextUrl.pathname.startsWith('/admin')
      const isOnLoginPage = nextUrl.pathname.startsWith('/login')

      if (isOnAdminRoute) {
        if (isLoggedIn) return true
        return false // Redirect unauthenticated users to login page
      } else if (isLoggedIn && isOnLoginPage) {
        return Response.redirect(new URL('/admin', nextUrl))
      }
      return true
    },
  },
  trustHost: true,
})
