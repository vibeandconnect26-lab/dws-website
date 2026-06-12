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
function heuristicGroupings(guests: Guest[], tableSize: number): TableGroup[] {
  const tablesNeeded = Math.max(1, Math.floor(guests.length / tableSize))

  // Sort by energy so a round-robin spread mixes introverts/extroverts evenly.
  const ordered = guests
    .map((g, i) => ({ g, num: i + 1 }))
    .sort((a, b) => energyRank(b.g.energy) - energyRank(a.g.energy))

  // Only seat full tables of exactly tableSize; leftovers stay unseated.
  const seatable = ordered.slice(0, tablesNeeded * tableSize)
  const buckets: { g: Guest; num: number }[][] = Array.from({ length: tablesNeeded }, () => [])
  seatable.forEach((entry, idx) => {
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
  const { guests, tableSize: rawSize } = (await req.json()) as { guests: Guest[]; tableSize?: number }

  if (!guests || guests.length < 2) {
    return Response.json({ error: "Need at least 2 guests." }, { status: 400 })
  }

  const tableSize = rawSize && rawSize > 0 ? Math.floor(rawSize) : 7

  if (guests.length < tableSize) {
    return Response.json(
      {
        error: `You need at least ${tableSize} guest${tableSize === 1 ? "" : "s"} (your table size) to form a table. You currently have ${guests.length}.`,
      },
      { status: 400 },
    )
  }

  const tablesNeeded = Math.floor(guests.length / tableSize)
  const seatedCount = tablesNeeded * tableSize

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

  const prompt = `You are helping Vibe and Connect, a community social events company in Columbia, SC, group dinner guests into tables for a "Dinner with Strangers" event.

Guests:
${guestSummaries}

Create exactly ${tablesNeeded} table${tablesNeeded > 1 ? "s" : ""}, and each table MUST have exactly ${tableSize} guests (no more, no fewer). That means you will seat exactly ${seatedCount} of the ${guests.length} guests; if there are leftover guests who don't fill a complete table of ${tableSize}, simply leave them unassigned (do not include them in any table). Mix ages, neighborhoods, and energy types. Align each table around shared interests. Avoid pairing guests where one wants to skip a topic the other loves. Each seated guest must appear in exactly one table, and no guest number may be repeated across tables.`

  try {
    const { object } = await generateObject({
      model: "anthropic/claude-sonnet-4.5",
      schema: tableSchema,
      prompt,
    })
    return Response.json({ ...object, source: "ai", tableSize })
  } catch (err) {
    console.log("[v0] AI gateway unavailable, using heuristic fallback:", err)
    const tables = heuristicGroupings(guests, tableSize)
    return Response.json({ tables, source: "heuristic", tableSize })
  }
}
