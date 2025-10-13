//layout.tsx från dashboard

'use client'

import { useSession, signOut } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'

type StudentListItem = {
  id: string
  namn: string
  Födelseår: number | null
  instrument: string
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const [isEleversOpen, setIsEleversOpen] = useState(true)
  const [elever, setElever] = useState<StudentListItem[]>([])
  const [loadingElever, setLoadingElever] = useState(true)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const initialBodyOverflow = useRef<string | null>(null)
  const mobileMenuTriggerRef = useRef<HTMLButtonElement | null>(null)
  const mobileMenuCloseRef = useRef<HTMLButtonElement | null>(null)
  const wasMobileMenuOpen = useRef(false)

  const fetchElever = useCallback(async () => {
    if (!session?.user?.teacherId) {
      setElever([])
      setLoadingElever(false)
      return
    }

    try {
      setLoadingElever(true)

      const response = await fetch('/api/students?scope=assigned')

      if (!response.ok) {
        throw new Error('Kunde inte hämta elever')
      }

      const data = await response.json()
      const records = Array.isArray(data.records) ? data.records : []

      // Formatera data för sidomenyn och sortera alfabetiskt
      const formattedStudents: StudentListItem[] = records.map((record: any) => ({
        id: record.id,
        namn: record.fields?.Namn || 'Okänt namn',
        Födelseår: record.fields?.Födelseår ?? null,
        instrument: record.fields?.Instrument || 'Okänt instrument',
      }))

      const sortedStudents = [...formattedStudents].sort((a, b) =>
        a.namn.localeCompare(b.namn, 'sv'),
      )

      setElever(sortedStudents)
    } catch (error) {
      console.error('Error fetching students:', error)
    } finally {
      setLoadingElever(false)
    }
  }, [session?.user?.teacherId])

  useEffect(() => {
    if (status === 'loading') return
    if (!session) router.push('/login')

    if (session?.user?.teacherId) {
      fetchElever()
    }
  }, [session, status, router, fetchElever])

  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    if (isMobileMenuOpen) {
      mobileMenuCloseRef.current?.focus()
    } else if (wasMobileMenuOpen.current) {
      mobileMenuTriggerRef.current?.focus()
    }

    wasMobileMenuOpen.current = isMobileMenuOpen
  }, [isMobileMenuOpen])

  useEffect(() => {
    if (typeof document === 'undefined') return

    const { body } = document

    if (initialBodyOverflow.current === null) {
      initialBodyOverflow.current = body.style.overflow || ''
    }

    if (isMobileMenuOpen) {
      body.style.overflow = 'hidden'
    } else {
      body.style.overflow = initialBodyOverflow.current
    }

    return () => {
      body.style.overflow = initialBodyOverflow.current || ''
    }
  }, [isMobileMenuOpen])

  useEffect(() => {
    if (!isMobileMenuOpen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMobileMenuOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isMobileMenuOpen])

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Laddar...</p>
        </div>
      </div>
    )
  }

  if (!session) return null

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/login' })
  }

  const calculateAge = (birthYear: number) => {
    const currentYear = new Date().getFullYear()
    return currentYear - birthYear
  }

  const isActivePage = (path: string) => {
    return pathname === path
      ? 'border-r-2 border-blue-500 bg-blue-100 text-blue-700'
      : 'text-gray-600 hover:bg-gray-50'
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      <div
        className={`fixed inset-0 z-30 bg-black/40 transition-opacity duration-200 ease-in-out md:hidden ${isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'pointer-events-none opacity-0'}`}
        onClick={() => setIsMobileMenuOpen(false)}
        aria-hidden="true"
      />

      <aside
        id="dashboard-sidebar"
        className={`fixed inset-y-0 left-0 z-40 w-72 transform bg-white shadow-lg transition-transform duration-200 ease-in-out md:relative md:flex md:w-64 md:translate-x-0 md:shadow-none ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
        aria-label="Lärarmeny"
      >
        <div className="flex h-full w-full flex-col">
          <div className="border-b border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500">
                  <span className="text-sm font-medium text-white">
                    {session.user?.name?.[0] || session.user?.email?.[0] || '?'}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {session.user?.name || 'Lärare'}
                  </p>
                  <p className="truncate text-xs text-gray-500">{session.user?.email}</p>
                </div>
              </div>
              <button
                type="button"
                ref={mobileMenuCloseRef}
                className="ml-4 inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 md:hidden"
                onClick={() => setIsMobileMenuOpen(false)}
                aria-label="Stäng meny"
              >
                ✕
              </button>
            </div>
          </div>

          <nav className="flex-1 py-4">
            <div className="px-3">
              <Link
                href="/dashboard"
                className={`mb-1 flex items-center rounded-md px-3 py-2 text-sm font-medium ${isActivePage('/dashboard')}`}
              >
                📊 <span className="ml-3">Dashboard</span>
              </Link>

              <div className="mb-1">
                <button
                  onClick={() => setIsEleversOpen(!isEleversOpen)}
                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                  aria-expanded={isEleversOpen}
                  aria-controls="dashboard-student-list"
                >
                  <div className="flex items-center">
                    👥 <span className="ml-3">Mina elever</span>
                  </div>
                  <span className="text-gray-400">{isEleversOpen ? '▼' : '▶'}</span>
                </button>

                {isEleversOpen && (
                  <div id="dashboard-student-list" className="mt-1 space-y-1 pl-5">
                    {loadingElever ? (
                      <div className="px-3 py-2 text-xs text-gray-400">Laddar elever...</div>
                    ) : elever.length > 0 ? (
                      elever.map((elev) => (
                        <Link
                          key={elev.id}
                          href={`/dashboard/elev/${elev.id}`}
                          className={`flex items-center rounded-md px-3 py-2 text-sm ${isActivePage(`/dashboard/elev/${elev.id}`)}`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate">{elev.namn}</p>
                            <p className="text-xs text-gray-400">
                              {elev.Födelseår ? calculateAge(elev.Födelseår) : '?'} år, {elev.instrument}
                            </p>
                          </div>
                        </Link>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-xs text-gray-400">Inga elever tilldelade än</div>
                    )}
                  </div>
                )}
              </div>

              <Link
                href="/dashboard/lektioner"
                className={`mb-1 flex items-center rounded-md px-3 py-2 text-sm font-medium ${isActivePage('/dashboard/lektioner')}`}
              >
                📅 <span className="ml-3">Alla lektioner</span>
              </Link>

              <Link
                href="/dashboard/elevkarta"
                className={`mb-1 flex items-center rounded-md px-3 py-2 text-sm font-medium ${isActivePage('/dashboard/elevkarta')}`}
              >
                🗺️ <span className="ml-3">Elevkarta</span>
              </Link>

              <Link
                href="/dashboard/profil"
                className={`mb-1 flex items-center rounded-md px-3 py-2 text-sm font-medium ${isActivePage('/dashboard/profil')}`}
              >
                👤 <span className="ml-3">Min profil</span>
              </Link>
            </div>
          </nav>

          <div className="border-t border-gray-200 p-4">
            <button
              onClick={handleLogout}
              className="flex w-full items-center rounded-md px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              🚪 <span className="ml-3">Logga ut</span>
            </button>
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between bg-white px-4 py-3 shadow md:hidden">
          <button
            type="button"
            ref={mobileMenuTriggerRef}
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label="Öppna meny"
            aria-expanded={isMobileMenuOpen}
            aria-controls="dashboard-sidebar"
          >
            ☰
          </button>
          <div className="flex-1 pl-4 text-right">
            <p className="text-sm font-medium text-gray-900">{session.user?.name || 'Lärare'}</p>
            <p className="text-xs text-gray-500">{session.user?.email}</p>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto bg-gray-50 p-6">{children}</main>
      </div>
    </div>
  )
}
