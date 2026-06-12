"use client"

import { type EventInfo } from "@/lib/questions"
import { CalendarDays, Clock, MapPin } from "lucide-react"

function formatDate(date: string) {
  if (!date) return "Date TBA"
  const parsed = new Date(date + "T12:00:00")
  if (isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
}

function formatTime(time: string) {
  if (!time) return ""
  const parsed = new Date("1970-01-01T" + time)
  if (isNaN(parsed.getTime())) return time
  return parsed.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
}

export function EventPicker({
  events,
  onSelect,
}: {
  events: EventInfo[]
  onSelect: (event: EventInfo) => void
}) {
  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-10 text-center">
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-[var(--gold-dark)]">
          Columbia, SC · Dinner with Strangers
        </p>
        <h1 className="mb-4 font-serif text-4xl leading-tight text-foreground text-balance sm:text-5xl">
          Choose your
          <br />
          <em className="text-[var(--gold-dark)]">dinner.</em>
        </h1>
        <p className="mx-auto max-w-md leading-relaxed text-muted-foreground text-pretty">
          Pick the evening that works best for you. Each dinner is a different restaurant and a different table of
          strangers waiting to become friends.
        </p>
      </div>

      {events.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card px-6 py-12 text-center">
          <CalendarDays className="mx-auto mb-4 size-10 text-[var(--gold-dark)]" aria-hidden="true" />
          <h2 className="mb-2 font-serif text-2xl text-foreground">No dinners open right now</h2>
          <p className="leading-relaxed text-muted-foreground">
            We&apos;re planning the next round of dinners. Check back soon to grab your seat.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {events.map((event) => (
            <button
              key={event.id}
              type="button"
              onClick={() => onSelect(event)}
              className="group flex flex-col gap-3 rounded-2xl border-[1.5px] border-border bg-card px-6 py-5 text-left transition-all hover:-translate-y-0.5 hover:border-[var(--gold)] hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <h3 className="font-serif text-2xl text-foreground">{event.restaurant || "Dinner with Strangers"}</h3>
                <span className="mt-1 shrink-0 rounded-full bg-[var(--gold)]/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--gold-dark)]">
                  Open
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="size-4" aria-hidden="true" />
                  {formatDate(event.date)}
                </span>
                {event.time && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="size-4" aria-hidden="true" />
                    {formatTime(event.time)}
                  </span>
                )}
                {event.address && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="size-4" aria-hidden="true" />
                    {event.address}
                  </span>
                )}
              </div>
              <span className="text-sm font-semibold text-[var(--gold-dark)] transition-transform group-hover:translate-x-0.5">
                Choose this dinner →
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
