'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'

import { LessonReportPayload, sendLessonReportToGuardian } from '../utils/sendLessonReport'

export default function AllaLektionerPage() {
  const { data: session } = useSession()
  
  const [lektioner, setLektioner] = useState<any[]>([])
  const [filteredLektioner, setFilteredLektioner] = useState<any[]>([])
  const [allStudents, setAllStudents] = useState<any[]>([])
  const [myStudents, setMyStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('tidigare')
  const [expandedLesson, setExpandedLesson] = useState<string | null>(null)
  const [showScheduleManager, setShowScheduleManager] = useState(false)
  const [activeScheduleAction, setActiveScheduleAction] = useState<'update' | 'add' | 'cancel'>('update')
  const [actionState, setActionState] = useState<{
    lessonId: string | null,
    action: 'genomförd' | 'ombokad' | 'inställd' | null,
    data: any
  }>({
    lessonId: null,
    action: null,
    data: {}
  })

  // Form states
  const [updateForm, setUpdateForm] = useState({
    elevId: '',
    arrangement: '',
    weekday: '',
    time: '',
    loading: false
  })

  const [addForm, setAddForm] = useState({
    elevId: '',
    firstDate: '',
    time: '',
    arrangement: '',
    repeatFullTerm: false,
    loading: false
  })

  const [cancelForm, setCancelForm] = useState({
    elevId: '',
    confirmed: false,
    loading: false
  })

  const selectedAddWeekday = useMemo(() => {
    if (!addForm.firstDate) {
      return ''
    }

    const date = new Date(`${addForm.firstDate}T00:00:00`)

    if (Number.isNaN(date.getTime())) {
      return ''
    }

    return date.toLocaleDateString('sv-SE', { weekday: 'long' })
  }, [addForm.firstDate])

  const formattedAddWeekday = useMemo(() => {
    if (!selectedAddWeekday) {
      return ''
    }

    return selectedAddWeekday.charAt(0).toUpperCase() + selectedAddWeekday.slice(1)
  }, [selectedAddWeekday])

  useEffect(() => {
    if (session?.user?.teacherId) {
      fetchAllData()
    }
  }, [session])

  useEffect(() => {
    filterLektioner()
  }, [lektioner, filter])

  const fetchAllData = async () => {
    try {
      setLoading(true)
      await Promise.all([
        fetchStudents(),
        fetchLektioner()
      ])
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchStudents = async () => {
    try {
      const response = await fetch('/api/students?scope=assigned')

      if (!response.ok) {
        throw new Error('Failed to fetch students')
      }

      const data = await response.json()
      const records = data.records || []

      setAllStudents(records)

      const myStudents = records.filter((record: any) => {
        const teacherRecordId = record.fields?.LärareRecordID

        if (Array.isArray(teacherRecordId)) {
          return teacherRecordId.includes(session?.user?.teacherId)
        }

        return teacherRecordId === session?.user?.teacherId
      })

      setMyStudents(myStudents)
    } catch (error) {
      console.error('Error fetching students:', error)
    }
  }

  const fetchLektioner = async () => {
    try {
      const response = await fetch('/api/lessons')

      if (!response.ok) {
        throw new Error('Failed to fetch lessons')
      }

      const data = await response.json()

      const myLektioner = (data.records || [])
        .sort((a: any, b: any) => new Date(b.fields.Datum).getTime() - new Date(a.fields.Datum).getTime())

      setLektioner(myLektioner)
    } catch (error) {
      console.error('Error fetching lektioner:', error)
    }
  }

  const filterLektioner = () => {
    const today = new Date().toISOString().split('T')[0]
    
    let filtered = lektioner
    
    switch (filter) {
      case 'kommande':
        filtered = lektioner.filter(l => l.fields.Datum >= today)
        break
      case 'tidigare':
        filtered = lektioner.filter(l => l.fields.Datum < today)
        break
      case 'genomförda':
        filtered = lektioner.filter(l => l.fields.Genomförd)
        break
      case 'inställda':
        filtered = lektioner.filter(l => l.fields.Inställd)
        break
      default:
        filtered = lektioner
    }
    
    setFilteredLektioner(filtered)
  }

  const getStudentName = (elevId: string) => {
    const student = allStudents.find(s => s.id === elevId)
    return student?.fields?.Namn || 'Okänd elev'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('sv-SE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getLektionStatus = (lektion: any) => {
    if (lektion.fields.Genomförd) {
      return { status: 'genomförd', color: 'bg-green-100 text-green-800 border-green-200' }
    } else if (lektion.fields.Inställd) {
      return { status: 'inställd', color: 'bg-red-100 text-red-800 border-red-200' }
    } else if (lektion.fields['Anledning ombokning']) {
      // Om det finns en ombokningsanledning så är lektionen ombokad (även om datumet nu är uppdaterat)
      return { status: 'ombokad', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' }
    } else {
      return { status: 'planerad', color: 'bg-blue-100 text-blue-800 border-blue-200' }
    }
  }

  const handleActionConfirm = async (lessonId: string, action: string, data: any) => {
    // Hitta lektionen för att få tillgång till befintliga fält
    const currentLesson = lektioner.find(l => l.id === lessonId)

    let updates: any = {}
    let reportPayload: LessonReportPayload | null = null

    if (action === 'genomförd') {
      const notes = data.lektionsanteckning || ''
      const homework = data.läxa || ''

      updates = {
        'Genomförd': true,
        'Inställd': false,
        'Ombokad till': null,
        'Läxa': homework,
        'Lektionsanteckning': notes,
        'Anledning ombokning': null,
        'Anledning inställd': null
      }

      reportPayload = {
        lessonId,
        notes,
        homework,
      }
    } else if (action === 'ombokad') {
      updates = {
        'Datum': data.datum, // Ändra faktiska datumet istället för "Ombokad till"
        'Klockslag': data.tid || currentLesson?.fields?.Klockslag || '',
        'Anledning ombokning': data.anledning,
        'Genomförd': false,
        'Inställd': false,
        'Ombokad till': null // Rensa det gamla fältet
      }
    } else if (action === 'inställd') {
      updates = {
        'Inställd': true,
        'Anledning inställd': data.anledning,
        'Genomförd': false,
        'Ombokad till': null,
        'Anledning ombokning': null
      }
    }

    const wasUpdated = await updateLessonStatus(lessonId, updates)

    if (wasUpdated && reportPayload) {
      await sendLessonReportToGuardian(reportPayload)
    }

    setActionState({ lessonId: null, action: null, data: {} })
  }

  const resetActionState = () => {
    setActionState({ lessonId: null, action: null, data: {} })
  }

  const updateLessonStatus = async (lessonId: string, updates: any) => {
    try {
      const response = await fetch(`/api/lessons/${lessonId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: updates
        })
      })

      if (response.ok) {
        // Uppdatera lokal state
        setLektioner(prev => prev.map(lektion =>
          lektion.id === lessonId
            ? { ...lektion, fields: { ...lektion.fields, ...updates } }
            : lektion
        ))
        setExpandedLesson(null)
        return true
      } else {
        console.error('Failed to update lesson')
        return false
      }
    } catch (error) {
      console.error('Error updating lesson:', error)
      return false
    }
  }

  const formatDateOnly = (date: Date) => {
    return date.toISOString().split('T')[0]
  }

  const determineTermEndDate = (firstDate: Date) => {
    const year = firstDate.getFullYear()
    const month = firstDate.getMonth() + 1
    const day = firstDate.getDate()

    let termYear = year
    let termMonth = 6
    let termDay = 30

    if (month < 7) {
      termMonth = 6
      termDay = 30
    } else if (month < 12 || (month === 12 && day <= 20)) {
      termMonth = 12
      termDay = 20
    } else {
      termYear = year + 1
      termMonth = 6
      termDay = 30
    }

    return new Date(`${termYear}-${String(termMonth).padStart(2, '0')}-${String(termDay).padStart(2, '0')}T00:00:00`)
  }

  const chunk = <T,>(items: T[], size: number) => {
    const result: T[][] = []

    for (let i = 0; i < items.length; i += size) {
      result.push(items.slice(i, i + size))
    }

    return result
  }

  const resetScheduleForms = () => {
    setUpdateForm({ elevId: '', arrangement: '', weekday: '', time: '', loading: false })
    setAddForm({ elevId: '', firstDate: '', time: '', arrangement: '', repeatFullTerm: false, loading: false })
    setCancelForm({ elevId: '', confirmed: false, loading: false })
  }

  const handleCloseScheduleModal = () => {
    setShowScheduleManager(false)
    setActiveScheduleAction('update')
    resetScheduleForms()
  }

  const handleOpenScheduleModal = () => {
    resetScheduleForms()
    setActiveScheduleAction('update')
    setShowScheduleManager(true)
  }

  const addRecurringLessons = async () => {
    if (!addForm.elevId) {
      alert('Välj en elev')
      return
    }

    if (!addForm.firstDate) {
      alert('Välj startdatum')
      return
    }

    if (!addForm.time) {
      alert('Välj tid')
      return
    }

    const teacherId = session?.user?.teacherId

    if (!teacherId) {
      alert('Kunde inte hitta lärarinformation. Logga ut och in igen.')
      return
    }

    const firstDate = new Date(`${addForm.firstDate}T00:00:00`)

    if (Number.isNaN(firstDate.getTime())) {
      alert('Ogiltigt startdatum')
      return
    }

    const lessonsPayload: Array<{ fields: Record<string, any> }> = []

    if (addForm.repeatFullTerm) {
      const termEnd = determineTermEndDate(firstDate)

      for (let current = new Date(firstDate); current <= termEnd; current.setDate(current.getDate() + 7)) {
        const fields: Record<string, any> = {
          Datum: formatDateOnly(current),
          Klockslag: addForm.time,
          Elev: [addForm.elevId],
          Lärare: [teacherId],
          Genomförd: false,
          Inställd: false,
        }

        if (addForm.arrangement) {
          fields['Upplägg'] = addForm.arrangement
        }

        lessonsPayload.push({ fields })
      }
    } else {
      const fields: Record<string, any> = {
        Datum: formatDateOnly(firstDate),
        Klockslag: addForm.time,
        Elev: [addForm.elevId],
        Lärare: [teacherId],
        Genomförd: false,
        Inställd: false,
      }

      if (addForm.arrangement) {
        fields['Upplägg'] = addForm.arrangement
      }

      lessonsPayload.push({ fields })
    }

    if (lessonsPayload.length === 0) {
      alert('Inga lektioner att skapa. Kontrollera datumet.')
      return
    }

    setAddForm(prev => ({ ...prev, loading: true }))

    try {
      const batches = chunk(lessonsPayload, 10)

      for (const batch of batches) {
        const response = await fetch('/api/lessons', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ records: batch })
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          console.error('Failed to create lessons', errorData)
          throw new Error('Kunde inte skapa lektioner')
        }
      }

      await fetchLektioner()
      handleCloseScheduleModal()
      alert(addForm.repeatFullTerm ? 'Lektioner tillagda fram till nästa termin!' : 'Lektion tillagd!')
    } catch (error) {
      console.error('Error creating lessons:', error)
      alert('Fel vid skapande av lektioner')
    } finally {
      setAddForm(prev => ({ ...prev, loading: false }))
    }
  }

  const deleteUpcomingLessons = async () => {
    if (!cancelForm.elevId) {
      alert('Välj en elev')
      return
    }

    if (!cancelForm.confirmed) {
      alert('Bekräfta att du vill radera lektionerna')
      return
    }

    const today = new Date().toISOString().split('T')[0]

    const lessonsToDelete = lektioner.filter(lektion => {
      const elevField = lektion.fields.Elev
      const elevId = Array.isArray(elevField) ? elevField[0] : elevField
      const isThisStudent = elevId === cancelForm.elevId
      const isFuture = lektion.fields.Datum >= today
      const notCompleted = !lektion.fields.Genomförd

      return isThisStudent && isFuture && notCompleted
    })

    if (lessonsToDelete.length === 0) {
      alert('Inga kommande lektioner att radera')
      return
    }

    setCancelForm(prev => ({ ...prev, loading: true }))

    try {
      const batches = chunk(lessonsToDelete.map(lektion => lektion.id), 10)

      for (const batch of batches) {
        const response = await fetch('/api/lessons', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ recordIds: batch })
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          console.error('Failed to delete lessons', errorData)
          throw new Error('Kunde inte radera lektioner')
        }
      }

      await fetchLektioner()
      handleCloseScheduleModal()
      alert('Alla kommande lektioner togs bort.')
    } catch (error) {
      console.error('Error deleting lessons:', error)
      alert('Fel vid radering av lektioner')
    } finally {
      setCancelForm(prev => ({ ...prev, loading: false }))
    }
  }

  const scheduleActions = [
    {
      key: 'update' as const,
      label: 'Justera upplägg/tid'
    },
    {
      key: 'add' as const,
      label: 'Skapa lektion'
    },
    {
      key: 'cancel' as const,
      label: 'Avsluta kommande lektioner'
    }
  ]

  const updateFutureLessons = async () => {
    if (!updateForm.elevId) {
      alert('Välj en elev')
      return
    }

    const hasArrangementChange = Boolean(updateForm.arrangement)
    const hasWeekdayChange = Boolean(updateForm.weekday)
    const hasTimeChange = Boolean(updateForm.time)

    if (!hasArrangementChange && !hasWeekdayChange && !hasTimeChange) {
      alert('Välj minst en ändring att genomföra')
      return
    }

    const today = new Date().toISOString().split('T')[0]

    const lessonsToUpdate = lektioner
      .filter(lektion => {
        const elevField = lektion.fields.Elev
        const elevId = Array.isArray(elevField) ? elevField[0] : elevField
        const isThisStudent = elevId === updateForm.elevId
        const isFuture = lektion.fields.Datum >= today
        const notCompleted = !lektion.fields.Genomförd

        return isThisStudent && isFuture && notCompleted
      })
      .sort((a, b) => new Date(a.fields.Datum).getTime() - new Date(b.fields.Datum).getTime())

    if (lessonsToUpdate.length === 0) {
      alert('Inga kommande lektioner att uppdatera')
      return
    }

    const weekdayMap: { [key: string]: number } = {
      'söndag': 0,
      'måndag': 1,
      'tisdag': 2,
      'onsdag': 3,
      'torsdag': 4,
      'fredag': 5,
      'lördag': 6
    }

    let firstTargetDate: Date | null = null
    let targetWeekdayIndex: number | undefined

    if (hasWeekdayChange) {
      targetWeekdayIndex = weekdayMap[updateForm.weekday.toLowerCase()]

      if (targetWeekdayIndex === undefined) {
        alert('Ogiltig veckodag vald')
        return
      }

      firstTargetDate = new Date(lessonsToUpdate[0].fields.Datum)

      while (firstTargetDate.getDay() !== targetWeekdayIndex) {
        firstTargetDate.setDate(firstTargetDate.getDate() + 1)
      }
    }

    setUpdateForm(prev => ({ ...prev, loading: true }))

    try {
      for (let index = 0; index < lessonsToUpdate.length; index++) {
        const lesson = lessonsToUpdate[index]
        const fields: Record<string, string> = {}

        if (hasWeekdayChange && firstTargetDate) {
          const nextDate = new Date(firstTargetDate)
          nextDate.setDate(nextDate.getDate() + index * 7)
          fields['Datum'] = formatDateOnly(nextDate)
        }

        if (hasTimeChange && updateForm.time) {
          fields['Klockslag'] = updateForm.time
        }

        if (hasArrangementChange && updateForm.arrangement) {
          fields['Upplägg'] = updateForm.arrangement
        }

        if (Object.keys(fields).length === 0) {
          continue
        }

        const response = await fetch(`/api/lessons/${lesson.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ fields })
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          console.error('Failed to update lesson', lesson.id, errorData)
          throw new Error('Kunde inte uppdatera lektioner')
        }
      }

      await fetchLektioner()
      handleCloseScheduleModal()
      alert('Lektioner uppdaterade!')
    } catch (error) {
      console.error('Error updating lessons:', error)
      alert('Fel vid uppdatering av lektioner')
    } finally {
      setUpdateForm(prev => ({ ...prev, loading: false }))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
        <span className="text-gray-600">Laddar lektioner...</span>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 pb-12 sm:px-6 lg:px-8">
      {/* Header med knappar */}
      <div className="rounded-2xl border border-gray-200 bg-white/80 p-4 shadow-sm ring-1 ring-gray-100 sm:p-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl font-bold text-gray-900 sm:text-3xl">Alla lektioner</h1>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
            <button
              onClick={handleOpenScheduleModal}
              className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 sm:w-auto sm:px-4 sm:text-base"
            >
              Hantera lektionsschema
            </button>
          </div>
        </div>

        {/* Filter */}
        <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
          {[
            { key: 'tidigare', label: 'Tidigare' },
            { key: 'kommande', label: 'Kommande' },
            { key: 'genomförda', label: 'Genomförda' },
            { key: 'inställda', label: 'Inställda' },
            { key: 'alla', label: 'Alla' }
          ].map((filterOption) => (
            <button
              key={filterOption.key}
              onClick={() => setFilter(filterOption.key)}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors sm:text-base ${
                filter === filterOption.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {filterOption.label}
            </button>
          ))}
        </div>
      </div>

      {/* Schemaläggningshanterare */}
      {showScheduleManager && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-6 sm:items-center">
          <div className="w-full max-w-3xl rounded-xl bg-white p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">Hantera lektionsschema</h2>
              </div>
              <button
                type="button"
                onClick={handleCloseScheduleModal}
                className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
              >
                Stäng
              </button>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              {scheduleActions.map((action) => (
                <button
                  key={action.key}
                  type="button"
                  onClick={() => setActiveScheduleAction(action.key)}
                  className={`flex h-full flex-col items-start rounded-lg border p-4 text-left transition-all ${
                    activeScheduleAction === action.key
                      ? 'border-blue-500 bg-blue-50 text-blue-900 shadow-sm'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800'
                  }`}
                >
                  <span className="text-sm font-semibold sm:text-base">{action.label}</span>
                </button>
              ))}
            </div>

            <div className="mt-6">
              {activeScheduleAction === 'update' && (
                <form
                  className="space-y-5"
                  onSubmit={(event) => {
                    event.preventDefault()
                    updateFutureLessons()
                  }}
                >
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Elev</label>
                    <select
                      value={updateForm.elevId}
                      onChange={(e) => setUpdateForm(prev => ({ ...prev, elevId: e.target.value }))}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Välj elev...</option>
                      {myStudents.map((student) => (
                        <option key={student.id} value={student.id}>
                          {student.fields.Namn}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="mb-2 block text-sm font-medium text-gray-700">Upplägg</label>
                      <select
                        value={updateForm.arrangement}
                        onChange={(e) => setUpdateForm(prev => ({ ...prev, arrangement: e.target.value }))}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Behåll nuvarande upplägg</option>
                        <option value="45-60 min">45-60 min</option>
                        <option value="90 min">90 min</option>
                        <option value="120 min">120 min</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">Veckodag</label>
                      <select
                        value={updateForm.weekday}
                        onChange={(e) => setUpdateForm(prev => ({ ...prev, weekday: e.target.value }))}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Behåll nuvarande veckodag</option>
                        <option value="måndag">Måndag</option>
                        <option value="tisdag">Tisdag</option>
                        <option value="onsdag">Onsdag</option>
                        <option value="torsdag">Torsdag</option>
                        <option value="fredag">Fredag</option>
                        <option value="lördag">Lördag</option>
                        <option value="söndag">Söndag</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">Tid</label>
                      <input
                        type="time"
                        value={updateForm.time}
                        onChange={(e) => setUpdateForm(prev => ({ ...prev, time: e.target.value }))}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
                    <p className="font-medium">Tips</p>
                    <p className="mt-1">Lämna fält tomma för att behålla nuvarande värde.</p>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
                    <button
                      type="submit"
                      disabled={updateForm.loading}
                      className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:text-base"
                    >
                      {updateForm.loading ? 'Sparar...' : 'Spara ändringar'}
                    </button>
                    <button
                      type="button"
                      onClick={handleCloseScheduleModal}
                      className="rounded-md bg-gray-500 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-600 sm:px-4 sm:text-base"
                    >
                      Avbryt
                    </button>
                  </div>
                </form>
              )}

              {activeScheduleAction === 'add' && (
                <form
                  className="space-y-5"
                  onSubmit={(event) => {
                    event.preventDefault()
                    addRecurringLessons()
                  }}
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="mb-2 block text-sm font-medium text-gray-700">Elev</label>
                      <select
                        value={addForm.elevId}
                        onChange={(e) => setAddForm(prev => ({ ...prev, elevId: e.target.value }))}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Välj elev...</option>
                        {myStudents.map((student) => (
                          <option key={student.id} value={student.id}>
                            {student.fields.Namn}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">Första lektionens datum</label>
                      <input
                        type="date"
                        value={addForm.firstDate}
                        onChange={(e) => setAddForm(prev => ({ ...prev, firstDate: e.target.value }))}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">Tid</label>
                      <input
                        type="time"
                        value={addForm.time}
                        onChange={(e) => setAddForm(prev => ({ ...prev, time: e.target.value }))}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="mb-2 block text-sm font-medium text-gray-700">Upplägg</label>
                      <select
                        value={addForm.arrangement}
                        onChange={(e) => setAddForm(prev => ({ ...prev, arrangement: e.target.value }))}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Valfritt – behåll nuvarande</option>
                        <option value="45-60 min">45-60 min</option>
                        <option value="90 min">90 min</option>
                        <option value="120 min">120 min</option>
                      </select>
                    </div>
                  </div>

                  <div className="rounded-lg border border-amber-100 bg-amber-50 p-4 text-sm text-amber-900">
                    <p className="font-medium">Så fungerar det</p>
                    <p className="mt-1">
                      Som standard lägger vi bara till en lektion på det datum du har valt.
                      Vill du att samma lektionstid ska fortsätta resten av terminen? Markera då <span className="font-semibold">Upprepa lektion hela terminen</span> så skapas en lektion varje vecka fram till nästa terminsslut.
                      {formattedAddWeekday && addForm.repeatFullTerm && (
                        <span className="block">Vald veckodag: {formattedAddWeekday}.</span>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <input
                      id="repeat-lessons"
                      type="checkbox"
                      checked={addForm.repeatFullTerm}
                      onChange={(event) => setAddForm(prev => ({ ...prev, repeatFullTerm: event.target.checked }))}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="repeat-lessons" className="text-sm font-medium text-gray-700">
                      Upprepa lektion hela terminen
                    </label>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
                    <button
                      type="submit"
                      disabled={addForm.loading}
                      className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:text-base"
                    >
                      {addForm.loading ? 'Skapar...' : 'Skapa lektion'}
                    </button>
                    <button
                      type="button"
                      onClick={handleCloseScheduleModal}
                      className="rounded-md bg-gray-500 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-600 sm:px-4 sm:text-base"
                    >
                      Avbryt
                    </button>
                  </div>
                </form>
              )}

              {activeScheduleAction === 'cancel' && (
                <form
                  className="space-y-5"
                  onSubmit={(event) => {
                    event.preventDefault()
                    deleteUpcomingLessons()
                  }}
                >
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Elev</label>
                    <select
                      value={cancelForm.elevId}
                      onChange={(e) => setCancelForm(prev => ({ ...prev, elevId: e.target.value, confirmed: false }))}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Välj elev...</option>
                      {myStudents.map((student) => (
                        <option key={student.id} value={student.id}>
                          {student.fields.Namn}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-900">
                    <p className="font-semibold">Detta går inte att ångra.</p>
                    <p className="mt-1">
                      Alla framtida lektioner för eleven tas bort, även de som är ombokade eller inställda men ännu inte genomförda.
                    </p>
                  </div>

                  <label className="flex items-center gap-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={cancelForm.confirmed}
                      onChange={(e) => setCancelForm(prev => ({ ...prev, confirmed: e.target.checked }))}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Jag förstår att lektionerna tas bort permanent.</span>
                  </label>

                  <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
                    <button
                      type="submit"
                      disabled={cancelForm.loading}
                      className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:text-base"
                    >
                      {cancelForm.loading ? 'Tar bort...' : 'Ta bort kommande lektioner'}
                    </button>
                    <button
                      type="button"
                      onClick={handleCloseScheduleModal}
                      className="rounded-md bg-gray-500 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-600 sm:px-4 sm:text-base"
                    >
                      Avbryt
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lektioner lista */}
      <div className="space-y-4">
        {filteredLektioner.length > 0 ? (
          filteredLektioner.map((lektion) => {
            const status = getLektionStatus(lektion)
            const elevId = Array.isArray(lektion.fields.Elev) ? lektion.fields.Elev[0] : lektion.fields.Elev
            const elevNamn = getStudentName(elevId)

            return (
              <div key={lektion.id} className="space-y-0">
                <div
                  className={`cursor-pointer rounded-t-xl border p-3 transition-shadow hover:shadow-md sm:p-4 ${
                    expandedLesson === lektion.id
                      ? 'border-b-0 ' + status.color
                      : status.color
                  } ${expandedLesson === lektion.id ? 'rounded-b-none' : 'rounded-b-xl'}`}
                  onClick={() => setExpandedLesson(expandedLesson === lektion.id ? null : lektion.id)}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <span className="text-base font-semibold text-gray-900 sm:text-lg">{elevNamn}</span>
                        <span className="text-sm text-gray-600 sm:text-base">{formatDate(lektion.fields.Datum)}</span>
                        {lektion.fields.Klockslag && (
                          <span className="text-xs text-gray-500 sm:text-sm">{lektion.fields.Klockslag}</span>
                        )}
                      </div>
                      {lektion.fields['Anledning ombokning'] && (
                        <p className="text-sm text-gray-600">
                          Ombokad från ursprungligt datum – Anledning: {lektion.fields['Anledning ombokning']}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 sm:justify-end">
                      <span className="rounded-full bg-white/70 px-2.5 py-1 text-xs font-semibold capitalize text-gray-700 shadow-sm">
                        {status.status}
                      </span>
                      <span className="text-sm text-gray-400">
                        {expandedLesson === lektion.id ? '▼' : '▶'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Dropdown content */}
                {expandedLesson === lektion.id && (
                  <div className={`rounded-b-xl border border-t-0 bg-white p-4 shadow-sm sm:p-5 ${
                    status.status === 'genomförd' ? 'border-green-200' :
                    status.status === 'inställd' ? 'border-red-200' :
                    status.status === 'ombokad' ? 'border-yellow-200' :
                    'border-blue-200'
                  }`}>
                    
                    {/* Kontrollera om lektionen är låst (genomförd eller inställd) */}
                    {(lektion.fields.Genomförd || lektion.fields.Inställd) ? (
                      /* LÅST LEKTION - Visa bara information */
                      <div className="space-y-3">
                        {/* Visa befintliga anteckningar för genomförda lektioner */}
                        {lektion.fields.Genomförd && (
                          <>
                            {lektion.fields.Lektionsanteckning && (
                              <div>
                                <h4 className="text-sm font-medium text-gray-700 mb-2">Lektionsanteckning:</h4>
                                <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
                                  <p className="text-gray-900 text-sm">{lektion.fields.Lektionsanteckning}</p>
                                </div>
                              </div>
                            )}
                            {lektion.fields.Läxa && (
                              <div>
                                <h4 className="text-sm font-medium text-gray-700 mb-2">Läxa:</h4>
                                <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
                                  <p className="text-gray-900 text-sm">{lektion.fields.Läxa}</p>
                                </div>
                              </div>
                            )}
                          </>
                        )}

                        {/* Visa anledning för inställda lektioner */}
                        {lektion.fields.Inställd && lektion.fields['Anledning inställd'] && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-2">Anledning för inställning:</h4>
                            <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
                              <p className="text-gray-900 text-sm">{lektion.fields['Anledning inställd']}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* OLÅST LEKTION - Visa vanliga knappar och funktionalitet */
                      <div>
                        {/* Huvudknappar - bara för planerade lektioner */}
                        {actionState.lessonId !== lektion.id && (
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
                              <button
                                onClick={() => setActionState({
                                  lessonId: lektion.id,
                                  action: 'genomförd',
                                  data: {}
                                })}
                                className="rounded-md bg-green-600 px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-700 sm:px-4 sm:py-3"
                              >
                                ✅ Genomförd
                              </button>

                              <button
                                onClick={() => setActionState({ 
                                  lessonId: lektion.id, 
                                  action: 'ombokad', 
                                  data: {} 
                                })}
                                className="rounded-md bg-blue-600 px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 sm:px-4 sm:py-3"
                              >
                                📅 Boka om
                              </button>

                              <button
                                onClick={() => setActionState({ 
                                  lessonId: lektion.id, 
                                  action: 'inställd', 
                                  data: {} 
                                })}
                                className="rounded-md bg-red-600 px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 sm:px-4 sm:py-3"
                              >
                                ❌ Ställ in
                              </button>
                            </div>
                          </div>
                        )}
                        
                        {/* Genomförd bekräftelse */}
                        {actionState.lessonId === lektion.id && actionState.action === 'genomförd' && (
                          <div className="space-y-4">
                            <div className="space-y-3">
                              {/* Vad gjorde ni på lektionen idag */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Vad gjorde ni på lektionen idag?
                                </label>
                                <textarea
                                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                  rows={3}
                                  placeholder=""
                                  defaultValue={lektion.fields.Lektionsanteckning || ''}
                                  onChange={(e) => setActionState(prev => ({
                                    ...prev,
                                    data: { ...prev.data, lektionsanteckning: e.target.value }
                                  }))}
                                />
                              </div>

                              {/* Läxa */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Läxa för nästa gång:
                                </label>
                                <textarea
                                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                  rows={2}
                                  placeholder=""
                                  defaultValue={lektion.fields.Läxa || ''}
                                  onChange={(e) => setActionState(prev => ({
                                    ...prev,
                                    data: { ...prev.data, läxa: e.target.value }
                                  }))}
                                />
                              </div>
                            </div>

                            {/* Bekräfta & Avbryt */}
                            <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
                              <button
                                onClick={() => handleActionConfirm(lektion.id, 'genomförd', actionState.data)}
                                disabled={!actionState.data.lektionsanteckning}
                                className="rounded-md bg-green-600 px-3 py-2 text-sm text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:text-base"
                              >
                                Bekräfta genomförd
                              </button>
                              <button
                                onClick={resetActionState}
                                className="rounded-md bg-gray-500 px-3 py-2 text-sm text-white transition-colors hover:bg-gray-600 sm:px-4 sm:text-base"
                              >
                                Avbryt
                              </button>
                            </div>
                          </div>
                        )}
                        
                        {/* Ombokning bekräftelse */}
                        {actionState.lessonId === lektion.id && actionState.action === 'ombokad' && (
                          <div className="space-y-4">
                            <div className="space-y-3">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Nytt datum:
                                </label>
                                <input
                                  type="date"
                                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  onChange={(e) => setActionState(prev => ({
                                    ...prev,
                                    data: { ...prev.data, datum: e.target.value }
                                  }))}
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Ny tid (valfritt):
                                </label>
                                <input
                                  type="time"
                                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  placeholder={lektion.fields.Klockslag || 'Behåll nuvarande tid'}
                                  onChange={(e) => setActionState(prev => ({
                                    ...prev,
                                    data: { ...prev.data, tid: e.target.value }
                                  }))}
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                  Lämna tom för att behålla nuvarande tid ({lektion.fields.Klockslag || 'ingen tid angiven'})
                                </p>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Anledning för ombokning:
                                </label>
                                <textarea
                                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  rows={2}
                                  placeholder=""
                                  onChange={(e) => setActionState(prev => ({
                                    ...prev,
                                    data: { ...prev.data, anledning: e.target.value }
                                  }))}
                                />
                              </div>
                            </div>
                            <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
                              <button
                                onClick={() => handleActionConfirm(lektion.id, 'ombokad', actionState.data)}
                                disabled={!actionState.data.datum || !actionState.data.anledning}
                                className="rounded-md bg-blue-600 px-3 py-2 text-sm text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:text-base"
                              >
                                Bekräfta ombokning
                              </button>
                              <button
                                onClick={resetActionState}
                                className="rounded-md bg-gray-500 px-3 py-2 text-sm text-white transition-colors hover:bg-gray-600 sm:px-4 sm:text-base"
                              >
                                Avbryt
                              </button>
                            </div>
                          </div>
                        )}
                        
                        {/* Inställd bekräftelse */}
                        {actionState.lessonId === lektion.id && actionState.action === 'inställd' && (
                          <div className="space-y-4">
                            {/* Varningstext */}
                            <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 sm:p-4">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                                <div className="text-lg sm:text-xl">⚠️</div>
                                <div>
                                  <h4 className="text-sm font-medium text-yellow-800">Prova dessa alternativ först:</h4>
                                  <ul className="mt-2 list-disc space-y-1 text-sm text-yellow-700 sm:ml-4">
                                    <li>Boka om till ett annat datum</li>
                                    <li>Kör dubbellektion nästa gång</li>
                                    <li>Lägg in en extralektion under lov eller helg</li>
                                    <li>Erbjud digital lektion via video</li>
                                  </ul>
                                </div>
                              </div>
                            </div>
                            
                            <div className="space-y-3">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Vem ställer in lektionen?
                                </label>
                                <div className="space-y-2">
                                  <label className="flex items-center">
                                    <input
                                      type="checkbox"
                                      className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                                      onChange={(e) => {
                                        const who = e.target.checked ? 'Lärare ställer in' : ''
                                        setActionState(prev => ({
                                          ...prev,
                                          data: { 
                                            ...prev.data, 
                                            vemStällerIn: who,
                                            anledning: who ? `${who}: ${prev.data.anledning || ''}`.replace(': ', ': ').trim() : prev.data.anledning?.replace('Lärare ställer in: ', '') || ''
                                          }
                                        }))
                                      }}
                                    />
                                    <span className="ml-2 text-sm text-gray-700">Lärare ställer in</span>
                                  </label>
                                  <label className="flex items-center">
                                    <input
                                      type="checkbox"
                                      className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                                      onChange={(e) => {
                                        const who = e.target.checked ? 'Vårdnadshavare ställer in' : ''
                                        setActionState(prev => ({
                                          ...prev,
                                          data: { 
                                            ...prev.data, 
                                            vemStällerIn: who,
                                            anledning: who ? `${who}: ${prev.data.anledning || ''}`.replace(': ', ': ').trim() : prev.data.anledning?.replace('Vårdnadshavare ställer in: ', '') || ''
                                          }
                                        }))
                                      }}
                                    />
                                    <span className="ml-2 text-sm text-gray-700">Vårdnadshavare ställer in</span>
                                  </label>
                                </div>
                              </div>
                              
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Anledning för inställning:
                                </label>
                                <textarea
                                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                                  rows={2}
                                  placeholder=""
                                  onChange={(e) => {
                                    const baseAnledning = e.target.value
                                    const vemStällerIn = actionState.data.vemStällerIn || ''
                                    const fullAnledning = vemStällerIn ? `${vemStällerIn}: ${baseAnledning}` : baseAnledning
                                    
                                    setActionState(prev => ({
                                      ...prev,
                                      data: { 
                                        ...prev.data, 
                                        anledning: fullAnledning,
                                        baseAnledning: baseAnledning
                                      }
                                    }))
                                  }}
                                />
                              </div>
                            </div>
                            <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
                              <button
                                onClick={() => handleActionConfirm(lektion.id, 'inställd', actionState.data)}
                                disabled={!actionState.data.anledning || !actionState.data.vemStällerIn}
                                className="rounded-md bg-red-600 px-3 py-2 text-sm text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:text-base"
                              >
                                Bekräfta inställning
                              </button>
                              <button
                                onClick={resetActionState}
                                className="rounded-md bg-gray-500 px-3 py-2 text-sm text-white transition-colors hover:bg-gray-600 sm:px-4 sm:text-base"
                              >
                                Avbryt
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white/80 p-6 text-center shadow-sm ring-1 ring-gray-100 sm:p-10">
            <span className="mb-4 block text-3xl sm:text-4xl">📅</span>
            <h3 className="mb-2 text-base font-medium text-gray-900 sm:text-lg">Inga lektioner hittades</h3>
            <p className="text-gray-500">
              {filter === 'alla'
                ? 'Du har inga lektioner registrerade ännu.'
                : `Inga lektioner matchar filtret "${filter}".`
              }
            </p>
          </div>
        )}
      </div>
    </div>
  )
}