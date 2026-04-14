"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import {
  History, Plus, Minus, Bell, Pause, Play,
  ChevronLeft, Check, X, ToggleLeft, ToggleRight, Palette,
  Download,
} from "lucide-react"

const API                = "/api/brain"
const DEMO_RESTAURANT_ID = "dec0cafe-0000-4000-8000-000000000001"
const QUOTE_PRESETS      = [5, 10, 15, 20]

// Business day starts at 3am — history before 3am belongs to previous day
function getBusinessDate(): string {
  const now = new Date()
  if (now.getHours() < 3) now.setDate(now.getDate() - 1)
  return now.toLocaleDateString("en-CA")  // YYYY-MM-DD
}
const TABLE_NUMBERS      = Array.from({ length: 16 }, (_, i) => i + 1)

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

// ── Shared guest log + seating history (same keys as HOST standard) ──────────

interface GuestLogRecord {
  id: string; name: string; party_size: number; source: string
  phone: string | null; notes: string | null
  quoted_wait: number | null; actual_wait_min: number | null
  joined_ms: number; resolved_ms: number
  status: "seated" | "removed"
}

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`
}

function addToGuestLog(r: GuestLogRecord) {
  try {
    const key = `host_demo_log_${getBusinessDate()}`
    const records: GuestLogRecord[] = JSON.parse(localStorage.getItem(key) ?? "[]")
    const idx = records.findIndex(x => x.id === r.id)
    if (idx >= 0) records[idx] = r; else records.push(r)
    localStorage.setItem(key, JSON.stringify(records))
  } catch {}
}

const HISTORY_KEY      = "host_demo_seating_history"
const HISTORY_DATE_KEY = "host_demo_seating_history_date"
const MAX_HISTORY      = 300

function addToSharedHistory(row: AnalogRow, seatedMs: number) {
  if (!row.addedMs) return
  try {
    const bd = getBusinessDate()
    const lastDate = localStorage.getItem(HISTORY_DATE_KEY)
    let hist: { party_size: number; quoted_wait: number; actual_wait_min: number; seated_at: number; day_of_week: number; hour_of_day: number }[] = []
    if (!lastDate || lastDate === bd) {
      try { hist = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]") } catch {}
    }
    const now = new Date(seatedMs)
    hist.push({ party_size: row.partySize, quoted_wait: row.quotedWait ?? 0, actual_wait_min: Math.round((seatedMs - row.addedMs) / 60_000), seated_at: seatedMs, day_of_week: now.getDay(), hour_of_day: now.getHours() })
    if (hist.length > MAX_HISTORY) hist.splice(0, hist.length - MAX_HISTORY)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(hist))
    localStorage.setItem(HISTORY_DATE_KEY, bd)
  } catch {}
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
  // Tap occupied table in picker → ask to clear+seat
  const [clearAndSeat,    setClearAndSeat]   = useState<{ localId: string; tableNum: number; occupantName: string } | null>(null)
  // Long-press occupied table in picker → move that guest to another table
  const [movingFrom,      setMovingFrom]     = useState<number | null>(null)  // table number being moved
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
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
  const knownIdsRef = useRef<Set<string>>((() => {
    // Seed from localStorage rows so we don't skip/duplicate entries across sessions
    try {
      const s = localStorage.getItem("analog_rows")
      if (s) {
        const p = JSON.parse(s) as AnalogRow[]
        return new Set(p.filter(r => r.queueEntryId).map(r => r.queueEntryId!))
      }
    } catch {}
    return new Set<string>()
  })())
  // Track localIds with in-flight join POSTs so the poll doesn't insert duplicates
  const pendingJoinsRef = useRef<Set<string>>(new Set())
  // Always-current rows ref — used by debounce callbacks to read final settled value
  const rowsRef = useRef(rows)
  useEffect(() => { rowsRef.current = rows }, [rows])
  // Debounce timers — only the timer handle, no stale val stored here
  const adjustTimerDebounce = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const partySizeDebounce   = useRef<Record<string, { timer: ReturnType<typeof setTimeout>; entryId: string; val: number }>>({})
  // Block pollQueue from overriding quotedWait while user is actively tapping ±
  const adjustingUntilRef = useRef<Record<string, number>>({})

  const V = makeV(visual)

  // ── Persist to localStorage ───────────────────────────────────────────────────
  useEffect(() => { try { localStorage.setItem("analog_rows", JSON.stringify(rows)) } catch {} }, [rows])
  useEffect(() => { try { localStorage.setItem("analog_visual", visual) } catch {} }, [visual])
  useEffect(() => { try { localStorage.setItem("analog_tables", String(tableAssignment)) } catch {} }, [tableAssignment])
  useEffect(() => { try { localStorage.setItem("analog_zoom", String(zoom)) } catch {} }, [zoom])

  // ── 3am history clearing — wipe completed rows when business date changes ──
  useEffect(() => {
    const BDATE_KEY = "analog_business_date"
    const check = () => {
      const bd = getBusinessDate()
      try {
        const prev = localStorage.getItem(BDATE_KEY)
        if (prev && prev !== bd) {
          // New business day — clear completed rows
          setRows(r => r.filter(row => row.status !== "seated" && row.status !== "removed"))
        }
        localStorage.setItem(BDATE_KEY, bd)
      } catch {}
    }
    check()
    const t = setInterval(check, 60_000) // re-check every minute
    return () => clearInterval(t)
  }, [])

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

  // Track table occupants from backend for cross-view consistency
  const [tableOccupants, setTableOccupants] = useState<Record<string, { name: string; party_size: number }>>({})

  // Fetch tables + occupants periodically so both views stay synced
  const fetchTables = useCallback(() => {
    fetch(`${API}/tables?restaurant_id=${DEMO_RESTAURANT_ID}`).then(r => r.ok ? r.json() : []).then(setTables).catch(() => {})
    fetch(`${API}/tables/occupants?restaurant_id=${DEMO_RESTAURANT_ID}`).then(r => r.ok ? r.json() : {}).then(setTableOccupants).catch(() => {})
  }, [])
  useEffect(() => { fetchTables(); const t = setInterval(fetchTables, 2_000); return () => clearInterval(t) }, [fetchTables])

  // ── Poll queue ────────────────────────────────────────────────────────────────
  const pollQueue = useCallback(async () => {
    try {
      const r = await fetch(`${API}/queue?restaurant_id=${DEMO_RESTAURANT_ID}`)
      if (!r.ok) return
      const data: QueueEntry[] = await r.json()
      const serverIds = new Set(data.map(e => e.id))
      setRows(prev => {
        let updated = [...prev]
        // Sync existing + add new entries from server
        data.forEach(entry => {
          const existingIdx = updated.findIndex(r => r.queueEntryId === entry.id)
          if (existingIdx >= 0) {
            const ex = updated[existingIdx]
            let patch: Partial<AnalogRow> = {}
            // Status sync — handle all transitions including restore
            if (entry.status === "seated" && ex.status !== "seated")
              patch = { ...patch, status: "seated", seatedMs: ex.seatedMs ?? Date.now() }
            else if (entry.status === "removed" && ex.status !== "removed")
              patch = { ...patch, status: "removed", seatedMs: ex.seatedMs ?? Date.now(), removedByGuest: ex.source === "nfc" || ex.source === "web" }
            else if (entry.status === "ready" && ex.status !== "ready")
              patch = { ...patch, status: "ready" }
            else if (entry.status === "waiting" && (ex.status === "seated" || ex.status === "removed")) {
              // Restored from another view — bring back to active queue
              const arrMs = new Date(entry.arrival_time).getTime()
              const base = entry.wait_set_at ? new Date(entry.wait_set_at).getTime() : arrMs
              patch = { ...patch, status: "waiting", seatedMs: null, removedByGuest: undefined, quotedWait: entry.quoted_wait, addedMs: arrMs, deadlineMs: entry.quoted_wait ? base + entry.quoted_wait * 60_000 : null }
            }
            // Sync quoted_wait when HOST standard changes it — but not while user is tapping ±
            if (entry.quoted_wait !== null && entry.quoted_wait !== ex.quotedWait && !patch.quotedWait) {
              const isAdjusting = (adjustingUntilRef.current[ex.localId] ?? 0) > Date.now()
              if (!isAdjusting) {
                const base = entry.wait_set_at ? new Date(entry.wait_set_at).getTime() : Date.now()
                patch = { ...patch, quotedWait: entry.quoted_wait, status: (ex.status === "filling" ? "waiting" : ex.status) as AnalogRow["status"], addedMs: ex.addedMs ?? base, deadlineMs: base + entry.quoted_wait * 60_000 }
              }
            }
            // Sync name, party size and phone edits from HOST standard
            if (entry.name && entry.name !== ex.name) patch = { ...patch, name: entry.name }
            if (entry.party_size !== ex.partySize) patch = { ...patch, partySize: entry.party_size }
            if (entry.phone && entry.phone !== ex.phone) patch = { ...patch, phone: entry.phone }
            if (Object.keys(patch).length > 0)
              updated = updated.map((r, i) => i === existingIdx ? { ...r, ...patch } : r)
            return
          }
          if (knownIdsRef.current.has(entry.id)) return
          // If a local row with the same name is mid-join (pendingJoinsRef), link it instead of creating a duplicate
          const pendingIdx = updated.findIndex(r => pendingJoinsRef.current.has(r.localId) && !r.queueEntryId && r.name === entry.name && r.partySize === entry.party_size)
          if (pendingIdx >= 0) {
            knownIdsRef.current.add(entry.id)
            updated = updated.map((r, i) => i === pendingIdx ? { ...r, queueEntryId: entry.id } : r)
            return
          }
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
        // Detect entries that vanished from server (seated/removed from HOST standard)
        updated = updated.map(r => {
          if (r.queueEntryId && (r.status === "waiting" || r.status === "ready" || r.status === "filling") && !serverIds.has(r.queueEntryId)) {
            return { ...r, status: "seated" as const, seatedMs: r.seatedMs ?? Date.now() }
          }
          return r
        })
        return updated
      })
    } catch {}
  }, [])

  useEffect(() => { pollQueue(); const t = setInterval(pollQueue, 1_500); return () => clearInterval(t) }, [pollQueue])

  const patchRow = useCallback((localId: string, patch: Partial<AnalogRow>) => {
    setRows(prev => prev.map(r => r.localId === localId ? { ...r, ...patch } : r))
  }, [])

  // ── Set quote ─────────────────────────────────────────────────────────────────
  const setQuote = useCallback(async (localId: string, minutes: number) => {
    const row = rows.find(r => r.localId === localId)
    if (!row) return
    if (!row.queueEntryId && !row.name.trim() && !row.phone.trim()) return
    const now = Date.now()
    // Optimistic UI — timer starts immediately without waiting on network
    patchRow(localId, { quotedWait: minutes, status: "waiting", addedMs: row.addedMs ?? now, deadlineMs: (row.addedMs ?? now) + minutes * 60_000 })
    if (row.queueEntryId) {
      // Already in queue — PATCH wait; backend fires SMS on first quote
      fetch(`${API}/queue/${row.queueEntryId}/wait?minutes=${minutes}`, { method: "PATCH" })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.sms_sent) showToast("Text sent"); else if (d?.sms_error) showToast(`Text failed: ${d.sms_error}`) })
        .catch(() => {})
    } else {
      // New guest — join with quoted_wait; backend fires SMS synchronously and returns result
      pendingJoinsRef.current.add(localId)
      try {
        const joinRes = await fetch(`${API}/queue/join`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: row.name.trim() || "Guest", party_size: row.partySize, phone: row.phone.trim() || null, notes: row.notes.trim() || null, restaurant_id: DEMO_RESTAURANT_ID, source: "analog", quoted_wait: minutes }),
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
  }, [rows, patchRow, showToast])

  const adjustTimer = useCallback((localId: string, delta: number) => {
    // Mark row as "user adjusting" — blocks pollQueue from overriding for 2s
    adjustingUntilRef.current[localId] = Date.now() + 2000

    // Pure state update — no side effects inside the updater
    setRows(prev => prev.map(r => {
      if (r.localId !== localId) return r
      const newQuoted = Math.max(1, (r.quotedWait ?? 0) + delta)
      return r.isPaused
        ? { ...r, quotedWait: newQuoted, pausedSecsLeft: Math.max(0, r.pausedSecsLeft + delta * 60) }
        : { ...r, quotedWait: newQuoted, deadlineMs: (computeSecs(r) === 0 && delta > 0) ? Date.now() + delta * 60_000 : (r.deadlineMs ?? Date.now()) + delta * 60_000 }
    }))

    // Debounce the PATCH — cancel any pending timer and set a new one.
    // Read the final settled value from rowsRef at fire time (avoids stale closure).
    const existing = adjustTimerDebounce.current[localId]
    if (existing) clearTimeout(existing)
    adjustTimerDebounce.current[localId] = setTimeout(() => {
      delete adjustTimerDebounce.current[localId]
      const row = rowsRef.current.find(r => r.localId === localId)
      if (row?.queueEntryId && row.quotedWait) {
        fetch(`${API}/queue/${row.queueEntryId}/wait?minutes=${row.quotedWait}`, { method: "PATCH" }).catch(() => {})
      }
    }, 600)
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
      // Show table picker when tableAssignment is on — works with or without queueEntryId
      // (guests without a queueEntryId won't hit the backend table assignment but still seat locally)
      if (tableAssignment) { setTablePickFor(localId); fetchTables(); return }
      if (row.queueEntryId) try { await fetch(`${API}/queue/${row.queueEntryId}/seat`, { method: "POST" }) } catch {}
      const seatedMs = Date.now()
      patchRow(localId, { status: "seated", seatedMs })
      addToSharedHistory(row, seatedMs)
      addToGuestLog({ id: row.queueEntryId || row.localId, name: row.name || "Guest", party_size: row.partySize, source: row.source || "analog", phone: row.phone || null, notes: row.notes || null, quoted_wait: row.quotedWait, actual_wait_min: row.addedMs ? Math.round((seatedMs - row.addedMs) / 60_000) : null, joined_ms: row.addedMs ?? seatedMs, resolved_ms: seatedMs, status: "seated" })
      showToast(`${row.name || "Guest"} seated`)
    } else {
      if (row.queueEntryId) try { await fetch(`${API}/queue/${row.queueEntryId}/remove`, { method: "POST" }) } catch {}
      const resolvedMs = Date.now()
      patchRow(localId, { status: "removed", seatedMs: resolvedMs })
      addToGuestLog({ id: row.queueEntryId || row.localId, name: row.name || "Guest", party_size: row.partySize, source: row.source || "analog", phone: row.phone || null, notes: row.notes || null, quoted_wait: row.quotedWait, actual_wait_min: null, joined_ms: row.addedMs ?? resolvedMs, resolved_ms: resolvedMs, status: "removed" })
      showToast(`${row.name || "Guest"} left`)
    }
  }, [rows, tableAssignment, patchRow, showToast, fetchTables])

  // Move an already-seated guest from one table to another (long-press flow)
  const moveTableGuest = useCallback(async (fromNum: number, toNum: number) => {
    setMovingFrom(null)
    if (fromNum === toNum) return
    let tableList: Table[] = tables
    try {
      const tr = await fetch(`${API}/tables?restaurant_id=${DEMO_RESTAURANT_ID}`)
      if (tr.ok) {
        const raw: Table[] = await tr.json()
        const coerced = raw.map(t => ({ ...t, table_number: Number(t.table_number) }))
        const byNumber = new Map<number, Table>()
        for (const t of coerced) {
          const ex = byNumber.get(t.table_number)
          if (!ex || t.status === "occupied") byNumber.set(t.table_number, t)
        }
        tableList = Array.from(byNumber.values())
      }
    } catch {}
    const fromTable = tableList.find(t => t.table_number === fromNum)
    const toTable   = tableList.find(t => t.table_number === toNum)
    if (!fromTable || !toTable) { showToast("Table not found"); return }
    const occupant = tableOccupants[String(fromNum)]
    if (!occupant) { showToast("No guest at that table"); return }
    // Optimistic update
    setTableOccupants(prev => {
      const n = { ...prev }
      delete n[String(fromNum)]
      n[String(toNum)] = occupant
      return n
    })
    setTables(prev => prev.map(t =>
      t.table_number === fromNum ? { ...t, status: "available" } :
      t.table_number === toNum   ? { ...t, status: "occupied"  } : t
    ))
    try {
      await fetch(`${API}/tables/${toTable.id}/occupy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: occupant.name, party_size: occupant.party_size }),
      })
      await fetch(`${API}/tables/${fromTable.id}/clear`, { method: "POST" })
    } catch { showToast("Move may not have saved — check floor map") }
    showToast(`Table ${fromNum} → Table ${toNum}`)
    fetchTables()
  }, [tables, tableOccupants, showToast, fetchTables])

  const seatToTable = useCallback(async (localId: string, tableNum: number) => {
    setTablePickFor(null)
    const row = rows.find(r => r.localId === localId)
    if (!row) return
    // Always fetch fresh tables so we never miss a tableId
    // Normalize: table_number comes back as string from API, deduplicate per number
    let tableList: Table[] = tables
    try {
      const tr = await fetch(`${API}/tables?restaurant_id=${DEMO_RESTAURANT_ID}`)
      if (tr.ok) {
        const raw: Table[] = await tr.json()
        const coerced = raw.map(t => ({ ...t, table_number: Number(t.table_number) }))
        const byNumber = new Map<number, Table>()
        for (const t of coerced) {
          const ex = byNumber.get(t.table_number)
          if (!ex || t.status === "occupied") byNumber.set(t.table_number, t)
        }
        tableList = Array.from(byNumber.values())
      }
    } catch {}
    const apiTable = tableList.find(t => t.table_number === tableNum)
    if (row.queueEntryId) {
      try {
        const r = apiTable
          ? await fetch(`${API}/queue/${row.queueEntryId}/seat-to-table/${apiTable.id}`, { method: "POST" })
          : await fetch(`${API}/queue/${row.queueEntryId}/seat`, { method: "POST" })
        if (!r.ok) { showToast("Could not seat guest — try again"); return }
      } catch { showToast("Could not seat guest — try again"); return }
    }
    // Optimistically mark the table occupied in local state so the picker updates immediately
    setTableOccupants(prev => ({ ...prev, [String(tableNum)]: { name: row.name || "Guest", party_size: row.partySize } }))
    setTables(prev => prev.map(t => t.table_number === tableNum ? { ...t, status: "occupied" } : t))
    const seatedMs = Date.now()
    patchRow(localId, { status: "seated", seatedMs })
    addToSharedHistory(row, seatedMs)
    addToGuestLog({ id: row.queueEntryId || row.localId, name: row.name || "Guest", party_size: row.partySize, source: row.source || "analog", phone: row.phone || null, notes: row.notes || null, quoted_wait: row.quotedWait, actual_wait_min: row.addedMs ? Math.round((seatedMs - row.addedMs) / 60_000) : null, joined_ms: row.addedMs ?? seatedMs, resolved_ms: seatedMs, status: "seated" })
    showToast(`${row.name || "Guest"} seated at Table ${tableNum}`)
    fetchTables()
  }, [rows, tables, patchRow, showToast, fetchTables])

  // Clear an occupied table then seat the pending guest there (declared after seatToTable)
  const clearAndSeatGuest = useCallback(async (localId: string, tableNum: number) => {
    setClearAndSeat(null)
    setTablePickFor(null)
    let tableList: Table[] = tables
    try {
      const tr = await fetch(`${API}/tables?restaurant_id=${DEMO_RESTAURANT_ID}`)
      if (tr.ok) {
        const raw: Table[] = await tr.json()
        const coerced = raw.map(t => ({ ...t, table_number: Number(t.table_number) }))
        const byNumber = new Map<number, Table>()
        for (const t of coerced) {
          const ex = byNumber.get(t.table_number)
          if (!ex || t.status === "occupied") byNumber.set(t.table_number, t)
        }
        tableList = Array.from(byNumber.values())
      }
    } catch {}
    const apiTable = tableList.find(t => t.table_number === tableNum)
    if (!apiTable) { showToast("Table not found"); return }
    try { await fetch(`${API}/tables/${apiTable.id}/clear`, { method: "POST" }) } catch {}
    setTableOccupants(prev => { const n = { ...prev }; delete n[String(tableNum)]; return n })
    setTables(prev => prev.map(t => t.table_number === tableNum ? { ...t, status: "available" } : t))
    await seatToTable(localId, tableNum)
  }, [tables, seatToTable, showToast])

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

  const firstCol = visual === "classic" ? "68px" : "52px"
  const gridCols = isLandscape
    ? `${firstCol} 1fr 100px 1fr minmax(170px,1.2fr) minmax(140px,1fr)`
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

      {/* ── Scaled content ── */}
      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        {/* Classic notepad margin lines — inside overflow:hidden so they don't scroll, outside the zoom transform so they never intersect content */}
        {visual === "classic" && <>
          <div style={{ position: "absolute", top: 0, bottom: 0, left: 8, width: 2, background: "rgba(200,50,50,0.65)", zIndex: 2, pointerEvents: "none" }} />
          <div style={{ position: "absolute", top: 0, bottom: 0, left: 14, width: 2, background: "rgba(200,50,50,0.65)", zIndex: 2, pointerEvents: "none" }} />
        </>}
        <div style={{ overflowY: "auto", height: "100%", boxSizing: "border-box", paddingLeft: visual === "classic" ? 22 : 0, paddingBottom: `calc(100dvh / ${zoom})` }}>
          <div style={{ transform: `scale(${zoom})`, transformOrigin: "top left", width: `${(1 / zoom) * 100}%`, minHeight: `${(1 / zoom) * 100}%` }}>

            {/* ── Column Headers ── */}
            <div style={{ background: V.colHeaderBg, borderBottom: `1px solid ${V.rowBorder}`, display: "grid", gridTemplateColumns: gridCols, padding: "6px 16px" }}>
              {colHeaders.map((h, i) => (
                <div key={i} style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: V.colHeaderText, paddingLeft: i > 0 ? 8 : 0 }}>{h}</div>
              ))}
            </div>

            {/* ── Completed rows (above active — history at top) ── */}
            {completedRows.length > 0 && (
              <>
                <div style={{ height: 1, background: V.completedDiv, margin: "12px 0 0" }} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px 6px", background: V.completedBg }}>
                  <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: V.textMuted }}>Completed · {completedRows.length}</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => {
                        const header = ["Name","Party Size","Phone","Quoted Wait (min)","Status","Arrived","Waited (min)","Notes"]
                        const csvRows = completedRows.map(r => [
                          r.name || "Guest", r.partySize, r.phone || "", r.quotedWait ?? "",
                          r.status === "seated" ? "Seated" : r.removedByGuest ? "Left waitlist" : "Removed",
                          r.addedMs ? new Date(r.addedMs).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }) : "",
                          r.addedMs ? Math.round(((r.seatedMs ?? Date.now()) - r.addedMs) / 60_000) : "",
                          r.notes || "",
                        ])
                        const csv = [header, ...csvRows].map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n")
                        const blob = new Blob([csv], { type: "text/csv" })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement("a"); a.href = url; a.download = `waitlist-${getBusinessDate()}.csv`; a.click()
                        URL.revokeObjectURL(url)
                        showToast("Exported to CSV")
                      }}
                      style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, border: `1.5px solid rgba(34,197,94,0.30)`, background: "rgba(34,197,94,0.08)", color: "#22c55e", fontSize: 11, fontWeight: 700, cursor: "pointer", touchAction: "manipulation" }}
                    ><Download style={{ width: 12, height: 12 }} /> CSV</button>
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
                        const arrMs = entry ? new Date(entry.arrival_time).getTime() : row.addedMs
                        const qw = entry?.quoted_wait ?? row.quotedWait
                        const base = entry?.wait_set_at ? new Date(entry.wait_set_at).getTime() : (arrMs ?? Date.now())
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

                  {/* Checkbox / Remove */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {!isBlank && !isWaiting && row.status === "filling" ? (
                      /* Remove button — discard a row being filled in */
                      <button
                        onPointerDown={e => {
                          e.preventDefault()
                          if (row.queueEntryId) fetch(`${API}/queue/${row.queueEntryId}/remove`, { method: "POST" }).catch(() => {})
                          const resolvedMs = Date.now()
                          addToGuestLog({ id: row.queueEntryId || row.localId, name: row.name || "Guest", party_size: row.partySize, source: row.source || "analog", phone: row.phone || null, notes: row.notes || null, quoted_wait: row.quotedWait, actual_wait_min: null, joined_ms: row.addedMs ?? resolvedMs, resolved_ms: resolvedMs, status: "removed" })
                          setRows(prev => prev.filter(r => r.localId !== row.localId))
                        }}
                        style={{ width: 44, height: 44, borderRadius: 10, border: `2px solid rgba(239,68,68,0.25)`, background: "rgba(239,68,68,0.06)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", touchAction: "manipulation", color: "#ef4444" }}
                        title="Remove"
                      >
                        <X style={{ width: 16, height: 16 }} />
                      </button>
                    ) : !isBlank ? (
                      <button
                        onPointerDown={() => setConfirmFor(row.localId)}
                        style={{ width: 44, height: 44, borderRadius: 10, border: `2px solid ${isWaiting ? V.textSub : V.rowBorder}`, background: visual === "modern" ? "rgba(255,255,255,0.05)" : "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", touchAction: "manipulation", boxShadow: isWaiting ? "0 1px 4px rgba(0,0,0,0.08)" : "none" }}
                      />
                    ) : null}
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
                    <button onPointerDown={() => {
                      const s = Math.max(1, row.partySize - 1); patchRow(row.localId, { partySize: s })
                      if (row.queueEntryId) {
                        const ex = partySizeDebounce.current[row.localId]; if (ex) clearTimeout(ex.timer)
                        const timer = setTimeout(() => { const p = partySizeDebounce.current[row.localId]; if (p) { fetch(`${API}/queue/${p.entryId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ party_size: p.val }) }).catch(() => {}); delete partySizeDebounce.current[row.localId] } }, 500)
                        partySizeDebounce.current[row.localId] = { timer, entryId: row.queueEntryId, val: s }
                      }
                    }} style={{ width: 30, height: 40, border: "none", background: "transparent", color: V.textSub, fontSize: 20, cursor: "pointer", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", touchAction: "manipulation" }}>−</button>
                    <input
                      type="number" min={1} max={20} value={row.partySize}
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
      {(tablePickFor || movingFrom !== null) && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end" }} onPointerDown={() => { setTablePickFor(null); setMovingFrom(null) }}>
          <div style={{ width: "100%", background: "white", borderRadius: "20px 20px 0 0", padding: "24px 20px 44px", maxHeight: "65dvh", overflowY: "auto" }} onPointerDown={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <p style={{ fontSize: 17, fontWeight: 700, color: "#111", margin: 0 }}>
                {movingFrom !== null ? `Move guest from Table ${movingFrom}` : "Select Table"}
              </p>
              <button onPointerDown={() => { setTablePickFor(null); setMovingFrom(null) }} style={{ border: "none", background: "none", cursor: "pointer", color: "rgba(0,0,0,0.40)", fontSize: 20, lineHeight: 1, touchAction: "manipulation" }}>✕</button>
            </div>
            {movingFrom === null && (
              <p style={{ fontSize: 12, color: "rgba(0,0,0,0.38)", margin: "0 0 16px" }}>
                Tap an open table to seat · Tap red to swap · Hold red to move
              </p>
            )}
            {movingFrom !== null && (
              <p style={{ fontSize: 12, color: "rgba(0,0,0,0.38)", margin: "0 0 16px" }}>
                Tap any table to move the guest there
              </p>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              {TABLE_NUMBERS.map(n => {
                const occupied     = tables.find(t => Number(t.table_number) === n)?.status === "occupied" || !!tableOccupants[String(n)]
                const occupantName = tableOccupants[String(n)]?.name
                const isMoveSrc    = movingFrom === n
                // In move mode: all other tables are targets
                if (movingFrom !== null) {
                  return (
                    <button
                      key={n}
                      onPointerDown={() => moveTableGuest(movingFrom, n)}
                      style={{
                        height: 60, borderRadius: 14, display: "flex", flexDirection: "column",
                        alignItems: "center", justifyContent: "center", gap: 2,
                        border: `2px solid ${isMoveSrc ? "rgba(251,191,36,0.80)" : occupied ? "rgba(239,68,68,0.35)" : "rgba(34,197,94,0.40)"}`,
                        background: isMoveSrc ? "rgba(251,191,36,0.15)" : occupied ? "rgba(239,68,68,0.07)" : "rgba(34,197,94,0.07)",
                        color: isMoveSrc ? "#b45309" : occupied ? "#dc2626" : "#16a34a",
                        fontSize: isMoveSrc ? 13 : 20, fontWeight: 800, cursor: "pointer", touchAction: "manipulation",
                        opacity: isMoveSrc ? 0.6 : 1,
                      }}
                    >
                      {isMoveSrc ? <><span style={{ fontSize: 9, letterSpacing: "0.08em" }}>MOVING</span><span>{n}</span></> : n}
                    </button>
                  )
                }
                // Normal seating mode
                return (
                  <button
                    key={n}
                    onPointerDown={(e) => {
                      if (!occupied) { seatToTable(tablePickFor!, n); return }
                      // Long-press on occupied → enter move mode
                      longPressTimer.current = setTimeout(() => {
                        longPressTimer.current = null
                        setMovingFrom(n)
                        setTablePickFor(null)
                      }, 400)
                    }}
                    onPointerUp={() => {
                      if (longPressTimer.current) {
                        clearTimeout(longPressTimer.current)
                        longPressTimer.current = null
                        // Short tap on occupied → confirm clear+seat
                        if (occupied && tablePickFor) {
                          setClearAndSeat({ localId: tablePickFor, tableNum: n, occupantName: occupantName || `Table ${n} guest` })
                        }
                      }
                    }}
                    onPointerLeave={() => { if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null } }}
                    style={{
                      height: 60, borderRadius: 14, display: "flex", flexDirection: "column",
                      alignItems: "center", justifyContent: "center", gap: 1,
                      border: `2px solid ${occupied ? "rgba(239,68,68,0.55)" : "rgba(34,197,94,0.40)"}`,
                      background: occupied ? "rgba(239,68,68,0.09)" : "rgba(34,197,94,0.07)",
                      color: occupied ? "#dc2626" : "#16a34a",
                      cursor: "pointer", touchAction: "manipulation",
                    }}
                  >
                    <span style={{ fontSize: occupied ? 16 : 20, fontWeight: 800, lineHeight: 1 }}>{n}</span>
                    {occupied && occupantName && <span style={{ fontSize: 8, fontWeight: 600, color: "rgba(220,38,38,0.60)", overflow: "hidden", maxWidth: "90%", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{occupantName}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Clear + Seat confirmation ── */}
      {clearAndSeat && (
        <div style={{ position: "fixed", inset: 0, zIndex: 150, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end" }} onPointerDown={() => setClearAndSeat(null)}>
          <div style={{ width: "100%", background: "white", borderRadius: "24px 24px 0 0", padding: "28px 24px 48px" }} onPointerDown={e => e.stopPropagation()}>
            <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 600, color: "rgba(0,0,0,0.40)", letterSpacing: "0.04em", textTransform: "uppercase" }}>Table {clearAndSeat.tableNum} is occupied</p>
            <p style={{ margin: "0 0 24px", fontSize: 18, fontWeight: 700, color: "#111" }}>
              Clear <span style={{ color: "#dc2626" }}>{clearAndSeat.occupantName}</span> and seat new guest here?
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <button
                onPointerDown={() => clearAndSeatGuest(clearAndSeat.localId, clearAndSeat.tableNum)}
                style={{ height: 64, borderRadius: 18, border: "none", cursor: "pointer", fontSize: 17, fontWeight: 800, background: "rgba(34,197,94,0.88)", color: "white", touchAction: "manipulation" }}
              >
                Yes, clear and seat here
              </button>
              <button
                onPointerDown={() => { setClearAndSeat(null); setTablePickFor(clearAndSeat.localId); fetchTables() }}
                style={{ height: 48, borderRadius: 14, border: "1px solid rgba(0,0,0,0.10)", background: "rgba(0,0,0,0.03)", color: "rgba(0,0,0,0.45)", fontSize: 15, fontWeight: 600, cursor: "pointer", touchAction: "manipulation" }}
              >
                Cancel
              </button>
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
