"use client"

import { useState } from "react"
import Image from "next/image"
import { type EventInfo, type Guest } from "@/lib/questions"
import { resendReceiptByToken } from "@/app/actions/event"
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

type Status = "confirmed" | "already-cancelled" | "error"

export function ConfirmView({
  guest,
  eventInfo,
  token,
  status,
}: {
  guest: Guest
  eventInfo: EventInfo
  token: string
  status: Status
}) {
  // The confirmation is processed server-side before this page renders, so we
  // simply display the resolved result. No client-side action call is needed,
  // which keeps the flow reliable inside mobile email in-app browsers.
  const [resending, setResending] = useState(false)
  const [resendMsg, setResendMsg] = useState<string | null>(null)

  // Lets the guest request another copy of their confirmation email straight
  // from this page, in case the automatic one never arrived.
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
        {status === "confirmed" ? (
          <div className="w-full rounded-2xl border border-border bg-card px-8 py-10 text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-secondary">
              <CheckCircle2 className="size-7 text-[var(--gold-dark)]" aria-hidden="true" />
            </div>
            <h1 className="mb-2 font-serif text-2xl text-foreground">Thank you for confirming, {firstName}!</h1>
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
        ) : status === "already-cancelled" ? (
          <div className="w-full rounded-2xl border border-border bg-card px-8 py-10 text-center">
            <h1 className="mb-2 font-serif text-2xl text-foreground">This reservation was cancelled</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              It looks like this spot has already been cancelled, so we couldn&apos;t confirm it. If this was a
              mistake, please contact the host to get back on the list.
            </p>
          </div>
        ) : (
          <div className="w-full rounded-2xl border border-border bg-card px-8 py-10 text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-secondary">
              <XCircle className="size-7 text-[var(--gold-dark)]" aria-hidden="true" />
            </div>
            <h1 className="mb-2 font-serif text-2xl text-foreground">Something went wrong</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              We couldn&apos;t confirm your spot just now. Please refresh the page to try again, or contact the
              host and we&apos;ll sort it out.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
