import { getGuestByToken, getEventForGuestToken } from "@/app/actions/event"
import { FeedbackView } from "@/components/feedback-view"
import { notFound } from "next/navigation"

export const dynamic = "force-dynamic"

export default async function FeedbackPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ rating?: string }>
}) {
  const { token } = await params
  const { rating } = await searchParams
  const [guest, eventInfo] = await Promise.all([getGuestByToken(token), getEventForGuestToken(token)])

  if (!guest) {
    notFound()
  }

  const initialRating = rating ? Math.min(5, Math.max(1, Number.parseInt(rating, 10) || 0)) : 0

  return <FeedbackView guest={guest} eventInfo={eventInfo} token={token} initialRating={initialRating} />
}
