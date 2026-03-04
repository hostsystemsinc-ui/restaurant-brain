/**
 * Square OAuth 2.0 callback handler.
 *
 * Flow:
 *   1. Frontend redirects owner to Square's authorize URL
 *   2. Owner approves → Square redirects here with ?code=...
 *   3. We exchange code for access token (server-side, secret never leaves server)
 *   4. We store token in a short-lived httpOnly cookie
 *   5. We redirect owner back to their admin dashboard
 *   6. Frontend calls /api/square/session to pick up the token, then stores in localStorage
 *
 * Required env vars (set in Railway):
 *   SQUARE_CLIENT_ID      — from developer.squareup.com (also set as NEXT_PUBLIC_SQUARE_CLIENT_ID)
 *   SQUARE_CLIENT_SECRET  — from developer.squareup.com (never expose client-side)
 *   NEXT_PUBLIC_BASE_URL  — e.g. https://hostplatform.net (optional, defaults to that)
 */
import { NextResponse } from "next/server"
import { cookies }      from "next/headers"

export async function GET(req: Request) {
  const url    = new URL(req.url)
  const code   = url.searchParams.get("code")
  const error  = url.searchParams.get("error")
  const origin = process.env.NEXT_PUBLIC_BASE_URL ?? "https://hostplatform.net"

  if (error || !code) {
    return NextResponse.redirect(`${origin}/walters303?sq=error`)
  }

  const clientId     = process.env.SQUARE_CLIENT_ID
  const clientSecret = process.env.SQUARE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    console.error("[square/callback] Missing SQUARE_CLIENT_ID or SQUARE_CLIENT_SECRET env vars")
    return NextResponse.redirect(`${origin}/walters303?sq=error`)
  }

  try {
    // Exchange authorization code for access token
    const tokenRes = await fetch("https://connect.squareup.com/oauth2/token", {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Square-Version": "2024-01-17",
      },
      body: JSON.stringify({
        client_id:     clientId,
        client_secret: clientSecret,
        code,
        grant_type:    "authorization_code",
        redirect_uri:  `${origin}/api/square/callback`,
      }),
    })

    const token = await tokenRes.json()

    if (!tokenRes.ok || !token.access_token) {
      console.error("[square/callback] Token exchange failed:", token)
      return NextResponse.redirect(`${origin}/walters303?sq=error`)
    }

    // Fetch merchant info (business name) for display
    let merchantName = "Square Account"
    try {
      const mRes  = await fetch("https://connect.squareup.com/v2/merchants/me", {
        headers: {
          "Authorization": `Bearer ${token.access_token}`,
          "Square-Version": "2024-01-17",
        },
      })
      const mData = await mRes.json()
      merchantName = mData.merchant?.[0]?.business_name ?? merchantName
    } catch { /* non-fatal — name is cosmetic */ }

    // Store token in a short-lived httpOnly cookie (5 min TTL)
    // Frontend will retrieve it via /api/square/session and move it to localStorage
    const jar = await cookies()
    jar.set("sq_pending", JSON.stringify({
      access_token:  token.access_token,
      merchant_id:   token.merchant_id,
      expires_at:    token.expires_at ?? null,
      merchant_name: merchantName,
    }), {
      httpOnly: true,
      secure:   true,
      sameSite: "lax",
      maxAge:   300, // 5 minutes
      path:     "/",
    })

    return NextResponse.redirect(`${origin}/walters303?sq=connected`)
  } catch (err) {
    console.error("[square/callback] Unexpected error:", err)
    return NextResponse.redirect(`${origin}/walters303?sq=error`)
  }
}
