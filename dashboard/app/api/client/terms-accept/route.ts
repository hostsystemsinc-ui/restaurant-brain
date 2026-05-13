import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"

const API           = "https://restaurant-brain-production.up.railway.app"
const OWNER_SECRET  = process.env.OWNER_SECRET || ""

// ── POST /api/client/terms-accept ────────────────────────────────────────────
// Called from the station page when a client accepts updated terms.
//
// Does two things:
//  1. POSTs a permanent agreement record to the Railway /agreements/accept
//     endpoint so it shows up in the owner console Signed Agreements tab.
//  2. Best-effort PATCHes guest_config with acceptance metadata (Railway may
//     silently drop unknown fields, but we try anyway for the server log).
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
    const userAgent = hdrs.get("user-agent") ?? "unknown"

    const { slug, version } = body

    // ── 1. GET current config (public endpoint, no auth needed) ──────────────
    const configRes = await fetch(
      `${API}/client/${encodeURIComponent(slug)}/config`,
      { cache: "no-store" }
    )
    if (!configRes.ok) {
      return NextResponse.json({ error: "Could not load client config" }, { status: 502 })
    }
    const config         = await configRes.json()
    const restaurantId   = String(config.restaurant_id || "")
    const gc             = (config.guest_config || {}) as Record<string, unknown>
    const businessName   = String(gc.restaurantName || config.name || slug)
    const planType       = String(config.plan_type || "active")

    if (!restaurantId) {
      return NextResponse.json({ error: "Could not determine restaurant ID" }, { status: 502 })
    }

    // ── 2. Create a permanent agreement record in Railway ────────────────────
    // This makes the acceptance visible in the owner console Signed Agreements
    // tab immediately and persists it to Supabase across server restarts.
    // The station doesn't collect signer name/email, so we use clear placeholders.
    const agreementRes = await fetch(`${API}/agreements/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        business_name:     businessName,
        signer_name:       "HOST Station",
        signer_title:      "Terms Re-Acceptance via Station Device",
        signer_email:      `station+${slug}@hostplatform.net`,
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
      // Non-fatal — continue; localStorage on the device is still the primary record
    }

    // ── 3. Best-effort PATCH guest_config (Railway may drop unknown fields) ──
    const updatedGc = {
      ...gc,
      termsAcceptedVersion: version,
      termsAcceptedAt:      new Date().toISOString(),
      termsAcceptedIp:      ip,
    }
    await fetch(
      `${API}/owner/clients/${restaurantId}/config?secret=${encodeURIComponent(OWNER_SECRET)}`,
      {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ guest_config: updatedGc }),
      }
    ).catch(() => {/* non-critical */})

    return NextResponse.json({
      ok:         true,
      slug,
      version,
      acceptedAt: new Date().toISOString(),
      ip,
    })

  } catch (e) {
    console.error("[terms-accept] Error:", e)
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 })
  }
}
