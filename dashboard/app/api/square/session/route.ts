/**
 * One-time Square token retrieval.
 *
 * After the OAuth callback sets a sq_pending cookie, the frontend calls this
 * endpoint to retrieve the token, which is then stored in localStorage.
 * The cookie is immediately deleted after one read to prevent replay.
 */
import { NextResponse } from "next/server"
import { cookies }      from "next/headers"

export async function GET() {
  const jar     = await cookies()
  const pending = jar.get("sq_pending")

  if (!pending?.value) {
    return NextResponse.json({ error: "No pending Square session" }, { status: 404 })
  }

  // Delete immediately — single-use token handoff
  jar.delete("sq_pending")

  try {
    return NextResponse.json(JSON.parse(pending.value))
  } catch {
    return NextResponse.json({ error: "Malformed session data" }, { status: 400 })
  }
}
