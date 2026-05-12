import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"

const API           = "https://restaurant-brain-production.up.railway.app"
const OWNER_SECRET  = process.env.OWNER_SECRET || ""

// ── POST /api/client/terms-accept ────────────────────────────────────────────
// Called from the station page when a client accepts updated terms.
// Reads the current config for the slug, merges the acceptance fields,
// and PATCHes it back — so acceptance survives restarts/redeploys.
//
// Body: { slug: string, version: string }
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { slug?: string; version?: string }
    if (!body.slug || !body.version) {
      return NextResponse.json({ error: "slug and version required" }, { status: 400 })
    }

    const hdrs = await headers()
    const ip   = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim()
               ?? hdrs.get("x-real-ip")
               ?? "unknown"

    const { slug, version } = body

    // ── 1. GET current config (public endpoint, no auth needed) ──────────────
    const configRes = await fetch(
      `${API}/client/${encodeURIComponent(slug)}/config`,
      { cache: "no-store" }
    )
    if (!configRes.ok) {
      return NextResponse.json({ error: "Could not load client config" }, { status: 502 })
    }
    const config    = await configRes.json()
    const restaurantId: string = config.restaurant_id || ""
    if (!restaurantId) {
      return NextResponse.json({ error: "Could not determine restaurant ID" }, { status: 502 })
    }

    // ── 2. Merge acceptance fields into guest_config ──────────────────────────
    const existingGc: Record<string, unknown> = config.guest_config || {}
    const updatedGc = {
      ...existingGc,
      termsAcceptedVersion: version,
      termsAcceptedAt:      new Date().toISOString(),
      termsAcceptedIp:      ip,
    }

    // ── 3. PATCH back — preserves all other config fields ────────────────────
    const patchRes = await fetch(
      `${API}/owner/clients/${restaurantId}/config?secret=${encodeURIComponent(OWNER_SECRET)}`,
      {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ guest_config: updatedGc }),
      }
    )

    if (!patchRes.ok) {
      const err = await patchRes.json().catch(() => ({}))
      console.error("[terms-accept] PATCH failed:", err)
      return NextResponse.json({ error: "Failed to record acceptance" }, { status: 502 })
    }

    return NextResponse.json({
      ok:          true,
      slug,
      version,
      acceptedAt:  updatedGc.termsAcceptedAt,
      ip,
    })

  } catch (e) {
    console.error("[terms-accept] Error:", e)
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 })
  }
}
