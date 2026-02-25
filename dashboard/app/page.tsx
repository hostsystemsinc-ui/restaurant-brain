"use client"

import { useEffect, useState, useCallback } from "react"
import {
  Users, Clock, BrainCircuit, Wifi, WifiOff,
  ChevronUp, ChevronDown, CheckCircle2, BellRing, Trash2,
  TableProperties, RefreshCw, Sparkles, Truck, Camera, BarChart3,
} from "lucide-react"

const API = "https://restaurant-brain-production.up.railway.app"

// ── Types ────────────────────────────────────────────────────────────────────

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

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

function sourceBadge(source: string) {
  const map: Record<string, string> = {
    nfc: "NFC", host: "Host", phone: "Phone",
    web: "Web", OpenTable: "OT",
  }
  return map[source] ?? source
}

function sourceColor(source: string) {
  if (source === "nfc") return "text-blue-400 bg-blue-400/10"
  if (source === "host") return "text-purple-400 bg-purple-400/10"
  if (source === "OpenTable") return "text-orange-400 bg-orange-400/10"
  return "text-white/50 bg-white/5"
}

// ── Table Card ───────────────────────────────────────────────────────────────

function TableCard({ table, onClear }: { table: Table; onClear: () => void }) {
  const available = table.status === "available"
  return (
    <div
      className="rounded-xl border p-3 flex flex-col gap-2 transition-all duration-300"
      style={{
        borderColor: available ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)",
        background: available ? "rgba(34,197,94,0.04)" : "rgba(239,68,68,0.04)",
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-white/80">T{table.table_number}</span>
        <span className="text-xs" style={{ color: available ? "#22c55e" : "#ef4444" }}>
          {available ? "●" : "●"}
        </span>
      </div>
      <div className="flex items-center gap-1">
        {Array.from({ length: table.capacity }).map((_, i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full"
            style={{ background: available ? "rgba(34,197,94,0.5)" : "rgba(239,68,68,0.5)" }}
          />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: "var(--muted)" }}>{table.capacity} seats</span>
        {!available && (
          <button
            onClick={onClear}
            className="text-xs px-2 py-0.5 rounded-md transition-colors hover:bg-white/10"
            style={{ color: "var(--muted)" }}
          >
            Clear
          </button>
        )}
      </div>
    </div>
  )
}

// ── Queue Row ────────────────────────────────────────────────────────────────

function QueueRow({
  entry,
  onSeat,
  onNotify,
  onRemove,
}: {
  entry: QueueEntry
  onSeat: () => void
  onNotify: () => void
  onRemove: () => void
}) {
  const isReady = entry.status === "ready"
  return (
    <div
      className="rounded-xl border p-4 flex flex-col gap-3 transition-all duration-300"
      style={{
        borderColor: isReady ? "rgba(34,197,94,0.35)" : "rgba(255,255,255,0.08)",
        background: isReady ? "rgba(34,197,94,0.06)" : "var(--surface)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Position */}
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
          style={{
            background: isReady ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.08)",
            color: isReady ? "#22c55e" : "var(--muted)",
          }}
        >
          {entry.position}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-white truncate">{entry.name}</span>
            <span
              className="text-xs px-1.5 py-0.5 rounded-md font-medium"
              style={{ background: "rgba(255,255,255,0.08)", color: "var(--muted)" }}
            >
              <Users className="inline w-3 h-3 mr-1" style={{ display: "inline" }} />
              {entry.party_size}
            </span>
            <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${sourceColor(entry.source)}`}>
              {sourceBadge(entry.source)}
            </span>
            {isReady && (
              <span className="text-xs px-1.5 py-0.5 rounded-md font-medium text-green-400 bg-green-400/10">
                Ready
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs" style={{ color: "var(--muted)" }}>
              <Clock className="inline w-3 h-3 mr-1" />
              {timeAgo(entry.arrival_time)}
            </span>
            {entry.wait_estimate !== undefined && entry.wait_estimate > 0 && (
              <span className="text-xs" style={{ color: "var(--muted)" }}>
                ~{entry.wait_estimate}m est.
              </span>
            )}
            {entry.notes && entry.notes !== "asap" && (
              <span className="text-xs" style={{ color: "var(--muted)" }}>
                {entry.notes}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onSeat}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
          style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e" }}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          Seat
        </button>
        {!isReady && (
          <button
            onClick={onNotify}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
            style={{ background: "rgba(249,115,22,0.15)", color: "#f97316" }}
          >
            <BellRing className="w-3.5 h-3.5" />
            Notify Ready
          </button>
        )}
        <button
          onClick={onRemove}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-all ml-auto"
          style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}
        >
          <Trash2 className="w-3.5 h-3.5" />
          Remove
        </button>
      </div>
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [tables, setTables]     = useState<Table[]>([])
  const [queue, setQueue]       = useState<QueueEntry[]>([])
  const [insights, setInsights] = useState<Insights | null>(null)
  const [online, setOnline]     = useState(true)
  const [lastSync, setLastSync] = useState(new Date())
  const [aiLoading, setAiLoading] = useState(false)

  const fetchTables = useCallback(async () => {
    try {
      const r = await fetch(`${API}/tables`)
      if (r.ok) setTables(await r.json())
    } catch { /* ignore */ }
  }, [])

  const fetchQueue = useCallback(async () => {
    try {
      const r = await fetch(`${API}/queue`)
      if (r.ok) {
        setQueue(await r.json())
        setOnline(true)
        setLastSync(new Date())
      }
    } catch { setOnline(false) }
  }, [])

  const fetchInsights = useCallback(async () => {
    setAiLoading(true)
    try {
      const r = await fetch(`${API}/insights`)
      if (r.ok) setInsights(await r.json())
    } catch { /* ignore */ } finally {
      setAiLoading(false)
    }
  }, [])

  const refreshAll = useCallback(() => {
    fetchTables()
    fetchQueue()
  }, [fetchTables, fetchQueue])

  useEffect(() => {
    refreshAll()
    fetchInsights()
    const fast = setInterval(refreshAll, 4000)
    const slow = setInterval(fetchInsights, 30000)
    return () => { clearInterval(fast); clearInterval(slow) }
  }, [refreshAll, fetchInsights])

  const seat = async (id: string) => {
    await fetch(`${API}/queue/${id}/seat`, { method: "POST" })
    refreshAll()
  }
  const notify = async (id: string) => {
    await fetch(`${API}/queue/${id}/notify`, { method: "POST" })
    refreshAll()
  }
  const remove = async (id: string) => {
    await fetch(`${API}/queue/${id}/remove`, { method: "POST" })
    refreshAll()
  }
  const clear = async (id: string) => {
    await fetch(`${API}/tables/${id}/clear`, { method: "POST" })
    refreshAll()
  }

  const available  = tables.filter(t => t.status === "available").length
  const occupied   = tables.filter(t => t.status === "occupied").length
  const waiting    = queue.filter(q => q.status === "waiting").length
  const readyCount = queue.filter(q => q.status === "ready").length
  const avgWait    = insights?.avg_wait_estimate ?? 0

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-50 flex items-center justify-between px-6 py-3 border-b"
        style={{ background: "rgba(10,10,10,0.85)", backdropFilter: "blur(12px)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-2.5">
          <BrainCircuit className="w-5 h-5 text-green-400" />
          <span className="font-semibold text-white tracking-tight">Restaurant Brain</span>
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e" }}
          >
            Host
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* Status chips */}
          <div className="hidden sm:flex items-center gap-3 text-sm">
            <span style={{ color: "var(--muted)" }}>
              <TableProperties className="inline w-3.5 h-3.5 mr-1" />
              <span className="text-green-400 font-medium">{available}</span>/{tables.length} free
            </span>
            <span style={{ color: "var(--muted)" }}>
              <Users className="inline w-3.5 h-3.5 mr-1" />
              <span className="text-orange-400 font-medium">{waiting}</span> waiting
            </span>
            {avgWait > 0 && (
              <span style={{ color: "var(--muted)" }}>
                <Clock className="inline w-3.5 h-3.5 mr-1" />
                ~<span className="text-white font-medium">{avgWait}m</span>
              </span>
            )}
          </div>

          {/* Connection indicator */}
          <div className="flex items-center gap-1.5 text-xs" style={{ color: online ? "#22c55e" : "#ef4444" }}>
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

      {/* ── AI Banner ──────────────────────────────────────────────────── */}
      {insights?.ai_insights && (
        <div
          className="mx-4 mt-4 rounded-xl px-4 py-3 flex items-start gap-3"
          style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)" }}
        >
          <Sparkles className="w-4 h-4 mt-0.5 shrink-0 text-blue-400" />
          <p className="text-sm text-blue-200 leading-relaxed whitespace-pre-line">
            {insights.ai_insights}
          </p>
        </div>
      )}
      {aiLoading && !insights?.ai_insights && (
        <div
          className="mx-4 mt-4 rounded-xl px-4 py-3 flex items-center gap-3"
          style={{ background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.1)" }}
        >
          <Sparkles className="w-4 h-4 text-blue-400 animate-pulse" />
          <span className="text-sm text-blue-300/60">Loading AI insights...</span>
        </div>
      )}

      {/* ── Stat Cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-4 mt-4">
        {[
          { label: "Available", value: available, color: "#22c55e", icon: TableProperties },
          { label: "Occupied",  value: occupied,  color: "#ef4444", icon: Users },
          { label: "Waiting",   value: waiting,   color: "#f97316", icon: Clock },
          { label: "Avg Wait",  value: avgWait > 0 ? `${avgWait}m` : "—", color: "#3b82f6", icon: BarChart3 },
        ].map(({ label, value, color, icon: Icon }) => (
          <div
            key={label}
            className="rounded-xl p-4 flex flex-col gap-2"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>{label}</span>
              <Icon className="w-3.5 h-3.5" style={{ color }} />
            </div>
            <span className="text-2xl font-bold" style={{ color }}>{value}</span>
          </div>
        ))}
      </div>

      {/* ── Main Content ───────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row gap-4 p-4 mt-2">

        {/* Tables Panel */}
        <div className="lg:w-64 shrink-0">
          <div
            className="rounded-xl border p-4"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white/80 flex items-center gap-2">
                <TableProperties className="w-4 h-4" />
                Tables
              </h2>
              <span className="text-xs" style={{ color: "var(--muted)" }}>
                {available}/{tables.length}
              </span>
            </div>

            {tables.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm" style={{ color: "var(--muted)" }}>No tables configured.</p>
                <button
                  onClick={() => fetch(`${API}/setup`, { method: "POST" }).then(refreshAll)}
                  className="mt-3 text-xs px-3 py-1.5 rounded-lg transition-colors"
                  style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e" }}
                >
                  Run Setup
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {tables.map(t => (
                  <TableCard key={t.id} table={t} onClear={() => clear(t.id)} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Queue Panel */}
        <div className="flex-1 min-w-0">
          <div
            className="rounded-xl border p-4 h-full"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white/80 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Live Queue
                {readyCount > 0 && (
                  <span
                    className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                    style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e" }}
                  >
                    {readyCount} ready
                  </span>
                )}
              </h2>
              <a
                href="/join"
                className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
                style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e" }}
              >
                + Add Guest
              </a>
            </div>

            {queue.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <CheckCircle2 className="w-8 h-8" style={{ color: "var(--muted)" }} />
                <p className="text-sm" style={{ color: "var(--muted)" }}>Queue is clear</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {queue.map(entry => (
                  <QueueRow
                    key={entry.id}
                    entry={entry}
                    onSeat={() => seat(entry.id)}
                    onNotify={() => notify(entry.id)}
                    onRemove={() => remove(entry.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel */}
        <div className="lg:w-56 shrink-0 flex flex-col gap-4">

          {/* Capacity */}
          <div
            className="rounded-xl border p-4"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}
          >
            <h3 className="text-xs font-semibold mb-3" style={{ color: "var(--muted)" }}>
              CAPACITY
            </h3>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-white/60">
                {insights?.capacity_utilization ?? 0}% full
              </span>
              <span className="text-xs text-white/60">{occupied}/{tables.length}</span>
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${insights?.capacity_utilization ?? 0}%`,
                  background: (insights?.capacity_utilization ?? 0) > 80 ? "#ef4444" :
                    (insights?.capacity_utilization ?? 0) > 50 ? "#f97316" : "#22c55e",
                }}
              />
            </div>
          </div>

          {/* Data Inputs */}
          <div
            className="rounded-xl border p-4 flex-1"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}
          >
            <h3 className="text-xs font-semibold mb-3" style={{ color: "var(--muted)" }}>
              DATA INPUTS
            </h3>
            <div className="flex flex-col gap-3">
              {[
                { label: "Camera",   icon: Camera, active: false, note: "Not connected" },
                { label: "Delivery", icon: Truck,  active: false, note: "Not connected" },
                { label: "POS",      icon: BarChart3, active: false, note: "Not connected" },
              ].map(({ label, icon: Icon, active, note }) => (
                <div key={label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5" style={{ color: active ? "#22c55e" : "var(--muted)" }} />
                    <span className="text-xs text-white/70">{label}</span>
                  </div>
                  <span className="text-xs" style={{ color: active ? "#22c55e" : "rgba(255,255,255,0.25)" }}>
                    {active ? "Live" : note}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs mt-4" style={{ color: "rgba(255,255,255,0.2)" }}>
              Connect data sources to enable AI wait predictions.
            </p>
          </div>

          {/* NFC Link */}
          <div
            className="rounded-xl border p-4"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}
          >
            <h3 className="text-xs font-semibold mb-2" style={{ color: "var(--muted)" }}>NFC / JOIN LINK</h3>
            <p className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.4)" }}>
              Program your NFC tag to this URL:
            </p>
            <div
              className="rounded-lg px-3 py-2 text-xs break-all font-mono"
              style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)" }}
            >
              {typeof window !== "undefined" ? `${window.location.origin}/join` : "/join"}
            </div>
            <a
              href="/join"
              target="_blank"
              className="mt-3 flex items-center justify-center gap-2 text-xs px-3 py-2 rounded-lg transition-all w-full"
              style={{ background: "rgba(59,130,246,0.15)", color: "#3b82f6" }}
            >
              Preview Join Page
            </a>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 pb-4 flex items-center justify-between">
        <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
          Last sync: {lastSync.toLocaleTimeString()}
        </span>
        <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
          Restaurant Brain · AI-powered host system
        </span>
      </div>
    </div>
  )
}
