import { NextRequest, NextResponse } from "next/server"
import { redeemAppToken } from "@/lib/app-tokens"

// Maps account key → the station URL to redirect to after auth
const REDIRECTS: Record<string, string> = {
  walters:   "/station",
  demo:      "/demo/station",
  original:  "/station",
  southside: "/station",
  walnut:    "/walnut/dashboard",
}

const COOKIE_NAME = "host_client_session"

// ── GET /api/client/app-auth?t={token} ───────────────────────────────────────
// The HOST Android app opens this URL in its WebView after getting a token
// from /api/client/app-token. This endpoint:
//   1. Validates the one-time token (60-second TTL)
//   2. Sets a 1-year httpOnly session cookie (so tablets never log out)
//   3. Redirects to the station page for the authenticated account
//
// The token is single-use and short-lived, so intercepting the URL is harmless.
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const token   = req.nextUrl.searchParams.get("t") ?? ""
  const account = redeemAppToken(token)

  if (!account) {
    // Token missing, expired, or already used — redirect to an error state
    // The app will detect the failed load and can re-request a fresh token
    const url = new URL("/api/client/app-auth-error", req.url)
    return NextResponse.redirect(url, 302)
  }

  const redirect = REDIRECTS[account] ?? "/station"
  const res = NextResponse.redirect(new URL(redirect, req.url), 302)

  // 1-year cookie — tablets are dedicated devices that should never be logged out
  res.cookies.set(COOKIE_NAME, account, {
    httpOnly: true,
    sameSite: "lax",
    path:     "/",
    maxAge:   60 * 60 * 24 * 365,   // 365 days
  })

  return res
}
