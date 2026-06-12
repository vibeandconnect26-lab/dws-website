"use client"

import { useMemo } from "react"
import { type EventInfo } from "@/lib/questions"
import type { GuestsByEvent } from "@/components/app-shell"
import { Star, MessageSquareQuote } from "lucide-react"

function formatDate(date: string, long = false) {
  if (!date) return "TBA"
  const parsed = new Date(date + "T00:00:00")
  if (isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString("en-US", {
    weekday: long ? "long" : undefined,
    month: long ? "long" : "short",
    day: "numeric",
    year: "numeric",
  })
}

function StarRow({ value, size = "size-4" }: { value: number; size?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`${size} ${
            n <= Math.round(value) ? "fill-[var(--gold)] text-[var(--gold)]" : "text-muted-foreground/30"
          }`}
          aria-hidden="true"
        />
      ))}
    </span>
  )
}

type Review = {
  guestId: number
  name: string
  rating: number
  comment: string | null
  submittedAt: string | null
  eventId: number
  eventLabel: string
  eventDate: string
}

export function ReviewsTab({
  events,
  guestsByEvent,
}: {
  events: EventInfo[]
  guestsByEvent: GuestsByEvent
}) {
  // Flatten every submitted rating across all events into a single list.
  const reviews = useMemo<Review[]>(() => {
    const out: Review[] = []
    for (const event of events) {
      const confirmed = guestsByEvent[event.id]?.confirmedGuests ?? []
      for (const g of confirmed) {
        if (g.feedback_rating == null) continue
        out.push({
          guestId: g.id,
          name: g.name,
          rating: g.feedback_rating,
          comment: g.feedback_comment,
          submittedAt: g.feedback_submitted_at,
          eventId: event.id,
          eventLabel: event.restaurant || "Untitled Dinner",
          eventDate: event.date,
        })
      }
    }
    return out.sort((a, b) => {
      const ta = a.submittedAt ? new Date(a.submittedAt).getTime() : 0
      const tb = b.submittedAt ? new Date(b.submittedAt).getTime() : 0
      return tb - ta
    })
  }, [events, guestsByEvent])

  const overallAvg = reviews.length
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0

  // Rating distribution (5 → 1) for the summary bars.
  const distribution = useMemo(() => {
    const counts = [0, 0, 0, 0, 0] // index 0 = 1 star ... index 4 = 5 stars
    for (const r of reviews) counts[r.rating - 1]++
    return counts
  }, [reviews])

  // Per-event averages.
  const perEvent = useMemo(() => {
    return events
      .map((event) => {
        const evReviews = reviews.filter((r) => r.eventId === event.id)
        const avg = evReviews.length
          ? evReviews.reduce((sum, r) => sum + r.rating, 0) / evReviews.length
          : 0
        return {
          id: event.id,
          label: event.restaurant || "Untitled Dinner",
          date: event.date,
          count: evReviews.length,
          avg,
        }
      })
      .filter((e) => e.count > 0)
      .sort((a, b) => b.avg - a.avg)
  }, [events, reviews])

  if (reviews.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card px-6 py-12 text-center">
        <MessageSquareQuote className="mx-auto mb-3 size-8 text-muted-foreground/50" aria-hidden="true" />
        <p className="text-muted-foreground">
          No reviews yet. Once guests respond to the post-dinner review email, their ratings will appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Overall summary */}
      <div className="rounded-2xl border border-border bg-card px-7 py-6">
        <div className="flex flex-wrap items-center gap-8">
          <div className="text-center">
            <div className="font-serif text-5xl text-foreground">{overallAvg.toFixed(1)}</div>
            <div className="mt-1.5">
              <StarRow value={overallAvg} />
            </div>
            <div className="mt-1.5 text-[13px] text-muted-foreground">
              {reviews.length} review{reviews.length === 1 ? "" : "s"}
            </div>
          </div>
          <div className="min-w-[200px] flex-1">
            {[5, 4, 3, 2, 1].map((stars) => {
              const count = distribution[stars - 1]
              const pct = reviews.length ? (count / reviews.length) * 100 : 0
              return (
                <div key={stars} className="flex items-center gap-2 py-0.5">
                  <span className="w-3 text-[12px] text-muted-foreground">{stars}</span>
                  <Star className="size-3 fill-[var(--gold)] text-[var(--gold)]" aria-hidden="true" />
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-[var(--gold)]" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-6 text-right text-[12px] text-muted-foreground">{count}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Per-dinner averages */}
      {perEvent.length > 1 && (
        <div>
          <h3 className="mb-3 font-serif text-xl text-foreground">By dinner</h3>
          <div className="flex flex-col gap-2">
            {perEvent.map((e) => (
              <div
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-5 py-3"
              >
                <div>
                  <div className="font-medium text-foreground">{e.label}</div>
                  <div className="text-[12px] text-muted-foreground">{formatDate(e.date)}</div>
                </div>
                <div className="flex items-center gap-3">
                  <StarRow value={e.avg} size="size-3.5" />
                  <span className="text-[13px] font-semibold text-[var(--gold-dark)]">{e.avg.toFixed(1)}</span>
                  <span className="text-[12px] text-muted-foreground">
                    ({e.count} review{e.count === 1 ? "" : "s"})
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Individual reviews */}
      <div>
        <h3 className="mb-3 font-serif text-xl text-foreground">All reviews</h3>
        <div className="flex flex-col gap-3">
          {reviews.map((r) => (
            <div key={`${r.eventId}-${r.guestId}`} className="rounded-xl border border-border bg-card px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="font-medium text-foreground">{r.name}</span>
                  <StarRow value={r.rating} size="size-3.5" />
                </div>
                <span className="text-[12px] text-muted-foreground">
                  {r.eventLabel} · {formatDate(r.eventDate)}
                </span>
              </div>
              {r.comment && <p className="mt-2 text-[14px] italic leading-relaxed text-muted-foreground">{`"${r.comment}"`}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
