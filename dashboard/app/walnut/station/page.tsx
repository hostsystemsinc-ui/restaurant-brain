"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Users, Clock, CheckCircle2, BellRing,
  RefreshCw, Wifi, WifiOff, Plus, X,
  GripVertical, CalendarDays, Pencil, Trash2,
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

const API         = "https://restaurant-brain-production.up.railway.app"
const WALNUT_LOGO = "https://images.getbento.com/accounts/d2ce1ba3bfb5b87e1f0ba2897a682acb/media/images/28198New_Walnut_Logo.png"

// ── Restaurant locations ───────────────────────────────────────────────────────

const LOCATIONS = {
  original:  { rid: "0001cafe-0001-4000-8000-000000000001", name: "The Original Walnut Cafe",  short: "Original"  },
  southside: { rid: "0002cafe-0001-4000-8000-000000000002", name: "The Southside Walnut Cafe", short: "Southside" },
} as const
type LocationKey = keyof typeof LOCATIONS

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
  { number: 1,  shape: "round",  x: 28,  y: 32,  w: 72, h: 72,  section: "main" },
  { number: 2,  shape: "round",  x: 28,  y: 148, w: 72, h: 72,  section: "main" },
  { number: 3,  shape: "round",  x: 28,  y: 264, w: 72, h: 72,  section: "main" },
  { number: 4,  shape: "square", x: 148, y: 26,  w: 95, h: 95,  section: "main" },
  { number: 5,  shape: "square", x: 148, y: 163, w: 95, h: 95,  section: "main" },
  { number: 6,  shape: "square", x: 148, y: 298, w: 95, h: 95,  section: "main" },
  { number: 7,  shape: "rect",   x: 293, y: 26,  w: 162, h: 112, section: "main" },
  { number: 8,  shape: "rect",   x: 293, y: 196, w: 162, h: 112, section: "main" },
  { number: 9,  shape: "rect",   x: 293, y: 366, w: 162, h: 98,  section: "main" },
  { number: 10, shape: "square", x: 506, y: 26,  w: 95, h: 95,  section: "main" },
  { number: 11, shape: "square", x: 506, y: 163, w: 95, h: 95,  section: "main" },
  { number: 12, shape: "square", x: 506, y: 298, w: 95, h: 95,  section: "main" },
  { number: 13, shape: "round",  x: 748, y: 36,  w: 60, h: 60,  section: "bar"  },
  { number: 14, shape: "round",  x: 748, y: 134, w: 60, h: 60,  section: "bar"  },
  { number: 15, shape: "round",  x: 748, y: 232, w: 60, h: 60,  section: "bar"  },
  { number: 16, shape: "round",  x: 748, y: 330, w: 60, h: 60,  section: "bar"  },
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

interface LocalOccupant { name: string; party_size: number }

interface Reservation {
  id:         string
  guest_name: string
  party_size: number
  date:       string
  time:       string
  status:     string
  phone:      string | null
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function parseUTCMs(ts: string | null | undefined): number | null {
  if (!ts) return null
  const s = (ts.endsWith("Z") || /[+-]\d{2}:?\d{2}$/.test(ts))
    ? ts : ts.replace(" ", "T") + "Z"
  const ms = new Date(s).getTime()
  return isNaN(ms) ? null : ms
}

function timeWaiting(iso: string): string {
  const diff = Math.floor((Date.now() - (parseUTCMs(iso) ?? Date.now())) / 1000)
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

function normalizeTables(raw: Table[]): Table[] {
  const coerced = raw.map(t => ({ ...t, table_number: Number(t.table_number) }))
  const byNumber = new Map<number, Table>()
  for (const t of coerced) {
    const existing = byNumber.get(t.table_number)
    if (!existing || t.status === "occupied") byNumber.set(t.table_number, t)
  }
  return Array.from(byNumber.values())
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
      background: "#0C0907",
      borderTop: "1px solid rgba(251,191,36,0.28)",
      borderRight: "1px solid rgba(255,185,100,0.14)",
      display: "flex", flexDirection: "column",
      overflowY: "hidden",
    }}>
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px 28px" }}>

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] font-black tracking-[0.22em] uppercase" style={{ color: "rgba(255,200,150,0.40)" }}>Edit Guest</p>
            <p className="text-lg font-semibold leading-tight" style={{ color: "rgba(255,248,240,0.95)" }}>{entry.name || "Guest"}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl transition-all active:scale-95" style={{ color: "rgba(255,200,150,0.50)", border: "1px solid rgba(255,185,100,0.20)", background: "rgba(255,185,100,0.06)" }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Wait time */}
        <p className="text-[10px] font-bold tracking-[0.16em] uppercase mb-3" style={{ color: "rgba(255,200,150,0.45)" }}>Set Wait Time</p>
        <div className="flex items-center justify-between mb-4 px-2">
          <button onClick={() => setMinutes(m => Math.max(1, m - 1))} className="w-14 h-14 rounded-full flex items-center justify-center text-2xl font-light transition-all active:scale-95 hover:brightness-125" style={{ border: "1.5px solid rgba(255,185,100,0.22)", color: "rgba(255,200,150,0.7)", background: "rgba(255,185,100,0.06)" }}>−</button>
          <div className="text-center">
            <span className="text-6xl font-extralight tabular-nums leading-none" style={{ color: "rgba(255,248,240,0.95)" }}>{minutes}</span>
            <span className="text-sm ml-2" style={{ color: "rgba(255,200,150,0.40)" }}>min</span>
          </div>
          <button onClick={() => setMinutes(m => Math.min(120, m + 1))} className="w-14 h-14 rounded-full flex items-center justify-center text-2xl font-light transition-all active:scale-95 hover:brightness-125" style={{ border: "1.5px solid rgba(255,185,100,0.22)", color: "rgba(255,200,150,0.7)", background: "rgba(255,185,100,0.06)" }}>+</button>
        </div>
        <div className="grid grid-cols-6 gap-2 mb-5">
          {PRESETS.map(p => (
            <button key={p} onClick={() => setMinutes(p)} className="flex flex-col items-center justify-center rounded-xl transition-all active:scale-95" style={{ height: 52, background: minutes === p ? "rgba(255,185,100,0.16)" : "rgba(255,185,100,0.05)", border: `1px solid ${minutes === p ? "rgba(255,185,100,0.50)" : "rgba(255,185,100,0.10)"}` }}>
              <span style={{ fontSize: 17, fontWeight: 700, lineHeight: 1, color: minutes === p ? "rgba(255,230,190,0.97)" : "rgba(255,200,150,0.50)" }}>{p}</span>
              <span style={{ fontSize: 9, letterSpacing: "0.05em", color: minutes === p ? "rgba(255,200,150,0.55)" : "rgba(255,185,100,0.28)", marginTop: 2 }}>min</span>
            </button>
          ))}
        </div>

        {/* Party size */}
        <p className="text-[10px] font-bold tracking-[0.16em] uppercase mb-2" style={{ color: "rgba(255,200,150,0.45)" }}>Party Size</p>
        <div className="flex items-center rounded-xl mb-4" style={{ background: "rgba(255,185,100,0.06)", border: "1.5px solid rgba(255,185,100,0.14)", padding: "0 12px", height: 56 }}>
          <button onClick={() => setPartySize(p => Math.max(1, p - 1))} className="w-10 h-10 flex items-center justify-center text-2xl transition-all active:scale-95" style={{ color: "rgba(255,200,150,0.7)" }}>−</button>
          <span className="flex-1 text-center text-2xl font-light tabular-nums" style={{ color: "rgba(255,248,240,0.95)" }}>{partySize}</span>
          <button onClick={() => setPartySize(p => Math.min(20, p + 1))} className="w-10 h-10 flex items-center justify-center text-2xl transition-all active:scale-95" style={{ color: "rgba(255,200,150,0.7)" }}>+</button>
        </div>

        {/* Phone */}
        <p className="text-[10px] font-bold tracking-[0.16em] uppercase mb-2" style={{ color: "rgba(255,200,150,0.45)" }}>Phone <span style={{ color: "rgba(255,200,150,0.25)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>optional</span></p>
        <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(555) 000-0000" className="w-full rounded-xl outline-none mb-4" style={{ background: "rgba(255,185,100,0.06)", border: "1.5px solid rgba(255,185,100,0.14)", color: "rgba(255,248,240,0.92)", fontSize: 15, padding: "15px 14px", height: 56 }} />

        {/* Notes */}
        <p className="text-[10px] font-bold tracking-[0.16em] uppercase mb-2" style={{ color: "rgba(255,200,150,0.45)" }}>Notes <span style={{ color: "rgba(255,200,150,0.25)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>optional</span></p>
        <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Allergies, preferences, occasion…" className="w-full rounded-xl outline-none mb-5" style={{ background: "rgba(255,185,100,0.06)", border: "1.5px solid rgba(255,185,100,0.14)", color: "rgba(255,248,240,0.92)", fontSize: 15, padding: "15px 14px", height: 56 }} />

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
  const [showBar,       setShowBar]       = useState(false)
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: entry.id, data: { entry },
  })

  const handleRemove = async () => {
    setRemoving(true)
    try { await fetch(`${API}/queue/${entry.id}/remove`, { method: "POST" }) } catch {}
    setRemoving(false)
    onRemoved?.()
  }

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

  const displayWait = Math.ceil(secsLeft / 60)
  const quotedTotal = entry.quoted_wait ?? entry.wait_estimate ?? 0
  const progress    = quotedTotal > 0 ? Math.max(0, Math.min(1, 1 - secsLeft / (quotedTotal * 60))) : 0
  const isOverdue   = secsLeft <= 0 && quotedTotal > 0
  const barColor    = isOverdue ? "#ef4444" : secsLeft < 120 ? "#f97316" : "#22c55e"

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
        display: "flex", flexDirection: "column", gap: 6, padding: "10px 12px",
      }}
    >
      {/* Row 1: grip + position + name */}
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

      {/* Row 2: meta */}
      <div style={{ paddingLeft: 38, display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "rgba(255,200,150,0.65)" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Users className="w-2.5 h-2.5" />{entry.party_size}p</span>
        <span style={{ color: "rgba(255,185,100,0.35)" }}>·</span>
        <span className="animate-pulse" style={{ display: "flex", alignItems: "center", gap: 3 }}><Clock className="w-2.5 h-2.5" />{timeWaiting(entry.arrival_time)}</span>
        {(entry.quoted_wait != null || entry.wait_estimate != null) && !isReady && (
          <>
            <span style={{ color: "rgba(255,185,100,0.35)" }}>·</span>
            <span style={{ fontWeight: 700, color: isOverdue ? "#ef4444" : displayWait <= 2 ? "#f97316" : "rgba(251,191,36,0.90)", letterSpacing: "0.01em" }}>
              {isOverdue ? "overdue" : displayWait <= 0 ? "ready" : `~${displayWait}m left`}
            </span>
            <button
              onPointerDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); setShowBar(b => !b) }}
              style={{ marginLeft: 2, width: 14, height: 14, borderRadius: 3, background: showBar ? `${barColor}22` : "rgba(255,185,100,0.08)", border: `1px solid ${showBar ? barColor : "rgba(255,185,100,0.20)"}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, flexShrink: 0 }}
            >
              <div style={{ width: 7, height: 3, borderRadius: 1, background: showBar ? barColor : "rgba(255,185,100,0.35)" }} />
            </button>
          </>
        )}
      </div>

      {/* Progress bar (toggleable) */}
      {showBar && quotedTotal > 0 && !isReady && (
        <div onPointerDown={e => e.stopPropagation()} style={{ paddingLeft: 38, paddingRight: 4 }}>
          <div style={{ height: 4, borderRadius: 2, background: "rgba(255,185,100,0.10)", overflow: "hidden", position: "relative" }}>
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${(progress * 100).toFixed(1)}%`, background: barColor, borderRadius: 2, transition: "width 1s linear, background 0.3s" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2, fontSize: 9, color: "rgba(255,185,100,0.40)" }}>
            <span>0</span>
            <span style={{ color: isOverdue ? "#ef4444" : "rgba(255,185,100,0.40)" }}>{isOverdue ? `${Math.abs(Math.ceil(secsLeft / 60))}m over` : `${displayWait}m left`}</span>
            <span>{quotedTotal}m</span>
          </div>
        </div>
      )}

      {/* Notes */}
      {entry.notes && (
        <div style={{ paddingLeft: 38, fontSize: 11, color: "rgba(255,200,150,0.50)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {entry.notes}
        </div>
      )}

      {/* Action buttons */}
      {confirmDelete ? (
        <div onPointerDown={e => e.stopPropagation()} style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
          <span style={{ fontSize: 11, color: "rgba(239,68,68,0.80)", flex: 1 }}>Remove {entry.name || "guest"}?</span>
          <button onClick={e => { e.stopPropagation(); setConfirmDelete(false) }} className="h-8 px-3 rounded-lg text-xs font-semibold" style={{ background: "rgba(255,185,100,0.08)", color: "rgba(255,200,150,0.60)", border: "1px solid rgba(255,185,100,0.15)" }}>Cancel</button>
          <button onClick={e => { e.stopPropagation(); handleRemove() }} disabled={removing} className="h-8 px-3 rounded-lg text-xs font-bold disabled:opacity-50" style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.30)" }}>{removing ? "…" : "Remove"}</button>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
          <button onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onSeat() }} className="h-10 w-10 flex items-center justify-center rounded-xl transition-all active:scale-95 hover:brightness-125" style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e" }} title="Seat"><CheckCircle2 className="w-5 h-5" /></button>
          {!isReady
            ? <button onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onNotify() }} className="h-10 w-10 flex items-center justify-center rounded-xl transition-all active:scale-95 hover:brightness-125" style={{ background: "rgba(249,115,22,0.1)", color: "#f97316" }} title="Notify ready"><BellRing className="w-5 h-5" /></button>
            : <div className="h-10 w-10" />
          }
          <button onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onEdit?.(displayWait) }} className="h-10 w-10 flex items-center justify-center rounded-xl transition-all active:scale-95 hover:brightness-125" style={{ background: "rgba(251,191,36,0.08)", color: "rgba(251,191,36,0.75)", border: "1px solid rgba(251,191,36,0.14)" }} title="Edit guest"><Pencil className="w-4 h-4" /></button>
          <button onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); setConfirmDelete(true) }} className="h-10 w-10 flex items-center justify-center rounded-xl transition-all active:scale-95 hover:brightness-125" style={{ background: "rgba(239,68,68,0.07)", color: "rgba(239,68,68,0.55)", border: "1px solid rgba(239,68,68,0.14)" }} title="Remove guest"><Trash2 className="w-4 h-4" /></button>
        </div>
      )}
    </div>
  )
}

// ── Drag ghost ─────────────────────────────────────────────────────────────────

function DragGhost({ entry }: { entry: QueueEntry }) {
  return (
    <div style={{ background: "rgba(10,6,3,0.96)", border: "1px solid rgba(255,185,100,0.22)", borderRadius: 10, padding: "9px 13px", boxShadow: "0 12px 40px rgba(0,0,0,0.7)", cursor: "grabbing", minWidth: 130 }}>
      <p style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,248,240,0.94)", marginBottom: 2 }}>{entry.name || "Guest"}</p>
      <p style={{ fontSize: 11, color: "rgba(255,200,150,0.55)" }}>{entry.party_size}p</p>
    </div>
  )
}

// ── Floor table (droppable + draggable for staff relocation) ──────────────────

function DroppableFloorTable({
  pos, table, occupant, onClear, isDraggingOccupant, isSelectMode,
  onSeatFromSelect, forceAvailable, onAvailableTap,
}: {
  pos: FloorPos
  table?: Table
  occupant?: LocalOccupant
  onClear?: () => void
  isDraggingOccupant: boolean
  isSelectMode: boolean
  onSeatFromSelect?: () => void
  forceAvailable?: boolean
  onAvailableTap?: () => void
}) {
  const isOccupied       = !forceAvailable && (!!occupant || (!!table && table.status !== "available"))
  const hasLocalOccupant = !!occupant
  const canReceiveDrop   = isDraggingOccupant ? !hasLocalOccupant : !isOccupied

  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `table-${pos.number}`, disabled: !canReceiveDrop })
  const { setNodeRef: setDragRef, listeners: dragListeners, attributes: dragAttrs, isDragging } = useDraggable({
    id: `occupant-${pos.number}`, data: { type: "occupant", tableNumber: pos.number, occupant }, disabled: !hasLocalOccupant,
  })
  const setNodeRef = useCallback((el: HTMLElement | null) => { setDropRef(el); setDragRef(el) }, [setDropRef, setDragRef])

  const isSelectTarget = isSelectMode && !isOccupied
  const avail = !isOccupied
  const noTable = !table

  const bg = isOver && canReceiveDrop ? "rgba(34,197,94,0.55)" : isSelectTarget ? "rgba(34,197,94,0.38)" : isOccupied ? "rgba(239,68,68,0.28)" : noTable ? "rgba(255,255,255,0.07)" : "rgba(34,197,94,0.22)"
  const borderColor = isOver && canReceiveDrop ? "#22c55e" : isSelectTarget ? "#4ade80" : isOccupied ? "rgba(239,68,68,0.90)" : noTable ? "rgba(255,255,255,0.32)" : "rgba(34,197,94,0.82)"
  const borderRadius = pos.shape === "round" ? "50%" : pos.shape === "square" ? 11 : 10

  return (
    <div
      ref={setNodeRef}
      {...(hasLocalOccupant ? dragListeners : {})}
      {...(hasLocalOccupant ? dragAttrs : {})}
      style={{
        position: "absolute",
        left: `${(pos.x / CANVAS_W * 100).toFixed(3)}%`, top: `${(pos.y / CANVAS_H * 100).toFixed(3)}%`,
        width: `${(pos.w / CANVAS_W * 100).toFixed(3)}%`, height: `${(pos.h / CANVAS_H * 100).toFixed(3)}%`,
        borderRadius, clipPath: pos.shape === "round" ? "circle(50%)" : undefined,
        background: bg, border: `1.5px solid ${borderColor}`,
        boxShadow: isOver && canReceiveDrop ? "0 0 0 4px rgba(34,197,94,0.35)" : isOccupied ? "0 0 0 2px rgba(239,68,68,0.18)" : avail ? "0 0 0 2px rgba(34,197,94,0.18)" : "none",
        transition: "none",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
        overflow: "hidden",
        cursor: hasLocalOccupant ? "grab" : isSelectTarget ? "pointer" : (isOccupied && onClear) ? "pointer" : (onAvailableTap && !isOccupied && !hasLocalOccupant) ? "pointer" : canReceiveDrop ? "copy" : "default",
        opacity: isDragging ? 0.4 : 1,
      }}
      onClick={
        isSelectTarget && onSeatFromSelect ? onSeatFromSelect
        : (isOccupied && onClear && !hasLocalOccupant) ? onClear
        : (!isOccupied && !hasLocalOccupant && !isSelectMode && onAvailableTap) ? onAvailableTap
        : undefined
      }
    >
      {isOccupied && onClear ? (
        <button onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onClear() }} style={{ position: "absolute", top: pos.shape === "round" ? "18%" : 4, right: pos.shape === "round" ? "18%" : 4, width: 16, height: 16, borderRadius: "50%", background: "rgba(239,68,68,0.75)", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.95)", fontSize: 11, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }} title="Clear table">×</button>
      ) : (
        <div style={{ position: "absolute", top: pos.shape === "round" ? "18%" : 7, right: pos.shape === "round" ? "18%" : 7, width: 6, height: 6, borderRadius: "50%", background: noTable ? "rgba(255,255,255,0.28)" : "#22c55e", opacity: 0.85 }} />
      )}
      {isOver && canReceiveDrop ? (
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "rgba(34,197,94,0.9)" }}>DROP</span>
      ) : occupant ? (
        <>
          <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,200,150,0.75)", letterSpacing: "0.1em" }}>T{pos.number}</span>
          <span style={{ fontSize: pos.shape === "rect" ? 11 : 10, fontWeight: 700, color: "rgba(255,240,220,0.97)", textAlign: "center", lineHeight: 1.2, paddingInline: 4 }}>{occupant.name}</span>
          <span style={{ fontSize: 9, color: "rgba(255,200,150,0.70)" }}>{occupant.party_size}p</span>
        </>
      ) : table && table.status !== "available" ? (
        <>
          <span style={{ fontSize: pos.shape === "rect" ? 16 : 14, fontWeight: 800, color: "rgba(239,68,68,0.95)" }}>{pos.number}</span>
          <span style={{ fontSize: 9, color: "rgba(239,68,68,0.72)" }}>{table.capacity}p</span>
        </>
      ) : (
        <>
          <span style={{ fontSize: pos.shape === "rect" ? 17 : 14, fontWeight: 800, color: table ? "#22c55e" : "rgba(255,200,150,0.55)" }}>{pos.number}</span>
          {table && <span style={{ fontSize: 10, color: "rgba(34,197,94,0.90)" }}>{table.capacity}p</span>}
        </>
      )}
    </div>
  )
}

// ── Floor map ──────────────────────────────────────────────────────────────────

function FloorMap({
  tables, localOccupants, onClear, isDraggingOccupant, selectedEntry, onSeatFromSelect, onAvailableTap, locallyAvailableTables,
}: {
  tables: Table[]
  localOccupants: Map<number, LocalOccupant>
  onClear: (tableId: string | undefined, tableNumber: number) => void
  isDraggingOccupant: boolean
  selectedEntry?: QueueEntry | null
  onSeatFromSelect?: (tableNumber: number, tableId: string | undefined) => void
  onAvailableTap?: (tableNumber: number, tableId: string | undefined, capacity: number | undefined) => void
  locallyAvailableTables?: Set<number>
}) {
  const tableByNumber = new Map(tables.map(t => [t.table_number, t]))
  return (
    <div className="flex-1 relative overflow-hidden" style={{ background: "#0a0704" }}>
      <span style={{ position: "absolute", top: 14, left: 18, fontSize: 9, fontWeight: 800, letterSpacing: "0.2em", color: "rgba(255,200,150,0.45)", textTransform: "uppercase", zIndex: 1, pointerEvents: "none" }}>Floor Plan</span>
      <div style={{ position: "absolute", inset: "30px 16px 40px 16px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ position: "relative", width: "100%", aspectRatio: `${CANVAS_W} / ${CANVAS_H}`, maxHeight: "100%" }}>
          <div style={{ position: "absolute", left: `${(726 / CANVAS_W * 100).toFixed(2)}%`, top: 0, right: 0, bottom: 0, background: "rgba(255,185,100,0.03)", borderLeft: "1px solid rgba(255,185,100,0.16)", borderRadius: "0 8px 8px 0" }} />
          <span style={{ position: "absolute", left: `${(760 / CANVAS_W * 100).toFixed(2)}%`, top: `${(10 / CANVAS_H * 100).toFixed(2)}%`, fontSize: 8, fontWeight: 800, letterSpacing: "0.22em", color: "rgba(255,200,150,0.55)", textTransform: "uppercase", pointerEvents: "none" }}>BAR</span>
          <span style={{ position: "absolute", left: `${(30 / CANVAS_W * 100).toFixed(2)}%`, bottom: `${(12 / CANVAS_H * 100).toFixed(2)}%`, fontSize: 8, fontWeight: 800, letterSpacing: "0.2em", color: "rgba(255,200,150,0.45)", textTransform: "uppercase", pointerEvents: "none" }}>Main Dining</span>
          <span style={{ position: "absolute", right: `${(8 / CANVAS_W * 100).toFixed(2)}%`, bottom: `${(8 / CANVAS_H * 100).toFixed(2)}%`, fontSize: 8, letterSpacing: "0.08em", color: "rgba(255,185,100,0.35)", pointerEvents: "none" }}>Powered by <strong>HOST</strong></span>
          {FLOOR_PLAN.map(pos => {
            const table = tableByNumber.get(pos.number)
            const occupant = localOccupants.get(pos.number)
            return (
              <DroppableFloorTable
                key={pos.number} pos={pos} table={table} occupant={occupant}
                onClear={() => onClear(table?.id, pos.number)}
                isDraggingOccupant={isDraggingOccupant}
                isSelectMode={!!selectedEntry}
                onSeatFromSelect={selectedEntry ? () => onSeatFromSelect?.(pos.number, table?.id) : undefined}
                forceAvailable={locallyAvailableTables?.has(pos.number)}
                onAvailableTap={!occupant && (!table || table.status === "available" || locallyAvailableTables?.has(pos.number)) ? () => onAvailableTap?.(pos.number, table?.id, table?.capacity) : undefined}
              />
            )
          })}
        </div>
      </div>
      <div style={{ position: "absolute", bottom: 14, left: "50%", transform: "translateX(-50%)", fontSize: 10, color: "rgba(255,200,150,0.45)", letterSpacing: "0.1em", whiteSpace: "nowrap", pointerEvents: "none" }}>
        Tap a guest to select · tap a table to seat · or drag directly
      </div>
    </div>
  )
}

// ── Seat Table Picker ──────────────────────────────────────────────────────────

function SeatTablePicker({
  guest, tables, localOccupants, onConfirm, onClose,
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
      <div className="relative w-full sm:w-[420px] rounded-t-3xl sm:rounded-2xl p-6" style={{ background: "#100C09", border: "1px solid rgba(255,185,100,0.09)", zIndex: 1 }}>
        <div className="sm:hidden w-8 h-[3px] rounded-full mx-auto mb-5" style={{ background: "rgba(255,185,100,0.12)" }} />
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-black tracking-[0.2em] uppercase" style={{ color: "rgba(255,240,220,0.88)" }}>Seat Guest</span>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ color: "rgba(255,200,150,0.25)" }}><X className="w-4 h-4" /></button>
        </div>
        <p className="text-xs mb-6" style={{ color: "rgba(255,200,150,0.3)" }}>{guest.name || "Guest"} · {guest.party_size}p — choose a table</p>
        {available.length === 0 ? (
          <div className="text-center py-8"><p className="text-xs" style={{ color: "rgba(255,200,150,0.3)" }}>No tables available right now</p></div>
        ) : (
          <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto">
            {available.map(pos => {
              const t = tables.find(t => t.table_number === pos.number)
              return (
                <button key={pos.number} onClick={() => onConfirm(pos.number, t?.id)} className="flex flex-col items-center justify-center gap-0.5 py-3 rounded-xl transition-all active:scale-95 hover:brightness-125" style={{ background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.25)" }}>
                  <span className="text-xl font-bold" style={{ color: "rgba(34,197,94,0.9)" }}>{pos.number}</span>
                  {t && <span className="text-[10px]" style={{ color: "rgba(34,197,94,0.45)" }}>{t.capacity}p</span>}
                  <span className="text-[9px] tracking-wider uppercase mt-0.5" style={{ color: "rgba(34,197,94,0.3)" }}>{pos.section}</span>
                </button>
              )
            })}
          </div>
        )}
        <button onClick={onClose} className="w-full mt-5 py-3 rounded-xl text-xs font-bold tracking-[0.1em] uppercase" style={{ background: "rgba(255,185,100,0.05)", color: "rgba(255,200,150,0.35)", border: "1px solid rgba(255,185,100,0.07)" }}>Cancel</button>
      </div>
    </div>
  )
}

// ── Table Guest Picker (tap available table with no pre-selected guest) ─────────

function TableGuestPicker({
  tableNumber, tableId, capacity, queue, restaurantId, onClose, onSeated,
}: {
  tableNumber: number; tableId: string | undefined; capacity: number | undefined
  queue: QueueEntry[]; restaurantId: string
  onClose: () => void; onSeated: (tableNumber: number, occupant: LocalOccupant) => void
}) {
  const waitingGuests = queue.filter(q => q.status === "waiting" || q.status === "ready")
  const [showWalkIn,  setShowWalkIn]  = useState(false)
  const [walkInName,  setWalkInName]  = useState("")
  const [walkInSize,  setWalkInSize]  = useState(2)
  const [submitting,  setSubmitting]  = useState(false)

  const seatGuest = async (entry: QueueEntry) => {
    if (tableId) await fetch(`${API}/queue/${entry.id}/seat-to-table/${tableId}`, { method: "POST" })
    else         await fetch(`${API}/queue/${entry.id}/seat`, { method: "POST" })
    onSeated(tableNumber, { name: entry.name || "Guest", party_size: entry.party_size })
    onClose()
  }

  const submitWalkIn = async () => {
    setSubmitting(true)
    try {
      const r = await fetch(`${API}/queue/join`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: walkInName.trim() || null, party_size: walkInSize, source: "host", restaurant_id: restaurantId }) })
      const data = await r.json()
      const entryId = data.entry?.id
      if (entryId) {
        if (tableId) await fetch(`${API}/queue/${entryId}/seat-to-table/${tableId}`, { method: "POST" })
        else         await fetch(`${API}/queue/${entryId}/seat`, { method: "POST" })
        onSeated(tableNumber, { name: walkInName.trim() || "Guest", party_size: walkInSize })
        onClose()
      }
    } catch {}
    setSubmitting(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full sm:w-[420px] rounded-t-3xl sm:rounded-2xl" style={{ background: "#100C09", border: "1px solid rgba(255,185,100,0.09)", zIndex: 1, maxHeight: "80dvh", overflowY: "auto" }}>
        <div className="p-6">
          <div className="sm:hidden w-8 h-[3px] rounded-full mx-auto mb-5" style={{ background: "rgba(255,185,100,0.12)" }} />
          <div className="flex items-center justify-between mb-1">
            <div>
              <span className="text-xs font-black tracking-[0.2em] uppercase" style={{ color: "rgba(255,240,220,0.88)" }}>Table {tableNumber}</span>
              {capacity && <span className="text-xs ml-2" style={{ color: "rgba(255,200,150,0.35)" }}>· {capacity}p</span>}
            </div>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ color: "rgba(255,200,150,0.25)" }}><X className="w-4 h-4" /></button>
          </div>
          <p className="text-xs mb-5" style={{ color: "rgba(255,200,150,0.3)" }}>Select a guest from the waitlist or add a walk-in</p>
          <div className="px-3 pb-2">
            {waitingGuests.length === 0 ? (
              <div className="text-center py-8"><p className="text-sm" style={{ color: "rgba(255,200,150,0.35)" }}>No guests waiting</p></div>
            ) : (
              <div className="flex flex-col gap-1">
                {waitingGuests.map(entry => {
                  const dw = entry.remaining_wait ?? entry.wait_estimate ?? entry.quoted_wait ?? null
                  return (
                    <button key={entry.id} onClick={() => seatGuest(entry)} className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-left transition-all active:scale-[0.98] hover:brightness-125" style={{ background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.18)" }}>
                      <span className="font-bold text-sm" style={{ color: "rgba(255,248,240,0.95)" }}>{entry.name || "Guest"}</span>
                      <span className="text-xs" style={{ color: "rgba(255,200,150,0.50)" }}>{entry.party_size}p{dw != null ? ` · ${dw}m quoted` : ""}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          <div className="mx-4 my-3" style={{ borderTop: "1px solid rgba(255,185,100,0.10)" }} />
          <div className="px-3 pb-5">
            {!showWalkIn ? (
              <button onClick={() => setShowWalkIn(true)} className="w-full py-3 rounded-xl text-sm font-bold tracking-[0.08em] transition-all active:scale-[0.98] hover:brightness-125" style={{ background: "rgba(251,191,36,0.07)", color: "rgba(251,191,36,0.80)", border: "1px solid rgba(251,191,36,0.18)" }}>Walk-in / not on waitlist</button>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-xs font-black tracking-[0.15em] uppercase" style={{ color: "rgba(251,191,36,0.65)" }}>Walk-in</p>
                <input type="text" value={walkInName} onChange={e => setWalkInName(e.target.value)} placeholder="Guest" className="w-full rounded-xl outline-none" style={{ background: "rgba(255,185,100,0.07)", border: "1px solid rgba(255,185,100,0.18)", color: "rgba(255,248,240,0.92)", fontSize: 15, padding: "13px 16px" }} />
                <div className="flex items-center justify-between px-2">
                  <span className="text-xs" style={{ color: "rgba(255,200,150,0.50)" }}>Party size</span>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setWalkInSize(s => Math.max(1, s - 1))} className="w-9 h-9 rounded-full flex items-center justify-center text-xl font-light" style={{ border: "1.5px solid rgba(255,185,100,0.22)", color: "rgba(255,200,150,0.70)", background: "rgba(255,185,100,0.06)" }}>−</button>
                    <span className="text-xl font-bold tabular-nums w-6 text-center" style={{ color: "rgba(255,248,240,0.92)" }}>{walkInSize}</span>
                    <button onClick={() => setWalkInSize(s => Math.min(20, s + 1))} className="w-9 h-9 rounded-full flex items-center justify-center text-xl font-light" style={{ border: "1.5px solid rgba(255,185,100,0.22)", color: "rgba(255,200,150,0.70)", background: "rgba(255,185,100,0.06)" }}>+</button>
                  </div>
                </div>
                <button onClick={submitWalkIn} disabled={submitting} className="w-full py-3.5 rounded-xl text-sm font-black tracking-[0.1em] uppercase disabled:opacity-40" style={{ background: "#22c55e", color: "white" }}>{submitting ? "Seating…" : "Seat Now"}</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Add Guest Drawer ───────────────────────────────────────────────────────────

function AddGuestDrawer({ onClose, onAdded, restaurantId }: {
  onClose: () => void
  onAdded: () => void
  restaurantId: string
}) {
  const [name,      setName]      = useState("")
  const [partySize, setPartySize] = useState(2)
  const [phone,     setPhone]     = useState("")
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState("")

  const submit = async () => {
    setLoading(true); setError("")
    try {
      const r = await fetch(`${API}/queue/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || null, party_size: partySize, phone: phone.trim() || null, preference: "asap", source: "host", restaurant_id: restaurantId }),
      })
      if (!r.ok) throw new Error()
      onAdded()
    } catch { setError("Could not add guest.") }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full sm:w-[580px] rounded-t-3xl sm:rounded-3xl p-8" style={{ background: "#100C09", border: "1px solid rgba(255,185,100,0.12)", zIndex: 1 }}>
        <div className="sm:hidden w-10 h-1 rounded-full mx-auto mb-7" style={{ background: "rgba(255,185,100,0.18)" }} />
        <div className="flex items-center justify-between mb-8">
          <span className="text-base font-black tracking-[0.18em] uppercase" style={{ color: "rgba(255,240,220,0.92)" }}>Add Guest</span>
          <button onClick={onClose} className="w-11 h-11 flex items-center justify-center rounded-xl" style={{ color: "rgba(255,200,150,0.35)", border: "1px solid rgba(255,185,100,0.12)" }}><X className="w-5 h-5" /></button>
        </div>
        <p className="text-xs font-bold tracking-[0.18em] uppercase mb-4" style={{ color: "rgba(255,200,150,0.45)" }}>Party Size</p>
        <div className="flex items-center justify-between mb-8 px-2">
          <button onClick={() => setPartySize(p => Math.max(1, p - 1))} className="w-20 h-20 rounded-full flex items-center justify-center text-4xl font-light transition-all active:scale-95 hover:brightness-125" style={{ border: "1.5px solid rgba(255,185,100,0.22)", color: "rgba(255,200,150,0.7)", background: "rgba(255,185,100,0.06)" }}>−</button>
          <span className="text-[88px] font-extralight tabular-nums leading-none" style={{ color: "rgba(255,248,240,0.95)", minWidth: 120, textAlign: "center" }}>{partySize}</span>
          <button onClick={() => setPartySize(p => Math.min(20, p + 1))} className="w-20 h-20 rounded-full flex items-center justify-center text-4xl font-light transition-all active:scale-95 hover:brightness-125" style={{ border: "1.5px solid rgba(255,185,100,0.22)", color: "rgba(255,200,150,0.7)", background: "rgba(255,185,100,0.06)" }}>+</button>
        </div>
        <p className="text-xs font-bold tracking-[0.18em] uppercase mb-3" style={{ color: "rgba(255,200,150,0.45)" }}>Name</p>
        <input type="text" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} placeholder="Guest name" autoFocus className="w-full rounded-2xl outline-none mb-5" style={{ background: "rgba(255,185,100,0.06)", border: "1.5px solid rgba(255,185,100,0.14)", color: "rgba(255,248,240,0.92)", fontSize: 18, padding: "18px 20px" }} />
        <p className="text-xs font-bold tracking-[0.18em] uppercase mb-3" style={{ color: "rgba(255,200,150,0.45)" }}>Phone <span style={{ color: "rgba(255,200,150,0.25)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span></p>
        <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} placeholder="(555) 000-0000" className="w-full rounded-2xl outline-none mb-7" style={{ background: "rgba(255,185,100,0.06)", border: "1.5px solid rgba(255,185,100,0.14)", color: "rgba(255,248,240,0.92)", fontSize: 18, padding: "18px 20px" }} />
        {error && <p className="text-sm text-red-400 mb-5 text-center font-medium">{error}</p>}
        <button onClick={submit} disabled={loading} className="w-full rounded-2xl font-black tracking-[0.15em] uppercase transition-all active:scale-[0.98] disabled:opacity-40" style={{ background: loading ? "rgba(255,185,100,0.08)" : "#22c55e", color: "white", fontSize: 16, padding: "22px 0" }}>{loading ? "Adding…" : "Add to Queue"}</button>
      </div>
    </div>
  )
}

// ── Main: Walnut Station ───────────────────────────────────────────────────────

export default function WalnutStation() {
  const router = useRouter()
  const [authed,    setAuthed]    = useState(false)
  const [location,  setLocation]  = useState<LocationKey>("original")

  // Auth check — must be logged in as the walnut owner account
  useEffect(() => {
    fetch("/api/client/auth")
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d || d.account !== "walnut") router.replace("/login/client")
        else setAuthed(true)
      })
      .catch(() => router.replace("/login/client"))
  }, [router])

  const restaurantId   = LOCATIONS[location].rid
  const restaurantName = LOCATIONS[location].name

  // ── State ──────────────────────────────────────────────────────────────
  const [tables,            setTables]           = useState<Table[]>([])
  const [queue,             setQueue]            = useState<QueueEntry[]>([])
  const [online,            setOnline]           = useState(true)
  const [lastSync,          setLastSync]         = useState(new Date())
  const [showAdd,           setShowAdd]          = useState(false)
  const [editModal,         setEditModal]        = useState<{ entry: QueueEntry; displayWait: number } | null>(null)
  const [activeDragEntry,   setActiveDrag]       = useState<QueueEntry | null>(null)
  const [activeDragOccupant,setActiveDragOccupant] = useState<{ tableNumber: number; occupant: LocalOccupant } | null>(null)
  const [seatPicker,        setSeatPicker]       = useState<QueueEntry | null>(null)
  const [todayReservations, setTodayRes]         = useState<Reservation[]>([])
  const [selectedEntry,     setSelectedEntry]    = useState<QueueEntry | null>(null)
  const [clearConfirm,      setClearConfirm]     = useState<{ tableId: string | undefined; tableNumber: number; occupant: LocalOccupant } | null>(null)
  const [tableTapModal,     setTableTapModal]    = useState<{ tableNumber: number; tableId: string | undefined; capacity: number | undefined } | null>(null)
  const [sidebarW,          setSidebarW]         = useState(300)
  const [now,               setNow]              = useState(() => new Date())
  const [isInitialLoad,     setIsInitialLoad]    = useState(true)

  const localOccupants           = useRef<Map<number, LocalOccupant>>(new Map())
  const [localOccupantsV,  setLocalOccupantsV]  = useState(0) // version counter to trigger re-render
  const locallyAvailableTables   = useRef<Set<number>>(new Set())
  const [lavV,             setLavV]             = useState(0)
  const pendingClearsRef         = useRef<Set<number>>(new Set())
  const fetchingRef              = useRef(false)
  const seenEntryIdsRef          = useRef<Set<string> | null>(null)
  const isResizing               = useRef(false)
  const resizeStartX             = useRef(0)
  const resizeStartW             = useRef(sidebarW)

  // ── Helpers ────────────────────────────────────────────────────────────
  const getLocalOccupants = () => localOccupants.current
  const getLocallyAvailable = () => locallyAvailableTables.current

  // ── Resize sidebar ─────────────────────────────────────────────────────
  const handleResizeMove = useCallback((e: PointerEvent) => {
    if (!isResizing.current) return
    const delta = e.clientX - resizeStartX.current
    setSidebarW(Math.max(220, Math.min(520, resizeStartW.current + delta)))
  }, [])

  const handleResizeUp = useCallback(() => {
    isResizing.current = false
    document.removeEventListener("pointermove", handleResizeMove)
    document.removeEventListener("pointerup",   handleResizeUp)
    document.body.style.cursor = ""
    document.body.style.userSelect = ""
  }, [handleResizeMove])

  const startResize = useCallback((e: React.PointerEvent) => {
    isResizing.current = true
    resizeStartX.current = e.clientX
    resizeStartW.current = sidebarW
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
    document.addEventListener("pointermove", handleResizeMove)
    document.addEventListener("pointerup",   handleResizeUp)
  }, [sidebarW, handleResizeMove, handleResizeUp])

  // ── Fetch ──────────────────────────────────────────────────────────────
  const refreshAll = useCallback(async () => {
    if (fetchingRef.current || !restaurantId) return
    fetchingRef.current = true
    try {
      const r = await fetch(`${API}/state?restaurant_id=${restaurantId}`)
      if (r.ok) {
        const d = await r.json()
        setQueue(d.queue ?? [])
        const serverTables: Table[] = normalizeTables(d.tables ?? [])
        setTables(prev => {
          if (pendingClearsRef.current.size === 0) return serverTables
          return serverTables.map(t => pendingClearsRef.current.has(t.table_number) ? { ...t, status: "available" as const } : t)
        })
        setOnline(true)
        setLastSync(new Date())
        setIsInitialLoad(false)
      } else { setOnline(false) }
    } catch { setOnline(false) }
    fetchingRef.current = false
  }, [restaurantId])

  const fetchReservations = useCallback(async () => {
    if (!restaurantId) return
    try {
      const dateStr = toLocalDateStr(new Date())
      const r = await fetch(`${API}/reservations?restaurant_id=${restaurantId}&date=${dateStr}`)
      if (r.ok) setTodayRes(await r.json())
    } catch {}
  }, [restaurantId])

  // ── Effects ────────────────────────────────────────────────────────────

  // Reset and refetch when location changes
  useEffect(() => {
    if (!authed) return
    setQueue([])
    setTables([])
    setTodayRes([])
    setSelectedEntry(null)
    setEditModal(null)
    seenEntryIdsRef.current = null
    localOccupants.current = new Map()
    locallyAvailableTables.current = new Set()
    setLocalOccupantsV(v => v + 1)
    setLavV(v => v + 1)
    setIsInitialLoad(true)
    refreshAll()
    fetchReservations()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, authed])

  // Poll queue every 3 s
  useEffect(() => {
    if (!authed) return
    const t = setInterval(refreshAll, 3000)
    return () => clearInterval(t)
  }, [authed, refreshAll])

  // Poll reservations every 60 s
  useEffect(() => {
    if (!authed) return
    const t = setInterval(fetchReservations, 60_000)
    return () => clearInterval(t)
  }, [authed, fetchReservations])

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])

  // Track new unquoted entries
  useEffect(() => {
    if (queue.length === 0 && seenEntryIdsRef.current === null) return
    if (seenEntryIdsRef.current === null) {
      seenEntryIdsRef.current = new Set(queue.map(e => e.id))
      return
    }
    queue.forEach(e => seenEntryIdsRef.current!.add(e.id))
  }, [queue])

  // ── Drag & drop ────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 8 } }),
  )

  const handleDragStart = useCallback((e: DragStartEvent) => {
    const data = e.active.data.current
    if (data?.type === "occupant") {
      setActiveDragOccupant({ tableNumber: data.tableNumber, occupant: data.occupant })
    } else if (data?.entry) {
      setActiveDrag(data.entry)
    }
  }, [])

  const confirmSeat = useCallback(async (entry: QueueEntry, tableNumber: number, tableId: string | undefined) => {
    // Optimistic: mark table locally
    localOccupants.current = new Map(localOccupants.current).set(tableNumber, { name: entry.name || "Guest", party_size: entry.party_size })
    setLocalOccupantsV(v => v + 1)
    setQueue(prev => prev.filter(q => q.id !== entry.id))
    try {
      if (tableId) await fetch(`${API}/queue/${entry.id}/seat-to-table/${tableId}`, { method: "POST" })
      else         await fetch(`${API}/queue/${entry.id}/seat`, { method: "POST" })
    } catch {}
    refreshAll()
  }, [refreshAll])

  const handleDragEnd = useCallback((e: DragEndEvent) => {
    setActiveDrag(null)
    setActiveDragOccupant(null)
    const over = e.over
    if (!over) return

    const data = e.active.data.current

    if (data?.type === "occupant" && over.id.toString().startsWith("table-")) {
      const toNumber = parseInt(over.id.toString().replace("table-", ""), 10)
      const fromNumber = data.tableNumber as number
      const occupant   = data.occupant as LocalOccupant
      if (toNumber === fromNumber) return
      // Move local occupant to new table
      const next = new Map(localOccupants.current)
      next.delete(fromNumber)
      next.set(toNumber, occupant)
      localOccupants.current = next
      setLocalOccupantsV(v => v + 1)
      return
    }

    if (data?.entry && over.id.toString().startsWith("table-")) {
      const tableNumber = parseInt(over.id.toString().replace("table-", ""), 10)
      const table = tables.find(t => t.table_number === tableNumber)
      confirmSeat(data.entry as QueueEntry, tableNumber, table?.id)
    }
  }, [tables, confirmSeat])

  const clearTable = useCallback(async (tableId: string | undefined, tableNumber: number) => {
    // Optimistic: remove local occupant, mark as locally-available
    const next = new Map(localOccupants.current)
    next.delete(tableNumber)
    localOccupants.current = next
    setLocalOccupantsV(v => v + 1)
    locallyAvailableTables.current = new Set([...locallyAvailableTables.current, tableNumber])
    setLavV(v => v + 1)
    pendingClearsRef.current.add(tableNumber)
    try {
      if (tableId) await fetch(`${API}/tables/${tableId}/clear`, { method: "POST" })
    } catch {}
    pendingClearsRef.current.delete(tableNumber)
    locallyAvailableTables.current = new Set([...locallyAvailableTables.current].filter(n => n !== tableNumber))
    setLavV(v => v + 1)
    refreshAll()
  }, [refreshAll])

  const openSeatPicker = useCallback((entry: QueueEntry) => { setSeatPicker(entry); setSelectedEntry(null) }, [])

  const notify = useCallback(async (entryId: string) => {
    try { await fetch(`${API}/queue/${entryId}/notify`, { method: "POST" }) } catch {}
    refreshAll()
  }, [refreshAll])

  // ── Computed ───────────────────────────────────────────────────────────
  void localOccupantsV; void lavV // consumed to trigger re-renders
  const localOccupantsMap    = getLocalOccupants()
  const locallyAvailableSet  = getLocallyAvailable()

  const floorOccupied = FLOOR_PLAN.filter(pos => {
    if (localOccupantsMap.has(pos.number)) return true
    const t = tables.find(t => t.table_number === pos.number)
    return !!t && t.status !== "available"
  }).length
  const available    = FLOOR_PLAN.length - floorOccupied
  const readyList    = queue.filter(q => q.status === "ready")
  const waitingList  = queue.filter(q => q.status === "waiting")
  const needsQuoteList = waitingList.filter(q => q.quoted_wait == null)
  const quotedWaiting  = waitingList.filter(q => q.quoted_wait != null)

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
        <header className="flex items-center justify-between px-4 h-12 shrink-0" style={{ background: "rgba(7,4,2,0.98)", borderBottom: "1px solid rgba(255,185,100,0.18)", backdropFilter: "blur(20px)" }}>

          {/* Logo + restaurant switcher */}
          <div className="flex items-center gap-3 min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={WALNUT_LOGO} alt="Walnut Cafe" style={{ height: 28, width: "auto", objectFit: "contain", flexShrink: 0 }} />
            <div className="w-px h-5 shrink-0" style={{ background: "rgba(255,185,100,0.20)" }} />
            {/* Location tabs */}
            <div className="flex items-center gap-1">
              {(Object.entries(LOCATIONS) as [LocationKey, typeof LOCATIONS[LocationKey]][]).map(([key, loc]) => (
                <button
                  key={key}
                  onClick={() => setLocation(key)}
                  className="text-[11px] font-bold px-3 h-7 rounded-lg transition-all active:scale-95"
                  style={{
                    background: location === key ? "rgba(200,144,96,0.18)" : "transparent",
                    border: `1px solid ${location === key ? "rgba(200,144,96,0.50)" : "rgba(255,185,100,0.14)"}`,
                    color: location === key ? "rgba(255,220,170,0.95)" : "rgba(255,200,150,0.45)",
                    letterSpacing: "0.04em",
                  }}
                >
                  {loc.short}
                </button>
              ))}
            </div>
          </div>

          {/* Stats + controls */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:flex items-center gap-1.5">
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg" style={{ background: "rgba(255,185,100,0.07)", border: "1px solid rgba(255,185,100,0.16)" }}>
                <span className="text-xs font-bold tabular-nums" style={{ color: available > 0 ? "#22c55e" : "#ef4444" }}>{available}</span>
                <span className="text-xs" style={{ color: "rgba(255,185,100,0.50)" }}>/{FLOOR_PLAN.length}</span>
                <span className="text-[10px] ml-0.5" style={{ color: "rgba(255,200,150,0.60)" }}>free</span>
              </div>
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg" style={{ background: "rgba(255,185,100,0.07)", border: "1px solid rgba(255,185,100,0.16)" }}>
                <span className="text-xs font-bold tabular-nums" style={{ color: waitingList.length > 0 ? "#f97316" : "rgba(255,200,150,0.60)" }}>{waitingList.length}</span>
                <span className="text-[10px]" style={{ color: "rgba(255,200,150,0.60)" }}>waiting</span>
              </div>
              {readyList.length > 0 && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg animate-pulse" style={{ background: "rgba(34,197,94,0.14)", border: "1px solid rgba(34,197,94,0.35)" }}>
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  <span className="text-xs font-bold" style={{ color: "#22c55e" }}>{readyList.length} ready</span>
                </div>
              )}
            </div>
            <span className="hidden sm:block text-[11px] tabular-nums font-medium px-2" style={{ color: "rgba(255,200,150,0.65)", letterSpacing: "0.04em" }}>{clockStr}</span>
            <Link href="/walnut/dashboard" className="hidden sm:flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-medium hover:bg-white/8 transition-colors" style={{ color: "rgba(255,200,150,0.65)" }}>Dashboard</Link>
            <div className="h-7 w-7 flex items-center justify-center" style={{ color: online ? "rgba(34,197,94,0.85)" : "rgba(239,68,68,0.85)" }}>
              {online ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            </div>
            <button onClick={refreshAll} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-white/8" style={{ color: "rgba(255,200,150,0.55)" }}><RefreshCw className="w-3.5 h-3.5" /></button>
          </div>
        </header>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden">

          {/* ── Queue sidebar ──────────────────────────────────────────── */}
          <div className="flex flex-col shrink-0 overflow-hidden" style={{ width: sidebarW, position: "relative", background: "#0C0907" }}>

            {/* Resize handle */}
            <div onPointerDown={startResize} style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 6, cursor: "col-resize", zIndex: 20, background: "transparent", borderRight: "1px solid rgba(255,185,100,0.16)" }} title="Drag to resize">
              <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", display: "flex", flexDirection: "column", gap: 3 }}>
                {[0,1,2].map(i => <div key={i} style={{ width: 2, height: 2, borderRadius: "50%", background: "rgba(255,185,100,0.28)" }} />)}
              </div>
            </div>

            {/* Today's reservations */}
            {activeRes.length > 0 && (
              <div style={{ padding: "8px 12px 8px", borderBottom: "1px solid rgba(255,185,100,0.16)", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 7, padding: "0 2px" }}>
                  <CalendarDays style={{ width: 9, height: 9, color: "rgba(99,179,237,0.80)" }} />
                  <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.16em", color: "rgba(99,179,237,0.75)", textTransform: "uppercase" }}>Reservations · {activeRes.length}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {activeRes.map(res => {
                    const urgency = getResUrgency(res.date, res.time, now)
                    const isLate = urgency === "late", isNow = urgency === "now", isArriving = urgency === "arriving"
                    return (
                      <div key={res.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 9px", borderRadius: 9, background: isLate ? "rgba(239,68,68,0.12)" : isNow ? "rgba(249,115,22,0.10)" : isArriving ? "rgba(251,191,36,0.07)" : "rgba(255,185,100,0.04)", border: `1px solid ${isLate ? "rgba(239,68,68,0.35)" : isNow ? "rgba(249,115,22,0.28)" : isArriving ? "rgba(251,191,36,0.20)" : "rgba(255,185,100,0.10)"}` }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: isLate ? "rgba(239,68,68,0.95)" : isNow ? "rgba(249,115,22,0.95)" : "rgba(255,248,240,0.92)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{res.guest_name}</div>
                          <div style={{ fontSize: 10, color: isLate ? "rgba(239,68,68,0.65)" : "rgba(255,200,150,0.50)", display: "flex", gap: 5, marginTop: 1 }}>
                            <span>{fmt12Res(res.time)}</span>
                            <span style={{ opacity: 0.5 }}>·</span>
                            <span>{res.party_size}p</span>
                            {isLate && <span style={{ fontWeight: 700, color: "rgba(239,68,68,0.80)" }}>late</span>}
                            {isNow  && <span style={{ fontWeight: 700, color: "rgba(249,115,22,0.80)" }}>arriving</span>}
                          </div>
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
                  <span className="text-[10px] font-black tracking-[0.16em] uppercase" style={{ color: "rgba(34,197,94,0.90)" }}>Ready · {readyList.length}</span>
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

            {readyList.length > 0 && waitingList.length > 0 && (
              <div className="mx-3 my-2 shrink-0" style={{ height: 1, background: "rgba(255,185,100,0.14)" }} />
            )}

            {/* Needs Quote section */}
            {needsQuoteList.length > 0 && (
              <div className="px-3 pt-2 pb-1 shrink-0">
                <div className="flex items-center gap-2 mb-2 px-1">
                  <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#60a5fa" }} />
                  <span className="text-[10px] font-black tracking-[0.16em] uppercase" style={{ color: "rgba(99,179,237,0.90)" }}>Needs Quote · {needsQuoteList.length}</span>
                </div>
                <div className="flex flex-col gap-1.5 pr-1">
                  {needsQuoteList.map(e => (
                    <div key={e.id} style={{ borderRadius: 12, padding: "10px 12px", background: "rgba(99,179,237,0.07)", border: "1px solid rgba(99,179,237,0.30)", display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: "rgba(255,255,255,0.92)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name || "Guest"}</div>
                        <div style={{ fontSize: 11, color: "rgba(147,207,255,0.65)", display: "flex", gap: 6, marginTop: 2 }}>
                          <span>{e.party_size}p</span><span style={{ opacity: 0.5 }}>·</span><span>{timeWaiting(e.arrival_time)} waiting</span>
                        </div>
                      </div>
                      <button onClick={() => setEditModal({ entry: e, displayWait: 0 })} style={{ flexShrink: 0, height: 30, padding: "0 12px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: "rgba(99,179,237,0.16)", color: "rgba(147,207,255,0.95)", border: "1px solid rgba(99,179,237,0.40)", cursor: "pointer", letterSpacing: "0.04em" }}>Quote</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {needsQuoteList.length > 0 && quotedWaiting.length > 0 && (
              <div className="mx-3 my-1.5 shrink-0" style={{ height: 1, background: "rgba(99,179,237,0.14)" }} />
            )}

            {/* Waiting section */}
            <div className="px-3 pt-2 flex-1 overflow-y-auto">
              {quotedWaiting.length > 0 && (
                <div className="flex items-center gap-2 mb-2 px-1">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#f97316", opacity: 0.90 }} />
                  <span className="text-[10px] font-black tracking-[0.16em] uppercase" style={{ color: "rgba(255,200,150,0.65)" }}>Waiting · {quotedWaiting.length}</span>
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

            {/* Sidebar footer */}
            <div className="px-4 py-3 shrink-0 flex items-center justify-between" style={{ borderTop: "1px solid rgba(255,185,100,0.14)" }}>
              <p className="text-[10px] tabular-nums" style={{ color: "rgba(255,200,150,0.40)" }}>Synced {lastSync.toLocaleTimeString()}</p>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: online ? "#22c55e" : "#ef4444", boxShadow: online ? "0 0 4px rgba(34,197,94,0.7)" : "0 0 4px rgba(239,68,68,0.7)" }} />
                <span className="text-[10px] font-semibold" style={{ color: online ? "rgba(34,197,94,0.75)" : "rgba(239,68,68,0.75)" }}>{online ? "System OK" : "Offline"}</span>
              </div>
            </div>
          </div>

          {/* ── Floor map ──────────────────────────────────────────────── */}
          <div className="flex-1 overflow-hidden hidden lg:flex">
            <FloorMap
              tables={tables}
              localOccupants={localOccupantsMap}
              onClear={(tableId, tableNumber) => {
                const occupant = localOccupantsMap.get(tableNumber)
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
              onAvailableTap={(tableNumber, tableId, capacity) => {
                if (selectedEntry) return
                setTableTapModal({ tableNumber, tableId, capacity })
              }}
              locallyAvailableTables={locallyAvailableSet}
            />
          </div>

          {/* Mobile fallback */}
          <div className="flex-1 lg:hidden overflow-y-auto p-4 flex flex-col gap-4">
            <p className="text-xs text-center py-8" style={{ color: "rgba(255,200,150,0.50)" }}>Floor map available on larger screens</p>
          </div>
        </div>

        {/* ── Add Guest FAB ─────────────────────────────────────────────── */}
        <button
          onClick={() => setShowAdd(true)}
          className="fixed bottom-6 right-6 flex items-center gap-2.5 h-16 px-8 rounded-full text-sm font-black tracking-[0.1em] uppercase shadow-2xl transition-all active:scale-95 hover:scale-[1.03] z-30"
          style={{ background: "#22c55e", color: "white", boxShadow: "0 8px 32px rgba(34,197,94,0.45), 0 0 0 1px rgba(34,197,94,0.20)" }}
        >
          <Plus className="w-5 h-5" /> Add Guest
        </button>

        {/* ── Drag overlay ─────────────────────────────────────────────── */}
        <DragOverlay>
          {activeDragEntry && <DragGhost entry={activeDragEntry} />}
          {activeDragOccupant && (
            <div style={{ background: "rgba(10,6,3,0.96)", border: "1px solid rgba(239,68,68,0.35)", borderRadius: 10, padding: "9px 13px", boxShadow: "0 12px 40px rgba(0,0,0,0.7)", cursor: "grabbing", minWidth: 120 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,248,240,0.94)", marginBottom: 2 }}>{activeDragOccupant.occupant.name}</p>
              <p style={{ fontSize: 11, color: "rgba(239,68,68,0.65)" }}>T{activeDragOccupant.tableNumber} → moving</p>
            </div>
          )}
        </DragOverlay>

        {/* ── Selected guest hint ───────────────────────────────────────── */}
        {selectedEntry && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-4 py-2.5 rounded-full" style={{ background: "rgba(12,6,3,0.93)", border: "1px solid rgba(255,220,100,0.38)", backdropFilter: "blur(12px)", boxShadow: "0 4px 20px rgba(0,0,0,0.55)", whiteSpace: "nowrap" }}>
            <span className="text-xs font-bold" style={{ color: "rgba(255,220,100,0.95)" }}>{selectedEntry.name || "Guest"} · {selectedEntry.party_size}p</span>
            <span className="text-[10px]" style={{ color: "rgba(255,220,100,0.48)" }}>— tap a table to seat</span>
            <button onClick={() => setSelectedEntry(null)} className="w-5 h-5 flex items-center justify-center rounded-full ml-1" style={{ color: "rgba(255,220,100,0.6)" }}><X className="w-3 h-3" /></button>
          </div>
        )}

        {/* ── Modals ────────────────────────────────────────────────────── */}

        {showAdd && (
          <AddGuestDrawer
            onClose={() => setShowAdd(false)}
            onAdded={() => { setShowAdd(false); refreshAll() }}
            restaurantId={restaurantId}
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

        {seatPicker && (
          <SeatTablePicker
            guest={seatPicker}
            tables={tables}
            localOccupants={localOccupantsMap}
            onConfirm={(tableNumber, tableId) => { confirmSeat(seatPicker, tableNumber, tableId); setSeatPicker(null) }}
            onClose={() => setSeatPicker(null)}
          />
        )}

        {tableTapModal && (
          <TableGuestPicker
            tableNumber={tableTapModal.tableNumber}
            tableId={tableTapModal.tableId}
            capacity={tableTapModal.capacity}
            queue={queue}
            restaurantId={restaurantId}
            onClose={() => setTableTapModal(null)}
            onSeated={(tableNumber, occupant) => {
              const next = new Map(localOccupantsMap)
              next.set(tableNumber, occupant)
              localOccupants.current = next
              setLocalOccupantsV(v => v + 1)
              setTableTapModal(null)
              refreshAll()
            }}
          />
        )}

        {clearConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setClearConfirm(null)} />
            <div className="relative w-80 rounded-2xl p-7 text-center" style={{ background: "#100C09", border: "1px solid rgba(239,68,68,0.22)" }}>
              <p className="text-base font-bold mb-1" style={{ color: "rgba(255,248,240,0.95)" }}>Clear Table {clearConfirm.tableNumber}?</p>
              <p className="text-sm mb-6" style={{ color: "rgba(255,200,150,0.45)" }}>{clearConfirm.occupant.name} · {clearConfirm.occupant.party_size}p</p>
              <div className="flex gap-3">
                <button onClick={() => setClearConfirm(null)} className="flex-1 py-3 rounded-xl text-sm font-bold" style={{ background: "rgba(255,185,100,0.06)", color: "rgba(255,200,150,0.60)", border: "1px solid rgba(255,185,100,0.12)" }}>Cancel</button>
                <button onClick={() => { clearTable(clearConfirm.tableId, clearConfirm.tableNumber); setClearConfirm(null) }} className="flex-1 py-3 rounded-xl text-sm font-bold" style={{ background: "rgba(239,68,68,0.14)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.30)" }}>Clear</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </DndContext>
  )
}
