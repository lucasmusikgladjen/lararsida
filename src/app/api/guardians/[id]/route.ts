import { NextResponse } from 'next/server'

import { UnauthorizedError, requireTeacherSession } from '@/lib/auth'
import { airtableRequest } from '@/lib/airtable'

interface RouteParams {
  params: { id: string }
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    await requireTeacherSession()
    const record = await airtableRequest(`/Vårdnadshavare/${params.id}`)
    return NextResponse.json(record)
  } catch (error) {
    console.error('Failed to fetch guardian', error)

    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({ error: 'Failed to fetch guardian' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    await requireTeacherSession()
    const payload = await request.json()
    const record = await airtableRequest(`/Vårdnadshavare/${params.id}`, {
      method: 'PATCH',
      body: payload,
    })
    return NextResponse.json(record)
  } catch (error) {
    console.error('Failed to update guardian', error)

    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({ error: 'Failed to update guardian' }, { status: 500 })
  }
}
