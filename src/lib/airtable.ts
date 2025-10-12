import 'server-only'

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID

if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
  throw new Error('Missing Airtable configuration. Ensure AIRTABLE_API_KEY and AIRTABLE_BASE_ID are set.')
}

const BASE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}`

type AirtableRequestInit = Omit<RequestInit, 'body'> & { body?: RequestInit['body'] | Record<string, unknown> }

export async function airtableRequest(path: string, init: AirtableRequestInit = {}) {
  const url = `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`

  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${AIRTABLE_API_KEY}`)

  let body = init.body

  if (body && typeof body === 'object' && !(body instanceof ArrayBuffer) && !(body instanceof Blob) && !(body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
    body = JSON.stringify(body)
  }

  const response = await fetch(url, {
    ...init,
    cache: 'no-store',
    headers,
    body,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Airtable request failed: ${response.status} ${response.statusText} - ${errorText}`)
  }

  return response.json()
}

export async function fetchAllRecords(table: string, params?: Record<string, string>) {
  const records: any[] = []
  let offset: string | undefined

  do {
    const searchParams = new URLSearchParams(params)

    if (offset) {
      searchParams.set('offset', offset)
    }

    const query = searchParams.toString()
    const path = `/${encodeURIComponent(table)}${query ? `?${query}` : ''}`
    const data = await airtableRequest(path)
    records.push(...(data.records ?? []))
    offset = data.offset
  } while (offset)

  return records
}

export function recordHasTeacher(value: string | string[] | null | undefined, teacherId: string) {
  if (!value) {
    return false
  }

  if (Array.isArray(value)) {
    return value.includes(teacherId)
  }

  return value === teacherId
}

export function studentBelongsToTeacher(record: any, teacherId: string) {
  const teacherReference = record.fields?.LärareRecordID ?? record.fields?.Lärare
  return recordHasTeacher(teacherReference, teacherId)
}

export function lessonBelongsToTeacher(record: any, teacherId: string) {
  return recordHasTeacher(record.fields?.Lärare, teacherId)
}

export function lessonMatchesStudent(record: any, studentId: string) {
  const fieldValue = record.fields?.Elev

  if (!fieldValue) {
    return false
  }

  if (Array.isArray(fieldValue)) {
    return fieldValue.includes(studentId)
  }

  return fieldValue === studentId
}
