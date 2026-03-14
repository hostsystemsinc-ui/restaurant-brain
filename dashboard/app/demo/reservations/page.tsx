"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ChevronLeft, ChevronRight, Plus, X, Edit2, Trash2,
  Users, Phone, Check, Loader2, LayoutDashboard,
  CalendarCheck, RefreshCw, CalendarDays, Clock,
} from "lucide-react"

const API                = "https://restaurant-brain-production.up.railway.app"
const DEMO_RESTAURANT_ID = "dec0cafe-0000-4000-8000-000000000001"

// ── Types ──────────────────────────────────────────────────────────────────────

interface Reservation {
  id:         string
  guest_name: string
  party_size: number
  date:       string  // "YYYY-MM-DD"
  time:       string  // "HH:MM" or "HH:MM:SS" from Supabase
  phone:      string | null
  email:      string | null
  notes:      string | null
  status:     "confirmed" | "seated" | "cancelled" | "no-show"
  source:     string
  created_at: string
}

// ── Date helpers — always use LOCAL date, never UTC ────────────────────────────

function toDateStr(d: Date): string {
  const y   = d.getFullYear()
  const mo  = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${mo}-${day}`
}

function localDate(ds: string): Date {
  const [y, mo, d] = ds.split("-").map(Number)
  return new Date(y, mo - 1, d)
}

function fmt12(t: string): string {
  const [h, m] = t.split(":").map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`
}

function displayDay(ds: string): string {
  const today = toDateStr(new Date())
  const tmr   = toDateStr(new Date(new Date().setDate(new Date().getDate() + 1)))
  if (ds === today) return "Today"
  if (ds === tmr)   return "Tomorrow"
  return localDate(ds).toLocaleDateString("en-US", { weekday: "long" })
}

function longDate(ds: string): string {
  return localDate(ds).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  })
}

function getMonthGrid(year: number, month: number) {
  const first  = new Date(year, month, 1)
  const last   = new Date(year, month + 1, 0)
  const padStart = first.getDay()
  const out: { date: Date; current: boolean }[] = []

  for (let i = padStart - 1; i >= 0; i--)
    out.push({ date: new Date(year, month, -i), current: false })
  for (let d = 1; d <= last.getDate(); d++)
    out.push({ date: new Date(year, month, d), current: true })
  const rem = out.length % 7
  if (rem > 0)
    for (let i = 1; i <= 7 - rem; i++)
      out.push({ date: new Date(year, month + 1, i), current: false })

  return out
}

// ── Urgency ────────────────────────────────────────────────────────────────────

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

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
]
const DAY_ABBR = ["Su","Mo","Tu","We","Th","Fr","Sa"]
const STATUSES = ["confirmed","seated","cancelled","no-show"] as const

// ── Design tokens (dark host-view palette) ─────────────────────────────────────

const BG   = "#0C0907"
const SRF  = "#100C09"
const SRF2 = "#0A0705"
const BR   = "rgba(255,185,100,0.16)"
const BR2  = "rgba(255,185,100,0.14)"
const TX   = "rgba(255,248,240,0.92)"
const TX2  = "rgba(255,220,180,0.5)"
const MU   = "rgba(255,200,150,0.65)"
const ACC  = "#D9321C"
const GRN  = "#22c55e"

// ── StatusPill ─────────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    confirmed: { bg: "rgba(34,197,94,0.1)",   color: GRN,        label: "Confirmed" },
    seated:    { bg: "rgba(59,130,246,0.12)",  color: "#60a5fa",  label: "Seated"    },
    cancelled: { bg: "rgba(239,68,68,0.1)",    color: "#f87171",  label: "Cancelled" },
    "no-show": { bg: "rgba(148,163,184,0.1)",  color: MU,         label: "No Show"   },
  }
  const s = map[status] ?? map.confirmed
  return (
    <span style={{
      fontSize: 10, padding: "2px 8px", borderRadius: 99, fontWeight: 800,
      background: s.bg, color: s.color, letterSpacing: "0.07em",
      textTransform: "uppercase", border: `1px solid ${s.color}22`,
    }}>
      {s.label}
    </span>
  )
}

// ── Urgency Badge ──────────────────────────────────────────────────────────────

function UrgencyBadge({ urgency }: { urgency: ResUrgency }) {
  if (urgency === "upcoming") return null
  const cfg = {
    arriving: { label: "ARRIVING SOON", color: "#fbbf24", bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.25)", pulse: false },
    now:      { label: "DUE NOW",        color: "#f97316", bg: "rgba(249,115,22,0.1)",  border: "rgba(249,115,22,0.25)", pulse: true  },
    late:     { label: "LATE",           color: "#ef4444", bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.25)",  pulse: true  },
  }[urgency]
  return (
    <span
      className={cfg.pulse ? "animate-pulse" : ""}
      style={{
        fontSize: 9, padding: "2px 8px", borderRadius: 99, fontWeight: 900,
        background: cfg.bg, color: cfg.color, letterSpacing: "0.12em",
        border: `1px solid ${cfg.border}`, whiteSpace: "nowrap",
      }}
    >
      {cfg.label}
    </span>
  )
}

// ── Mini Calendar ──────────────────────────────────────────────────────────────

function MiniCalendar({
  selectedDate, onSelect, reservationsByDate,
}: {
  selectedDate:     string
  onSelect:         (d: string) => void
  reservationsByDate: Map<string, number>
}) {
  const today = toDateStr(new Date())
  const [year,  setYear]  = useState(() => parseInt(selectedDate.slice(0, 4)))
  const [month, setMonth] = useState(() => parseInt(selectedDate.slice(5, 7)) - 1)

  useEffect(() => {
    setYear(parseInt(selectedDate.slice(0, 4)))
    setMonth(parseInt(selectedDate.slice(5, 7)) - 1)
  }, [selectedDate])

  const grid = useMemo(() => getMonthGrid(year, month), [year, month])

  function prev() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  function next() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }
  function jumpToday() {
    const n = new Date()
    setYear(n.getFullYear()); setMonth(n.getMonth())
    onSelect(toDateStr(n))
  }

  return (
    <div style={{ padding: "0 14px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <button onClick={prev} style={calBtnSt}>
          <ChevronLeft style={{ width: 13, height: 13 }} />
        </button>
        <button
          onClick={jumpToday}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, color: TX2, letterSpacing: "0.04em" }}
        >
          {MONTH_NAMES[month]} {year}
        </button>
        <button onClick={next} style={calBtnSt}>
          <ChevronRight style={{ width: 13, height: 13 }} />
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 4 }}>
        {DAY_ABBR.map(d => (
          <div key={d} style={{ textAlign: "center", fontSize: 9, fontWeight: 700, letterSpacing: "0.07em", color: "rgba(255,200,150,0.2)", paddingBottom: 8 }}>
            {d}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", rowGap: 2 }}>
        {grid.map(({ date, current }, i) => {
          const ds      = toDateStr(date)
          const isSel   = ds === selectedDate
          const isToday = ds === today
          const isPast  = ds < today
          const count   = current ? (reservationsByDate.get(ds) ?? 0) : 0

          return (
            <button
              key={i}
              onClick={() => current && onSelect(ds)}
              style={{
                width: "100%", aspectRatio: "1",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: 3, border: "none", borderRadius: 8,
                cursor: current ? "pointer" : "default",
                background: isSel ? ACC : isToday ? "rgba(217,50,28,0.1)" : "transparent",
                outline: isToday && !isSel ? "1px solid rgba(217,50,28,0.45)" : "none",
                outlineOffset: -1,
                transition: "background 0.1s",
              }}
            >
              <span style={{
                fontSize: 11, fontWeight: isSel || isToday ? 700 : 400, lineHeight: 1,
                color: isSel
                  ? "white"
                  : !current
                  ? "rgba(255,200,150,0.07)"
                  : isPast
                  ? "rgba(255,200,150,0.2)"
                  : "rgba(255,240,220,0.7)",
              }}>
                {date.getDate()}
              </span>
              {count > 0 && (
                <div style={{
                  minWidth: 14, height: 4, borderRadius: 99,
                  background: isSel ? "rgba(255,255,255,0.6)" : ACC,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 8, fontWeight: 800, color: isSel ? ACC : "white",
                  padding: count > 1 ? "0 3px" : "0 2px",
                }}>
                  {count > 1 ? count : ""}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

const calBtnSt: React.CSSProperties = {
  width: 26, height: 26, borderRadius: 7, cursor: "pointer",
  background: "rgba(255,185,100,0.16)", border: `1px solid ${BR}`,
  display: "flex", alignItems: "center", justifyContent: "center",
  color: MU,
}

// ── Reservation Card ───────────────────────────────────────────────────────────

function ResCard({ res, onEdit, onDelete, onMarkNoShow, now }: {
  res: Reservation
  onEdit: () => void
  onDelete: () => void
  onMarkNoShow?: () => void
  now: Date
}) {
  const today = toDateStr(new Date())
  const isToday = res.date === today
  const urgency: ResUrgency = (isToday && res.status === "confirmed")
    ? getResUrgency(res.date, res.time, now)
    : "upcoming"

  const borderColor: Record<string, string> = {
    confirmed: urgency === "late" ? "#ef4444" : urgency === "now" ? "#f97316" : urgency === "arriving" ? "#fbbf24" : GRN,
    seated:    "#60a5fa",
    cancelled: "rgba(255,200,150,0.50)",
    "no-show": "rgba(255,200,150,0.50)",
  }
  const isCancelled = res.status === "cancelled" || res.status === "no-show"
  const [timePart, period] = fmt12(res.time).split(" ")

  return (
    <div style={{
      display: "flex", alignItems: "stretch",
      background: urgency === "late"
        ? "rgba(239,68,68,0.04)"
        : urgency === "now"
        ? "rgba(249,115,22,0.03)"
        : "rgba(255,185,100,0.025)",
      borderRadius: 12, overflow: "hidden",
      border: `1px solid ${BR}`,
      borderLeft: `3px solid ${borderColor[res.status] ?? GRN}`,
      opacity: isCancelled ? 0.55 : 1,
      transition: "opacity 0.15s",
    }}>
      {/* Time */}
      <div style={{
        width: 68, flexShrink: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", padding: "16px 0",
        borderRight: `1px solid ${BR2}`,
      }}>
        <span style={{ fontSize: 19, fontWeight: 800, color: TX, lineHeight: 1 }}>{timePart}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: MU, marginTop: 3, letterSpacing: "0.1em" }}>{period}</span>
      </div>

      {/* Info */}
      <div style={{ flex: 1, padding: "13px 16px", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: TX }}>{res.guest_name}</span>
          <StatusPill status={res.status} />
          {urgency !== "upcoming" && res.status === "confirmed" && <UrgencyBadge urgency={urgency} />}
          {res.source === "opentable" && (
            <span style={{
              fontSize: 9, padding: "2px 7px", borderRadius: 4, fontWeight: 800,
              background: "rgba(218,55,67,0.1)", color: "#DA3743",
              border: "1px solid rgba(218,55,67,0.22)", letterSpacing: "0.08em",
            }}>
              OPENTABLE
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: TX2, display: "flex", alignItems: "center", gap: 4 }}>
            <Users style={{ width: 11, height: 11 }} />
            {res.party_size} {res.party_size === 1 ? "guest" : "guests"}
          </span>
          {res.phone && (
            <span style={{ fontSize: 12, color: TX2, display: "flex", alignItems: "center", gap: 4 }}>
              <Phone style={{ width: 11, height: 11 }} />
              {res.phone}
            </span>
          )}
          {res.notes && (
            <span style={{ fontSize: 11, color: MU, fontStyle: "italic" }}>
              {res.notes.length > 70 ? res.notes.slice(0, 70) + "…" : res.notes}
            </span>
          )}
        </div>

        {/* Late quick-action */}
        {urgency === "late" && res.status === "confirmed" && onMarkNoShow && (
          <div style={{ marginTop: 8 }}>
            <button
              onClick={onMarkNoShow}
              style={{
                height: 24, padding: "0 10px", borderRadius: 6, border: "1px solid rgba(239,68,68,0.3)",
                background: "rgba(239,68,68,0.08)", color: "#f87171",
                fontSize: 10, fontWeight: 700, cursor: "pointer", letterSpacing: "0.08em",
              }}
            >
              Mark No-Show
            </button>
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{
        display: "flex", flexDirection: "column", justifyContent: "center", gap: 5,
        padding: "0 14px", flexShrink: 0, borderLeft: `1px solid ${BR2}`,
      }}>
        <button
          onClick={onEdit}
          style={{ width: 30, height: 30, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,185,100,0.14)", border: `1px solid ${BR}`, color: TX2 }}
          title="Edit"
        >
          <Edit2 style={{ width: 12, height: 12 }} />
        </button>
        <button
          onClick={onDelete}
          style={{ width: 30, height: 30, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)", color: "#f87171" }}
          title="Delete"
        >
          <Trash2 style={{ width: 12, height: 12 }} />
        </button>
      </div>
    </div>
  )
}

// ── Reservation Drawer ─────────────────────────────────────────────────────────

function ResDrawer({
  initial, defaultDate, onClose, onSave,
}: {
  initial:     Partial<Reservation> | null
  defaultDate: string
  onClose:     () => void
  onSave:      (newResInfo?: { guest_name: string; time: string }) => void
}) {
  const isEdit = !!initial?.id

  const [name,    setName]    = useState(initial?.guest_name ?? "")
  const [party,   setParty]   = useState(initial?.party_size ?? 2)
  const [date,    setDate]    = useState(initial?.date ?? defaultDate)
  const [time,    setTime]    = useState(initial?.time ? initial.time.slice(0, 5) : "19:00")
  const [phone,   setPhone]   = useState(initial?.phone ?? "")
  const [email,   setEmail]   = useState(initial?.email ?? "")
  const [notes,   setNotes]   = useState(initial?.notes ?? "")
  const [status,  setStatus]  = useState<string>(initial?.status ?? "confirmed")
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState("")

  const save = async () => {
    if (!name.trim()) { setError("Guest name is required."); return }
    if (!date || !time) { setError("Date and time are required."); return }
    setLoading(true); setError("")
    try {
      const body = {
        guest_name:    name.trim(),
        party_size:    party,
        date,
        time:          time.slice(0, 5),
        phone:         phone.trim() || null,
        email:         email.trim() || null,
        notes:         notes.trim() || null,
        source:        initial?.source ?? "host",
        restaurant_id: DEMO_RESTAURANT_ID,
      }
      const url    = isEdit ? `${API}/reservations/${initial!.id}` : `${API}/reservations`
      const method = isEdit ? "PUT" : "POST"
      const res = await fetch(url, {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.detail ?? "Server error — please check Supabase tables are created.")
      }
      if (isEdit && status !== initial?.status) {
        await fetch(`${API}/reservations/${initial!.id}/status?status=${status}`, { method: "PATCH" })
      }
      // Pass form data directly — don't rely on API response having an id
      onSave(isEdit ? undefined : { guest_name: name.trim(), time: time.slice(0, 5) })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not save reservation. Try again.")
    } finally {
      setLoading(false)
    }
  }

  const inp: React.CSSProperties = {
    width: "100%", boxSizing: "border-box" as const,
    padding: "10px 12px", fontSize: 13, color: TX,
    background: "rgba(255,185,100,0.16)", border: `1px solid ${BR}`,
    borderRadius: 8, outline: "none", fontFamily: "inherit",
  }
  const lbl: React.CSSProperties = {
    fontSize: 10, fontWeight: 800, color: MU, display: "block",
    marginBottom: 7, letterSpacing: "0.12em", textTransform: "uppercase" as const,
  }
  const stepBtn: React.CSSProperties = {
    width: 36, height: 36, borderRadius: 8, border: `1px solid ${BR}`,
    background: "rgba(255,185,100,0.14)", cursor: "pointer", fontSize: 20,
    color: TX2, display: "flex", alignItems: "center", justifyContent: "center",
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex" }}>
      <div
        style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
        onClick={onClose}
      />
      <div style={{
        position: "absolute", right: 0, top: 0, bottom: 0, width: 430,
        background: SRF, borderLeft: `1px solid ${BR}`,
        display: "flex", flexDirection: "column",
        boxShadow: "-8px 0 40px rgba(0,0,0,0.5)",
      }}>
        {/* Header */}
        <div style={{
          padding: "18px 22px", borderBottom: `1px solid ${BR}`,
          display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.18em", color: MU, textTransform: "uppercase", marginBottom: 4 }}>
              {isEdit ? "Edit" : "New"} Reservation
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: TX }}>
              {isEdit ? (initial?.guest_name || "Guest") : "Add a reservation"}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,185,100,0.14)", border: `1px solid ${BR}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: MU }}
          >
            <X style={{ width: 14, height: 14 }} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, padding: "22px", display: "flex", flexDirection: "column", gap: 20, overflowY: "auto" }}>

          {/* Party size */}
          <div>
            <label style={lbl}>Party Size</label>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 4 }}>
              <button onClick={() => setParty(p => Math.max(1, p - 1))} style={stepBtn}>−</button>
              <span style={{ fontSize: 34, fontWeight: 800, color: TX, width: 52, textAlign: "center" }}>{party}</span>
              <button onClick={() => setParty(p => Math.min(20, p + 1))} style={stepBtn}>+</button>
              <span style={{ fontSize: 12, color: MU }}>{party === 1 ? "guest" : "guests"}</span>
            </div>
          </div>

          {/* Name */}
          <div>
            <label style={lbl}>Guest Name *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="First and last name" autoFocus style={inp} />
          </div>

          {/* Date + Time */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={lbl}>Date *</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>Time *</label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)} style={inp} />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label style={lbl}>Phone <span style={{ color: "rgba(255,200,150,0.55)", fontWeight: 400, letterSpacing: 0, textTransform: "none" }}>— optional</span></label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(555) 000-0000" style={inp} />
          </div>

          {/* Email */}
          <div>
            <label style={lbl}>Email <span style={{ color: "rgba(255,200,150,0.55)", fontWeight: 400, letterSpacing: 0, textTransform: "none" }}>— optional</span></label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="guest@email.com" style={inp} />
          </div>

          {/* Status (edit only) */}
          {isEdit && (
            <div>
              <label style={lbl}>Status</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                {STATUSES.map(s => (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    style={{
                      padding: "6px 14px", borderRadius: 8, cursor: "pointer",
                      border: `1px solid ${status === s ? ACC : BR}`,
                      fontSize: 12, fontWeight: 600, textTransform: "capitalize",
                      background: status === s ? ACC : "rgba(255,185,100,0.16)",
                      color: status === s ? "white" : TX2,
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label style={lbl}>Notes <span style={{ color: "rgba(255,200,150,0.55)", fontWeight: 400, letterSpacing: 0, textTransform: "none" }}>— optional</span></label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Seating preference, special occasion, dietary needs…"
              rows={3}
              style={{ ...inp, resize: "vertical" }}
            />
          </div>

          {error && <p style={{ fontSize: 12, color: "#f87171", margin: 0, lineHeight: 1.5, padding: "10px 12px", background: "rgba(239,68,68,0.08)", borderRadius: 8, border: "1px solid rgba(239,68,68,0.18)" }}>{error}</p>}
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 22px", borderTop: `1px solid ${BR}`, display: "flex", gap: 10, flexShrink: 0 }}>
          <button
            onClick={save}
            disabled={loading}
            style={{
              flex: 1, padding: "12px 0", borderRadius: 10, border: "none",
              background: loading ? "rgba(255,185,100,0.1)" : ACC, color: "white",
              fontWeight: 700, fontSize: 13, cursor: loading ? "default" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              letterSpacing: "0.06em", textTransform: "uppercase",
            }}
          >
            {loading
              ? <><Loader2 style={{ width: 14, height: 14 }} /> Saving…</>
              : <><Check style={{ width: 14, height: 14 }} /> {isEdit ? "Save Changes" : "Add Reservation"}</>
            }
          </button>
          <button
            onClick={onClose}
            style={{
              padding: "12px 18px", borderRadius: 10, border: `1px solid ${BR}`,
              background: "rgba(255,185,100,0.16)", color: TX2,
              fontWeight: 600, fontSize: 13, cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function DemoReservationsPage() {
  const router = useRouter()
  const today = toDateStr(new Date())
  const [selectedDate,    setSelectedDate]    = useState(today)
  const [allReservations, setAllReservations] = useState<Reservation[]>([])
  const [loading,         setLoading]         = useState(true)
  const [drawer,          setDrawer]          = useState<"new" | Reservation | null>(null)
  const [deleteTarget,    setDeleteTarget]    = useState<string | null>(null)
  const [now,             setNow]             = useState(() => new Date())
  const [authed,          setAuthed]          = useState(false)
  const [assignPrompt,    setAssignPrompt]    = useState<{ guest_name: string; time: string } | null>(null)

  // Auth gate
  useEffect(() => {
    if (typeof window !== "undefined") {
      const ok = sessionStorage.getItem("host_demo_authed") === "1"
      if (!ok) { router.replace("/login"); return }
      setAuthed(true)
    }
  }, [router])

  // Live clock — tick every 30s for urgency badge updates
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])

  // Fetch ALL reservations for this demo restaurant — filter client-side
  const fetchAll = useCallback(async () => {
    try {
      const r = await fetch(`${API}/reservations?restaurant_id=${DEMO_RESTAURANT_ID}`)
      setAllReservations(r.ok ? await r.json() : [])
    } catch {
      setAllReservations([])
    } finally {
      setLoading(false)
    }
  }, [])

  // On mount + auto-refresh every 30s
  useEffect(() => {
    if (!authed) return
    fetchAll()
    const t = setInterval(fetchAll, 30_000)
    return () => clearInterval(t)
  }, [fetchAll, authed])

  // Day's reservations
  const dayRes = useMemo(() => {
    const filtered = allReservations.filter(r => r.date === selectedDate)
    if (selectedDate === today) {
      const urgencyOrder: Record<ResUrgency, number> = { late: 0, now: 1, arriving: 2, upcoming: 3 }
      return [...filtered].sort((a, b) => {
        if (a.status === "confirmed" && b.status === "confirmed") {
          const ua = urgencyOrder[getResUrgency(a.date, a.time, now)]
          const ub = urgencyOrder[getResUrgency(b.date, b.time, now)]
          if (ua !== ub) return ua - ub
        }
        return a.time.localeCompare(b.time)
      })
    }
    return [...filtered].sort((a, b) => a.time.localeCompare(b.time))
  }, [allReservations, selectedDate, today, now])

  // Map date → active reservation count (for calendar dots)
  const resMap = useMemo(() => {
    const m = new Map<string, number>()
    allReservations.forEach(r => {
      if (r.status !== "cancelled" && r.status !== "no-show")
        m.set(r.date, (m.get(r.date) ?? 0) + 1)
    })
    return m
  }, [allReservations])

  const active = dayRes.filter(r => r.status !== "cancelled" && r.status !== "no-show")
  const covers = active.reduce((s, r) => s + r.party_size, 0)

  // Count today's urgent reservations for header badge
  const urgentCount = useMemo(() => {
    if (selectedDate !== today) return 0
    return allReservations.filter(r => {
      if (r.date !== today || r.status !== "confirmed") return false
      const u = getResUrgency(r.date, r.time, now)
      return u === "now" || u === "late"
    }).length
  }, [allReservations, today, selectedDate, now])

  async function deleteRes(id: string) {
    try {
      await fetch(`${API}/reservations/${id}`, { method: "DELETE" })
      setAllReservations(prev => prev.filter(r => r.id !== id))
    } catch {}
    setDeleteTarget(null)
  }

  async function markNoShow(id: string) {
    try {
      await fetch(`${API}/reservations/${id}/status?status=no-show`, { method: "PATCH" })
      setAllReservations(prev => prev.map(r => r.id === id ? { ...r, status: "no-show" as const } : r))
    } catch {}
  }

  // Upcoming days with reservations (next 30 days, up to 10)
  const upcomingDays = useMemo(() => {
    const out: { ds: string; count: number; label: string }[] = []
    for (let i = 0; i <= 30 && out.length < 10; i++) {
      const d  = new Date()
      d.setDate(d.getDate() + i)
      const ds    = toDateStr(d)
      const count = resMap.get(ds) ?? 0
      if (count === 0) continue
      const label = i === 0 ? "Today" : i === 1 ? "Tomorrow"
        : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
      out.push({ ds, count, label })
    }
    return out
  }, [resMap])

  // Live clock string for today header
  const clockStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })

  if (!authed) return null

  return (
    <div style={{
      height: "100dvh", display: "flex", flexDirection: "column",
      background: BG, color: TX,
      fontFamily: "var(--font-geist), system-ui, -apple-system, sans-serif",
      overflow: "hidden",
    }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header style={{
        height: 48, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 20px",
        background: "rgba(7,4,2,0.98)", borderBottom: `1px solid ${BR}`,
        backdropFilter: "blur(20px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div>
            <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: "0.22em", color: MU, textTransform: "uppercase" }}>Powered by</div>
            <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: "0.35em", color: TX }}>HOST</div>
          </div>
          <div style={{ width: 1, height: 24, background: BR }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: TX2 }}>Demo Restaurant</span>
          <div style={{ width: 1, height: 24, background: BR }} />
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: MU }}>
            <CalendarCheck style={{ width: 13, height: 13 }} />
            Reservations
          </div>
          {urgentCount > 0 && (
            <span className="animate-pulse" style={{
              fontSize: 10, padding: "2px 8px", borderRadius: 99, fontWeight: 800,
              background: "rgba(249,115,22,0.12)", color: "#f97316",
              border: "1px solid rgba(249,115,22,0.25)", letterSpacing: "0.06em",
            }}>
              {urgentCount} URGENT
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            onClick={fetchAll}
            style={{ height: 30, width: 30, borderRadius: 8, background: "rgba(255,185,100,0.16)", border: `1px solid ${BR}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: MU }}
            title="Refresh"
          >
            <RefreshCw style={{ width: 12, height: 12 }} />
          </button>

          <Link href="/demo/station" style={{ textDecoration: "none" }}>
            <button style={{ height: 30, padding: "0 11px", borderRadius: 8, background: "rgba(255,185,100,0.16)", border: `1px solid ${BR}`, cursor: "pointer", fontSize: 11, fontWeight: 600, color: MU, display: "flex", alignItems: "center", gap: 5 }}>
              ← Host View
            </button>
          </Link>
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ── Left panel: Calendar + upcoming ─────────────────────────── */}
        <div style={{
          width: 262, flexShrink: 0, display: "flex", flexDirection: "column",
          background: SRF2, borderRight: `1px solid ${BR}`, overflowY: "auto",
        }}>
          {/* Month calendar */}
          <div style={{ padding: "16px 0 4px" }}>
            <MiniCalendar
              selectedDate={selectedDate}
              onSelect={setSelectedDate}
              reservationsByDate={resMap}
            />
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: BR, margin: "10px 0 12px" }} />

          {/* Upcoming list */}
          <div style={{ flex: 1, padding: "0 14px 20px" }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.2em", color: "rgba(255,200,150,0.55)", textTransform: "uppercase", marginBottom: 10 }}>
              Coming Up
            </div>
            {loading ? (
              <div style={{ fontSize: 11, color: MU, padding: "10px 0" }}>Loading…</div>
            ) : upcomingDays.length === 0 ? (
              <div style={{ fontSize: 11, color: MU, textAlign: "center", padding: "20px 0 10px" }}>
                No upcoming reservations
              </div>
            ) : (
              upcomingDays.map(({ ds, count, label }) => (
                <button
                  key={ds}
                  onClick={() => setSelectedDate(ds)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "7px 10px", borderRadius: 8, border: "none", cursor: "pointer",
                    background: selectedDate === ds ? "rgba(217,50,28,0.1)" : "transparent",
                    marginBottom: 2, textAlign: "left",
                  }}
                >
                  <span style={{ fontSize: 12, color: selectedDate === ds ? TX : TX2, fontWeight: selectedDate === ds ? 700 : 400 }}>
                    {label}
                  </span>
                  <span style={{ fontSize: 11, padding: "1px 8px", borderRadius: 99, background: "rgba(217,50,28,0.12)", color: ACC, fontWeight: 700 }}>
                    {count}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── Right panel: Day view ────────────────────────────────────── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Day header */}
          <div style={{
            height: 62, flexShrink: 0, padding: "0 24px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            borderBottom: `1px solid ${BR}`, background: "rgba(12,9,7,0.7)",
          }}>
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: TX }}>{displayDay(selectedDate)}</span>
                <span style={{ fontSize: 13, color: MU }}>{longDate(selectedDate)}</span>
                {/* Live clock chip — only for today */}
                {selectedDate === today && (
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    fontSize: 11, color: "rgba(255,200,150,0.35)", fontVariantNumeric: "tabular-nums",
                    padding: "2px 8px", borderRadius: 99,
                    background: "rgba(255,185,100,0.16)", border: `1px solid ${BR}`,
                  }}>
                    <Clock style={{ width: 9, height: 9 }} />
                    {clockStr}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: 16, marginTop: 2 }}>
                <span style={{ fontSize: 11, color: TX2 }}>
                  <strong style={{ color: active.length > 0 ? TX : MU }}>{active.length}</strong>
                  {" "}{active.length === 1 ? "reservation" : "reservations"}
                </span>
                {covers > 0 && (
                  <span style={{ fontSize: 11, color: TX2 }}>
                    <strong style={{ color: TX }}>{covers}</strong> covers
                  </span>
                )}
                {dayRes.filter(r => r.status === "seated").length > 0 && (
                  <span style={{ fontSize: 11, color: "#60a5fa" }}>
                    <strong>{dayRes.filter(r => r.status === "seated").length}</strong> seated
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setSelectedDate(today)}
                style={{ height: 32, padding: "0 12px", borderRadius: 8, background: "rgba(255,185,100,0.16)", border: `1px solid ${BR}`, cursor: "pointer", fontSize: 11, fontWeight: 600, color: MU }}
              >
                Today
              </button>
              <button
                onClick={() => { setDrawer("new"); }}
                style={{
                  height: 36, padding: "0 16px", borderRadius: 10, border: "none",
                  background: ACC, color: "white", cursor: "pointer",
                  fontWeight: 700, fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase",
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                <Plus style={{ width: 13, height: 13 }} /> Add Reservation
              </button>
            </div>
          </div>

          {/* Reservations list */}
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
            {loading ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 220, color: MU, fontSize: 13 }}>
                Loading…
              </div>
            ) : dayRes.length === 0 ? (
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                height: 280, gap: 16,
                border: `1px dashed rgba(255,185,100,0.18)`, borderRadius: 16,
              }}>
                <CalendarDays style={{ width: 44, height: 44, color: "rgba(255,185,100,0.1)" }} />
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontSize: 15, fontWeight: 600, color: TX2, margin: "0 0 5px" }}>
                    No reservations for {displayDay(selectedDate).toLowerCase()}
                  </p>
                  <p style={{ fontSize: 12, color: MU, margin: 0 }}>
                    Add one manually using the button above
                  </p>
                </div>
                <button
                  onClick={() => setDrawer("new")}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "9px 20px",
                    borderRadius: 10, border: "none", background: ACC, color: "white",
                    cursor: "pointer", fontWeight: 700, fontSize: 13,
                    letterSpacing: "0.04em",
                  }}
                >
                  <Plus style={{ width: 13, height: 13 }} /> Add Reservation
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {dayRes.map(res => (
                  <div key={res.id}>
                    {deleteTarget === res.id ? (
                      <div style={{
                        padding: "14px 18px", borderRadius: 12,
                        background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.18)",
                        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                      }}>
                        <span style={{ fontSize: 13, color: "#f87171", fontWeight: 600 }}>
                          Delete <strong>{res.guest_name}</strong> at {fmt12(res.time)}?
                        </span>
                        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                          <button
                            onClick={() => deleteRes(res.id)}
                            style={{ padding: "5px 14px", borderRadius: 7, border: "none", background: "#ef4444", color: "white", cursor: "pointer", fontWeight: 700, fontSize: 12 }}
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => setDeleteTarget(null)}
                            style={{ padding: "5px 14px", borderRadius: 7, border: `1px solid ${BR}`, background: "rgba(255,185,100,0.16)", cursor: "pointer", fontWeight: 600, fontSize: 12, color: TX2 }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <ResCard
                        res={res}
                        now={now}
                        onEdit={() => setDrawer(res)}
                        onDelete={() => setDeleteTarget(res.id)}
                        onMarkNoShow={() => markNoShow(res.id)}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Drawer ──────────────────────────────────────────────────────── */}
      {drawer !== null && (
        <ResDrawer
          initial={drawer === "new" ? null : drawer}
          defaultDate={selectedDate}
          onClose={() => setDrawer(null)}
          onSave={(newResInfo) => { setDrawer(null); fetchAll(); if (newResInfo) setAssignPrompt(newResInfo) }}
        />
      )}

      {/* ── Assign Table Prompt ──────────────────────────────────────────── */}
      {assignPrompt !== null && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div
            style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
            onClick={() => setAssignPrompt(null)}
          />
          <div style={{
            position: "relative", zIndex: 1,
            background: SRF, border: `1px solid ${BR}`,
            borderRadius: 20, padding: "28px 26px 24px",
            width: "calc(100% - 48px)", maxWidth: 360,
            boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
          }}>
            {/* Icon */}
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: "rgba(251,191,36,0.12)",
              border: "1px solid rgba(251,191,36,0.28)",
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: 16, fontSize: 20,
            }}>
              🪑
            </div>
            {/* Headline */}
            <p style={{ fontSize: 16, fontWeight: 800, color: TX, marginBottom: 6, letterSpacing: "-0.01em" }}>
              Assign a table?
            </p>
            <p style={{ fontSize: 13, color: MU, lineHeight: 1.55, marginBottom: 22 }}>
              <strong style={{ color: TX }}>{assignPrompt.guest_name}</strong>&apos;s reservation at{" "}
              <strong style={{ color: TX }}>{fmt12(assignPrompt.time)}</strong> is saved.
              Head to the station to pre-assign their table.
            </p>
            {/* Buttons */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                onClick={() => { setAssignPrompt(null); router.push("/demo/station") }}
                style={{
                  width: "100%", height: 46, borderRadius: 12,
                  background: "rgba(251,191,36,0.16)",
                  border: "1px solid rgba(251,191,36,0.38)",
                  color: "rgba(255,220,120,0.95)",
                  fontSize: 13, fontWeight: 800,
                  letterSpacing: "0.06em", textTransform: "uppercase",
                  cursor: "pointer",
                }}
              >
                Go to Station →
              </button>
              <button
                onClick={() => setAssignPrompt(null)}
                style={{
                  width: "100%", height: 42, borderRadius: 12,
                  background: "transparent",
                  border: `1px solid ${BR}`,
                  color: MU,
                  fontSize: 13, fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Not Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
