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

const OWNER_SECRET = process.env.OWNER_SECRET || ""

function checkAuth(req: NextRequest): boolean {
  const secret = req.nextUrl.searchParams.get("secret") ||
    req.headers.get("x-owner-secret") || ""
  return OWNER_SECRET ? secret === OWNER_SECRET : secret.length > 0
}

// GET — return current terms (override or canonical)
export async function GET() {
  const state = overrideState ?? {
    version:       CURRENT_VERSION,
    effectiveDate: EFFECTIVE_DATE,
    sections:      TERMS_SECTIONS,
    publishedAt:   "",
    publishedBy:   "",
  }
  return NextResponse.json({ ...state, isOverride: !!overrideState })
}

// POST — publish a new version (owner-auth required)
export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
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
