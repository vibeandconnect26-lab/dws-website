"use client"

import { useState } from "react"
import Image from "next/image"
import { type EventInfo, type Guest } from "@/lib/questions"
import { verifyAdmin } from "@/app/actions/event"
import { Questionnaire } from "@/components/questionnaire"
import { EventPicker } from "@/components/event-picker"
import { AdminDashboard } from "@/components/admin-dashboard"
import { cn } from "@/lib/utils"
import { Lock } from "lucide-react"

type View = "form" | "admin"

export type GuestsByEvent = Record<
  number,
  { guests: Guest[]; confirmedGuests: Guest[]; cancelledGuests: Guest[] }
>

type Counts = Record<number, { pending: number; confirmed: number; cancelled: number }>

export function AppShell({
  events,
  openEvents,
  counts,
  guestsByEvent,
}: {
  events: EventInfo[]
  openEvents: EventInfo[]
  counts: Counts
  guestsByEvent: GuestsByEvent
}) {
  const [view, setView] = useState<View>("form")
  const [adminUnlocked, setAdminUnlocked] = useState(false)
  const [showPinModal, setShowPinModal] = useState(false)
  const [pinInput, setPinInput] = useState("")
  const [pinError, setPinError] = useState(false)
  const [checking, setChecking] = useState(false)

  // The event the public guest is signing up for. Auto-select when only one is open.
  const [selectedEvent, setSelectedEvent] = useState<EventInfo | null>(
    openEvents.length === 1 ? openEvents[0] : null,
  )

  const totalPending = Object.values(counts).reduce((sum, c) => sum + c.pending, 0)

  const handleAdminClick = () => {
    if (adminUnlocked) {
      setView("admin")
      return
    }
    setPinInput("")
    setPinError(false)
    setShowPinModal(true)
  }

  const handlePinSubmit = async () => {
    setChecking(true)
    const { ok } = await verifyAdmin(pinInput)
    setChecking(false)
    if (ok) {
      setAdminUnlocked(true)
      setShowPinModal(false)
      setView("admin")
    } else {
      setPinError(true)
      setPinInput("")
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex flex-col items-center justify-between gap-4 border-b border-border bg-secondary px-6 py-4 sm:flex-row sm:px-8">
        <Image
          src="/vibe-connect-logo.png"
          alt="Vibe & Connect"
          width={56}
          height={56}
          className="h-14 w-14 object-contain"
          priority
        />
        <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
          <button
            onClick={() => setView("form")}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              view === "form" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            Guest Form
          </button>
          <button
            onClick={handleAdminClick}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              view === "admin" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {!adminUnlocked && <Lock className="size-3.5" aria-hidden="true" />}
            {adminUnlocked ? `Admin (${totalPending})` : "Admin"}
          </button>
        </div>
      </header>

      {view === "form" ? (
        selectedEvent ? (
          <Questionnaire
            eventInfo={selectedEvent}
            onChangeEvent={openEvents.length > 1 ? () => setSelectedEvent(null) : undefined}
          />
        ) : (
          <EventPicker events={openEvents} onSelect={(e) => setSelectedEvent(e)} />
        )
      ) : (
        <AdminDashboard events={events} counts={counts} guestsByEvent={guestsByEvent} />
      )}

      {showPinModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-primary/55 px-4"
          role="dialog"
          aria-modal="true"
          aria-label="Admin access"
        >
          <div className="w-full max-w-sm rounded-2xl bg-card p-9 shadow-2xl">
            <div className="mb-6 text-center">
              <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-secondary">
                <Lock className="size-5 text-[var(--gold-dark)]" aria-hidden="true" />
              </div>
              <h2 className="mb-1.5 font-serif text-2xl text-foreground">Admin Access</h2>
              <p className="text-sm text-muted-foreground">Enter your password to continue</p>
            </div>
            <input
              type="password"
              placeholder="Password"
              value={pinInput}
              autoFocus
              onChange={(e) => {
                setPinInput(e.target.value)
                setPinError(false)
              }}
              onKeyDown={(e) => e.key === "Enter" && handlePinSubmit()}
              className={cn(
                "w-full rounded-xl border-[1.5px] border-input bg-card px-4 py-3 text-[15px] outline-none transition-colors focus:border-[var(--gold)]",
                pinError ? "mb-2" : "mb-4",
              )}
            />
            {pinError && <p className="mb-3 text-[13px] text-destructive">Incorrect password. Try again.</p>}
            <button
              onClick={handlePinSubmit}
              disabled={checking}
              className="w-full rounded-xl bg-primary px-4 py-3 text-base font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {checking ? "Checking..." : "Unlock Admin →"}
            </button>
            <button
              onClick={() => setShowPinModal(false)}
              className="mt-2.5 w-full py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
