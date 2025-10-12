import { NextResponse } from 'next/server'

import { UnauthorizedError, requireTeacherSession } from '@/lib/auth'
import { airtableRequest, lessonBelongsToTeacher } from '@/lib/airtable'

interface RouteParams {
  params: { id: string }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const session = await requireTeacherSession()
    const existing = await airtableRequest(`/Lektioner/${params.id}`)

    if (!lessonBelongsToTeacher(existing, session.user.teacherId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const payload = await request.json()
    const record = await airtableRequest(`/Lektioner/${params.id}`, {
      method: 'PATCH',
      body: payload,
    })

    return NextResponse.json(record)
  } catch (error) {
    console.error('Failed to update lesson', error)

    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({ error: 'Failed to update lesson' }, { status: 500 })
  }
}
