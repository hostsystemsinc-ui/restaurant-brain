import { NextResponse } from "next/server"
import { cookies } from "next/headers"

// GET /api/owner/secrets — returns Textbelt key, links, and client credentials
// Accepts: Authorization: Bearer <OWNER_PASS>  OR  host_owner_session cookie
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization") || ""
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : ""
  const expected = process.env.OWNER_PASS

  // Check Bearer token first, then fall back to session cookie
  let authed = expected && token === expected
  if (!authed) {
    const cookieStore = await cookies()
    const session = cookieStore.get("host_owner_session")
    authed = session?.value === "1"
  }

  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const key = process.env.TEXTBELT_KEY || ""

  return NextResponse.json({
    textbeltKey: key,
    textbeltPurchaseUrl:  `https://textbelt.com/purchase?apikey=${key}`,
    textbeltWhitelistUrl: `https://textbelt.com/whitelist?key=${key}`,
    clientCreds: {
      walters: { username: "walters", password: process.env.CLIENT_PASS_WALTERS || "" },
      demo:    { username: "demo",    password: process.env.CLIENT_PASS_DEMO    || "" },
    },
  })
}
