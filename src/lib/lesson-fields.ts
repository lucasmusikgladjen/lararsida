import { airtableRequest } from '@/lib/airtable'

export const ALLOWED_LESSON_ARRANGEMENTS = ['45-60 min', '90 min', '120 min'] as const

export type AllowedLessonArrangement = (typeof ALLOWED_LESSON_ARRANGEMENTS)[number]

const NAME_FIELD_CANDIDATES = [
  'Namn',
  'Fullständigt namn',
  'Fullständigt Namn',
  'För- och efternamn',
  'För- och Efternamn',
  'Name',
]

function getLinkedRecordId(value: unknown): string | null {
  if (!value) {
    return null
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()

    return trimmed ? trimmed : null
  }

  if (Array.isArray(value) && value.length > 0) {
    const first = value[0]

    if (typeof first === 'string') {
      const trimmed = first.trim()

      return trimmed ? trimmed : null
    }
  }

  return null
}

function pickFirstStringField(fields: Record<string, any> | undefined, candidates: string[]): string | null {
  if (!fields) {
    return null
  }

  for (const key of candidates) {
    const value = fields[key]

    if (typeof value === 'string') {
      const trimmed = value.trim()

      if (trimmed) {
        return trimmed
      }
    }
  }

  const firstName = typeof fields.Förnamn === 'string' ? fields.Förnamn.trim() : ''
  const lastName = typeof fields.Efternamn === 'string' ? fields.Efternamn.trim() : ''

  if (firstName || lastName) {
    return `${firstName} ${lastName}`.trim()
  }

  return null
}

export function normalizeLessonArrangement(value: unknown): AllowedLessonArrangement | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()

  return (ALLOWED_LESSON_ARRANGEMENTS as readonly string[]).includes(trimmed)
    ? (trimmed as AllowedLessonArrangement)
    : null
}

async function fetchStudentRecords(studentIds: string[]) {
  if (studentIds.length === 0) {
    return new Map<string, any>()
  }

  const entries = await Promise.all(
    studentIds.map(async (id) => {
      const record = await airtableRequest(`/Elev/${id}`)
      return [id, record] as const
    }),
  )

  return new Map(entries)
}

async function fetchGuardianNames(guardianIds: string[]) {
  if (guardianIds.length === 0) {
    return new Map<string, string>()
  }

  const entries = await Promise.all(
    guardianIds.map(async (id) => {
      const record = await airtableRequest(`/Vårdnadshavare/${id}`)
      const name =
        pickFirstStringField(record?.fields, NAME_FIELD_CANDIDATES) ?? ''

      return [id, name] as const
    }),
  )

  return new Map(entries)
}

export async function resolveTeacherName(teacherId: string, fallbackName?: string | null) {
  const fallback = (fallbackName ?? '').trim()

  try {
    const record = await airtableRequest(`/Lärare/${teacherId}`)
    const name = pickFirstStringField(record?.fields, NAME_FIELD_CANDIDATES)

    return name ?? fallback
  } catch (error) {
    console.error('Failed to fetch teacher name', error)
    return fallback
  }
}

export interface LessonRecordInput {
  fields: Record<string, any>
}

export async function enrichLessonRecords(
  records: LessonRecordInput[],
  options: { teacherId: string; teacherName?: string | null },
) {
  if (!records.length) {
    return
  }

  const todayIso = new Date().toISOString().split('T')[0]
  const teacherName =
    (options.teacherName ?? '').trim() || (await resolveTeacherName(options.teacherId)) || ''

  const studentIds = new Set<string>()

  for (const record of records) {
    const studentId = getLinkedRecordId(record.fields?.Elev)

    if (studentId) {
      studentIds.add(studentId)
    }
  }

  const studentMap = await fetchStudentRecords(Array.from(studentIds))

  const guardianIds = new Set<string>()

  for (const studentRecord of studentMap.values()) {
    const guardianId = getLinkedRecordId(studentRecord?.fields?.Vårdnadshavare)

    if (guardianId) {
      guardianIds.add(guardianId)
    }
  }

  const guardianMap = await fetchGuardianNames(Array.from(guardianIds))

  for (const record of records) {
    const fields = record.fields ?? {}

    const arrangement =
      normalizeLessonArrangement(fields['Upplägg']) ??
      normalizeLessonArrangement(fields.arrangement)

    if (arrangement) {
      fields['Upplägg'] = arrangement
    }

    const studentId = getLinkedRecordId(fields.Elev)
    let guardianName = ''

    if (studentId) {
      const studentRecord = studentMap.get(studentId)

      if (studentRecord?.fields) {
        const guardianId = getLinkedRecordId(studentRecord.fields.Vårdnadshavare)

        if (guardianId) {
          guardianName = guardianMap.get(guardianId) ?? ''
        }

        if (!guardianName) {
          guardianName =
            pickFirstStringField(studentRecord.fields, [
              'Vårdnadshavare namn',
              'Vårdnadshavare Namn',
              'Vårdnadshavare - namn',
            ]) ?? guardianName
        }
      }
    }

    fields['Vårdnadshavare (backup)'] = guardianName
    fields['Lärare (backup)'] = teacherName

    if (fields['Genomförd'] === true) {
      fields['Datum genomförd'] = todayIso
    } else if (fields['Genomförd'] === false && 'Datum genomförd' in fields) {
      fields['Datum genomförd'] = null
    }

    if ('arrangement' in fields) {
      delete fields.arrangement
    }
  }
}
