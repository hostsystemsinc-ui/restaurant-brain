import { NextRequest, NextResponse } from "next/server"
import { CURRENT_VERSION, EFFECTIVE_DATE, TERMS_SECTIONS, type TermsSection } from "@/lib/terms"
import fs from "fs"

// ── Persistence ───────────────────────────────────────────────────────────────
// Two-layer storage so pushed terms survive process hot-reloads and most
// Railway container restarts (which only happen on new deploys, not random
// process restarts).
//
//   Layer 1: module-level variable (in-memory) — fastest, cleared on any restart
//   Layer 2: /tmp/host-terms-override.json — survives hot-reloads; cleared on
//             Railway deploy (new container), which is the desired behaviour
//             since a new deploy = new canonical lib/terms.ts anyway.
//
// NOTE: This is intentionally per-server-instance. On Railway's free tier
// (single instance), this is fine. Multi-instance setups would need a shared
// store (e.g. Supabase, Redis). If you need that, update lib/terms.ts instead.
//
// The pending/accepted slug state was REMOVED from here.
// Terms push state is stored per-client in localStorage on the station device.
// This survives server restarts and requires no DB write.

const OVERRIDE_FILE = "/tmp/host-terms-override.json"

interface TermsState {
  version:       string
  effectiveDate: string
  sections:      TermsSection[]
  publishedAt:   string
  publishedBy:   string
}

let overrideState: TermsState | null = null

function readPersistedState(): TermsState | null {
  try {
    const raw = fs.readFileSync(OVERRIDE_FILE, "utf-8")
    return JSON.parse(raw) as TermsState
  } catch {
    return null
  }
}

function persistState(state: TermsState | null) {
  try {
    if (state) {
      fs.writeFileSync(OVERRIDE_FILE, JSON.stringify(state), "utf-8")
    } else {
      fs.unlinkSync(OVERRIDE_FILE)
    }
  } catch { /* /tmp may be unavailable in some environments — non-fatal */ }
}

function getActiveState(): TermsState {
  // Restore from disk if in-memory was cleared (e.g. hot-reload)
  if (!overrideState) {
    overrideState = readPersistedState()
  }

  // Guard: if the override was pushed from an older canonical version than the
  // current build (e.g. pushed from MSA-v2.0 but lib/terms.ts is now MSA-v2.1),
  // auto-invalidate it so newly deployed terms changes are always visible.
  // A push version looks like "MSA-v2.1-2026-05-push20260513120000"; strip the
  // -pushNNN suffix to get the canonical base for comparison.
  if (overrideState) {
    const canonicalBase = CURRENT_VERSION.replace(/-push\d+$/, "")
    const overrideBase  = overrideState.version.replace(/-push\d+$/, "")
    if (overrideBase !== canonicalBase) {
      // Override is stale — clear both layers so fresh canonical sections are served
      overrideState = null
      persistState(null)
    }
  }

  return overrideState ?? {
    version:       CURRENT_VERSION,
    effectiveDate: EFFECTIVE_DATE,
    sections:      TERMS_SECTIONS,
    publishedAt:   "",
    publishedBy:   "",
  }
}

const OWNER_SECRET = process.env.OWNER_SECRET || ""

function checkAuth(req: NextRequest): boolean {
  const secret = req.nextUrl.searchParams.get("secret") ||
    req.headers.get("x-owner-secret") || ""
  return OWNER_SECRET ? secret === OWNER_SECRET : secret.length > 0
}

// GET — return current terms (override > persisted > canonical)
export async function GET() {
  const state = getActiveState()
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
    persistState(overrideState)
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
  persistState(null)
  return NextResponse.json({ ok: true, reverted: true })
}
