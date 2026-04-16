import { NextResponse } from "next/server"

const COOKIE_NAME = "host_owner_session"
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 8, // 8 hours
}

// POST /api/owner/auth  — validates owner password server-side, sets httpOnly session cookie
export async function POST(req: Request) {
  try {
    const { password } = await req.json()
    const expected = process.env.OWNER_PASS

    if (!expected) {
      console.error("OWNER_PASS env var not set")
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
    }

    if (!password || password !== expected) {
      // Small delay to slow brute-force attempts
      await new Promise(r => setTimeout(r, 400))
      return NextResponse.json({ error: "Incorrect password" }, { status: 401 })
    }

    const res = NextResponse.json({ success: true })
    res.cookies.set(COOKIE_NAME, "1", COOKIE_OPTS)
    return res
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 })
  }
}

// DELETE /api/owner/auth  — clears the session cookie (logout)
export async function DELETE() {
  const res = NextResponse.json({ success: true })
  res.cookies.set(COOKIE_NAME, "", { ...COOKIE_OPTS, maxAge: 0 })
  return res
}
