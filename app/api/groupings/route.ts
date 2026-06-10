import { generateObject } from "ai"
import { z } from "zod"
import type { Guest, TableGroup } from "@/lib/questions"

export const maxDuration = 30

const tableSchema = z.object({
  tables: z.array(
    z.object({
      table: z.string().describe('Label like "Table 1"'),
      theme: z.string().describe("A short, one-line vibe for the table"),
      guests: z.array(z.number()).describe("1-based guest numbers seated at this table"),
      why: z.string().describe("One sentence on why this group works"),
    }),
  ),
})

function energyRank(energy: string | null): number {
  if (!energy) return 1
  const e = energy.toLowerCase()
  if (e.startsWith("extrovert")) return 2
  if (e.startsWith("introvert")) return 0
  return 1
}

// Deterministic fallback: balances social energy across tables and themes
// each table around the interest its members most commonly share.
function heuristicGroupings(guests: Guest[]): TableGroup[] {
  const tablesNeeded = Math.ceil(guests.length / 7)

  // Sort by energy so a round-robin spread mixes introverts/extroverts evenly.
  const ordered = guests
    .map((g, i) => ({ g, num: i + 1 }))
    .sort((a, b) => energyRank(b.g.energy) - energyRank(a.g.energy))

  const buckets: { g: Guest; num: number }[][] = Array.from({ length: tablesNeeded }, () => [])
  ordered.forEach((entry, idx) => {
    buckets[idx % tablesNeeded].push(entry)
  })

  return buckets.map((bucket, i) => {
    // Most common shared interest drives the theme.
    const counts = new Map<string, number>()
    bucket.forEach(({ g }) =>
      (g.talk_about || []).forEach((t) => counts.set(t, (counts.get(t) || 0) + 1)),
    )
    const topInterest = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    const neighborhoods = new Set(bucket.map(({ g }) => g.neighborhood).filter(Boolean))

    const theme = topInterest ? `Bonding over ${topInterest.toLowerCase()}` : "A little bit of everything"
    const why = topInterest
      ? `Several guests here love ${topInterest.toLowerCase()}, and the mix spans ${neighborhoods.size} neighborhood${
          neighborhoods.size === 1 ? "" : "s"
        } and a healthy blend of social energies.`
      : `A balanced spread of personalities and backgrounds to spark fresh conversation across ${neighborhoods.size} neighborhood${
          neighborhoods.size === 1 ? "" : "s"
        }.`

    return {
      table: `Table ${i + 1}`,
      theme,
      why,
      guests: bucket.map(({ num }) => num),
    }
  })
}

export async function POST(req: Request) {
  const { guests } = (await req.json()) as { guests: Guest[] }

  if (!guests || guests.length < 2) {
    return Response.json({ error: "Need at least 2 guests." }, { status: 400 })
  }

  const tablesNeeded = Math.ceil(guests.length / 7)

  const guestSummaries = guests
    .map(
      (g, i) =>
        `Guest ${i + 1}: ${g.name}, ${g.age_range}, ${g.neighborhood}. Topics: ${(g.talk_about || []).join(
          ", ",
        )}. Skip: ${(g.skip_topics || []).join(", ")}. Energy: ${
          g.energy?.split("—")[0].trim() ?? ""
        }. Motivation: ${g.motivation}.`,
    )
    .join("\n")

  const prompt = `You are helping Vibe and Connect, a community social events company in Columbia, SC, group dinner guests into tables of 6-8 people for a "Dinner with Strangers" event.

Guests:
${guestSummaries}

Create ${tablesNeeded} balanced table${tablesNeeded > 1 ? "s" : ""}. Mix ages, neighborhoods, and energy types. Align each table around shared interests. Avoid pairing guests where one wants to skip a topic the other loves. Every guest must be assigned to exactly one table.`

  try {
    const { object } = await generateObject({
      model: "anthropic/claude-sonnet-4.5",
      schema: tableSchema,
      prompt,
    })
    return Response.json({ ...object, source: "ai" })
  } catch (err) {
    console.log("[v0] AI gateway unavailable, using heuristic fallback:", err)
    const tables = heuristicGroupings(guests)
    return Response.json({ tables, source: "heuristic" })
  }
}
