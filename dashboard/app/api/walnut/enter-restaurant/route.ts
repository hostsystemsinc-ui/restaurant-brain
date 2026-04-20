import { NextResponse } from "next/server"
import { cookies } from "next/headers"

const ALLOWED = ["original", "southside"] as const
type Account = typeof ALLOWED[number]

const REDIRECTS: Record<Account, string> = {
  original:  "/station",
  southside: "/station",
}

/**
 * POST /api/walnut/enter-restaurant
 * Requires walnut_admin_pin_ok cookie (must have entered PIN).
 * Body: { account: "original" | "southside" }
 *
 * Sets host_client_session to the requested restaurant account with a
 * 1-year maxAge so the station tablet never logs out unexpectedly.
 * Returns { redirect: string } — the station URL to navigate to.
 */
export async function POST(req: Request) {
  const cookieStore = await cookies()
  const pinOk = cookieStore.get("walnut_admin_pin_ok")
  if (!pinOk?.value) {
    return NextResponse.json({ error: "Admin PIN required" }, { status: 401 })
  }

  try {
    const { account } = await req.json()
    if (!account || !ALLOWED.includes(account as Account)) {
      return NextResponse.json({ error: "Invalid account" }, { status: 400 })
    }

    const redirect = REDIRECTS[account as Account]
    const res = NextResponse.json({ redirect })
    res.cookies.set("host_client_session", account, {
      httpOnly: true,
      sameSite: "lax",
      path:     "/",
      maxAge:   60 * 60 * 24 * 365, // 1 year — station tablets stay logged in
    })
    return res
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 })
  }
}
