//layout.tsx från dashboard

'use client'

import { useSession, signOut } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const [isEleversOpen, setIsEleversOpen] = useState(true)
  const [elever, setElever] = useState<any[]>([])
  const [loadingElever, setLoadingElever] = useState(true)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  useEffect(() => {
    if (status === 'loading') return
    if (!session) router.push('/login')

    // Hämta elever när session är laddad
    if (session?.user?.teacherId) {
      fetchElever()
    }
  }, [session, status, router])

  useEffect(() => {
    setIsSidebarOpen(false)
  }, [pathname])

  const fetchElever = async () => {
  try {
    setLoadingElever(true)

    const response = await fetch('/api/students?scope=assigned')

    if (!response.ok) {
      throw new Error('Kunde inte hämta elever')
    }

    const data = await response.json()

    const myStudents = (data.records || [])
      .filter((record: any) => {
        const teacherRecordId = record.fields?.LärareRecordID

        if (Array.isArray(teacherRecordId)) {
          return teacherRecordId.includes(session?.user?.teacherId)
        }

        return teacherRecordId === session?.user?.teacherId
      })

    // Formatera data
    const formattedStudents = myStudents.map((record: any) => ({
      id: record.id,
      namn: record.fields.Namn || 'Okänt namn',
      Födelseår: record.fields.Födelseår || null,
      instrument: record.fields.Instrument || 'Okänt instrument',
    }))
    
    setElever(formattedStudents)
  } catch (error) {
    console.error('Error fetching students:', error)
  } finally {
    setLoadingElever(false)
  }
}

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Laddar...</p>
        </div>
      </div>
    )
  }

  if (!session) return null

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/login' })
  }

  // Beräkna ålder från födelseår
  const calculateAge = (birthYear: number) => {
    const currentYear = new Date().getFullYear()
    return currentYear - birthYear
  }

  const isActivePage = (path: string) => {
    return pathname === path
      ? 'bg-blue-100 text-blue-700 shadow-inner'
      : 'text-gray-600 hover:bg-gray-100'
  }

  return (
    <div className="min-h-dvh bg-gray-100">
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 border-b border-gray-200 bg-white/90 backdrop-blur md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            ☰ Meny
          </button>
          <div className="min-w-0 flex-1 px-4">
            <p className="truncate text-sm font-semibold text-gray-900">{session.user?.name || 'Lärare'}</p>
            <p className="truncate text-xs text-gray-500">{session.user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 shadow-sm hover:bg-red-50"
          >
            Logga ut
          </button>
        </div>
      </div>

      <div className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col md:min-h-dvh md:flex-row">
        {isSidebarOpen && (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-black/40 transition-opacity md:hidden"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Stäng menyn"
          />
        )}

        <aside
          className={`${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-40 w-full max-w-xs transform bg-white shadow-xl transition-transform duration-200 ease-in-out md:static md:z-auto md:flex md:w-64 md:max-w-none md:translate-x-0 md:shadow-none`}
        >
          <div className="flex h-full flex-col border-r border-gray-200 bg-white md:border-r md:border-gray-200">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 md:hidden">
              <p className="text-sm font-semibold text-gray-900">Navigering</p>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              >
                <span className="sr-only">Stäng menyn</span>
                ✕
              </button>
            </div>

            <div className="border-b border-gray-200 p-4">
              <div className="flex items-center space-x-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500 text-sm font-medium text-white">
                  {session.user?.name?.[0] || session.user?.email?.[0] || '?'}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900">{session.user?.name || 'Lärare'}</p>
                  <p className="truncate text-xs text-gray-500">{session.user?.email}</p>
                </div>
              </div>
            </div>

            <nav className="flex-1 overflow-y-auto py-4">
              <div className="space-y-1 px-4">
                <Link
                  href="/dashboard"
                  className={`flex items-center rounded-md px-3 py-2 text-sm font-medium transition ${isActivePage('/dashboard')}`}
                >
                  📊 <span className="ml-3">Dashboard</span>
                </Link>

                <div className="rounded-md bg-gray-50/60 p-2">
                  <button
                    onClick={() => setIsEleversOpen(!isEleversOpen)}
                    className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-100"
                  >
                    <span className="flex items-center">
                      👥 <span className="ml-3">Mina elever</span>
                    </span>
                    <span className="text-gray-500">{isEleversOpen ? '−' : '+'}</span>
                  </button>

                  {isEleversOpen && (
                    <div className="mt-2 space-y-1 pl-6">
                      {loadingElever ? (
                        <div className="px-2 py-1 text-xs text-gray-400">Laddar elever…</div>
                      ) : elever.length > 0 ? (
                        elever.map((elev) => (
                          <Link
                            key={elev.id}
                            href={`/dashboard/elev/${elev.id}`}
                            className={`flex items-center rounded-md px-2 py-1.5 text-sm transition ${isActivePage(`/dashboard/elev/${elev.id}`)}`}
                          >
                            <div className="min-w-0">
                              <p className="truncate">{elev.namn}</p>
                              <p className="text-xs text-gray-400">
                                {elev.Födelseår ? calculateAge(elev.Födelseår) : '?'} år, {elev.instrument}
                              </p>
                            </div>
                          </Link>
                        ))
                      ) : (
                        <div className="px-2 py-1 text-xs text-gray-400">Inga elever tilldelade än</div>
                      )}
                    </div>
                  )}
                </div>

                <Link
                  href="/dashboard/lektioner"
                  className={`flex items-center rounded-md px-3 py-2 text-sm font-medium transition ${isActivePage('/dashboard/lektioner')}`}
                >
                  📅 <span className="ml-3">Alla lektioner</span>
                </Link>

                <Link
                  href="/dashboard/elevkarta"
                  className={`flex items-center rounded-md px-3 py-2 text-sm font-medium transition ${isActivePage('/dashboard/elevkarta')}`}
                >
                  🗺️ <span className="ml-3">Elevkarta</span>
                </Link>

                <Link
                  href="/dashboard/profil"
                  className={`flex items-center rounded-md px-3 py-2 text-sm font-medium transition ${isActivePage('/dashboard/profil')}`}
                >
                  👤 <span className="ml-3">Min profil</span>
                </Link>
              </div>
            </nav>

            <div className="border-t border-gray-200 p-4">
              <button
                onClick={handleLogout}
                className="flex w-full items-center justify-center rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
              >
                🚪 <span className="ml-3">Logga ut</span>
              </button>
            </div>
          </div>
        </aside>

        <div className="flex flex-1 flex-col md:overflow-hidden">
          <main className="flex-1 bg-gray-50 px-4 py-6 sm:px-6 md:overflow-y-auto md:px-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}