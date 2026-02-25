"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import {
  Users, Clock, CheckCircle2, BellRing, Trash2,
  TableProperties, RefreshCw, Wifi, WifiOff, Plus, X,
  LayoutDashboard,
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeWaiting(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`
}

const SOURCE_LABELS: Record<string, string> = {
  nfc: "NFC", host: "Host", phone: "Phone",
  web: "Web", app: "App", OpenTable: "OT",
}
const SOURCE_COLORS: Record<string, string> = {
  nfc:       "text-sky-400 bg-sky-400/10",
  app:       "text-sky-400 bg-sky-400/10",
  host:      "text-purple-400 bg-purple-400/10",
  OpenTable: "text-orange-400 bg-orange-400/10",
}

// ── Table Row ─────────────────────────────────────────────────────────────────

function TableRow({ table, onClear }: { table: Table; onClear: () => void }) {
  const avail = table.status === "available"
  return (
    <div
      className="flex items-center justify-between px-3 py-2.5 rounded-xl transition-all"
      style={{
        background: avail ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)",
        border: `1px solid ${avail ? "rgba(34,197,94,0.18)" : "rgba(239,68,68,0.18)"}`,
      }}
    >
      <div className="flex items-center gap-2.5">
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: avail ? "#22c55e" : "#ef4444" }}
        />
        <span className="text-sm font-semibold text-white/80">T{table.table_number}</span>
        <span className="text-xs" style={{ color: "var(--muted)" }}>
          <Users className="inline w-3 h-3 mr-0.5" />{table.capacity}
        </span>
      </div>
      {!avail ? (
        <button
          onClick={onClear}
          className="text-xs px-2.5 py-1 rounded-lg hover:bg-white/10 transition-colors font-medium"
          style={{ color: "var(--muted)" }}
        >
          Clear
        </button>
      ) : (
        <span className="text-xs font-medium text-green-400/60">Free</span>
      )}
    </div>
  )
}

// ── Queue Card ────────────────────────────────────────────────────────────────

function QueueCard({
  entry, onSeat, onNotify, onRemove,
}: {
  entry: QueueEntry
  onSeat: () => void
  onNotify: () => void
  onRemove: () => void
}) {
  const isReady = entry.status === "ready"
  const sourceColor = SOURCE_COLORS[entry.source] ?? "text-white/35 bg-white/5"

  return (
    <div
      className="rounded-2xl p-4 transition-all duration-200"
      style={{
        background: isReady ? "rgba(34,197,94,0.07)" : "var(--surface)",
        border: `1px solid ${isReady ? "rgba(34,197,94,0.28)" : "var(--border)"}`,
      }}
    >
      {/* Top row */}
      <div className="flex items-center gap-3 mb-3.5">
        {/* Position */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
          style={{
            background: isReady ? "rgba(34,197,94,0.18)" : "rgba(255,255,255,0.07)",
            color: isReady ? "#22c55e" : "var(--muted)",
          }}
        >
          {entry.position ?? "·"}
        </div>

        {/* Name + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="font-semibold text-white">
              {entry.name || "Guest"}
            </span>
            {isReady && (
              <span className="text-xs px-1.5 py-0.5 rounded font-medium text-green-400 bg-green-400/12 animate-pulse">
                Ready
              </span>
            )}
          </div>
          <div className="flex items-center gap-2.5 text-xs flex-wrap" style={{ color: "var(--muted)" }}>
            <span><Users className="inline w-3 h-3 mr-0.5" />{entry.party_size}</span>
            <span><Clock className="inline w-3 h-3 mr-0.5" />{timeWaiting(entry.arrival_time)}</span>
            {entry.wait_estimate && entry.wait_estimate > 0 && (
              <span>~{entry.wait_estimate}m est.</span>
            )}
            {entry.source && (
              <span className={`px-1.5 py-0.5 rounded font-medium ${sourceColor}`}>
                {SOURCE_LABELS[entry.source] ?? entry.source}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onSeat}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 hover:brightness-110"
          style={{ background: "rgba(34,197,94,0.18)", color: "#22c55e" }}
        >
          <CheckCircle2 className="w-4 h-4" />
          Seat
        </button>

        {!isReady && (
          <button
            onClick={onNotify}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-95 hover:brightness-110"
            style={{ background: "rgba(249,115,22,0.14)", color: "#f97316" }}
          >
            <BellRing className="w-4 h-4" />
            Notify Ready
          </button>
        )}

        <button
          onClick={onRemove}
          className="ml-auto p-2 rounded-xl transition-all active:scale-95 hover:bg-red-500/12"
          style={{ color: "rgba(239,68,68,0.5)" }}
          title="Remove from queue"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ── Add Guest Drawer ──────────────────────────────────────────────────────────

function AddGuestDrawer({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [name, setName]           = useState("")
  const [partySize, setPartySize] = useState(2)
  const [phone, setPhone]         = useState("")
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState("")

  const submit = async () => {
    setLoading(true)
    setError("")
    try {
      const r = await fetch(`${API}/queue/join`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:          name.trim() || null,
          party_size:    partySize,
          phone:         phone.trim() || null,
          preference:    "asap",
          source:        "host",
          restaurant_id: "272a8876-e4e6-4867-831d-0525db80a8db",
        }),
      })
      if (!r.ok) throw new Error("Failed")
      onAdded()
      onClose()
    } catch {
      setError("Could not add guest. Try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative w-full sm:w-[400px] rounded-t-3xl sm:rounded-2xl p-6"
        style={{ background: "#181818", border: "1px solid var(--border)" }}
      >
        {/* Handle (mobile) */}
        <div className="sm:hidden w-10 h-1 rounded-full bg-white/20 mx-auto mb-5" />

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white tracking-tight">Add Guest</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            style={{ color: "var(--muted)" }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Party size */}
        <div className="mb-5">
          <label className="text-xs font-semibold tracking-[0.15em] uppercase mb-3 block" style={{ color: "var(--muted)" }}>
            Party Size
          </label>
          <div className="flex items-center gap-5">
            <button
              onClick={() => setPartySize(p => Math.max(1, p - 1))}
              className="w-11 h-11 rounded-full flex items-center justify-center text-xl font-light transition-colors hover:bg-white/10"
              style={{ border: "1px solid var(--border)", color: "var(--muted)" }}
            >
              −
            </button>
            <span className="text-4xl font-light text-white w-14 text-center tabular-nums">
              {partySize}
            </span>
            <button
              onClick={() => setPartySize(p => Math.min(20, p + 1))}
              className="w-11 h-11 rounded-full flex items-center justify-center text-xl font-light transition-colors hover:bg-white/10"
              style={{ border: "1px solid var(--border)", color: "var(--muted)" }}
            >
              +
            </button>
          </div>
        </div>

        {/* Name */}
        <div className="mb-4">
          <label className="text-xs font-semibold tracking-[0.15em] uppercase mb-2 block" style={{ color: "var(--muted)" }}>
            Name <span style={{ color: "rgba(255,255,255,0.2)" }}>(optional)</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && submit()}
            placeholder="Guest name"
            autoFocus
            className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/25 outline-none focus:ring-1 focus:ring-white/25 transition-all"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)" }}
          />
        </div>

        {/* Phone */}
        <div className="mb-6">
          <label className="text-xs font-semibold tracking-[0.15em] uppercase mb-2 block" style={{ color: "var(--muted)" }}>
            Phone <span style={{ color: "rgba(255,255,255,0.2)" }}>(optional — for SMS)</span>
          </label>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            onKeyDown={e => e.key === "Enter" && submit()}
            placeholder="(555) 000-0000"
            className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/25 outline-none focus:ring-1 focus:ring-white/25 transition-all"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)" }}
          />
        </div>

        {error && (
          <p className="text-sm text-red-400 mb-4 text-center">{error}</p>
        )}

        <button
          onClick={submit}
          disabled={loading}
          className="w-full py-3.5 rounded-xl text-sm font-bold tracking-[0.1em] uppercase transition-all active:scale-95 disabled:opacity-40"
          style={{ background: loading ? "rgba(255,255,255,0.1)" : "white", color: "black" }}
        >
          {loading ? "Adding…" : "Add to Queue"}
        </button>
      </div>
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function HostDashboard() {
  const [tables, setTables]   = useState<Table[]>([])
  const [queue, setQueue]     = useState<QueueEntry[]>([])
  const [online, setOnline]   = useState(true)
  const [lastSync, setLastSync] = useState(new Date())
  const [showAdd, setShowAdd] = useState(false)
  const [avgWait, setAvgWait] = useState(0)

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
      if (r.ok) { const d = await r.json(); setAvgWait(d.avg_wait_estimate ?? 0) }
    } catch { /* ignore */ }
  }, [])

  const refreshAll = useCallback(() => {
    fetchTables(); fetchQueue()
  }, [fetchTables, fetchQueue])

  useEffect(() => {
    refreshAll(); fetchInsights()
    const fast = setInterval(refreshAll, 4000)
    const slow = setInterval(fetchInsights, 30000)
    return () => { clearInterval(fast); clearInterval(slow) }
  }, [refreshAll, fetchInsights])

  const seat   = async (id: string) => { await fetch(`${API}/queue/${id}/seat`,   { method: "POST" }); refreshAll() }
  const notify = async (id: string) => { await fetch(`${API}/queue/${id}/notify`, { method: "POST" }); refreshAll() }
  const remove = async (id: string) => { await fetch(`${API}/queue/${id}/remove`, { method: "POST" }); refreshAll() }
  const clear  = async (id: string) => { await fetch(`${API}/tables/${id}/clear`, { method: "POST" }); fetchTables() }

  const available  = tables.filter(t => t.status === "available").length
  const readyList  = queue.filter(q => q.status === "ready")
  const waitingList = queue.filter(q => q.status === "waiting")

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-40 flex items-center justify-between px-5 py-3 border-b"
        style={{ background: "rgba(10,10,10,0.92)", backdropFilter: "blur(16px)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-3">
          <span className="font-bold text-white tracking-[0.25em] text-sm">HOST</span>
          <div className="h-4 w-px" style={{ background: "rgba(255,255,255,0.12)" }} />
          <div className="flex items-center gap-4 text-xs" style={{ color: "var(--muted)" }}>
            <span>
              <span className="text-green-400 font-semibold">{available}</span>
              <span className="text-white/30">/{tables.length}</span> tables free
            </span>
            <span>
              <span className="text-orange-400 font-semibold">{waitingList.length}</span> waiting
            </span>
            {readyList.length > 0 && (
              <span className="text-green-400 font-semibold animate-pulse">
                {readyList.length} ready ●
              </span>
            )}
            {avgWait > 0 && (
              <span className="hidden md:inline">
                ~<span className="text-white font-medium">{avgWait}m</span> wait
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin"
            className="hidden sm:flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors hover:bg-white/10"
            style={{ color: "var(--muted)" }}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            Admin
          </Link>
          <div
            className="flex items-center gap-1.5 text-xs"
            style={{ color: online ? "#22c55e" : "#ef4444" }}
          >
            {online ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
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

      {/* ── Main Content ───────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row gap-4 p-4">

        {/* ── Queue Panel ────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col gap-5">

          {/* Ready to seat */}
          {readyList.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <h2 className="text-xs font-bold tracking-[0.18em] uppercase text-green-400">
                  Ready to Seat · {readyList.length}
                </h2>
              </div>
              <div className="flex flex-col gap-2.5">
                {readyList.map(entry => (
                  <QueueCard
                    key={entry.id} entry={entry}
                    onSeat={() => seat(entry.id)}
                    onNotify={() => notify(entry.id)}
                    onRemove={() => remove(entry.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Waiting */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {waitingList.length > 0 && (
                  <div className="w-2 h-2 rounded-full bg-orange-400" />
                )}
                <h2 className="text-xs font-bold tracking-[0.18em] uppercase" style={{ color: "var(--muted)" }}>
                  {waitingList.length > 0 ? `Waiting · ${waitingList.length}` : "Queue"}
                </h2>
              </div>
            </div>

            {queue.length === 0 ? (
              <div
                className="rounded-2xl border flex flex-col items-center justify-center py-20 gap-3"
                style={{ borderColor: "var(--border)" }}
              >
                <CheckCircle2 className="w-8 h-8" style={{ color: "rgba(255,255,255,0.15)" }} />
                <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.25)" }}>
                  Queue is clear
                </p>
              </div>
            ) : waitingList.length === 0 ? (
              <div
                className="rounded-2xl border flex flex-col items-center justify-center py-10 gap-2"
                style={{ borderColor: "var(--border)" }}
              >
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.2)" }}>
                  No one else waiting
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {waitingList.map(entry => (
                  <QueueCard
                    key={entry.id} entry={entry}
                    onSeat={() => seat(entry.id)}
                    onNotify={() => notify(entry.id)}
                    onRemove={() => remove(entry.id)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>

        {/* ── Tables Panel ───────────────────────────────────────────── */}
        <div className="lg:w-56 shrink-0">
          <div
            className="rounded-2xl border p-4 lg:sticky lg:top-[61px]"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold tracking-[0.18em] uppercase flex items-center gap-2" style={{ color: "var(--muted)" }}>
                <TableProperties className="w-3.5 h-3.5" />
                Tables
              </h2>
              <span className="text-xs font-semibold" style={{ color: available > 0 ? "#22c55e" : "#ef4444" }}>
                {available}/{tables.length}
              </span>
            </div>

            {tables.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>No tables configured.</p>
                <button
                  onClick={() => fetch(`${API}/setup`, { method: "POST" }).then(refreshAll)}
                  className="text-xs px-3 py-1.5 rounded-lg"
                  style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e" }}
                >
                  Run Setup
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {tables.map(t => (
                  <TableRow key={t.id} table={t} onClear={() => clear(t.id)} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <div className="px-5 pb-24">
        <span className="text-xs" style={{ color: "rgba(255,255,255,0.15)" }}>
          Last sync {lastSync.toLocaleTimeString()}
        </span>
      </div>

      {/* ── Add Guest FAB ──────────────────────────────────────────────── */}
      <button
        onClick={() => setShowAdd(true)}
        className="fixed bottom-6 right-6 flex items-center gap-2 px-5 py-3.5 rounded-full text-sm font-bold shadow-2xl transition-all active:scale-95 hover:scale-105 z-30"
        style={{ background: "white", color: "black", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}
      >
        <Plus className="w-4 h-4" />
        Add Guest
      </button>

      {/* ── Add Guest Drawer ───────────────────────────────────────────── */}
      {showAdd && (
        <AddGuestDrawer onClose={() => setShowAdd(false)} onAdded={refreshAll} />
      )}
    </div>
  )
}
