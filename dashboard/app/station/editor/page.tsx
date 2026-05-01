"use client"

// ─────────────────────────────────────────────────────────────────────────────
// Floor Plan Visual Editor — localhost:3000/station/editor
// Select tables · walls · objects → edit in panel or drag on canvas.
// Three plans: Original Walnut | Southside Indoor | Southside Outdoor
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useCallback, useEffect } from "react"

type Shape   = "round" | "square" | "rect" | "diamond"
type ObjType = "door" | "window" | "stairs" | "label" | "counter" | "host"

interface FloorPos {
  number: number
  label?: string
  shape: Shape
  x: number; y: number; w: number; h: number
  section: string
}

interface FloorWall {
  x1: number; y1: number; x2: number; y2: number
  thickness?: number
}

interface FloorObject {
  id: string
  type: ObjType
  x: number; y: number; w: number; h: number
  label?: string
}

interface FloorPlan {
  name: string
  canvasW: number
  canvasH: number
  tables: FloorPos[]
  walls?: FloorWall[]
  objects?: FloorObject[]
}

type Selection =
  | { kind: "table";  number: number }
  | { kind: "wall";   index: number }
  | { kind: "object"; id: string }
  | null

// ── Object visual config ───────────────────────────────────────────────────────

const OBJ_META: Record<ObjType, {
  bg: string; border: string; text: string
  defaultLabel: string; defaultW: number; defaultH: number
}> = {
  door:    { bg:"rgba(50,185,158,0.5)",   border:"#35c5a5", text:"#a0fff0", defaultLabel:"Door",       defaultW:70,  defaultH:20 },
  window:  { bg:"rgba(110,160,255,0.3)",  border:"#80aaff", text:"#b0d0ff", defaultLabel:"Window",     defaultW:80,  defaultH:12 },
  stairs:  { bg:"rgba(195,150,65,0.45)",  border:"#c89848", text:"#ffe090", defaultLabel:"Stairs",     defaultW:80,  defaultH:65 },
  label:   { bg:"rgba(255,255,255,0.05)", border:"#555",    text:"#aaa",    defaultLabel:"Label",      defaultW:100, defaultH:32 },
  counter: { bg:"rgba(135,85,42,0.55)",   border:"#a86830", text:"#f0c880", defaultLabel:"Counter",    defaultW:160, defaultH:35 },
  host:    { bg:"rgba(110,70,195,0.5)",   border:"#8855e0", text:"#d0a8ff", defaultLabel:"Host Stand", defaultW:80,  defaultH:70 },
}

const DRAG_THRESHOLD = 4

// ── Seed data ──────────────────────────────────────────────────────────────────

const INITIAL_ORIGINAL: FloorPlan = {
  name: "Original Walnut Cafe",
  canvasW: 1168,
  canvasH: 720,
  walls: [
    { x1: 282, y1: 0,   x2: 282,  y2: 720, thickness: 5 },
    { x1: 579, y1: 232, x2: 1079, y2: 232, thickness: 9 },
    { x1: 404, y1: 623, x2: 1148, y2: 623, thickness: 6 },
  ],
  objects: [
    { id: "door-1",    type: "door",    x: 186, y: 331, w: 84,  h: 88, label: "Door" },
    { id: "counter-2", type: "counter", x: 681, y: 643, w: 201, h: 73, label: "Counter" },
  ],
  tables: [
    { number: 44, shape: "rect",    x: 12,  y: 42,  w: 68,  h: 112, section: "left" },
    { number: 43, shape: "rect",    x: 12,  y: 186, w: 68,  h: 112, section: "left" },
    { number: 42, shape: "rect",    x: 12,  y: 332, w: 68,  h: 112, section: "left" },
    { number: 41, shape: "rect",    x: 12,  y: 476, w: 68,  h: 112, section: "left" },
    { number: 40, shape: "round",   x: 14,  y: 633, w: 73,  h: 73,  section: "left" },
    { number: 35, shape: "round",   x: 179, y: 6,   w: 73,  h: 73,  section: "left" },
    { number: 34, shape: "diamond", x: 168, y: 95,  w: 100, h: 100, section: "left" },
    { number: 33, shape: "diamond", x: 169, y: 210, w: 100, h: 100, section: "left" },
    { number: 32, shape: "round",   x: 184, y: 443, w: 73,  h: 73,  section: "left" },
    { number: 31, shape: "rect",    x: 159, y: 543, w: 110, h: 58,  section: "left" },
    { number: 30, shape: "round",   x: 186, y: 633, w: 73,  h: 73,  section: "left" },
    { number: 21, shape: "square",  x: 318, y: 69,  w: 82,  h: 80,  section: "main" },
    { number: 12, shape: "round",   x: 324, y: 179, w: 75,  h: 75,  section: "main" },
    { number: 11, shape: "round",   x: 325, y: 281, w: 75,  h: 75,  section: "main" },
    { number: 22, shape: "rect",    x: 431, y: 23,  w: 150, h: 71,  section: "main" },
    { number: 23, shape: "round",   x: 632, y: 12,  w: 82,  h: 82,  section: "main" },
    { number: 24, shape: "round",   x: 774, y: 13,  w: 82,  h: 82,  section: "main" },
    { number: 25, shape: "round",   x: 902, y: 9,   w: 82,  h: 82,  section: "main" },
    { number: 26, shape: "round",   x: 1035, y: 12, w: 76,  h: 76,  section: "main" },
    { number: 101, label: "A", shape: "rect", x: 581, y: 164, w: 110, h: 60, section: "booth" },
    { number: 102, label: "B", shape: "rect", x: 762, y: 164, w: 110, h: 60, section: "booth" },
    { number: 103, label: "C", shape: "rect", x: 962, y: 164, w: 110, h: 60, section: "booth" },
    { number: 18, shape: "rect",    x: 582, y: 250, w: 110, h: 95,  section: "main" },
    { number: 19, shape: "rect",    x: 762, y: 250, w: 110, h: 95,  section: "main" },
    { number: 20, shape: "rect",    x: 962, y: 250, w: 110, h: 95,  section: "main" },
    { number: 13, shape: "diamond", x: 404, y: 383, w: 100, h: 100, section: "main" },
    { number: 14, shape: "diamond", x: 570, y: 388, w: 100, h: 100, section: "main" },
    { number: 15, shape: "diamond", x: 752, y: 389, w: 100, h: 100, section: "main" },
    { number: 16, shape: "diamond", x: 925, y: 395, w: 100, h: 100, section: "main" },
    { number: 3,  shape: "round",   x: 343, y: 535, w: 78,  h: 78,  section: "bar" },
    { number: 4,  shape: "round",   x: 443, y: 535, w: 78,  h: 78,  section: "bar" },
    { number: 5,  shape: "round",   x: 543, y: 535, w: 78,  h: 78,  section: "bar" },
    { number: 6,  shape: "round",   x: 643, y: 535, w: 78,  h: 78,  section: "bar" },
    { number: 7,  shape: "round",   x: 743, y: 535, w: 78,  h: 78,  section: "bar" },
    { number: 8,  shape: "round",   x: 843, y: 535, w: 78,  h: 78,  section: "bar" },
    { number: 9,  shape: "round",   x: 943, y: 535, w: 78,  h: 78,  section: "bar" },
    { number: 10, shape: "round",   x: 1043, y: 530, w: 78, h: 78,  section: "bar" },
  ],
}

const INITIAL_SOUTHSIDE_INDOOR: FloorPlan = {
  name: "Southside — Indoor",
  canvasW: 1087,
  canvasH: 769,
  walls: [
    { x1: 257, y1: 362, x2: 1038, y2: 362, thickness: 9 },
  ],
  objects: [
    { id: "label-2",  type: "label",  x: 913, y: 17,  w: 163, h: 88, label: "BACK DOOR" },
    { id: "window-4", type: "window", x: 370, y: 690, w: 520, h: 72, label: "BAR" },
  ],
  tables: [
    { number: 1,  label: "19", shape: "round",   x: 16,  y: 85,  w: 108, h: 108, section: "booth" },
    { number: 2,  label: "13", shape: "rect",    x: 12,  y: 248, w: 137, h: 65,  section: "booth" },
    { number: 3,  label: "6",  shape: "rect",    x: 12,  y: 387, w: 137, h: 65,  section: "booth" },
    { number: 4,  label: "1",  shape: "rect",    x: 12,  y: 519, w: 137, h: 65,  section: "booth" },
    { number: 5,  label: "26", shape: "square",  x: 301, y: 12,  w: 100, h: 100, section: "main" },
    { number: 6,  label: "27", shape: "square",  x: 440, y: 12,  w: 100, h: 100, section: "main" },
    { number: 7,  label: "28", shape: "square",  x: 610, y: 12,  w: 100, h: 100, section: "main" },
    { number: 8,  label: "29", shape: "square",  x: 791, y: 12,  w: 100, h: 100, section: "main" },
    { number: 9,  label: "20", shape: "diamond", x: 216, y: 133, w: 100, h: 100, section: "main" },
    { number: 10, label: "21", shape: "diamond", x: 379, y: 133, w: 100, h: 100, section: "main" },
    { number: 11, label: "22", shape: "diamond", x: 525, y: 132, w: 100, h: 100, section: "main" },
    { number: 12, label: "23", shape: "diamond", x: 679, y: 133, w: 100, h: 100, section: "main" },
    { number: 13, label: "14", shape: "square",  x: 260, y: 267, w: 85,  h: 85,  section: "main" },
    { number: 14, label: "15", shape: "square",  x: 409, y: 267, w: 85,  h: 85,  section: "main" },
    { number: 15, label: "16", shape: "square",  x: 561, y: 267, w: 85,  h: 85,  section: "main" },
    { number: 16, label: "17", shape: "square",  x: 753, y: 267, w: 85,  h: 85,  section: "main" },
    { number: 17, label: "8",  shape: "square",  x: 392, y: 386, w: 80,  h: 70,  section: "bar" },
    { number: 18, label: "24", shape: "diamond", x: 827, y: 133, w: 100, h: 100, section: "bar" },
    { number: 19, label: "18", shape: "square",  x: 935, y: 267, w: 94,  h: 80,  section: "bar" },
    { number: 20, label: "7",  shape: "square",  x: 260, y: 386, w: 80,  h: 70,  section: "bar" },
    { number: 21, label: "9",  shape: "square",  x: 519, y: 386, w: 70,  h: 70,  section: "main" },
    { number: 22, label: "10", shape: "square",  x: 624, y: 386, w: 70,  h: 70,  section: "main" },
    { number: 23, label: "11", shape: "square",  x: 758, y: 386, w: 85,  h: 70,  section: "main" },
    { number: 24, label: "12", shape: "square",  x: 907, y: 386, w: 86,  h: 69,  section: "main" },
    { number: 25, label: "2",  shape: "square",  x: 320, y: 502, w: 70,  h: 70,  section: "main" },
    { number: 26, label: "3",  shape: "diamond", x: 520, y: 500, w: 82,  h: 82,  section: "main" },
    { number: 27, label: "4",  shape: "diamond", x: 681, y: 500, w: 82,  h: 82,  section: "main" },
    { number: 28, label: "5",  shape: "diamond", x: 839, y: 500, w: 82,  h: 82,  section: "main" },
    { number: 29, label: "C",  shape: "round",   x: 390, y: 608, w: 70,  h: 70,  section: "main" },
    { number: 30, label: "U",  shape: "round",   x: 500, y: 606, w: 70,  h: 70,  section: "main" },
    { number: 31, label: "N",  shape: "round",   x: 601, y: 607, w: 70,  h: 70,  section: "main" },
    { number: 32, label: "T",  shape: "round",   x: 704, y: 611, w: 70,  h: 70,  section: "main" },
    { number: 33, label: "Y",  shape: "round",   x: 803, y: 612, w: 70,  h: 70,  section: "main" },
    { number: 34, label: "25", shape: "square",  x: 160, y: 12,  w: 100, h: 100, section: "main" },
  ],
}

const INITIAL_SOUTHSIDE_OUTDOOR: FloorPlan = {
  name: "Southside — Outdoor",
  canvasW: 1011,
  canvasH: 715,
  objects: [
    { id: "label-1", type: "label", x: 386, y: 321, w: 612, h: 382, label: " " },
    { id: "label-2", type: "label", x: 723, y: 353, w: 229, h: 65,  label: "BACK DOOR" },
  ],
  tables: [
    { number: 30, label: "P4",  shape: "square", x: 15,  y: 207, w: 97,  h: 112, section: "patio" },
    { number: 31, label: "P2",  shape: "square", x: 14,  y: 464, w: 97,  h: 112, section: "patio" },
    { number: 32, label: "W1",  shape: "square", x: 237, y: 626, w: 130, h: 79,  section: "patio" },
    { number: 33, label: "W4",  shape: "square", x: 270, y: 346, w: 96,  h: 78,  section: "patio" },
    { number: 34, label: "W5",  shape: "square", x: 237, y: 250, w: 130, h: 79,  section: "patio" },
    { number: 35, label: "W8",  shape: "square", x: 697, y: 225, w: 73,  h: 77,  section: "patio" },
    { number: 36, label: "W9",  shape: "square", x: 798, y: 234, w: 81,  h: 66,  section: "patio" },
    { number: 37, label: "P3",  shape: "square", x: 15,  y: 335, w: 97,  h: 112, section: "patio" },
    { number: 39, label: "P1",  shape: "square", x: 15,  y: 590, w: 97,  h: 112, section: "patio" },
    { number: 40, label: "W2",  shape: "square", x: 237, y: 538, w: 130, h: 79,  section: "patio" },
    { number: 41, label: "W3",  shape: "square", x: 271, y: 444, w: 96,  h: 78,  section: "patio" },
    { number: 42, label: "W6",  shape: "square", x: 436, y: 192, w: 96,  h: 112, section: "patio" },
    { number: 43, label: "W7",  shape: "square", x: 569, y: 192, w: 96,  h: 112, section: "patio" },
    { number: 44, label: "W10", shape: "square", x: 910, y: 235, w: 81,  h: 66,  section: "main" },
    { number: 45, label: "R1",  shape: "square", x: 254, y: 7,   w: 101, h: 123, section: "main" },
    { number: 46, label: "R2",  shape: "square", x: 382, y: 9,   w: 101, h: 123, section: "main" },
    { number: 47, label: "R3",  shape: "square", x: 501, y: 6,   w: 111, h: 62,  section: "main" },
    { number: 48, label: "R4",  shape: "square", x: 630, y: 6,   w: 111, h: 62,  section: "main" },
    { number: 49, label: "R5",  shape: "square", x: 758, y: 5,   w: 111, h: 62,  section: "main" },
    { number: 50, label: "R6",  shape: "square", x: 888, y: 5,   w: 111, h: 62,  section: "main" },
  ],
}

const ALL_PLANS = [INITIAL_ORIGINAL, INITIAL_SOUTHSIDE_INDOOR, INITIAL_SOUTHSIDE_OUTDOOR]

// ── TypeScript code generator ──────────────────────────────────────────────────

function generateTS(plan: FloorPlan): string {
  const name = plan.name.toLowerCase()
  const constName =
    name.includes("outdoor") ? "SOUTHSIDE_OUTDOOR_PLAN" :
    name.includes("southside") ? "SOUTHSIDE_INDOOR_PLAN" :
    "ORIGINAL_WALNUT_PLAN"

  const wallLines = (plan.walls ?? []).map(w =>
    `    { x1: ${w.x1}, y1: ${w.y1}, x2: ${w.x2}, y2: ${w.y2}${w.thickness != null ? `, thickness: ${w.thickness}` : ""} },`
  ).join("\n")

  const objLines = (plan.objects ?? []).map(o => {
    const lp = o.label ? `, label: "${o.label}"` : ""
    return `    { id: "${o.id}", type: "${o.type}", x: ${o.x}, y: ${o.y}, w: ${o.w}, h: ${o.h}${lp} },`
  }).join("\n")

  const tableLines = plan.tables.map(t => {
    const lp = t.label ? `, label: "${t.label}"` : ""
    return `    { number: ${t.number}${lp}, shape: "${t.shape}", x: ${t.x}, y: ${t.y}, w: ${t.w}, h: ${t.h}, section: "${t.section}" },`
  }).join("\n")

  const parts: string[] = [
    `const ${constName}: FloorPlan = {`,
    `  canvasW: ${plan.canvasW},`,
    `  canvasH: ${plan.canvasH},`,
  ]
  if ((plan.walls ?? []).length > 0) {
    parts.push(``, `  walls: [`, wallLines, `  ],`)
  }
  if ((plan.objects ?? []).length > 0) {
    parts.push(``, `  objects: [`, objLines, `  ],`)
  }
  parts.push(``, `  tables: [`, tableLines, `  ],`, `}`)
  return parts.join("\n")
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function FloorPlanEditor() {
  const [planIdx, setPlanIdx]       = useState(0)
  const [plan, setPlan]             = useState<FloorPlan>(() => JSON.parse(JSON.stringify(ALL_PLANS[0])))
  const [selection, setSelection]   = useState<Selection>(null)
  const [copied, setCopied]         = useState(false)
  const [history, setHistory]       = useState<FloorPlan[]>([])
  const [showObjPicker, setShowObjPicker] = useState(false)

  const canvasRef     = useRef<HTMLDivElement>(null)
  const planRef       = useRef(plan)
  const tableDrag     = useRef<{ num: number; sx: number; sy: number; tx: number; ty: number; active: boolean } | null>(null)
  const wallDrag      = useRef<{ idx: number; sx: number; sy: number; ox1: number; oy1: number; ox2: number; oy2: number; active: boolean } | null>(null)
  const tableResize   = useRef<{ num: number; sx: number; sy: number; ow: number; oh: number } | null>(null)
  const objectDrag    = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number; active: boolean } | null>(null)
  const objectResize  = useRef<{ id: string; sx: number; sy: number; ow: number; oh: number } | null>(null)
  const objIdCounter  = useRef(0)

  useEffect(() => { planRef.current = plan }, [plan])

  useEffect(() => {
    setPlan(JSON.parse(JSON.stringify(ALL_PLANS[planIdx])))
    setSelection(null)
    setHistory([])
    setShowObjPicker(false)
  }, [planIdx])

  const toCanvas = useCallback((screenPx: number, axis: "x" | "y") => {
    if (!canvasRef.current) return screenPx
    const rect = canvasRef.current.getBoundingClientRect()
    const dim  = axis === "x" ? rect.width  : rect.height
    const cDim = axis === "x" ? planRef.current.canvasW : planRef.current.canvasH
    return screenPx * (cDim / dim)
  }, [])

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(v)))

  const pushHistory = useCallback(() => {
    setHistory(h => [...h.slice(-40), planRef.current])
  }, [])

  const undo = () => {
    if (!history.length) return
    setPlan(history[history.length - 1])
    setHistory(h => h.slice(0, -1))
    setSelection(null)
  }

  // ── Table drag/resize ──────────────────────────────────────────────────────

  const onTableDown = (e: React.PointerEvent, num: number) => {
    e.preventDefault(); e.stopPropagation()
    setSelection({ kind: "table", number: num })
    const t = planRef.current.tables.find(t => t.number === num)!
    tableDrag.current = { num, sx: e.clientX, sy: e.clientY, tx: t.x, ty: t.y, active: false }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onResizeDown = (e: React.PointerEvent, num: number) => {
    e.preventDefault(); e.stopPropagation()
    const t = planRef.current.tables.find(t => t.number === num)!
    tableResize.current = { num, sx: e.clientX, sy: e.clientY, ow: t.w, oh: t.h }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  // ── Wall drag ─────────────────────────────────────────────────────────────

  const onWallDown = (e: React.PointerEvent, idx: number) => {
    e.preventDefault(); e.stopPropagation()
    setSelection({ kind: "wall", index: idx })
    const w = planRef.current.walls![idx]
    wallDrag.current = { idx, sx: e.clientX, sy: e.clientY, ox1: w.x1, oy1: w.y1, ox2: w.x2, oy2: w.y2, active: false }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  // ── Object drag/resize ────────────────────────────────────────────────────

  const onObjectDown = (e: React.PointerEvent, id: string) => {
    e.preventDefault(); e.stopPropagation()
    setSelection({ kind: "object", id })
    const obj = (planRef.current.objects ?? []).find(o => o.id === id)!
    objectDrag.current = { id, sx: e.clientX, sy: e.clientY, ox: obj.x, oy: obj.y, active: false }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onObjResizeDown = (e: React.PointerEvent, id: string) => {
    e.preventDefault(); e.stopPropagation()
    const obj = (planRef.current.objects ?? []).find(o => o.id === id)!
    objectResize.current = { id, sx: e.clientX, sy: e.clientY, ow: obj.w, oh: obj.h }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  // ── Combined pointer move ──────────────────────────────────────────────────

  const onCanvasMove = (e: React.PointerEvent) => {
    // Table drag
    if (tableDrag.current) {
      const { num, sx, sy, tx, ty } = tableDrag.current
      const dx = e.clientX - sx; const dy = e.clientY - sy
      if (!tableDrag.current.active && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
      tableDrag.current.active = true
      const p = planRef.current
      const t = p.tables.find(t => t.number === num)!
      const nx = clamp(tx + toCanvas(dx, "x"), 0, p.canvasW - t.w)
      const ny = clamp(ty + toCanvas(dy, "y"), 0, p.canvasH - t.h)
      setPlan(prev => ({ ...prev, tables: prev.tables.map(t => t.number === num ? { ...t, x: nx, y: ny } : t) }))
      return
    }

    // Wall drag
    if (wallDrag.current) {
      const { idx, sx, sy, ox1, oy1, ox2, oy2 } = wallDrag.current
      const dx = e.clientX - sx; const dy = e.clientY - sy
      if (!wallDrag.current.active && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
      wallDrag.current.active = true
      const p = planRef.current
      const isVert  = ox1 === ox2
      const isHoriz = oy1 === oy2
      const cdx = Math.round(toCanvas(dx, "x"))
      const cdy = Math.round(toCanvas(dy, "y"))
      const nx1 = clamp(ox1 + cdx, 0, p.canvasW)
      const ny1 = clamp(oy1 + cdy, 0, p.canvasH)
      const nx2 = isVert  ? nx1 : clamp(ox2 + cdx, 0, p.canvasW)
      const ny2 = isHoriz ? ny1 : clamp(oy2 + cdy, 0, p.canvasH)
      setPlan(prev => ({
        ...prev,
        walls: (prev.walls ?? []).map((w, i) => i === idx ? { ...w, x1: nx1, y1: ny1, x2: nx2, y2: ny2 } : w)
      }))
      return
    }

    // Table resize
    if (tableResize.current) {
      const { num, sx, sy, ow, oh } = tableResize.current
      const p = planRef.current
      const t = p.tables.find(t => t.number === num)!
      const nw = clamp(ow + toCanvas(e.clientX - sx, "x"), 20, p.canvasW - t.x)
      const nh = clamp(oh + toCanvas(e.clientY - sy, "y"), 20, p.canvasH - t.y)
      setPlan(prev => ({ ...prev, tables: prev.tables.map(t => t.number === num ? { ...t, w: nw, h: nh } : t) }))
      return
    }

    // Object drag
    if (objectDrag.current) {
      const { id, sx, sy, ox, oy } = objectDrag.current
      const dx = e.clientX - sx; const dy = e.clientY - sy
      if (!objectDrag.current.active && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
      objectDrag.current.active = true
      const p = planRef.current
      const obj = (p.objects ?? []).find(o => o.id === id)!
      const nx = clamp(ox + toCanvas(dx, "x"), 0, p.canvasW - obj.w)
      const ny = clamp(oy + toCanvas(dy, "y"), 0, p.canvasH - obj.h)
      setPlan(prev => ({
        ...prev,
        objects: (prev.objects ?? []).map(o => o.id === id ? { ...o, x: nx, y: ny } : o)
      }))
      return
    }

    // Object resize
    if (objectResize.current) {
      const { id, sx, sy, ow, oh } = objectResize.current
      const p = planRef.current
      const obj = (p.objects ?? []).find(o => o.id === id)!
      const nw = clamp(ow + toCanvas(e.clientX - sx, "x"), 12, p.canvasW - obj.x)
      const nh = clamp(oh + toCanvas(e.clientY - sy, "y"), 12, p.canvasH - obj.y)
      setPlan(prev => ({
        ...prev,
        objects: (prev.objects ?? []).map(o => o.id === id ? { ...o, w: nw, h: nh } : o)
      }))
    }
  }

  const onCanvasUp = () => {
    if (
      tableDrag.current?.active ||
      wallDrag.current?.active ||
      tableResize.current ||
      objectDrag.current?.active ||
      objectResize.current
    ) pushHistory()
    tableDrag.current   = null
    wallDrag.current    = null
    tableResize.current = null
    objectDrag.current  = null
    objectResize.current = null
  }

  // ── Panel field updaters ───────────────────────────────────────────────────

  const updateTable = (field: keyof FloorPos, raw: string) => {
    if (selection?.kind !== "table") return
    const num = selection.number
    const isStr = field === "shape" || field === "section" || field === "label"
    const value = isStr ? (raw || undefined) : parseInt(raw, 10)
    pushHistory()
    setPlan(prev => ({ ...prev, tables: prev.tables.map(t => t.number === num ? { ...t, [field]: value } : t) }))
  }

  const updateWall = (idx: number, field: keyof FloorWall, raw: string) => {
    const value = parseInt(raw, 10)
    if (isNaN(value)) return
    pushHistory()
    setPlan(prev => ({
      ...prev,
      walls: (prev.walls ?? []).map((w, i) => i === idx ? { ...w, [field]: value } : w)
    }))
  }

  const updateObject = (id: string, field: keyof FloorObject, raw: string) => {
    const isStr = field === "type" || field === "id" || field === "label"
    const value: unknown = isStr ? (raw === "" ? undefined : raw) : parseInt(raw, 10)
    pushHistory()
    setPlan(prev => ({
      ...prev,
      objects: (prev.objects ?? []).map(o => o.id === id ? { ...o, [field]: value } : o)
    }))
  }

  // ── Add / delete ───────────────────────────────────────────────────────────

  const addTable = () => {
    pushHistory()
    // Pick next number above existing real tables (ignore 100+ labels like A/B/C)
    const maxNum = plan.tables.reduce((m, t) => (t.number < 100 ? Math.max(m, t.number) : m), 0)
    const newNum = maxNum + 1
    const newTable: FloorPos = {
      number: newNum, shape: "round",
      x: Math.round(plan.canvasW / 2 - 35),
      y: Math.round(plan.canvasH / 2 - 35),
      w: 70, h: 70, section: "main",
    }
    setPlan(prev => ({ ...prev, tables: [...prev.tables, newTable] }))
    setSelection({ kind: "table", number: newNum })
  }

  const addObject = (type: ObjType) => {
    pushHistory()
    setShowObjPicker(false)
    const meta = OBJ_META[type]
    const id = `${type}-${++objIdCounter.current}`
    const newObj: FloorObject = {
      id, type,
      x: Math.round(plan.canvasW / 2 - meta.defaultW / 2),
      y: Math.round(plan.canvasH / 2 - meta.defaultH / 2),
      w: meta.defaultW, h: meta.defaultH,
      label: meta.defaultLabel,
    }
    setPlan(prev => ({ ...prev, objects: [...(prev.objects ?? []), newObj] }))
    setSelection({ kind: "object", id })
  }

  const addWall = () => {
    pushHistory()
    const newWall: FloorWall = { x1: 0, y1: Math.round(plan.canvasH / 2), x2: plan.canvasW, y2: Math.round(plan.canvasH / 2), thickness: 4 }
    const newWalls = [...(plan.walls ?? []), newWall]
    setPlan(prev => ({ ...prev, walls: newWalls }))
    setSelection({ kind: "wall", index: newWalls.length - 1 })
  }

  const deleteTable = (num: number) => {
    pushHistory()
    setPlan(prev => ({ ...prev, tables: prev.tables.filter(t => t.number !== num) }))
    setSelection(null)
  }

  const deleteWall = (idx: number) => {
    pushHistory()
    setPlan(prev => ({ ...prev, walls: (prev.walls ?? []).filter((_, i) => i !== idx) }))
    setSelection(null)
  }

  const deleteObject = (id: string) => {
    pushHistory()
    setPlan(prev => ({ ...prev, objects: (prev.objects ?? []).filter(o => o.id !== id) }))
    setSelection(null)
  }

  // ── Copy TypeScript ────────────────────────────────────────────────────────

  const copyTS = () => {
    navigator.clipboard.writeText(generateTS(plan))
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const selTable   = selection?.kind === "table"  ? plan.tables.find(t => t.number === selection.number) ?? null : null
  const selWallIdx = selection?.kind === "wall"   ? selection.index : null
  const selWall    = selWallIdx != null ? (plan.walls ?? [])[selWallIdx] ?? null : null
  const selObjId   = selection?.kind === "object" ? selection.id : null
  const selObj     = selObjId != null ? (plan.objects ?? []).find(o => o.id === selObjId) ?? null : null

  // ── Shared styles ──────────────────────────────────────────────────────────

  const lbl: React.CSSProperties = { fontSize: 10, color: "#777", marginBottom: 2, display: "block", textTransform: "uppercase", letterSpacing: 1 }
  const inp: React.CSSProperties = { background: "#1e1e1e", color: "#ddd", border: "1px solid #444", padding: "5px 7px", borderRadius: 4, fontSize: 12, boxSizing: "border-box", width: "100%" }
  const btn = (bg: string, fg: string, border: string): React.CSSProperties => ({
    background: bg, color: fg, border: `1px solid ${border}`, padding: "7px 0",
    borderRadius: 4, cursor: "pointer", fontSize: 12, width: "100%",
  })

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", height: "100vh", background: "#111", color: "#eee", fontFamily: "'SF Mono', monospace", overflow: "hidden" }}>

      {/* ── LEFT PANEL ──────────────────────────────────────────────────────── */}
      <div style={{ width: 232, flexShrink: 0, background: "#181818", borderRight: "1px solid #2a2a2a", padding: 14, display: "flex", flexDirection: "column", gap: 10, overflowY: "auto" }}>

        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Floor Plan Editor</div>

        {/* Plan selector */}
        <div>
          <label style={lbl}>Plan</label>
          <select value={planIdx} onChange={e => setPlanIdx(Number(e.target.value))} style={inp}>
            {ALL_PLANS.map((p, i) => <option key={i} value={i}>{p.name}</option>)}
          </select>
        </div>

        {/* Canvas size */}
        <div>
          <label style={lbl}>Canvas (W × H)</label>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="number" value={plan.canvasW} onChange={e => { pushHistory(); setPlan(p => ({ ...p, canvasW: +e.target.value })) }} style={inp} />
            <span style={{ color: "#444" }}>×</span>
            <input type="number" value={plan.canvasH} onChange={e => { pushHistory(); setPlan(p => ({ ...p, canvasH: +e.target.value })) }} style={inp} />
          </div>
        </div>

        <div style={{ borderTop: "1px solid #2a2a2a" }} />

        {/* ── TABLE panel ── */}
        {selTable && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#7dfc98" }}>Table {selTable.label ?? selTable.number}</div>

            <div>
              <label style={lbl}>Shape</label>
              <select value={selTable.shape} onChange={e => updateTable("shape", e.target.value)} style={inp}>
                {(["round","square","rect","diamond"] as Shape[]).map(s => <option key={s}>{s}</option>)}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {(["x","y","w","h"] as const).map(f => (
                <div key={f}>
                  <label style={lbl}>{f.toUpperCase()}</label>
                  <input type="number" value={selTable[f] as number} onChange={e => updateTable(f, e.target.value)} style={inp} />
                </div>
              ))}
            </div>

            <div>
              <label style={lbl}>Section</label>
              <input value={selTable.section} onChange={e => updateTable("section", e.target.value)} style={inp} />
            </div>

            <div>
              <label style={lbl}>Label (optional)</label>
              <input value={selTable.label ?? ""} placeholder="e.g. A" onChange={e => updateTable("label", e.target.value)} style={inp} />
            </div>

            <button onClick={() => deleteTable(selTable.number)} style={btn("#3a1010","#f88","#6a2020")}>Delete Table</button>
          </div>
        )}

        {/* ── WALL panel ── */}
        {selWall != null && selWallIdx != null && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#f5c76d" }}>
              Wall {selWallIdx + 1} — {selWall.x1 === selWall.x2 ? "Vertical" : selWall.y1 === selWall.y2 ? "Horizontal" : "Diagonal"}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {(["x1","y1","x2","y2"] as const).map(f => (
                <div key={f}>
                  <label style={lbl}>{f.toUpperCase()}</label>
                  <input type="number" value={selWall[f]} onChange={e => updateWall(selWallIdx, f, e.target.value)} style={inp} />
                </div>
              ))}
            </div>

            <div>
              <label style={lbl}>Thickness (px)</label>
              <input type="number" value={selWall.thickness ?? 4} onChange={e => updateWall(selWallIdx, "thickness", e.target.value)} style={inp} />
            </div>

            <button onClick={() => deleteWall(selWallIdx)} style={btn("#3a1010","#f88","#6a2020")}>Delete Wall</button>
          </div>
        )}

        {/* ── OBJECT panel ── */}
        {selObj && selObjId && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: OBJ_META[selObj.type].text }}>
              {selObj.label ?? OBJ_META[selObj.type].defaultLabel}
            </div>

            <div>
              <label style={lbl}>Type</label>
              <select value={selObj.type} onChange={e => updateObject(selObjId, "type", e.target.value)} style={inp}>
                {(Object.keys(OBJ_META) as ObjType[]).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {(["x","y","w","h"] as const).map(f => (
                <div key={f}>
                  <label style={lbl}>{f.toUpperCase()}</label>
                  <input type="number" value={selObj[f] as number} onChange={e => updateObject(selObjId, f, e.target.value)} style={inp} />
                </div>
              ))}
            </div>

            <div>
              <label style={lbl}>Label</label>
              <input value={selObj.label ?? ""} placeholder="custom label" onChange={e => updateObject(selObjId, "label", e.target.value)} style={inp} />
            </div>

            <button onClick={() => deleteObject(selObjId)} style={btn("#3a1010","#f88","#6a2020")}>Delete Object</button>
          </div>
        )}

        {/* ── No selection hint ── */}
        {!selTable && selWall == null && !selObj && (
          <div style={{ color: "#444", fontSize: 11, lineHeight: 1.8 }}>
            Click a table, wall, or<br />object to select &amp; edit.
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* ── Add Table ── */}
        <button onClick={addTable} style={btn("#1a2e1a","#7dfc98","#2a5a2a")}>+ Add Table</button>

        {/* ── Add Object (expandable picker) ── */}
        <div>
          <button
            onClick={() => setShowObjPicker(p => !p)}
            style={{ ...btn("#1a1e2e","#a0b8f8","#2a3a6a"), display: "flex", justifyContent: "space-between", alignItems: "center", paddingLeft: 10, paddingRight: 10 }}
          >
            <span>+ Add Object</span>
            <span style={{ fontSize: 9 }}>{showObjPicker ? "▲" : "▼"}</span>
          </button>
          {showObjPicker && (
            <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 4 }}>
              {(Object.keys(OBJ_META) as ObjType[]).map(type => {
                const m = OBJ_META[type]
                return (
                  <button
                    key={type}
                    onClick={() => addObject(type)}
                    style={{
                      background: m.bg, color: m.text,
                      border: `1px solid ${m.border}`,
                      padding: "5px 10px", borderRadius: 4,
                      cursor: "pointer", fontSize: 11,
                      width: "100%", textAlign: "left",
                    }}
                  >
                    {m.defaultLabel}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Add Wall ── */}
        <button onClick={addWall} style={btn("#1e1c10","rgba(210,165,75,0.9)","rgba(210,165,75,0.4)")}>+ Add Wall</button>

        <div style={{ borderTop: "1px solid #2a2a2a" }} />

        {/* Undo */}
        <button onClick={undo} disabled={!history.length}
          style={btn(history.length ? "#1e2e1e" : "#1a1a1a", history.length ? "#7dfc98" : "#444", history.length ? "#3a5a3a" : "#2a2a2a")}>
          ↩ Undo ({history.length})
        </button>

        {/* Copy TS */}
        <button onClick={copyTS}
          style={btn(copied ? "#1a3a1a" : "#1a2a3a", copied ? "#7dfc98" : "#7ab8f5", copied ? "#3a6a3a" : "#2a4a6a")}>
          {copied ? "✓ Copied!" : "Copy TypeScript"}
        </button>

        <div style={{ fontSize: 10, color: "#3a3a3a", lineHeight: 1.8 }}>
          Click → select<br />
          Drag → move<br />
          Drag ◢ → resize<br />
          Fields → instant update
        </div>
      </div>

      {/* ── CANVAS ──────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, padding: 20, overflow: "auto", display: "flex", alignItems: "flex-start", justifyContent: "center", background: "#111" }}>
        <div
          ref={canvasRef}
          onPointerMove={onCanvasMove}
          onPointerUp={onCanvasUp}
          onPointerLeave={onCanvasUp}
          onClick={e => { if (e.target === canvasRef.current) setSelection(null) }}
          style={{
            position: "relative",
            width: "100%",
            maxWidth: plan.canvasW,
            aspectRatio: `${plan.canvasW} / ${plan.canvasH}`,
            background: "#181f18",
            border: "1px solid #2a2a2a",
            borderRadius: 8,
            userSelect: "none",
            touchAction: "none",
            flexShrink: 0,
          }}
        >
          {/* ── Walls ── */}
          {(plan.walls ?? []).map((wall, i) => {
            const isSel   = selection?.kind === "wall" && selection.index === i
            const isVert  = wall.x1 === wall.x2
            const thick   = wall.thickness ?? 4
            const lPct    = Math.min(wall.x1, wall.x2) / plan.canvasW * 100
            const tPct    = Math.min(wall.y1, wall.y2) / plan.canvasH * 100
            const lenWPct = Math.abs(wall.x2 - wall.x1) / plan.canvasW * 100
            const lenHPct = Math.abs(wall.y2 - wall.y1) / plan.canvasH * 100
            const thkWPct = thick / plan.canvasW * 100
            const thkHPct = thick / plan.canvasH * 100

            // Wider clickable hit area
            const hitPadW = isVert  ? Math.max(thkWPct, 2) : lenWPct
            const hitPadH = isVert  ? lenHPct : Math.max(thkHPct, 2)
            const hitLeft = isVert  ? lPct - 1 : lPct
            const hitTop  = isVert  ? tPct : tPct - 1

            return (
              <div key={i}>
                <div
                  onPointerDown={e => onWallDown(e, i)}
                  style={{
                    position: "absolute",
                    left:   `${hitLeft.toFixed(3)}%`,
                    top:    `${hitTop.toFixed(3)}%`,
                    width:  `${hitPadW.toFixed(3)}%`,
                    height: `${hitPadH.toFixed(3)}%`,
                    cursor: "grab",
                    zIndex: 6,
                    background: "transparent",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left:   `${lPct.toFixed(3)}%`,
                    top:    `${tPct.toFixed(3)}%`,
                    width:  isVert ? `${thkWPct.toFixed(3)}%` : `${lenWPct.toFixed(3)}%`,
                    height: isVert ? `${lenHPct.toFixed(3)}%` : `${thkHPct.toFixed(3)}%`,
                    background: isSel ? "#f5c76d" : "rgba(200,160,80,0.55)",
                    boxShadow: isSel ? "0 0 8px rgba(245,199,109,0.7)" : "none",
                    borderRadius: 2,
                    pointerEvents: "none",
                    zIndex: 5,
                    transition: "background 0.1s",
                  }}
                />
              </div>
            )
          })}

          {/* ── Objects (doors, windows, stairs, labels, counters, host stand) ── */}
          {(plan.objects ?? []).map(obj => {
            const meta  = OBJ_META[obj.type]
            const xP    = obj.x / plan.canvasW * 100
            const yP    = obj.y / plan.canvasH * 100
            const wP    = obj.w / plan.canvasW * 100
            const hP    = obj.h / plan.canvasH * 100
            const isSel = selection?.kind === "object" && selection.id === obj.id

            const bgStyle = obj.type === "stairs"
              ? `repeating-linear-gradient(0deg, ${meta.bg}, ${meta.bg} 6px, rgba(0,0,0,0.22) 6px, rgba(0,0,0,0.22) 8px)`
              : meta.bg

            return (
              <div
                key={obj.id}
                onPointerDown={e => onObjectDown(e, obj.id)}
                style={{
                  position: "absolute",
                  left:   `${xP.toFixed(3)}%`,
                  top:    `${yP.toFixed(3)}%`,
                  width:  `${wP.toFixed(3)}%`,
                  height: `${hP.toFixed(3)}%`,
                  background:  bgStyle,
                  border: `${isSel ? 2 : 1}px ${obj.type === "label" ? "dashed" : "solid"} ${isSel ? "#fff" : meta.border}`,
                  boxSizing: "border-box",
                  borderRadius: obj.type === "host" ? "10%" : 4,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  textAlign: "center",
                  cursor: "grab",
                  fontSize: "clamp(6px, 0.85vw, 10px)", fontWeight: 600,
                  color: isSel ? "#fff" : meta.text,
                  zIndex: isSel ? 11 : 3,
                  outline: isSel ? "2px solid rgba(255,255,255,0.3)" : "none",
                  outlineOffset: 2,
                  boxShadow: isSel ? "0 0 12px rgba(255,255,255,0.2)" : "none",
                  transition: "border 0.1s, box-shadow 0.1s",
                  overflow: "hidden",
                  lineHeight: 1.2,
                  userSelect: "none",
                }}
              >
                {obj.label ?? meta.defaultLabel}
                {isSel && (
                  <div
                    onPointerDown={e => onObjResizeDown(e, obj.id)}
                    style={{
                      position: "absolute", right: -1, bottom: -1,
                      width: 14, height: 14,
                      background: "#fff", borderRadius: "4px 0 5px 0",
                      cursor: "nwse-resize", display: "flex", alignItems: "center",
                      justifyContent: "center", fontSize: 8, color: "#333", fontWeight: 900, zIndex: 20,
                    }}
                  >◢</div>
                )}
              </div>
            )
          })}

          {/* ── Tables ── */}
          {plan.tables.map(pos => {
            const xP        = pos.x / plan.canvasW * 100
            const yP        = pos.y / plan.canvasH * 100
            const wP        = pos.w / plan.canvasW * 100
            const hP        = pos.h / plan.canvasH * 100
            const isSel     = selection?.kind === "table" && selection.number === pos.number
            const isRound   = pos.shape === "round"
            const isDiamond = pos.shape === "diamond"

            return (
              <div
                key={pos.number}
                onPointerDown={e => onTableDown(e, pos.number)}
                style={{
                  position: "absolute",
                  left: `${xP.toFixed(3)}%`, top: `${yP.toFixed(3)}%`,
                  width: `${wP.toFixed(3)}%`, height: `${hP.toFixed(3)}%`,
                  background: isSel ? "rgba(60,140,80,0.65)" : "rgba(25,55,30,0.95)",
                  border: `${isSel ? 2 : 1}px solid ${isSel ? "#5ef07a" : "#2f6535"}`,
                  boxSizing: "border-box",
                  borderRadius: isRound ? "50%" : isDiamond ? 0 : "8%",
                  clipPath: isDiamond ? "polygon(50% 0%,100% 50%,50% 100%,0% 50%)" : undefined,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "grab",
                  fontSize: "clamp(7px, 1.1vw, 13px)", fontWeight: 700,
                  color: isSel ? "#e0ffe8" : "#7dca8a",
                  zIndex: isSel ? 12 : 4,
                  outline: isSel ? "2px solid rgba(94,240,122,0.35)" : "none",
                  outlineOffset: 2,
                  transition: "background 0.1s",
                  userSelect: "none",
                }}
              >
                {pos.label ?? pos.number}
                {isSel && !isDiamond && (
                  <div
                    onPointerDown={e => onResizeDown(e, pos.number)}
                    style={{
                      position: "absolute", right: -1, bottom: -1,
                      width: 16, height: 16,
                      background: "#5ef07a", borderRadius: "4px 0 6px 0",
                      cursor: "nwse-resize", display: "flex", alignItems: "center",
                      justifyContent: "center", fontSize: 9, color: "#000", fontWeight: 900, zIndex: 20,
                    }}
                  >◢</div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── RIGHT: live TypeScript output ───────────────────────────────────── */}
      <div style={{ width: 310, flexShrink: 0, background: "#0d1410", borderLeft: "1px solid #2a2a2a", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "10px 12px", borderBottom: "1px solid #2a2a2a", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 10, color: "#555", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Live Output</span>
          <button onClick={copyTS} style={{ background: "transparent", color: copied ? "#7dfc98" : "#7ab8f5", border: "none", cursor: "pointer", fontSize: 11, padding: 0 }}>
            {copied ? "✓ copied" : "copy"}
          </button>
        </div>
        <pre style={{ fontSize: 10, color: "#6db87a", margin: 0, padding: 12, whiteSpace: "pre-wrap", wordBreak: "break-word", overflowY: "auto", flex: 1, lineHeight: 1.6 }}>
          {generateTS(plan)}
        </pre>
      </div>
    </div>
  )
}
