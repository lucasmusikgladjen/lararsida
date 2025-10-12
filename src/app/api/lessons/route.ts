import { NextResponse } from 'next/server'

import { UnauthorizedError, requireTeacherSession } from '@/lib/auth'
import {
  airtableRequest,
  fetchAllRecords,
  lessonBelongsToTeacher,
  lessonMatchesStudent,
} from '@/lib/airtable'

export async function GET(request: Request) {
  try {
    const session = await requireTeacherSession()
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get('studentId')
    const includeAll = searchParams.get('includeAll') === 'true'

    const records = await fetchAllRecords('Lektioner')

    let filtered = records

    if (!includeAll) {
      filtered = filtered.filter((record) => lessonBelongsToTeacher(record, session.user.teacherId))
    }

    if (studentId) {
      filtered = filtered.filter((record) => lessonMatchesStudent(record, studentId))
    }

    return NextResponse.json({ records: filtered })
  } catch (error) {
    console.error('Failed to fetch lessons', error)

    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({ error: 'Failed to fetch lessons' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    await requireTeacherSession()
    const payload = await request.json()
    const records = await airtableRequest('/Lektioner', {
      method: 'POST',
      body: payload,
    })
    return NextResponse.json(records)
  } catch (error) {
    console.error('Failed to create lessons', error)

    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({ error: 'Failed to create lessons' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    await requireTeacherSession()
    const payload = await request.json()
    const recordIds: string[] = payload.recordIds ?? []

    if (!Array.isArray(recordIds) || recordIds.length === 0) {
      return NextResponse.json({ error: 'recordIds is required' }, { status: 400 })
    }

    const params = new URLSearchParams()
    for (const id of recordIds) {
      params.append('records[]', id)
    }

    const response = await airtableRequest(`/Lektioner?${params.toString()}`, {
      method: 'DELETE',
    })

    return NextResponse.json(response)
  } catch (error) {
    console.error('Failed to delete lessons', error)

    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({ error: 'Failed to delete lessons' }, { status: 500 })
  }
}
