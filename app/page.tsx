import { AppShell } from "@/components/app-shell"
import {
  getEvents,
  getOpenEvents,
  getEventCounts,
  getGuests,
  getConfirmedGuests,
  getCancelledGuests,
  getPoolContacts,
} from "@/app/actions/event"

export const dynamic = "force-dynamic"

export default async function Page() {
  const [events, openEvents, counts, poolContacts] = await Promise.all([
    getEvents(),
    getOpenEvents(),
    getEventCounts(),
    getPoolContacts(),
  ])

  // Preload guest lists for every event so the admin can switch instantly.
  const guestData = await Promise.all(
    events.map(async (e) => {
      const [guests, confirmedGuests, cancelledGuests] = await Promise.all([
        getGuests(e.id),
        getConfirmedGuests(e.id),
        getCancelledGuests(e.id),
      ])
      return [e.id, { guests, confirmedGuests, cancelledGuests }] as const
    }),
  )
  const guestsByEvent = Object.fromEntries(guestData)

  return (
    <AppShell
      events={events}
      openEvents={openEvents}
      counts={counts}
      guestsByEvent={guestsByEvent}
      poolContacts={poolContacts}
    />
  )
}
