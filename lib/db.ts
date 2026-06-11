import { neon, type NeonQueryFunction } from "@neondatabase/serverless"

let _sql: NeonQueryFunction<false, false> | null = null

function getSql(): NeonQueryFunction<false, false> {
  if (_sql) return _sql

  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error("DATABASE_URL is not set")
  }

  _sql = neon(url)
  return _sql
}

// Lazy proxy: the real Neon client is only created on first query, so importing
// this module during the build's page-data collection never throws.
export const sql = ((...args: Parameters<NeonQueryFunction<false, false>>) => {
  // @ts-expect-error - forwarding tagged-template / query args to the Neon client
  return getSql()(...args)
}) as NeonQueryFunction<false, false>
