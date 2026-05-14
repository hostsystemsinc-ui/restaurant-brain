/**
 * /client/[slug]/station  →  redirect to /station
 *
 * The unified /station page now handles ALL restaurants:
 *   - Reads the session cookie via /api/client/me
 *   - Looks up the restaurant ID (Railway or hardcoded config)
 *   - Shows the full HOST interface — floor plan, queue, tables, history, analog
 *
 * Data isolation is guaranteed by the session cookie:
 *   each restaurant's cookie maps to its unique restaurant_id,
 *   so every API call is scoped to that restaurant only.
 *
 * This page is intentionally kept as a server component so the redirect
 * is instant (no flash of the old simplified UI).
 */
import { redirect } from "next/navigation"

export default function ClientStationRedirect() {
  redirect("/station")
}
