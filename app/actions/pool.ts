"use server"

import { sql } from "@/lib/db"
import { type PoolContact, type Guest } from "@/lib/questions"
import { revalidatePath } from "next/cache"

const POOL_COLUMNS = `
  id, name, email, phone, age_range, neighborhood, motivation,
  talk_about, skip_topics, energy, surprise, hope, source_guest_id, created_at
`

// Every saved contact in the permanent pool, newest first.
export async function getPoolContacts(): Promise<PoolContact[]> {
  const rows = await sql`
    SELECT ${sql.unsafe(POOL_COLUMNS)}
    FROM pool_contacts
    ORDER BY created_at DESC, id DESC
  `
  return rows as PoolContact[]
}

// Saves a guest (from any dinner) into the permanent pool so they can be
// re-imported into future dinners. Deduplicates on email when present so the
// same person isn't added twice; otherwise falls back to name match.
export async function savePoolContactFromGuest(
  guestId: number,
): Promise<{ ok: boolean; alreadySaved: boolean; contact?: PoolContact; error?: string }> {
  const guestRows = (await sql`
    SELECT id, name, email, phone, age_range, neighborhood, motivation,
           talk_about, skip_topics, energy, surprise, hope
    FROM guests WHERE id = ${guestId}
  `) as Guest[]
  const g = guestRows[0]
  if (!g) return { ok: false, alreadySaved: false, error: "Guest not found." }

  // Skip if this person is already in the pool (by email, else by name).
  const existing = (g.email
    ? await sql`SELECT ${sql.unsafe(POOL_COLUMNS)} FROM pool_contacts WHERE lower(email) = lower(${g.email}) LIMIT 1`
    : await sql`SELECT ${sql.unsafe(POOL_COLUMNS)} FROM pool_contacts WHERE name = ${g.name} AND email IS NULL LIMIT 1`) as PoolContact[]
  if (existing.length > 0) {
    return { ok: true, alreadySaved: true, contact: existing[0] }
  }

  const inserted = (await sql`
    INSERT INTO pool_contacts
      (name, email, phone, age_range, neighborhood, motivation, talk_about, skip_topics, energy, surprise, hope, source_guest_id)
    VALUES (
      ${g.name}, ${g.email}, ${g.phone}, ${g.age_range}, ${g.neighborhood}, ${g.motivation},
      ${JSON.stringify(g.talk_about ?? [])}, ${JSON.stringify(g.skip_topics ?? [])},
      ${g.energy}, ${g.surprise}, ${g.hope}, ${g.id}
    )
    RETURNING ${sql.unsafe(POOL_COLUMNS)}
  `) as PoolContact[]

  revalidatePath("/")
  return { ok: true, alreadySaved: false, contact: inserted[0] }
}

// Permanently removes a contact from the pool.
export async function deletePoolContact(id: number): Promise<{ ok: boolean }> {
  await sql`DELETE FROM pool_contacts WHERE id = ${id}`
  revalidatePath("/")
  return { ok: true }
}

// Imports pool contacts into a dinner as fresh, pending guests, then removes
// them from the pool (each import takes them out of the permanent pool).
// Returns the number imported so the UI can update.
export async function importPoolContactsToEvent(
  contactIds: number[],
  eventId: number,
): Promise<{ ok: boolean; imported: number; guests: Guest[]; error?: string }> {
  if (!contactIds || contactIds.length === 0) {
    return { ok: false, imported: 0, guests: [], error: "No contacts selected." }
  }

  const contacts = (await sql`
    SELECT ${sql.unsafe(POOL_COLUMNS)} FROM pool_contacts WHERE id = ANY(${contactIds})
  `) as PoolContact[]
  if (contacts.length === 0) {
    return { ok: false, imported: 0, guests: [], error: "Those contacts are no longer in the pool." }
  }

  const created: Guest[] = []
  for (const c of contacts) {
    const rows = (await sql`
      INSERT INTO guests
        (event_id, name, email, phone, age_range, neighborhood, motivation, talk_about, skip_topics, energy, surprise, hope)
      VALUES (
        ${eventId}, ${c.name}, ${c.email ?? ""}, ${c.phone}, ${c.age_range}, ${c.neighborhood}, ${c.motivation},
        ${JSON.stringify(c.talk_about ?? [])}, ${JSON.stringify(c.skip_topics ?? [])},
        ${c.energy}, ${c.surprise}, ${c.hope}
      )
      RETURNING id, event_id, name, email, phone, age_range, neighborhood, motivation,
                talk_about, skip_topics, energy, surprise, hope, submitted_at,
                cancel_token, cancelled, cancelled_at, details_sent_at, reminder_sent_at,
                confirmed, confirmed_at, table_label,
                feedback_sent_at, feedback_rating, feedback_comment, feedback_submitted_at
    `) as Guest[]
    created.push(rows[0])
  }

  // Imported contacts leave the pool.
  await sql`DELETE FROM pool_contacts WHERE id = ANY(${contactIds})`

  revalidatePath("/")
  return { ok: true, imported: created.length, guests: created }
}
