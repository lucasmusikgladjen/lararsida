import { NextResponse } from 'next/server'

import { UnauthorizedError, requireTeacherSession } from '@/lib/auth'
import { fetchAllRecords, studentBelongsToTeacher } from '@/lib/airtable'

export async function GET(request: Request) {
  try {
    const session = await requireTeacherSession()
    const { searchParams } = new URL(request.url)
    const scope = searchParams.get('scope') ?? 'assigned'

    const records = await fetchAllRecords('Elev')

    let filtered = records

    if (scope === 'assigned') {
      filtered = records.filter((record) => studentBelongsToTeacher(record, session.user.teacherId))
    } else if (scope === 'available') {
      filtered = records.filter((record) => record.fields?.Status === 'Söker lärare' && !record.fields?.LärareRecordID)
    }

    return NextResponse.json({ records: filtered })
  } catch (error) {
    console.error('Failed to fetch students', error)

    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({ error: 'Failed to fetch students' }, { status: 500 })
  }
}
