"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Wifi, WifiOff, RefreshCw, Users, CheckCircle2, Clock, Delete, LogIn, X } from "lucide-react"

// Business day starts at 3am
function getBusinessDate(): string {
  const now = new Date()
  if (now.getHours() < 3) now.setDate(now.getDate() - 1)
  return now.toLocaleDateString("en-CA")
}

interface HistoryEntry {
  id: string
  name: string
  party_size: number
  status: "seated" | "removed"
  arrival_time: string
  quoted_wait: number | null
  phone: string | null
  notes: string | null
  updated_at?: string  // when status changed (seated/removed) — used for actual wait
}

const API  = "https://restaurant-brain-production.up.railway.app"
const LOGO = "https://images.getbento.com/accounts/d2ce1ba3bfb5b87e1f0ba2897a682acb/media/images/28198New_Walnut_Logo.png"

// ── Floor plan ─────────────────────────────────────────────────────────────────

const CANVAS_W = 920
const CANVAS_H = 500

const FLOOR_PLAN = [
  { number: 1,  shape: "round",  x: 28,  y: 32,  w: 72,  h: 72,  section: "main" },
  { number: 2,  shape: "round",  x: 28,  y: 148, w: 72,  h: 72,  section: "main" },
  { number: 3,  shape: "round",  x: 28,  y: 264, w: 72,  h: 72,  section: "main" },
  { number: 4,  shape: "square", x: 148, y: 26,  w: 95,  h: 95,  section: "main" },
  { number: 5,  shape: "square", x: 148, y: 163, w: 95,  h: 95,  section: "main" },
  { number: 6,  shape: "square", x: 148, y: 298, w: 95,  h: 95,  section: "main" },
  { number: 7,  shape: "rect",   x: 293, y: 26,  w: 162, h: 112, section: "main" },
  { number: 8,  shape: "rect",   x: 293, y: 196, w: 162, h: 112, section: "main" },
  { number: 9,  shape: "rect",   x: 293, y: 366, w: 162, h: 98,  section: "main" },
  { number: 10, shape: "square", x: 506, y: 26,  w: 95,  h: 95,  section: "main" },
  { number: 11, shape: "square", x: 506, y: 163, w: 95,  h: 95,  section: "main" },
  { number: 12, shape: "square", x: 506, y: 298, w: 95,  h: 95,  section: "main" },
  { number: 13, shape: "round",  x: 748, y: 36,  w: 60,  h: 60,  section: "bar" },
  { number: 14, shape: "round",  x: 748, y: 134, w: 60,  h: 60,  section: "bar" },
  { number: 15, shape: "round",  x: 748, y: 232, w: 60,  h: 60,  section: "bar" },
  { number: 16, shape: "round",  x: 748, y: 330, w: 60,  h: 60,  section: "bar" },
] as const

// ── Restaurant config ──────────────────────────────────────────────────────────

const RESTAURANTS = [
  {
    key:          "original" as const,
    name:         "The Original Walnut Cafe",
    short:        "Original",
    rid:          "0001cafe-0001-4000-8000-000000000001",
    joinUrl:      "https://hostplatform.net/walnut/original/join",
    color:        "#7C5B3A",
    accent:       "rgba(124,91,58,0.12)",
    accentBorder: "rgba(124,91,58,0.35)",
  },
  {
    key:          "southside" as const,
    name:         "The Southside Walnut Cafe",
    short:        "Southside",
    rid:          "0002cafe-0001-4000-8000-000000000002",
    joinUrl:      "https://hostplatform.net/walnut/southside/join",
    color:        "#3A6B5B",
    accent:       "rgba(58,107,91,0.12)",
    accentBorder: "rgba(58,107,91,0.35)",
  },
] as const

// ── Types ──────────────────────────────────────────────────────────────────────

// The /state endpoint returns table_number as a string and includes updated_at
interface RawTable {
  id: string
  table_number: string  // string from API, e.g. "4"
  capacity: number
  status: "available" | "occupied" | "reserved"
  updated_at: string
}

interface Table {
  id: string
  table_number: number  // parsed to int for FLOOR_PLAN lookup
  capacity: number
  status: "available" | "occupied" | "reserved"
}

interface QueueEntry {
  id: string
  name: string
  party_size: number
  status: "waiting" | "ready" | "seated" | "removed"
  arrival_time: string
}

interface Occupant {
  name:       string
  party_size: number
}

interface RestaurantData {
  tables:       Table[]
  queue:        QueueEntry[]
  occupants:    Map<number, Occupant>  // table_number → occupant (from /tables/occupants)
  avgWait:      number
  history:      HistoryEntry[]
  dailyAvgWait: number | null
  online:       boolean
  lastSync:     Date
}

// ── Color system ───────────────────────────────────────────────────────────────

const C = {
  bg:       "#F8FAFC",
  surface:  "#FFFFFF",
  border:   "#E2E8F0",
  text:     "#0F172A",
  text2:    "#475569",
  muted:    "#94A3B8",
  green:    "#16A34A",
  greenBg:  "#F0FDF4",
  orange:   "#D97706",
  orangeBg: "#FFFBEB",
  red:      "#DC2626",
  redBg:    "#FEF2F2",
}

// ── Floor map ─────────────────────────────────────────────────────────────────

function FloorMap({ tables, occupants }: { tables: Table[]; occupants: Map<number, Occupant> }) {
  const byNumber = new Map(tables.map(t => [t.table_number, t]))

  return (
    <div style={{
      position: "relative",
      width: "100%",
      aspectRatio: `${CANVAS_W} / ${CANVAS_H}`,
      background: "#F1F5F9",
      borderRadius: 10,
      overflow: "hidden",
    }}>
      {/* Bar section */}
      <div style={{
        position: "absolute",
        left: `${(726 / CANVAS_W * 100).toFixed(2)}%`,
        top: 0, right: 0, bottom: 0,
        background: "rgba(180,140,80,0.07)",
        borderLeft: "1px solid rgba(180,140,80,0.22)",
      }} />

      {/* Labels */}
      <span style={{ position: "absolute", left: `${(762 / CANVAS_W * 100).toFixed(2)}%`, top: "4%", fontSize: 7, fontWeight: 800, letterSpacing: "0.2em", color: "rgba(100,70,30,0.45)", textTransform: "uppercase", pointerEvents: "none" }}>BAR</span>
      <span style={{ position: "absolute", left: "3%", bottom: "5%", fontSize: 7, fontWeight: 800, letterSpacing: "0.18em", color: "rgba(80,60,40,0.38)", textTransform: "uppercase", pointerEvents: "none" }}>Main Dining</span>

      {/* Tables */}
      {FLOOR_PLAN.map(pos => {
        const t       = byNumber.get(pos.number)
        const isOcc   = occupants.has(pos.number) || (t ? t.status !== "available" : false)
        const occ     = occupants.get(pos.number)
        const isUnknown = !t
        const radius  = pos.shape === "round" ? "50%" : "11%"
        // For tooltip: show name + party size if we have occupant info
        const tooltip = occ
          ? `Table ${pos.number} — ${occ.name !== "Guest" ? occ.name : "Occupied"} (${occ.party_size}p)`
          : `Table ${pos.number}${t ? ` — ${t.status}` : ""}`

        return (
          <div key={pos.number}
            title={tooltip}
            style={{
              position: "absolute",
              left:   `${(pos.x / CANVAS_W * 100).toFixed(3)}%`,
              top:    `${(pos.y / CANVAS_H * 100).toFixed(3)}%`,
              width:  `${(pos.w / CANVAS_W * 100).toFixed(3)}%`,
              height: `${(pos.h / CANVAS_H * 100).toFixed(3)}%`,
              borderRadius: radius,
              background: isUnknown ? "#E2E8F0" : isOcc ? "#FEE2E2" : "#DCFCE7",
              border: `1.5px solid ${isUnknown ? "#CBD5E1" : isOcc ? "#FCA5A5" : "#86EFAC"}`,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              fontWeight: 800,
              color: isUnknown ? "#94A3B8" : isOcc ? "#DC2626" : "#16A34A",
              transition: "background .3s, border-color .3s",
              userSelect: "none",
              overflow: "hidden",
              gap: 1,
            }}
          >
            {/* Table number — slightly smaller when we also show party size */}
            <span style={{ fontSize: "min(1.4cqi, 11px)", lineHeight: 1, fontWeight: 800 }}>
              {pos.number}
            </span>
            {/* Party size badge on occupied tables */}
            {occ && (
              <span style={{ fontSize: "min(0.9cqi, 7px)", lineHeight: 1, opacity: 0.75, fontWeight: 700 }}>
                {occ.party_size}p
              </span>
            )}
          </div>
        )
      })}

      {/* Legend */}
      <div style={{ position: "absolute", right: "1%", bottom: "4%", display: "flex", gap: 8, alignItems: "center" }}>
        {[
          { label: "Open",   bg: "#DCFCE7", border: "#86EFAC" },
          { label: "Seated", bg: "#FEE2E2", border: "#FCA5A5" },
        ].map(({ label, bg, border }) => (
          <span key={label} style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: bg, border: `1px solid ${border}`, display: "inline-block" }} />
            <span style={{ fontSize: 6.5, color: "rgba(60,60,60,0.5)", fontWeight: 700 }}>{label}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Queue list ─────────────────────────────────────────────────────────────────

function QueueList({ queue }: { queue: QueueEntry[] }) {
  const active = queue.filter(e => e.status === "waiting" || e.status === "ready")
  if (!active.length) {
    return <p style={{ fontSize: 13, color: C.muted, fontStyle: "italic" }}>No parties waiting</p>
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, overflowY: "auto", maxHeight: 340 }}>
      {active.slice(0, 10).map((e, i) => {
        const isReady = e.status === "ready"
        const minsAgo = Math.round((Date.now() - new Date(e.arrival_time).getTime()) / 60_000)
        return (
          <div key={e.id} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "8px 12px", borderRadius: 10,
            background: isReady ? C.greenBg : C.bg,
            border: `1px solid ${isReady ? "#BBF7D0" : C.border}`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{
                width: 22, height: 22, borderRadius: "50%",
                background: isReady ? C.green : C.muted,
                color: "#fff", fontSize: 10, fontWeight: 800,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>{i + 1}</span>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{e.name || "Guest"}</p>
                <p style={{ fontSize: 11, color: C.muted }}>Party of {e.party_size} · {minsAgo}m ago</p>
              </div>
            </div>
            {isReady && <span style={{ fontSize: 10, fontWeight: 800, color: C.green, letterSpacing: ".06em", textTransform: "uppercase" }}>Ready</span>}
          </div>
        )
      })}
      {active.length > 10 && (
        <p style={{ fontSize: 11, color: C.muted, textAlign: "center", marginTop: 2 }}>
          +{active.length - 10} more in queue
        </p>
      )}
    </div>
  )
}

// ── PIN screen ─────────────────────────────────────────────────────────────────

function PinScreen({ onSuccess }: { onSuccess: () => void }) {
  const [digits,  setDigits]  = useState<string[]>([])
  const [error,   setError]   = useState("")
  const [loading, setLoading] = useState(false)
  const [shake,   setShake]   = useState(false)

  const verifyPin = useCallback(async (pin: string) => {
    setLoading(true)
    try {
      const r = await fetch("/api/walnut/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      })
      const d = await r.json()
      if (d.ok) {
        onSuccess()
      } else {
        setShake(true)
        setTimeout(() => setShake(false), 600)
        setError("Incorrect PIN")
        setDigits([])
      }
    } catch {
      setError("Connection error — try again")
      setDigits([])
    } finally {
      setLoading(false)
    }
  }, [onSuccess])

  const addDigit = useCallback((d: string) => {
    if (loading) return
    setError("")
    setDigits(prev => {
      if (prev.length >= 4) return prev
      const next = [...prev, d]
      if (next.length === 4) verifyPin(next.join(""))
      return next
    })
  }, [loading, verifyPin])

  const backspace = useCallback(() => {
    if (loading) return
    setError("")
    setDigits(prev => prev.slice(0, -1))
  }, [loading])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") addDigit(e.key)
      else if (e.key === "Backspace") backspace()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [addDigit, backspace])

  const PAD = [["1","2","3"],["4","5","6"],["7","8","9"],["","0","⌫"]]

  return (
    <div style={{
      minHeight: "100dvh", background: C.bg, display: "flex", alignItems: "center",
      justifyContent: "center", fontFamily: "var(--font-geist), system-ui, -apple-system, sans-serif",
    }}>
      <div style={{
        width: "100%", maxWidth: 340, padding: "40px 32px",
        background: C.surface, borderRadius: 24, boxShadow: "0 8px 40px rgba(0,0,0,0.08)",
        border: `1px solid ${C.border}`,
        transform: shake ? "translateX(-4px)" : "none",
        transition: "transform 0.06s",
      }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 28 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} alt="Walnut Cafe" style={{ height: 44, objectFit: "contain", marginBottom: 12 }} />
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: C.muted }}>
            Admin Dashboard
          </p>
          <p style={{ fontSize: 13, color: C.text2, marginTop: 4 }}>Enter your 4-digit PIN</p>
        </div>

        <div style={{ display: "flex", gap: 14, justifyContent: "center", marginBottom: 28 }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{
              width: 18, height: 18, borderRadius: "50%",
              background: digits.length > i ? C.text : "transparent",
              border: `2px solid ${error ? C.red : digits.length > i ? C.text : C.border}`,
              transition: "background 0.1s, border-color 0.2s",
            }} />
          ))}
        </div>

        {error && (
          <p style={{ textAlign: "center", fontSize: 12, color: C.red, fontWeight: 600, marginBottom: 16, marginTop: -12 }}>
            {error}
          </p>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {PAD.flat().map((d, i) => (
            <button key={i}
              onClick={() => d === "⌫" ? backspace() : d ? addDigit(d) : undefined}
              disabled={loading || (!d && d !== "0")}
              style={{
                height: 64, borderRadius: 14, fontSize: d === "⌫" ? 20 : 24, fontWeight: 600,
                background: d === "⌫" ? "rgba(220,38,38,0.05)" : d ? C.bg : "transparent",
                border: d === "⌫" ? "1px solid rgba(220,38,38,0.15)" : d ? `1px solid ${C.border}` : "none",
                color: d === "⌫" ? C.red : d ? C.text : "transparent",
                cursor: d ? "pointer" : "default",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background 0.1s", opacity: loading ? 0.5 : 1,
              }}
            >
              {d === "⌫" ? <Delete size={18} /> : d}
            </button>
          ))}
        </div>

        {loading && <p style={{ textAlign: "center", fontSize: 12, color: C.muted, marginTop: 16 }}>Verifying…</p>}
      </div>
    </div>
  )
}

// ── History Drawer ─────────────────────────────────────────────────────────────

function HistoryDrawer({
  restaurantId, restaurantName, history, tables, onClose, onRestored,
}: {
  restaurantId: string
  restaurantName: string
  history: HistoryEntry[]
  tables: Table[]
  onClose: () => void
  onRestored: () => void
}) {
  const [restoring, setRestoring] = useState<string | null>(null)
  const [seatPicker, setSeatPicker] = useState<HistoryEntry | null>(null)
  const [seating, setSeating] = useState<string | null>(null)

  const fmtTime = (iso: string) => {
    try { return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }) }
    catch { return "—" }
  }

  const restore = async (e: HistoryEntry) => {
    setRestoring(e.id)
    try {
      const r = await fetch(`${API}/queue/${e.id}/restore`, { method: "POST" })
      if (r.ok) onRestored()
    } catch {}
    setRestoring(null)
    onClose()
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

  const availableTables = tables.filter(t => t.status === "available")

  // Suppress unused warning — restaurantId used conceptually for scoping
  void restaurantId

  return (
    <div className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-end" style={{ fontFamily: "var(--font-geist), system-ui, sans-serif" }}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:w-[420px] h-full sm:h-[90vh] sm:max-h-[90vh] sm:mr-4 sm:rounded-2xl flex flex-col overflow-hidden"
        style={{ background: C.surface, border: `1px solid ${C.border}`, zIndex: 1 }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0" style={{ borderBottom: `1px solid ${C.border}` }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: C.muted, marginBottom: 2 }}>Today&apos;s History</p>
            <p style={{ fontSize: 17, fontWeight: 800, color: C.text }}>{restaurantName}</p>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: `1px solid ${C.border}`, cursor: "pointer", color: C.muted }}>
            <X size={14} />
          </button>
        </div>

        {/* Summary */}
        <div className="px-5 py-3 shrink-0 flex gap-3" style={{ borderBottom: `1px solid ${C.border}` }}>
          {[
            { label: "Seated Today", value: seated.length, color: C.green },
            { label: "Removed Today", value: removed.length, color: C.red },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ flex: 1, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 12px", textAlign: "center" }}>
              <p style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>{value}</p>
              <p style={{ fontSize: 10, fontWeight: 600, color: C.muted, marginTop: 2 }}>{label}</p>
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <Clock size={28} style={{ color: C.muted }} />
              <p style={{ fontSize: 14, fontWeight: 600, color: C.text2 }}>No history yet today</p>
              <p style={{ fontSize: 12, color: C.muted, maxWidth: 220, lineHeight: 1.6 }}>Seated and removed guests will appear here.</p>
            </div>
          ) : (
            [
              { key: "removed", label: "Removed", color: C.red,   items: removed },
              { key: "seated",  label: "Seated",  color: C.green, items: seated  },
            ].filter(s => s.items.length > 0).map(section => (
              <div key={section.key} style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: C.muted }}>{section.label}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: section.color }}>{section.items.length}</span>
                </div>
                <div style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${C.border}` }}>
                  {section.items.map((e, i) => (
                    <div key={e.id} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "12px 14px",
                      background: i % 2 === 0 ? C.bg : C.surface,
                      borderTop: i > 0 ? `1px solid ${C.border}` : "none",
                    }}>
                      <div style={{ width: 3, height: 40, borderRadius: 2, background: section.color, opacity: 0.6, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 2 }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name || "Guest"}</span>
                          <span style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>{fmtTime(e.arrival_time)}</span>
                        </div>
                        <div style={{ fontSize: 11, color: C.text2, display: "flex", gap: 6 }}>
                          <span>{e.party_size} {e.party_size === 1 ? "guest" : "guests"}</span>
                          {e.quoted_wait != null && <><span style={{ opacity: 0.4 }}>·</span><span>{e.quoted_wait}m quoted</span></>}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                        <button onClick={() => setSeatPicker(e)}
                          style={{ height: 30, padding: "0 10px", borderRadius: 8, fontSize: 11, fontWeight: 600, background: C.greenBg, color: C.green, border: `1px solid #BBF7D0`, cursor: "pointer" }}>
                          Seat
                        </button>
                        <button onClick={() => restore(e)} disabled={restoring === e.id}
                          style={{ height: 30, padding: "0 10px", borderRadius: 8, fontSize: 11, fontWeight: 600, background: C.bg, color: C.text2, border: `1px solid ${C.border}`, cursor: "pointer", opacity: restoring === e.id ? 0.5 : 1 }}>
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

      {/* Seat at table picker */}
      {seatPicker && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSeatPicker(null)} />
          <div className="relative w-full sm:max-w-sm mx-0 sm:mx-4 rounded-t-3xl sm:rounded-2xl p-6"
            style={{ background: C.surface, border: `1px solid ${C.border}`, zIndex: 1 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4 }}>Seat {seatPicker.name || "Guest"} ({seatPicker.party_size}p)</p>
            <p style={{ fontSize: 12, color: C.text2, marginBottom: 16 }}>Choose an available table:</p>
            {availableTables.length === 0 ? (
              <p style={{ fontSize: 13, color: C.muted, textAlign: "center", padding: "24px 0" }}>No tables available right now</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16 }}>
                {availableTables.map(t => (
                  <button key={t.id} onClick={() => seatAtTable(seatPicker, t.id)} disabled={seating === seatPicker.id}
                    style={{ height: 56, borderRadius: 10, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, background: C.greenBg, border: `1px solid #BBF7D0`, cursor: "pointer", opacity: seating === seatPicker.id ? 0.5 : 1 }}>
                    <span style={{ fontSize: 18, fontWeight: 800, color: C.green }}>{t.table_number}</span>
                    <span style={{ fontSize: 9, color: C.green, opacity: 0.7 }}>{t.capacity}p</span>
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => setSeatPicker(null)}
              style={{ width: "100%", padding: "10px 0", borderRadius: 10, background: C.bg, border: `1px solid ${C.border}`, color: C.text2, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Day History inline stat box ────────────────────────────────────────────────

function DayHistory({ history, restaurantColor }: { history: HistoryEntry[]; restaurantColor: string }) {
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const fmtTime = (iso: string) => {
    try { return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }) }
    catch { return "—" }
  }

  const fmtWait = (entry: HistoryEntry): string => {
    // Prefer actual elapsed time if we have updated_at (when they were seated/removed)
    if (entry.updated_at) {
      try {
        const ms = new Date(entry.updated_at).getTime() - new Date(entry.arrival_time).getTime()
        if (ms > 0) {
          const mins = Math.round(ms / 60_000)
          return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`
        }
      } catch {}
    }
    // Fall back to quoted wait
    return entry.quoted_wait != null ? `${entry.quoted_wait}m quoted` : "—"
  }

  const copyPhone = async (phone: string, id: string) => {
    try { await navigator.clipboard.writeText(phone); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000) } catch {}
  }

  // Sort newest first — use updated_at if available, else arrival_time
  const sorted = [...history].sort((a, b) => {
    const ta = new Date(a.updated_at ?? a.arrival_time).getTime()
    const tb = new Date(b.updated_at ?? b.arrival_time).getTime()
    return tb - ta
  })

  const seated  = history.filter(e => e.status === "seated").length
  const removed = history.filter(e => e.status === "removed").length

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: "18px 20px", marginBottom: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Today&apos;s Guest Log</h3>
          <span style={{ fontSize: 11, color: C.green, fontWeight: 700, background: C.greenBg, padding: "2px 8px", borderRadius: 12, border: "1px solid #BBF7D0" }}>
            {seated} seated
          </span>
          <span style={{ fontSize: 11, color: C.muted, fontWeight: 600, background: C.bg, padding: "2px 8px", borderRadius: 12, border: `1px solid ${C.border}` }}>
            {removed} removed
          </span>
        </div>
        <span style={{ fontSize: 11, color: C.muted }}>{history.length} total</span>
      </div>

      {sorted.length === 0 ? (
        <p style={{ fontSize: 13, color: C.muted, fontStyle: "italic", textAlign: "center", padding: "24px 0" }}>
          No guests yet today — history appears here as guests are seated or removed.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                {["Status", "Name", "Party", "Phone", "Added", "Quoted", "Waited"].map(h => (
                  <th key={h} style={{
                    padding: "6px 10px", textAlign: "left", fontSize: 10, fontWeight: 700,
                    color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em",
                    whiteSpace: "nowrap",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((e, i) => {
                const isSeated = e.status === "seated"
                const rowBg = i % 2 === 0 ? C.bg : C.surface
                return (
                  <tr key={e.id} style={{ background: rowBg, borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: "9px 10px", whiteSpace: "nowrap" }}>
                      <span style={{
                        fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase",
                        padding: "2px 7px", borderRadius: 6,
                        background: isSeated ? C.greenBg : "#FEF2F2",
                        color: isSeated ? C.green : C.red,
                        border: `1px solid ${isSeated ? "#BBF7D0" : "#FECACA"}`,
                      }}>
                        {isSeated ? "Seated" : "Removed"}
                      </span>
                    </td>
                    <td style={{ padding: "9px 10px", fontWeight: 600, color: C.text, whiteSpace: "nowrap" }}>
                      {e.name || "Guest"}
                    </td>
                    <td style={{ padding: "9px 10px", color: C.text2, textAlign: "center" }}>
                      {e.party_size}
                    </td>
                    <td style={{ padding: "9px 10px", whiteSpace: "nowrap" }}>
                      {e.phone ? (
                        <button onClick={() => copyPhone(e.phone!, e.id)}
                          style={{
                            fontSize: 11, fontWeight: 500, padding: "3px 8px", borderRadius: 6,
                            background: copiedId === e.id ? C.greenBg : "transparent",
                            color: copiedId === e.id ? C.green : restaurantColor,
                            border: `1px solid ${copiedId === e.id ? "#BBF7D0" : "transparent"}`,
                            cursor: "pointer", fontFamily: "monospace",
                          }}>
                          {copiedId === e.id ? "✓ Copied" : e.phone}
                        </button>
                      ) : (
                        <span style={{ color: C.muted, fontStyle: "italic" }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "9px 10px", color: C.text2, whiteSpace: "nowrap" }}>
                      {fmtTime(e.arrival_time)}
                    </td>
                    <td style={{ padding: "9px 10px", color: C.text2, whiteSpace: "nowrap" }}>
                      {e.quoted_wait != null ? `${e.quoted_wait}m` : <span style={{ color: C.muted }}>—</span>}
                    </td>
                    <td style={{ padding: "9px 10px", color: C.text2, whiteSpace: "nowrap", fontWeight: 500 }}>
                      {fmtWait(e)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Main dashboard ─────────────────────────────────────────────────────────────

export default function WalnutDashboard() {
  // PIN is NEVER pre-checked from the cookie — always required on every page load
  const [pinOk,     setPinOk]     = useState(false)
  const [activeTab, setActiveTab] = useState<0 | 1>(0)
  const [entering,  setEntering]  = useState<string | null>(null)
  const [data, setData] = useState<[RestaurantData, RestaurantData]>([
    { tables: [], queue: [], occupants: new Map(), avgWait: 0, history: [], dailyAvgWait: null, online: true,  lastSync: new Date() },
    { tables: [], queue: [], occupants: new Map(), avgWait: 0, history: [], dailyAvgWait: null, online: true,  lastSync: new Date() },
  ])

  // Fetch using /state (same endpoint the station page uses) so table statuses are live.
  // The API returns many duplicate records per table (historical status log), so we
  // deduplicate by table_number keeping the most recently-updated record.
  // table_number comes back as a string from the API, so we parse it to int.
  const fetchAll = useCallback(async () => {
    const results = await Promise.allSettled(
      RESTAURANTS.map(async (r) => {
        const [stateRes, occupantsRes] = await Promise.all([
          fetch(`${API}/state?restaurant_id=${r.rid}`),
          fetch(`${API}/tables/occupants?restaurant_id=${r.rid}`),
        ])
        if (!stateRes.ok) throw new Error("offline")
        const d = await stateRes.json()

        // Deduplicate: keep the most recently-updated record for each table_number
        const latestByNum = new Map<string, RawTable>()
        for (const t of (d.tables ?? []) as RawTable[]) {
          const prev = latestByNum.get(t.table_number)
          if (!prev || t.updated_at > prev.updated_at) {
            latestByNum.set(t.table_number, t)
          }
        }
        // Parse table_number to integer so FLOOR_PLAN lookups work
        const tables: Table[] = Array.from(latestByNum.values()).map(t => ({
          id:           t.id,
          table_number: parseInt(t.table_number, 10),
          capacity:     t.capacity,
          status:       t.status,
        }))

        // Build occupant map: include ALL entries from the occupants endpoint —
        // /tables/occupants is the true source of truth for which tables have guests.
        const occupants = new Map<number, Occupant>()
        if (occupantsRes.ok) {
          const raw = await occupantsRes.json() as Record<string, { name: string; party_size: number }>
          for (const [numStr, occ] of Object.entries(raw)) {
            const num = parseInt(numStr, 10)
            occupants.set(num, { name: occ.name, party_size: occ.party_size })
          }
        }

        // Fetch history for daily stats
        let history: HistoryEntry[] = []
        let dailyAvgWait: number | null = null
        try {
          const histRes = await fetch(`${API}/queue/history?restaurant_id=${r.rid}`)
          if (histRes.ok) {
            const allHistory: HistoryEntry[] = await histRes.json()
            const bd = getBusinessDate()
            // Filter to today's business day (entries after 3am today)
            history = allHistory.filter(e => {
              try {
                const d = new Date(e.arrival_time)
                const entryDate = d.toLocaleDateString("en-CA")
                const entryHour = d.getHours()
                // If arrival is before 3am, it belongs to previous business day
                if (entryHour < 3) {
                  const prev = new Date(d)
                  prev.setDate(prev.getDate() - 1)
                  return prev.toLocaleDateString("en-CA") === bd
                }
                return entryDate === bd
              } catch { return false }
            })
            // Compute daily avg from today's seated guests' quoted_wait
            const seatedWithWait = history.filter(e => e.status === "seated" && e.quoted_wait != null)
            if (seatedWithWait.length > 0) {
              dailyAvgWait = Math.round(seatedWithWait.reduce((a, e) => a + (e.quoted_wait ?? 0), 0) / seatedWithWait.length)
            }
          }
        } catch {}

        return {
          tables,
          queue:        (d.queue   ?? []) as QueueEntry[],
          occupants,
          avgWait:      (d.avg_wait ?? 0) as number,
          history,
          dailyAvgWait,
        }
      })
    )
    setData(prev => {
      const next: [RestaurantData, RestaurantData] = [{ ...prev[0] }, { ...prev[1] }]
      results.forEach((r, i) => {
        if (r.status === "fulfilled") {
          next[i] = { ...r.value, online: true, lastSync: new Date() }
        } else {
          next[i] = { ...prev[i], online: false, occupants: prev[i].occupants, history: prev[i].history, dailyAvgWait: prev[i].dailyAvgWait }
        }
      })
      return next
    })
  }, [])

  useEffect(() => {
    if (!pinOk) return
    fetchAll()
    const t = setInterval(fetchAll, 10_000)
    return () => clearInterval(t)
  }, [pinOk, fetchAll])

  async function enterRestaurant(key: "original" | "southside") {
    setEntering(key)
    try {
      const r = await fetch("/api/walnut/enter-restaurant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account: key }),
      })
      if (r.ok) {
        const d = await r.json()
        window.location.href = d.redirect
      } else {
        alert("Could not enter station — please re-enter your PIN and try again")
      }
    } catch {
      alert("Connection error — try again")
    } finally {
      setEntering(null)
    }
  }

  // ── PIN gate (always shown on load) ─────────────────────────────────────────
  if (!pinOk) return <PinScreen onSuccess={() => setPinOk(true)} />

  // ── Derived stats for both restaurants ───────────────────────────────────────
  // Use FLOOR_PLAN.length (16) as the canonical total — the API may not have all
  // tables seeded for a restaurant, and we always know there are 16 tables.
  function stats(d: RestaurantData) {
    const total     = FLOOR_PLAN.length  // always 16
    // Use occupants map as the source of truth (since we removed the occupiedNums filter).
    // Fall back to table status count for tables that have no occupant entry.
    const fromOccupants = d.occupants.size
    const fromTables    = d.tables.filter(t => t.status !== "available").length
    const occupied  = Math.max(fromOccupants, fromTables)
    const available = total - occupied
    const waiting   = d.queue.filter(e => e.status === "waiting" || e.status === "ready").length
    const occupancy = Math.round(occupied / total * 100)
    return { total, available, occupied, waiting, occupancy, avgWait: d.dailyAvgWait ?? d.avgWait }
  }

  const restaurant = RESTAURANTS[activeTab]
  const d          = data[activeTab]
  const s          = stats(d)

  const activeQueue    = d.queue.filter(e => e.status === "waiting" || e.status === "ready")
  const longestWait = activeQueue.length > 0
    ? (() => {
        const waits = activeQueue
          .map(e => Math.round((Date.now() - new Date(e.arrival_time).getTime()) / 60_000))
          .filter(m => m >= 0)
        return waits.length > 0 ? Math.max(...waits) : null
      })()
    : null

  return (
    <div style={{
      minHeight: "100vh", background: C.bg,
      fontFamily: "var(--font-geist), system-ui, -apple-system, sans-serif",
      color: C.text,
    }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{
        background: C.surface, borderBottom: `1px solid ${C.border}`,
        padding: "0 28px", display: "flex", alignItems: "center",
        justifyContent: "space-between", height: 60,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} alt="Walnut Cafe" style={{ height: 32, objectFit: "contain" }} />
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: C.text, lineHeight: 1.2 }}>The Walnut Cafe</p>
            <p style={{ fontSize: 10, color: C.muted }}>Admin Dashboard</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link href="/walnut/logins"
            style={{ fontSize: 12, fontWeight: 600, color: C.text2, padding: "7px 14px", borderRadius: 8, border: `1px solid ${C.border}`, textDecoration: "none" }}>
            Logins
          </Link>
          <button onClick={fetchAll}
            style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: C.muted }}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* ── Summary cards ───────────────────────────────────────────────────── */}
      <div style={{ padding: "24px 28px 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {RESTAURANTS.map((r, i) => {
          const rd = data[i]
          const rs = stats(rd)
          const isActive = activeTab === i
          return (
            <div key={r.key} style={{
              background: C.surface,
              border: `2px solid ${isActive ? r.color : C.border}`,
              borderRadius: 16, padding: "18px 20px",
              boxShadow: isActive ? `0 0 0 3px ${r.color}22` : "none",
              transition: "border-color .15s, box-shadow .15s",
            }}>
              {/* Clickable area to switch tab */}
              <button onClick={() => setActiveTab(i as 0 | 1)}
                style={{ all: "unset", cursor: "pointer", display: "block", width: "100%" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
                  <div>
                    <p style={{ fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: C.muted, marginBottom: 3 }}>{r.short}</p>
                    <p style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{r.name}</p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    {rd.online ? <Wifi size={13} style={{ color: C.green }} /> : <WifiOff size={13} style={{ color: C.red }} />}
                    <span style={{ fontSize: 10, color: rd.online ? C.green : C.red, fontWeight: 600 }}>
                      {rd.online ? "Live" : "Offline"}
                    </span>
                  </div>
                </div>

                {/* 4 stats */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 14 }}>
                  {[
                    { label: "Open",    value: rs.available, color: C.green,  bg: C.greenBg,  bdr: "#BBF7D0" },
                    { label: "Seated",  value: rs.occupied,  color: C.red,    bg: "#FEF2F2",  bdr: "#FECACA" },
                    { label: "Occ %",   value: `${rs.occupancy}%`, color: C.text2, bg: C.bg, bdr: C.border },
                    { label: "Waiting", value: rs.waiting,   color: C.orange, bg: C.orangeBg, bdr: "#FDE68A" },
                  ].map(({ label, value, color, bg, bdr }) => (
                    <div key={label} style={{ background: bg, borderRadius: 10, padding: "8px 10px", border: `1px solid ${bdr}`, textAlign: "center" }}>
                      <p style={{ fontSize: 9, color, fontWeight: 700, marginBottom: 2, letterSpacing: ".04em", textTransform: "uppercase" }}>{label}</p>
                      <p style={{ fontSize: 20, fontWeight: 800, color }}>{value}</p>
                    </div>
                  ))}
                </div>
              </button>

              {/* Enter station button */}
              <button
                onClick={() => enterRestaurant(r.key)}
                disabled={entering === r.key}
                style={{
                  width: "100%", padding: "9px 0", borderRadius: 10,
                  background: isActive ? r.color : "#F1F5F9",
                  border: `1.5px solid ${isActive ? r.color : C.border}`,
                  color: isActive ? "#fff" : C.text2,
                  fontSize: 12, fontWeight: 700, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                  opacity: entering === r.key ? 0.6 : 1,
                  transition: "background .15s, color .15s",
                }}>
                <LogIn size={13} />
                {entering === r.key ? "Entering…" : `Enter ${r.short} Station`}
              </button>
            </div>
          )
        })}
      </div>

      {/* ── Detail view ─────────────────────────────────────────────────────── */}
      <div style={{ padding: "20px 28px 40px" }}>

        {/* Section header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 4, height: 22, borderRadius: 2, background: restaurant.color }} />
            <h2 style={{ fontSize: 17, fontWeight: 800, color: C.text }}>{restaurant.name}</h2>
          </div>
          <span style={{ fontSize: 11, color: C.muted }}>
            Last sync {d.lastSync.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>

        {/* Stats row — simple, scannable numbers */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 16 }}>
          {[
            { icon: CheckCircle2, label: "Tables Open",  value: s.available, sub: `of ${s.total}`, color: C.green,  bg: C.greenBg,  bdr: "#BBF7D0" },
            { icon: Users,        label: "Tables Seated", value: s.occupied, sub: `${s.occupancy}% full`, color: s.occupancy >= 80 ? C.red : s.occupancy >= 50 ? C.orange : C.text2, bg: s.occupancy >= 80 ? "#FEF2F2" : s.occupancy >= 50 ? C.orangeBg : C.bg, bdr: s.occupancy >= 80 ? "#FECACA" : s.occupancy >= 50 ? "#FDE68A" : C.border },
            { icon: Clock,        label: "Parties Waiting", value: s.waiting, sub: s.waiting === 0 ? "no queue" : s.waiting === 1 ? "1 party" : `${s.waiting} parties`, color: s.waiting > 0 ? C.orange : C.green, bg: s.waiting > 0 ? C.orangeBg : C.greenBg, bdr: s.waiting > 0 ? "#FDE68A" : "#BBF7D0" },
            { icon: Clock,        label: "Avg Wait",     value: s.avgWait > 0 ? `${Math.round(s.avgWait)}m` : "—", sub: "estimated", color: s.avgWait > 20 ? C.red : s.avgWait > 0 ? C.orange : C.muted, bg: C.bg, bdr: C.border },
            { icon: Clock,        label: "Longest Wait", value: longestWait !== null && longestWait > 0 ? `${longestWait}m` : "—", sub: "in queue", color: longestWait !== null && longestWait >= 30 ? C.red : longestWait !== null && longestWait > 0 ? C.orange : C.muted, bg: C.bg, bdr: C.border },
          ].map(({ icon: Icon, label, value, sub, color, bg, bdr }) => (
            <div key={label} style={{
              background: bg, border: `1px solid ${bdr}`, borderRadius: 14,
              padding: "14px 16px", display: "flex", flexDirection: "column", gap: 4,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                <Icon size={12} style={{ color, flexShrink: 0 }} />
                <span style={{ fontSize: 10, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: ".06em" }}>{label}</span>
              </div>
              <p style={{ fontSize: 28, fontWeight: 900, color, lineHeight: 1 }}>{value}</p>
              <p style={{ fontSize: 11, color, opacity: 0.6 }}>{sub}</p>
            </div>
          ))}
        </div>

        {/* Live waitlist */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: "18px 20px", marginBottom: 16 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 14 }}>
            Waitlist
            {s.waiting > 0 && (
              <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 800, background: C.orange, color: "#fff", padding: "2px 7px", borderRadius: 20 }}>
                {s.waiting}
              </span>
            )}
          </h3>
          <QueueList queue={d.queue} />
        </div>

        {/* Today's guest history */}
        <DayHistory history={d.history} restaurantColor={restaurant.color} />

        {/* Guest join links */}
        <div>
          <h3 style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
            Guest Join Links
          </h3>
          <div style={{ display: "flex", gap: 10 }}>
            {RESTAURANTS.map(r => (
              <div key={r.key} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 18px", flex: 1 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: r.color, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>{r.short}</p>
                <p style={{ fontSize: 11, color: C.text2, marginBottom: 8, wordBreak: "break-all" }}>{r.joinUrl}</p>
                <a href={r.joinUrl} target="_blank" rel="noreferrer"
                  style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, color: r.color, padding: "6px 12px", borderRadius: 8, background: r.accent, border: `1px solid ${r.accentBorder}`, textDecoration: "none" }}>
                  Open ↗
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  )
}
