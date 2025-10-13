import { NextResponse } from 'next/server'

import { UnauthorizedError, requireTeacherSession } from '@/lib/auth'
import { airtableRequest, lessonBelongsToTeacher } from '@/lib/airtable'

interface LessonReportRequestBody {
  lessonId?: string
  notes?: string
  homework?: string
}

/**
 * API endpoint for forwarding completed lesson reports to the Make webhook.
 *
 * The handler enriches the incoming payload with information about the
 * connected student and guardian so the automation has everything it needs
 * to email the guardian.
 */
export async function POST(request: Request) {
  try {
    const session = await requireTeacherSession()
    const body = (await request.json()) as LessonReportRequestBody

    if (!body.lessonId) {
      return NextResponse.json({ error: 'lessonId is required' }, { status: 400 })
    }

    const webhookUrl = process.env.LESSON_REPORT_WEBHOOK_URL

    if (!webhookUrl) {
      console.error('LESSON_REPORT_WEBHOOK_URL is not configured')
      return NextResponse.json({ error: 'Lesson report webhook is not configured' }, { status: 500 })
    }

    const lessonRecord = await airtableRequest(`/Lektioner/${body.lessonId}`)

    if (!lessonBelongsToTeacher(lessonRecord, session.user.teacherId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const studentField = lessonRecord.fields?.Elev
    const studentId = Array.isArray(studentField) ? studentField[0] : studentField

    if (!studentId) {
      return NextResponse.json({ error: 'Lesson is missing a linked student' }, { status: 422 })
    }

    const studentRecord = await airtableRequest(`/Elev/${studentId}`)
    const guardianField = studentRecord.fields?.Vårdnadshavare
    const guardianId = Array.isArray(guardianField) ? guardianField[0] : guardianField

    if (!guardianId) {
      return NextResponse.json({ error: 'Student is missing a guardian' }, { status: 422 })
    }

    const guardianRecord = await airtableRequest(`/Vårdnadshavare/${guardianId}`)
    const guardianEmail =
      guardianRecord.fields?.['E-post'] ??
      guardianRecord.fields?.Epost ??
      guardianRecord.fields?.Email ??
      guardianRecord.fields?.email

    if (!guardianEmail) {
      return NextResponse.json({ error: 'Guardian is missing an email address' }, { status: 422 })
    }

    const payload = {
      lesson: {
        id: lessonRecord.id ?? body.lessonId,
        date: lessonRecord.fields?.Datum ?? null,
        time: lessonRecord.fields?.Klockslag ?? null,
        notes: body.notes ?? '',
        homework: body.homework ?? '',
      },
      student: {
        id: studentId,
        name: studentRecord.fields?.Namn ?? '',
      },
      guardian: {
        id: guardianId,
        name:
          guardianRecord.fields?.Namn ??
          guardianRecord.fields?.['Fullständigt namn'] ??
          guardianRecord.fields?.['För- och efternamn'] ??
          '',
        email: guardianEmail,
      },
      teacher: {
        id: session.user.teacherId,
        name: session.user.name ?? '',
        email: session.user.email ?? '',
      },
    }

    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!webhookResponse.ok) {
      const errorText = await webhookResponse.text().catch(() => 'Okänt fel från webhooken')
      console.error('Webhook call for lesson report failed:', errorText)
      return NextResponse.json({ error: 'Failed to deliver lesson report' }, { status: 502 })
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
