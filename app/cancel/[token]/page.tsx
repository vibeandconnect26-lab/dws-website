import { getGuestByToken, getEventInfo } from "@/app/actions/event"
import { CancelView } from "@/components/cancel-view"
import { notFound } from "next/navigation"

export const dynamic = "force-dynamic"

export default async function CancelPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const [guest, eventInfo] = await Promise.all([getGuestByToken(token), getEventInfo()])

  if (!guest) {
    notFound()
  }

  return <CancelView guest={guest} eventInfo={eventInfo} token={token} />
}
