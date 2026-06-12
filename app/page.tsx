import { AppShell } from "@/components/app-shell"
import {
  getEvents,
  getOpenEvents,
  getEventCounts,
  getGuests,
  getConfirmedGuests,
} from "@/app/actions/event"

export const dynamic = "force-dynamic"

export default async function Page() {
  const [events, openEvents, counts] = await Promise.all([getEvents(), getOpenEvents(), getEventCounts()])

  // Preload guest lists for every event so the admin can switch instantly.
  const guestData = await Promise.all(
    events.map(async (e) => {
      const [guests, confirmedGuests] = await Promise.all([getGuests(e.id), getConfirmedGuests(e.id)])
      return [e.id, { guests, confirmedGuests }] as const
    }),
  )
  const guestsByEvent = Object.fromEntries(guestData)

  return (
    <AppShell
      events={events}
      openEvents={openEvents}
      counts={counts}
      guestsByEvent={guestsByEvent}
    />
  )
}
