import { NextResponse } from 'next/server'

import { UnauthorizedError, requireTeacherSession } from '@/lib/auth'
import { airtableRequest } from '@/lib/airtable'

const WEBHOOK_URL = process.env.FIRST_LESSON_WEBHOOK_URL

const WEEKDAY_TO_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
}

const WEEKDAY_LABELS: Record<string, string> = {
  sunday: 'Söndag',
  monday: 'Måndag',
  tuesday: 'Tisdag',
  wednesday: 'Onsdag',
  thursday: 'Torsdag',
  friday: 'Fredag',
  saturday: 'Lördag',
}

type RequestBody = {
  studentId?: string
  firstLessonDate?: string
  firstLessonTime?: string
  ordinaryWeekday?: string
  ordinaryTime?: string
  backupTime?: string
  arrangement?: string
  termGoal?: string
  notes?: string
}

function getTrimmedString(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  return value.trim()
}

function parseDateOnly(value: string | undefined) {
  if (!value) {
    return null
  }

  const date = new Date(`${value}T00:00:00`)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date
}

function formatDateOnly(date: Date) {
  return date.toISOString().split('T')[0]
}

function formatDateParts(year: number, month: number, day: number) {
  const paddedMonth = String(month).padStart(2, '0')
  const paddedDay = String(day).padStart(2, '0')
  return `${year}-${paddedMonth}-${paddedDay}`
}

function determineTermEndDate(firstLessonDate: Date) {
  const year = firstLessonDate.getFullYear()
  const month = firstLessonDate.getMonth() + 1 // 1-indexed
  const day = firstLessonDate.getDate()

  let termYear = year
  let termMonth = 6
  let termDay = 30

  if (month < 7) {
    // Spring term (January–June)
    termMonth = 6
    termDay = 30
  } else if (month < 12 || (month === 12 && day <= 20)) {
    // Autumn term (July–20 December)
    termMonth = 12
    termDay = 20
  } else {
    // After 20 December we move to next year's spring term
    termYear = year + 1
    termMonth = 6
    termDay = 30
  }

  const isoDate = formatDateParts(termYear, termMonth, termDay)
  const parsed = parseDateOnly(isoDate)

  if (!parsed) {
    throw new Error('Kunde inte bestämma terminsslut')
  }

  return { date: parsed, iso: isoDate }
}

function getNextWeekdayAfter(date: Date, targetWeekday: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + 1)

  while (next.getDay() !== targetWeekday) {
    next.setDate(next.getDate() + 1)
  }

  return next
}

function chunk<T>(items: T[], size: number) {
  const result: T[][] = []

  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size))
  }

  return result
}

function extractRecordIds(response: unknown) {
  if (!response || typeof response !== 'object') {
    return [] as string[]
  }

  const recordsValue = (response as { records?: unknown }).records

  if (!Array.isArray(recordsValue)) {
    return [] as string[]
  }

  const ids: string[] = []

  for (const record of recordsValue) {
    if (record && typeof record === 'object' && 'id' in record) {
      const id = (record as { id?: unknown }).id

      if (typeof id === 'string') {
        ids.push(id)
      }
    }
  }

  return ids
}

async function deleteCreatedLessons(recordIds: string[]) {
  if (recordIds.length === 0) {
    return
  }

  const batches = chunk(recordIds, 10)

  for (const batch of batches) {
    const params = new URLSearchParams()

    for (const id of batch) {
      params.append('records[]', id)
    }

    try {
      await airtableRequest(`/Lektioner?${params.toString()}`, { method: 'DELETE' })
    } catch (error) {
      console.error('Failed to rollback created lessons', error)
    }
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireTeacherSession()
    const body = (await request.json()) as RequestBody

    const studentId = getTrimmedString(body.studentId)
    const firstLessonDateRaw = getTrimmedString(body.firstLessonDate)
    const firstLessonTime = getTrimmedString(body.firstLessonTime)
    const ordinaryWeekdayRaw = getTrimmedString(body.ordinaryWeekday)?.toLowerCase() ?? null
    const ordinaryTime = getTrimmedString(body.ordinaryTime)
    const backupTime = getTrimmedString(body.backupTime) ?? ''
    const arrangement = getTrimmedString(body.arrangement) ?? ''
    const termGoal = getTrimmedString(body.termGoal) ?? ''
    const notes = getTrimmedString(body.notes) ?? ''

    if (!studentId) {
      return NextResponse.json({ error: 'studentId saknas' }, { status: 400 })
    }

    if (!firstLessonDateRaw || !firstLessonTime) {
      return NextResponse.json({ error: 'Datum och tid för första lektionen måste anges' }, { status: 400 })
    }

    if (!ordinaryWeekdayRaw || !ordinaryTime) {
      return NextResponse.json({ error: 'Ordinarie veckodag och tid måste anges' }, { status: 400 })
    }

    const firstLessonDate = parseDateOnly(firstLessonDateRaw)

    if (!firstLessonDate) {
      return NextResponse.json({ error: 'Ogiltigt datum för första lektionen' }, { status: 400 })
    }

    const ordinaryWeekdayIndex = WEEKDAY_TO_INDEX[ordinaryWeekdayRaw]

    if (ordinaryWeekdayIndex === undefined) {
      return NextResponse.json({ error: 'Ogiltig veckodag för ordinarie lektionstid' }, { status: 400 })
    }

    const { date: termEndDate, iso: termEndDateString } = determineTermEndDate(firstLessonDate)

    const lessonsPayload = [
      {
        fields: {
          Datum: firstLessonDateRaw,
          Klockslag: firstLessonTime,
          Elev: [studentId],
          Lärare: [session.user.teacherId],
          Genomförd: false,
          Inställd: false,
        },
      },
    ]

    let nextLessonDate = getNextWeekdayAfter(firstLessonDate, ordinaryWeekdayIndex)

    while (nextLessonDate <= termEndDate) {
      lessonsPayload.push({
        fields: {
          Datum: formatDateOnly(nextLessonDate),
          Klockslag: ordinaryTime,
          Elev: [studentId],
          Lärare: [session.user.teacherId],
          Genomförd: false,
          Inställd: false,
        },
      })

      nextLessonDate = new Date(nextLessonDate)
      nextLessonDate.setDate(nextLessonDate.getDate() + 7)
    }

    const createdRecordIds: string[] = []

    const batches = chunk(lessonsPayload, 10)

    for (const batch of batches) {
      const response = await airtableRequest('/Lektioner', {
        method: 'POST',
        body: { records: batch },
      })

      createdRecordIds.push(...extractRecordIds(response))
    }

    if (!WEBHOOK_URL) {
      throw new Error('FIRST_LESSON_WEBHOOK_URL saknas i konfigurationen')
    }

    const webhookResponse = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        teacher: {
          id: session.user.teacherId,
          name: session.user.name,
          email: session.user.email,
        },
        studentId,
        firstLessonDate: firstLessonDateRaw,
        firstLessonTime,
        ordinaryWeekday: ordinaryWeekdayRaw,
        ordinaryWeekdayLabel: WEEKDAY_LABELS[ordinaryWeekdayRaw] ?? ordinaryWeekdayRaw,
        ordinaryTime,
        backupTime,
        arrangement,
        termGoal,
        notes,
        lessonsCreated: createdRecordIds.length,
        termEndDate: termEndDateString,
      }),
    })

    if (!webhookResponse.ok) {
      const errorText = await webhookResponse.text()
      await deleteCreatedLessons(createdRecordIds)
      throw new Error(`Webhook svarade med fel: ${webhookResponse.status} ${webhookResponse.statusText} - ${errorText}`)
    }

    return NextResponse.json({
      success: true,
      lessonsCreated: createdRecordIds.length,
      recordIds: createdRecordIds,
    })
  } catch (error) {
    console.error('Failed to handle first lesson request', error)

    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Obehörig' }, { status: 401 })
    }

    return NextResponse.json({ error: error instanceof Error ? error.message : 'Något gick fel' }, { status: 500 })
  }
}
