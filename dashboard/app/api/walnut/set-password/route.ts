import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { readSettings, writeSettings } from "@/lib/walnut-settings"

const ALLOWED_ACCOUNTS = ["original", "southside", "walnut"] as const
type AllowedAccount = typeof ALLOWED_ACCOUNTS[number]

const RAILWAY_API = "https://restaurant-brain-production.up.railway.app"

// Maps account name → the restaurant(s) and credential label to update in client_credentials
const ACCOUNT_TARGETS: Record<AllowedAccount, Array<{ rid: string; label: string; username: string }>> = {
  original:  [{ rid: "0001cafe-0001-4000-8000-000000000001", label: "Station Login (Original)",  username: "original"  }],
  southside: [{ rid: "0002cafe-0001-4000-8000-000000000002", label: "Station Login (Southside)", username: "southside" }],
  walnut:    [
    { rid: "0001cafe-0001-4000-8000-000000000001", label: "Dashboard Login (Walnut)", username: "walnut" },
    { rid: "0002cafe-0001-4000-8000-000000000002", label: "Dashboard Login (Walnut)", username: "walnut" },
  ],
}

/**
 * POST /api/walnut/set-password — changes the login password for a restaurant account.
 * Requires walnut_admin_pin_ok cookie (verified PIN session).
 * Body: { account: "original" | "southside" | "walnut", password: string }
 *
 * Writes to BOTH:
 *  1. Local walnut-settings.json (immediate, for this server process)
 *  2. Railway client_credentials table (persistent, shown in owner console)
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

    const trimmed = password.trim()

    // 1. Write to local settings file (fast, always works)
    const settings = readSettings()
    settings.credentials[account as AllowedAccount] = trimmed
    writeSettings(settings)

    // 2. Sync to Railway client_credentials for each target restaurant
    const ownerSecret = process.env.OWNER_PASS || ""
    if (ownerSecret) {
      const targets = ACCOUNT_TARGETS[account as AllowedAccount]
      await Promise.allSettled(targets.map(async ({ rid, label, username }) => {
        try {
          const value = `${username} / ${trimmed}`
          const notes = `Username: ${username}  |  Password: ${trimmed}`

          // List existing credentials to find the matching one
          const listRes = await fetch(
            `${RAILWAY_API}/owner/clients/${rid}/credentials?secret=${encodeURIComponent(ownerSecret)}`,
            { cache: "no-store" }
          )
          if (!listRes.ok) return

          const listData = await listRes.json() as { credentials?: Array<{ id: string; label: string; credential_type: string }> }
          const existing = listData.credentials?.find(c => c.label === label && c.credential_type === "login")

          if (existing) {
            // PATCH the existing credential
            await fetch(
              `${RAILWAY_API}/owner/clients/${rid}/credentials/${existing.id}?secret=${encodeURIComponent(ownerSecret)}`,
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ credential_type: "login", label, value, notes }),
              }
            )
          } else {
            // Create new credential
            await fetch(
              `${RAILWAY_API}/owner/clients/${rid}/credentials?secret=${encodeURIComponent(ownerSecret)}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ credential_type: "login", label, value, notes }),
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
