'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'

import { LessonReportPayload, sendLessonReportToGuardian } from './utils/sendLessonReport'

export default function DashboardPage() {
  const { data: session } = useSession()
  const [adminMessage, setAdminMessage] = useState<any>(null)
  const [loadingMessage, setLoadingMessage] = useState(true)
  const [allLektioner, setAllLektioner] = useState<any[]>([]) // Alla lektioner cachade
  const [lektioner, setLektioner] = useState<any[]>([]) // Filtrerade lektioner för aktuell vecka
  const [loadingLektioner, setLoadingLektioner] = useState(true)
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0) // 0 = denna vecka, 1 = nästa vecka, -1 = förra veckan
  const [allStudents, setAllStudents] = useState<any[]>([]) // För att slå upp elevnamn
  const [expandedLesson, setExpandedLesson] = useState<string | null>(null) // Vilken lektion som är expanderad
  const [actionState, setActionState] = useState<{
    lessonId: string | null,
    action: 'genomförd' | 'ombokad' | 'inställd' | null,
    data: any
  }>({
    lessonId: null,
    action: null,
    data: {}
  })

  useEffect(() => {
    if (session?.user?.teacherId) {
      fetchAdminMessage()
      fetchStudents()
      fetchAllLektioner() // Hämta alla lektioner en gång
    }
  }, [session])

  useEffect(() => {
    if (allLektioner.length > 0) {
      filterLektionerForWeek() // Filtrera cachade lektioner när vecka ändras
    }
  }, [currentWeekOffset, allLektioner]) // Lyssna på veckoändring och cachade lektioner

  const fetchAdminMessage = async () => {
    try {
      setLoadingMessage(true)

      const response = await fetch('/api/admin-message')

      if (response.ok) {
        const data = await response.json()
        if (data?.fields) {
          setAdminMessage(data.fields)
        }
      }
    } catch (error) {
      console.error('Error fetching admin message:', error)
    } finally {
      setLoadingMessage(false)
    }
  }

  const convertMarkdownLinks = (text: string) => {
    // Konvertera markdown-länkar [text](url) till HTML-länkar
    return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 underline">$1</a>')
  }

  const fetchStudents = async () => {
    try {
      // Hämta alla elever för namn-lookup
      const response = await fetch('/api/students?scope=assigned')

      if (!response.ok) {
        throw new Error('Failed to fetch students')
      }

      const data = await response.json()
      setAllStudents(data.records || [])
    } catch (error) {
      console.error('Error fetching students:', error)
    }
  }

  const getStudentName = (elevId: string) => {
    const student = allStudents.find(s => s.id === elevId)
    return student?.fields?.Namn || 'Okänd elev'
  }

  const fetchAllLektioner = async () => {
    try {
      setLoadingLektioner(true)

      console.log('Hämtar alla lektioner från Airtable...')

      const response = await fetch('/api/lessons')

      if (!response.ok) {
        throw new Error('Failed to fetch lessons')
      }

      const data = await response.json()

      console.log('Mina alla lektioner (cachade):', (data.records || []).length)

      setAllLektioner(data.records || [])
      
    } catch (error) {
      console.error('Error fetching alla lektioner:', error)
    } finally {
      setLoadingLektioner(false)
    }
  }

  const filterLektionerForWeek = () => {
    // Beräkna start- och slutdatum baserat på currentWeekOffset
    const today = new Date()
    
    // Hitta måndag för aktuell vecka
    const currentMonday = new Date(today)
    const dayOfWeek = today.getDay()
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // Söndag = 0, så vi behöver gå tillbaka 6 dagar
    currentMonday.setDate(today.getDate() - daysFromMonday)
    
    // Lägg till veckooffset
    currentMonday.setDate(currentMonday.getDate() + (currentWeekOffset * 7))
    
    // Skapa start- och slutdatum för veckan
    const startDate = new Date(currentMonday)
    const endDate = new Date(currentMonday)
    endDate.setDate(startDate.getDate() + 6) // Måndag till söndag
    
    // Formatera datum som YYYY-MM-DD (lokal tid, inte UTC)
    const startDateStr = startDate.getFullYear() + '-' + 
      String(startDate.getMonth() + 1).padStart(2, '0') + '-' + 
      String(startDate.getDate()).padStart(2, '0')
    
    const endDateStr = endDate.getFullYear() + '-' + 
      String(endDate.getMonth() + 1).padStart(2, '0') + '-' + 
      String(endDate.getDate()).padStart(2, '0')
    
    console.log(`Filtrerar cachade lektioner för vecka: ${startDateStr} till ${endDateStr}`)
    
    // Filtrera cachade lektioner för vald vecka
    const weekLektioner = allLektioner.filter((record: any) => {
      const lektionDate = record.fields.Datum
      
      if (!lektionDate) {
        return false
      }
      
      // Kontrollera att det är inom vald vecka
      const isWithinPeriod = lektionDate >= startDateStr && lektionDate <= endDateStr
      
      return isWithinPeriod
    })
    
    console.log(`Lektioner för veckan ${startDateStr} - ${endDateStr}:`, weekLektioner.length)
    
    setLektioner(weekLektioner)
  }

  const handleActionConfirm = async (lessonId: string, action: string, data: any) => {
    // Hitta lektionen för att få tillgång till befintliga fält
    const currentLesson = allLektioner.find(l => l.id === lessonId)

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
        'Klockslag': data.tid || currentLesson?.fields?.Klockslag || '', // Uppdatera tid om angiven
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
        // Uppdatera även cachade lektioner
        setAllLektioner(prev => prev.map(lektion =>
          lektion.id === lessonId
            ? { ...lektion, fields: { ...lektion.fields, ...updates } }
            : lektion
        ))
        // Stäng dropdown och reset action state efter uppdatering
        setExpandedLesson(null)
        setActionState({ lessonId: null, action: null, data: {} })
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

  const getWeekDaysForOffset = (offset: number) => {
    const days = []
    const today = new Date()
    
    // Hitta måndag för aktuell vecka + offset
    const currentMonday = new Date(today)
    const dayOfWeek = today.getDay()
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    currentMonday.setDate(today.getDate() - daysFromMonday)
    
    // Lägg till veckooffset
    currentMonday.setDate(currentMonday.getDate() + (offset * 7))
    
    // Generera måndag till söndag
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentMonday)
      date.setDate(currentMonday.getDate() + i)
      days.push(date)
    }
    
    return days
  }

  const getWeekDays = () => {
    return getWeekDaysForOffset(currentWeekOffset)
  }

  const getWeekTitle = () => {
    const weekDays = getWeekDays()
    const today = new Date()
    
    // Kontrollera om dagens datum finns i denna vecka
    const isCurrentWeek = weekDays.some(day => 
      day.toDateString() === today.toDateString()
    )
    
    if (isCurrentWeek) {
      return "Denna vecka"
    } else if (currentWeekOffset === 1) {
      return "Nästa vecka"
    } else if (currentWeekOffset === -1) {
      return "Förra veckan"
    } else if (currentWeekOffset > 1) {
      return `${Math.abs(currentWeekOffset)} veckor framåt`
    } else if (currentWeekOffset < -1) {
      return `${Math.abs(currentWeekOffset)} veckor bakåt`
    } else {
      const startDate = weekDays[0]
      const endDate = weekDays[6]
      return `${startDate.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })} - ${endDate.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}`
    }
  }

  const getLektionerForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0]
    return lektioner.filter((lektion: any) => lektion.fields.Datum === dateStr)
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const weekDays = getWeekDays()

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pb-10 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100 sm:p-6">
        <h1 className="mb-2 text-xl font-bold text-gray-900 sm:text-3xl">
          Välkommen tillbaka, {session?.user?.name}! 👋
        </h1>

      </div>

      {/* Admin Message */}
      {loadingMessage ? (
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-center justify-center gap-3 text-sm text-gray-700">
            <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-gray-600"></div>
            <span>Laddar meddelande...</span>
          </div>
        </div>
      ) : adminMessage ? (
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 sm:p-6">
          <div className="flex flex-col gap-2 sm:gap-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
              <div className="space-y-1 text-left">
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500">📢 Meddelande från HQ</span>
                <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">
                  {adminMessage.Rubrik || 'Meddelande från administrationen'}
                </h2>
              </div>
              {adminMessage.Datum && (
                <span className="text-xs font-medium text-gray-600 sm:text-sm sm:leading-6">
                  {formatDate(adminMessage.Datum)}
                </span>
              )}
            </div>

            {/* Meddelande */}
            <div
              className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800 sm:text-base"
              dangerouslySetInnerHTML={{
                __html: convertMarkdownLinks(adminMessage.Meddelande || 'Inget meddelande tillgängligt')
              }}
            />

            {/* Länk/Knapp - nu över bilden */}
            {adminMessage.Länk && (
              <div className="sm:flex sm:justify-start">
                <a
                  href={adminMessage.Länk}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gray-800 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-900 sm:w-auto sm:px-4"
                >
                  <span>{adminMessage.Länktext || 'Läs mer'}</span>
                  <span aria-hidden className="text-white">→</span>
                </a>
              </div>
            )}

            {/* Bild - nu under knappen */}
            {adminMessage.Bild && adminMessage.Bild.length > 0 && (
              <div className="overflow-hidden rounded-xl">
                <img
                  src={adminMessage.Bild[0].url}
                  alt="Meddelande bild"
                  className="h-auto w-full object-cover"
                  style={{ maxHeight: '320px' }}
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white/70 p-4 sm:p-6">
          <div className="flex flex-col items-center gap-2 text-center text-sm text-gray-500">
            <span className="text-2xl">📭</span>
            <p>Inga nya meddelanden från administrationen</p>
          </div>
        </div>
      )}

      {/* Schema */}
      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100 sm:p-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-center sm:text-left">
            <h2 className="text-lg font-semibold text-gray-900 sm:text-2xl">Ditt schema</h2>
            <p className="text-sm text-gray-500 sm:text-base">Navigera mellan veckor och håll koll på varje lektion.</p>
          </div>

          <div className="flex flex-col gap-3 sm:items-end sm:gap-4">
            <div className="flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row sm:gap-4">
              <div className="flex w-full items-center gap-3 rounded-2xl border border-gray-200 bg-white/70 px-3 py-2 shadow-sm backdrop-blur-sm sm:w-auto sm:px-4">
                <button
                  type="button"
                  onClick={() => setCurrentWeekOffset(currentWeekOffset - 1)}
                  className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-40 sm:h-10 sm:w-10"
                  aria-label="Visa föregående vecka"
                  disabled={loadingLektioner}
                >
                  <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M12.5 5L7.5 10L12.5 15" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                <div className="flex min-w-0 flex-1 flex-col text-center sm:min-w-[220px]">
                  <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Veckoöversikt</span>
                  <span className="text-sm font-semibold text-gray-900 sm:text-base">{getWeekTitle()}</span>
                  <span className="text-xs text-gray-600 sm:text-sm">
                    {weekDays[0].toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })} – {weekDays[6].toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentWeekOffset(currentWeekOffset + 1)}
                  className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-40 sm:h-10 sm:w-10"
                  aria-label="Visa nästa vecka"
                  disabled={loadingLektioner}
                >
                  <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M7.5 5L12.5 10L7.5 15" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>

              {currentWeekOffset !== 0 && (
                <button
                  onClick={() => {
                    // Hitta vilken vecka som innehåller idag
                    const today = new Date()
                    let testOffset = 0

                    // Testa olika offsets för att hitta veckan som innehåller idag
                    for (let i = -10; i <= 10; i++) {
                      const testDays = getWeekDaysForOffset(i)
                      if (testDays.some(day => day.toDateString() === today.toDateString())) {
                        testOffset = i
                        break
                      }
                    }

                    setCurrentWeekOffset(testOffset)
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 transition hover:border-blue-200 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60 sm:px-4"
                  disabled={loadingLektioner}
                >
                  <span>Hoppa till denna vecka</span>
                </button>
              )}
            </div>
          </div>
        </div>
        
        {loadingLektioner ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
            <span className="text-gray-600">Laddar schema...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {weekDays.map((day, index) => {
              const dayLektioner = getLektionerForDate(day)
              const isToday = day.toDateString() === new Date().toDateString()
              
              return (
                <div key={index} className={`rounded-xl border p-3 shadow-sm transition sm:p-4 ${isToday ? 'border-gray-300 bg-gray-50/80' : 'border-gray-200 bg-white'}`}>
                  <div className="mb-3">
                    <h3 className={`text-base font-medium capitalize sm:text-lg ${isToday ? 'text-gray-900' : 'text-gray-900'}`}>
                      {day.toLocaleDateString('sv-SE', { weekday: 'long', month: 'long', day: 'numeric' })}
                      {isToday && <span className="ml-2 text-xs text-gray-500 sm:text-sm">(Idag)</span>}
                    </h3>
                  </div>

                  {dayLektioner.length > 0 ? (
                    <div className="space-y-3">
                      {dayLektioner.map((lektion: any) => {
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
                                <div className="flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-medium">
                                      {elevNamn}
                                    </span>
                                    <span className="text-sm text-gray-500">
                                      {lektion.fields.Klockslag || 'Ingen tid angiven'}
                                    </span>
                                  </div>
                                  {lektion.fields['Anledning ombokning'] && (
                                    <div className="text-sm text-gray-600 mt-1">
                                      Ombokad från ursprungligt datum - Anledning: {lektion.fields['Anledning ombokning']}
                                    </div>
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
                            
                            {/* Dropdown content - direkt under utan gap */}
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
                                    {/* Huvudknappar */}
                                    {actionState.lessonId !== lektion.id && (
                                      <div className="space-y-3">
                                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
                                          <button
                                            onClick={() => setActionState({
                                              lessonId: lektion.id,
                                              action: 'genomförd',
                                              data: {}
                                            })}
                                            className="w-full rounded-lg bg-green-600 px-3 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-green-700 sm:px-4 sm:py-3"
                                          >
                                            ✅ Genomförd
                                          </button>

                                          <button
                                            onClick={() => setActionState({
                                              lessonId: lektion.id, 
                                              action: 'ombokad', 
                                              data: {} 
                                            })}
                                            className="w-full rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 sm:px-4 sm:py-3"
                                          >
                                            📅 Boka om
                                          </button>

                                          <button
                                            onClick={() => setActionState({
                                              lessonId: lektion.id, 
                                              action: 'inställd', 
                                              data: {} 
                                            })}
                                            className="w-full rounded-lg bg-red-600 px-3 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-red-700 sm:px-4 sm:py-3"
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
                                        <div className="flex flex-col gap-2 sm:flex-row">
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
                                              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                                              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                                        <div className="flex flex-col gap-2 sm:flex-row">
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
                                        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 sm:p-4">
                                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                                            <div className="text-xl sm:pt-1">⚠️</div>
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
                                              <label className="flex items-center gap-2">
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
                                                <span className="text-sm text-gray-700">Lärare ställer in</span>
                                              </label>
                                              <label className="flex items-center gap-2">
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
                                                <span className="text-sm text-gray-700">Vårdnadshavare ställer in</span>
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
                                        <div className="flex flex-col gap-2 sm:flex-row">
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
                        
                      })}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}