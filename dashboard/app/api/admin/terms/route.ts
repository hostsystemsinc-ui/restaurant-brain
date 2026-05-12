import { NextRequest, NextResponse } from "next/server"
import { CURRENT_VERSION, EFFECTIVE_DATE, TERMS_SECTIONS, type TermsSection } from "@/lib/terms"

// ── In-memory override store ──────────────────────────────────────────────────
// Persists for the lifetime of the Next.js server process.
// On redeploy, reverts to the canonical lib/terms.ts values.
// For permanent storage, update lib/terms.ts and redeploy.

interface TermsState {
  version:       string
  effectiveDate: string
  sections:      TermsSection[]
  publishedAt:   string
  publishedBy:   string
}

let overrideState: TermsState | null = null

// slugs that must accept the current terms before continuing on the station
let pendingSlugs: Set<string> = new Set()
// slugs that have accepted (cleared on new push so they'd need to re-accept)
let acceptedSlugs: Map<string, { acceptedAt: string; version: string }> = new Map()

const OWNER_SECRET = process.env.OWNER_SECRET || ""

function checkAuth(req: NextRequest): boolean {
  const secret = req.nextUrl.searchParams.get("secret") ||
    req.headers.get("x-owner-secret") || ""
  return OWNER_SECRET ? secret === OWNER_SECRET : secret.length > 0
}

function currentVersion(): string {
  return overrideState?.version ?? CURRENT_VERSION
}

// GET — return current terms (override or canonical) + pending/accepted info
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug")

  // Station-side lightweight check: ?slug=xxx → just return pending status
  if (slug) {
    const isPending = pendingSlugs.has(slug)
    const acceptance = acceptedSlugs.get(slug)
    if (!isPending) {
      return NextResponse.json({ pending: false, acceptance: acceptance ?? null })
    }
    const state = overrideState ?? {
      version:       CURRENT_VERSION,
      effectiveDate: EFFECTIVE_DATE,
      sections:      TERMS_SECTIONS,
      publishedAt:   "",
      publishedBy:   "",
    }
    return NextResponse.json({
      pending: true,
      version: state.version,
      effectiveDate: state.effectiveDate,
      sections: state.sections,
    })
  }

  // Owner-side full response
  const state = overrideState ?? {
    version:       CURRENT_VERSION,
    effectiveDate: EFFECTIVE_DATE,
    sections:      TERMS_SECTIONS,
    publishedAt:   "",
    publishedBy:   "",
  }
  return NextResponse.json({
    ...state,
    isOverride:    !!overrideState,
    pendingSlugs:  Array.from(pendingSlugs),
    acceptedSlugs: Object.fromEntries(acceptedSlugs),
  })
}

// POST — publish a new version OR push to slugs OR record station acceptance
export async function POST(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action")

  // ── Station acceptance (no owner auth needed — client-side call) ────────────
  if (action === "accept") {
    try {
      const body = await req.json() as { slug: string; version: string }
      if (!body.slug) return NextResponse.json({ error: "slug required" }, { status: 400 })
      pendingSlugs.delete(body.slug)
      acceptedSlugs.set(body.slug, {
        acceptedAt: new Date().toISOString(),
        version:    body.version || currentVersion(),
      })
      return NextResponse.json({ ok: true })
    } catch {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 })
    }
  }

  // All other POST actions require owner auth
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // ── Push to slugs (mark specific clients as needing acceptance) ─────────────
  if (action === "push") {
    try {
      const body = await req.json() as { slugs: string[] }
      if (!Array.isArray(body.slugs)) return NextResponse.json({ error: "slugs array required" }, { status: 400 })
      body.slugs.forEach(s => {
        pendingSlugs.add(s)
        acceptedSlugs.delete(s) // reset prior acceptance
      })
      return NextResponse.json({ ok: true, pendingSlugs: Array.from(pendingSlugs) })
    } catch {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 })
    }
  }

  // ── Publish a new version ───────────────────────────────────────────────────
  try {
    const body = await req.json() as Partial<TermsState & { publishedBy: string }>
    if (!body.version || !body.sections || !Array.isArray(body.sections)) {
      return NextResponse.json({ error: "version and sections required" }, { status: 400 })
    }
    overrideState = {
      version:       body.version,
      effectiveDate: body.effectiveDate || new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
      sections:      body.sections,
      publishedAt:   new Date().toISOString(),
      publishedBy:   body.publishedBy || "Owner Console",
    }
    return NextResponse.json({ ok: true, state: overrideState })
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
}

// DELETE — revert to canonical lib/terms.ts
export async function DELETE(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  overrideState = null
  return NextResponse.json({ ok: true, reverted: true })
}
