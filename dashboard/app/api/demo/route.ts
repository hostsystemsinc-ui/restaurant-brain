import { NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"

// Persist submissions to /tmp so they survive between requests within a deployment.
// They reset on redeploy — add a database (Supabase, PlanetScale, etc.) when ready for full persistence.
const DATA_FILE = "/tmp/host_demo_submissions.json"

async function read(): Promise<Record<string, unknown>[]> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8")
    return JSON.parse(raw)
  } catch {
    return []
  }
}

async function write(subs: Record<string, unknown>[]) {
  await fs.writeFile(DATA_FILE, JSON.stringify(subs, null, 2))
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, restaurant, email, phone, city, type, submittedAt } = body

    if (!name || !restaurant || !email) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const submission = {
      id: crypto.randomUUID(),
      name:         String(name).trim(),
      restaurant:   String(restaurant).trim(),
      email:        String(email).trim().toLowerCase(),
      phone:        String(phone  || "").trim(),
      city:         String(city   || "").trim(),
      type:         String(type   || "").trim(),
      submittedAt:  submittedAt || new Date().toISOString(),
      receivedAt:   new Date().toISOString(),
    }

    // Log so it also appears in Railway logs
    console.log("[DEMO REQUEST]", JSON.stringify(submission))

    const existing = await read()
    existing.unshift(submission) // newest first
    await write(existing)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[DEMO REQUEST ERROR]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  // Simple owner-only guard: require header or query param
  const secret = req.nextUrl.searchParams.get("secret") ?? req.headers.get("x-owner-secret")
  if (secret !== "hostowner2025") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const subs = await read()
  return NextResponse.json(subs)
}
