import { NextResponse } from "next/server"
import { getAdminPin } from "@/lib/walnut-settings"

const COOKIE_NAME   = "walnut_admin_pin_ok"
const RAILWAY_API   = "https://restaurant-brain-production.up.railway.app"
const WALNUT_RID    = "0001cafe-0001-4000-8000-000000000001" // Original — canonical PIN source

/**
 * POST /api/walnut/verify-pin — verifies 4-digit admin PIN.
 * Body: { pin: string }
 * Checks Railway client_credentials first (so owner-console PIN changes are live),
 * then falls back to local settings file / env var.
 */
export async function POST(req: Request) {
  try {
    const { pin } = await req.json()
    if (!pin || typeof pin !== "string") {
      return NextResponse.json({ ok: false, error: "Missing PIN" }, { status: 400 })
    }

    // Try to get the live PIN from Railway client_credentials
    let expected = getAdminPin() // local file / env var fallback
    const ownerSecret = process.env.OWNER_PASS || ""
    if (ownerSecret) {
      try {
        const credRes = await fetch(
          `${RAILWAY_API}/owner/clients/${WALNUT_RID}/credentials?secret=${encodeURIComponent(ownerSecret)}`,
          { cache: "no-store" }
        )
        if (credRes.ok) {
          const credData = await credRes.json() as { credentials?: Array<{ credential_type: string; value: string }> }
          const adminPinCred = credData.credentials?.find(c => c.credential_type === "admin_pin")
          if (adminPinCred?.value) expected = adminPinCred.value
        }
      } catch {
        // Network error — use local fallback
      }
    }

    if (pin !== expected) {
      await new Promise(r => setTimeout(r, 400)) // timing-safe delay
      return NextResponse.json({ ok: false, error: "Incorrect PIN" }, { status: 401 })
    }

    const res = NextResponse.json({ ok: true })
    res.cookies.set(COOKIE_NAME, "1", {
      httpOnly: true,
      sameSite: "lax",
      path:     "/",
      // intentionally no maxAge so it's a session cookie
    })
    return res
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 })
  }
}
