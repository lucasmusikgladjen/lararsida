import { NextResponse } from 'next/server'

import { UnauthorizedError, requireTeacherSession } from '@/lib/auth'
import { airtableRequest, lessonBelongsToTeacher } from '@/lib/airtable'

interface LessonReportRequestBody {
  lessonId?: string
  notes?: string
  homework?: string
}

/**
 * API endpoint for acknowledging completed lesson reports.
 *
 * Webhook forwarding was removed, but we keep this endpoint so existing
 * dashboard calls still succeed after a lesson is marked as completed.
 */
export async function POST(request: Request) {
  try {
    const session = await requireTeacherSession()
    const body = (await request.json()) as LessonReportRequestBody

    if (!body.lessonId) {
      return NextResponse.json({ error: 'lessonId is required' }, { status: 400 })
    }

    const lessonRecord = await airtableRequest(`/Lektioner/${body.lessonId}`)

    if (!lessonBelongsToTeacher(lessonRecord, session.user.teacherId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to forward lesson report', error)

    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({ error: 'Failed to forward lesson report' }, { status: 500 })
  }
}
