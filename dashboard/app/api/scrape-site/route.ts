import { NextRequest, NextResponse } from "next/server"

// ── Types ─────────────────────────────────────────────────────────────────────
interface MenuItemOut    { name: string; description: string; price: string; tags: string[] }
interface MenuSectionOut { title: string; items: MenuItemOut[] }
interface MenuItemRaw    { name?: string; description?: string; offers?: { price?: string | number } | Array<{ price?: string | number }>; suitableForDiet?: string | string[] }
interface MenuSectionRaw { name?: string; hasMenuItem?: MenuItemRaw[] }
interface MenuSchema     { "@type"?: string; hasMenuSection?: MenuSectionRaw[] }
interface RestaurantSchema { "@type"?: string; menu?: string | { "@id"?: string; url?: string } }

// ── Utilities ─────────────────────────────────────────────────────────────────
function extractMeta(html: string, name: string): string {
  const pats = [
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, "i"),
    new RegExp(`<meta[^>]+property=["']${name}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${name}["']`, "i"),
  ]
  for (const p of pats) { const m = html.match(p); if (m?.[1]) return m[1].trim() }
  return ""
}

function resolveUrl(base: string, path: string): string {
  if (!path || path.startsWith("data:")) return ""
  if (path.startsWith("http")) return path
  if (path.startsWith("//"))   return `https:${path}`
  try {
    const u = new URL(base)
    return path.startsWith("/") ? `${u.origin}${path}` : `${u.origin}/${path}`
  } catch { return path }
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&apos;/g, "'").replace(/&quot;/g, '"')
}

async function fetchHtml(url: string, ms = 9_000): Promise<string> {
  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      signal: AbortSignal.timeout(ms),
      redirect: "follow",
    })
    return r.ok ? r.text() : ""
  } catch { return "" }
}

// ── Logo ──────────────────────────────────────────────────────────────────────
function findLogo(html: string, baseUrl: string): string {
  // 1. og:image (most reliable — usually the restaurant's hero/logo image)
  const ogImage = extractMeta(html, "og:image")
  if (ogImage) return resolveUrl(baseUrl, ogImage)

  // 2. apple-touch-icon
  const touch =
    html.match(/<link[^>]+rel=["']apple-touch-icon(?:-precomposed)?["'][^>]+href=["']([^"']+)["']/i)?.[1] ||
    html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']apple-touch-icon(?:-precomposed)?["']/i)?.[1] || ""
  if (touch) return resolveUrl(baseUrl, touch)

  // 3. <img> with "logo" or "brand" in src / alt / class / id
  const imgRe = /<img([^>]+)>/gi
  let m: RegExpExecArray | null
  while ((m = imgRe.exec(html)) !== null) {
    const a   = m[1]
    const src = a.match(/src=["']([^"']+)["']/i)?.[1] || ""
    const alt = (a.match(/alt=["']([^"']*?)["']/i)?.[1] || "").toLowerCase()
    const cls = (a.match(/class=["']([^"']*?)["']/i)?.[1] || "").toLowerCase()
    const id  = (a.match(/id=["']([^"']*?)["']/i)?.[1]  || "").toLowerCase()
    if (src && /logo|brand/.test(src.toLowerCase() + alt + cls + id))
      return resolveUrl(baseUrl, src)
  }

  // 4. Favicon (last resort)
  const fav =
    html.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i)?.[1] ||
    html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut )?icon["']/i)?.[1] || ""
  return fav ? resolveUrl(baseUrl, fav) : ""
}

// ── Brand color ───────────────────────────────────────────────────────────────
function findBrandColor(html: string): string {
  const themeRaw = extractMeta(html, "theme-color") || extractMeta(html, "msapplication-TileColor")
  if (/^#[0-9a-fA-F]{3,8}$/.test(themeRaw) && themeRaw.toLowerCase() !== "#ffffff" && themeRaw.toLowerCase() !== "#fff")
    return themeRaw

  const styles = (html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || []).join("\n")
  for (const re of [
    /--(?:primary|brand|main|accent|theme)[-_]?color\s*:\s*(#[0-9a-fA-F]{3,8})/i,
    /--color-(?:primary|brand|main|accent|theme)\s*:\s*(#[0-9a-fA-F]{3,8})/i,
    /--(?:color-)?primary\s*:\s*(#[0-9a-fA-F]{3,8})/i,
  ]) { const hit = styles.match(re); if (hit?.[1]) return hit[1] }

  const headerBlock = styles.match(/(?:header|\.header|#header|\.navbar|\.nav-bar)[^{]*\{([^}]+)\}/gi)?.[0] || ""
  const bgHit = headerBlock.match(/background(?:-color)?\s*:\s*(#[0-9a-fA-F]{3,8})/i)
  if (bgHit?.[1] && !/^#f{3,6}$|^#fff/i.test(bgHit[1])) return bgHit[1]

  return ""
}

// ── Menu: JSON-LD (schema.org/Menu) ──────────────────────────────────────────
function parseMenuJsonLd(html: string): MenuSectionOut[] {
  const sections: MenuSectionOut[] = []
  const scripts = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || []
  for (const script of scripts) {
    try {
      const data = JSON.parse(script.replace(/<script[^>]*>/i, "").replace(/<\/script>/i, "")) as Record<string, unknown>
      const schemas: unknown[] = Array.isArray(data) ? data
        : Array.isArray(data["@graph"]) ? (data["@graph"] as unknown[]) : [data]
      for (const raw of schemas) {
        const s = raw as MenuSchema
        if (s["@type"] === "Menu" && Array.isArray(s.hasMenuSection)) {
          for (const sec of s.hasMenuSection) {
            const items: MenuItemOut[] = (sec.hasMenuItem || []).map((it: MenuItemRaw) => {
              const arr   = Array.isArray(it.offers) ? it.offers : (it.offers ? [it.offers] : [])
              const price = arr[0]?.price != null ? `$${arr[0].price}` : ""
              const diet  = Array.isArray(it.suitableForDiet) ? it.suitableForDiet : (it.suitableForDiet ? [it.suitableForDiet] : [])
              const tags  = diet.map((d: string) => d.replace(/https?:\/\/schema\.org\//g, "").replace(/RestrictedDiet$/, ""))
              return { name: it.name || "", description: it.description || "", price, tags }
            }).filter((i: MenuItemOut) => i.name)
            if (items.length > 0) sections.push({ title: sec.name || "Menu", items })
          }
        }
      }
    } catch { /* skip */ }
  }
  return sections
}

// ── Menu: Restaurant JSON-LD → follow menu URL ────────────────────────────────
function findMenuUrlFromRestaurantJsonLd(html: string, baseUrl: string): string {
  const scripts = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || []
  for (const script of scripts) {
    try {
      const data = JSON.parse(script.replace(/<script[^>]*>/i, "").replace(/<\/script>/i, "")) as Record<string, unknown>
      const schemas: unknown[] = Array.isArray(data) ? data
        : Array.isArray(data["@graph"]) ? (data["@graph"] as unknown[]) : [data]
      for (const raw of schemas) {
        const s = raw as RestaurantSchema
        if (s["@type"] === "Restaurant" || s["@type"] === "FoodEstablishment") {
          if (typeof s.menu === "string" && s.menu)
            return resolveUrl(baseUrl, s.menu)
          if (s.menu && typeof s.menu === "object") {
            const u = (s.menu as { url?: string; "@id"?: string }).url || (s.menu as { "@id"?: string })["@id"] || ""
            if (u) return resolveUrl(baseUrl, u)
          }
        }
      }
    } catch { /* skip */ }
  }
  return ""
}

// ── Menu: HTML heuristic (section headings → items, with or without prices) ───
function parseMenuHtml(html: string): MenuSectionOut[] {
  // Strip non-content elements
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi,  " ")
    .replace(/<style[\s\S]*?<\/style>/gi,    " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi,        " ")
    .replace(/<!--[\s\S]*?-->/g,             " ")

  // Tag block-level elements so we can reconstruct structure
  const tagged = cleaned
    .replace(/<h2[^>]*>/gi,  "\n§H2§").replace(/<\/h2>/gi,  "\n")
    .replace(/<h3[^>]*>/gi,  "\n§H3§").replace(/<\/h3>/gi,  "\n")
    .replace(/<h4[^>]*>/gi,  "\n§H4§").replace(/<\/h4>/gi,  "\n")
    .replace(/<h5[^>]*>/gi,  "\n§H5§").replace(/<\/h5>/gi,  "\n")
    .replace(/<li[^>]*>/gi,  "\n§LI§").replace(/<\/li>/gi,  "\n")
    .replace(/<dt[^>]*>/gi,  "\n§DT§").replace(/<\/dt>/gi,  "\n")
    .replace(/<dd[^>]*>/gi,  "\n§DD§").replace(/<\/dd>/gi,  "\n")
    .replace(/<p[^>]*>/gi,   "\n§P§" ).replace(/<\/p>/gi,   "\n")
    .replace(/<(div|section|article|tr|td|header|footer|nav|span)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/[ \t]+/g, " ")

  const priceRe = /\$\s*(\d{1,3}(?:\.\d{1,2})?)/
  const junkRe  = /^(home|about|contact|reservations?|order online|careers?|gift cards?|hours|location|copyright|privacy|follow|sign up|newsletter|login|log in|sign in|back to top|©|\d{4}\s)$/i

  const sections: MenuSectionOut[] = []
  let currentSection: MenuSectionOut | null = null

  const lines = tagged.split("\n").map(l => l.trim()).filter(l => l.length > 0)

  for (let i = 0; i < lines.length; i++) {
    const raw     = lines[i]
    const tag     = raw.match(/^§([^§]+)§/)?.[1] || ""
    const content = decodeHtml(raw.replace(/^§[^§]+§/, "").trim())
    if (!content || content.length < 2) continue

    const isSection = tag === "H2" || tag === "H3"
    const isItem    = tag === "H4" || tag === "H5" || tag === "LI" || tag === "DT"
    const isDesc    = tag === "DD" || tag === "P"

    if (isSection) {
      if (content.length >= 2 && content.length <= 80 && !junkRe.test(content)) {
        currentSection = { title: content, items: [] }
        sections.push(currentSection)
      }

    } else if (isItem) {
      const priceMatch = content.match(priceRe)
      const price = priceMatch ? `$${priceMatch[1]}` : ""
      const name  = decodeHtml(content.replace(priceRe, "").replace(/[\s·—.]+$/, "").trim())

      if (name.length >= 2 && name.length <= 120 && !junkRe.test(name) && !/^https?:\/\//.test(name)) {
        if (!currentSection) {
          currentSection = { title: "Menu", items: [] }
          sections.push(currentSection)
        }
        // Peek at next lines for a description
        let description = ""
        for (let j = i + 1; j <= i + 2 && j < lines.length; j++) {
          const nRaw  = lines[j]
          const nTag  = nRaw.match(/^§([^§]+)§/)?.[1] || ""
          const nText = decodeHtml(nRaw.replace(/^§[^§]+§/, "").trim())
          if ((nTag === "DD" || nTag === "P" || !nTag) && nText.length > 5 && nText.length < 300 && !priceRe.test(nText) && !junkRe.test(nText)) {
            description = nText; break
          }
          if (nTag === "H2" || nTag === "H3" || nTag === "H4" || nTag === "LI" || nTag === "DT") break
        }
        currentSection.items.push({ name, description, price, tags: [] })
      }

    } else if (isDesc) {
      if (currentSection?.items.length) {
        const last = currentSection.items[currentSection.items.length - 1]
        if (!last.description && content.length > 5 && content.length < 300 && !junkRe.test(content))
          last.description = content
      }

    } else {
      // Untagged line — still try price extraction
      const priceMatch = content.match(priceRe)
      if (priceMatch && content.length < 120) {
        const priceIdx = content.indexOf(priceMatch[0])
        const name = decodeHtml(content.slice(0, priceIdx).replace(/[\s·—.]+$/, "").trim())
        if (name.length >= 2 && name.length <= 80 && !junkRe.test(name)) {
          if (!currentSection) { currentSection = { title: "Menu", items: [] }; sections.push(currentSection) }
          currentSection.items.push({ name, description: "", price: `$${priceMatch[1]}`, tags: [] })
        }
      }
    }
  }

  // Deduplicate items by name (case-insensitive), drop sections with 0 items
  return sections
    .map(s => ({
      ...s,
      items: s.items
        .filter((it, idx, arr) => arr.findIndex(x => x.name.toLowerCase() === it.name.toLowerCase()) === idx)
    }))
    .filter(s => s.items.length >= 1)
    .slice(0, 16) // cap at 16 sections
}

// ── Menu discovery: nav link heuristic ───────────────────────────────────────
function findMenuNavUrl(html: string, baseUrl: string): string {
  // Match full anchor tags so we can check link text too
  const aRe = /<a([^>]+)>([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = aRe.exec(html)) !== null) {
    const href = m[1].match(/href=["']([^"']+)["']/i)?.[1] || ""
    if (!href || href.startsWith("#") || href.startsWith("mailto") || href.startsWith("tel")) continue
    const text = m[2].replace(/<[^>]+>/g, "").trim()
    if (/^\/?(menu|our[-_]?menu|food[-_]?menu|food[-_]?drink|dine|dining)(\/?$|[?#])/i.test(href))
      return resolveUrl(baseUrl, href)
    if (/\/menu\/?$/.test(href))
      return resolveUrl(baseUrl, href)
    if (/^(menu|our menu|food menu|view menu|full menu|food & drinks?|food and drinks?)$/i.test(text))
      return resolveUrl(baseUrl, href)
  }
  return ""
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
    const ogSiteName     = extractMeta(html, "og:site_name")
    const titleRaw       = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || ""
    const titleClean     = titleRaw.split(/\s*[\|\-–—·•]\s*/)[0].trim()
    const restaurantName = ogSiteName || titleClean || extractMeta(html, "og:title") || ""

    // ── Logo ─────────────────────────────────────────────────────────────────
    const logoUrl = findLogo(html, baseUrl)

    // ── Brand color ───────────────────────────────────────────────────────────
    const brandColor = findBrandColor(html)

    // ── Menu (try multiple strategies in priority order) ──────────────────────
    let menuSections: MenuSectionOut[] = []

    // Strategy 1: JSON-LD Menu schema on main page
    menuSections = parseMenuJsonLd(html)

    if (menuSections.length === 0) {
      // Strategy 2: Follow menu URL from Restaurant JSON-LD schema
      const jsonLdMenuUrl = findMenuUrlFromRestaurantJsonLd(html, baseUrl)
      if (jsonLdMenuUrl && jsonLdMenuUrl !== baseUrl) {
        const menuHtml = await fetchHtml(jsonLdMenuUrl)
        if (menuHtml) {
          menuSections = parseMenuJsonLd(menuHtml)
          if (menuSections.length === 0) menuSections = parseMenuHtml(menuHtml)
        }
      }
    }

    if (menuSections.length === 0) {
      // Strategy 3: Follow nav link to menu page
      const navMenuUrl = findMenuNavUrl(html, baseUrl)
      if (navMenuUrl && navMenuUrl !== baseUrl) {
        const menuHtml = await fetchHtml(navMenuUrl)
        if (menuHtml) {
          menuSections = parseMenuJsonLd(menuHtml)
          if (menuSections.length === 0) menuSections = parseMenuHtml(menuHtml)
        }
      }
    }

    if (menuSections.length === 0) {
      // Strategy 4: Parse main page HTML directly
      menuSections = parseMenuHtml(html)
    }

    return NextResponse.json({ restaurantName, logoUrl, brandColor, menuSections, scrapedFrom: baseUrl })

  } catch (e: unknown) {
    const msg       = e instanceof Error ? e.message : String(e)
    const isTimeout = msg.toLowerCase().includes("timeout") || msg.toLowerCase().includes("abort")
    return NextResponse.json(
      { error: isTimeout ? "Site took too long to respond (>12s)" : `Could not reach site: ${msg}` },
      { status: isTimeout ? 408 : 422 },
    )
  }
}
