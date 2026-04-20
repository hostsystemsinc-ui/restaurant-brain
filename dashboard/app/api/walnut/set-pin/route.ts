import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { readSettings, writeSettings } from "@/lib/walnut-settings"

/**
 * POST /api/walnut/set-pin — changes the admin PIN.
 * Requires walnut_admin_pin_ok cookie (verified PIN session).
 * Body: { pin: string }  (must be exactly 4 digits)
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

    const settings = readSettings()
    settings.pin = pin
    writeSettings(settings)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 })
  }
}
