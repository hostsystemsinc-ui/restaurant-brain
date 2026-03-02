"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import Link from "next/link"
import {
  LayoutDashboard, TrendingUp, TableProperties, Users,
  Download, Wifi, WifiOff, RefreshCw, Copy, Check,
  ExternalLink, Search, ArrowLeft, Sparkles,
  Settings2, CalendarDays, Camera, CreditCard, Loader2,
} from "lucide-react"
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

type Page = "overview" | "analytics" | "tables" | "guests" | "inputs"
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
    padding: small ? "6px 10px" : "8px 14px",
    fontSize: small ? 12 : 13,
    opacity: disabled ? 0.45 : 1,
  }
  const styles: Record<string, React.CSSProperties> = {
    primary:   { background: C.accent, color: "#fff" },
    secondary: { background: C.surface, color: C.text2, border: `1px solid ${C.border}` },
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
  tables, queue, insights, online, lastSync, onRefresh, localOccupants,
}: {
  tables: Table[]; queue: QueueEntry[]; insights: Insights | null
  online: boolean; lastSync: Date; onRefresh: () => void
  localOccupants: Map<number, LocalOcc>
}) {
  const [copied, setCopied] = useState(false)
  const joinUrl = typeof window !== "undefined"
    ? `${window.location.origin}/join?r=272a8876-e4e6-4867-831d-0525db80a8db`
    : "https://restaurant-brain-production.up.railway.app/join"

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
          <p style={{ fontSize: 13, color: C.muted, margin: "4px 0 0" }}>Walter's303 · Denver, CO · Live</p>
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
        <CardHeader title="Table Status" action={<span style={{ fontSize: 12, color: C.muted }}>{available} of 16 available</span>} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 10 }}>
          {Array.from({ length: 16 }, (_, i) => {
            const num = i + 1
            const t = tables.find(t => t.table_number === num)
            const localOcc = localOccupants.get(num)
            const apiOccupied = !!t && t.status !== "available"
            const avail = !apiOccupied && !localOcc
            return (
              <div
                key={num}
                style={{
                  padding: "8px 4px",
                  borderRadius: 8,
                  border: `1px solid ${avail ? C.greenBorder : C.redBorder}`,
                  background: avail ? C.greenBg : C.redBg,
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 800, color: avail ? C.green : C.red }}>T{num}</div>
                {localOcc ? (
                  <>
                    <div style={{ fontSize: 9, color: C.red, marginTop: 1, fontWeight: 700, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {localOcc.name}
                    </div>
                    <div style={{ fontSize: 9, color: C.red, fontWeight: 600 }}>{localOcc.party_size}p</div>
                  </>
                ) : (
                  <div style={{ fontSize: 9, color: avail ? C.green : C.red, marginTop: 2, fontWeight: 600 }}>
                    {avail ? "Free" : "Occupied"}
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

function InputsPage() {
  const [icalUrl,    setIcalUrl]    = useState("")
  const [saved,      setSaved]      = useState(false)
  const [syncing,    setSyncing]    = useState(false)
  const [syncMsg,    setSyncMsg]    = useState<{ text: string; ok: boolean } | null>(null)

  useEffect(() => {
    fetch(`${API}/settings`)
      .then(r => r.json())
      .then(d => { if (d.opentable_ical_url) setIcalUrl(d.opentable_ical_url) })
      .catch(() => {})
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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, alignItems: "start" }}>

        {/* ── Reservations / OpenTable ── */}
        <div style={boxStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={iconBoxStyle("#FFFBEB")}>
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
              placeholder="Paste your OpenTable calendar link here…&#10;(Guest Center → Settings → Calendar Sync → iCal Feed)"
              rows={4}
              style={inputSt}
            />
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Btn onClick={saveUrl} variant="primary" small icon={saved ? Check : undefined}>
              {saved ? "Saved!" : "Save URL"}
            </Btn>
            <Btn
              onClick={syncNow}
              small
              disabled={!icalUrl.trim() || syncing}
              icon={syncing ? Loader2 : RefreshCw}
            >
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
              <strong style={{ color: C.text2 }}>Where to find it:</strong> OpenTable Guest Center → Settings → Reservations → Calendar Sync → iCal Feed URL. Paste the link above, save, then click Sync Now. Reservations will appear in the Reservations calendar.
            </p>
          </div>
        </div>

        {/* ── POS ── */}
        <div style={{ ...boxStyle, opacity: 0.65 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={iconBoxStyle(C.bg)}>
              <CreditCard style={{ width: 20, height: 20, color: C.muted }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>POS System</div>
              <div style={{ fontSize: 11, color: C.muted }}>Toast · Square · Clover</div>
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
            Connect your point-of-sale to automatically close tables when checks are paid and sync covers to your analytics.
          </p>
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

// ── Sidebar ────────────────────────────────────────────────────────────────────

const NAV: { label: string; page: Page; Icon: React.ElementType }[] = [
  { label: "Overview",  page: "overview",  Icon: LayoutDashboard },
  { label: "Analytics", page: "analytics", Icon: TrendingUp      },
  { label: "Tables",    page: "tables",    Icon: TableProperties  },
  { label: "Guests",    page: "guests",    Icon: Users            },
  { label: "Inputs",    page: "inputs",    Icon: Settings2        },
]

function Sidebar({ active, onSelect }: { active: Page; onSelect: (p: Page) => void }) {
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
        <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>Walter's303</div>
        <div style={{ fontSize: 11, color: C.muted }}>Denver, CO · Admin</div>
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
        <Link href="/" style={{ textDecoration: "none" }}>
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
  const [page,     setPage]     = useState<Page>("overview")
  const [tables,   setTables]   = useState<Table[]>([])
  const [queue,    setQueue]    = useState<QueueEntry[]>([])
  const [insights, setInsights] = useState<Insights | null>(null)
  const [online,   setOnline]   = useState(true)
  const [lastSync, setLastSync] = useState(new Date())
  const [localOccupants, setLocalOccupants] = useState<Map<number, LocalOcc>>(() => {
    try {
      const s = typeof window !== "undefined" ? localStorage.getItem("host_occupants") : null
      return s ? new Map(JSON.parse(s) as [number, LocalOcc][]) : new Map()
    } catch { return new Map() }
  })

  // Sync localOccupants from host view via storage events (cross-tab)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "host_occupants" && e.newValue) {
        try { setLocalOccupants(new Map(JSON.parse(e.newValue) as [number, LocalOcc][])) } catch {}
      } else if (e.key === "host_occupants" && !e.newValue) {
        setLocalOccupants(new Map())
      }
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  const fetchAll = useCallback(async () => {
    try {
      const [tRes, qRes, iRes] = await Promise.all([
        fetch(`${API}/tables`),
        fetch(`${API}/queue`),
        fetch(`${API}/insights`),
      ])
      if (tRes.ok) setTables(await tRes.json())
      if (qRes.ok) setQueue(await qRes.json())
      if (iRes.ok) setInsights(await iRes.json())
      setOnline(true); setLastSync(new Date())
    } catch { setOnline(false) }
  }, [])

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
      <Sidebar active={page} onSelect={setPage} />
      <main style={{ flex: 1, overflowY: "auto", padding: "32px 36px" }}>
        {page === "overview"  && (
          <OverviewPage
            tables={tables} queue={queue} insights={insights}
            online={online} lastSync={lastSync} onRefresh={fetchAll}
            localOccupants={localOccupants}
          />
        )}
        {page === "analytics" && <AnalyticsPage />}
        {page === "tables"    && <TablesPage tables={tables} localOccupants={localOccupants} />}
        {page === "guests"    && <GuestsPage queue={queue} />}
        {page === "inputs"    && <InputsPage />}
      </main>
    </div>
  )
}
