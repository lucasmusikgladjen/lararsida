'use client'

import { useState } from 'react'
import { signIn, getSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError('Fel e-post eller lösenord')
      } else {
        // Kontrollera session och redirecta
        const session = await getSession()
        if (session) {
          router.push('/dashboard')
        }
      }
    } catch (error) {
      setError('Något gick fel. Försök igen.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh bg-gray-100">
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-4 py-10 sm:px-6">
        <div className="rounded-2xl bg-white/95 p-6 shadow-xl ring-1 ring-gray-100 sm:p-8">
          <div className="mb-8 space-y-2 text-center">
            <p className="text-sm font-medium uppercase tracking-wide text-blue-600">Lärarportal</p>
            <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl">Logga in</h1>
            <p className="text-sm text-gray-600">Kom åt ditt schema och dina elever var du än befinner dig.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="email" className="block text-left text-sm font-medium text-gray-700">
                E-postadress
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-base text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
                placeholder="namn@exempel.se"
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-left text-sm font-medium text-gray-700">
                Lösenord
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-base text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-base font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Loggar in…' : 'Logga in'}
            </button>
          </form>

          <div className="mt-8 space-y-2 text-center text-sm">
            <a href="/register" className="block font-medium text-green-600 transition hover:text-green-700">
              Skapa eller ändra lösenord (för befintliga lärare)
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}