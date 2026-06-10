"use client"

import { useState } from "react"
import { type EventInfo, type Guest, type TableGroup, emptyEventInfo } from "@/lib/questions"
import { deleteGuest, saveEventInfo } from "@/app/actions/event"
import { Loader2, Pencil, Trash2 } from "lucide-react"

function formatDate(date: string, withYear = false) {
  if (!date) return "—"
  const parsed = new Date(date + "T12:00:00")
  if (isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
  })
}

function formatTime(time: string) {
  if (!time) return "—"
  const parsed = new Date("1970-01-01T" + time)
  if (isNaN(parsed.getTime())) return time
  return parsed.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })
}

type ParsedTable = TableGroup & { guestObjects: Guest[] }

export function AdminDashboard({
  guests: initialGuests,
  eventInfo: initialEvent,
}: {
  guests: Guest[]
  eventInfo: EventInfo
}) {
  const [guests, setGuests] = useState(initialGuests)
  const [eventInfo, setEventInfo] = useState(initialEvent)
  const [editingEvent, setEditingEvent] = useState(false)
  const [draftEvent, setDraftEvent] = useState<EventInfo>(initialEvent)

  const [loading, setLoading] = useState(false)
  const [parsedTables, setParsedTables] = useState<ParsedTable[] | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const [source, setSource] = useState<"ai" | "heuristic" | null>(null)

  const tablesNeeded = Math.ceil(guests.length / 7)
  const introverts = guests.filter((g) => g.energy?.startsWith("Introvert")).length

  const handleDelete = async (id: number) => {
    setGuests((prev) => prev.filter((g) => g.id !== id))
    await deleteGuest(id)
  }

  const handleSaveEvent = async () => {
    setEventInfo(draftEvent)
    setEditingEvent(false)
    await saveEventInfo(draftEvent)
  }

  const generateGroupings = async () => {
    if (guests.length < 2) return
    setLoading(true)
    setParsedTables(null)
    setAiError(null)
    setSource(null)
    try {
      const res = await fetch("/api/groupings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guests }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const tables: TableGroup[] = data.tables
      setSource(data.source === "ai" ? "ai" : "heuristic")
      setParsedTables(
        tables.map((t) => ({
          ...t,
          guestObjects: t.guests.map((idx) => guests[idx - 1]).filter(Boolean),
        })),
      )
    } catch {
      setAiError("Could not generate groupings. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const hasEvent = Boolean(eventInfo.restaurant)

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h2 className="mb-5 font-serif text-3xl text-foreground">Event Dashboard</h2>

      {/* Event details */}
      <div className="mb-7 rounded-2xl border border-border bg-card px-7 py-6">
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-xl font-semibold text-foreground">Event Details</h3>
          {!editingEvent && (
            <button
              onClick={() => {
                setDraftEvent(eventInfo)
                setEditingEvent(true)
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border-[1.5px] border-input bg-card px-4 py-1.5 text-[13px] font-medium transition-colors hover:border-[var(--gold)]"
            >
              <Pencil className="size-3.5" aria-hidden="true" />
              {hasEvent ? "Edit" : "Add Event Details"}
            </button>
          )}
        </div>

        {editingEvent ? (
          <div className="mt-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Restaurant / Venue" placeholder="e.g. The Oak Table" value={draftEvent.restaurant} onChange={(v) => setDraftEvent((d) => ({ ...d, restaurant: v }))} />
              <Field label="Address" placeholder="Full address" value={draftEvent.address} onChange={(v) => setDraftEvent((d) => ({ ...d, address: v }))} />
              <Field label="Date" type="date" value={draftEvent.date} onChange={(v) => setDraftEvent((d) => ({ ...d, date: v }))} />
              <Field label="Time" type="time" value={draftEvent.time} onChange={(v) => setDraftEvent((d) => ({ ...d, time: v }))} />
              <Field label="Max Guests" type="number" placeholder="e.g. 42" value={draftEvent.maxGuests} onChange={(v) => setDraftEvent((d) => ({ ...d, maxGuests: v }))} />
              <Field label="Dress Code (optional)" placeholder="e.g. Smart casual" value={draftEvent.dressCode} onChange={(v) => setDraftEvent((d) => ({ ...d, dressCode: v }))} />
            </div>
            <div className="mt-4">
              <Field label="Additional Notes (optional)" placeholder="Parking info, what to bring, etc." value={draftEvent.notes} onChange={(v) => setDraftEvent((d) => ({ ...d, notes: v }))} />
            </div>
            <div className="mt-4 flex gap-2.5">
              <button
                onClick={handleSaveEvent}
                className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Save Details
              </button>
              <button
                onClick={() => setEditingEvent(false)}
                className="rounded-xl border-[1.5px] border-input bg-card px-5 py-2.5 text-sm font-medium transition-colors hover:border-[var(--gold)]"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : hasEvent ? (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Fact label="Venue" value={eventInfo.restaurant} sub={eventInfo.address} />
            <Fact label="Date" value={formatDate(eventInfo.date, true)} />
            <Fact label="Time" value={formatTime(eventInfo.time)} />
            <Fact
              label="Capacity"
              value={`${guests.length}${eventInfo.maxGuests ? ` / ${eventInfo.maxGuests} max` : ""} guests`}
            />
            {eventInfo.dressCode && <Fact label="Dress Code" value={eventInfo.dressCode} />}
            {eventInfo.notes && (
              <div className="sm:col-span-2 lg:col-span-3">
                <div className="mb-1 text-[11px] uppercase tracking-[0.1em] text-muted-foreground">Notes</div>
                <div className="text-[13px] text-foreground">{eventInfo.notes}</div>
              </div>
            )}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            No event details added yet. Click &quot;Add Event Details&quot; to get started.
          </p>
        )}
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat num={guests.length} label="Registered Guests" />
        <Stat num={tablesNeeded || "—"} label="Tables Needed" />
        <Stat num={introverts} label="Introverts" />
      </div>

      {guests.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          No guests yet. Share the questionnaire to start collecting RSVPs.
        </div>
      ) : (
        <>
          <h3 className="mb-5 font-serif text-xl text-foreground">Guest List</h3>
          <div className="flex flex-col gap-3">
            {guests.map((g) => (
              <div
                key={g.id}
                className="flex items-start justify-between gap-4 rounded-xl border border-border bg-card px-6 py-5"
              >
                <div className="flex-1">
                  <div className="text-base font-semibold text-foreground">{g.name}</div>
                  <div className="mb-2 text-[13px] text-muted-foreground">
                    {[g.age_range, g.neighborhood, g.energy?.split("—")[0].trim()].filter(Boolean).join(" · ")}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(g.talk_about || []).map((t) => (
                      <Tag key={t}>{t}</Tag>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(g.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border-[1.5px] border-destructive/70 px-3 py-1.5 text-[13px] text-destructive transition-colors hover:bg-destructive/10"
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                  Remove
                </button>
              </div>
            ))}
          </div>

          {/* AI groupings */}
          <div className="mt-8 rounded-2xl border border-border bg-card p-7">
            <div className="mb-3 flex items-center justify-between gap-4">
              <h3 className="font-serif text-xl text-foreground">AI Table Groupings</h3>
              <button
                onClick={generateGroupings}
                disabled={loading || guests.length < 2}
                className="rounded-lg border-[1.5px] border-input bg-card px-4 py-1.5 text-[13px] font-medium transition-colors hover:border-[var(--gold)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Thinking..." : parsedTables ? "Re-generate" : "Generate groupings"}
              </button>
            </div>
            <p className="text-sm text-muted-foreground">
              Claude analyzes all guests and suggests balanced tables based on interests, energy, and neighborhood.
            </p>

            {loading && (
              <div className="flex items-center gap-2.5 py-4 text-sm text-muted-foreground">
                <Loader2 className="size-5 animate-spin text-[var(--gold)]" aria-hidden="true" />
                Curating your tables...
              </div>
            )}
            {aiError && <p className="mt-2 text-[13px] text-destructive">{aiError}</p>}

            {parsedTables && source && (
              <p className="mt-3 text-[13px] text-muted-foreground">
                {source === "ai"
                  ? "Curated by Claude based on guest interests, energy, and neighborhood."
                  : "Curated by the built-in balancing algorithm (AI Gateway unavailable)."}
              </p>
            )}

            {parsedTables?.map((table, i) => (
              <div key={i} className="mb-4 mt-4 rounded-xl border border-border bg-secondary px-6 py-5">
                <div className="font-serif text-lg text-[var(--gold-dark)]">{table.table}</div>
                <div className="mb-3 text-[13px] italic text-[var(--gold-dark)]">{table.theme}</div>
                {table.guestObjects.map((g) => (
                  <div key={g.id} className="flex items-center gap-2.5 border-b border-border py-2.5 last:border-b-0">
                    <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                      {g.name?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-foreground">{g.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {[g.age_range, g.neighborhood].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    <div className="ml-auto flex flex-wrap justify-end gap-1.5">
                      {(g.talk_about || []).slice(0, 2).map((t) => (
                        <Tag key={t}>{t}</Tag>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="mt-3 text-[13px] italic text-muted-foreground">{table.why}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <div>
      <label className="mb-2 block text-[13px] font-semibold text-foreground">{label}</label>
      <input
        type={type}
        min={type === "number" ? 1 : undefined}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border-[1.5px] border-input bg-card px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-[var(--gold)]"
      />
    </div>
  )
}

function Fact({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="mb-1 text-[11px] uppercase tracking-[0.1em] text-muted-foreground">{label}</div>
      <div className="font-semibold text-foreground">{value}</div>
      {sub && <div className="text-[13px] text-muted-foreground">{sub}</div>}
    </div>
  )
}

function Stat({ num, label }: { num: number | string; label: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-6 py-5">
      <div className="mb-1 font-serif text-4xl leading-none text-[var(--gold-dark)]">{num}</div>
      <div className="text-[13px] font-medium text-muted-foreground">{label}</div>
    </div>
  )
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-[var(--gold)]/12 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--gold-dark)]">
      {children}
    </span>
  )
}
