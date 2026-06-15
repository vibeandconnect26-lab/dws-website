"use client"

import { useState } from "react"
import { type PoolContact } from "@/lib/questions"
import { deletePoolContact } from "@/app/actions/pool"
import { Mail, MessageSquare, ChevronDown, Trash2, Loader2, Users } from "lucide-react"
import { cn } from "@/lib/utils"

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-medium text-[var(--gold-dark)]">
      {children}
    </span>
  )
}

const DETAIL_FIELDS: { key: keyof PoolContact; label: string }[] = [
  { key: "motivation", label: "Why they're coming" },
  { key: "skip_topics", label: "Topics to skip" },
  { key: "energy", label: "Energy" },
  { key: "surprise", label: "Something surprising" },
  { key: "hope", label: "What they hope for" },
]

export function PoolTab({
  contacts,
  onDelete,
}: {
  contacts: PoolContact[]
  onDelete: (id: number) => void
}) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const handleDelete = async (c: PoolContact) => {
    if (!confirm(`Remove ${c.name} from the contact pool?`)) return
    setDeletingId(c.id)
    await deletePoolContact(c.id)
    setDeletingId(null)
    onDelete(c.id)
  }

  if (contacts.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card px-6 py-12 text-center text-muted-foreground">
        <Users className="mx-auto mb-3 size-8 text-muted-foreground/50" aria-hidden="true" />
        Your contact pool is empty. Use the save icon on any guest to add them here, then import them into future
        dinners.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="mb-2 text-sm text-muted-foreground">
        {contacts.length} saved contact{contacts.length === 1 ? "" : "s"}. Import them into any dinner from that
        dinner&apos;s guest screen — importing moves a contact out of this pool.
      </p>
      {contacts.map((c) => (
        <div key={c.id} className="flex items-start justify-between gap-4 rounded-xl border border-border bg-card px-6 py-5">
          <div className="min-w-0 flex-1">
            <span className="text-base font-semibold text-foreground">{c.name}</span>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
              {c.email && (
                <span className="flex items-center gap-1.5">
                  <Mail className="size-3.5" aria-hidden="true" />
                  <a href={`mailto:${c.email}`} className="hover:text-foreground hover:underline">
                    {c.email}
                  </a>
                </span>
              )}
              {c.phone && (
                <span className="flex items-center gap-1.5">
                  <MessageSquare className="size-3.5" aria-hidden="true" />
                  <a href={`tel:${c.phone}`} className="hover:text-foreground hover:underline">
                    {c.phone}
                  </a>
                </span>
              )}
            </div>
            {[c.age_range, c.neighborhood, c.energy?.split("—")[0].trim()].filter(Boolean).length > 0 && (
              <div className="mt-1 text-[13px] text-muted-foreground">
                {[c.age_range, c.neighborhood, c.energy?.split("—")[0].trim()].filter(Boolean).join(" · ")}
              </div>
            )}
            {(c.talk_about || []).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(c.talk_about || []).map((t) => (
                  <Tag key={t}>{t}</Tag>
                ))}
              </div>
            )}
            <button
              onClick={() => setExpanded((prev) => ({ ...prev, [c.id]: !prev[c.id] }))}
              aria-expanded={Boolean(expanded[c.id])}
              className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-[var(--gold-dark)] underline-offset-2 hover:underline"
            >
              <ChevronDown
                className={cn("size-3.5 transition-transform", expanded[c.id] && "rotate-180")}
                aria-hidden="true"
              />
              {expanded[c.id] ? "Hide full answers" : "View full answers"}
            </button>
            {expanded[c.id] && (
              <dl className="mt-3 grid gap-x-6 gap-y-3 border-t border-border pt-3 sm:grid-cols-2">
                {DETAIL_FIELDS.map((f) => {
                  const value = c[f.key]
                  const display = Array.isArray(value) ? value.join(", ") : value ? String(value) : null
                  return (
                    <div key={String(f.key)}>
                      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        {f.label}
                      </dt>
                      <dd className="mt-0.5 text-[13px] text-foreground">
                        {display || <span className="text-muted-foreground">—</span>}
                      </dd>
                    </div>
                  )
                })}
              </dl>
            )}
          </div>
          <button
            onClick={() => handleDelete(c)}
            disabled={deletingId === c.id}
            title={`Remove ${c.name} from the pool`}
            aria-label={`Remove ${c.name} from the pool`}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-destructive/70 px-3 py-1.5 text-[13px] text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
          >
            {deletingId === c.id ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Trash2 className="size-3.5" aria-hidden="true" />
            )}
          </button>
        </div>
      ))}
    </div>
  )
}
