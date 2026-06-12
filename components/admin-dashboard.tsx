"use client"

import { useMemo, useState } from "react"
import { type EventInfo, type EventDraft, type Guest, type TableGroup } from "@/lib/questions"
import {
  createEvent,
  deleteEvent,
  deleteGuest,
  sendDinnerDetailsToTable,
  sendReminders,
  setEventOpen,
  updateEvent,
} from "@/app/actions/event"
import { EventEditor } from "@/components/event-editor"
import type { GuestsByEvent } from "@/components/app-shell"
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Loader2,
  Mail,
  MailCheck,
  MapPin,
  MessageSquare,
  Pencil,
  Plus,
  Send,
  Trash2,
} from "lucide-react"

function formatDate(date: string, withYear = false) {
  if (!date) return "Date TBA"
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
  return parsed.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
}

type Counts = Record<number, { pending: number; confirmed: number }>

export function AdminDashboard({
  events: initialEvents,
  counts: initialCounts,
  guestsByEvent,
}: {
  events: EventInfo[]
  counts: Counts
  guestsByEvent: GuestsByEvent
}) {
  const [events, setEvents] = useState(initialEvents)
  const [counts] = useState(initialCounts)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const [savingEvent, setSavingEvent] = useState(false)
  const [busyEventId, setBusyEventId] = useState<number | null>(null)

  const selectedEvent = useMemo(() => events.find((e) => e.id === selectedId) ?? null, [events, selectedId])

  const handleCreate = async (draft: EventDraft) => {
    setSavingEvent(true)
    const created = await createEvent(draft)
    setEvents((prev) => [created, ...prev])
    setSavingEvent(false)
    setCreating(false)
    setSelectedId(created.id)
  }

  const handleToggleOpen = async (event: EventInfo) => {
    setBusyEventId(event.id)
    const next = !event.isOpen
    setEvents((prev) => prev.map((e) => (e.id === event.id ? { ...e, isOpen: next } : e)))
    await setEventOpen(event.id, next)
    setBusyEventId(null)
  }

  const handleDeleteEvent = async (event: EventInfo) => {
    if (!confirm(`Delete "${event.restaurant || "this event"}" and all of its guests? This cannot be undone.`)) return
    setBusyEventId(event.id)
    setEvents((prev) => prev.filter((e) => e.id !== event.id))
    if (selectedId === event.id) setSelectedId(null)
    await deleteEvent(event.id)
    setBusyEventId(null)
  }

  // Detail view for a single event.
  if (selectedEvent) {
    return (
      <EventDetail
        event={selectedEvent}
        initialGuests={guestsByEvent[selectedEvent.id]?.guests ?? []}
        initialConfirmed={guestsByEvent[selectedEvent.id]?.confirmedGuests ?? []}
        onBack={() => setSelectedId(null)}
        onEdited={(updated) => setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))}
      />
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="font-serif text-3xl text-foreground">Your Dinners</h2>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Plus className="size-4" aria-hidden="true" />
            New Dinner
          </button>
        )}
      </div>

      {creating && (
        <div className="mb-7 rounded-2xl border border-border bg-card px-7 py-6">
          <h3 className="font-serif text-xl font-semibold text-foreground">Create a New Dinner</h3>
          <EventEditor saving={savingEvent} onSave={handleCreate} onCancel={() => setCreating(false)} />
        </div>
      )}

      {events.length === 0 && !creating ? (
        <div className="rounded-2xl border border-border bg-card px-6 py-12 text-center text-muted-foreground">
          No dinners yet. Click &quot;New Dinner&quot; to schedule your first one.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {events.map((event) => {
            const c = counts[event.id] ?? { pending: 0, confirmed: 0 }
            return (
              <div key={event.id} className="rounded-2xl border border-border bg-card px-6 py-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="font-serif text-xl text-foreground">
                        {event.restaurant || "Untitled Dinner"}
                      </h3>
                      <span
                        className={
                          event.isOpen
                            ? "rounded-full bg-[var(--gold)]/12 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--gold-dark)]"
                            : "rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                        }
                      >
                        {event.isOpen ? "Open" : "Closed"}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <CalendarDays className="size-3.5" aria-hidden="true" />
                        {formatDate(event.date, true)}
                      </span>
                      {event.time && <span>{formatTime(event.time)}</span>}
                      {event.address && (
                        <span className="flex items-center gap-1.5">
                          <MapPin className="size-3.5" aria-hidden="true" />
                          {event.address}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 text-[13px] text-foreground">
                      <span className="font-semibold">{c.pending}</span> pending ·{" "}
                      <span className="font-semibold">{c.confirmed}</span> confirmed
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedId(event.id)}
                    className="rounded-lg bg-primary px-4 py-1.5 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    Manage guests &amp; tables
                  </button>
                  <button
                    onClick={() => handleToggleOpen(event)}
                    disabled={busyEventId === event.id}
                    className="rounded-lg border-[1.5px] border-input bg-card px-4 py-1.5 text-[13px] font-medium transition-colors hover:border-[var(--gold)] disabled:opacity-50"
                  >
                    {event.isOpen ? "Close signups" : "Open signups"}
                  </button>
                  <button
                    onClick={() => handleDeleteEvent(event)}
                    disabled={busyEventId === event.id}
                    className="inline-flex items-center gap-1.5 rounded-lg border-[1.5px] border-destructive/70 px-3 py-1.5 text-[13px] text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                    Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

type ParsedTable = TableGroup & { guestObjects: Guest[] }

function EventDetail({
  event: initialEvent,
  initialGuests,
  initialConfirmed,
  onBack,
  onEdited,
}: {
  event: EventInfo
  initialGuests: Guest[]
  initialConfirmed: Guest[]
  onBack: () => void
  onEdited: (event: EventInfo) => void
}) {
  const [event, setEvent] = useState(initialEvent)
  const [editing, setEditing] = useState(false)
  const [savingEvent, setSavingEvent] = useState(false)
  const [guests, setGuests] = useState(initialGuests)
  const [confirmedGuests] = useState(initialConfirmed)

  const [loading, setLoading] = useState(false)
  const [parsedTables, setParsedTables] = useState<ParsedTable[] | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const [source, setSource] = useState<"ai" | "heuristic" | null>(null)
  const [unseatedCount, setUnseatedCount] = useState(0)

  const [sendingTable, setSendingTable] = useState<string | null>(null)
  const [tableResults, setTableResults] = useState<
    Record<string, { sent: number; failed: number; errors: string[] }>
  >({})

  const [sendingReminders, setSendingReminders] = useState(false)
  const [reminderResult, setReminderResult] = useState<
    { sent: number; failed: number; skipped: number; errors: string[] } | null
  >(null)

  const tableSize = Math.max(0, Number.parseInt(event.maxGuests || "0", 10) || 0)
  const tablesPossible = tableSize > 0 ? Math.floor(guests.length / tableSize) : 0

  const handleSaveEvent = async (draft: EventDraft) => {
    setSavingEvent(true)
    const updated: EventInfo = { ...draft, id: event.id }
    setEvent(updated)
    await updateEvent(updated)
    onEdited(updated)
    setSavingEvent(false)
    setEditing(false)
  }

  const handleDelete = async (id: number) => {
    setGuests((prev) => prev.filter((g) => g.id !== id))
    await deleteGuest(id)
  }

  const handleSendTable = async (table: ParsedTable) => {
    setSendingTable(table.table)
    const ids = table.guestObjects.map((g) => g.id)
    const result = await sendDinnerDetailsToTable(ids, table.table, event.id)
    setTableResults((prev) => ({ ...prev, [table.table]: result }))
    setSendingTable(null)
    if (result.sent > 0) {
      setGuests((prev) =>
        prev.map((g) => (ids.includes(g.id) ? { ...g, details_sent_at: new Date().toISOString() } : g)),
      )
    }
  }

  const handleSendReminders = async () => {
    setSendingReminders(true)
    setReminderResult(null)
    const result = await sendReminders({ eventId: event.id })
    setReminderResult(result)
    setSendingReminders(false)
  }

  const generateGroupings = async () => {
    if (guests.length < 2) return
    if (tableSize <= 0) {
      setAiError("Set a 'Table Size' value in the event details first — that number is your table size.")
      return
    }
    setLoading(true)
    setParsedTables(null)
    setAiError(null)
    setSource(null)
    setUnseatedCount(0)
    try {
      const res = await fetch("/api/groupings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guests, tableSize }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const tables: TableGroup[] = data.tables
      setSource(data.source === "ai" ? "ai" : "heuristic")
      const parsed = tables.map((t) => ({
        ...t,
        guestObjects: t.guests.map((idx) => guests[idx - 1]).filter(Boolean),
      }))
      setParsedTables(parsed)
      const seated = parsed.reduce((sum, t) => sum + t.guestObjects.length, 0)
      setUnseatedCount(Math.max(0, guests.length - seated))
    } catch (e) {
      setAiError(e instanceof Error && e.message ? e.message : "Could not generate groupings. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <button
        onClick={onBack}
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        All dinners
      </button>

      {/* Event details */}
      <div className="mb-7 rounded-2xl border border-border bg-card px-7 py-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <h3 className="font-serif text-xl font-semibold text-foreground">
              {event.restaurant || "Untitled Dinner"}
            </h3>
            <span
              className={
                event.isOpen
                  ? "rounded-full bg-[var(--gold)]/12 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--gold-dark)]"
                  : "rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
              }
            >
              {event.isOpen ? "Open" : "Closed"}
            </span>
          </div>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border-[1.5px] border-input bg-card px-4 py-1.5 text-[13px] font-medium transition-colors hover:border-[var(--gold)]"
            >
              <Pencil className="size-3.5" aria-hidden="true" />
              Edit
            </button>
          )}
        </div>

        {editing ? (
          <EventEditor initial={event} saving={savingEvent} onSave={handleSaveEvent} onCancel={() => setEditing(false)} />
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Fact label="Venue" value={event.restaurant || "—"} sub={event.address} />
            <Fact label="Date" value={formatDate(event.date, true)} />
            <Fact label="Time" value={formatTime(event.time)} />
            <Fact
              label="Capacity"
              value={`${guests.length}${event.maxGuests ? ` / ${event.maxGuests} per table` : ""} guests`}
            />
            {event.dressCode && <Fact label="Dress Code" value={event.dressCode} />}
            {event.notes && (
              <div className="sm:col-span-2 lg:col-span-3">
                <div className="mb-1 text-[11px] uppercase tracking-[0.1em] text-muted-foreground">Notes</div>
                <div className="text-[13px] text-foreground">{event.notes}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat num={guests.length} label="Pending Guests" />
        <Stat num={tableSize > 0 ? tablesPossible : "—"} label={`Full Tables of ${tableSize || "?"}`} />
        <Stat num={confirmedGuests.length} label="Confirmed" />
      </div>

      {guests.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          No pending guests for this dinner yet. Share the questionnaire to start collecting RSVPs.
        </div>
      ) : (
        <>
          <h3 className="mb-1.5 font-serif text-xl text-foreground">Pending Guests</h3>
          <p className="mb-5 text-sm text-muted-foreground">
            These guests haven&apos;t been seated yet. Generate table groupings below, then email each table their
            details. Once a guest confirms or cancels from that email, they drop off this list automatically.
          </p>
          <div className="flex flex-col gap-3">
            {guests.map((g) => (
              <div
                key={g.id}
                className="flex items-start justify-between gap-4 rounded-xl border border-border bg-card px-6 py-5"
              >
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-semibold text-foreground">{g.name}</span>
                    {g.details_sent_at && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-[var(--gold-dark)]">
                        <MailCheck className="size-3" aria-hidden="true" />
                        Details sent
                      </span>
                    )}
                  </div>
                  <div className="mb-1 flex items-center gap-1.5 text-[13px] text-muted-foreground">
                    <Mail className="size-3.5" aria-hidden="true" />
                    <a href={`mailto:${g.email}`} className="hover:text-foreground hover:underline">
                      {g.email}
                    </a>
                  </div>
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
              Claude builds tables of exactly {tableSize > 0 ? tableSize : "your table size"} guest
              {tableSize === 1 ? "" : "s"}, balanced by interests, energy, and neighborhood. Then email each table
              their dinner details.
            </p>

            {loading && (
              <div className="flex items-center gap-2.5 py-4 text-sm text-muted-foreground">
                <Loader2 className="size-5 animate-spin text-[var(--gold)]" aria-hidden="true" />
                Curating your tables...
              </div>
            )}
            {aiError && <p className="mt-2 text-[13px] text-destructive">{aiError}</p>}

            {parsedTables && (
              <div className="mt-5 flex flex-col gap-4">
                {source && (
                  <p className="text-[13px] text-muted-foreground">
                    {source === "ai" ? "Curated by Claude." : "Curated with a balanced fallback."}
                    {unseatedCount > 0 &&
                      ` ${unseatedCount} guest${unseatedCount === 1 ? "" : "s"} left unseated (not enough for a full table).`}
                  </p>
                )}
                {parsedTables.map((table) => {
                  const result = tableResults[table.table]
                  return (
                    <div key={table.table} className="rounded-xl border border-border bg-secondary/40 p-5">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h4 className="font-serif text-lg text-foreground">{table.table}</h4>
                          <p className="text-[13px] italic text-[var(--gold-dark)]">{table.theme}</p>
                        </div>
                        <button
                          onClick={() => handleSendTable(table)}
                          disabled={sendingTable === table.table}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                        >
                          {sendingTable === table.table ? (
                            <>
                              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                              Sending...
                            </>
                          ) : (
                            <>
                              <Send className="size-3.5" aria-hidden="true" />
                              Email this table
                            </>
                          )}
                        </button>
                      </div>
                      <p className="mb-3 text-[13px] text-muted-foreground">{table.why}</p>
                      <div className="flex flex-wrap gap-2">
                        {table.guestObjects.map((g) => (
                          <span
                            key={g.id}
                            className="rounded-full border border-border bg-card px-3 py-1 text-[13px] text-foreground"
                          >
                            {g.name}
                          </span>
                        ))}
                      </div>
                      {result && (
                        <p className="mt-3 rounded-lg border border-border bg-card px-3 py-2 text-[13px] text-foreground">
                          {result.sent} sent
                          {result.failed > 0 ? ` · ${result.failed} failed` : ""}
                          {result.errors.length > 0 ? ` — ${result.errors.join("; ")}` : ""}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Confirmed guests */}
      {confirmedGuests.length > 0 && (
        <div className="mt-8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-serif text-xl text-foreground">Confirmed for Dinner</h3>
            <button
              onClick={handleSendReminders}
              disabled={sendingReminders}
              className="inline-flex items-center gap-1.5 rounded-lg border-[1.5px] border-input bg-card px-4 py-1.5 text-[13px] font-medium transition-colors hover:border-[var(--gold)] disabled:opacity-50"
            >
              {sendingReminders ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  Texting...
                </>
              ) : (
                <>
                  <MessageSquare className="size-3.5" aria-hidden="true" />
                  Text day-of reminder
                </>
              )}
            </button>
          </div>
          {reminderResult && (
            <p className="mb-4 rounded-lg border border-border bg-secondary px-4 py-2.5 text-[13px] text-foreground">
              {reminderResult.sent} text{reminderResult.sent === 1 ? "" : "s"} sent
              {reminderResult.failed > 0 ? ` · ${reminderResult.failed} failed` : ""}
              {reminderResult.skipped > 0 ? ` · ${reminderResult.skipped} skipped` : ""}
              {reminderResult.errors.length > 0 ? ` — ${reminderResult.errors.join("; ")}` : ""}
            </p>
          )}
          <div className="flex flex-col gap-3">
            {confirmedGuests.map((g) => (
              <div
                key={g.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card px-6 py-4"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-semibold text-foreground">{g.name}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-[var(--gold-dark)]">
                      <CheckCircle2 className="size-3" aria-hidden="true" />
                      Confirmed
                    </span>
                    {g.table_label && (
                      <span className="rounded-full bg-[var(--gold)]/12 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--gold-dark)]">
                        {g.table_label}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Mail className="size-3.5" aria-hidden="true" />
                      <a href={`mailto:${g.email}`} className="hover:text-foreground hover:underline">
                        {g.email}
                      </a>
                    </span>
                    {g.phone && (
                      <span className="flex items-center gap-1.5">
                        <MessageSquare className="size-3.5" aria-hidden="true" />
                        <a href={`tel:${g.phone}`} className="hover:text-foreground hover:underline">
                          {g.phone}
                        </a>
                        {g.reminder_sent_at && <span className="text-[var(--gold-dark)]">· reminded</span>}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
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
