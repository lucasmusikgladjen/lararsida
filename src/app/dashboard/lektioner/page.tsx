'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

export default function AllaLektionerPage() {
  const { data: session } = useSession()
  
  const [lektioner, setLektioner] = useState<any[]>([])
  const [filteredLektioner, setFilteredLektioner] = useState<any[]>([])
  const [allStudents, setAllStudents] = useState<any[]>([])
  const [myStudents, setMyStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('tidigare')
  const [expandedLesson, setExpandedLesson] = useState<string | null>(null)
  const [showNewLessonsForm, setShowNewLessonsForm] = useState(false)
  const [showBulkDelete, setShowBulkDelete] = useState(false)
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
  const [newLessonsForm, setNewLessonsForm] = useState({
    elevId: '',
    weekday: '',
    time: '',
    loading: false
  })
  
  const [bulkDeleteForm, setBulkDeleteForm] = useState({
    elevId: '',
    loading: false
  })

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
    
    await updateLessonStatus(lessonId, updates)
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
      } else {
        console.error('Failed to update lesson')
      }
    } catch (error) {
      console.error('Error updating lesson:', error)
    }
  }

  const createRecurringLessons = async () => {
    if (!newLessonsForm.elevId || !newLessonsForm.weekday || !newLessonsForm.time) {
      alert('Alla fält måste fyllas i')
      return
    }

    try {
      setNewLessonsForm(prev => ({ ...prev, loading: true }))
      
      const today = new Date()
      const currentYear = today.getFullYear()
      
      // Bestäm slutdatum baserat på om vi är före eller efter december
      const endDate = today.getMonth() < 6 
        ? new Date(currentYear, 5, 15) // 15 juni detta år
        : new Date(currentYear, 11, 20) // 20 december detta år
      
      const lessons = []
      const weekdayMap: { [key: string]: number } = {
        'måndag': 1,
        'tisdag': 2,
        'onsdag': 3,
        'torsdag': 4,
        'fredag': 5,
        'lördag': 6,
        'söndag': 0
      }
      
      const targetWeekday = weekdayMap[newLessonsForm.weekday.toLowerCase()]
      
      // Hitta nästa datum för vald veckodag
      let currentDate = new Date(today)
      while (currentDate.getDay() !== targetWeekday) {
        currentDate.setDate(currentDate.getDate() + 1)
      }
      
      // Skapa lektioner veckovis fram till slutdatum
      while (currentDate <= endDate) {
        lessons.push({
          fields: {
            'Datum': currentDate.toISOString().split('T')[0],
            'Klockslag': newLessonsForm.time,
            'Elev': [newLessonsForm.elevId],
            'Lärare': [session?.user?.teacherId],
            'Genomförd': false,
            'Inställd': false
          }
        })
        
        // Gå till nästa vecka
        currentDate.setDate(currentDate.getDate() + 7)
      }
      
      console.log('Försöker skapa lektioner:', lessons)
      
      // Skicka alla lektioner i batches (Airtable max 10 per request)
      const batchSize = 10
      for (let i = 0; i < lessons.length; i += batchSize) {
        const batch = lessons.slice(i, i + batchSize)
        
        console.log(`Skickar batch ${Math.floor(i/batchSize) + 1}:`, batch)
        
      const response = await fetch('/api/lessons', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          records: batch
        })
      })
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          console.error('Airtable error details:', errorData)
          console.error('Request body was:', JSON.stringify({ records: batch }, null, 2))
          throw new Error(`Failed to create lessons: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`)
        }
        
        const responseData = await response.json()
        console.log('Batch skapad:', responseData)
      }
      
      alert(`${lessons.length} lektioner skapade!`)
      setShowNewLessonsForm(false)
      setNewLessonsForm({ elevId: '', weekday: '', time: '', loading: false })
      await fetchLektioner()
      
    } catch (error) {
      console.error('Error creating lessons:', error)
      alert('Fel vid skapande av lektioner: ' + error)
    } finally {
      setNewLessonsForm(prev => ({ ...prev, loading: false }))
    }
  }

  const bulkDeleteLessons = async () => {
    if (!bulkDeleteForm.elevId) {
      alert('Välj en elev')
      return
    }

    if (!confirm('Är du säker på att du vill radera alla kommande icke-genomförda lektioner för denna elev?')) {
      return
    }

    try {
      setBulkDeleteForm(prev => ({ ...prev, loading: true }))
      
      const today = new Date().toISOString().split('T')[0]
      
      // Hitta alla kommande icke-genomförda lektioner för eleven
      const lessonsToDelete = lektioner.filter(lektion => {
        const elevField = lektion.fields.Elev
        const elevId = Array.isArray(elevField) ? elevField[0] : elevField
        const isThisStudent = elevId === bulkDeleteForm.elevId
        const isFuture = lektion.fields.Datum >= today
        const notCompleted = !lektion.fields.Genomförd
        
        return isThisStudent && isFuture && notCompleted
      })
      
      if (lessonsToDelete.length === 0) {
        alert('Inga lektioner att radera')
        return
      }
      
      // Radera i batches
      const batchSize = 10
      for (let i = 0; i < lessonsToDelete.length; i += batchSize) {
        const batch = lessonsToDelete.slice(i, i + batchSize)
        const recordIds = batch.map(lesson => lesson.id)
        
        console.log('Försöker radera record IDs:', recordIds)
        
        // För DELETE API använder vi URL-parametrar, inte body
        const response = await fetch('/api/lessons', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ recordIds })
        })
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          console.error('Airtable delete error details:', errorData)
          console.error('Tried to delete records:', recordIds)
          throw new Error(`Failed to delete lessons: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`)
        }
      }
      
      alert(`${lessonsToDelete.length} lektioner raderade!`)
      setShowBulkDelete(false)
      setBulkDeleteForm({ elevId: '', loading: false })
      await fetchLektioner()
      
    } catch (error) {
      console.error('Error deleting lessons:', error)
      alert('Fel vid radering av lektioner')
    } finally {
      setBulkDeleteForm(prev => ({ ...prev, loading: false }))
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
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header med knappar */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Alla lektioner</h1>
          <div className="flex space-x-3">
            <button
              onClick={() => setShowNewLessonsForm(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              Schemalägg lektion
            </button>
            <button
              onClick={() => setShowBulkDelete(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              Ta bort schemalagd lektionstid
            </button>
          </div>
        </div>

        {/* Filter */}
        <div className="flex space-x-2">
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
              className={`px-3 py-1 rounded-md text-sm transition-colors ${
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

      {/* Skapa ny lektionstid modal */}
      {showNewLessonsForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Schemalägg ny lektionstid</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Elev</label>
                <select
                  value={newLessonsForm.elevId}
                  onChange={(e) => setNewLessonsForm(prev => ({ ...prev, elevId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Veckodag</label>
                <select
                  value={newLessonsForm.weekday}
                  onChange={(e) => setNewLessonsForm(prev => ({ ...prev, weekday: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Välj veckodag...</option>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Tid</label>
                <input
                  type="time"
                  value={newLessonsForm.time}
                  onChange={(e) => setNewLessonsForm(prev => ({ ...prev, time: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button
                onClick={createRecurringLessons}
                disabled={newLessonsForm.loading}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {newLessonsForm.loading ? 'Schemalägg...' : 'Schemalägg lektioner'}
              </button>
              <button
                onClick={() => {
                  setShowNewLessonsForm(false)
                  setNewLessonsForm({ elevId: '', weekday: '', time: '', loading: false })
                }}
                className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
              >
                Avbryt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk delete modal */}
      {showBulkDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Ta bort schemalagd lektionstid</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Elev</label>
                <select
                  value={bulkDeleteForm.elevId}
                  onChange={(e) => setBulkDeleteForm(prev => ({ ...prev, elevId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="">Välj elev...</option>
                  {myStudents.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.fields.Namn}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <h4 className="text-sm font-medium text-red-800 mb-2">När behöver du ta bort schemalagd lektionstid?</h4>
                <ul className="text-red-800 text-sm list-disc list-inside space-y-1">
                  <li><strong>Tidändring:</strong> Om du har bytt tid på lektionerna - ta bort den gamla tiden och schemalägg den nya</li>
                  <li><strong>Eleven har slutat:</strong> Om eleven inte längre ska ha lektioner</li>
                </ul>
                <p className="text-red-800 text-sm mt-2 font-medium">
                  Detta tar bort alla kommande icke-genomförda lektioner för vald elev.
                </p>
              </div>
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button
                onClick={bulkDeleteLessons}
                disabled={bulkDeleteForm.loading}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {bulkDeleteForm.loading ? 'Tar bort...' : 'Ta bort lektionstider'}
              </button>
              <button
                onClick={() => {
                  setShowBulkDelete(false)
                  setBulkDeleteForm({ elevId: '', loading: false })
                }}
                className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
              >
                Avbryt
              </button>
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
              <div key={lektion.id} className="bg-white rounded-lg shadow-sm">
                <div 
                  className={`p-4 border rounded-t-lg cursor-pointer hover:bg-gray-50 transition-colors ${
                    expandedLesson === lektion.id 
                      ? 'border-b-0 ' + status.color + ' rounded-b-none'
                      : status.color + ' rounded-b-lg'
                  }`}
                  onClick={() => setExpandedLesson(expandedLesson === lektion.id ? null : lektion.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <span className="font-medium text-lg">{elevNamn}</span>
                      <span className="font-medium">{formatDate(lektion.fields.Datum)}</span>
                      <span className="text-sm text-gray-500">{lektion.fields.Klockslag}</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.color.replace('border-', '')}`}>
                        {status.status}
                      </span>
                    </div>
                    <span className="text-gray-400 text-sm">
                      {expandedLesson === lektion.id ? '▼' : '▶'}
                    </span>
                  </div>
                  
                  {lektion.fields['Anledning ombokning'] && (
                    <div className="mt-2">
                      <span className="text-sm text-gray-600">
                        Ombokad från ursprungligt datum - Anledning: {lektion.fields['Anledning ombokning']}
                      </span>
                    </div>
                  )}
                </div>
                
                {/* Dropdown content */}
                {expandedLesson === lektion.id && (
                  <div className={`bg-white border border-t-0 rounded-b-lg p-4 shadow-sm ${
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
          })
        ) : (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <span className="text-4xl mb-4 block">📅</span>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Inga lektioner hittades</h3>
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