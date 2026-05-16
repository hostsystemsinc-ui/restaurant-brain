import { NextResponse } from "next/server"

const BACKEND = "https://restaurant-brain-production.up.railway.app"

// Allow up to 60 s for Claude to process large menus
export const maxDuration = 60

// Thin proxy — buffer the full multipart body and forward it verbatim.
// We use req.arrayBuffer() rather than streaming req.body because Next.js /
// Node environments vary in their duplex-streaming support, and the arrayBuffer
// approach reliably preserves the multipart boundary for any file size.
export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") ?? ""
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 })
    }

    const body = await req.arrayBuffer()

    const upstream = await fetch(`${BACKEND}/menu/parse`, {
      method: "POST",
      headers: { "content-type": contentType },
      body: body,
    })

    const data = await upstream.json()
    if (!upstream.ok) {
      // FastAPI validation errors arrive as detail: [{type, loc, msg, input}]
      // Convert to a readable string before passing to the client
      const detail = data.detail
      const errorMsg =
        typeof detail === "string"
          ? detail
          : Array.isArray(detail)
          ? detail.map((e: { msg?: string }) => e.msg ?? JSON.stringify(e)).join("; ")
          : "Parsing failed"
      return NextResponse.json({ error: errorMsg }, { status: upstream.status })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error("menu-parse proxy error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
