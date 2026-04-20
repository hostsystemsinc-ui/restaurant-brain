import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/**
 * Multi-tenant routing + authentication middleware
 *
 * Auth protection:
 *   /owner/*              → requires httpOnly cookie  host_owner_session=1
 *   /station/*            → requires httpOnly cookie  host_client_session (any value)
 *   /admin/*              → requires httpOnly cookie  host_client_session (any value)
 *   /analog/*             → requires httpOnly cookie  host_client_session (any value)
 *   /demo/station/*       → requires httpOnly cookie  host_client_session=demo
 *   /walnut/station/*     → requires httpOnly cookie  host_client_session=walnut
 *   /walnut/dashboard/*   → requires httpOnly cookie  host_client_session (any value, PIN gate in page)
 *   /walnut/logins/*      → requires httpOnly cookie  host_client_session (any value, PIN gate in page)
 *
 * Multi-tenant rewrite (after auth check):
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
  "walnut",   // Walnut Cafe join pages + owner dashboard
  "api",
  "admin",
  "analog",
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

  // Static file (has a file extension) — pass through
  if (/\.[a-zA-Z0-9]+$/.test(segments[0])) return NextResponse.next()

  // Determine the effective destination path
  // (for multi-tenant routes, first segment is the slug)
  let destPath = pathname
  const isMultiTenant = !RESERVED.has(segments[0])
  if (isMultiTenant) {
    const rest = segments.slice(1)
    destPath = rest.length > 0 ? "/" + rest.join("/") : "/admin"
  }

  const destSegments = destPath.split("/").filter(Boolean)
  const destRoot = destSegments[0] ?? ""

  // ── Auth gates ────────────────────────────────────────────────────────────────

  // /owner → owner must be logged in
  if (destRoot === "owner") {
    const cookie = request.cookies.get("host_owner_session")
    if (!cookie || cookie.value !== "1") {
      return NextResponse.redirect(new URL("/login/owner", request.url))
    }
  }

  // /station or /admin → any authenticated client
  if (destRoot === "station" || destRoot === "admin") {
    const cookie = request.cookies.get("host_client_session")
    if (!cookie || !cookie.value) {
      return NextResponse.redirect(new URL("/login/client", request.url))
    }
  }

  // /demo/station and /demo/reservations → must be logged in as demo account
  const DEMO_PROTECTED = ["station", "reservations"]
  if (destRoot === "demo" && DEMO_PROTECTED.includes(destSegments[1])) {
    const cookie = request.cookies.get("host_client_session")
    if (!cookie || cookie.value !== "demo") {
      return NextResponse.redirect(new URL("/login/client", request.url))
    }
  }

  // /walnut/station → requires walnut owner account
  if (destRoot === "walnut" && destSegments[1] === "station") {
    const cookie = request.cookies.get("host_client_session")
    if (!cookie || cookie.value !== "walnut") {
      return NextResponse.redirect(new URL("/login/client", request.url))
    }
  }

  // /walnut/dashboard and /walnut/logins → any authenticated client (PIN gate in the page)
  const WALNUT_CLIENT_ROUTES = ["dashboard", "logins"]
  if (destRoot === "walnut" && WALNUT_CLIENT_ROUTES.includes(destSegments[1])) {
    const cookie = request.cookies.get("host_client_session")
    if (!cookie || !cookie.value) {
      return NextResponse.redirect(new URL("/login/client", request.url))
    }
  }

  // /analog → any authenticated client (restaurant detected from session in page)
  if (destRoot === "analog") {
    const cookie = request.cookies.get("host_client_session")
    if (!cookie || !cookie.value) {
      return NextResponse.redirect(new URL("/login/client", request.url))
    }
  }

  // ── Multi-tenant rewrite ──────────────────────────────────────────────────────
  if (isMultiTenant) {
    const url = request.nextUrl.clone()
    url.pathname = destPath
    return NextResponse.rewrite(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
