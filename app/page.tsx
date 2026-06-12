import { AppShell } from "@/components/app-shell"
import { getEventInfo, getGuests, getConfirmedGuests } from "@/app/actions/event"

export const dynamic = "force-dynamic"

export default async function Page() {
  const [guests, confirmedGuests, eventInfo] = await Promise.all([
    getGuests(),
    getConfirmedGuests(),
    getEventInfo(),
  ])

  return <AppShell guests={guests} confirmedGuests={confirmedGuests} eventInfo={eventInfo} />
}
