"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import {
  Users, Clock, CheckCircle2, BellRing, Trash2,
  TableProperties, RefreshCw, Wifi, WifiOff, Plus, X,
  LayoutDashboard,
} from "lucide-react"

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

// ── Helpers ────────────────────────────────────────────────────────────────────

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

// ── Queue Card — large, touch-friendly ────────────────────────────────────────

function QueueCard({
  entry, onSeat, onNotify, onRemove,
}: {
  entry: QueueEntry
  onSeat: () => void
  onNotify: () => void
  onRemove: () => void
}) {
  const isReady = entry.status === "ready"
  const srcColor = SOURCE_COLORS[entry.source] ?? "text-white/30 bg-white/5"

  return (
    <div
      className="rounded-2xl transition-all duration-200"
      style={{
        background: isReady ? "rgba(34,197,94,0.07)" : "var(--surface)",
        border: `1px solid ${isReady ? "rgba(34,197,94,0.3)" : "var(--border)"}`,
      }}
    >
      {/* Info row */}
      <div className="flex items-center gap-4 px-5 pt-4 pb-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-base font-bold shrink-0"
          style={{
            background: isReady ? "rgba(34,197,94,0.18)" : "rgba(255,255,255,0.07)",
            color: isReady ? "#22c55e" : "var(--muted)",
          }}
        >
          {entry.position ?? "·"}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold text-lg text-white leading-tight">
              {entry.name || "Guest"}
            </span>
            {isReady && (
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold text-green-400 bg-green-400/12 animate-pulse">
                READY
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm flex-wrap" style={{ color: "var(--muted)" }}>
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {entry.party_size} {entry.party_size === 1 ? "guest" : "guests"}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {timeWaiting(entry.arrival_time)}
            </span>
            {entry.wait_estimate && entry.wait_estimate > 0 && (
              <span>~{entry.wait_estimate}m est.</span>
            )}
            {entry.source && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${srcColor}`}>
                {SOURCE_LABELS[entry.source] ?? entry.source}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div
        className="flex items-stretch gap-0 border-t"
        style={{ borderColor: isReady ? "rgba(34,197,94,0.15)" : "var(--border)" }}
      >
        {/* Seat — primary */}
        <button
          onClick={onSeat}
          className="flex-1 flex items-center justify-center gap-2 py-4 text-base font-bold transition-all active:scale-95 hover:brightness-110 rounded-bl-2xl"
          style={{ background: "rgba(34,197,94,0.14)", color: "#22c55e" }}
        >
          <CheckCircle2 className="w-5 h-5" />
          Seat
        </button>

        <div style={{ width: "1px", background: isReady ? "rgba(34,197,94,0.15)" : "var(--border)" }} />

        {/* Notify Ready */}
        {!isReady ? (
          <button
            onClick={onNotify}
            className="flex-1 flex items-center justify-center gap-2 py-4 text-base font-semibold transition-all active:scale-95 hover:brightness-110"
            style={{ background: "rgba(249,115,22,0.10)", color: "#f97316" }}
          >
            <BellRing className="w-5 h-5" />
            Notify
          </button>
        ) : (
          <div
            className="flex-1 flex items-center justify-center gap-2 py-4 text-base font-semibold"
            style={{ color: "rgba(34,197,94,0.35)" }}
          >
            <BellRing className="w-5 h-5" />
            Notified
          </div>
        )}

        <div style={{ width: "1px", background: "var(--border)" }} />

        {/* Remove */}
        <button
          onClick={onRemove}
          className="px-5 flex items-center justify-center transition-all active:scale-95 hover:bg-red-500/10 rounded-br-2xl"
          style={{ color: "rgba(239,68,68,0.55)" }}
          title="Remove"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}

// ── Table chip ─────────────────────────────────────────────────────────────────

function TableChip({ table, onClear }: { table: Table; onClear: () => void }) {
  const avail = table.status === "available"
  return (
    <div
      className="flex items-center justify-between px-3 py-3 rounded-xl"
      style={{
        background: avail ? "rgba(34,197,94,0.07)" : "rgba(239,68,68,0.07)",
        border: `1px solid ${avail ? "rgba(34,197,94,0.18)" : "rgba(239,68,68,0.18)"}`,
      }}
    >
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: avail ? "#22c55e" : "#ef4444" }} />
        <span className="text-sm font-bold text-white/85">T{table.table_number}</span>
        <span className="text-xs" style={{ color: "var(--muted)" }}>
          <Users className="inline w-3 h-3 mr-0.5" />{table.capacity}
        </span>
      </div>
      {!avail ? (
        <button
          onClick={onClear}
          className="text-xs px-2.5 py-1 rounded-lg font-semibold hover:bg-white/10 transition-colors"
          style={{ color: "var(--muted)" }}
        >
          Clear
        </button>
      ) : (
        <span className="text-xs font-semibold text-green-400/60">Free</span>
      )}
    </div>
  )
}

// ── Add Guest Drawer ───────────────────────────────────────────────────────────

function AddGuestDrawer({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [name, setName]           = useState("")
  const [partySize, setPartySize] = useState(2)
  const [phone, setPhone]         = useState("")
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState("")

  const submit = async () => {
    setLoading(true); setError("")
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
      if (!r.ok) throw new Error()
      onAdded(); onClose()
    } catch {
      setError("Could not add guest.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full sm:w-[420px] rounded-t-3xl sm:rounded-2xl p-6"
        style={{ background: "#181818", border: "1px solid var(--border)" }}
      >
        <div className="sm:hidden w-10 h-1 rounded-full bg-white/20 mx-auto mb-5" />
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Add Guest</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10" style={{ color: "var(--muted)" }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <label className="text-xs font-bold tracking-[0.15em] uppercase mb-3 block" style={{ color: "var(--muted)" }}>Party Size</label>
        <div className="flex items-center gap-5 mb-6">
          <button onClick={() => setPartySize(p => Math.max(1, p - 1))}
            className="w-12 h-12 rounded-full flex items-center justify-center text-2xl hover:bg-white/10"
            style={{ border: "1px solid var(--border)", color: "var(--muted)" }}>−</button>
          <span className="text-5xl font-light text-white w-14 text-center tabular-nums">{partySize}</span>
          <button onClick={() => setPartySize(p => Math.min(20, p + 1))}
            className="w-12 h-12 rounded-full flex items-center justify-center text-2xl hover:bg-white/10"
            style={{ border: "1px solid var(--border)", color: "var(--muted)" }}>+</button>
        </div>

        <label className="text-xs font-bold tracking-[0.15em] uppercase mb-2 block" style={{ color: "var(--muted)" }}>Name</label>
        <input type="text" value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && submit()} placeholder="Guest name" autoFocus
          className="w-full px-4 py-3.5 rounded-xl text-base text-white placeholder-white/25 outline-none mb-4"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)" }} />

        <label className="text-xs font-bold tracking-[0.15em] uppercase mb-2 block" style={{ color: "var(--muted)" }}>
          Phone <span style={{ color: "rgba(255,255,255,0.2)", fontWeight: 400 }}>(optional)</span>
        </label>
        <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
          onKeyDown={e => e.key === "Enter" && submit()} placeholder="(555) 000-0000"
          className="w-full px-4 py-3.5 rounded-xl text-base text-white placeholder-white/25 outline-none mb-6"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)" }} />

        {error && <p className="text-sm text-red-400 mb-4 text-center">{error}</p>}

        <button onClick={submit} disabled={loading}
          className="w-full py-4 rounded-xl text-base font-bold tracking-[0.1em] uppercase active:scale-[0.98] disabled:opacity-40"
          style={{ background: loading ? "rgba(255,255,255,0.1)" : "white", color: "black" }}>
          {loading ? "Adding…" : "Add to Queue"}
        </button>
      </div>
    </div>
  )
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────

export default function HostDashboard() {
  const [tables, setTables]     = useState<Table[]>([])
  const [queue, setQueue]       = useState<QueueEntry[]>([])
  const [online, setOnline]     = useState(true)
  const [lastSync, setLastSync] = useState(new Date())
  const [showAdd, setShowAdd]   = useState(false)
  const [avgWait, setAvgWait]   = useState(0)

  const fetchTables   = useCallback(async () => { try { const r = await fetch(`${API}/tables`); if (r.ok) setTables(await r.json()) } catch {} }, [])
  const fetchQueue    = useCallback(async () => { try { const r = await fetch(`${API}/queue`); if (r.ok) { setQueue(await r.json()); setOnline(true); setLastSync(new Date()) } } catch { setOnline(false) } }, [])
  const fetchInsights = useCallback(async () => { try { const r = await fetch(`${API}/insights`); if (r.ok) { const d = await r.json(); setAvgWait(d.avg_wait_estimate ?? 0) } } catch {} }, [])
  const refreshAll    = useCallback(() => { fetchTables(); fetchQueue() }, [fetchTables, fetchQueue])

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

  const available   = tables.filter(t => t.status === "available").length
  const readyList   = queue.filter(q => q.status === "ready")
  const waitingList = queue.filter(q => q.status === "waiting")

  return (
    <div className="flex flex-col w-full" style={{ height: "100dvh", overflow: "hidden", background: "var(--bg)" }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-5 py-3.5 shrink-0"
        style={{ background: "rgba(10,10,10,0.95)", borderBottom: "1px solid var(--border)", backdropFilter: "blur(16px)" }}>
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="font-bold text-white tracking-[0.25em] text-sm shrink-0">HOST</span>
          <div className="h-4 w-px shrink-0" style={{ background: "rgba(255,255,255,0.12)" }} />
          <div className="flex items-center gap-2 sm:gap-4 text-sm min-w-0 overflow-hidden" style={{ color: "var(--muted)" }}>
            <span className="shrink-0"><span className="text-green-400 font-bold">{available}</span><span className="text-white/30">/{tables.length}</span> free</span>
            <span className="shrink-0"><span className="text-orange-400 font-bold">{waitingList.length}</span> waiting</span>
            {readyList.length > 0 && <span className="text-green-400 font-bold animate-pulse shrink-0">{readyList.length} ready ●</span>}
            {avgWait > 0 && <span className="hidden md:inline shrink-0">~<span className="text-white font-semibold">{avgWait}m</span></span>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href="/admin" className="hidden sm:flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg hover:bg-white/10" style={{ color: "var(--muted)" }}>
            <LayoutDashboard className="w-3.5 h-3.5" /> Admin
          </Link>
          <div style={{ color: online ? "#22c55e" : "#ef4444" }}>
            {online ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
          </div>
          <button onClick={refreshAll} className="p-2 rounded-lg hover:bg-white/10" style={{ color: "var(--muted)" }}>
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Queue list (scrollable internally) ─────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">

          {/* Ready to seat */}
          {readyList.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
                <h2 className="text-sm font-bold tracking-[0.15em] uppercase text-green-400">
                  Ready to Seat · {readyList.length}
                </h2>
              </div>
              <div className="flex flex-col gap-3">
                {readyList.map(e => (
                  <QueueCard key={e.id} entry={e} onSeat={() => seat(e.id)} onNotify={() => notify(e.id)} onRemove={() => remove(e.id)} />
                ))}
              </div>
            </section>
          )}

          {/* Waiting */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              {waitingList.length > 0 && <div className="w-2.5 h-2.5 rounded-full bg-orange-400" />}
              <h2 className="text-sm font-bold tracking-[0.15em] uppercase" style={{ color: "var(--muted)" }}>
                {waitingList.length > 0 ? `Waiting · ${waitingList.length}` : "Queue"}
              </h2>
            </div>

            {queue.length === 0 ? (
              <div className="rounded-2xl border flex flex-col items-center justify-center py-24 gap-3" style={{ borderColor: "var(--border)" }}>
                <CheckCircle2 className="w-10 h-10" style={{ color: "rgba(255,255,255,0.12)" }} />
                <p className="text-base font-medium" style={{ color: "rgba(255,255,255,0.2)" }}>Queue is clear</p>
              </div>
            ) : waitingList.length === 0 ? (
              <div className="rounded-2xl border flex items-center justify-center py-12" style={{ borderColor: "var(--border)" }}>
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.2)" }}>No one else waiting</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {waitingList.map(e => (
                  <QueueCard key={e.id} entry={e} onSeat={() => seat(e.id)} onNotify={() => notify(e.id)} onRemove={() => remove(e.id)} />
                ))}
              </div>
            )}
          </section>

          <p className="text-xs pb-24" style={{ color: "rgba(255,255,255,0.1)" }}>
            Last sync {lastSync.toLocaleTimeString()}
          </p>
        </div>

        {/* ── Tables sidebar (desktop) ───────────────────────────────── */}
        <div className="hidden lg:flex flex-col w-60 shrink-0 border-l overflow-y-auto p-4 gap-3"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold tracking-[0.15em] uppercase flex items-center gap-2" style={{ color: "var(--muted)" }}>
              <TableProperties className="w-3.5 h-3.5" /> Tables
            </h2>
            <span className="text-sm font-bold" style={{ color: available > 0 ? "#22c55e" : "#ef4444" }}>
              {available}/{tables.length}
            </span>
          </div>
          {tables.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>No tables configured.</p>
              <button onClick={() => fetch(`${API}/setup`, { method: "POST" }).then(refreshAll)}
                className="text-xs px-3 py-2 rounded-lg font-semibold"
                style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e" }}>Run Setup</button>
            </div>
          ) : (
            tables.map(t => <TableChip key={t.id} table={t} onClear={() => clear(t.id)} />)
          )}
        </div>
      </div>

      {/* ── Add Guest FAB ──────────────────────────────────────────────── */}
      <button
        onClick={() => setShowAdd(true)}
        className="fixed bottom-6 right-6 flex items-center gap-2.5 px-6 py-4 rounded-full text-base font-bold shadow-2xl transition-all active:scale-95 hover:scale-105 z-30"
        style={{ background: "white", color: "black", boxShadow: "0 8px 40px rgba(0,0,0,0.6)" }}
      >
        <Plus className="w-5 h-5" /> Add Guest
      </button>

      {showAdd && <AddGuestDrawer onClose={() => setShowAdd(false)} onAdded={refreshAll} />}
    </div>
  )
}
