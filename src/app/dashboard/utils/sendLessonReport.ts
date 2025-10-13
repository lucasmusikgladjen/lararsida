/**
 * Helper for sending completed lesson reports to the backend webhook endpoint.
 *
 * We centralise the fetch call here so multiple dashboard views can reuse
 * the same implementation and logging behaviour.
 */
export interface LessonReportPayload {
  lessonId: string
  notes: string
  homework: string
}

/**
 * Sends the completed lesson report to the server which in turn forwards
 * the details to the Make scenario webhook.
 *
 * @returns `true` when the server accepted the report, otherwise `false`.
 */
export async function sendLessonReportToGuardian(payload: LessonReportPayload): Promise<boolean> {
  try {
    const response = await fetch('/api/lesson-reports', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Okänt fel från servern')
      console.error('Misslyckades att skicka lektionsrapport till webhook:', errorText)
      return false
    }

    return true
  } catch (error) {
    console.error('Tekniskt fel vid skick av lektionsrapport:', error)
    return false
  }
}
