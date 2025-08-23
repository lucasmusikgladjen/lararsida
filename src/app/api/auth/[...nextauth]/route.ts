import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        try {
          // Hämta lärare från Airtable
          const response = await fetch(`https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/Lärare?filterByFormula={E-post}="${credentials.email}"`, {
            headers: {
              'Authorization': `Bearer ${process.env.AIRTABLE_API_KEY}`,
            },
          })

          const data = await response.json()
          
          if (!data.records || data.records.length === 0) {
            return null // Ingen lärare hittad
          }

          const teacher = data.records[0]
          const hashedPassword = teacher.fields.Lösenord

          // Kontrollera lösenord
          const isValidPassword = await bcrypt.compare(credentials.password, hashedPassword)
          
          if (!isValidPassword) {
            return null
          }

          // Returnera användardata
          return {
            id: teacher.id,
            email: teacher.fields['E-post'],
            name: teacher.fields.Namn || teacher.fields.Name, // Hantera olika namnfält
          }
        } catch (error) {
          console.error('Auth error:', error)
          return null
        }
      }
    })
  ],
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.teacherId = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (token.teacherId) {
        session.user.teacherId = token.teacherId
      }
      return session
    },
  },
})

export { handler as GET, handler as POST }