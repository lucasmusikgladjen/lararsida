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

  useEffect(() => {
    if (status === 'loading') return
    if (!session) router.push('/login')
    
    // Hämta elever när session är laddad
    if (session?.user?.teacherId) {
      fetchElever()
    }
  }, [session, status, router])

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
    return pathname === path ? 'bg-blue-100 text-blue-700 border-r-2 border-blue-500' : 'text-gray-600 hover:bg-gray-50'
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-lg flex flex-col">
        {/* User Info */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white font-medium text-sm">
                {session.user?.name?.[0] || session.user?.email?.[0] || '?'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {session.user?.name || 'Lärare'}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {session.user?.email}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4">
          <div className="px-3">
            {/* Dashboard */}
            <Link
              href="/dashboard"
              className={`flex items-center px-3 py-2 text-sm font-medium rounded-md mb-1 ${isActivePage('/dashboard')}`}
            >
              📊 <span className="ml-3">Dashboard</span>
            </Link>

            {/* Mina elever */}
            <div className="mb-1">
              <button
                onClick={() => setIsEleversOpen(!isEleversOpen)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-50"
              >
                <div className="flex items-center">
                  👥 <span className="ml-3">Mina elever</span>
                </div>
                <span className="text-gray-400">
                  {isEleversOpen ? '▼' : '▶'}
                </span>
              </button>
              
              {isEleversOpen && (
                <div className="ml-8 mt-1 space-y-1">
                  {loadingElever ? (
                    <div className="px-3 py-2 text-xs text-gray-400">
                      Laddar elever...
                    </div>
                  ) : elever.length > 0 ? (
                    elever.map((elev) => (
                      <Link
                        key={elev.id}
                        href={`/dashboard/elev/${elev.id}`}
                        className={`flex items-center px-3 py-2 text-sm rounded-md ${isActivePage(`/dashboard/elev/${elev.id}`)}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="truncate">{elev.namn}</p>
                          <p className="text-xs text-gray-400">
                            {elev.Födelseår ? calculateAge(elev.Födelseår) : '?'} år, {elev.instrument}
                          </p>
                        </div>
                      </Link>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-xs text-gray-400">
                      Inga elever tilldelade än
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Alla lektioner */}
            <Link
              href="/dashboard/lektioner"
              className={`flex items-center px-3 py-2 text-sm font-medium rounded-md mb-1 ${isActivePage('/dashboard/lektioner')}`}
            >
              📅 <span className="ml-3">Alla lektioner</span>
            </Link>

            {/* Elevkarta */}
            <Link
              href="/dashboard/elevkarta"
              className={`flex items-center px-3 py-2 text-sm font-medium rounded-md mb-1 ${isActivePage('/dashboard/elevkarta')}`}
            >
              🗺️ <span className="ml-3">Elevkarta</span>
            </Link>

            {/* Min profil */}
            <Link
              href="/dashboard/profil"
              className={`flex items-center px-3 py-2 text-sm font-medium rounded-md mb-1 ${isActivePage('/dashboard/profil')}`}
            >
              👤 <span className="ml-3">Min profil</span>
            </Link>
          </div>
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="w-full flex items-center px-3 py-2 text-sm font-medium text-red-600 rounded-md hover:bg-red-50"
          >
            🚪 <span className="ml-3">Logga ut</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}