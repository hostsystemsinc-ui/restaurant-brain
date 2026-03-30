"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import {
  History, Plus, Minus, Bell, Pause, Play,
  ChevronLeft, Check, X, ToggleLeft, ToggleRight, Palette,
} from "lucide-react"

const API                = "/api/brain"
const DEMO_RESTAURANT_ID = "dec0cafe-0000-4000-8000-000000000001"
const QUOTE_PRESETS      = [5, 10, 15, 20]
const TABLE_NUMBERS      = Array.from({ length: 16 }, (_, i) => i + 1)

// ── Types ──────────────────────────────────────────────────────────────────────

interface QueueEntry {
  id: string; name: string; party_size: number
  status: "waiting" | "ready" | "seated" | "removed"
  source: string; quoted_wait: number | null
  arrival_time: string; phone: string | null; notes: string | null
}

interface Table { id: string; table_number: number; capacity: number; status: string }

interface AnalogRow {
  localId: string; queueEntryId: string | null
  name: string; phone: string; partySize: number; notes: string
  quotedWait: number | null
  status: "filling" | "waiting" | "ready" | "seated" | "removed"
  source: "analog" | "nfc" | "web" | "host"
  addedMs: number | null; notifiedMs: number | null
  seatedMs: number | null; deadlineMs: number | null
  isPaused: boolean; pausedSecsLeft: number
  removedByGuest?: boolean
}

type Visual = "basic" | "classic" | "modern"

// ── Visual theme tokens ────────────────────────────────────────────────────────

function makeV(v: Visual) {
  if (v === "classic") return {
    pageBg:        "#FFFDE7",
    headerBg:      "rgba(255,253,220,0.97)",
    headerBorder:  "rgba(180,150,60,0.28)",
    colHeaderBg:   "rgba(255,253,220,0.97)",
    colHeaderText: "rgba(100,70,30,0.45)",
    rowBorder:     "rgba(168,210,228,0.80)",
    rowBgNormal:   "transparent",
    rowBgNFC:      "rgba(251,191,36,0.09)",
    rowBgOverdue:  "rgba(220,38,38,0.07)",
    completedBg:   "rgba(180,150,60,0.05)",
    completedDiv:  "rgba(168,210,228,0.65)",
    text:          "#3D2B1F",
    textSub:       "rgba(61,43,31,0.55)",
    textMuted:     "rgba(61,43,31,0.38)",
    inputColor:    "#3D2B1F",
    notesBg:       "rgba(168,210,228,0.12)",
    notesBorder:   "rgba(168,210,228,0.65)",
    notesLabel:    "rgba(100,70,30,0.40)",
    quoteBtnBg:    "rgba(255,250,200,0.88)",
    quoteBtnBgOff: "rgba(180,150,60,0.07)",
    quoteBtnText:  "#3D2B1F",
    ctrlBg:        "rgba(255,250,200,0.88)",
    ctrlBorder:    "rgba(180,150,60,0.30)",
    btnBorder:     "rgba(180,150,60,0.28)",
    clearBtnBg:    "rgba(180,150,60,0.15)",
    clearBtnColor: "rgba(61,43,31,0.50)",
    marginLine:    true,
    marginColor:   "rgba(200,50,50,0.65)",
    marginBorder:  "",
    pageMarginBg:  "linear-gradient(90deg, rgba(200,50,50,0.70) 0px, rgba(200,50,50,0.70) 2px, transparent 2px, transparent 6px, rgba(200,50,50,0.70) 6px, rgba(200,50,50,0.70) 8px, transparent 8px)",
    brandText:     "rgba(90,165,195,0.95)",
    brandSub:      "rgba(90,165,195,0.65)",
    font:          "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  }
  if (v === "modern") return {
    pageBg:        "#0A0A0A",
    headerBg:      "rgba(7,4,2,0.98)",
    headerBorder:  "rgba(255,185,100,0.18)",
    colHeaderBg:   "rgba(12,9,7,0.97)",
    colHeaderText: "rgba(255,255,255,0.28)",
    rowBorder:     "rgba(255,255,255,0.07)",
    rowBgNormal:   "transparent",
    rowBgNFC:      "rgba(251,191,36,0.07)",
    rowBgOverdue:  "rgba(239,68,68,0.12)",
    completedBg:   "rgba(255,255,255,0.03)",
    completedDiv:  "rgba(255,255,255,0.12)",
    text:          "rgba(255,255,255,0.92)",
    textSub:       "rgba(255,255,255,0.45)",
    textMuted:     "rgba(255,255,255,0.28)",
    inputColor:    "rgba(255,255,255,0.88)",
    notesBg:       "rgba(255,255,255,0.05)",
    notesBorder:   "rgba(255,255,255,0.10)",
    notesLabel:    "rgba(255,255,255,0.28)",
    quoteBtnBg:    "rgba(255,255,255,0.08)",
    quoteBtnBgOff: "rgba(255,255,255,0.03)",
    quoteBtnText:  "rgba(255,255,255,0.85)",
    ctrlBg:        "rgba(255,255,255,0.08)",
    ctrlBorder:    "rgba(255,255,255,0.14)",
    btnBorder:     "rgba(255,255,255,0.14)",
    clearBtnBg:    "rgba(255,255,255,0.12)",
    clearBtnColor: "rgba(255,255,255,0.50)",
    marginLine:    false,
    marginColor:   "transparent",
    marginBorder:  "",
    pageMarginBg:  "",
    brandText:     "rgba(255,255,255,0.92)",
    brandSub:      "rgba(255,255,255,0.28)",
    font:          "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  }
  // basic
  return {
    pageBg:        "#FAFAF8",
    headerBg:      "rgba(255,255,255,0.96)",
    headerBorder:  "rgba(0,0,0,0.09)",
    colHeaderBg:   "rgba(250,250,248,0.97)",
    colHeaderText: "rgba(0,0,0,0.28)",
    rowBorder:     "rgba(0,0,0,0.07)",
    rowBgNormal:   "transparent",
    rowBgNFC:      "rgba(251,191,36,0.06)",
    rowBgOverdue:  "rgba(239,68,68,0.04)",
    completedBg:   "rgba(0,0,0,0.025)",
    completedDiv:  "rgba(0,0,0,0.10)",
    text:          "#111",
    textSub:       "rgba(0,0,0,0.45)",
    textMuted:     "rgba(0,0,0,0.28)",
    inputColor:    "#111",
    notesBg:       "rgba(0,0,0,0.025)",
    notesBorder:   "rgba(0,0,0,0.07)",
    notesLabel:    "rgba(0,0,0,0.28)",
    quoteBtnBg:    "white",
    quoteBtnBgOff: "rgba(0,0,0,0.03)",
    quoteBtnText:  "#111",
    ctrlBg:        "white",
    ctrlBorder:    "rgba(0,0,0,0.12)",
    btnBorder:     "rgba(0,0,0,0.12)",
    clearBtnBg:    "rgba(0,0,0,0.10)",
    clearBtnColor: "rgba(0,0,0,0.45)",
    marginLine:    false,
    marginColor:   "transparent",
    marginBorder:  "",
    pageMarginBg:  "",
    brandText:     "#111",
    brandSub:      "rgba(0,0,0,0.28)",
    font:          "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

let _seq = 0
const uid = () => `r${Date.now()}${++_seq}`

const makeRow = (overrides: Partial<AnalogRow> = {}): AnalogRow => ({
  localId: uid(), queueEntryId: null, name: "", phone: "", notes: "",
  partySize: 2, quotedWait: null, status: "filling", source: "analog",
  addedMs: null, notifiedMs: null, seatedMs: null, deadlineMs: null,
  isPaused: false, pausedSecsLeft: 0,
  ...overrides,
})

function computeSecs(row: AnalogRow): number {
  if (!row.deadlineMs) return 0
  if (row.isPaused) return row.pausedSecsLeft
  return Math.max(0, Math.ceil((row.deadlineMs - Date.now()) / 1000))
}

function fmtCountdown(secs: number): string {
  const m = Math.floor(secs / 60); const s = secs % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

function fmtClock(ms: number | null): string {
  if (!ms) return "—"
  return new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
}

function waitedLabel(row: AnalogRow): string {
  if (!row.addedMs) return ""
  return `${Math.round(((row.seatedMs ?? Date.now()) - row.addedMs) / 60_000)}m`
}

// Format raw input to (XXX) XXX-XXXX as digits are typed / Scribbled
function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 10)
  if (d.length <= 3) return d
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function AnalogPage() {
  const [rows, setRows] = useState<AnalogRow[]>(() => {
    try { const s = localStorage.getItem("analog_rows"); if (s) { const p = JSON.parse(s) as AnalogRow[]; if (p.length) return p } } catch {}
    return [makeRow()]
  })
  const [tableAssignment, setTableAssignment] = useState(() => {
    try { const s = localStorage.getItem("analog_tables"); if (s !== null) return s === "true" } catch {}
    return true
  })
  const [tablePickFor,    setTablePickFor]   = useState<string | null>(null)
  const [confirmFor,      setConfirmFor]     = useState<string | null>(null)
  const [tables,          setTables]         = useState<Table[]>([])
  const [toast,           setToast]          = useState<string | null>(null)
  const [zoom, setZoom] = useState(() => {
    try { const s = localStorage.getItem("analog_zoom"); if (s) return parseFloat(s) || 1.0 } catch {}
    return 1.0
  })
  const [visual, setVisual] = useState<Visual>(() => {
    try { const s = localStorage.getItem("analog_visual"); if (s === "basic" || s === "classic" || s === "modern") return s } catch {}
    return "basic"
  })
  const [showVisuals,     setShowVisuals]    = useState(false)
  const [isLandscape,     setIsLandscape]    = useState(false)
  const [,                tick]              = useState(0)
  const knownIdsRef = useRef(new Set<string>())

  const V = makeV(visual)

  // ── Persist to localStorage ───────────────────────────────────────────────────
  useEffect(() => { try { localStorage.setItem("analog_rows", JSON.stringify(rows)) } catch {} }, [rows])
  useEffect(() => { try { localStorage.setItem("analog_visual", visual) } catch {} }, [visual])
  useEffect(() => { try { localStorage.setItem("analog_tables", String(tableAssignment)) } catch {} }, [tableAssignment])
  useEffect(() => { try { localStorage.setItem("analog_zoom", String(zoom)) } catch {} }, [zoom])

  useEffect(() => { const t = setInterval(() => tick(n => n + 1), 1000); return () => clearInterval(t) }, [])
  const showToast = useCallback((msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }, [])

  useEffect(() => {
    const check = () => setIsLandscape(window.innerWidth > window.innerHeight)
    check(); window.addEventListener("resize", check); return () => window.removeEventListener("resize", check)
  }, [])

  // ── Ensure blank row at bottom ────────────────────────────────────────────────
  useEffect(() => {
    setRows(prev => {
      const last = prev[prev.length - 1]
      if (!last || last.status !== "filling" || last.queueEntryId || last.name || last.phone)
        return [...prev, makeRow()]
      return prev
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length, rows.map(r => r.name + r.status + r.queueEntryId).join("|")])

  useEffect(() => {
    fetch(`${API}/tables?restaurant_id=${DEMO_RESTAURANT_ID}`).then(r => r.ok ? r.json() : []).then(setTables).catch(() => {})
  }, [])

  // ── Poll queue ────────────────────────────────────────────────────────────────
  const pollQueue = useCallback(async () => {
    try {
      const r = await fetch(`${API}/queue?restaurant_id=${DEMO_RESTAURANT_ID}`)
      if (!r.ok) return
      const data: QueueEntry[] = await r.json()
      setRows(prev => {
        let updated = [...prev]
        data.forEach(entry => {
          const existingIdx = updated.findIndex(r => r.queueEntryId === entry.id)
          if (existingIdx >= 0) {
            const ex = updated[existingIdx]
            if (entry.status === "seated" && ex.status !== "seated")
              updated = updated.map((r, i) => i === existingIdx ? { ...r, status: "seated" as const, seatedMs: r.seatedMs ?? Date.now() } : r)
            else if (entry.status === "removed" && ex.status !== "removed")
              updated = updated.map((r, i) => i === existingIdx ? { ...r, status: "removed" as const, seatedMs: r.seatedMs ?? Date.now(), removedByGuest: true } : r)
            return
          }
          if (entry.source === "analog" && !knownIdsRef.current.has(entry.id)) { knownIdsRef.current.add(entry.id); return }
          if (knownIdsRef.current.has(entry.id)) return
          knownIdsRef.current.add(entry.id)
          const isQuoted = !!entry.quoted_wait
          const arrivalMs = new Date(entry.arrival_time).getTime()
          const newRow: AnalogRow = makeRow({
            queueEntryId: entry.id, name: entry.name || "", phone: entry.phone || "",
            partySize: entry.party_size, quotedWait: entry.quoted_wait,
            status: isQuoted ? "waiting" : "filling",
            source: entry.source === "nfc" ? "nfc" : entry.source === "host" ? "host" : "web",
            addedMs: isQuoted ? arrivalMs : null,
            deadlineMs: isQuoted ? arrivalMs + (entry.quoted_wait! * 60_000) : null,
          })
          const blankIdx = updated.findLastIndex(r => !r.name && !r.phone && r.quotedWait === null && r.status === "filling" && !r.queueEntryId)
          updated = blankIdx >= 0 ? [...updated.slice(0, blankIdx), newRow, ...updated.slice(blankIdx)] : [...updated, newRow]
        })
        return updated
      })
    } catch {}
  }, [])

  useEffect(() => { pollQueue(); const t = setInterval(pollQueue, 5_000); return () => clearInterval(t) }, [pollQueue])

  const patchRow = useCallback((localId: string, patch: Partial<AnalogRow>) => {
    setRows(prev => prev.map(r => r.localId === localId ? { ...r, ...patch } : r))
  }, [])

  // ── Set quote ─────────────────────────────────────────────────────────────────
  const setQuote = useCallback(async (localId: string, minutes: number) => {
    // Read row directly — do NOT nest async work inside setRows
    const row = rows.find(r => r.localId === localId)
    if (!row) return
    const now = Date.now()
    if (row.queueEntryId) {
      // Guest already in queue — PATCH wait; backend fires link SMS on first quote automatically
      try { await fetch(`${API}/queue/${row.queueEntryId}/wait?minutes=${minutes}`, { method: "PATCH" }) } catch {}
      patchRow(localId, { quotedWait: minutes, status: "waiting", addedMs: row.addedMs ?? now, deadlineMs: (row.addedMs ?? now) + minutes * 60_000 })
    } else {
      // New guest — join + quote in one call; backend fires link SMS automatically for source "analog"
      if (!row.name.trim() && !row.phone.trim()) return
      try {
        const joinRes = await fetch(`${API}/queue/join`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: row.name.trim() || "Guest", party_size: row.partySize, phone: row.phone.trim() || null, notes: row.notes.trim() || null, restaurant_id: DEMO_RESTAURANT_ID, source: "analog", quoted_wait: minutes }),
        })
        if (!joinRes.ok) { showToast("Could not add guest"); return }
        const joined = await joinRes.json()
        const entryId = joined.entry?.id ?? joined.id  // API returns { entry: { id } }
        if (!entryId) { showToast("Could not add guest"); return }
        await fetch(`${API}/queue/${entryId}/wait?minutes=${minutes}`, { method: "PATCH" }).catch(() => {})
        knownIdsRef.current.add(entryId)
        patchRow(localId, { queueEntryId: entryId, quotedWait: minutes, status: "waiting", addedMs: now, deadlineMs: now + minutes * 60_000 })
        showToast(`${row.name || "Guest"} added · ${minutes}m`)
      } catch { showToast("Could not add guest") }
    }
  }, [rows, patchRow, showToast])

  const adjustTimer = useCallback((localId: string, delta: number) => {
    setRows(prev => prev.map(r => {
      if (r.localId !== localId) return r
      const newQuoted = Math.max(1, (r.quotedWait ?? 0) + delta)
      const updated = r.isPaused ? { ...r, quotedWait: newQuoted, pausedSecsLeft: Math.max(0, r.pausedSecsLeft + delta * 60) }
        : { ...r, quotedWait: newQuoted, deadlineMs: (computeSecs(r) === 0 && delta > 0) ? Date.now() + delta * 60_000 : (r.deadlineMs ?? Date.now()) + delta * 60_000 }
      if (r.queueEntryId) fetch(`${API}/queue/${r.queueEntryId}/wait?minutes=${newQuoted}`, { method: "PATCH" }).catch(() => {})
      return updated
    }))
  }, [])

  const togglePause = useCallback((localId: string) => {
    setRows(prev => prev.map(r => {
      if (r.localId !== localId) return r
      const willPause = !r.isPaused
      if (r.queueEntryId) fetch(`${API}/queue/${r.queueEntryId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paused: willPause }) }).catch(() => {})
      return willPause ? { ...r, isPaused: true, pausedSecsLeft: computeSecs(r) }
        : { ...r, isPaused: false, deadlineMs: Date.now() + r.pausedSecsLeft * 1000 }
    }))
  }, [])

  const notifyGuest = useCallback(async (localId: string) => {
    const row = rows.find(r => r.localId === localId)
    if (!row) return
    if (!row.queueEntryId) { showToast("Set a wait time first"); return }
    try {
      // Backend marks as ready AND sends the "table ready" SMS (has TEXTBELT_KEY)
      await fetch(`${API}/queue/${row.queueEntryId}/notify`, { method: "POST" })
      patchRow(localId, { status: "ready", notifiedMs: Date.now() })
      showToast(`${row.name || "Guest"} notified${row.phone.trim() ? " · text sent" : ""}`)
    } catch { showToast("Could not notify") }
  }, [rows, patchRow, showToast])

  const confirmAction = useCallback(async (localId: string, action: "seat" | "left") => {
    setConfirmFor(null)
    const row = rows.find(r => r.localId === localId)
    if (!row) return
    if (action === "seat") {
      if (tableAssignment && row.queueEntryId) { setTablePickFor(localId); return }
      if (row.queueEntryId) try { await fetch(`${API}/queue/${row.queueEntryId}/seat`, { method: "POST" }) } catch {}
      patchRow(localId, { status: "seated", seatedMs: Date.now() })
      showToast(`${row.name || "Guest"} seated`)
    } else {
      if (row.queueEntryId) try { await fetch(`${API}/queue/${row.queueEntryId}/remove`, { method: "POST" }) } catch {}
      patchRow(localId, { status: "removed", seatedMs: Date.now() })
      showToast(`${row.name || "Guest"} left`)
    }
  }, [rows, tableAssignment, patchRow, showToast])

  const seatToTable = useCallback(async (localId: string, tableNum: number) => {
    setTablePickFor(null)
    const row = rows.find(r => r.localId === localId)
    if (!row?.queueEntryId) return
    const apiTable = tables.find(t => t.table_number === tableNum)
    try {
      await fetch(apiTable ? `${API}/queue/${row.queueEntryId}/seat-to-table/${apiTable.id}` : `${API}/queue/${row.queueEntryId}/seat`, { method: "POST" })
    } catch {}
    patchRow(localId, { status: "seated", seatedMs: Date.now() })
    showToast(`${row.name || "Guest"} seated at Table ${tableNum}`)
  }, [rows, tables, patchRow, showToast])

  // ── Pen helpers ───────────────────────────────────────────────────────────────
  // Apple Pencil: clear text fields so Scribble writes fresh
  const clearOnPen = useCallback((localId: string, field: "name" | "phone" | "notes") =>
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === "pen") patchRow(localId, { [field]: "" } as Partial<AnalogRow>)
    }, [patchRow])

  // Apple Pencil on party size: select all so Scribble replaces the number
  const selectOnPen = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "pen") {
      const input = (e.currentTarget as HTMLDivElement).querySelector("input")
      setTimeout(() => input?.select(), 0)
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────────
  const activeRows    = rows.filter(r => r.status !== "seated" && r.status !== "removed")
  const completedRows = rows.filter(r => r.status === "seated" || r.status === "removed")
  const confirmRow    = confirmFor ? rows.find(r => r.localId === confirmFor) : null

  const gridCols = isLandscape
    ? "52px 1fr 100px 1fr minmax(170px,1.2fr) minmax(140px,1fr)"
    : "52px 1fr 100px 1fr minmax(170px,1.2fr)"
  const colHeaders = isLandscape
    ? ["", "Name", "Party", "Phone", "Wait / Timer", "Notes"]
    : ["", "Name", "Party", "Phone", "Wait / Timer"]

  const ctrlBtn: React.CSSProperties = {
    width: 42, height: 42, borderRadius: 10,
    border: `1px solid ${V.ctrlBorder}`, background: V.ctrlBg,
    color: V.text, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    boxShadow: "0 1px 3px rgba(0,0,0,0.07)", touchAction: "manipulation", flex: 1,
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100dvh", background: V.pageBg, fontFamily: V.font, display: "flex", flexDirection: "column" }}>

      {/* ── Header ── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 50,
        background: V.headerBg, backdropFilter: "blur(16px)",
        borderBottom: `1px solid ${V.headerBorder}`,
        padding: "0 16px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Link href="/demo/station" style={{ display: "flex", alignItems: "center", color: V.textMuted, textDecoration: "none", padding: "6px 6px", borderRadius: 8 }}>
            <ChevronLeft style={{ width: 16, height: 16 }} />
          </Link>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: "0.04em", color: V.brandText }}>HOST</span>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", color: V.brandSub, textTransform: "uppercase" }}>Analog</span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Zoom */}
          <div style={{ display: "flex", alignItems: "center", gap: 2, background: visual === "modern" ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.04)", borderRadius: 10, padding: "2px 4px" }}>
            <button onClick={() => setZoom(z => Math.max(0.6, parseFloat((z - 0.1).toFixed(1))))}
              style={{ width: 32, height: 32, border: "none", background: "transparent", color: V.textSub, fontSize: 18, cursor: "pointer", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>−</button>
            <span style={{ fontSize: 11, fontWeight: 700, color: V.textMuted, minWidth: 32, textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(2.0, parseFloat((z + 0.1).toFixed(1))))}
              style={{ width: 32, height: 32, border: "none", background: "transparent", color: V.textSub, fontSize: 18, cursor: "pointer", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>+</button>
          </div>

          {/* Visuals */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowVisuals(v => !v)}
              style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 15px", borderRadius: 12, border: `1.5px solid ${showVisuals ? V.textSub : V.btnBorder}`, background: showVisuals ? (visual === "modern" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.07)") : (visual === "modern" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)"), cursor: "pointer", touchAction: "manipulation", boxShadow: showVisuals ? "0 2px 12px rgba(0,0,0,0.14)" : "none", transition: "all 0.12s" }}
            >
              <Palette style={{ width: 16, height: 16, color: V.textSub }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: V.textSub, letterSpacing: "0.01em" }}>Visuals</span>
            </button>
            {showVisuals && (
              <div style={{
                position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 200,
                background: visual === "modern" ? "#1A1A1A" : "white",
                border: `1px solid ${V.btnBorder}`,
                borderRadius: 14, padding: 8, minWidth: 160,
                boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
              }}>
                {(["basic", "classic", "modern"] as Visual[]).map(opt => (
                  <button
                    key={opt}
                    onClick={() => { setVisual(opt); setShowVisuals(false) }}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 12px", borderRadius: 10, border: "none", cursor: "pointer",
                      background: visual === opt
                        ? (visual === "modern" ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.06)")
                        : "transparent",
                      textAlign: "left",
                    }}
                  >
                    {/* Swatch */}
                    <div style={{
                      width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                      background: opt === "classic" ? "linear-gradient(135deg, #FFFDE7 50%, #D4C5A9 50%)"
                        : opt === "modern" ? "linear-gradient(135deg, #0A0A0A 50%, #FFB964 50%)"
                        : "linear-gradient(135deg, #FAFAF8 50%, #E5E5E5 50%)",
                      border: "1px solid rgba(0,0,0,0.12)",
                    }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: visual === "modern" ? "rgba(255,255,255,0.90)" : "#111" }}>
                        {opt === "basic" ? "Basic" : opt === "classic" ? "Classic" : "Modern"}
                      </div>
                      <div style={{ fontSize: 11, color: visual === "modern" ? "rgba(255,255,255,0.40)" : "rgba(0,0,0,0.40)" }}>
                        {opt === "basic" ? "Clean & minimal" : opt === "classic" ? "Yellow notepad" : "HOST dark theme"}
                      </div>
                    </div>
                    {visual === opt && <Check style={{ width: 14, height: 14, color: "#22c55e", marginLeft: "auto" }} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Table Assignment */}
          <button
            onClick={() => setTableAssignment(v => !v)}
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 15px", borderRadius: 12, border: `1.5px solid ${tableAssignment ? "rgba(34,197,94,0.50)" : V.btnBorder}`, background: tableAssignment ? "rgba(34,197,94,0.11)" : (visual === "modern" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)"), cursor: "pointer", touchAction: "manipulation", boxShadow: tableAssignment ? "0 0 0 1px rgba(34,197,94,0.18), 0 2px 10px rgba(34,197,94,0.18)" : "none", transition: "all 0.12s" }}
          >
            {tableAssignment ? <ToggleRight style={{ width: 17, height: 17, color: "#22c55e" }} /> : <ToggleLeft style={{ width: 17, height: 17, color: V.textMuted }} />}
            <span style={{ fontSize: 13, fontWeight: 700, color: tableAssignment ? "#16a34a" : V.textSub, letterSpacing: "0.01em" }}>Tables</span>
          </button>

          {/* Stats */}
          <Link href="/demo/stats" style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 15px", borderRadius: 12, border: `1.5px solid ${V.btnBorder}`, background: visual === "modern" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)", color: V.textSub, textDecoration: "none", fontSize: 13, fontWeight: 700, letterSpacing: "0.01em", touchAction: "manipulation" }}>
            <History style={{ width: 16, height: 16 }} />
            Stats
          </Link>
        </div>
      </header>

      {/* Click away from visuals popup */}
      {showVisuals && <div style={{ position: "fixed", inset: 0, zIndex: 49 }} onClick={() => setShowVisuals(false)} />}

      {/* Classic notepad double margin lines — fixed so they run infinite height */}
      {visual === "classic" && <>
        <div style={{ position: "fixed", top: 56, bottom: 0, left: 53, width: 2, background: "rgba(200,50,50,0.65)", zIndex: 1, pointerEvents: "none" }} />
        <div style={{ position: "fixed", top: 56, bottom: 0, left: 59, width: 2, background: "rgba(200,50,50,0.65)", zIndex: 1, pointerEvents: "none" }} />
      </>}

      {/* ── Scaled content ── */}
      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        <div style={{ overflowY: "auto", height: "100%", boxSizing: "border-box", paddingBottom: `calc(100dvh / ${zoom})` }}>
          <div style={{ transform: `scale(${zoom})`, transformOrigin: "top left", width: `${(1 / zoom) * 100}%`, minHeight: `${(1 / zoom) * 100}%` }}>

            {/* ── Column Headers ── */}
            <div style={{ background: V.colHeaderBg, borderBottom: `1px solid ${V.rowBorder}`, display: "grid", gridTemplateColumns: gridCols, padding: "6px 16px" }}>
              {colHeaders.map((h, i) => (
                <div key={i} style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: V.colHeaderText, paddingLeft: i > 0 ? 8 : 0 }}>{h}</div>
              ))}
            </div>

            {/* ── Completed rows (above active — scroll up for history) ── */}
            {completedRows.length > 0 && (
              <>
                <div style={{ padding: "10px 16px 6px", background: V.completedBg }}>
                  <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: V.textMuted }}>Completed · {completedRows.length}</span>
                </div>
                {completedRows.map(row => (
                  <div key={row.localId} style={{ display: "grid", gridTemplateColumns: gridCols, alignItems: "center", minHeight: 48, borderBottom: `1px solid ${V.rowBorder}`, background: V.completedBg, padding: "6px 0" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: row.status === "seated" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.08)", border: `1.5px solid ${row.status === "seated" ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.25)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {row.status === "seated" ? <Check style={{ width: 14, height: 14, color: "#16a34a" }} /> : <X style={{ width: 14, height: 14, color: "#dc2626" }} />}
                      </div>
                    </div>
                    <div style={{ padding: "0 8px" }}><span style={{ fontSize: 14, fontWeight: 500, color: V.textSub }}>{row.name || "Guest"}</span></div>
                    <div style={{ textAlign: "center" }}><span style={{ fontSize: 13, color: V.textMuted }}>{row.partySize}p</span></div>
                    <div style={{ padding: "0 8px" }}><span style={{ fontSize: 12, color: V.textMuted }}>{row.phone || "—"}</span></div>
                    <div style={{ padding: "0 10px 0 6px" }}>
                      <div style={{ fontSize: 11, color: V.textMuted, display: "flex", flexWrap: "wrap", gap: "2px 10px" }}>
                        {row.status === "removed" && <span style={{ color: "rgba(239,68,68,0.70)", fontWeight: 600 }}>{row.removedByGuest ? "Left waitlist" : "Removed by host"}</span>}
                        <span>In {fmtClock(row.addedMs)}</span>
                        {row.notifiedMs && <span>Notified {fmtClock(row.notifiedMs)}</span>}
                        <span>Waited {waitedLabel(row)}</span>
                      </div>
                    </div>
                    {isLandscape && <div style={{ padding: "0 8px" }}><span style={{ fontSize: 12, color: V.textMuted }}>{row.notes || "—"}</span></div>}
                  </div>
                ))}
                <div style={{ height: 1, background: V.completedDiv, margin: "4px 0 0" }} />
              </>
            )}

            {/* ── Active Rows ── */}
            {activeRows.map((row) => {
              const isBlank    = !row.name && !row.phone && row.quotedWait === null && !row.queueEntryId
              const isExternal = row.source === "nfc" || row.source === "web" || row.source === "host"
              const needsQuote = row.status === "filling" && !!row.queueEntryId && isExternal
              const isWaiting  = row.status === "waiting" || row.status === "ready"
              const secs       = computeSecs(row)
              const isOverdue  = isWaiting && secs === 0

              const sourceBadge = row.source === "nfc" ? { label: "NFC", color: "rgba(251,191,36,0.90)" }
                : row.source === "web"   ? { label: "Web",        color: "rgba(99,102,241,0.75)" }
                : row.source === "host"  ? { label: "Host",       color: V.textMuted }
                : !isBlank               ? { label: "Host Stand", color: V.textMuted }
                : null

              return (
                <div key={row.localId} style={{
                  display: "grid", gridTemplateColumns: gridCols, alignItems: "center",
                  minHeight: 68, borderBottom: `1px solid ${V.rowBorder}`,
                  background: needsQuote ? V.rowBgNFC : isOverdue ? V.rowBgOverdue : V.rowBgNormal,
                  padding: "8px 0",
                }}>

                  {/* Checkbox */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {!isBlank && (
                      <button
                        onPointerDown={() => setConfirmFor(row.localId)}
                        style={{ width: 44, height: 44, borderRadius: 10, border: `2px solid ${isWaiting ? V.textSub : V.rowBorder}`, background: visual === "modern" ? "rgba(255,255,255,0.05)" : "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", touchAction: "manipulation", boxShadow: isWaiting ? "0 1px 4px rgba(0,0,0,0.08)" : "none" }}
                      />
                    )}
                  </div>

                  {/* Name */}
                  <div style={{ padding: "0 8px" }}>
                    {isExternal && !row.name ? (
                      <span style={{ fontSize: 13, color: V.textMuted, fontStyle: "italic" }}>{row.source === "nfc" ? "NFC guest" : "Guest"}</span>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }} onPointerDown={clearOnPen(row.localId, "name")}>
                        <input
                          type="text" value={row.name}
                          onChange={e => patchRow(row.localId, { name: e.target.value })}
                          placeholder="Write name…" inputMode="text"
                          autoCorrect="off" spellCheck={false} autoCapitalize="words"
                          style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 15, fontWeight: 500, color: V.inputColor, padding: "8px 0", caretColor: "#22c55e", minWidth: 0, touchAction: "manipulation" }}
                        />
                        {row.name && (
                          <button onPointerDown={e => { e.preventDefault(); patchRow(row.localId, { name: "" }) }} style={{ width: 20, height: 20, borderRadius: 10, border: "none", background: V.clearBtnBg, color: V.clearBtnColor, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, touchAction: "manipulation" }}>×</button>
                        )}
                      </div>
                    )}
                    {sourceBadge && <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: sourceBadge.color, marginTop: 1 }}>{sourceBadge.label}</div>}
                  </div>

                  {/* Party size — number input for pen + stepper for finger */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0 }} onPointerDown={selectOnPen}>
                    <button onPointerDown={() => { const s = Math.max(1, row.partySize - 1); patchRow(row.localId, { partySize: s }); if (row.queueEntryId) fetch(`${API}/queue/${row.queueEntryId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ party_size: s }) }).catch(() => {}) }} style={{ width: 30, height: 40, border: "none", background: "transparent", color: V.textSub, fontSize: 20, cursor: "pointer", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", touchAction: "manipulation" }}>−</button>
                    <input
                      type="number" min={1} max={20} value={row.partySize}
                      onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v)) { const s = Math.max(1, Math.min(20, v)); patchRow(row.localId, { partySize: s }); if (row.queueEntryId) fetch(`${API}/queue/${row.queueEntryId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ party_size: s }) }).catch(() => {}) } }}
                      inputMode="numeric"
                      style={{ width: 30, textAlign: "center", border: "none", outline: "none", background: "transparent", fontSize: 16, fontWeight: 700, color: V.text, caretColor: "#22c55e", touchAction: "manipulation", MozAppearance: "textfield" } as React.CSSProperties}
                    />
                    <button onPointerDown={() => { const s = Math.min(20, row.partySize + 1); patchRow(row.localId, { partySize: s }); if (row.queueEntryId) fetch(`${API}/queue/${row.queueEntryId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ party_size: s }) }).catch(() => {}) }} style={{ width: 30, height: 40, border: "none", background: "transparent", color: V.textSub, fontSize: 20, cursor: "pointer", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", touchAction: "manipulation" }}>+</button>
                  </div>

                  {/* Phone */}
                  <div style={{ padding: "0 8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }} onPointerDown={clearOnPen(row.localId, "phone")}>
                      <input
                        type="tel" value={row.phone}
                        onChange={e => patchRow(row.localId, { phone: formatPhone(e.target.value) })}
                        placeholder="Write number…" inputMode="tel"
                        autoCorrect="off" spellCheck={false} autoCapitalize="off"
                        style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 15, fontWeight: 500, color: V.inputColor, padding: "8px 0", caretColor: "#22c55e", minWidth: 0, touchAction: "manipulation" }}
                      />
                      {row.phone && (
                        <button onPointerDown={e => { e.preventDefault(); patchRow(row.localId, { phone: "" }) }} style={{ width: 20, height: 20, borderRadius: 10, border: "none", background: V.clearBtnBg, color: V.clearBtnColor, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, touchAction: "manipulation" }}>×</button>
                      )}
                    </div>
                  </div>

                  {/* Wait / Timer */}
                  <div style={{ padding: "0 10px 0 6px" }}>
                    {!isWaiting ? (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 5 }}>
                        {QUOTE_PRESETS.map(t => (
                          <button key={t}
                            onPointerDown={e => { e.preventDefault(); if (!isBlank) setQuote(row.localId, t) }}
                            onClick={() => { if (!isBlank) setQuote(row.localId, t) }}
                            style={{ height: 48, borderRadius: 12, border: `1px solid ${V.btnBorder}`, background: isBlank ? V.quoteBtnBgOff : V.quoteBtnBg, color: isBlank ? V.textMuted : V.quoteBtnText, fontSize: 15, fontWeight: 700, cursor: isBlank ? "default" : "pointer", boxShadow: isBlank ? "none" : "0 1px 4px rgba(0,0,0,0.07)", touchAction: "manipulation", opacity: isBlank ? 0.4 : 1 }}>{t}</button>
                        ))}
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ textAlign: "center", minWidth: 56 }}>
                          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1, color: isOverdue ? "#dc2626" : secs < 60 ? "#f97316" : V.text, fontVariantNumeric: "tabular-nums" }}>
                            {row.isPaused ? <span style={{ color: V.textSub }}>{fmtCountdown(row.pausedSecsLeft)}</span> : fmtCountdown(secs)}
                          </div>
                          {row.isPaused && <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: V.textMuted, textTransform: "uppercase", marginTop: 2 }}>Paused</div>}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 5, flex: 1 }}>
                          <div style={{ display: "flex", gap: 5 }}>
                            <button onPointerDown={() => adjustTimer(row.localId, -1)} style={ctrlBtn}><Minus style={{ width: 15, height: 15 }} /></button>
                            <button onPointerDown={() => togglePause(row.localId)} style={ctrlBtn}>{row.isPaused ? <Play style={{ width: 15, height: 15 }} /> : <Pause style={{ width: 15, height: 15 }} />}</button>
                            <button onPointerDown={() => adjustTimer(row.localId, 1)} style={ctrlBtn}><Plus style={{ width: 15, height: 15 }} /></button>
                          </div>
                          <button
                            onPointerDown={() => row.status !== "ready" && notifyGuest(row.localId)}
                            style={{ height: 44, borderRadius: 10, border: "none", cursor: row.status === "ready" ? "default" : "pointer", fontSize: 13, fontWeight: 700, touchAction: "manipulation", background: row.status === "ready" ? "rgba(34,197,94,0.10)" : "rgba(34,197,94,0.88)", color: row.status === "ready" ? "#16a34a" : "white", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all 0.12s", boxShadow: row.status === "ready" ? "none" : "0 2px 8px rgba(34,197,94,0.25)" }}
                          >
                            <Bell style={{ width: 14, height: 14 }} />
                            {row.status === "ready" ? "Notified" : "Notify"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Notes — landscape: inline column */}
                  {!isBlank && isLandscape && (
                    <div style={{ padding: "0 10px" }} onPointerDown={clearOnPen(row.localId, "notes")}>
                      <input
                        type="text" value={row.notes}
                        onChange={e => patchRow(row.localId, { notes: e.target.value })}
                        placeholder="Notes…" inputMode="text"
                        autoCorrect="off" spellCheck={false} autoCapitalize="sentences"
                        style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontSize: 13, color: V.inputColor, caretColor: "#22c55e", borderBottom: `1px solid ${V.rowBorder}`, padding: "6px 0", touchAction: "manipulation" }}
                      />
                    </div>
                  )}

                  {/* Notes — portrait: distinct card below row */}
                  {!isBlank && !isLandscape && (
                    <div style={{ gridColumn: "1 / -1", margin: "6px 12px 10px 60px", background: V.notesBg, borderRadius: 10, border: `1px solid ${V.notesBorder}`, padding: "7px 12px" }} onPointerDown={clearOnPen(row.localId, "notes")}>
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: V.notesLabel, marginBottom: 3 }}>Notes</div>
                      <input
                        type="text" value={row.notes}
                        onChange={e => patchRow(row.localId, { notes: e.target.value })}
                        placeholder="Allergies, special requests…" inputMode="text"
                        autoCorrect="off" spellCheck={false} autoCapitalize="sentences"
                        style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontSize: 13, color: V.inputColor, caretColor: "#22c55e", touchAction: "manipulation" }}
                      />
                    </div>
                  )}
                </div>
              )
            })}

            <div style={{ height: 40 }} />
          </div>
        </div>
      </div>

      {/* ── Confirm Modal ── */}
      {confirmFor && confirmRow && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.40)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end" }} onPointerDown={() => setConfirmFor(null)}>
          <div style={{ width: "100%", background: "white", borderRadius: "24px 24px 0 0", padding: "28px 24px 48px" }} onPointerDown={e => e.stopPropagation()}>
            <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 600, color: "rgba(0,0,0,0.40)", letterSpacing: "0.04em", textTransform: "uppercase" }}>{confirmRow.name || "Guest"} · Party of {confirmRow.partySize}</p>
            <p style={{ margin: "0 0 24px", fontSize: 19, fontWeight: 700, color: "#111" }}>Seat or mark as left?</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <button onPointerDown={() => confirmAction(confirmFor, "seat")} style={{ height: 68, borderRadius: 18, border: "none", cursor: "pointer", fontSize: 18, fontWeight: 800, background: "rgba(34,197,94,0.88)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, boxShadow: "0 4px 16px rgba(34,197,94,0.28)", touchAction: "manipulation" }}>
                <Check style={{ width: 22, height: 22 }} />Seat Guest
              </button>
              <button onPointerDown={() => confirmAction(confirmFor, "left")} style={{ height: 68, borderRadius: 18, border: "none", cursor: "pointer", fontSize: 18, fontWeight: 800, background: "rgba(239,68,68,0.88)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, boxShadow: "0 4px 16px rgba(239,68,68,0.20)", touchAction: "manipulation" }}>
                <X style={{ width: 22, height: 22 }} />Guest Left
              </button>
              <button onPointerDown={() => setConfirmFor(null)} style={{ height: 44, borderRadius: 12, border: "1px solid rgba(0,0,0,0.10)", background: "rgba(0,0,0,0.03)", color: "rgba(0,0,0,0.40)", fontSize: 14, fontWeight: 600, cursor: "pointer", touchAction: "manipulation" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Table Picker ── */}
      {tablePickFor && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end" }} onPointerDown={() => setTablePickFor(null)}>
          <div style={{ width: "100%", background: "white", borderRadius: "20px 20px 0 0", padding: "24px 20px 44px", maxHeight: "65dvh", overflowY: "auto" }} onPointerDown={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <p style={{ fontSize: 17, fontWeight: 700, color: "#111", margin: 0 }}>Select Table</p>
              <button onPointerDown={() => setTablePickFor(null)} style={{ border: "none", background: "none", cursor: "pointer", color: "rgba(0,0,0,0.40)", fontSize: 20, lineHeight: 1, touchAction: "manipulation" }}>✕</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              {TABLE_NUMBERS.map(n => {
                const occupied = tables.find(t => t.table_number === n)?.status === "occupied"
                return (
                  <button key={n} onPointerDown={() => !occupied && seatToTable(tablePickFor!, n)} disabled={occupied} style={{ height: 60, borderRadius: 14, border: `2px solid ${occupied ? "rgba(239,68,68,0.35)" : "rgba(34,197,94,0.40)"}`, background: occupied ? "rgba(239,68,68,0.07)" : "rgba(34,197,94,0.07)", color: occupied ? "#dc2626" : "#16a34a", fontSize: 20, fontWeight: 800, cursor: occupied ? "default" : "pointer", touchAction: "manipulation" }}>
                    {n}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div style={{ position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.82)", color: "white", padding: "10px 20px", borderRadius: 10, fontSize: 13, fontWeight: 600, backdropFilter: "blur(12px)", zIndex: 300, whiteSpace: "nowrap" }}>
          {toast}
        </div>
      )}
    </div>
  )
}
