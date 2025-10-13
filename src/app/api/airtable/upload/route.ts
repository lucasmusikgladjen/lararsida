import { NextResponse } from 'next/server'

import { UnauthorizedError, requireTeacherSession } from '@/lib/auth'
import { airtableRequest, studentBelongsToTeacher } from '@/lib/airtable'

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID

if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
  throw new Error('Missing Airtable configuration for uploads.')
}

const TEACHER_ATTACHMENT_FIELDS = new Set(['Profilbild', 'Avtal', 'Jämkning', 'Belastningsregister'])
const STUDENT_ATTACHMENT_FIELDS = new Set(['Lärandematerial'])
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024

type UploadRequestBody = {
  field?: string
  fileName?: string
  contentType?: string
  base64?: string
  recordType?: 'teacher' | 'student'
  recordId?: string
}

export async function POST(request: Request) {
  try {
    const session = await requireTeacherSession()
    const body: UploadRequestBody = await request.json()

    const {
      field,
      fileName,
      contentType,
      base64,
      recordType = 'teacher',
      recordId,
    } = body

    if (!field || typeof field !== 'string') {
      return NextResponse.json({ error: 'Fältet för uppladdning saknas.' }, { status: 400 })
    }

    if (!fileName || typeof fileName !== 'string') {
      return NextResponse.json({ error: 'Filnamn saknas.' }, { status: 400 })
    }

    if (!base64 || typeof base64 !== 'string') {
      return NextResponse.json({ error: 'Filinnehåll saknas.' }, { status: 400 })
    }

    const normalizedBase64 = base64.trim()

    if (!normalizedBase64) {
      return NextResponse.json({ error: 'Tomt filinnehåll.' }, { status: 400 })
    }

    const fileSizeBytes = Buffer.byteLength(normalizedBase64, 'base64')

    if (fileSizeBytes > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: 'Filen är för stor. Maxstorlek är 5 MB.' }, { status: 413 })
    }

    const allowedFields = recordType === 'student' ? STUDENT_ATTACHMENT_FIELDS : TEACHER_ATTACHMENT_FIELDS

    if (!allowedFields.has(field)) {
      return NextResponse.json({ error: 'Ogiltigt fältnamn för uppladdning.' }, { status: 400 })
    }

    let targetRecordId = session.user.teacherId

    if (recordType === 'student') {
      if (!recordId) {
        return NextResponse.json({ error: 'Saknar recordId för elev.' }, { status: 400 })
      }

      const studentRecord = await airtableRequest(`/Elev/${recordId}`)

      if (!studentBelongsToTeacher(studentRecord, session.user.teacherId)) {
        return NextResponse.json({ error: 'Åtkomst nekad.' }, { status: 403 })
      }

      targetRecordId = recordId
    }

    const uploadUrl = `https://content.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(targetRecordId)}/${encodeURIComponent(field)}/uploadAttachment`

    const airtableResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contentType: contentType || 'application/octet-stream',
        file: normalizedBase64,
        filename: fileName,
      }),
    })

    const airtableResult = await airtableResponse.json().catch(() => null)

    if (!airtableResponse.ok) {
      const message = airtableResult?.error?.message || 'Fel vid uppladdning till Airtable.'
      return NextResponse.json({ error: message }, { status: airtableResponse.status })
    }

    const attachments =
      airtableResult?.attachments ||
      (airtableResult?.attachment ? [airtableResult.attachment] : undefined) ||
      null

    return NextResponse.json({ attachments })
  } catch (error) {
    console.error('Failed to upload attachment to Airtable', error)

    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Ogiltig JSON i förfrågan.' }, { status: 400 })
    }

    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({ error: 'Ett oväntat fel uppstod vid uppladdning.' }, { status: 500 })
  }
}
