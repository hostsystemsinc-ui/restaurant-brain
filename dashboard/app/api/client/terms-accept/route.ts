import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"

const API           = "https://restaurant-brain-production.up.railway.app"
const OWNER_SECRET  = process.env.OWNER_SECRET || ""

// ── POST /api/client/terms-accept ────────────────────────────────────────────
// Called from any station page when a client accepts updated terms.
//
// Accepts two calling conventions:
//
//   A) Slug-based (demo station, walters303):
//      { slug: string, version: string }
//      → fetches /client/{slug}/config to get restaurantId + businessName
//
//   B) Direct (walnut station, any page that already has restaurantId):
//      { restaurantId: string, businessName: string, version: string }
//      → no config fetch needed; uses provided values directly
//
// Then:
//  1. POSTs a permanent agreement record to Railway /agreements/accept
//     so the acceptance appears in the owner console Signed Agreements tab.
//  2. Best-effort PATCHes guest_config with acceptance metadata.
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      slug?:         string
      restaurantId?: string
      businessName?: string
      version?:      string
    }

    if (!body.version) {
      return NextResponse.json({ error: "version required" }, { status: 400 })
    }

    const hdrs      = await headers()
    const ip        = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim()
                    ?? hdrs.get("x-real-ip")
                    ?? "unknown"
    const userAgent = hdrs.get("user-agent") ?? "unknown"
    const version   = body.version

    let restaurantId: string
    let businessName: string
    let planType = "active"

    // ── Path A: slug provided — look up config from Railway ──────────────────
    if (body.slug) {
      const configRes = await fetch(
        `${API}/client/${encodeURIComponent(body.slug)}/config`,
        { cache: "no-store" }
      )
      if (!configRes.ok) {
        return NextResponse.json({ error: "Could not load client config" }, { status: 502 })
      }
      const config = await configRes.json()
      restaurantId = String(config.restaurant_id || "")
      const gc     = (config.guest_config || {}) as Record<string, unknown>
      businessName = String(gc.restaurantName || config.name || body.slug)
      planType     = String(config.plan_type || "active")

      if (!restaurantId) {
        return NextResponse.json({ error: "Could not determine restaurant ID" }, { status: 502 })
      }
    }
    // ── Path B: restaurantId + businessName provided directly ─────────────────
    else if (body.restaurantId && body.businessName) {
      restaurantId = body.restaurantId
      businessName = body.businessName
    }
    else {
      return NextResponse.json(
        { error: "Provide either slug or restaurantId+businessName" },
        { status: 400 }
      )
    }

    // ── 1. Create a permanent agreement record in Railway ────────────────────
    // Stored in Supabase — survives server restarts, visible in owner console.
    const agreementRes = await fetch(`${API}/agreements/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        business_name:     businessName,
        signer_name:       "HOST Station",
        signer_title:      "Terms Re-Acceptance via Station Device",
        signer_email:      `station+${restaurantId}@hostplatform.net`,
        address:           "Digital acceptance via HOST Station device",
        location_count:    1,
        plan_type:         planType,
        monthly_fee:       0,
        agreement_version: version,
        ip_address:        ip,
        user_agent:        userAgent,
      }),
    })

    if (!agreementRes.ok) {
      console.warn("[terms-accept] Agreement record creation failed:", await agreementRes.text().catch(() => ""))
      // Non-fatal — localStorage on the device is still the primary acceptance record
    }

    // ── 2. Best-effort PATCH guest_config ────────────────────────────────────
    // Railway may drop unknown fields; this is a best-effort server-side log.
    await fetch(
      `${API}/owner/clients/${restaurantId}/config?secret=${encodeURIComponent(OWNER_SECRET)}`,
      {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          guest_config: {
            termsAcceptedVersion: version,
            termsAcceptedAt:      new Date().toISOString(),
            termsAcceptedIp:      ip,
          },
        }),
      }
    ).catch(() => {/* non-critical */})

    return NextResponse.json({
      ok:         true,
      restaurantId,
      version,
      acceptedAt: new Date().toISOString(),
      ip,
    })

  } catch (e) {
    console.error("[terms-accept] Error:", e)
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 })
  }
}
