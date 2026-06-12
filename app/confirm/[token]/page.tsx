import { getGuestByToken, getEventForGuestToken } from "@/app/actions/event"
import { ConfirmView } from "@/components/confirm-view"
import { notFound } from "next/navigation"

export const dynamic = "force-dynamic"

export default async function ConfirmPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const [guest, eventInfo] = await Promise.all([getGuestByToken(token), getEventForGuestToken(token)])

  if (!guest) {
    notFound()
  }

  return <ConfirmView guest={guest} eventInfo={eventInfo} token={token} />
}
