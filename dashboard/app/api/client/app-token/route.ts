import { NextRequest, NextResponse } from "next/server"
import { getCredentialOverride } from "@/lib/walnut-settings"
import { createAppToken } from "@/lib/app-tokens"

// Same account map as /api/client/auth — keep in sync when adding new clients
const ACCOUNTS: Record<string, { envKey: string }> = {
  walters:   { envKey: "CLIENT_PASS_WALTERS"   },
  demo:      { envKey: "CLIENT_PASS_DEMO"       },
  original:  { envKey: "CLIENT_PASS_ORIGINAL"  },
  southside: { envKey: "CLIENT_PASS_SOUTHSIDE" },
  walnut:    { envKey: "CLIENT_PASS_WALNUT"    },
}

// ── POST /api/client/app-token ────────────────────────────────────────────────
// Called by the HOST Android app during login / auto-login.
// Validates username + password, returns a short-lived (60s) one-time token.
// The app passes that token to /api/client/app-auth in the WebView URL,
// which sets the session cookie and redirects to the station page.
//
// Credentials never appear in any URL — they're POSTed as JSON over HTTPS.
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { username?: string; password?: string }
    const { username, password } = body

    if (!username || !password) {
      return NextResponse.json({ error: "Missing credentials" }, { status: 400 })
    }

    const key     = username.trim().toLowerCase()
    const account = ACCOUNTS[key]

    if (!account) {
      await new Promise(r => setTimeout(r, 400))   // timing-safe delay
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    // Check runtime override (owner-console password changes) before env var
    const override  = getCredentialOverride(key)
    const expected  = override ?? process.env[account.envKey]

    if (!expected || password !== expected) {
      await new Promise(r => setTimeout(r, 400))
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    const token = createAppToken(key)
    return NextResponse.json({ token })

  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 })
  }
}
