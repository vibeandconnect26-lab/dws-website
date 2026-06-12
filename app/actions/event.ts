"use server"

import { sql } from "@/lib/db"
import { type EventInfo, type EventDraft, emptyEventInfo, type Guest } from "@/lib/questions"
import { sendDinnerDetails } from "@/lib/email"
import { normalizePhone, sendReminderSms } from "@/lib/sms"
import { revalidatePath } from "next/cache"

const GUEST_COLUMNS = `
  id, event_id, name, email, phone, age_range, neighborhood, motivation,
  talk_about, skip_topics, energy, surprise, hope, submitted_at,
  cancel_token, cancelled, cancelled_at, details_sent_at, reminder_sent_at,
  confirmed, confirmed_at, table_label
`

type EventRow = {
  id: number | string
  restaurant: string | null
  address: string | null
  event_date: string | null
  event_time: string | null
  max_guests: string | null
  dress_code: string | null
  notes: string | null
  is_open: boolean | null
}

function mapEvent(row: EventRow): EventInfo {
  return {
    id: Number(row.id),
    restaurant: row.restaurant ?? "",
    address: row.address ?? "",
    date: row.event_date ?? "",
    time: row.event_time ?? "",
    maxGuests: row.max_guests ?? "",
    dressCode: row.dress_code ?? "",
    notes: row.notes ?? "",
    isOpen: row.is_open ?? false,
  }
}

export async function submitGuest(formData: {
  eventId: number
  name: string
  email: string
  phone: string
  age_range: string
  neighborhood: string
  motivation: string
  talk_about: string[]
  skip_topics: string[]
  energy: string
  surprise: string
  hope: string
}) {
  await sql`
    INSERT INTO guests
      (event_id, name, email, phone, age_range, neighborhood, motivation, talk_about, skip_topics, energy, surprise, hope)
    VALUES (
      ${formData.eventId},
      ${formData.name},
      ${formData.email},
      ${normalizePhone(formData.phone)},
      ${formData.age_range},
      ${formData.neighborhood},
      ${formData.motivation},
      ${JSON.stringify(formData.talk_about)},
      ${JSON.stringify(formData.skip_topics)},
      ${formData.energy},
      ${formData.surprise},
      ${formData.hope}
    )
  `
  revalidatePath("/")
  return { success: true }
}

// All events, newest first by date, for the admin.
export async function getEvents(): Promise<EventInfo[]> {
  const rows = (await sql`
    SELECT id, restaurant, address, event_date, event_time, max_guests, dress_code, notes, is_open
    FROM events
    ORDER BY (event_date = '') ASC, event_date DESC, id DESC
  `) as EventRow[]
  return rows.map(mapEvent)
}

// Only events open for signups, for the public form.
export async function getOpenEvents(): Promise<EventInfo[]> {
  const rows = (await sql`
    SELECT id, restaurant, address, event_date, event_time, max_guests, dress_code, notes, is_open
    FROM events
    WHERE is_open = true
    ORDER BY (event_date = '') ASC, event_date ASC, id ASC
  `) as EventRow[]
  return rows.map(mapEvent)
}

export async function getEvent(eventId: number): Promise<EventInfo | null> {
  const rows = (await sql`
    SELECT id, restaurant, address, event_date, event_time, max_guests, dress_code, notes, is_open
    FROM events WHERE id = ${eventId}
  `) as EventRow[]
  return rows[0] ? mapEvent(rows[0]) : null
}

export async function createEvent(draft: EventDraft): Promise<EventInfo> {
  const rows = (await sql`
    INSERT INTO events (restaurant, address, event_date, event_time, max_guests, dress_code, notes, is_open)
    VALUES (
      ${draft.restaurant}, ${draft.address}, ${draft.date}, ${draft.time},
      ${draft.maxGuests}, ${draft.dressCode}, ${draft.notes}, ${draft.isOpen}
    )
    RETURNING id, restaurant, address, event_date, event_time, max_guests, dress_code, notes, is_open
  `) as EventRow[]
  revalidatePath("/")
  return mapEvent(rows[0])
}

export async function updateEvent(info: EventInfo): Promise<{ success: boolean }> {
  await sql`
    UPDATE events SET
      restaurant = ${info.restaurant},
      address = ${info.address},
      event_date = ${info.date},
      event_time = ${info.time},
      max_guests = ${info.maxGuests},
      dress_code = ${info.dressCode},
      notes = ${info.notes},
      is_open = ${info.isOpen},
      updated_at = now()
    WHERE id = ${info.id}
  `
  revalidatePath("/")
  return { success: true }
}

export async function setEventOpen(eventId: number, isOpen: boolean): Promise<{ success: boolean }> {
  await sql`UPDATE events SET is_open = ${isOpen}, updated_at = now() WHERE id = ${eventId}`
  revalidatePath("/")
  return { success: true }
}

export async function deleteEvent(eventId: number): Promise<{ success: boolean }> {
  // Remove the event and its guests together.
  await sql`DELETE FROM guests WHERE event_id = ${eventId}`
  await sql`DELETE FROM events WHERE id = ${eventId}`
  revalidatePath("/")
  return { success: true }
}

export async function getGuests(eventId: number): Promise<Guest[]> {
  const rows = await sql`
    SELECT ${sql.unsafe(GUEST_COLUMNS)}
    FROM guests
    WHERE event_id = ${eventId} AND cancelled = false AND confirmed = false
    ORDER BY submitted_at ASC
  `
  return rows as Guest[]
}

export async function getConfirmedGuests(eventId: number): Promise<Guest[]> {
  const rows = await sql`
    SELECT ${sql.unsafe(GUEST_COLUMNS)}
    FROM guests
    WHERE event_id = ${eventId} AND cancelled = false AND confirmed = true
    ORDER BY confirmed_at ASC
  `
  return rows as Guest[]
}

// Per-event counts so the admin event list can show activity at a glance.
export async function getEventCounts(): Promise<Record<number, { pending: number; confirmed: number }>> {
  const rows = (await sql`
    SELECT event_id,
      COUNT(*) FILTER (WHERE cancelled = false AND confirmed = false) AS pending,
      COUNT(*) FILTER (WHERE cancelled = false AND confirmed = true) AS confirmed
    FROM guests
    WHERE event_id IS NOT NULL
    GROUP BY event_id
  `) as { event_id: number | string; pending: number | string; confirmed: number | string }[]
  const out: Record<number, { pending: number; confirmed: number }> = {}
  for (const r of rows) {
    out[Number(r.event_id)] = { pending: Number(r.pending), confirmed: Number(r.confirmed) }
  }
  return out
}

export async function deleteGuest(id: number) {
  await sql`DELETE FROM guests WHERE id = ${id}`
  revalidatePath("/")
  return { success: true }
}

export async function verifyAdmin(password: string) {
  const expected = process.env.ADMIN_PASSWORD || "vibeadmin2025"
  return { ok: password === expected }
}

export async function sendDinnerDetailsToTable(
  guestIds: number[],
  tableLabel: string,
  eventId: number,
): Promise<{
  sent: number
  failed: number
  errors: string[]
}> {
  const event = await getEvent(eventId)
  if (!event || !event.restaurant) {
    return { sent: 0, failed: 0, errors: ["Add event details before sending."] }
  }
  if (!guestIds || guestIds.length === 0) {
    return { sent: 0, failed: 0, errors: ["No guests at this table."] }
  }

  const rows = (await sql`
    SELECT ${sql.unsafe(GUEST_COLUMNS)}
    FROM guests
    WHERE id = ANY(${guestIds}) AND cancelled = false
    ORDER BY submitted_at ASC
  `) as Guest[]

  let sent = 0
  let failed = 0
  const errors: string[] = []

  for (const guest of rows) {
    const result = await sendDinnerDetails(guest, event)
    if (result.ok) {
      sent++
      await sql`
        UPDATE guests SET details_sent_at = now(), table_label = ${tableLabel}
        WHERE id = ${guest.id}
      `
    } else {
      failed++
      if (result.error && !errors.includes(result.error)) errors.push(result.error)
    }
  }

  revalidatePath("/")
  return { sent, failed, errors }
}

export async function getGuestByToken(token: string): Promise<Guest | null> {
  const rows = (await sql`
    SELECT ${sql.unsafe(GUEST_COLUMNS)}
    FROM guests
    WHERE cancel_token = ${token}
  `) as Guest[]
  return rows[0] ?? null
}

export async function getEventForGuestToken(token: string): Promise<EventInfo> {
  const rows = (await sql`
    SELECT e.id, e.restaurant, e.address, e.event_date, e.event_time, e.max_guests, e.dress_code, e.notes, e.is_open
    FROM guests g JOIN events e ON e.id = g.event_id
    WHERE g.cancel_token = ${token}
  `) as EventRow[]
  return rows[0] ? mapEvent(rows[0]) : emptyEventInfo
}

export async function confirmByToken(
  token: string,
): Promise<{ ok: boolean; alreadyConfirmed: boolean; cancelled: boolean }> {
  const rows = (await sql`
    SELECT confirmed, cancelled FROM guests WHERE cancel_token = ${token}
  `) as { confirmed: boolean; cancelled: boolean }[]

  if (rows.length === 0) return { ok: false, alreadyConfirmed: false, cancelled: false }
  if (rows[0].cancelled) return { ok: false, alreadyConfirmed: false, cancelled: true }
  if (rows[0].confirmed) return { ok: true, alreadyConfirmed: true, cancelled: false }

  await sql`
    UPDATE guests SET confirmed = true, confirmed_at = now() WHERE cancel_token = ${token}
  `
  revalidatePath("/")
  return { ok: true, alreadyConfirmed: false, cancelled: false }
}

export async function sendReminders(opts?: { eventId?: number; onlyUnsent?: boolean }): Promise<{
  sent: number
  failed: number
  skipped: number
  errors: string[]
}> {
  let sent = 0
  let failed = 0
  let skipped = 0
  const errors: string[] = []

  // Scope to one event when given, otherwise all events (used by the cron job).
  const events = opts?.eventId
    ? ([await getEvent(opts.eventId)].filter(Boolean) as EventInfo[])
    : await getEvents()

  for (const event of events) {
    if (!event.restaurant) continue

    const guests = (await sql`
      SELECT ${sql.unsafe(GUEST_COLUMNS)}
      FROM guests
      WHERE event_id = ${event.id} AND cancelled = false AND confirmed = true
      ORDER BY confirmed_at ASC
    `) as Guest[]

    for (const guest of guests) {
      // When triggered by cron we avoid double-texting anyone already reminded.
      if (opts?.onlyUnsent && guest.reminder_sent_at) {
        skipped++
        continue
      }
      if (!normalizePhone(guest.phone)) {
        skipped++
        if (!errors.includes("Some guests have no valid mobile number.")) {
          errors.push("Some guests have no valid mobile number.")
        }
        continue
      }
      const result = await sendReminderSms(guest, event)
      if (result.ok) {
        sent++
        await sql`UPDATE guests SET reminder_sent_at = now() WHERE id = ${guest.id}`
      } else {
        failed++
        if (result.error && !errors.includes(result.error)) errors.push(result.error)
      }
    }
  }

  if (!opts?.eventId && events.length === 0) {
    errors.push("No events found.")
  }

  revalidatePath("/")
  return { sent, failed, skipped, errors }
}

export async function cancelByToken(token: string): Promise<{ ok: boolean; alreadyCancelled: boolean }> {
  const rows = (await sql`
    SELECT cancelled FROM guests WHERE cancel_token = ${token}
  `) as { cancelled: boolean }[]

  if (rows.length === 0) return { ok: false, alreadyCancelled: false }
  if (rows[0].cancelled) return { ok: true, alreadyCancelled: true }

  await sql`
    UPDATE guests SET cancelled = true, cancelled_at = now() WHERE cancel_token = ${token}
  `
  revalidatePath("/")
  return { ok: true, alreadyCancelled: false }
}
