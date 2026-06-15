"use server"

import { sql } from "@/lib/db"
import { type EventInfo, type EventDraft, emptyEventInfo, type Guest, type PoolContact } from "@/lib/questions"
import {
  sendCancellationReceipt,
  sendConfirmationReceipt,
  sendDinnerCancelled,
  sendDinnerDetails,
  sendFeedbackRequest,
  sendNotChosenNotice,
  sendSystemErrorNotice,
} from "@/lib/email"
import { normalizePhone, sendChosenSms, sendConfirmationSms, sendReminderSms } from "@/lib/sms"
import { revalidatePath } from "next/cache"

const GUEST_COLUMNS = `
  id, event_id, name, email, phone, age_range, neighborhood, motivation,
  talk_about, skip_topics, energy, surprise, hope, submitted_at,
  cancel_token, cancelled, cancelled_at, details_sent_at, reminder_sent_at,
  confirmed, confirmed_at, table_label,
  feedback_sent_at, feedback_rating, feedback_comment, feedback_submitted_at
`

// Profile fields shared between a guest and a pooled contact.
const POOL_PROFILE_COLUMNS = `
  name, email, phone, age_range, neighborhood, motivation,
  talk_about, skip_topics, energy, surprise, hope
`

const POOL_COLUMNS = `id, source_guest_id, ${POOL_PROFILE_COLUMNS}, created_at`

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

// Creates a new dinner pre-filled with another dinner's details so the admin
// can spin up similar events quickly. Guests are NOT copied, the date/time are
// cleared (each event needs its own), and the copy starts closed for signups.
export async function duplicateEvent(eventId: number): Promise<EventInfo | null> {
  const source = await getEvent(eventId)
  if (!source) return null

  const rows = (await sql`
    INSERT INTO events (restaurant, address, event_date, event_time, max_guests, dress_code, notes, is_open)
    VALUES (
      ${source.restaurant ? `${source.restaurant} (Copy)` : ""},
      ${source.address}, ${""}, ${""},
      ${source.maxGuests}, ${source.dressCode}, ${source.notes}, ${false}
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

// Guests who cancelled after RSVPing, newest cancellation first.
export async function getCancelledGuests(eventId: number): Promise<Guest[]> {
  const rows = await sql`
    SELECT ${sql.unsafe(GUEST_COLUMNS)}
    FROM guests
    WHERE event_id = ${eventId} AND cancelled = true
    ORDER BY cancelled_at DESC NULLS LAST
  `
  return rows as Guest[]
}

// Per-event counts so the admin event list can show activity at a glance.
export async function getEventCounts(): Promise<
  Record<number, { pending: number; confirmed: number; cancelled: number }>
> {
  const rows = (await sql`
    SELECT event_id,
      COUNT(*) FILTER (WHERE cancelled = false AND confirmed = false) AS pending,
      COUNT(*) FILTER (WHERE cancelled = false AND confirmed = true) AS confirmed,
      COUNT(*) FILTER (WHERE cancelled = true) AS cancelled
    FROM guests
    WHERE event_id IS NOT NULL
    GROUP BY event_id
  `) as {
    event_id: number | string
    pending: number | string
    confirmed: number | string
    cancelled: number | string
  }[]
  const out: Record<number, { pending: number; confirmed: number; cancelled: number }> = {}
  for (const r of rows) {
    out[Number(r.event_id)] = {
      pending: Number(r.pending),
      confirmed: Number(r.confirmed),
      cancelled: Number(r.cancelled),
    }
  }
  return out
}

export async function deleteGuest(id: number) {
  await sql`DELETE FROM guests WHERE id = ${id}`
  revalidatePath("/")
  return { success: true }
}

// Moves a pending guest from their current dinner into another dinner's pool.
// Resets all seating / send / RSVP state so they start fresh in the new pool.
export async function moveGuestToEvent(
  guestId: number,
  targetEventId: number,
): Promise<{ ok: boolean; error?: string }> {
  const target = await getEvent(targetEventId)
  if (!target) return { ok: false, error: "That dinner no longer exists." }

  const rows = (await sql`SELECT id FROM guests WHERE id = ${guestId}`) as { id: number }[]
  if (rows.length === 0) return { ok: false, error: "Guest not found." }

  await sql`
    UPDATE guests
    SET event_id = ${targetEventId},
        table_label = NULL,
        details_sent_at = NULL,
        reminder_sent_at = NULL,
        confirmed = false,
        confirmed_at = NULL,
        cancelled = false,
        cancelled_at = NULL,
        feedback_sent_at = NULL,
        feedback_rating = NULL,
        feedback_comment = NULL,
        feedback_submitted_at = NULL
    WHERE id = ${guestId}
  `
  revalidatePath("/")
  return { ok: true }
}

// Every contact saved to the standing pool, newest first.
export async function getPoolContacts(): Promise<PoolContact[]> {
  const rows = await sql`
    SELECT ${sql.unsafe(POOL_COLUMNS)}
    FROM pool_contacts
    ORDER BY created_at DESC NULLS LAST, id DESC
  `
  return rows as PoolContact[]
}

// Marks a guest as "not chosen": removes them from their dinner, saves their
// profile to the standing pool of unassigned people, and emails them a warm
// note with a link back to the dinners page so they can pick another night.
// Set `notify` to false to move silently without emailing.
// The INSERT...SELECT copies the profile (jsonb included) without
// re-serializing on the client.
export async function moveGuestToPool(
  guestId: number,
  notify = true,
): Promise<{ ok: boolean; contact?: PoolContact; emailSent?: boolean; emailError?: string; error?: string }> {
  // Load the full guest (and their dinner) up front so we can personalize the
  // "not chosen" email before the row is deleted.
  const guestRows = (await sql`
    SELECT ${sql.unsafe(GUEST_COLUMNS)} FROM guests WHERE id = ${guestId}
  `) as Guest[]
  if (guestRows.length === 0) return { ok: false, error: "Guest not found." }
  const guest = guestRows[0]
  const event = guest.event_id != null ? await getEvent(guest.event_id) : null

  const inserted = (await sql`
    INSERT INTO pool_contacts
      (source_guest_id, ${sql.unsafe(POOL_PROFILE_COLUMNS)})
    SELECT id, ${sql.unsafe(POOL_PROFILE_COLUMNS)}
    FROM guests
    WHERE id = ${guestId}
    RETURNING ${sql.unsafe(POOL_COLUMNS)}
  `) as PoolContact[]

  if (inserted.length === 0) return { ok: false, error: "Guest not found." }

  await sql`DELETE FROM guests WHERE id = ${guestId}`

  // Email the guest that they weren't chosen, with a link to pick another
  // dinner. A failed email never blocks the move — we just report it back.
  let emailSent = false
  let emailError: string | undefined
  if (notify && event && guest.email) {
    const res = await sendNotChosenNotice(guest, event)
    emailSent = res.ok
    if (!res.ok) emailError = res.error
  }

  revalidatePath("/")
  return { ok: true, contact: inserted[0], emailSent, emailError }
}

// Places a pooled contact into a dinner as a fresh pending guest, then removes
// them from the pool.
export async function assignPoolContactToEvent(
  poolContactId: number,
  targetEventId: number,
): Promise<{ ok: boolean; error?: string }> {
  const target = await getEvent(targetEventId)
  if (!target) return { ok: false, error: "That dinner no longer exists." }

  const inserted = (await sql`
    INSERT INTO guests
      (event_id, ${sql.unsafe(POOL_PROFILE_COLUMNS)})
    SELECT ${targetEventId}, ${sql.unsafe(POOL_PROFILE_COLUMNS)}
    FROM pool_contacts
    WHERE id = ${poolContactId}
    RETURNING id
  `) as { id: number }[]

  if (inserted.length === 0) return { ok: false, error: "Pool contact not found." }

  await sql`DELETE FROM pool_contacts WHERE id = ${poolContactId}`
  revalidatePath("/")
  return { ok: true }
}

// Permanently removes a contact from the standing pool.
export async function deletePoolContact(poolContactId: number): Promise<{ ok: boolean }> {
  await sql`DELETE FROM pool_contacts WHERE id = ${poolContactId}`
  revalidatePath("/")
  return { ok: true }
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
  textsSent: number
  textsFailed: number
  errors: string[]
}> {
  const event = await getEvent(eventId)
  if (!event || !event.restaurant) {
    return { sent: 0, failed: 0, textsSent: 0, textsFailed: 0, errors: ["Add event details before sending."] }
  }
  if (!guestIds || guestIds.length === 0) {
    return { sent: 0, failed: 0, textsSent: 0, textsFailed: 0, errors: ["No guests at this table."] }
  }

  const rows = (await sql`
    SELECT ${sql.unsafe(GUEST_COLUMNS)}
    FROM guests
    WHERE id = ANY(${guestIds}) AND cancelled = false
    ORDER BY submitted_at ASC
  `) as Guest[]

  let sent = 0
  let failed = 0
  let textsSent = 0
  let textsFailed = 0
  const errors: string[] = []

  for (const [seatIndex, guest] of rows.entries()) {
    const result = await sendDinnerDetails(guest, event, seatIndex)
    if (result.ok) {
      sent++
      await sql`
        UPDATE guests SET details_sent_at = now(), table_label = ${tableLabel}
        WHERE id = ${guest.id}
      `
      // Also text the guest the essentials. A missing/invalid number or SMS
      // failure never blocks the email confirmation — we just tally it.
      const smsResult = await sendChosenSms(guest, event)
      if (smsResult.ok) {
        textsSent++
      } else {
        textsFailed++
        if (smsResult.error && !errors.includes(smsResult.error)) errors.push(smsResult.error)
      }
    } else {
      failed++
      if (result.error && !errors.includes(result.error)) errors.push(result.error)
    }
  }

  revalidatePath("/")
  return { sent, failed, textsSent, textsFailed, errors }
}

// Re-sends the dinner details / confirmation email to guests who were already
// emailed but haven't confirmed (or cancelled) yet. Pass the full ordered list
// of a table's guest IDs so seat-specific prompts stay consistent — confirmed
// and cancelled guests are skipped automatically.
export async function resendConfirmation(
  guestIds: number[],
  eventId: number,
): Promise<{ sent: number; failed: number; skipped: number; errors: string[] }> {
  const event = await getEvent(eventId)
  if (!event || !event.restaurant) {
    return { sent: 0, failed: 0, skipped: 0, errors: ["Add event details before sending."] }
  }
  if (!guestIds || guestIds.length === 0) {
    return { sent: 0, failed: 0, skipped: 0, errors: ["No guests to resend to."] }
  }

  const rows = (await sql`
    SELECT ${sql.unsafe(GUEST_COLUMNS)}
    FROM guests
    WHERE id = ANY(${guestIds})
    ORDER BY submitted_at ASC
  `) as Guest[]

  let sent = 0
  let failed = 0
  let skipped = 0
  const errors: string[] = []

  for (const [seatIndex, guest] of rows.entries()) {
    // Only resend to guests already emailed who haven't confirmed or cancelled.
    if (!guest.details_sent_at || guest.confirmed || guest.cancelled) {
      skipped++
      continue
    }
    const result = await sendDinnerDetails(guest, event, seatIndex)
    if (result.ok) {
      sent++
      await sql`UPDATE guests SET details_sent_at = now() WHERE id = ${guest.id}`
    } else {
      failed++
      if (result.error && !errors.includes(result.error)) errors.push(result.error)
    }
  }

  revalidatePath("/")
  return { sent, failed, skipped, errors }
}

// Cancels a dinner for a group of guests because not enough people confirmed.
// Emails each non-cancelled guest a cancellation notice and marks them cancelled
// so they move to the cancelled list. Pass the guest IDs that make up the group
// (e.g. everyone at a sent table) along with the event.
export async function cancelDinnerForGuests(
  guestIds: number[],
  eventId: number,
): Promise<{ sent: number; failed: number; cancelled: number; errors: string[] }> {
  const event = await getEvent(eventId)
  if (!event) {
    return { sent: 0, failed: 0, cancelled: 0, errors: ["That dinner no longer exists."] }
  }
  if (!guestIds || guestIds.length === 0) {
    return { sent: 0, failed: 0, cancelled: 0, errors: ["No guests to cancel."] }
  }

  const rows = (await sql`
    SELECT ${sql.unsafe(GUEST_COLUMNS)}
    FROM guests
    WHERE id = ANY(${guestIds}) AND cancelled = false
    ORDER BY submitted_at ASC
  `) as Guest[]

  let sent = 0
  let failed = 0
  let cancelled = 0
  const errors: string[] = []

  for (const guest of rows) {
    const result = await sendDinnerCancelled(guest, event)
    if (result.ok) {
      sent++
    } else {
      failed++
      if (result.error && !errors.includes(result.error)) errors.push(result.error)
    }
    // Mark cancelled regardless of email outcome so the admin's view stays
    // accurate; the inline notice surfaces any email failures.
    await sql`
      UPDATE guests
      SET cancelled = true, cancelled_at = now()
      WHERE id = ${guest.id}
    `
    cancelled++
  }

  revalidatePath("/")
  return { sent, failed, cancelled, errors }
}

// Removes a guest from a sent table and returns them to the pending pool.
// Clears their table assignment + sent/confirm/cancel state, then emails a
// "please disregard / system error" notice letting them know they're safe.
export async function removeGuestFromTable(
  guestId: number,
  eventId: number,
): Promise<{ ok: boolean; emailed: boolean; error?: string }> {
  const rows = (await sql`
    SELECT ${sql.unsafe(GUEST_COLUMNS)}
    FROM guests
    WHERE id = ${guestId}
  `) as Guest[]
  const guest = rows[0]
  if (!guest) return { ok: false, emailed: false, error: "Guest not found." }

  // Return them to the pending pool: clear the table + all send/RSVP state.
  await sql`
    UPDATE guests
    SET table_label = NULL,
        details_sent_at = NULL,
        reminder_sent_at = NULL,
        confirmed = false,
        confirmed_at = NULL,
        cancelled = false,
        cancelled_at = NULL
    WHERE id = ${guestId}
  `

  let emailed = false
  let error: string | undefined
  const event = await getEvent(eventId)
  if (event && guest.email) {
    const result = await sendSystemErrorNotice(guest, event)
    emailed = result.ok
    if (!result.ok) error = result.error
  }

  revalidatePath("/")
  return { ok: true, emailed, error }
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
    SELECT ${sql.unsafe(GUEST_COLUMNS)} FROM guests WHERE cancel_token = ${token}
  `) as Guest[]

  if (rows.length === 0) return { ok: false, alreadyConfirmed: false, cancelled: false }
  if (rows[0].cancelled) return { ok: false, alreadyConfirmed: false, cancelled: true }
  if (rows[0].confirmed) return { ok: true, alreadyConfirmed: true, cancelled: false }

  await sql`
    UPDATE guests SET confirmed = true, confirmed_at = now() WHERE cancel_token = ${token}
  `
  revalidatePath("/")

  // Send a short "you're confirmed" receipt so the guest has proof in their
  // inbox. Email failures shouldn't block the confirmation itself.
  const event = rows[0].event_id ? await getEvent(rows[0].event_id) : null
  if (event) {
    const result = await sendConfirmationReceipt(rows[0], event)
    if (!result.ok && result.error) console.log("[v0] confirmation receipt failed:", result.error)
    // Also fire a brief confirmation text pointing them to their email. SMS
    // failures (no Twilio config, no/invalid phone) shouldn't block confirming.
    const smsResult = await sendConfirmationSms(rows[0], event)
    if (!smsResult.ok && smsResult.error) console.log("[v0] confirmation SMS failed:", smsResult.error)
  }

  return { ok: true, alreadyConfirmed: false, cancelled: false }
}

// Manually confirms a guest from the admin dashboard, for cases where the guest
// can't complete the confirmation on their end (broken link, email issues, etc.).
// Mirrors confirmByToken but is keyed by guest id and emails a receipt.
export async function confirmGuestManually(
  guestId: number,
  eventId: number,
): Promise<{ ok: boolean; alreadyConfirmed: boolean; cancelled: boolean; error?: string }> {
  const rows = (await sql`
    SELECT ${sql.unsafe(GUEST_COLUMNS)} FROM guests WHERE id = ${guestId}
  `) as Guest[]

  if (rows.length === 0) return { ok: false, alreadyConfirmed: false, cancelled: false, error: "Guest not found." }
  if (rows[0].cancelled) return { ok: false, alreadyConfirmed: false, cancelled: true, error: "Guest has cancelled." }
  if (rows[0].confirmed) return { ok: true, alreadyConfirmed: true, cancelled: false }

  await sql`
    UPDATE guests SET confirmed = true, confirmed_at = now() WHERE id = ${guestId}
  `
  revalidatePath("/")

  // Send a short "you're confirmed" receipt so the guest has proof in their
  // inbox. Email failures shouldn't block the confirmation itself.
  const event = await getEvent(eventId)
  if (event) {
    const result = await sendConfirmationReceipt(rows[0], event)
    if (!result.ok && result.error) console.log("[v0] manual confirmation receipt failed:", result.error)
    // Same confirmation text as the self-serve flow, so manually-confirmed
    // guests get an identical experience. SMS failures don't block confirming.
    const smsResult = await sendConfirmationSms(rows[0], event)
    if (!smsResult.ok && smsResult.error) console.log("[v0] manual confirmation SMS failed:", smsResult.error)
  }

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
    SELECT ${sql.unsafe(GUEST_COLUMNS)} FROM guests WHERE cancel_token = ${token}
  `) as Guest[]

  if (rows.length === 0) return { ok: false, alreadyCancelled: false }
  if (rows[0].cancelled) return { ok: true, alreadyCancelled: true }

  await sql`
    UPDATE guests SET cancelled = true, cancelled_at = now() WHERE cancel_token = ${token}
  `
  revalidatePath("/")

  // Send a short "your spot is released" receipt so the guest knows the
  // cancellation went through. Email failures shouldn't block the cancellation.
  const event = rows[0].event_id ? await getEvent(rows[0].event_id) : null
  if (event) {
    const result = await sendCancellationReceipt(rows[0], event)
    if (!result.ok && result.error) console.log("[v0] cancellation receipt failed:", result.error)
  }

  return { ok: true, alreadyCancelled: false }
}

// Re-sends the receipt for a guest's current status (confirmed or cancelled).
// Lets a guest request another copy from the confirmation page if the first
// email never arrived or was lost.
export async function resendReceiptByToken(
  token: string,
): Promise<{ ok: boolean; type: "confirmed" | "cancelled" | "none"; error?: string }> {
  const rows = (await sql`
    SELECT ${sql.unsafe(GUEST_COLUMNS)} FROM guests WHERE cancel_token = ${token}
  `) as Guest[]
  if (rows.length === 0) return { ok: false, type: "none", error: "We couldn't find your reservation." }

  const guest = rows[0]
  const event = guest.event_id ? await getEvent(guest.event_id) : null
  if (!event) return { ok: false, type: "none", error: "This dinner is no longer available." }

  if (guest.cancelled) {
    const result = await sendCancellationReceipt(guest, event)
    if (!result.ok && result.error) console.log("[v0] resend cancellation receipt failed:", result.error)
    return result.ok ? { ok: true, type: "cancelled" } : { ok: false, type: "cancelled", error: result.error }
  }
  if (guest.confirmed) {
    const result = await sendConfirmationReceipt(guest, event)
    if (!result.ok && result.error) console.log("[v0] resend confirmation receipt failed:", result.error)
    return result.ok ? { ok: true, type: "confirmed" } : { ok: false, type: "confirmed", error: result.error }
  }
  return { ok: false, type: "none", error: "Please confirm or cancel your spot first." }
}

// Sends the post-event review request to everyone who attended (confirmed,
// not cancelled). When triggered by cron we skip anyone already emailed.
export async function sendFeedbackRequests(opts?: { eventId?: number; onlyUnsent?: boolean }): Promise<{
  sent: number
  failed: number
  skipped: number
  errors: string[]
}> {
  let sent = 0
  let failed = 0
  let skipped = 0
  const errors: string[] = []

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
      if (opts?.onlyUnsent && guest.feedback_sent_at) {
        skipped++
        continue
      }
      if (!guest.email) {
        skipped++
        if (!errors.includes("Some guests have no email address.")) {
          errors.push("Some guests have no email address.")
        }
        continue
      }
      const result = await sendFeedbackRequest(guest, event)
      if (result.ok) {
        sent++
        await sql`UPDATE guests SET feedback_sent_at = now() WHERE id = ${guest.id}`
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

// Records a guest's star rating (1–5) and optional comment from the feedback page.
export async function submitFeedback(
  token: string,
  rating: number,
  comment: string,
): Promise<{ ok: boolean; error?: string }> {
  const safeRating = Math.round(rating)
  if (!Number.isFinite(safeRating) || safeRating < 1 || safeRating > 5) {
    return { ok: false, error: "Please choose a rating between 1 and 5 stars." }
  }

  const rows = (await sql`
    SELECT id FROM guests WHERE cancel_token = ${token}
  `) as { id: number }[]
  if (rows.length === 0) return { ok: false, error: "We couldn't find your reservation." }

  await sql`
    UPDATE guests
    SET feedback_rating = ${safeRating},
        feedback_comment = ${comment.trim() || null},
        feedback_submitted_at = now()
    WHERE cancel_token = ${token}
  `
  revalidatePath("/")
  return { ok: true }
}
