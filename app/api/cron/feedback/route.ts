import { getEvents, sendFeedbackRequests } from "@/app/actions/event"

// Vercel Cron hits this endpoint daily. It sends the post-event review request
// for events that happened *yesterday*, so guests get it the morning after.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = request.headers.get("authorization")
    if (auth !== `Bearer ${secret}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  // Yesterday in US Eastern time (Columbia, SC) so "yesterday" lines up with the local day.
  const now = new Date()
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const yesterdayET = yesterday.toLocaleDateString("en-CA", { timeZone: "America/New_York" })

  const events = await getEvents()
  const finished = events.filter((e) => e.date === yesterdayET && e.restaurant)

  if (finished.length === 0) {
    return Response.json({ ran: false, reason: `No events finished yesterday (${yesterdayET}).` })
  }

  let sent = 0
  let failed = 0
  let skipped = 0
  const errors: string[] = []
  for (const event of finished) {
    const result = await sendFeedbackRequests({ eventId: event.id, onlyUnsent: true })
    sent += result.sent
    failed += result.failed
    skipped += result.skipped
    for (const err of result.errors) if (!errors.includes(err)) errors.push(err)
  }

  return Response.json({ ran: true, events: finished.length, sent, failed, skipped, errors })
}
