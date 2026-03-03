/**
 * Server-side proxy for the Homebase API.
 * Homebase: https://app.joinhomebase.com/api
 * Auth: Authorization: Bearer {api_key}
 *
 * POST /api/homebase
 * Headers: x-homebase-key: <api_key>
 * Body:    { endpoint: string, method?: string, body?: object }
 */
export async function POST(req: Request) {
  try {
    const { endpoint, method = "GET", body } = await req.json()
    const key = req.headers.get("x-homebase-key")

    if (!key)      return Response.json({ error: "Missing x-homebase-key header" }, { status: 400 })
    if (!endpoint) return Response.json({ error: "Missing endpoint in body"       }, { status: 400 })

    const upstream = await fetch(`https://app.joinhomebase.com/api${endpoint}`, {
      method,
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type":  "application/json",
        "Accept":        "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })

    const data = await upstream.json().catch(() => ({}))
    return Response.json(data, { status: upstream.status })
  } catch (err) {
    console.error("[homebase proxy]", err)
    return Response.json({ error: "Proxy error" }, { status: 500 })
  }
}
