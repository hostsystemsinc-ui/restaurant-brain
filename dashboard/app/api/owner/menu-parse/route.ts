import { NextResponse } from "next/server"

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

const IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"])

const CLAUDE_PROMPT =
  "Parse this restaurant menu and return a JSON array of sections. Each section has: title (string), items (array of {name, description, price, tags}). tags is an array of strings like 'vegetarian', 'spicy', 'gluten-free', etc. Return ONLY valid JSON, no markdown code blocks, no explanation."

export async function POST(req: Request) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "Server misconfigured: missing API key" }, { status: 500 })
    }

    const contentType = req.headers.get("content-type") ?? ""
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 })
    }

    const formData = await req.formData()
    const file = formData.get("file")

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const blob = file as File
    if (blob.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 413 })
    }

    const mimeType = blob.type || "application/octet-stream"
    const isImage = IMAGE_TYPES.has(mimeType)

    let claudeContent: object[]

    if (isImage) {
      // For images: use vision
      const arrayBuffer = await blob.arrayBuffer()
      const base64 = Buffer.from(arrayBuffer).toString("base64")
      // Normalize mime type for Claude (it only accepts jpeg, png, gif, webp)
      const claudeMime = mimeType === "image/jpg" ? "image/jpeg" : mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp"

      claudeContent = [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: claudeMime,
            data: base64,
          },
        },
        {
          type: "text",
          text: CLAUDE_PROMPT,
        },
      ]
    } else {
      // For text/PDF/CSV: read as text
      const text = await blob.text()
      if (!text.trim()) {
        return NextResponse.json({ error: "File appears to be empty or unreadable as text" }, { status: 400 })
      }

      claudeContent = [
        {
          type: "text",
          text: `Here is the menu content:\n\n${text}\n\n${CLAUDE_PROMPT}`,
        },
      ]
    }

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: claudeContent,
          },
        ],
      }),
    })

    if (!claudeRes.ok) {
      const errBody = await claudeRes.text()
      console.error("Claude API error:", claudeRes.status, errBody)
      return NextResponse.json({ error: "AI parsing failed" }, { status: 502 })
    }

    const claudeData = await claudeRes.json()
    const rawText: string = claudeData?.content?.[0]?.text ?? ""

    if (!rawText) {
      return NextResponse.json({ error: "AI returned empty response" }, { status: 502 })
    }

    // Strip any accidental markdown fences
    const cleaned = rawText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim()

    let parsed: { title: string; items: { name: string; description?: string; price?: string; tags?: string[] }[] }[]
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      console.error("JSON parse failed. Raw text:", rawText)
      return NextResponse.json({ error: "AI returned invalid JSON" }, { status: 502 })
    }

    if (!Array.isArray(parsed)) {
      return NextResponse.json({ error: "AI returned unexpected format" }, { status: 502 })
    }

    // Shape into MenuSection[]
    const sections = parsed.map(section => ({
      id: crypto.randomUUID(),
      title: String(section.title ?? "Section"),
      items: Array.isArray(section.items)
        ? section.items.map(item => ({
            id: crypto.randomUUID(),
            name: String(item.name ?? "Item"),
            description: String(item.description ?? ""),
            price: String(item.price ?? ""),
            tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
          }))
        : [],
    }))

    return NextResponse.json({ sections })
  } catch (err) {
    console.error("menu-parse error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
