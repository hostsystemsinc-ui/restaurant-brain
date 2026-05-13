import { NextRequest, NextResponse } from "next/server"

const API          = "https://restaurant-brain-production.up.railway.app"
const OWNER_SECRET = process.env.OWNER_SECRET || ""

// ── GET /api/client/terms-status?restaurantId=xxx ────────────────────────────
// Returns the terms version this restaurant has accepted (from server-side
// guest_config), so devices that cleared localStorage or are brand-new don't
// re-prompt a restaurant that already signed.
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || ""
  if (!restaurantId) {
    return NextResponse.json({ error: "restaurantId required" }, { status: 400 })
  }

  try {
    const res = await fetch(
      `${API}/owner/clients/${encodeURIComponent(restaurantId)}/config?secret=${encodeURIComponent(OWNER_SECRET)}`,
      { cache: "no-store" }
    )
    if (!res.ok) {
      return NextResponse.json({ acceptedVersion: null }, { status: 200 })
    }
    const config    = await res.json()
    const gc        = (config.guest_config || {}) as Record<string, unknown>
    const accepted  = typeof gc.termsAcceptedVersion === "string" ? gc.termsAcceptedVersion : null
    return NextResponse.json({ acceptedVersion: accepted })
  } catch {
    return NextResponse.json({ acceptedVersion: null }, { status: 200 })
  }
}
