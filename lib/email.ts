import { Resend } from "resend"
import type { EventInfo, Guest } from "@/lib/questions"

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

// The verified sending domain in Resend for this project.
const DEFAULT_FROM = "Vibe & Connect <dinners@aseatatthetable.city>"

// Free mailbox providers can never be used as a sender — Resend rejects them.
// If EMAIL_FROM is misconfigured (e.g. a gmail address), ignore it and use the verified domain.
function resolveFrom() {
  const configured = process.env.EMAIL_FROM?.trim()
  if (!configured) return DEFAULT_FROM
  const freeProviders = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com", "aol.com"]
  const lower = configured.toLowerCase()
  if (freeProviders.some((p) => lower.includes(p))) return DEFAULT_FROM
  return configured
}

const FROM = resolveFrom()

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

// A pool of optional conversation starters. Each guest at a table gets a
// different trio dealt from this pool, so no two seatmates open with the same
// questions. Keep at least 3 * (max table size) prompts for full uniqueness.
const ICEBREAKER_POOL = [
  "What's something you've changed your mind about in the last year?",
  "What's a small thing that reliably makes your day better?",
  "If you had a completely free weekend, no plans at all, how would you spend it?",
  "What's the best meal you've had in Columbia — and where?",
  "What's something you're looking forward to in the next few months?",
  "What's a hobby or skill you'd love to pick up if time weren't an issue?",
  "What's the last thing that genuinely surprised you?",
  "Who's someone (famous or not) you'd love to share a meal with?",
  "What's a place you've traveled to that stuck with you, and why?",
  "What's a book, show, or song you can't stop recommending?",
  "What did you want to be when you were a kid?",
  "What's a tiny, oddly specific thing you're a little bit obsessed with?",
  "What's the best piece of advice you've ever actually used?",
  "What's something on your bucket list that might surprise people?",
  "If you could instantly master one skill, what would it be?",
  "What's a moment recently when you felt really proud of yourself?",
  "What's your go-to way to unwind after a long week?",
  "What's something you believe everyone should try at least once?",
]

// Deal `count` distinct prompts for the guest at `index` within their table.
// We offset by index * count so seatmates never receive the same set.
function promptsForGuest(index: number, count = 3): string[] {
  const pool = ICEBREAKER_POOL
  const out: string[] = []
  for (let i = 0; i < count; i++) {
    out.push(pool[(index * count + i) % pool.length])
  }
  return out
}

function buildPromptsSection(prompts: string[]) {
  if (!prompts || prompts.length === 0) return ""
  const items = prompts
    .map(
      (p) =>
        `<li style="margin: 0 0 10px; padding-left: 4px; font-size: 15px; line-height: 1.5; color: #2c2418;">${p}</li>`,
    )
    .join("")
  return `
    <div style="background: #fff; border: 1px solid #e8e1d4; border-radius: 12px; padding: 24px; margin-bottom: 20px; font-family: Helvetica, Arial, sans-serif;">
      <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #b08d3a; margin: 0 0 6px; font-weight: 700;">Conversation starters</p>
      <p style="font-size: 13px; color: #6b6253; margin: 0 0 16px; line-height: 1.5;">Totally optional — but if you'd like a little help breaking the ice, here are three questions just for you. Yours are different from your tablemates', so swap and compare!</p>
      <ol style="margin: 0; padding: 0 0 0 20px;">${items}</ol>
    </div>`
}

function buildHtml(guest: Guest, event: EventInfo, prompts: string[] = []) {
  const cancelUrl = `${getBaseUrl()}/cancel/${guest.cancel_token}`
  const confirmUrl = `${getBaseUrl()}/confirm/${guest.cancel_token}`
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

    ${buildPromptsSection(prompts)}

    <div style="background: #fff; border: 1px solid #e8e1d4; border-radius: 12px; padding: 24px; text-align: center; font-family: Helvetica, Arial, sans-serif;">
      <p style="font-size: 15px; color: #2c2418; margin: 0 0 16px; font-weight: 600;">Please let us know if you can make it.</p>
      <p style="font-size: 13px; color: #6b6253; margin: 0 0 16px;">Confirming locks in your seat. If you can't make it, cancel so we can offer your spot to someone else.</p>
      <a href="${confirmUrl}" style="display: inline-block; padding: 12px 28px; background: #2c2418; color: #fff; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 600; margin: 0 6px 10px;">Confirm my spot</a>
      <a href="${cancelUrl}" style="display: inline-block; padding: 12px 28px; background: #faf7f2; color: #2c2418; text-decoration: none; border: 1px solid #d8cfbf; border-radius: 8px; font-size: 15px; font-weight: 600; margin: 0 6px 10px;">Cancel my spot</a>
    </div>

    <p style="font-size: 12px; color: #9b9280; text-align: center; margin: 24px 0 0; font-family: Helvetica, Arial, sans-serif;">Vibe &amp; Connect &middot; Columbia, SC</p>
  </div>`
}

function buildFeedbackHtml(guest: Guest, event: EventInfo) {
  const firstName = guest.name?.split(" ")[0] || "friend"
  const venue = event.restaurant ? ` at ${event.restaurant}` : ""
  const feedbackBase = `${getBaseUrl()}/feedback/${guest.cancel_token}`

  // Five gold stars, each linking to the feedback page with a pre-selected rating.
  const stars = [1, 2, 3, 4, 5]
    .map(
      (n) =>
        `<a href="${feedbackBase}?rating=${n}" style="text-decoration: none; font-size: 40px; line-height: 1; color: #d4af37; margin: 0 3px; font-family: Arial, sans-serif;" aria-label="${n} star${n === 1 ? "" : "s"}">&#9733;</a>`,
    )
    .join("")

  return `
  <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 560px; margin: 0 auto; background: #faf7f2; padding: 32px; border-radius: 16px; color: #2c2418;">
    <h1 style="font-size: 24px; margin: 0 0 4px;">How was your dinner, ${firstName}?</h1>
    <p style="font-size: 15px; color: #6b6253; margin: 0 0 24px; line-height: 1.5;">Thanks for joining us${venue} last night. We'd love to hear how it went — your feedback helps us craft even better tables.</p>

    <div style="background: #ffffff; border: 1px solid #e8e1d4; border-radius: 12px; padding: 28px 24px; margin-bottom: 20px; text-align: center; font-family: Helvetica, Arial, sans-serif;">
      <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #b08d3a; margin: 0 0 14px; font-weight: 700;">Rate your experience</p>
      <div style="margin: 0 0 16px;">${stars}</div>
      <p style="font-size: 13px; color: #6b6253; margin: 0;">Tap a star to leave your rating — you can add a comment on the next screen.</p>
    </div>

    <div style="text-align: center;">
      <a href="${feedbackBase}" style="display: inline-block; padding: 12px 28px; background: #2c2418; color: #fff; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 600; font-family: Helvetica, Arial, sans-serif;">Leave a review</a>
    </div>

    <p style="font-size: 12px; color: #9b9280; text-align: center; margin: 24px 0 0; font-family: Helvetica, Arial, sans-serif;">Vibe &amp; Connect &middot; Columbia, SC</p>
  </div>`
}

export async function sendFeedbackRequest(guest: Guest, event: EventInfo) {
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
      subject: `How was your dinner${event.restaurant ? ` at ${event.restaurant}` : ""}?`,
      html: buildFeedbackHtml(guest, event),
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to send email." }
  }
}

function buildSystemErrorHtml(guest: Guest, event: EventInfo) {
  const firstName = guest.name?.split(" ")[0] || "friend"
  const venue = event.restaurant ? ` for ${event.restaurant}` : ""
  return `
  <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 560px; margin: 0 auto; background: #faf7f2; padding: 32px; border-radius: 16px; color: #2c2418;">
    <h1 style="font-size: 24px; margin: 0 0 4px;">Quick correction, ${firstName}</h1>
    <p style="font-size: 15px; color: #6b6253; margin: 0 0 20px; line-height: 1.6;">A system error caused the dinner details${venue} we just sent you to go out by mistake. Please disregard that previous email — those details were not final.</p>

    <div style="background: #ffffff; border: 1px solid #e8e1d4; border-radius: 12px; padding: 24px; margin-bottom: 20px; font-family: Helvetica, Arial, sans-serif;">
      <p style="font-size: 15px; color: #2c2418; margin: 0 0 12px; line-height: 1.6;">Don&apos;t worry — your spot is safe. You&apos;ve been added back to the guest pool, and we&apos;ll be in touch with your confirmed table and details shortly.</p>
      <p style="font-size: 14px; color: #6b6253; margin: 0; line-height: 1.6;">If someone else cancels, we&apos;ll automatically slot you back in. No action is needed on your end.</p>
    </div>

    <p style="font-size: 14px; color: #6b6253; margin: 0 0 4px; line-height: 1.6;">Thanks so much for your patience — we can&apos;t wait to host you.</p>
    <p style="font-size: 12px; color: #9b9280; text-align: center; margin: 24px 0 0; font-family: Helvetica, Arial, sans-serif;">Vibe &amp; Connect &middot; Columbia, SC</p>
  </div>`
}

export async function sendSystemErrorNotice(guest: Guest, event: EventInfo) {
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
      subject: "Please disregard our previous email",
      html: buildSystemErrorHtml(guest, event),
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to send email." }
  }
}

// Short receipt sent right after a guest confirms from the email/landing page,
// so they have proof in their inbox that their spot is locked in.
function buildConfirmationReceiptHtml(guest: Guest, event: EventInfo) {
  const firstName = guest.name?.split(" ")[0] || "friend"
  const venue = event.restaurant ? ` at ${event.restaurant}` : ""
  const dateLine = event.date ? `${formatDate(event.date)}${event.time ? ` at ${formatTime(event.time)}` : ""}` : ""
  return `
  <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 560px; margin: 0 auto; background: #faf7f2; padding: 32px; border-radius: 16px; color: #2c2418;">
    <h1 style="font-size: 24px; margin: 0 0 4px;">You're confirmed, ${firstName}!</h1>
    <p style="font-size: 15px; color: #6b6253; margin: 0 0 20px; line-height: 1.6;">Thank you for confirming. Your seat${venue}${dateLine ? ` on ${dateLine}` : ""} is locked in, and we can't wait to host you.</p>

    <div style="background: #ffffff; border: 1px solid #e8e1d4; border-radius: 12px; padding: 24px; font-family: Helvetica, Arial, sans-serif;">
      <p style="font-size: 14px; color: #6b6253; margin: 0; line-height: 1.6;">Keep an eye on your inbox for any last details before the dinner. If your plans change, just reply to this email and let us know.</p>
    </div>

    <p style="font-size: 12px; color: #9b9280; text-align: center; margin: 24px 0 0; font-family: Helvetica, Arial, sans-serif;">Vibe &amp; Connect &middot; Columbia, SC</p>
  </div>`
}

export async function sendConfirmationReceipt(guest: Guest, event: EventInfo) {
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
      subject: `You're confirmed${event.restaurant ? ` for ${event.restaurant}` : ""}!`,
      html: buildConfirmationReceiptHtml(guest, event),
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to send email." }
  }
}

// Short receipt sent right after a guest cancels their own spot, so they know
// the cancellation went through.
function buildCancellationReceiptHtml(guest: Guest, event: EventInfo) {
  const firstName = guest.name?.split(" ")[0] || "friend"
  const venue = event.restaurant ? ` at ${event.restaurant}` : ""
  const dateLine = event.date ? `${formatDate(event.date)}${event.time ? ` at ${formatTime(event.time)}` : ""}` : ""
  const upcomingUrl = getBaseUrl()
  return `
  <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 560px; margin: 0 auto; background: #faf7f2; padding: 32px; border-radius: 16px; color: #2c2418;">
    <h1 style="font-size: 24px; margin: 0 0 4px;">Your spot has been released, ${firstName}</h1>
    <p style="font-size: 15px; color: #6b6253; margin: 0 0 20px; line-height: 1.6;">Thanks for letting us know. We've cancelled your reservation${venue}${dateLine ? ` on ${dateLine}` : ""} — there's nothing more you need to do.</p>

    <div style="background: #ffffff; border: 1px solid #e8e1d4; border-radius: 12px; padding: 24px; margin-bottom: 20px; font-family: Helvetica, Arial, sans-serif;">
      <p style="font-size: 14px; color: #6b6253; margin: 0; line-height: 1.6;">We'd still love to share a table with you. Whenever you're ready, you can pick another night that works better.</p>
    </div>

    <div style="text-align: center; margin: 0 0 20px;">
      <a href="${upcomingUrl}" style="display: inline-block; padding: 12px 28px; background: #2c2418; color: #fff; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 600; font-family: Helvetica, Arial, sans-serif;">See upcoming dinners</a>
    </div>

    <p style="font-size: 12px; color: #9b9280; text-align: center; margin: 24px 0 0; font-family: Helvetica, Arial, sans-serif;">Vibe &amp; Connect &middot; Columbia, SC</p>
  </div>`
}

export async function sendCancellationReceipt(guest: Guest, event: EventInfo) {
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
      subject: `Your spot has been cancelled${event.restaurant ? ` — ${event.restaurant}` : ""}`,
      html: buildCancellationReceiptHtml(guest, event),
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to send email." }
  }
}

function buildDinnerCancelledHtml(guest: Guest, event: EventInfo) {
  const firstName = guest.name?.split(" ")[0] || "friend"
  const venue = event.restaurant ? ` at ${event.restaurant}` : ""
  const dateLine = event.date ? `${formatDate(event.date)}${event.time ? ` at ${formatTime(event.time)}` : ""}` : ""
  const upcomingUrl = getBaseUrl()
  return `
  <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 560px; margin: 0 auto; background: #faf7f2; padding: 32px; border-radius: 16px; color: #2c2418;">
    <h1 style="font-size: 24px; margin: 0 0 4px;">A change of plans, ${firstName}</h1>
    <p style="font-size: 15px; color: #6b6253; margin: 0 0 20px; line-height: 1.6;">We're sorry to share that your upcoming dinner${venue}${dateLine ? ` on ${dateLine}` : ""} has been cancelled. We weren't able to confirm enough guests for this table to make it the warm, lively evening we want every dinner to be.</p>

    <div style="background: #ffffff; border: 1px solid #e8e1d4; border-radius: 12px; padding: 24px; margin-bottom: 20px; font-family: Helvetica, Arial, sans-serif;">
      <p style="font-size: 15px; color: #2c2418; margin: 0 0 12px; line-height: 1.6;">There's nothing you need to do — you won't be charged, and there's no need to reply. We'd love to seat you at a future dinner, so you're welcome to pick another night that works for you.</p>
      <p style="font-size: 14px; color: #6b6253; margin: 0; line-height: 1.6;">Thank you for being so flexible. Bringing the right group together sometimes takes a little patience, and we appreciate yours.</p>
    </div>

    <div style="text-align: center; margin: 0 0 20px;">
      <a href="${upcomingUrl}" style="display: inline-block; padding: 12px 28px; background: #2c2418; color: #fff; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 600; font-family: Helvetica, Arial, sans-serif;">See upcoming dinners</a>
    </div>

    <p style="font-size: 14px; color: #6b6253; margin: 0 0 4px; line-height: 1.6;">We truly hope to host you soon.</p>
    <p style="font-size: 12px; color: #9b9280; text-align: center; margin: 24px 0 0; font-family: Helvetica, Arial, sans-serif;">Vibe &amp; Connect &middot; Columbia, SC</p>
  </div>`
}

export async function sendDinnerCancelled(guest: Guest, event: EventInfo) {
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
      subject: `Your dinner${event.restaurant ? ` at ${event.restaurant}` : ""} has been cancelled`,
      html: buildDinnerCancelledHtml(guest, event),
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to send email." }
  }
}

export async function sendDinnerDetails(guest: Guest, event: EventInfo, seatIndex = 0) {
  if (!resend) {
    return { ok: false, error: "RESEND_API_KEY is not configured." as string }
  }
  if (!guest.email) {
    return { ok: false, error: "Guest has no email address." }
  }
  try {
    const prompts = promptsForGuest(seatIndex)
    const { error } = await resend.emails.send({
      from: FROM,
      to: guest.email,
      subject: `Your dinner details${event.restaurant ? ` — ${event.restaurant}` : ""}`,
      html: buildHtml(guest, event, prompts),
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to send email." }
  }
}
