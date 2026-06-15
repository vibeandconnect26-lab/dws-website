"use client"

import { useState } from "react"
import Image from "next/image"
import { type EventInfo, type Guest } from "@/lib/questions"
import { submitFeedback } from "@/app/actions/event"
import { CheckCircle2, Loader2, Star } from "lucide-react"

function formatDate(date: string) {
  if (!date) return ""
  const parsed = new Date(date + "T12:00:00")
  if (isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

const RATING_LABELS: Record<number, string> = {
  1: "Not great",
  2: "Could be better",
  3: "It was good",
  4: "Really enjoyed it",
  5: "Absolutely loved it",
}

export function FeedbackView({
  guest,
  eventInfo,
  token,
  initialRating,
}: {
  guest: Guest
  eventInfo: EventInfo
  token: string
  initialRating: number
}) {
  const alreadySubmitted = guest.feedback_submitted_at != null
  const [rating, setRating] = useState<number>(alreadySubmitted ? (guest.feedback_rating ?? 0) : initialRating)
  const [hover, setHover] = useState<number>(0)
  const [comment, setComment] = useState<string>(guest.feedback_comment ?? "")
  const [submitted, setSubmitted] = useState<boolean>(alreadySubmitted)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const firstName = guest.name?.split(" ")[0] || "friend"
  const when = formatDate(eventInfo.date)
  const active = hover || rating

  const handleSubmit = async () => {
    if (rating < 1) {
      setError("Please choose a star rating first.")
      return
    }
    setLoading(true)
    setError(null)
    const res = await submitFeedback(token, rating, comment)
    setLoading(false)
    if (res.ok) {
      setSubmitted(true)
    } else {
      setError(res.error ?? "Something went wrong. Please try again.")
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-center border-b border-border bg-secondary px-6 py-4">
        <Image
          src="/vibe-connect-logo.png"
          alt="Vibe & Connect"
          width={56}
          height={56}
          className="h-14 w-14 object-contain"
          priority
        />
      </header>

      <main className="mx-auto flex max-w-lg flex-col items-center px-6 py-16">
        {submitted ? (
          <div className="w-full rounded-2xl border border-border bg-card px-8 py-10 text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-secondary">
              <CheckCircle2 className="size-7 text-[var(--gold-dark)]" aria-hidden="true" />
            </div>
            <h1 className="mb-2 font-serif text-2xl text-foreground">Thank you, {firstName}!</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Your feedback means a lot to us. We use every review to make the next table even better — we hope to
              see you at another dinner soon.
            </p>
            <div className="mt-5 flex items-center justify-center gap-1" aria-hidden="true">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  className={`size-6 ${n <= rating ? "fill-[var(--gold)] text-[var(--gold)]" : "text-muted-foreground/40"}`}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="w-full rounded-2xl border border-border bg-card px-8 py-10 text-center">
            <h1 className="mb-2 font-serif text-2xl text-foreground">How was your dinner, {firstName}?</h1>
            <p className="mb-7 text-sm leading-relaxed text-muted-foreground">
              Thanks for joining us
              {eventInfo.restaurant ? ` at ${eventInfo.restaurant}` : ""}
              {when ? ` on ${when}` : ""}. Tap the stars to rate your experience — and add a note if you&apos;d
              like.
            </p>

            <div className="mb-2 flex items-center justify-center gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    setRating(n)
                    setError(null)
                  }}
                  onMouseEnter={() => setHover(n)}
                  onMouseLeave={() => setHover(0)}
                  className="rounded-md p-1 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]"
                  aria-label={`${n} star${n === 1 ? "" : "s"}`}
                  aria-pressed={rating === n}
                >
                  <Star
                    className={`size-10 transition-colors ${
                      n <= active ? "fill-[var(--gold)] text-[var(--gold)]" : "text-muted-foreground/40"
                    }`}
                    aria-hidden="true"
                  />
                </button>
              ))}
            </div>
            <p className="mb-6 h-5 text-[13px] font-medium text-[var(--gold-dark)]">
              {active ? RATING_LABELS[active] : "\u00A0"}
            </p>

            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              placeholder="What stood out? Anything we could do better? (optional)"
              className="mb-4 w-full resize-none rounded-xl border-[1.5px] border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-[var(--gold)] focus:outline-none"
            />

            {error && <p className="mb-4 text-[13px] text-destructive">{error}</p>}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-base font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {loading ? "Sending..." : "Submit review"}
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
