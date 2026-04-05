import { NextRequest, NextResponse } from "next/server"

const RAILWAY_API = "https://restaurant-brain-production.up.railway.app"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, restaurant, email } = body
    if (!name || !restaurant || !email) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }
    const r = await fetch(`${RAILWAY_API}/demo-submissions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!r.ok) return NextResponse.json({ error: "Server error" }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[DEMO REQUEST ERROR]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret") ?? req.headers.get("x-owner-secret")
  if (secret !== "hostowner2025") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const r = await fetch(`${RAILWAY_API}/demo-submissions?secret=${secret}`, {
      cache: "no-store",
    })
    if (!r.ok) return NextResponse.json([])
    return NextResponse.json(await r.json())
  } catch {
    return NextResponse.json([])
  }
}
