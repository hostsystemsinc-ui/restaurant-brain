"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Users, Clock, CheckCircle2, BellRing,
  RefreshCw, Wifi, WifiOff, Plus, X,
  LayoutDashboard, GripVertical, CalendarDays, CalendarCheck,
  Copy, Check, Pencil, Activity, Trash2,
} from "lucide-react"
import {
  DndContext, DragOverlay,
  PointerSensor, TouchSensor,
  useSensor, useSensors,
  useDraggable, useDroppable,
  pointerWithin, MeasuringStrategy,
  type DragStartEvent, type DragEndEvent,
} from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"

const API                = "/api/brain"
const DEMO_RESTAURANT_ID = "dec0cafe-0000-4000-8000-000000000001"
const NFC_JOIN_URL       = "https://hostplatform.net/demo/join"

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
  phone: string | null
  notes: string | null
}

interface LocalOccupant { name: string; party_size: number }

interface Reservation {
  id:         string
  guest_name: string
  party_size: number
  date:       string   // "YYYY-MM-DD"
  time:       string   // "HH:MM" or "HH:MM:SS"
  status:     string
  phone:      string | null
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
      await fetch(`${API}/queue/${entryId}/wait?minutes=${minutes}`, { method: "PATCH" })
    } catch {}
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
          style={{ background: "#D9321C", color: "white", fontSize: 16, padding: "20px 0" }}
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

// ── Guest Edit Modal ────────────────────────────────────────────────────────────

function GuestEditModal({
  entry, displayWait, onClose, onSaved, onRemoved,
}: {
  entry: QueueEntry
  displayWait: number
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
  const [paused,    setPaused]    = useState(false)
  const [countdown, setCountdown] = useState(displayWait)
  const PRESETS = [5, 10, 15, 20, 30, 45]
  const pausedRef = useRef(false)
  useEffect(() => { pausedRef.current = paused }, [paused])
  useEffect(() => {
    const t = setInterval(() => {
      if (pausedRef.current) return
      setCountdown(p => Math.max(0, p - 1))
    }, 60_000)
    return () => clearInterval(t)
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      await fetch(`${API}/queue/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoted_wait: minutes, party_size: partySize, phone: phone.trim() || null, notes: notes.trim() || null }),
      })
    } catch {}
    setSaving(false)
    onSaved()
    onClose()
  }

  const handlePause = async () => {
    const willBePaused = !paused
    setPaused(willBePaused)
    try {
      await fetch(`${API}/queue/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // When pausing: freeze the quoted_wait at the current countdown and mark paused.
        // When resuming: clear the paused flag so the iOS guest bar starts moving again.
        body: JSON.stringify(
          willBePaused
            ? { quoted_wait: countdown, paused: true }
            : { paused: false }
        ),
      })
    } catch {}
  }

  const remove = async () => {
    setRemoving(true)
    try { await fetch(`${API}/queue/${entry.id}/remove`, { method: "POST" }) } catch {}
    setRemoving(false)
    onRemoved()
    onClose()
  }

  const countdownColor = countdown <= 0 ? "#22c55e" : countdown <= 5 ? "#f97316" : "rgba(251,191,36,0.90)"

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full sm:w-[480px] rounded-t-2xl sm:rounded-2xl" style={{ background: "#100C09", border: "1px solid rgba(255,185,100,0.14)", zIndex: 1 }}>
        {/* Drag handle (mobile only) */}
        <div className="sm:hidden w-8 h-1 rounded-full mx-auto mt-3" style={{ background: "rgba(255,185,100,0.18)" }} />

        <div className="px-5 pt-4 pb-5">
          {/* ── Header ── */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] font-black tracking-[0.22em] uppercase" style={{ color: "rgba(255,200,150,0.40)" }}>Edit Guest</p>
              <p className="text-lg font-semibold leading-tight" style={{ color: "rgba(255,248,240,0.95)" }}>{entry.name || "Guest"}</p>
            </div>
            <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl" style={{ color: "rgba(255,200,150,0.35)", border: "1px solid rgba(255,185,100,0.12)" }}>
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* ── Time remaining ── */}
          {(entry.quoted_wait != null || entry.wait_estimate != null) && (
            <div className="flex items-center justify-between rounded-xl mb-3 px-4 py-2.5" style={{ background: "rgba(255,185,100,0.06)", border: "1px solid rgba(255,185,100,0.13)" }}>
              <div>
                <p className="text-[9px] font-black tracking-[0.2em] uppercase mb-0.5" style={{ color: paused ? "rgba(249,115,22,0.65)" : "rgba(255,200,150,0.40)" }}>
                  {paused ? "⏸ Paused" : "Time Remaining"}
                </p>
                <p className="text-2xl font-bold tabular-nums leading-none" style={{ color: countdownColor }}>
                  {countdown > 0 ? `${countdown} min` : "Ready to seat"}
                </p>
              </div>
              <button
                onClick={handlePause}
                className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold tracking-[0.1em] uppercase transition-all active:scale-95 hover:brightness-110"
                style={{
                  background: paused ? "rgba(34,197,94,0.12)" : "rgba(249,115,22,0.10)",
                  color:      paused ? "#22c55e"              : "#f97316",
                  border: `1px solid ${paused ? "rgba(34,197,94,0.25)" : "rgba(249,115,22,0.20)"}`,
                }}
              >
                {paused ? "▶ Resume" : "⏸ Pause"}
              </button>
            </div>
          )}

          {/* ── Set estimate ── */}
          <p className="text-[10px] font-bold tracking-[0.16em] uppercase mb-2" style={{ color: "rgba(255,200,150,0.45)" }}>Set Estimate</p>
          <div className="flex items-center justify-between mb-2 px-1">
            <button onClick={() => setMinutes(m => Math.max(1, m - 1))} className="w-10 h-10 rounded-full flex items-center justify-center text-xl font-light transition-all active:scale-95 hover:brightness-125" style={{ border: "1.5px solid rgba(255,185,100,0.22)", color: "rgba(255,200,150,0.7)", background: "rgba(255,185,100,0.06)" }}>−</button>
            <div className="text-center">
              <span className="text-5xl font-extralight tabular-nums leading-none" style={{ color: "rgba(255,248,240,0.95)" }}>{minutes}</span>
              <span className="text-xs ml-1.5" style={{ color: "rgba(255,200,150,0.40)" }}>min</span>
            </div>
            <button onClick={() => setMinutes(m => Math.min(120, m + 1))} className="w-10 h-10 rounded-full flex items-center justify-center text-xl font-light transition-all active:scale-95 hover:brightness-125" style={{ border: "1.5px solid rgba(255,185,100,0.22)", color: "rgba(255,200,150,0.7)", background: "rgba(255,185,100,0.06)" }}>+</button>
          </div>
          {/* Single row of 6 presets */}
          <div className="grid grid-cols-6 gap-1.5 mb-3">
            {PRESETS.map(p => (
              <button key={p} onClick={() => setMinutes(p)} className="flex flex-col items-center justify-center rounded-xl transition-all active:scale-95" style={{ height: 40, background: minutes === p ? "rgba(255,185,100,0.16)" : "rgba(255,185,100,0.05)", border: `1px solid ${minutes === p ? "rgba(255,185,100,0.50)" : "rgba(255,185,100,0.10)"}` }}>
                <span style={{ fontSize: 15, fontWeight: 700, lineHeight: 1, color: minutes === p ? "rgba(255,230,190,0.97)" : "rgba(255,200,150,0.50)" }}>{p}</span>
                <span style={{ fontSize: 8, letterSpacing: "0.05em", color: minutes === p ? "rgba(255,200,150,0.55)" : "rgba(255,185,100,0.28)", marginTop: 1 }}>m</span>
              </button>
            ))}
          </div>

          {/* ── Party size + Phone (side by side) ── */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <p className="text-[10px] font-bold tracking-[0.16em] uppercase mb-1.5" style={{ color: "rgba(255,200,150,0.45)" }}>Party</p>
              <div className="flex items-center rounded-xl h-11" style={{ background: "rgba(255,185,100,0.06)", border: "1.5px solid rgba(255,185,100,0.14)", padding: "0 8px" }}>
                <button onClick={() => setPartySize(p => Math.max(1, p - 1))} className="w-8 h-8 flex items-center justify-center rounded-lg text-lg transition-all active:scale-95" style={{ color: "rgba(255,200,150,0.7)" }}>−</button>
                <span className="flex-1 text-center text-xl font-light tabular-nums" style={{ color: "rgba(255,248,240,0.95)" }}>{partySize}</span>
                <button onClick={() => setPartySize(p => Math.min(20, p + 1))} className="w-8 h-8 flex items-center justify-center rounded-lg text-lg transition-all active:scale-95" style={{ color: "rgba(255,200,150,0.7)" }}>+</button>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold tracking-[0.16em] uppercase mb-1.5" style={{ color: "rgba(255,200,150,0.45)" }}>Phone <span style={{ color: "rgba(255,200,150,0.25)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>opt.</span></p>
              <input
                type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="(555) 000-0000"
                className="w-full rounded-xl outline-none h-11"
                style={{ background: "rgba(255,185,100,0.06)", border: "1.5px solid rgba(255,185,100,0.14)", color: "rgba(255,248,240,0.92)", fontSize: 14, padding: "0 12px" }}
              />
            </div>
          </div>

          {/* ── Notes ── */}
          <p className="text-[10px] font-bold tracking-[0.16em] uppercase mb-1.5" style={{ color: "rgba(255,200,150,0.45)" }}>Notes <span style={{ color: "rgba(255,200,150,0.25)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>opt.</span></p>
          <input
            type="text" value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Allergies, preferences, special occasion…"
            className="w-full rounded-xl outline-none mb-4 h-11"
            style={{ background: "rgba(255,185,100,0.06)", border: "1.5px solid rgba(255,185,100,0.14)", color: "rgba(255,248,240,0.92)", fontSize: 14, padding: "0 14px" }}
          />

          {/* ── Save ── */}
          <button onClick={save} disabled={saving} className="w-full rounded-xl font-black tracking-[0.15em] uppercase transition-all active:scale-[0.98] disabled:opacity-40" style={{ background: "#D9321C", color: "white", fontSize: 14, padding: "14px 0" }}>
            {saving ? "Saving…" : "Save Changes"}
          </button>

          {/* ── Remove ── */}
          <div style={{ margin: "12px -20px -20px", padding: "12px 20px 20px", borderTop: "1px solid rgba(239,68,68,0.10)" }}>
            <button
              onClick={remove}
              disabled={removing}
              className="w-full rounded-xl font-bold tracking-[0.08em] uppercase transition-all active:scale-[0.98] disabled:opacity-40"
              style={{ background: "rgba(239,68,68,0.07)", color: "rgba(239,68,68,0.70)", border: "1px solid rgba(239,68,68,0.18)", fontSize: 13, padding: "12px 0" }}
            >
              {removing ? "Removing…" : "Remove from Waitlist"}
            </button>
          </div>
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
    try { await fetch(`${API}/queue/${entry.id}/remove`, { method: "POST" }) } catch {}
    setRemoving(false)
    onRemoved?.()
  }

  // Per-card live countdown.
  // remaining_wait = server-computed "minutes truly left" (quoted_wait minus elapsed time since
  // updated_at). Falls back to wait_estimate when no quoted_wait has been set.
  const [displayWait, setDisplayWait] = useState(entry.remaining_wait ?? entry.wait_estimate ?? 0)
  const quotedTotal = entry.quoted_wait ?? entry.wait_estimate ?? 0
  const barPct = quotedTotal > 0 ? Math.max(0, Math.min(100, (displayWait / quotedTotal) * 100)) : 0
  useEffect(() => {
    setDisplayWait(entry.remaining_wait ?? entry.wait_estimate ?? 0)
  }, [entry.remaining_wait, entry.wait_estimate])
  useEffect(() => {
    const target = entry.remaining_wait ?? entry.wait_estimate
    if (!target) return
    const t = setInterval(() => setDisplayWait(p => Math.max(0, p - 1)), 60_000)
    return () => clearInterval(t)
  }, [entry.remaining_wait, entry.wait_estimate])

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
        <span style={{ display: "flex", alignItems: "center", gap: 3 }} title="Time since arrival">
          <Clock className="w-2.5 h-2.5" />{timeWaiting(entry.arrival_time)} elapsed
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
          📝 {entry.notes}
        </div>
      )}

      {/* ── Progress bar: remaining time vs quoted total ── */}
      {quotedTotal > 0 && !isReady && (
        <div style={{ marginTop: 6, height: 3, background: "rgba(255,185,100,0.08)", borderRadius: 2, overflow: "hidden" }}>
          <div style={{
            height: "100%",
            width: `${barPct}%`,
            background: displayWait <= 0 ? "#22c55e" : displayWait <= 5 ? "#f97316" : "rgba(251,191,36,0.75)",
            borderRadius: 2,
            transition: "width 60s linear",
          }} />
        </div>
      )}

      {/* ── Row 3: action buttons or delete confirm ── */}
      {confirmDelete ? (
        <div onPointerDown={e => e.stopPropagation()} style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
          <span style={{ fontSize: 11, color: "rgba(239,68,68,0.80)", flex: 1 }}>Remove {entry.name || "guest"}?</span>
          <button onClick={e => { e.stopPropagation(); setConfirmDelete(false) }}
            className="h-8 px-3 rounded-lg text-xs font-semibold transition-all active:scale-95"
            style={{ background: "rgba(255,185,100,0.08)", color: "rgba(255,200,150,0.60)", border: "1px solid rgba(255,185,100,0.15)" }}>
            Cancel
          </button>
          <button onClick={e => { e.stopPropagation(); handleRemove() }} disabled={removing}
            className="h-8 px-3 rounded-lg text-xs font-bold transition-all active:scale-95 disabled:opacity-50"
            style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.30)" }}>
            {removing ? "…" : "Remove"}
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
          <button onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onSeat() }}
            className="h-10 w-10 flex items-center justify-center rounded-xl transition-all active:scale-95 hover:brightness-125"
            style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e" }} title="Seat">
            <CheckCircle2 className="w-5 h-5" />
          </button>
          {!isReady ? (
            <button onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onNotify() }}
              className="h-10 w-10 flex items-center justify-center rounded-xl transition-all active:scale-95 hover:brightness-125"
              style={{ background: "rgba(249,115,22,0.1)", color: "#f97316" }} title="Notify ready">
              <BellRing className="w-5 h-5" />
            </button>
          ) : (
            <div className="h-10 w-10" />
          )}
          <button onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onEdit?.(displayWait) }}
            className="h-10 w-10 flex items-center justify-center rounded-xl transition-all active:scale-95 hover:brightness-125"
            style={{ background: "rgba(251,191,36,0.08)", color: "rgba(251,191,36,0.75)", border: "1px solid rgba(251,191,36,0.14)" }} title="Edit guest">
            <Pencil className="w-4 h-4" />
          </button>
          <button onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); setConfirmDelete(true) }}
            className="h-10 w-10 flex items-center justify-center rounded-xl transition-all active:scale-95 hover:brightness-125"
            style={{ background: "rgba(239,68,68,0.07)", color: "rgba(239,68,68,0.55)", border: "1px solid rgba(239,68,68,0.14)" }} title="Remove guest">
            <Trash2 className="w-4 h-4" />
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
  pos, table, occupant, onClear, isDraggingOccupant, isSelectMode, onSeatFromSelect,
}: {
  pos: FloorPos
  table?: Table
  occupant?: LocalOccupant
  onClear?: () => void
  isDraggingOccupant?: boolean
  isSelectMode?: boolean
  onSeatFromSelect?: () => void
}) {
  const isOccupied = !!occupant || (!!table && table.status !== "available")
  const hasLocalOccupant = !!occupant
  const canReceiveDrop = isDraggingOccupant ? !hasLocalOccupant : !isOccupied
  const noTable = !table
  const avail = !isOccupied

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

  const isSelectTarget = !!isSelectMode && !isOccupied

  const bg = isOver && canReceiveDrop
    ? "rgba(34,197,94,0.55)"
    : isSelectTarget
    ? "rgba(34,197,94,0.38)"
    : isOccupied ? "rgba(239,68,68,0.28)"
    : noTable ? "rgba(255,255,255,0.07)"
    : "rgba(34,197,94,0.22)"

  const borderColor = isOver && canReceiveDrop
    ? "#22c55e"
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
          background: noTable ? "rgba(255,255,255,0.28)" : "#22c55e",
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
  tables, localOccupants, onClear, isDraggingOccupant, selectedEntry, onSeatFromSelect,
}: {
  tables: Table[]
  localOccupants: Map<number, LocalOccupant>
  onClear: (tableId: string | undefined, tableNumber: number) => void
  isDraggingOccupant: boolean
  selectedEntry?: QueueEntry | null
  onSeatFromSelect?: (tableNumber: number, tableId: string | undefined) => void
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
                onClear={() => onClear(table?.id, pos.number)}
                isDraggingOccupant={isDraggingOccupant}
                isSelectMode={!!selectedEntry}
                onSeatFromSelect={selectedEntry ? () => onSeatFromSelect?.(pos.number, table?.id) : undefined}
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
  guest,
  tables,
  localOccupants,
  onConfirm,
  onClose,
}: {
  guest: { name: string | null; party_size: number }
  tables: Table[]
  localOccupants: Map<number, LocalOccupant>
  onConfirm: (tableNumber: number, tableId: string | undefined) => void
  onClose: () => void
}) {
  const available = FLOOR_PLAN.filter(pos => {
    if (localOccupants.has(pos.number)) return false
    const t = tables.find(t => t.table_number === pos.number)
    return !t || t.status === "available"
  })

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
            Seat Guest
          </span>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ color: "rgba(255,200,150,0.25)" }}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs mb-6" style={{ color: "rgba(255,200,150,0.3)" }}>
          {guest.name || "Guest"} · {guest.party_size}p — choose a table
        </p>

        {available.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-xs" style={{ color: "rgba(255,200,150,0.3)" }}>No tables available right now</p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto">
            {available.map(pos => {
              const t = tables.find(t => t.table_number === pos.number)
              return (
                <button
                  key={pos.number}
                  onClick={() => onConfirm(pos.number, t?.id)}
                  className="flex flex-col items-center justify-center gap-0.5 py-3 rounded-xl transition-all active:scale-95 hover:brightness-125"
                  style={{
                    background: "rgba(34,197,94,0.07)",
                    border: "1px solid rgba(34,197,94,0.25)",
                  }}
                >
                  <span className="text-xl font-bold" style={{ color: "rgba(34,197,94,0.9)" }}>
                    {pos.number}
                  </span>
                  {t && (
                    <span className="text-[10px]" style={{ color: "rgba(34,197,94,0.45)" }}>
                      {t.capacity}p
                    </span>
                  )}
                  <span className="text-[9px] tracking-wider uppercase mt-0.5" style={{ color: "rgba(34,197,94,0.3)" }}>
                    {pos.section}
                  </span>
                </button>
              )
            })}
          </div>
        )}

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

function AddGuestDrawer({ onClose, onAdded }: { onClose: () => void; onAdded: (entryId: string, defaultMinutes: number) => void }) {
  const [name, setName]           = useState("")
  const [partySize, setPartySize] = useState(2)
  const [phone, setPhone]         = useState("")
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState("")

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
          preference:    "asap",
          source:        "host",
          restaurant_id: DEMO_RESTAURANT_ID,
        }),
      })
      if (!r.ok) throw new Error()
      const data = await r.json()
      onAdded(data.entry?.id ?? "", data.wait_estimate ?? 15)
    } catch {
      setError("Could not add guest.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={onClose} />
      <div
        className="relative w-full sm:w-[580px] rounded-t-3xl sm:rounded-3xl p-8"
        style={{ background: "#100C09", border: "1px solid rgba(255,185,100,0.12)", zIndex: 1 }}
      >
        <div className="sm:hidden w-10 h-1 rounded-full mx-auto mb-7" style={{ background: "rgba(255,185,100,0.18)" }} />
        <div className="flex items-center justify-between mb-8">
          <span className="text-base font-black tracking-[0.18em] uppercase" style={{ color: "rgba(255,240,220,0.92)" }}>
            Add Guest
          </span>
          <button onClick={onClose} className="w-11 h-11 flex items-center justify-center rounded-xl transition-colors hover:bg-white/8" style={{ color: "rgba(255,200,150,0.35)", border: "1px solid rgba(255,185,100,0.12)" }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs font-bold tracking-[0.18em] uppercase mb-4" style={{ color: "rgba(255,200,150,0.45)" }}>Party Size</p>
        <div className="flex items-center justify-between mb-8 px-2">
          <button onClick={() => setPartySize(p => Math.max(1, p - 1))}
            className="w-20 h-20 rounded-full flex items-center justify-center text-4xl font-light transition-all active:scale-95 hover:brightness-125"
            style={{ border: "1.5px solid rgba(255,185,100,0.22)", color: "rgba(255,200,150,0.7)", background: "rgba(255,185,100,0.06)" }}>−</button>
          <span className="text-[88px] font-extralight tabular-nums leading-none" style={{ color: "rgba(255,248,240,0.95)", minWidth: 120, textAlign: "center" }}>{partySize}</span>
          <button onClick={() => setPartySize(p => Math.min(20, p + 1))}
            className="w-20 h-20 rounded-full flex items-center justify-center text-4xl font-light transition-all active:scale-95 hover:brightness-125"
            style={{ border: "1.5px solid rgba(255,185,100,0.22)", color: "rgba(255,200,150,0.7)", background: "rgba(255,185,100,0.06)" }}>+</button>
        </div>

        <p className="text-xs font-bold tracking-[0.18em] uppercase mb-3" style={{ color: "rgba(255,200,150,0.45)" }}>Name</p>
        <input type="text" value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && submit()} placeholder="Guest name" autoFocus
          className="w-full rounded-2xl outline-none mb-5"
          style={{ background: "rgba(255,185,100,0.06)", border: "1.5px solid rgba(255,185,100,0.14)", color: "rgba(255,248,240,0.92)", fontSize: 18, padding: "18px 20px" }} />

        <p className="text-xs font-bold tracking-[0.18em] uppercase mb-3" style={{ color: "rgba(255,200,150,0.45)" }}>
          Phone <span style={{ color: "rgba(255,200,150,0.25)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span>
        </p>
        <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
          onKeyDown={e => e.key === "Enter" && submit()} placeholder="(555) 000-0000"
          className="w-full rounded-2xl outline-none mb-7"
          style={{ background: "rgba(255,185,100,0.06)", border: "1.5px solid rgba(255,185,100,0.14)", color: "rgba(255,248,240,0.92)", fontSize: 18, padding: "18px 20px" }} />

        {error && <p className="text-sm text-red-400 mb-5 text-center font-medium">{error}</p>}

        <button onClick={submit} disabled={loading}
          className="w-full rounded-2xl font-black tracking-[0.15em] uppercase transition-all active:scale-[0.98] disabled:opacity-40"
          style={{ background: loading ? "rgba(255,185,100,0.08)" : "#D9321C", color: "white", fontSize: 16, padding: "22px 0" }}>
          {loading ? "Adding…" : "Add to Queue"}
        </button>
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
  const [online, setOnline]               = useState(true)
  const [lastSync, setLastSync]           = useState(new Date())
  const [ghStatus, setGhStatus]           = useState<"good"|"degraded"|"bad">("good")
  const [showAdd, setShowAdd]             = useState(false)
  const [waitModal, setWaitModal]         = useState<{ id: string; defaultMinutes: number } | null>(null)
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
  const [linkCopied, setLinkCopied]       = useState(false)
  const isResizing = useRef(false)
  const resizeStartX = useRef(0)
  const resizeStartW = useRef(0)

  // Auth gate
  useEffect(() => {
    if (typeof window !== "undefined") {
      const ok = sessionStorage.getItem("host_demo_authed") === "1"
      if (!ok) { router.replace("/login"); return }
      setAuthed(true)
    }
  }, [router])

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

  const fetchTables   = useCallback(async () => { try { const r = await fetch(`${API}/tables?restaurant_id=${DEMO_RESTAURANT_ID}`);   if (r.ok) setTables(await r.json()) } catch {} }, [])
  const fetchQueue    = useCallback(async () => { try { const r = await fetch(`${API}/queue?restaurant_id=${DEMO_RESTAURANT_ID}`);    if (r.ok) { setQueue(await r.json()); setOnline(true); setLastSync(new Date()) } } catch { setOnline(false) } }, [])
  const fetchInsights = useCallback(async () => { try { const r = await fetch(`${API}/insights?restaurant_id=${DEMO_RESTAURANT_ID}`); if (r.ok) { const d = await r.json(); setAvgWait(d.avg_wait_estimate ?? 0) } } catch {} }, [])
  const refreshAll    = useCallback(() => { fetchTables(); fetchQueue() }, [fetchTables, fetchQueue])

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
    const fast   = setInterval(refreshAll, 4000)
    const slow   = setInterval(fetchInsights, 30000)
    const resInt = setInterval(fetchReservations, 30000)
    return () => { clearInterval(fast); clearInterval(slow); clearInterval(resInt) }
  }, [refreshAll, fetchInsights, fetchReservations, authed])

  const seat   = useCallback(async (id: string) => { await fetch(`${API}/queue/${id}/seat`,   { method: "POST" }); refreshAll() }, [refreshAll])
  const notify = useCallback(async (id: string) => { await fetch(`${API}/queue/${id}/notify`, { method: "POST" }); refreshAll() }, [refreshAll])
  const remove = useCallback(async (id: string) => { await fetch(`${API}/queue/${id}/remove`, { method: "POST" }); refreshAll() }, [refreshAll])

  const openSeatPicker = useCallback((entry: QueueEntry) => {
    setSeatPicker(entry)
    setSelectedEntry(null)
  }, [])

  const confirmSeat = useCallback(async (entry: QueueEntry, tableNumber: number, tableId: string | undefined) => {
    setSeatPicker(null)
    if (tableId) {
      await fetch(`${API}/queue/${entry.id}/seat-to-table/${tableId}`, { method: "POST" })
    } else {
      await fetch(`${API}/queue/${entry.id}/seat`, { method: "POST" })
    }
    setLocalOccupants(prev => new Map(prev).set(tableNumber, { name: entry.name || "Guest", party_size: entry.party_size }))
    refreshAll()
  }, [refreshAll])

  const checkInConfirm = useCallback(async (res: Reservation, tableNumber: number, tableId: string | undefined) => {
    setResPicker(null)
    try {
      await fetch(`${API}/reservations/${res.id}/status?status=seated`, { method: "PATCH" })
    } catch {}
    setTodayRes(prev => prev.filter(r => r.id !== res.id))
    if (tableId) {
      try { await fetch(`${API}/tables/${tableId}/occupy`, { method: "POST" }) } catch {}
      fetchTables()
    }
    setLocalOccupants(prev => new Map(prev).set(tableNumber, { name: res.guest_name, party_size: res.party_size }))
  }, [fetchTables])

  const clearTable = useCallback(async (tableId: string | undefined, tableNumber: number) => {
    setLocalOccupants(prev => { const n = new Map(prev); n.delete(tableNumber); return n })
    if (tableId) {
      try { await fetch(`${API}/tables/${tableId}/clear`, { method: "POST" }) } catch {}
      fetchTables()
    }
  }, [fetchTables])

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

  function handleDragEnd(event: DragEndEvent) {
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
      setLocalOccupants(prev => {
        const next = new Map(prev)
        next.delete(sourceTable)
        const displaced = prev.get(targetTable)
        if (displaced) next.set(sourceTable, displaced)
        next.set(targetTable, occupant)
        return next
      })
      return
    }

    const entry = (data as { entry?: QueueEntry } | undefined)?.entry
    if (!entry) return
    if (localOccupants.has(targetTable)) return
    const apiTable = tables.find(t => t.table_number === targetTable)
    if (apiTable) {
      fetch(`${API}/queue/${entry.id}/seat-to-table/${apiTable.id}`, { method: "POST" }).then(() => refreshAll())
    } else {
      seat(entry.id)
    }
    setLocalOccupants(prev => new Map(prev).set(targetTable, { name: entry.name || "Guest", party_size: entry.party_size }))
  }

  const floorOccupied = FLOOR_PLAN.filter(pos => {
    if (localOccupants.has(pos.number)) return true
    const t = tables.find(t => t.table_number === pos.number)
    return !!t && t.status !== "available"
  }).length
  const available   = FLOOR_PLAN.length - floorOccupied
  const readyList   = queue.filter(q => q.status === "ready")
  const waitingList = queue.filter(q => q.status === "waiting")

  const urgencyOrder: Record<ResUrgency, number> = { late: 0, now: 1, arriving: 2, upcoming: 3 }
  const activeRes = todayReservations
    .filter(r => {
      const [h, m] = r.time.split(":").map(Number)
      const [y, mo, d] = r.date.split("-").map(Number)
      const resTime = new Date(y, mo - 1, d, h, m)
      const diffMin = (resTime.getTime() - now.getTime()) / 60_000
      return diffMin > -45 && diffMin < 180
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
      <div className="flex flex-col w-full" style={{ height: "100dvh", overflow: "hidden", background: "#0C0907" }}>

        {/* ── Header ─────────────────────────────────────────────────── */}
        <header
          className="flex items-center justify-between px-5 h-12 shrink-0"
          style={{ background: "rgba(7,4,2,0.98)", borderBottom: "1px solid rgba(255,185,100,0.18)", backdropFilter: "blur(20px)" }}
        >
          <div className="flex items-center gap-3.5 min-w-0 flex-1 overflow-hidden">
            {/* Demo Restaurant wordmark */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: "0.06em", color: "rgba(255,248,240,0.95)" }}>Demo Restaurant</span>
              <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.22em", color: "rgba(255,200,150,0.40)", textTransform: "uppercase" }}>Powered by HOST</span>
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

            <Link href="/demo/reservations" className="hidden sm:flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-medium hover:bg-white/8 transition-colors" style={{ color: "rgba(255,200,150,0.65)" }}>
              <CalendarDays className="w-3 h-3" /> Reservations
            </Link>

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

                    return (
                      <div
                        key={res.id}
                        style={{
                          display: "flex", alignItems: "center", gap: 8,
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
                            fontSize: 10, display: "flex", gap: 5, alignItems: "center",
                            color: "rgba(255,200,150,0.70)",
                          }}>
                            <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmt12Res(res.time)}</span>
                            <span>·</span>
                            <span>{res.party_size}p</span>
                            {isArriving && (
                              <span style={{ color: "#fbbf24", fontWeight: 800, fontSize: 9, letterSpacing: "0.08em" }}>
                                ARRIVING
                              </span>
                            )}
                            {isNow && (
                              <span className="animate-pulse" style={{ color: "#f97316", fontWeight: 800, fontSize: 9, letterSpacing: "0.08em" }}>
                                DUE NOW
                              </span>
                            )}
                            {isLate && (
                              <span className="animate-pulse" style={{ color: "#ef4444", fontWeight: 800, fontSize: 9, letterSpacing: "0.08em" }}>
                                LATE
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => setResPicker(res)}
                          style={{
                            height: 24, padding: "0 8px", borderRadius: 6, border: "none",
                            cursor: "pointer", fontSize: 9, fontWeight: 800,
                            letterSpacing: "0.1em", textTransform: "uppercase", whiteSpace: "nowrap",
                            background: "rgba(34,197,94,0.12)", color: "#22c55e",
                          }}
                        >
                          Check In
                        </button>
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
                <div className="flex flex-col gap-1.5">
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

            {/* Waiting section */}
            <div className="px-3 pt-2 flex-1 overflow-y-auto">
              <div className="flex items-center gap-2 mb-2 px-1">
                {waitingList.length > 0 && <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#f97316", opacity: 0.90 }} />}
                <span className="text-[10px] font-black tracking-[0.16em] uppercase" style={{ color: "rgba(255,200,150,0.65)" }}>
                  {waitingList.length > 0 ? `Waiting · ${waitingList.length}` : "Queue"}
                </span>
              </div>

              {queue.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3" style={{ border: "1px solid rgba(255,185,100,0.14)", borderRadius: 12 }}>
                  <CheckCircle2 className="w-7 h-7" style={{ color: "rgba(255,185,100,0.30)" }} />
                  <p className="text-[11px] font-medium" style={{ color: "rgba(255,200,150,0.50)" }}>Queue is clear</p>
                </div>
              ) : waitingList.length === 0 ? (
                <div className="flex items-center justify-center py-8" style={{ border: "1px solid rgba(255,185,100,0.14)", borderRadius: 12 }}>
                  <p className="text-xs" style={{ color: "rgba(255,200,150,0.50)" }}>No one else waiting</p>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5 pb-24">
                  {waitingList.map(e => (
                    <DraggableQueueCard key={e.id} entry={e}
                      isSelected={selectedEntry?.id === e.id}
                      onSelect={() => setSelectedEntry(prev => prev?.id === e.id ? null : e)}
                      onSeat={() => openSeatPicker(e)} onNotify={() => notify(e.id)}
                      onEdit={(dw) => setEditModal({ entry: e, displayWait: dw })}
                      onRemoved={() => refreshAll()} />
                  ))}
                </div>
              )}
            </div>

            {/* Sidebar footer — system health (3-state) */}
            {(() => {
              const level: "green"|"yellow"|"red" =
                !online ? "red" :
                ghStatus === "bad" ? "red" :
                ghStatus === "degraded" ? "yellow" :
                "green"
              const dot   = level === "green" ? "#22c55e" : level === "yellow" ? "#f59e0b" : "#ef4444"
              const label = level === "green" ? "System Good" : level === "yellow" ? "System Check" : "System Down"
              return (
                <div className="px-4 py-3 shrink-0 flex items-center justify-between"
                  style={{ borderTop: "1px solid rgba(255,185,100,0.14)" }}>
                  <p className="text-[10px] tabular-nums" style={{ color: "rgba(255,200,150,0.35)" }}>
                    Synced {lastSync.toLocaleTimeString()}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{
                      background: dot,
                      boxShadow: `0 0 5px ${dot}CC`,
                    }} />
                    <span className="text-[10px] font-semibold" style={{ color: dot + "CC" }}>
                      {label}
                    </span>
                  </div>
                </div>
              )
            })()}
          </div>

          {/* ── Floor map (desktop only) ───────────────────────────── */}
          <div className="flex-1 overflow-hidden hidden lg:flex">
            <FloorMap
              tables={tables}
              localOccupants={localOccupants}
              onClear={(tableId, tableNumber) => {
                const occupant = localOccupants.get(tableNumber)
                if (occupant) setClearConfirm({ tableId, tableNumber, occupant })
                else clearTable(tableId, tableNumber)
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
          style={{ background: "#D9321C", color: "white", boxShadow: "0 4px 28px rgba(217,50,28,0.4)" }}
        >
          <Plus className="w-5 h-5" /> Add Guest
        </button>

        {showAdd && (
          <AddGuestDrawer
            onClose={() => setShowAdd(false)}
            onAdded={(id, mins) => { setShowAdd(false); setWaitModal({ id, defaultMinutes: mins }); refreshAll() }}
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
            onConfirm={(tableNumber, tableId) => checkInConfirm(resPicker, tableNumber, tableId)}
            onClose={() => setResPicker(null)}
          />
        )}
      </div>

      {/* ── Drag overlay ──────────────────────────────────────────── */}
      <DragOverlay dropAnimation={null}>
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
    </DndContext>
  )
}
