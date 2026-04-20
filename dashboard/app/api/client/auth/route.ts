import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getCredentialOverride } from "@/lib/walnut-settings"

// Known accounts: maps username → { envKey, redirect, maxAge }
const ACCOUNTS: Record<string, { envKey: string; redirect: string; maxAge: number }> = {
  walters:   { envKey: "CLIENT_PASS_WALTERS",   redirect: "/station",          maxAge: 60 * 60 * 12          }, // 12h
  demo:      { envKey: "CLIENT_PASS_DEMO",       redirect: "/demo/station",     maxAge: 60 * 60 * 12          }, // 12h
  // Station accounts — 1-year maxAge so tablets never log out unexpectedly
  original:  { envKey: "CLIENT_PASS_ORIGINAL",   redirect: "/station",          maxAge: 60 * 60 * 24 * 365    }, // 1 year
  southside: { envKey: "CLIENT_PASS_SOUTHSIDE",  redirect: "/station",          maxAge: 60 * 60 * 24 * 365    }, // 1 year
  walnut:    { envKey: "CLIENT_PASS_WALNUT",     redirect: "/walnut/dashboard", maxAge: 60 * 60 * 12          }, // 12h
}

const COOKIE_NAME = "host_client_session"
const COOKIE_BASE = {
  httpOnly: true,
  sameSite: "lax" as const,
  path:     "/",
}

// POST /api/client/auth — validates client credentials server-side, sets httpOnly session cookie
export async function POST(req: Request) {
  try {
    const { username, password } = await req.json()
    if (!username || !password) {
      return NextResponse.json({ error: "Missing credentials" }, { status: 400 })
    }

    const key = username.trim().toLowerCase()
    const account = ACCOUNTS[key]

    if (!account) {
      await new Promise(r => setTimeout(r, 400))
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    // Check for runtime credential override (set via /api/walnut/set-password)
    // before falling back to the environment variable.
    const override  = getCredentialOverride(key)
    const expected  = override ?? process.env[account.envKey]
    if (!expected || password !== expected) {
      await new Promise(r => setTimeout(r, 400))
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    const res = NextResponse.json({ redirect: account.redirect })
    res.cookies.set(COOKIE_NAME, key, { ...COOKIE_BASE, maxAge: account.maxAge })
    return res
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
