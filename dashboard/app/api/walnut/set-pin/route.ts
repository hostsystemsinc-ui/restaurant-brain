import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { readSettings, writeSettings } from "@/lib/walnut-settings"

const RAILWAY_API = "https://restaurant-brain-production.up.railway.app"
// Both Walnut locations share the same admin PIN
const WALNUT_RIDS = [
  "0001cafe-0001-4000-8000-000000000001", // Original
  "0002cafe-0001-4000-8000-000000000002", // Southside
]

/**
 * POST /api/walnut/set-pin — changes the admin PIN.
 * Requires walnut_admin_pin_ok cookie (verified PIN session).
 * Body: { pin: string }  (must be exactly 4 digits)
 * Writes to both the local settings file AND the Railway client_credentials table
 * so the owner console always reflects the current PIN.
 */
export async function POST(req: Request) {
  const cookieStore = await cookies()
  const pinOk = cookieStore.get("walnut_admin_pin_ok")
  if (!pinOk?.value) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 })
  }

  try {
    const { pin } = await req.json()
    if (!pin || typeof pin !== "string" || !/^\d{4}$/.test(pin)) {
      return NextResponse.json({ error: "PIN must be exactly 4 digits" }, { status: 400 })
    }

    // 1. Write to local settings file (fast, always works)
    const settings = readSettings()
    settings.pin = pin
    writeSettings(settings)

    // 2. Write to Railway client_credentials table for both locations
    const ownerSecret = process.env.OWNER_PASS || ""
    if (ownerSecret) {
      await Promise.allSettled(WALNUT_RIDS.map(async (rid) => {
        try {
          // Find existing admin_pin credential
          const listRes = await fetch(
            `${RAILWAY_API}/owner/clients/${rid}/credentials?secret=${encodeURIComponent(ownerSecret)}`,
            { cache: "no-store" }
          )
          if (!listRes.ok) return

          const listData = await listRes.json() as { credentials?: Array<{ id: string; credential_type: string }> }
          const existing = listData.credentials?.find(c => c.credential_type === "admin_pin")

          if (existing) {
            // PATCH the existing credential
            await fetch(
              `${RAILWAY_API}/owner/clients/${rid}/credentials/${existing.id}?secret=${encodeURIComponent(ownerSecret)}`,
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ credential_type: "admin_pin", label: "Admin PIN", value: pin }),
              }
            )
          } else {
            // Create new credential
            await fetch(
              `${RAILWAY_API}/owner/clients/${rid}/credentials?secret=${encodeURIComponent(ownerSecret)}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ credential_type: "admin_pin", label: "Admin PIN", value: pin }),
              }
            )
          }
        } catch {
          // Non-critical — local file already updated
        }
      }))
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 })
  }
}
