import { NextResponse } from "next/server"
import { getAdminPin } from "@/lib/walnut-settings"

const COOKIE_NAME   = "walnut_admin_pin_ok"
const RAILWAY_API   = "https://restaurant-brain-production.up.railway.app"
const WALNUT_RID    = "0001cafe-0001-4000-8000-000000000001" // Original — canonical PIN source
// Both locations share the same admin PIN
const WALNUT_RIDS   = [
  "0001cafe-0001-4000-8000-000000000001",
  "0002cafe-0001-4000-8000-000000000002",
]

/**
 * POST /api/walnut/verify-pin — verifies 4-digit admin PIN.
 * Body: { pin: string }
 *
 * Checks Railway client_credentials first (so owner-console PIN changes are live),
 * then falls back to local settings file / env var.
 *
 * On successful login: syncs the verified PIN back to client_credentials for both
 * locations so the owner console always reflects the current PIN.
 */
export async function POST(req: Request) {
  try {
    const { pin } = await req.json()
    if (!pin || typeof pin !== "string") {
      return NextResponse.json({ ok: false, error: "Missing PIN" }, { status: 400 })
    }

    const ownerSecret = process.env.OWNER_PASS || ""

    // Try to get the live PIN from Railway client_credentials
    let expected = getAdminPin() // local file / env var fallback
    let dbHasPin = false
    if (ownerSecret) {
      try {
        const credRes = await fetch(
          `${RAILWAY_API}/owner/clients/${WALNUT_RID}/credentials?secret=${encodeURIComponent(ownerSecret)}`,
          { cache: "no-store" }
        )
        if (credRes.ok) {
          const credData = await credRes.json() as { credentials?: Array<{ id: string; credential_type: string; value: string }> }
          const adminPinCred = credData.credentials?.find(c => c.credential_type === "admin_pin")
          if (adminPinCred?.value) {
            expected = adminPinCred.value
            dbHasPin = true
          }
        }
      } catch {
        // Network error — use local fallback
      }
    }

    if (pin !== expected) {
      await new Promise(r => setTimeout(r, 400)) // timing-safe delay
      return NextResponse.json({ ok: false, error: "Incorrect PIN" }, { status: 401 })
    }

    // ── Successful login: sync PIN to DB if it was from local file ──────────────
    // This ensures that PINs changed via the logins page (before the DB-sync fix)
    // get written to the DB on first successful use, keeping owner console in sync.
    if (ownerSecret && !dbHasPin) {
      // Fire-and-forget — don't block the response
      Promise.allSettled(WALNUT_RIDS.map(async (rid) => {
        try {
          const listRes = await fetch(
            `${RAILWAY_API}/owner/clients/${rid}/credentials?secret=${encodeURIComponent(ownerSecret)}`,
            { cache: "no-store" }
          )
          if (!listRes.ok) return
          const listData = await listRes.json() as { credentials?: Array<{ id: string; credential_type: string }> }
          const existing = listData.credentials?.find(c => c.credential_type === "admin_pin")
          if (existing) {
            await fetch(
              `${RAILWAY_API}/owner/clients/${rid}/credentials/${existing.id}?secret=${encodeURIComponent(ownerSecret)}`,
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ credential_type: "admin_pin", label: "Admin PIN", value: pin }),
              }
            )
          } else {
            await fetch(
              `${RAILWAY_API}/owner/clients/${rid}/credentials?secret=${encodeURIComponent(ownerSecret)}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ credential_type: "admin_pin", label: "Admin PIN", value: pin }),
              }
            )
          }
        } catch { /* non-critical */ }
      }))
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
