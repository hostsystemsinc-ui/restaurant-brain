import { NextResponse } from "next/server"

const BACKEND = "https://restaurant-brain-production.up.railway.app"

// Allow up to 60 s for Claude to process large menus
export const maxDuration = 60

// Thin proxy — pipe the raw multipart bytes straight to Railway.
// We do NOT call req.formData() here; instead we stream req.body verbatim so
// the multipart boundary is preserved and large files (4+ images) don't hit
// Next.js's default 4 MB body-parser limit.
export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") ?? ""
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 })
    }

    const upstream = await fetch(`${BACKEND}/menu/parse`, {
      method: "POST",
      // Forward the content-type header so the boundary is preserved
      headers: { "content-type": contentType },
      // Stream the raw body — avoids buffering / re-serialisation
      body: req.body,
      // Required for body streaming in some Node runtimes
      // @ts-ignore
      duplex: "half",
    })

    const data = await upstream.json()
    if (!upstream.ok) {
      return NextResponse.json(
        { error: data.detail ?? "Parsing failed" },
        { status: upstream.status }
      )
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error("menu-parse proxy error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
