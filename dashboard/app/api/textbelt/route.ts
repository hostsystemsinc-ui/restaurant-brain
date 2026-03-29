import { NextResponse } from "next/server"

export async function GET() {
  const key = process.env.TEXTBELT_KEY
  if (!key) {
    return NextResponse.json({ error: "TEXTBELT_KEY not configured", quotaRemaining: null }, { status: 200 })
  }
  try {
    const r = await fetch(`https://textbelt.com/quota/${encodeURIComponent(key)}`, {
      cache: "no-store",
      next: { revalidate: 0 },
    })
    const data = await r.json()
    // Textbelt returns { success: true, quotaRemaining: N }
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: "Failed to reach Textbelt", quotaRemaining: null }, { status: 200 })
  }
}
