import { NextRequest, NextResponse } from "next/server"

function extractMeta(html: string, name: string): string {
  const patterns = [
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, "i"),
    new RegExp(`<meta[^>]+property=["']${name}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${name}["']`, "i"),
  ]
  for (const p of patterns) {
    const m = html.match(p)
    if (m?.[1]) return m[1].trim()
  }
  return ""
}

function resolveUrl(base: string, path: string): string {
  if (!path) return ""
  if (path.startsWith("http")) return path
  if (path.startsWith("//")) return `https:${path}`
  try {
    const u = new URL(base)
    if (path.startsWith("/")) return `${u.origin}${path}`
    return `${u.origin}/${path}`
  } catch { return path }
}

interface MenuItemOut { name: string; description: string; price: string; tags: string[] }
interface MenuSectionOut { title: string; items: MenuItemOut[] }
interface MenuItemRaw { name?: string; description?: string; offers?: { price?: string | number } | Array<{ price?: string | number }>; suitableForDiet?: string | string[] }
interface MenuSectionRaw { name?: string; hasMenuItem?: MenuItemRaw[] }
interface MenuSchema { "@type"?: string; hasMenuSection?: MenuSectionRaw[] }

function parseMenuFromJsonLd(html: string): MenuSectionOut[] {
  const sections: MenuSectionOut[] = []
  const scriptTags = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || []
  for (const script of scriptTags) {
    try {
      const content = script.replace(/<script[^>]*>/i, "").replace(/<\/script>/i, "")
      const data = JSON.parse(content) as Record<string, unknown>
      const schemas: unknown[] = Array.isArray(data)
        ? data
        : (Array.isArray(data["@graph"]) ? (data["@graph"] as unknown[]) : [data])

      for (const schema of schemas) {
        const s = schema as MenuSchema
        if (s["@type"] === "Menu" && Array.isArray(s.hasMenuSection)) {
          for (const section of s.hasMenuSection) {
            const items: MenuItemOut[] = (section.hasMenuItem || []).map((item: MenuItemRaw) => {
              const offersArr = Array.isArray(item.offers) ? item.offers : (item.offers ? [item.offers] : [])
              const priceRaw = offersArr[0]?.price
              const price    = priceRaw != null ? `$${priceRaw}` : ""
              const dietRaw  = item.suitableForDiet
              const diets    = Array.isArray(dietRaw) ? dietRaw : (dietRaw ? [dietRaw] : [])
              const tags     = diets.map((d: string) =>
                d.replace(/https?:\/\/schema\.org\//g, "").replace(/RestrictedDiet$/, "")
              )
              return { name: item.name || "", description: item.description || "", price, tags }
            }).filter((i: MenuItemOut) => i.name)
            if (items.length > 0) sections.push({ title: section.name || "Menu", items })
          }
        }
      }
    } catch { /* skip malformed JSON-LD */ }
  }
  return sections
}

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get("url")
  if (!rawUrl) return NextResponse.json({ error: "Missing url param" }, { status: 400 })

  const url = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      signal: AbortSignal.timeout(12000),
      redirect: "follow",
    })

    if (!res.ok) {
      return NextResponse.json({ error: `Site returned HTTP ${res.status}` }, { status: 422 })
    }

    const html    = await res.text()
    const baseUrl = res.url || url

    // ── Restaurant name ───────────────────────────────────────────────────────
    const ogSiteName  = extractMeta(html, "og:site_name")
    const ogTitle     = extractMeta(html, "og:title")
    const titleMatch  = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    const rawTitle    = titleMatch?.[1]?.trim() || ""
    const cleanTitle  = rawTitle.split(/\s*[\|\-–—·•]\s*/)[0].trim()
    const restaurantName = ogSiteName || cleanTitle || ogTitle || ""

    // ── Logo ─────────────────────────────────────────────────────────────────
    const ogImage   = extractMeta(html, "og:image")
    const touchIcon = html.match(/<link[^>]+rel=["']apple-touch-icon(?:-precomposed)?["'][^>]+href=["']([^"']+)["']/i)?.[1]
                   || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']apple-touch-icon(?:-precomposed)?["']/i)?.[1]
                   || ""
    const favicon   = html.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i)?.[1]
                   || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut )?icon["']/i)?.[1]
                   || ""
    const rawLogo   = ogImage || touchIcon || favicon || ""
    const logoUrl   = rawLogo ? resolveUrl(baseUrl, rawLogo) : ""

    // ── Brand color ───────────────────────────────────────────────────────────
    const themeRaw   = extractMeta(html, "theme-color") || extractMeta(html, "msapplication-TileColor") || ""
    const brandColor = /^#[0-9a-fA-F]{3,8}$/.test(themeRaw) ? themeRaw : ""

    // ── Menu from JSON-LD ─────────────────────────────────────────────────────
    const menuSections = parseMenuFromJsonLd(html)

    return NextResponse.json({
      restaurantName,
      logoUrl,
      brandColor,
      menuSections,
      scrapedFrom: baseUrl,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    const isTimeout = msg.toLowerCase().includes("timeout") || msg.toLowerCase().includes("abort")
    return NextResponse.json(
      { error: isTimeout ? "Site took too long to respond (>12s)" : `Could not reach site: ${msg}` },
      { status: isTimeout ? 408 : 422 }
    )
  }
}
