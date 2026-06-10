"use server"

import { sql } from "@/lib/db"
import { type EventInfo, emptyEventInfo, type Guest } from "@/lib/questions"
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
           talk_about, skip_topics, energy, surprise, hope, submitted_at
    FROM guests
    ORDER BY submitted_at ASC
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

