# React Native App - Kravdokumentation

## Översikt

Denna dokumentation sammanfattar syftet med Lärarsida-webbapplikationen och dess verksamhet, som grund för utveckling av en React Native-app.

---

## 1. Syfte med hemsidan

**Lärarsida** är en digital lärarportal för **musikinstrumentlärare** som hanterar privatundervisning. Plattformen fungerar som ett nav mellan lärare, elever och vårdnadshavare.

### Kärnfunktioner

| Funktion | Beskrivning |
|----------|-------------|
| **Veckoschema** | Läraren ser sina lektioner veckovis och kan navigera mellan veckor |
| **Lektionsrapportering** | Markera lektioner som genomförda med anteckningar och läxa |
| **Ombokning/Inställning** | Hantera schemaändringar med anledning |
| **Elevkarta** | Interaktiv karta för att hitta nya elever som söker lärare |
| **Första lektion** | Skapa initial lektion och generera återkommande lektionsschema |
| **Elevprofiler** | Se elevinfo, vårdnadshavare, lektionshistorik och terminsmål |
| **Lärarprofil** | Hantera personlig info, bankuppgifter och dokument |

### Automatiseringar

- **Lektionsrapport till vårdnadshavare**: När läraren markerar en lektion som genomförd skickas automatiskt e-post till vårdnadshavaren med anteckningar och läxa
- **Schemaläggning**: Vid första lektionen skapas automatiskt lektioner fram till terminsslut

---

## 2. Koppling till verksamheten

### Affärsmodell

Lärarsida verkar som en **förmedlingstjänst för musikundervisning** där:

1. **Elever/föräldrar** anmäler intresse för instrumentundervisning
2. **Administratörer** registrerar elever i systemet med geografiska koordinater
3. **Lärare** hittar elever via elevkartan och registrerar intresse
4. **Matchning** sker baserat på läge, instrument och tillgänglighet
5. **Löpande undervisning** hanteras via plattformen med automatiserad kommunikation

### Intressenter

| Roll | Systemåtkomst | Huvudbehov |
|------|---------------|------------|
| **Lärare** | Full appåtkomst | Schema, rapportering, hitta elever |
| **Vårdnadshavare** | Passiv (e-post) | Lektionsrapporter, kommunikation |
| **Elev** | Ingen direkt | Undervisning |
| **Administratör** | Backend | Elevregistrering, meddelanden |

### Dataflöde

```
Elev anmäler sig → Admin registrerar i Airtable →
Lärare ser på karta → Lärare registrerar intresse →
Admin matchar → Lärare skapar schema →
Lektioner genomförs → Rapport till vårdnadshavare
```

---

## 3. Användarbeteende

### Typisk användarsession (Lärare)

1. **Dagligt**: Logga in → Kolla veckans schema → Se dagens lektioner
2. **Efter lektion**: Markera genomförd → Skriv anteckningar → Sätt läxa
3. **Vid schemaändring**: Boka om med nytt datum eller ställ in
4. **Periodvis**: Kolla elevkartan för nya elever → Registrera intresse
5. **Terminsstart**: Skapa första lektion för nya elever

### Vanliga interaktionsmönster

- **Snabb statusuppdatering**: Läraren vill kunna markera lektion som genomförd med minimal friktion
- **Veckonavigering**: Bläddra mellan veckor för att planera framåt
- **Mobilanvändning**: Många lärare jobbar på plats hos elever och behöver mobil åtkomst
- **Anteckningar**: Korta, koncisa anteckningar om vad som gjordes och läxa

---

## 4. Utmaningar och smärtpunkter

### Tekniska utmaningar

| Utmaning | Beskrivning |
|----------|-------------|
| **Kartprestanda** | Elevkartan med många markörer kan vara tung på mobil |
| **Formulärhantering** | Många formulär (rapportering, ombokning) kräver bra UX på liten skärm |
| **Pushnotifikationer** | Behov av påminnelser om lektioner och admin-meddelanden |

### Användarutmaningar

| Utmaning | Nuvarande lösning | Förbättringsmöjlighet |
|----------|-------------------|----------------------|
| **Glömmer rapportera** | Manuell påminnelse | Push-notis efter lektionstid |
| **Hitta rätt elev** | Scrollbar lista | Sökfunktion, favoriter |
| **Navigera i schemat** | Veckonavigering | Kalendervy, snabbhopp till datum |
| **Se elevinfo under lektion** | Gå till elevprofil | Snabb elevinfo i lektionsvyn |

### UX-förbättringar för appen

1. **Snabbåtgärder**: Swipe för att markera genomförd, boka om, ställa in
2. **Dagens fokus**: Startskärm med dagens lektioner prominent
3. **Senaste elever**: Snabbåtkomst till nyligen undervisade elever
4. **Offline-first**: Spara rapporter lokalt och synka när uppkoppling finns
5. **Biometrisk inloggning**: Face ID/fingeravtryck för snabb åtkomst

---

## 5. Prioriterade funktioner för MVP

### Must-have (v1.0)

- [ ] Inloggning/autentisering
- [ ] Veckoschema med lektioner
- [ ] Markera lektion som genomförd (med anteckningar/läxa)
- [ ] Boka om och ställ in lektion
- [ ] Se elevprofil och vårdnadshavare
- [ ] Push-notifikationer för lektionspåminnelser

### Nice-to-have (v1.1+)

- [ ] Elevkarta med ny-elev-sökfunktion
- [ ] Skapa första lektion och schema
- [ ] Redigera lärarprofil
- [ ] Filuppladdning
- [ ] Offline-läge

---

## 6. Teknisk grund

### Befintlig infrastruktur

- **Backend**: Next.js API Routes (kan återanvändas)
- **Databas**: Airtable
- **Autentisering**: NextAuth med JWT
- **Webhooks**: Make för automatisering

### Rekommendationer för React Native

| Område | Rekommendation |
|--------|----------------|
| **Navigation** | React Navigation med tab-bar (Schema, Elever, Profil) |
| **State** | Zustand eller Redux Toolkit för global state |
| **API** | React Query/TanStack Query för data-fetching och caching |
| **Kartor** | react-native-maps (native performance) |
| **Formulär** | React Hook Form med Zod-validering |
| **Notifikationer** | Expo Notifications eller Firebase Cloud Messaging |

---

## Sammanfattning

Lärarsida är en fokuserad plattform för musikinstrumentlärare som behöver:
1. **Hantera sitt schema** - se och navigera lektioner
2. **Rapportera lektioner** - anteckningar och läxa till vårdnadshavare
3. **Hitta nya elever** - via geografisk karta
4. **Kommunicera** - automatiserade rapporter till föräldrar

En React Native-app bör fokusera på **snabb rapportering** och **schemaöversikt** som kärnfunktioner, med sömlös integration mot befintligt API.
