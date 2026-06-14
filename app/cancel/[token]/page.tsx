import { cancelByToken, getGuestByToken, getEventForGuestToken } from "@/app/actions/event"
import { CancelView } from "@/components/cancel-view"
import { notFound } from "next/navigation"

export const dynamic = "force-dynamic"

export default async function CancelPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  // Process the cancellation server-side, during render. The "Cancel my spot"
  // link in the email lands here and the seat is released immediately, so the
  // final result page is delivered in the initial HTML. This avoids relying on
  // client-side JavaScript to run the action, which is unreliable inside the
  // in-app browsers used by mobile email clients (Gmail, Outlook, Apple Mail).
  const [guest, eventInfo, result] = await Promise.all([
    getGuestByToken(token),
    getEventForGuestToken(token),
    cancelByToken(token),
  ])

  if (!guest) {
    notFound()
  }

  const status = result.ok ? "cancelled" : "error"

  return <CancelView guest={guest} eventInfo={eventInfo} token={token} status={status} />
}
