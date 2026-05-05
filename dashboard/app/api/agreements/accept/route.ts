import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"

const API = "https://restaurant-brain-production.up.railway.app"

// ── POST /api/agreements/accept ────────────────────────────────────────────────
// Proxies a signed agreement to the FastAPI backend, which persists it to Supabase.
// The backend endpoint POST /agreements/accept handles DB insertion and email.
//
// The Next.js layer adds server-side metadata (IP, user-agent) that the client
// cannot forge, then forwards the full payload to the backend.
// ──────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // ── Validate required fields ─────────────────────────────────────────────
    const required = [
      "business_name", "signer_name", "signer_email",
      "address", "location_count", "plan_type", "monthly_fee", "agreement_version",
    ]
    for (const field of required) {
      if (body[field] === undefined || body[field] === null || body[field] === "") {
        return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 })
      }
    }

    // ── Gather server-side metadata (cannot be spoofed by client) ────────────
    const hdrs      = await headers()
    const ip        = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim()
                      ?? hdrs.get("x-real-ip")
                      ?? "unknown"
    const userAgent = hdrs.get("user-agent") ?? "unknown"

    // ── Forward to FastAPI backend ────────────────────────────────────────────
    const backendRes = await fetch(`${API}/agreements/accept`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...body,
        ip_address: ip,
        user_agent: userAgent,
      }),
    })

    if (!backendRes.ok) {
      const err = await backendRes.json().catch(() => ({}))
      console.error("[agreements/accept] Backend error:", err)
      return NextResponse.json(
        { error: err.detail ?? "Failed to record agreement. Please try again." },
        { status: backendRes.status }
      )
    }

    const data = await backendRes.json()
    return NextResponse.json(data)

  } catch (e: unknown) {
    console.error("[agreements/accept] Unexpected error:", e)
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 })
  }
}
