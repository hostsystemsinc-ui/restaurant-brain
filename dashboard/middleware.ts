import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/**
 * Multi-tenant routing middleware
 *
 * Any first path segment that isn't a reserved route is treated as a
 * client slug and rewritten to the matching internal page:
 *
 *   /walters303              → /admin
 *   /walters303/station      → /station
 *   /walters303/wait/:id     → /wait/:id
 *   /walters303/join         → /join
 *   /walters303/reservations → /reservations
 */

// These top-level paths are real routes — not client slugs
const RESERVED = new Set([
  "owner",
  "login",
  "demo",
  "api",
  "admin",
  "station",
  "wait",
  "join",
  "reservations",
  "_next",
  "favicon.ico",
  "globals.css",
])

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const segments = pathname.split("/").filter(Boolean)

  // Root — serve portal page as-is
  if (segments.length === 0) return NextResponse.next()

  // Static file (has a file extension, e.g. /walters-logo.png, /manifest.json) — pass through
  if (/\.[a-zA-Z0-9]+$/.test(segments[0])) return NextResponse.next()

  // Reserved path — pass through unchanged
  if (RESERVED.has(segments[0])) return NextResponse.next()

  // Everything else: treat first segment as a client slug
  // /walters303           → /admin
  // /walters303/station   → /station
  // /walters303/wait/xyz  → /wait/xyz
  const rest = segments.slice(1)
  const destination = rest.length > 0 ? "/" + rest.join("/") : "/admin"

  const url = request.nextUrl.clone()
  url.pathname = destination
  return NextResponse.rewrite(url)
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
