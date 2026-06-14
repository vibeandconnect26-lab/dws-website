"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { type EventInfo, type Guest } from "@/lib/questions"
import { cancelByToken, resendReceiptByToken } from "@/app/actions/event"
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

type Status = "processing" | "cancelled" | "error"

export function CancelView({
  guest,
  eventInfo,
  token,
}: {
  guest: Guest
  eventInfo: EventInfo
  token: string
}) {
  // Clicking "Cancel my spot" in the email lands the guest straight here, and
  // we release their seat automatically so they immediately see a cancellation
  // confirmation page — no extra button to press.
  const initial: Status = guest.cancelled ? "cancelled" : "processing"
  const [status, setStatus] = useState<Status>(initial)
  const [resending, setResending] = useState(false)
  const [resendMsg, setResendMsg] = useState<string | null>(null)
  const ran = useRef(false)

  useEffect(() => {
    if (initial !== "processing" || ran.current) return
    ran.current = true
    cancelByToken(token).then((res) => {
      setStatus(res.ok ? "cancelled" : "error")
    })
  }, [initial, token])

  // Lets the guest request another copy of their cancellation email from this
  // page, in case the automatic one never arrived.
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

  const when = [formatDate(eventInfo.date), formatTime(eventInfo.time)].filter(Boolean).join(" at ")
  const firstName = guest.name?.split(" ")[0] || "friend"

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-center border-b border-border bg-secondary px-6 py-4">
        <Image
          src="/vibe-connect-logo.png"
          alt="Vibe & Connect"
          width={220}
          height={56}
          className="h-14 w-auto object-contain"
          style={{ width: "auto", height: "3.5rem" }}
          priority
        />
      </header>

      <main className="mx-auto flex max-w-lg flex-col items-center px-6 py-16">
        {status === "processing" ? (
          <div className="w-full rounded-2xl border border-border bg-card px-8 py-10 text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-secondary">
              <Loader2 className="size-7 animate-spin text-[var(--gold-dark)]" aria-hidden="true" />
            </div>
            <h1 className="mb-2 font-serif text-2xl text-foreground">Cancelling your spot…</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              One moment, {firstName} — we&apos;re releasing your seat.
            </p>
          </div>
        ) : status === "cancelled" ? (
          <div className="w-full rounded-2xl border border-border bg-card px-8 py-10 text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-secondary">
              <CheckCircle2 className="size-7 text-[var(--gold-dark)]" aria-hidden="true" />
            </div>
            <h1 className="mb-2 font-serif text-2xl text-foreground">Your spot has been cancelled</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Thanks for letting us know, {firstName}. We&apos;ve released your reservation
              {eventInfo.restaurant ? ` at ${eventInfo.restaurant}` : ""}
              {when ? ` on ${when}` : ""} and can now offer your seat to someone else. We hope to see you at a
              future dinner.
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
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-secondary">
              <XCircle className="size-7 text-[var(--gold-dark)]" aria-hidden="true" />
            </div>
            <h1 className="mb-2 font-serif text-2xl text-foreground">Something went wrong</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              We couldn&apos;t cancel your spot just now. Please refresh the page to try again, or contact the host
              and we&apos;ll sort it out.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
