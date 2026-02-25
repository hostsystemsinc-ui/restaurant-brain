"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import {
  Users, Clock, CheckCircle2, BellRing,
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

// ── Queue Row ──────────────────────────────────────────────────────────────────

function QueueRow({
  entry, onSeat, onNotify, onRemove,
}: {
  entry: QueueEntry
  onSeat: () => void
  onNotify: () => void
  onRemove: () => void
}) {
  const isReady = entry.status === "ready"

  return (
    <div
      className="flex items-center gap-3 sm:gap-4 px-4 py-3.5 rounded-xl transition-colors duration-200"
      style={{
        background: isReady ? "rgba(34,197,94,0.05)" : "rgba(255,255,255,0.025)",
        border: `1px solid ${isReady ? "rgba(34,197,94,0.16)" : "rgba(255,255,255,0.055)"}`,
      }}
    >
      {/* Position */}
      <div
        className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold shrink-0 tabular-nums"
        style={{
          background: isReady ? "rgba(34,197,94,0.14)" : "rgba(255,255,255,0.06)",
          color: isReady ? "#22c55e" : "rgba(255,255,255,0.28)",
        }}
      >
        {entry.position ?? "—"}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="font-semibold text-[15px] leading-snug"
            style={{ color: isReady ? "#86efac" : "rgba(255,255,255,0.92)" }}
          >
            {entry.name || "Guest"}
          </span>
          {isReady && (
            <span
              className="text-[9px] font-black tracking-[0.14em] px-1.5 py-0.5 rounded animate-pulse"
              style={{ background: "rgba(34,197,94,0.12)", color: "#4ade80" }}
            >
              READY
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-[3px]" style={{ color: "rgba(255,255,255,0.28)", fontSize: "12px" }}>
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />{entry.party_size}
          </span>
          <span style={{ color: "rgba(255,255,255,0.12)" }}>·</span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />{timeWaiting(entry.arrival_time)}
          </span>
          {entry.wait_estimate != null && entry.wait_estimate > 0 && (
            <>
              <span style={{ color: "rgba(255,255,255,0.12)" }}>·</span>
              <span>~{entry.wait_estimate}m</span>
            </>
          )}
          {entry.source && (
            <>
              <span style={{ color: "rgba(255,255,255,0.12)" }}>·</span>
              <span style={{ letterSpacing: "0.04em", color: "rgba(255,255,255,0.22)" }}>
                {SOURCE_LABELS[entry.source] ?? entry.source}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onSeat}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-all active:scale-95 hover:brightness-125"
          style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e" }}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Seat</span>
        </button>

        {!isReady ? (
          <button
            onClick={onNotify}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-all active:scale-95 hover:brightness-125"
            style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b" }}
          >
            <BellRing className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Notify</span>
          </button>
        ) : (
          <div
            className="h-8 px-3 hidden sm:flex items-center text-xs font-medium"
            style={{ color: "rgba(34,197,94,0.25)" }}
          >
            Notified
          </div>
        )}

        <button
          onClick={onRemove}
          className="h-8 w-8 flex items-center justify-center rounded-lg transition-all active:scale-95 hover:bg-red-500/10 hover:text-red-400"
          style={{ color: "rgba(255,255,255,0.18)" }}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

// ── Table Chip ─────────────────────────────────────────────────────────────────

function TableChip({ table, onClear }: { table: Table; onClear: () => void }) {
  const avail = table.status === "available"
  return (
    <div
      className="p-3 rounded-xl transition-colors"
      style={{
        background: avail ? "rgba(34,197,94,0.04)" : "rgba(255,255,255,0.02)",
        border: `1px solid ${avail ? "rgba(34,197,94,0.13)" : "rgba(255,255,255,0.055)"}`,
      }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.75)" }}>
          T{table.table_number}
        </span>
        <div
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: avail ? "#22c55e" : "#ef4444", opacity: 0.8 }}
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 text-[11px]" style={{ color: "rgba(255,255,255,0.22)" }}>
          <Users className="w-2.5 h-2.5" />{table.capacity}
        </span>
        {avail ? (
          <span className="text-[10px] font-semibold" style={{ color: "rgba(34,197,94,0.45)" }}>Open</span>
        ) : (
          <button
            onClick={onClear}
            className="text-[10px] font-medium transition-colors hover:text-white/60"
            style={{ color: "rgba(255,255,255,0.22)" }}
          >
            Clear
          </button>
        )}
      </div>
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
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div
        className="relative w-full sm:w-[400px] rounded-t-3xl sm:rounded-2xl p-6"
        style={{ background: "#0f0f0f", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div className="sm:hidden w-8 h-[3px] rounded-full bg-white/10 mx-auto mb-6" />

        <div className="flex items-center justify-between mb-7">
          <span className="text-xs font-black tracking-[0.2em] uppercase" style={{ color: "rgba(255,255,255,0.9)" }}>
            Add Guest
          </span>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/8 transition-colors"
            style={{ color: "rgba(255,255,255,0.25)" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-[10px] font-bold tracking-[0.18em] uppercase mb-3" style={{ color: "rgba(255,255,255,0.25)" }}>
          Party Size
        </p>
        <div className="flex items-center gap-6 mb-7">
          <button
            onClick={() => setPartySize(p => Math.max(1, p - 1))}
            className="w-10 h-10 rounded-full flex items-center justify-center text-lg hover:bg-white/8 transition-colors"
            style={{ border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.35)" }}
          >
            −
          </button>
          <span className="text-5xl font-extralight text-white w-12 text-center tabular-nums">{partySize}</span>
          <button
            onClick={() => setPartySize(p => Math.min(20, p + 1))}
            className="w-10 h-10 rounded-full flex items-center justify-center text-lg hover:bg-white/8 transition-colors"
            style={{ border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.35)" }}
          >
            +
          </button>
        </div>

        <p className="text-[10px] font-bold tracking-[0.18em] uppercase mb-2" style={{ color: "rgba(255,255,255,0.25)" }}>
          Name
        </p>
        <input
          type="text" value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && submit()}
          placeholder="Guest name" autoFocus
          className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/20 outline-none mb-4"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
        />

        <p className="text-[10px] font-bold tracking-[0.18em] uppercase mb-2" style={{ color: "rgba(255,255,255,0.25)" }}>
          Phone{" "}
          <span style={{ color: "rgba(255,255,255,0.13)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
            (optional)
          </span>
        </p>
        <input
          type="tel" value={phone} onChange={e => setPhone(e.target.value)}
          onKeyDown={e => e.key === "Enter" && submit()}
          placeholder="(555) 000-0000"
          className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/20 outline-none mb-6"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
        />

        {error && <p className="text-xs text-red-400 mb-4 text-center">{error}</p>}

        <button
          onClick={submit} disabled={loading}
          className="w-full py-3.5 rounded-xl text-xs font-black tracking-[0.15em] uppercase transition-all active:scale-[0.98] disabled:opacity-40"
          style={{ background: loading ? "rgba(255,255,255,0.08)" : "white", color: "#080808" }}
        >
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
    <div className="flex flex-col w-full" style={{ height: "100dvh", overflow: "hidden", background: "#080808" }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header
        className="flex items-center justify-between px-5 h-12 shrink-0"
        style={{
          background: "rgba(5,5,5,0.98)",
          borderBottom: "1px solid rgba(255,255,255,0.055)",
          backdropFilter: "blur(20px)",
        }}
      >
        {/* Left: HOST + stats */}
        <div className="flex items-center gap-3.5 min-w-0 flex-1 overflow-hidden">

          {/* HOST wordmark */}
          <span
            className="text-[11px] font-black shrink-0"
            style={{ color: "white", letterSpacing: "0.32em" }}
          >
            HOST
          </span>

          <div className="w-px h-3.5 shrink-0" style={{ background: "rgba(255,255,255,0.08)" }} />

          {/* Stat chips */}
          <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">

            {/* Tables */}
            <div
              className="flex items-center gap-1 px-2 py-1 rounded-lg shrink-0"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.055)" }}
            >
              <span
                className="text-xs font-bold tabular-nums"
                style={{ color: available > 0 ? "#22c55e" : "#ef4444" }}
              >
                {available}
              </span>
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.18)" }}>/{tables.length}</span>
              <span className="text-[10px] ml-0.5" style={{ color: "rgba(255,255,255,0.22)" }}>free</span>
            </div>

            {/* Waiting */}
            <div
              className="flex items-center gap-1 px-2 py-1 rounded-lg shrink-0"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.055)" }}
            >
              <span
                className="text-xs font-bold tabular-nums"
                style={{ color: waitingList.length > 0 ? "#f59e0b" : "rgba(255,255,255,0.3)" }}
              >
                {waitingList.length}
              </span>
              <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.22)" }}>waiting</span>
            </div>

            {/* Ready pulse */}
            {readyList.length > 0 && (
              <div
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg shrink-0 animate-pulse"
                style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.18)" }}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                <span className="text-xs font-bold" style={{ color: "#22c55e" }}>
                  {readyList.length} ready
                </span>
              </div>
            )}

            {/* Avg wait — desktop only */}
            {avgWait > 0 && (
              <div
                className="hidden md:flex items-center gap-1 px-2 py-1 rounded-lg shrink-0"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.055)" }}
              >
                <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.22)" }}>~</span>
                <span className="text-xs font-semibold tabular-nums" style={{ color: "rgba(255,255,255,0.55)" }}>
                  {avgWait}m
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right: controls */}
        <div className="flex items-center gap-1 shrink-0">
          <Link
            href="/admin"
            className="hidden sm:flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-medium transition-colors hover:bg-white/8"
            style={{ color: "rgba(255,255,255,0.25)" }}
          >
            <LayoutDashboard className="w-3 h-3" /> Admin
          </Link>
          <div
            className="h-7 w-7 flex items-center justify-center"
            style={{ color: online ? "rgba(34,197,94,0.6)" : "rgba(239,68,68,0.6)" }}
          >
            {online ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
          </div>
          <button
            onClick={refreshAll}
            className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-white/8 transition-colors"
            style={{ color: "rgba(255,255,255,0.22)" }}
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Queue ──────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">

          {/* Ready section */}
          {readyList.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-2.5 px-1">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span
                  className="text-[10px] font-black tracking-[0.16em] uppercase"
                  style={{ color: "rgba(34,197,94,0.65)" }}
                >
                  Ready to Seat · {readyList.length}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {readyList.map(e => (
                  <QueueRow key={e.id} entry={e}
                    onSeat={() => seat(e.id)} onNotify={() => notify(e.id)} onRemove={() => remove(e.id)} />
                ))}
              </div>
            </section>
          )}

          {/* Waiting section */}
          <section>
            <div className="flex items-center gap-2 mb-2.5 px-1">
              {waitingList.length > 0 && (
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#f59e0b", opacity: 0.7 }} />
              )}
              <span
                className="text-[10px] font-black tracking-[0.16em] uppercase"
                style={{ color: "rgba(255,255,255,0.22)" }}
              >
                {waitingList.length > 0 ? `Waiting · ${waitingList.length}` : "Queue"}
              </span>
            </div>

            {queue.length === 0 ? (
              <div
                className="rounded-xl flex flex-col items-center justify-center py-20 gap-3"
                style={{ border: "1px solid rgba(255,255,255,0.045)" }}
              >
                <CheckCircle2 className="w-8 h-8" style={{ color: "rgba(255,255,255,0.07)" }} />
                <p className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.14)" }}>
                  Queue is clear
                </p>
              </div>
            ) : waitingList.length === 0 ? (
              <div
                className="rounded-xl flex items-center justify-center py-10"
                style={{ border: "1px solid rgba(255,255,255,0.045)" }}
              >
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.14)" }}>No one else waiting</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {waitingList.map(e => (
                  <QueueRow key={e.id} entry={e}
                    onSeat={() => seat(e.id)} onNotify={() => notify(e.id)} onRemove={() => remove(e.id)} />
                ))}
              </div>
            )}
          </section>

          <p className="text-[10px] pb-24 px-1" style={{ color: "rgba(255,255,255,0.07)" }}>
            Updated {lastSync.toLocaleTimeString()}
          </p>
        </div>

        {/* ── Tables sidebar ─────────────────────────────────────────── */}
        <div
          className="hidden lg:flex flex-col w-52 shrink-0 overflow-y-auto p-4 gap-3"
          style={{
            borderLeft: "1px solid rgba(255,255,255,0.05)",
            background: "#060606",
          }}
        >
          <div className="flex items-center justify-between px-0.5 mb-1">
            <span
              className="text-[10px] font-black tracking-[0.16em] uppercase flex items-center gap-1.5"
              style={{ color: "rgba(255,255,255,0.22)" }}
            >
              <TableProperties className="w-3 h-3" /> Tables
            </span>
            <span
              className="text-xs font-bold tabular-nums"
              style={{ color: available > 0 ? "rgba(34,197,94,0.6)" : "rgba(239,68,68,0.6)" }}
            >
              {available}/{tables.length}
            </span>
          </div>

          {tables.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.18)" }}>No tables yet.</p>
              <button
                onClick={() => fetch(`${API}/setup`, { method: "POST" }).then(refreshAll)}
                className="text-xs px-3 py-2 rounded-lg font-semibold transition-colors hover:brightness-125"
                style={{ background: "rgba(34,197,94,0.1)", color: "rgba(34,197,94,0.65)" }}
              >
                Run Setup
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {tables.map(t => <TableChip key={t.id} table={t} onClear={() => clear(t.id)} />)}
            </div>
          )}
        </div>
      </div>

      {/* ── Add Guest FAB ──────────────────────────────────────────────── */}
      <button
        onClick={() => setShowAdd(true)}
        className="fixed bottom-6 right-6 flex items-center gap-2 h-11 px-5 rounded-full text-xs font-black tracking-[0.1em] uppercase shadow-2xl transition-all active:scale-95 hover:scale-[1.03] z-30"
        style={{ background: "white", color: "#080808", boxShadow: "0 4px 24px rgba(0,0,0,0.8)" }}
      >
        <Plus className="w-3.5 h-3.5" /> Add Guest
      </button>

      {showAdd && <AddGuestDrawer onClose={() => setShowAdd(false)} onAdded={refreshAll} />}
    </div>
  )
}
