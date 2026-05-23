import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getCredentialOverride } from "@/lib/walnut-settings"
import { verifyPassword } from "@/lib/password"

const RAILWAY_API   = "https://restaurant-brain-production.up.railway.app"
const OWNER_SECRET  = process.env.OWNER_SECRET || process.env.OWNER_PASS || ""

// Known legacy accounts: maps username → { envKey, redirect, maxAge }
// New clients created via the wizard are authenticated dynamically via Railway.
const ACCOUNTS: Record<string, { envKey: string; redirect: string; maxAge: number }> = {
  walters:   { envKey: "CLIENT_PASS_WALTERS",   redirect: "/station",          maxAge: 60 * 60 * 12          }, // 12h
  demo:      { envKey: "CLIENT_PASS_DEMO",       redirect: "/demo/station",     maxAge: 60 * 60 * 12          }, // 12h
  // Station accounts — 1-year maxAge so tablets never log out unexpectedly
  original:  { envKey: "CLIENT_PASS_ORIGINAL",   redirect: "/walnut-cafe/original",  maxAge: 60 * 60 * 24 * 365 }, // 1 year
  southside: { envKey: "CLIENT_PASS_SOUTHSIDE",  redirect: "/walnut-cafe/southside", maxAge: 60 * 60 * 24 * 365 }, // 1 year
  walnut:    { envKey: "CLIENT_PASS_WALNUT",     redirect: "/walnut/dashboard", maxAge: 60 * 60 * 12          }, // 12h
}

const COOKIE_NAME = "host_client_session"
const COOKIE_BASE = {
  httpOnly: true,
  sameSite: "lax" as const,
  path:     "/",
}

// ── Dynamic Railway auth ──────────────────────────────────────────────────────
// For new clients created via the owner wizard, credentials are stored in Railway.
// Login username = restaurant slug. Password = the "login" credential value
// (stored as "username:password" by the wizard — we verify the password part).
async function tryRailwayAuth(slug: string, password: string): Promise<string | null> {
  if (!OWNER_SECRET) return null
  try {
    // 1. Fetch public restaurant config by slug — no auth required
    const configRes = await fetch(
      `${RAILWAY_API}/client/${encodeURIComponent(slug)}/config`,
      { cache: "no-store" }
    )
    if (!configRes.ok) return null
    const config = await configRes.json()
    const restaurantId: string = config.restaurant_id || ""
    if (!restaurantId) return null

    // 2. Fetch credentials for this restaurant (owner-only endpoint)
    const credsRes = await fetch(
      `${RAILWAY_API}/owner/clients/${encodeURIComponent(restaurantId)}/credentials?secret=${encodeURIComponent(OWNER_SECRET)}`,
      { cache: "no-store" }
    )
    if (!credsRes.ok) return null
    const data = await credsRes.json()
    const creds: Array<{ credential_type: string; value: string }> = data.credentials || []

    // 3. Find a "login" credential and verify the password.
    //    Credentials stored as "username:password" — only the password portion is checked.
    //    The login username is always the restaurant slug (used for the config lookup above).
    const loginCred = creds.find(c => c.credential_type === "login")
    if (!loginCred) return null

    const colonIdx      = loginCred.value.indexOf(":")
    const storedPassword = colonIdx >= 0
      ? loginCred.value.slice(colonIdx + 1)
      : loginCred.value

    if (!storedPassword || !verifyPassword(password, storedPassword)) return null
    return slug // auth OK — cookie value = slug
  } catch {
    return null
  }
}

// POST /api/client/auth — validates client credentials server-side, sets httpOnly session cookie
export async function POST(req: Request) {
  try {
    const { username, password } = await req.json()
    if (!username || !password) {
      return NextResponse.json({ error: "Missing credentials" }, { status: 400 })
    }

    const key = username.trim().toLowerCase()

    // ── Path 1: hardcoded legacy accounts (fast, env-var based) ──────────────
    const account = ACCOUNTS[key]
    if (account) {
      const override  = getCredentialOverride(key)
      const expected  = override ?? process.env[account.envKey]
      if (!expected || password !== expected) {
        await new Promise(r => setTimeout(r, 400))
        return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
      }
      const res = NextResponse.json({ redirect: account.redirect })
      res.cookies.set(COOKIE_NAME, key, { ...COOKIE_BASE, maxAge: account.maxAge })
      return res
    }

    // ── Path 2: dynamic Railway lookup for new clients ─────────────────────
    // Username must equal the restaurant slug (auto-populated in the wizard).
    const railwaySlug = await tryRailwayAuth(key, password)
    if (railwaySlug) {
      // Each new client gets their own isolated URL — data is scoped to the slug
      // in the URL, not to a session cookie, so there is zero risk of cross-client leakage.
      const res = NextResponse.json({ redirect: `/client/${railwaySlug}/station` })
      // 1-year maxAge — tablets should never be unexpectedly logged out
      res.cookies.set(COOKIE_NAME, railwaySlug, { ...COOKIE_BASE, maxAge: 60 * 60 * 24 * 365 })
      return res
    }

    // Both paths failed
    await new Promise(r => setTimeout(r, 400))
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 })
  }
}

// GET /api/client/auth — returns current session info if logged in, 401 if not
export async function GET() {
  const cookieStore = await cookies()
  const session = cookieStore.get(COOKIE_NAME)
  if (!session?.value) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  return NextResponse.json({ account: session.value })
}

// DELETE /api/client/auth — clears the client session cookie (logout)
export async function DELETE() {
  const res = NextResponse.json({ success: true })
  res.cookies.set(COOKIE_NAME, "", { ...COOKIE_BASE, maxAge: 0 })
  return res
}
