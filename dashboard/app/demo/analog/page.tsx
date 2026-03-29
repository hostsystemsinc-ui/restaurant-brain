"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import {
  History, Plus, Minus, Bell, Pause, Play,
  ChevronLeft, Check, X, ToggleLeft, ToggleRight,
} from "lucide-react"

const API                = "/api/brain"
const DEMO_RESTAURANT_ID = "dec0cafe-0000-4000-8000-000000000001"
const QUOTE_PRESETS      = [5, 10, 15, 20]
const TABLE_NUMBERS      = Array.from({ length: 16 }, (_, i) => i + 1)

// ── Types ──────────────────────────────────────────────────────────────────────

interface QueueEntry {
  id:           string
  name:         string
  party_size:   number
  status:       "waiting" | "ready" | "seated" | "removed"
  source:       string
  quoted_wait:  number | null
  arrival_time: string
  phone:        string | null
  notes:        string | null
}

interface Table {
  id: string
  table_number: number
  capacity: number
  status: string
}

interface AnalogRow {
  localId:       string
  queueEntryId:  string | null
  name:          string
  phone:         string
  partySize:     number
  quotedWait:    number | null
  status:        "filling" | "waiting" | "ready" | "seated" | "removed"
  source:        "analog" | "nfc" | "web" | "host"
  addedMs:       number | null
  notifiedMs:    number | null
  seatedMs:      number | null
  deadlineMs:    number | null
  isPaused:      boolean
  pausedSecsLeft: number
  checkState:    "unchecked" | "confirming"
}

// ── Helpers ────────────────────────────────────────────────────────────────────

let _seq = 0
const uid = () => `r${Date.now()}${++_seq}`

const makeRow = (overrides: Partial<AnalogRow> = {}): AnalogRow => ({
  localId: uid(), queueEntryId: null, name: "", phone: "",
  partySize: 2, quotedWait: null, status: "filling", source: "analog",
  addedMs: null, notifiedMs: null, seatedMs: null, deadlineMs: null,
  isPaused: false, pausedSecsLeft: 0, checkState: "unchecked",
  ...overrides,
})

function computeSecs(row: AnalogRow): number {
  if (!row.deadlineMs) return 0
  if (row.isPaused) return row.pausedSecsLeft
  return Math.max(0, Math.ceil((row.deadlineMs - Date.now()) / 1000))
}

function fmtCountdown(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

function fmtClock(ms: number | null): string {
  if (!ms) return "—"
  return new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
}

function waitedLabel(row: AnalogRow): string {
  if (!row.addedMs) return ""
  const endMs = row.seatedMs ?? Date.now()
  const m = Math.round((endMs - row.addedMs) / 60_000)
  return `${m}m`
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function AnalogPage() {
  const [rows,            setRows]           = useState<AnalogRow[]>([makeRow()])
  const [tableAssignment, setTableAssignment] = useState(true)
  const [tablePickFor,    setTablePickFor]   = useState<string | null>(null)
  const [confirmFor,      setConfirmFor]     = useState<string | null>(null)
  const [tables,          setTables]         = useState<Table[]>([])
  const [toast,           setToast]          = useState<string | null>(null)
  const [,                tick]              = useState(0)
  const knownIdsRef = useRef(new Set<string>())

  // ── Countdown ticker ────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => tick(n => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  // ── Toast ───────────────────────────────────────────────────────────────────
  const showToast = useCallback((msg: string) => {
    setToast(msg); setTimeout(() => setToast(null), 3000)
  }, [])

  // ── Ensure blank row at bottom ──────────────────────────────────────────────
  useEffect(() => {
    setRows(prev => {
      const last = prev[prev.length - 1]
      if (!last || last.status !== "filling" || last.queueEntryId || last.name || last.phone) {
        return [...prev, makeRow()]
      }
      return prev
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length, rows.map(r => r.name + r.status + r.queueEntryId).join("|")])

  // ── Fetch tables (for seat-to-table) ────────────────────────────────────────
  useEffect(() => {
    fetch(`${API}/tables?restaurant_id=${DEMO_RESTAURANT_ID}`)
      .then(r => r.ok ? r.json() : [])
      .then(setTables)
      .catch(() => {})
  }, [])

  // ── Poll queue for NFC / web guests ─────────────────────────────────────────
  const pollQueue = useCallback(async () => {
    try {
      const r = await fetch(`${API}/queue?restaurant_id=${DEMO_RESTAURANT_ID}`)
      if (!r.ok) return
      const data: QueueEntry[] = await r.json()

      setRows(prev => {
        let updated = [...prev]

        data.forEach(entry => {
          // Already have a row for this entry?
          const existingIdx = updated.findIndex(r => r.queueEntryId === entry.id)

          if (existingIdx >= 0) {
            const existing = updated[existingIdx]
            // Sync seat/remove from digital station
            if (entry.status === "seated" && existing.status !== "seated") {
              updated = updated.map((r, i) => i === existingIdx
                ? { ...r, status: "seated" as const, seatedMs: r.seatedMs ?? Date.now(), checkState: "unchecked" as const }
                : r)
            } else if (entry.status === "removed" && existing.status !== "removed") {
              updated = updated.map((r, i) => i === existingIdx
                ? { ...r, status: "removed" as const, seatedMs: r.seatedMs ?? Date.now(), checkState: "unchecked" as const }
                : r)
            }
            return
          }

          // New entry not yet tracked
          if (knownIdsRef.current.has(entry.id)) return
          knownIdsRef.current.add(entry.id)

          const isQuoted = !!entry.quoted_wait
          const arrivalMs = new Date(entry.arrival_time).getTime()
          const newRow: AnalogRow = makeRow({
            queueEntryId: entry.id,
            name:         entry.name || "",
            phone:        entry.phone || "",
            partySize:    entry.party_size,
            quotedWait:   entry.quoted_wait,
            status:       isQuoted ? "waiting" : "filling",
            source:       entry.source === "nfc" ? "nfc" : "web",
            addedMs:      isQuoted ? arrivalMs : null,
            deadlineMs:   isQuoted ? arrivalMs + (entry.quoted_wait! * 60_000) : null,
          })

          // Insert before the last blank row
          const blankIdx = updated.findLastIndex(r =>
            !r.name && !r.phone && r.quotedWait === null && r.status === "filling" && !r.queueEntryId
          )
          if (blankIdx >= 0) {
            updated = [...updated.slice(0, blankIdx), newRow, ...updated.slice(blankIdx)]
          } else {
            updated = [...updated, newRow]
          }
        })

        return updated
      })
    } catch {}
  }, [])

  useEffect(() => {
    pollQueue()
    const t = setInterval(pollQueue, 5_000)
    return () => clearInterval(t)
  }, [pollQueue])

  // ── Update a single row field ────────────────────────────────────────────────
  const patchRow = useCallback((localId: string, patch: Partial<AnalogRow>) => {
    setRows(prev => prev.map(r => r.localId === localId ? { ...r, ...patch } : r))
  }, [])

  // ── Set quote (creates entry for analog guests; sets wait for NFC guests) ────
  const setQuote = useCallback(async (localId: string, minutes: number) => {
    setRows(prev => {
      const row = prev.find(r => r.localId === localId)
      if (!row) return prev

      // Fire async action without blocking state update
      ;(async () => {
        const now = Date.now()
        if (row.queueEntryId) {
          // NFC guest — just set wait time
          try {
            await fetch(`${API}/queue/${row.queueEntryId}/wait?minutes=${minutes}`, { method: "PATCH" })
          } catch {}
          patchRow(localId, {
            quotedWait: minutes, status: "waiting",
            addedMs:    row.addedMs ?? now,
            deadlineMs: (row.addedMs ?? now) + minutes * 60_000,
          })
        } else {
          // Analog guest — create queue entry
          if (!row.name.trim() && !row.partySize) return
          try {
            const joinRes = await fetch(`${API}/queue/join`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name:          row.name.trim() || "Guest",
                party_size:    row.partySize,
                phone:         row.phone.trim() || null,
                restaurant_id: DEMO_RESTAURANT_ID,
                source:        "host",
              }),
            })
            if (!joinRes.ok) { showToast("Could not add guest"); return }
            const joined = await joinRes.json()
            await fetch(`${API}/queue/${joined.id}/wait?minutes=${minutes}`, { method: "PATCH" })
            knownIdsRef.current.add(joined.id)
            patchRow(localId, {
              queueEntryId: joined.id, quotedWait: minutes, status: "waiting",
              addedMs: now, deadlineMs: now + minutes * 60_000,
            })
            showToast(`${row.name || "Guest"} added · ${minutes}m`)
          } catch { showToast("Could not add guest") }
        }
      })()

      return prev // state updated via patchRow inside async
    })
  }, [patchRow, showToast])

  // ── Adjust timer (+/– min) ───────────────────────────────────────────────────
  const adjustTimer = useCallback((localId: string, delta: number) => {
    setRows(prev => prev.map(r => {
      if (r.localId !== localId) return r
      const newQuoted = Math.max(1, (r.quotedWait ?? 0) + delta)
      const updated = r.isPaused
        ? { ...r, quotedWait: newQuoted, pausedSecsLeft: Math.max(0, r.pausedSecsLeft + delta * 60) }
        : { ...r, quotedWait: newQuoted, deadlineMs: (r.deadlineMs ?? Date.now()) + delta * 60_000 }
      if (r.queueEntryId) {
        fetch(`${API}/queue/${r.queueEntryId}/wait?minutes=${newQuoted}`, { method: "PATCH" }).catch(() => {})
      }
      return updated
    }))
  }, [])

  // ── Pause / resume ───────────────────────────────────────────────────────────
  const togglePause = useCallback((localId: string) => {
    setRows(prev => prev.map(r => {
      if (r.localId !== localId) return r
      if (r.isPaused) {
        return { ...r, isPaused: false, deadlineMs: Date.now() + r.pausedSecsLeft * 1000 }
      } else {
        return { ...r, isPaused: true, pausedSecsLeft: computeSecs(r) }
      }
    }))
  }, [])

  // ── Notify ───────────────────────────────────────────────────────────────────
  const notifyGuest = useCallback(async (localId: string) => {
    const row = rows.find(r => r.localId === localId)
    if (!row?.queueEntryId) return
    try {
      await fetch(`${API}/queue/${row.queueEntryId}/notify`, { method: "POST" })
      patchRow(localId, { status: "ready", notifiedMs: Date.now() })
      showToast(`${row.name || "Guest"} notified`)
    } catch { showToast("Could not notify") }
  }, [rows, patchRow, showToast])

  // ── Confirm seat / left ──────────────────────────────────────────────────────
  const confirmAction = useCallback(async (localId: string, action: "seat" | "left") => {
    setConfirmFor(null)
    const row = rows.find(r => r.localId === localId)
    if (!row) return

    if (action === "seat") {
      if (tableAssignment && row.queueEntryId) {
        setTablePickFor(localId); return
      }
      if (row.queueEntryId) {
        try { await fetch(`${API}/queue/${row.queueEntryId}/seat`, { method: "POST" }) } catch {}
      }
      patchRow(localId, { status: "seated", seatedMs: Date.now(), checkState: "unchecked" })
      showToast(`${row.name || "Guest"} seated`)
    } else {
      if (row.queueEntryId) {
        try { await fetch(`${API}/queue/${row.queueEntryId}/remove`, { method: "POST" }) } catch {}
      }
      patchRow(localId, { status: "removed", seatedMs: Date.now(), checkState: "unchecked" })
      showToast(`${row.name || "Guest"} left`)
    }
  }, [rows, tableAssignment, patchRow, showToast])

  // ── Seat to specific table ───────────────────────────────────────────────────
  const seatToTable = useCallback(async (localId: string, tableNum: number) => {
    setTablePickFor(null)
    const row = rows.find(r => r.localId === localId)
    if (!row?.queueEntryId) return
    const apiTable = tables.find(t => t.table_number === tableNum)
    try {
      const url = apiTable
        ? `${API}/queue/${row.queueEntryId}/seat-to-table/${apiTable.id}`
        : `${API}/queue/${row.queueEntryId}/seat`
      await fetch(url, { method: "POST" })
    } catch {}
    patchRow(localId, { status: "seated", seatedMs: Date.now() })
    showToast(`${row.name || "Guest"} seated at Table ${tableNum}`)
  }, [rows, tables, patchRow, showToast])

  // ── Derived ──────────────────────────────────────────────────────────────────
  const activeRows    = rows.filter(r => r.status !== "seated" && r.status !== "removed")
  const completedRows = rows.filter(r => r.status === "seated" || r.status === "removed").reverse()

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: "100dvh", background: "#FAFAF8",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      display: "flex", flexDirection: "column",
    }}>

      {/* ── Header ── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(255,255,255,0.96)", backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(0,0,0,0.09)",
        padding: "0 20px", height: 52,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link href="/demo/station" style={{ display: "flex", alignItems: "center", gap: 4, color: "rgba(0,0,0,0.35)", textDecoration: "none", fontSize: 13, padding: "4px 6px", borderRadius: 8 }}>
            <ChevronLeft style={{ width: 15, height: 15 }} />
          </Link>
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: "0.04em", color: "#111" }}>HOST</span>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", color: "rgba(0,0,0,0.35)", textTransform: "uppercase" }}>Analog</span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Table Assignment Toggle */}
          <button
            onClick={() => setTableAssignment(v => !v)}
            style={{
              display: "flex", alignItems: "center", gap: 7, padding: "5px 12px",
              borderRadius: 99, border: `1px solid ${tableAssignment ? "rgba(34,197,94,0.35)" : "rgba(0,0,0,0.12)"}`,
              background: tableAssignment ? "rgba(34,197,94,0.07)" : "rgba(0,0,0,0.03)",
              cursor: "pointer", transition: "all 0.15s",
            }}
          >
            {tableAssignment
              ? <ToggleRight style={{ width: 16, height: 16, color: "#22c55e" }} />
              : <ToggleLeft  style={{ width: 16, height: 16, color: "rgba(0,0,0,0.35)" }} />}
            <span style={{ fontSize: 12, fontWeight: 600, color: tableAssignment ? "#16a34a" : "rgba(0,0,0,0.40)", letterSpacing: "0.04em" }}>
              Table Assignment
            </span>
          </button>

          {/* History */}
          <Link
            href="/demo/history?analog=1"
            style={{
              display: "flex", alignItems: "center", gap: 5, padding: "5px 12px",
              borderRadius: 99, border: "1px solid rgba(0,0,0,0.10)",
              background: "rgba(0,0,0,0.02)", color: "rgba(0,0,0,0.50)",
              textDecoration: "none", fontSize: 12, fontWeight: 600,
            }}
          >
            <History style={{ width: 13, height: 13 }} />
            History
          </Link>
        </div>
      </header>

      {/* ── Column Headers ── */}
      <div style={{
        position: "sticky", top: 52, zIndex: 40,
        background: "rgba(250,250,248,0.97)", backdropFilter: "blur(8px)",
        borderBottom: "1px solid rgba(0,0,0,0.07)",
        display: "grid",
        gridTemplateColumns: "44px 1fr 96px 1fr 1fr",
        gap: 0, padding: "6px 16px",
      }}>
        {["", "Name", "Party", "Phone", "Wait / Timer"].map((h, i) => (
          <div key={i} style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(0,0,0,0.28)", paddingLeft: i > 0 ? 8 : 0 }}>
            {h}
          </div>
        ))}
      </div>

      {/* ── Rows ── */}
      <div style={{ flex: 1, overflowY: "auto" }}>

        {/* Active rows */}
        {activeRows.map((row, i) => {
          const isBlank   = !row.name && !row.phone && row.quotedWait === null && !row.queueEntryId
          const isNfc     = row.source === "nfc" || row.source === "web"
          const needsQuote= row.status === "filling" && !!row.queueEntryId && isNfc
          const isWaiting = row.status === "waiting" || row.status === "ready"
          const secs      = computeSecs(row)
          const isOverdue = isWaiting && secs === 0
          const isConfirming = confirmFor === row.localId

          return (
            <div
              key={row.localId}
              style={{
                display: "grid",
                gridTemplateColumns: "44px 1fr 96px 1fr 1fr",
                alignItems: "center",
                minHeight: 64,
                borderBottom: "1px solid rgba(0,0,0,0.07)",
                background: isConfirming
                  ? "rgba(0,0,0,0.03)"
                  : needsQuote
                  ? "rgba(251,191,36,0.06)"
                  : isOverdue
                  ? "rgba(239,68,68,0.04)"
                  : "transparent",
                position: "relative",
                padding: "8px 0",
              }}
            >
              {/* ── Checkbox ── */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                {!isBlank && (
                  isConfirming ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <button
                        onClick={() => confirmAction(row.localId, "seat")}
                        style={{ width: 32, height: 28, borderRadius: 7, background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.35)", color: "#16a34a", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                      >Seat</button>
                      <button
                        onClick={() => confirmAction(row.localId, "left")}
                        style={{ width: 32, height: 28, borderRadius: 7, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#dc2626", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                      >Left</button>
                      <button
                        onClick={() => setConfirmFor(null)}
                        style={{ width: 32, height: 20, borderRadius: 6, background: "transparent", border: "none", color: "rgba(0,0,0,0.30)", fontSize: 10, cursor: "pointer" }}
                      >✕</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => isWaiting && setConfirmFor(row.localId)}
                      disabled={!isWaiting}
                      style={{
                        width: 28, height: 28, borderRadius: 6,
                        border: `2px solid ${isWaiting ? "rgba(0,0,0,0.22)" : "rgba(0,0,0,0.10)"}`,
                        background: "white",
                        cursor: isWaiting ? "pointer" : "default",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "border-color 0.12s",
                        boxShadow: isWaiting ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
                      }}
                      title={isWaiting ? "Check to seat or remove" : "Set a wait time first"}
                    />
                  )
                )}
              </div>

              {/* ── Name ── */}
              <div style={{ padding: "0 8px" }}>
                {isNfc && !row.name ? (
                  <span style={{ fontSize: 13, color: "rgba(0,0,0,0.28)", fontStyle: "italic" }}>NFC guest</span>
                ) : (
                  <input
                    type="text"
                    value={row.name}
                    onChange={e => patchRow(row.localId, { name: e.target.value })}
                    placeholder="Write name…"
                    inputMode="text"
                    style={{
                      width: "100%", border: "none", outline: "none",
                      background: "transparent", fontSize: 15, fontWeight: 500,
                      color: "#111", padding: "4px 0",
                      caretColor: "#22c55e",
                    }}
                  />
                )}
                {isNfc && (
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "rgba(251,191,36,0.85)", marginTop: 1 }}>
                    {row.source === "nfc" ? "NFC" : "Web"}
                  </div>
                )}
              </div>

              {/* ── Party size ── */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0 }}>
                <button
                  onClick={() => patchRow(row.localId, { partySize: Math.max(1, row.partySize - 1) })}
                  style={{ width: 28, height: 36, border: "none", background: "transparent", color: "rgba(0,0,0,0.35)", fontSize: 18, cursor: "pointer", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}
                >−</button>
                <span style={{ width: 26, textAlign: "center", fontSize: 16, fontWeight: 700, color: "#111" }}>{row.partySize}</span>
                <button
                  onClick={() => patchRow(row.localId, { partySize: Math.min(20, row.partySize + 1) })}
                  style={{ width: 28, height: 36, border: "none", background: "transparent", color: "rgba(0,0,0,0.35)", fontSize: 18, cursor: "pointer", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}
                >+</button>
              </div>

              {/* ── Phone ── */}
              <div style={{ padding: "0 8px" }}>
                <input
                  type="tel"
                  value={row.phone}
                  onChange={e => patchRow(row.localId, { phone: e.target.value })}
                  placeholder="Write number…"
                  inputMode="tel"
                  style={{
                    width: "100%", border: "none", outline: "none",
                    background: "transparent", fontSize: 15, fontWeight: 500,
                    color: "#111", padding: "4px 0",
                    caretColor: "#22c55e",
                  }}
                />
              </div>

              {/* ── Wait Quote / Timer ── */}
              <div style={{ padding: "0 10px 0 6px" }}>
                {!isWaiting ? (
                  /* Quote preset buttons */
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4 }}>
                    {QUOTE_PRESETS.map(t => (
                      <button
                        key={t}
                        onClick={() => !isBlank && setQuote(row.localId, t)}
                        disabled={isBlank}
                        style={{
                          height: 44, borderRadius: 10, border: "1px solid rgba(0,0,0,0.12)",
                          background: isBlank ? "rgba(0,0,0,0.03)" : "white",
                          color: isBlank ? "rgba(0,0,0,0.20)" : "#111",
                          fontSize: 14, fontWeight: 700, cursor: isBlank ? "default" : "pointer",
                          boxShadow: isBlank ? "none" : "0 1px 3px rgba(0,0,0,0.06)",
                          transition: "all 0.1s",
                        }}
                      >{t}</button>
                    ))}
                  </div>
                ) : (
                  /* Live countdown + controls */
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {/* Countdown */}
                    <div style={{ textAlign: "center", minWidth: 52 }}>
                      <div style={{
                        fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1,
                        color: isOverdue ? "#dc2626" : secs < 60 ? "#f97316" : "#111",
                        fontVariantNumeric: "tabular-nums",
                      }}>
                        {row.isPaused ? <span style={{ color: "rgba(0,0,0,0.40)" }}>{fmtCountdown(row.pausedSecsLeft)}</span> : fmtCountdown(secs)}
                      </div>
                      {row.isPaused && <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "rgba(0,0,0,0.30)", textTransform: "uppercase", marginTop: 2 }}>Paused</div>}
                    </div>

                    {/* Controls */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      {/* Timer controls row */}
                      <div style={{ display: "flex", gap: 3 }}>
                        <button onClick={() => adjustTimer(row.localId, -1)} style={ctrlBtn}>
                          <Minus style={{ width: 11, height: 11 }} />
                        </button>
                        <button onClick={() => togglePause(row.localId)} style={ctrlBtn}>
                          {row.isPaused ? <Play style={{ width: 11, height: 11 }} /> : <Pause style={{ width: 11, height: 11 }} />}
                        </button>
                        <button onClick={() => adjustTimer(row.localId, 1)} style={ctrlBtn}>
                          <Plus style={{ width: 11, height: 11 }} />
                        </button>
                      </div>
                      {/* Notify button */}
                      <button
                        onClick={() => notifyGuest(row.localId)}
                        style={{
                          height: 24, borderRadius: 7, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700,
                          background: row.status === "ready" ? "rgba(34,197,94,0.12)" : "rgba(34,197,94,0.85)",
                          color: row.status === "ready" ? "#16a34a" : "white",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                          transition: "all 0.12s",
                        }}
                      >
                        <Bell style={{ width: 10, height: 10 }} />
                        {row.status === "ready" ? "Notified" : "Notify"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {/* ── Completed rows ── */}
        {completedRows.length > 0 && (
          <>
            <div style={{ padding: "14px 16px 6px", borderTop: "1px solid rgba(0,0,0,0.08)", marginTop: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(0,0,0,0.28)" }}>
                Completed · {completedRows.length}
              </span>
            </div>
            {completedRows.map(row => (
              <div
                key={row.localId}
                style={{
                  display: "grid",
                  gridTemplateColumns: "44px 1fr 96px 1fr 1fr",
                  alignItems: "center",
                  minHeight: 48,
                  borderBottom: "1px solid rgba(0,0,0,0.05)",
                  background: "rgba(0,0,0,0.025)",
                  padding: "6px 0",
                }}
              >
                {/* Check mark */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: 6,
                    background: row.status === "seated" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.08)",
                    border: `1.5px solid ${row.status === "seated" ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.25)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {row.status === "seated"
                      ? <Check style={{ width: 12, height: 12, color: "#16a34a" }} />
                      : <X     style={{ width: 12, height: 12, color: "#dc2626" }} />}
                  </div>
                </div>

                {/* Name */}
                <div style={{ padding: "0 8px" }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: "rgba(0,0,0,0.45)" }}>{row.name || "Guest"}</span>
                </div>

                {/* Party */}
                <div style={{ textAlign: "center" }}>
                  <span style={{ fontSize: 13, color: "rgba(0,0,0,0.35)" }}>{row.partySize}p</span>
                </div>

                {/* Phone */}
                <div style={{ padding: "0 8px" }}>
                  <span style={{ fontSize: 12, color: "rgba(0,0,0,0.30)" }}>{row.phone || "—"}</span>
                </div>

                {/* Stats */}
                <div style={{ padding: "0 10px 0 6px" }}>
                  <div style={{ fontSize: 11, color: "rgba(0,0,0,0.35)", display: "flex", flexWrap: "wrap", gap: "2px 10px" }}>
                    <span>In {fmtClock(row.addedMs)}</span>
                    {row.notifiedMs && <span>Notified {fmtClock(row.notifiedMs)}</span>}
                    <span>Waited {waitedLabel(row)}</span>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {/* Bottom padding so last row isn't cut off by keyboard */}
        <div style={{ height: 80 }} />
      </div>

      {/* ── Table Picker Modal ── */}
      {tablePickFor && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 100,
          background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "flex-end",
        }}
          onClick={() => setTablePickFor(null)}
        >
          <div
            style={{
              width: "100%", background: "white", borderRadius: "20px 20px 0 0",
              padding: "24px 20px 40px", maxHeight: "60dvh", overflowY: "auto",
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <p style={{ fontSize: 17, fontWeight: 700, color: "#111", margin: 0 }}>Select Table</p>
              <button onClick={() => setTablePickFor(null)} style={{ border: "none", background: "none", cursor: "pointer", color: "rgba(0,0,0,0.40)", fontSize: 20, lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              {TABLE_NUMBERS.map(n => {
                const apiTable = tables.find(t => t.table_number === n)
                const occupied = apiTable?.status === "occupied"
                return (
                  <button
                    key={n}
                    onClick={() => !occupied && seatToTable(tablePickFor!, n)}
                    disabled={occupied}
                    style={{
                      height: 56, borderRadius: 14,
                      border: `1.5px solid ${occupied ? "rgba(239,68,68,0.30)" : "rgba(0,0,0,0.12)"}`,
                      background: occupied ? "rgba(239,68,68,0.06)" : "white",
                      color: occupied ? "rgba(239,68,68,0.60)" : "#111",
                      fontSize: 18, fontWeight: 700, cursor: occupied ? "default" : "pointer",
                      boxShadow: occupied ? "none" : "0 1px 4px rgba(0,0,0,0.07)",
                    }}
                  >
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
        <div style={{
          position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)",
          background: "rgba(0,0,0,0.82)", color: "white",
          padding: "10px 20px", borderRadius: 10, fontSize: 13, fontWeight: 600,
          backdropFilter: "blur(12px)", zIndex: 200, whiteSpace: "nowrap",
        }}>
          {toast}
        </div>
      )}
    </div>
  )
}

// ── Shared mini control button style ────────────────────────────────────────────

const ctrlBtn: React.CSSProperties = {
  width: 26, height: 26, borderRadius: 7,
  border: "1px solid rgba(0,0,0,0.12)", background: "white",
  color: "rgba(0,0,0,0.55)", cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
  boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
}
