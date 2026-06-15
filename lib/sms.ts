import twilio from "twilio"
import type { EventInfo, Guest } from "@/lib/questions"

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const fromNumber = process.env.TWILIO_PHONE_NUMBER

const client = accountSid && authToken ? twilio(accountSid, authToken) : null

// Normalize a US phone number to E.164 (+1XXXXXXXXXX) so Twilio accepts it.
// Returns null if it doesn't look like a valid 10-digit US number.
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, "")
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`
  if (raw.trim().startsWith("+")) return raw.trim()
  return null
}

function formatDate(date: string) {
  if (!date) return "TBA"
  const parsed = new Date(date + "T12:00:00")
  if (isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
}

function formatTime(time: string) {
  if (!time) return "TBA"
  const parsed = new Date("1970-01-01T" + time)
  if (isNaN(parsed.getTime())) return time
  return parsed.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
}

// Sent the moment a guest is chosen for a dinner, alongside the details email.
// Keeps the essentials (date, time, place) in the text and points them to email
// for everything else (confirm link, seat prompts, address details).
export function buildChosenMessage(guest: Guest, event: EventInfo) {
  const firstName = guest.name?.split(" ")[0] || "there"
  const timeStr = formatTime(event.time)
  const dateStr = formatDate(event.date)
  const where = event.restaurant || "your dinner"
  return `Hi ${firstName}! Great news from Vibe & Connect — you've got a seat at our Dinner with Strangers on ${dateStr} at ${timeStr}, at ${where}. Check your email for full details and to confirm your spot. This number is not monitored, so please do not reply.`
}

export async function sendChosenSms(guest: Guest, event: EventInfo) {
  if (!client || !fromNumber) {
    return { ok: false, error: "Twilio is not configured (set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER)." }
  }
  const to = normalizePhone(guest.phone)
  if (!to) {
    return { ok: false, error: `${guest.name || "Guest"} has no valid mobile number.` }
  }
  try {
    await client.messages.create({
      from: fromNumber,
      to,
      body: buildChosenMessage(guest, event),
    })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to send text." }
  }
}

export function buildReminderMessage(guest: Guest, event: EventInfo) {
  const firstName = guest.name?.split(" ")[0] || "there"
  const timeStr = formatTime(event.time)
  const dateStr = formatDate(event.date)
  const where = event.restaurant || "your dinner"
  const address = event.address ? ` (${event.address})` : ""
  return `Hi ${firstName}! Reminder from Vibe & Connect: your Dinner with Strangers is today, ${dateStr} at ${timeStr}, at ${where}${address}. We can't wait to see you there! This number is not monitored, so please do not reply. Need to cancel? Use the link in your confirmation email.`
}

// Short text sent the moment a guest confirms, alongside the email receipt.
// Keeps the SMS brief and points them to their inbox for the full details.
export function buildConfirmationMessage(guest: Guest, event: EventInfo) {
  const firstName = guest.name?.split(" ")[0] || "there"
  const venue = event.restaurant ? ` at ${event.restaurant}` : ""
  const dateStr = event.date ? ` on ${formatDate(event.date)}` : ""
  return `Hi ${firstName}! You're confirmed for your Vibe & Connect Dinner with Strangers${venue}${dateStr}. Check your email for the full details, venue info, and conversation starters. This number is not monitored, so please do not reply.`
}

export async function sendConfirmationSms(guest: Guest, event: EventInfo) {
  if (!client || !fromNumber) {
    return { ok: false, error: "Twilio is not configured (set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER)." }
  }
  const to = normalizePhone(guest.phone)
  if (!to) {
    return { ok: false, error: `${guest.name || "Guest"} has no valid mobile number.` }
  }
  try {
    await client.messages.create({
      from: fromNumber,
      to,
      body: buildConfirmationMessage(guest, event),
    })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to send text." }
  }
}

export async function sendReminderSms(guest: Guest, event: EventInfo) {
  if (!client || !fromNumber) {
    return { ok: false, error: "Twilio is not configured (set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER)." }
  }
  const to = normalizePhone(guest.phone)
  if (!to) {
    return { ok: false, error: `${guest.name || "Guest"} has no valid mobile number.` }
  }
  try {
    await client.messages.create({
      from: fromNumber,
      to,
      body: buildReminderMessage(guest, event),
    })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to send text." }
  }
}
