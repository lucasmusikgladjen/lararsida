# CLAUDE.md — Lärarsida

## Vad det här är

Lärarsida är en webbportal för musikinstrumentlärare hos Musikglädjen. Lärare loggar in för att hantera sitt schema, rapportera lektioner, hitta nya elever och kommunicera med vårdnadshavare.

Admin-dashboarden (separat repo: `musikgladjen-admin`) hanterar matchning och administration. Lärarsida är lärarens eget verktyg.

## Tech stack

- **Framework:** Next.js (App Router), React, TypeScript
- **Styling:** Tailwind CSS
- **Databas:** Airtable (via REST API, se `src/lib/airtable.ts`)
- **Auth:** NextAuth med JWT (lärarens `teacherId` lagras i sessionen)
- **Deployment:** Vercel

## Projektstruktur

```
src/
├── app/
│   ├── api/           → Backend-routes (first-lesson, lessons, students, m.fl.)
│   └── dashboard/     → Sidorna läraren ser
│       ├── forsta-lektionen/   → Formulär för första lektionen
│       ├── lektioner/          → Lektionsschema
│       ├── elev/               → Elevprofiler
│       └── profil/             → Lärarprofil
├── lib/               → Airtable-klient, auth-helpers, lesson-fields
└── types/             → Delade TypeScript-typer
```

## Viktiga Airtable-kopplingar

| Airtable-tabell | Används till |
|---|---|
| `Lektioner` | Lektionsposter — en rad per lektion |
| `Matchningar` | Kopplingen lärare ↔ elev, med status och datum |
| `Elever` | Elevinfo |
| `Vårdnadshavare` | Föräldrar/kontakter, tar emot lektionsrapporter via e-post |
| `Lärare` | Lärarens profil och inloggning |

## Vad "Första lektionen"-formuläret gör

Formulär: `src/app/dashboard/forsta-lektionen/page.tsx`  
API: `src/app/api/first-lesson/route.ts`

När läraren skickar in formuläret händer två saker:

1. **Skapar lektionsposter i `Lektioner`** — första lektionen (Genomförd: true) + alla återkommande lektioner varje vecka fram till terminsslutet.
2. **Uppdaterar `Matchningar` → fältet `Första lektion genomförd`** med dagens datum, på den rad som matchar rätt elev + lärare.

> OBS: Fältet `Första lektionen` på `Vårdnadshavare`-tabellen berörs **inte** av detta formulär.
