"use client"

import { useState } from "react"
import { type EventInfo, type EventDraft, emptyEventDraft } from "@/lib/questions"

export function EventEditor({
  initial,
  saving,
  onSave,
  onCancel,
}: {
  // When editing, pass the existing event; when creating, omit it.
  initial?: EventInfo
  saving?: boolean
  onSave: (draft: EventDraft) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState<EventDraft>(
    initial
      ? {
          restaurant: initial.restaurant,
          address: initial.address,
          date: initial.date,
          time: initial.time,
          maxGuests: initial.maxGuests,
          dressCode: initial.dressCode,
          notes: initial.notes,
          isOpen: initial.isOpen,
        }
      : emptyEventDraft,
  )

  return (
    <div className="mt-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Restaurant / Venue" placeholder="e.g. The Oak Table" value={draft.restaurant} onChange={(v) => setDraft((d) => ({ ...d, restaurant: v }))} />
        <Field label="Address" placeholder="Full address" value={draft.address} onChange={(v) => setDraft((d) => ({ ...d, address: v }))} />
        <Field label="Date" type="date" value={draft.date} onChange={(v) => setDraft((d) => ({ ...d, date: v }))} />
        <Field label="Time" type="time" value={draft.time} onChange={(v) => setDraft((d) => ({ ...d, time: v }))} />
        <Field label="Table Size (guests per table)" type="number" placeholder="e.g. 7" value={draft.maxGuests} onChange={(v) => setDraft((d) => ({ ...d, maxGuests: v }))} />
        <Field label="Dress Code (optional)" placeholder="e.g. Smart casual" value={draft.dressCode} onChange={(v) => setDraft((d) => ({ ...d, dressCode: v }))} />
      </div>
      <div className="mt-4">
        <Field label="Additional Notes (optional)" placeholder="Parking info, what to bring, etc." value={draft.notes} onChange={(v) => setDraft((d) => ({ ...d, notes: v }))} />
      </div>
      <label className="mt-4 flex cursor-pointer items-center gap-2.5">
        <input
          type="checkbox"
          checked={draft.isOpen}
          onChange={(e) => setDraft((d) => ({ ...d, isOpen: e.target.checked }))}
          className="size-4 accent-[var(--gold-dark)]"
        />
        <span className="text-[13px] font-medium text-foreground">Open for signups (guests can choose this dinner)</span>
      </label>
      <div className="mt-5 flex gap-2.5">
        <button
          onClick={() => onSave(draft)}
          disabled={saving}
          className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving..." : initial ? "Save Changes" : "Create Event"}
        </button>
        <button
          onClick={onCancel}
          className="rounded-xl border-[1.5px] border-input bg-card px-5 py-2.5 text-sm font-medium transition-colors hover:border-[var(--gold)]"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <div>
      <label className="mb-2 block text-[13px] font-semibold text-foreground">{label}</label>
      <input
        type={type}
        min={type === "number" ? 1 : undefined}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border-[1.5px] border-input bg-card px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-[var(--gold)]"
      />
    </div>
  )
}
