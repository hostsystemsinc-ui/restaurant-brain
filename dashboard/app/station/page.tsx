"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { flushSync } from "react-dom"
import Link from "next/link"
import {
  Users, Clock, CheckCircle2, BellRing,
  RefreshCw, Wifi, WifiOff, Plus, X,
  LayoutDashboard, GripVertical,
  Pencil, Activity, Trash2, History, HelpCircle,
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

const API = "https://restaurant-brain-production.up.railway.app"

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
  wait_set_at?: string | null
  arrival_time: string
  position?: number
  paused?: boolean
  phone: string | null
  notes: string | null
}

interface LocalOccupant { name: string; party_size: number; entry_id?: string }

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

// ── Helpers ────────────────────────────────────────────────────────────────────

// Parse a backend timestamp as UTC milliseconds.
// SQLite stores datetimes without timezone suffix; without 'Z' browsers parse as local time.
function parseUTCMs(ts: string | null | undefined): number | null {
  if (!ts) return null
  const s = (ts.endsWith("Z") || /[+-]\d{2}:?\d{2}$/.test(ts))
    ? ts
    : ts.replace(" ", "T") + "Z"
  const ms = new Date(s).getTime()
  return isNaN(ms) ? null : ms
}

function timeWaiting(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`
}

function getBusinessDate(): string {
  const now = new Date()
  if (now.getHours() < 3) now.setDate(now.getDate() - 1)
  return now.toLocaleDateString("en-CA")
}

const SOURCE_LABELS: Record<string, string> = {
  nfc: "NFC", host: "Host", phone: "Phone",
  web: "Web", app: "App", OpenTable: "OT",
}

// ── Wait Time Modal (post-add flow) ───────────────────────────────────────────

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
        style={{ background: "var(--modal-bg)", border: "1px solid var(--bdr-1)", zIndex: 1 }}
      >
        <div className="sm:hidden w-10 h-1 rounded-full mx-auto mb-6" style={{ background: "var(--bdr-3)" }} />
        <p className="text-xs font-black tracking-[0.22em] uppercase mb-1" style={{ color: "var(--text-muted3)" }}>Estimated Wait</p>
        <p className="text-sm mb-7" style={{ color: "var(--text-dim4)" }}>The guest will see this count down live on their phone.</p>
        <div className="flex items-center justify-between mb-6 px-2">
          <button onClick={() => setMinutes(m => Math.max(1, m - 1))} className="w-16 h-16 rounded-full flex items-center justify-center text-3xl font-light transition-all active:scale-95 hover:brightness-125" style={{ border: "1.5px solid var(--bdr-8)", color: "var(--text-warm5)", background: "var(--surf-3)" }}>−</button>
          <div className="text-center">
            <span className="text-7xl font-extralight tabular-nums leading-none" style={{ color: "var(--text-hi3)" }}>{minutes}</span>
            <span className="block text-sm mt-1" style={{ color: "var(--text-warm6)" }}>min</span>
          </div>
          <button onClick={() => setMinutes(m => Math.min(120, m + 1))} className="w-16 h-16 rounded-full flex items-center justify-center text-3xl font-light transition-all active:scale-95 hover:brightness-125" style={{ border: "1.5px solid var(--bdr-8)", color: "var(--text-warm5)", background: "var(--surf-3)" }}>+</button>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-8">
          {PRESETS.map(p => (
            <button key={p} onClick={() => setMinutes(p)} className="flex flex-col items-center justify-center rounded-2xl transition-all active:scale-95" style={{ height: 76, background: minutes === p ? "var(--bdr-2)" : "var(--surf-6)", border: `1.5px solid ${minutes === p ? "var(--bdr-9)" : "var(--bdr-10)"}`, boxShadow: minutes === p ? "0 0 0 3px var(--surf-7)" : "none" }}>
              <span style={{ fontSize: 30, fontWeight: 700, lineHeight: 1, color: minutes === p ? "rgba(255,230,190,0.97)" : "var(--text-muted2)" }}>{p}</span>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: minutes === p ? "var(--text-muted4)" : "var(--bdr-11)", marginTop: 4 }}>MIN</span>
            </button>
          ))}
        </div>
        <button onClick={save} disabled={saving} className="w-full rounded-2xl font-black tracking-[0.15em] uppercase transition-all active:scale-[0.98] disabled:opacity-40" style={{ background: "#22c55e", color: "white", fontSize: 16, padding: "20px 0" }}>{saving ? "Saving…" : "Set Wait Time"}</button>
        <button onClick={onClose} className="w-full mt-3 py-3 text-sm transition-all" style={{ color: "var(--text-dim4)", background: "none", border: "none", cursor: "pointer" }}>Skip for now</button>
      </div>
    </div>
  )
}

// ── Guest Edit Modal (sidebar panel — floor map stays live) ───────────────────

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

  const remove = async () => {
    setRemoving(true)
    try { await fetch(`${API}/queue/${entry.id}/remove`, { method: "POST" }) } catch {}
    setRemoving(false)
    onRemoved()
    onClose()
  }

  return (
    <div style={{
      position: "fixed", top: 48, left: 0, bottom: 0,
      width: sidebarW, zIndex: 48,
      background: "var(--modal-bg2)",
      borderTop: "1px solid rgba(251,191,36,0.28)",
      borderRight: "1px solid var(--bdr-1)",
      display: "flex", flexDirection: "column",
      overflowY: "hidden",
    }}>
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px 28px" }}>

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] font-black tracking-[0.22em] uppercase" style={{ color: "var(--text-warm6)" }}>Edit Guest</p>
            <p className="text-lg font-semibold leading-tight" style={{ color: "var(--text-hi3)" }}>{entry.name || "Guest"}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl transition-all active:scale-95" style={{ color: "var(--text-muted2)", border: "1px solid var(--bdr-6)", background: "var(--surf-3)" }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Wait time */}
        <p className="text-[10px] font-bold tracking-[0.16em] uppercase mb-3" style={{ color: "var(--text-muted3)" }}>Set Wait Time</p>
        <div className="flex items-center justify-between mb-4 px-2">
          <button onClick={() => setMinutes(m => Math.max(1, m - 1))} className="w-14 h-14 rounded-full flex items-center justify-center text-2xl font-light transition-all active:scale-95 hover:brightness-125" style={{ border: "1.5px solid var(--bdr-8)", color: "var(--text-warm5)", background: "var(--surf-3)" }}>−</button>
          <div className="text-center">
            <span className="text-6xl font-extralight tabular-nums leading-none" style={{ color: "var(--text-hi3)" }}>{minutes}</span>
            <span className="text-sm ml-2" style={{ color: "var(--text-warm6)" }}>min</span>
          </div>
          <button onClick={() => setMinutes(m => Math.min(120, m + 1))} className="w-14 h-14 rounded-full flex items-center justify-center text-2xl font-light transition-all active:scale-95 hover:brightness-125" style={{ border: "1.5px solid var(--bdr-8)", color: "var(--text-warm5)", background: "var(--surf-3)" }}>+</button>
        </div>
        <div className="grid grid-cols-6 gap-2 mb-5">
          {PRESETS.map(p => (
            <button key={p} onClick={() => setMinutes(p)} className="flex flex-col items-center justify-center rounded-xl transition-all active:scale-95" style={{ height: 52, background: minutes === p ? "var(--bdr-2)" : "var(--surf-6)", border: `1px solid ${minutes === p ? "var(--bdr-12)" : "var(--surf-7)"}` }}>
              <span style={{ fontSize: 17, fontWeight: 700, lineHeight: 1, color: minutes === p ? "rgba(255,230,190,0.97)" : "var(--text-muted2)" }}>{p}</span>
              <span style={{ fontSize: 9, letterSpacing: "0.05em", color: minutes === p ? "var(--text-muted)" : "var(--text-dim3)", marginTop: 2 }}>min</span>
            </button>
          ))}
        </div>

        {/* Party size */}
        <p className="text-[10px] font-bold tracking-[0.16em] uppercase mb-2" style={{ color: "var(--text-muted3)" }}>Party Size</p>
        <div className="flex items-center rounded-xl mb-4" style={{ background: "var(--surf-3)", border: "1.5px solid var(--bdr-1)", padding: "0 12px", height: 56 }}>
          <button onClick={() => setPartySize(p => Math.max(1, p - 1))} className="w-10 h-10 flex items-center justify-center text-2xl transition-all active:scale-95" style={{ color: "var(--text-warm5)" }}>−</button>
          <span className="flex-1 text-center text-2xl font-light tabular-nums" style={{ color: "var(--text-hi3)" }}>{partySize}</span>
          <button onClick={() => setPartySize(p => Math.min(20, p + 1))} className="w-10 h-10 flex items-center justify-center text-2xl transition-all active:scale-95" style={{ color: "var(--text-warm5)" }}>+</button>
        </div>

        {/* Phone */}
        <p className="text-[10px] font-bold tracking-[0.16em] uppercase mb-2" style={{ color: "var(--text-muted3)" }}>Phone <span style={{ color: "var(--text-dim5)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>optional</span></p>
        <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(555) 000-0000" className="w-full rounded-xl outline-none mb-4" style={{ background: "var(--surf-3)", border: "1.5px solid var(--bdr-1)", color: "var(--text-hi)", fontSize: 15, padding: "15px 14px", height: 56 }} />

        {/* Notes */}
        <p className="text-[10px] font-bold tracking-[0.16em] uppercase mb-2" style={{ color: "var(--text-muted3)" }}>Notes <span style={{ color: "var(--text-dim5)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>optional</span></p>
        <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Allergies, preferences, occasion…" className="w-full rounded-xl outline-none mb-5" style={{ background: "var(--surf-3)", border: "1.5px solid var(--bdr-1)", color: "var(--text-hi)", fontSize: 15, padding: "15px 14px", height: 56 }} />

        {/* Save */}
        <button onClick={save} disabled={saving} className="w-full rounded-xl font-black tracking-[0.15em] uppercase transition-all active:scale-[0.98] disabled:opacity-40" style={{ background: "#22c55e", color: "white", fontSize: 15, padding: "18px 0" }}>
          {saving ? "Saving…" : "Save Changes"}
        </button>

        {/* Remove */}
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(239,68,68,0.10)" }}>
          <button onClick={remove} disabled={removing} className="w-full rounded-xl font-bold tracking-[0.08em] uppercase transition-all active:scale-[0.98] disabled:opacity-40" style={{ background: "rgba(239,68,68,0.07)", color: "rgba(239,68,68,0.70)", border: "1px solid rgba(239,68,68,0.18)", fontSize: 14, padding: "18px 0" }}>
            {removing ? "Removing…" : "Remove from Waitlist"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Draggable Queue Card ───────────────────────────────────────────────────────

function DraggableQueueCard({
  entry, onSeat, onNotify, isSelected, onSelect, onEdit, onRemoved, onAddTime,
}: {
  entry: QueueEntry
  onSeat: () => void
  onNotify: () => void
  isSelected?: boolean
  onSelect?: () => void
  onEdit?: (displayWait: number) => void
  onRemoved?: () => void
  onAddTime?: () => void
}) {
  const isReady = entry.status === "ready"
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [removing,      setRemoving]      = useState(false)
  const [showBar,       setShowBar]       = useState(false)
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

  // Per-card live countdown — driven by wait_set_at + quoted_wait for sub-minute accuracy
  const computeSecsLeft = useCallback(() => {
    if (entry.paused) return (entry.remaining_wait ?? 0) * 60
    if (entry.wait_set_at && entry.quoted_wait != null) {
      const deadlineMs = (parseUTCMs(entry.wait_set_at) ?? 0) + entry.quoted_wait * 60_000
      return Math.round((deadlineMs - Date.now()) / 1000)
    }
    return (entry.remaining_wait ?? entry.wait_estimate ?? 0) * 60
  }, [entry.paused, entry.wait_set_at, entry.quoted_wait, entry.remaining_wait, entry.wait_estimate])

  const [secsLeft, setSecsLeft] = useState(computeSecsLeft)
  useEffect(() => { setSecsLeft(computeSecsLeft()) },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entry.wait_set_at, entry.quoted_wait, entry.remaining_wait, entry.wait_estimate, entry.paused])
  useEffect(() => {
    if (entry.paused) return
    const t = setInterval(() => setSecsLeft(computeSecsLeft()), 1000)
    return () => clearInterval(t)
  }, [computeSecsLeft, entry.paused])

  const displayWait   = Math.ceil(secsLeft / 60)
  const quotedTotal   = entry.quoted_wait ?? entry.wait_estimate ?? 0
  const progress      = quotedTotal > 0 ? Math.max(0, Math.min(1, 1 - secsLeft / (quotedTotal * 60))) : 0
  const isOverdue     = secsLeft <= 0 && quotedTotal > 0
  const barColor      = isOverdue ? "#ef4444" : secsLeft < 120 ? "#f97316" : "#22c55e"

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
        background: isSelected ? "rgba(255,220,100,0.09)" : isReady ? "rgba(34,197,94,0.10)" : "var(--surf-3)",
        border: `1px solid ${isSelected ? "rgba(255,220,100,0.55)" : isReady ? "rgba(34,197,94,0.30)" : "var(--bdr-2)"}`,
        boxShadow: isSelected ? "0 0 0 2px rgba(255,220,100,0.18), inset 0 0 10px rgba(255,220,100,0.05)" : undefined,
        borderRadius: 12,
        cursor: isDragging ? "grabbing" : "grab",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "10px 12px",
      }}
    >
      {/* ── Rows 1+2 wrapper: left stacked content, right +5 min button ── */}
      {/* gap:4 matches the action bar gap so +5 min aligns exactly over EDIT+REMOVE */}
      <div style={{ display: "flex", gap: 4, alignItems: "stretch" }}>
        {/* Left column: name row + meta row */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          {/* ── Row 1: grip + position + name ── */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <GripVertical className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted3)" }} />
            <div className="w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold shrink-0 tabular-nums" style={{ background: isReady ? "rgba(34,197,94,0.20)" : "var(--surf-4)", color: isReady ? "#22c55e" : "rgba(255,220,180,0.75)" }}>
              {entry.position ?? "—"}
            </div>
            <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 5 }}>
              <span style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.3, color: isReady ? "#86efac" : "var(--text-hi2)", wordBreak: "break-word" }}>
                {entry.name || "Guest"}
              </span>
              {isReady && (
                <span className="text-[8px] font-black tracking-[0.14em] px-1 py-0.5 rounded animate-pulse shrink-0" style={{ background: "rgba(34,197,94,0.12)", color: "#4ade80" }}>READY</span>
              )}
            </div>
          </div>

          {/* ── Row 2: meta info ── */}
          <div style={{ paddingLeft: 38, paddingRight: 4, display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--text-warm2)" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <Users className="w-2.5 h-2.5" />{entry.party_size}p
            </span>
            <span style={{ color: "var(--bdr-15)" }}>·</span>
            <span className="animate-pulse" style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <Clock className="w-2.5 h-2.5" />{timeWaiting(entry.arrival_time)}
            </span>
            {(entry.quoted_wait != null || entry.wait_estimate != null) && !isReady && (
              <>
                <span style={{ color: "var(--bdr-15)" }}>·</span>
                <span style={{ fontWeight: 700, color: isOverdue ? "#ef4444" : displayWait <= 2 ? "#f97316" : "rgba(251,191,36,0.90)", letterSpacing: "0.01em" }}>
                  {isOverdue ? "overdue" : displayWait <= 0 ? "ready" : `~${displayWait}m left`}
                </span>
                {entry.paused && <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(96,165,250,0.80)", letterSpacing: "0.08em" }}>⏸ PAUSED</span>}
                {/* Progress bar toggle */}
                <button
                  onPointerDown={e => { e.stopPropagation() }}
                  onClick={e => { e.stopPropagation(); setShowBar(b => !b) }}
                  style={{ marginLeft: 2, width: 14, height: 14, borderRadius: 3, background: showBar ? `${barColor}22` : "var(--surf-5)", border: `1px solid ${showBar ? barColor : "var(--bdr-6)"}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, flexShrink: 0 }}
                  title={showBar ? "Hide timer bar" : "Show timer bar"}
                >
                  <div style={{ width: 7, height: 3, borderRadius: 1, background: showBar ? barColor : "var(--bdr-15)" }} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Right column: +5 min button spanning full height of both rows */}
        {onAddTime && (entry.quoted_wait != null || entry.wait_estimate != null) && !isReady && (
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onAddTime() }}
            style={{ alignSelf: "stretch", flex: 1, borderRadius: 8, background: "rgba(96,165,250,0.10)", color: "rgba(96,165,250,0.85)", border: "1px solid rgba(96,165,250,0.22)", fontSize: 11, fontWeight: 800, letterSpacing: "0.04em", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
            title="+5 min"
          >
            +5 min
          </button>
        )}
      </div>
      {/* ── Progress bar (shown when toggled) ── */}
      {showBar && quotedTotal > 0 && !isReady && (
        <div onPointerDown={e => e.stopPropagation()} style={{ paddingLeft: 38, paddingRight: 4 }}>
          <div style={{ height: 4, borderRadius: 2, background: "var(--surf-7)", overflow: "hidden", position: "relative" }}>
            <div style={{
              position: "absolute", left: 0, top: 0, bottom: 0,
              width: `${(progress * 100).toFixed(1)}%`,
              background: barColor,
              borderRadius: 2,
              transition: "width 1s linear, background 0.3s",
            }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2, fontSize: 9, color: "var(--text-dim2)" }}>
            <span>0</span>
            <span style={{ color: isOverdue ? "#ef4444" : "var(--text-dim2)" }}>
              {isOverdue ? `${Math.abs(Math.ceil(secsLeft / 60))}m over` : `${displayWait}m left`}
            </span>
            <span>{quotedTotal}m</span>
          </div>
        </div>
      )}

      {/* ── Row 3: action buttons or delete confirm ── */}
      {confirmDelete ? (
        <div onPointerDown={e => e.stopPropagation()} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, color: "rgba(239,68,68,0.80)", flex: 1 }}>Remove {entry.name || "guest"}?</span>
          <button onClick={e => { e.stopPropagation(); setConfirmDelete(false) }}
            className="h-9 px-3 rounded-xl text-xs font-semibold transition-all active:scale-95"
            style={{ background: "var(--surf-5)", color: "var(--text-muted4)", border: "1px solid var(--bdr-13)" }}>
            Cancel
          </button>
          <button onClick={e => { e.stopPropagation(); handleRemove() }} disabled={removing}
            className="h-9 px-3 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-50"
            style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.30)" }}>
            {removing ? "…" : "Remove"}
          </button>
        </div>
      ) : (
        /* Full-width action bar — each button expands equally to fill the card width */
        <div onPointerDown={e => e.stopPropagation()} style={{ display: "flex", gap: 4, marginTop: 2 }}>
          {/* Seat */}
          <button onClick={e => { e.stopPropagation(); onSeat() }}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all active:scale-95 hover:brightness-125"
            style={{ height: 48, background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.20)" }} title="Seat">
            <CheckCircle2 className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.05em" }}>SEAT</span>
          </button>
          {/* Notify / placeholder */}
          {!isReady ? (
            <button onClick={e => { e.stopPropagation(); onNotify() }}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all active:scale-95 hover:brightness-125"
              style={{ height: 48, background: "rgba(249,115,22,0.10)", color: "#f97316", border: "1px solid rgba(249,115,22,0.18)" }} title="Notify ready">
              <BellRing style={{ width: 18, height: 18 }} />
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.05em" }}>NOTIFY</span>
            </button>
          ) : (
            <div style={{ flex: 1 }} />
          )}
          {/* Edit */}
          <button onClick={e => { e.stopPropagation(); onEdit?.(displayWait) }}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all active:scale-95 hover:brightness-125"
            style={{ height: 48, background: "rgba(251,191,36,0.08)", color: "rgba(251,191,36,0.80)", border: "1px solid rgba(251,191,36,0.16)" }} title="Edit guest">
            <Pencil style={{ width: 16, height: 16 }} />
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.05em" }}>EDIT</span>
          </button>
          {/* Remove */}
          <button onClick={e => { e.stopPropagation(); setConfirmDelete(true) }}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all active:scale-95 hover:brightness-125"
            style={{ height: 48, background: "rgba(239,68,68,0.07)", color: "rgba(239,68,68,0.60)", border: "1px solid rgba(239,68,68,0.14)" }} title="Remove guest">
            <Trash2 style={{ width: 16, height: 16 }} />
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.05em" }}>REMOVE</span>
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
        border: "1px solid var(--bdr-8)",
        borderRadius: 10,
        padding: "9px 13px",
        boxShadow: "0 12px 40px rgba(0,0,0,0.7)",
        cursor: "grabbing",
        minWidth: 130,
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-hi)" }}>
        {entry.name || "Guest"}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-warm6)", marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}>
        <Users style={{ width: 10, height: 10 }} />
        {entry.party_size} guests
      </div>
    </div>
  )
}

// ── Droppable floor table ──────────────────────────────────────────────────────

function DroppableFloorTable({
  pos, table, occupant, onClear, isDraggingOccupant, isSelectMode, onSeatFromSelect, onAvailableTap, forceAvailable,
}: {
  pos: FloorPos
  table?: Table
  occupant?: LocalOccupant
  onClear?: () => void
  isDraggingOccupant?: boolean
  isSelectMode?: boolean
  onSeatFromSelect?: () => void
  onAvailableTap?: () => void
  forceAvailable?: boolean
}) {
  // forceAvailable overrides table.status so a just-cleared table goes green instantly,
  // without waiting for the server to confirm and refreshAll to propagate.
  const isOccupied = !forceAvailable && (!!occupant || (!!table && table.status !== "available"))
  const hasLocalOccupant = !!occupant
  // When dragging an occupant, allow dropping on any table without a local occupant
  const canReceiveDrop = isDraggingOccupant ? !hasLocalOccupant : !isOccupied
  const noTable = !table
  const avail = !isOccupied

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `table-${pos.number}`,
    disabled: !canReceiveDrop,
  })

  // Make occupied (local) tables draggable so staff can move guests between tables
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

  // Combine droppable + draggable refs onto the same DOM node
  const setNodeRef = useCallback((el: HTMLElement | null) => {
    setDropRef(el)
    setDragRef(el)
  }, [setDropRef, setDragRef])

  const isSelectTarget = !!isSelectMode && !isOccupied

  const bg = isOver && canReceiveDrop
    ? "var(--table-over-bg)"
    : isSelectTarget
    ? "var(--table-select-bg)"
    : isOccupied ? "var(--table-occ-bg)"
    : noTable ? "var(--table-none-bg)"
    : "var(--table-avail-bg)"

  const borderColor = isOver && canReceiveDrop
    ? "var(--table-over-border)"
    : isSelectTarget
    ? "var(--table-select-border)"
    : isOccupied ? "var(--table-occ-border)"
    : noTable ? "var(--table-none-border)"
    : "var(--table-avail-border)"

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
          ? "var(--table-shadow-over)"
          : isOccupied ? "var(--table-shadow-occ)"
          : avail ? "var(--table-shadow-avail)"
          : "none",
        // No transition — background/border must snap instantly when a guest is moved or cleared.
        transition: "none",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        overflow: "hidden",
        cursor: isOccupied && onClear ? "pointer" : hasLocalOccupant ? "grab" : isSelectTarget ? "pointer" : onAvailableTap && !isOccupied && !hasLocalOccupant ? "pointer" : canReceiveDrop ? "copy" : "default",
        opacity: isDragging ? 0.4 : 1,
      }}
      onClick={
        isSelectTarget && onSeatFromSelect
          ? onSeatFromSelect
          : isOccupied && onClear
          ? onClear
          : !isOccupied && !hasLocalOccupant && !isSelectMode && onAvailableTap
          ? onAvailableTap
          : undefined
      }
    >
      <div style={{
        position: "absolute",
        top: pos.shape === "round" ? "18%" : 7,
        right: pos.shape === "round" ? "18%" : 7,
        width: 6, height: 6,
        borderRadius: "50%",
        background: noTable ? "var(--table-none-dot)" : isOccupied ? "rgba(239,68,68,0.70)" : "#22c55e",
        opacity: 0.85,
      }} />

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
          <span style={{ fontSize: 9, fontWeight: 700, color: "var(--text-warm)", letterSpacing: "0.1em" }}>
            T{pos.number}
          </span>
          <span style={{
            fontSize: pos.shape === "rect" ? 11 : 10,
            fontWeight: 700,
            color: "var(--text-cream)",
            textAlign: "center",
            lineHeight: 1.2,
            paddingInline: 4,
          }}>
            {occupant.name}
          </span>
          <span style={{ fontSize: 9, color: "var(--text-warm5)" }}>
            {occupant.party_size}p
          </span>
        </>
      ) : table && table.status !== "available" ? (
        <>
          <span style={{ fontSize: pos.shape === "rect" ? 16 : 14, fontWeight: 800, color: "var(--table-occ-num)" }}>
            {pos.number}
          </span>
          <span style={{ fontSize: 9, color: "var(--table-occ-cap)" }}>{table.capacity}p</span>
        </>
      ) : (
        <>
          <span style={{
            fontSize: pos.shape === "rect" ? 17 : 14,
            fontWeight: 800,
            color: table ? "var(--table-avail-num)" : "var(--text-muted)",
          }}>
            {pos.number}
          </span>
          {table && (
            <span style={{ fontSize: 10, color: "var(--table-avail-cap)" }}>
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
  tables, localOccupants, onClear, isDraggingOccupant, selectedEntry, onSeatFromSelect, onAvailableTap, locallyAvailableTables,
  isTableMoveMode, onCancelTableMove,
}: {
  tables: Table[]
  localOccupants: Map<number, LocalOccupant>
  onClear: (tableId: string | undefined, tableNumber: number) => void
  isDraggingOccupant: boolean
  selectedEntry?: QueueEntry | null
  onSeatFromSelect?: (tableNumber: number, tableId: string | undefined) => void
  onAvailableTap?: (tableNumber: number, tableId: string | undefined, capacity: number | undefined) => void
  locallyAvailableTables?: Set<number>
  isTableMoveMode?: boolean
  onCancelTableMove?: () => void
}) {
  const tableByNumber = new Map(tables.map(t => [t.table_number, t]))

  return (
    <div
      className="flex-1 relative overflow-hidden"
      style={{ background: "var(--page-deep)" }}
    >
      <span style={{
        position: "absolute",
        top: 14,
        left: 18,
        fontSize: 9,
        fontWeight: 800,
        letterSpacing: "0.2em",
        color: "var(--text-muted3)",
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
            background: "var(--surf-8)",
            borderLeft: "1px solid var(--bdr-2)",
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
            color: "var(--text-muted)",
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
            color: "var(--text-muted3)",
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
            color: "var(--bdr-15)",
            pointerEvents: "none",
          }}>
            Powered by <strong>HOST</strong>
          </span>

          {/* Tables */}
          {FLOOR_PLAN.map(pos => {
            const table = tableByNumber.get(pos.number)
            const occupant = localOccupants.get(pos.number)
            const isAvailable = !occupant && (!table || table.status === "available" || locallyAvailableTables?.has(pos.number))
            return (
              <DroppableFloorTable
                key={pos.number}
                pos={pos}
                table={table}
                occupant={occupant}
                onClear={() => onClear(table?.id, pos.number)}
                isDraggingOccupant={isDraggingOccupant}
                isSelectMode={!!selectedEntry || !!isTableMoveMode}
                onSeatFromSelect={selectedEntry ? () => onSeatFromSelect?.(pos.number, table?.id) : undefined}
                forceAvailable={locallyAvailableTables?.has(pos.number)}
                onAvailableTap={isAvailable ? () => onAvailableTap?.(pos.number, table?.id, table?.capacity) : undefined}
              />
            )
          })}
        </div>
      </div>

      {/* Bottom bar: Cancel button in move mode, otherwise hint text */}
      {isTableMoveMode && onCancelTableMove ? (
        <div style={{ position: "absolute", bottom: 10, left: 12, right: 12 }}>
          <button
            onClick={onCancelTableMove}
            style={{
              width: "100%",
              padding: "13px 0",
              borderRadius: 14,
              background: "rgba(239,68,68,0.14)",
              color: "#ef4444",
              border: "1px solid rgba(239,68,68,0.32)",
              fontSize: 14,
              fontWeight: 800,
              letterSpacing: "0.06em",
              cursor: "pointer",
              textTransform: "uppercase",
            }}
          >
            Cancel Move
          </button>
        </div>
      ) : (
        <div style={{
          position: "absolute",
          bottom: 14,
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: 10,
          color: "var(--text-muted3)",
          letterSpacing: "0.1em",
          whiteSpace: "nowrap",
          pointerEvents: "none",
        }}>
          Tap a guest to select · tap a table to seat · or drag directly
        </div>
      )}
    </div>
  )
}

// ── Seat Table Picker ──────────────────────────────────────────────────────────
// Generic — accepts any guest object with name + party_size

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
        style={{ background: "var(--modal-bg)", border: "1px solid var(--bdr-14)", zIndex: 1 }}
      >
        <div className="sm:hidden w-8 h-[3px] rounded-full mx-auto mb-5" style={{ background: "var(--surf-4)" }} />

        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-black tracking-[0.2em] uppercase" style={{ color: "var(--text-cream2)" }}>
            Seat Guest
          </span>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ color: "var(--text-dim5)" }}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs mb-6" style={{ color: "var(--text-dim6)" }}>
          {guest.name || "Guest"} · {guest.party_size}p — choose a table
        </p>

        {available.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-xs" style={{ color: "var(--text-dim6)" }}>No tables available right now</p>
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
          style={{ background: "var(--surf-6)", color: "var(--text-dim7)", border: "1px solid var(--surf-1)" }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Table Click Modal ─────────────────────────────────────────────────────────
// Shown when staff taps an available table.
// Two tabs: seat a waiting guest OR add a new walk-in directly to the table.
// Matches the demo restaurant's TableClickModal design.

function TableGuestPicker({
  tableNumber,
  tableId,
  capacity,
  queue,
  restaurantId,
  onClose,
  onSeated,
}: {
  tableNumber: number
  tableId: string | undefined
  capacity: number | undefined
  queue: QueueEntry[]
  restaurantId: string
  onClose: () => void
  onSeated: (tableNumber: number, occupant: LocalOccupant) => void
}) {
  const waitingGuests = queue.filter(q => q.status === "waiting" || q.status === "ready")
  const [mode,       setMode]       = useState<"pick" | "add">(waitingGuests.length > 0 ? "pick" : "add")
  const [name,       setName]       = useState("")
  const [partySize,  setPartySize]  = useState(2)
  const [phone,      setPhone]      = useState("")
  const [submitting, setSubmitting] = useState(false)

  const seatGuest = async (entry: QueueEntry) => {
    if (tableId) {
      await fetch(`${API}/queue/${entry.id}/seat-to-table/${tableId}`, { method: "POST" })
    } else {
      await fetch(`${API}/queue/${entry.id}/seat`, { method: "POST" })
    }
    onSeated(tableNumber, { name: entry.name || "Guest", party_size: entry.party_size, entry_id: entry.id })
    onClose()
  }

  const addWalkIn = async () => {
    setSubmitting(true)
    try {
      const r = await fetch(`${API}/queue/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || null, party_size: partySize, phone: phone.trim() || null, preference: "asap", source: "host", restaurant_id: restaurantId }),
      })
      const data = await r.json()
      const entryId = data.entry?.id
      if (entryId) {
        if (tableId) {
          await fetch(`${API}/queue/${entryId}/seat-to-table/${tableId}`, { method: "POST" })
        } else {
          await fetch(`${API}/queue/${entryId}/seat`, { method: "POST" })
        }
        onSeated(tableNumber, { name: name.trim() || "Guest", party_size: partySize, entry_id: entryId })
        onClose()
      }
    } catch {}
    setSubmitting(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
      <div
        className="relative w-full sm:max-w-sm mx-0 sm:mx-4 rounded-t-3xl sm:rounded-2xl p-6"
        style={{ background: "var(--modal-bg)", border: "1px solid var(--bdr-1)", zIndex: 1 }}
      >
        <div className="sm:hidden w-8 h-[3px] rounded-full mx-auto mb-5" style={{ background: "var(--surf-4)" }} />

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <p className="text-xs font-black tracking-[0.2em] uppercase" style={{ color: "var(--text-cream2)" }}>
              Table {tableNumber}
            </p>
            {capacity && (
              <span className="text-xs font-black px-2 py-0.5 rounded-full"
                style={{ background: "rgba(251,191,36,0.10)", color: "rgba(251,191,36,0.65)", border: "1px solid rgba(251,191,36,0.20)" }}>
                {capacity}p
              </span>
            )}
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg"
            style={{ color: "var(--text-dim5)", border: "1px solid var(--surf-4)" }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab toggle */}
        <div className="flex gap-2 mb-5">
          <button onClick={() => setMode("pick")}
            className="flex-1 rounded-2xl font-bold transition-all active:scale-[0.98]"
            style={{
              padding: "14px 0", fontSize: 14,
              background: mode === "pick" ? "var(--bdr-2)" : "var(--surf-2)",
              border: `1px solid ${mode === "pick" ? "var(--bdr-12)" : "var(--surf-7)"}`,
              color: mode === "pick" ? "var(--text-bright)" : "var(--text-dim7)",
            }}>
            Waiting{waitingGuests.length > 0 ? ` (${waitingGuests.length})` : ""}
          </button>
          <button onClick={() => setMode("add")}
            className="flex-1 rounded-2xl font-bold transition-all active:scale-[0.98]"
            style={{
              padding: "14px 0", fontSize: 14,
              background: mode === "add" ? "rgba(34,197,94,0.16)" : "rgba(34,197,94,0.04)",
              border: `1px solid ${mode === "add" ? "rgba(34,197,94,0.50)" : "rgba(34,197,94,0.10)"}`,
              color: mode === "add" ? "rgba(100,240,160,0.97)" : "rgba(100,200,130,0.35)",
            }}>
            Walk-in
          </button>
        </div>

        {mode === "pick" ? (
          waitingGuests.length === 0 ? (
            <p className="text-sm py-8 text-center" style={{ color: "var(--text-warm6)" }}>
              No guests waiting — switch to Walk-in to seat directly
            </p>
          ) : (
            <div className="flex flex-col gap-2.5 max-h-72 overflow-y-auto">
              {waitingGuests.map(entry => {
                const displayWait = entry.remaining_wait ?? entry.wait_estimate ?? entry.quoted_wait ?? null
                return (
                  <button key={entry.id} onClick={() => seatGuest(entry)}
                    className="flex items-center justify-between rounded-2xl text-left transition-all hover:brightness-125 active:scale-[0.98]"
                    style={{
                      padding: "16px 18px",
                      background: entry.status === "ready" ? "rgba(34,197,94,0.10)" : "var(--surf-1)",
                      border: `1px solid ${entry.status === "ready" ? "rgba(34,197,94,0.35)" : "var(--bdr-2)"}`,
                    }}>
                    <div className="min-w-0">
                      <p className="font-bold truncate" style={{ fontSize: 16, color: "var(--text-hi3)" }}>{entry.name || "Guest"}</p>
                      <p className="mt-1" style={{ fontSize: 13, color: "var(--text-muted)" }}>
                        {entry.party_size}p{displayWait != null ? ` · ${displayWait}m quoted` : ""}
                      </p>
                    </div>
                    {entry.status === "ready"
                      ? <span className="text-xs font-black ml-3 shrink-0 px-2 py-1 rounded-lg" style={{ background: "rgba(34,197,94,0.14)", color: "#22c55e" }}>READY</span>
                      : <span style={{ fontSize: 20, color: "var(--bdr-11)", marginLeft: 12 }}>›</span>
                    }
                  </button>
                )
              })}
            </div>
          )
        ) : (
          <div className="flex flex-col gap-3">
            <input placeholder="Guest name (optional)" value={name} onChange={e => setName(e.target.value)}
              className="w-full rounded-2xl outline-none"
              style={{ padding: "16px 18px", fontSize: 15, background: "var(--surf-3)", border: "1px solid var(--bdr-2)", color: "var(--text-hi)" }} />
            <div className="flex items-center gap-3 rounded-2xl"
              style={{ background: "var(--surf-3)", border: "1px solid var(--bdr-2)", padding: "10px 16px" }}>
              <span className="text-sm font-bold shrink-0" style={{ color: "var(--text-warm2)" }}>Party size</span>
              <div className="flex items-center gap-3 ml-auto">
                <button onClick={() => setPartySize(p => Math.max(1, p - 1))}
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-xl font-bold"
                  style={{ background: "var(--surf-7)", border: "1px solid var(--bdr-8)", color: "var(--text-warm3)" }}>−</button>
                <span className="w-8 text-center font-bold tabular-nums" style={{ fontSize: 18, color: "var(--text-hi3)" }}>{partySize}</span>
                <button onClick={() => setPartySize(p => Math.min(20, p + 1))}
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-xl font-bold"
                  style={{ background: "var(--surf-7)", border: "1px solid var(--bdr-8)", color: "var(--text-warm3)" }}>+</button>
              </div>
            </div>
            <input placeholder="Phone (optional)" value={phone} onChange={e => setPhone(e.target.value)} type="tel"
              className="w-full rounded-2xl outline-none"
              style={{ padding: "16px 18px", fontSize: 15, background: "var(--surf-3)", border: "1px solid var(--bdr-2)", color: "var(--text-hi)" }} />
            <button onClick={addWalkIn} disabled={submitting}
              className="w-full rounded-2xl font-bold tracking-wide transition-all active:scale-[0.98] hover:brightness-125 mt-1 disabled:opacity-40"
              style={{ fontSize: 17, padding: "22px 0", background: "rgba(34,197,94,0.15)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.32)" }}>
              {submitting ? "Seating…" : `Seat at Table ${tableNumber}`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Add Guest Drawer ───────────────────────────────────────────────────────────
// Left-side sidebar panel — covers the sidebar only, floor map stays live behind it.
// Includes inline wait-time quoting so no second modal is needed.

function AddGuestDrawer({
  onClose, onAdded, restaurantId, sidebarW,
}: {
  onClose: () => void
  onAdded: () => void
  restaurantId: string
  sidebarW: number
}) {
  const [name,      setName]      = useState("")
  const [partySize, setPartySize] = useState(2)
  const [phone,     setPhone]     = useState("")
  const [waitMins,  setWaitMins]  = useState<number | null>(15)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState("")
  const PRESETS = [5, 10, 15, 20, 30, 45]

  // Track visual viewport so the panel rises with the keyboard on mobile
  const [bottomOffset, setBottomOffset] = useState(0)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => setBottomOffset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop))
    vv.addEventListener("resize", update)
    vv.addEventListener("scroll", update)
    return () => { vv.removeEventListener("resize", update); vv.removeEventListener("scroll", update) }
  }, [])

  const submit = async () => {
    setLoading(true); setError("")
    try {
      const r = await fetch(`${API}/queue/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || null,
          party_size: partySize,
          phone: phone.trim() || null,
          preference: "asap",
          source: "host",
          restaurant_id: restaurantId,
        }),
      })
      if (!r.ok) throw new Error()
      const data = await r.json()
      const entryId = data.entry?.id
      // Apply quoted wait time inline — no separate WaitModal needed
      if (waitMins && entryId) {
        await fetch(`${API}/queue/${entryId}/wait?minutes=${waitMins}`, { method: "PATCH" }).catch(() => {})
      }
      onAdded()
    } catch {
      setError("Could not add guest — try again")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: "fixed",
      top: 48,          // below the header bar
      left: 0,
      bottom: bottomOffset,
      width: sidebarW,
      zIndex: 45,
      background: "var(--modal-bg2)",
      borderTop: "1px solid var(--bdr-8)",
      borderRight: "1px solid var(--bdr-3)",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px 10px", borderBottom: "1px solid var(--surf-4)", flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text-cream2)" }}>
          Add Guest
        </span>
        <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "1px solid var(--bdr-1)", cursor: "pointer", color: "var(--text-muted3)" }}>
          <X style={{ width: 14, height: 14 }} />
        </button>
      </div>

      {/* Scrollable form body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px 0" }}>

        {/* Party Size */}
        <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text-muted3)", marginBottom: 8 }}>Party Size</p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, padding: "0 4px" }}>
          <button onClick={() => setPartySize(p => Math.max(1, p - 1))}
            style={{ width: 44, height: 44, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 300, background: "var(--surf-3)", border: "1.5px solid var(--bdr-6)", color: "var(--text-warm5)", cursor: "pointer" }}>−</button>
          <span style={{ fontSize: 62, fontWeight: 200, color: "var(--text-hi3)", letterSpacing: "-0.02em", lineHeight: 1, minWidth: 60, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
            {partySize}
          </span>
          <button onClick={() => setPartySize(p => Math.min(20, p + 1))}
            style={{ width: 44, height: 44, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 300, background: "var(--surf-3)", border: "1.5px solid var(--bdr-6)", color: "var(--text-warm5)", cursor: "pointer" }}>+</button>
        </div>

        {/* Name */}
        <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text-muted3)", marginBottom: 6 }}>Name</p>
        <input
          type="text" value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && submit()} placeholder="Guest name" autoFocus
          style={{ width: "100%", background: "var(--surf-3)", border: "1.5px solid var(--bdr-1)", borderRadius: 12, color: "var(--text-hi)", fontSize: 15, padding: "11px 13px", marginBottom: 12, outline: "none", boxSizing: "border-box" }}
        />

        {/* Phone */}
        <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text-muted3)", marginBottom: 6 }}>
          Phone <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "var(--text-dim4)" }}>— opt.</span>
        </p>
        <input
          type="tel" value={phone} onChange={e => setPhone(e.target.value)}
          onKeyDown={e => e.key === "Enter" && submit()} placeholder="(555) 000-0000"
          style={{ width: "100%", background: "var(--surf-3)", border: "1.5px solid var(--bdr-1)", borderRadius: 12, color: "var(--text-hi)", fontSize: 15, padding: "11px 13px", marginBottom: 14, outline: "none", boxSizing: "border-box" }}
        />

        {/* Inline wait quote */}
        <div style={{ borderTop: "1px solid var(--surf-4)", paddingTop: 12, marginBottom: 4 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text-muted3)", margin: 0 }}>
              Quote Wait
            </p>
            {waitMins !== null && (
              <button onClick={() => setWaitMins(null)} style={{ fontSize: 9, color: "var(--text-dim6)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                skip →
              </button>
            )}
          </div>

          {/* Preset buttons */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 4, marginBottom: 10 }}>
            {PRESETS.map(p => (
              <button key={p} onClick={() => setWaitMins(p)}
                style={{
                  height: 34, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                  background: waitMins === p ? "var(--bdr-3)" : "var(--surf-6)",
                  border: `1px solid ${waitMins === p ? "var(--bdr-9)" : "var(--surf-4)"}`,
                  cursor: "pointer", transition: "all 0.1s",
                }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: waitMins === p ? "rgba(255,230,190,0.97)" : "var(--text-muted2)" }}>{p}</span>
              </button>
            ))}
          </div>

          {/* Fine-tune stepper */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px" }}>
            <button onClick={() => setWaitMins(m => Math.max(1, (m ?? 15) - 1))}
              style={{ width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surf-3)", border: "1px solid var(--bdr-3)", color: "var(--text-warm5)", cursor: "pointer", fontSize: 16 }}>−</button>
            <span style={{ fontSize: 28, fontWeight: 700, color: waitMins !== null ? "var(--text-hi3)" : "var(--text-dim5)", letterSpacing: "-0.02em", minWidth: 50, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
              {waitMins ?? "—"}
            </span>
            <button onClick={() => setWaitMins(m => Math.min(120, (m ?? 14) + 1))}
              style={{ width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surf-3)", border: "1px solid var(--bdr-3)", color: "var(--text-warm5)", cursor: "pointer", fontSize: 16 }}>+</button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: "10px 14px 14px", borderTop: "1px solid var(--surf-7)", flexShrink: 0 }}>
        {error && <p style={{ fontSize: 11, color: "rgba(248,113,113,0.90)", textAlign: "center", marginBottom: 8 }}>{error}</p>}
        <button onClick={submit} disabled={loading}
          style={{
            width: "100%", height: 48, borderRadius: 14, border: "none", cursor: loading ? "default" : "pointer",
            background: loading ? "var(--surf-5)" : "#22c55e",
            color: "white", fontSize: 13, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase",
            opacity: loading ? 0.5 : 1, transition: "opacity 0.12s",
          }}>
          {loading ? "Adding…" : waitMins ? `Add · ${waitMins}m wait` : "Add to Queue"}
        </button>
      </div>
    </div>
  )
}

// ── Header logo — extracted so eslint-disable works reliably ──────────────────
function HeaderLogo({ src, name }: { src: string; name: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={name} style={{ height: 36, width: "auto", objectFit: "contain", flexShrink: 0 }} />
}

// ── Station History Drawer ─────────────────────────────────────────────────────

function StationHistoryDrawer({
  restaurantId, history, tables, localOccupants, onClose, onRestored,
}: {
  restaurantId: string
  history: HistoryEntry[]
  tables: Table[]
  localOccupants: Map<number, LocalOccupant>
  onClose: () => void
  onRestored: () => void
}) {
  const [restoring, setRestoring] = useState<string | null>(null)
  const [seatPicker, setSeatPicker] = useState<HistoryEntry | null>(null)
  const [seating, setSeating] = useState<string | null>(null)
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null)

  const fmtTime = (iso: string) => {
    try { return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }) } catch { return "—" }
  }

  const copyPhone = async (phone: string, id: string) => {
    try { await navigator.clipboard.writeText(phone); setCopiedPhone(id); setTimeout(() => setCopiedPhone(null), 2000) } catch {}
  }

  const restore = async (e: HistoryEntry) => {
    setRestoring(e.id)
    try {
      const r = await fetch(`${API}/queue/${e.id}/restore`, { method: "POST" })
      if (r.ok) { onRestored(); onClose() }
    } catch {}
    setRestoring(null)
  }

  const seatAtTable = async (entry: HistoryEntry, tableId: string) => {
    setSeating(entry.id)
    try {
      await fetch(`${API}/queue/${entry.id}/restore`, { method: "POST" })
      await fetch(`${API}/queue/${entry.id}/seat-to-table/${tableId}`, { method: "POST" })
      onRestored()
    } catch {}
    setSeating(null)
    setSeatPicker(null)
    onClose()
  }

  const seated  = history.filter(e => e.status === "seated")
  const removed = history.filter(e => e.status === "removed")
  const availableTables = tables.filter(t => !localOccupants.has(t.table_number) && t.status === "available")

  // Suppress unused variable warning — restaurantId may be used in future
  void restaurantId

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "stretch", justifyContent: "flex-end" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.60)", backdropFilter: "blur(6px)" }} onClick={onClose} />
      <div style={{
        position: "relative", width: "100%", maxWidth: 400, height: "100%",
        display: "flex", flexDirection: "column", overflow: "hidden",
        background: "var(--card-bg)", borderLeft: "1px solid var(--header-border)",
        zIndex: 1,
      }}>
        {/* Header */}
        <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid var(--divider)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
            <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--text-muted)" }}>Today&apos;s History</p>
            <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surf-1)", border: "1px solid var(--bdr-1)", cursor: "pointer", color: "var(--text-muted)" }}>
              <X style={{ width: 13, height: 13 }} />
            </button>
          </div>
          <p style={{ fontSize: 16, fontWeight: 800, color: "var(--text-hi)" }}>{seated.length} seated · {removed.length} removed</p>
        </div>

        {/* Summary chips */}
        <div style={{ display: "flex", gap: 8, padding: "10px 20px", borderBottom: "1px solid var(--divider)", flexShrink: 0 }}>
          {[
            { label: "Seated Today", value: seated.length, color: "#22c55e", bg: "rgba(34,197,94,0.10)", bdr: "rgba(34,197,94,0.30)" },
            { label: "Removed Today", value: removed.length, color: "#ef4444", bg: "rgba(239,68,68,0.10)", bdr: "rgba(239,68,68,0.28)" },
          ].map(({ label, value, color, bg, bdr }) => (
            <div key={label} style={{ flex: 1, background: bg, border: `1px solid ${bdr}`, borderRadius: 10, padding: "8px 12px", textAlign: "center" }}>
              <p style={{ fontSize: 22, fontWeight: 900, color, lineHeight: 1 }}>{value}</p>
              <p style={{ fontSize: 10, fontWeight: 600, color, opacity: 0.75, marginTop: 3 }}>{label}</p>
            </div>
          ))}
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px" }}>
          {history.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 0", gap: 8, textAlign: "center" }}>
              <Clock style={{ width: 28, height: 28, color: "var(--text-dim)" }} />
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-warm)" }}>No history yet today</p>
              <p style={{ fontSize: 12, color: "var(--text-muted)", maxWidth: 200, lineHeight: 1.6 }}>Seated and removed guests appear here throughout the day.</p>
            </div>
          ) : (
            [
              { key: "removed", label: "Removed", color: "#ef4444", borderColor: "rgba(239,68,68,0.55)", items: removed },
              { key: "seated",  label: "Seated",  color: "#22c55e", borderColor: "rgba(34,197,94,0.55)",  items: seated  },
            ].filter(s => s.items.length > 0).map(section => (
              <div key={section.key} style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, padding: "0 2px" }}>
                  <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--text-muted)" }}>{section.label}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: section.color }}>{section.items.length}</span>
                </div>
                <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid var(--bdr-1)" }}>
                  {section.items.map((e, i) => (
                    <div key={e.id} style={{
                      padding: "11px 14px",
                      background: i % 2 === 0 ? "var(--surf-1)" : "var(--card-bg)",
                      borderTop: i > 0 ? "1px solid var(--bdr-1)" : "none",
                    }}>
                      {/* Name + time row */}
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 3, height: 32, borderRadius: 2, background: section.color, opacity: 0.65, flexShrink: 0 }} />
                          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-hi)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name || "Guest"}</span>
                        </div>
                        <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0, marginLeft: 8 }}>{fmtTime(e.arrival_time)}</span>
                      </div>
                      {/* Party + wait */}
                      <div style={{ fontSize: 11, color: "var(--text-warm)", display: "flex", gap: 6, marginLeft: 9, marginBottom: 8 }}>
                        <span>{e.party_size} {e.party_size === 1 ? "guest" : "guests"}</span>
                        {e.quoted_wait != null && <><span style={{ opacity: 0.4 }}>·</span><span>{e.quoted_wait}m quoted</span></>}
                        {e.notes && <><span style={{ opacity: 0.4 }}>·</span><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 100 }}>{e.notes}</span></>}
                      </div>
                      {/* Phone + actions */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 9 }}>
                        {e.phone ? (
                          <button onClick={() => copyPhone(e.phone!, e.id)}
                            style={{ flex: "0 0 auto", height: 28, padding: "0 10px", borderRadius: 7, fontSize: 11, fontWeight: 600,
                              background: copiedPhone === e.id ? "rgba(34,197,94,0.12)" : "var(--surf-4)",
                              color: copiedPhone === e.id ? "#22c55e" : "var(--text-warm2)",
                              border: `1px solid ${copiedPhone === e.id ? "rgba(34,197,94,0.35)" : "var(--bdr-5)"}`,
                              cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                            {copiedPhone === e.id ? "✓ Copied" : e.phone}
                          </button>
                        ) : (
                          <span style={{ fontSize: 11, color: "var(--text-dim)", fontStyle: "italic" }}>No phone</span>
                        )}
                        <div style={{ flex: 1 }} />
                        <button onClick={() => setSeatPicker(e)}
                          style={{ height: 28, padding: "0 10px", borderRadius: 7, fontSize: 11, fontWeight: 700,
                            background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.30)", cursor: "pointer" }}>
                          Seat
                        </button>
                        <button onClick={() => restore(e)} disabled={restoring === e.id}
                          style={{ height: 28, padding: "0 10px", borderRadius: 7, fontSize: 11, fontWeight: 700,
                            background: "var(--surf-1)", color: "var(--text-warm)", border: "1px solid var(--bdr-1)",
                            cursor: "pointer", opacity: restoring === e.id ? 0.5 : 1 }}>
                          {restoring === e.id ? "…" : "Waitlist"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Seat-at-table picker */}
      {seatPicker && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "flex-end" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }} onClick={() => setSeatPicker(null)} />
          <div style={{ position: "relative", width: "100%", maxWidth: 440, margin: "0 auto", borderRadius: "20px 20px 0 0", padding: "24px 20px", background: "var(--card-bg)", border: "1px solid var(--header-border)", zIndex: 1 }}>
            <p style={{ fontSize: 15, fontWeight: 800, color: "var(--text-hi)", marginBottom: 4 }}>
              Seat {seatPicker.name || "Guest"} ({seatPicker.party_size}p)
            </p>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>Choose an available table:</p>
            {availableTables.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: "24px 0" }}>No tables available right now</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16 }}>
                {availableTables.map(t => (
                  <button key={t.id} onClick={() => seatAtTable(seatPicker, t.id)} disabled={seating === seatPicker.id}
                    style={{ height: 58, borderRadius: 10, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
                      background: "rgba(34,197,94,0.10)", border: "1px solid rgba(34,197,94,0.30)", cursor: "pointer", opacity: seating === seatPicker.id ? 0.5 : 1 }}>
                    <span style={{ fontSize: 20, fontWeight: 900, color: "#22c55e" }}>{t.table_number}</span>
                    <span style={{ fontSize: 9, color: "#22c55e", opacity: 0.7 }}>{t.capacity}p</span>
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => setSeatPicker(null)}
              style={{ width: "100%", padding: "11px 0", borderRadius: 10, background: "var(--surf-1)", border: "1px solid var(--bdr-1)", color: "var(--text-warm)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────

export default function HostDashboard() {
  const [restaurantId,   setRestaurantId]   = useState<string>("")
  const [restaurantName, setRestaurantName] = useState<string>("")
  const [restaurantLogo, setRestaurantLogo] = useState<string>("")
  const [zoom, setZoom] = useState(() => { try { return parseFloat(localStorage.getItem("host_walnut_zoom") || "1") } catch { return 1 } })
  useEffect(() => { try { localStorage.setItem("host_walnut_zoom", String(zoom)) } catch {} }, [zoom])
  const [theme, setTheme] = useState<"dark" | "light">(() => { try { return (localStorage.getItem("host_walnut_theme") as "dark" | "light") || "dark" } catch { return "dark" } })
  useEffect(() => { try { localStorage.setItem("host_walnut_theme", theme) } catch {} }, [theme])
  const [tables, setTables]               = useState<Table[]>([])
  const [queue, setQueue]                 = useState<QueueEntry[]>([])
  const [online, setOnline]               = useState(true)
  const [lastSync, setLastSync]           = useState(new Date())
  const [showAdd, setShowAdd]             = useState(false)
  const [waitModal, setWaitModal]         = useState<{ id: string; defaultMinutes: number } | null>(null)
  const [editModal, setEditModal]         = useState<{ entry: QueueEntry; displayWait: number } | null>(null)
  const [avgWait, setAvgWait]             = useState(0)
  const [activeDragEntry, setActiveDrag]  = useState<QueueEntry | null>(null)
  const [activeDragOccupant, setActiveDragOccupant] = useState<{ tableNumber: number; occupant: LocalOccupant } | null>(null)
  const [seatPicker, setSeatPicker]             = useState<QueueEntry | null>(null)
  const [selectedEntry, setSelectedEntry]       = useState<QueueEntry | null>(null)
  const [clearConfirm, setClearConfirm]         = useState<{ tableId: string | undefined; tableNumber: number; occupant: LocalOccupant } | null>(null)
  const [tableTapModal, setTableTapModal]       = useState<{ tableNumber: number; tableId: string | undefined; capacity: number | undefined } | null>(null)
  // Active table-move: host tapped "Move" in the table popup; floor map becomes a target picker
  const [pendingTableMove, setPendingTableMove] = useState<{ tableId: string | undefined; tableNumber: number; occupant: LocalOccupant } | null>(null)
  const [showHistory, setShowHistory]     = useState(false)
  const [showHelp,    setShowHelp]        = useState(false)
  const [history,     setHistory]         = useState<HistoryEntry[]>([])
  const [sidebarW, setSidebarW]           = useState(300)
  const isResizing = useRef(false)
  const resizeStartX = useRef(0)
  const resizeStartW = useRef(0)
  // Auto-prompt: tracks which entry IDs we've seen so we detect truly-new joiners
  // null = initial load not yet completed (don't prompt on first fetch)
  const seenEntryIdsRef = useRef<Set<string> | null>(null)
  // Mirror of waitModal in a ref so the auto-prompt effect can read it without being in deps
  const waitModalRef = useRef<{ id: string; defaultMinutes: number } | null>(null)

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
  const [now, setNow]                     = useState(() => new Date())
  // localOccupants is intentionally not pre-loaded here — we don't know which restaurant
  // we belong to yet. It gets loaded in the effect below once restaurantId is known.
  const [localOccupants, setLocalOccupants] = useState<Map<number, LocalOccupant>>(new Map())
  const localOccupantsLoadedRef = useRef(false)

  // ── Client-side history tracking ──────────────────────────────────────────
  // Stores seated/removed entries locally so history works even when the backend
  // /queue/history endpoint is unavailable. Persisted to localStorage, scoped
  // to the current restaurant and cleared at the 3am business day boundary.
  const localHistoryRef = useRef<HistoryEntry[]>([])
  // Mirror of queue state accessible in callbacks without causing dep array churn
  const queueRef = useRef<QueueEntry[]>([])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  // Load occupants from the restaurant-scoped key once restaurantId is known.
  // This prevents one client's floor map state from bleeding into another.
  useEffect(() => {
    if (!restaurantId || localOccupantsLoadedRef.current) return
    localOccupantsLoadedRef.current = true
    try {
      const s = localStorage.getItem(`host_occupants_${restaurantId}`)
      if (s) setLocalOccupants(new Map(JSON.parse(s) as [number, LocalOccupant][]))
    } catch {}
  }, [restaurantId])

  // Persist floor map occupancy to a restaurant-scoped localStorage key.
  // Compare JSON before writing to skip the write when nothing changed — the poll loop
  // creates a new Map reference every 4s even if content is identical, which would
  // otherwise block the iPad main thread with a serialization + write on every tick.
  useEffect(() => {
    if (!restaurantId) return
    try {
      const next = JSON.stringify([...localOccupants])
      if (next !== localStorage.getItem(`host_occupants_${restaurantId}`)) {
        localStorage.setItem(`host_occupants_${restaurantId}`, next)
      }
    } catch {}
  }, [localOccupants, restaurantId])

  // Live clock — ticks every 30s for urgency updates
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])

  const fetchingRef        = useRef(false)
  const failCountRef       = useRef(0)
  const pollTimerRef       = useRef<ReturnType<typeof setTimeout> | null>(null)
  // On the very first occupants fetch after mount, skip server-authoritative removal so
  // localStorage-restored occupants (e.g. a guest just moved to a new table) are not
  // wiped before the server can confirm them. After the first successful fetch this flag
  // is cleared and normal reconciliation resumes.
  const firstOccupantsFetchRef = useRef(true)
  // Tracks when history was last fetched so the poll loop only fetches every 30s.
  // Mutation-triggered calls (setTimeout(fetchHistory, 600)) bypass this via fetchHistory directly.
  const lastHistoryFetchRef = useRef<number>(0)
  // Tables whose clear API call is still in-flight. refreshAll must not revert these to "occupied".
  const pendingClearsRef = useRef<Set<number>>(new Set())
  // Tables whose occupy API call is still in-flight. refreshAll must not evict these from localOccupants.
  // Without this, a poll that fires between the optimistic UI update and the occupy response will
  // see the target as "not occupied" on the server and remove it — causing the guest to disappear.
  const pendingOccupiesRef = useRef<Set<number>>(new Set())
  // React state mirror of pendingClearsRef — drives instant green on DroppableFloorTable via forceAvailable.
  const [locallyAvailableTables, setLocallyAvailableTables] = useState<Set<number>>(new Set())

  // Keep queueRef in sync so addToLocalHistory can read the latest queue without dep issues
  useEffect(() => { queueRef.current = queue }, [queue])

  // Load local history from localStorage once we know the restaurant ID, and reset if new business day
  useEffect(() => {
    if (!restaurantId) return
    const bd = getBusinessDate()
    const key = `host_history_${restaurantId}`
    try {
      const stored = localStorage.getItem(key)
      if (stored) {
        const parsed = JSON.parse(stored) as { bdate: string; entries: HistoryEntry[] }
        if (parsed.bdate === bd && Array.isArray(parsed.entries)) {
          localHistoryRef.current = parsed.entries
          setHistory(parsed.entries)  // show local history immediately
        } else {
          localStorage.removeItem(key)
        }
      }
    } catch {}
  }, [restaurantId])

  // Fetch restaurant config on mount
  useEffect(() => {
    fetch("/api/client/me")
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return
        if (d.rid)     setRestaurantId(d.rid)
        if (d.name)    setRestaurantName(d.name)
        if (d.logoUrl) setRestaurantLogo(d.logoUrl)
      })
      .catch(() => {})
  }, [])

  // Save local history to localStorage (restaurant-scoped, tagged with business date)
  const saveLocalHistory = useCallback(() => {
    if (!restaurantId) return
    try {
      localStorage.setItem(`host_history_${restaurantId}`, JSON.stringify({ bdate: getBusinessDate(), entries: localHistoryRef.current }))
    } catch {}
  }, [restaurantId])

  // Add a queue entry to local history when it's seated or removed.
  // This makes history work immediately and persists across refreshes even when server is down.
  const addToLocalHistory = useCallback((entry: QueueEntry, finalStatus: "seated" | "removed") => {
    const histEntry: HistoryEntry = {
      id: entry.id,
      name: entry.name,
      party_size: entry.party_size,
      status: finalStatus,
      arrival_time: entry.arrival_time,
      quoted_wait: entry.quoted_wait,
      phone: entry.phone,
      notes: entry.notes,
    }
    // Remove any previous entry with the same ID (e.g., if guest was restored then re-removed)
    localHistoryRef.current = [histEntry, ...localHistoryRef.current.filter(e => e.id !== entry.id)]
    saveLocalHistory()
    // Immediately reflect in state (server fetch will merge on top later)
    setHistory(localHistoryRef.current)
  }, [saveLocalHistory])

  // fetchHistory is decoupled from the fetchingRef guard so it always runs after mutations.
  // It merges server data on top of local history — server entries take priority,
  // but local-only entries fill any gaps (e.g., when server is temporarily unavailable).
  // Stamps lastHistoryFetchRef so the poll loop can rate-limit to every 30s.
  const fetchHistory = useCallback(() => {
    if (!restaurantId) return
    lastHistoryFetchRef.current = Date.now()
    const bd = getBusinessDate()
    const filterToday = (entries: HistoryEntry[]) => entries.filter(e => {
      try {
        const d = new Date(e.arrival_time)
        const hour = d.getHours()
        if (hour < 3) {
          const prev = new Date(d); prev.setDate(prev.getDate() - 1)
          return prev.toLocaleDateString("en-CA") === bd
        }
        return d.toLocaleDateString("en-CA") === bd
      } catch { return false }
    })
    // Compute local history (used to fill gaps when server is down/empty)
    // We deliberately do NOT setHistory here — that double-render causes the visible flash
    // every polling cycle. Local history is already loaded at mount via the localStorage effect.
    const localToday = filterToday(localHistoryRef.current)

    fetch(`${API}/queue/history?restaurant_id=${restaurantId}`)
      .then(r => r.ok ? r.json() : [])
      .then((all: unknown) => {
        const serverToday = Array.isArray(all) ? filterToday(all as HistoryEntry[]) : []
        if (serverToday.length > 0) {
          // Merge: server entries take priority; local-only entries fill gaps
          const serverIds = new Set(serverToday.map(e => e.id))
          const localOnly = localToday.filter(e => !serverIds.has(e.id))
          const merged = [...serverToday, ...localOnly].sort(
            (a, b) => new Date(b.arrival_time).getTime() - new Date(a.arrival_time).getTime()
          )
          setHistory(merged)
          localHistoryRef.current = merged
          saveLocalHistory()
        } else if (localToday.length > 0) {
          // Server returned nothing — show local (handles offline / server down)
          setHistory(localToday)
        }
      })
      .catch(() => {
        // Network error — local history (already shown from mount effect) stands
      })
  }, [restaurantId, saveLocalHistory])

  const refreshAll = useCallback(async () => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    try {
      const rid = restaurantId
      const [stateRes, occupantsRes] = await Promise.all([
        fetch(`${API}/state${rid ? `?restaurant_id=${rid}` : ""}`),
        rid ? fetch(`${API}/tables/occupants?restaurant_id=${rid}`) : Promise.resolve(null),
      ])
      if (stateRes.ok) {
        const d = await stateRes.json()
        setQueue(d.queue ?? [])
        // If any table clears are still in-flight, don't let the server response
        // revert them back to "occupied" — that's what causes a guest to appear on 2 tables.
        const serverTables: Table[] = d.tables ?? []
        setTables(prev => {
          if (pendingClearsRef.current.size === 0) return serverTables
          return serverTables.map(t =>
            pendingClearsRef.current.has(t.table_number)
              ? { ...t, status: "available" as const }
              : t
          )
        })
        // locallyAvailableTables is cleaned up in the occupants section below,
        // coupled directly to pendingClearsRef so they always move together.
        setAvgWait(d.avg_wait ?? 0)
        setOnline(true)
        setLastSync(new Date())
        failCountRef.current = 0
      } else {
        setOnline(false)
        failCountRef.current++
      }
      // Sync localOccupants from server.
      // Rules:
      //  - ADD/UPDATE tables the server shows as occupied (unless a clear is in-flight for them)
      //  - REMOVE tables that the server says are free AND have no pending clear in-flight
      //    (this fixes "names remaining after clear" — the stale local entry is evicted)
      //  - Clean up pendingClearsRef for any table the server has confirmed is now free.
      //    This is the authoritative place to remove from pendingClearsRef — NOT in the API
      //    callback — so we only stop protecting a table once the server confirms it's gone.
      if (occupantsRes && occupantsRes.ok) {
        const raw = await occupantsRes.json() as Record<string, { name: string; party_size: number; entry_id?: string }>
        const serverOccupiedNums = new Set(Object.keys(raw).map(k => parseInt(k, 10)))
        // Server confirmed these are free — stop protecting them AND drop forceAvailable.
        // locallyAvailableTables lifetime is EXACTLY pendingClearsRef lifetime:
        // both are added together (clearTable / move source) and removed together here.
        // This prevents the race where a status-based cleanup loop fires on source tables
        // while their clear is still in-flight (server still says "occupied") and
        // incorrectly removes forceAvailable, causing the table to flicker or lock red.
        const confirmedFree: number[] = []
        pendingClearsRef.current.forEach(num => {
          if (!serverOccupiedNums.has(num)) {
            pendingClearsRef.current.delete(num)
            confirmedFree.push(num)
          }
        })
        if (confirmedFree.length > 0) {
          setLocallyAvailableTables(prev => {
            if (prev.size === 0) return prev
            const next = new Set(prev)
            confirmedFree.forEach(n => next.delete(n))
            return next.size === prev.size ? prev : next
          })
        }
        // Server confirmed these are occupied — the occupy call landed, safe to stop protecting
        pendingOccupiesRef.current.forEach(num => {
          if (serverOccupiedNums.has(num)) pendingOccupiesRef.current.delete(num)
        })
        setLocalOccupants(prev => {
          const next = new Map(prev)
          // Add/update from server, skip tables whose clear is still in-flight
          for (const [numStr, occ] of Object.entries(raw)) {
            const num = parseInt(numStr, 10)
            if (!pendingClearsRef.current.has(num)) {
              next.set(num, { name: occ.name || "Guest", party_size: occ.party_size || 2, entry_id: occ.entry_id })
            }
          }
          // Server-authoritative removal: evict any local entry the server says is gone
          // and no in-flight operation is protecting it.
          // Skipped on the very first fetch after mount — localStorage may have restored
          // a guest that was just moved (APIs still in-flight or server restarted), and
          // removing them immediately would revert the move before the server catches up.
          if (!firstOccupantsFetchRef.current) {
            next.forEach((_, num) => {
              if (!serverOccupiedNums.has(num) && !pendingClearsRef.current.has(num) && !pendingOccupiesRef.current.has(num)) {
                next.delete(num)
              }
            })
          }
          firstOccupantsFetchRef.current = false
          return next
        })
      }
    } catch {
      setOnline(false)
      failCountRef.current++
    } finally {
      fetchingRef.current = false
    }
    // Rate-limit history fetches to every 30s from the poll loop.
    // Mutation callbacks (seat/remove/clear) still call fetchHistory directly via setTimeout,
    // which bypasses this guard and always fires immediately after a change.
    if (Date.now() - lastHistoryFetchRef.current >= 30_000) {
      fetchHistory()
    }
  }, [restaurantId, fetchHistory])

  useEffect(() => {
    refreshAll()
    const tick = () => {
      const interval = failCountRef.current >= 3 ? 15_000 : 4_000
      pollTimerRef.current = setTimeout(() => { refreshAll(); tick() }, interval)
    }
    tick()
    return () => { if (pollTimerRef.current) clearTimeout(pollTimerRef.current) }
  }, [refreshAll])

  // Pause polling when iPad screen locks, resume immediately on wake
  useEffect(() => {
    const onVis = () => { if (!document.hidden) refreshAll() }
    document.addEventListener("visibilitychange", onVis)
    return () => document.removeEventListener("visibilitychange", onVis)
  }, [refreshAll])

  // Keep waitModalRef in sync with waitModal state (lets auto-prompt read it without being in deps)
  useEffect(() => { waitModalRef.current = waitModal }, [waitModal])

  // Auto-prompt for quoted wait when a new guest joins (NFC or otherwise).
  // On the first fetch we just record existing IDs so we don't prompt for pre-existing entries.
  useEffect(() => {
    if (queue.length === 0 && seenEntryIdsRef.current === null) return

    // First successful load — populate seen set, don't prompt
    if (seenEntryIdsRef.current === null) {
      seenEntryIdsRef.current = new Set(queue.map(e => e.id))
      return
    }

    // Find a new waiting entry that hasn't been quoted yet
    const newEntry = queue.find(e =>
      e.status === "waiting" &&
      e.quoted_wait == null &&
      !seenEntryIdsRef.current!.has(e.id)
    )

    // Mark all current entries as seen
    queue.forEach(e => seenEntryIdsRef.current!.add(e.id))

    // New unquoted guests appear in the blue "Needs Quote" section at the top of the sidebar
    // (non-blocking — host can quote when ready)
    void newEntry
  }, [queue])

  const seat   = useCallback(async (id: string) => {
    const entry = queueRef.current.find(e => e.id === id)
    if (entry) addToLocalHistory(entry, "seated")
    try { await fetch(`${API}/queue/${id}/seat`, { method: "POST" }) } catch {}
    refreshAll(); setTimeout(fetchHistory, 600)
  }, [refreshAll, fetchHistory, addToLocalHistory])
  const notify = useCallback(async (id: string) => { try { await fetch(`${API}/queue/${id}/notify`, { method: "POST" }) } catch {} refreshAll() }, [refreshAll])
  const remove = useCallback(async (id: string) => {
    const entry = queueRef.current.find(e => e.id === id)
    if (entry) addToLocalHistory(entry, "removed")
    try { await fetch(`${API}/queue/${id}/remove`, { method: "POST" }) } catch {}
    refreshAll(); setTimeout(fetchHistory, 600)
  }, [refreshAll, fetchHistory, addToLocalHistory])

  // Quick "+5 min" — extends the guest's quoted wait by 5 minutes from now.
  // Uses the current remaining time (displayWait) + 5 so the deadline shifts forward.
  const addTime = useCallback(async (id: string, currentDisplayWait: number) => {
    const newMinutes = Math.max(1, currentDisplayWait + 5)
    try { await fetch(`${API}/queue/${id}/wait?minutes=${newMinutes}`, { method: "PATCH" }) } catch {}
    refreshAll()
  }, [refreshAll])

  const openSeatPicker = useCallback((entry: QueueEntry) => {
    setSeatPicker(entry)
    setSelectedEntry(null)
  }, [])

  const confirmSeat = useCallback(async (entry: QueueEntry, tableNumber: number, tableId: string | undefined) => {
    setSeatPicker(null)
    addToLocalHistory(entry, "seated")
    // Cancel any pending-clear on this table — a new guest is being placed here
    pendingClearsRef.current.delete(tableNumber)
    // Drop forceAvailable immediately so the table color can turn red right away
    setLocallyAvailableTables(prev => { const n = new Set(prev); n.delete(tableNumber); return n })
    if (tableId) {
      await fetch(`${API}/queue/${entry.id}/seat-to-table/${tableId}`, { method: "POST" })
    } else {
      await fetch(`${API}/queue/${entry.id}/seat`, { method: "POST" })
    }
    setLocalOccupants(prev => new Map(prev).set(tableNumber, { name: entry.name || "Guest", party_size: entry.party_size, entry_id: entry.id }))
    refreshAll()
    setTimeout(fetchHistory, 600)
  }, [refreshAll, fetchHistory, addToLocalHistory])

  const clearTable = useCallback(async (tableId: string | undefined, tableNumber: number, entryId?: string, mode: "restore" | "cancel" = "cancel") => {
    // flushSync forces the optimistic render to commit NOW, before the network call starts —
    // the table is painted green in the same tick as the click.
    flushSync(() => {
      setLocalOccupants(prev => { const n = new Map(prev); n.delete(tableNumber); return n })
      setLocallyAvailableTables(prev => new Set(prev).add(tableNumber))
      setTables(prev => prev.map(t => t.table_number === tableNumber ? { ...t, status: "available" as const } : t))
    })
    pendingClearsRef.current.add(tableNumber)
    if (tableId) {
      try { await fetch(`${API}/tables/${tableId}/clear`, { method: "POST" }) } catch {}
    }
    if (entryId) {
      if (mode === "restore") {
        try { await fetch(`${API}/queue/${entryId}/restore`, { method: "POST" }) } catch {}
      } else {
        try { await fetch(`${API}/queue/${entryId}/remove`, { method: "POST" }) } catch {}
      }
    }
    // Do NOT remove tableNumber from pendingClearsRef here — refreshAll is the authoritative
    // place that cleans up pendingClearsRef only once the server confirms the table is free.
    // Removing it here (before the next refreshAll) caused stale server data to re-add the
    // occupant, leaving names on cleared tables with no color.
    refreshAll()  // refreshAll cleans up pendingClearsRef + locallyAvailableTables from server
    setTimeout(fetchHistory, 600)
  }, [refreshAll, fetchHistory])

  // ── Table-move (tap-to-move alternative to drag-and-drop) ─────────────
  // Triggered by the "Move" button in the occupied-table popup. Works like
  // the drag-and-drop path but uses tap selection instead.
  const executeTableMove = useCallback((toTableNumber: number, toTableId: string | undefined) => {
    if (!pendingTableMove) return
    const { tableId: fromTableId, tableNumber: fromTableNumber, occupant } = pendingTableMove
    setPendingTableMove(null)
    if (fromTableNumber === toTableNumber) return

    // Optimistic UI: same as handleDragEnd table-to-table
    const displaced = localOccupants.get(toTableNumber)
    flushSync(() => {
      setLocalOccupants(prev => {
        const next = new Map(prev)
        next.delete(fromTableNumber)
        if (displaced) next.set(fromTableNumber, displaced)
        next.set(toTableNumber, occupant)
        return next
      })
      setLocallyAvailableTables(prev => {
        const n = new Set(prev)
        n.add(fromTableNumber)      // source turns green (cleared)
        n.delete(toTableNumber)     // target must NOT be forceAvailable — it's now occupied
        return n
      })
      setTables(prev => prev.map(t =>
        t.table_number === fromTableNumber ? { ...t, status: "available" as const } :
        t.table_number === toTableNumber   ? { ...t, status: "occupied"  as const } :
        t
      ))
    })

    pendingClearsRef.current.add(fromTableNumber)
    pendingClearsRef.current.delete(toTableNumber)
    pendingOccupiesRef.current.add(toTableNumber)

    const calls: Promise<unknown>[] = []
    if (fromTableId) calls.push(fetch(`${API}/tables/${fromTableId}/clear`, { method: "POST" }))
    if (toTableId)   calls.push(fetch(`${API}/tables/${toTableId}/occupy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: occupant.name, party_size: occupant.party_size, entry_id: occupant.entry_id }),
    }))
    Promise.all(calls).then(() => refreshAll()).catch(() => refreshAll())
  }, [pendingTableMove, localOccupants, refreshAll])

  // ── DnD handlers ──────────────────────────────────────────────────────

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

    // Table-to-table: move a seated guest to another table (swap if both occupied)
    if (data?.type === "occupant") {
      const sourceTable = data.tableNumber as number
      const occupant = data.occupant as LocalOccupant
      if (sourceTable === targetTable) return

      // 1. Instant optimistic UI.
      //    - Remove occupant from source, add to target in localOccupants.
      //    - Add source to locallyAvailableTables so DroppableFloorTable renders it
      //      green immediately via forceAvailable, bypassing table.status entirely.
      //      This is the guaranteed-instant path — React state, same render cycle.
      // flushSync forces React to paint the optimistic state synchronously, before this handler
      // returns. Without it, React can batch the render to the next frame, which on a slow iPad
      // feels like lag. Combined with the tables/locallyAvailableTables updates below, the source
      // table turns green in the same tick the drag ends.
      flushSync(() => {
        setLocalOccupants(prev => {
          const next = new Map(prev)
          next.delete(sourceTable)
          const displaced = prev.get(targetTable)
          if (displaced) next.set(sourceTable, displaced)
          next.set(targetTable, occupant)
          return next
        })
        setLocallyAvailableTables(prev => new Set(prev).add(sourceTable))
        setTables(prev => prev.map(t =>
          t.table_number === sourceTable ? { ...t, status: "available" as const } :
          t.table_number === targetTable ? { ...t, status: "occupied" as const } :
          t
        ))
      })

      // 2. Register source as pending-clear so refreshAll won't re-add its stale occupant.
      //    Register target as pending-occupy so refreshAll won't evict the optimistic occupant
      //    if a poll fires before the occupy API call lands.
      pendingClearsRef.current.add(sourceTable)
      pendingClearsRef.current.delete(targetTable)
      pendingOccupiesRef.current.add(targetTable)

      // 3. Fire API calls in parallel then sync.
      const sourceApiTable = tables.find(t => t.table_number === sourceTable)
      const targetApiTable = tables.find(t => t.table_number === targetTable)
      const calls: Promise<unknown>[] = []
      if (sourceApiTable) calls.push(fetch(`${API}/tables/${sourceApiTable.id}/clear`, { method: "POST" }))
      if (targetApiTable) calls.push(fetch(`${API}/tables/${targetApiTable.id}/occupy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: occupant.name, party_size: occupant.party_size, entry_id: occupant.entry_id }),
      }))
      // refreshAll is the authoritative cleanup for both pendingClearsRef and pendingOccupiesRef —
      // it removes entries only once the server confirms the expected state.
      const finalize = () => refreshAll()
      Promise.all(calls).then(finalize).catch(finalize)
      return
    }

    // Queue-to-table: seat a waiting guest at a table
    const entry = (data as { entry?: QueueEntry } | undefined)?.entry
    if (!entry) return
    if (localOccupants.has(targetTable)) return
    addToLocalHistory(entry, "seated")
    // A new guest is being placed here — cancel any pending-clear protection on this table
    pendingClearsRef.current.delete(targetTable)
    // Drop forceAvailable so the table turns red, not stays green
    setLocallyAvailableTables(prev => { const n = new Set(prev); n.delete(targetTable); return n })
    const apiTable = tables.find(t => t.table_number === targetTable)
    if (apiTable) {
      fetch(`${API}/queue/${entry.id}/seat-to-table/${apiTable.id}`, { method: "POST" })
        .then(() => { refreshAll(); setTimeout(fetchHistory, 600) })
    } else {
      seat(entry.id)
    }
    setLocalOccupants(prev => new Map(prev).set(targetTable, { name: entry.name || "Guest", party_size: entry.party_size, entry_id: entry.id }))
  }

  // Floor availability
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

  // Live clock string
  const clockStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <style>{`
  [data-host-theme="dark"] {
    --accent:255,185,100; --warm:255,200,150; --cream:255,248,240;
    --page-bg:#0C0907; --card-bg:#100C09; --page-deep:#0a0704;
    --header-bg:rgba(7,4,2,0.98); --header-border:rgba(255,185,100,0.18); --divider:rgba(255,185,100,0.16);
    /* text — cream primary */
    --text-hi:rgba(255, 248, 240, 0.92); --text-hi2:rgba(255, 248, 240, 0.97); --text-hi3:rgba(255, 248, 240, 0.95); --text-hi4:rgba(255, 248, 240, 0.88);
    /* text — warm amber secondary */
    --text-warm:rgba(255, 200, 150, 0.75); --text-warm2:rgba(255, 200, 150, 0.65); --text-warm3:rgba(255, 200, 150, 0.80); --text-warm4:rgba(255, 200, 150, 0.90);
    --text-warm5:rgba(255, 200, 150, 0.70); --text-warm6:rgba(255, 200, 150, 0.40);
    /* text — muted */
    --text-muted:rgba(255, 200, 150, 0.55); --text-muted2:rgba(255, 200, 150, 0.50); --text-muted3:rgba(255, 200, 150, 0.45); --text-muted4:rgba(255, 200, 150, 0.60);
    /* text — dim */
    --text-dim:rgba(255, 185, 100, 0.45); --text-dim2:rgba(255, 185, 100, 0.40); --text-dim3:rgba(255, 185, 100, 0.28);
    --text-dim4:rgba(255, 200, 150, 0.28); --text-dim5:rgba(255, 200, 150, 0.25); --text-dim6:rgba(255, 200, 150, 0.30); --text-dim7:rgba(255, 200, 150, 0.35);
    --text-bright:rgba(255, 220, 160, 0.97);
    --text-cream:rgba(255, 240, 220, 0.97); --text-cream2:rgba(255, 240, 220, 0.88);
    /* table states */
    --table-avail-bg:rgba(34,197,94,0.22); --table-avail-border:rgba(34,197,94,0.82); --table-avail-num:#22c55e; --table-avail-cap:rgba(34,197,94,0.90);
    --table-occ-bg:rgba(239,68,68,0.28); --table-occ-border:rgba(239,68,68,0.90); --table-occ-num:rgba(239,68,68,0.95); --table-occ-cap:rgba(239,68,68,0.72);
    --table-name:rgba(255, 240, 220, 0.97);
    --table-over-bg:rgba(34,197,94,0.55); --table-over-border:#22c55e; --table-select-bg:rgba(34,197,94,0.38); --table-select-border:#4ade80;
    --table-none-bg:rgba(255,255,255,0.07); --table-none-border:rgba(255,255,255,0.32); --table-none-dot:rgba(255,255,255,0.28);
    --table-shadow-avail:0 0 0 2px rgba(34,197,94,0.18),inset 0 0 12px rgba(34,197,94,0.06);
    --table-shadow-occ:0 0 0 2px rgba(239,68,68,0.18),inset 0 0 12px rgba(239,68,68,0.08);
    --table-shadow-over:0 0 0 4px rgba(34,197,94,0.35),inset 0 0 20px rgba(34,197,94,0.10);
    /* surfaces */
    --surf-1:rgba(255, 185, 100, 0.07); --surf-2:rgba(255, 185, 100, 0.04); --surf-3:rgba(255, 185, 100, 0.06); --surf-4:rgba(255, 185, 100, 0.12); --surf-5:rgba(255, 185, 100, 0.08);
    --surf-6:rgba(255, 185, 100, 0.05); --surf-7:rgba(255, 185, 100, 0.10); --surf-8:rgba(255, 185, 100, 0.03);
    /* borders */
    --bdr-1:rgba(255, 185, 100, 0.14); --bdr-2:rgba(255, 185, 100, 0.16); --bdr-3:rgba(255, 185, 100, 0.18); --bdr-4:rgba(255, 185, 100, 0.28); --bdr-5:rgba(255, 185, 100, 0.12); --bdr-6:rgba(255, 185, 100, 0.20); --bdr-7:rgba(255, 185, 100, 0.25);
    --bdr-8:rgba(255, 185, 100, 0.22); --bdr-9:rgba(255, 185, 100, 0.55); --bdr-10:rgba(255, 185, 100, 0.11); --bdr-11:rgba(255, 185, 100, 0.30); --bdr-12:rgba(255, 185, 100, 0.50); --bdr-13:rgba(255, 185, 100, 0.15); --bdr-14:rgba(255, 185, 100, 0.09); --bdr-15:rgba(255, 185, 100, 0.35);
    --modal-bg:#100C09; --modal-bg2:#0C0907;
  }
  [data-host-theme="light"] {
    --accent:160,90,0; --warm:110,60,5; --cream:18,10,3;
    --page-bg:#F5F2EE; --card-bg:#FFFFFF; --page-deep:#EDE9E3;
    --header-bg:rgba(252,249,245,0.98); --header-border:rgba(160,90,0,0.18); --divider:rgba(160,90,0,0.14);
    /* text — dark primary */
    --text-hi:rgba(22,12,4,0.90); --text-hi2:rgba(22,12,4,0.95); --text-hi3:rgba(22,12,4,0.92); --text-hi4:rgba(22,12,4,0.85);
    /* text — warm brown secondary */
    --text-warm:rgba(100,55,5,0.85); --text-warm2:rgba(100,55,5,0.75); --text-warm3:rgba(100,55,5,0.90); --text-warm4:rgba(100,55,5,0.95); --text-warm5:rgba(100,55,5,0.80); --text-warm6:rgba(100,55,5,0.58);
    /* text — muted */
    --text-muted:rgba(100,55,5,0.65); --text-muted2:rgba(100,55,5,0.58); --text-muted3:rgba(100,55,5,0.50); --text-muted4:rgba(100,55,5,0.70);
    /* text — dim */
    --text-dim:rgba(130,75,10,0.55); --text-dim2:rgba(130,75,10,0.48); --text-dim3:rgba(130,75,10,0.38);
    --text-dim4:rgba(100,55,5,0.48); --text-dim5:rgba(100,55,5,0.42); --text-dim6:rgba(100,55,5,0.50); --text-dim7:rgba(100,55,5,0.55);
    --text-bright:rgba(100,55,5,0.97);
    --text-cream:rgba(30,14,4,0.94); --text-cream2:rgba(30,14,4,0.82);
    /* table states — high contrast for light bg */
    --table-avail-bg:rgba(22,163,74,0.18); --table-avail-border:#15803d; --table-avail-num:#14532d; --table-avail-cap:#166534;
    --table-occ-bg:rgba(220,38,38,0.16); --table-occ-border:#b91c1c; --table-occ-num:#991b1b; --table-occ-cap:#b91c1c;
    --table-name:rgba(30,14,4,0.94);
    --table-over-bg:rgba(22,163,74,0.40); --table-over-border:#15803d; --table-select-bg:rgba(22,163,74,0.32); --table-select-border:#16a34a;
    --table-none-bg:rgba(150,120,90,0.14); --table-none-border:rgba(120,90,60,0.40); --table-none-dot:rgba(120,90,60,0.45);
    --table-shadow-avail:0 0 0 2px rgba(22,163,74,0.30),inset 0 0 12px rgba(22,163,74,0.10);
    --table-shadow-occ:0 0 0 2px rgba(220,38,38,0.28),inset 0 0 12px rgba(220,38,38,0.10);
    --table-shadow-over:0 0 0 4px rgba(22,163,74,0.40),inset 0 0 20px rgba(22,163,74,0.14);
    /* surfaces */
    --surf-1:rgba(160,90,0,0.07); --surf-2:rgba(160,90,0,0.04); --surf-3:rgba(160,90,0,0.06); --surf-4:rgba(160,90,0,0.12); --surf-5:rgba(160,90,0,0.08); --surf-6:rgba(160,90,0,0.05); --surf-7:rgba(160,90,0,0.10); --surf-8:rgba(160,90,0,0.03);
    /* borders */
    --bdr-1:rgba(160,90,0,0.16); --bdr-2:rgba(160,90,0,0.18); --bdr-3:rgba(160,90,0,0.22); --bdr-4:rgba(160,90,0,0.30); --bdr-5:rgba(160,90,0,0.14); --bdr-6:rgba(160,90,0,0.24); --bdr-7:rgba(160,90,0,0.28);
    --bdr-8:rgba(160,90,0,0.26); --bdr-9:rgba(160,90,0,0.42); --bdr-10:rgba(160,90,0,0.15); --bdr-11:rgba(160,90,0,0.28); --bdr-12:rgba(160,90,0,0.40); --bdr-13:rgba(160,90,0,0.18); --bdr-14:rgba(160,90,0,0.12); --bdr-15:rgba(160,90,0,0.30);
    --modal-bg:#FFFFFF; --modal-bg2:#F5F2EE;
  }
`}</style>
      <div data-host-theme={theme} style={{ width: "100vw", height: "100dvh", overflow: "hidden", position: "relative", background: "var(--page-bg)" }}>
      <div className="flex flex-col" style={{
        width: `${(1 / zoom * 100).toFixed(6)}vw`,
        height: `${(1 / zoom * 100).toFixed(6)}dvh`,
        background: "var(--page-bg)",
        transform: `scale(${zoom})`,
        transformOrigin: "top left",
        overflow: "hidden",
      }}>

        {/* ── Header ─────────────────────────────────────────────────── */}
        <header
          className="flex items-center justify-between px-5 h-12 shrink-0"
          style={{ background: "var(--header-bg)", borderBottom: "1px solid var(--header-border)", backdropFilter: "blur(20px)" }}
        >
          <div className="flex items-center gap-3.5 min-w-0 flex-1 overflow-hidden">
            {/* Restaurant logo / name */}
            {restaurantLogo
              ? <HeaderLogo src={restaurantLogo} name={restaurantName} />
              : <span style={{ fontSize: 15, fontWeight: 800, color: "var(--text-warm4)", letterSpacing: "0.04em", flexShrink: 0 }}>{restaurantName}</span>
            }
            {/* Location label for Walnut restaurants (Original / Southside) */}
            {(restaurantName.includes("Original") || restaurantName.includes("Southside")) && (
              <span className="hidden sm:block text-[10px] font-black tracking-[0.14em] px-2 py-0.5 rounded-md shrink-0" style={{ background: "var(--surf-4)", color: "var(--text-warm)", border: "1px solid rgba(200,144,96,0.25)", textTransform: "uppercase" }}>
                {restaurantName.includes("Original") ? "Original" : "Southside"}
              </span>
            )}

            <div className="w-px h-5 shrink-0" style={{ background: "var(--bdr-6)" }} />

            {/* Stats */}
            <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg shrink-0" style={{ background: "var(--surf-1)", border: "1px solid var(--bdr-2)" }}>
                <span className="text-xs font-bold tabular-nums" style={{ color: available > 0 ? "#22c55e" : "#ef4444" }}>{available}</span>
                <span className="text-xs" style={{ color: "var(--bdr-12)" }}>/{FLOOR_PLAN.length}</span>
                <span className="text-[10px] ml-0.5" style={{ color: "var(--text-muted4)" }}>free</span>
              </div>
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg shrink-0" style={{ background: "var(--surf-1)", border: "1px solid var(--bdr-2)" }}>
                <span className="text-xs font-bold tabular-nums" style={{ color: waitingList.length > 0 ? "#f97316" : "var(--text-muted4)" }}>{waitingList.length}</span>
                <span className="text-[10px]" style={{ color: "var(--text-muted4)" }}>waiting</span>
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
              style={{ color: "var(--text-warm2)", letterSpacing: "0.04em" }}
            >
              {clockStr}
            </span>
            {/* Analog view — only for Walnut restaurants */}
            {(restaurantName.includes("Original") || restaurantName.includes("Southside")) && (
              <Link href="/analog" className="hidden sm:flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-medium hover:bg-white/8 transition-colors" style={{ color: "var(--text-warm2)" }}>
                <Activity className="w-3 h-3" /> Analog
              </Link>
            )}
            {/* Zoom controls */}
            <div className="hidden sm:flex items-center gap-0.5 rounded-lg overflow-hidden" style={{ border: "1px solid var(--bdr-1)", background: "var(--surf-2)" }}>
              <button onClick={() => setZoom(z => Math.max(0.7, Math.round((z - 0.1) * 10) / 10))}
                className="h-7 w-7 flex items-center justify-center transition-colors hover:bg-white/8"
                style={{ color: "var(--text-muted4)", fontSize: 14, fontWeight: 300 }}
                title="Zoom out">−</button>
              <span className="text-[10px] tabular-nums font-semibold px-1" style={{ color: "var(--text-muted3)", minWidth: 28, textAlign: "center" }}>
                {Math.round(zoom * 100)}%
              </span>
              <button onClick={() => setZoom(z => Math.min(1.4, Math.round((z + 0.1) * 10) / 10))}
                className="h-7 w-7 flex items-center justify-center transition-colors hover:bg-white/8"
                style={{ color: "var(--text-muted4)", fontSize: 14, fontWeight: 300 }}
                title="Zoom in">+</button>
            </div>
            {/* Light / Dark toggle */}
            <button onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}
              className="h-7 px-2 rounded-lg hidden sm:flex items-center gap-1 text-[11px] font-semibold transition-colors hover:bg-white/8"
              style={{ color: "var(--text-warm2)", border: "1px solid var(--bdr-1)", background: "var(--surf-2)" }}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
              {theme === "dark" ? "☀︎" : "◗"} {theme === "dark" ? "Light" : "Dark"}
            </button>
            {/* History */}
            {(restaurantName.includes("Original") || restaurantName.includes("Southside")) && (
              <button onClick={() => setShowHistory(true)}
                className="hidden sm:flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-medium hover:bg-white/8 transition-colors"
                style={{ color: "var(--text-warm2)", border: "1px solid var(--bdr-1)", background: "var(--surf-1)" }}>
                <History className="w-3 h-3" /> History
              </button>
            )}
            {/* Admin link — Walnut goes to unified dashboard, others go to /admin */}
            {(restaurantName.includes("Original") || restaurantName.includes("Southside")) ? (
              <Link href="/walnut/dashboard" className="hidden sm:flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-medium hover:bg-white/8 transition-colors" style={{ color: "var(--text-warm2)" }}>
                <LayoutDashboard className="w-3 h-3" /> Admin
              </Link>
            ) : (
              <Link href="/admin" className="hidden sm:flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-medium hover:bg-white/8 transition-colors" style={{ color: "var(--text-warm2)" }}>
                <LayoutDashboard className="w-3 h-3" /> Admin
              </Link>
            )}
            {/* Help / FAQ */}
            <button onClick={() => setShowHelp(true)}
              className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-white/8 transition-colors"
              style={{ color: "var(--text-muted)" }} title="How to use HOST">
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
            <div className="h-7 w-7 flex items-center justify-center" style={{ color: online ? "rgba(34,197,94,0.85)" : "rgba(239,68,68,0.85)" }}>
              {online ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            </div>
            <button onClick={refreshAll} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-white/8 transition-colors" style={{ color: "var(--text-muted)" }}>
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
              background: "var(--page-bg)",
            }}
          >
            {/* Drag-to-resize handle */}
            <div
              onPointerDown={startResize}
              style={{
                position: "absolute", right: 0, top: 0, bottom: 0, width: 6,
                cursor: "col-resize", zIndex: 20,
                background: "transparent",
                borderRight: "1px solid var(--bdr-2)",
              }}
              title="Drag to resize"
            >
              {/* Visual grip dots */}
              <div style={{
                position: "absolute", top: "50%", left: "50%",
                transform: "translate(-50%, -50%)",
                display: "flex", flexDirection: "column", gap: 3,
              }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{ width: 2, height: 2, borderRadius: "50%", background: "var(--text-dim3)" }} />
                ))}
              </div>
            </div>

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
                      onRemoved={() => refreshAll()}
                      onAddTime={() => addTime(e.id, Math.ceil((e.remaining_wait ?? e.wait_estimate ?? 0)))} />
                  ))}
                </div>
              </div>
            )}

            {/* Divider */}
            {readyList.length > 0 && waitingList.length > 0 && (
              <div className="mx-3 my-2 shrink-0" style={{ height: 1, background: "var(--bdr-1)" }} />
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
            {needsQuoteList.length > 0 && quotedWaiting.length > 0 && (
              <div className="mx-3 my-1.5 shrink-0" style={{ height: 1, background: "rgba(99,179,237,0.14)" }} />
            )}

            {/* Waiting section — only guests that have been quoted */}
            <div className="px-3 pt-2 flex-1 overflow-y-auto">
              {quotedWaiting.length > 0 && (
                <div className="flex items-center gap-2 mb-2 px-1">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#f97316", opacity: 0.90 }} />
                  <span className="text-[10px] font-black tracking-[0.16em] uppercase" style={{ color: "var(--text-warm2)" }}>
                    Waiting · {quotedWaiting.length}
                  </span>
                </div>
              )}

              {queue.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3" style={{ border: "1px solid var(--bdr-1)", borderRadius: 12 }}>
                  <CheckCircle2 className="w-7 h-7" style={{ color: "var(--bdr-11)" }} />
                  <p className="text-[11px] font-medium" style={{ color: "var(--text-muted2)" }}>Queue is clear</p>
                </div>
              ) : quotedWaiting.length === 0 && needsQuoteList.length === 0 ? (
                <div className="flex items-center justify-center py-8" style={{ border: "1px solid var(--bdr-1)", borderRadius: 12 }}>
                  <p className="text-xs" style={{ color: "var(--text-muted2)" }}>No one else waiting</p>
                </div>
              ) : quotedWaiting.length > 0 ? (
                <div className="flex flex-col gap-1.5 pb-24">
                  {quotedWaiting.map(e => (
                    <DraggableQueueCard key={e.id} entry={e}
                      isSelected={selectedEntry?.id === e.id}
                      onSelect={() => setSelectedEntry(prev => prev?.id === e.id ? null : e)}
                      onSeat={() => openSeatPicker(e)} onNotify={() => notify(e.id)}
                      onEdit={(dw) => setEditModal({ entry: e, displayWait: dw })}
                      onRemoved={() => refreshAll()}
                      onAddTime={() => addTime(e.id, Math.ceil((e.remaining_wait ?? e.wait_estimate ?? 0)))} />
                  ))}
                </div>
              ) : null}
            </div>

            {/* Sidebar footer — system health */}
            <div className="px-4 py-3 shrink-0 flex items-center justify-between" style={{ borderTop: "1px solid var(--bdr-1)" }}>
              <p className="text-[10px] tabular-nums" style={{ color: "var(--text-warm6)" }}>
                Synced {lastSync.toLocaleTimeString()}
              </p>
              <div className="flex items-center gap-1.5">
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: online ? "#22c55e" : "#ef4444", boxShadow: online ? "0 0 4px rgba(34,197,94,0.7)" : "0 0 4px rgba(239,68,68,0.7)" }}
                />
                <span className="text-[10px] font-semibold" style={{ color: online ? "rgba(34,197,94,0.75)" : "rgba(239,68,68,0.75)" }}>
                  {online ? "System OK" : "Offline"}
                </span>
              </div>
            </div>
          </div>

          {/* ── Floor map (desktop only) ───────────────────────────── */}
          <div className="flex-1 overflow-hidden hidden lg:flex">
            <FloorMap
              tables={tables}
              localOccupants={localOccupants}
              onClear={(tableId, tableNumber) => {
                if (pendingTableMove) return  // ignore taps while move mode is active
                const occupant = localOccupants.get(tableNumber)
                const dbOccupied = tables.find(t => t.table_number === tableNumber)?.status === "occupied"
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
              onAvailableTap={(tableNumber, tableId, capacity) => {
                if (pendingTableMove) {
                  executeTableMove(tableNumber, tableId)
                  return
                }
                if (selectedEntry) return
                setTableTapModal({ tableNumber, tableId, capacity })
              }}
              locallyAvailableTables={locallyAvailableTables}
              isTableMoveMode={!!pendingTableMove}
              onCancelTableMove={() => setPendingTableMove(null)}
            />
          </div>

          {/* ── Mobile: no floor map — full queue ─────────────────── */}
          <div className="flex-1 lg:hidden overflow-y-auto p-4 flex flex-col gap-4">
            <p className="text-xs text-center py-8" style={{ color: "var(--text-muted2)" }}>
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
            onClose={() => setShowAdd(false)}
            onAdded={() => { setShowAdd(false); refreshAll() }}
            restaurantId={restaurantId}
            sidebarW={sidebarW}
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
        {clearConfirm && (() => {
          // Look up full details from history (seated guests appear in history)
          const histEntry = clearConfirm.occupant.entry_id
            ? history.find(e => e.id === clearConfirm.occupant.entry_id)
            : null
          const phone = histEntry?.phone ?? null
          const notes = histEntry?.notes ?? null
          const arrivedAt = histEntry?.arrival_time
            ? new Date(histEntry.arrival_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
            : null
          const quotedWait = histEntry?.quoted_wait ?? null
          return (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
              <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setClearConfirm(null)} />
              <div className="relative w-full sm:max-w-sm mx-0 sm:mx-4 rounded-t-3xl sm:rounded-2xl p-8" style={{ background: "var(--modal-bg)", border: "1px solid rgba(239,68,68,0.28)", zIndex: 1 }}>
                <div className="sm:hidden w-10 h-1 rounded-full mx-auto mb-5" style={{ background: "var(--bdr-3)" }} />
                {/* Guest details */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-muted3)" }}>Table {clearConfirm.tableNumber}</span>
                  </div>
                  <p style={{ fontSize: 22, fontWeight: 800, color: "var(--text-hi)", marginBottom: 6, lineHeight: 1.1 }}>{clearConfirm.occupant.name}</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", marginBottom: 8 }}>
                    <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 600 }}>Party of {clearConfirm.occupant.party_size}</span>
                    {arrivedAt && <span style={{ fontSize: 13, color: "var(--text-muted3)" }}>In at {arrivedAt}</span>}
                    {quotedWait && <span style={{ fontSize: 13, color: "var(--text-muted3)" }}>{quotedWait}m quoted</span>}
                  </div>
                  {phone && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: "var(--text-dim3)", fontWeight: 700, letterSpacing: "0.08em" }}>PHONE</span>
                      <span style={{ fontSize: 14, color: "var(--text-warm3)", fontWeight: 600, fontFamily: "monospace", letterSpacing: "0.04em" }}>{phone}</span>
                    </div>
                  )}
                  {notes && (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                      <span style={{ fontSize: 12, color: "var(--text-dim3)", fontWeight: 700, letterSpacing: "0.08em", marginTop: 1 }}>NOTES</span>
                      <span style={{ fontSize: 13, color: "var(--text-muted)", fontStyle: "italic" }}>{notes}</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-3">
                  {clearConfirm.occupant.entry_id && (
                    <button
                      onClick={() => { clearTable(clearConfirm.tableId, clearConfirm.tableNumber, clearConfirm.occupant.entry_id, "restore"); setClearConfirm(null) }}
                      className="w-full rounded-2xl font-bold tracking-wide transition-all active:scale-[0.98] hover:brightness-125"
                      style={{ background: "rgba(34,197,94,0.14)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.35)", fontSize: 16, padding: "18px 0" }}>
                      Return to Waitlist
                    </button>
                  )}
                  <button
                    onClick={() => { setPendingTableMove({ tableId: clearConfirm.tableId, tableNumber: clearConfirm.tableNumber, occupant: clearConfirm.occupant }); setClearConfirm(null) }}
                    className="w-full rounded-2xl font-bold tracking-wide transition-all active:scale-[0.98] hover:brightness-125"
                    style={{ background: "rgba(96,165,250,0.12)", color: "rgba(96,165,250,0.95)", border: "1px solid rgba(96,165,250,0.30)", fontSize: 16, padding: "18px 0" }}>
                    Move to Another Table
                  </button>
                  <button
                    onClick={() => { clearTable(clearConfirm.tableId, clearConfirm.tableNumber, clearConfirm.occupant.entry_id, "cancel"); setClearConfirm(null) }}
                    className="w-full rounded-2xl font-bold tracking-wide transition-all active:scale-[0.98] hover:brightness-125"
                    style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.28)", fontSize: 16, padding: "18px 0" }}>
                    Clear Table
                  </button>
                  <button
                    onClick={() => setClearConfirm(null)}
                    className="w-full rounded-2xl font-bold tracking-wide transition-all active:scale-[0.98] hover:brightness-125"
                    style={{ background: "var(--surf-3)", color: "var(--text-warm2)", border: "1px solid var(--surf-4)", fontSize: 15, padding: "16px 0" }}>
                    Keep Seated
                  </button>
                </div>
              </div>
            </div>
          )
        })()}

        {/* History drawer */}
        {showHistory && (
          <StationHistoryDrawer
            restaurantId={restaurantId}
            history={history}
            tables={tables}
            localOccupants={localOccupants}
            onClose={() => setShowHistory(false)}
            onRestored={refreshAll}
          />
        )}

        {/* ── Help / FAQ modal ───────────────────────────────────── */}
        {showHelp && (
          <div
            style={{ position: "absolute", inset: 0, zIndex: 120, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
            onClick={() => setShowHelp(false)}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{ background: "var(--modal-bg)", border: "1px solid var(--bdr-4)", borderRadius: 18, width: "100%", maxWidth: 560, maxHeight: "88dvh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 24px 80px rgba(0,0,0,0.55)" }}
            >
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 12px", borderBottom: "1px solid var(--bdr-2)", flexShrink: 0 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-hi2)", letterSpacing: "0.01em" }}>How to use HOST</div>
                  <div style={{ fontSize: 11, color: "var(--text-warm2)", marginTop: 2 }}>Quick reference for hosts</div>
                </div>
                <button onClick={() => setShowHelp(false)} style={{ width: 30, height: 30, borderRadius: 8, background: "var(--surf-4)", border: "1px solid var(--bdr-5)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted4)", cursor: "pointer" }}>
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable body */}
              <div style={{ overflowY: "auto", padding: "14px 20px 20px", display: "flex", flexDirection: "column", gap: 18 }}>

                {/* Adding guests */}
                <section>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 8 }}>Adding &amp; Managing Guests</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    {[
                      { label: "+ Add Guest", desc: "Tap the button at the top of the waitlist. Enter name, party size, and optional phone + wait time. Phone + quoted wait → guest gets an automatic text confirmation." },
                      { label: "SEAT", desc: "Marks the guest as seated and auto-picks the best available table. Or drag the guest card directly onto a table for a specific seat." },
                      { label: "NOTIFY", desc: "Sends a 'your table is ready' text. Use this while the table is being bussed — guest walks in ready to sit. Then hit SEAT to finalize." },
                      { label: "+5 min", desc: "Extends the quoted wait by 5 minutes instantly. Tap it freely when service is running behind — faster than opening EDIT." },
                      { label: "EDIT", desc: "Change name, party size, phone number, notes, or the quoted wait time." },
                      { label: "REMOVE", desc: "Removes the guest from the list (left, no-show). They move to History — you can restore them if needed." },
                    ].map(({ label, desc }) => (
                      <div key={label} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <div style={{ flexShrink: 0, marginTop: 1, fontSize: 10, fontWeight: 800, letterSpacing: "0.04em", color: "rgba(255,185,100,0.90)", background: "rgba(255,185,100,0.10)", border: "1px solid rgba(255,185,100,0.20)", borderRadius: 5, padding: "2px 6px", whiteSpace: "nowrap" }}>{label}</div>
                        <div style={{ fontSize: 12, color: "var(--text-warm2)", lineHeight: 1.5 }}>{desc}</div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Floor map */}
                <section>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 8 }}>Floor Map</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    {[
                      { label: "🟢 Green table", desc: "Available — tap to choose a guest to seat there, or drag a guest card from the waitlist onto it." },
                      { label: "🔴 Red table", desc: "Occupied — shows guest name and party size. Tap to bring up options: Keep at Table, Move, Restore to Waitlist, or Clear." },
                      { label: "Drag to move", desc: "Press and hold a guest on a red table, then drag to another table to move them. Tables swap if both are occupied." },
                      { label: "Move button", desc: "In the occupied table popup, tap 'Move to Another Table', then tap any green table to move the guest there." },
                      { label: "Clear Table", desc: "Tap a red table → Clear Table. The table turns green immediately. Use this once a guest has left." },
                    ].map(({ label, desc }) => (
                      <div key={label} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <div style={{ flexShrink: 0, marginTop: 1, fontSize: 10, fontWeight: 800, letterSpacing: "0.04em", color: "rgba(96,165,250,0.90)", background: "rgba(96,165,250,0.10)", border: "1px solid rgba(96,165,250,0.20)", borderRadius: 5, padding: "2px 6px", whiteSpace: "nowrap" }}>{label}</div>
                        <div style={{ fontSize: 12, color: "var(--text-warm2)", lineHeight: 1.5 }}>{desc}</div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* History */}
                <section>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 8 }}>History</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    {[
                      { label: "History tab", desc: "Tap History (top of sidebar) to see every guest seated or removed today. Resets at 3am." },
                      { label: "Restore", desc: "Find a guest in History and tap Restore to Waitlist — puts them back in the queue. Re-quote their wait time." },
                    ].map(({ label, desc }) => (
                      <div key={label} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <div style={{ flexShrink: 0, marginTop: 1, fontSize: 10, fontWeight: 800, letterSpacing: "0.04em", color: "rgba(34,197,94,0.90)", background: "rgba(34,197,94,0.10)", border: "1px solid rgba(34,197,94,0.22)", borderRadius: 5, padding: "2px 6px", whiteSpace: "nowrap" }}>{label}</div>
                        <div style={{ fontSize: 12, color: "var(--text-warm2)", lineHeight: 1.5 }}>{desc}</div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Pro tips */}
                <section style={{ background: "var(--surf-1)", border: "1px solid var(--bdr-2)", borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 8 }}>Tips</div>
                  <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 5 }}>
                    {[
                      "Always quote a wait time when adding a guest — it triggers the SMS and sets expectations.",
                      "Tap NOTIFY first while the table is being bussed, then SEAT once it's clean.",
                      "Drag guest cards to reorder the waitlist priority.",
                      "Use +5 min freely — it's one tap and keeps timers accurate.",
                      "If the app shows a spinner, check WiFi — it reconnects automatically.",
                    ].map((tip, i) => (
                      <li key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                        <span style={{ color: "rgba(255,185,100,0.50)", fontSize: 10, marginTop: 3, flexShrink: 0 }}>▸</span>
                        <span style={{ fontSize: 12, color: "var(--text-warm2)", lineHeight: 1.5 }}>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </section>

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

        {/* Table-tap guest picker */}
        {tableTapModal && (
          <TableGuestPicker
            tableNumber={tableTapModal.tableNumber}
            tableId={tableTapModal.tableId}
            capacity={tableTapModal.capacity}
            queue={queue}
            restaurantId={restaurantId}
            onClose={() => setTableTapModal(null)}
            onSeated={(tableNumber, occupant) => {
              setLocalOccupants(prev => new Map(prev).set(tableNumber, occupant))
              setTableTapModal(null)
              refreshAll()
              setTimeout(fetchHistory, 600)
            }}
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
            color: "var(--text-cream)",
            fontSize: 11,
            fontWeight: 700,
            whiteSpace: "nowrap",
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          }}>
            {activeDragOccupant.occupant.name} · {activeDragOccupant.occupant.party_size}p
          </div>
        )}
      </DragOverlay>
      </div>
    </DndContext>
  )
}
