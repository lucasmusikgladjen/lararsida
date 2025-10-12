import { NextResponse } from 'next/server'

import { UnauthorizedError, requireTeacherSession } from '@/lib/auth'
import { airtableRequest } from '@/lib/airtable'

export async function GET() {
  try {
    await requireTeacherSession()

    const params = new URLSearchParams({
      maxRecords: '1',
      'sort[0][field]': 'Datum',
      'sort[0][direction]': 'desc',
    })

    const data = await airtableRequest(`/Admin_Meddelanden?${params.toString()}`)
    const record = data.records?.[0] ?? null

    return NextResponse.json(record)
  } catch (error) {
    console.error('Failed to fetch admin message', error)

    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({ error: 'Failed to fetch admin message' }, { status: 500 })
  }
}
