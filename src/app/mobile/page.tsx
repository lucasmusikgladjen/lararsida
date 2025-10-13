import Link from 'next/link'

const quickLinks = [
  {
    title: 'Inloggning',
    description: 'Förfinad layout med mjuka kanter, tydliga fält och trygg knappstorlek.',
    href: '/login',
    color: 'from-blue-500/10 to-blue-500/5'
  },
  {
    title: 'Återställ lösenord',
    description: 'Formulär med förbättrad läsbarhet och extra stödtexter i mobilen.',
    href: '/register',
    color: 'from-emerald-500/10 to-emerald-500/5'
  },
  {
    title: 'Dashboard',
    description: 'Responsivt sidofält, tydlig veckoöversikt och mobilanpassade åtgärder.',
    href: '/dashboard',
    color: 'from-indigo-500/10 to-indigo-500/5'
  }
]

const checklist = [
  'Responsiv navigering med mobilmeny och snabba genvägar.',
  'Veckoöversikt som staplar innehåll och bibehåller läsbarhet på små skärmar.',
  'Åtgärdsknappar och formulärfält som skalar till full bredd i vertikalt läge.',
  'Förbättrade typografiska hierarkier för enklare skanning och fokus.',
]

export default function MobileImprovementsPage() {
  return (
    <div className="min-h-dvh bg-gradient-to-b from-slate-50 via-white to-white px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-10">
        <header className="space-y-4 text-center sm:text-left">
          <p className="inline-flex items-center rounded-full bg-blue-100 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
            Mobil UI-översikt
          </p>
          <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">
            Mobilförbättringar för lärarportalen
          </h1>
          <p className="text-base text-gray-600 sm:text-lg">
            Den här sidan samlar de största justeringarna för mobilupplevelsen och gör det enkelt att hoppa vidare till respektive vy.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white/80 p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${link.color} opacity-0 transition-opacity duration-300 group-hover:opacity-100`} aria-hidden />
              <div className="relative space-y-2">
                <h2 className="text-lg font-semibold text-gray-900">{link.title}</h2>
                <p className="text-sm text-gray-600">{link.description}</p>
                <span className="inline-flex items-center text-sm font-semibold text-blue-600 transition group-hover:translate-x-1">
                  Öppna sidan →
                </span>
              </div>
            </Link>
          ))}
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white/80 p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">Vad som är åtgärdat</h2>
          <ul className="mt-4 space-y-3 text-sm text-gray-700">
            {checklist.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span className="mt-1 text-green-500">✔</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-blue-200 bg-blue-50/60 p-6 text-sm text-blue-900">
          <h2 className="text-lg font-semibold">Fortsatt förbättring</h2>
          <p className="mt-2 leading-relaxed">
            Testa gärna flödena direkt på mobilen eller via utvecklarverktyg för att säkerställa att inga komponenter hoppar utanför skärmen.
            Den här dedikerade mobilsidan kan fungera som startpunkt för framtida QA och visualisering av förbättringsbehov.
          </p>
        </section>
      </div>
    </div>
  )
}
