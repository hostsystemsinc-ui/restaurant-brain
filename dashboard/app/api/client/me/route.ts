import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { RESTAURANT_CONFIG } from "@/lib/restaurant-config"

const RAILWAY_API = "https://restaurant-brain-production.up.railway.app"

// ── Floor plan coordinate conversion ─────────────────────────────────────────
// The wizard stores tables with CENTER-based percentage coordinates.
// /station/page.tsx expects LEFT-EDGE-based pixel coordinates in a canvasW×canvasH space.
// We convert: set canvasW = round(aspect * 100), canvasH = 100
// so that percentage-to-pixel math in the station page yields correct percentages.
interface WizardFloorInput {
  tables?: Array<{
    id?: string
    number: number
    label?: string
    capacity?: number
    shape: string
    x: number   // center_x as % of canvas width
    y: number   // center_y as % of canvas height
    w: number   // width as % of canvas width
    h: number   // height as % of canvas height
  }>
  objects?: Array<{
    id: string
    type: string
    x: number; y: number; w: number; h: number
    label?: string
  }>
  canvasAspect?: number
}

interface ConvertedFloorPlan {
  canvasW: number
  canvasH: number
  tables: Array<{
    number: number
    label?: string
    shape: "round" | "square" | "rect" | "diamond"
    x: number; y: number; w: number; h: number
    section: string
  }>
  objects?: Array<{
    id: string
    type: "door" | "window" | "stairs" | "label" | "counter" | "host"
    x: number; y: number; w: number; h: number
    label?: string
  }>
}

function convertFloorPlan(fp: WizardFloorInput | null): ConvertedFloorPlan | null {
  if (!fp || !Array.isArray(fp.tables) || fp.tables.length === 0) return null

  const asp     = fp.canvasAspect || 1.62
  const canvasW = Math.round(asp * 100)
  const canvasH = 100

  // Shape mapping: wizard uses "circle", station uses "round"; others match
  const shapeMap: Record<string, "round" | "square" | "rect" | "diamond"> = {
    circle:  "round",
    round:   "round",
    square:  "square",
    rect:    "rect",
    booth:   "rect",
    diamond: "diamond",
  }

  const tables = fp.tables.map(t => ({
    number:  t.number,
    label:   t.label || undefined,
    // Convert center-based % → left-edge pixel in canvasW×canvasH space
    x: (t.x - t.w / 2) * asp,
    y:  t.y - t.h / 2,
    w:  t.w * asp,
    h:  t.h,
    shape:   shapeMap[t.shape] ?? "rect",
    section: "main",
  }))

  const objects = fp.objects?.map(o => ({
    id:    o.id,
    type:  o.type as "door" | "window" | "stairs" | "label" | "counter" | "host",
    x:     o.x * asp,
    y:     o.y,
    w:     o.w * asp,
    h:     o.h,
    label: o.label,
  }))

  return { canvasW, canvasH, tables, objects }
}

// GET /api/client/me — returns restaurant config for the currently logged-in client
export async function GET() {
  const cookieStore = await cookies()
  const session = cookieStore.get("host_client_session")
  if (!session?.value) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  // ── Path 1: hardcoded legacy accounts ────────────────────────────────────
  const config = RESTAURANT_CONFIG[session.value]
  if (config) {
    return NextResponse.json({ account: session.value, ...config })
  }

  // ── Path 2: dynamic lookup from Railway for new clients ───────────────────
  // The session cookie value is the restaurant slug for wizard-created clients.
  const slug = session.value
  try {
    const res = await fetch(
      `${RAILWAY_API}/client/${encodeURIComponent(slug)}/config`,
      { cache: "no-store" }
    )
    if (!res.ok) return NextResponse.json({ error: "Unknown account" }, { status: 404 })

    const d  = await res.json()
    const gc = (d.guest_config || {}) as Record<string, unknown>

    return NextResponse.json({
      account: slug,
      name:    String(gc.restaurantName || d.name || slug),
      city:    "",
      rid:     String(d.restaurant_id || ""),
      slug,
      joinUrl: String(d.join_url || `https://hostplatform.net/client/${slug}/join`),
      logoUrl: typeof gc.logoUrl === "string" ? gc.logoUrl : "",
      // Pre-converted floor plan so /station/page.tsx can use it directly
      floorPlan: convertFloorPlan(d.floor_plan as WizardFloorInput | null),
    })
  } catch {
    return NextResponse.json({ error: "Unknown account" }, { status: 404 })
  }
}
