"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import {
  BrainCircuit, ChevronLeft, TableProperties, Users, Clock,
  BarChart3, Sparkles, Wifi, WifiOff, RefreshCw,
  Camera, Truck, ExternalLink, Copy, Check,
  TrendingUp, Activity, Zap,
} from "lucide-react"

const API = "https://restaurant-brain-production.up.railway.app"

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  return `${Math.floor(diff / 3600)}h`
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, color, icon: Icon,
}: {
  label: string
  value: string | number
  sub?: string
  color: string
  icon: React.ElementType
}) {
  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-1.5"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>{label}</span>
        <Icon className="w-3.5 h-3.5" style={{ color }} />
      </div>
      <span className="text-3xl font-bold tabular-nums" style={{ color }}>{value}</span>
      {sub && <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>{sub}</span>}
    </div>
  )
}

// ── Admin Hub ─────────────────────────────────────────────────────────────────

export default function AdminHub() {
  const [tables, setTables]     = useState<Table[]>([])
  const [queue, setQueue]       = useState<QueueEntry[]>([])
  const [insights, setInsights] = useState<Insights | null>(null)
  const [online, setOnline]     = useState(true)
  const [copied, setCopied]     = useState(false)
  const [origin, setOrigin]     = useState("")
  const [lastSync, setLastSync] = useState(new Date())

  useEffect(() => { setOrigin(window.location.origin) }, [])

  const fetchTables = useCallback(async () => {
    try {
      const r = await fetch(`${API}/tables`)
      if (r.ok) setTables(await r.json())
    } catch { /* ignore */ }
  }, [])

  const fetchQueue = useCallback(async () => {
    try {
      const r = await fetch(`${API}/queue`)
      if (r.ok) { setQueue(await r.json()); setOnline(true); setLastSync(new Date()) }
    } catch { setOnline(false) }
  }, [])

  const fetchInsights = useCallback(async () => {
    try {
      const r = await fetch(`${API}/insights`)
      if (r.ok) setInsights(await r.json())
    } catch { /* ignore */ }
  }, [])

  const refreshAll = useCallback(() => {
    fetchTables(); fetchQueue(); fetchInsights()
  }, [fetchTables, fetchQueue, fetchInsights])

  useEffect(() => {
    refreshAll()
    const interval = setInterval(refreshAll, 8000)
    return () => clearInterval(interval)
  }, [refreshAll])

  const clear = async (id: string) => {
    await fetch(`${API}/tables/${id}/clear`, { method: "POST" })
    fetchTables()
  }

  const copyLink = () => {
    navigator.clipboard.writeText(`${origin}/join`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const available  = tables.filter(t => t.status === "available").length
  const occupied   = tables.filter(t => t.status === "occupied").length
  const waiting    = queue.filter(q => q.status === "waiting").length
  const readyCount = queue.filter(q => q.status === "ready").length
  const utilization = insights?.capacity_utilization ?? 0

  const utilizationColor =
    utilization > 80 ? "#ef4444" :
    utilization > 50 ? "#f97316" : "#22c55e"

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-40 flex items-center justify-between px-5 py-3 border-b"
        style={{ background: "rgba(10,10,10,0.92)", backdropFilter: "blur(16px)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs transition-colors hover:text-white"
            style={{ color: "var(--muted)" }}
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Host View</span>
          </Link>
          <div className="h-4 w-px" style={{ background: "rgba(255,255,255,0.12)" }} />
          <div className="flex items-center gap-2">
            <BrainCircuit className="w-4 h-4 text-blue-400" />
            <span className="font-bold text-white tracking-[0.12em] text-sm">Admin</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs hidden sm:block" style={{ color: "rgba(255,255,255,0.2)" }}>
            {lastSync.toLocaleTimeString()}
          </span>
          <div
            className="flex items-center gap-1.5 text-xs"
            style={{ color: online ? "#22c55e" : "#ef4444" }}
          >
            {online ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{online ? "Live" : "Offline"}</span>
          </div>
          <button
            onClick={refreshAll}
            className="p-1.5 rounded-lg transition-colors hover:bg-white/10"
            style={{ color: "var(--muted)" }}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="p-4 space-y-4">

        {/* ── Stats Grid ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Tables Free"   value={available}  sub={`of ${tables.length}`}             color="#22c55e" icon={TableProperties} />
          <StatCard label="Occupied"      value={occupied}   sub="tables"                             color="#ef4444" icon={Users} />
          <StatCard label="Waiting"       value={waiting}    sub="parties"                            color="#f97316" icon={Clock} />
          <StatCard label="Ready"         value={readyCount} sub="to seat"                            color="#22c55e" icon={CheckIcon} />
          <StatCard label="Avg Wait"      value={insights?.avg_wait_estimate ? `${insights.avg_wait_estimate}m` : "—"} sub="estimate" color="#3b82f6" icon={TrendingUp} />
          <StatCard label="Capacity"      value={`${utilization}%`} sub="utilized"                   color={utilizationColor} icon={Activity} />
        </div>

        {/* ── AI Insights ────────────────────────────────────────────── */}
        {insights?.ai_insights ? (
          <div
            className="rounded-2xl px-5 py-4 flex items-start gap-3"
            style={{ background: "rgba(59,130,246,0.07)", border: "1px solid rgba(59,130,246,0.18)" }}
          >
            <Sparkles className="w-4 h-4 mt-0.5 shrink-0 text-blue-400" />
            <div>
              <div className="text-xs font-bold text-blue-400 tracking-[0.18em] uppercase mb-2 flex items-center gap-2">
                AI Insights
                <Zap className="w-3 h-3" />
              </div>
              <p className="text-sm text-blue-200/75 leading-relaxed whitespace-pre-line">
                {insights.ai_insights}
              </p>
            </div>
          </div>
        ) : (
          <div
            className="rounded-2xl px-5 py-4 flex items-center gap-3"
            style={{ background: "rgba(59,130,246,0.04)", border: "1px solid rgba(59,130,246,0.1)" }}
          >
            <Sparkles className="w-4 h-4 text-blue-400/40 animate-pulse" />
            <span className="text-sm" style={{ color: "rgba(255,255,255,0.2)" }}>
              AI insights loading…
            </span>
          </div>
        )}

        {/* ── Main Grid ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Tables Management */}
          <div
            className="rounded-2xl border p-5"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-white/80 flex items-center gap-2">
                <TableProperties className="w-4 h-4" />
                Table Management
              </h2>
              {tables.length === 0 && (
                <button
                  onClick={() => fetch(`${API}/setup`, { method: "POST" }).then(fetchTables)}
                  className="text-xs px-3 py-1.5 rounded-lg"
                  style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e" }}
                >
                  Run Setup
                </button>
              )}
            </div>

            {tables.length === 0 ? (
              <div className="text-center py-10">
                <TableProperties className="w-8 h-8 mx-auto mb-3" style={{ color: "rgba(255,255,255,0.15)" }} />
                <p className="text-sm" style={{ color: "var(--muted)" }}>No tables configured.</p>
                <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.2)" }}>
                  Run setup to add default tables.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-4">
                  {tables.map(t => {
                    const avail = t.status === "available"
                    return (
                      <div
                        key={t.id}
                        className="rounded-xl p-3 flex flex-col gap-2"
                        style={{
                          background: avail ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)",
                          border: `1px solid ${avail ? "rgba(34,197,94,0.18)" : "rgba(239,68,68,0.18)"}`,
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-white/80">T{t.table_number}</span>
                          <div className="w-2 h-2 rounded-full" style={{ background: avail ? "#22c55e" : "#ef4444" }} />
                        </div>
                        <div className="flex items-center gap-0.5 flex-wrap">
                          {Array.from({ length: Math.min(t.capacity, 8) }).map((_, i) => (
                            <div
                              key={i}
                              className="w-2 h-2 rounded-full"
                              style={{ background: avail ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)" }}
                            />
                          ))}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs" style={{ color: "var(--muted)" }}>{t.capacity}p</span>
                          {!avail && (
                            <button
                              onClick={() => clear(t.id)}
                              className="text-xs px-1.5 py-0.5 rounded hover:bg-white/10 transition-colors"
                              style={{ color: "var(--muted)" }}
                            >
                              Clear
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Capacity bar */}
                <div className="pt-4 border-t" style={{ borderColor: "var(--border)" }}>
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span style={{ color: "var(--muted)" }}>Capacity utilization</span>
                    <span style={{ color: utilizationColor }}>{utilization}%</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${utilization}%`, background: utilizationColor }}
                    />
                  </div>
                  <div className="flex justify-between text-xs mt-1.5" style={{ color: "rgba(255,255,255,0.2)" }}>
                    <span>{occupied} occupied</span>
                    <span>{available} available</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-4">

            {/* Queue overview */}
            <div
              className="rounded-2xl border p-5"
              style={{ background: "var(--surface)", borderColor: "var(--border)" }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-white/80 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Queue Overview
                </h2>
                <Link
                  href="/"
                  className="text-xs px-2.5 py-1 rounded-lg transition-colors hover:bg-white/10"
                  style={{ color: "var(--muted)" }}
                >
                  Manage →
                </Link>
              </div>

              {queue.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm" style={{ color: "var(--muted)" }}>Queue is clear</p>
                </div>
              ) : (
                <div>
                  {queue.slice(0, 10).map(entry => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between py-2.5 border-b last:border-0"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className="text-xs w-5 text-center font-medium tabular-nums"
                          style={{ color: "rgba(255,255,255,0.2)" }}
                        >
                          {entry.position}
                        </span>
                        <span className="text-sm text-white/80 font-medium">
                          {entry.name || "Guest"}
                        </span>
                        <span className="text-xs" style={{ color: "var(--muted)" }}>
                          ×{entry.party_size}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className="text-xs px-2 py-0.5 rounded-lg font-medium"
                          style={{
                            color:       entry.status === "ready" ? "#22c55e" : "#f97316",
                            background:  entry.status === "ready" ? "rgba(34,197,94,0.1)" : "rgba(249,115,22,0.1)",
                          }}
                        >
                          {entry.status}
                        </span>
                        <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
                          {timeAgo(entry.arrival_time)}
                        </span>
                      </div>
                    </div>
                  ))}
                  {queue.length > 10 && (
                    <p className="text-xs text-center pt-3" style={{ color: "rgba(255,255,255,0.2)" }}>
                      +{queue.length - 10} more entries
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* NFC / Join Link */}
            <div
              className="rounded-2xl border p-5"
              style={{ background: "var(--surface)", borderColor: "var(--border)" }}
            >
              <h3 className="text-xs font-bold tracking-[0.18em] uppercase mb-3" style={{ color: "var(--muted)" }}>
                NFC · Guest Join Link
              </h3>
              <p className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>
                Program your NFC tag or share this URL for guests to join the waitlist.
              </p>
              <div
                className="rounded-xl px-3 py-2.5 text-xs font-mono mb-3 break-all select-all"
                style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", border: "1px solid var(--border)" }}
              >
                {origin ? `${origin}/join` : "/join"}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={copyLink}
                  className="flex items-center gap-1.5 text-xs px-3 py-2.5 rounded-xl flex-1 justify-center font-medium transition-all"
                  style={{
                    background: copied ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.06)",
                    color: copied ? "#22c55e" : "var(--muted)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copied!" : "Copy Link"}
                </button>
                <a
                  href="/join"
                  target="_blank"
                  className="flex items-center gap-1.5 text-xs px-3 py-2.5 rounded-xl flex-1 justify-center font-medium transition-all"
                  style={{ background: "rgba(59,130,246,0.1)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.2)" }}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Preview
                </a>
              </div>
            </div>

            {/* Data Sources */}
            <div
              className="rounded-2xl border p-5"
              style={{ background: "var(--surface)", borderColor: "var(--border)" }}
            >
              <h3 className="text-xs font-bold tracking-[0.18em] uppercase mb-4" style={{ color: "var(--muted)" }}>
                Data Sources
              </h3>
              <div className="space-y-3">
                {([
                  { label: "Camera Feed",       icon: Camera,   note: "Connect for visual queue monitoring" },
                  { label: "Delivery Platform", icon: Truck,    note: "Sync incoming delivery orders" },
                  { label: "POS System",        icon: BarChart3, note: "Real-time order & table data" },
                ] as { label: string; icon: React.ElementType; note: string }[]).map(({ label, icon: Icon, note }) => (
                  <div key={label} className="flex items-start gap-3">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)" }}
                    >
                      <Icon className="w-3.5 h-3.5" style={{ color: "var(--muted)" }} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-white/70 font-medium">{label}</span>
                        <span
                          className="text-xs px-2 py-0.5 rounded-lg"
                          style={{ color: "rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.05)" }}
                        >
                          Not connected
                        </span>
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.2)" }}>
                        {note}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs mt-4 pt-3 border-t" style={{ color: "rgba(255,255,255,0.18)", borderColor: "var(--border)" }}>
                Connect data sources to enable AI-powered wait predictions.
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}

// Icon helper (avoids importing CheckCircle2 which would conflict with usage)
function CheckIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <Check className={className} style={style} />
}
