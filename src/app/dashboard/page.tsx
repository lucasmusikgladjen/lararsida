'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'

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
      
      // Hämta admin-meddelanden från Airtable
      // Vi antar att det finns en tabell som heter "Admin_Meddelanden" eller liknande
      const response = await fetch(`https://api.airtable.com/v0/${process.env.NEXT_PUBLIC_AIRTABLE_BASE_ID}/Admin_Meddelanden?maxRecords=1&sort%5B0%5D%5Bfield%5D=Datum&sort%5B0%5D%5Bdirection%5D=desc`, {
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_AIRTABLE_API_KEY}`,
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.records && data.records.length > 0) {
          setAdminMessage(data.records[0].fields)
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
      let allRecords: any[] = []
      let offset = ''
      
      do {
        const url = `https://api.airtable.com/v0/${process.env.NEXT_PUBLIC_AIRTABLE_BASE_ID}/Elev${offset ? `?offset=${offset}` : ''}`
        
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_AIRTABLE_API_KEY}`,
          },
        })
        
        if (response.ok) {
          const data = await response.json()
          allRecords = allRecords.concat(data.records)
          offset = data.offset || ''
        } else {
          break
        }
      } while (offset)
      
      setAllStudents(allRecords)
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
      
      // Hämta alla lektioner från Airtable
      let allLektionerFromAPI: any[] = []
      let offset = ''
      
      do {
        const url = `https://api.airtable.com/v0/${process.env.NEXT_PUBLIC_AIRTABLE_BASE_ID}/Lektioner${offset ? `?offset=${offset}` : ''}`
        
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_AIRTABLE_API_KEY}`,
          },
        })
        
        if (response.ok) {
          const data = await response.json()
          allLektionerFromAPI = allLektionerFromAPI.concat(data.records)
          offset = data.offset || ''
        } else {
          break
        }
      } while (offset)
      
      console.log('Alla lektioner från Airtable:', allLektionerFromAPI.length)
      
      // Filtrera mina lektioner och cacha dem
      const myLektioner = allLektionerFromAPI.filter((record: any) => {
        const teacherField = record.fields.Lärare
        
        // Kontrollera att det är min lektion
        const isMyLesson = Array.isArray(teacherField) 
          ? teacherField.includes(session?.user?.teacherId)
          : teacherField === session?.user?.teacherId
        
        return isMyLesson
      })
      
      console.log('Mina alla lektioner (cachade):', myLektioner.length)
      
      setAllLektioner(myLektioner)
      
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
    
    if (action === 'genomförd') {
      updates = {
        'Genomförd': true,
        'Inställd': false,
        'Ombokad till': null,
        'Läxa': data.läxa || '',
        'Lektionsanteckning': data.lektionsanteckning || '',
        'Anledning ombokning': null,
        'Anledning inställd': null
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
    
    await updateLessonStatus(lessonId, updates)
    setActionState({ lessonId: null, action: null, data: {} })
  }

  const resetActionState = () => {
    setActionState({ lessonId: null, action: null, data: {} })
  }

  const updateLessonStatus = async (lessonId: string, updates: any) => {
    try {
      const response = await fetch(`https://api.airtable.com/v0/${process.env.NEXT_PUBLIC_AIRTABLE_BASE_ID}/Lektioner/${lessonId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_AIRTABLE_API_KEY}`,
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
      } else {
        console.error('Failed to update lesson')
      }
    } catch (error) {
      console.error('Error updating lesson:', error)
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

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Välkommen tillbaka, {session?.user?.name}! 👋
        </h1>
       
      </div>

      {/* Admin Message */}
      {loadingMessage ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-600 mr-3"></div>
            <span className="text-gray-800">Laddar meddelande...</span>
          </div>
        </div>
      ) : adminMessage ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-start">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="flex items-center mb-1">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">📢 Meddelande från HQ</span>
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {adminMessage.Rubrik || 'Meddelande från administrationen'}
                  </h2>
                </div>
                {adminMessage.Datum && (
                  <span className="text-sm text-gray-700">
                    {formatDate(adminMessage.Datum)}
                  </span>
                )}
              </div>
              
              {/* Meddelande */}
              <div 
                className="text-gray-800 mb-4 whitespace-pre-wrap"
                dangerouslySetInnerHTML={{
                  __html: convertMarkdownLinks(adminMessage.Meddelande || 'Inget meddelande tillgängligt')
                }}
              />
              
              {/* Länk/Knapp - nu över bilden */}
              {adminMessage.Länk && (
                <div className="mb-4">
                  <a 
                    href={adminMessage.Länk}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-between px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-800 transition-colors"
                  >
                    <span>{adminMessage.Länktext || 'Läs mer'}</span>
                    <span className="ml-2 text-white">→</span>
                  </a>
                </div>
              )}
              
              {/* Bild - nu under knappen */}
              {adminMessage.Bild && adminMessage.Bild.length > 0 && (
                <div className="mb-4">
                  <img 
                    src={adminMessage.Bild[0].url} 
                    alt="Meddelande bild"
                    className="max-w-full h-auto rounded-lg shadow-sm"
                    style={{ maxHeight: '300px' }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="text-center text-gray-500">
            <span className="text-2xl">📭</span>
            <p className="mt-2">Inga nya meddelanden från administrationen</p>
          </div>
        </div>
      )}

      {/* Schema */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Ditt schema</h2>
          
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setCurrentWeekOffset(currentWeekOffset - 1)}
              className="p-2 rounded-md hover:bg-gray-100 transition-colors"
              disabled={loadingLektioner}
            >
              <span className="text-gray-600">← Förra veckan</span>
            </button>
            
            <div className="text-center min-w-[200px]">
              <div className="font-medium text-gray-900">{getWeekTitle()}</div>
              <div className="text-sm text-gray-500">
                {getWeekDays()[0].toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })} - {getWeekDays()[6].toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}
              </div>
            </div>
            
            <button
              onClick={() => setCurrentWeekOffset(currentWeekOffset + 1)}
              className="p-2 rounded-md hover:bg-gray-100 transition-colors"
              disabled={loadingLektioner}
            >
              <span className="text-gray-600">Nästa vecka →</span>
            </button>
            
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
                className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
                disabled={loadingLektioner}
              >
                Idag
              </button>
            )}
          </div>
        </div>
        
        {loadingLektioner ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
            <span className="text-gray-600">Laddar schema...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {getWeekDays().map((day, index) => {
              const dayLektioner = getLektionerForDate(day)
              const isToday = day.toDateString() === new Date().toDateString()
              
              return (
                <div key={index} className={`border rounded-lg p-4 ${isToday ? 'border-gray-300 bg-gray-50' : 'border-gray-200'}`}>
                  <div className="mb-3">
                    <h3 className={`font-medium ${isToday ? 'text-gray-900' : 'text-gray-900'}`}>
                      {day.toLocaleDateString('sv-SE', { weekday: 'long', month: 'long', day: 'numeric' })}
                      {isToday && <span className="ml-2 text-sm text-gray-500">(Idag)</span>}
                    </h3>
                  </div>
                  
                  {dayLektioner.length > 0 ? (
                    <div className="space-y-2">
                      {dayLektioner.map((lektion: any) => {
                        const status = getLektionStatus(lektion)
                        const elevId = Array.isArray(lektion.fields.Elev) ? lektion.fields.Elev[0] : lektion.fields.Elev
                        const elevNamn = getStudentName(elevId)
                        
                        return (
                          <div key={lektion.id} className="space-y-0">
                            <div 
                              className={`p-3 rounded-t-md border cursor-pointer hover:shadow-sm transition-shadow ${
                                expandedLesson === lektion.id 
                                  ? 'border-b-0 ' + status.color 
                                  : status.color
                              } ${expandedLesson === lektion.id ? 'rounded-b-none' : 'rounded-b-md'}`}
                              onClick={() => setExpandedLesson(expandedLesson === lektion.id ? null : lektion.id)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2">
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
                                <div className="flex items-center space-x-2">
                                  <span className="text-xs font-medium capitalize">
                                    {status.status}
                                  </span>
                                  <span className="text-gray-400 text-sm">
                                    {expandedLesson === lektion.id ? '▼' : '▶'}
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            {/* Dropdown content - direkt under utan gap */}
                            {expandedLesson === lektion.id && (
                              <div className={`bg-white border border-t-0 rounded-b-md p-4 shadow-sm ${
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
                                        <div className="grid grid-cols-3 gap-3">
                                          <button
                                            onClick={() => setActionState({ 
                                              lessonId: lektion.id, 
                                              action: 'genomförd', 
                                              data: {} 
                                            })}
                                            className="px-4 py-3 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors font-medium"
                                          >
                                            ✅ Genomförd
                                          </button>
                                          
                                          <button
                                            onClick={() => setActionState({ 
                                              lessonId: lektion.id, 
                                              action: 'ombokad', 
                                              data: {} 
                                            })}
                                            className="px-4 py-3 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
                                          >
                                            📅 Boka om
                                          </button>
                                          
                                          <button
                                            onClick={() => setActionState({ 
                                              lessonId: lektion.id, 
                                              action: 'inställd', 
                                              data: {} 
                                            })}
                                            className="px-3 py-3 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
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
                                        <div className="flex space-x-2">
                                          <button
                                            onClick={() => handleActionConfirm(lektion.id, 'genomförd', actionState.data)}
                                            disabled={!actionState.data.lektionsanteckning}
                                            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                          >
                                            Bekräfta genomförd
                                          </button>
                                          <button
                                            onClick={resetActionState}
                                            className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
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
                                        <div className="flex space-x-2">
                                          <button
                                            onClick={() => handleActionConfirm(lektion.id, 'ombokad', actionState.data)}
                                            disabled={!actionState.data.datum || !actionState.data.anledning}
                                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                          >
                                            Bekräfta ombokning
                                          </button>
                                          <button
                                            onClick={resetActionState}
                                            className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
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
                                        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                                          <div className="flex">
                                            <div className="flex-shrink-0">
                                              <span className="text-yellow-400">⚠️</span>
                                            </div>
                                            <div className="ml-3">
                                              <h4 className="text-sm font-medium text-yellow-800">Prova dessa alternativ först:</h4>
                                              <ul className="mt-2 text-sm text-yellow-700 list-disc list-inside space-y-1">
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
                                        <div className="flex space-x-2">
                                          <button
                                            onClick={() => handleActionConfirm(lektion.id, 'inställd', actionState.data)}
                                            disabled={!actionState.data.anledning || !actionState.data.vemStällerIn}
                                            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                          >
                                            Bekräfta inställning
                                          </button>
                                          <button
                                            onClick={resetActionState}
                                            className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
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