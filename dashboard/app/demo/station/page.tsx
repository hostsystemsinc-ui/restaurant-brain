"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Users, Clock, CheckCircle2, BellRing,
  RefreshCw, Wifi, WifiOff, Plus, X,
  LayoutDashboard, GripVertical, CalendarDays, CalendarCheck,
  Copy, Check, Pencil, Activity, Trash2, BarChart2, AlertTriangle, ChevronLeft,
} from "lucide-react"
import {
  DndContext, DragOverlay,
  PointerSensor, TouchSensor,
  useSensor, useSensors,
  useDraggable, useDroppable,
  pointerWithin, MeasuringStrategy,
  type DragStartEvent, type DragEndEvent,
  type Modifier,
} from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"

// Snap drag ghost so cursor stays at top-left corner of ghost (+small offset).
// This ensures the cursor IS the precise drop point the user sees.
const snapGhostToCursor: Modifier = ({ activatorEvent, draggingNodeRect, transform }) => {
  if (activatorEvent && draggingNodeRect) {
    const ev = activatorEvent as PointerEvent
    return {
      ...transform,
      x: transform.x + (ev.clientX - draggingNodeRect.left) - 12,
      y: transform.y + (ev.clientY - draggingNodeRect.top)  - 12,
    }
  }
  return transform
}

const API                = "/api/brain"
const DEMO_RESTAURANT_ID = "dec0cafe-0000-4000-8000-000000000001"
const NFC_JOIN_URL       = "https://hostplatform.net/demo/join"

// ── Utilities ──────────────────────────────────────────────────────────────────

function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 10)
  if (d.length <= 3) return d
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
}

// ── Floor plan ─────────────────────────────────────────────────────────────────

const CANVAS_W = 920
const CANVAS_H = 500

interface FloorPos {
  number: number
  shape: "round" | "square" | "rect"
  x: number; y: number; w: number; h: number
  section: "main" | "bar"
}

const FLOOR_PLAN: FloorPos[] = [
  // Window 2-tops (far left, round)
  { number: 1,  shape: "round",  x: 28,  y: 32,  w: 72, h: 72,  section: "main" },
  { number: 2,  shape: "round",  x: 28,  y: 148, w: 72, h: 72,  section: "main" },
  { number: 3,  shape: "round",  x: 28,  y: 264, w: 72, h: 72,  section: "main" },
  // 4-tops (second column, square)
  { number: 4,  shape: "square", x: 148, y: 26,  w: 95, h: 95,  section: "main" },
  { number: 5,  shape: "square", x: 148, y: 163, w: 95, h: 95,  section: "main" },
  { number: 6,  shape: "square", x: 148, y: 298, w: 95, h: 95,  section: "main" },
  // Center feature tables (rect)
  { number: 7,  shape: "rect",   x: 293, y: 26,  w: 162, h: 112, section: "main" },
  { number: 8,  shape: "rect",   x: 293, y: 196, w: 162, h: 112, section: "main" },
  { number: 9,  shape: "rect",   x: 293, y: 366, w: 162, h: 98,  section: "main" },
  // Right 4-tops
  { number: 10, shape: "square", x: 506, y: 26,  w: 95, h: 95,  section: "main" },
  { number: 11, shape: "square", x: 506, y: 163, w: 95, h: 95,  section: "main" },
  { number: 12, shape: "square", x: 506, y: 298, w: 95, h: 95,  section: "main" },
  // Bar stools (far right, behind divider)
  { number: 13, shape: "round",  x: 748, y: 36,  w: 60, h: 60,  section: "bar" },
  { number: 14, shape: "round",  x: 748, y: 134, w: 60, h: 60,  section: "bar" },
  { number: 15, shape: "round",  x: 748, y: 232, w: 60, h: 60,  section: "bar" },
  { number: 16, shape: "round",  x: 748, y: 330, w: 60, h: 60,  section: "bar" },
]

// ── Seating History + Suggestions ──────────────────────────────────────────────

interface SeatingRecord {
  party_size:      number
  quoted_wait:     number
  actual_wait_min: number  // minutes from arrival_time to seated
  seated_at:       number  // unix ms
  day_of_week:     number  // 0–6
  hour_of_day:     number  // 0–23
}

// ── Guest Log (rich per-day record for History page) ───────────────────────────
export interface GuestLogRecord {
  id:              string
  name:            string
  party_size:      number
  source:          string
  phone:           string | null
  notes:           string | null
  quoted_wait:     number | null
  actual_wait_min: number | null  // null for removed guests
  joined_ms:       number         // unix ms
  resolved_ms:     number         // unix ms (seated or removed)
  status:          "seated" | "removed"
}

const GUEST_LOG_KEY = (dateStr: string) => `host_demo_log_${dateStr}`

function addToGuestLog(r: GuestLogRecord) {
  try {
    const dateStr = getBusinessDate()
    const key     = GUEST_LOG_KEY(dateStr)
    const records: GuestLogRecord[] = JSON.parse(localStorage.getItem(key) ?? "[]")
    // Replace if entry ID already present (e.g. re-seat after undo)
    const idx = records.findIndex(x => x.id === r.id)
    if (idx >= 0) records[idx] = r; else records.push(r)
    localStorage.setItem(key, JSON.stringify(records))
  } catch {}
}

const HISTORY_KEY      = "host_demo_seating_history"
const HISTORY_DATE_KEY = "host_demo_seating_history_date"
const MAX_HISTORY      = 300
// Minimum seatings needed before suggestions are considered statistically valid
const MIN_SAMPLES_FOR_SUGGESTION = 8

// Business day starts at 3am — history before 3am belongs to previous day
function getBusinessDate(): string {
  const now = new Date()
  if (now.getHours() < 3) now.setDate(now.getDate() - 1)
  return now.toLocaleDateString("en-CA")  // YYYY-MM-DD
}

function getHistory(): SeatingRecord[] {
  try {
    // Auto-wipe history at 3am (business day boundary)
    const bd       = getBusinessDate()
    const lastDate = localStorage.getItem(HISTORY_DATE_KEY)
    if (lastDate && lastDate !== bd) {
      localStorage.removeItem(HISTORY_KEY)
      localStorage.setItem(HISTORY_DATE_KEY, bd)
      return []
    }
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]")
  } catch { return [] }
}
function addToHistory(r: SeatingRecord) {
  try {
    const h = getHistory(); h.push(r)
    if (h.length > MAX_HISTORY) h.splice(0, h.length - MAX_HISTORY)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(h))
    localStorage.setItem(HISTORY_DATE_KEY, getBusinessDate())
  } catch {}
}
// Weighted suggestion: favors same party size + nearby hour of day.
// Returns null until MIN_SAMPLES_FOR_SUGGESTION seatings have been recorded today.
function suggestWait(partySize: number): number | null {
  const hist = getHistory()
  if (hist.length < MIN_SAMPLES_FOR_SUGGESTION) return null
  const hour = new Date().getHours()
  const scored = hist.flatMap(r => {
    const sd = Math.abs(r.party_size - partySize)
    const hd = Math.min(Math.abs(r.hour_of_day - hour), 24 - Math.abs(r.hour_of_day - hour))
    if (sd > 4 || hd > 4) return []
    return [{ wait: r.quoted_wait, w: (sd === 0 ? 4 : sd === 1 ? 2 : 1) * (hd <= 1 ? 2 : 1) }]
  })
  if (scored.length < 3) {
    const s = hist.filter(r => r.party_size === partySize)
    if (s.length < 3) return null          // not enough exact-size data either
    return Math.round(s.reduce((a, r) => a + r.quoted_wait, 0) / s.length)
  }
  const tw = scored.reduce((a, r) => a + r.w, 0)
  return Math.round(scored.reduce((a, r) => a + r.wait * r.w, 0) / tw)
}
// How many seatings still needed before suggestions unlock
function samplesNeeded(): number {
  return Math.max(0, MIN_SAMPLES_FOR_SUGGESTION - getHistory().length)
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface Table {
  id: string
  table_number: number
  capacity: number
  status: "available" | "occupied" | "reserved"
}

interface QueueEntry {
  id: string
  name: string
  party_size: number
  status: "waiting" | "ready" | "seated" | "removed"
  source: string
  quoted_wait: number | null
  wait_estimate?: number
  remaining_wait?: number
  arrival_time: string
  position?: number
  paused?: boolean
  phone: string | null
  notes: string | null
}

interface LocalOccupant { name: string; party_size: number; entry_id?: string }

interface Reservation {
  id:         string
  guest_name: string
  party_size: number
  date:       string   // "YYYY-MM-DD"
  time:       string   // "HH:MM" or "HH:MM:SS"
  status:     string
  phone:      string | null
  notes?:     string | null
}

// Table pre-assigned to an upcoming reservation (local-only, persisted in localStorage)
interface ReservedTable { resId: string; guestName: string; time: string }

// Toast notification system
type ToastItem = { id: number; msg: string; type: "ok" | "err" | "warn" }
let _toastSeq = 0
let _dispatchToast: ((msg: string, type: ToastItem["type"]) => void) | null = null
function showToast(msg: string, type: ToastItem["type"] = "ok") { _dispatchToast?.(msg, type) }

// fetch with AbortController timeout (default 10 s)
async function fetchT(url: string, opts: RequestInit = {}, ms = 10_000): Promise<Response> {
  const ctrl = new AbortController()
  const tid  = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal })
  } finally {
    clearTimeout(tid)
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function timeWaiting(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`
}

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function fmt12Res(t: string): string {
  const [h, m] = t.split(":").map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`
}

type ResUrgency = "upcoming" | "arriving" | "now" | "late"

function getResUrgency(dateStr: string, timeStr: string, now: Date): ResUrgency {
  const [h, m] = timeStr.split(":").map(Number)
  const [y, mo, d] = dateStr.split("-").map(Number)
  const resTime = new Date(y, mo - 1, d, h, m, 0)
  const diff = (resTime.getTime() - now.getTime()) / 60_000
  if (diff > 30)  return "upcoming"
  if (diff > 15)  return "arriving"
  if (diff > -15) return "now"
  return "late"
}

// Returns minutes until a reservation time (positive = future, negative = past/overdue)
function getResMinutesUntil(timeStr: string, now: Date): number {
  const [h, m] = timeStr.split(":").map(Number)
  const resTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0)
  return (resTime.getTime() - now.getTime()) / 60_000
}

// ── Wait Time Modal ────────────────────────────────────────────────────────────

function WaitTimeModal({
  entryId, defaultMinutes, onClose,
}: {
  entryId: string
  defaultMinutes: number
  onClose: () => void
}) {
  const [minutes, setMinutes] = useState(defaultMinutes || 15)
  const [saving,  setSaving]  = useState(false)
  const PRESETS = [5, 10, 15, 20, 30, 45]

  const save = async () => {
    setSaving(true)
    try {
      const r = await fetchT(`${API}/queue/${entryId}/wait?minutes=${minutes}`, { method: "PATCH" })
      if (!r.ok) throw new Error("server")
    } catch (e: unknown) {
      const isTimeout = e instanceof Error && e.name === "AbortError"
      showToast(isTimeout ? "Request timed out — try again." : "Could not update wait time.", "err")
      setSaving(false)
      return
    }
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={onClose} />
      <div
        className="relative w-full sm:w-[480px] rounded-t-3xl sm:rounded-3xl p-8"
        style={{ background: "#100C09", border: "1px solid rgba(255,185,100,0.14)", zIndex: 1 }}
      >
        <div className="sm:hidden w-10 h-1 rounded-full mx-auto mb-6" style={{ background: "rgba(255,185,100,0.18)" }} />

        <p className="text-xs font-black tracking-[0.22em] uppercase mb-1" style={{ color: "rgba(255,200,150,0.45)" }}>
          Estimated Wait
        </p>
        <p className="text-sm mb-7" style={{ color: "rgba(255,200,150,0.28)" }}>
          The guest will see this count down live on their phone.
        </p>

        {/* Stepper */}
        <div className="flex items-center justify-between mb-6 px-2">
          <button
            onClick={() => setMinutes(m => Math.max(1, m - 1))}
            className="w-16 h-16 rounded-full flex items-center justify-center text-3xl font-light transition-all active:scale-95 hover:brightness-125"
            style={{ border: "1.5px solid rgba(255,185,100,0.22)", color: "rgba(255,200,150,0.7)", background: "rgba(255,185,100,0.06)" }}
          >−</button>
          <div className="text-center">
            <span className="text-7xl font-extralight tabular-nums leading-none" style={{ color: "rgba(255,248,240,0.95)" }}>
              {minutes}
            </span>
            <span className="block text-sm mt-1" style={{ color: "rgba(255,200,150,0.40)" }}>min</span>
          </div>
          <button
            onClick={() => setMinutes(m => Math.min(120, m + 1))}
            className="w-16 h-16 rounded-full flex items-center justify-center text-3xl font-light transition-all active:scale-95 hover:brightness-125"
            style={{ border: "1.5px solid rgba(255,185,100,0.22)", color: "rgba(255,200,150,0.7)", background: "rgba(255,185,100,0.06)" }}
          >+</button>
        </div>

        {/* Preset grid */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {PRESETS.map(p => (
            <button
              key={p}
              onClick={() => setMinutes(p)}
              className="flex flex-col items-center justify-center rounded-2xl transition-all active:scale-95"
              style={{
                height: 76,
                background: minutes === p ? "rgba(255,185,100,0.16)" : "rgba(255,185,100,0.05)",
                border: `1.5px solid ${minutes === p ? "rgba(255,185,100,0.55)" : "rgba(255,185,100,0.11)"}`,
                boxShadow: minutes === p ? "0 0 0 3px rgba(255,185,100,0.10)" : "none",
              }}
            >
              <span style={{
                fontSize: 30, fontWeight: 700, lineHeight: 1,
                color: minutes === p ? "rgba(255,230,190,0.97)" : "rgba(255,200,150,0.50)",
              }}>
                {p}
              </span>
              <span style={{
                fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
                color: minutes === p ? "rgba(255,200,150,0.60)" : "rgba(255,185,100,0.30)",
                marginTop: 4,
              }}>
                MIN
              </span>
            </button>
          ))}
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="w-full rounded-2xl font-black tracking-[0.15em] uppercase transition-all active:scale-[0.98] disabled:opacity-40"
          style={{ background: "#22c55e", color: "white", fontSize: 16, padding: "20px 0" }}
        >
          {saving ? "Saving…" : "Set Wait Time"}
        </button>
        <button
          onClick={onClose}
          className="w-full mt-3 py-3 text-sm transition-all"
          style={{ color: "rgba(255,200,150,0.28)", background: "none", border: "none", cursor: "pointer" }}
        >
          Skip for now
        </button>
      </div>
    </div>
  )
}

// ── NFC Wait Panel (sidebar — floor map stays live) ─────────────────────────

function NfcWaitPanel({
  entryId, entryName, partySize, suggested, sidebarW, onClose,
}: {
  entryId:   string
  entryName: string
  partySize: number
  suggested: number | null
  sidebarW:  number
  onClose:   () => void
}) {
  const [minutes, setMinutes] = useState(suggested ?? 15)
  const [saving,  setSaving]  = useState(false)
  const PRESETS = [5, 10, 15, 20, 30, 45]

  const save = async () => {
    setSaving(true)
    try {
      const r = await fetchT(`${API}/queue/${entryId}/wait?minutes=${minutes}`, { method: "PATCH" })
      if (!r.ok) throw new Error("server")
    } catch (e: unknown) {
      const isTimeout = e instanceof Error && e.name === "AbortError"
      showToast(isTimeout ? "Request timed out — try again." : "Could not update wait time.", "err")
      setSaving(false)
      return
    }
    setSaving(false)
    onClose()
  }

  return (
    <div style={{
      position: "fixed", top: 48, left: 0, bottom: 0,
      width: sidebarW, zIndex: 46,
      background: "#0C0907",
      borderTop: "1px solid rgba(99,179,237,0.30)",
      borderRight: "1px solid rgba(99,179,237,0.18)",
      display: "flex", flexDirection: "column",
      overflowY: "auto",
    }}>
      {/* Header */}
      <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid rgba(99,179,237,0.14)", flexShrink: 0 }}>
        <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(99,179,237,0.65)", marginBottom: 4 }}>
          Quote Wait Time
        </p>
        <p style={{ fontSize: 16, fontWeight: 700, color: "rgba(255,248,240,0.95)", margin: 0 }}>
          {entryName || "Guest"} <span style={{ fontSize: 13, fontWeight: 400, color: "rgba(255,200,150,0.50)" }}>· {partySize}p</span>
        </p>
        <p style={{ fontSize: 11, color: "rgba(255,200,150,0.32)", marginTop: 4, marginBottom: 0 }}>
          The guest will see this count down on their phone.
        </p>
      </div>

      {/* Body */}
      <div style={{ padding: "16px 14px", flex: 1 }}>
        {/* HOST suggestion chip */}
        {suggested !== null && (
          <button
            onClick={() => setMinutes(suggested)}
            style={{
              width: "100%", padding: "8px 12px", borderRadius: 10, cursor: "pointer",
              marginBottom: 14,
              background: minutes === suggested ? "rgba(251,191,36,0.18)" : "rgba(251,191,36,0.07)",
              border: `1.5px solid ${minutes === suggested ? "rgba(251,191,36,0.65)" : "rgba(251,191,36,0.22)"}`,
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}
          >
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(251,191,36,0.75)" }}>
              HOST Suggestion
            </span>
            <span style={{ fontSize: 22, fontWeight: 700, color: minutes === suggested ? "rgba(255,240,180,0.97)" : "rgba(255,220,140,0.75)" }}>
              {suggested}<span style={{ fontSize: 11, fontWeight: 500, marginLeft: 3, color: "rgba(251,191,36,0.55)" }}>min</span>
            </span>
          </button>
        )}

        {/* Stepper */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, padding: "0 4px" }}>
          <button
            onClick={() => setMinutes(m => Math.max(1, m - 1))}
            style={{ width: 52, height: 52, borderRadius: "50%", border: "1.5px solid rgba(255,185,100,0.22)", color: "rgba(255,200,150,0.7)", background: "rgba(255,185,100,0.06)", fontSize: 26, fontWeight: 300, cursor: "pointer" }}
          >−</button>
          <div style={{ textAlign: "center" }}>
            <span style={{ fontSize: 60, fontWeight: 200, lineHeight: 1, color: "rgba(255,248,240,0.95)", fontVariantNumeric: "tabular-nums" }}>
              {minutes}
            </span>
            <span style={{ display: "block", fontSize: 11, marginTop: 2, color: "rgba(255,200,150,0.40)" }}>min</span>
          </div>
          <button
            onClick={() => setMinutes(m => Math.min(120, m + 1))}
            style={{ width: 52, height: 52, borderRadius: "50%", border: "1.5px solid rgba(255,185,100,0.22)", color: "rgba(255,200,150,0.7)", background: "rgba(255,185,100,0.06)", fontSize: 26, fontWeight: 300, cursor: "pointer" }}
          >+</button>
        </div>

        {/* Preset grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 20 }}>
          {PRESETS.map(p => (
            <button
              key={p}
              onClick={() => setMinutes(p)}
              style={{
                height: 64, borderRadius: 14, cursor: "pointer",
                background: minutes === p ? "rgba(255,185,100,0.16)" : "rgba(255,185,100,0.05)",
                border: `1.5px solid ${minutes === p ? "rgba(255,185,100,0.55)" : "rgba(255,185,100,0.11)"}`,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
              }}
            >
              <span style={{ fontSize: 26, fontWeight: 700, lineHeight: 1, color: minutes === p ? "rgba(255,230,190,0.97)" : "rgba(255,200,150,0.50)" }}>
                {p}
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.10em", color: minutes === p ? "rgba(255,200,150,0.60)" : "rgba(255,185,100,0.30)" }}>
                MIN
              </span>
            </button>
          ))}
        </div>

        {/* Confirm button */}
        <button
          onClick={save}
          disabled={saving}
          style={{
            width: "100%", borderRadius: 14, fontWeight: 900, letterSpacing: "0.15em",
            textTransform: "uppercase", fontSize: 15, padding: "18px 0",
            background: "#22c55e", color: "white", border: "none", cursor: "pointer",
            opacity: saving ? 0.4 : 1,
          }}
        >
          {saving ? "Saving…" : "Set Wait Time"}
        </button>
      </div>
    </div>
  )
}

// ── Guest Edit Modal ────────────────────────────────────────────────────────────

function GuestEditModal({
  entry, displayWait, sidebarW, onClose, onSaved, onRemoved,
}: {
  entry: QueueEntry
  displayWait: number
  sidebarW: number
  onClose: () => void
  onSaved: () => void
  onRemoved: () => void
}) {
  const [minutes,   setMinutes]   = useState(displayWait || entry.quoted_wait || entry.wait_estimate || 15)
  const [partySize, setPartySize] = useState(entry.party_size)
  const [phone,     setPhone]     = useState(entry.phone ?? "")
  const [notes,     setNotes]     = useState(entry.notes ?? "")
  const [saving,    setSaving]    = useState(false)
  const [removing,  setRemoving]  = useState(false)
  const PRESETS = [5, 10, 15, 20, 30, 45]

  const save = async () => {
    setSaving(true)
    try {
      const r = await fetchT(`${API}/queue/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoted_wait: minutes, party_size: partySize, phone: phone.trim() || null, notes: notes.trim() || null }),
      })
      if (!r.ok) throw new Error("server")
    } catch (e: unknown) {
      const isTimeout = e instanceof Error && e.name === "AbortError"
      showToast(isTimeout ? "Request timed out — try again." : "Could not save changes.", "err")
      setSaving(false)
      return   // Don't close modal on error
    }
    setSaving(false)
    onSaved()
    onClose()
  }

  const remove = async () => {
    setRemoving(true)
    try {
      const r = await fetchT(`${API}/queue/${entry.id}/remove`, { method: "POST" })
      if (!r.ok) throw new Error()
    } catch {
      showToast("Could not remove guest.", "err")
      setRemoving(false)
      return   // Don't close modal on error
    }
    addToGuestLog({ id: entry.id, name: entry.name || "Guest", party_size: entry.party_size, source: entry.source || "walk-in", phone: entry.phone, notes: entry.notes, quoted_wait: entry.quoted_wait, actual_wait_min: null, joined_ms: new Date(entry.arrival_time).getTime(), resolved_ms: Date.now(), status: "removed" })
    setRemoving(false)
    onRemoved()
    onClose()
  }

  return (
    <div style={{
      position: "fixed", top: 48, left: 0, bottom: 0,
      width: sidebarW, zIndex: 48,
      background: "#100C09",
      borderTop: "1px solid rgba(251,191,36,0.28)",
      borderRight: "1px solid rgba(255,185,100,0.14)",
      display: "flex", flexDirection: "column",
      overflowY: "hidden",
    }}>
      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px 28px" }}>
        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] font-black tracking-[0.22em] uppercase" style={{ color: "rgba(255,200,150,0.40)" }}>Edit Guest</p>
            <p className="text-lg font-semibold leading-tight" style={{ color: "rgba(255,248,240,0.95)" }}>{entry.name || "Guest"}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl transition-all active:scale-95 hover:brightness-125" style={{ color: "rgba(255,200,150,0.50)", border: "1px solid rgba(255,185,100,0.20)", background: "rgba(255,185,100,0.06)" }}>
            <X className="w-4 h-4" />
          </button>
        </div>


          {/* ── Set estimate ── */}
          <p className="text-[10px] font-bold tracking-[0.16em] uppercase mb-3" style={{ color: "rgba(255,200,150,0.45)" }}>Set Wait Time</p>
          <div className="flex items-center justify-between mb-4 px-2">
            <button onClick={() => setMinutes(m => Math.max(1, m - 1))} className="w-14 h-14 rounded-full flex items-center justify-center text-2xl font-light transition-all active:scale-95 hover:brightness-125" style={{ border: "1.5px solid rgba(255,185,100,0.22)", color: "rgba(255,200,150,0.7)", background: "rgba(255,185,100,0.06)" }}>−</button>
            <div className="text-center">
              <span className="text-6xl font-extralight tabular-nums leading-none" style={{ color: "rgba(255,248,240,0.95)" }}>{minutes}</span>
              <span className="text-sm ml-2" style={{ color: "rgba(255,200,150,0.40)" }}>min</span>
            </div>
            <button onClick={() => setMinutes(m => Math.min(120, m + 1))} className="w-14 h-14 rounded-full flex items-center justify-center text-2xl font-light transition-all active:scale-95 hover:brightness-125" style={{ border: "1.5px solid rgba(255,185,100,0.22)", color: "rgba(255,200,150,0.7)", background: "rgba(255,185,100,0.06)" }}>+</button>
          </div>
          {/* Presets */}
          <div className="grid grid-cols-6 gap-2 mb-5">
            {PRESETS.map(p => (
              <button key={p} onClick={() => setMinutes(p)} className="flex flex-col items-center justify-center rounded-xl transition-all active:scale-95" style={{ height: 52, background: minutes === p ? "rgba(255,185,100,0.16)" : "rgba(255,185,100,0.05)", border: `1px solid ${minutes === p ? "rgba(255,185,100,0.50)" : "rgba(255,185,100,0.10)"}` }}>
                <span style={{ fontSize: 17, fontWeight: 700, lineHeight: 1, color: minutes === p ? "rgba(255,230,190,0.97)" : "rgba(255,200,150,0.50)" }}>{p}</span>
                <span style={{ fontSize: 9, letterSpacing: "0.05em", color: minutes === p ? "rgba(255,200,150,0.55)" : "rgba(255,185,100,0.28)", marginTop: 2 }}>min</span>
              </button>
            ))}
          </div>

          {/* ── Party size ── */}
          <p className="text-[10px] font-bold tracking-[0.16em] uppercase mb-2" style={{ color: "rgba(255,200,150,0.45)" }}>Party Size</p>
          <div className="flex items-center rounded-xl mb-4" style={{ background: "rgba(255,185,100,0.06)", border: "1.5px solid rgba(255,185,100,0.14)", padding: "0 12px", height: 56 }}>
            <button onClick={() => setPartySize(p => Math.max(1, p - 1))} className="w-10 h-10 flex items-center justify-center rounded-lg text-2xl transition-all active:scale-95" style={{ color: "rgba(255,200,150,0.7)" }}>−</button>
            <span className="flex-1 text-center text-2xl font-light tabular-nums" style={{ color: "rgba(255,248,240,0.95)" }}>{partySize}</span>
            <button onClick={() => setPartySize(p => Math.min(20, p + 1))} className="w-10 h-10 flex items-center justify-center rounded-lg text-2xl transition-all active:scale-95" style={{ color: "rgba(255,200,150,0.7)" }}>+</button>
          </div>

          {/* ── Phone ── */}
          <p className="text-[10px] font-bold tracking-[0.16em] uppercase mb-2" style={{ color: "rgba(255,200,150,0.45)" }}>Phone <span style={{ color: "rgba(255,200,150,0.25)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>optional</span></p>
          <input
            type="tel" value={phone} onChange={e => setPhone(formatPhone(e.target.value))}
            placeholder="(555) 000-0000"
            className="w-full rounded-xl outline-none mb-4"
            style={{ background: "rgba(255,185,100,0.06)", border: "1.5px solid rgba(255,185,100,0.14)", color: "rgba(255,248,240,0.92)", fontSize: 15, padding: "15px 14px", height: 56 }}
          />

          {/* ── Notes ── */}
          <p className="text-[10px] font-bold tracking-[0.16em] uppercase mb-2" style={{ color: "rgba(255,200,150,0.45)" }}>Notes <span style={{ color: "rgba(255,200,150,0.25)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>optional</span></p>
          <input
            type="text" value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Allergies, preferences, special occasion…"
            className="w-full rounded-xl outline-none mb-5"
            style={{ background: "rgba(255,185,100,0.06)", border: "1.5px solid rgba(255,185,100,0.14)", color: "rgba(255,248,240,0.92)", fontSize: 15, padding: "15px 14px", height: 56 }}
          />

          {/* ── Save ── */}
          <button onClick={save} disabled={saving} className="w-full rounded-xl font-black tracking-[0.15em] uppercase transition-all active:scale-[0.98] disabled:opacity-40" style={{ background: "#22c55e", color: "white", fontSize: 15, padding: "18px 0" }}>
            {saving ? "Saving…" : "Save Changes"}
          </button>

          {/* ── Remove ── */}
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(239,68,68,0.10)" }}>
            <button
              onClick={remove}
              disabled={removing}
              className="w-full rounded-xl font-bold tracking-[0.08em] uppercase transition-all active:scale-[0.98] disabled:opacity-40"
              style={{ background: "rgba(239,68,68,0.07)", color: "rgba(239,68,68,0.70)", border: "1px solid rgba(239,68,68,0.18)", fontSize: 14, padding: "18px 0" }}
            >
              {removing ? "Removing…" : "Remove from Waitlist"}
            </button>
          </div>
      </div>
    </div>
  )
}

// ── Draggable Queue Card ───────────────────────────────────────────────────────

function DraggableQueueCard({
  entry, onSeat, onNotify, isSelected, onSelect, onEdit, onRemoved,
}: {
  entry: QueueEntry
  onSeat: () => void
  onNotify: () => void
  isSelected?: boolean
  onSelect?: () => void
  onEdit?: (displayWait: number) => void
  onRemoved?: () => void
}) {
  const isReady = entry.status === "ready"
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [removing,      setRemoving]      = useState(false)
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: entry.id,
    data: { entry },
  })

  const handleRemove = async () => {
    setRemoving(true)
    onRemoved?.()  // optimistic: remove from UI immediately
    try { await fetch(`${API}/queue/${entry.id}/remove`, { method: "POST" }) } catch {}
    setRemoving(false)
  }

  // Per-card live countdown.
  // remaining_wait = server-computed "minutes truly left" (quoted_wait minus elapsed time since
  // updated_at). Falls back to wait_estimate when no quoted_wait has been set.
  const [displayWait, setDisplayWait] = useState(entry.remaining_wait ?? entry.wait_estimate ?? 0)
  const quotedTotal = entry.quoted_wait ?? entry.wait_estimate ?? 0
  useEffect(() => {
    setDisplayWait(entry.remaining_wait ?? entry.wait_estimate ?? 0)
  }, [entry.remaining_wait, entry.wait_estimate])
  useEffect(() => {
    const target = entry.remaining_wait ?? entry.wait_estimate
    if (!target || entry.paused) return
    const t = setInterval(() => setDisplayWait(p => Math.max(0, p - 1)), 60_000)
    return () => clearInterval(t)
  }, [entry.remaining_wait, entry.wait_estimate, entry.paused])

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => { if (!isDragging) onSelect?.() }}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.35 : 1,
        touchAction: "none",
        background: isSelected ? "rgba(255,220,100,0.09)" : isReady ? "rgba(34,197,94,0.10)" : "rgba(255,185,100,0.06)",
        border: `1px solid ${isSelected ? "rgba(255,220,100,0.55)" : isReady ? "rgba(34,197,94,0.30)" : "rgba(255,185,100,0.16)"}`,
        boxShadow: isSelected ? "0 0 0 2px rgba(255,220,100,0.18), inset 0 0 10px rgba(255,220,100,0.05)" : undefined,
        borderRadius: 12,
        cursor: isDragging ? "grabbing" : "grab",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "10px 12px",
      }}
    >
      {/* ── Row 1: grip + position + name ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <GripVertical className="w-3.5 h-3.5 shrink-0" style={{ color: "rgba(255,200,150,0.45)" }} />
        <div className="w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold shrink-0 tabular-nums" style={{ background: isReady ? "rgba(34,197,94,0.20)" : "rgba(255,185,100,0.12)", color: isReady ? "#22c55e" : "rgba(255,220,180,0.75)" }}>
          {entry.position ?? "—"}
        </div>
        <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 5 }}>
          <span style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.3, color: isReady ? "#86efac" : "rgba(255,248,240,0.97)", wordBreak: "break-word" }}>
            {entry.name || "Guest"}
          </span>
          {isReady && (
            <span className="text-[8px] font-black tracking-[0.14em] px-1 py-0.5 rounded animate-pulse shrink-0" style={{ background: "rgba(34,197,94,0.12)", color: "#4ade80" }}>READY</span>
          )}
        </div>
      </div>

      {/* ── Row 2: meta info ── */}
      <div style={{ paddingLeft: 38, display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "rgba(255,200,150,0.65)" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
          <Users className="w-2.5 h-2.5" />{entry.party_size}p
        </span>
        <span style={{ color: "rgba(255,185,100,0.35)" }}>·</span>
        <span className="animate-pulse" style={{ display: "flex", alignItems: "center", gap: 3 }} title="Time since arrival">
          <Clock className="w-2.5 h-2.5" />{timeWaiting(entry.arrival_time)}
        </span>
        {(entry.quoted_wait != null || entry.wait_estimate != null) && !isReady && (
          <>
            <span style={{ color: "rgba(255,185,100,0.35)" }}>·</span>
            <span style={{ fontWeight: 700, color: displayWait <= 0 ? "#22c55e" : displayWait <= 5 ? "#f97316" : "rgba(251,191,36,0.90)", letterSpacing: "0.01em" }}>
              {displayWait <= 0 ? "ready" : `~${displayWait}m left`}
            </span>
          </>
        )}
      </div>
      {/* ── Row 2b: notes preview ── */}
      {entry.notes && (
        <div style={{ paddingLeft: 38, fontSize: 11, color: "rgba(255,200,150,0.50)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {entry.notes}
        </div>
      )}


      {/* ── Row 3: action buttons or delete confirm ── */}
      {confirmDelete ? (
        <div onPointerDown={e => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 4 }}>
          <span style={{ fontSize: 11, color: "rgba(239,68,68,0.80)", textAlign: "center" }}>
            Remove {entry.name || "guest"}?
          </span>
          <div style={{ display: "flex", gap: 5, width: "100%" }}>
            <button onClick={e => { e.stopPropagation(); setConfirmDelete(false) }}
              className="h-11 rounded-xl text-xs font-semibold transition-all active:scale-95"
              style={{ flex: 1, minWidth: 0, background: "rgba(255,185,100,0.08)", color: "rgba(255,200,150,0.60)", border: "1px solid rgba(255,185,100,0.15)" }}>
              Cancel
            </button>
            <button onClick={e => { e.stopPropagation(); handleRemove() }} disabled={removing}
              className="h-11 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-50"
              style={{ flex: 1, minWidth: 0, background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.30)" }}>
              {removing ? "…" : "Remove"}
            </button>
          </div>
        </div>
      ) : (
        /* Full-width action row — buttons stretch to fill the card */
        <div onPointerDown={e => e.stopPropagation()} style={{ display: "flex", gap: 5, marginTop: 4 }}>
          {/* Seat — primary, gets most space */}
          <button onClick={e => { e.stopPropagation(); onSeat() }}
            className="flex items-center justify-center gap-1.5 rounded-xl transition-all active:scale-95 font-bold"
            style={{ flex: 2, height: 44, fontSize: 13, letterSpacing: "0.04em", background: "rgba(34,197,94,0.14)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.32)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)" }}>
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            Seat
          </button>
          {/* Notify (only when not yet ready) */}
          {!isReady ? (
            <button onClick={e => { e.stopPropagation(); onNotify() }}
              className="flex items-center justify-center gap-1.5 rounded-xl transition-all active:scale-95 font-semibold"
              style={{ flex: 1, height: 44, fontSize: 12, background: "rgba(249,115,22,0.10)", color: "#f97316", border: "1px solid rgba(249,115,22,0.28)" }}>
              <BellRing className="w-3.5 h-3.5 shrink-0" />
              <span style={{ letterSpacing: "0.02em" }}>Notify</span>
            </button>
          ) : null}
          {/* Edit */}
          <button onClick={e => { e.stopPropagation(); onEdit?.(displayWait) }}
            className="flex items-center justify-center gap-1.5 rounded-xl transition-all active:scale-95 font-semibold"
            style={{ flex: 1, height: 44, fontSize: 12, background: "rgba(251,191,36,0.09)", color: "rgba(251,191,36,0.80)", border: "1px solid rgba(251,191,36,0.22)" }}>
            <Pencil className="w-3.5 h-3.5 shrink-0" />
            <span style={{ letterSpacing: "0.02em" }}>Edit</span>
          </button>
          {/* Remove */}
          <button onClick={e => { e.stopPropagation(); setConfirmDelete(true) }}
            className="flex items-center justify-center rounded-xl transition-all active:scale-95"
            style={{ width: 44, height: 44, flexShrink: 0, background: "rgba(239,68,68,0.07)", color: "rgba(239,68,68,0.55)", border: "1px solid rgba(239,68,68,0.18)" }}>
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}

// ── Drag ghost (DragOverlay) ───────────────────────────────────────────────────

function DragGhost({ entry }: { entry: QueueEntry }) {
  return (
    <div
      style={{
        background: "rgba(10,6,3,0.96)",
        border: "1px solid rgba(255,185,100,0.22)",
        borderRadius: 10,
        padding: "9px 13px",
        boxShadow: "0 12px 40px rgba(0,0,0,0.7)",
        cursor: "grabbing",
        minWidth: 130,
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 13, color: "rgba(255,248,240,0.92)" }}>
        {entry.name || "Guest"}
      </div>
      <div style={{ fontSize: 11, color: "rgba(255,200,150,0.4)", marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}>
        <Users style={{ width: 10, height: 10 }} />
        {entry.party_size} guests
      </div>
    </div>
  )
}

// ── Droppable floor table ──────────────────────────────────────────────────────

function DroppableFloorTable({
  pos, table, occupant, onClear, isDraggingOccupant, isSelectMode, onSeatFromSelect, reservation, now,
}: {
  pos: FloorPos
  table?: Table
  occupant?: LocalOccupant
  onClear?: () => void
  isDraggingOccupant?: boolean
  isSelectMode?: boolean
  onSeatFromSelect?: () => void
  reservation?: ReservedTable   // pre-assigned to upcoming reservation → yellow
  now?: Date
}) {
  const isOccupied       = !!occupant || (!!table && table.status !== "available")
  const hasLocalOccupant = !!occupant
  const noTable          = !table
  const avail            = !isOccupied

  // Time-based reservation states
  const resMinutes    = (reservation && !isOccupied && now) ? getResMinutesUntil(reservation.time, now) : undefined
  const isResLocked   = resMinutes !== undefined && resMinutes <= 0          // at/past reservation time → hard lock
  const isResWarning  = resMinutes !== undefined && resMinutes > 0 && resMinutes <= 60 // within 1 hr → warn
  const hasReservation = !!reservation && !isOccupied && resMinutes !== undefined && resMinutes > 0

  // Locked tables block all drops; warning/far-future reserved tables allow walk-ins
  const canReceiveDrop = isResLocked ? false : (isDraggingOccupant ? !hasLocalOccupant : !isOccupied)
  // Locked tables cannot be select-mode targets
  const isSelectTargetBase = !!isSelectMode && !isOccupied && !isResLocked

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `table-${pos.number}`,
    disabled: !canReceiveDrop,
  })

  const {
    setNodeRef: setDragRef,
    listeners: dragListeners,
    attributes: dragAttrs,
    isDragging,
  } = useDraggable({
    id: `occupant-${pos.number}`,
    data: { type: "occupant", tableNumber: pos.number, occupant },
    disabled: !hasLocalOccupant,
  })

  const setNodeRef = useCallback((el: HTMLElement | null) => {
    setDropRef(el)
    setDragRef(el)
  }, [setDropRef, setDragRef])

  const isSelectTarget = isSelectTargetBase

  const bg = isOver && canReceiveDrop
    ? "rgba(34,197,94,0.55)"
    : isResLocked
    ? "rgba(239,68,68,0.18)"
    : isResWarning
    ? "rgba(249,115,22,0.15)"
    : hasReservation
    ? "rgba(251,191,36,0.16)"
    : isSelectTarget
    ? "rgba(34,197,94,0.38)"
    : isOccupied ? "rgba(239,68,68,0.28)"
    : noTable ? "rgba(255,255,255,0.07)"
    : "rgba(34,197,94,0.22)"

  const borderColor = isOver && canReceiveDrop
    ? "#22c55e"
    : isResLocked
    ? "rgba(239,68,68,0.90)"
    : isResWarning
    ? "rgba(249,115,22,0.85)"
    : hasReservation
    ? "rgba(251,191,36,0.75)"
    : isSelectTarget
    ? "#4ade80"
    : isOccupied ? "rgba(239,68,68,0.90)"
    : noTable ? "rgba(255,255,255,0.32)"
    : "rgba(34,197,94,0.82)"

  const borderRadius = pos.shape === "round" ? "50%" : pos.shape === "square" ? 11 : 10

  return (
    <div
      ref={setNodeRef}
      {...(hasLocalOccupant ? dragListeners : {})}
      {...(hasLocalOccupant ? dragAttrs : {})}
      style={{
        position: "absolute",
        left: `${(pos.x / CANVAS_W * 100).toFixed(3)}%`,
        top: `${(pos.y / CANVAS_H * 100).toFixed(3)}%`,
        width: `${(pos.w / CANVAS_W * 100).toFixed(3)}%`,
        height: `${(pos.h / CANVAS_H * 100).toFixed(3)}%`,
        borderRadius,
        clipPath: pos.shape === "round" ? "circle(50%)" : undefined,
        background: bg,
        border: `1.5px solid ${borderColor}`,
        boxShadow: isOver && canReceiveDrop
          ? "0 0 0 4px rgba(34,197,94,0.35), inset 0 0 20px rgba(34,197,94,0.10)"
          : isResLocked  ? "0 0 0 2px rgba(239,68,68,0.30), inset 0 0 14px rgba(239,68,68,0.12)"
          : isResWarning ? "0 0 0 2px rgba(249,115,22,0.25), inset 0 0 12px rgba(249,115,22,0.08)"
          : hasReservation ? "0 0 0 2px rgba(251,191,36,0.20), inset 0 0 12px rgba(251,191,36,0.06)"
          : isOccupied ? "0 0 0 2px rgba(239,68,68,0.18), inset 0 0 12px rgba(239,68,68,0.08)"
          : avail ? "0 0 0 2px rgba(34,197,94,0.18), inset 0 0 12px rgba(34,197,94,0.06)"
          : "none",
        transition: "border-color 0.12s ease, box-shadow 0.12s ease, background 0.12s ease",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        overflow: "hidden",
        cursor: hasLocalOccupant ? "grab" : isSelectTarget ? "pointer" : isOccupied && onClear ? "pointer" : canReceiveDrop ? "copy" : "default",
        opacity: isDragging ? 0.4 : 1,
      }}
      onClick={
        isSelectTarget && onSeatFromSelect
          ? onSeatFromSelect
          : isOccupied && onClear && !hasLocalOccupant
          ? onClear
          : undefined
      }
    >
      {isOccupied && onClear ? (
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onClear() }}
          style={{
            position: "absolute",
            top: pos.shape === "round" ? "18%" : 4,
            right: pos.shape === "round" ? "18%" : 4,
            width: 16, height: 16,
            borderRadius: "50%",
            background: "rgba(239,68,68,0.75)",
            border: "none",
            cursor: "pointer",
            color: "rgba(255,255,255,0.95)",
            fontSize: 11,
            fontWeight: 900,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: 1,
            padding: 0,
          }}
          title="Clear table"
        >
          ×
        </button>
      ) : (
        <div style={{
          position: "absolute",
          top: pos.shape === "round" ? "18%" : 7,
          right: pos.shape === "round" ? "18%" : 7,
          width: 6, height: 6,
          borderRadius: "50%",
          background: isResLocked ? "rgba(239,68,68,0.90)" : isResWarning ? "rgba(249,115,22,0.85)" : hasReservation ? "rgba(251,191,36,0.80)" : noTable ? "rgba(255,255,255,0.28)" : "#22c55e",
          opacity: 0.85,
        }} />
      )}

      {isOver && canReceiveDrop ? (
        <span style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.12em",
          color: "rgba(34,197,94,0.9)",
        }}>
          DROP
        </span>
      ) : isResLocked ? (
        <>
          <span style={{ fontSize: 7, fontWeight: 900, letterSpacing: "0.12em", color: "rgba(239,68,68,0.85)", textTransform: "uppercase" }}>
            LOCKED
          </span>
          <span style={{
            fontSize: pos.shape === "rect" ? 10 : 8,
            fontWeight: 700,
            color: "rgba(255,180,180,0.97)",
            textAlign: "center",
            lineHeight: 1.2,
            paddingInline: 3,
            overflow: "hidden",
          }}>
            {reservation!.guestName.split(" ")[0]}
          </span>
          <span style={{ fontSize: 7, color: "rgba(239,68,68,0.80)" }}>
            {fmt12Res(reservation!.time)}
          </span>
        </>
      ) : isResWarning ? (
        <>
          <span style={{ fontSize: 7, fontWeight: 800, letterSpacing: "0.08em", color: "rgba(249,115,22,0.75)", textTransform: "uppercase" }}>
            ⚠ Soon
          </span>
          <span style={{
            fontSize: pos.shape === "rect" ? 10 : 8,
            fontWeight: 700,
            color: "rgba(255,220,160,0.97)",
            textAlign: "center",
            lineHeight: 1.2,
            paddingInline: 3,
            overflow: "hidden",
          }}>
            {reservation!.guestName.split(" ")[0]}
          </span>
          <span style={{ fontSize: 7, color: "rgba(249,115,22,0.80)" }}>
            {fmt12Res(reservation!.time)}
          </span>
        </>
      ) : hasReservation ? (
        <>
          <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: "0.12em", color: "rgba(251,191,36,0.60)", textTransform: "uppercase" }}>
            Rsvd
          </span>
          <span style={{
            fontSize: pos.shape === "rect" ? 11 : 9,
            fontWeight: 700,
            color: "rgba(255,228,150,0.97)",
            textAlign: "center",
            lineHeight: 1.2,
            paddingInline: 3,
            overflow: "hidden",
          }}>
            {reservation!.guestName.split(" ")[0]}
          </span>
          <span style={{ fontSize: 8, color: "rgba(251,191,36,0.75)" }}>
            {fmt12Res(reservation!.time)}
          </span>
        </>
      ) : occupant ? (
        <>
          <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,200,150,0.75)", letterSpacing: "0.1em" }}>
            T{pos.number}
          </span>
          <span style={{
            fontSize: pos.shape === "rect" ? 11 : 10,
            fontWeight: 700,
            color: "rgba(255,240,220,0.97)",
            textAlign: "center",
            lineHeight: 1.2,
            paddingInline: 4,
          }}>
            {occupant.name}
          </span>
          <span style={{ fontSize: 9, color: "rgba(255,200,150,0.70)" }}>
            {occupant.party_size}p
          </span>
        </>
      ) : table && table.status !== "available" ? (
        <>
          <span style={{ fontSize: pos.shape === "rect" ? 16 : 14, fontWeight: 800, color: "rgba(239,68,68,0.95)" }}>
            {pos.number}
          </span>
          <span style={{ fontSize: 9, color: "rgba(239,68,68,0.72)" }}>{table.capacity}p</span>
        </>
      ) : (
        <>
          <span style={{
            fontSize: pos.shape === "rect" ? 17 : 14,
            fontWeight: 800,
            color: table ? "#22c55e" : "rgba(255,200,150,0.55)",
          }}>
            {pos.number}
          </span>
          {table && (
            <span style={{ fontSize: 10, color: "rgba(34,197,94,0.90)" }}>
              {table.capacity}p
            </span>
          )}
        </>
      )}
    </div>
  )
}

// ── Floor map ──────────────────────────────────────────────────────────────────

function FloorMap({
  tables, localOccupants, onClear, isDraggingOccupant, selectedEntry, onSeatFromSelect, reservedTables, now,
}: {
  tables: Table[]
  localOccupants: Map<number, LocalOccupant>
  onClear: (tableId: string | undefined, tableNumber: number) => void
  isDraggingOccupant: boolean
  selectedEntry?: QueueEntry | null
  onSeatFromSelect?: (tableNumber: number, tableId: string | undefined) => void
  reservedTables?: Map<number, ReservedTable>
  now?: Date
}) {
  const tableByNumber = new Map(tables.map(t => [t.table_number, t]))

  return (
    <div
      className="flex-1 relative overflow-hidden"
      style={{ background: "#0a0704" }}
    >
      <span style={{
        position: "absolute",
        top: 14,
        left: 18,
        fontSize: 9,
        fontWeight: 800,
        letterSpacing: "0.2em",
        color: "rgba(255,200,150,0.45)",
        textTransform: "uppercase",
        zIndex: 1,
        pointerEvents: "none",
      }}>
        Floor Plan
      </span>

      <div style={{
        position: "absolute",
        inset: "30px 16px 40px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <div style={{
          position: "relative",
          width: "100%",
          aspectRatio: `${CANVAS_W} / ${CANVAS_H}`,
          maxHeight: "100%",
        }}>
          {/* Bar section background */}
          <div style={{
            position: "absolute",
            left: `${(726 / CANVAS_W * 100).toFixed(2)}%`,
            top: 0,
            right: 0,
            bottom: 0,
            background: "rgba(255,185,100,0.03)",
            borderLeft: "1px solid rgba(255,185,100,0.16)",
            borderRadius: "0 8px 8px 0",
          }} />

          {/* Section labels */}
          <span style={{
            position: "absolute",
            left: `${(760 / CANVAS_W * 100).toFixed(2)}%`,
            top: `${(10 / CANVAS_H * 100).toFixed(2)}%`,
            fontSize: 8,
            fontWeight: 800,
            letterSpacing: "0.22em",
            color: "rgba(255,200,150,0.55)",
            textTransform: "uppercase",
            pointerEvents: "none",
          }}>
            BAR
          </span>
          <span style={{
            position: "absolute",
            left: `${(30 / CANVAS_W * 100).toFixed(2)}%`,
            bottom: `${(12 / CANVAS_H * 100).toFixed(2)}%`,
            fontSize: 8,
            fontWeight: 800,
            letterSpacing: "0.2em",
            color: "rgba(255,200,150,0.45)",
            textTransform: "uppercase",
            pointerEvents: "none",
          }}>
            Main Dining
          </span>

          {/* "Powered by HOST" */}
          <span style={{
            position: "absolute",
            right: `${(8 / CANVAS_W * 100).toFixed(2)}%`,
            bottom: `${(8 / CANVAS_H * 100).toFixed(2)}%`,
            fontSize: 8,
            letterSpacing: "0.08em",
            color: "rgba(255,185,100,0.35)",
            pointerEvents: "none",
          }}>
            Powered by <strong>HOST</strong>
          </span>

          {/* Tables */}
          {FLOOR_PLAN.map(pos => {
            const table = tableByNumber.get(pos.number)
            const occupant = localOccupants.get(pos.number)
            return (
              <DroppableFloorTable
                key={pos.number}
                pos={pos}
                table={table}
                occupant={occupant}
                reservation={reservedTables?.get(pos.number)}
                onClear={() => onClear(table?.id, pos.number)}
                isDraggingOccupant={isDraggingOccupant}
                isSelectMode={!!selectedEntry}
                onSeatFromSelect={selectedEntry ? () => onSeatFromSelect?.(pos.number, table?.id) : undefined}
                now={now}
              />
            )
          })}
        </div>
      </div>

      {/* Hint text */}
      <div style={{
        position: "absolute",
        bottom: 14,
        left: "50%",
        transform: "translateX(-50%)",
        fontSize: 10,
        color: "rgba(255,200,150,0.45)",
        letterSpacing: "0.1em",
        whiteSpace: "nowrap",
        pointerEvents: "none",
      }}>
        Tap a guest to select · tap a table to seat · or drag directly
      </div>
    </div>
  )
}

// ── Seat Table Picker ──────────────────────────────────────────────────────────

function SeatTablePicker({
  guest, tables, localOccupants, onConfirm, onClose,
  reservedTables, excludeResId, mode = "seat", now,
}: {
  guest: { name: string | null; party_size: number }
  tables: Table[]
  localOccupants: Map<number, LocalOccupant>
  onConfirm: (tableNumber: number, tableId: string | undefined) => void
  onClose: () => void
  reservedTables?: Map<number, ReservedTable>
  excludeResId?: string   // allow re-selecting the table already held by this reservation
  mode?: "seat" | "reserve"
  now?: Date
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
      <div
        className="relative w-full sm:w-[420px] rounded-t-3xl sm:rounded-2xl p-6"
        style={{ background: "#100C09", border: "1px solid rgba(255,185,100,0.09)", zIndex: 1 }}
      >
        <div className="sm:hidden w-8 h-[3px] rounded-full mx-auto mb-5" style={{ background: "rgba(255,185,100,0.12)" }} />

        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-black tracking-[0.2em] uppercase" style={{ color: "rgba(255,240,220,0.88)" }}>
            {mode === "reserve" ? "Reserve Table" : "Seat Guest"}
          </span>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ color: "rgba(255,200,150,0.25)" }}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs mb-6" style={{ color: "rgba(255,200,150,0.3)" }}>
          {guest.name || "Guest"} · {guest.party_size}p —{" "}
          {mode === "reserve" ? "choose a table to hold" : "choose a table"}
        </p>

        <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto">
          {FLOOR_PLAN.map(pos => {
            const t = tables.find(t => t.table_number === pos.number)
            // Occupied: either in-memory occupant map or DB status
            const isOccupied = localOccupants.has(pos.number) || t?.status === "occupied"

            // Reservation logic
            const resInfo = reservedTables?.get(pos.number)
            const hasOtherRes = !!(resInfo && resInfo.resId !== excludeResId)
            let isResLocked = false
            let isResWarn   = false
            if (hasOtherRes) {
              if (mode === "seat" && now) {
                const mins = getResMinutesUntil(resInfo!.time, now)
                if (mins <= 0) isResLocked = true
                else if (mins <= 60) isResWarn = true
                else isResLocked = true  // far future — block
              } else {
                isResLocked = true
              }
            }

            const isBlocked  = isOccupied || isResLocked

            // Colour scheme
            const bg     = isOccupied   ? "rgba(239,68,68,0.10)"
                         : isResWarn    ? "rgba(249,115,22,0.10)"
                         : "rgba(34,197,94,0.07)"
            const border = isOccupied   ? "rgba(239,68,68,0.45)"
                         : isResWarn    ? "rgba(249,115,22,0.40)"
                         : "rgba(34,197,94,0.25)"
            const color  = isOccupied   ? "rgba(239,68,68,0.9)"
                         : isResWarn    ? "rgba(249,115,22,0.9)"
                         : "rgba(34,197,94,0.9)"
            const subColor = isOccupied ? "rgba(239,68,68,0.5)"
                           : isResWarn  ? "rgba(249,115,22,0.35)"
                           : "rgba(34,197,94,0.3)"

            return (
              <button
                key={pos.number}
                disabled={isBlocked}
                onClick={() => !isBlocked && onConfirm(pos.number, t?.id)}
                className="flex flex-col items-center justify-center gap-0.5 py-3 rounded-xl transition-all active:scale-95"
                style={{
                  background: bg,
                  border: `1px solid ${border}`,
                  opacity: isResLocked && !isOccupied ? 0.45 : 1,
                  cursor: isBlocked ? "default" : "pointer",
                }}
              >
                <span className="text-xl font-bold" style={{ color }}>
                  {pos.number}
                </span>
                {isOccupied ? (
                  <span className="text-[9px] font-bold" style={{ color: subColor }}>occupied</span>
                ) : isResWarn ? (
                  <span className="text-[9px] font-bold text-center leading-tight" style={{ color: subColor }}>
                    ⚠ {fmt12Res(resInfo!.time)}
                  </span>
                ) : isResLocked ? (
                  <span className="text-[9px] font-bold" style={{ color: subColor }}>reserved</span>
                ) : t ? (
                  <span className="text-[10px]" style={{ color: subColor }}>{t.capacity}p</span>
                ) : null}
                <span className="text-[9px] tracking-wider uppercase mt-0.5" style={{ color: subColor }}>
                  {pos.section}
                </span>
              </button>
            )
          })}
        </div>

        <button
          onClick={onClose}
          className="w-full mt-5 py-3 rounded-xl text-xs font-bold tracking-[0.1em] uppercase"
          style={{ background: "rgba(255,185,100,0.05)", color: "rgba(255,200,150,0.35)", border: "1px solid rgba(255,185,100,0.07)" }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Add Guest Drawer ───────────────────────────────────────────────────────────
// Renders as a panel covering only the sidebar — floor map stays fully interactive.

function AddGuestDrawer({
  onClose, onAdded, sidebarW,
}: {
  onClose: () => void
  onAdded: (entryId: string) => void
  sidebarW: number
}) {
  const [name,      setName]      = useState("")
  const [partySize, setPartySize] = useState(2)
  const [phone,     setPhone]     = useState("")
  const [notes,     setNotes]     = useState("")
  const [waitMins,  setWaitMins]  = useState<number | null>(null)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState("")
  const PRESETS = [5, 10, 15, 20, 30, 45]

  const [bottomOffset, setBottomOffset] = useState(0)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      setBottomOffset(offset)
    }
    vv.addEventListener("resize", update)
    vv.addEventListener("scroll", update)
    return () => { vv.removeEventListener("resize", update); vv.removeEventListener("scroll", update) }
  }, [])

  // Recompute suggestion when party size changes; pre-select it if nothing chosen yet
  const suggestion = suggestWait(partySize)
  const needed     = samplesNeeded()
  useEffect(() => {
    if (suggestion !== null) setWaitMins(suggestion)
    else setWaitMins(null)
  }, [partySize, suggestion])

  const submit = async () => {
    setLoading(true); setError("")
    try {
      const r = await fetch(`${API}/queue/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:          name.trim() || null,
          party_size:    partySize,
          phone:         phone.trim() || null,
          notes:         notes.trim() || null,
          preference:    "asap",
          source:        "host",
          restaurant_id: DEMO_RESTAURANT_ID,
        }),
      })
      if (!r.ok) throw new Error()
      const data = await r.json()
      const entryId = data.entry?.id ?? ""
      // Apply wait immediately if one was selected
      if (waitMins && entryId) {
        await fetchT(`${API}/queue/${entryId}/wait?minutes=${waitMins}`, { method: "PATCH" }).catch(() => {})
        showToast(`${name.trim() || "Guest"} added · ${waitMins}m wait set`, "ok")
      } else {
        showToast(`${name.trim() || "Guest"} added to queue`, "ok")
      }
      onAdded(entryId)
    } catch {
      setError("Could not add guest — try again.")
      setLoading(false)
    }
  }

  return (
    /* Panel covers the sidebar only — floor map stays live behind it */
    <div
      style={{
        position: "fixed",
        top: 48,        // below header
        left: 0,
        bottom: bottomOffset,
        width: sidebarW,
        zIndex: 45,
        background: "#0C0907",
        borderTop: "1px solid rgba(255,185,100,0.22)",
        borderRight: "1px solid rgba(255,185,100,0.18)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px 10px", borderBottom: "1px solid rgba(255,185,100,0.12)", flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,240,220,0.88)" }}>
          Add Guest
        </span>
        <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "1px solid rgba(255,185,100,0.14)", cursor: "pointer", color: "rgba(255,200,150,0.45)" }}>
          <X style={{ width: 14, height: 14 }} />
        </button>
      </div>

      {/* ── Scrollable form body ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px 0" }}>

        {/* Party Size */}
        <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,200,150,0.45)", marginBottom: 8 }}>Party Size</p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, padding: "0 4px" }}>
          <button onClick={() => setPartySize(p => Math.max(1, p - 1))}
            style={{ width: 44, height: 44, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 300, background: "rgba(255,185,100,0.06)", border: "1.5px solid rgba(255,185,100,0.20)", color: "rgba(255,200,150,0.7)", cursor: "pointer" }}>−</button>
          <span style={{ fontSize: 62, fontWeight: 200, color: "rgba(255,248,240,0.95)", letterSpacing: "-0.02em", lineHeight: 1, minWidth: 60, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
            {partySize}
          </span>
          <button onClick={() => setPartySize(p => Math.min(20, p + 1))}
            style={{ width: 44, height: 44, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 300, background: "rgba(255,185,100,0.06)", border: "1.5px solid rgba(255,185,100,0.20)", color: "rgba(255,200,150,0.7)", cursor: "pointer" }}>+</button>
        </div>

        {/* Name */}
        <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,200,150,0.45)", marginBottom: 6 }}>Name</p>
        <input
          type="text" value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && submit()} placeholder="Guest name" autoFocus
          style={{ width: "100%", background: "rgba(255,185,100,0.06)", border: "1.5px solid rgba(255,185,100,0.14)", borderRadius: 12, color: "rgba(255,248,240,0.92)", fontSize: 15, padding: "11px 13px", marginBottom: 12, outline: "none", boxSizing: "border-box" }}
        />

        {/* Phone */}
        <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,200,150,0.45)", marginBottom: 6 }}>
          Phone <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "rgba(255,200,150,0.28)" }}>— opt.</span>
        </p>
        <input
          type="tel" value={phone} onChange={e => setPhone(formatPhone(e.target.value))}
          onKeyDown={e => e.key === "Enter" && submit()} placeholder="(555) 000-0000"
          style={{ width: "100%", background: "rgba(255,185,100,0.06)", border: "1.5px solid rgba(255,185,100,0.14)", borderRadius: 12, color: "rgba(255,248,240,0.92)", fontSize: 15, padding: "11px 13px", marginBottom: 14, outline: "none", boxSizing: "border-box" }}
        />

        {/* Notes */}
        <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,200,150,0.45)", marginBottom: 6 }}>
          Notes <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "rgba(255,200,150,0.28)" }}>— opt.</span>
        </p>
        <input
          type="text" value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Allergies, preferences, occasion…"
          style={{ width: "100%", background: "rgba(255,185,100,0.06)", border: "1.5px solid rgba(255,185,100,0.14)", borderRadius: 12, color: "rgba(255,248,240,0.92)", fontSize: 15, padding: "11px 13px", marginBottom: 14, outline: "none", boxSizing: "border-box" }}
        />

        {/* ── Quote Wait Time ── */}
        <div style={{ borderTop: "1px solid rgba(255,185,100,0.12)", paddingTop: 12, marginBottom: 4 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,200,150,0.45)", margin: 0 }}>
              Quote Wait
            </p>
            {waitMins !== null && (
              <button
                onClick={() => setWaitMins(null)}
                style={{ fontSize: 9, color: "rgba(255,200,150,0.30)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                skip →
              </button>
            )}
          </div>

          {/* HOST suggestion chip — only shows after enough data */}
          {suggestion !== null && (
            <div style={{ marginBottom: 10 }}>
              <button
                onClick={() => setWaitMins(suggestion)}
                style={{
                  width: "100%", padding: "8px 10px", borderRadius: 10, cursor: "pointer",
                  background: waitMins === suggestion ? "rgba(251,191,36,0.18)" : "rgba(251,191,36,0.07)",
                  border: `1.5px solid ${waitMins === suggestion ? "rgba(251,191,36,0.65)" : "rgba(251,191,36,0.22)"}`,
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  transition: "all 0.12s",
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(251,191,36,0.75)" }}>
                  HOST Suggestion
                </span>
                <span style={{ fontSize: 22, fontWeight: 700, color: waitMins === suggestion ? "rgba(255,240,180,0.97)" : "rgba(255,220,140,0.75)", letterSpacing: "-0.02em" }}>
                  {suggestion}<span style={{ fontSize: 11, fontWeight: 500, marginLeft: 3, color: "rgba(251,191,36,0.55)" }}>min</span>
                </span>
              </button>
            </div>
          )}

          {/* Presets */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 4, marginBottom: 10 }}>
            {PRESETS.map(p => (
              <button key={p} onClick={() => setWaitMins(p)}
                style={{
                  height: 34, borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  background: waitMins === p ? "rgba(255,185,100,0.18)" : "rgba(255,185,100,0.05)",
                  border: `1px solid ${waitMins === p ? "rgba(255,185,100,0.55)" : "rgba(255,185,100,0.12)"}`,
                  cursor: "pointer", transition: "all 0.1s",
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1, color: waitMins === p ? "rgba(255,230,190,0.97)" : "rgba(255,200,150,0.50)" }}>{p}</span>
              </button>
            ))}
          </div>

          {/* Fine-tune stepper */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px" }}>
            <button onClick={() => setWaitMins(m => Math.max(1, (m ?? 15) - 1))}
              style={{ width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,185,100,0.06)", border: "1px solid rgba(255,185,100,0.18)", color: "rgba(255,200,150,0.7)", cursor: "pointer", fontSize: 16 }}>−</button>
            <span style={{ fontSize: 28, fontWeight: 700, color: waitMins !== null ? "rgba(255,248,240,0.95)" : "rgba(255,200,150,0.25)", letterSpacing: "-0.02em", minWidth: 50, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
              {waitMins ?? "—"}
            </span>
            <button onClick={() => setWaitMins(m => Math.min(120, (m ?? 14) + 1))}
              style={{ width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,185,100,0.06)", border: "1px solid rgba(255,185,100,0.18)", color: "rgba(255,200,150,0.7)", cursor: "pointer", fontSize: 16 }}>+</button>
          </div>
        </div>
      </div>

      {/* ── Footer: error + submit ── */}
      <div style={{ padding: "10px 14px 14px", borderTop: "1px solid rgba(255,185,100,0.10)", flexShrink: 0 }}>
        {error && <p style={{ fontSize: 11, color: "rgba(248,113,113,0.90)", textAlign: "center", marginBottom: 8 }}>{error}</p>}
        <button onClick={submit} disabled={loading}
          style={{
            width: "100%", height: 48, borderRadius: 14, border: "none", cursor: loading ? "default" : "pointer",
            background: loading ? "rgba(255,185,100,0.08)" : "#22c55e",
            color: "white", fontSize: 13, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase",
            opacity: loading ? 0.5 : 1, transition: "opacity 0.12s",
          }}
        >
          {loading ? "Adding…" : waitMins ? `Add · ${waitMins}m wait` : "Add to Queue"}
        </button>
      </div>
    </div>
  )
}

// ── Toast renderer ─────────────────────────────────────────────────────────────

function Toasts({ items }: { items: ToastItem[] }) {
  if (!items.length) return null
  return (
    <div style={{ position: "fixed", bottom: 108, right: 24, zIndex: 300, display: "flex", flexDirection: "column", gap: 7, alignItems: "flex-end", pointerEvents: "none" }}>
      {items.map(t => (
        <div key={t.id} style={{
          padding: "9px 16px",
          borderRadius: 10,
          background: t.type === "ok"  ? "rgba(34,197,94,0.16)"  : t.type === "err" ? "rgba(239,68,68,0.18)"  : "rgba(251,191,36,0.14)",
          border:     `1px solid ${t.type === "ok" ? "rgba(34,197,94,0.48)" : t.type === "err" ? "rgba(239,68,68,0.48)" : "rgba(251,191,36,0.48)"}`,
          backdropFilter: "blur(12px)",
          color:  t.type === "ok" ? "#22c55e" : t.type === "err" ? "#f87171" : "#fbbf24",
          fontSize: 12, fontWeight: 600,
          maxWidth: 300,
          boxShadow: "0 4px 18px rgba(0,0,0,0.40)",
        }}>
          {t.msg}
        </div>
      ))}
    </div>
  )
}

// ── History Drawer ─────────────────────────────────────────────────────────────

interface HistoryEntry {
  id: string
  name: string
  party_size: number
  status: "seated" | "removed"
  arrival_time: string
  quoted_wait: number | null
  phone: string | null
  notes: string | null
}

function HistoryDrawer({ onClose, onRestored }: { onClose: () => void; onRestored: () => void }) {
  const [tab,       setTab]       = useState<"today" | "stats">("today")
  const [entries,   setEntries]   = useState<HistoryEntry[]>([])
  const [loading,   setLoading]   = useState(true)
  const [restoring, setRestoring] = useState<string | null>(null)

  // Local seating history for stats (localStorage)
  const hist = getHistory()
  const todayMs = (() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime() })()
  const todayHist = hist.filter(r => r.seated_at >= todayMs)
  const avgQuoted = hist.length ? Math.round(hist.reduce((a, r) => a + r.quoted_wait, 0) / hist.length) : null
  const avgActual = hist.length ? Math.round(hist.reduce((a, r) => a + r.actual_wait_min, 0) / hist.length) : null
  const hourCounts: Record<number, number> = {}
  hist.forEach(r => { hourCounts[r.hour_of_day] = (hourCounts[r.hour_of_day] ?? 0) + 1 })
  let busiestHour: number | null = null; let busiestCount = 0
  for (const [h, c] of Object.entries(hourCounts)) { if (c > busiestCount) { busiestHour = Number(h); busiestCount = c } }
  const fmtHour = (h: number) => `${h % 12 || 12}${h >= 12 ? "PM" : "AM"}`
  const PARTY_SIZES = [1, 2, 3, 4, 5, 6, 8]

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`${API}/queue/history?restaurant_id=${DEMO_RESTAURANT_ID}`)
      if (r.ok) setEntries(await r.json())
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const restore = async (entryId: string) => {
    setRestoring(entryId)
    try {
      const r = await fetchT(`${API}/queue/${entryId}/restore`, { method: "POST" })
      if (!r.ok) throw new Error()
      setEntries(prev => prev.filter(e => e.id !== entryId))
      onRestored()
      showToast("Guest restored to waitlist", "ok")
    } catch {
      showToast("Could not restore guest.", "err")
    }
    setRestoring(null)
  }

  const fmtTime = (iso: string) => {
    try {
      const d = new Date(iso)
      return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
    } catch { return "—" }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-stretch sm:items-center justify-end">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={onClose} />
      <div
        className="relative w-full sm:w-[400px] h-full sm:h-auto sm:max-h-[90vh] rounded-none sm:rounded-2xl flex flex-col overflow-hidden"
        style={{ background: "#0D0D0D", border: "1px solid rgba(255,255,255,0.07)", zIndex: 1 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div>
            <p className="text-[10px] font-black tracking-[0.22em] uppercase mb-0.5" style={{ color: "rgba(255,255,255,0.22)" }}>
              Host Log
            </p>
            <p className="text-lg font-bold" style={{ color: "rgba(255,255,255,0.92)" }}>History</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl" style={{ color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex shrink-0 px-5 pt-4 gap-2">
          {(["today", "stats"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                height: 34, padding: "0 16px", borderRadius: 10, fontSize: 13, fontWeight: 600,
                background: tab === t ? "rgba(255,255,255,0.1)" : "transparent",
                border: `1px solid ${tab === t ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.07)"}`,
                color: tab === t ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.38)",
                cursor: "pointer", transition: "all 0.12s",
              }}
            >
              {t === "today" ? `Today${entries.length > 0 ? ` · ${entries.length}` : ""}` : "Stats"}
            </button>
          ))}
          {tab === "today" && (
            <button onClick={load} style={{ marginLeft: "auto", width: 34, height: 34, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "1px solid rgba(255,255,255,0.07)", cursor: "pointer", color: "rgba(255,255,255,0.35)" }}>
              <RefreshCw style={{ width: 13, height: 13 }} />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-5 flex flex-col mt-3">
          {tab === "today" ? (
            loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin" style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.08)", borderTopColor: "rgba(255,255,255,0.5)" }} />
              </div>
            ) : entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <Clock className="w-7 h-7" style={{ color: "rgba(255,255,255,0.15)" }} />
                <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.35)" }}>No history yet today</p>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.18)", maxWidth: 200, lineHeight: 1.6 }}>Seated and removed guests will appear here.</p>
              </div>
            ) : (() => {
              const seated  = entries.filter(e => e.status === "seated")
              const removed = entries.filter(e => e.status === "removed")
              const sections = [
                { key: "seated",  label: "Seated",  color: "#22c55e", items: seated  },
                { key: "removed", label: "Removed", color: "#f87171", items: removed },
              ].filter(s => s.items.length > 0)
              return sections.map(section => (
                <div key={section.key} style={{ marginBottom: 24 }}>
                  {/* Section header */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)" }}>
                      {section.label}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: section.color, opacity: 0.75 }}>
                      {section.items.length}
                    </span>
                  </div>
                  {/* Rows */}
                  <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)" }}>
                    {section.items.map((e, i) => (
                      <div
                        key={e.id}
                        style={{
                          display: "flex", alignItems: "center", gap: 12,
                          padding: "13px 14px",
                          background: i % 2 === 0 ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.015)",
                          borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : "none",
                        }}
                      >
                        {/* Color accent bar */}
                        <div style={{ width: 3, height: 38, borderRadius: 2, background: section.color, opacity: 0.55, flexShrink: 0 }} />
                        {/* Text content */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 3 }}>
                            <span style={{ fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.92)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {e.name || "Guest"}
                            </span>
                            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.32)", flexShrink: 0 }}>
                              {fmtTime(e.arrival_time)}
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.42)", display: "flex", gap: 6 }}>
                            <span>{e.party_size} {e.party_size === 1 ? "guest" : "guests"}</span>
                            {e.quoted_wait != null && <><span style={{ opacity: 0.4 }}>·</span><span>{e.quoted_wait}m quoted</span></>}
                          </div>
                          {e.notes && (
                            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.26)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {e.notes}
                            </div>
                          )}
                        </div>
                        {/* Restore button — available for both seated and removed */}
                        <button
                          onClick={() => restore(e.id)}
                          disabled={restoring === e.id}
                          style={{
                            flexShrink: 0, height: 32, padding: "0 13px",
                            borderRadius: 8, fontSize: 12, fontWeight: 600,
                            background: "rgba(147,207,255,0.08)",
                            color: "rgba(147,207,255,0.85)",
                            border: "1px solid rgba(147,207,255,0.2)",
                            cursor: "pointer",
                            opacity: restoring === e.id ? 0.45 : 1,
                            transition: "opacity 0.15s",
                          }}
                        >
                          {restoring === e.id ? "…" : "Restore"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            })()
          ) : (
            // Stats tab
            hist.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <BarChart2 className="w-8 h-8" style={{ color: "rgba(255,255,255,0.12)" }} />
                <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.32)" }}>No seating data yet</p>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.18)", maxWidth: 220, lineHeight: 1.6 }}>Seat guests to build wait-time suggestions.</p>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 20 }}>
                  <p className="text-[10px] font-black tracking-[0.18em] uppercase mb-3" style={{ color: "rgba(255,255,255,0.25)" }}>
                    Today · {todayHist.length} parties
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Parties", value: todayHist.length, unit: "" },
                      { label: "Avg Quoted", value: avgQuoted, unit: "min" },
                      { label: "Avg Actual", value: avgActual, unit: "min" },
                    ].map(({ label, value, unit }) => (
                      <div key={label} className="flex flex-col items-center justify-center rounded-xl py-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                        <span style={{ fontSize: 26, fontWeight: 700, lineHeight: 1, color: "rgba(255,255,255,0.92)", letterSpacing: "-0.02em" }}>{value ?? "—"}</span>
                        {unit && value != null && <span style={{ fontSize: 10, color: "rgba(255,255,255,0.32)", marginTop: 2 }}>{unit}</span>}
                        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)", marginTop: 5, textAlign: "center" }}>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <p className="text-[10px] font-black tracking-[0.18em] uppercase mb-3" style={{ color: "rgba(255,255,255,0.25)" }}>
                    All Time · {hist.length} parties
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {busiestHour !== null && (
                      <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                        <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)", marginBottom: 5 }}>Busiest Hour</p>
                        <p style={{ fontSize: 24, fontWeight: 700, color: "rgba(255,255,255,0.92)", lineHeight: 1, letterSpacing: "-0.02em" }}>{fmtHour(busiestHour)}</p>
                        <p style={{ fontSize: 10, color: "rgba(255,255,255,0.32)", marginTop: 3 }}>{busiestCount} parties</p>
                      </div>
                    )}
                    {avgQuoted != null && avgActual != null && (
                      <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                        <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)", marginBottom: 5 }}>Accuracy</p>
                        <p style={{ fontSize: 24, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.02em", color: Math.abs(avgQuoted - avgActual) <= 3 ? "#22c55e" : "rgba(251,191,36,0.90)" }}>
                          {Math.abs(avgQuoted - avgActual) <= 3 ? "Great" : avgActual > avgQuoted ? "Under" : "Over"}
                        </p>
                        <p style={{ fontSize: 10, color: "rgba(255,255,255,0.32)", marginTop: 3 }}>
                          {Math.abs(avgQuoted - avgActual)}m {avgActual > avgQuoted ? "longer" : "shorter"} than quoted
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-black tracking-[0.18em] uppercase mb-1" style={{ color: "rgba(255,255,255,0.25)" }}>Suggested Wait Times</p>
                  <p className="text-[10px] mb-3" style={{ color: "rgba(255,255,255,0.20)" }}>Based on {hist.length} seatings · adjusted for time of day</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {PARTY_SIZES.map(n => {
                      const suggestion = suggestWait(n)
                      return (
                        <div key={n} className="flex flex-col items-center justify-center rounded-xl py-3" style={{ background: suggestion ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.02)", border: `1px solid ${suggestion ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.05)"}` }}>
                          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 3 }}>{n}{n === 8 ? "+" : ""}p</span>
                          <span style={{ fontSize: 20, fontWeight: 700, lineHeight: 1, color: suggestion ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.18)", letterSpacing: "-0.02em" }}>{suggestion ?? "—"}</span>
                          {suggestion != null && <span style={{ fontSize: 9, color: "rgba(255,255,255,0.28)", marginTop: 1 }}>min</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </>
            )
          )}
        </div>

        {/* Footer — Today tab */}
        {entries.length > 0 && tab === "today" && (
          <div className="px-5 py-4 shrink-0 flex flex-col gap-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <button
              onClick={() => {
                const headers = ["Name","Party Size","Status","Arrival","Quoted Wait (min)","Phone","Notes"]
                const csvRows = entries.map(e => [e.name || "Guest", e.party_size, e.status, fmtTime(e.arrival_time), e.quoted_wait ?? "", e.phone ?? "", (e.notes ?? "").replace(/"/g, '""')])
                const csv = [headers, ...csvRows].map(r => r.map(v => `"${v}"`).join(",")).join("\n")
                const blob = new Blob([csv], { type: "text/csv" })
                const url  = URL.createObjectURL(blob)
                const a    = document.createElement("a"); a.href = url
                a.download = `history-${getBusinessDate()}.csv`; a.click()
                URL.revokeObjectURL(url); showToast("Exported to CSV", "ok")
              }}
              className="w-full rounded-xl text-xs font-bold tracking-[0.1em] uppercase transition-all hover:brightness-125"
              style={{ background: "rgba(34,197,94,0.07)", color: "rgba(34,197,94,0.65)", border: "1px solid rgba(34,197,94,0.18)", padding: "10px 0" }}
            >
              Export to CSV
            </button>
            <button
              onClick={() => {
                setEntries([])
                showToast("History cleared", "ok")
              }}
              className="w-full rounded-xl text-xs font-bold tracking-[0.1em] uppercase transition-all hover:brightness-125"
              style={{ background: "rgba(239,68,68,0.06)", color: "rgba(239,68,68,0.45)", border: "1px solid rgba(239,68,68,0.12)", padding: "10px 0" }}
            >
              Clear History
            </button>
          </div>
        )}
        {/* Footer — Stats tab */}
        {hist.length > 0 && tab === "stats" && (
          <div className="px-5 py-4 shrink-0 flex flex-col gap-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <button
              onClick={() => {
                const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]
                const headers = ["Seated At","Party Size","Quoted Wait (min)","Actual Wait (min)","Day","Hour"]
                const rows = hist.map(r => [new Date(r.seated_at).toLocaleString(), r.party_size, r.quoted_wait, r.actual_wait_min, DAYS[r.day_of_week], r.hour_of_day])
                const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n")
                const blob = new Blob([csv], { type: "text/csv" })
                const url  = URL.createObjectURL(blob)
                const a    = document.createElement("a"); a.href = url
                a.download = `seating-${getBusinessDate()}.csv`; a.click()
                URL.revokeObjectURL(url); showToast("Exported to CSV", "ok")
              }}
              className="w-full rounded-xl text-xs font-bold tracking-[0.1em] uppercase transition-all hover:brightness-125"
              style={{ background: "rgba(34,197,94,0.07)", color: "rgba(34,197,94,0.65)", border: "1px solid rgba(34,197,94,0.18)", padding: "10px 0" }}
            >
              Export to CSV
            </button>
            <button
              onClick={() => {
                try { localStorage.removeItem(HISTORY_KEY); localStorage.removeItem(HISTORY_DATE_KEY) } catch {}
                onClose(); showToast("History cleared", "ok")
              }}
              className="w-full rounded-xl text-xs font-bold tracking-[0.1em] uppercase transition-all hover:brightness-125"
              style={{ background: "rgba(239,68,68,0.06)", color: "rgba(239,68,68,0.45)", border: "1px solid rgba(239,68,68,0.12)", padding: "10px 0" }}
            >
              Clear Stats
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────

export default function DemoHostDashboard() {
  const router = useRouter()
  const [authed, setAuthed] = useState(false)
  const [tables, setTables]               = useState<Table[]>([])
  const [queue, setQueue]                 = useState<QueueEntry[]>([])
  const queueRef = useRef<QueueEntry[]>([])
  const [online, setOnline]               = useState(true)
  const [lastSync, setLastSync]           = useState(new Date())
  const [ghStatus, setGhStatus]           = useState<"good"|"degraded"|"bad">("good")
  const [showAdd, setShowAdd]             = useState(false)
  const [waitModal, setWaitModal]         = useState<{ id: string; defaultMinutes: number } | null>(null)
  const [nfcWaitPanel, setNfcWaitPanel]   = useState<{ id: string; name: string; party_size: number; suggested: number | null } | null>(null)
  const [editModal, setEditModal]         = useState<{ entry: QueueEntry; displayWait: number } | null>(null)
  const [avgWait, setAvgWait]             = useState(0)
  const [activeDragEntry, setActiveDrag]  = useState<QueueEntry | null>(null)
  const [activeDragOccupant, setActiveDragOccupant] = useState<{ tableNumber: number; occupant: LocalOccupant } | null>(null)
  const [seatPicker, setSeatPicker]       = useState<QueueEntry | null>(null)
  const [resPicker, setResPicker]         = useState<Reservation | null>(null)
  const [todayReservations, setTodayRes]  = useState<Reservation[]>([])
  const [selectedEntry, setSelectedEntry] = useState<QueueEntry | null>(null)
  const [clearConfirm, setClearConfirm]   = useState<{ tableId: string | undefined; tableNumber: number; occupant: LocalOccupant } | null>(null)
  const [sidebarW, setSidebarW]           = useState(300)
  const [zoom,     setZoom]               = useState(() => { try { return parseFloat(localStorage.getItem("host_zoom") || "1") } catch { return 1 } })
  useEffect(() => { try { localStorage.setItem("host_zoom", String(zoom)) } catch {} }, [zoom])
  const [linkCopied, setLinkCopied]       = useState(false)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [toasts, setToasts]               = useState<ToastItem[]>([])
  const [resTblPicker, setResTblPicker]   = useState<Reservation | null>(null)
  const [resSeatWarning, setResSeatWarning] = useState<{ entry: QueueEntry; tableNumber: number; tableId: string | undefined; resInfo: ReservedTable } | null>(null)
  const [reservedTables, setReservedTables] = useState<Map<number, ReservedTable>>(() => {
    try {
      const s = localStorage.getItem("host_demo_reserved_tables")
      return s ? new Map(JSON.parse(s) as [number, ReservedTable][]) : new Map()
    } catch { return new Map() }
  })
  const toastSeqRef     = useRef(0)
  const isResizing      = useRef(false)
  const resizeStartX    = useRef(0)
  const resizeStartW    = useRef(0)

  // Auth gate
  useEffect(() => {
    if (typeof window !== "undefined") {
      const ok = sessionStorage.getItem("host_demo_authed") === "1"
      if (!ok) { router.replace("/login"); return }
      setAuthed(true)
    }
  }, [router])

  // Wire module-level toast dispatcher to component state
  useEffect(() => {
    _dispatchToast = (msg, type) => {
      const id = ++toastSeqRef.current
      setToasts(p => [...p, { id, msg, type }])
      setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500)
    }
    return () => { _dispatchToast = null }
  }, [])

  // Persist reserved table pre-assignments
  useEffect(() => {
    try { localStorage.setItem("host_demo_reserved_tables", JSON.stringify([...reservedTables])) } catch {}
  }, [reservedTables])

  // Poll GitHub + Railway status to derive real system health
  useEffect(() => {
    if (!authed) return
    async function checkServices() {
      try {
        const r = await fetch("https://www.githubstatus.com/api/v2/status.json", { cache: "no-store" })
        const d = await r.json()
        const ind: string = d?.status?.indicator ?? "none"
        if (ind === "major" || ind === "critical") setGhStatus("bad")
        else if (ind === "minor")                  setGhStatus("degraded")
        else                                       setGhStatus("good")
      } catch { /* network-only error — ignore, keep last known */ }
    }
    checkServices()
    const t = setInterval(checkServices, 5 * 60_000)
    return () => clearInterval(t)
  }, [authed])

  const handleResizePointerMove = useCallback((e: PointerEvent) => {
    if (!isResizing.current) return
    const delta = e.clientX - resizeStartX.current
    setSidebarW(Math.max(220, Math.min(520, resizeStartW.current + delta)))
  }, [])

  const handleResizePointerUp = useCallback(() => {
    isResizing.current = false
    document.removeEventListener("pointermove", handleResizePointerMove)
    document.removeEventListener("pointerup", handleResizePointerUp)
    document.body.style.cursor = ""
    document.body.style.userSelect = ""
  }, [handleResizePointerMove])

  const startResize = useCallback((e: React.PointerEvent) => {
    isResizing.current = true
    resizeStartX.current = e.clientX
    resizeStartW.current = sidebarW
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
    document.addEventListener("pointermove", handleResizePointerMove)
    document.addEventListener("pointerup", handleResizePointerUp)
  }, [sidebarW, handleResizePointerMove, handleResizePointerUp])

  const [now, setNow] = useState(() => new Date())
  const [localOccupants, setLocalOccupants] = useState<Map<number, LocalOccupant>>(() => {
    try {
      const s = localStorage.getItem("host_demo_occupants")
      return s ? new Map(JSON.parse(s) as [number, LocalOccupant][]) : new Map()
    } catch { return new Map() }
  })
  // Tables seated from THIS view — protected from syncOccupants wiping them during the
  // brief window between the optimistic set and the backend commit (avoids race condition)
  const recentlySeateddRef = useRef<Map<number, number>>(new Map()) // tableNum → expiry ms

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  // Persist floor map occupancy to localStorage (separate key from Walter's)
  useEffect(() => {
    try { localStorage.setItem("host_demo_occupants", JSON.stringify([...localOccupants])) } catch {}
  }, [localOccupants])

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])

  const fetchTables   = useCallback(async () => {
    try {
      const r = await fetch(`${API}/tables?restaurant_id=${DEMO_RESTAURANT_ID}`)
      if (r.ok) setTables(await r.json())
    } catch {}
  }, [])
  const fetchQueue    = useCallback(async () => {
    try {
      const r = await fetch(`${API}/queue?restaurant_id=${DEMO_RESTAURANT_ID}`)
      if (r.ok) {
        const data: QueueEntry[] = await r.json()
        setQueue(data); queueRef.current = data; setOnline(true); setLastSync(new Date())
      }
    } catch { setOnline(false) }
    finally   { setIsInitialLoad(false) }
  }, [])
  const fetchInsights = useCallback(async () => { try { const r = await fetch(`${API}/insights?restaurant_id=${DEMO_RESTAURANT_ID}`); if (r.ok) { const d = await r.json(); setAvgWait(d.avg_wait_estimate ?? 0) } } catch {} }, [])
  // Sync table occupants from backend (covers seating done on HOST analog)
  const syncOccupants = useCallback(async () => {
    try {
      const r = await fetch(`${API}/tables/occupants?restaurant_id=${DEMO_RESTAURANT_ID}`)
      if (!r.ok) return
      const data: Record<string, { name: string; party_size: number; entry_id: string }> = await r.json()
      // Full replace from backend — authoritative source for cross-view sync.
      // Preserves tables seated from THIS view during a brief grace period (5s) to avoid
      // the race where the interval fires before the seat-to-table DB write is visible.
      setLocalOccupants(prev => {
        const now2 = Date.now()
        const next = new Map<number, { name: string; party_size: number }>()
        // Add everything from backend
        for (const [numStr, occ] of Object.entries(data)) {
          next.set(parseInt(numStr, 10), { name: occ.name, party_size: occ.party_size })
        }
        // Keep any recently-seated local entry that backend hasn't picked up yet
        for (const [tNum, expiry] of recentlySeateddRef.current) {
          if (expiry > now2 && prev.has(tNum) && !next.has(tNum)) {
            next.set(tNum, prev.get(tNum)!)
          } else if (expiry <= now2) {
            recentlySeateddRef.current.delete(tNum)
          }
        }
        return next
      })
    } catch {}
  }, [])
  const refreshAll    = useCallback(() => { fetchTables(); fetchQueue(); syncOccupants() }, [fetchTables, fetchQueue, syncOccupants])

  const fetchReservations = useCallback(async () => {
    try {
      const r = await fetch(`${API}/reservations?restaurant_id=${DEMO_RESTAURANT_ID}`)
      if (r.ok) {
        const all: Reservation[] = await r.json()
        const todayStr = toLocalDateStr(new Date())
        setTodayRes(
          all
            .filter(r => r.date === todayStr && r.status === "confirmed")
            .sort((a, b) => a.time.localeCompare(b.time))
        )
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (!authed) return
    refreshAll(); fetchInsights(); fetchReservations()
    const fast   = setInterval(refreshAll, 2000)
    const slow   = setInterval(fetchInsights, 30000)
    const resInt = setInterval(fetchReservations, 30000)
    return () => { clearInterval(fast); clearInterval(slow); clearInterval(resInt) }
  }, [refreshAll, fetchInsights, fetchReservations, authed])

  const seat   = useCallback(async (id: string) => {
    setQueue(prev => prev.filter(e => e.id !== id))  // optimistic
    try { const r = await fetchT(`${API}/queue/${id}/seat`, { method: "POST" }); if (!r.ok) throw new Error(); refreshAll() }
    catch { showToast("Could not seat guest — try again.", "err"); refreshAll() }
  }, [refreshAll])
  const notify = useCallback(async (id: string) => {
    setQueue(prev => prev.map(e => e.id === id ? { ...e, status: "ready" as const } : e))  // optimistic
    try {
      const r = await fetchT(`${API}/queue/${id}/notify`, { method: "POST" })
      if (!r.ok) throw new Error()
      const data = await r.json()
      if (data.sms_error) {
        showToast(`Marked ready. SMS failed: ${data.sms_error}`, "warn")
      } else if (data.sms_sent) {
        showToast("Guest notified by text", "ok")
      } else {
        showToast("Marked ready (no phone on file)", "ok")
      }
      refreshAll()
    } catch { showToast("Could not notify guest.", "err"); refreshAll() }
  }, [refreshAll])

  const remove = useCallback(async (id: string) => {
    const entry = queueRef.current.find(e => e.id === id)
    setQueue(prev => prev.filter(e => e.id !== id))  // optimistic UI
    try {
      const r = await fetchT(`${API}/queue/${id}/remove`, { method: "POST" })
      if (!r.ok) throw new Error()
      if (entry) {
        addToGuestLog({ id: entry.id, name: entry.name || "Guest", party_size: entry.party_size, source: entry.source || "walk-in", phone: entry.phone, notes: entry.notes, quoted_wait: entry.quoted_wait, actual_wait_min: null, joined_ms: new Date(entry.arrival_time).getTime(), resolved_ms: Date.now(), status: "removed" })
      }
      refreshAll()
    } catch {
      showToast("Could not remove guest.", "err")
      refreshAll()  // revert on failure
    }
  }, [refreshAll])

  const openSeatPicker = useCallback((entry: QueueEntry) => {
    setSeatPicker(entry)
    setSelectedEntry(null)
    // Fetch fresh table + occupant data so the picker shows live availability
    fetchTables()
    fetch(`${API}/tables/occupants?restaurant_id=${DEMO_RESTAURANT_ID}`)
      .then(r => r.ok ? r.json() : {})
      .then((data: Record<string, { name: string; party_size: number }>) => {
        setLocalOccupants(prev => {
          const now2 = Date.now()
          const next = new Map<number, { name: string; party_size: number }>()
          for (const [numStr, occ] of Object.entries(data)) {
            next.set(parseInt(numStr, 10), { name: occ.name, party_size: occ.party_size })
          }
          for (const [tNum, expiry] of recentlySeateddRef.current) {
            if (expiry > now2 && prev.has(tNum) && !next.has(tNum)) {
              next.set(tNum, prev.get(tNum)!)
            } else if (expiry <= now2) {
              recentlySeateddRef.current.delete(tNum)
            }
          }
          return next
        })
      })
      .catch(() => {})
  }, [fetchTables])

  // Core seat action — called directly or after warning confirmation
  const doSeat = useCallback(async (entry: QueueEntry, tableNumber: number, tableId: string | undefined) => {
    // Resolve tableId — prefer passed value, then current tables state, then fetch fresh
    // (ensures seat-to-table is always used, never the generic /seat fallback)
    let resolvedTableId = tableId ?? tables.find(t => t.table_number === tableNumber)?.id
    if (!resolvedTableId) {
      try {
        const r = await fetch(`${API}/tables?restaurant_id=${DEMO_RESTAURANT_ID}`)
        if (r.ok) {
          const fresh: { id: string; table_number: number; status: string }[] = await r.json()
          resolvedTableId = fresh.find(t => t.table_number === tableNumber)?.id
        }
      } catch {}
    }
    // Capacity warning (non-blocking)
    const apiTable = tables.find(t => resolvedTableId ? t.id === resolvedTableId : t.table_number === tableNumber)
    if (apiTable && entry.party_size > apiTable.capacity) {
      showToast(`Table ${tableNumber} fits ${apiTable.capacity}p but party is ${entry.party_size}p`, "warn")
    }
    try {
      const r = resolvedTableId
        ? await fetchT(`${API}/queue/${entry.id}/seat-to-table/${resolvedTableId}`, { method: "POST" })
        : await fetchT(`${API}/queue/${entry.id}/seat`, { method: "POST" })
      if (!r.ok) throw new Error()
    } catch {
      showToast("Could not seat guest — please try again.", "err")
      return
    }
    recentlySeateddRef.current.set(tableNumber, Date.now() + 5000) // protect for 5s
    setLocalOccupants(prev => new Map(prev).set(tableNumber, { name: entry.name || "Guest", party_size: entry.party_size, entry_id: entry.id }))
    setReservedTables(prev => { const n = new Map(prev); n.delete(tableNumber); return n })
    // Record seating history for suggestions + guest log
    {
      const arrivalMs  = new Date(entry.arrival_time).getTime()
      const resolvedMs = Date.now()
      const actualWait = Math.round((resolvedMs - arrivalMs) / 60_000)
      const now        = new Date()
      if (entry.quoted_wait) {
        addToHistory({ party_size: entry.party_size, quoted_wait: entry.quoted_wait, actual_wait_min: actualWait, seated_at: resolvedMs, day_of_week: now.getDay(), hour_of_day: now.getHours() })
      }
      addToGuestLog({ id: entry.id, name: entry.name || "Guest", party_size: entry.party_size, source: entry.source || "walk-in", phone: entry.phone, notes: entry.notes, quoted_wait: entry.quoted_wait, actual_wait_min: actualWait, joined_ms: arrivalMs, resolved_ms: resolvedMs, status: "seated" })
    }
    showToast(`${entry.name || "Guest"} seated at Table ${tableNumber}`)
    refreshAll()
  }, [refreshAll, tables])

  const confirmSeat = useCallback(async (entry: QueueEntry, tableNumber: number, tableId: string | undefined) => {
    setSeatPicker(null)
    // Reservation conflict — BLOCKING warning before seating
    const resTableInfo = reservedTables.get(tableNumber)
    if (resTableInfo) {
      const mins = getResMinutesUntil(resTableInfo.time, new Date())
      if (mins > -15 && mins <= 60) {
        setResSeatWarning({ entry, tableNumber, tableId, resInfo: resTableInfo })
        return
      }
    }
    await doSeat(entry, tableNumber, tableId)
  }, [doSeat, reservedTables])

  const checkInConfirm = useCallback(async (res: Reservation, tableNumber: number, tableId: string | undefined) => {
    setResPicker(null)
    try { await fetchT(`${API}/reservations/${res.id}/status?status=seated`, { method: "PATCH" }) } catch {}
    setTodayRes(prev => prev.filter(r => r.id !== res.id))
    // Clear this reservation's pre-assignment
    setReservedTables(prev => {
      const next = new Map(prev)
      for (const [tNum, info] of next) { if (info.resId === res.id) { next.delete(tNum); break } }
      return next
    })
    if (tableId) {
      try { await fetchT(`${API}/tables/${tableId}/occupy`, { method: "POST" }) } catch {}
      fetchTables()
    }
    recentlySeateddRef.current.set(tableNumber, Date.now() + 5000)
    setLocalOccupants(prev => new Map(prev).set(tableNumber, { name: res.guest_name, party_size: res.party_size }))
    showToast(`${res.guest_name} checked in at Table ${tableNumber}`)
  }, [fetchTables])

  const clearTable = useCallback(async (tableId: string | undefined, tableNumber: number) => {
    recentlySeateddRef.current.delete(tableNumber) // allow immediate eviction
    setLocalOccupants(prev => { const n = new Map(prev); n.delete(tableNumber); return n })
    // Resolve tableId if not passed — look it up from current tables state,
    // or fetch fresh if state is stale/empty (critical: without this the API
    // call is skipped and syncOccupants re-adds the occupant 2s later)
    let resolvedTableId = tableId ?? tables.find(t => t.table_number === tableNumber)?.id
    if (!resolvedTableId) {
      try {
        const r = await fetch(`${API}/tables?restaurant_id=${DEMO_RESTAURANT_ID}`)
        if (r.ok) {
          const fresh: { id: string; table_number: number }[] = await r.json()
          resolvedTableId = fresh.find(t => t.table_number === tableNumber)?.id
        }
      } catch {}
    }
    if (resolvedTableId) {
      try { await fetch(`${API}/tables/${resolvedTableId}/clear`, { method: "POST" }) } catch {}
    }
    fetchTables()
  }, [fetchTables, tables])

  // Returns the pre-assigned table number for a given reservation, if any
  const tableForRes = useCallback((resId: string): number | undefined => {
    for (const [tNum, info] of reservedTables) { if (info.resId === resId) return tNum }
    return undefined
  }, [reservedTables])

  // Pre-assign a table to a reservation (turns it yellow on the floor map)
  const assignResTable = useCallback((res: Reservation, tableNumber: number) => {
    setReservedTables(prev => new Map(prev).set(tableNumber, {
      resId: res.id, guestName: res.guest_name, time: res.time,
    }))
    showToast(`Table ${tableNumber} held for ${res.guest_name} at ${fmt12Res(res.time)}`)
  }, [])

  function handleDragStart(event: DragStartEvent) {
    setSelectedEntry(null)
    const data = event.active.data.current as Record<string, unknown> | undefined
    if (data?.type === "occupant") {
      setActiveDragOccupant({ tableNumber: data.tableNumber as number, occupant: data.occupant as LocalOccupant })
      setActiveDrag(null)
    } else {
      setActiveDrag((data as { entry?: QueueEntry } | undefined)?.entry ?? null)
      setActiveDragOccupant(null)
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveDrag(null)
    setActiveDragOccupant(null)
    if (!over || !active) return

    const targetTable = parseInt((over.id as string).replace("table-", ""))
    if (isNaN(targetTable)) return

    const data = active.data.current as Record<string, unknown> | undefined

    if (data?.type === "occupant") {
      const sourceTable = data.tableNumber as number
      const occupant = data.occupant as LocalOccupant
      if (sourceTable === targetTable) return

      // Fetch fresh table list to get accurate IDs
      let tableList = tables
      try {
        const r = await fetch(`${API}/tables?restaurant_id=${DEMO_RESTAURANT_ID}`)
        if (r.ok) tableList = await r.json()
      } catch {}

      const sourceApiTable = tableList.find(t => t.table_number === sourceTable)
      const targetApiTable = tableList.find(t => t.table_number === targetTable)

      if (!sourceApiTable || !targetApiTable) {
        showToast("Could not resolve table IDs — please try again.", "err")
        return
      }

      const displaced = localOccupants.get(targetTable)

      // Optimistic update immediately
      recentlySeateddRef.current.set(targetTable, Date.now() + 5000)
      if (displaced) recentlySeateddRef.current.set(sourceTable, Date.now() + 5000)
      setLocalOccupants(prev => {
        const next = new Map(prev)
        next.delete(sourceTable)
        if (displaced) next.set(sourceTable, displaced)
        next.set(targetTable, occupant)
        return next
      })

      // Persist to backend
      try {
        // Occupy the target table with this guest
        await fetch(`${API}/tables/${targetApiTable.id}/occupy`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: occupant.name, party_size: occupant.party_size, entry_id: occupant.entry_id }),
        })
        if (displaced) {
          // Swap: put displaced guest at source table
          await fetch(`${API}/tables/${sourceApiTable.id}/occupy`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: displaced.name, party_size: displaced.party_size, entry_id: displaced.entry_id }),
          })
        } else {
          // No swap: clear the source table
          await fetch(`${API}/tables/${sourceApiTable.id}/clear`, { method: "POST" })
        }
      } catch {
        showToast("Move saved locally — sync may differ.", "warn")
      }
      refreshAll()
      return
    }

    const entry = (data as { entry?: QueueEntry } | undefined)?.entry
    if (!entry) return
    if (localOccupants.has(targetTable)) return

    // Always fetch fresh tables so we get the correct tableId for the drop target.
    // Without this, a stale/empty tables array causes fallback to generic /seat
    // which auto-assigns the smallest available table (usually table 1).
    let tableList = tables
    if (!tableList.find(t => t.table_number === targetTable)) {
      try {
        const r = await fetch(`${API}/tables?restaurant_id=${DEMO_RESTAURANT_ID}`)
        if (r.ok) tableList = await r.json()
      } catch {}
    }

    const apiTable = tableList.find(t => t.table_number === targetTable)
    if (!apiTable) {
      showToast(`Table ${targetTable} not found — please try again.`, "err")
      return
    }
    if (localOccupants.has(targetTable) || apiTable.status === "occupied") {
      showToast(`Table ${targetTable} is already occupied.`, "err")
      return
    }
    if (entry.party_size > apiTable.capacity) {
      showToast(`Table ${targetTable} fits ${apiTable.capacity}p but party is ${entry.party_size}p`, "warn")
    }

    const resolvedMs = Date.now()
    const arrivalMs  = new Date(entry.arrival_time).getTime()
    const actualWait = Math.round((resolvedMs - arrivalMs) / 60_000)

    // Optimistic update — show table as occupied immediately
    recentlySeateddRef.current.set(targetTable, Date.now() + 5000)
    setLocalOccupants(prev => new Map(prev).set(targetTable, { name: entry.name || "Guest", party_size: entry.party_size, entry_id: entry.id }))
    setReservedTables(prev => { const n = new Map(prev); n.delete(targetTable); return n })

    // Reservation warning
    const dragResInfo = reservedTables.get(targetTable)
    if (dragResInfo) {
      const mins = getResMinutesUntil(dragResInfo.time, new Date())
      if (mins <= 0) {
        // Undo optimistic — this is a locked reserved table
        setLocalOccupants(prev => { const n = new Map(prev); n.delete(targetTable); return n })
        recentlySeateddRef.current.delete(targetTable)
        return
      }
      if (mins <= 60) showToast(`${dragResInfo.guestName} reserved this table at ${fmt12Res(dragResInfo.time)}`, "warn")
    }

    fetchT(`${API}/queue/${entry.id}/seat-to-table/${apiTable.id}`, { method: "POST" })
      .then(r => { if (!r.ok) { showToast("Could not seat guest.", "err"); refreshAll() } else refreshAll() })
      .catch(() => { showToast("Could not seat guest.", "err"); refreshAll() })

    // Log to guest history
    if (entry.quoted_wait) {
      addToHistory({ party_size: entry.party_size, quoted_wait: entry.quoted_wait, actual_wait_min: actualWait, seated_at: resolvedMs, day_of_week: new Date().getDay(), hour_of_day: new Date().getHours() })
    }
    addToGuestLog({ id: entry.id, name: entry.name || "Guest", party_size: entry.party_size, source: entry.source || "walk-in", phone: entry.phone, notes: entry.notes, quoted_wait: entry.quoted_wait, actual_wait_min: actualWait, joined_ms: arrivalMs, resolved_ms: resolvedMs, status: "seated" })
  }

  const floorOccupied = FLOOR_PLAN.filter(pos => {
    if (localOccupants.has(pos.number)) return true
    const t = tables.find(t => t.table_number === pos.number)
    return !!t && t.status !== "available"
  }).length
  const available   = FLOOR_PLAN.length - floorOccupied
  const readyList      = queue.filter(q => q.status === "ready")
  const waitingList    = queue.filter(q => q.status === "waiting")
  const needsQuoteList = waitingList.filter(q => q.quoted_wait == null)
  const quotedWaiting  = waitingList.filter(q => q.quoted_wait != null)

  const urgencyOrder: Record<ResUrgency, number> = { late: 0, now: 1, arriving: 2, upcoming: 3 }
  const activeRes = todayReservations
    .filter(r => {
      const [h, m] = r.time.split(":").map(Number)
      const [y, mo, d] = r.date.split("-").map(Number)
      const resTime = new Date(y, mo - 1, d, h, m)
      const diffMin = (resTime.getTime() - now.getTime()) / 60_000
      return diffMin > -30 && diffMin < 60
    })
    .sort((a, b) => {
      const ua = urgencyOrder[getResUrgency(a.date, a.time, now)]
      const ub = urgencyOrder[getResUrgency(b.date, b.time, now)]
      if (ua !== ub) return ua - ub
      return a.time.localeCompare(b.time)
    })

  const clockStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })

  function copyNfcLink() {
    navigator.clipboard.writeText(NFC_JOIN_URL).then(() => {
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    })
  }

  if (!authed) return null

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Outer clip wrapper — always exactly viewport size */}
      <div style={{ width: "100vw", height: "100dvh", overflow: "hidden", position: "relative", background: "#0C0907" }}>
      {/* Inner scaled container — transform:scale keeps getBoundingClientRect in viewport coords,
          fixing @dnd-kit collision detection accuracy regardless of zoom level */}
      <div
        className="flex flex-col"
        style={{
          width:           `${(1 / zoom * 100).toFixed(6)}vw`,
          height:          `${(1 / zoom * 100).toFixed(6)}dvh`,
          background:      "#0C0907",
          transform:       `scale(${zoom})`,
          transformOrigin: "top left",
          overflow:        "hidden",
        }}
      >

        {/* ── Header ─────────────────────────────────────────────────── */}
        <header
          className="flex items-center justify-between px-5 h-12 shrink-0"
          style={{ background: "rgba(7,4,2,0.98)", borderBottom: "1px solid rgba(255,185,100,0.18)", backdropFilter: "blur(20px)" }}
        >
          <div className="flex items-center gap-3.5 min-w-0 flex-1 overflow-hidden">
            {/* Back arrow → Analog + Demo Restaurant wordmark */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Link href="/demo/analog" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 8, background: "rgba(255,185,100,0.08)", border: "1px solid rgba(255,185,100,0.16)", color: "rgba(255,200,150,0.65)", textDecoration: "none", flexShrink: 0, transition: "background 0.15s" }} title="Switch to Analog">
                <ChevronLeft style={{ width: 16, height: 16 }} />
              </Link>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: "0.06em", color: "rgba(255,248,240,0.95)" }}>Demo Restaurant</span>
                <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.22em", color: "rgba(255,200,150,0.40)", textTransform: "uppercase" }}>Powered by HOST</span>
              </div>
            </div>

            <div className="w-px h-5 shrink-0" style={{ background: "rgba(255,185,100,0.20)" }} />

            {/* Stats */}
            <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg shrink-0" style={{ background: "rgba(255,185,100,0.07)", border: "1px solid rgba(255,185,100,0.16)" }}>
                <span className="text-xs font-bold tabular-nums" style={{ color: available > 0 ? "#22c55e" : "#ef4444" }}>{available}</span>
                <span className="text-xs" style={{ color: "rgba(255,185,100,0.50)" }}>/{FLOOR_PLAN.length}</span>
                <span className="text-[10px] ml-0.5" style={{ color: "rgba(255,200,150,0.60)" }}>free</span>
              </div>
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg shrink-0" style={{ background: "rgba(255,185,100,0.07)", border: "1px solid rgba(255,185,100,0.16)" }}>
                <span className="text-xs font-bold tabular-nums" style={{ color: waitingList.length > 0 ? "#f97316" : "rgba(255,200,150,0.60)" }}>{waitingList.length}</span>
                <span className="text-[10px]" style={{ color: "rgba(255,200,150,0.60)" }}>waiting</span>
              </div>
              {readyList.length > 0 && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg shrink-0 animate-pulse" style={{ background: "rgba(34,197,94,0.14)", border: "1px solid rgba(34,197,94,0.35)" }}>
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  <span className="text-xs font-bold" style={{ color: "#22c55e" }}>{readyList.length} ready</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Live clock */}
            <span
              className="hidden sm:block text-[11px] tabular-nums font-medium px-2"
              style={{ color: "rgba(255,200,150,0.65)", letterSpacing: "0.04em" }}
            >
              {clockStr}
            </span>

            {/* Copy NFC Link button */}
            <button
              onClick={copyNfcLink}
              className="hidden sm:flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-medium transition-colors"
              style={{
                color: linkCopied ? "#22c55e" : "rgba(255,200,150,0.65)",
                background: linkCopied ? "rgba(34,197,94,0.1)" : "transparent",
                border: linkCopied ? "1px solid rgba(34,197,94,0.3)" : "1px solid transparent",
              }}
              title={NFC_JOIN_URL}
            >
              {linkCopied
                ? <><Check className="w-3 h-3" /> Copied!</>
                : <><Copy className="w-3 h-3" /> NFC Link</>
              }
            </button>

            <Link href="/demo/history" className="hidden sm:flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-medium hover:bg-white/8 transition-colors" style={{ color: "rgba(255,200,150,0.65)" }}>
              <BarChart2 className="w-3 h-3" /> History
            </Link>

            <Link href="/demo/reservations" className="hidden sm:flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-medium hover:bg-white/8 transition-colors" style={{ color: "rgba(255,200,150,0.65)" }}>
              <CalendarDays className="w-3 h-3" /> Reservations
            </Link>

            {/* Zoom controls */}
            <div className="hidden sm:flex items-center gap-0.5 rounded-lg overflow-hidden" style={{ border: "1px solid rgba(255,185,100,0.14)", background: "rgba(255,185,100,0.04)" }}>
              <button
                onClick={() => setZoom(z => Math.max(0.7, Math.round((z - 0.1) * 10) / 10))}
                className="h-7 w-7 flex items-center justify-center transition-colors hover:bg-white/8"
                style={{ color: "rgba(255,200,150,0.60)", fontSize: 14, fontWeight: 300 }}
                title="Zoom out"
              >−</button>
              <span className="text-[10px] tabular-nums font-semibold px-1" style={{ color: "rgba(255,200,150,0.45)", minWidth: 28, textAlign: "center" }}>
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom(z => Math.min(1.4, Math.round((z + 0.1) * 10) / 10))}
                className="h-7 w-7 flex items-center justify-center transition-colors hover:bg-white/8"
                style={{ color: "rgba(255,200,150,0.60)", fontSize: 14, fontWeight: 300 }}
                title="Zoom in"
              >+</button>
            </div>

            <div className="h-7 w-7 flex items-center justify-center" style={{ color: online ? "rgba(34,197,94,0.85)" : "rgba(239,68,68,0.85)" }}>
              {online ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            </div>
            <button onClick={refreshAll} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-white/8 transition-colors" style={{ color: "rgba(255,200,150,0.55)" }}>
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>

        {/* ── Body ───────────────────────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden">

          {/* ── Queue sidebar (resizable) ──────────────────────── */}
          <div
            className="flex flex-col shrink-0 overflow-hidden"
            style={{
              width: sidebarW,
              position: "relative",
              background: "#0C0907",
            }}
          >
            {/* Drag-to-resize handle */}
            <div
              onPointerDown={startResize}
              style={{
                position: "absolute", right: 0, top: 0, bottom: 0, width: 6,
                cursor: "col-resize", zIndex: 20,
                background: "transparent",
                borderRight: "1px solid rgba(255,185,100,0.16)",
              }}
              title="Drag to resize"
            >
              <div style={{
                position: "absolute", top: "50%", left: "50%",
                transform: "translate(-50%, -50%)",
                display: "flex", flexDirection: "column", gap: 3,
              }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{ width: 2, height: 2, borderRadius: "50%", background: "rgba(255,185,100,0.28)" }} />
                ))}
              </div>
            </div>

            {/* ── Today's reservations ──────────────────────────── */}
            {activeRes.length > 0 && (
              <div
                style={{
                  padding: "8px 12px 8px",
                  borderBottom: "1px solid rgba(255,185,100,0.16)",
                  flexShrink: 0,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 7, padding: "0 2px" }}>
                  <CalendarDays style={{ width: 9, height: 9, color: "rgba(99,179,237,0.80)" }} />
                  <span style={{
                    fontSize: 9, fontWeight: 800, letterSpacing: "0.16em",
                    color: "rgba(99,179,237,0.75)", textTransform: "uppercase",
                  }}>
                    Reservations · {activeRes.length}
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {activeRes.map(res => {
                    const urgency = getResUrgency(res.date, res.time, now)
                    const isLate     = urgency === "late"
                    const isNow      = urgency === "now"
                    const isArriving = urgency === "arriving"
                    const assignedTableNum = tableForRes(res.id)
                    const assignedApiTable = assignedTableNum !== undefined
                      ? tables.find(t => t.table_number === assignedTableNum)
                      : undefined

                    return (
                      <div
                        key={res.id}
                        style={{
                          display: "flex", alignItems: "flex-start", gap: 8,
                          padding: "7px 9px", borderRadius: 9,
                          background: isLate
                            ? "rgba(239,68,68,0.12)"
                            : isNow
                            ? "rgba(249,115,22,0.10)"
                            : isArriving
                            ? "rgba(251,191,36,0.08)"
                            : "rgba(99,179,237,0.06)",
                          border: `1px solid ${isLate
                            ? "rgba(239,68,68,0.45)"
                            : isNow
                            ? "rgba(249,115,22,0.40)"
                            : isArriving
                            ? "rgba(251,191,36,0.35)"
                            : "rgba(99,179,237,0.22)"}`,
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: 12, fontWeight: 600,
                            color: "rgba(255,248,240,0.97)",
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            marginBottom: 2,
                          }}>
                            {res.guest_name}
                          </div>
                          <div style={{
                            fontSize: 10, display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap",
                            color: "rgba(255,200,150,0.70)",
                          }}>
                            <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmt12Res(res.time)}</span>
                            <span>·</span>
                            <span>{res.party_size}p</span>
                            {isArriving && <span style={{ color: "#fbbf24", fontWeight: 800, fontSize: 9, letterSpacing: "0.08em" }}>ARRIVING</span>}
                            {isNow      && <span className="animate-pulse" style={{ color: "#f97316", fontWeight: 800, fontSize: 9, letterSpacing: "0.08em" }}>DUE NOW</span>}
                            {isLate     && <span className="animate-pulse" style={{ color: "#ef4444", fontWeight: 800, fontSize: 9, letterSpacing: "0.08em" }}>LATE</span>}
                            {/* Pre-assigned table badge */}
                            {assignedTableNum !== undefined && (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                                <span style={{ fontSize: 9, fontWeight: 800, color: "rgba(251,191,36,0.95)", background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.35)", borderRadius: 4, padding: "1px 5px" }}>
                                  T{assignedTableNum}
                                </span>
                                <button
                                  onPointerDown={e => e.stopPropagation()}
                                  onClick={e => { e.stopPropagation(); setReservedTables(prev => { const n = new Map(prev); n.delete(assignedTableNum); return n }) }}
                                  style={{ fontSize: 10, color: "rgba(251,191,36,0.45)", cursor: "pointer", background: "none", border: "none", padding: 0, lineHeight: 1 }}
                                  title="Clear table assignment"
                                >✕</button>
                              </span>
                            )}
                          </div>
                          {/* Notes — visible on the card so staff never misses them */}
                          {res.notes && (
                            <div style={{ fontSize: 10, color: "rgba(99,179,237,0.70)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {res.notes}
                            </div>
                          )}
                        </div>

                        {/* Action buttons column */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end", flexShrink: 0 }}>
                          {/* Check In — auto-uses pre-assigned table if set */}
                          <button
                            onClick={() => {
                              if (assignedTableNum !== undefined) {
                                checkInConfirm(res, assignedTableNum, assignedApiTable?.id)
                              } else {
                                setResPicker(res)
                              }
                            }}
                            style={{
                              height: 24, padding: "0 8px", borderRadius: 6, border: "none",
                              cursor: "pointer", fontSize: 9, fontWeight: 800,
                              letterSpacing: "0.1em", textTransform: "uppercase", whiteSpace: "nowrap",
                              background: "rgba(34,197,94,0.12)", color: "#22c55e",
                            }}
                          >
                            {assignedTableNum !== undefined ? `Check In → T${assignedTableNum}` : "Check In"}
                          </button>
                          {/* Assign Table — only shown when no table is pre-assigned */}
                          {assignedTableNum === undefined && (
                            <button
                              onClick={() => setResTblPicker(res)}
                              style={{
                                height: 20, padding: "0 7px", borderRadius: 5,
                                border: "1px solid rgba(251,191,36,0.28)",
                                cursor: "pointer", fontSize: 8, fontWeight: 700,
                                letterSpacing: "0.1em", textTransform: "uppercase", whiteSpace: "nowrap",
                                background: "rgba(251,191,36,0.06)", color: "rgba(251,191,36,0.75)",
                              }}
                            >
                              Assign Table
                            </button>
                          )}
                          {/* No Show — cancel reservation for non-arrivals */}
                          <button
                            onPointerDown={e => e.stopPropagation()}
                            onClick={async (e) => {
                              e.stopPropagation()
                              await fetchT(`${API}/reservations/${res.id}/status?status=no-show`, { method: "PATCH" }).catch(() => {})
                              fetchReservations()
                              showToast(`${res.guest_name} marked as no-show`, "warn")
                            }}
                            style={{
                              height: 20, padding: "0 7px", borderRadius: 5,
                              border: "1px solid rgba(239,68,68,0.22)",
                              cursor: "pointer", fontSize: 8, fontWeight: 700,
                              letterSpacing: "0.1em", textTransform: "uppercase", whiteSpace: "nowrap" as never,
                              background: "rgba(239,68,68,0.06)", color: "rgba(239,68,68,0.62)",
                            }}
                          >
                            No Show
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Ready section */}
            {readyList.length > 0 && (
              <div className="px-3 pt-3 pb-1 shrink-0">
                <div className="flex items-center gap-2 mb-2 px-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-[10px] font-black tracking-[0.16em] uppercase" style={{ color: "rgba(34,197,94,0.90)" }}>
                    Ready · {readyList.length}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5 pr-1">
                  {readyList.map(e => (
                    <DraggableQueueCard key={e.id} entry={e}
                      isSelected={selectedEntry?.id === e.id}
                      onSelect={() => setSelectedEntry(prev => prev?.id === e.id ? null : e)}
                      onSeat={() => openSeatPicker(e)} onNotify={() => notify(e.id)}
                      onEdit={(dw) => setEditModal({ entry: e, displayWait: dw })}
                      onRemoved={() => refreshAll()} />
                  ))}
                </div>
              </div>
            )}

            {/* Divider */}
            {readyList.length > 0 && waitingList.length > 0 && (
              <div className="mx-3 my-2 shrink-0" style={{ height: 1, background: "rgba(255,185,100,0.14)" }} />
            )}

            {/* Needs Quote section — guests who joined without a quoted time */}
            {needsQuoteList.length > 0 && (
              <div className="px-3 pt-2 pb-1 shrink-0">
                <div className="flex items-center gap-2 mb-2 px-1">
                  <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#60a5fa" }} />
                  <span className="text-[10px] font-black tracking-[0.16em] uppercase" style={{ color: "rgba(99,179,237,0.90)" }}>
                    Needs Quote · {needsQuoteList.length}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5 pr-1">
                  {needsQuoteList.map(e => (
                    <div
                      key={e.id}
                      style={{
                        borderRadius: 12, padding: "10px 12px",
                        background: "rgba(99,179,237,0.07)",
                        border: "1px solid rgba(99,179,237,0.30)",
                        display: "flex", alignItems: "center", gap: 8,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: "rgba(255,255,255,0.92)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {e.name || "Guest"}
                        </div>
                        <div style={{ fontSize: 11, color: "rgba(147,207,255,0.65)", display: "flex", gap: 6, marginTop: 2 }}>
                          <span>{e.party_size}p</span>
                          <span style={{ opacity: 0.5 }}>·</span>
                          <span>{timeWaiting(e.arrival_time)} waiting</span>
                        </div>
                      </div>
                      <button
                        onClick={() => setEditModal({ entry: e, displayWait: 0 })}
                        style={{
                          flexShrink: 0, height: 30, padding: "0 12px",
                          borderRadius: 8, fontSize: 11, fontWeight: 700,
                          background: "rgba(99,179,237,0.16)",
                          color: "rgba(147,207,255,0.95)",
                          border: "1px solid rgba(99,179,237,0.40)",
                          cursor: "pointer", letterSpacing: "0.04em",
                        }}
                      >
                        Quote
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {needsQuoteList.length > 0 && waitingList.length > needsQuoteList.length && (
              <div className="mx-3 my-1.5 shrink-0" style={{ height: 1, background: "rgba(99,179,237,0.14)" }} />
            )}

            {/* Waiting section — only shows guests that have been quoted */}
            <div className="px-3 pt-2 flex-1 overflow-y-auto">
              {quotedWaiting.length > 0 && (
                <div className="flex items-center gap-2 mb-2 px-1">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#f97316", opacity: 0.90 }} />
                  <span className="text-[10px] font-black tracking-[0.16em] uppercase" style={{ color: "rgba(255,200,150,0.65)" }}>
                    Waiting · {quotedWaiting.length}
                  </span>
                </div>
              )}
              {isInitialLoad ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: "rgba(255,185,100,0.18)", borderTopColor: "rgba(255,185,100,0.65)" }} />
                </div>
              ) : queue.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3" style={{ border: "1px solid rgba(255,185,100,0.14)", borderRadius: 12 }}>
                  <CheckCircle2 className="w-7 h-7" style={{ color: "rgba(255,185,100,0.30)" }} />
                  <p className="text-[11px] font-medium" style={{ color: "rgba(255,200,150,0.50)" }}>Queue is clear</p>
                </div>
              ) : quotedWaiting.length > 0 ? (
                <div className="flex flex-col gap-1.5 pb-24 pr-1">
                  {quotedWaiting.map(e => (
                    <DraggableQueueCard key={e.id} entry={e}
                      isSelected={selectedEntry?.id === e.id}
                      onSelect={() => setSelectedEntry(prev => prev?.id === e.id ? null : e)}
                      onSeat={() => openSeatPicker(e)} onNotify={() => notify(e.id)}
                      onEdit={(dw) => setEditModal({ entry: e, displayWait: dw })}
                      onRemoved={() => refreshAll()} />
                  ))}
                </div>
              ) : null}
            </div>

          </div>

          {/* ── Floor map (desktop only) ───────────────────────────── */}
          <div className="flex-1 overflow-hidden hidden lg:flex">
            <FloorMap
              tables={tables}
              localOccupants={localOccupants}
              reservedTables={reservedTables}
              now={now}
              onClear={(tableId, tableNumber) => {
                const occupant = localOccupants.get(tableNumber)
                const dbOccupied = tables.find(t => t.table_number === tableNumber)?.status === "occupied"
                // Always confirm before clearing — prevents accidental wipes when a table
                // is occupied in DB but not yet reflected in localOccupants
                if (occupant || dbOccupied) {
                  setClearConfirm({ tableId, tableNumber, occupant: occupant ?? { name: "Guest", party_size: 2 } })
                } else {
                  clearTable(tableId, tableNumber)
                }
              }}
              isDraggingOccupant={!!activeDragOccupant}
              selectedEntry={selectedEntry}
              onSeatFromSelect={(tableNumber, tableId) => {
                if (!selectedEntry) return
                confirmSeat(selectedEntry, tableNumber, tableId)
                setSelectedEntry(null)
              }}
            />
          </div>

          {/* ── Mobile: no floor map ─────────────────── */}
          <div className="flex-1 lg:hidden overflow-y-auto p-4 flex flex-col gap-4">
            <p className="text-xs text-center py-8" style={{ color: "rgba(255,200,150,0.50)" }}>
              Floor map available on larger screens
            </p>
          </div>
        </div>

        {/* ── Add Guest FAB ─────────────────────────────────────────── */}
        <button
          onClick={() => setShowAdd(true)}
          className="fixed bottom-6 right-6 flex items-center gap-2.5 h-16 px-8 rounded-full text-sm font-black tracking-[0.1em] uppercase shadow-2xl transition-all active:scale-95 hover:scale-[1.03] z-30"
          style={{ background: "#22c55e", color: "white", boxShadow: "0 4px 28px rgba(34,197,94,0.35)" }}
        >
          <Plus className="w-5 h-5" /> Add Guest
        </button>

        {showAdd && (
          <AddGuestDrawer
            sidebarW={sidebarW}
            onClose={() => setShowAdd(false)}
            onAdded={(id) => {
              setShowAdd(false)
              refreshAll()
            }}
          />
        )}

        {nfcWaitPanel && (
          <NfcWaitPanel
            entryId={nfcWaitPanel.id}
            entryName={nfcWaitPanel.name}
            partySize={nfcWaitPanel.party_size}
            suggested={nfcWaitPanel.suggested}
            sidebarW={sidebarW}
            onClose={() => {
              setNfcWaitPanel(null)
              refreshAll()
            }}
          />
        )}

        {waitModal && (
          <WaitTimeModal
            entryId={waitModal.id}
            defaultMinutes={waitModal.defaultMinutes}
            onClose={() => { setWaitModal(null); refreshAll() }}
          />
        )}

        {editModal && (
          <GuestEditModal
            entry={editModal.entry}
            displayWait={editModal.displayWait}
            sidebarW={sidebarW}
            onClose={() => setEditModal(null)}
            onSaved={() => { setEditModal(null); refreshAll() }}
            onRemoved={() => { setEditModal(null); refreshAll() }}
          />
        )}

        {/* ── Selected guest hint bar ───────────────────────────── */}
        {selectedEntry && (
          <div
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-4 py-2.5 rounded-full"
            style={{
              background: "rgba(12,6,3,0.93)",
              border: "1px solid rgba(255,220,100,0.38)",
              backdropFilter: "blur(12px)",
              boxShadow: "0 4px 20px rgba(0,0,0,0.55)",
              whiteSpace: "nowrap",
            }}
          >
            <span className="text-xs font-bold" style={{ color: "rgba(255,220,100,0.95)" }}>
              {selectedEntry.name || "Guest"} · {selectedEntry.party_size}p
            </span>
            <span className="text-[10px]" style={{ color: "rgba(255,220,100,0.48)" }}>
              — tap a table to seat
            </span>
            <button
              onClick={() => setSelectedEntry(null)}
              className="w-5 h-5 flex items-center justify-center rounded-full ml-1 transition-all hover:bg-yellow-400/10"
              style={{ color: "rgba(255,220,100,0.6)" }}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* ── Clear Table Confirmation ──────────────────────────── */}
        {clearConfirm && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setClearConfirm(null)} />
            <div className="relative w-full sm:max-w-sm mx-0 sm:mx-4 rounded-t-3xl sm:rounded-2xl p-8" style={{ background: "#100C09", border: "1px solid rgba(239,68,68,0.28)", zIndex: 1 }}>
              <div className="sm:hidden w-10 h-1 rounded-full mx-auto mb-6" style={{ background: "rgba(255,185,100,0.18)" }} />
              <p className="text-base font-bold mb-2" style={{ color: "rgba(255,248,240,0.92)" }}>Clear Table?</p>
              <p className="text-sm mb-8" style={{ color: "rgba(255,200,150,0.55)" }}>
                Remove <strong style={{ color: "rgba(255,248,240,0.88)" }}>{clearConfirm.occupant.name}</strong>{" "}
                ({clearConfirm.occupant.party_size}p) from the floor map?
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => { clearTable(clearConfirm.tableId, clearConfirm.tableNumber); setClearConfirm(null) }}
                  className="w-full rounded-2xl font-bold tracking-wide transition-all active:scale-[0.98] hover:brightness-125"
                  style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.32)", fontSize: 16, padding: "20px 0" }}
                >
                  Yes, Clear Table
                </button>
                <button
                  onClick={() => setClearConfirm(null)}
                  className="w-full rounded-2xl font-bold tracking-wide transition-all active:scale-[0.98] hover:brightness-125"
                  style={{ background: "rgba(255,185,100,0.06)", color: "rgba(255,200,150,0.65)", border: "1px solid rgba(255,185,100,0.12)", fontSize: 15, padding: "18px 0" }}
                >
                  Keep
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Queue seat picker */}
        {seatPicker && (
          <SeatTablePicker
            guest={seatPicker}
            tables={tables}
            localOccupants={localOccupants}
            reservedTables={reservedTables}
            now={now}
            onConfirm={(tableNumber, tableId) => confirmSeat(seatPicker, tableNumber, tableId)}
            onClose={() => setSeatPicker(null)}
          />
        )}

        {/* Reservation check-in picker */}
        {resPicker && (
          <SeatTablePicker
            guest={{ name: resPicker.guest_name, party_size: resPicker.party_size }}
            tables={tables}
            localOccupants={localOccupants}
            reservedTables={reservedTables}
            excludeResId={resPicker.id}
            onConfirm={(tableNumber, tableId) => checkInConfirm(resPicker, tableNumber, tableId)}
            onClose={() => setResPicker(null)}
          />
        )}

        {/* Reservation table pre-assignment picker */}
        {resTblPicker && (
          <SeatTablePicker
            guest={{ name: resTblPicker.guest_name, party_size: resTblPicker.party_size }}
            tables={tables}
            localOccupants={localOccupants}
            reservedTables={reservedTables}
            excludeResId={resTblPicker.id}
            mode="reserve"
            onConfirm={(tableNumber) => { assignResTable(resTblPicker, tableNumber); setResTblPicker(null) }}
            onClose={() => setResTblPicker(null)}
          />
        )}

        {/* ── Reservation seat warning modal (blocking) ─────────── */}
        {resSeatWarning && (
          <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md" />
            <div
              className="relative w-full sm:w-[420px] rounded-t-3xl sm:rounded-2xl p-7"
              style={{ background: "#100C09", border: "1px solid rgba(249,115,22,0.35)", zIndex: 1 }}
            >
              <div className="sm:hidden w-8 h-[3px] rounded-full mx-auto mb-5" style={{ background: "rgba(255,185,100,0.18)" }} />

              <div className="flex items-start gap-3 mb-5">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "rgba(249,115,22,0.14)", border: "1px solid rgba(249,115,22,0.35)", color: "rgba(249,115,22,0.85)" }}
                >
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-sm mb-1" style={{ color: "rgba(255,240,220,0.97)" }}>Table Reserved</p>
                  <p className="text-xs" style={{ color: "rgba(255,200,150,0.55)", lineHeight: 1.5 }}>
                    Table {resSeatWarning.tableNumber} is held for{" "}
                    <strong style={{ color: "rgba(255,240,220,0.88)" }}>{resSeatWarning.resInfo.guestName}</strong>{" "}
                    at <strong style={{ color: "rgba(249,115,22,0.95)" }}>{fmt12Res(resSeatWarning.resInfo.time)}</strong>.
                  </p>
                </div>
              </div>

              <div className="mb-5 p-3 rounded-xl" style={{ background: "rgba(249,115,22,0.07)", border: "1px solid rgba(249,115,22,0.18)" }}>
                <p className="text-xs" style={{ color: "rgba(255,200,150,0.60)", lineHeight: 1.5 }}>
                  Seating{" "}
                  <strong style={{ color: "rgba(255,240,220,0.88)" }}>{resSeatWarning.entry.name || "this guest"}</strong>{" "}
                  ({resSeatWarning.entry.party_size}p) here may conflict with the upcoming reservation.
                </p>
              </div>

              <div className="flex flex-col gap-2.5">
                <button
                  onClick={() => {
                    const w = resSeatWarning
                    setResSeatWarning(null)
                    doSeat(w.entry, w.tableNumber, w.tableId)
                  }}
                  className="w-full rounded-xl font-bold tracking-[0.08em] uppercase transition-all active:scale-[0.98] hover:brightness-110"
                  style={{ background: "rgba(249,115,22,0.16)", color: "#f97316", border: "1px solid rgba(249,115,22,0.40)", fontSize: 14, padding: "16px 0" }}
                >
                  Seat Anyway
                </button>
                <button
                  onClick={() => {
                    const entry = resSeatWarning.entry
                    setResSeatWarning(null)
                    setSeatPicker(entry)
                  }}
                  className="w-full rounded-xl font-bold tracking-[0.08em] uppercase transition-all active:scale-[0.98] hover:brightness-110"
                  style={{ background: "rgba(34,197,94,0.10)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.30)", fontSize: 14, padding: "16px 0" }}
                >
                  Choose Different Table
                </button>
                <button
                  onClick={() => setResSeatWarning(null)}
                  className="w-full py-3 text-xs transition-all"
                  style={{ color: "rgba(255,200,150,0.28)", background: "none", border: "none", cursor: "pointer" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Toast notifications */}
      <Toasts items={toasts} />


      {/* ── Drag overlay ──────────────────────────────────────────── */}
      <DragOverlay dropAnimation={null} modifiers={[snapGhostToCursor]}>
        {activeDragEntry && <DragGhost entry={activeDragEntry} />}
        {activeDragOccupant && (
          <div style={{
            background: "rgba(239,68,68,0.35)",
            border: "1.5px solid rgba(239,68,68,0.90)",
            borderRadius: 10,
            padding: "6px 12px",
            color: "rgba(255,240,220,0.97)",
            fontSize: 11,
            fontWeight: 700,
            whiteSpace: "nowrap",
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          }}>
            {activeDragOccupant.occupant.name} · {activeDragOccupant.occupant.party_size}p
          </div>
        )}
      </DragOverlay>
      </div>{/* end outer clip wrapper */}
    </DndContext>
  )
}
