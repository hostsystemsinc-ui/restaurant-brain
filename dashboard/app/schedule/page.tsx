"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import Link from "next/link"
import {
  LayoutDashboard, CalendarDays, CalendarCheck,
  Users, Clock, Minus, Plus,
  RefreshCw, BarChart3, Sparkles, Info,
  Copy, Check, ExternalLink,
} from "lucide-react"

const API = "https://restaurant-brain-production.up.railway.app"

// ─────────────────────────────────────────────────────────────────────────────
// Theme
// ─────────────────────────────────────────────────────────────────────────────
const BG  = "#0a0a0a"
const TX  = "#ffffff"
const TX2 = "rgba(255,255,255,0.6)"
const MU  = "rgba(255,200,150,0.65)"
const BR  = "rgba(255,255,255,0.08)"
const CARD = "rgba(255,255,255,0.035)"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface QueueEntry {
  id:           string
  name:         string
  party_size:   number
  status:       string
  arrival_time: string
  wait_estimate?: number
  quoted_wait?:   number | null
}

interface Reservation {
  id:         string
  guest_name: string
  party_size: number
  date:       string   // "YYYY-MM-DD"
  time:       string   // "HH:MM" or "HH:MM:SS"
  status:     string
}

interface Insights {
  avg_wait_estimate: number
  parties_waiting:   number
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const DAYS_FULL  = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

const SHIFTS = [
  { id: "lunch",  label: "Lunch",  time: "11 AM – 3 PM",  hours: [11, 12, 13, 14] },
  { id: "mid",    label: "Mid",    time: "3 PM – 5 PM",   hours: [15, 16]          },
  { id: "dinner", label: "Dinner", time: "5 PM – 9 PM",   hours: [17, 18, 19, 20]  },
  { id: "close",  label: "Close",  time: "9 PM – 11 PM",  hours: [21, 22]           },
]

type Load = "light" | "moderate" | "busy" | "peak"

const LOAD_META: Record<Load, { bg: string; border: string; text: string; label: string }> = {
  light:    { bg: "rgba(34,197,94,0.10)",  border: "rgba(34,197,94,0.3)",  text: "rgba(34,197,94,0.9)",  label: "Light"    },
  moderate: { bg: "rgba(251,191,36,0.10)", border: "rgba(251,191,36,0.3)", text: "rgba(251,191,36,0.9)", label: "Moderate" },
  busy:     { bg: "rgba(251,146,60,0.12)", border: "rgba(251,146,60,0.3)", text: "rgba(251,146,60,0.9)", label: "Busy"     },
  peak:     { bg: "rgba(239,68,68,0.12)",  border: "rgba(239,68,68,0.3)",  text: "rgba(239,68,68,0.9)",  label: "Peak"     },
}

// Industry baseline: estimated parties per shift window for 80-seat casual dining (Denver)
// [Sun, Mon, Tue, Wed, Thu, Fri, Sat]
const BASE_COVERS: Record<string, number[]> = {
  lunch:  [14, 10, 11, 13, 16, 18, 22],
  mid:    [ 6,  4,  5,  6,  9, 12, 15],
  dinner: [24, 16, 18, 22, 28, 42, 46],
  close:  [ 8,  5,  6,  8, 12, 20, 24],
}

// ─────────────────────────────────────────────────────────────────────────────
// Scheduling engine
// ─────────────────────────────────────────────────────────────────────────────
interface ShiftSuggestion {
  dayIndex:   number
  shiftId:    string
  covers:     number
  servers:    number
  hosts:      number
  bussers:    number
  load:       Load
  rationale:  string
  dataPoints: string[]
}

function staffFromLoad(load: Load, shiftId: string): { servers: number; hosts: number; bussers: number } {
  const base = {
    light:    { servers: 2, hosts: 1, bussers: 1 },
    moderate: { servers: 3, hosts: 1, bussers: 1 },
    busy:     { servers: 4, hosts: 2, bussers: 2 },
    peak:     { servers: 5, hosts: 2, bussers: 3 },
  }[load]

  // Mid-shift: smaller window, trim by 1
  if (shiftId === "mid")   return { ...base, servers: Math.max(2, base.servers - 1), bussers: Math.max(1, base.bussers - 1) }
  // Close: lighter server need, same support
  if (shiftId === "close") return { ...base, servers: Math.max(2, base.servers - 1) }
  return base
}

function coversToLoad(covers: number): Load {
  if (covers <= 10) return "light"
  if (covers <= 20) return "moderate"
  if (covers <= 34) return "busy"
  return "peak"
}

function buildSuggestions(
  reservations: Reservation[],
  queue:        QueueEntry[],
  insights:     Insights | null,
  weekStart:    Date,
): ShiftSuggestion[] {
  const todayDow = new Date().getDay()

  // Aggregate reservation covers → day + shift
  const resByKey: Record<string, number> = {}
  for (const r of reservations) {
    if (r.status === "cancelled") continue
    const [h] = r.time.split(":").map(Number)
    const rDate  = new Date(r.date + "T12:00:00")
    const dayOff = Math.round((rDate.getTime() - weekStart.getTime()) / 86_400_000)
    if (dayOff < 0 || dayOff > 6) continue
    const shift = SHIFTS.find(s => s.hours.includes(h))
    if (!shift) continue
    resByKey[`${dayOff}-${shift.id}`] = (resByKey[`${dayOff}-${shift.id}`] ?? 0) + (r.party_size ?? 2)
  }

  // Aggregate queue arrivals → hour (today only)
  const queueByHour: Record<number, number> = {}
  for (const e of queue) {
    const h = new Date(e.arrival_time).getHours()
    queueByHour[h] = (queueByHour[h] ?? 0) + 1
  }

  const results: ShiftSuggestion[] = []

  for (let day = 0; day < 7; day++) {
    for (const shift of SHIFTS) {
      const baseline   = BASE_COVERS[shift.id][day]
      const resCover   = resByKey[`${day}-${shift.id}`] ?? 0
      let   queueCount = 0
      if (day === todayDow) {
        for (const h of shift.hours) queueCount += queueByHour[h] ?? 0
      }

      // Weighted estimate: reservations are confirmed covers, queue is observed demand
      const estimated = Math.round(
        Math.max(
          baseline,
          resCover > 0  ? resCover * 2.2  : 0,
          queueCount > 0 ? queueCount * 1.8 : 0,
        )
      )

      let load = coversToLoad(estimated)

      // Weekend dinner/close floor: at least "busy"
      if ((day === 5 || day === 6) && (shift.id === "dinner" || shift.id === "close")) {
        if (load === "light" || load === "moderate") load = "busy"
      }

      const staff = staffFromLoad(load, shift.id)

      // Build data points
      const dataPoints: string[] = []
      if (resCover > 0)   dataPoints.push(`${resCover} covers reserved`)
      if (queueCount > 0) dataPoints.push(`${queueCount} queue arrivals today`)
      if (insights && day === todayDow) {
        const nowH = new Date().getHours()
        if (shift.hours.includes(nowH)) {
          if (insights.parties_waiting > 0) dataPoints.push(`${insights.parties_waiting} parties waiting live`)
          if (insights.avg_wait_estimate > 0) dataPoints.push(`${insights.avg_wait_estimate}m avg wait live`)
        }
      }
      if (dataPoints.length === 0) dataPoints.push(`~${estimated} covers est. (industry baseline)`)

      const rationale =
        load === "peak"     ? "High-volume period — maximum staff required" :
        load === "busy"     ? "Above-average traffic expected" :
        load === "moderate" ? "Standard service volume" :
                              "Lighter service period"

      results.push({
        dayIndex: day,
        shiftId:  shift.id,
        covers:   estimated,
        ...staff,
        load,
        rationale,
        dataPoints,
      })
    }
  }

  return results
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function getWeekStart(d: Date): Date {
  const s = new Date(d)
  s.setHours(0, 0, 0, 0)
  s.setDate(s.getDate() - s.getDay())
  return s
}

function weekLabel(ws: Date): string {
  const end = new Date(ws)
  end.setDate(end.getDate() + 6)
  const mo = ws.toLocaleString("en-US",  { month: "short" })
  const me = end.toLocaleString("en-US", { month: "short" })
  return mo === me
    ? `${mo} ${ws.getDate()}–${end.getDate()}`
    : `${mo} ${ws.getDate()} – ${me} ${end.getDate()}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${BR}`, borderRadius: 12, padding: "14px 16px" }}>
      <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", margin: "0 0 6px" }}>{label}</p>
      <p style={{ fontSize: 26, fontWeight: 700, color, margin: "0 0 2px", lineHeight: 1 }}>{value}</p>
      <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", margin: 0 }}>{sub}</p>
    </div>
  )
}

function Stepper({ value, onDec, onInc }: { value: number; onDec: () => void; onInc: () => void }) {
  const btn: React.CSSProperties = {
    width: 26, height: 26, borderRadius: "50%",
    border: "1px solid rgba(255,255,255,0.15)",
    background: "transparent", color: TX, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <button style={btn} onClick={onDec}><Minus style={{ width: 10, height: 10 }} /></button>
      <span style={{ fontSize: 22, fontWeight: 300, minWidth: 24, textAlign: "center", color: TX }}>{value}</span>
      <button style={btn} onClick={onInc}><Plus style={{ width: 10, height: 10 }} /></button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────
export default function SchedulePage() {
  const [queue,        setQueue]        = useState<QueueEntry[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [insights,     setInsights]     = useState<Insights | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [weekOffset,   setWeekOffset]   = useState(0)
  const [selectedDay,  setSelectedDay]  = useState(new Date().getDay())
  const [copied,       setCopied]       = useState(false)
  const [adjustments,  setAdjustments]  = useState<Record<string, Record<string, number>>>({})

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [qRes, rRes, iRes] = await Promise.all([
        fetch(`${API}/queue`),
        fetch(`${API}/reservations`),
        fetch(`${API}/insights`),
      ])
      if (qRes.ok) setQueue(await qRes.json())
      if (rRes.ok) setReservations(await rRes.json())
      if (iRes.ok) setInsights(await iRes.json())
    } catch { /* silently handle */ }
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const weekStart = useMemo(() => {
    const ws = getWeekStart(new Date())
    ws.setDate(ws.getDate() + weekOffset * 7)
    return ws
  }, [weekOffset])

  const baseSuggestions = useMemo(
    () => buildSuggestions(reservations, queue, insights, weekStart),
    [reservations, queue, insights, weekStart],
  )

  const suggestions = useMemo((): ShiftSuggestion[] =>
    baseSuggestions.map(s => {
      const key = `${s.dayIndex}-${s.shiftId}`
      const adj = adjustments[key] ?? {}
      return { ...s, ...adj }
    }),
    [baseSuggestions, adjustments],
  )

  const daySuggestions = useMemo(
    () => suggestions.filter(s => s.dayIndex === selectedDay),
    [suggestions, selectedDay],
  )

  // Heatmap: total estimated covers per day
  const dailyLoad = useMemo(() => {
    const maxCovers = Math.max(1, ...suggestions.map(s => s.covers))
    return DAYS_SHORT.map((_, day) => {
      const total = suggestions.filter(s => s.dayIndex === day).reduce((a, s) => a + s.covers, 0)
      return { total, pct: Math.min(100, Math.round((total / (maxCovers * 3.5)) * 100)) }
    })
  }, [suggestions])

  function adjust(dayIndex: number, shiftId: string, field: string, delta: number) {
    const key  = `${dayIndex}-${shiftId}`
    const cur  = suggestions.find(s => s.dayIndex === dayIndex && s.shiftId === shiftId)!
    const prev = (cur[field as keyof ShiftSuggestion] as number) ?? 1
    const next = Math.max(1, Math.min(10, prev + delta))
    setAdjustments(prev => ({ ...prev, [key]: { ...(prev[key] ?? {}), [field]: next } }))
  }

  function copySchedule() {
    const lines: string[] = [
      `HOST AI Schedule — ${weekLabel(weekStart)}`,
      `Generated ${new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`,
      "",
    ]
    for (let day = 0; day < 7; day++) {
      lines.push(`── ${DAYS_FULL[day]} ──`)
      for (const s of suggestions.filter(x => x.dayIndex === day)) {
        const sh = SHIFTS.find(x => x.id === s.shiftId)!
        lines.push(`  ${sh.label} (${sh.time})`)
        lines.push(`    Servers: ${s.servers}  ·  Host(s): ${s.hosts}  ·  Bussers: ${s.bussers}  [${LOAD_META[s.load].label}]`)
        lines.push(`    Est. covers: ${s.covers} — ${s.rationale}`)
      }
      lines.push("")
    }
    lines.push("Powered by HOST · tryhostapp.com")
    navigator.clipboard.writeText(lines.join("\n"))
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const todayDow   = new Date().getDay()
  const weekRes    = reservations.filter(r => r.status !== "cancelled").length
  const totalStaff = daySuggestions.reduce((a, s) => a + s.servers + s.hosts + s.bussers, 0)

  return (
    <div style={{ minHeight: "100vh", background: BG, color: TX, fontFamily: "system-ui, -apple-system, sans-serif" }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 50,
        height: 50, display: "flex", alignItems: "center",
        padding: "0 20px", gap: 8,
        borderBottom: `1px solid ${BR}`,
        background: "rgba(10,10,10,0.92)", backdropFilter: "blur(14px)",
      }}>
        {/* Wordmark */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginRight: 6 }}>
          <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: "0.18em" }}>WALTER303</span>
          <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.12em", color: "rgba(255,200,150,0.5)", textTransform: "uppercase" }}>Denver, CO</span>
        </div>

        {/* Nav */}
        {[
          { href: "/",             icon: <LayoutDashboard style={{ width: 12, height: 12 }} />, label: "Dashboard" },
          { href: "/reservations", icon: <CalendarDays    style={{ width: 12, height: 12 }} />, label: "Reservations" },
        ].map(({ href, icon, label }) => (
          <Link key={href} href={href} style={{
            display: "flex", alignItems: "center", gap: 5,
            height: 28, padding: "0 10px", borderRadius: 8,
            fontSize: 11, fontWeight: 500, color: MU, textDecoration: "none",
          }}>
            {icon} {label}
          </Link>
        ))}

        {/* Active: Schedule */}
        <div style={{
          display: "flex", alignItems: "center", gap: 5,
          height: 28, padding: "0 10px", borderRadius: 8,
          fontSize: 11, fontWeight: 600, color: TX,
          background: "rgba(255,255,255,0.06)", border: `1px solid rgba(255,255,255,0.1)`,
        }}>
          <CalendarCheck style={{ width: 12, height: 12 }} /> Schedule
        </div>

        <Link href="/admin" style={{
          display: "flex", alignItems: "center", gap: 5,
          height: 28, padding: "0 10px", borderRadius: 8,
          fontSize: 11, fontWeight: 500, color: MU, textDecoration: "none",
        }}>
          <LayoutDashboard style={{ width: 12, height: 12 }} /> Admin
        </Link>

        <div style={{ flex: 1 }} />

        <button onClick={fetchAll} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.35)", padding: 6, display: "flex" }}>
          <RefreshCw style={{ width: 14, height: 14 }} />
        </button>
      </header>

      <main style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px 80px" }}>

        {/* ── Page title ───────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
            <Sparkles style={{ width: 16, height: 16, color: "rgba(251,191,36,0.85)" }} />
            <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "0.04em", margin: 0 }}>
              AI Scheduling
            </h1>
          </div>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", margin: 0, lineHeight: 1.6 }}>
            Staffing suggestions powered by your HOST queue data, confirmed reservations, and industry benchmarks.
            Adjust freely — then copy straight into 7Shifts.
          </p>
        </div>

        {/* ── Live stats ───────────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 28 }}>
          <StatCard
            label="Currently Waiting"
            value={loading ? "…" : `${insights?.parties_waiting ?? 0}`}
            sub="parties in queue right now"
            color="rgba(99,179,237,0.9)"
          />
          <StatCard
            label="Live Avg Wait"
            value={loading ? "…" : insights?.avg_wait_estimate ? `${insights.avg_wait_estimate}m` : "—"}
            sub="estimated wait time"
            color="rgba(251,191,36,0.9)"
          />
          <StatCard
            label="Reservations This Week"
            value={loading ? "…" : `${weekRes}`}
            sub="confirmed bookings"
            color="rgba(34,197,94,0.9)"
          />
        </div>

        {/* ── Week nav + copy button ───────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={() => setWeekOffset(w => w - 1)}
              style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,0.05)", border: `1px solid ${BR}`, color: TX, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}
            >‹</button>
            <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.8)", minWidth: 130, textAlign: "center" }}>
              {weekOffset === 0 ? "This Week" : weekOffset === 1 ? "Next Week" : weekOffset === -1 ? "Last Week" : weekLabel(weekStart)}
            </span>
            <button
              onClick={() => setWeekOffset(w => w + 1)}
              style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,0.05)", border: `1px solid ${BR}`, color: TX, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}
            >›</button>
          </div>

          <button
            onClick={copySchedule}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              height: 34, padding: "0 16px", borderRadius: 8, cursor: "pointer",
              fontSize: 12, fontWeight: 600,
              background: copied ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.06)",
              border: `1px solid ${copied ? "rgba(34,197,94,0.4)" : "rgba(255,255,255,0.12)"}`,
              color: copied ? "rgba(34,197,94,0.9)" : TX,
              transition: "all 0.2s",
            }}
          >
            {copied
              ? <><Check style={{ width: 13, height: 13 }} /> Copied to clipboard</>
              : <><Copy style={{ width: 13, height: 13 }} /> Copy for 7Shifts</>
            }
          </button>
        </div>

        {/* ── Traffic heatmap ──────────────────────────────────────────────── */}
        <div style={{ background: CARD, border: `1px solid ${BR}`, borderRadius: 14, padding: "16px 18px", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
            <BarChart3 style={{ width: 13, height: 13, color: "rgba(99,179,237,0.65)" }} />
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", color: "rgba(255,255,255,0.4)", textTransform: "uppercase" }}>
              Weekly Traffic Forecast
            </span>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginLeft: 4 }}>— tap a day to view staffing</span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {DAYS_SHORT.map((day, i) => {
              const { total, pct } = dailyLoad[i]
              const isToday  = i === todayDow && weekOffset === 0
              const isActive = i === selectedDay
              const barH     = Math.max(8, Math.round(pct * 0.65))
              const barColor =
                pct > 70 ? "rgba(239,68,68,0.7)"    :
                pct > 45 ? "rgba(251,146,60,0.7)"   :
                pct > 25 ? "rgba(251,191,36,0.7)"   :
                           "rgba(34,197,94,0.7)"
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(i)}
                  style={{
                    flex: 1, borderRadius: 10, padding: "8px 4px 10px",
                    cursor: "pointer",
                    background: isActive ? "rgba(255,255,255,0.07)" : "transparent",
                    border: `1px solid ${isActive ? "rgba(255,255,255,0.14)" : "transparent"}`,
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{ height: 65, display: "flex", alignItems: "flex-end", width: "100%", justifyContent: "center" }}>
                    <div style={{ width: "55%", height: `${barH}px`, background: barColor, borderRadius: 4, transition: "height 0.3s ease" }} />
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: isActive ? TX : "rgba(255,255,255,0.4)" }}>{day}</span>
                  <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)" }}>~{total}</span>
                  {isToday && <div style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(99,179,237,0.8)" }} />}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Day heading ──────────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <Users style={{ width: 14, height: 14, color: "rgba(255,255,255,0.4)" }} />
          <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "rgba(255,255,255,0.85)" }}>
            {DAYS_FULL[selectedDay]} · HOST Staffing Plan
          </h2>
          {selectedDay === todayDow && weekOffset === 0 && (
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase",
              background: "rgba(99,179,237,0.12)", border: "1px solid rgba(99,179,237,0.28)",
              color: "rgba(99,179,237,0.9)", borderRadius: 5, padding: "2px 7px",
            }}>Today</span>
          )}
          <span style={{ marginLeft: "auto", fontSize: 10, color: "rgba(255,255,255,0.25)" }}>
            {totalStaff} total staff across all shifts
          </span>
        </div>

        {/* ── Shift cards ──────────────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}>
          {daySuggestions.map(sug => {
            const shift = SHIFTS.find(s => s.id === sug.shiftId)!
            const lm    = LOAD_META[sug.load]
            const key   = `${sug.dayIndex}-${sug.shiftId}`

            return (
              <div key={key} style={{ background: CARD, border: `1px solid ${BR}`, borderRadius: 14, padding: "16px 18px" }}>

                {/* Shift header row */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                      <Clock style={{ width: 12, height: 12, color: "rgba(255,255,255,0.35)" }} />
                      <span style={{ fontSize: 14, fontWeight: 700 }}>{shift.label}</span>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.38)", fontWeight: 400 }}>{shift.time}</span>
                      <span style={{
                        fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase",
                        background: lm.bg, border: `1px solid ${lm.border}`, color: lm.text,
                        borderRadius: 5, padding: "2px 7px",
                      }}>{lm.label}</span>
                    </div>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.38)", margin: 0, fontStyle: "italic" }}>
                      {sug.rationale}
                    </p>
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", textAlign: "right", lineHeight: 1.5 }}>
                    <span style={{ display: "block" }}>~{sug.covers} covers</span>
                    <span style={{ display: "block" }}>{sug.servers + sug.hosts + sug.bussers} staff</span>
                  </div>
                </div>

                {/* Staff adjusters */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                  {([ ["servers", "Servers"], ["hosts", "Host(s)"], ["bussers", "Bussers"] ] as const).map(([field, label]) => (
                    <div key={field} style={{
                      background: "rgba(255,255,255,0.04)", border: `1px solid rgba(255,255,255,0.06)`,
                      borderRadius: 10, padding: "10px 12px",
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                    }}>
                      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.38)" }}>{label}</span>
                      <Stepper
                        value={sug[field] as number}
                        onDec={() => adjust(sug.dayIndex, sug.shiftId, field, -1)}
                        onInc={() => adjust(sug.dayIndex, sug.shiftId, field, +1)}
                      />
                    </div>
                  ))}
                </div>

                {/* Data point footer */}
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid rgba(255,255,255,0.05)`, display: "flex", alignItems: "flex-start", gap: 6 }}>
                  <Info style={{ width: 11, height: 11, color: "rgba(99,179,237,0.55)", marginTop: 1, flexShrink: 0 }} />
                  <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", margin: 0, lineHeight: 1.7 }}>
                    Based on: {sug.dataPoints.join(" · ")}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── 7Shifts integration panel ────────────────────────────────────── */}
        <div style={{
          background: "rgba(99,102,241,0.07)",
          border: "1px solid rgba(99,102,241,0.2)",
          borderRadius: 14, padding: "20px 22px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
          marginBottom: 24,
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 18 }}>📅</span>
              <span style={{ fontSize: 13, fontWeight: 700 }}>7Shifts Integration</span>
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase",
                background: "rgba(99,102,241,0.18)", border: "1px solid rgba(99,102,241,0.35)",
                color: "rgba(150,150,255,0.9)", borderRadius: 5, padding: "2px 7px",
              }}>Coming Soon</span>
            </div>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.38)", margin: 0, lineHeight: 1.7, maxWidth: 500 }}>
              Connect your 7Shifts account to push HOST schedules directly — auto-create shifts, set hours, and notify staff without copy-pasting.
              For now, use <strong style={{ color: "rgba(255,255,255,0.65)" }}>Copy for 7Shifts</strong> above to paste your schedule in manually.
            </p>
          </div>
          <a
            href="https://www.7shifts.com/integrations"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.28)",
              borderRadius: 8, color: "rgba(150,150,255,0.85)", textDecoration: "none",
              padding: "8px 16px", fontSize: 12, fontWeight: 600, flexShrink: 0,
              whiteSpace: "nowrap",
            }}
          >
            7Shifts API <ExternalLink style={{ width: 11, height: 11 }} />
          </a>
        </div>

        {/* ── Data sources ─────────────────────────────────────────────────── */}
        <div style={{
          padding: "14px 16px",
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.05)",
          borderRadius: 10,
        }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", color: "rgba(255,255,255,0.28)", textTransform: "uppercase", margin: "0 0 8px" }}>
            Data Sources &amp; Citations
          </p>
          <ul style={{ margin: 0, padding: "0 0 0 14px" }}>
            {[
              "HOST queue — real-time arrival timestamps from your live waitlist",
              "HOST reservations — confirmed bookings fetched from your restaurant's Supabase",
              "HOST insights — live avg wait time &amp; parties waiting from /insights endpoint",
              "National Restaurant Association (2024) — 1 server per 3–4 tables benchmark for 80-seat casual dining",
              "7shifts.com — Shift scheduling best practices for full-service restaurants",
              "Toast POS Blog (2024) — Peak-hour demand patterns for Denver restaurant category",
            ].map(src => (
              <li key={src} style={{ fontSize: 10, color: "rgba(255,255,255,0.28)", lineHeight: 1.9 }}
                dangerouslySetInnerHTML={{ __html: src }}
              />
            ))}
          </ul>
        </div>

      </main>
    </div>
  )
}
