import { NextResponse } from 'next/server'

import { UnauthorizedError, requireTeacherSession } from '@/lib/auth'
import { fetchAllRecords } from '@/lib/airtable'

export async function GET() {
  try {
    await requireTeacherSession()
    const records = await fetchAllRecords('Vårdnadshavare')
    return NextResponse.json({ records })
  } catch (error) {
    console.error('Failed to fetch guardians', error)

    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({ error: 'Failed to fetch guardians' }, { status: 500 })
  }
}
