"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import {
  Plus, Minus, Bell, Pause, Play,
  ChevronLeft, Check, X, Palette, Move,
} from "lucide-react"

const API          = "https://restaurant-brain-production.up.railway.app"
const QUOTE_PRESETS = [5, 10, 15, 20]

function getBusinessDate(): string {
  const now = new Date()
  if (now.getHours() < 3) now.setDate(now.getDate() - 1)
  return now.toLocaleDateString("en-CA")
}

function parseUTCMs(ts: string | null | undefined): number | null {
  if (!ts) return null
  const s = (ts.endsWith("Z") || /[+-]\d{2}:?\d{2}$/.test(ts))
    ? ts
    : ts.replace(" ", "T") + "Z"
  const ms = new Date(s).getTime()
  return isNaN(ms) ? null : ms
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface QueueEntry {
  id: string; name: string; party_size: number
  status: "waiting" | "ready" | "seated" | "removed"
  source: string; quoted_wait: number | null
  arrival_time: string; phone: string | null; notes: string | null
  wait_set_at?: string | null
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
    pageBg: "#FFFDE7", headerBg: "rgba(255,253,220,0.97)", headerBorder: "rgba(180,150,60,0.28)",
    colHeaderBg: "rgba(255,253,220,0.97)", colHeaderText: "rgba(100,70,30,0.45)",
    rowBorder: "rgba(168,210,228,0.80)", rowBgNormal: "transparent",
    rowBgNFC: "rgba(251,191,36,0.09)", rowBgOverdue: "rgba(220,38,38,0.07)",
    completedBg: "rgba(180,150,60,0.05)", completedDiv: "rgba(168,210,228,0.65)",
    text: "#3D2B1F", textSub: "rgba(61,43,31,0.55)", textMuted: "rgba(61,43,31,0.38)",
    inputColor: "#3D2B1F", notesBg: "rgba(168,210,228,0.12)", notesBorder: "rgba(168,210,228,0.65)",
    notesLabel: "rgba(100,70,30,0.40)", quoteBtnBg: "rgba(255,250,200,0.88)",
    quoteBtnBgOff: "rgba(180,150,60,0.07)", quoteBtnText: "#3D2B1F",
    ctrlBg: "rgba(255,250,200,0.88)", ctrlBorder: "rgba(180,150,60,0.30)",
    btnBorder: "rgba(180,150,60,0.28)", clearBtnBg: "rgba(180,150,60,0.15)",
    clearBtnColor: "rgba(61,43,31,0.50)", brandText: "rgba(90,165,195,0.95)",
    brandSub: "rgba(90,165,195,0.65)", font: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  }
  if (v === "modern") return {
    pageBg: "#0A0A0A", headerBg: "rgba(7,4,2,0.98)", headerBorder: "rgba(255,185,100,0.18)",
    colHeaderBg: "rgba(12,9,7,0.97)", colHeaderText: "rgba(255,255,255,0.28)",
    rowBorder: "rgba(255,255,255,0.07)", rowBgNormal: "transparent",
    rowBgNFC: "rgba(251,191,36,0.07)", rowBgOverdue: "rgba(239,68,68,0.12)",
    completedBg: "rgba(255,255,255,0.03)", completedDiv: "rgba(255,255,255,0.12)",
    text: "rgba(255,255,255,0.92)", textSub: "rgba(255,255,255,0.45)", textMuted: "rgba(255,255,255,0.28)",
    inputColor: "rgba(255,255,255,0.88)", notesBg: "rgba(255,255,255,0.05)",
    notesBorder: "rgba(255,255,255,0.10)", notesLabel: "rgba(255,255,255,0.28)",
    quoteBtnBg: "rgba(255,255,255,0.08)", quoteBtnBgOff: "rgba(255,255,255,0.03)",
    quoteBtnText: "rgba(255,255,255,0.85)", ctrlBg: "rgba(255,255,255,0.08)",
    ctrlBorder: "rgba(255,255,255,0.14)", btnBorder: "rgba(255,255,255,0.14)",
    clearBtnBg: "rgba(255,255,255,0.12)", clearBtnColor: "rgba(255,255,255,0.50)",
    brandText: "rgba(255,255,255,0.92)", brandSub: "rgba(255,255,255,0.28)",
    font: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  }
  // basic
  return {
    pageBg: "#FAFAF8", headerBg: "rgba(255,255,255,0.96)", headerBorder: "rgba(0,0,0,0.09)",
    colHeaderBg: "rgba(250,250,248,0.97)", colHeaderText: "rgba(0,0,0,0.28)",
    rowBorder: "rgba(0,0,0,0.07)", rowBgNormal: "transparent",
    rowBgNFC: "rgba(251,191,36,0.06)", rowBgOverdue: "rgba(239,68,68,0.04)",
    completedBg: "rgba(0,0,0,0.025)", completedDiv: "rgba(0,0,0,0.10)",
    text: "#111", textSub: "rgba(0,0,0,0.45)", textMuted: "rgba(0,0,0,0.28)",
    inputColor: "#111", notesBg: "rgba(0,0,0,0.025)", notesBorder: "rgba(0,0,0,0.07)",
    notesLabel: "rgba(0,0,0,0.28)", quoteBtnBg: "white", quoteBtnBgOff: "rgba(0,0,0,0.03)",
    quoteBtnText: "#111", ctrlBg: "white", ctrlBorder: "rgba(0,0,0,0.12)",
    btnBorder: "rgba(0,0,0,0.12)", clearBtnBg: "rgba(0,0,0,0.10)",
    clearBtnColor: "rgba(0,0,0,0.45)", brandText: "#111", brandSub: "rgba(0,0,0,0.28)",
    font: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
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

function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 10)
  if (d.length <= 3) return d
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
}

// ── Restaurant config (fetched on mount) ─────────────────────────────────────

interface RestaurantConfig {
  rid:     string
  name:    string
  slug:    string
  logoUrl?: string
}

// ── Table picker (seat / move / clear) ─────────────────────────────────────────
// Used by the analog page for any action that targets a specific table:
//   - Seating a waiting guest at a chosen table (replaces the auto-pick flow).
//   - Moving an already-seated guest to a different table.
//   - Clearing (removing) the current occupant of a table.
// The tile grid mirrors the station floor map at a glance but is tuned for a tablet:
// big tap targets, state-colored (green=available, red=occupied), occupant name visible.

interface TileOcc { name: string; party_size: number; entry_id?: string }

function TablePicker({
  mode,
  rid,
  apiBase,
  sourceTableId,
  label,
  onDone,
  onCancel,
}: {
  mode: "seat" | "move"
  rid: string
  apiBase: string
  // for move mode: the table_id the guest is currently at, so we can clear it after the destination
  // accepts a clear/occupy change. omitted for "seat".
  sourceTableId?: string
  label: string
  onDone: (targetTable: { id: string; number: number }) => void
  onCancel: () => void
}) {
  const [tables,    setTables]    = useState<Table[]>([])
  const [occupants, setOccupants] = useState<Record<string, TileOcc>>({})
  const [busy,      setBusy]      = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  // When the user taps an occupied table, we offer a choice between "Clear" and "Move".
  // Move flips the picker into a sub-mode where the NEXT tap targets the move destination.
  const [occupiedAction, setOccupiedAction] = useState<{ table: Table; occ: TileOcc } | null>(null)
  const [pendingMove,    setPendingMove]    = useState<{ fromTable: Table; occ: TileOcc } | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [tRes, oRes] = await Promise.all([
        fetch(`${apiBase}/state?restaurant_id=${rid}`),
        fetch(`${apiBase}/tables/occupants?restaurant_id=${rid}`),
      ])
      if (tRes.ok) {
        const d = await tRes.json()
        // Normalize table_number — Supabase returns it as a string in some responses.
        const normalized: Table[] = (d.tables ?? []).map((t: Table) => ({
          ...t,
          table_number: typeof t.table_number === "number" ? t.table_number : parseInt(String(t.table_number), 10),
        }))
        setTables(normalized)
      }
      if (oRes.ok) setOccupants(await oRes.json())
    } catch {}
  }, [apiBase, rid])

  useEffect(() => { refresh(); const t = setInterval(refresh, 2000); return () => clearInterval(t) }, [refresh])

  const handleTap = async (t: Table) => {
    if (busy) return
    const occ = occupants[String(t.table_number)]

    // If we're mid-way through a "move an existing occupant" sub-flow, the NEXT tap is the
    // destination. Only allow available tiles to be the destination.
    if (pendingMove) {
      if (occ) {
        setError(`Table ${t.table_number} is already occupied — pick an empty table.`)
        return
      }
      setBusy(true); setError(null)
      try {
        // Clear the source, occupy the destination. Non-atomic but simple.
        await fetch(`${apiBase}/tables/${pendingMove.fromTable.id}/clear`, { method: "POST" }).catch(() => {})
        const r = await fetch(`${apiBase}/tables/${t.id}/occupy`, { method: "POST" })
        if (!r.ok) throw new Error(`occupy failed (${r.status})`)
        // Re-link the queue entry to the new table so /tables/occupants shows the name here.
        if (pendingMove.occ.entry_id) {
          await fetch(`${apiBase}/queue/${pendingMove.occ.entry_id}/seat-to-table/${t.id}`, { method: "POST" }).catch(() => {})
        }
        setPendingMove(null)
        await refresh()
      } catch (e) {
        setError(`Couldn't move to Table ${t.table_number}. ${e instanceof Error ? e.message : ""}`)
      }
      setBusy(false)
      return
    }

    if (occ) {
      // Offer Clear or Move for occupied tiles.
      setOccupiedAction({ table: t, occ })
      return
    }
    // Available — execute the mode action.
    setBusy(true)
    setError(null)
    try {
      if (mode === "move" && sourceTableId) {
        // Clear source first, then occupy target. Non-atomic but simple; server /occupy is
        // sibling-safe on table_number so a stale source won't block the target.
        await fetch(`${apiBase}/tables/${sourceTableId}/clear`, { method: "POST" }).catch(() => {})
        const r = await fetch(`${apiBase}/tables/${t.id}/occupy`, { method: "POST" })
        if (!r.ok) throw new Error(`occupy failed (${r.status})`)
      }
      onDone({ id: t.id, number: t.table_number })
    } catch (e) {
      setError(`Couldn't use Table ${t.table_number}. ${e instanceof Error ? e.message : ""}`)
      setBusy(false)
    }
  }

  const doClear = async () => {
    if (!occupiedAction) return
    const { table } = occupiedAction
    setBusy(true); setError(null)
    try {
      const r = await fetch(`${apiBase}/tables/${table.id}/clear`, { method: "POST" })
      if (!r.ok) throw new Error(`clear failed (${r.status})`)
      setOccupiedAction(null)
      await refresh()
    } catch (e) {
      setError(`Couldn't clear Table ${table.table_number}. ${e instanceof Error ? e.message : ""}`)
    }
    setBusy(false)
  }

  const startMove = () => {
    if (!occupiedAction) return
    setPendingMove({ fromTable: occupiedAction.table, occ: occupiedAction.occ })
    setOccupiedAction(null)
  }

  const rendered = tables.length > 0
    ? [...tables].sort((a, b) => a.table_number - b.table_number)
    : []

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 250, background: "rgba(0,0,0,0.58)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center" }} onPointerDown={onCancel}>
      <div style={{ width: "min(640px, 96vw)", maxHeight: "90vh", overflow: "auto", background: "white", borderRadius: 20, padding: 22, boxShadow: "0 20px 60px rgba(0,0,0,0.35)" }} onPointerDown={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#111" }}>{label}</p>
          <button onPointerDown={onCancel} style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid rgba(0,0,0,0.10)", background: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(0,0,0,0.55)" }}>
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>
        <p style={{ margin: "0 0 16px", fontSize: 12, color: "rgba(0,0,0,0.52)" }}>
          {pendingMove
            ? `Moving ${pendingMove.occ.name || "guest"} from Table ${pendingMove.fromTable.table_number} — tap an empty table.`
            : `Tap an available table to ${mode === "move" ? "move here" : "seat"}. Tap an occupied table to move or clear that guest.`}
        </p>

        {pendingMove && (
          <button onPointerDown={() => setPendingMove(null)} style={{ marginBottom: 12, padding: "8px 12px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.12)", background: "rgba(0,0,0,0.04)", color: "rgba(0,0,0,0.65)", fontSize: 12, cursor: "pointer" }}>
            Cancel move
          </button>
        )}

        {rendered.length === 0 ? (
          <p style={{ textAlign: "center", padding: 20, color: "rgba(0,0,0,0.45)" }}>Loading tables…</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            {rendered.map(t => {
              const occ = occupants[String(t.table_number)]
              const isOccupied = !!occ
              return (
                <button key={t.id}
                  disabled={busy}
                  onPointerDown={() => handleTap(t)}
                  style={{
                    aspectRatio: "1/1", borderRadius: 14, padding: 8,
                    background: isOccupied ? "rgba(239,68,68,0.10)" : "rgba(34,197,94,0.10)",
                    border: `1.5px solid ${isOccupied ? "rgba(239,68,68,0.45)" : "rgba(34,197,94,0.45)"}`,
                    cursor: busy ? "wait" : "pointer", touchAction: "manipulation",
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    gap: 4, opacity: busy ? 0.55 : 1,
                  }}
                >
                  <span style={{ fontSize: 22, fontWeight: 800, color: isOccupied ? "#991b1b" : "#166534" }}>{t.table_number}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", color: isOccupied ? "rgba(153,27,27,0.75)" : "rgba(22,101,52,0.70)" }}>
                    {t.capacity}p
                  </span>
                  {isOccupied && (
                    <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(153,27,27,0.82)", textAlign: "center", lineHeight: 1.1, marginTop: 2, padding: "0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
                      {occ.name}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {error && (
          <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#991b1b", fontSize: 12 }}>
            {error}
          </div>
        )}

        {/* Occupied-table action sheet — shown when user taps a red tile. */}
        {occupiedAction && (
          <div style={{ position: "fixed", inset: 0, zIndex: 260, background: "rgba(0,0,0,0.40)", display: "flex", alignItems: "flex-end", justifyContent: "center" }} onPointerDown={() => setOccupiedAction(null)}>
            <div style={{ width: "min(480px, 96vw)", background: "white", borderRadius: "22px 22px 0 0", padding: "22px 22px 34px" }} onPointerDown={e => e.stopPropagation()}>
              <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 700, color: "rgba(0,0,0,0.55)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                Table {occupiedAction.table.table_number} · {occupiedAction.occ.name || "Guest"}
              </p>
              <p style={{ margin: "0 0 18px", fontSize: 16, fontWeight: 700, color: "#111" }}>What do you want to do?</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button onPointerDown={startMove} style={{ height: 60, borderRadius: 14, border: "none", background: "rgba(59,130,246,0.92)", color: "white", fontSize: 16, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, touchAction: "manipulation" }}>
                  <Move style={{ width: 20, height: 20 }} />Move to another table
                </button>
                <button onPointerDown={doClear} style={{ height: 60, borderRadius: 14, border: "none", background: "rgba(239,68,68,0.92)", color: "white", fontSize: 16, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, touchAction: "manipulation" }}>
                  <X style={{ width: 20, height: 20 }} />Remove guest (clear table)
                </button>
                <button onPointerDown={() => setOccupiedAction(null)} style={{ height: 40, borderRadius: 10, border: "1px solid rgba(0,0,0,0.10)", background: "rgba(0,0,0,0.03)", color: "rgba(0,0,0,0.50)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function AnalogPage() {
  const [config, setConfig] = useState<RestaurantConfig | null>(null)

  // Load restaurant config from session
  useEffect(() => {
    fetch("/api/client/me")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.rid) setConfig(d) })
      .catch(() => {})
  }, [])

  if (!config) {
    return (
      <div style={{ minHeight: "100dvh", background: "#FAFAF8", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 13, color: "rgba(0,0,0,0.35)" }}>Loading…</div>
      </div>
    )
  }

  return <AnalogBoard config={config} />
}

// ── Inner board (needs config) ─────────────────────────────────────────────────

function AnalogBoard({ config }: { config: RestaurantConfig }) {
  const { rid, name: restaurantName, slug, logoUrl } = config

  // localStorage keys are restaurant-scoped to avoid cross-restaurant bleed
  const ROWS_KEY    = `analog_rows_${slug}`
  const VISUAL_KEY  = `analog_visual_${slug}`
  const ZOOM_KEY    = `analog_zoom_${slug}`
  const BDATE_KEY   = `analog_bdate_${slug}`

  const [rows, setRows] = useState<AnalogRow[]>(() => {
    try { const s = localStorage.getItem(ROWS_KEY); if (s) { const p = JSON.parse(s) as AnalogRow[]; if (p.length) return p } } catch {}
    return [makeRow()]
  })
  const [confirmFor,    setConfirmFor]    = useState<string | null>(null)
  const [toast,         setToast]         = useState<string | null>(null)
  // Table picker modal state — drives seat-at-specific-table and move-guest flows.
  const [tablePicker,   setTablePicker]   = useState<
    | { mode: "seat"; localId: string }
    | { mode: "move"; localId: string; sourceTableId?: string }
    | null
  >(null)
  const [zoom,          setZoom]          = useState(() => {
    try { const s = localStorage.getItem(ZOOM_KEY); if (s) return parseFloat(s) || 1.0 } catch {}
    return 1.0
  })
  const [visual, setVisual] = useState<Visual>(() => {
    try { const s = localStorage.getItem(VISUAL_KEY); if (s === "basic" || s === "classic" || s === "modern") return s } catch {}
    return "basic"
  })
  const [showVisuals,   setShowVisuals]   = useState(false)
  const [isLandscape,   setIsLandscape]   = useState(false)
  const [,              tick]             = useState(0)
  const knownIdsRef = useRef<Set<string>>((() => {
    try {
      const s = localStorage.getItem(ROWS_KEY)
      if (s) {
        const p = JSON.parse(s) as AnalogRow[]
        return new Set(p.filter(r => r.queueEntryId).map(r => r.queueEntryId!))
      }
    } catch {}
    return new Set<string>()
  })())
  const pendingJoinsRef = useRef<Set<string>>(new Set())
  const rowsRef = useRef(rows)
  useEffect(() => { rowsRef.current = rows }, [rows])
  const adjustTimerDebounce = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const partySizeDebounce   = useRef<Record<string, { timer: ReturnType<typeof setTimeout>; entryId: string; val: number }>>({})
  const adjustingUntilRef   = useRef<Record<string, number>>({})

  const V = makeV(visual)

  useEffect(() => { try { localStorage.setItem(ROWS_KEY, JSON.stringify(rows)) } catch {} }, [rows, ROWS_KEY])
  useEffect(() => { try { localStorage.setItem(VISUAL_KEY, visual) } catch {} }, [visual, VISUAL_KEY])
  useEffect(() => { try { localStorage.setItem(ZOOM_KEY, String(zoom)) } catch {} }, [zoom, ZOOM_KEY])

  // 3am business day reset
  useEffect(() => {
    const check = () => {
      const bd = getBusinessDate()
      try {
        const prev = localStorage.getItem(BDATE_KEY)
        if (prev && prev !== bd) setRows(r => r.filter(row => row.status !== "seated" && row.status !== "removed"))
        localStorage.setItem(BDATE_KEY, bd)
      } catch {}
    }
    check()
    const t = setInterval(check, 60_000)
    return () => clearInterval(t)
  }, [BDATE_KEY])

  useEffect(() => { const t = setInterval(() => tick(n => n + 1), 1000); return () => clearInterval(t) }, [])
  const showToast = useCallback((msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }, [])

  useEffect(() => {
    const check = () => setIsLandscape(window.innerWidth > window.innerHeight)
    check(); window.addEventListener("resize", check); return () => window.removeEventListener("resize", check)
  }, [])

  // Ensure blank row at bottom
  useEffect(() => {
    setRows(prev => {
      const last = prev[prev.length - 1]
      if (!last || last.status !== "filling" || last.queueEntryId || last.name || last.phone)
        return [...prev, makeRow()]
      return prev
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length, rows.map(r => r.name + r.status + r.queueEntryId).join("|")])

  // Poll queue
  const pollQueue = useCallback(async () => {
    try {
      const r = await fetch(`${API}/queue?restaurant_id=${rid}`)
      if (!r.ok) return
      const data: QueueEntry[] = await r.json()
      const serverIds = new Set(data.map(e => e.id))
      setRows(prev => {
        let updated = [...prev]
        data.forEach(entry => {
          const existingIdx = updated.findIndex(r => r.queueEntryId === entry.id)
          if (existingIdx >= 0) {
            const ex = updated[existingIdx]
            let patch: Partial<AnalogRow> = {}
            if (entry.status === "seated" && ex.status !== "seated")
              patch = { ...patch, status: "seated", seatedMs: ex.seatedMs ?? Date.now() }
            else if (entry.status === "removed" && ex.status !== "removed")
              patch = { ...patch, status: "removed", seatedMs: ex.seatedMs ?? Date.now(), removedByGuest: ex.source === "nfc" || ex.source === "web" }
            else if (entry.status === "ready" && ex.status !== "ready")
              patch = { ...patch, status: "ready" }
            else if (entry.status === "waiting" && (ex.status === "seated" || ex.status === "removed")) {
              const arrMs = (parseUTCMs(entry.arrival_time) ?? Date.now())
              const base = entry.wait_set_at ? (parseUTCMs(entry.wait_set_at) ?? Date.now()) : arrMs
              patch = { ...patch, status: "waiting", seatedMs: null, removedByGuest: undefined, quotedWait: entry.quoted_wait, addedMs: arrMs, deadlineMs: entry.quoted_wait ? base + entry.quoted_wait * 60_000 : null }
            }
            if (entry.quoted_wait !== null && entry.quoted_wait !== ex.quotedWait && !patch.quotedWait) {
              const isAdjusting = (adjustingUntilRef.current[ex.localId] ?? 0) > Date.now()
              if (!isAdjusting) {
                const base = entry.wait_set_at ? (parseUTCMs(entry.wait_set_at) ?? Date.now()) : Date.now()
                patch = { ...patch, quotedWait: entry.quoted_wait, status: (ex.status === "filling" ? "waiting" : ex.status) as AnalogRow["status"], addedMs: ex.addedMs ?? base, deadlineMs: base + entry.quoted_wait * 60_000 }
              }
            }
            if (entry.name && entry.name !== ex.name) patch = { ...patch, name: entry.name }
            if (entry.party_size !== ex.partySize) patch = { ...patch, partySize: entry.party_size }
            if (entry.phone && entry.phone !== ex.phone) patch = { ...patch, phone: entry.phone }
            if (Object.keys(patch).length > 0)
              updated = updated.map((r, i) => i === existingIdx ? { ...r, ...patch } : r)
            return
          }
          if (knownIdsRef.current.has(entry.id)) return
          const pendingIdx = updated.findIndex(r => pendingJoinsRef.current.has(r.localId) && !r.queueEntryId && r.name === entry.name && r.partySize === entry.party_size)
          if (pendingIdx >= 0) {
            knownIdsRef.current.add(entry.id)
            updated = updated.map((r, i) => i === pendingIdx ? { ...r, queueEntryId: entry.id } : r)
            return
          }
          knownIdsRef.current.add(entry.id)
          const isQuoted = !!entry.quoted_wait
          const arrivalMs = (parseUTCMs(entry.arrival_time) ?? Date.now())
          const waitSetBase = entry.wait_set_at ? (parseUTCMs(entry.wait_set_at) ?? Date.now()) : arrivalMs
          const newRow: AnalogRow = makeRow({
            queueEntryId: entry.id, name: entry.name || "", phone: entry.phone || "",
            partySize: entry.party_size, quotedWait: entry.quoted_wait,
            status: isQuoted ? "waiting" : "filling",
            source: entry.source === "nfc" ? "nfc" : entry.source === "host" ? "host" : "web",
            addedMs: isQuoted ? arrivalMs : null,
            deadlineMs: isQuoted ? waitSetBase + (entry.quoted_wait! * 60_000) : null,
          })
          const blankIdx = updated.findLastIndex(r => !r.name && !r.phone && r.quotedWait === null && r.status === "filling" && !r.queueEntryId)
          updated = blankIdx >= 0 ? [...updated.slice(0, blankIdx), newRow, ...updated.slice(blankIdx)] : [...updated, newRow]
        })
        updated = updated.map(r => {
          if (r.queueEntryId && (r.status === "waiting" || r.status === "ready" || r.status === "filling") && !serverIds.has(r.queueEntryId)) {
            return { ...r, status: "seated" as const, seatedMs: r.seatedMs ?? Date.now() }
          }
          return r
        })
        return updated
      })
    } catch {}
  }, [rid])

  useEffect(() => { pollQueue(); const t = setInterval(pollQueue, 1_500); return () => clearInterval(t) }, [pollQueue])

  const patchRow = useCallback((localId: string, patch: Partial<AnalogRow>) => {
    setRows(prev => prev.map(r => r.localId === localId ? { ...r, ...patch } : r))
  }, [])

  // Set quote
  const setQuote = useCallback(async (localId: string, minutes: number) => {
    const row = rows.find(r => r.localId === localId)
    if (!row) return
    if (!row.queueEntryId && !row.name.trim() && !row.phone.trim()) return
    const now = Date.now()
    patchRow(localId, { quotedWait: minutes, status: "waiting", addedMs: row.addedMs ?? now, deadlineMs: now + minutes * 60_000 })
    if (row.queueEntryId) {
      fetch(`${API}/queue/${row.queueEntryId}/wait?minutes=${minutes}`, { method: "PATCH" })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.sms_sent) showToast("Text sent"); else if (d?.sms_error) showToast(`Text failed: ${d.sms_error}`) })
        .catch(() => {})
    } else {
      pendingJoinsRef.current.add(localId)
      try {
        const joinRes = await fetch(`${API}/queue/join`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: row.name.trim() || "Guest", party_size: row.partySize, phone: row.phone.trim() || null, notes: row.notes.trim() || null, restaurant_id: rid, source: "analog", quoted_wait: minutes }),
        })
        if (!joinRes.ok) { pendingJoinsRef.current.delete(localId); showToast("Could not add guest"); return }
        const joined = await joinRes.json()
        const entryId = joined.entry?.id ?? joined.id
        if (!entryId) { pendingJoinsRef.current.delete(localId); showToast("Could not add guest"); return }
        knownIdsRef.current.add(entryId)
        patchRow(localId, { queueEntryId: entryId })
        const smsNote = joined.sms_sent ? " · text sent" : joined.sms_error ? ` · text failed: ${joined.sms_error}` : ""
        showToast(`${row.name || "Guest"} added · ${minutes}m${smsNote}`)
      } catch { showToast("Could not add guest") }
      finally { pendingJoinsRef.current.delete(localId) }
    }
  }, [rows, patchRow, showToast, rid])

  const adjustTimer = useCallback((localId: string, delta: number) => {
    adjustingUntilRef.current[localId] = Date.now() + 2000
    setRows(prev => prev.map(r => {
      if (r.localId !== localId || !r.deadlineMs) return r
      const secs = computeSecs(r)
      const newSecs = Math.max(0, secs + delta * 60)
      const newDeadline = r.isPaused ? r.deadlineMs : Date.now() + newSecs * 1000
      const newQuoted = Math.ceil(newSecs / 60)
      const ex = adjustTimerDebounce.current[localId]
      if (ex) clearTimeout(ex)
      if (r.queueEntryId) {
        adjustTimerDebounce.current[localId] = setTimeout(() => {
          const cur = rowsRef.current.find(x => x.localId === localId)
          if (!cur?.queueEntryId) return
          fetch(`${API}/queue/${cur.queueEntryId}/wait?minutes=${Math.ceil(computeSecs(cur) / 60)}`, { method: "PATCH" }).catch(() => {})
          delete adjustTimerDebounce.current[localId]
        }, 600)
      }
      return { ...r, quotedWait: newQuoted, deadlineMs: newDeadline, pausedSecsLeft: r.isPaused ? newSecs : r.pausedSecsLeft }
    }))
  }, [])

  const togglePause = useCallback((localId: string) => {
    setRows(prev => prev.map(r => {
      if (r.localId !== localId || !r.deadlineMs) return r
      if (r.isPaused) {
        return { ...r, isPaused: false, deadlineMs: Date.now() + r.pausedSecsLeft * 1000 }
      } else {
        return { ...r, isPaused: true, pausedSecsLeft: computeSecs(r) }
      }
    }))
  }, [])

  const notifyGuest = useCallback(async (localId: string) => {
    const row = rows.find(r => r.localId === localId)
    if (!row?.queueEntryId) return
    patchRow(localId, { status: "ready", notifiedMs: Date.now() })
    try {
      await fetch(`${API}/queue/${row.queueEntryId}/ready`, { method: "POST" })
      showToast(`${row.name || "Guest"} notified — table ready`)
    } catch { showToast("Notify failed") }
  }, [rows, patchRow, showToast])

  const confirmAction = useCallback(async (localId: string, action: "seat" | "left") => {
    setConfirmFor(null)
    const row = rows.find(r => r.localId === localId)
    if (!row) return
    const resolvedMs = Date.now()
    if (action === "seat") {
      patchRow(localId, { status: "seated", seatedMs: resolvedMs })
      if (row.queueEntryId) {
        try { await fetch(`${API}/queue/${row.queueEntryId}/seat`, { method: "POST" }) } catch {}
      }
      showToast(`${row.name || "Guest"} seated`)
    } else {
      patchRow(localId, { status: "removed", seatedMs: resolvedMs })
      if (row.queueEntryId) {
        try { await fetch(`${API}/queue/${row.queueEntryId}/remove`, { method: "POST" }) } catch {}
      }
      showToast(`${row.name || "Guest"} removed`)
    }
  }, [rows, patchRow, showToast])

  // Pen helpers
  const clearOnPen = useCallback((localId: string, field: "name" | "phone" | "notes") =>
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === "pen") patchRow(localId, { [field]: "" } as Partial<AnalogRow>)
    }, [patchRow])

  const selectOnPen = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "pen") {
      const input = (e.currentTarget as HTMLDivElement).querySelector("input")
      setTimeout(() => input?.select(), 0)
    }
  }

  // Derived
  const activeRows    = rows.filter(r => r.status !== "seated" && r.status !== "removed")
  const completedRows = rows.filter(r => r.status === "seated" || r.status === "removed")
  const confirmRow    = confirmFor ? rows.find(r => r.localId === confirmFor) : null

  const firstCol = visual === "classic" ? "68px" : "52px"
  const gridCols = isLandscape
    ? `${firstCol} 1fr 100px 1fr minmax(170px,1.2fr) minmax(100px,0.7fr)`
    : `${firstCol} 1fr 100px 1fr minmax(170px,1.2fr)`
  const colHeaders = isLandscape
    ? ["", "Name", "Party", "Phone", "Wait / Timer", "Notes"]
    : ["", "Name", "Party", "Phone", "Wait / Timer"]

  const ctrlBtn: React.CSSProperties = {
    width: 42, height: 42, borderRadius: 10,
    border: `1px solid ${V.ctrlBorder}`, background: V.ctrlBg,
    color: V.text, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    boxShadow: "0 1px 3px rgba(0,0,0,0.07)", touchAction: "manipulation", flex: 1,
  }

  const locationShort = restaurantName.includes("Original") ? "Original" : restaurantName.includes("Southside") ? "Southside" : restaurantName

  // Suppress unused variable warning — Table type is still used in QueueEntry polling
  void (null as unknown as Table)

  return (
    <div style={{ minHeight: "100dvh", background: V.pageBg, fontFamily: V.font, display: "flex", flexDirection: "column" }}>

      {/* ── Header ── */}
      <header style={{ position: "sticky", top: 0, zIndex: 50, background: V.headerBg, backdropFilter: "blur(16px)", borderBottom: `1px solid ${V.headerBorder}`, padding: "0 16px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link href="/station" style={{ display: "flex", alignItems: "center", color: V.textMuted, textDecoration: "none", padding: "6px 6px", borderRadius: 8 }}>
            <ChevronLeft style={{ width: 16, height: 16 }} />
          </Link>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={restaurantName} style={{ height: 30, objectFit: "contain", maxWidth: 120 }} />
          ) : (
            <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: "0.04em", color: V.brandText }}>{restaurantName}</span>
          )}
          <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", color: V.brandSub, textTransform: "uppercase" }}>
              {locationShort}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", color: V.brandSub, textTransform: "uppercase", opacity: 0.6 }}>Analog</span>
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
            <button onClick={() => setShowVisuals(v => !v)}
              style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 15px", borderRadius: 12, border: `1.5px solid ${showVisuals ? V.textSub : V.btnBorder}`, background: showVisuals ? (visual === "modern" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.07)") : (visual === "modern" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)"), cursor: "pointer", touchAction: "manipulation", transition: "all 0.12s" }}>
              <Palette style={{ width: 16, height: 16, color: V.textSub }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: V.textSub, letterSpacing: "0.01em" }}>Visuals</span>
            </button>
            {showVisuals && (
              <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 200, background: visual === "modern" ? "#1A1A1A" : "white", border: `1px solid ${V.btnBorder}`, borderRadius: 14, padding: 8, minWidth: 160, boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
                {(["basic", "classic", "modern"] as Visual[]).map(opt => (
                  <button key={opt} onClick={() => { setVisual(opt); setShowVisuals(false) }}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, border: "none", cursor: "pointer", background: visual === opt ? (visual === "modern" ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.06)") : "transparent", textAlign: "left" }}>
                    <div style={{ width: 24, height: 24, borderRadius: 6, flexShrink: 0, background: opt === "classic" ? "linear-gradient(135deg, #FFFDE7 50%, #D4C5A9 50%)" : opt === "modern" ? "linear-gradient(135deg, #0A0A0A 50%, #FFB964 50%)" : "linear-gradient(135deg, #FAFAF8 50%, #E5E5E5 50%)", border: "1px solid rgba(0,0,0,0.12)" }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: visual === "modern" ? "rgba(255,255,255,0.90)" : "#111" }}>{opt === "basic" ? "Basic" : opt === "classic" ? "Classic" : "Modern"}</div>
                      <div style={{ fontSize: 11, color: visual === "modern" ? "rgba(255,255,255,0.40)" : "rgba(0,0,0,0.40)" }}>{opt === "basic" ? "Clean & minimal" : opt === "classic" ? "Yellow notepad" : "HOST dark theme"}</div>
                    </div>
                    {visual === opt && <Check style={{ width: 14, height: 14, color: "#22c55e", marginLeft: "auto" }} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Click-away for visuals popup */}
      {showVisuals && <div style={{ position: "fixed", inset: 0, zIndex: 49 }} onClick={() => setShowVisuals(false)} />}

      {/* ── Scaled content ── */}
      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        {visual === "classic" && <>
          <div style={{ position: "absolute", top: 0, bottom: 0, left: 8, width: 2, background: "rgba(200,50,50,0.65)", zIndex: 2, pointerEvents: "none" }} />
          <div style={{ position: "absolute", top: 0, bottom: 0, left: 14, width: 2, background: "rgba(200,50,50,0.65)", zIndex: 2, pointerEvents: "none" }} />
        </>}
        <div style={{ overflowY: "auto", height: "100%", boxSizing: "border-box", paddingLeft: visual === "classic" ? 22 : 0, paddingBottom: `calc(100dvh / ${zoom})` }}>
          <div style={{ transform: `scale(${zoom})`, transformOrigin: "top left", width: `${(1 / zoom) * 100}%`, minHeight: `${(1 / zoom) * 100}%` }}>

            {/* Column Headers */}
            <div style={{ background: V.colHeaderBg, borderBottom: `1px solid ${V.rowBorder}`, display: "grid", gridTemplateColumns: gridCols, padding: "6px 16px" }}>
              {colHeaders.map((h, i) => (
                <div key={i} style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: V.colHeaderText, paddingLeft: i > 0 ? 8 : 0 }}>{h}</div>
              ))}
            </div>

            {/* Completed rows */}
            {completedRows.length > 0 && (
              <>
                <div style={{ height: 1, background: V.completedDiv, margin: "12px 0 0" }} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px 6px", background: V.completedBg }}>
                  <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: V.textMuted }}>Completed · {completedRows.length}</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => { setRows(prev => prev.filter(r => r.status !== "seated" && r.status !== "removed")); showToast("History cleared") }}
                      style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, border: `1.5px solid rgba(239,68,68,0.25)`, background: "rgba(239,68,68,0.06)", color: "rgba(239,68,68,0.75)", fontSize: 11, fontWeight: 700, cursor: "pointer", touchAction: "manipulation" }}
                    ><X style={{ width: 12, height: 12 }} /> Clear</button>
                  </div>
                </div>

                {completedRows.map(row => (
                  <div key={row.localId}
                    onClick={async () => {
                      if (!row.queueEntryId) return
                      try {
                        const res = await fetch(`${API}/queue/${row.queueEntryId}/restore`, { method: "POST" })
                        if (!res.ok) { showToast("Could not restore"); return }
                        const data = await res.json()
                        const entry = data.entry
                        const arrMs = entry ? (parseUTCMs(entry.arrival_time) ?? Date.now()) : row.addedMs
                        const qw = entry?.quoted_wait ?? row.quotedWait
                        const base = entry?.wait_set_at ? (parseUTCMs(entry.wait_set_at) ?? Date.now()) : (arrMs ?? Date.now())
                        patchRow(row.localId, { status: "waiting", seatedMs: null, removedByGuest: undefined, quotedWait: qw, addedMs: arrMs, deadlineMs: qw ? base + qw * 60_000 : null, isPaused: false, pausedSecsLeft: 0 })
                        showToast(`${row.name || "Guest"} restored to waitlist`)
                      } catch { showToast("Could not restore") }
                    }}
                    style={{ display: "grid", gridTemplateColumns: gridCols, alignItems: "center", minHeight: 48, borderBottom: `1px solid ${V.rowBorder}`, background: V.completedBg, padding: "6px 0", cursor: "pointer", touchAction: "manipulation" }}>
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
                <div style={{ height: 1, background: V.completedDiv, margin: "0 0 12px" }} />
              </>
            )}

            {/* Active rows */}
            {activeRows.map((row) => {
              const isBlank    = !row.name && !row.phone && row.quotedWait === null && !row.queueEntryId
              const isExternal = row.source === "nfc" || row.source === "web" || row.source === "host"
              const needsQuote = row.status === "filling" && !!row.queueEntryId && isExternal
              const isWaiting  = row.status === "waiting" || row.status === "ready"
              const secs       = computeSecs(row)
              const isOverdue  = isWaiting && secs === 0

              const sourceBadge = row.source === "nfc" ? { label: "NFC", color: "rgba(251,191,36,0.90)" }
                : row.source === "web"   ? { label: "Web",  color: "rgba(99,102,241,0.75)" }
                : row.source === "host"  ? { label: "Host", color: V.textMuted }
                : !isBlank               ? { label: "Host Stand", color: V.textMuted }
                : null

              const elapsedMins = isWaiting && row.addedMs
                ? Math.floor((Date.now() - row.addedMs) / 60_000)
                : 0

              return (
                <div key={row.localId} style={{ display: "grid", gridTemplateColumns: gridCols, alignItems: "center", minHeight: 68, borderBottom: `1px solid ${V.rowBorder}`, background: needsQuote ? V.rowBgNFC : isOverdue ? V.rowBgOverdue : V.rowBgNormal, padding: "8px 0" }}>

                  {/* Checkbox / Remove */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {!isBlank && !isWaiting && row.status === "filling" ? (
                      <button
                        onPointerDown={e => {
                          e.preventDefault()
                          if (row.queueEntryId) fetch(`${API}/queue/${row.queueEntryId}/remove`, { method: "POST" }).catch(() => {})
                          setRows(prev => prev.filter(r => r.localId !== row.localId))
                        }}
                        style={{ width: 44, height: 44, borderRadius: 10, border: `2px solid rgba(239,68,68,0.25)`, background: "rgba(239,68,68,0.06)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", touchAction: "manipulation", color: "#ef4444" }}>
                        <X style={{ width: 16, height: 16 }} />
                      </button>
                    ) : !isBlank ? (
                      <button
                        onPointerDown={() => setConfirmFor(row.localId)}
                        style={{ width: 44, height: 44, borderRadius: 10, border: `2px solid ${isWaiting ? V.textSub : V.rowBorder}`, background: visual === "modern" ? "rgba(255,255,255,0.05)" : "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", touchAction: "manipulation", boxShadow: isWaiting ? "0 1px 4px rgba(0,0,0,0.08)" : "none" }} />
                    ) : null}
                  </div>

                  {/* Name */}
                  <div style={{ padding: "0 8px" }}>
                    {isExternal && !row.name ? (
                      <span style={{ fontSize: 13, color: V.textMuted, fontStyle: "italic" }}>{row.source === "nfc" ? "NFC guest" : "Guest"}</span>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }} onPointerDown={clearOnPen(row.localId, "name")}>
                        <input type="text" value={row.name}
                          onChange={e => patchRow(row.localId, { name: e.target.value })}
                          placeholder="Write name…" inputMode="text" autoCorrect="off" spellCheck={false} autoCapitalize="words"
                          style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 15, fontWeight: 500, color: V.inputColor, padding: "8px 0", caretColor: "#22c55e", minWidth: 0, touchAction: "manipulation" }}
                        />
                        {row.name && (
                          <button onPointerDown={e => { e.preventDefault(); patchRow(row.localId, { name: "" }) }} style={{ width: 20, height: 20, borderRadius: 10, border: "none", background: V.clearBtnBg, color: V.clearBtnColor, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, touchAction: "manipulation" }}>×</button>
                        )}
                      </div>
                    )}
                    {sourceBadge && <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: sourceBadge.color, marginTop: 1 }}>{sourceBadge.label}</div>}
                  </div>

                  {/* Party size */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0 }} onPointerDown={selectOnPen}>
                    <button onPointerDown={() => {
                      const s = Math.max(1, row.partySize - 1); patchRow(row.localId, { partySize: s })
                      if (row.queueEntryId) {
                        const ex = partySizeDebounce.current[row.localId]; if (ex) clearTimeout(ex.timer)
                        const timer = setTimeout(() => { const p = partySizeDebounce.current[row.localId]; if (p) { fetch(`${API}/queue/${p.entryId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ party_size: p.val }) }).catch(() => {}); delete partySizeDebounce.current[row.localId] } }, 500)
                        partySizeDebounce.current[row.localId] = { timer, entryId: row.queueEntryId, val: s }
                      }
                    }} style={{ width: 30, height: 40, border: "none", background: "transparent", color: V.textSub, fontSize: 20, cursor: "pointer", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", touchAction: "manipulation" }}>−</button>
                    <input type="number" min={1} max={20} value={row.partySize}
                      onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v)) { const s = Math.max(1, Math.min(20, v)); patchRow(row.localId, { partySize: s }); if (row.queueEntryId) fetch(`${API}/queue/${row.queueEntryId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ party_size: s }) }).catch(() => {}) } }}
                      inputMode="numeric"
                      style={{ width: 30, textAlign: "center", border: "none", outline: "none", background: "transparent", fontSize: 16, fontWeight: 700, color: V.text, caretColor: "#22c55e", touchAction: "manipulation", MozAppearance: "textfield" } as React.CSSProperties}
                    />
                    <button onPointerDown={() => {
                      const s = Math.min(20, row.partySize + 1); patchRow(row.localId, { partySize: s })
                      if (row.queueEntryId) {
                        const ex = partySizeDebounce.current[row.localId]; if (ex) clearTimeout(ex.timer)
                        const timer = setTimeout(() => { const p = partySizeDebounce.current[row.localId]; if (p) { fetch(`${API}/queue/${p.entryId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ party_size: p.val }) }).catch(() => {}); delete partySizeDebounce.current[row.localId] } }, 500)
                        partySizeDebounce.current[row.localId] = { timer, entryId: row.queueEntryId, val: s }
                      }
                    }} style={{ width: 30, height: 40, border: "none", background: "transparent", color: V.textSub, fontSize: 20, cursor: "pointer", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", touchAction: "manipulation" }}>+</button>
                  </div>

                  {/* Phone */}
                  <div style={{ padding: "0 8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }} onPointerDown={clearOnPen(row.localId, "phone")}>
                      <input type="tel" value={row.phone}
                        onChange={e => patchRow(row.localId, { phone: formatPhone(e.target.value) })}
                        placeholder="Write number…" inputMode="tel" autoCorrect="off" spellCheck={false} autoCapitalize="off"
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
                          {isWaiting && row.addedMs && elapsedMins > 0 && (
                            <div style={{ fontSize: 10, fontWeight: 700, color: V.textSub, marginBottom: 2 }}>{elapsedMins}m waited</div>
                          )}
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

                  {/* Notes — landscape column */}
                  {!isBlank && isLandscape && (
                    <div style={{ padding: "0 10px" }} onPointerDown={clearOnPen(row.localId, "notes")}>
                      <input type="text" value={row.notes}
                        onChange={e => patchRow(row.localId, { notes: e.target.value })}
                        placeholder="Notes…" inputMode="text" autoCorrect="off" spellCheck={false} autoCapitalize="sentences"
                        style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontSize: 11, color: V.inputColor, caretColor: "#22c55e", borderBottom: `1px solid ${V.rowBorder}`, padding: "6px 0", touchAction: "manipulation" }}
                      />
                    </div>
                  )}

                  {/* Notes — portrait card below */}
                  {!isBlank && !isLandscape && (
                    <div style={{ gridColumn: "1 / -1", margin: "3px 12px 4px 56px", background: V.notesBg, borderRadius: 8, border: `1px solid ${V.notesBorder}`, padding: "4px 10px" }} onPointerDown={clearOnPen(row.localId, "notes")}>
                      <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: V.notesLabel, marginBottom: 3 }}>Notes</div>
                      <input type="text" value={row.notes}
                        onChange={e => patchRow(row.localId, { notes: e.target.value })}
                        placeholder="Notes…" inputMode="text" autoCorrect="off" spellCheck={false} autoCapitalize="sentences"
                        style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontSize: 11, color: V.inputColor, caretColor: "#22c55e", touchAction: "manipulation" }}
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

      {/* ── Confirm modal ── */}
      {confirmFor && confirmRow && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.40)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end" }} onPointerDown={() => setConfirmFor(null)}>
          <div style={{ width: "100%", background: "white", borderRadius: "24px 24px 0 0", padding: "28px 24px 48px" }} onPointerDown={e => e.stopPropagation()}>
            <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 600, color: "rgba(0,0,0,0.40)", letterSpacing: "0.04em", textTransform: "uppercase" }}>{confirmRow.name || "Guest"} · Party of {confirmRow.partySize}</p>
            <p style={{ margin: "0 0 24px", fontSize: 19, fontWeight: 700, color: "#111" }}>Seat or mark as left?</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <button onPointerDown={() => { if (confirmFor) { setTablePicker({ mode: "seat", localId: confirmFor }); setConfirmFor(null) } }} style={{ height: 68, borderRadius: 18, border: "none", cursor: "pointer", fontSize: 18, fontWeight: 800, background: "rgba(34,197,94,0.88)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, boxShadow: "0 4px 16px rgba(34,197,94,0.28)", touchAction: "manipulation" }}>
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

      {/* Table picker — seats at specific table or moves a seated guest */}
      {tablePicker && (
        <TablePicker
          mode={tablePicker.mode}
          rid={rid}
          apiBase={API}
          sourceTableId={tablePicker.mode === "move" ? tablePicker.sourceTableId : undefined}
          label={tablePicker.mode === "move" ? "Move guest to which table?" : "Seat guest at which table?"}
          onCancel={() => setTablePicker(null)}
          onDone={async (target) => {
            const localId = tablePicker.localId
            const row     = rows.find(r => r.localId === localId)
            const picker  = tablePicker
            setTablePicker(null)
            if (!row) return
            if (picker.mode === "seat") {
              // Mark seated locally for immediate feedback; server call commits.
              patchRow(localId, { status: "seated", seatedMs: Date.now() })
              try {
                if (row.queueEntryId) {
                  await fetch(`${API}/queue/${row.queueEntryId}/seat-to-table/${target.id}`, { method: "POST" })
                } else {
                  // Row never made it to the server queue (no quote set). Fall back to walk-in
                  // atomic-seat which creates + seats in one call.
                  const r = await fetch(`${API}/queue/walkin-at-table/${target.id}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: row.name.trim() || "Guest", party_size: row.partySize, phone: row.phone.trim() || null, restaurant_id: rid }),
                  })
                  if (r.ok) {
                    const d = await r.json()
                    if (d.entry?.id) patchRow(localId, { queueEntryId: d.entry.id })
                  }
                }
                showToast(`${row.name || "Guest"} seated at Table ${target.number}`)
              } catch {
                showToast("Seat request failed")
              }
            } else {
              // Move flow: the picker already cleared the source and occupied the target.
              // Persist the guest's seat-to-table so /tables/occupants reflects the new seat.
              if (row.queueEntryId) {
                try { await fetch(`${API}/queue/${row.queueEntryId}/seat-to-table/${target.id}`, { method: "POST" }) } catch {}
              }
              showToast(`${row.name || "Guest"} moved to Table ${target.number}`)
            }
          }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.82)", color: "white", padding: "10px 20px", borderRadius: 10, fontSize: 13, fontWeight: 600, backdropFilter: "blur(12px)", zIndex: 300, whiteSpace: "nowrap" }}>
          {toast}
        </div>
      )}
    </div>
  )
}
