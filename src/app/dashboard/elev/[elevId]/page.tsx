'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useParams, useRouter } from 'next/navigation'

export default function ElevPage() {
  const { elevId } = useParams()
  const { data: session } = useSession()
  const router = useRouter()
  
  const [elev, setElev] = useState<any>(null)
  const [vårdnadshavare, setVårdnadshavare] = useState<any>(null)
  const [lektioner, setLektioner] = useState<any[]>([])
  const [nextLesson, setNextLesson] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showAllLessons, setShowAllLessons] = useState(false)
  const [expandedLesson, setExpandedLesson] = useState<string | null>(null)
  const [terminsmål, setTerminsmål] = useState('')
  const [savingTerminsmål, setSavingTerminsmål] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', message: string } | null>(null)
  const [actionState, setActionState] = useState<{
    lessonId: string | null,
    action: 'ombokad' | null,
    data: any
  }>({
    lessonId: null,
    action: null,
    data: {}
  })

  useEffect(() => {
    if (session?.user?.teacherId && elevId) {
      fetchElevData()
    }
  }, [session, elevId])

  useEffect(() => {
    if (statusMessage) {
      const timer = setTimeout(() => setStatusMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [statusMessage])

  const fetchElevData = async () => {
    try {
      setLoading(true)
      
      // Hämta elevdata
      const elevResponse = await fetch(`https://api.airtable.com/v0/${process.env.NEXT_PUBLIC_AIRTABLE_BASE_ID}/Elev/${elevId}`, {
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_AIRTABLE_API_KEY}`,
        },
      })
      
      if (!elevResponse.ok) {
        console.error('Kunde inte hämta elevdata')
        return
      }
      
      const elevData = await elevResponse.json()
      setElev(elevData.fields)
      setTerminsmål(elevData.fields.Terminsmål || '')
      
      // Hämta vårdnadshavare
      if (elevData.fields.Vårdnadshavare && elevData.fields.Vårdnadshavare.length > 0) {
        const vårdnadshavareId = elevData.fields.Vårdnadshavare[0]
        const vhResponse = await fetch(`https://api.airtable.com/v0/${process.env.NEXT_PUBLIC_AIRTABLE_BASE_ID}/Vårdnadshavare/${vårdnadshavareId}`, {
          headers: {
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_AIRTABLE_API_KEY}`,
          },
        })
        
        if (vhResponse.ok) {
          const vhData = await vhResponse.json()
          setVårdnadshavare(vhData.fields)
        }
      }
      
      // Hämta lektioner för denna elev
      await fetchLektioner()
      
    } catch (error) {
      console.error('Error fetching elev data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchLektioner = async () => {
    try {
      // Hämta alla lektioner
      let allLektioner: any[] = []
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
          allLektioner = allLektioner.concat(data.records)
          offset = data.offset || ''
        } else {
          break
        }
      } while (offset)
      
      // Filtrera lektioner för denna elev och sortera efter datum (senaste först)
      const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD format
      
      // Tidigare lektioner (idag och bakåt) - bara genomförda
      const elevLektioner = allLektioner
        .filter((lektion: any) => {
          const elevField = lektion.fields.Elev
          const lektionDate = lektion.fields.Datum
          
          // Kolla om det är denna elev OCH datum är idag eller tidigare OCH lektionen är genomförd
          const isThisStudent = Array.isArray(elevField) ? elevField.includes(elevId) : elevField === elevId
          const isNotFuture = lektionDate <= today
          const isCompleted = lektion.fields.Genomförd
          
          return isThisStudent && isNotFuture && isCompleted
        })
        .sort((a, b) => new Date(b.fields.Datum).getTime() - new Date(a.fields.Datum).getTime())
      
      // Nästa planerade lektion (framtida)
      const futureLessons = allLektioner
        .filter((lektion: any) => {
          const elevField = lektion.fields.Elev
          const lektionDate = lektion.fields.Datum
          
          const isThisStudent = Array.isArray(elevField) ? elevField.includes(elevId) : elevField === elevId
          const isFuture = lektionDate > today
          
          return isThisStudent && isFuture
        })
        .sort((a, b) => new Date(a.fields.Datum).getTime() - new Date(b.fields.Datum).getTime()) // Tidigaste först
      
      setLektioner(elevLektioner)
      setNextLesson(futureLessons.length > 0 ? futureLessons[0] : null)
      
    } catch (error) {
      console.error('Error fetching lektioner:', error)
    }
  }

  const saveTerminsmål = async () => {
    try {
      setSavingTerminsmål(true)
      
      const response = await fetch(`https://api.airtable.com/v0/${process.env.NEXT_PUBLIC_AIRTABLE_BASE_ID}/Elev/${elevId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: {
            'Terminsmål': terminsmål
          }
        })
      })

      if (response.ok) {
        setStatusMessage({ type: 'success', message: 'Terminsmål sparade!' })
      } else {
        setStatusMessage({ type: 'error', message: 'Kunde inte spara terminsmål' })
      }
    } catch (error) {
      console.error('Error saving terminsmål:', error)
      setStatusMessage({ type: 'error', message: 'Fel vid sparande av terminsmål' })
    } finally {
      setSavingTerminsmål(false)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setUploadingFile(true)
      setStatusMessage(null)

      const formData = new FormData()
      formData.append('file', file)
      formData.append('field', 'Lärandematerial')
      formData.append('teacherId', elevId as string) // Använder elevId som "teacherId" för eleven

      const response = await fetch('http://localhost:4000/upload', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Fel vid uppladdning')
      }

      setStatusMessage({
        type: 'success',
        message: `Filen "${file.name}" har laddats upp!`,
      })

      // Refresh student data to show the new file
      await fetchElevData()

    } catch (error: any) {
      console.error('Upload error:', error)
      setStatusMessage({
        type: 'error',
        message: `Uppladdningen misslyckades: ${error.message || 'okänt fel'}`,
      })
    } finally {
      setUploadingFile(false)
      // Reset file input
      event.target.value = ''
    }
  }

  const calculateAge = (birthYear: number) => {
    const currentYear = new Date().getFullYear()
    return currentYear - birthYear
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
      return { status: 'genomförd', color: 'bg-green-100 text-green-800' }
    } else if (lektion.fields.Inställd) {
      return { status: 'inställd', color: 'bg-red-100 text-red-800' }
    } else if (lektion.fields['Anledning ombokning']) {
      // Om det finns en ombokningsanledning så är lektionen ombokad (även om datumet nu är uppdaterat)
      return { status: 'ombokad', color: 'bg-yellow-100 text-yellow-800' }
    } else {
      return { status: 'planerad', color: 'bg-blue-100 text-blue-800' }
    }
  }

  const handleActionConfirm = async (lessonId: string, action: string, data: any) => {
    // Hitta lektionen för att få tillgång till befintliga fält
    const currentLesson = nextLesson?.id === lessonId ? nextLesson : lektioner.find(l => l.id === lessonId)
    
    let updates: any = {}
    
    if (action === 'ombokad') {
      updates = {
        'Datum': data.datum, // Ändra faktiska datumet istället för "Ombokad till"
        'Klockslag': data.tid || currentLesson?.fields?.Klockslag || '',
        'Anledning ombokning': data.anledning,
        'Genomförd': false,
        'Inställd': false,
        'Ombokad till': null // Rensa det gamla fältet
      }
    }
    
    await updateLessonStatus(lessonId, updates)
    setActionState({ lessonId: null, action: null, data: {} })
    // Uppdatera lektioner efter ändring
    await fetchLektioner()
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

      if (!response.ok) {
        console.error('Failed to update lesson')
      }
    } catch (error) {
      console.error('Error updating lesson:', error)
    }
  }

  const resetActionState = () => {
    setActionState({ lessonId: null, action: null, data: {} })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
        <span className="text-gray-600">Laddar elevdata...</span>
      </div>
    )
  }

  if (!elev) {
    return (
      <div className="text-center py-12">
        <h1 className="text-xl text-gray-600">Eleven kunde inte hittas</h1>
      </div>
    )
  }

  const displayedLektioner = showAllLessons ? lektioner : lektioner.slice(0, 3)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Status Messages */}
      {statusMessage && (
        <div className={`rounded-lg p-4 ${
          statusMessage.type === 'success' 
            ? 'bg-green-50 border border-green-200 text-green-800' 
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          <div className="flex items-center">
            <span className="mr-2">
              {statusMessage.type === 'success' ? '✅' : '❌'}
            </span>
            {statusMessage.message}
          </div>
        </div>
      )}

      {/* Elevinfo och Vårdnadshavare */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Elevinfo */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            {elev.Namn}
          </h1>
          <div className="space-y-3">
            <div className="flex items-center">
              <span className="text-sm font-medium text-gray-500 w-20">Ålder:</span>
              <span className="text-gray-900">
                {elev.Födelseår ? calculateAge(elev.Födelseår) : 'Okänd'} år
              </span>
            </div>
            <div className="flex items-center">
              <span className="text-sm font-medium text-gray-500 w-20">Instrument:</span>
              <span className="text-gray-900">{elev.Instrument || 'Inte angivet'}</span>
            </div>
          </div>
        </div>

        {/* Vårdnadshavare */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Vårdnadshavare
          </h2>
          {vårdnadshavare ? (
            <div className="space-y-3">
              <div className="flex items-center">
                <span className="text-sm font-medium text-gray-500 w-20">Namn:</span>
                <span className="text-gray-900">{vårdnadshavare.Namn}</span>
              </div>
              <div className="flex items-center">
                <span className="text-sm font-medium text-gray-500 w-20">Adress:</span>
                <span className="text-gray-900">
                  {vårdnadshavare.Gata} {vårdnadshavare.Gatunummer}, {vårdnadshavare.Ort}
                </span>
              </div>
              <div className="flex items-center">
                <span className="text-sm font-medium text-gray-500 w-20">E-post:</span>
                <a href={`mailto:${vårdnadshavare['E-post']}`} className="text-blue-600 hover:text-blue-800">
                  {vårdnadshavare['E-post']}
                </a>
              </div>
              <div className="flex items-center">
                <span className="text-sm font-medium text-gray-500 w-20">Telefon:</span>
                <a href={`tel:${vårdnadshavare.Telefon}`} className="text-blue-600 hover:text-blue-800">
                  {vårdnadshavare.Telefon}
                </a>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">Ingen vårdnadshavare registrerad</p>
          )}
        </div>
      </div>

      {/* Nästa planerade lektion */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Nästa planerade lektion
        </h2>
        
        {nextLesson ? (
          <div className={`p-4 rounded-lg border border-blue-200 bg-blue-50`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-3">
                <span className="font-medium text-blue-900">{formatDate(nextLesson.fields.Datum)}</span>
                <span className="text-sm text-blue-700">{nextLesson.fields.Klockslag}</span>
                {nextLesson.fields['Anledning ombokning'] && (
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    Ombokad
                  </span>
                )}
              </div>
              <button
                onClick={() => setActionState({ 
                  lessonId: nextLesson.id, 
                  action: 'ombokad', 
                  data: {} 
                })}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                📅 Boka om
              </button>
            </div>
            
            {nextLesson.fields['Anledning ombokning'] && (
              <div className="mt-2">
                <span className="text-sm text-blue-700">
                  Ombokad från ursprungligt datum - Anledning: {nextLesson.fields['Anledning ombokning']}
                </span>
              </div>
            )}
            
            {nextLesson.fields.Läxa && (
              <div className="mt-3 p-3 bg-blue-100 rounded-md">
                <h4 className="text-sm font-medium text-blue-800 mb-1">Läxa att förbereda:</h4>
                <p className="text-blue-900 text-sm">{nextLesson.fields.Läxa}</p>
              </div>
            )}
            
            {/* Ombokning bekräftelse */}
            {actionState.lessonId === nextLesson.id && actionState.action === 'ombokad' && (
              <div className="mt-4 p-4 bg-white rounded-md border border-blue-300">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Boka om lektion</h4>
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
                      placeholder={nextLesson.fields.Klockslag || 'Behåll nuvarande tid'}
                      onChange={(e) => setActionState(prev => ({
                        ...prev,
                        data: { ...prev.data, tid: e.target.value }
                      }))}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Lämna tom för att behålla nuvarande tid ({nextLesson.fields.Klockslag || 'ingen tid angiven'})
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
                <div className="flex space-x-2 mt-3">
                  <button
                    onClick={() => handleActionConfirm(nextLesson.id, 'ombokad', actionState.data)}
                    disabled={!actionState.data.datum || !actionState.data.anledning}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    Bekräfta ombokning
                  </button>
                  <button
                    onClick={resetActionState}
                    className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors text-sm"
                  >
                    Avbryt
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-6 text-gray-500">
            <span className="text-4xl">📅</span>
            <p className="mt-2">Inga framtida lektioner planerade</p>
            <p className="text-sm text-gray-400">Kontakta administratören för att boka nästa lektion</p>
          </div>
        )}
      </div>

      {/* Senaste lektioner */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Senaste genomförda lektioner
        </h2>
        
        {lektioner.length > 0 ? (
          <div className="space-y-2">
            {displayedLektioner.map((lektion) => {
              return (
                <div key={lektion.id} className="space-y-0">
                  <div 
                    className={`p-4 rounded-t-lg border cursor-pointer hover:bg-gray-50 transition-colors bg-green-100 text-green-800 border-green-200 ${
                      expandedLesson === lektion.id ? 'rounded-b-none border-b-0' : 'rounded-b-lg'
                    }`}
                    onClick={() => setExpandedLesson(expandedLesson === lektion.id ? null : lektion.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <span className="font-medium">{formatDate(lektion.fields.Datum)}</span>
                        <span className="text-sm text-gray-500">{lektion.fields.Klockslag}</span>
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Genomförd
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
                  
                  {/* Dropdown content - bara visa information */}
                  {expandedLesson === lektion.id && (
                    <div className="bg-white border border-t-0 border-gray-200 rounded-b-lg p-4">
                      <div className="space-y-3">
                        {lektion.fields.Lektionsanteckning && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-2">Vad gjorde ni på lektionen:</h4>
                            <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
                              <p className="text-gray-900 text-sm">{lektion.fields.Lektionsanteckning}</p>
                            </div>
                          </div>
                        )}
                        
                        {lektion.fields.Läxa && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-2">Läxa till nästa gång:</h4>
                            <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
                              <p className="text-gray-900 text-sm">{lektion.fields.Läxa}</p>
                            </div>
                          </div>
                        )}
                        
                        {!lektion.fields.Lektionsanteckning && !lektion.fields.Läxa && (
                          <p className="text-gray-500 text-sm">Inga anteckningar eller läxor registrerade för denna lektion.</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
            
            {lektioner.length > 3 && !showAllLessons && (
              <button
                onClick={() => setShowAllLessons(true)}
                className="w-full py-2 text-sm text-blue-600 hover:text-blue-800 transition-colors"
              >
                Visa alla {lektioner.length} genomförda lektioner
              </button>
            )}
            
            {showAllLessons && lektioner.length > 3 && (
              <button
                onClick={() => setShowAllLessons(false)}
                className="w-full py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                Visa färre
              </button>
            )}
          </div>
        ) : (
          <p className="text-gray-500">Inga genomförda lektioner registrerade än</p>
        )}
      </div>

      {/* Terminsmål */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Terminsmål</h2>
          <button
            onClick={saveTerminsmål}
            disabled={savingTerminsmål}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {savingTerminsmål ? 'Sparar...' : 'Spara'}
          </button>
        </div>
        <textarea
          value={terminsmål}
          onChange={(e) => setTerminsmål(e.target.value)}
          placeholder="Skriv terminsmål för eleven här..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          rows={4}
        />
      </div>

      {/* Lärandematerial */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Lärandematerial
          </h2>
          
          {/* Ladda upp knapp */}
          <div className="relative">
            <input
              type="file"
              id="file-upload"
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploadingFile}
              accept=".pdf,.jpg,.jpeg,.png,.mp3,.wav,.mp4,.doc,.docx"
            />
            <label
              htmlFor="file-upload"
              className={`px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors cursor-pointer ${
                uploadingFile ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {uploadingFile ? 'Laddar upp...' : '📎 Ladda upp fil'}
            </label>
          </div>
        </div>
        
        {elev.Lärandematerial && elev.Lärandematerial.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            {elev.Lärandematerial.map((file: any, index: number) => (
              <a
                key={index}
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex-shrink-0 mr-3">
                  <span className="text-2xl">
                    {file.type?.includes('image') ? '🖼️' : 
                     file.type?.includes('pdf') ? '📄' : 
                     file.type?.includes('audio') ? '🎵' : 
                     file.type?.includes('video') ? '🎬' :
                     '📁'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {file.filename}
                  </p>
                  <p className="text-xs text-gray-500">
                    {file.size ? (file.size / 1024 / 1024).toFixed(1) + ' MB' : 'Okänd storlek'}
                  </p>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div className="mb-4">
            <p className="text-gray-500">Inget lärandematerial uppladdat än</p>
          </div>
        )}
  
      </div>
    </div>
  )
}