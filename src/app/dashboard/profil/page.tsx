'use client'

import { useEffect, useState } from 'react'
import type { MouseEvent } from 'react'
import { useSession } from 'next-auth/react'

import { MAX_FILE_SIZE_BYTES, fileToBase64 } from '@/lib/client/files'

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
    Elev?: string[]
    Elever?: string[]
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
  const [removingAttachment, setRemovingAttachment] = useState<string | null>(null)
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

  const populateFormFromProfile = (fields: TeacherProfile['fields']) => {
    setEditForm({
      Namn: fields.Namn || '',
      Instrument: fields.Instrument || '',
      Adress: fields.Adress || '',
      Ort: fields.Ort || '',
      'E-post': fields['E-post'] || '',
      Telefon: fields.Telefon || '',
      Bankkontonummer: fields.Bankkontonummer || '',
      Bank: fields.Bank || '',
      Personnummer: fields.Personnummer || '',
      Biografi: fields.Biografi || '',
      'Önskat antal elever': fields['Önskat antal elever'] || 0,
    })
  }

  const handleCancelEdit = () => {
    if (profile) {
      populateFormFromProfile(profile.fields)
    }
    setEditMode(false)
  }

  const handleEnterEditMode = () => {
    if (profile) {
      populateFormFromProfile(profile.fields)
    }
    setEditMode(true)
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

  const handleEditAction = (event?: MouseEvent<HTMLButtonElement>) => {
    if (saving) return
    if (editMode) {
      void saveProfile()
    } else {
      const triggerButton = event?.currentTarget ?? null
      const previousTop = triggerButton?.getBoundingClientRect().top ?? null

      handleEnterEditMode()

      if (triggerButton && previousTop !== null) {
        requestAnimationFrame(() => {
          const newTop = triggerButton.getBoundingClientRect().top
          window.scrollBy({ top: newTop - previousTop })
        })
      }
    }
  }

  const editActionLabel = saving ? 'Sparar…' : editMode ? 'Spara' : 'Redigera'

  const EditActionButton = ({ className = '', ariaLabel }: { className?: string; ariaLabel?: string }) => (
    <button
      type="button"
      onClick={handleEditAction}
      disabled={saving}
      className={`inline-flex items-center rounded-full bg-gray-100/70 px-2.5 py-1 text-xs font-medium text-gray-500 transition hover:bg-gray-200 hover:text-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      aria-label={
        ariaLabel ?? (editMode ? 'Spara dina ändringar' : 'Aktivera redigeringsläge')
      }
    >
      {editActionLabel}
    </button>
  )

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
      populateFormFromProfile(data.fields)
    } catch (err) {
      console.error(err)
      setStatusMessage({ type: 'error', message: 'Fel vid hämtning av profil' })
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setStatusMessage({
        type: 'error',
        message: 'Filen är för stor. Maxstorlek är 5 MB.',
      })
      e.target.value = ''
      return
    }

    try {
      setUploadingFile(field)
      setStatusMessage(null)

      const base64 = await fileToBase64(file)

      const res = await fetch('/api/airtable/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          field,
          fileName: file.name,
          contentType: file.type || 'application/octet-stream',
          base64,
        }),
      })

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error || 'Fel vid uppladdning')
      }

      setStatusMessage({
        type: 'success',
        message: `Filen "${file.name}" har laddats upp!`,
      })

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

  const handleRemoveAttachment = async (field: string, attachmentId: string, fileName: string) => {
    const confirmed = window.confirm(`Är du säker på att du vill ta bort "${fileName}"?`)
    if (!confirmed) {
      return
    }

    try {
      setRemovingAttachment(attachmentId)
      setStatusMessage(null)

      const response = await fetch('/api/airtable/attachments', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ field, attachmentId }),
      })

      const result = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(result?.error || 'Fel vid borttagning')
      }

      setStatusMessage({
        type: 'success',
        message: `Dokumentet "${fileName}" har tagits bort.`,
      })

      await fetchProfile()
    } catch (error) {
      console.error(error)
      setStatusMessage({ type: 'error', message: 'Kunde inte ta bort dokumentet.' })
    } finally {
      setRemovingAttachment(null)
    }
  }


  const calculateTimlön = () =>
    (profile?.fields.Grundlön || 0) + (profile?.fields.Lönenpålägg || 0)

  const assignedStudentsCount =
    profile?.fields['Elev']?.length ?? profile?.fields.Elever?.length ?? 0

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
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 pb-12 sm:px-6 lg:px-8">
      {/* Status */}
      {statusMessage && (
        <div
          className={`rounded-xl border p-3 shadow-sm sm:p-4 ${
            statusMessage.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2 text-sm sm:text-base">
            <span>{statusMessage.type === 'success' ? '✅' : '❌'}</span>
            {statusMessage.message}
          </div>
        </div>
      )}

      {/* Header */}
      <div
        className={`relative flex flex-col gap-4 rounded-2xl border bg-white/80 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6 ${
          editMode ? 'border-blue-200 ring-2 ring-blue-100' : 'border-gray-200 ring-1 ring-gray-100'
        }`}
      >
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="relative">
            {profile.fields.Profilbild?.[0]?.url ? (
              <img
                src={profile.fields.Profilbild[0].url}
                alt="Profilbild"
                className="h-16 w-16 rounded-full border-4 border-gray-200 object-cover sm:h-20 sm:w-20"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-500 text-xl font-bold text-white sm:h-20 sm:w-20 sm:text-2xl">
                {profile.fields.Namn?.[0] || '?'}
              </div>
            )}
            {editMode && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
                <label className="cursor-pointer text-xs text-white">
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
            <h1 className="text-xl font-bold text-gray-900 sm:text-3xl">{profile.fields.Namn}</h1>
            <p className="text-sm text-gray-600 sm:text-base">
              {profile.fields.Instrument || 'Instrument ej angivet'}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 sm:hidden">
          {editMode && (
            <button
              type="button"
              onClick={handleCancelEdit}
              className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-100"
            >
              ✏️ Redigerar
            </button>
          )}
          <EditActionButton ariaLabel={editMode ? 'Spara dina profiländringar' : 'Redigera din profil'} />
        </div>
        <div className="absolute right-4 top-4 hidden items-center gap-2 sm:flex">
          {editMode && (
            <button
              type="button"
              onClick={handleCancelEdit}
              className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-100"
            >
              Avbryt
            </button>
          )}
          <EditActionButton ariaLabel={editMode ? 'Spara dina profiländringar' : 'Redigera din profil'} />
        </div>
      </div>

      {/* Personuppgifter */}
      <div
        className={`relative rounded-2xl bg-white/80 p-4 shadow-sm sm:p-6 ${
          editMode ? 'border border-blue-200 ring-2 ring-blue-100' : 'border border-gray-200 ring-1 ring-gray-100'
        }`}
      >
        <div className="mb-4 flex items-start justify-between gap-2">
          <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">Personuppgifter</h2>
          <EditActionButton ariaLabel={editMode ? 'Spara uppdaterade personuppgifter' : 'Redigera dina personuppgifter'} />
        </div>
        {editMode && (
          <p className="mb-4 text-xs font-medium text-blue-700 sm:text-sm">
            Uppdatera dina uppgifter nedan och spara när du är klar.
          </p>
        )}
        <div className="grid grid-cols-1 gap-5 min-[360px]:grid-cols-2 md:gap-6">
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
      <div
        className={`relative rounded-2xl bg-white/80 p-4 shadow-sm sm:p-6 ${
          editMode ? 'border border-blue-200 ring-2 ring-blue-100' : 'border border-gray-200 ring-1 ring-gray-100'
        }`}
      >
        <h2 className="mb-4 text-lg font-semibold text-gray-900 sm:text-xl">Löneuppgifter</h2>
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
      <div
        className={`relative rounded-2xl bg-white/80 p-4 shadow-sm sm:p-6 ${
          editMode ? 'border border-blue-200 ring-2 ring-blue-100' : 'border border-gray-200 ring-1 ring-gray-100'
        }`}
      >
        <div className="mb-4 flex items-start justify-between gap-2">
          <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">Elever</h2>
          <EditActionButton ariaLabel={editMode ? 'Spara dina uppdateringar kring elever' : 'Redigera dina elevuppgifter'} />
        </div>
        {editMode && (
          <p className="mb-4 text-xs font-medium text-blue-700 sm:text-sm">
            Justera dina mål och följ upp elevantalet här nedan.
          </p>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
          {/* Nuvarande */}
          <div className="rounded-lg border border-gray-200 p-4 text-center">
            <p className="text-xs uppercase tracking-wide text-gray-500 sm:text-sm">Nuvarande elever</p>
            <p className="mt-1 text-2xl font-bold text-green-600 sm:text-3xl">
              {assignedStudentsCount}
            </p>
          </div>
          {/* Pågående ansökningar */}
          <div className="rounded-lg border border-gray-200 p-4 text-center">
            <p className="text-xs uppercase tracking-wide text-gray-500 sm:text-sm">Pågående ansökningar</p>
            <p className="mt-1 text-2xl font-bold text-yellow-600 sm:text-3xl">
              {profile.fields.Önskar?.length || 0}
            </p>
          </div>
          {/* Önskat antal */}
          <div
            className={`rounded-lg p-4 text-center ${
              editMode ? 'border-2 border-blue-500' : 'border border-gray-200'
            }`}
          >
            <p className="text-xs uppercase tracking-wide text-gray-500 sm:text-sm">Önskat antal elever</p>
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
                className="mt-1 w-full text-2xl font-bold focus:outline-none sm:text-3xl"
              />
            ) : (
              <p className="mt-1 text-2xl font-bold text-blue-600 sm:text-3xl">
                {profile.fields['Önskat antal elever'] || 0}
              </p>
            )}
          </div>
        </div>
        <div className="mt-6 border-t pt-4">
          <p className="text-xs uppercase tracking-wide text-gray-500 sm:text-sm">Fast månadslön</p>
          <p className="mt-1 text-lg font-semibold text-green-600 sm:text-xl">
            {calculateTimlön() * 4 * assignedStudentsCount} kr/månad
          </p>
          <p className="text-xs text-gray-500 sm:text-sm">
            (Timlön × 4 timmar × {assignedStudentsCount} elever)
          </p>
        </div>
        {editMode &&
          editForm['Önskat antal elever'] !== assignedStudentsCount && (
            <div className="mt-4 border-t pt-4">
              <p className="text-xs uppercase tracking-wide text-gray-500 sm:text-sm">
                Beräknad månadslön vid önskat antal
              </p>
              <p className="mt-1 text-base font-medium text-blue-600 sm:text-lg">
                {calculateTimlön() *
                  4 *
                  (editForm['Önskat antal elever'] || 0)}{' '}
                kr/månad
              </p>
              <p className="text-xs text-gray-500 sm:text-sm">
                (Timlön × 4 timmar × {editForm['Önskat antal elever'] || 0}{' '}
                elever)
              </p>
            </div>
          )}
      </div>

      {/* Biografi */}
      <div
        className={`relative rounded-2xl bg-white/80 p-4 shadow-sm sm:p-6 ${
          editMode ? 'border border-blue-200 ring-2 ring-blue-100' : 'border border-gray-200 ring-1 ring-gray-100'
        }`}
      >
        <div className="mb-4 flex items-start justify-between gap-2">
          <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">Biografi</h2>
          <EditActionButton ariaLabel={editMode ? 'Spara din uppdaterade biografi' : 'Redigera din biografi'} />
        </div>
        {editMode ? (
          <textarea
            value={editForm.Biografi}
            onChange={(e) =>
              setEditForm(prev => ({ ...prev, Biografi: e.target.value }))
            }
            className="h-40 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Berätta om dig själv…"
          />
        ) : (
          <div className="rounded-md bg-gray-50 p-4">
            {profile.fields.Biografi ? (
              <p className="whitespace-pre-wrap text-sm text-gray-900 sm:text-base">
                {profile.fields.Biografi}
              </p>
            ) : (
              <p className="text-sm italic text-gray-500">Ingen biografi skriven än</p>
            )}
          </div>
        )}
      </div>

      {/* Dokument */}
      <div
        className={`relative rounded-2xl bg-white/80 p-4 shadow-sm sm:p-6 ${
          editMode ? 'border border-blue-200 ring-2 ring-blue-100' : 'border border-gray-200 ring-1 ring-gray-100'
        }`}
      >
        <div className="mb-4 flex items-start justify-between gap-2">
          <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">Dokument</h2>
          <EditActionButton ariaLabel={editMode ? 'Spara dina uppdaterade dokumentval' : 'Redigera dina dokument'} />
        </div>
        {editMode && (
          <p className="mb-4 text-xs font-medium text-blue-700 sm:text-sm">
            Ladda upp nya filer eller ersätt befintliga dokument.
          </p>
        )}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-6">
          {/* Avtal */}
          <div>
            <h3 className="mb-3 text-base font-semibold text-gray-900 sm:text-lg">Avtal</h3>
            {profile.fields.Avtal?.length ? (
              <div className="space-y-2">
                {profile.fields.Avtal.map((file, idx) => (
                  <div key={file.id ?? idx} className="flex items-center gap-2">
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-1 items-center gap-2 rounded-md border border-gray-200 p-3 text-sm hover:bg-gray-50 transition-colors"
                    >
                      <span>📄</span>
                      <span className="truncate">{file.filename}</span>
                    </a>
                    {editMode && (
                      <button
                        type="button"
                        onClick={() => file.id && handleRemoveAttachment('Avtal', file.id, file.filename)}
                        disabled={removingAttachment === file.id || !file.id}
                        className="shrink-0 rounded-md border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {removingAttachment === file.id ? 'Tar bort…' : 'Ta bort'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Inget avtal uppladdat</p>
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
                  <span className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer">
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
            <h3 className="mb-3 text-base font-semibold text-gray-900 sm:text-lg">Jämkning</h3>
            {profile.fields.Jämkning?.length ? (
              <div className="space-y-2">
                {profile.fields.Jämkning.map((file, idx) => (
                  <div key={file.id ?? idx} className="flex items-center gap-2">
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-1 items-center gap-2 rounded-md border border-gray-200 p-3 text-sm hover:bg-gray-50 transition-colors"
                    >
                      <span>📄</span>
                      <span className="truncate">{file.filename}</span>
                    </a>
                    {editMode && (
                      <button
                        type="button"
                        onClick={() => file.id && handleRemoveAttachment('Jämkning', file.id, file.filename)}
                        disabled={removingAttachment === file.id || !file.id}
                        className="shrink-0 rounded-md border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {removingAttachment === file.id ? 'Tar bort…' : 'Ta bort'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Ingen jämkning uppladdat</p>
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
                  <span className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer">
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
                  <div key={file.id ?? idx} className="flex items-center gap-2">
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-1 items-center rounded-md border border-gray-200 p-2 text-sm hover:bg-gray-50 transition-colors"
                    >
                      <span className="mr-2">📄</span>
                      <span className="truncate">{file.filename}</span>
                    </a>
                    {editMode && (
                      <button
                        type="button"
                        onClick={() =>
                          file.id && handleRemoveAttachment('Belastningsregister', file.id, file.filename)
                        }
                        disabled={removingAttachment === file.id || !file.id}
                        className="shrink-0 rounded-md border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {removingAttachment === file.id ? 'Tar bort…' : 'Ta bort'}
                      </button>
                    )}
                  </div>
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
