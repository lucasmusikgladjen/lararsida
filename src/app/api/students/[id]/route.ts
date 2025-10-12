import { NextResponse } from 'next/server'

import { UnauthorizedError, requireTeacherSession } from '@/lib/auth'
import { airtableRequest, studentBelongsToTeacher } from '@/lib/airtable'

interface RouteParams {
  params: { id: string }
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const session = await requireTeacherSession()
    const record = await airtableRequest(`/Elev/${params.id}`)

    if (!studentBelongsToTeacher(record, session.user.teacherId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(record)
  } catch (error) {
    console.error('Failed to fetch student', error)

    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({ error: 'Failed to fetch student' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const session = await requireTeacherSession()
    const existing = await airtableRequest(`/Elev/${params.id}`)

    if (!studentBelongsToTeacher(existing, session.user.teacherId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const payload = await request.json()
    const record = await airtableRequest(`/Elev/${params.id}`, {
      method: 'PATCH',
      body: payload,
    })

    return NextResponse.json(record)
  } catch (error) {
    console.error('Failed to update student', error)

    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({ error: 'Failed to update student' }, { status: 500 })
  }
}
