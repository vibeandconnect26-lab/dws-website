"use client"

import { useMemo, useState } from "react"
import { questions, type EventInfo, type EventDraft, type Guest, type TableGroup } from "@/lib/questions"
import {
  createEvent,
  deleteEvent,
  deleteGuest,
  removeGuestFromTable,
  sendDinnerDetailsToTable,
  sendFeedbackRequests,
  sendReminders,
  setEventOpen,
  updateEvent,
} from "@/app/actions/event"
import { EventEditor } from "@/components/event-editor"
import { ReviewsTab } from "@/components/reviews-tab"
import type { GuestsByEvent } from "@/components/app-shell"
import { cn } from "@/lib/utils"
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  GripVertical,
  Loader2,
  Lock,
  Mail,
  MailCheck,
  MapPin,
  MessageSquare,
  Pencil,
  Plus,
  Send,
  Star,
  Trash2,
  Unlock,
  X,
  XCircle,
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

type Counts = Record<number, { pending: number; confirmed: number; cancelled: number }>

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
  const [adminTab, setAdminTab] = useState<"dinners" | "reviews">("dinners")

  // Overall average rating across every event, for the Reviews tab badge.
  const reviewStats = useMemo(() => {
    let total = 0
    let count = 0
    for (const e of events) {
      for (const g of guestsByEvent[e.id]?.confirmedGuests ?? []) {
        if (g.feedback_rating != null) {
          total += g.feedback_rating
          count++
        }
      }
    }
    return { count, avg: count ? total / count : 0 }
  }, [events, guestsByEvent])

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
        initialCancelled={guestsByEvent[selectedEvent.id]?.cancelledGuests ?? []}
        onBack={() => setSelectedId(null)}
        onEdited={(updated) => setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))}
      />
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-6 flex w-fit gap-1 rounded-xl border border-border bg-card p-1">
        <button
          onClick={() => setAdminTab("dinners")}
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            adminTab === "dinners"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Dinners
        </button>
        <button
          onClick={() => setAdminTab("reviews")}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            adminTab === "reviews"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Star className="size-3.5" aria-hidden="true" />
          Reviews
          {reviewStats.count > 0 && (
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[11px] font-semibold",
                adminTab === "reviews" ? "bg-primary-foreground/20" : "bg-secondary text-[var(--gold-dark)]",
              )}
            >
              {reviewStats.avg.toFixed(1)}★
            </span>
          )}
        </button>
      </div>

      {adminTab === "reviews" ? (
        <>
          <h2 className="mb-6 font-serif text-3xl text-foreground">Reviews</h2>
          <ReviewsTab events={events} guestsByEvent={guestsByEvent} />
        </>
      ) : (
        <>
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
            const c = counts[event.id] ?? { pending: 0, confirmed: 0, cancelled: 0 }
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
                      {c.cancelled > 0 && (
                        <>
                          {" · "}
                          <span className="font-semibold text-destructive">{c.cancelled}</span> cancelled
                        </>
                      )}
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
        </>
      )}
    </div>
  )
}

type ParsedTable = TableGroup & { guestObjects: Guest[]; locked?: boolean }

function EventDetail({
  event: initialEvent,
  initialGuests,
  initialConfirmed,
  initialCancelled,
  onBack,
  onEdited,
}: {
  event: EventInfo
  initialGuests: Guest[]
  initialConfirmed: Guest[]
  initialCancelled: Guest[]
  onBack: () => void
  onEdited: (event: EventInfo) => void
}) {
  const [event, setEvent] = useState(initialEvent)
  const [editing, setEditing] = useState(false)
  const [savingEvent, setSavingEvent] = useState(false)
  const [guests, setGuests] = useState(initialGuests)
  const [confirmedGuests, setConfirmedGuests] = useState(initialConfirmed)
  const [cancelledGuests, setCancelledGuests] = useState(initialCancelled)

  // Source-of-truth status lookup for any guest id, used to badge the
  // grouping chips. The lists are authoritative; chip snapshots may be stale.
  const guestStatus = (id: number): "confirmed" | "cancelled" | "pending" => {
    if (confirmedGuests.some((g) => g.id === id)) return "confirmed"
    if (cancelledGuests.some((g) => g.id === id)) return "cancelled"
    return "pending"
  }

  const [loading, setLoading] = useState(false)
  const [parsedTables, setParsedTables] = useState<ParsedTable[] | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const [source, setSource] = useState<"ai" | "heuristic" | null>(null)
  const [unseatedCount, setUnseatedCount] = useState(0)

  const [sendingTable, setSendingTable] = useState<string | null>(null)
  const [tableResults, setTableResults] = useState<
    Record<string, { sent: number; failed: number; errors: string[] }>
  >({})

  // Manual grouping: which guest is being dragged, and the table they came from.
  const [dragging, setDragging] = useState<{ guestId: number; fromTable: string } | null>(null)
  const [dragOverTable, setDragOverTable] = useState<string | null>(null)

  // Which pending guest cards are expanded to show their full answers.
  const [expandedGuests, setExpandedGuests] = useState<Record<number, boolean>>({})
  const toggleGuestExpanded = (id: number) =>
    setExpandedGuests((prev) => ({ ...prev, [id]: !prev[id] }))

  // Manual fill-in: for a given open seat (keyed by the cancelled guest id),
  // which pending guest the host picked, plus in-flight / result state.
  const [fillSelection, setFillSelection] = useState<Record<number, number | "">>({})
  const [fillingSeat, setFillingSeat] = useState<number | null>(null)
  const [filledSeats, setFilledSeats] = useState<Record<number, string>>({})

  const handleFillSeat = async (cancelledGuest: Guest) => {
    const pendingId = fillSelection[cancelledGuest.id]
    if (!pendingId) return
    const replacement = unseatedGuests.find((g) => g.id === pendingId)
    if (!replacement) return
    const tableLabel = cancelledGuest.table_label || "Table 1"
    setFillingSeat(cancelledGuest.id)
    const result = await sendDinnerDetailsToTable([replacement.id], tableLabel, event.id)
    setFillingSeat(null)
    if (result.sent > 0) {
      // The replacement now holds the seat: stamp them as emailed + seated so
      // they leave the pending list and appear in their new table.
      setGuests((prev) =>
        prev.map((g) =>
          g.id === replacement.id
            ? { ...g, details_sent_at: new Date().toISOString(), table_label: tableLabel }
            : g,
        ),
      )
      setFilledSeats((prev) => ({
        ...prev,
        [cancelledGuest.id]: `${replacement.name} was added to ${tableLabel} and emailed their details.`,
      }))
    } else {
      setFilledSeats((prev) => ({
        ...prev,
        [cancelledGuest.id]: result.errors[0] || "Could not email the replacement. Try again.",
      }))
    }
  }

  const [sendingReminders, setSendingReminders] = useState(false)
  const [reminderResult, setReminderResult] = useState<
    { sent: number; failed: number; skipped: number; errors: string[] } | null
  >(null)

  const tableSize = Math.max(0, Number.parseInt(event.maxGuests || "0", 10) || 0)
  const tablesPossible = tableSize > 0 ? Math.floor(guests.length / tableSize) : 0

  // Pending guests who haven't been emailed a table yet. Once a table is sent,
  // its guests stay in the database but drop off the active pending list.
  const unseatedGuests = useMemo(() => guests.filter((g) => !g.details_sent_at), [guests])

  // Reconstruct emailed tables from each guest's persisted table_label across
  // every list, so the generated tables stay on the page (with live confirm
  // status) even after a reload.
  const sentTables = useMemo(() => {
    const map = new Map<string, Guest[]>()
    for (const g of [...guests, ...confirmedGuests, ...cancelledGuests]) {
      if (!g.table_label) continue
      if (!map.has(g.table_label)) map.set(g.table_label, [])
      map.get(g.table_label)!.push(g)
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
      .map(([label, gs]) => ({ label, guests: gs }))
  }, [guests, confirmedGuests, cancelledGuests])

  const [removingGuestId, setRemovingGuestId] = useState<number | null>(null)
  const [removeNotice, setRemoveNotice] = useState<Record<string, string>>({})

  // Pull a guest off a sent table, return them to the pending pool, and email
  // them a "system error / please disregard" notice. Reflects the change in all
  // local lists so the UI updates without a reload.
  const handleRemoveFromTable = async (guest: Guest) => {
    const label = guest.table_label || ""
    setRemovingGuestId(guest.id)
    const result = await removeGuestFromTable(guest.id, event.id)
    setRemovingGuestId(null)
    if (!result.ok) {
      if (label) setRemoveNotice((prev) => ({ ...prev, [label]: result.error || "Could not remove guest." }))
      return
    }
    // Remove from confirmed/cancelled, and reset the pending copy back to the pool.
    setConfirmedGuests((prev) => prev.filter((g) => g.id !== guest.id))
    setCancelledGuests((prev) => prev.filter((g) => g.id !== guest.id))
    setGuests((prev) =>
      prev.some((g) => g.id === guest.id)
        ? prev.map((g) =>
            g.id === guest.id
              ? {
                  ...g,
                  table_label: null,
                  details_sent_at: null,
                  reminder_sent_at: null,
                  confirmed: false,
                  confirmed_at: null,
                  cancelled: false,
                  cancelled_at: null,
                }
              : g,
          )
        : [
            ...prev,
            {
              ...guest,
              table_label: null,
              details_sent_at: null,
              reminder_sent_at: null,
              confirmed: false,
              confirmed_at: null,
              cancelled: false,
              cancelled_at: null,
            },
          ],
    )
    if (label) {
      setRemoveNotice((prev) => ({
        ...prev,
        [label]: result.emailed
          ? `${guest.name} was returned to the pool and emailed a correction notice.`
          : `${guest.name} was returned to the pool. (Email notice could not be sent.)`,
      }))
    }
  }

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

  const [sendingFeedback, setSendingFeedback] = useState(false)
  const [feedbackResult, setFeedbackResult] = useState<
    { sent: number; failed: number; skipped: number; errors: string[] } | null
  >(null)

  const handleSendFeedback = async () => {
    setSendingFeedback(true)
    setFeedbackResult(null)
    const result = await sendFeedbackRequests({ eventId: event.id })
    setFeedbackResult(result)
    setSendingFeedback(false)
    if (result.sent > 0) {
      setGuests((prev) =>
        prev.map((g) =>
          g.confirmed && !g.cancelled && g.feedback_sent_at == null
            ? { ...g, feedback_sent_at: new Date().toISOString() }
            : g,
        ),
      )
    }
  }

  const generateGroupings = async () => {
    if (unseatedGuests.length < 2) return
    if (tableSize <= 0) {
      setAiError("Set a 'Table Size' value in the event details first — that number is your table size.")
      return
    }
    setLoading(true)
    setAiError(null)
    setSource(null)
    setUnseatedCount(0)

    // Preserve locked tables and exclude their guests from re-grouping.
    const lockedTables = (parsedTables ?? []).filter((t) => t.locked)
    const lockedGuestIds = new Set(lockedTables.flatMap((t) => t.guestObjects.map((g) => g.id)))
    const guestsToGroup = unseatedGuests.filter((g) => !lockedGuestIds.has(g.id))

    if (guestsToGroup.length < 2) {
      setAiError("All remaining guests are in locked tables. Unlock a table to re-group them.")
      setLoading(false)
      return
    }

    try {
      const res = await fetch("/api/groupings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guests: guestsToGroup, tableSize }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const tables: TableGroup[] = data.tables
      setSource(data.source === "ai" ? "ai" : "heuristic")
      // The grouping API returns 1-based indexes into guestsToGroup.
      const generated: ParsedTable[] = tables.map((t) => ({
        ...t,
        guestObjects: t.guests.map((idx) => guestsToGroup[idx - 1]).filter(Boolean),
        locked: false,
      }))
      const combined = relabelTables([...lockedTables, ...generated])
      setParsedTables(combined)
      const seated = combined.reduce((sum, t) => sum + t.guestObjects.length, 0)
      setUnseatedCount(Math.max(0, unseatedGuests.length - seated))
    } catch (e) {
      setAiError(e instanceof Error && e.message ? e.message : "Could not generate groupings. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  // Keep table labels sequential after add/remove/re-generate.
  const relabelTables = (tables: ParsedTable[]): ParsedTable[] =>
    tables.map((t, i) => ({ ...t, table: `Table ${i + 1}` }))

  const toggleLock = (tableName: string) => {
    setParsedTables((prev) =>
      prev ? prev.map((t) => (t.table === tableName ? { ...t, locked: !t.locked } : t)) : prev,
    )
  }

  const addEmptyTable = () => {
    setParsedTables((prev) => {
      const base = prev ?? []
      const next: ParsedTable = {
        table: `Table ${base.length + 1}`,
        theme: "Hand-picked",
        why: "Manually arranged by the host.",
        guests: [],
        guestObjects: [],
        locked: false,
      }
      return [...base, next]
    })
  }

  const moveGuest = (guestId: number, fromTable: string, toTable: string) => {
    if (fromTable === toTable) return
    setParsedTables((prev) => {
      if (!prev) return prev
      const guest = prev.find((t) => t.table === fromTable)?.guestObjects.find((g) => g.id === guestId)
      if (!guest) return prev
      return prev.map((t) => {
        if (t.table === fromTable) {
          return { ...t, guestObjects: t.guestObjects.filter((g) => g.id !== guestId) }
        }
        if (t.table === toTable) {
          if (t.guestObjects.some((g) => g.id === guestId)) return t
          return { ...t, guestObjects: [...t.guestObjects, guest] }
        }
        return t
      })
    })
  }

  const handleDropOnTable = (toTable: string) => {
    if (dragging) moveGuest(dragging.guestId, dragging.fromTable, toTable)
    setDragging(null)
    setDragOverTable(null)
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
        <Stat num={unseatedGuests.length} label="Pending Guests" />
        <Stat num={tableSize > 0 ? tablesPossible : "—"} label={`Full Tables of ${tableSize || "?"}`} />
        <Stat num={confirmedGuests.length} label="Confirmed" />
      </div>

      {unseatedGuests.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          {guests.length === 0 && confirmedGuests.length === 0
            ? "No pending guests for this dinner yet. Share the questionnaire to start collecting RSVPs."
            : "Everyone has been emailed a table. See your tables below."}
        </div>
      ) : (
        <>
          <h3 className="mb-1.5 font-serif text-xl text-foreground">Pending Guests</h3>
          <p className="mb-5 text-sm text-muted-foreground">
            These guests haven&apos;t been seated yet. Generate table groupings below, then email each table their
            details. Once a guest is emailed a table, they move to &quot;Your Tables&quot; and drop off this list.
          </p>
          <div className="flex flex-col gap-3">
            {unseatedGuests.map((g) => (
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
                  <button
                    onClick={() => toggleGuestExpanded(g.id)}
                    aria-expanded={Boolean(expandedGuests[g.id])}
                    className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-[var(--gold-dark)] underline-offset-2 hover:underline"
                  >
                    <ChevronDown
                      className={cn(
                        "size-3.5 transition-transform",
                        expandedGuests[g.id] && "rotate-180",
                      )}
                      aria-hidden="true"
                    />
                    {expandedGuests[g.id] ? "Hide full answers" : "View full answers"}
                  </button>
                  {expandedGuests[g.id] && (
                    <dl className="mt-3 grid gap-x-6 gap-y-3 border-t border-border pt-3 sm:grid-cols-2">
                      {questions
                        .filter((q) => q.id !== "name" && q.id !== "email")
                        .map((q) => {
                          const value = g[q.id as keyof Guest]
                          const display = Array.isArray(value)
                            ? value.join(", ")
                            : value
                              ? String(value)
                              : null
                          return (
                            <div key={q.id}>
                              <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                {q.label}
                              </dt>
                              <dd className="mt-0.5 text-[13px] text-foreground">
                                {display || <span className="text-muted-foreground">—</span>}
                              </dd>
                            </div>
                          )
                        })}
                    </dl>
                  )}
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
              <div className="flex flex-wrap gap-2">
                {parsedTables && (
                  <button
                    onClick={addEmptyTable}
                    className="inline-flex items-center gap-1.5 rounded-lg border-[1.5px] border-input bg-card px-3 py-1.5 text-[13px] font-medium transition-colors hover:border-[var(--gold)]"
                  >
                    <Plus className="size-3.5" aria-hidden="true" />
                    Add table
                  </button>
                )}
                <button
                  onClick={generateGroupings}
                  disabled={loading || unseatedGuests.length < 2}
                  className="rounded-lg border-[1.5px] border-input bg-card px-4 py-1.5 text-[13px] font-medium transition-colors hover:border-[var(--gold)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Thinking..." : parsedTables ? "Re-generate" : "Generate groupings"}
                </button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Claude builds tables of exactly {tableSize > 0 ? tableSize : "your table size"} guest
              {tableSize === 1 ? "" : "s"}, balanced by interests, energy, and neighborhood. Then email each table
              their dinner details.
            </p>
            {parsedTables && (
              <>
                <p className="mt-2 text-[13px] text-muted-foreground">
                  Drag guests between tables to rearrange them. Lock a table to protect it when you re-generate.
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-4 text-[12px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-[var(--success)]" aria-hidden="true" />
                    Confirmed
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-muted-foreground/50" aria-hidden="true" />
                    Pending reply
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-destructive" aria-hidden="true" />
                    Cancelled
                  </span>
                </div>
              </>
            )}

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
                  const isOver = dragOverTable === table.table
                  return (
                    <div
                      key={table.table}
                      onDragOver={(e) => {
                        e.preventDefault()
                        if (!table.locked) setDragOverTable(table.table)
                      }}
                      onDragLeave={() => setDragOverTable((cur) => (cur === table.table ? null : cur))}
                      onDrop={() => {
                        if (!table.locked) handleDropOnTable(table.table)
                      }}
                      className={cn(
                        "rounded-xl border p-5 transition-colors",
                        isOver && !table.locked
                          ? "border-[var(--gold)] bg-[var(--gold)]/8"
                          : "border-border bg-secondary/40",
                        table.locked && "border-[var(--gold)]/50",
                      )}
                    >
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-serif text-lg text-foreground">{table.table}</h4>
                            <span className="text-[12px] text-muted-foreground">
                              {table.guestObjects.length} guest{table.guestObjects.length === 1 ? "" : "s"}
                            </span>
                            {table.locked && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--gold)]/12 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--gold-dark)]">
                                <Lock className="size-3" aria-hidden="true" />
                                Locked
                              </span>
                            )}
                          </div>
                          <p className="text-[13px] italic text-[var(--gold-dark)]">{table.theme}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => toggleLock(table.table)}
                            className="inline-flex items-center gap-1.5 rounded-lg border-[1.5px] border-input bg-card px-3 py-1.5 text-[13px] font-medium transition-colors hover:border-[var(--gold)]"
                          >
                            {table.locked ? (
                              <>
                                <Unlock className="size-3.5" aria-hidden="true" />
                                Unlock
                              </>
                            ) : (
                              <>
                                <Lock className="size-3.5" aria-hidden="true" />
                                Lock
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => handleSendTable(table)}
                            disabled={sendingTable === table.table || table.guestObjects.length === 0}
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
                      </div>
                      <p className="mb-3 text-[13px] text-muted-foreground">{table.why}</p>
                      {table.guestObjects.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-border px-3 py-3 text-center text-[13px] text-muted-foreground">
                          Empty table — drag guests here.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {table.guestObjects.map((g) => {
                            const status = guestStatus(g.id)
                            return (
                              <span
                                key={g.id}
                                draggable={!table.locked}
                                onDragStart={() => setDragging({ guestId: g.id, fromTable: table.table })}
                                onDragEnd={() => {
                                  setDragging(null)
                                  setDragOverTable(null)
                                }}
                                title={
                                  status === "confirmed"
                                    ? "Confirmed"
                                    : status === "cancelled"
                                      ? "Cancelled"
                                      : "Pending reply"
                                }
                                className={cn(
                                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13px]",
                                  table.locked ? "cursor-default" : "cursor-grab active:cursor-grabbing",
                                  dragging?.guestId === g.id && "opacity-40",
                                  status === "confirmed"
                                    ? "border-[var(--success)]/40 bg-[var(--success)]/10 text-foreground"
                                    : status === "cancelled"
                                      ? "border-destructive/40 bg-destructive/10 text-foreground line-through decoration-destructive/50"
                                      : "border-border bg-card text-foreground",
                                )}
                              >
                                {!table.locked && (
                                  <GripVertical className="size-3 text-muted-foreground" aria-hidden="true" />
                                )}
                                <span
                                  aria-hidden="true"
                                  className={cn(
                                    "size-1.5 rounded-full",
                                    status === "confirmed"
                                      ? "bg-[var(--success)]"
                                      : status === "cancelled"
                                        ? "bg-destructive"
                                        : "bg-muted-foreground/50",
                                  )}
                                />
                                {g.name}
                              </span>
                            )
                          })}
                        </div>
                      )}
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

      {/* Your Tables — emailed tables reconstructed from persisted data, with live status */}
      {sentTables.length > 0 && (
        <div className="mt-8">
          <h3 className="mb-1 font-serif text-xl text-foreground">Your Tables</h3>
          <p className="mb-3 text-[13px] text-muted-foreground">
            Tables you&apos;ve emailed, saved here for easy reference. Each shows the dinner location and where each
            guest stands.
          </p>
          <div className="mb-4 flex flex-wrap items-center gap-4 text-[12px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-[var(--success)]" aria-hidden="true" />
              Confirmed
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-muted-foreground/50" aria-hidden="true" />
              Pending reply
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-destructive" aria-hidden="true" />
              Cancelled
            </span>
          </div>
          <div className="flex flex-col gap-4">
            {sentTables.map((t) => {
              const confirmedCount = t.guests.filter((g) => guestStatus(g.id) === "confirmed").length
              return (
                <div key={t.label} className="rounded-xl border border-border bg-secondary/40 p-5">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h4 className="font-serif text-lg text-foreground">{t.label}</h4>
                    <span className="text-[12px] text-muted-foreground">
                      {confirmedCount}/{t.guests.length} confirmed
                    </span>
                  </div>
                  {(event.restaurant || event.address) && (
                    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
                      {event.restaurant && (
                        <span className="flex items-center gap-1.5 font-medium text-foreground">
                          <MapPin className="size-3.5" aria-hidden="true" />
                          {event.restaurant}
                        </span>
                      )}
                      {event.address && <span>{event.address}</span>}
                      {event.time && <span>{formatTime(event.time)}</span>}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {t.guests.map((g) => {
                      const status = guestStatus(g.id)
                      return (
                        <div key={g.id} className="group relative">
                          <span
                            className={cn(
                              "inline-flex cursor-default items-center gap-1.5 rounded-full border px-3 py-1 text-[13px]",
                              status === "confirmed"
                                ? "border-[var(--success)]/40 bg-[var(--success)]/10 text-foreground"
                                : status === "cancelled"
                                  ? "border-destructive/40 bg-destructive/10 text-foreground line-through decoration-destructive/50"
                                  : "border-border bg-card text-foreground",
                            )}
                          >
                            <span
                              aria-hidden="true"
                              className={cn(
                                "size-1.5 rounded-full",
                                status === "confirmed"
                                  ? "bg-[var(--success)]"
                                  : status === "cancelled"
                                    ? "bg-destructive"
                                    : "bg-muted-foreground/50",
                              )}
                            />
                            {g.name}
                            <button
                              onClick={() => handleRemoveFromTable(g)}
                              disabled={removingGuestId === g.id}
                              title={`Remove ${g.name} from ${t.label} and return them to the pool`}
                              aria-label={`Remove ${g.name} from ${t.label}`}
                              className="ml-0.5 inline-flex items-center justify-center rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive disabled:opacity-50"
                            >
                              {removingGuestId === g.id ? (
                                <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                              ) : (
                                <X className="size-3" aria-hidden="true" />
                              )}
                            </button>
                          </span>
                          <GuestAnswersCard guest={g} />
                        </div>
                      )
                    })}
                  </div>
                  {removeNotice[t.label] && (
                    <p className="mt-3 text-[12px] text-muted-foreground">{removeNotice[t.label]}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Confirmed guests */}
      {confirmedGuests.length > 0 && (
        <div className="mt-8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-serif text-xl text-foreground">Confirmed for Dinner</h3>
            <div className="flex flex-wrap items-center gap-2">
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
              <button
                onClick={handleSendFeedback}
                disabled={sendingFeedback}
                className="inline-flex items-center gap-1.5 rounded-lg border-[1.5px] border-input bg-card px-4 py-1.5 text-[13px] font-medium transition-colors hover:border-[var(--gold)] disabled:opacity-50"
              >
                {sendingFeedback ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Star className="size-3.5" aria-hidden="true" />
                    Email review request
                  </>
                )}
              </button>
            </div>
          </div>
          {feedbackResult && (
            <p className="mb-4 rounded-lg border border-border bg-secondary px-4 py-2.5 text-[13px] text-foreground">
              {feedbackResult.sent} review request{feedbackResult.sent === 1 ? "" : "s"} sent
              {feedbackResult.failed > 0 ? ` · ${feedbackResult.failed} failed` : ""}
              {feedbackResult.skipped > 0 ? ` · ${feedbackResult.skipped} skipped` : ""}
              {feedbackResult.errors.length > 0 ? ` — ${feedbackResult.errors.join("; ")}` : ""}
            </p>
          )}
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
                  {(g.feedback_rating != null || g.feedback_sent_at) && (
                    <div className="mt-2 flex flex-col gap-1">
                      {g.feedback_rating != null ? (
                        <div className="flex items-center gap-1.5">
                          <span className="flex items-center gap-0.5" aria-label={`${g.feedback_rating} out of 5 stars`}>
                            {[1, 2, 3, 4, 5].map((n) => (
                              <Star
                                key={n}
                                className={`size-3.5 ${
                                  n <= (g.feedback_rating ?? 0)
                                    ? "fill-[var(--gold)] text-[var(--gold)]"
                                    : "text-muted-foreground/40"
                                }`}
                                aria-hidden="true"
                              />
                            ))}
                          </span>
                          <span className="text-[12px] font-medium text-[var(--gold-dark)]">
                            {g.feedback_rating}/5
                          </span>
                        </div>
                      ) : (
                        <span className="text-[12px] text-muted-foreground">Review requested · awaiting reply</span>
                      )}
                      {g.feedback_comment && (
                        <p className="text-[13px] italic text-muted-foreground">{`"${g.feedback_comment}"`}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cancelled guests + manual fill-in */}
      {cancelledGuests.length > 0 && (
        <div className="mt-8">
          <h3 className="mb-1 font-serif text-xl text-foreground">Cancelled</h3>
          <p className="mb-3 text-[13px] text-muted-foreground">
            These guests dropped out. If they were already seated, the open seat is noted — fill it from your pending
            pool and we&apos;ll email the replacement their details.
          </p>
          <div className="flex flex-col gap-3">
            {cancelledGuests.map((g) => {
              const filled = filledSeats[g.id]
              const seatLabel = g.table_label
              return (
                <div key={g.id} className="rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-semibold text-foreground">{g.name}</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/12 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-destructive">
                          <XCircle className="size-3" aria-hidden="true" />
                          Cancelled
                        </span>
                        {seatLabel && (
                          <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--gold-dark)]">
                            Open seat at {seatLabel}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-[13px] text-muted-foreground">
                        {g.email}
                        {g.cancelled_at && <span> · cancelled {formatDate(g.cancelled_at, true)}</span>}
                      </div>
                    </div>
                  </div>

                  {filled ? (
                    <p className="mt-3 rounded-lg border border-border bg-card px-3 py-2 text-[13px] text-foreground">
                      {filled}
                    </p>
                  ) : unseatedGuests.length === 0 ? (
                    <p className="mt-3 text-[13px] text-muted-foreground">
                      No pending guests available to fill this seat.
                    </p>
                  ) : (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <label className="sr-only" htmlFor={`fill-${g.id}`}>
                        Choose a replacement guest
                      </label>
                      <select
                        id={`fill-${g.id}`}
                        value={fillSelection[g.id] ?? ""}
                        onChange={(e) =>
                          setFillSelection((prev) => ({
                            ...prev,
                            [g.id]: e.target.value ? Number(e.target.value) : "",
                          }))
                        }
                        className="rounded-lg border-[1.5px] border-input bg-card px-3 py-1.5 text-[13px] outline-none transition-colors focus:border-[var(--gold)]"
                      >
                        <option value="">Pick a replacement…</option>
                        {unseatedGuests.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleFillSeat(g)}
                        disabled={!fillSelection[g.id] || fillingSeat === g.id}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                      >
                        {fillingSeat === g.id ? (
                          <>
                            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                            Filling...
                          </>
                        ) : (
                          <>
                            <Send className="size-3.5" aria-hidden="true" />
                            Fill seat &amp; email
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
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

// Hover/focus popover that surfaces a guest's questionnaire answers, so the host
// can compare seatmates before deciding who to pull from a table.
function GuestAnswersCard({ guest }: { guest: Guest }) {
  const rows = questions
    .filter((q) => q.id !== "name" && q.id !== "email")
    .map((q) => {
      const value = guest[q.id as keyof Guest]
      const display = Array.isArray(value) ? value.join(", ") : value ? String(value) : null
      return { id: q.id, label: q.label, display }
    })
    .filter((r) => r.display)

  return (
    <div
      role="tooltip"
      className="invisible absolute left-1/2 top-full z-20 mt-2 w-72 -translate-x-1/2 rounded-xl border border-border bg-popover p-4 text-left opacity-0 shadow-lg transition-opacity duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
    >
      <p className="mb-2 font-serif text-sm text-foreground">{guest.name}&apos;s answers</p>
      {rows.length === 0 ? (
        <p className="text-[12px] text-muted-foreground">No questionnaire answers on file.</p>
      ) : (
        <dl className="grid gap-y-2">
          {rows.map((r) => (
            <div key={r.id}>
              <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{r.label}</dt>
              <dd className="mt-0.5 text-[12px] leading-snug text-foreground">{r.display}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}
