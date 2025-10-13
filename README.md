# Lärarsida

## Miljövariabler

| Namn | Beskrivning |
| --- | --- |
| `AIRTABLE_API_KEY` | API-nyckel för att läsa och uppdatera Airtable-basens tabeller. |
| `AIRTABLE_BASE_ID` | ID för Airtable-basen. |
| `LESSON_REPORT_WEBHOOK_URL` | URL till Make-webhooken som tar emot färdiga lektionsrapporter. |

## Skicka lektionsrapporter

När en lärare markerar en lektion som genomförd skickas anteckningar, läxa och guardian-information vidare till en Make-webhook via `/api/lesson-reports`. Säkerställ att miljövariabeln `LESSON_REPORT_WEBHOOK_URL` är satt så att rapporterna kan levereras.

## Komma igång lokalt

Installera beroenden och starta utvecklingsservern:

```bash
npm install
npm run dev
```

Applikationen nås därefter på [http://localhost:3000](http://localhost:3000).
