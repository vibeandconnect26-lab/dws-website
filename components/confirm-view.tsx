"use client"

import { useState } from "react"
import Image from "next/image"
import { type EventInfo, type Guest } from "@/lib/questions"
import { confirmByToken, cancelByToken, resendReceiptByToken } from "@/app/actions/event"
import { CheckCircle2, Loader2, Mail, XCircle } from "lucide-react"

function formatDate(date: string) {
  if (!date) return ""
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
  if (!time) return ""
  const parsed = new Date("1970-01-01T" + time)
  if (isNaN(parsed.getTime())) return time
  return parsed.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
}

type Status = "pending" | "confirmed" | "cancelled" | "already-cancelled"

export function ConfirmView({
  guest,
  eventInfo,
  token,
}: {
  guest: Guest
  eventInfo: EventInfo
  token: string
}) {
  const initial: Status = guest.cancelled
    ? "already-cancelled"
    : guest.confirmed
      ? "confirmed"
      : "pending"
  const [status, setStatus] = useState<Status>(initial)
  const [loading, setLoading] = useState<"confirm" | "cancel" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [resending, setResending] = useState(false)
  const [resendMsg, setResendMsg] = useState<string | null>(null)

  // Lets the guest request another copy of their confirmation/cancellation
  // email straight from this page, in case the automatic one never arrived.
  const handleResend = async () => {
    setResending(true)
    setResendMsg(null)
    const res = await resendReceiptByToken(token)
    setResending(false)
    if (res.ok) {
      setResendMsg("Sent! Check your inbox in a minute (and your spam folder, just in case).")
    } else {
      setResendMsg(res.error || "We couldn't resend the email. Please contact the host.")
    }
  }

  const handleConfirm = async () => {
    setLoading("confirm")
    setError(null)
    const res = await confirmByToken(token)
    setLoading(null)
    if (res.cancelled) {
      setStatus("already-cancelled")
    } else if (res.ok) {
      setStatus("confirmed")
    } else {
      setError("Something went wrong. Please try again or contact the host.")
    }
  }

  const handleCancel = async () => {
    setLoading("cancel")
    setError(null)
    const res = await cancelByToken(token)
    setLoading(null)
    if (res.ok) {
      setStatus("cancelled")
    } else {
      setError("Something went wrong. Please try again or contact the host.")
    }
  }

  const when = [formatDate(eventInfo.date), formatTime(eventInfo.time)].filter(Boolean).join(" at ")
  const firstName = guest.name?.split(" ")[0] || "friend"

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-center border-b border-border bg-secondary px-6 py-4">
        <Image
          src="/vibe-connect-logo.png"
          alt="Vibe & Connect"
          width={56}
          height={56}
          className="h-14 w-14 object-contain"
          priority
        />
      </header>

      <main className="mx-auto flex max-w-lg flex-col items-center px-6 py-16">
        {status === "confirmed" ? (
          <div className="w-full rounded-2xl border border-border bg-card px-8 py-10 text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-secondary">
              <CheckCircle2 className="size-7 text-[var(--gold-dark)]" aria-hidden="true" />
            </div>
            <h1 className="mb-2 font-serif text-2xl text-foreground">You&apos;re all set, {firstName}!</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Your seat is confirmed{eventInfo.restaurant ? ` at ${eventInfo.restaurant}` : ""}
              {when ? ` on ${when}` : ""}. We can&apos;t wait to see you there. Check your email for the full
              details.
            </p>
            <div className="mt-6 border-t border-border pt-5">
              <button
                onClick={handleResend}
                disabled={resending}
                className="inline-flex items-center justify-center gap-2 rounded-xl border-[1.5px] border-input bg-card px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-[var(--gold)] disabled:opacity-50"
              >
                {resending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Mail className="size-4" aria-hidden="true" />
                )}
                {resending ? "Sending..." : "Resend confirmation email"}
              </button>
              {resendMsg && <p className="mt-3 text-[13px] text-muted-foreground">{resendMsg}</p>}
            </div>
          </div>
        ) : status === "cancelled" ? (
          <div className="w-full rounded-2xl border border-border bg-card px-8 py-10 text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-secondary">
              <XCircle className="size-7 text-[var(--gold-dark)]" aria-hidden="true" />
            </div>
            <h1 className="mb-2 font-serif text-2xl text-foreground">Your spot has been released</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Thanks for letting us know, {firstName}. We&apos;ve cancelled your reservation and can now offer your
              seat to someone else. We hope to see you at a future dinner.
            </p>
            <div className="mt-6 border-t border-border pt-5">
              <button
                onClick={handleResend}
                disabled={resending}
                className="inline-flex items-center justify-center gap-2 rounded-xl border-[1.5px] border-input bg-card px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-[var(--gold)] disabled:opacity-50"
              >
                {resending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Mail className="size-4" aria-hidden="true" />
                )}
                {resending ? "Sending..." : "Resend cancellation email"}
              </button>
              {resendMsg && <p className="mt-3 text-[13px] text-muted-foreground">{resendMsg}</p>}
            </div>
          </div>
        ) : status === "already-cancelled" ? (
          <div className="w-full rounded-2xl border border-border bg-card px-8 py-10 text-center">
            <h1 className="mb-2 font-serif text-2xl text-foreground">This reservation was cancelled</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              It looks like this spot has already been cancelled. If this was a mistake, please contact the host to
              get back on the list.
            </p>
            <div className="mt-6 border-t border-border pt-5">
              <button
                onClick={handleResend}
                disabled={resending}
                className="inline-flex items-center justify-center gap-2 rounded-xl border-[1.5px] border-input bg-card px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-[var(--gold)] disabled:opacity-50"
              >
                {resending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Mail className="size-4" aria-hidden="true" />
                )}
                {resending ? "Sending..." : "Resend cancellation email"}
              </button>
              {resendMsg && <p className="mt-3 text-[13px] text-muted-foreground">{resendMsg}</p>}
            </div>
          </div>
        ) : (
          <div className="w-full rounded-2xl border border-border bg-card px-8 py-10 text-center">
            <h1 className="mb-2 font-serif text-2xl text-foreground">Can you make it, {firstName}?</h1>
            <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
              You&apos;ve been seated for the dinner
              {eventInfo.restaurant ? ` at ${eventInfo.restaurant}` : ""}
              {when ? ` on ${when}` : ""}. Please confirm your spot so we know to expect you, or cancel so we can
              offer it to someone else.
            </p>

            {error && <p className="mb-4 text-[13px] text-destructive">{error}</p>}

            <div className="flex flex-col gap-3">
              <button
                onClick={handleConfirm}
                disabled={loading !== null}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-base font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {loading === "confirm" && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                {loading === "confirm" ? "Confirming..." : "Yes, confirm my spot"}
              </button>
              <button
                onClick={handleCancel}
                disabled={loading !== null}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-input bg-card px-6 py-3 text-base font-semibold text-foreground transition-colors hover:border-[var(--gold)] disabled:opacity-50"
              >
                {loading === "cancel" && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                {loading === "cancel" ? "Cancelling..." : "I can't make it — cancel"}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
