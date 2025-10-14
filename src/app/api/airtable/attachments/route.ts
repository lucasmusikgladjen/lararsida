import { NextResponse } from 'next/server'

import { airtableRequest } from '@/lib/airtable'
import { UnauthorizedError, requireTeacherSession } from '@/lib/auth'

export async function DELETE(request: Request) {
  try {
    const session = await requireTeacherSession()
    const { field, attachmentId } = await request.json()

    if (typeof field !== 'string' || typeof attachmentId !== 'string') {
      return NextResponse.json({ error: 'Ogiltig förfrågan' }, { status: 400 })
    }

    const record = await airtableRequest(`/Lärare/${session.user.teacherId}`)
    const attachments = record?.fields?.[field]

    if (!Array.isArray(attachments)) {
      return NextResponse.json({ error: 'Bilagan hittades inte' }, { status: 404 })
    }

    const remaining = attachments.filter((attachment: any) => attachment?.id !== attachmentId)

    if (remaining.length === attachments.length) {
      return NextResponse.json({ error: 'Bilagan kunde inte hittas för borttagning' }, { status: 404 })
    }

    const payloadAttachments = remaining.map((attachment: any) => ({ id: attachment.id }))

    await airtableRequest(`/Lärare/${session.user.teacherId}`, {
      method: 'PATCH',
      body: {
        fields: {
          [field]: payloadAttachments,
        },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete attachment', error)

    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({ error: 'Det gick inte att ta bort dokumentet' }, { status: 500 })
  }
}
