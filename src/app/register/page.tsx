'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [resetCode, setResetCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    // Validering
    if (password !== confirmPassword) {
      setError('Lösenorden matchar inte')
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setError('Lösenordet måste vara minst 6 tecken')
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, resetCode }),
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess('Lösenord uppdaterat! Du kan nu logga in.')
        setTimeout(() => {
          router.push('/login')
        }, 2000)
      } else {
        setError(data.error || 'Något gick fel')
      }
    } catch (error) {
      setError('Något gick fel. Försök igen.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh bg-gray-100">
      <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col justify-center px-4 py-10 sm:px-6">
        <div className="rounded-2xl bg-white/95 p-6 shadow-xl ring-1 ring-gray-100 sm:p-10">
          <div className="mb-8 space-y-2 text-center">
            <p className="text-sm font-medium uppercase tracking-wide text-emerald-600">Återställning</p>
            <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl">Sätt nytt lösenord</h1>
            <p className="text-sm text-gray-600">Ange din e-post, återställningskod och välj ett nytt lösenord.</p>
            <p className="text-xs text-gray-500">Återställningskoden får du av administratören.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="email" className="block text-left text-sm font-medium text-gray-700">
                E-post (som finns i systemet)
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-base text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                placeholder="namn@exempel.se"
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="resetCode" className="block text-left text-sm font-medium text-gray-700">
                Återställningskod
              </label>
              <input
                id="resetCode"
                type="text"
                value={resetCode}
                onChange={(e) => setResetCode(e.target.value)}
                required
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-base text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                placeholder="Kod från administratören"
                autoComplete="one-time-code"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-left text-sm font-medium text-gray-700">
                Nytt lösenord
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-base text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                placeholder="Minst 6 tecken"
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="block text-left text-sm font-medium text-gray-700">
                Bekräfta lösenord
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-base text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                placeholder="Skriv lösenordet igen"
                autoComplete="new-password"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-base font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Uppdaterar…' : 'Sätt nytt lösenord'}
            </button>
          </form>

          <div className="mt-8 text-center text-sm">
            <a href="/login" className="font-medium text-blue-600 transition hover:text-blue-700">
              Tillbaka till inloggning
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}