import { NextResponse } from "next/server"

const BACKEND = "https://restaurant-brain-production.up.railway.app"

// Thin proxy — the Python backend holds the Anthropic key and handles
// multi-file uploads + Claude vision parsing.
export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") ?? ""
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 })
    }

    const formData = await req.formData()
    const files = formData.getAll("file")

    if (!files.length) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 })
    }

    // Forward the entire form to the Railway backend unchanged
    const upstream = await fetch(`${BACKEND}/menu/parse`, {
      method: "POST",
      body: formData,
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
