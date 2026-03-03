/**
 * Server-side proxy for the When I Work API.
 * When I Work: https://api.wheniwork.com/2
 * Auth: W-Token: {api_token}  (their custom header)
 *
 * POST /api/wheniwork
 * Headers: x-wiw-key: <api_token>
 * Body:    { endpoint: string, method?: string, body?: object }
 */
export async function POST(req: Request) {
  try {
    const { endpoint, method = "GET", body } = await req.json()
    const key = req.headers.get("x-wiw-key")

    if (!key)      return Response.json({ error: "Missing x-wiw-key header" }, { status: 400 })
    if (!endpoint) return Response.json({ error: "Missing endpoint in body"  }, { status: 400 })

    const upstream = await fetch(`https://api.wheniwork.com/2${endpoint}`, {
      method,
      headers: {
        "W-Token":       key,
        "Content-Type":  "application/json",
        "Accept":        "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })

    const data = await upstream.json().catch(() => ({}))
    return Response.json(data, { status: upstream.status })
  } catch (err) {
    console.error("[wheniwork proxy]", err)
    return Response.json({ error: "Proxy error" }, { status: 500 })
  }
}
