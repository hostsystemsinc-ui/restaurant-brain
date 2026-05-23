import { NextResponse } from "next/server"
import { hashPassword } from "@/lib/password"

const RAILWAY_API  = "https://restaurant-brain-production.up.railway.app"
const OWNER_SECRET = process.env.OWNER_SECRET || process.env.OWNER_PASS || ""

/**
 * Credential values are stored as "slug:password".
 * Hash the password portion before it reaches the database.
 * If the value has no colon (unusual), hash the whole thing.
 */
function hashCredentialValue(value: string): string {
  const colonIdx = value.indexOf(":")
  if (colonIdx < 0) return hashPassword(value)
  const slug     = value.slice(0, colonIdx)
  const password = value.slice(colonIdx + 1)
  return `${slug}:${hashPassword(password)}`
}

// GET /api/client/credentials?rid=xxx  — fetch credentials for a restaurant (server-side owner secret)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const rid = searchParams.get("rid")
  if (!rid) return NextResponse.json({ error: "Missing rid" }, { status: 400 })
  if (!OWNER_SECRET) return NextResponse.json({ error: "Not configured" }, { status: 500 })

  try {
    const r = await fetch(
      `${RAILWAY_API}/owner/clients/${encodeURIComponent(rid)}/credentials?secret=${encodeURIComponent(OWNER_SECRET)}`,
      { cache: "no-store" }
    )
    if (!r.ok) return NextResponse.json({ error: "Backend error" }, { status: r.status })
    return NextResponse.json(await r.json())
  } catch {
    return NextResponse.json({ error: "Network error" }, { status: 502 })
  }
}

// PATCH /api/client/credentials  — update a credential (add or update login credential)
export async function PATCH(req: Request) {
  if (!OWNER_SECRET) return NextResponse.json({ error: "Not configured" }, { status: 500 })

  try {
    const { rid, cred_id, value, label } = await req.json()
    if (!rid) return NextResponse.json({ error: "Missing rid" }, { status: 400 })

    // value is stored as "slug:password". Hash the password portion before saving
    // so the plaintext password never reaches the database.
    const hashedValue = hashCredentialValue(value)

    if (cred_id) {
      // Update existing credential
      const r = await fetch(
        `${RAILWAY_API}/owner/clients/${encodeURIComponent(rid)}/credentials/${encodeURIComponent(cred_id)}?secret=${encodeURIComponent(OWNER_SECRET)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value: hashedValue, label }),
        }
      )
      if (!r.ok) return NextResponse.json({ error: "Backend error" }, { status: r.status })
      return NextResponse.json(await r.json())
    } else {
      // Create new credential
      const r = await fetch(
        `${RAILWAY_API}/owner/clients/${encodeURIComponent(rid)}/credentials?secret=${encodeURIComponent(OWNER_SECRET)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ credential_type: "login", value: hashedValue, label: label || "Login" }),
        }
      )
      if (!r.ok) return NextResponse.json({ error: "Backend error" }, { status: r.status })
      return NextResponse.json(await r.json())
    }
  } catch {
    return NextResponse.json({ error: "Network error" }, { status: 502 })
  }
}
