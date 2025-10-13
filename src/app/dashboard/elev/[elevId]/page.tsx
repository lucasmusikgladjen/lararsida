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

      const elevResponse = await fetch(`/api/students/${elevId}`)

      if (!elevResponse.ok) {
        console.error('Kunde inte hämta elevdata')
        return
      }

      const elevData = await elevResponse.json()
      setElev(elevData.fields)
      setTerminsmål(elevData.fields.Terminsmål || '')

      if (elevData.fields.Vårdnadshavare && elevData.fields.Vårdnadshavare.length > 0) {
        const vårdnadshavareId = elevData.fields.Vårdnadshavare[0]
        const vhResponse = await fetch(`/api/guardians/${vårdnadshavareId}`)

        if (vhResponse.ok) {
          const vhData = await vhResponse.json()
          setVårdnadshavare(vhData.fields)
        }
      }

      await fetchLektioner()
    } catch (error) {
      console.error('Error fetching elev data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchLektioner = async () => {
    try {
      const response = await fetch(`/api/lessons?studentId=${elevId}`)

      if (!response.ok) {
        throw new Error('Failed to fetch lessons')
      }

      const data = await response.json()
      const allLektioner = data.records || []
      const today = new Date().toISOString().split('T')[0]

      const elevLektioner = allLektioner
        .filter((lektion: any) => {
          const lektionDate = lektion.fields.Datum
          const isNotFuture = lektionDate <= today
          const isCompleted = lektion.fields.Genomförd

          return isNotFuture && isCompleted
        })
        .sort((a: any, b: any) => new Date(b.fields.Datum).getTime() - new Date(a.fields.Datum).getTime())

      const futureLessons = allLektioner
        .filter((lektion: any) => {
          const lektionDate = lektion.fields.Datum
          return lektionDate > today
        })
        .sort((a: any, b: any) => new Date(a.fields.Datum).getTime() - new Date(b.fields.Datum).getTime())

      setLektioner(elevLektioner)
      setNextLesson(futureLessons.length > 0 ? futureLessons[0] : null)

    } catch (error) {
      console.error('Error fetching lektioner:', error)
    }
  }

  const saveTerminsmål = async () => {
    try {
      setSavingTerminsmål(true)

      const response = await fetch(`/api/students/${elevId}`, {
        method: 'PATCH',
        headers: {
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
      const response = await fetch(`/api/lessons/${lessonId}`, {
        method: 'PATCH',
        headers: {
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
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 pb-12 sm:px-6 lg:px-8">
      {/* Status Messages */}
      {statusMessage && (
        <div className={`rounded-xl border p-3 shadow-sm sm:p-4 ${
          statusMessage.type === 'success'
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-center gap-2 text-sm sm:text-base">
            <span>{statusMessage.type === 'success' ? '✅' : '❌'}</span>
            {statusMessage.message}
          </div>
        </div>
      )}

      {/* Elevinfo och Vårdnadshavare */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        {/* Elevinfo */}
        <div className="rounded-2xl border border-gray-200 bg-white/80 p-4 shadow-sm ring-1 ring-gray-100 sm:p-6">
          <h1 className="mb-4 text-xl font-bold text-gray-900 sm:text-3xl">
            {elev.Namn}
          </h1>
          <div className="space-y-3">
            <div className="flex flex-wrap items-start gap-2 sm:flex-nowrap sm:items-center">
              <span className="w-24 shrink-0 text-sm font-medium text-gray-500 sm:text-base">Ålder:</span>
              <span className="min-w-0 text-sm text-gray-900 sm:flex-1 sm:text-base break-words">
                {elev.Födelseår ? calculateAge(elev.Födelseår) : 'Okänd'} år
              </span>
            </div>
            <div className="flex flex-wrap items-start gap-2 sm:flex-nowrap sm:items-center">
              <span className="w-24 shrink-0 text-sm font-medium text-gray-500 sm:text-base">Instrument:</span>
              <span className="min-w-0 text-sm text-gray-900 sm:flex-1 sm:text-base break-words">{elev.Instrument || 'Inte angivet'}</span>
            </div>
          </div>
        </div>

        {/* Vårdnadshavare */}
        <div className="rounded-2xl border border-gray-200 bg-white/80 p-4 shadow-sm ring-1 ring-gray-100 sm:p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 sm:text-xl">
            Vårdnadshavare
          </h2>
          {vårdnadshavare ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-start gap-2 sm:flex-nowrap sm:items-center">
                <span className="w-24 shrink-0 text-sm font-medium text-gray-500 sm:text-base">Namn:</span>
                <span className="min-w-0 text-sm text-gray-900 sm:flex-1 sm:text-base break-words">{vårdnadshavare.Namn}</span>
              </div>
              <div className="flex flex-wrap items-start gap-2 sm:flex-nowrap sm:items-center">
                <span className="w-24 shrink-0 text-sm font-medium text-gray-500 sm:text-base">Adress:</span>
                <span className="min-w-0 text-sm text-gray-900 sm:flex-1 sm:text-base break-words">
                  {vårdnadshavare.Gata} {vårdnadshavare.Gatunummer}, {vårdnadshavare.Ort}
                </span>
              </div>
              <div className="flex flex-wrap items-start gap-2 sm:flex-nowrap sm:items-center">
                <span className="w-24 shrink-0 text-sm font-medium text-gray-500 sm:text-base">E-post:</span>
                <a href={`mailto:${vårdnadshavare['E-post']}`} className="min-w-0 text-sm text-blue-600 hover:text-blue-800 sm:flex-1 sm:text-base break-words">
                  {vårdnadshavare['E-post']}
                </a>
              </div>
              <div className="flex flex-wrap items-start gap-2 sm:flex-nowrap sm:items-center">
                <span className="w-24 shrink-0 text-sm font-medium text-gray-500 sm:text-base">Telefon:</span>
                <a href={`tel:${vårdnadshavare.Telefon}`} className="min-w-0 text-sm text-blue-600 hover:text-blue-800 sm:flex-1 sm:text-base break-words">
                  {vårdnadshavare.Telefon}
                </a>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Ingen vårdnadshavare registrerad</p>
          )}
        </div>
      </div>

      {/* Nästa planerade lektion */}
      <div className="rounded-2xl border border-gray-200 bg-white/80 p-4 shadow-sm ring-1 ring-gray-100 sm:p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 sm:text-xl">
          Nästa planerade lektion
        </h2>

        {nextLesson ? (
          <div className={`rounded-xl border border-blue-200 bg-blue-50 p-3 transition-shadow hover:shadow-md sm:p-4`}>
            <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <span className="font-medium text-blue-900 sm:text-lg">{formatDate(nextLesson.fields.Datum)}</span>
                <span className="text-sm text-blue-700">{nextLesson.fields.Klockslag}</span>
                {nextLesson.fields['Anledning ombokning'] && (
                  <span className="rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-medium text-yellow-800">
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
                className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 sm:w-auto"
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
              <div className="mt-3 rounded-lg border border-blue-200 bg-blue-100 p-3">
                <h4 className="text-sm font-medium text-blue-800 mb-1">Läxa att förbereda:</h4>
                <p className="text-blue-900 text-sm">{nextLesson.fields.Läxa}</p>
              </div>
            )}

            {/* Ombokning bekräftelse */}
            {actionState.lessonId === nextLesson.id && actionState.action === 'ombokad' && (
              <div className="mt-4 rounded-xl border border-blue-300 bg-white p-4 sm:p-5">
                <h4 className="mb-3 text-sm font-medium text-gray-700">Boka om lektion</h4>
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
                      placeholder={nextLesson.fields.Klockslag || 'Behåll nuvarande tid'}
                      onChange={(e) => setActionState(prev => ({
                        ...prev,
                        data: { ...prev.data, tid: e.target.value }
                      }))}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Lämna tom för att behålla nuvarande tid ({nextLesson.fields.Klockslag || 'ingen tid angiven'})
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Anledning för ombokning:
                    </label>
                    <textarea
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      rows={2}
                      placeholder=""
                      onChange={(e) => setActionState(prev => ({
                        ...prev,
                        data: { ...prev.data, anledning: e.target.value }
                      }))}
                    />
                  </div>
                </div>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:gap-3">
                  <button
                    onClick={() => handleActionConfirm(nextLesson.id, 'ombokad', actionState.data)}
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
          </div>
        ) : (
          <div className="py-5 text-center text-gray-500">
            <span className="text-3xl sm:text-4xl">📅</span>
            <p className="mt-2">Inga framtida lektioner planerade</p>
            <p className="text-sm text-gray-400">Kontakta administratören för att boka nästa lektion</p>
          </div>
        )}
      </div>

      {/* Senaste lektioner */}
      <div className="rounded-2xl border border-gray-200 bg-white/80 p-4 shadow-sm ring-1 ring-gray-100 sm:p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 sm:text-xl">
          Senaste genomförda lektioner
        </h2>

        {lektioner.length > 0 ? (
          <div className="space-y-2">
            {displayedLektioner.map((lektion) => {
              return (
                <div key={lektion.id} className="space-y-0">
                  <div
                    className={`cursor-pointer rounded-t-xl border border-green-200 bg-green-100 p-3 text-green-900 transition-shadow hover:bg-green-100/80 hover:shadow-md sm:p-4 ${
                      expandedLesson === lektion.id ? 'rounded-b-none border-b-0' : 'rounded-b-xl'
                    }`}
                    onClick={() => setExpandedLesson(expandedLesson === lektion.id ? null : lektion.id)}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <span className="font-medium text-gray-900 sm:text-lg">{formatDate(lektion.fields.Datum)}</span>
                        {lektion.fields.Klockslag && (
                          <span className="text-sm text-gray-700">{lektion.fields.Klockslag}</span>
                        )}
                        <span className="rounded-full bg-white/70 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-green-800 shadow-sm">
                          Genomförd
                        </span>
                      </div>
                      <span className="text-sm text-gray-500">
                        {expandedLesson === lektion.id ? '▼' : '▶'}
                      </span>
                    </div>

                    {lektion.fields['Anledning ombokning'] && (
                      <p className="mt-2 text-sm text-gray-700">
                        Ombokad från ursprungligt datum – Anledning: {lektion.fields['Anledning ombokning']}
                      </p>
                    )}
                  </div>

                  {/* Dropdown content - bara visa information */}
                  {expandedLesson === lektion.id && (
                    <div className="rounded-b-xl border border-t-0 border-gray-200 bg-white p-4 sm:p-5">
                      <div className="space-y-3">
                        {lektion.fields.Lektionsanteckning && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-2">Vad gjorde ni på lektionen:</h4>
                            <div className="border border-gray-200 bg-gray-50 p-3 rounded-lg">
                              <p className="text-gray-900 text-sm">{lektion.fields.Lektionsanteckning}</p>
                            </div>
                          </div>
                        )}

                        {lektion.fields.Läxa && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-2">Läxa till nästa gång:</h4>
                            <div className="border border-gray-200 bg-gray-50 p-3 rounded-lg">
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
                className="w-full rounded-md border border-blue-200 px-3 py-2 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50"
              >
                Visa alla {lektioner.length} genomförda lektioner
              </button>
            )}

            {showAllLessons && lektioner.length > 3 && (
              <button
                onClick={() => setShowAllLessons(false)}
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
              >
                Visa färre
              </button>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500">Inga genomförda lektioner registrerade än</p>
        )}
      </div>

      {/* Terminsmål */}
      <div className="rounded-2xl border border-gray-200 bg-white/80 p-4 shadow-sm ring-1 ring-gray-100 sm:p-6">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">Terminsmål</h2>
          <button
            onClick={saveTerminsmål}
            disabled={savingTerminsmål}
            className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-4 sm:text-base"
          >
            {savingTerminsmål ? 'Sparar...' : 'Spara'}
          </button>
        </div>
        <textarea
          value={terminsmål}
          onChange={(e) => setTerminsmål(e.target.value)}
          placeholder="Skriv terminsmål för eleven här..."
          className="h-32 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Lärandematerial */}
      <div className="rounded-2xl border border-gray-200 bg-white/80 p-4 shadow-sm ring-1 ring-gray-100 sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">
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
              className={`inline-flex items-center justify-center rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700 ${
                uploadingFile ? 'cursor-not-allowed opacity-50' : ''
              }`}
            >
              {uploadingFile ? 'Laddar upp...' : '📎 Ladda upp fil'}
            </label>
          </div>
        </div>

        {elev.Lärandematerial && elev.Lärandematerial.length > 0 ? (
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {elev.Lärandematerial.map((file: any, index: number) => (
              <a
                key={index}
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 transition-colors hover:bg-gray-50"
              >
                <span className="text-2xl">
                  {file.type?.includes('image') ? '🖼️' :
                   file.type?.includes('pdf') ? '📄' :
                   file.type?.includes('audio') ? '🎵' :
                   file.type?.includes('video') ? '🎬' :
                   '📁'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">
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
            <p className="text-sm text-gray-500">Inget lärandematerial uppladdat än</p>
          </div>
        )}

      </div>
    </div>
  )
}