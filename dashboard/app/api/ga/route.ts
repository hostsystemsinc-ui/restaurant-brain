import { NextRequest, NextResponse } from "next/server"
import { createSign } from "node:crypto"

const OWNER_PASS = process.env.OWNER_PASS

// ── JWT / service-account auth ─────────────────────────────────────────────────
function b64url(s: string): string {
  return Buffer.from(s).toString("base64url")
}

async function getAccessToken(saJson: string): Promise<string> {
  const sa  = JSON.parse(saJson)
  const now = Math.floor(Date.now() / 1000)
  const hdr = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))
  const cla = b64url(JSON.stringify({
    iss:   sa.client_email,
    scope: "https://www.googleapis.com/auth/analytics.readonly",
    aud:   "https://oauth2.googleapis.com/token",
    exp:   now + 3600,
    iat:   now,
  }))
  const msg    = `${hdr}.${cla}`
  const signer = createSign("RSA-SHA256")
  signer.update(msg)
  const sig = signer.sign(sa.private_key).toString("base64url")
  const jwt = `${msg}.${sig}`

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  })
  const d = await r.json()
  if (!d.access_token) throw new Error(`Token error: ${JSON.stringify(d)}`)
  return d.access_token
}

// ── GA4 Data API ───────────────────────────────────────────────────────────────
type GARow = { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] }

async function runReport(token: string, propertyId: string, body: object): Promise<{ rows?: GARow[] }> {
  const r = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method:  "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    }
  )
  return r.json()
}

const mv = (row: GARow | undefined, i: number) => parseInt(row?.metricValues?.[i]?.value ?? "0")
const dv = (row: GARow | undefined, i: number) => row?.dimensionValues?.[i]?.value ?? ""

// ── Handler ────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret") ?? req.headers.get("x-owner-secret")
  if (!OWNER_PASS || secret !== OWNER_PASS) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const saJson     = process.env.GA_SERVICE_ACCOUNT_JSON
  const propertyId = process.env.GA_PROPERTY_ID

  if (!saJson || !propertyId) {
    return NextResponse.json({ configured: false })
  }

  try {
    const tok = await getAccessToken(saJson)

    const [todayRpt, pagesRpt, sourcesRpt, dailyRpt] = await Promise.all([
      // Today summary
      runReport(tok, propertyId, {
        dateRanges: [{ startDate: "today", endDate: "today" }],
        metrics: [
          { name: "sessions" },
          { name: "screenPageViews" },
          { name: "activeUsers" },
          { name: "newUsers" },
        ],
      }),
      // Top pages — 7 days
      runReport(tok, propertyId, {
        dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
        dimensions: [{ name: "pagePath" }, { name: "pageTitle" }],
        metrics: [{ name: "screenPageViews" }, { name: "sessions" }],
        orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
        limit: 10,
      }),
      // Traffic sources — 7 days
      runReport(tok, propertyId, {
        dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
        dimensions: [{ name: "sessionSource" }],
        metrics: [{ name: "sessions" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 8,
      }),
      // Daily trend — 14 days
      runReport(tok, propertyId, {
        dateRanges: [{ startDate: "13daysAgo", endDate: "today" }],
        dimensions: [{ name: "date" }],
        metrics: [{ name: "sessions" }, { name: "screenPageViews" }],
        orderBys: [{ dimension: { dimensionName: "date" }, desc: false }],
      }),
    ])

    const today = {
      sessions:    mv(todayRpt.rows?.[0], 0),
      pageviews:   mv(todayRpt.rows?.[0], 1),
      activeUsers: mv(todayRpt.rows?.[0], 2),
      newUsers:    mv(todayRpt.rows?.[0], 3),
    }

    const pages = (pagesRpt.rows ?? []).map(r => ({
      path:      dv(r, 0),
      title:     dv(r, 1),
      pageviews: mv(r, 0),
      sessions:  mv(r, 1),
    }))

    const sources = (sourcesRpt.rows ?? []).map(r => ({
      source:   dv(r, 0) || "(direct)",
      sessions: mv(r, 0),
    }))

    const daily = (dailyRpt.rows ?? []).map(r => {
      const raw = dv(r, 0)
      return {
        date:      `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`,
        sessions:  mv(r, 0),
        pageviews: mv(r, 1),
      }
    })

    return NextResponse.json({ configured: true, today, pages, sources, daily })
  } catch (err) {
    console.error("[GA] Error:", err)
    return NextResponse.json({ configured: false, error: String(err) }, { status: 500 })
  }
}
