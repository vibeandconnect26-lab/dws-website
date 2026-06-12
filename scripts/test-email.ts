import { sendDinnerDetails } from "../lib/email"
import type { EventInfo, Guest } from "../lib/questions"

const testGuest = {
  id: "test",
  name: "Shanika (Test)",
  email: "shanika0215@yahoo.com",
  cancel_token: "00000000-0000-0000-0000-000000000000",
} as unknown as Guest

const testEvent = {
  restaurant: "Sample Bistro",
  address: "123 Main St, Columbia, SC 29201",
  date: "2026-07-18",
  time: "19:00",
  dressCode: "Smart casual",
  notes: "This is a TEST email to verify delivery. Please ignore.",
} as unknown as EventInfo

async function main() {
  const result = await sendDinnerDetails(testGuest, testEvent)
  console.log("[v0] send result:", JSON.stringify(result))
  if (!result.ok) process.exit(1)
}

main()
