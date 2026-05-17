import { NextResponse } from "next/server"

const RAILWAY_API  = "https://restaurant-brain-production.up.railway.app"
const OWNER_SECRET = process.env.OWNER_SECRET || process.env.OWNER_PASS || ""

// PATCH /api/client/config — merge guest_config fields for a restaurant
export async function PATCH(req: Request) {
  if (!OWNER_SECRET) return NextResponse.json({ error: "Not configured" }, { status: 500 })
  try {
    const { rid, guest_config, floor_plan, menu_config } = await req.json()
    if (!rid) return NextResponse.json({ error: "Missing rid" }, { status: 400 })

    const body: Record<string, unknown> = {}
    if (guest_config !== undefined) body.guest_config = guest_config
    if (floor_plan   !== undefined) body.floor_plan   = floor_plan
    if (menu_config  !== undefined) body.menu_config  = menu_config

    const r = await fetch(
      `${RAILWAY_API}/owner/clients/${encodeURIComponent(rid)}/config?secret=${encodeURIComponent(OWNER_SECRET)}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" }
    )
    if (!r.ok) return NextResponse.json({ error: "Backend error" }, { status: r.status })
    return NextResponse.json(await r.json())
  } catch {
    return NextResponse.json({ error: "Network error" }, { status: 502 })
  }
}

// GET /api/client/config?rid=xxx — fetch full config for a restaurant
export async function GET(req: Request) {
  if (!OWNER_SECRET) return NextResponse.json({ error: "Not configured" }, { status: 500 })
  const { searchParams } = new URL(req.url)
  const rid = searchParams.get("rid")
  if (!rid) return NextResponse.json({ error: "Missing rid" }, { status: 400 })
  try {
    const r = await fetch(
      `${RAILWAY_API}/owner/clients/${encodeURIComponent(rid)}/config?secret=${encodeURIComponent(OWNER_SECRET)}`,
      { cache: "no-store" }
    )
    if (!r.ok) return NextResponse.json({ error: "Backend error" }, { status: r.status })
    return NextResponse.json(await r.json())
  } catch {
    return NextResponse.json({ error: "Network error" }, { status: 502 })
  }
}
