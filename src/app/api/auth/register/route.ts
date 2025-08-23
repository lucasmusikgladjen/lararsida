import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const { email, password, resetCode } = await request.json()

    // Validering
    if (!email || !password || !resetCode) {
      return NextResponse.json(
        { error: 'E-post, lösenord och återställningskod krävs' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Lösenordet måste vara minst 6 tecken' },
        { status: 400 }
      )
    }

    // Kontrollera om läraren finns och har rätt återställningskod
    const searchResponse = await fetch(
      `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/Lärare?filterByFormula=AND({E-post}="${email}", {Återställningskod}="${resetCode}")`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.AIRTABLE_API_KEY}`,
        },
      }
    )

    const searchData = await searchResponse.json()

    if (!searchData.records || searchData.records.length === 0) {
      return NextResponse.json(
        { error: 'Felaktig e-post eller återställningskod. Kontakta administratören.' },
        { status: 404 }
      )
    }

    const teacher = searchData.records[0]

    // Kontrollera att återställningskoden inte är tom
    if (!teacher.fields.Återställningskod) {
      return NextResponse.json(
        { error: 'Ingen aktiv återställningskod. Kontakta administratören för en ny kod.' },
        { status: 403 }
      )
    }

    // Hasha det nya lösenordet
    const hashedPassword = await bcrypt.hash(password, 12)

    // Uppdatera lösenordet och rensa återställningskoden
    const updateResponse = await fetch(
      `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/Lärare/${teacher.id}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${process.env.AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: {
            'Lösenord': hashedPassword,
            'Återställningskod': '', // Rensa koden så den inte kan användas igen
          },
        }),
      }
    )

    if (!updateResponse.ok) {
      throw new Error('Kunde inte uppdatera lösenordet')
    }

    return NextResponse.json(
      { message: 'Lösenordet har uppdaterats framgångsrikt' },
      { status: 200 }
    )

  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json(
      { error: 'Något gick fel. Försök igen senare.' },
      { status: 500 }
    )
  }
}