import { NextResponse } from 'next/server'

import { UnauthorizedError, requireTeacherSession } from '@/lib/auth'
import { airtableRequest } from '@/lib/airtable'

export async function GET() {
  try {
    const session = await requireTeacherSession()
    const record = await airtableRequest(`/Lärare/${session.user.teacherId}`)
    return NextResponse.json(record)
  } catch (error) {
    console.error('Failed to fetch teacher profile', error)

    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({ error: 'Failed to fetch teacher profile' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireTeacherSession()
    const payload = await request.json()
    const record = await airtableRequest(`/Lärare/${session.user.teacherId}`, {
      method: 'PATCH',
      body: payload,
    })

    return NextResponse.json(record)
  } catch (error) {
    console.error('Failed to update teacher profile', error)

    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({ error: 'Failed to update teacher profile' }, { status: 500 })
  }
}
