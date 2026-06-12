import { getEvents, sendReminders } from "@/app/actions/event"

// Vercel Cron hits this endpoint on a schedule. It only sends reminders
// for events whose date is today, so it's safe to run daily.
export async function GET(request: Request) {
  // Protect the endpoint: Vercel Cron sends the CRON_SECRET as a Bearer token.
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = request.headers.get("authorization")
    if (auth !== `Bearer ${secret}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  // Compare in US Eastern time (Columbia, SC) so "today" lines up with the local day.
  const todayET = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" })

  const events = await getEvents()
  const todays = events.filter((e) => e.date === todayET && e.restaurant)

  if (todays.length === 0) {
    return Response.json({ ran: false, reason: `No events scheduled for today (${todayET}).` })
  }

  let sent = 0
  let failed = 0
  let skipped = 0
  const errors: string[] = []
  for (const event of todays) {
    const result = await sendReminders({ eventId: event.id, onlyUnsent: true })
    sent += result.sent
    failed += result.failed
    skipped += result.skipped
    for (const err of result.errors) if (!errors.includes(err)) errors.push(err)
  }

  return Response.json({ ran: true, events: todays.length, sent, failed, skipped, errors })
}
