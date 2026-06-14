import { confirmByToken, getGuestByToken, getEventForGuestToken } from "@/app/actions/event"
import { ConfirmView } from "@/components/confirm-view"
import { notFound } from "next/navigation"

export const dynamic = "force-dynamic"

export default async function ConfirmPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  // Process the confirmation server-side, during render. The "Confirm my spot"
  // link in the email lands here and the seat is locked in immediately, so the
  // final result page is delivered in the initial HTML. This avoids relying on
  // client-side JavaScript to run the action, which is unreliable inside the
  // in-app browsers used by mobile email clients (Gmail, Outlook, Apple Mail).
  const [guest, eventInfo, result] = await Promise.all([
    getGuestByToken(token),
    getEventForGuestToken(token),
    confirmByToken(token),
  ])

  if (!guest) {
    notFound()
  }

  const status = result.cancelled ? "already-cancelled" : result.ok ? "confirmed" : "error"

  return <ConfirmView guest={guest} eventInfo={eventInfo} token={token} status={status} />
}
