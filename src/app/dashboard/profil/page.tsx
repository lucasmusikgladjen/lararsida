'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

interface TeacherProfile {
  id: string
  fields: {
    Namn: string
    Instrument: string
    Adress: string
    Ort: string
    'E-post': string
    Telefon: string
    Bankkontonummer: string
    Bank: string
    Personnummer: string
    Elever: string[]
    Önskar: string[]
    Grundlön: number
    Lönenpålägg: number
    Skattesats: number
    Profilbild: any[]
    Biografi: string
    'Önskat antal elever': number
    Avtal: any[]
    Jämkning: any[]
    Belastningsregister: any[]
  }
}

export default function ProfilPage() {
  const { data: session } = useSession()

  const [profile, setProfile] = useState<TeacherProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadingFile, setUploadingFile] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const [editForm, setEditForm] = useState({
    Namn: '',
    Instrument: '',
    Adress: '',
    Ort: '',
    'E-post': '',
    Telefon: '',
    Bankkontonummer: '',
    Bank: '',
    Personnummer: '',
    Biografi: '',
    'Önskat antal elever': 0,
  })

  useEffect(() => {
    if (session?.user?.teacherId) {
      fetchProfile()
    }
  }, [session])

  useEffect(() => {
    if (!statusMessage) return
    const timer = setTimeout(() => setStatusMessage(null), 5000)
    return () => clearTimeout(timer)
  }, [statusMessage])

  const fetchProfile = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/teachers/me')
      if (!res.ok) throw new Error('network')
      const data = await res.json()
      setProfile(data)
      setEditForm({
        Namn: data.fields.Namn || '',
        Instrument: data.fields.Instrument || '',
        Adress: data.fields.Adress || '',
        Ort: data.fields.Ort || '',
        'E-post': data.fields['E-post'] || '',
        Telefon: data.fields.Telefon || '',
        Bankkontonummer: data.fields.Bankkontonummer || '',
        Bank: data.fields.Bank || '',
        Personnummer: data.fields.Personnummer || '',
        Biografi: data.fields.Biografi || '',
        'Önskat antal elever': data.fields['Önskat antal elever'] || 0,
      })
    } catch (err) {
      console.error(err)
      setStatusMessage({ type: 'error', message: 'Fel vid hämtning av profil' })
    } finally {
      setLoading(false)
    }
  }

  const saveProfile = async () => {
    try {
      setSaving(true)
      const res = await fetch('/api/teachers/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fields: editForm }),
      })
      if (!res.ok) throw new Error('network')
      setStatusMessage({ type: 'success', message: 'Profil uppdaterad!' })
      setEditMode(false)
      await fetchProfile()
    } catch (err) {
      console.error(err)
      setStatusMessage({ type: 'error', message: 'Fel vid sparande av profil' })
    } finally {
      setSaving(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
  const file = e.target.files?.[0]
  if (!file) return

  try {
    setUploadingFile(field)
    setStatusMessage(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('field', field)
    formData.append('teacherId', session?.user?.teacherId || '')

    const res = await fetch('http://localhost:4000/upload', {
      method: 'POST',
      body: formData,
    })

    const result = await res.json()

    if (!res.ok) {
      throw new Error(result.error || 'Fel vid uppladdning')
    }

    setStatusMessage({
      type: 'success',
      message: `Filen "${file.name}" har laddats upp!`,
    })

    // Uppdatera profilen för att visa nya filen
    await fetchProfile()
  } catch (err: any) {
    console.error(err)
    setStatusMessage({
      type: 'error',
      message: `Uppladdningen misslyckades: ${err.message || 'okänt fel'}`,
    })
  } finally {
    setUploadingFile(null)
    e.target.value = ''
  }
}


  const calculateTimlön = () =>
    (profile?.fields.Grundlön || 0) + (profile?.fields.Lönenpålägg || 0)

  if (loading)
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <span className="text-gray-600">Laddar profil...</span>
        </div>
      </div>
    )

  if (!profile)
    return (
      <div className="text-center py-12">
        <h1 className="text-xl text-gray-600">Profilen kunde inte hittas</h1>
      </div>
    )

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Status */}
      {statusMessage && (
        <div
          className={`rounded-lg p-4 border ${
            statusMessage.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center">
            <span className="mr-2">{statusMessage.type === 'success' ? '✅' : '❌'}</span>
            {statusMessage.message}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="relative">
            {profile.fields.Profilbild?.[0]?.url ? (
              <img
                src={profile.fields.Profilbild[0].url}
                alt="Profilbild"
                className="w-20 h-20 rounded-full object-cover border-4 border-gray-200"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-blue-500 flex items-center justify-center text-white text-2xl font-bold">
                {profile.fields.Namn?.[0] || '?'}
              </div>
            )}
            {editMode && (
              <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
                <label className="text-xs text-white cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, 'Profilbild')}
                    disabled={uploadingFile === 'Profilbild'}
                  />
                  {uploadingFile === 'Profilbild' ? 'Laddar...' : 'Ändra'}
                </label>
              </div>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{profile.fields.Namn}</h1>
            <p className="text-gray-600">
              {profile.fields.Instrument || 'Instrument ej angivet'}
            </p>
          </div>
        </div>
        {editMode ? (
          <div className="flex space-x-3">
            <button
              onClick={saveProfile}
              disabled={saving}
              className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              {saving ? 'Sparar...' : 'Spara'}
            </button>
            <button
              onClick={() => {
                setEditMode(false)
                // reset form
                setEditForm({
                  Namn: profile.fields.Namn || '',
                  Instrument: profile.fields.Instrument || '',
                  Adress: profile.fields.Adress || '',
                  Ort: profile.fields.Ort || '',
                  'E-post': profile.fields['E-post'] || '',
                  Telefon: profile.fields.Telefon || '',
                  Bankkontonummer: profile.fields.Bankkontonummer || '',
                  Bank: profile.fields.Bank || '',
                  Personnummer: profile.fields.Personnummer || '',
                  Biografi: profile.fields.Biografi || '',
                  'Önskat antal elever': profile.fields['Önskat antal elever'] || 0,
                })
              }}
              className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
            >
              Avbryt
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditMode(true)}
            className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
          >
            Redigera profil
          </button>
        )}
      </div>

      {/* Personuppgifter */}
      <div className="bg-white rounded-lg shadow-sm p-6 relative">
        {editMode ? (
          <button
            onClick={saveProfile}
            disabled={saving}
            className="absolute top-4 right-4 bg-gray-500 text-white text-sm px-3 py-1 rounded-md hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            {saving ? 'Sparar...' : 'Spara'}
          </button>
        ) : (
          <button
            onClick={() => setEditMode(true)}
            className="absolute top-4 right-4 bg-gray-500 text-white text-sm px-3 py-1 rounded-md hover:bg-gray-600 transition-colors"
          >
            Redigera
          </button>
        )}
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Personuppgifter</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Namn</label>
              {editMode ? (
                <input
                  type="text"
                  value={editForm.Namn}
                  onChange={(e) => setEditForm(prev => ({ ...prev, Namn: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <p className="text-gray-900">{profile.fields.Namn || 'Ej angivet'}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Instrument</label>
              {editMode ? (
                <input
                  type="text"
                  value={editForm.Instrument}
                  onChange={(e) => setEditForm(prev => ({ ...prev, Instrument: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <p className="text-gray-900">{profile.fields.Instrument || 'Ej angivet'}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-post</label>
              {editMode ? (
                <input
                  type="email"
                  value={editForm['E-post']}
                  onChange={(e) => setEditForm(prev => ({ ...prev, 'E-post': e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <p className="text-gray-900">{profile.fields['E-post'] || 'Ej angivet'}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
              {editMode ? (
                <input
                  type="tel"
                  value={editForm.Telefon}
                  onChange={(e) => setEditForm(prev => ({ ...prev, Telefon: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <p className="text-gray-900">{profile.fields.Telefon || 'Ej angivet'}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Personnummer</label>
              {editMode ? (
                <input
                  type="text"
                  value={editForm.Personnummer}
                  onChange={(e) => setEditForm(prev => ({ ...prev, Personnummer: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="YYYYMMDD-XXXX"
                />
              ) : (
                <p className="text-gray-900">{profile.fields.Personnummer || 'Ej angivet'}</p>
              )}
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Adress</label>
              {editMode ? (
                <input
                  type="text"
                  value={editForm.Adress}
                  onChange={(e) => setEditForm(prev => ({ ...prev, Adress: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <p className="text-gray-900">{profile.fields.Adress || 'Ej angivet'}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ort</label>
              {editMode ? (
                <input
                  type="text"
                  value={editForm.Ort}
                  onChange={(e) => setEditForm(prev => ({ ...prev, Ort: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <p className="text-gray-900">{profile.fields.Ort || 'Ej angivet'}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bank</label>
              {editMode ? (
                <input
                  type="text"
                  value={editForm.Bank}
                  onChange={(e) => setEditForm(prev => ({ ...prev, Bank: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <p className="text-gray-900">{profile.fields.Bank || 'Ej angivet'}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bankkontonummer</label>
              {editMode ? (
                <input
                  type="text"
                  value={editForm.Bankkontonummer}
                  onChange={(e) => setEditForm(prev => ({ ...prev, Bankkontonummer: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <p className="text-gray-900">{profile.fields.Bankkontonummer || 'Ej angivet'}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Löneuppgifter */}
      <div className="bg-white rounded-lg shadow-sm p-6 relative">
        {editMode ? (
          <button
            onClick={saveProfile}
            disabled={saving}
            className="absolute top-4 right-4 bg-gray-500 text-white text-sm px-3 py-1 rounded-md hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            {saving ? 'Sparar...' : 'Spara'}
          </button>
        ) : (
          <button
            onClick={() => setEditMode(true)}
            className="absolute top-4 right-4 bg-gray-500 text-white text-sm px-3 py-1 rounded-md hover:bg-gray-600 transition-colors"
          >
            Redigera
          </button>
        )}
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Löneuppgifter</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Timlön</label>
            <p className="text-lg font-semibold text-green-600">
              {calculateTimlön()} kr/timme
            </p>
          </div>
           {/* Skattesats med hover-tooltip */}
          <div>
            <div className="flex items-center space-x-2 mb-1">
              <label className="block text-sm font-medium text-gray-700">Skattesats</label>
              <div className="relative group">
                <div className="flex items-center cursor-help text-gray-400 text-sm">
                  <span>Sänk din skatt</span>
                  <span className="ml-1">❓</span>
                </div>
                {/* Utökad hover‑area */}
                <div className="absolute -inset-3 group-hover:bg-transparent"></div>
                <div className="absolute bottom-full left-0 mb-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity duration-200 w-80 p-4 bg-gray-800 text-white text-sm rounded-lg shadow-lg z-10 pointer-events-none group-hover:pointer-events-auto">
                  <div className="space-y-3">
                    <p><strong>💡 Tips för dig som ung lärare:</strong></p>
                    <p>Som musiklärare har du troligen inte tillräckligt med timmar för att betala full skatt. Eftersom det här bara är ett extrajobb vid sidan av studier behöver du förmodligen inte skatta lika mycket som din nuvarande skattesats visar.</p>
                    <p><strong>Vad kan du göra?</strong><br/>
                    Ansök om jämkning hos Skatteverket! Nästan alla lärare borde göra detta eftersom i princip ingen har tillräckligt med timmar för att skatta fullt.</p>
                    <p>Det är enkelt och kan spara dig massor av pengar varje månad! 💰</p>
                    <a 
                      href="https://www.skatteverket.se/privat/etjansterochblanketter/blanketterbroschyrer/blanketter/info/4301.4.39f16f103821c58f680006624.html"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-2 px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors text-xs font-medium"
                    >
                      🔗 Jämkningsblankett på Skatteverket
                    </a>
                  </div>
                  <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
                </div>
              </div>
            </div>
            <p className="text-gray-900">
              {((profile.fields.Skattesats || 0) * 100).toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

        



      {/* Elever */}
      <div className="bg-white rounded-lg shadow-sm p-6 relative">
        {editMode ? (
          <button
            onClick={saveProfile}
            disabled={saving}
            className="absolute top-4 right-4 bg-gray-500 text-white text-sm px-3 py-1 rounded-md hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            {saving ? 'Sparar...' : 'Spara'}
          </button>
        ) : (
          <button
            onClick={() => setEditMode(true)}
            className="absolute top-4 right-4 bg-gray-500 text-white text-sm px-3 py-1 rounded-md hover:bg-gray-600 transition-colors"
          >
            Redigera
          </button>
        )}
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Elever</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {/* Nuvarande */}
          <div className="border border-gray-200 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-500">Nuvarande elever</p>
            <p className="mt-1 text-2xl font-bold text-green-600">
              {profile.fields.Elever?.length || 0}
            </p>
          </div>
          {/* Pågående ansökningar */}
          <div className="border border-gray-200 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-500">Pågående ansökningar</p>
            <p className="mt-1 text-2xl font-bold text-yellow-600">
              {profile.fields.Önskar?.length || 0}
            </p>
          </div>
          {/* Önskat antal */}
          <div
            className={`rounded-lg p-4 text-center ${
              editMode ? 'border-2 border-blue-500' : 'border border-gray-200'
            }`}
          >
            <p className="text-sm text-gray-500">Önskat antal elever</p>
            {editMode ? (
              <input
                type="number"
                min={0}
                value={editForm['Önskat antal elever']}
                onChange={(e) =>
                  setEditForm(prev => ({
                    ...prev,
                    'Önskat antal elever': parseInt(e.target.value) || 0,
                  }))
                }
                className="mt-1 w-full text-2xl font-bold focus:outline-none"
              />
            ) : (
              <p className="mt-1 text-2xl font-bold text-blue-600">
                {profile.fields['Önskat antal elever'] || 0}
              </p>
            )}
          </div>
        </div>
        <div className="mt-6 pt-4 border-t">
          <p className="text-sm text-gray-500">Fast månadslön</p>
          <p className="mt-1 text-lg font-semibold text-green-600">
            {calculateTimlön() * 4 * (profile.fields.Elever?.length || 0)} kr/månad
          </p>
          <p className="text-xs text-gray-500">
            (Timlön × 4 timmar × {profile.fields.Elever?.length || 0} elever)
          </p>
        </div>
        {editMode &&
          editForm['Önskat antal elever'] !== (profile.fields.Elever?.length || 0) && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-gray-500">
                Beräknad månadslön vid önskat antal
              </p>
              <p className="mt-1 text-base font-medium text-blue-600">
                {calculateTimlön() *
                  4 *
                  (editForm['Önskat antal elever'] || 0)}{' '}
                kr/månad
              </p>
              <p className="text-xs text-gray-500">
                (Timlön × 4 timmar × {editForm['Önskat antal elever'] || 0}{' '}
                elever)
              </p>
            </div>
          )}
      </div>

      {/* Biografi */}
      <div className="bg-white rounded-lg shadow-sm p-6 relative">
        {editMode ? (
          <button
            onClick={saveProfile}
            disabled={saving}
            className="absolute top-4 right-4 bg-gray-500 text-white text-sm px-3 py-1 rounded-md hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            {saving ? 'Sparar...' : 'Spara'}
          </button>
        ) : (
          <button
            onClick={() => setEditMode(true)}
            className="absolute top-4 right-4 bg-gray-500 text-white text-sm px-3 py-1 rounded-md hover:bg-gray-600 transition-colors"
          >
            Redigera
          </button>
        )}
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Biografi</h2>
        {editMode ? (
          <textarea
            value={editForm.Biografi}
            onChange={(e) =>
              setEditForm(prev => ({ ...prev, Biografi: e.target.value }))
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={6}
            placeholder="Berätta om dig själv…"
          />
        ) : (
          <div className="bg-gray-50 p-4 rounded-md">
            {profile.fields.Biografi ? (
              <p className="text-gray-900 whitespace-pre-wrap">
                {profile.fields.Biografi}
              </p>
            ) : (
              <p className="text-gray-500 italic">Ingen biografi skriven än</p>
            )}
          </div>
        )}
      </div>

      {/* Dokument */}
      <div className="bg-white rounded-lg shadow-sm p-6 relative">
        {editMode ? (
          <button
            onClick={saveProfile}
            disabled={saving}
            className="absolute top-4 right-4 bg-gray-500 text-white text-sm px-3 py-1 rounded-md hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            {saving ? 'Sparar...' : 'Spara'}
          </button>
        ) : (
          <button
            onClick={() => setEditMode(true)}
            className="absolute top-4 right-4 bg-gray-500 text-white text-sm px-3 py-1 rounded-md hover:bg-gray-600 transition-colors"
          >
            Redigera
          </button>
        )}
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Dokument</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Avtal */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Avtal</h3>
            {profile.fields.Avtal?.length ? (
              <div className="space-y-2">
                {profile.fields.Avtal.map((file, idx) => (
                  <a
                    key={idx}
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center p-2 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    <span className="mr-2">📄</span>
                    <span className="text-sm truncate">
                      {file.filename}
                    </span>
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">Inget avtal uppladdat</p>
            )}
            {editMode && (
              <div className="mt-3">
                <label className="block">
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => handleFileUpload(e, 'Avtal')}
                    disabled={uploadingFile === 'Avtal'}
                  />
                  <span className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer">
                    {uploadingFile === 'Avtal'
                      ? 'Laddar upp...'
                      : 'Ladda upp avtal'}
                  </span>
                </label>
              </div>
            )}
          </div>
          {/* Jämkning */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Jämkning</h3>
            {profile.fields.Jämkning?.length ? (
              <div className="space-y-2">
                {profile.fields.Jämkning.map((file, idx) => (
                  <a
                    key={idx}
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center p-2 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    <span className="mr-2">📄</span>
                    <span className="text-sm truncate">
                      {file.filename}
                    </span>
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">Ingen jämkning uppladdat</p>
            )}
            {editMode && (
              <div className="mt-3">
                <label className="block">
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => handleFileUpload(e, 'Jämkning')}
                    disabled={uploadingFile === 'Jämkning'}
                  />
                  <span className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer">
                    {uploadingFile === 'Jämkning'
                      ? 'Laddar upp...'
                      : 'Ladda upp jämkning'}
                  </span>
                </label>
              </div>
            )}
          </div>
          {/* Belastningsregister */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">
              Belastningsregister
            </h3>
            {profile.fields.Belastningsregister?.length ? (
              <div className="space-y-2">
                {profile.fields.Belastningsregister.map((file, idx) => (
                  <a
                    key={idx}
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center p-2 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    <span className="mr-2">📄</span>
                    <span className="text-sm truncate">
                      {file.filename}
                    </span>
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">
                Inget belastningsregister uppladdat
              </p>
            )}
            {editMode && (
              <div className="mt-3">
                <label className="block">
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) =>
                      handleFileUpload(e, 'Belastningsregister')
                    }
                    disabled={uploadingFile === 'Belastningsregister'}
                  />
                  <span className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer">
                    {uploadingFile === 'Belastningsregister'
                      ? 'Laddar upp...'
                      : 'Ladda upp belastningsregister'}
                  </span>
                </label>
              </div>
            )}
          </div>
        </div>
        
      </div>

      
    </div>
  )
}
