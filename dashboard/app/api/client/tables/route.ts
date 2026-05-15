import { NextResponse } from "next/server"

const RAILWAY_API  = "https://restaurant-brain-production.up.railway.app"
const OWNER_SECRET = process.env.OWNER_SECRET || process.env.OWNER_PASS || ""

// POST /api/client/tables — batch upsert tables (number, capacity, x, y, w, h)
export async function POST(req: Request) {
  if (!OWNER_SECRET) return NextResponse.json({ error: "Not configured" }, { status: 500 })
  try {
    const { rid, tables } = await req.json()
    if (!rid || !Array.isArray(tables)) return NextResponse.json({ error: "Missing rid or tables" }, { status: 400 })

    const r = await fetch(
      `${RAILWAY_API}/owner/clients/${encodeURIComponent(rid)}/tables/batch?secret=${encodeURIComponent(OWNER_SECRET)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tables }),
        cache: "no-store",
      }
    )
    if (!r.ok) return NextResponse.json({ error: "Backend error" }, { status: r.status })
    return NextResponse.json(await r.json())
  } catch {
    return NextResponse.json({ error: "Network error" }, { status: 502 })
  }
}
