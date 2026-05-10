import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { readSettings, writeSettings, getCredentialOverride } from "@/lib/walnut-settings"

// All known client accounts and their env-var keys
const ACCOUNT_MAP: Record<string, { envKey: string; displayName: string; redirect: string }> = {
  walters:   { envKey: "CLIENT_PASS_WALTERS",  displayName: "Walter's 303",          redirect: "/station"          },
  demo:      { envKey: "CLIENT_PASS_DEMO",      displayName: "Demo Restaurant",        redirect: "/demo/station"     },
  original:  { envKey: "CLIENT_PASS_ORIGINAL",  displayName: "Walnut Original",        redirect: "/station"          },
  southside: { envKey: "CLIENT_PASS_SOUTHSIDE", displayName: "Walnut Southside",       redirect: "/station"          },
  walnut:    { envKey: "CLIENT_PASS_WALNUT",    displayName: "Walnut Café (owner)",    redirect: "/walnut/dashboard" },
}

async function checkAuth(req: Request): Promise<boolean> {
  const authHeader = req.headers.get("authorization") || ""
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : ""
  const expected = process.env.OWNER_PASS

  if (expected && token === expected) return true

  const cookieStore = await cookies()
  const session = cookieStore.get("host_owner_session")
  return session?.value === "1"
}

// GET /api/owner/secrets — returns all client credentials + Textbelt info
export async function GET(req: Request) {
  if (!(await checkAuth(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const key = process.env.TEXTBELT_KEY || ""

  const clientCreds = Object.entries(ACCOUNT_MAP).map(([username, cfg]) => {
    const override = getCredentialOverride(username)
    const envVal   = process.env[cfg.envKey] || ""
    return {
      username,
      displayName:  cfg.displayName,
      redirect:     cfg.redirect,
      password:     override ?? envVal,   // current active password
      isOverride:   override !== null,     // true = set via UI, false = env var
      envKey:       cfg.envKey,
    }
  })

  return NextResponse.json({
    textbeltKey:          key,
    textbeltPurchaseUrl:  `https://textbelt.com/purchase?apikey=${key}`,
    textbeltWhitelistUrl: `https://textbelt.com/whitelist?key=${key}`,
    clientCreds,
  })
}

// POST /api/owner/secrets — update a client credential password
export async function POST(req: Request) {
  if (!(await checkAuth(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { username?: string; password?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: "Bad JSON" }, { status: 400 }) }

  const { username, password } = body
  if (!username || typeof password !== "string") {
    return NextResponse.json({ error: "Missing username or password" }, { status: 400 })
  }
  if (!(username in ACCOUNT_MAP)) {
    return NextResponse.json({ error: "Unknown account" }, { status: 400 })
  }
  if (password.length < 4) {
    return NextResponse.json({ error: "Password must be at least 4 characters" }, { status: 400 })
  }

  const settings = readSettings()
  ;(settings.credentials as Record<string, string | null>)[username] = password
  writeSettings(settings)

  return NextResponse.json({ ok: true, username, message: "Password updated" })
}
