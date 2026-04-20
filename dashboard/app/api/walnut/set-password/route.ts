import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { readSettings, writeSettings } from "@/lib/walnut-settings"

const ALLOWED_ACCOUNTS = ["original", "southside", "walnut"] as const
type AllowedAccount = typeof ALLOWED_ACCOUNTS[number]

/**
 * POST /api/walnut/set-password — changes the login password for a restaurant account.
 * Requires walnut_admin_pin_ok cookie (verified PIN session).
 * Body: { account: "original" | "southside" | "walnut", password: string }
 * The updated password overrides the env var for that account on this server process.
 * Note: resets to env-var value on fresh deployment.
 */
export async function POST(req: Request) {
  const cookieStore = await cookies()
  const pinOk = cookieStore.get("walnut_admin_pin_ok")
  if (!pinOk?.value) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 })
  }

  try {
    const { account, password } = await req.json()
    if (
      !account || !ALLOWED_ACCOUNTS.includes(account as AllowedAccount) ||
      !password || typeof password !== "string" || password.trim().length < 3
    ) {
      return NextResponse.json({ error: "Invalid account or password (min 3 chars)" }, { status: 400 })
    }

    const settings = readSettings()
    settings.credentials[account as AllowedAccount] = password.trim()
    writeSettings(settings)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 })
  }
}
