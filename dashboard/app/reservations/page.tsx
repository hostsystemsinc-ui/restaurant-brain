"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  ChevronLeft, ChevronRight, Plus, X, Edit2, Trash2,
  Users, Phone, CalendarDays, Check, ArrowLeft,
  RefreshCw, ExternalLink, Loader2, LayoutDashboard,
  CalendarCheck,
} from "lucide-react"

const API            = "https://restaurant-brain-production.up.railway.app"
const RESTAURANT_NAME = "Walter's303"

// ── Design tokens (light mode — matches admin) ─────────────────────────────────

const C = {
  bg:           "#F8FAFC",
  surface:      "#FFFFFF",
  border:       "#E2E8F0",
  text:         "#0F172A",
  text2:        "#475569",
  muted:        "#94A3B8",
  accent:       "#D9321C",
  green:        "#16A34A",
  greenBg:      "#F0FDF4",
  greenBorder:  "#BBF7D0",
  red:          "#DC2626",
  redBg:        "#FEF2F2",
  redBorder:    "#FECACA",
  orange:       "#D97706",
  orangeBg:     "#FFFBEB",
  orangeBorder: "#FDE68A",
  blue:         "#2563EB",
  blueBg:       "#EFF6FF",
  blueBorder:   "#BFDBFE",
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface Reservation {
  id:         string
  guest_name: string
  party_size: number
  date:       string
  time:       string
  phone:      string | null
  email:      string | null
  notes:      string | null
  status:     "confirmed" | "seated" | "cancelled" | "no-show"
  source:     string
  created_at: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function displayDate(dateStr: string): string {
  const d        = new Date(dateStr + "T12:00:00")
  const today    = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (toDateStr(d) === toDateStr(today))    return "Today"
  if (toDateStr(d) === toDateStr(tomorrow)) return "Tomorrow"
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
}

function longDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  })
}

function fmt12(t: string): string {
  const [h, m] = t.split(":").map(Number)
  const period = h >= 12 ? "PM" : "AM"
  const hour   = h % 12 || 12
  return `${hour}:${m.toString().padStart(2, "0")} ${period}`
}

// ── StatusBadge ────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; border: string; label: string }> = {
    confirmed: { bg: C.greenBg, color: C.green,  border: C.greenBorder, label: "Confirmed" },
    seated:    { bg: C.blueBg,  color: C.blue,   border: C.blueBorder,  label: "Seated"    },
    cancelled: { bg: C.redBg,   color: C.red,    border: C.redBorder,   label: "Cancelled" },
    "no-show": { bg: C.bg,      color: C.muted,  border: C.border,      label: "No Show"   },
  }
  const s = map[status] ?? map.confirmed
  return (
    <span style={{
      fontSize: 11, padding: "2px 8px", borderRadius: 99, fontWeight: 700,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      {s.label}
    </span>
  )
}

// ── ReservationCard ────────────────────────────────────────────────────────────

function ReservationCard({
  res, onEdit, onDelete,
}: {
  res:      Reservation
  onEdit:   () => void
  onDelete: () => void
}) {
  const sourceColor: Record<string, string> = {
    opentable: "#DA3743",
    host:      C.accent,
    google:    "#4285F4",
    apple:     "#555",
  }

  const isCancelled = res.status === "cancelled" || res.status === "no-show"

  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderLeft: `4px solid ${isCancelled ? C.muted : C.accent}`,
      borderRadius: 12,
      padding: "14px 16px",
      display: "flex",
      alignItems: "flex-start",
      gap: 16,
      opacity: isCancelled ? 0.6 : 1,
    }}>
      {/* Time column */}
      <div style={{ width: 60, flexShrink: 0, textAlign: "center", paddingTop: 2 }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: C.text, lineHeight: 1 }}>
          {fmt12(res.time).split(" ")[0]}
        </div>
        <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, marginTop: 2 }}>
          {fmt12(res.time).split(" ")[1]}
        </div>
      </div>

      {/* Divider */}
      <div style={{ width: 1, background: C.border, alignSelf: "stretch" }} />

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 5 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
            {res.guest_name}
          </span>
          <StatusBadge status={res.status} />
          {res.source && res.source !== "host" && (
            <span style={{
              fontSize: 10, padding: "1px 7px", borderRadius: 5, fontWeight: 700,
              background: "#FFF5F5", color: sourceColor[res.source] ?? C.muted,
              border: `1px solid ${sourceColor[res.source] ?? C.border}`,
            }}>
              {res.source === "opentable" ? "OpenTable" : res.source}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: C.text2, display: "flex", alignItems: "center", gap: 4 }}>
            <Users style={{ width: 12, height: 12 }} />
            {res.party_size} {res.party_size === 1 ? "guest" : "guests"}
          </span>
          {res.phone && (
            <span style={{ fontSize: 12, color: C.text2, display: "flex", alignItems: "center", gap: 4 }}>
              <Phone style={{ width: 12, height: 12 }} />
              {res.phone}
            </span>
          )}
          {res.notes && (
            <span style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>
              {res.notes.length > 70 ? res.notes.slice(0, 70) + "…" : res.notes}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        <button
          onClick={onEdit}
          style={{
            width: 32, height: 32, borderRadius: 8, cursor: "pointer",
            background: C.bg, border: `1px solid ${C.border}`,
            display: "flex", alignItems: "center", justifyContent: "center", color: C.text2,
          }}
          title="Edit"
        >
          <Edit2 style={{ width: 13, height: 13 }} />
        </button>
        <button
          onClick={onDelete}
          style={{
            width: 32, height: 32, borderRadius: 8, cursor: "pointer",
            background: C.redBg, border: `1px solid ${C.redBorder}`,
            display: "flex", alignItems: "center", justifyContent: "center", color: C.red,
          }}
          title="Delete"
        >
          <Trash2 style={{ width: 13, height: 13 }} />
        </button>
      </div>
    </div>
  )
}

// ── Shared input/label styles for the drawer ───────────────────────────────────

const labelSt: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: C.text2, display: "block", marginBottom: 6,
}
const inputSt: React.CSSProperties = {
  width: "100%", boxSizing: "border-box" as const,
  padding: "9px 12px", fontSize: 14, color: C.text,
  border: `1px solid ${C.border}`, borderRadius: 8, outline: "none",
  background: C.bg, fontFamily: "inherit",
}
const smallBtnSt: React.CSSProperties = {
  width: 36, height: 36, borderRadius: 8, border: `1px solid ${C.border}`,
  background: C.surface, cursor: "pointer", fontSize: 20, color: C.text2,
  display: "flex", alignItems: "center", justifyContent: "center",
}

const STATUSES = ["confirmed", "seated", "cancelled", "no-show"] as const

// ── ReservationDrawer ──────────────────────────────────────────────────────────

function ReservationDrawer({
  initial, defaultDate, onClose, onSave,
}: {
  initial:     Partial<Reservation> | null
  defaultDate: string
  onClose:     () => void
  onSave:      () => void
}) {
  const isEdit = !!initial?.id

  const [name,    setName]    = useState(initial?.guest_name ?? "")
  const [party,   setParty]   = useState(initial?.party_size ?? 2)
  const [date,    setDate]    = useState(initial?.date ?? defaultDate)
  const [time,    setTime]    = useState(initial?.time ?? "19:00")
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
        guest_name: name.trim(),
        party_size: party,
        date, time,
        phone: phone.trim() || null,
        email: email.trim() || null,
        notes: notes.trim() || null,
        source: initial?.source ?? "host",
      }
      if (isEdit) {
        await fetch(`${API}/reservations/${initial!.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        // If status changed, patch it separately
        if (status !== initial?.status) {
          await fetch(`${API}/reservations/${initial!.id}/status?status=${status}`, { method: "PATCH" })
        }
      } else {
        await fetch(`${API}/reservations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      }
      onSave()
    } catch {
      setError("Could not save reservation. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex" }}>
      {/* Backdrop */}
      <div
        style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(2px)" }}
        onClick={onClose}
      />

      {/* Slide-in panel from right */}
      <div style={{
        position: "absolute", right: 0, top: 0, bottom: 0,
        width: 440, background: C.surface,
        boxShadow: "-8px 0 32px rgba(0,0,0,0.12)",
        display: "flex", flexDirection: "column",
        overflowY: "auto",
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 24px", borderBottom: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          position: "sticky", top: 0, background: C.surface, zIndex: 1,
        }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.text }}>
            {isEdit ? "Edit Reservation" : "New Reservation"}
          </h2>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 8, cursor: "pointer",
              border: `1px solid ${C.border}`, background: C.bg,
              display: "flex", alignItems: "center", justifyContent: "center", color: C.text2,
            }}
          >
            <X style={{ width: 14, height: 14 }} />
          </button>
        </div>

        {/* Form body */}
        <div style={{ padding: 24, flex: 1, display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Party size */}
          <div>
            <label style={labelSt}>Party Size</label>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 8 }}>
              <button onClick={() => setParty(p => Math.max(1, p - 1))} style={smallBtnSt}>−</button>
              <span style={{ fontSize: 28, fontWeight: 800, color: C.text, width: 48, textAlign: "center" }}>
                {party}
              </span>
              <button onClick={() => setParty(p => Math.min(20, p + 1))} style={smallBtnSt}>+</button>
              <span style={{ fontSize: 12, color: C.muted }}>
                {party === 1 ? "guest" : "guests"}
              </span>
            </div>
          </div>

          {/* Guest name */}
          <div>
            <label style={labelSt}>Guest Name *</label>
            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="First and last name" autoFocus
              style={inputSt}
            />
          </div>

          {/* Date & Time */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelSt}>Date *</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>Time *</label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)} style={inputSt} />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label style={labelSt}>
              Phone{" "}
              <span style={{ color: C.muted, fontWeight: 400 }}>— optional</span>
            </label>
            <input
              type="tel" value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="(555) 000-0000"
              style={inputSt}
            />
          </div>

          {/* Email */}
          <div>
            <label style={labelSt}>
              Email{" "}
              <span style={{ color: C.muted, fontWeight: 400 }}>— optional</span>
            </label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="guest@email.com"
              style={inputSt}
            />
          </div>

          {/* Status (edit mode only) */}
          {isEdit && (
            <div>
              <label style={labelSt}>Status</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {STATUSES.map(s => (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    style={{
                      padding: "5px 14px", borderRadius: 7, cursor: "pointer",
                      border: `1px solid ${status === s ? C.accent : C.border}`,
                      fontSize: 12, fontWeight: 600, textTransform: "capitalize",
                      background: status === s ? C.accent : C.surface,
                      color: status === s ? "white" : C.text2,
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
            <label style={labelSt}>
              Notes{" "}
              <span style={{ color: C.muted, fontWeight: 400 }}>— optional</span>
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Dietary restrictions, birthday, booth preference…"
              rows={3}
              style={{ ...inputSt, resize: "vertical" }}
            />
          </div>

          {error && (
            <p style={{ fontSize: 12, color: C.red, margin: 0, lineHeight: 1.5 }}>{error}</p>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "16px 24px", borderTop: `1px solid ${C.border}`,
          display: "flex", gap: 10,
          position: "sticky", bottom: 0, background: C.surface,
        }}>
          <button
            onClick={save}
            disabled={loading}
            style={{
              flex: 1, padding: "11px 0", borderRadius: 9, border: "none",
              background: loading ? C.muted : C.accent, color: "white",
              fontWeight: 700, fontSize: 14, cursor: loading ? "default" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            {loading
              ? <><Loader2 style={{ width: 15, height: 15 }} /> Saving…</>
              : <><Check style={{ width: 15, height: 15 }} /> {isEdit ? "Save Changes" : "Add Reservation"}</>
            }
          </button>
          <button
            onClick={onClose}
            style={{
              padding: "11px 18px", borderRadius: 9,
              border: `1px solid ${C.border}`, background: C.surface,
              color: C.text2, fontWeight: 600, fontSize: 14, cursor: "pointer",
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

const navBtnSt: React.CSSProperties = {
  width: 34, height: 34, borderRadius: 8, border: `1px solid ${C.border}`,
  background: C.surface, cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center", color: C.text2,
}

export default function ReservationsPage() {
  const [selectedDate,   setSelectedDate]   = useState(toDateStr(new Date()))
  const [reservations,   setReservations]   = useState<Reservation[]>([])
  const [loading,        setLoading]        = useState(false)
  const [drawer,         setDrawer]         = useState<"new" | Reservation | null>(null)
  const [deleteConfirm,  setDeleteConfirm]  = useState<string | null>(null)

  const fetchReservations = useCallback(async (date: string) => {
    setLoading(true)
    try {
      const r = await fetch(`${API}/reservations?date=${date}`)
      setReservations(r.ok ? await r.json() : [])
    } catch {
      setReservations([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchReservations(selectedDate) }, [selectedDate, fetchReservations])

  function goDay(delta: number) {
    const d = new Date(selectedDate + "T12:00:00")
    d.setDate(d.getDate() + delta)
    setSelectedDate(toDateStr(d))
  }

  async function deleteReservation(id: string) {
    try {
      await fetch(`${API}/reservations/${id}`, { method: "DELETE" })
      fetchReservations(selectedDate)
    } catch {}
    setDeleteConfirm(null)
  }

  const sorted    = [...reservations].sort((a, b) => a.time.localeCompare(b.time))
  const active    = reservations.filter(r => r.status !== "cancelled" && r.status !== "no-show")
  const covers    = active.reduce((s, r) => s + r.party_size, 0)
  const icsUrl    = `${API}/reservations.ics`

  return (
    <div style={{
      minHeight: "100vh", background: C.bg,
      fontFamily: "var(--font-geist), system-ui, -apple-system, sans-serif",
      color: C.text,
    }}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header style={{
        background: C.surface, borderBottom: `1px solid ${C.border}`,
        padding: "0 28px", height: 56,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Link href="/" style={{ textDecoration: "none" }}>
            <button style={{
              display: "flex", alignItems: "center", gap: 6, padding: "5px 10px",
              borderRadius: 7, border: `1px solid ${C.border}`, background: C.surface,
              cursor: "pointer", fontSize: 12, fontWeight: 600, color: C.text2,
            }}>
              <ArrowLeft style={{ width: 13, height: 13 }} /> Host View
            </button>
          </Link>
          <div style={{ width: 1, height: 20, background: C.border }} />
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.18em", color: C.muted, textTransform: "uppercase" }}>
            Powered by HOST
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{RESTAURANT_NAME}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: C.muted }}>
            <CalendarCheck style={{ width: 14, height: 14 }} />
            Reservations
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <a href={icsUrl} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
            <button style={{
              display: "flex", alignItems: "center", gap: 6, padding: "6px 12px",
              borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface,
              cursor: "pointer", fontSize: 12, fontWeight: 600, color: C.text2,
            }}>
              <ExternalLink style={{ width: 12, height: 12 }} /> Subscribe to Calendar
            </button>
          </a>
          <Link href="/admin" style={{ textDecoration: "none" }}>
            <button style={{
              display: "flex", alignItems: "center", gap: 6, padding: "6px 12px",
              borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface,
              cursor: "pointer", fontSize: 12, fontWeight: 600, color: C.text2,
            }}>
              <LayoutDashboard style={{ width: 12, height: 12 }} /> Admin
            </button>
          </Link>
        </div>
      </header>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>

        {/* Date navigation + Add button */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => goDay(-1)} style={navBtnSt}>
              <ChevronLeft style={{ width: 16, height: 16 }} />
            </button>
            <div style={{ textAlign: "center", minWidth: 200 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: C.text, lineHeight: 1 }}>
                {displayDate(selectedDate)}
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>
                {longDate(selectedDate)}
              </div>
            </div>
            <button onClick={() => goDay(1)} style={navBtnSt}>
              <ChevronRight style={{ width: 16, height: 16 }} />
            </button>
            <button
              onClick={() => setSelectedDate(toDateStr(new Date()))}
              style={{
                padding: "5px 11px", borderRadius: 7,
                border: `1px solid ${C.border}`, background: C.surface,
                cursor: "pointer", fontSize: 12, fontWeight: 600, color: C.text2,
              }}
            >
              Today
            </button>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              onClick={() => fetchReservations(selectedDate)}
              style={navBtnSt}
              title="Refresh"
            >
              <RefreshCw style={{ width: 14, height: 14 }} />
            </button>
            <button
              onClick={() => setDrawer("new")}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "8px 16px",
                borderRadius: 9, border: "none", background: C.accent, color: "white",
                cursor: "pointer", fontWeight: 700, fontSize: 13,
              }}
            >
              <Plus style={{ width: 14, height: 14 }} /> Add Reservation
            </button>
          </div>
        </div>

        {/* Summary chips */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 24 }}>
          {[
            { label: "Total",      value: reservations.length,                                                            color: C.text   },
            { label: "Confirmed",  value: reservations.filter(r => r.status === "confirmed").length,                      color: C.green  },
            { label: "Seated",     value: reservations.filter(r => r.status === "seated").length,                         color: C.blue   },
            { label: "Cancelled",  value: reservations.filter(r => r.status === "cancelled" || r.status === "no-show").length, color: C.red },
            { label: "Covers",     value: covers,                                                                          color: C.accent },
          ].map(({ label, value, color }) => (
            <div key={label} style={{
              background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 10, padding: "12px 16px", textAlign: "center",
            }}>
              <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Reservation list */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "64px 0", color: C.muted, fontSize: 14 }}>
            Loading…
          </div>
        ) : sorted.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "80px 0",
            background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`,
          }}>
            <CalendarDays style={{ width: 44, height: 44, color: C.border, margin: "0 auto 18px", display: "block" }} />
            <p style={{ fontSize: 16, fontWeight: 600, color: C.text2, margin: "0 0 6px" }}>
              No reservations for {displayDate(selectedDate).toLowerCase()}
            </p>
            <p style={{ fontSize: 13, color: C.muted, margin: "0 0 24px" }}>
              Add one manually, or sync OpenTable in Admin → Inputs
            </p>
            <button
              onClick={() => setDrawer("new")}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "9px 18px", borderRadius: 9, border: "none",
                background: C.accent, color: "white", cursor: "pointer",
                fontWeight: 700, fontSize: 13,
              }}
            >
              <Plus style={{ width: 14, height: 14 }} /> Add Reservation
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {sorted.map(res => (
              <div key={res.id}>
                {deleteConfirm === res.id ? (
                  <div style={{
                    background: C.redBg, border: `1px solid ${C.redBorder}`,
                    borderRadius: 12, padding: "14px 18px",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                  }}>
                    <span style={{ fontSize: 13, color: C.red, fontWeight: 600 }}>
                      Delete reservation for <strong>{res.guest_name}</strong> at {fmt12(res.time)}?
                    </span>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => deleteReservation(res.id)}
                        style={{
                          padding: "5px 14px", borderRadius: 7, border: "none",
                          background: C.red, color: "white", cursor: "pointer",
                          fontWeight: 700, fontSize: 12,
                        }}
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        style={{
                          padding: "5px 14px", borderRadius: 7,
                          border: `1px solid ${C.border}`, background: C.surface,
                          cursor: "pointer", fontWeight: 600, fontSize: 12, color: C.text2,
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <ReservationCard
                    res={res}
                    onEdit={() => setDrawer(res)}
                    onDelete={() => setDeleteConfirm(res.id)}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ── Drawer ─────────────────────────────────────────────────────────── */}
      {drawer !== null && (
        <ReservationDrawer
          initial={drawer === "new" ? null : drawer}
          defaultDate={selectedDate}
          onClose={() => setDrawer(null)}
          onSave={() => { setDrawer(null); fetchReservations(selectedDate) }}
        />
      )}
    </div>
  )
}
