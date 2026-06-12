import { Resend } from "resend"
import type { EventInfo, Guest } from "@/lib/questions"

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

// Default to Resend's onboarding sender so it works before a custom domain is verified.
const FROM = process.env.EMAIL_FROM || "Vibe & Connect <onboarding@resend.dev>"

function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, "")
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return "http://localhost:3000"
}

function formatDate(date: string) {
  if (!date) return "TBA"
  const parsed = new Date(date + "T12:00:00")
  if (isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

function formatTime(time: string) {
  if (!time) return "TBA"
  const parsed = new Date("1970-01-01T" + time)
  if (isNaN(parsed.getTime())) return time
  return parsed.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
}

function buildHtml(guest: Guest, event: EventInfo) {
  const cancelUrl = `${getBaseUrl()}/cancel/${guest.cancel_token}`
  const dateStr = formatDate(event.date)
  const timeStr = formatTime(event.time)
  const mapsUrl = event.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address)}`
    : null

  return `
  <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 560px; margin: 0 auto; background: #faf7f2; padding: 32px; border-radius: 16px; color: #2c2418;">
    <h1 style="font-size: 24px; margin: 0 0 4px;">You're confirmed, ${guest.name?.split(" ")[0] || "friend"}!</h1>
    <p style="font-size: 15px; color: #6b6253; margin: 0 0 24px;">Here are the details for your upcoming dinner.</p>

    <div style="background: #ffffff; border: 1px solid #e8e1d4; border-radius: 12px; padding: 24px; margin-bottom: 20px;">
      <table style="width: 100%; border-collapse: collapse; font-family: Helvetica, Arial, sans-serif;">
        <tr><td style="padding: 8px 0; color: #9b9280; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Venue</td></tr>
        <tr><td style="padding: 0 0 16px; font-size: 17px; font-weight: 600;">${event.restaurant || "TBA"}</td></tr>
        ${
          event.address
            ? `<tr><td style="padding: 0 0 16px; font-size: 14px; color: #6b6253;">${event.address}${mapsUrl ? ` &middot; <a href="${mapsUrl}" style="color: #b08d3a;">View map</a>` : ""}</td></tr>`
            : ""
        }
        <tr><td style="padding: 8px 0; color: #9b9280; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Date &amp; Time</td></tr>
        <tr><td style="padding: 0 0 16px; font-size: 16px; font-weight: 600;">${dateStr} at ${timeStr}</td></tr>
        ${
          event.dressCode
            ? `<tr><td style="padding: 8px 0; color: #9b9280; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Dress Code</td></tr><tr><td style="padding: 0 0 16px; font-size: 15px;">${event.dressCode}</td></tr>`
            : ""
        }
        ${
          event.notes
            ? `<tr><td style="padding: 8px 0; color: #9b9280; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Notes</td></tr><tr><td style="padding: 0; font-size: 15px; color: #6b6253;">${event.notes}</td></tr>`
            : ""
        }
      </table>
    </div>

    <div style="background: #fff; border: 1px solid #e8e1d4; border-radius: 12px; padding: 20px; text-align: center; font-family: Helvetica, Arial, sans-serif;">
      <p style="font-size: 14px; color: #6b6253; margin: 0 0 12px;">Can't make it anymore? Please let us know so we can offer your seat to someone else.</p>
      <a href="${cancelUrl}" style="display: inline-block; padding: 10px 24px; background: #2c2418; color: #fff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600;">Cancel my spot</a>
    </div>

    <p style="font-size: 12px; color: #9b9280; text-align: center; margin: 24px 0 0; font-family: Helvetica, Arial, sans-serif;">Vibe &amp; Connect &middot; Columbia, SC</p>
  </div>`
}

export async function sendDinnerDetails(guest: Guest, event: EventInfo) {
  if (!resend) {
    return { ok: false, error: "RESEND_API_KEY is not configured." as string }
  }
  if (!guest.email) {
    return { ok: false, error: "Guest has no email address." }
  }
  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: guest.email,
      subject: `Your dinner details${event.restaurant ? ` — ${event.restaurant}` : ""}`,
      html: buildHtml(guest, event),
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to send email." }
  }
}
