import { NextRequest, NextResponse } from "next/server"

// ── Shared types ──────────────────────────────────────────────────────────────
interface MenuItemOut    { name: string; description: string; price: string; tags: string[] }
interface MenuSectionOut { title: string; items: MenuItemOut[] }

// ── Utilities ─────────────────────────────────────────────────────────────────
function extractMeta(html: string, name: string): string {
  const patterns = [
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, "i"),
    new RegExp(`<meta[^>]+property=["']${name}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${name}["']`, "i"),
  ]
  for (const p of patterns) { const m = html.match(p); if (m?.[1]) return m[1].trim() }
  return ""
}

function resolveUrl(base: string, path: string): string {
  if (!path) return ""
  if (path.startsWith("data:")) return ""          // skip inline data URIs
  if (path.startsWith("http"))  return path
  if (path.startsWith("//"))    return `https:${path}`
  try {
    const u = new URL(base)
    if (path.startsWith("/")) return `${u.origin}${path}`
    return `${u.origin}/${path}`
  } catch { return path }
}

async function fetchHtml(url: string, timeoutMs = 10_000): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      signal:   AbortSignal.timeout(timeoutMs),
      redirect: "follow",
    })
    if (!res.ok) return ""
    return res.text()
  } catch { return "" }
}

// ── Logo extraction ───────────────────────────────────────────────────────────
function findLogo(html: string, baseUrl: string): string {
  // 1. og:image (most reliable on real restaurant sites)
  const ogImage = extractMeta(html, "og:image")
  if (ogImage) return resolveUrl(baseUrl, ogImage)

  // 2. apple-touch-icon (usually the app icon / logo)
  const touchIcon =
    html.match(/<link[^>]+rel=["']apple-touch-icon(?:-precomposed)?["'][^>]+href=["']([^"']+)["']/i)?.[1] ||
    html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']apple-touch-icon(?:-precomposed)?["']/i)?.[1] || ""
  if (touchIcon) return resolveUrl(baseUrl, touchIcon)

  // 3. <img> tags whose src / alt / class / id contains "logo" or "brand"
  const imgRe = /<img([^>]+)>/gi
  let m: RegExpExecArray | null
  while ((m = imgRe.exec(html)) !== null) {
    const attrs = m[1]
    const src = attrs.match(/src=["']([^"']+)["']/i)?.[1] || ""
    const alt = (attrs.match(/alt=["']([^"']*?)["']/i)?.[1] || "").toLowerCase()
    const cls = (attrs.match(/class=["']([^"']*?)["']/i)?.[1] || "").toLowerCase()
    const id  = (attrs.match(/id=["']([^"']*?)["']/i)?.[1] || "").toLowerCase()
    if (src && /logo|brand/.test(src.toLowerCase() + alt + cls + id)) {
      return resolveUrl(baseUrl, src)
    }
  }

  // 4. SVG <use> / <symbol> logos referenced in an <img>
  // (not practical via regex — skip)

  // 5. Favicon as last resort
  const favicon =
    html.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i)?.[1] ||
    html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut )?icon["']/i)?.[1] || ""
  if (favicon) return resolveUrl(baseUrl, favicon)

  return ""
}

// ── Brand color extraction ────────────────────────────────────────────────────
function findBrandColor(html: string): string {
  // 1. theme-color / msapplication-TileColor meta
  const themeMeta = extractMeta(html, "theme-color") || extractMeta(html, "msapplication-TileColor")
  if (/^#[0-9a-fA-F]{3,8}$/.test(themeMeta)) return themeMeta

  // 2. CSS custom properties (--primary-color, --brand-color, --accent, etc.)
  const styles = (html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || []).join("\n")
  const varPatterns = [
    /--(?:primary|brand|main|accent|theme)[-_]?color\s*:\s*(#[0-9a-fA-F]{3,8})/i,
    /--color-(?:primary|brand|main|accent|theme)\s*:\s*(#[0-9a-fA-F]{3,8})/i,
    /--(?:color-)?primary\s*:\s*(#[0-9a-fA-F]{3,8})/i,
  ]
  for (const re of varPatterns) {
    const hit = styles.match(re)
    if (hit?.[1]) return hit[1]
  }

  // 3. body or header background-color in <style>
  const bgPatterns = [
    /(?:^|[{;])\s*background(?:-color)?\s*:\s*(#[0-9a-fA-F]{3,8})/i,
  ]
  const headerBlock = styles.match(/(?:header|\.header|#header|nav|\.nav|\.navbar)[^{]*\{([^}]+)\}/gi)?.[0] || ""
  for (const re of bgPatterns) {
    const hit = headerBlock.match(re)
    if (hit?.[1] && hit[1].toLowerCase() !== "#ffffff" && hit[1].toLowerCase() !== "#fff") return hit[1]
  }

  return ""
}

// ── Menu page discovery ───────────────────────────────────────────────────────
function findMenuPageUrl(html: string, baseUrl: string): string {
  // Find anchor tags that look like they lead to the menu
  const aRe = /<a([^>]+)>/gi
  let m: RegExpExecArray | null
  while ((m = aRe.exec(html)) !== null) {
    const attrs  = m[1]
    const href   = attrs.match(/href=["']([^"']+)["']/i)?.[1] || ""
    if (!href || href.startsWith("#") || href.startsWith("mailto") || href.startsWith("tel")) continue
    // Match href patterns like /menu, /our-menu, /food, /dine, /dining
    if (/^\/?(menu|our[-_]?menu|food[-_]?menu|drinks?[-_]?menu|food[-_]?and[-_]?drink|dine|dining)(\/?$|[?#])/i.test(href)) {
      return resolveUrl(baseUrl, href)
    }
    // Also match external-looking links with "menu" prominently
    if (/\/menu\/?$/.test(href)) return resolveUrl(baseUrl, href)
  }

  // Also scan link text (extracted via a quick text pass after anchor open)
  const fullAnchorRe = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  while ((m = fullAnchorRe.exec(html)) !== null) {
    const href = m[1]
    const text = m[2].replace(/<[^>]+>/g, "").trim()
    if (!href || href.startsWith("#")) continue
    if (/^(menu|our menu|food menu|view menu|full menu|food & drinks?|food and drinks?)$/i.test(text)) {
      return resolveUrl(baseUrl, href)
    }
  }

  return ""
}

// ── JSON-LD menu parser ───────────────────────────────────────────────────────
interface MenuItemRaw    { name?: string; description?: string; offers?: { price?: string | number } | Array<{ price?: string | number }>; suitableForDiet?: string | string[] }
interface MenuSectionRaw { name?: string; hasMenuItem?: MenuItemRaw[] }
interface MenuSchema     { "@type"?: string; hasMenuSection?: MenuSectionRaw[] }

function parseMenuFromJsonLd(html: string): MenuSectionOut[] {
  const sections: MenuSectionOut[] = []
  const scriptTags = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || []
  for (const script of scriptTags) {
    try {
      const content = script.replace(/<script[^>]*>/i, "").replace(/<\/script>/i, "")
      const data    = JSON.parse(content) as Record<string, unknown>
      const schemas: unknown[] = Array.isArray(data) ? data
        : Array.isArray(data["@graph"]) ? (data["@graph"] as unknown[])
        : [data]

      for (const schema of schemas) {
        const s = schema as MenuSchema
        if (s["@type"] === "Menu" && Array.isArray(s.hasMenuSection)) {
          for (const section of s.hasMenuSection) {
            const items: MenuItemOut[] = (section.hasMenuItem || []).map((item: MenuItemRaw) => {
              const offersArr  = Array.isArray(item.offers) ? item.offers : (item.offers ? [item.offers] : [])
              const priceRaw   = offersArr[0]?.price
              const price      = priceRaw != null ? `$${priceRaw}` : ""
              const dietRaw    = item.suitableForDiet
              const diets      = Array.isArray(dietRaw) ? dietRaw : (dietRaw ? [dietRaw] : [])
              const tags       = diets.map((d: string) =>
                d.replace(/https?:\/\/schema\.org\//g, "").replace(/RestrictedDiet$/, ""))
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

// ── HTML menu parser (heuristic) ──────────────────────────────────────────────
function parseMenuFromHtml(html: string): MenuSectionOut[] {
  // Strip scripts, styles, SVGs, comments
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")

  // Inject newlines at block-level elements so text structure is preserved
  const text = cleaned
    .replace(/<(\/?(h[1-6]|p|div|li|tr|td|dt|dd|section|article|header|footer|nav))[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ").replace(/&#\d+;/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")

  const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0)
  const priceRe = /\$\s*(\d{1,3}(?:\.\d{1,2})?)/

  const sections: MenuSectionOut[] = []
  let currentSection: MenuSectionOut | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const priceMatch = line.match(priceRe)

    if (priceMatch) {
      const priceIdx = line.indexOf(priceMatch[0])
      // Everything before the price (strip trailing dots/dashes used as dot-leaders)
      let itemName = line.slice(0, priceIdx).replace(/[\s.\-·]+$/, "").trim()

      // If name is empty or too short, look at the previous line
      if (itemName.length < 2 && i > 0) {
        const prev = lines[i - 1]
        if (!priceRe.test(prev) && prev.length >= 2 && prev.length <= 80) {
          itemName = prev
        }
      }

      if (itemName.length >= 2 && itemName.length <= 100) {
        // Ensure we have a section
        if (!currentSection) {
          currentSection = { title: "Menu", items: [] }
          sections.push(currentSection)
        }

        // Peek at next line for a description (no price, reasonable length)
        let description = ""
        if (i + 1 < lines.length) {
          const nxt = lines[i + 1]
          if (!priceRe.test(nxt) && nxt.length > 10 && nxt.length < 200) {
            description = nxt
          }
        }

        currentSection.items.push({
          name:        itemName,
          description,
          price:       `$${priceMatch[1]}`,
          tags:        [],
        })
      }
    } else {
      // Potential section heading: short, capitalised, next few lines have prices
      if (line.length >= 3 && line.length <= 60) {
        const upcoming = lines.slice(i + 1, i + 10)
        const priceCount = upcoming.filter(l => priceRe.test(l)).length
        if (priceCount >= 2) {
          currentSection = { title: line, items: [] }
          sections.push(currentSection)
        }
      }
    }
  }

  // Deduplicate items by name within each section, drop sections with <2 items
  return sections
    .map(s => ({ ...s, items: s.items.filter((it, idx, arr) => arr.findIndex(x => x.name === it.name) === idx) }))
    .filter(s => s.items.length >= 2)
}

// ── Main handler ──────────────────────────────────────────────────────────────
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
      signal:   AbortSignal.timeout(12_000),
      redirect: "follow",
    })
    if (!res.ok) return NextResponse.json({ error: `Site returned HTTP ${res.status}` }, { status: 422 })

    const html    = await res.text()
    const baseUrl = res.url || url

    // ── Name ─────────────────────────────────────────────────────────────────
    const ogSiteName = extractMeta(html, "og:site_name")
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    const rawTitle   = titleMatch?.[1]?.trim() || ""
    const cleanTitle = rawTitle.split(/\s*[\|\-–—·•]\s*/)[0].trim()
    const restaurantName = ogSiteName || cleanTitle || extractMeta(html, "og:title") || ""

    // ── Logo ─────────────────────────────────────────────────────────────────
    const logoUrl = findLogo(html, baseUrl)

    // ── Brand color ───────────────────────────────────────────────────────────
    const brandColor = findBrandColor(html)

    // ── Menu — JSON-LD first, then follow menu page, then HTML parse ──────────
    let menuSections = parseMenuFromJsonLd(html)

    if (menuSections.length === 0) {
      // Try the menu sub-page (e.g. /menu, /food)
      const menuPageUrl = findMenuPageUrl(html, baseUrl)
      if (menuPageUrl && menuPageUrl !== baseUrl) {
        const menuHtml = await fetchHtml(menuPageUrl, 8_000)
        if (menuHtml) {
          menuSections = parseMenuFromJsonLd(menuHtml)
          if (menuSections.length === 0) {
            menuSections = parseMenuFromHtml(menuHtml)
          }
        }
      }

      // Still nothing — try parsing the main page HTML directly
      if (menuSections.length === 0) {
        menuSections = parseMenuFromHtml(html)
      }
    }

    return NextResponse.json({ restaurantName, logoUrl, brandColor, menuSections, scrapedFrom: baseUrl })

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    const isTimeout = msg.toLowerCase().includes("timeout") || msg.toLowerCase().includes("abort")
    return NextResponse.json(
      { error: isTimeout ? "Site took too long to respond (>12s)" : `Could not reach site: ${msg}` },
      { status: isTimeout ? 408 : 422 },
    )
  }
}
