"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import Link from "next/link"
import {
  LayoutDashboard, TrendingUp, TableProperties, Users,
  Download, Wifi, WifiOff, RefreshCw, Copy, Check,
  ExternalLink, Search, ArrowLeft, Sparkles,
  Settings2, CalendarDays, Camera, CreditCard, Loader2,
  CalendarCheck, ScrollText,
} from "lucide-react"
import SchedulingPanel from "./SchedulingPanel"
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts"
import * as XLSX from "xlsx"

const API = "https://restaurant-brain-production.up.railway.app"

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
  arrival_time: string
  position?: number
  phone: string | null
  notes: string | null
}

interface Insights {
  tables_total: number
  tables_available: number
  tables_occupied: number
  parties_waiting: number
  parties_ready: number
  avg_wait_estimate: number
  capacity_utilization: number
  ai_insights: string | null
}

type Page = "overview" | "analytics" | "tables" | "guests" | "inputs" | "schedule" | "terms"
type TimeFrame = "today" | "7d" | "30d" | "90d"

interface LocalOcc { name: string; party_size: number }

// Shared floor-plan availability calculation (mirrors host view logic)
function calcAvailable(tables: Table[], localOccupants: Map<number, LocalOcc>): number {
  const occupied = Array.from({ length: 16 }, (_, i) => i + 1).filter(num => {
    if (localOccupants.has(num)) return true
    const t = tables.find(t => t.table_number === num)
    return !!t && t.status !== "available"
  }).length
  return 16 - occupied
}

// ── Design tokens ──────────────────────────────────────────────────────────────

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
  c1:           "#D9321C",
  c2:           "#2563EB",
  c3:           "#16A34A",
  c4:           "#D97706",
  c5:           "#7C3AED",
}

// ── Mock analytics data (stable — computed once at module load) ────────────────

function makeWaitData(tf: TimeFrame) {
  if (tf === "today") {
    return Array.from({ length: 13 }, (_, i) => {
      const h = i + 10
      const peak = (h >= 12 && h <= 14) || (h >= 18 && h <= 21)
      const base = peak ? 26 : 8
      const jitter = (i * 7 + 3) % 11 - 5
      return {
        time: `${h > 12 ? h - 12 : h}${h >= 12 ? "pm" : "am"}`,
        "Avg Wait (min)": Math.max(0, base + jitter),
        "Parties Seated": peak ? 5 + (i % 4) : 1 + (i % 3),
      }
    })
  }
  if (tf === "7d") {
    const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i))
      const wknd = d.getDay() === 0 || d.getDay() === 6
      return {
        time: `${days[d.getDay()]} ${d.getMonth()+1}/${d.getDate()}`,
        "Avg Wait (min)": (wknd ? 32 : 18) + (i * 3) % 9 - 4,
        "Parties Seated": (wknd ? 52 : 28) + (i * 7) % 15 - 7,
      }
    })
  }
  if (tf === "30d") {
    return Array.from({ length: 30 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (29 - i))
      const wknd = d.getDay() === 0 || d.getDay() === 6
      return {
        time: `${d.getMonth()+1}/${d.getDate()}`,
        "Avg Wait (min)": (wknd ? 30 : 17) + (i * 5) % 12 - 6,
        "Parties Seated": (wknd ? 50 : 26) + (i * 7) % 18 - 9,
      }
    })
  }
  return Array.from({ length: 13 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (12 - i) * 7)
    return {
      time: `Wk ${d.getMonth()+1}/${d.getDate()}`,
      "Avg Wait (min)": 22 + (i * 3) % 10 - 5,
      "Parties Seated": 220 + (i * 17) % 60 - 30,
    }
  })
}

const SOURCE_DATA = [
  { name: "NFC Tap",    value: 142, fill: C.c1 },
  { name: "Host Entry", value:  87, fill: C.c2 },
  { name: "Web",        value:  34, fill: C.c3 },
  { name: "Phone",      value:  23, fill: C.c4 },
  { name: "App",        value:  12, fill: C.c5 },
]

const PARTY_SIZE_DATA = [
  { size: "1", count:  8 },
  { size: "2", count: 89 },
  { size: "3", count: 45 },
  { size: "4", count: 67 },
  { size: "5", count: 23 },
  { size: "6+", count: 18 },
]

const TABLE_MOCK = [
  { table:"T1",  section:"Main", capacity:2, turnovers:5, avgDuration:42, utilization:72 },
  { table:"T2",  section:"Main", capacity:2, turnovers:6, avgDuration:38, utilization:78 },
  { table:"T3",  section:"Main", capacity:2, turnovers:4, avgDuration:45, utilization:63 },
  { table:"T4",  section:"Main", capacity:4, turnovers:5, avgDuration:55, utilization:80 },
  { table:"T5",  section:"Main", capacity:4, turnovers:4, avgDuration:58, utilization:74 },
  { table:"T6",  section:"Main", capacity:4, turnovers:3, avgDuration:61, utilization:65 },
  { table:"T7",  section:"Main", capacity:6, turnovers:4, avgDuration:68, utilization:82 },
  { table:"T8",  section:"Main", capacity:6, turnovers:3, avgDuration:72, utilization:75 },
  { table:"T9",  section:"Main", capacity:6, turnovers:3, avgDuration:65, utilization:67 },
  { table:"T10", section:"Main", capacity:4, turnovers:5, avgDuration:53, utilization:79 },
  { table:"T11", section:"Main", capacity:4, turnovers:4, avgDuration:57, utilization:71 },
  { table:"T12", section:"Main", capacity:4, turnovers:4, avgDuration:54, utilization:68 },
  { table:"T13", section:"Bar",  capacity:1, turnovers:8, avgDuration:28, utilization:88 },
  { table:"T14", section:"Bar",  capacity:1, turnovers:7, avgDuration:31, utilization:84 },
  { table:"T15", section:"Bar",  capacity:1, turnovers:8, avgDuration:27, utilization:91 },
  { table:"T16", section:"Bar",  capacity:1, turnovers:9, avgDuration:25, utilization:93 },
]

// ── Helpers ────────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

function exportSheet(data: object[], filename: string, sheet = "Data") {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), sheet)
  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

function exportMultiSheet(sheets: { name: string; data: object[] }[], filename: string) {
  const wb = XLSX.utils.book_new()
  sheets.forEach(({ name, data }) =>
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), name),
  )
  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

// ── Primitive components ───────────────────────────────────────────────────────

function Btn({
  children, onClick, variant = "secondary", icon: Icon, small, disabled,
}: {
  children: React.ReactNode
  onClick?: () => void
  variant?: "primary" | "secondary" | "ghost"
  icon?: React.ElementType
  small?: boolean
  disabled?: boolean
}) {
  const base: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 6,
    border: "none", cursor: disabled ? "default" : "pointer",
    fontWeight: 600, borderRadius: 8,
    transition: "opacity 0.12s",
    padding: small ? "8px 14px" : "10px 18px",
    fontSize: small ? 12 : 13,
    minHeight: small ? 36 : 42,
    opacity: disabled ? 0.45 : 1,
  }
  const styles: Record<string, React.CSSProperties> = {
    primary:   { background: C.accent, color: "#fff" },
    secondary: { background: "transparent", color: C.text2, border: "1.5px solid rgba(15,23,42,0.22)" },
    ghost:     { background: "transparent", color: C.muted },
  }
  return (
    <button style={{ ...base, ...styles[variant] }} onClick={onClick} disabled={disabled}>
      {Icon && <Icon style={{ width: 13, height: 13, flexShrink: 0 }} />}
      {children}
    </button>
  )
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`,
      borderRadius: 12, padding: 24, ...style,
    }}>
      {children}
    </div>
  )
}

function CardHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: 0 }}>{title}</h3>
      {action}
    </div>
  )
}

function KpiCard({
  label, value, sub, color = C.text,
}: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "20px 22px" }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: C.muted, letterSpacing: "0.07em", textTransform: "uppercase", margin: "0 0 8px" }}>
        {label}
      </p>
      <p style={{ fontSize: 30, fontWeight: 800, color, margin: 0, lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: 12, color: C.muted, margin: "6px 0 0" }}>{sub}</p>}
    </div>
  )
}

function Badge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; border: string; label: string }> = {
    waiting: { bg: C.orangeBg,  color: C.orange, border: C.orangeBorder, label: "Waiting"  },
    ready:   { bg: C.greenBg,   color: C.green,  border: C.greenBorder,  label: "Ready"    },
    seated:  { bg: C.greenBg,   color: C.green,  border: C.greenBorder,  label: "Seated"   },
    removed: { bg: C.bg,        color: C.muted,  border: C.border,       label: "Removed"  },
    available: { bg: C.greenBg, color: C.green,  border: C.greenBorder,  label: "Available"},
    occupied:  { bg: C.redBg,   color: C.red,    border: C.redBorder,    label: "Occupied" },
  }
  const s = map[status] ?? map.waiting
  return (
    <span style={{
      fontSize: 11, padding: "2px 8px", borderRadius: 99, fontWeight: 700,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      {s.label}
    </span>
  )
}

const TH_STYLE: React.CSSProperties = {
  textAlign: "left", padding: "0 12px 10px 0",
  color: C.muted, fontWeight: 600, fontSize: 11, letterSpacing: "0.05em",
}
const TD_STYLE: React.CSSProperties = {
  padding: "11px 12px 11px 0", borderBottom: `1px solid ${C.border}`,
  fontSize: 13, color: C.text2, verticalAlign: "middle",
}

// ── Page: Overview ─────────────────────────────────────────────────────────────

function OverviewPage({
  tables, queue, insights, online, lastSync, onRefresh, localOccupants, onMoveGuest,
  restaurantName, restaurantCity, restaurantJoinUrl,
}: {
  tables: Table[]; queue: QueueEntry[]; insights: Insights | null
  online: boolean; lastSync: Date; onRefresh: () => void
  localOccupants: Map<number, LocalOcc>
  onMoveGuest: (from: number, to: number) => void
  restaurantName: string; restaurantCity: string; restaurantJoinUrl: string
}) {
  const [copied,     setCopied]     = useState(false)
  const [dragSource, setDragSource] = useState<number | null>(null)
  const [dragTarget, setDragTarget] = useState<number | null>(null)
  const dragTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const startLongPress = (num: number) => {
    if (!localOccupants.has(num)) return
    dragTimer.current = setTimeout(() => setDragSource(num), 520)
  }
  const cancelLongPress = () => {
    if (dragTimer.current) { clearTimeout(dragTimer.current); dragTimer.current = null }
  }
  const commitMove = () => {
    if (dragSource !== null && dragTarget !== null && dragTarget !== dragSource) {
      onMoveGuest(dragSource, dragTarget)
    }
    setDragSource(null); setDragTarget(null); cancelLongPress()
  }
  const cancelDrag = () => {
    setDragSource(null); setDragTarget(null); cancelLongPress()
  }
  const joinUrl = restaurantJoinUrl || (typeof window !== "undefined"
    ? `${window.location.origin}/join`
    : "https://hostplatform.net/join")

  const copy = () => {
    navigator.clipboard.writeText(joinUrl)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const available = calcAvailable(tables, localOccupants)
  const occupied  = 16 - available
  const active    = queue.filter(q => q.status === "waiting" || q.status === "ready")
  const avgWait   = insights?.avg_wait_estimate ?? 0

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: 0 }}>Overview</h1>
          <p style={{ fontSize: 13, color: C.muted, margin: "4px 0 0" }}>{restaurantName || "Loading…"} · {restaurantCity} · Live</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: online ? C.green : C.red, display: "flex", alignItems: "center", gap: 4 }}>
            {online
              ? <Wifi style={{ width: 13, height: 13 }} />
              : <WifiOff style={{ width: 13, height: 13 }} />}
            {online ? "Live" : "Offline"} · {lastSync.toLocaleTimeString()}
          </span>
          <Btn icon={RefreshCw} onClick={onRefresh} small>Refresh</Btn>
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <KpiCard
          label="Tables Available"
          value={`${available}/16`}
          sub="on the floor"
          color={available > 0 ? C.green : C.red}
        />
        <KpiCard
          label="Currently Waiting"
          value={active.length}
          sub={active.length === 0 ? "Queue is clear" : `${active.length} part${active.length === 1 ? "y" : "ies"} in line`}
          color={active.length > 0 ? C.orange : C.green}
        />
        <KpiCard
          label="Avg Wait Time"
          value={avgWait > 0 ? `${avgWait}m` : "—"}
          sub="current estimate"
        />
        <KpiCard
          label="Tables Occupied"
          value={occupied}
          sub={`${Math.round(occupied / 16 * 100)}% utilization`}
          color={occupied > 12 ? C.red : C.text}
        />
      </div>

      {/* Two-column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16, marginBottom: 24 }}>
        {/* Live queue */}
        <Card>
          <CardHeader
            title="Live Queue"
            action={<span style={{ fontSize: 12, color: C.muted }}>{active.length} active</span>}
          />
          {active.length === 0 ? (
            <div style={{ textAlign: "center", padding: "36px 0", color: C.muted, fontSize: 13 }}>
              Queue is clear right now
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {["#", "Name", "Party", "Source", "Status", "Waiting"].map(h => (
                    <th key={h} style={TH_STYLE}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {active.slice(0, 8).map((e, i) => (
                  <tr key={e.id}>
                    <td style={{ ...TD_STYLE, color: C.muted, fontWeight: 700, width: 24 }}>{i + 1}</td>
                    <td style={{ ...TD_STYLE, fontWeight: 700, color: C.text }}>{e.name || "Guest"}</td>
                    <td style={{ ...TD_STYLE }}>{e.party_size}p</td>
                    <td style={{ ...TD_STYLE }}>
                      <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 99, background: C.bg, border: `1px solid ${C.border}`, color: C.text2, fontWeight: 600 }}>
                        {e.source}
                      </span>
                    </td>
                    <td style={{ ...TD_STYLE }}><Badge status={e.status} /></td>
                    <td style={{ ...TD_STYLE, fontSize: 12, color: C.muted }}>{timeAgo(e.arrival_time)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        {/* Right sidebar cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card>
            <CardHeader title="AI Insights" action={<Sparkles style={{ width: 14, height: 14, color: C.muted }} />} />
            <p style={{ fontSize: 13, color: C.text2, lineHeight: 1.65, margin: 0 }}>
              {insights?.ai_insights ?? "No insights yet. Insights will appear here as traffic builds up throughout service."}
            </p>
          </Card>

          <Card>
            <CardHeader title="Guest Join Link" />
            <p style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>
              Share with guests or use for NFC tap
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Btn icon={copied ? Check : Copy} onClick={copy} small>
                {copied ? "Copied!" : "Copy Link"}
              </Btn>
              <a href={joinUrl} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                <Btn icon={ExternalLink} small>Preview</Btn>
              </a>
            </div>
          </Card>
        </div>
      </div>

      {/* Tables grid */}
      <Card>
        <CardHeader
          title="Table Status"
          action={
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {dragSource !== null && (
                <span style={{ fontSize: 11, color: C.orange, fontWeight: 600 }}>
                  Moving T{dragSource} — drop on a free table
                </span>
              )}
              {dragSource === null && (
                <span style={{ fontSize: 11, color: C.muted }}>Hold an occupied table to move a guest</span>
              )}
              <span style={{ fontSize: 12, color: C.muted }}>{available} of 16 available</span>
            </div>
          }
        />
        <div
          style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 10, userSelect: "none" }}
          onPointerUp={commitMove}
          onPointerLeave={cancelDrag}
        >
          {Array.from({ length: 16 }, (_, i) => {
            const num      = i + 1
            const t        = tables.find(t => t.table_number === num)
            const localOcc = localOccupants.get(num)
            const apiOccupied = !!t && t.status !== "available"
            const avail    = !apiOccupied && !localOcc
            const isSource = dragSource === num
            const isTarget = dragTarget === num && dragSource !== null && avail
            const canDrop  = dragSource !== null && avail

            return (
              <div
                key={num}
                onPointerDown={() => startLongPress(num)}
                onPointerUp={commitMove}
                onPointerCancel={cancelDrag}
                onPointerEnter={() => { if (dragSource !== null) setDragTarget(num) }}
                style={{
                  padding: "10px 4px",
                  borderRadius: 8,
                  border: `1.5px solid ${
                    isTarget  ? C.green       :
                    isSource  ? C.orange      :
                    canDrop   ? C.greenBorder :
                    avail     ? C.greenBorder : C.redBorder
                  }`,
                  background: isTarget ? C.greenBg : isSource ? C.orangeBg : avail ? C.greenBg : C.redBg,
                  textAlign: "center",
                  cursor: localOcc ? (dragSource === null ? "grab" : "grabbing") : "default",
                  transform: isSource ? "scale(0.93)" : "scale(1)",
                  transition: "transform 0.12s, background 0.15s, border-color 0.15s",
                  touchAction: "none",
                  boxShadow: isTarget ? `0 0 0 2px ${C.green}40` : "none",
                }}
              >
                <div style={{
                  fontSize: 12, fontWeight: 800,
                  color: isTarget ? C.green : isSource ? C.orange : avail ? C.green : C.red,
                }}>T{num}</div>
                {localOcc ? (
                  <>
                    <div style={{ fontSize: 9, color: isSource ? C.orange : C.red, marginTop: 1, fontWeight: 700, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {localOcc.name}
                    </div>
                    <div style={{ fontSize: 9, color: isSource ? C.orange : C.red, fontWeight: 600 }}>{localOcc.party_size}p</div>
                  </>
                ) : (
                  <div style={{ fontSize: 9, color: isTarget ? C.green : avail ? C.green : C.red, marginTop: 2, fontWeight: 600 }}>
                    {isTarget ? "Drop here" : avail ? "Free" : "Occupied"}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}

// ── Page: Analytics ────────────────────────────────────────────────────────────

const TIME_FRAMES: { label: string; value: TimeFrame }[] = [
  { label: "Today",    value: "today" },
  { label: "7 Days",   value: "7d"    },
  { label: "30 Days",  value: "30d"   },
  { label: "3 Months", value: "90d"   },
]

function AnalyticsPage() {
  const [tf, setTf] = useState<TimeFrame>("7d")
  const waitData = useMemo(() => makeWaitData(tf), [tf])

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: 0 }}>Waitlist Analytics</h1>
          <p style={{ fontSize: 13, color: C.muted, margin: "4px 0 0" }}>Trends, sources, and guest patterns</p>
        </div>
        {/* Time frame selector */}
        <div style={{ display: "flex", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
          {TIME_FRAMES.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setTf(value)}
              style={{
                padding: "7px 16px", fontSize: 13, fontWeight: 600,
                border: "none", cursor: "pointer",
                background: tf === value ? C.accent : "transparent",
                color: tf === value ? "#fff" : C.text2,
                transition: "all 0.1s",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Wait time trend */}
      <Card style={{ marginBottom: 16 }}>
        <CardHeader
          title="Average Wait Time"
          action={
            <Btn
              icon={Download}
              small
              onClick={() => exportSheet(waitData, "wait_time_trend")}
            >
              Export
            </Btn>
          }
        />
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={waitData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="wGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={C.c1} stopOpacity={0.14} />
                <stop offset="95%" stopColor={C.c1} stopOpacity={0}    />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={C.border} strokeDasharray="4 4" vertical={false} />
            <XAxis dataKey="time" tick={{ fontSize: 11, fill: C.muted }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11, fill: C.muted }} tickLine={false} axisLine={false} unit="m" />
            <Tooltip
              contentStyle={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, color: C.text }}
              cursor={{ stroke: C.border }}
            />
            <Area
              type="monotone"
              dataKey="Avg Wait (min)"
              stroke={C.c1}
              fill="url(#wGrad)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: C.c1 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* Source + Party size — two columns */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        {/* Source breakdown */}
        <Card>
          <CardHeader
            title="Guest Source Breakdown"
            action={
              <Btn
                icon={Download}
                small
                onClick={() => exportSheet(
                  SOURCE_DATA.map(d => ({ Source: d.name, Guests: d.value })),
                  "source_breakdown",
                )}
              >
                Export
              </Btn>
            }
          />
          <ResponsiveContainer width="100%" height={230}>
            <BarChart
              data={SOURCE_DATA}
              layout="vertical"
              margin={{ top: 0, right: 24, left: 8, bottom: 0 }}
            >
              <CartesianGrid stroke={C.border} strokeDasharray="4 4" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: C.muted }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 12, fill: C.text2 }}
                tickLine={false}
                axisLine={false}
                width={82}
              />
              <Tooltip
                contentStyle={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, color: C.text }}
                cursor={{ fill: `${C.border}60` }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {SOURCE_DATA.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Party size distribution */}
        <Card>
          <CardHeader
            title="Party Size Distribution"
            action={
              <Btn
                icon={Download}
                small
                onClick={() => exportSheet(
                  PARTY_SIZE_DATA.map(d => ({ "Party Size": `${d.size} guests`, Parties: d.count })),
                  "party_sizes",
                )}
              >
                Export
              </Btn>
            }
          />
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={PARTY_SIZE_DATA} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid stroke={C.border} strokeDasharray="4 4" vertical={false} />
              <XAxis
                dataKey="size"
                tick={{ fontSize: 12, fill: C.muted }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: C.muted }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, color: C.text }}
                cursor={{ fill: `${C.border}60` }}
              />
              <Bar dataKey="count" fill={C.c2} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Export full page */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Btn
          icon={Download}
          variant="primary"
          onClick={() => exportMultiSheet([
            { name: "Wait Times",        data: waitData },
            { name: "Source Breakdown",  data: SOURCE_DATA.map(d => ({ Source: d.name, Guests: d.value })) },
            { name: "Party Sizes",       data: PARTY_SIZE_DATA.map(d => ({ "Party Size": `${d.size} guests`, Parties: d.count })) },
          ], "walter303_waitlist_analytics")}
        >
          Export Full Page to Excel
        </Btn>
      </div>
    </div>
  )
}

// ── Page: Tables ───────────────────────────────────────────────────────────────

function TablesPage({ tables, localOccupants }: { tables: Table[]; localOccupants: Map<number, LocalOcc> }) {
  const available = calcAvailable(tables, localOccupants)
  const occupied  = 16 - available

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: 0 }}>Tables</h1>
        <p style={{ fontSize: 13, color: C.muted, margin: "4px 0 0" }}>Utilization and turnover overview</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <KpiCard label="Total Tables"   value={16}        sub="on the floor"       />
        <KpiCard label="Available Now"  value={available}  color={available > 0 ? C.green : C.red} />
        <KpiCard label="Occupied Now"   value={occupied}   color={occupied > 12 ? C.red : C.text} />
        <KpiCard label="Avg Capacity"   value="3.4p"       sub="per table"         />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        {/* Utilization chart */}
        <Card>
          <CardHeader
            title="Table Utilization (Est. Today)"
            action={
              <Btn
                icon={Download}
                small
                onClick={() => exportSheet(
                  TABLE_MOCK.map(t => ({ Table: t.table, Section: t.section, "Utilization %": t.utilization, "Avg Duration (min)": t.avgDuration })),
                  "table_utilization",
                )}
              >
                Export
              </Btn>
            }
          />
          <ResponsiveContainer width="100%" height={290}>
            <BarChart data={TABLE_MOCK} margin={{ top: 0, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid stroke={C.border} strokeDasharray="4 4" vertical={false} />
              <XAxis dataKey="table" tick={{ fontSize: 10, fill: C.muted }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: C.muted }} tickLine={false} axisLine={false} unit="%" domain={[0, 100]} />
              <Tooltip
                contentStyle={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, color: C.text }}
                cursor={{ fill: `${C.border}60` }}
              />
              <Bar dataKey="utilization" fill={C.c3} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Table details list */}
        <Card>
          <CardHeader
            title="Table Details"
            action={<Btn icon={Download} small onClick={() => exportSheet(TABLE_MOCK, "table_details")}>Export</Btn>}
          />
          <div style={{ overflowY: "auto", maxHeight: 310 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {["Table","Sec.","Cap.","Turns","Avg. Dur.","Util."].map(h => (
                    <th key={h} style={{ ...TH_STYLE, fontSize: 10 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TABLE_MOCK.map(t => (
                  <tr key={t.table}>
                    <td style={{ ...TD_STYLE, fontWeight: 700, color: C.text }}>{t.table}</td>
                    <td style={{ ...TD_STYLE, color: C.muted }}>{t.section}</td>
                    <td style={{ ...TD_STYLE }}>{t.capacity}p</td>
                    <td style={{ ...TD_STYLE }}>{t.turnovers}×</td>
                    <td style={{ ...TD_STYLE }}>{t.avgDuration}m</td>
                    <td style={{ ...TD_STYLE }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 99,
                        background: t.utilization > 80 ? C.redBg : t.utilization > 65 ? C.orangeBg : C.greenBg,
                        color:      t.utilization > 80 ? C.red   : t.utilization > 65 ? C.orange   : C.green,
                        border: `1px solid ${t.utilization > 80 ? C.redBorder : t.utilization > 65 ? C.orangeBorder : C.greenBorder}`,
                      }}>
                        {t.utilization}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Btn icon={Download} variant="primary" onClick={() => exportSheet(TABLE_MOCK, "walter303_tables")}>
          Export Full Page to Excel
        </Btn>
      </div>
    </div>
  )
}

// ── Page: Guests ───────────────────────────────────────────────────────────────

const STATUS_FILTERS = ["all","waiting","ready","seated","removed"] as const

function GuestsPage({ queue }: { queue: QueueEntry[] }) {
  const [search,  setSearch]  = useState("")
  const [filter,  setFilter]  = useState<string>("all")

  const filtered = useMemo(() => queue.filter(e => {
    const matchName   = !search || (e.name ?? "").toLowerCase().includes(search.toLowerCase())
    const matchStatus = filter === "all" || e.status === filter
    return matchName && matchStatus
  }), [queue, search, filter])

  const seated = queue.filter(e => e.status === "seated").length
  const active = queue.filter(e => e.status === "waiting" || e.status === "ready").length
  const avgParty = queue.length > 0
    ? (queue.reduce((s, e) => s + e.party_size, 0) / queue.length).toFixed(1)
    : "—"

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: 0 }}>Guests</h1>
          <p style={{ fontSize: 13, color: C.muted, margin: "4px 0 0" }}>Queue history and guest log</p>
        </div>
        <Btn
          icon={Download}
          variant="primary"
          onClick={() => exportSheet(
            filtered.map(e => ({
              Name:              e.name || "Guest",
              "Party Size":      e.party_size,
              Status:            e.status,
              Source:            e.source,
              "Arrival Time":    new Date(e.arrival_time).toLocaleString(),
              "Est. Wait (min)": e.wait_estimate ?? "",
              Phone:             e.phone ?? "",
              Notes:             e.notes ?? "",
            })),
            "walter303_guests",
          )}
        >
          Export to Excel
        </Btn>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <KpiCard label="Total in Log"      value={queue.length}    />
        <KpiCard label="Currently Active"  value={active}   color={active > 0 ? C.orange : C.green} />
        <KpiCard label="Seated Today"      value={seated}   color={C.green} />
        <KpiCard label="Avg Party Size"    value={avgParty}        />
      </div>

      <Card>
        {/* Search + filter row */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1, maxWidth: 300 }}>
            <Search style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: C.muted, pointerEvents: "none" }} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name…"
              style={{
                width: "100%", paddingLeft: 32, paddingRight: 12, paddingTop: 8, paddingBottom: 8,
                fontSize: 13, border: `1px solid ${C.border}`, borderRadius: 8,
                outline: "none", color: C.text, background: C.bg, boxSizing: "border-box",
              }}
            />
          </div>
          <div style={{ display: "flex", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
            {STATUS_FILTERS.map(s => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                style={{
                  padding: "7px 13px", fontSize: 12, fontWeight: 600,
                  border: "none", cursor: "pointer", textTransform: "capitalize",
                  background: filter === s ? C.accent : "transparent",
                  color: filter === s ? "#fff" : C.text2,
                  transition: "all 0.1s",
                }}
              >
                {s}
              </button>
            ))}
          </div>
          <span style={{ fontSize: 12, color: C.muted, marginLeft: "auto" }}>
            {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
          </span>
        </div>

        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: C.muted, fontSize: 13 }}>
            No guests found
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {["Name","Party","Source","Status","Wait Est.","Arrived","Phone"].map(h => (
                  <th key={h} style={TH_STYLE}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => (
                <tr key={e.id}>
                  <td style={{ ...TD_STYLE, fontWeight: 700, color: C.text }}>{e.name || "Guest"}</td>
                  <td style={TD_STYLE}>{e.party_size}p</td>
                  <td style={TD_STYLE}>
                    <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 99, background: C.bg, border: `1px solid ${C.border}`, color: C.text2, fontWeight: 600 }}>
                      {e.source}
                    </span>
                  </td>
                  <td style={TD_STYLE}><Badge status={e.status} /></td>
                  <td style={TD_STYLE}>{e.wait_estimate ? `${e.wait_estimate}m` : "—"}</td>
                  <td style={{ ...TD_STYLE, fontSize: 12, color: C.muted }}>{timeAgo(e.arrival_time)}</td>
                  <td style={{ ...TD_STYLE, fontSize: 12, color: C.muted }}>{e.phone ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}

// ── Page: Inputs ───────────────────────────────────────────────────────────────

function InputsPage({ setPage }: { setPage?: (p: Page) => void }) {
  // OpenTable state
  const [icalUrl,    setIcalUrl]    = useState("")
  const [saved,      setSaved]      = useState(false)
  const [syncing,    setSyncing]    = useState(false)
  const [syncMsg,    setSyncMsg]    = useState<{ text: string; ok: boolean } | null>(null)

  // Calendar card state
  const [copied,       setCopied]      = useState(false)
  const [calPlatform,  setCalPlatform] = useState("resy")
  const [calUrl,       setCalUrl]      = useState("")
  const [calSaved,     setCalSaved]    = useState(false)
  const [calSyncing,   setCalSyncing]  = useState(false)
  const [calSyncMsg,   setCalSyncMsg]  = useState<{ text: string; ok: boolean } | null>(null)

  // 7Shifts / scheduling state
  const [schedPlatform,   setSchedPlatform]   = useState("7shifts")
  const [shiftKey,        setShiftKey]        = useState("")
  const [shiftSaved,      setShiftSaved]      = useState<string | null>(null)
  const [shiftCo,         setShiftCo]         = useState<{ id: number; name: string } | null>(null)
  const [shiftConnecting, setShiftConnecting] = useState(false)
  const [shiftErr,        setShiftErr]        = useState<string | null>(null)
  const [showHowTo,       setShowHowTo]       = useState(false)

  // Generic state for other connectable platforms (Homebase, When I Work, ...)
  const [otherKey,         setOtherKey]         = useState("")          // key input field
  const [otherCos,         setOtherCos]         = useState<Record<string, { id: string | number; name: string }>>({})
  const [otherConnecting,  setOtherConnecting]  = useState(false)
  const [otherErr,         setOtherErr]         = useState<string | null>(null)

  // Square POS OAuth state
  const [squareData,       setSquareData]       = useState<{ access_token: string; merchant_id: string; merchant_name: string; expires_at: string | null } | null>(null)
  const [squareConnecting, setSquareConnecting] = useState(false)
  const [squareErr,        setSquareErr]        = useState<string | null>(null)

  useEffect(() => {
    fetch(`${API}/settings`)
      .then(r => r.json())
      .then(d => {
        if (d.opentable_ical_url)  setIcalUrl(d.opentable_ical_url)
        if (d.secondary_ical_url)  setCalUrl(d.secondary_ical_url)
      })
      .catch(() => {})

    // Load scheduling connections from localStorage
    try {
      const savedPlatform = localStorage.getItem("host_scheduling_platform")
      const savedKey      = localStorage.getItem("host_7shifts_key")
      const savedCo       = localStorage.getItem("host_7shifts_company")
      if (savedPlatform) setSchedPlatform(savedPlatform)
      if (savedKey)      setShiftSaved(savedKey)
      if (savedCo)       setShiftCo(JSON.parse(savedCo))

      // Load other platform connections
      const loaded: Record<string, { id: string | number; name: string }> = {}
      for (const pid of ["homebase", "wheniwork"]) {
        const raw = localStorage.getItem(`host_${pid}_company`)
        if (raw) try { loaded[pid] = JSON.parse(raw) } catch {}
      }
      if (Object.keys(loaded).length) setOtherCos(loaded)

      // Load Square POS connection
      const rawSq = localStorage.getItem("host_square")
      if (rawSq) try { setSquareData(JSON.parse(rawSq)) } catch {}
    } catch {}

    // Handle Square OAuth redirect (?sq=connected or ?sq=error)
    const sqParam = new URLSearchParams(window.location.search).get("sq")
    if (sqParam === "connected") {
      setSquareConnecting(true)
      window.history.replaceState({}, "", window.location.pathname)
      fetch("/api/square/session")
        .then(r => r.json())
        .then(d => {
          if (d.access_token) {
            localStorage.setItem("host_square", JSON.stringify(d))
            setSquareData(d)
          } else {
            setSquareErr("Square connected but no token was returned — please try again.")
          }
          setSquareConnecting(false)
        })
        .catch(() => {
          setSquareErr("Connection failed. Please try again.")
          setSquareConnecting(false)
        })
    } else if (sqParam === "error") {
      setSquareErr("Square connection failed — please try again.")
      window.history.replaceState({}, "", window.location.pathname)
    }
  }, [])

  const saveUrl = async () => {
    try {
      await fetch(`${API}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opentable_ical_url: icalUrl.trim() || null }),
      })
      setSaved(true); setTimeout(() => setSaved(false), 2200)
    } catch {}
  }

  const syncNow = async () => {
    if (!icalUrl.trim()) return
    setSyncing(true); setSyncMsg(null)
    try {
      const r = await fetch(`${API}/settings/sync-ical`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: icalUrl.trim() }),
      })
      const d = await r.json()
      if (r.ok) {
        setSyncMsg({ text: `Synced ${d.imported} reservation${d.imported !== 1 ? "s" : ""} from OpenTable.`, ok: true })
      } else {
        setSyncMsg({ text: d.detail ?? "Sync failed.", ok: false })
      }
    } catch {
      setSyncMsg({ text: "Could not reach the OpenTable calendar. Check the URL.", ok: false })
    } finally {
      setSyncing(false)
    }
  }

  // Calendar card helpers
  const webcalUrl = `webcal://${API.replace("https://", "")}/reservations.ics`
  const icsHttpUrl = `${API}/reservations.ics`

  const copyLink = () => {
    navigator.clipboard.writeText(webcalUrl).catch(() => {})
    setCopied(true); setTimeout(() => setCopied(false), 2200)
  }

  const saveCalUrl = async () => {
    try {
      await fetch(`${API}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secondary_ical_url: calUrl.trim() || null }),
      })
      setCalSaved(true); setTimeout(() => setCalSaved(false), 2200)
    } catch {}
  }

  const syncCalNow = async () => {
    if (!calUrl.trim()) return
    setCalSyncing(true); setCalSyncMsg(null)
    try {
      const r = await fetch(`${API}/settings/sync-ical`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: calUrl.trim() }),
      })
      const d = await r.json()
      if (r.ok) {
        setCalSyncMsg({ text: `Synced ${d.imported} reservation${d.imported !== 1 ? "s" : ""}.`, ok: true })
      } else {
        setCalSyncMsg({ text: d.detail ?? "Sync failed.", ok: false })
      }
    } catch {
      setCalSyncMsg({ text: "Could not reach the calendar URL. Check the link.", ok: false })
    } finally {
      setCalSyncing(false)
    }
  }

  // 7Shifts helpers
  async function connect7Shifts() {
    if (!shiftKey.trim()) return
    setShiftConnecting(true); setShiftErr(null)
    try {
      const res  = await fetch("/api/7shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-7shifts-key": shiftKey.trim() },
        body: JSON.stringify({ endpoint: "/company" }),
      })
      const data = await res.json()
      if (res.ok && data?.data?.id) {
        const co = { id: data.data.id, name: data.data.name }
        localStorage.setItem("host_7shifts_key",        shiftKey.trim())
        localStorage.setItem("host_7shifts_company",    JSON.stringify(co))
        localStorage.setItem("host_scheduling_platform", "7shifts")
        setShiftSaved(shiftKey.trim()); setShiftCo(co); setShiftKey("")
      } else {
        setShiftErr("Invalid key — check 7Shifts → Settings → Integrations → API Keys")
      }
    } catch {
      setShiftErr("Connection failed. Check your internet and try again.")
    }
    setShiftConnecting(false)
  }

  function disconnect7Shifts() {
    localStorage.removeItem("host_7shifts_key")
    localStorage.removeItem("host_7shifts_company")
    setShiftSaved(null); setShiftCo(null); setShiftKey(""); setShiftErr(null)
  }

  // Generic connect helpers
  async function connectOtherPlatform(pid: string) {
    const sp = SCHED_PLATFORMS[pid]
    if (!sp?.canConnect || !sp.proxyRoute) return
    if (!otherKey.trim()) return
    setOtherConnecting(true); setOtherErr(null)
    try {
      const res = await fetch(sp.proxyRoute, {
        method: "POST",
        headers: { "Content-Type": "application/json", [sp.proxyHeader]: otherKey.trim() },
        body: JSON.stringify({ endpoint: sp.verifyEndpoint }),
      })
      const data = await res.json()
      if (res.ok) {
        // Resolve id + name from nested response shapes
        const root = Array.isArray(data) ? data[0]
          : (data?.data ?? data?.account ?? data)
        const id   = root?.id   ?? pid
        const name = root?.name ?? root?.company_name ?? sp.name
        if (root !== undefined) {
          const co = { id, name }
          localStorage.setItem(`host_${pid}_key`,      otherKey.trim())
          localStorage.setItem(`host_${pid}_company`,  JSON.stringify(co))
          localStorage.setItem("host_scheduling_platform", pid)
          setOtherCos(prev => ({ ...prev, [pid]: co }))
          setSchedPlatform(pid); setOtherKey("")
        } else {
          setOtherErr(`Invalid key — check ${sp.name}: ${sp.keyPath}`)
        }
      } else {
        setOtherErr(`Invalid key — check ${sp.name}: ${sp.keyPath}`)
      }
    } catch {
      setOtherErr("Connection failed. Check your internet and try again.")
    }
    setOtherConnecting(false)
  }

  function disconnectOtherPlatform(pid: string) {
    localStorage.removeItem(`host_${pid}_key`)
    localStorage.removeItem(`host_${pid}_company`)
    setOtherCos(prev => { const n = { ...prev }; delete n[pid]; return n })
    setOtherKey(""); setOtherErr(null)
  }

  // Square POS helpers
  function connectSquare() {
    const clientId = process.env.NEXT_PUBLIC_SQUARE_CLIENT_ID
    if (!clientId) return
    const state       = Math.random().toString(36).slice(2)
    sessionStorage.setItem("sq_state", state)
    const scopes      = encodeURIComponent("ORDERS_READ PAYMENTS_READ MERCHANT_PROFILE_READ")
    const redirectUri = encodeURIComponent(`${window.location.origin}/api/square/callback`)
    window.location.href =
      `https://connect.squareup.com/oauth2/authorize?client_id=${clientId}&scope=${scopes}&session=false&state=${state}&redirect_uri=${redirectUri}`
  }

  function disconnectSquare() {
    localStorage.removeItem("host_square")
    setSquareData(null); setSquareErr(null)
  }

  // Scheduling platform config
  const SCHED_PLATFORMS: Record<string, {
    name: string; color: string; canConnect: boolean; canPublish: boolean
    planNote?: string; keyPath: string; csvImport: string
    proxyRoute: string; proxyHeader: string
    verifyEndpoint: string; settingsUrl: string
  }> = {
    "7shifts":     { name: "7Shifts",     color: "#7C3AED", canConnect: true,  canPublish: true,  planNote: "Requires The Works plan ($43+/mo)",      keyPath: "Settings → Integrations → API Keys → Generate New Key",     csvImport: "Schedule → Import",                    proxyRoute: "/api/7shifts",   proxyHeader: "x-7shifts-key",  verifyEndpoint: "/company",       settingsUrl: "https://app.7shifts.com"              },
    "homebase":    { name: "Homebase",    color: "#FF6B35", canConnect: true,  canPublish: false, planNote: "Essentials plan or above required",       keyPath: "Account Settings → Security → API Tokens → Generate Token", csvImport: "Schedule → Import Shifts → Upload CSV", proxyRoute: "/api/homebase",  proxyHeader: "x-homebase-key", verifyEndpoint: "/v1/businesses", settingsUrl: "https://app.joinhomebase.com"          },
    "wheniwork":   { name: "When I Work", color: "#00B2A9", canConnect: true,  canPublish: false, planNote: "Standard plan or above required",         keyPath: "Profile → Developer → API Tokens → Create Token",           csvImport: "Scheduler → Import → Upload CSV",      proxyRoute: "/api/wheniwork", proxyHeader: "x-wiw-key",      verifyEndpoint: "/account",       settingsUrl: "https://app.wheniwork.com"             },
    "deputy":      { name: "Deputy",      color: "#3B82F6", canConnect: false, canPublish: false,                                                     keyPath: "Business Settings → Integrations → API → Create Token",      csvImport: "Scheduling → Import → CSV Upload",     proxyRoute: "",               proxyHeader: "",               verifyEndpoint: "",               settingsUrl: "https://once.deputy.com/my/apps/api"  },
    "sling":       { name: "Sling",       color: "#F97316", canConnect: false, canPublish: false,                                                     keyPath: "N/A — Sling has no public API",                               csvImport: "Schedule → More → Import CSV",         proxyRoute: "",               proxyHeader: "",               verifyEndpoint: "",               settingsUrl: "https://app.getsling.com"              },
    "hotschedules":{ name: "HotSchedules",color: "#DC2626", canConnect: false, canPublish: false, planNote: "Enterprise only — contact account rep",  keyPath: "Admin → Integrations → API Management → Create Key",         csvImport: "Schedule → Actions → Import via CSV",  proxyRoute: "",               proxyHeader: "",               verifyEndpoint: "",               settingsUrl: ""                                      },
  }

  const PLATFORMS: Record<string, { name: string; hint: string }> = {
    resy:        { name: "Resy",         hint: "ResyOS → Settings → Integrations → Calendar Export → Copy iCal Link" },
    sevenrooms:  { name: "SevenRooms",   hint: "SevenRooms → Settings → Calendar Sync → iCal Export URL" },
    tock:        { name: "Tock",         hint: "Tock → Admin Settings → Restaurant Info → Calendar Export → Copy URL" },
    toasttables: { name: "Toast Tables", hint: "Toast Backend → Guests → Reservations → Settings → Calendar Export → iCal URL" },
    other:       { name: "Other",        hint: "Paste any standard iCal (.ics) feed URL from your reservation platform." },
  }

  const CAL_BTNS = [
    { label: "Google Calendar", bg: "rgba(66,133,244,0.08)",  border: "rgba(66,133,244,0.3)",  color: "#4285F4",
      href: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl)}` },
    { label: "Apple Calendar",  bg: "rgba(0,122,255,0.08)",   border: "rgba(0,122,255,0.3)",   color: "#007AFF",
      href: webcalUrl },
    { label: "Outlook.com",     bg: "rgba(0,120,212,0.08)",   border: "rgba(0,120,212,0.3)",   color: "#0078D4",
      href: `https://outlook.live.com/calendar/0/addcalendar?url=${encodeURIComponent(icsHttpUrl)}` },
    { label: "Office 365",      bg: "rgba(0,120,212,0.08)",   border: "rgba(0,120,212,0.3)",   color: "#0078D4",
      href: `https://outlook.office.com/calendar/0/addcalendar?url=${encodeURIComponent(icsHttpUrl)}` },
  ]

  const boxStyle: React.CSSProperties = {
    background: C.surface, border: `1px solid ${C.border}`,
    borderRadius: 12, padding: 24,
    display: "flex", flexDirection: "column", gap: 16,
  }
  const iconBoxStyle = (bg: string): React.CSSProperties => ({
    width: 40, height: 40, borderRadius: 10, background: bg,
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  })
  const inputSt: React.CSSProperties = {
    width: "100%", boxSizing: "border-box",
    padding: "9px 12px", fontSize: 12, color: C.text,
    border: `1px solid ${C.border}`, borderRadius: 8, outline: "none",
    background: C.bg, fontFamily: "monospace", lineHeight: 1.5, resize: "vertical" as const,
  }

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: 0 }}>Inputs</h1>
        <p style={{ fontSize: 13, color: C.muted, margin: "4px 0 0" }}>
          Connect reservations, POS, and camera systems to HOST
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16, alignItems: "start" }}>

        {/* ── Reservations / OpenTable ── */}
        <div style={boxStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={iconBoxStyle(C.orangeBg)}>
              <CalendarDays style={{ width: 20, height: 20, color: C.orange }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Reservations</div>
              <div style={{ fontSize: 11, color: C.muted }}>OpenTable iCal sync</div>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: C.text2, display: "block", marginBottom: 6 }}>
              OpenTable iCal Feed URL
            </label>
            <textarea
              value={icalUrl}
              onChange={e => setIcalUrl(e.target.value)}
              placeholder={"Paste your OpenTable calendar link here…\n(Guest Center → Settings → Calendar Sync → iCal Feed)"}
              rows={4}
              style={inputSt}
            />
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Btn onClick={saveUrl} variant="primary" small icon={saved ? Check : undefined}>
              {saved ? "Saved!" : "Save URL"}
            </Btn>
            <Btn onClick={syncNow} small disabled={!icalUrl.trim() || syncing} icon={syncing ? Loader2 : RefreshCw}>
              {syncing ? "Syncing…" : "Sync Now"}
            </Btn>
          </div>

          {syncMsg && (
            <p style={{ fontSize: 12, color: syncMsg.ok ? C.green : C.red, margin: 0, lineHeight: 1.5 }}>
              {syncMsg.text}
            </p>
          )}

          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
            <p style={{ fontSize: 11, color: C.muted, margin: 0, lineHeight: 1.6 }}>
              <strong style={{ color: C.text2 }}>Where to find it:</strong> OpenTable Guest Center → Settings → Reservations → Calendar Sync → iCal Feed URL. Paste above, save, then Sync Now.
            </p>
          </div>
        </div>

        {/* ── Calendar ── */}
        <div style={boxStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={iconBoxStyle("rgba(59,130,246,0.1)")}>
              <CalendarDays style={{ width: 20, height: 20, color: "#3b82f6" }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Calendar</div>
              <div style={{ fontSize: 11, color: C.muted }}>Subscribe & sync with any calendar app</div>
            </div>
          </div>

          {/* ── Outbound: add HOST calendar to external app ── */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: C.text2, display: "block", marginBottom: 10 }}>
              Add HOST Reservations to Your Calendar
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
              {CAL_BTNS.map(btn => (
                <a key={btn.label} href={btn.href} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 7,
                    padding: "8px 11px", borderRadius: 8,
                    background: btn.bg, border: `1px solid ${btn.border}`,
                    cursor: "pointer", fontSize: 11, fontWeight: 600, color: btn.color,
                  }}>
                    <ExternalLink style={{ width: 11, height: 11, flexShrink: 0 }} />
                    {btn.label}
                  </div>
                </a>
              ))}
            </div>
            <button
              onClick={copyLink}
              style={{
                marginTop: 7, width: "100%", display: "flex", alignItems: "center", gap: 7,
                padding: "8px 11px", borderRadius: 8, cursor: "pointer", fontSize: 11, fontWeight: 600,
                background: copied ? C.greenBg : "rgba(148,163,184,0.08)",
                border: `1px solid ${copied ? C.greenBorder : C.border}`,
                color: copied ? C.green : C.text2, textAlign: "left",
              }}
            >
              {copied
                ? <Check style={{ width: 11, height: 11 }} />
                : <Copy style={{ width: 11, height: 11 }} />}
              {copied ? "Copied!" : "Copy webcal:// link  (any app)"}
            </button>
          </div>

          {/* ── Inbound: import from other platforms ── */}
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: C.text2, display: "block", marginBottom: 8 }}>
              Import from Other Platforms
            </label>

            <select
              value={calPlatform}
              onChange={e => setCalPlatform(e.target.value)}
              style={{ ...inputSt, resize: undefined, marginBottom: 8, cursor: "pointer" }}
            >
              {Object.entries(PLATFORMS).map(([key, { name }]) => (
                <option key={key} value={key}>{name}</option>
              ))}
            </select>

            <textarea
              value={calUrl}
              onChange={e => setCalUrl(e.target.value)}
              placeholder={`Paste your ${PLATFORMS[calPlatform]?.name ?? "platform"} iCal feed URL here…`}
              rows={3}
              style={inputSt}
            />

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              <Btn onClick={saveCalUrl} variant="primary" small icon={calSaved ? Check : undefined}>
                {calSaved ? "Saved!" : "Save URL"}
              </Btn>
              <Btn onClick={syncCalNow} small disabled={!calUrl.trim() || calSyncing} icon={calSyncing ? Loader2 : RefreshCw}>
                {calSyncing ? "Syncing…" : "Sync Now"}
              </Btn>
            </div>

            {calSyncMsg && (
              <p style={{ fontSize: 12, color: calSyncMsg.ok ? C.green : C.red, margin: "8px 0 0", lineHeight: 1.5 }}>
                {calSyncMsg.text}
              </p>
            )}

            {PLATFORMS[calPlatform] && (
              <p style={{ fontSize: 11, color: C.muted, margin: "12px 0 0", lineHeight: 1.6 }}>
                <strong style={{ color: C.text2 }}>Where to find it:</strong>{" "}
                {PLATFORMS[calPlatform].hint}
              </p>
            )}
          </div>
        </div>

        {/* ── Staff Scheduling (multi-platform) ── */}
        {(() => {
          const sp  = SCHED_PLATFORMS[schedPlatform]
          const is7 = schedPlatform === "7shifts"
          return (
            <div style={boxStyle}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={iconBoxStyle(`${sp.color}18`)}>
                  <CalendarCheck style={{ width: 20, height: 20, color: sp.color }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Staff Scheduling</div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: "0.04em",
                      background: `${sp.color}18`, color: sp.color,
                      border: `1px solid ${sp.color}33`,
                      borderRadius: 5, padding: "1px 7px",
                    }}>{sp.name}</span>
                    {!sp.canConnect && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
                        background: C.orangeBg, color: C.orange,
                        border: `1px solid ${C.orangeBorder}`,
                        borderRadius: 5, padding: "1px 6px",
                      }}>API Soon</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: C.muted }}>
                    {sp.canPublish ? `Push HOST schedules directly to ${sp.name}` : sp.canConnect ? `Connect ${sp.name} — publish support coming soon` : `Export HOST schedules for ${sp.name}`}
                  </div>
                </div>
                {((is7 && shiftCo) || (!is7 && otherCos[schedPlatform])) && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 99,
                    background: C.greenBg, color: C.green, border: `1px solid ${C.greenBorder}`,
                    whiteSpace: "nowrap",
                  }}>● Connected</span>
                )}
              </div>

              {/* Platform selector */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: C.text2, display: "block", marginBottom: 6 }}>
                  Your scheduling platform
                </label>
                <select
                  value={schedPlatform}
                  onChange={e => {
                    setSchedPlatform(e.target.value)
                    localStorage.setItem("host_scheduling_platform", e.target.value)
                    setShiftErr(null)
                  }}
                  style={{ ...inputSt, resize: undefined, cursor: "pointer" }}
                >
                  {Object.entries(SCHED_PLATFORMS).map(([id, { name, canPublish, canConnect }]) => (
                    <option key={id} value={id}>{name}{canPublish ? " ✓ Live API" : canConnect ? " ✓ Connect" : ""}</option>
                  ))}
                </select>
              </div>

              {/* 7Shifts — full API flow */}
              {is7 && (
                shiftCo ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{
                      background: C.greenBg, border: `1px solid ${C.greenBorder}`,
                      borderRadius: 8, padding: "12px 14px",
                    }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.green }}>{shiftCo.name}</div>
                      <div style={{ fontSize: 11, color: C.green, opacity: 0.75, marginTop: 2 }}>
                        Schedules you publish in HOST will sync directly to 7Shifts.
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      {setPage && (
                        <Btn onClick={() => setPage("schedule")} variant="primary" small icon={CalendarCheck}>
                          Open Schedule
                        </Btn>
                      )}
                      <button
                        onClick={disconnect7Shifts}
                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: C.muted, padding: 0 }}
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <button
                          onClick={() => setShowHowTo(v => !v)}
                          style={{
                            background: "none", border: "none", cursor: "pointer",
                            fontSize: 11, fontWeight: 600, color: sp.color, padding: 0,
                            display: "flex", alignItems: "center", gap: 5,
                          }}
                        >
                          {showHowTo ? "▲" : "▼"} Where to find your API key
                        </button>
                        {sp.settingsUrl && (
                          <a href={sp.settingsUrl} target="_blank" rel="noreferrer"
                            style={{ fontSize: 10, color: C.accent, fontWeight: 600, textDecoration: "none", display: "flex", alignItems: "center", gap: 3 }}>
                            Open {sp.name} <ExternalLink style={{ width: 9, height: 9 }} />
                          </a>
                        )}
                      </div>
                      {showHowTo && (
                        <ol style={{ margin: "10px 0 0 16px", padding: 0, fontSize: 11, color: C.text2, lineHeight: 2 }}>
                          <li>Log in to <strong>7Shifts</strong></li>
                          <li>Go to <strong>Settings → Integrations → API Keys</strong></li>
                          <li>Click <strong>Generate New Key</strong> → copy it</li>
                          <li>Paste it below → click <strong>Connect 7Shifts</strong></li>
                        </ol>
                      )}
                      {sp.planNote && (
                        <p style={{ fontSize: 10, color: C.muted, margin: "8px 0 0", lineHeight: 1.5 }}>
                          ⓘ {sp.planNote}
                        </p>
                      )}
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: C.text2, display: "block", marginBottom: 6 }}>
                        API Key
                      </label>
                      <input
                        type="password"
                        value={shiftKey}
                        onChange={e => setShiftKey(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && connect7Shifts()}
                        placeholder="Paste your 7Shifts API key here…"
                        style={{ ...inputSt, resize: undefined, fontFamily: "monospace" }}
                      />
                    </div>
                    <Btn onClick={connect7Shifts} variant="primary" small
                      disabled={!shiftKey.trim() || shiftConnecting}
                      icon={shiftConnecting ? Loader2 : undefined}
                    >
                      {shiftConnecting ? "Connecting…" : `Connect ${sp.name}`}
                    </Btn>
                    {shiftErr && (
                      <p style={{ fontSize: 11, color: C.red, margin: 0, lineHeight: 1.5 }}>{shiftErr}</p>
                    )}
                  </div>
                )
              )}

              {/* canConnect platforms — Homebase / When I Work */}
              {!is7 && sp.canConnect && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {otherCos[schedPlatform] ? (
                    /* ── Connected state ── */
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{
                        background: C.greenBg, border: `1px solid ${C.greenBorder}`,
                        borderRadius: 8, padding: "12px 14px",
                      }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.green }}>{otherCos[schedPlatform].name}</div>
                        <div style={{ fontSize: 11, color: C.green, opacity: 0.75, marginTop: 2 }}>
                          Connected to {sp.name}. HOST can read your account data.
                        </div>
                      </div>
                      <div style={{
                        background: C.orangeBg, border: `1px solid ${C.orangeBorder}`,
                        borderRadius: 8, padding: "10px 14px",
                        display: "flex", alignItems: "flex-start", gap: 8,
                      }}>
                        <Sparkles style={{ width: 12, height: 12, color: C.orange, marginTop: 1, flexShrink: 0 }} />
                        <div style={{ fontSize: 11, fontWeight: 700, color: C.orange }}>
                          Schedule publishing to {sp.name} coming soon
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        {setPage && (
                          <Btn onClick={() => setPage("schedule")} small icon={CalendarCheck}>
                            Open Schedule
                          </Btn>
                        )}
                        <button
                          onClick={() => disconnectOtherPlatform(schedPlatform)}
                          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: C.muted, padding: 0 }}
                        >
                          Disconnect
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* ── Not connected — API key input ── */
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <button
                            onClick={() => setShowHowTo(v => !v)}
                            style={{
                              background: "none", border: "none", cursor: "pointer",
                              fontSize: 11, fontWeight: 600, color: sp.color, padding: 0,
                              display: "flex", alignItems: "center", gap: 5,
                            }}
                          >
                            {showHowTo ? "▲" : "▼"} Where to find your API key
                          </button>
                          {sp.settingsUrl && (
                            <a href={sp.settingsUrl} target="_blank" rel="noreferrer"
                              style={{ fontSize: 10, color: C.accent, fontWeight: 600, textDecoration: "none", display: "flex", alignItems: "center", gap: 3 }}>
                              Open {sp.name} <ExternalLink style={{ width: 9, height: 9 }} />
                            </a>
                          )}
                        </div>
                        {showHowTo && (
                          <div style={{ margin: "10px 0 0", fontSize: 11, color: C.text2, lineHeight: 2 }}>
                            <strong>{sp.name}:</strong> {sp.keyPath}
                          </div>
                        )}
                        {sp.planNote && (
                          <p style={{ fontSize: 10, color: C.muted, margin: "8px 0 0", lineHeight: 1.5 }}>
                            ⓘ {sp.planNote}
                          </p>
                        )}
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: C.text2, display: "block", marginBottom: 6 }}>
                          API Key
                        </label>
                        <input
                          type="password"
                          value={otherKey}
                          onChange={e => setOtherKey(e.target.value)}
                          onKeyDown={e => e.key === "Enter" && connectOtherPlatform(schedPlatform)}
                          placeholder={`Paste your ${sp.name} API key here…`}
                          style={{ ...inputSt, resize: undefined, fontFamily: "monospace" }}
                        />
                      </div>
                      <Btn
                        onClick={() => connectOtherPlatform(schedPlatform)}
                        variant="primary" small
                        disabled={!otherKey.trim() || otherConnecting}
                        icon={otherConnecting ? Loader2 : undefined}
                      >
                        {otherConnecting ? "Connecting…" : `Connect ${sp.name}`}
                      </Btn>
                      {otherErr && (
                        <p style={{ fontSize: 11, color: C.red, margin: 0, lineHeight: 1.5 }}>{otherErr}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* CSV-only platforms — Deputy, Sling, HotSchedules */}
              {!is7 && !sp.canConnect && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {/* CSV workflow */}
                  <div style={{
                    background: "#F8FAFC", border: `1px solid ${C.border}`,
                    borderRadius: 8, padding: "12px 14px",
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.text2, marginBottom: 6 }}>
                      Use CSV export today
                    </div>
                    <ol style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: C.text2, lineHeight: 1.9 }}>
                      <li>Go to <strong>Admin → Schedule</strong> and build your week with HOST AI</li>
                      <li>Click <strong>Download CSV</strong> in the schedule toolbar</li>
                      <li>In {sp.name}: <strong>{sp.csvImport}</strong></li>
                    </ol>
                  </div>

                  {/* API coming soon */}
                  <div style={{
                    background: C.orangeBg, border: `1px solid ${C.orangeBorder}`,
                    borderRadius: 8, padding: "10px 14px",
                    display: "flex", alignItems: "flex-start", gap: 8,
                  }}>
                    <Sparkles style={{ width: 12, height: 12, color: C.orange, marginTop: 1, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.orange }}>
                        Direct {sp.name} API integration coming soon
                      </div>
                      <div style={{ fontSize: 10, color: C.orange, opacity: 0.8, marginTop: 2, lineHeight: 1.5 }}>
                        When ready: {sp.keyPath}{sp.planNote ? ` · ${sp.planNote}` : ""}
                      </div>
                    </div>
                  </div>

                  {setPage && (
                    <Btn onClick={() => setPage("schedule")} small icon={CalendarCheck}>
                      Open Schedule to Download CSV
                    </Btn>
                  )}
                </div>
              )}
            </div>
          )
        })()}

        {/* ── POS System ── */}
        <div style={boxStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={iconBoxStyle(squareData ? C.greenBg : "rgba(0,0,0,0.04)")}>
              <CreditCard style={{ width: 20, height: 20, color: squareData ? C.green : C.muted }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>POS System</div>
              <div style={{ fontSize: 11, color: C.muted }}>Auto-close tables · sync covers to analytics</div>
            </div>
            {squareData && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 99,
                background: C.greenBg, color: C.green, border: `1px solid ${C.greenBorder}`, whiteSpace: "nowrap",
              }}>● Connected</span>
            )}
            {squareConnecting && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 99,
                background: C.orangeBg, color: C.orange, border: `1px solid ${C.orangeBorder}`, whiteSpace: "nowrap",
              }}>Connecting…</span>
            )}
          </div>

          {/* ── Square ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#FF6900", flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Square</span>
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: "0.04em",
                background: C.greenBg, color: C.green, border: `1px solid ${C.greenBorder}`,
                borderRadius: 4, padding: "1px 6px",
              }}>Free · Recommended</span>
            </div>

            {squareData ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{
                  background: C.greenBg, border: `1px solid ${C.greenBorder}`,
                  borderRadius: 8, padding: "12px 14px",
                }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.green }}>{squareData.merchant_name}</div>
                  <div style={{ fontSize: 11, color: C.green, opacity: 0.8, marginTop: 2 }}>
                    Reading orders, payments &amp; covers from Square
                  </div>
                </div>
                <button onClick={disconnectSquare} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: C.muted, padding: 0, textAlign: "left" }}>
                  Disconnect Square
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <p style={{ fontSize: 11, color: C.text2, margin: 0, lineHeight: 1.55 }}>
                  Full OAuth · reads orders, payments &amp; covers. Auto-closes tables when checks are paid. Free developer account — no fees.
                </p>
                {process.env.NEXT_PUBLIC_SQUARE_CLIENT_ID ? (
                  <Btn onClick={connectSquare} variant="primary" small
                    disabled={squareConnecting}
                    icon={squareConnecting ? Loader2 : undefined}
                  >
                    {squareConnecting ? "Connecting…" : "Connect with Square"}
                  </Btn>
                ) : (
                  <div style={{
                    background: C.orangeBg, border: `1px solid ${C.orangeBorder}`,
                    borderRadius: 8, padding: "12px 14px",
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.orange, marginBottom: 6 }}>
                      One-time setup required (5 min, free)
                    </div>
                    <ol style={{ margin: 0, paddingLeft: 16, fontSize: 10, color: C.text2, lineHeight: 2 }}>
                      <li>Create a free app at{" "}
                        <a href="https://developer.squareup.com/apps" target="_blank" rel="noreferrer"
                          style={{ color: C.accent, fontWeight: 600 }}>developer.squareup.com</a>
                      </li>
                      <li>Add OAuth redirect URL:{" "}
                        <code style={{ fontSize: 9, background: "rgba(0,0,0,0.06)", padding: "1px 5px", borderRadius: 3 }}>
                          https://hostplatform.net/api/square/callback
                        </code>
                      </li>
                      <li>Add to Railway env vars:{" "}
                        <code style={{ fontSize: 9, background: "rgba(0,0,0,0.06)", padding: "1px 5px", borderRadius: 3 }}>NEXT_PUBLIC_SQUARE_CLIENT_ID</code>
                        {" "}&amp;{" "}
                        <code style={{ fontSize: 9, background: "rgba(0,0,0,0.06)", padding: "1px 5px", borderRadius: 3 }}>SQUARE_CLIENT_SECRET</code>
                      </li>
                    </ol>
                  </div>
                )}
                {squareErr && (
                  <p style={{ fontSize: 11, color: C.red, margin: 0 }}>{squareErr}</p>
                )}
              </div>
            )}
          </div>

          <div style={{ borderTop: `1px solid ${C.border}` }} />

          {/* ── Clover ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#00A651", flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Clover</span>
                <span style={{
                  fontSize: 9, fontWeight: 700,
                  background: C.orangeBg, color: C.orange, border: `1px solid ${C.orangeBorder}`,
                  borderRadius: 4, padding: "1px 6px",
                }}>Setup Required</span>
              </div>
              <a href="https://docs.clover.com/" target="_blank" rel="noreferrer"
                style={{ fontSize: 10, color: C.accent, fontWeight: 600, textDecoration: "none", display: "flex", alignItems: "center", gap: 3 }}>
                Docs <ExternalLink style={{ width: 9, height: 9 }} />
              </a>
            </div>
            <p style={{ fontSize: 10, color: C.muted, margin: 0, lineHeight: 1.6 }}>
              Full OAuth available. Register a free developer app at{" "}
              <a href="https://www.clover.com/global-developer-home" target="_blank" rel="noreferrer"
                style={{ color: C.accent }}>clover.com/global-developer-home</a>{" "}
              — requires sandbox testing before live use.
            </p>
          </div>

          <div style={{ borderTop: `1px solid ${C.border}` }} />

          {/* ── Toast ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#E91E1E", flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Toast</span>
                <span style={{
                  fontSize: 9, fontWeight: 700,
                  background: C.redBg, color: C.red, border: `1px solid ${C.redBorder}`,
                  borderRadius: 4, padding: "1px 6px",
                }}>Partner Program Required</span>
              </div>
              <a href="https://doc.toasttab.com/openapi/general/overview/" target="_blank" rel="noreferrer"
                style={{ fontSize: 10, color: C.muted, textDecoration: "none", display: "flex", alignItems: "center", gap: 3 }}>
                Docs <ExternalLink style={{ width: 9, height: 9 }} />
              </a>
            </div>
            <p style={{ fontSize: 10, color: C.muted, margin: 0, lineHeight: 1.6 }}>
              API gated behind Toast&apos;s Partner Program — requires an application, approval, and revenue-share fees. Not practical for independent owners.
            </p>
          </div>
        </div>

        {/* ── Camera AI ── */}
        <div style={{ ...boxStyle, opacity: 0.65 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={iconBoxStyle(C.bg)}>
              <Camera style={{ width: 20, height: 20, color: C.muted }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Camera AI</div>
              <div style={{ fontSize: 11, color: C.muted }}>Occupancy detection</div>
            </div>
          </div>
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <span style={{
              fontSize: 11, padding: "3px 12px", borderRadius: 99, fontWeight: 700,
              background: C.orangeBg, color: C.orange, border: `1px solid ${C.orangeBorder}`,
            }}>
              Coming Soon
            </span>
          </div>
          <p style={{ fontSize: 11, color: C.muted, margin: 0, lineHeight: 1.6 }}>
            Real-time table occupancy from ceiling cameras that auto-updates the floor map without any host input.
          </p>
        </div>

      </div>
    </div>
  )
}

// ── Page: Terms & Conditions ───────────────────────────────────────────────────

function TermsPage() {
  const EFFECTIVE = "March 1, 2025"
  const ENTITY    = "HOST Systems Inc."
  const EMAIL     = "legal@hostplatform.net"
  const ADDRESS   = "Denver, Colorado, United States"

  const sectionStyle: React.CSSProperties = { marginBottom: 36 }
  const h2Style: React.CSSProperties = {
    fontSize: 15, fontWeight: 800, color: C.text,
    margin: "0 0 10px", paddingBottom: 8,
    borderBottom: `1px solid ${C.border}`,
  }
  const h3Style: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: C.text, margin: "16px 0 6px" }
  const pStyle: React.CSSProperties  = { fontSize: 13, color: C.text2, lineHeight: 1.7, margin: "0 0 10px" }
  const liStyle: React.CSSProperties = { fontSize: 13, color: C.text2, lineHeight: 1.7, marginBottom: 5 }

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <ScrollText style={{ width: 20, height: 20, color: C.accent, flexShrink: 0 }} />
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: 0 }}>
            Terms &amp; Conditions
          </h1>
        </div>
        <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>
          {ENTITY} · Effective Date: {EFFECTIVE}
        </p>
        <div style={{
          marginTop: 16, padding: "12px 16px", borderRadius: 8,
          background: "#FFF7ED", border: "1px solid #FED7AA",
        }}>
          <p style={{ fontSize: 12, color: "#92400E", margin: 0, lineHeight: 1.6 }}>
            <strong>Please read these Terms carefully.</strong> By accessing or using the HOST platform
            ("Service"), you agree to be bound by these Terms on behalf of yourself and the business
            entity you represent. If you do not agree, you may not use the Service.
          </p>
        </div>
      </div>

      {/* 1. Definitions */}
      <div style={sectionStyle}>
        <h2 style={h2Style}>1. Definitions</h2>
        <p style={pStyle}>
          As used in these Terms, the following definitions apply:
        </p>
        <ul style={{ margin: "0 0 10px", paddingLeft: 22 }}>
          <li style={liStyle}><strong>"HOST" / "we" / "us"</strong> refers to {ENTITY}, the provider of the HOST restaurant management platform.</li>
          <li style={liStyle}><strong>"Service"</strong> refers to the HOST software platform, including the web application, hostess station interface, guest-facing queue and waitlist pages, administrative dashboard, analytics tools, scheduling features, and all associated APIs and integrations.</li>
          <li style={liStyle}><strong>"Subscriber" / "you"</strong> refers to the restaurant, hospitality business, or individual that has registered for and uses the Service.</li>
          <li style={liStyle}><strong>"Guest Data"</strong> refers to information collected about your restaurant guests, including names, phone numbers, party sizes, wait times, and seating records.</li>
          <li style={liStyle}><strong>"Subscription"</strong> refers to the paid or trial access plan under which you use the Service.</li>
        </ul>
      </div>

      {/* 2. Description of Service */}
      <div style={sectionStyle}>
        <h2 style={h2Style}>2. Description of Service</h2>
        <p style={pStyle}>
          HOST provides a cloud-based restaurant operations platform designed to help hospitality
          businesses manage waitlists and queues, view real-time table availability, coordinate
          reservations, access operational analytics, generate AI-assisted staff scheduling
          recommendations, and integrate with third-party point-of-sale, scheduling, and reservation
          systems (collectively, the "Service").
        </p>
        <p style={pStyle}>
          The Service is provided on a software-as-a-service ("SaaS") basis. We reserve the right to
          update, modify, or discontinue any feature of the Service at any time with reasonable prior
          notice where practicable.
        </p>
      </div>

      {/* 3. Account Registration */}
      <div style={sectionStyle}>
        <h2 style={h2Style}>3. Account Registration &amp; Access</h2>
        <h3 style={h3Style}>3.1 Eligibility</h3>
        <p style={pStyle}>
          You must be at least 18 years old and authorized to enter into legally binding contracts on
          behalf of the business entity you represent. By registering, you represent that all information
          you provide is accurate and complete.
        </p>
        <h3 style={h3Style}>3.2 Account Security</h3>
        <p style={pStyle}>
          You are responsible for maintaining the confidentiality of your account credentials. You agree
          to notify HOST immediately at {EMAIL} if you suspect unauthorized access. HOST is not liable for
          any losses arising from unauthorized use of your account due to your failure to safeguard
          credentials.
        </p>
        <h3 style={h3Style}>3.3 Authorized Users</h3>
        <p style={pStyle}>
          You may grant access to employees and staff ("Authorized Users") within your Subscription
          limits. You are responsible for all activity by Authorized Users and must ensure they comply
          with these Terms.
        </p>
      </div>

      {/* 4. Subscription and Billing */}
      <div style={sectionStyle}>
        <h2 style={h2Style}>4. Subscription &amp; Billing</h2>
        <h3 style={h3Style}>4.1 Subscription Plans</h3>
        <p style={pStyle}>
          HOST offers subscription plans on a monthly or annual basis, as described on our pricing page.
          Features available to you depend on your selected plan. HOST reserves the right to modify plan
          pricing or features upon 30 days' written notice.
        </p>
        <h3 style={h3Style}>4.2 Payment</h3>
        <p style={pStyle}>
          Subscriptions are billed in advance. By providing payment information, you authorize HOST (or
          its payment processor) to charge the applicable fees on a recurring basis. All fees are in
          U.S. dollars and are non-refundable except as expressly stated herein or required by
          applicable law.
        </p>
        <h3 style={h3Style}>4.3 Free Trials</h3>
        <p style={pStyle}>
          HOST may offer a free trial period. At the end of the trial, your account will automatically
          convert to a paid subscription unless you cancel before the trial expires.
        </p>
        <h3 style={h3Style}>4.4 Taxes</h3>
        <p style={pStyle}>
          You are responsible for all applicable taxes, levies, or duties imposed by taxing authorities
          in connection with your use of the Service, excluding taxes based solely on HOST's income.
        </p>
        <h3 style={h3Style}>4.5 Late Payment &amp; Suspension</h3>
        <p style={pStyle}>
          If payment is not received by the due date, HOST may suspend access to the Service after
          providing 7 days' written notice. Restoration of access may be subject to a reactivation fee.
        </p>
      </div>

      {/* 5. Restaurant and Guest Data */}
      <div style={sectionStyle}>
        <h2 style={h2Style}>5. Restaurant Data &amp; Guest Information</h2>
        <h3 style={h3Style}>5.1 Your Data Ownership</h3>
        <p style={pStyle}>
          You retain all ownership of your restaurant's operational data and Guest Data entered into or
          generated through the Service. You grant HOST a limited, non-exclusive license to process,
          store, and display your data solely to provide and improve the Service.
        </p>
        <h3 style={h3Style}>5.2 Guest Data Responsibilities</h3>
        <p style={pStyle}>
          You are solely responsible for ensuring that your collection, use, and storage of Guest Data
          complies with all applicable laws and regulations, including but not limited to the Colorado
          Privacy Act (CPA), the California Consumer Privacy Act (CCPA), and any other applicable
          state or federal privacy laws. You must provide appropriate notice to guests regarding data
          collection and obtain any required consents.
        </p>
        <h3 style={h3Style}>5.3 SMS Notifications</h3>
        <p style={pStyle}>
          The Service includes optional SMS notification features. You are responsible for obtaining
          all required consents from guests before sending SMS messages through the Service. By enabling
          SMS features, you represent that you have obtained such consents and will comply with the
          Telephone Consumer Protection Act (TCPA), CAN-SPAM Act, and all applicable carrier guidelines.
          HOST is not liable for violations arising from your use of SMS features.
        </p>
        <h3 style={h3Style}>5.4 Data Retention &amp; Export</h3>
        <p style={pStyle}>
          Upon termination of your account, HOST will retain your data for 90 days, during which you
          may export it via the administrative dashboard. After this period, your data may be
          permanently deleted. HOST is not responsible for data lost due to failure to export prior
          to deletion.
        </p>
        <h3 style={h3Style}>5.5 Aggregated Analytics</h3>
        <p style={pStyle}>
          HOST may use de-identified, aggregated data derived from your use of the Service to improve
          the platform, develop new features, and for internal analytics purposes. Such data will not
          identify you or your guests individually.
        </p>
      </div>

      {/* 6. Intellectual Property */}
      <div style={sectionStyle}>
        <h2 style={h2Style}>6. Intellectual Property</h2>
        <h3 style={h3Style}>6.1 HOST Ownership</h3>
        <p style={pStyle}>
          The Service, including all software, algorithms, user interface designs, documentation,
          trademarks, and branding (the "HOST IP"), is and remains the exclusive property of {ENTITY}.
          These Terms do not grant you any rights in or to the HOST IP except the limited license
          expressly set forth herein.
        </p>
        <h3 style={h3Style}>6.2 Limited License to You</h3>
        <p style={pStyle}>
          Subject to these Terms and payment of applicable fees, HOST grants you a limited,
          non-exclusive, non-transferable, non-sublicensable license to access and use the Service
          solely for your internal business operations during the subscription term.
        </p>
        <h3 style={h3Style}>6.3 Restrictions</h3>
        <p style={pStyle}>You agree not to:</p>
        <ul style={{ margin: "0 0 10px", paddingLeft: 22 }}>
          <li style={liStyle}>Copy, modify, distribute, sell, or sublicense any portion of the Service;</li>
          <li style={liStyle}>Reverse engineer, disassemble, or decompile the software;</li>
          <li style={liStyle}>Remove or alter any proprietary notices, labels, or marks;</li>
          <li style={liStyle}>Use the Service to build a competing product or service;</li>
          <li style={liStyle}>Access the Service by any automated means (scraping, bots) except via authorized APIs.</li>
        </ul>
        <h3 style={h3Style}>6.4 Feedback</h3>
        <p style={pStyle}>
          If you provide HOST with feedback, suggestions, or ideas about the Service, you grant HOST
          a perpetual, irrevocable, royalty-free license to use such feedback for any purpose without
          obligation or compensation to you.
        </p>
      </div>

      {/* 7. Privacy */}
      <div style={sectionStyle}>
        <h2 style={h2Style}>7. Privacy &amp; Data Security</h2>
        <p style={pStyle}>
          HOST's collection and use of personal information is governed by our Privacy Policy,
          incorporated herein by reference. HOST implements industry-standard technical and
          organizational measures to protect data against unauthorized access, alteration, or
          destruction. However, no method of transmission or storage is 100% secure, and HOST
          cannot guarantee absolute security.
        </p>
        <p style={pStyle}>
          In the event of a data breach affecting your Guest Data, HOST will notify you without
          undue delay and no later than as required by applicable law, and will cooperate reasonably
          in your response efforts.
        </p>
      </div>

      {/* 8. Third-Party Integrations */}
      <div style={sectionStyle}>
        <h2 style={h2Style}>8. Third-Party Integrations</h2>
        <p style={pStyle}>
          The Service may integrate with third-party platforms including but not limited to Square,
          Clover, Toast, 7Shifts, Homebase, WhenIWork, OpenTable, and Resy (collectively,
          "Third-Party Services"). Your use of Third-Party Services is subject to those services'
          own terms and privacy policies. HOST is not responsible for the availability, accuracy,
          or practices of any Third-Party Service.
        </p>
        <p style={pStyle}>
          When you connect a Third-Party Service through HOST, you authorize HOST to exchange data
          with that service on your behalf. You represent that you have the right to grant this
          authorization and that doing so does not violate the Third-Party Service's terms.
        </p>
      </div>

      {/* 9. Acceptable Use */}
      <div style={sectionStyle}>
        <h2 style={h2Style}>9. Acceptable Use Policy</h2>
        <p style={pStyle}>You agree not to use the Service to:</p>
        <ul style={{ margin: "0 0 10px", paddingLeft: 22 }}>
          <li style={liStyle}>Violate any applicable law, regulation, or third-party rights;</li>
          <li style={liStyle}>Transmit unsolicited commercial communications or spam;</li>
          <li style={liStyle}>Upload or distribute malware, viruses, or other harmful code;</li>
          <li style={liStyle}>Interfere with or disrupt the integrity or performance of the Service;</li>
          <li style={liStyle}>Attempt unauthorized access to HOST systems, accounts, or data;</li>
          <li style={liStyle}>Collect or harvest data from the Service without HOST's express written consent;</li>
          <li style={liStyle}>Impersonate any person or entity or misrepresent your affiliation.</li>
        </ul>
        <p style={pStyle}>
          HOST reserves the right to investigate suspected violations and, where appropriate, suspend or
          terminate access without prior notice.
        </p>
      </div>

      {/* 10. Service Availability */}
      <div style={sectionStyle}>
        <h2 style={h2Style}>10. Service Availability</h2>
        <p style={pStyle}>
          HOST will use commercially reasonable efforts to maintain Service availability of at least
          99.5% measured monthly, excluding scheduled maintenance windows. HOST will endeavor to
          provide advance notice of scheduled maintenance. Unplanned outages may occur and HOST is
          not liable for any resulting operational disruptions.
        </p>
      </div>

      {/* 11. Disclaimers */}
      <div style={sectionStyle}>
        <h2 style={h2Style}>11. Disclaimers</h2>
        <p style={pStyle}>
          THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS
          OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
          PARTICULAR PURPOSE, NON-INFRINGEMENT, OR UNINTERRUPTED OR ERROR-FREE OPERATION. HOST DOES
          NOT WARRANT THAT THE SERVICE WILL MEET YOUR SPECIFIC REQUIREMENTS OR THAT AI-GENERATED
          SCHEDULING RECOMMENDATIONS WILL BE ACCURATE OR SUITABLE FOR YOUR OPERATIONS.
        </p>
        <p style={pStyle}>
          Some jurisdictions do not allow the exclusion of implied warranties, so the above exclusions
          may not apply to you in full.
        </p>
      </div>

      {/* 12. Limitation of Liability */}
      <div style={sectionStyle}>
        <h2 style={h2Style}>12. Limitation of Liability</h2>
        <p style={pStyle}>
          TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT WILL HOST, ITS OFFICERS,
          DIRECTORS, EMPLOYEES, OR AFFILIATES BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
          CONSEQUENTIAL, PUNITIVE, OR EXEMPLARY DAMAGES, INCLUDING LOSS OF PROFITS, REVENUE, DATA,
          GOODWILL, OR BUSINESS INTERRUPTION, ARISING FROM OR RELATED TO YOUR USE OF OR INABILITY
          TO USE THE SERVICE.
        </p>
        <p style={pStyle}>
          HOST's total cumulative liability to you for all claims arising from or related to the
          Service will not exceed the greater of: (a) the total fees paid by you to HOST in the
          twelve (12) months immediately preceding the claim, or (b) one hundred U.S. dollars ($100).
        </p>
        <p style={pStyle}>
          These limitations apply regardless of the theory of liability (contract, tort, statute,
          or otherwise) and even if HOST has been advised of the possibility of such damages.
        </p>
      </div>

      {/* 13. Indemnification */}
      <div style={sectionStyle}>
        <h2 style={h2Style}>13. Indemnification</h2>
        <p style={pStyle}>
          You agree to defend, indemnify, and hold harmless {ENTITY} and its officers, directors,
          employees, agents, and successors from and against any claims, liabilities, damages,
          judgments, losses, costs, and expenses (including reasonable attorneys' fees) arising out of
          or relating to: (a) your use of the Service; (b) your violation of these Terms;
          (c) your violation of any applicable law or third-party right; (d) any Guest Data you
          collect or process through the Service; or (e) your use of Third-Party Integrations.
        </p>
      </div>

      {/* 14. Term and Termination */}
      <div style={sectionStyle}>
        <h2 style={h2Style}>14. Term &amp; Termination</h2>
        <h3 style={h3Style}>14.1 Term</h3>
        <p style={pStyle}>
          These Terms are effective upon your first access to or use of the Service and remain in
          effect until your Subscription is terminated.
        </p>
        <h3 style={h3Style}>14.2 Termination by You</h3>
        <p style={pStyle}>
          You may cancel your Subscription at any time through your account settings or by
          contacting {EMAIL}. Cancellation takes effect at the end of the current billing period.
          No refunds are provided for unused portions of a billing period.
        </p>
        <h3 style={h3Style}>14.3 Termination by HOST</h3>
        <p style={pStyle}>
          HOST may terminate or suspend your account immediately upon written notice if you: (a) breach
          these Terms and fail to cure such breach within 10 days of notice; (b) become insolvent or
          file for bankruptcy; (c) engage in conduct that HOST reasonably believes may harm HOST, the
          Service, or other users; or (d) fail to pay any amounts due.
        </p>
        <h3 style={h3Style}>14.4 Effect of Termination</h3>
        <p style={pStyle}>
          Upon termination, your right to access the Service immediately ceases. Sections 5.4, 6, 11,
          12, 13, 15, and 16 of these Terms survive termination indefinitely.
        </p>
      </div>

      {/* 15. Governing Law */}
      <div style={sectionStyle}>
        <h2 style={h2Style}>15. Governing Law &amp; Dispute Resolution</h2>
        <h3 style={h3Style}>15.1 Governing Law</h3>
        <p style={pStyle}>
          These Terms are governed by and construed in accordance with the laws of the State of
          Colorado, without regard to its conflict-of-law provisions.
        </p>
        <h3 style={h3Style}>15.2 Dispute Resolution</h3>
        <p style={pStyle}>
          The parties will attempt to resolve any dispute through good-faith negotiation for a period
          of 30 days before initiating formal proceedings. If negotiation fails, disputes will be
          resolved by binding arbitration in Denver, Colorado, administered by the American Arbitration
          Association (AAA) under its Commercial Arbitration Rules, except that either party may seek
          injunctive or other equitable relief in a court of competent jurisdiction.
        </p>
        <h3 style={h3Style}>15.3 Class Action Waiver</h3>
        <p style={pStyle}>
          You waive any right to participate in a class action lawsuit or class-wide arbitration
          against HOST with respect to any claim covered by these Terms.
        </p>
      </div>

      {/* 16. Changes to Terms */}
      <div style={sectionStyle}>
        <h2 style={h2Style}>16. Changes to These Terms</h2>
        <p style={pStyle}>
          HOST reserves the right to modify these Terms at any time. For material changes, HOST will
          provide at least 30 days' advance notice via email to your registered address or via a
          prominent notice within the Service. Your continued use of the Service after the effective
          date of any changes constitutes acceptance of the updated Terms. If you do not agree to
          the modified Terms, you must cancel your Subscription before the effective date.
        </p>
      </div>

      {/* 17. General */}
      <div style={sectionStyle}>
        <h2 style={h2Style}>17. General Provisions</h2>
        <h3 style={h3Style}>17.1 Entire Agreement</h3>
        <p style={pStyle}>
          These Terms, together with our Privacy Policy and any applicable Order Form or Statement of
          Work, constitute the entire agreement between you and HOST regarding the Service and supersede
          all prior agreements, representations, or negotiations.
        </p>
        <h3 style={h3Style}>17.2 Severability</h3>
        <p style={pStyle}>
          If any provision of these Terms is held to be invalid or unenforceable, it will be modified
          to the minimum extent necessary to make it enforceable, and the remaining provisions will
          continue in full force and effect.
        </p>
        <h3 style={h3Style}>17.3 Waiver</h3>
        <p style={pStyle}>
          HOST's failure to enforce any right or provision of these Terms will not be deemed a waiver
          of that right or provision.
        </p>
        <h3 style={h3Style}>17.4 Assignment</h3>
        <p style={pStyle}>
          You may not assign your rights or obligations under these Terms without HOST's prior written
          consent. HOST may assign these Terms freely in connection with a merger, acquisition, or
          sale of assets.
        </p>
        <h3 style={h3Style}>17.5 Force Majeure</h3>
        <p style={pStyle}>
          Neither party will be liable for delays or failures in performance resulting from causes
          beyond their reasonable control, including natural disasters, acts of government, power
          failures, internet disruptions, or pandemics.
        </p>
      </div>

      {/* 18. Contact */}
      <div style={sectionStyle}>
        <h2 style={h2Style}>18. Contact Information</h2>
        <p style={pStyle}>
          For legal inquiries or questions about these Terms, please contact:
        </p>
        <div style={{
          padding: "16px 20px", borderRadius: 8,
          background: C.bg, border: `1px solid ${C.border}`,
        }}>
          <p style={{ fontSize: 13, color: C.text, fontWeight: 700, margin: "0 0 4px" }}>{ENTITY}</p>
          <p style={{ fontSize: 13, color: C.text2, margin: "0 0 4px" }}>{ADDRESS}</p>
          <p style={{ fontSize: 13, color: C.text2, margin: 0 }}>
            Email:{" "}
            <a href={`mailto:${EMAIL}`} style={{ color: C.accent, textDecoration: "none" }}>
              {EMAIL}
            </a>
          </p>
        </div>
      </div>

      {/* Footer note */}
      <div style={{
        marginTop: 8, padding: "14px 18px", borderRadius: 8,
        background: "#F0FDF4", border: "1px solid #BBF7D0",
      }}>
        <p style={{ fontSize: 12, color: "#166534", margin: 0, lineHeight: 1.6 }}>
          <strong>Note to the Restaurant Operator:</strong> These Terms govern your subscription to HOST and your
          obligations as a restaurant operator using the platform. We recommend reviewing them with
          qualified legal counsel to ensure they meet your specific operational and jurisdictional
          requirements.
        </p>
      </div>

      <p style={{ fontSize: 11, color: C.muted, textAlign: "center", marginTop: 32, marginBottom: 8 }}>
        © {new Date().getFullYear()} {ENTITY} · All rights reserved · Effective {EFFECTIVE}
      </p>
    </div>
  )
}

// ── Sidebar ────────────────────────────────────────────────────────────────────

const NAV: { label: string; page: Page; Icon: React.ElementType }[] = [
  { label: "Overview",  page: "overview",  Icon: LayoutDashboard },
  { label: "Analytics", page: "analytics", Icon: TrendingUp      },
  { label: "Tables",    page: "tables",    Icon: TableProperties  },
  { label: "Guests",    page: "guests",    Icon: Users            },
  { label: "Schedule",  page: "schedule",  Icon: CalendarCheck    },
  { label: "Inputs",    page: "inputs",    Icon: Settings2        },
  { label: "Terms",     page: "terms",     Icon: ScrollText       },
]

function Sidebar({ active, onSelect, restaurantName, restaurantCity }: { active: Page; onSelect: (p: Page) => void; restaurantName: string; restaurantCity: string }) {
  return (
    <div style={{
      width: 220, flexShrink: 0,
      background: C.surface, borderRight: `1px solid ${C.border}`,
      display: "flex", flexDirection: "column",
      height: "100vh", position: "sticky", top: 0,
    }}>
      {/* Branding */}
      <div style={{ padding: "20px 20px 16px", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.18em", color: C.muted, textTransform: "uppercase", marginBottom: 4 }}>
          Powered by HOST
        </div>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{restaurantName || "Loading…"}</div>
        <div style={{ fontSize: 11, color: C.muted }}>{restaurantCity || ""} · Admin</div>
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, padding: "12px 10px" }}>
        {NAV.map(({ label, page, Icon }) => {
          const on = active === page
          return (
            <button
              key={page}
              onClick={() => onSelect(page)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10,
                padding: "9px 12px", borderRadius: 8, border: "none", cursor: "pointer",
                fontSize: 13, fontWeight: on ? 700 : 500, textAlign: "left",
                background: on ? `${C.accent}12` : "transparent",
                color: on ? C.accent : C.text2,
                borderLeft: `3px solid ${on ? C.accent : "transparent"}`,
                marginBottom: 2, transition: "all 0.1s",
              }}
            >
              <Icon style={{ width: 16, height: 16, flexShrink: 0 }} />
              {label}
            </button>
          )
        })}
      </nav>

      {/* Footer links */}
      <div style={{ padding: "12px 10px", borderTop: `1px solid ${C.border}`, display: "flex", flexDirection: "column", gap: 6 }}>
        <Link href="/reservations" style={{ textDecoration: "none" }}>
          <button style={{
            width: "100%", display: "flex", alignItems: "center", gap: 8,
            padding: "9px 12px", border: `1px solid ${C.border}`, borderRadius: 8,
            cursor: "pointer", fontSize: 12, fontWeight: 600,
            background: "transparent", color: C.text2,
          }}>
            <CalendarDays style={{ width: 13, height: 13 }} />
            Reservations
          </button>
        </Link>
        <Link href="/walters303/station" style={{ textDecoration: "none" }}>
          <button style={{
            width: "100%", display: "flex", alignItems: "center", gap: 8,
            padding: "9px 12px", border: `1px solid ${C.border}`, borderRadius: 8,
            cursor: "pointer", fontSize: 12, fontWeight: 600,
            background: "transparent", color: C.text2,
          }}>
            <ArrowLeft style={{ width: 13, height: 13 }} />
            Back to Host View
          </button>
        </Link>
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [restaurantId,   setRestaurantId]   = useState<string>("")
  const [restaurantName, setRestaurantName] = useState<string>("")
  const [restaurantCity, setRestaurantCity] = useState<string>("")
  const [restaurantJoinUrl, setRestaurantJoinUrl] = useState<string>("")
  const [page,     setPage]     = useState<Page>("overview")
  const [tables,   setTables]   = useState<Table[]>([])
  const [queue,    setQueue]    = useState<QueueEntry[]>([])
  const [insights, setInsights] = useState<Insights | null>(null)
  const [online,   setOnline]   = useState(true)
  const [lastSync, setLastSync] = useState(new Date())
  const [localOccupants, setLocalOccupants] = useState<Map<number, LocalOcc>>(new Map())
  const localOccupantsLoadedRef = useRef(false)

  // Fetch restaurant config on mount
  useEffect(() => {
    fetch("/api/client/me")
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return
        if (d.rid)     setRestaurantId(d.rid)
        if (d.name)    setRestaurantName(d.name)
        if (d.city)    setRestaurantCity(d.city)
        if (d.joinUrl) setRestaurantJoinUrl(d.joinUrl)
      })
      .catch(() => {})
  }, [])

  // Load occupants from the restaurant-scoped key once restaurantId is known
  useEffect(() => {
    if (!restaurantId || localOccupantsLoadedRef.current) return
    localOccupantsLoadedRef.current = true
    try {
      const s = localStorage.getItem(`host_occupants_${restaurantId}`)
      if (s) setLocalOccupants(new Map(JSON.parse(s) as [number, LocalOcc][]))
    } catch {}
  }, [restaurantId])

  // Sync localOccupants from station view via cross-tab storage events
  useEffect(() => {
    if (!restaurantId) return
    const key = `host_occupants_${restaurantId}`
    const onStorage = (e: StorageEvent) => {
      if (e.key === key && e.newValue) {
        try { setLocalOccupants(new Map(JSON.parse(e.newValue) as [number, LocalOcc][])) } catch {}
      } else if (e.key === key && !e.newValue) {
        setLocalOccupants(new Map())
      }
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [restaurantId])

  const moveGuest = useCallback((from: number, to: number) => {
    setLocalOccupants(prev => {
      const next = new Map(prev)
      const occ = next.get(from)
      if (!occ) return prev
      next.delete(from)
      next.set(to, occ)
      try { localStorage.setItem(`host_occupants_${restaurantId}`, JSON.stringify([...next])) } catch {}
      return next
    })
  }, [restaurantId])

  const fetchAll = useCallback(async () => {
    try {
      const rid = restaurantId
      const qs = rid ? `?restaurant_id=${rid}` : ""
      const [tRes, qRes, iRes] = await Promise.all([
        fetch(`${API}/tables${qs}`),
        fetch(`${API}/queue${qs}`),
        fetch(`${API}/insights${qs}`),
      ])
      if (tRes.ok) setTables(await tRes.json())
      if (qRes.ok) setQueue(await qRes.json())
      if (iRes.ok) setInsights(await iRes.json())
      setOnline(true); setLastSync(new Date())
    } catch { setOnline(false) }
  }, [restaurantId])

  useEffect(() => {
    fetchAll()
    const t = setInterval(fetchAll, 8000)
    return () => clearInterval(t)
  }, [fetchAll])

  return (
    <div style={{
      display: "flex", minHeight: "100vh", background: C.bg,
      fontFamily: "var(--font-geist), system-ui, -apple-system, sans-serif",
      color: C.text,
    }}>
      <Sidebar active={page} onSelect={setPage} restaurantName={restaurantName} restaurantCity={restaurantCity} />
      <main style={{
        flex: 1,
        overflowY: page === "schedule" ? "hidden" : "auto",
        padding: page === "schedule" ? 0 : "32px 36px",
        // Terms page uses its own internal max-width container
        display: "flex", flexDirection: "column",
      }}>
        {page === "overview"  && (
          <OverviewPage
            tables={tables} queue={queue} insights={insights}
            online={online} lastSync={lastSync} onRefresh={fetchAll}
            localOccupants={localOccupants} onMoveGuest={moveGuest}
            restaurantName={restaurantName} restaurantCity={restaurantCity} restaurantJoinUrl={restaurantJoinUrl}
          />
        )}
        {page === "analytics" && <AnalyticsPage />}
        {page === "tables"    && <TablesPage tables={tables} localOccupants={localOccupants} />}
        {page === "guests"    && <GuestsPage queue={queue} />}
        {page === "schedule"  && <SchedulingPanel />}
        {page === "inputs"    && <InputsPage setPage={setPage} />}
        {page === "terms"     && <TermsPage />}
      </main>
    </div>
  )
}
