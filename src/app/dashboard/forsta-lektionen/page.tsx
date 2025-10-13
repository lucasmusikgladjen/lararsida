'use client'

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'

const WEEKDAYS: { label: string; value: string }[] = [
  { label: 'Måndag', value: 'monday' },
  { label: 'Tisdag', value: 'tuesday' },
  { label: 'Onsdag', value: 'wednesday' },
  { label: 'Torsdag', value: 'thursday' },
  { label: 'Fredag', value: 'friday' },
  { label: 'Lördag', value: 'saturday' },
  { label: 'Söndag', value: 'sunday' },
]

const CHECKLIST_ITEMS = [
  'Välkomna elev och eventuell vårdnadshavare – skapa trygg stämning.',
  'Gå igenom mål för terminen och stäm av förväntningar.',
  'Bekräfta ordinarie lektionstid och reservtid.',
  'Gör en snabb nulägesanalys av elevens nivå.',
  'Presentera första veckornas upplägg och eventuellt material.',
  'Säkerställ att kontaktuppgifter och kommunikationskanaler fungerar.',
  'Planera hur uppföljning ska ske inför lektion två.',
]

type StudentRecordFields = {
  Namn?: string
  Instrument?: string
  LärareRecordID?: string | string[]
  Lärare?: string | string[]
}

type StudentRecord = {
  id: string
  fields: StudentRecordFields
}

type StatusMessage = {
  type: 'success' | 'error'
  message: string
}

const INITIAL_FORM_STATE = {
  studentId: '',
  firstLessonDate: '',
  firstLessonTime: '',
  ordinaryWeekday: '',
  ordinaryTime: '',
  backupTime: '',
  arrangement: '',
  termGoal: '',
  notes: '',
}

export default function FirstLessonPage() {
  const { data: session } = useSession()
  const [students, setStudents] = useState<StudentRecord[]>([])
  const [loadingStudents, setLoadingStudents] = useState(true)
  const [formData, setFormData] = useState(INITIAL_FORM_STATE)
  const [status, setStatus] = useState<StatusMessage | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const loadStudents = async () => {
      if (!session?.user?.teacherId) {
        return
      }

      try {
        setLoadingStudents(true)
        const response = await fetch('/api/students?scope=assigned')

        if (!response.ok) {
          throw new Error('Kunde inte hämta elever')
        }

        const data = await response.json()
        const records: StudentRecord[] = data.records ?? []
        const teacherId = session?.user?.teacherId

        const assignedToMe = records.filter((record) => {
          const teacherRef = record.fields['LärareRecordID'] ?? record.fields['Lärare']

          if (!teacherId) {
            return false
          }

          if (Array.isArray(teacherRef)) {
            return teacherRef.includes(teacherId)
          }

          return teacherRef === teacherId
        })

        setStudents(assignedToMe)
      } catch (error) {
        console.error('Failed to fetch students for first lesson page', error)
        setStatus({ type: 'error', message: 'Kunde inte ladda elever. Försök igen senare.' })
      } finally {
        setLoadingStudents(false)
      }
    }

    loadStudents()
  }, [session?.user?.teacherId])

  const studentOptions = useMemo(
    () =>
      students
        .map((student) => ({
          id: student.id,
          name: student.fields?.Namn ?? 'Okänd elev',
          instrument: student.fields?.Instrument ?? '',
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'sv')),
    [students],
  )

  const handleInputChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const validateForm = () => {
    if (!formData.studentId) {
      return 'Välj en elev'
    }

    if (!formData.firstLessonDate || !formData.firstLessonTime) {
      return 'Fyll i datum och tid för första lektionen'
    }

    if (!formData.ordinaryWeekday || !formData.ordinaryTime) {
      return 'Ange ordinarie veckodag och tid för lektionerna'
    }

    return null
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setStatus(null)

    const validationError = validateForm()

    if (validationError) {
      setStatus({ type: 'error', message: validationError })
      return
    }

    try {
      setIsSubmitting(true)
      const response = await fetch('/api/first-lesson', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error ?? 'Ett fel uppstod vid sparandet')
      }

      const result = await response.json()
      const createdCount = result.lessonsCreated ?? 0

      setStatus({
        type: 'success',
        message:
          createdCount > 1
            ? `Första lektionen bokad och ${createdCount - 1} återkommande lektioner skapades.`
            : 'Första lektionen bokad.',
      })
      setFormData(INITIAL_FORM_STATE)
    } catch (error) {
      console.error('Failed to submit first lesson form', error)
      const message = error instanceof Error ? error.message : 'Ett oväntat fel uppstod.'
      setStatus({ type: 'error', message })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-bold text-gray-900">Första lektionen</h1>
        <p className="text-base text-gray-600">
          Använd checklistan inför första lektionen och fyll i formuläret tillsammans med vårdnadshavaren i slutet av
          lektionen för att skapa underlag till deras lektionsavtal. OBS: fyller du inte i formuläret så kommer inte
          lektionerna att kunna fortsätta.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-blue-900">Checklista</h2>
          <ul className="mt-4 space-y-3 text-sm text-blue-900/90">
            {CHECKLIST_ITEMS.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span className="mt-0.5 text-lg">✅</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">Planering av första lektionen</h2>

        {status && (
          <div
            className={`mt-4 rounded-lg border p-4 text-sm ${
              status.type === 'success'
                ? 'border-green-200 bg-green-50 text-green-800'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {status.message}
          </div>
        )}

        <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm font-medium text-gray-700">
              Elev
              <select
                name="studentId"
                value={formData.studentId}
                onChange={handleInputChange}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                disabled={loadingStudents || students.length === 0}
              >
                <option value="">Välj elev</option>
                {studentOptions.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name}
                    {student.instrument ? ` – ${student.instrument}` : ''}
                  </option>
                ))}
              </select>
              {loadingStudents && <span className="text-xs font-normal text-gray-500">Laddar elever…</span>}
              {!loadingStudents && students.length === 0 && (
                <span className="text-xs font-normal text-amber-600">
                  Inga elever tilldelade än. Koppla en elev för att aktivera formuläret.
                </span>
              )}
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium text-gray-700">
              Datum för första lektionen
              <input
                type="date"
                name="firstLessonDate"
                value={formData.firstLessonDate}
                onChange={handleInputChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium text-gray-700">
              Tid för första lektionen
              <input
                type="time"
                name="firstLessonTime"
                value={formData.firstLessonTime}
                onChange={handleInputChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium text-gray-700">
              Ordinarie veckodag
              <select
                name="ordinaryWeekday"
                value={formData.ordinaryWeekday}
                onChange={handleInputChange}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">Välj veckodag</option>
                {WEEKDAYS.map((weekday) => (
                  <option key={weekday.value} value={weekday.value}>
                    {weekday.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium text-gray-700">
              Ordinarie tid
              <input
                type="time"
                name="ordinaryTime"
                value={formData.ordinaryTime}
                onChange={handleInputChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium text-gray-700">
              Reservtid
              <input
                type="text"
                name="backupTime"
                value={formData.backupTime}
                onChange={handleInputChange}
                placeholder="Till exempel fredag 15.30"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm font-medium text-gray-700">
              Upplägg
              <select
                name="arrangement"
                value={formData.arrangement}
                onChange={handleInputChange}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">Välj upplägg</option>
                <option value="45-60 min">45-60 min</option>
                <option value="90 min">90 min</option>
                <option value="120 min">120 min</option>
              </select>
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium text-gray-700">
              Terminsmål
              <textarea
                name="termGoal"
                value={formData.termGoal}
                onChange={handleInputChange}
                rows={4}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </label>
          </div>

          <label className="flex flex-col gap-2 text-sm font-medium text-gray-700">
            Övriga anteckningar
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              rows={3}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </label>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting || loadingStudents || students.length === 0}
              className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {isSubmitting ? 'Skickar…' : 'Skicka planeringen'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
