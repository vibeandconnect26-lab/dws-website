"use server"

import { sql } from "@/lib/db"
import { type EventInfo, emptyEventInfo, type Guest } from "@/lib/questions"
import { sendDinnerDetails } from "@/lib/email"
import { revalidatePath } from "next/cache"

export async function submitGuest(formData: {
  name: string
  email: string
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
      (name, email, age_range, neighborhood, motivation, talk_about, skip_topics, energy, surprise, hope)
    VALUES (
      ${formData.name},
      ${formData.email},
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

export async function getGuests(): Promise<Guest[]> {
  const rows = await sql`
    SELECT id, name, email, age_range, neighborhood, motivation,
           talk_about, skip_topics, energy, surprise, hope, submitted_at,
           cancel_token, cancelled, cancelled_at, details_sent_at,
           confirmed, confirmed_at, table_label
    FROM guests
    WHERE cancelled = false AND confirmed = false
    ORDER BY submitted_at ASC
  `
  return rows as Guest[]
}

export async function getConfirmedGuests(): Promise<Guest[]> {
  const rows = await sql`
    SELECT id, name, email, age_range, neighborhood, motivation,
           talk_about, skip_topics, energy, surprise, hope, submitted_at,
           cancel_token, cancelled, cancelled_at, details_sent_at,
           confirmed, confirmed_at, table_label
    FROM guests
    WHERE cancelled = false AND confirmed = true
    ORDER BY confirmed_at ASC
  `
  return rows as Guest[]
}

export async function deleteGuest(id: number) {
  await sql`DELETE FROM guests WHERE id = ${id}`
  revalidatePath("/")
  return { success: true }
}

export async function getEventInfo(): Promise<EventInfo> {
  const rows = await sql`
    SELECT restaurant, address, event_date, event_time, max_guests, dress_code, notes
    FROM event_info WHERE id = 1
  `
  const row = rows[0]
  if (!row) return emptyEventInfo
  return {
    restaurant: row.restaurant ?? "",
    address: row.address ?? "",
    date: row.event_date ?? "",
    time: row.event_time ?? "",
    maxGuests: row.max_guests ?? "",
    dressCode: row.dress_code ?? "",
    notes: row.notes ?? "",
  }
}

export async function saveEventInfo(info: EventInfo) {
  await sql`
    UPDATE event_info SET
      restaurant = ${info.restaurant},
      address = ${info.address},
      event_date = ${info.date},
      event_time = ${info.time},
      max_guests = ${info.maxGuests},
      dress_code = ${info.dressCode},
      notes = ${info.notes},
      updated_at = now()
    WHERE id = 1
  `
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
): Promise<{
  sent: number
  failed: number
  errors: string[]
}> {
  const event = await getEventInfo()
  if (!event.restaurant) {
    return { sent: 0, failed: 0, errors: ["Add event details before sending."] }
  }
  if (!guestIds || guestIds.length === 0) {
    return { sent: 0, failed: 0, errors: ["No guests at this table."] }
  }

  const rows = (await sql`
    SELECT id, name, email, age_range, neighborhood, motivation,
           talk_about, skip_topics, energy, surprise, hope, submitted_at,
           cancel_token, cancelled, cancelled_at, details_sent_at,
           confirmed, confirmed_at, table_label
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
    SELECT id, name, email, age_range, neighborhood, motivation,
           talk_about, skip_topics, energy, surprise, hope, submitted_at,
           cancel_token, cancelled, cancelled_at, details_sent_at,
           confirmed, confirmed_at, table_label
    FROM guests
    WHERE cancel_token = ${token}
  `) as Guest[]
  return rows[0] ?? null
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

