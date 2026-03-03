/**
 * Server-side proxy for the 7Shifts API.
 * All browser calls go through here to avoid CORS errors.
 *
 * POST /api/7shifts
 * Headers: x-7shifts-key: <api_key>
 * Body:    { endpoint: string, method?: string, body?: object }
 */
export async function POST(req: Request) {
  try {
    const { endpoint, method = "GET", body } = await req.json()
    const key = req.headers.get("x-7shifts-key")

    if (!key)      return Response.json({ error: "Missing x-7shifts-key header" }, { status: 400 })
    if (!endpoint) return Response.json({ error: "Missing endpoint in body"      }, { status: 400 })

    const upstream = await fetch(`https://api.7shifts.com/v2${endpoint}`, {
      method,
      headers: {
        "Authorization":  `Bearer ${key}`,
        "Content-Type":   "application/json",
        "Accept":         "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })

    const data = await upstream.json().catch(() => ({}))
    return Response.json(data, { status: upstream.status })
  } catch (err) {
    console.error("[7shifts proxy]", err)
    return Response.json({ error: "Proxy error" }, { status: 500 })
  }
}
