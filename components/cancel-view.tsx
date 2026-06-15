"use client"

import { useState } from "react"
import Image from "next/image"
import { type EventInfo, type Guest } from "@/lib/questions"
import { cancelByToken } from "@/app/actions/event"
import { CheckCircle2, Loader2 } from "lucide-react"

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

export function CancelView({
  guest,
  eventInfo,
  token,
}: {
  guest: Guest
  eventInfo: EventInfo
  token: string
}) {
  const [cancelled, setCancelled] = useState(guest.cancelled)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCancel = async () => {
    setLoading(true)
    setError(null)
    const res = await cancelByToken(token)
    setLoading(false)
    if (res.ok) {
      setCancelled(true)
    } else {
      setError("Something went wrong. Please try again or contact the host.")
    }
  }

  const when = [formatDate(eventInfo.date), formatTime(eventInfo.time)].filter(Boolean).join(" at ")

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
        {cancelled ? (
          <div className="w-full rounded-2xl border border-border bg-card px-8 py-10 text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-secondary">
              <CheckCircle2 className="size-7 text-[var(--gold-dark)]" aria-hidden="true" />
            </div>
            <h1 className="mb-2 font-serif text-2xl text-foreground">Your spot has been released</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Thanks for letting us know, {guest.name?.split(" ")[0] || "friend"}. We&apos;ve cancelled your
              reservation and can now offer your seat to someone else. We hope to see you at a future dinner.
            </p>
          </div>
        ) : (
          <div className="w-full rounded-2xl border border-border bg-card px-8 py-10 text-center">
            <h1 className="mb-2 font-serif text-2xl text-foreground">Cancel your reservation?</h1>
            <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
              Hi {guest.name?.split(" ")[0] || "there"}, you&apos;re currently confirmed for the dinner
              {eventInfo.restaurant ? ` at ${eventInfo.restaurant}` : ""}
              {when ? ` on ${when}` : ""}. If you can no longer make it, release your spot so we can fill it.
            </p>

            {error && <p className="mb-4 text-[13px] text-destructive">{error}</p>}

            <button
              onClick={handleCancel}
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-base font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {loading ? "Cancelling..." : "Yes, cancel my spot"}
            </button>
            <p className="mt-4 text-[13px] text-muted-foreground">
              Changed your mind? You can simply close this page to keep your reservation.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
