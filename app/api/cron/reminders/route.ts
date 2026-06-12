import { getEventInfo, sendReminders } from "@/app/actions/event"

// Vercel Cron hits this endpoint on a schedule. It only sends reminders
// when today matches the event date, so it's safe to run daily.
export async function GET(request: Request) {
  // Protect the endpoint: Vercel Cron sends the CRON_SECRET as a Bearer token.
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = request.headers.get("authorization")
    if (auth !== `Bearer ${secret}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  const event = await getEventInfo()
  if (!event.date) {
    return Response.json({ ran: false, reason: "No event date set." })
  }

  // Compare in US Eastern time (Columbia, SC) so "today" lines up with the local day.
  const todayET = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" })
  if (event.date !== todayET) {
    return Response.json({ ran: false, reason: `Not event day (event ${event.date}, today ${todayET}).` })
  }

  const result = await sendReminders({ onlyUnsent: true })
  return Response.json({ ran: true, ...result })
}
