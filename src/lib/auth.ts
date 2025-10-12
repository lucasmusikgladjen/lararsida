import { getServerSession } from 'next-auth'

import { authOptions } from '@/app/api/auth/[...nextauth]/route'

export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

export async function requireTeacherSession() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.teacherId) {
    throw new UnauthorizedError()
  }

  return session
}
