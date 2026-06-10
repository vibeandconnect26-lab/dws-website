"use client"

import { useState } from "react"
import { questions, MAX_TOPICS, type EventInfo } from "@/lib/questions"
import { submitGuest } from "@/app/actions/event"
import { cn } from "@/lib/utils"
import { CheckCircle2 } from "lucide-react"

function formatDate(date: string) {
  if (!date) return ""
  return new Date(date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  })
}

function formatTime(time: string) {
  if (!time) return ""
  return new Date("1970-01-01T" + time).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })
}

type Answers = Record<string, string | string[]>

export function Questionnaire({ eventInfo }: { eventInfo: EventInfo }) {
  const [answers, setAnswers] = useState<Answers>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [pending, setPending] = useState(false)

  const set = (id: string, val: string | string[]) => setAnswers((a) => ({ ...a, [id]: val }))

  const toggleChip = (id: string, val: string, max: number) => {
    const cur = (answers[id] as string[]) || []
    if (cur.includes(val)) set(id, cur.filter((v) => v !== val))
    else if (cur.length < max) set(id, [...cur, val])
  }

  const validate = () => {
    const e: Record<string, string> = {}
    questions.forEach((q) => {
      if (q.type === "multi") {
        if (!answers[q.id] || (answers[q.id] as string[]).length === 0) e[q.id] = "Pick at least one"
      } else if (!answers[q.id] || !answers[q.id].toString().trim()) {
        e[q.id] = "Required"
      }
    })
    return e
  }

  const handleSubmit = async () => {
    const e = validate()
    if (Object.keys(e).length) {
      setErrors(e)
      return
    }
    setErrors({})
    setPending(true)
    try {
      await submitGuest({
        name: (answers.name as string) ?? "",
        email: (answers.email as string) ?? "",
        age_range: (answers.age_range as string) ?? "",
        neighborhood: (answers.neighborhood as string) ?? "",
        motivation: (answers.motivation as string) ?? "",
        talk_about: (answers.talk_about as string[]) ?? [],
        skip_topics: (answers.skip_topics as string[]) ?? [],
        energy: (answers.energy as string) ?? "",
        surprise: (answers.surprise as string) ?? "",
        hope: (answers.hope as string) ?? "",
      })
      setSubmitted(true)
    } catch {
      setErrors({ form: "Something went wrong. Please try again." })
    } finally {
      setPending(false)
    }
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <div className="rounded-2xl border border-border bg-card px-6 py-12 text-center">
          <CheckCircle2 className="mx-auto mb-4 size-12 text-[var(--success)]" aria-hidden="true" />
          <h2 className="mb-2 font-serif text-3xl text-primary">{"You're on the list."}</h2>
          <p className="leading-relaxed text-muted-foreground">
            {"We'll review your answers and place you at the perfect table."}
            <br />
            Expect a confirmation from Vibe &amp; Connect closer to the event.
          </p>
        </div>
      </div>
    )
  }

  const hasEvent = Boolean(eventInfo.restaurant)

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-12 text-center">
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-[var(--gold-dark)]">
          Columbia, SC · Dinner with Strangers
        </p>
        <h1 className="mb-4 font-serif text-4xl leading-tight text-foreground text-balance sm:text-5xl">
          Tell us a little
          <br />
          <em className="text-[var(--gold-dark)]">about you.</em>
        </h1>
        <p className="mx-auto max-w-md leading-relaxed text-muted-foreground text-pretty">
          We use your answers to place you at a table with people {"you'll"} actually click with. No algorithms — just
          thoughtful curation.
        </p>
      </div>

      {hasEvent && (
        <div className="mb-8 flex flex-wrap justify-center gap-8 rounded-xl border border-border bg-card px-6 py-5">
          <EventFact label="Venue" value={eventInfo.restaurant} sub={eventInfo.address} />
          {eventInfo.date && <EventFact label="Date" value={formatDate(eventInfo.date)} />}
          {eventInfo.time && <EventFact label="Time" value={formatTime(eventInfo.time)} />}
          {eventInfo.dressCode && <EventFact label="Dress Code" value={eventInfo.dressCode} />}
        </div>
      )}

      <div className="flex flex-col gap-7">
        {questions.map((q) => (
          <div key={q.id}>
            <label htmlFor={q.id} className="mb-2.5 block text-sm font-semibold text-foreground">
              {q.label}
            </label>

            {q.type === "text" && (
              <input
                id={q.id}
                className="w-full rounded-xl border-[1.5px] border-input bg-card px-4 py-3 text-[15px] outline-none transition-colors placeholder:text-muted-foreground focus:border-[var(--gold)]"
                placeholder={q.placeholder}
                value={(answers[q.id] as string) || ""}
                onChange={(e) => set(q.id, e.target.value)}
              />
            )}

            {q.type === "select" && (
              <select
                id={q.id}
                className="w-full cursor-pointer appearance-none rounded-xl border-[1.5px] border-input bg-card px-4 py-3 text-[15px] outline-none transition-colors focus:border-[var(--gold)]"
                value={(answers[q.id] as string) || ""}
                onChange={(e) => set(q.id, e.target.value)}
              >
                <option value="">Select one...</option>
                {q.options?.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            )}

            {q.type === "multi" && (
              <div className="flex flex-wrap gap-2.5">
                {q.options?.map((o) => {
                  const selected = ((answers[q.id] as string[]) || []).includes(o)
                  return (
                    <button
                      key={o}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleChip(q.id, o, MAX_TOPICS)}
                      className={cn(
                        "rounded-full border-[1.5px] px-3.5 py-2 text-[13px] font-medium transition-all",
                        selected
                          ? "border-[var(--gold)] bg-[var(--gold)]/12 text-[var(--gold-dark)]"
                          : "border-input bg-transparent text-muted-foreground hover:border-[var(--gold)]/60",
                      )}
                    >
                      {o}
                    </button>
                  )
                })}
              </div>
            )}

            {errors[q.id] && <p className="mt-2 text-[13px] text-destructive">{errors[q.id]}</p>}
          </div>
        ))}

        {errors.form && <p className="text-[13px] text-destructive">{errors.form}</p>}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={pending}
          className="mt-1 w-full rounded-xl bg-primary px-4 py-4 text-base font-semibold tracking-wide text-primary-foreground transition-all hover:-translate-y-0.5 hover:opacity-90 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Saving..." : "Save my seat →"}
        </button>
      </div>
    </div>
  )
}

function EventFact({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="text-center">
      <div className="mb-1 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <div className="text-[15px] font-semibold text-foreground">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  )
}
