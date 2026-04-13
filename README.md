# Lärarsida

## Miljövariabler

| Namn | Beskrivning |
| --- | --- |
| `AIRTABLE_API_KEY` | API-nyckel för att läsa och uppdatera Airtable-basens tabeller. |
| `AIRTABLE_BASE_ID` | ID för Airtable-basen. |

## Skicka lektionsrapporter

När en lärare markerar en lektion som genomförd anropas `/api/lesson-reports` för kompatibilitet med dashboard-flödet.

## Komma igång lokalt

Installera beroenden och starta utvecklingsservern:

```bash
npm install
npm run dev
```

Applikationen nås därefter på [http://localhost:3000](http://localhost:3000).
