import { AppShell } from "@/components/app-shell"
import { getEventInfo, getGuests } from "@/app/actions/event"

export const dynamic = "force-dynamic"

export default async function Page() {
  const [guests, eventInfo] = await Promise.all([getGuests(), getEventInfo()])

  return <AppShell guests={guests} eventInfo={eventInfo} />
}
