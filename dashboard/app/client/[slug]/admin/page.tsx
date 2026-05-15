"use client"

import { useState, useEffect, useCallback, Suspense } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  RefreshCw, Wifi, WifiOff, Users, Clock, CheckCircle2, BarChart2, ChevronLeft,
} from "lucide-react"

const API = "https://restaurant-brain-production.up.railway.app"

// ── Color system (dark — matches HOST globals.css) ────────────────────────────
const C = {
  bg:        "#050709",
  surface:   "#0c0f12",
  surface2:  "#111518",
  border:    "rgba(255,190,110,0.16)",
  text:      "rgba(255,248,240,0.96)",
  text2:     "rgba(255,220,180,0.70)",
  muted:     "rgba(255,220,180,0.42)",
  green:     "#22c55e",
  greenBg:   "rgba(34,197,94,0.10)",
  greenBdr:  "rgba(34,197,94,0.28)",
  orange:    "#f97316",
  orangeBg:  "rgba(249,115,22,0.10)",
  orangeBdr: "rgba(249,115,22,0.28)",
  red:       "#ef4444",
  redBg:     "rgba(239,68,68,0.10)",
  redBdr:    "rgba(239,68,68,0.28)",
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface QueueEntry {
  id: string
  name: string
  party_size: number
  status: "waiting" | "ready" | "seated" | "removed"
  arrival_time: string
  quoted_wait: number | null
}

interface TableRow {
  id: string
  table_number: string | number
  capacity: number
  status: "available" | "occupied" | "reserved"
}

interface HistoryEntry {
  id: string
  name: string
  party_size: number
  status: "seated" | "removed"
  arrival_time: string
  quoted_wait: number | null
  updated_at?: string
}

interface Insights {
  avg_wait_estimate?: number
  parties_waiting?: number
  available_tables?: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseUTCMs(ts: string | null | undefined): number | null {
  if (!ts) return null
  const s = ts.endsWith("Z") || /[+-]\d{2}:?\d{2}$/.test(ts)
    ? ts
    : ts.replace(" ", "T") + "Z"
  const ms = new Date(s).getTime()
  return isNaN(ms) ? null : ms
}

function timeWaiting(iso: string): string {
  const diff = Math.floor((Date.now() - (parseUTCMs(iso) ?? Date.now())) / 1000)
  if (diff < 60)   return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso.endsWith("Z") ? iso : iso + "Z")
      .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
  } catch { return "—" }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon, label, value, sub, color, bg, bdr,
}: {
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>
  label: string
  value: string | number
  sub: string
  color: string
  bg: string
  bdr: string
}) {
  return (
    <div style={{
      background: bg, border: `1px solid ${bdr}`, borderRadius: 14,
      padding: "16px 18px", display: "flex", flexDirection: "column", gap: 4,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
        <Icon size={12} style={{ color, flexShrink: 0 }} />
        <span style={{ fontSize: 10, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: ".06em" }}>
          {label}
        </span>
      </div>
      <p style={{ fontSize: 30, fontWeight: 900, color, lineHeight: 1 }}>{value}</p>
      <p style={{ fontSize: 11, color, opacity: 0.55 }}>{sub}</p>
    </div>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      fontSize: 11, fontWeight: 800, letterSpacing: "0.18em",
      textTransform: "uppercase", color: C.muted, marginBottom: 12,
    }}>
      {children}
    </h2>
  )
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`,
      borderRadius: 16, padding: "20px 22px", ...style,
    }}>
      {children}
    </div>
  )
}

// ── Queue section ─────────────────────────────────────────────────────────────

function QueueSection({ queue }: { queue: QueueEntry[] }) {
  const active = queue.filter(e => e.status === "waiting" || e.status === "ready")
  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <SectionHeading>Queue</SectionHeading>
        {active.length > 0 && (
          <span style={{
            fontSize: 11, fontWeight: 800, padding: "2px 10px", borderRadius: 20,
            background: C.orangeBg, color: C.orange, border: `1px solid ${C.orangeBdr}`,
          }}>
            {active.length} waiting
          </span>
        )}
      </div>
      {active.length === 0 ? (
        <p style={{ fontSize: 13, color: C.muted, fontStyle: "italic", textAlign: "center", padding: "20px 0" }}>
          No parties in queue
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {active.map((e, i) => {
            const isReady = e.status === "ready"
            return (
              <div key={e.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 14px", borderRadius: 12,
                background: isReady ? C.greenBg : C.surface2,
                border: `1px solid ${isReady ? C.greenBdr : C.border}`,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{
                    width: 24, height: 24, borderRadius: "50%",
                    background: isReady ? C.green : "rgba(255,190,110,0.20)",
                    color: isReady ? "#fff" : C.muted,
                    fontSize: 10, fontWeight: 800,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>{i + 1}</span>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{e.name || "Guest"}</p>
                    <p style={{ fontSize: 11, color: C.muted }}>
                      Party of {e.party_size} · waiting {timeWaiting(e.arrival_time)}
                      {e.quoted_wait != null ? ` · ${e.quoted_wait}m quoted` : ""}
                    </p>
                  </div>
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase",
                  color: isReady ? C.green : C.orange,
                }}>
                  {isReady ? "Ready" : "Waiting"}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

// ── Tables section ────────────────────────────────────────────────────────────

function TablesSection({ tables }: { tables: TableRow[] }) {
  // Deduplicate by table_number, preferring occupied rows
  const byNumber = new Map<number, TableRow>()
  for (const t of tables) {
    const num = Number(t.table_number)
    const existing = byNumber.get(num)
    if (!existing || t.status === "occupied") byNumber.set(num, t)
  }
  const deduped = Array.from(byNumber.values()).sort((a, b) => Number(a.table_number) - Number(b.table_number))

  const available = deduped.filter(t => t.status === "available").length
  const occupied  = deduped.filter(t => t.status !== "available").length

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <SectionHeading>Tables</SectionHeading>
        <div style={{ display: "flex", gap: 8 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 20,
            background: C.greenBg, color: C.green, border: `1px solid ${C.greenBdr}`,
          }}>{available} open</span>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 20,
            background: C.redBg, color: C.red, border: `1px solid ${C.redBdr}`,
          }}>{occupied} seated</span>
        </div>
      </div>
      {deduped.length === 0 ? (
        <p style={{ fontSize: 13, color: C.muted, fontStyle: "italic", textAlign: "center", padding: "20px 0" }}>
          No table data
        </p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", gap: 8 }}>
          {deduped.map(t => {
            const isOcc = t.status !== "available"
            return (
              <div key={t.id} style={{
                borderRadius: 10, padding: "10px 8px",
                background: isOcc ? C.redBg : C.greenBg,
                border: `1px solid ${isOcc ? C.redBdr : C.greenBdr}`,
                display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                textAlign: "center",
              }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: isOcc ? C.red : C.green }}>
                  {t.table_number}
                </span>
                <span style={{ fontSize: 9, fontWeight: 600, color: isOcc ? C.red : C.green, opacity: 0.7, textTransform: "uppercase", letterSpacing: ".04em" }}>
                  {t.capacity}p
                </span>
                <span style={{ fontSize: 8, fontWeight: 700, color: isOcc ? C.red : C.green, opacity: 0.55, textTransform: "uppercase", letterSpacing: ".04em" }}>
                  {isOcc ? "Seated" : "Open"}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

// ── History section ───────────────────────────────────────────────────────────

function HistorySection({ history }: { history: HistoryEntry[] }) {
  const seated  = history.filter(e => e.status === "seated")
  const removed = history.filter(e => e.status === "removed")

  const sorted = [...history].sort((a, b) => {
    const ta = parseUTCMs(a.updated_at ?? a.arrival_time) ?? 0
    const tb = parseUTCMs(b.updated_at ?? b.arrival_time) ?? 0
    return tb - ta
  })

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <SectionHeading>History (Today)</SectionHeading>
        <div style={{ display: "flex", gap: 8 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 20,
            background: C.greenBg, color: C.green, border: `1px solid ${C.greenBdr}`,
          }}>{seated.length} seated</span>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 20,
            background: C.surface2, color: C.muted, border: `1px solid ${C.border}`,
          }}>{removed.length} removed</span>
        </div>
      </div>
      {sorted.length === 0 ? (
        <p style={{ fontSize: 13, color: C.muted, fontStyle: "italic", textAlign: "center", padding: "20px 0" }}>
          No history yet today
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {["Status", "Name", "Party", "Arrived", "Quoted"].map(h => (
                  <th key={h} style={{
                    padding: "6px 10px", textAlign: "left",
                    fontSize: 9, fontWeight: 800, color: C.muted,
                    textTransform: "uppercase", letterSpacing: "0.10em", whiteSpace: "nowrap",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((e, i) => {
                const isSeated = e.status === "seated"
                return (
                  <tr key={e.id} style={{
                    borderBottom: `1px solid ${C.border}`,
                    background: i % 2 === 0 ? "transparent" : C.surface2,
                  }}>
                    <td style={{ padding: "9px 10px", whiteSpace: "nowrap" }}>
                      <span style={{
                        fontSize: 9, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase",
                        padding: "2px 7px", borderRadius: 6,
                        background: isSeated ? C.greenBg : C.redBg,
                        color: isSeated ? C.green : C.red,
                        border: `1px solid ${isSeated ? C.greenBdr : C.redBdr}`,
                      }}>
                        {isSeated ? "Seated" : "Removed"}
                      </span>
                    </td>
                    <td style={{ padding: "9px 10px", fontWeight: 600, color: C.text, whiteSpace: "nowrap" }}>
                      {e.name || "Guest"}
                    </td>
                    <td style={{ padding: "9px 10px", color: C.text2, textAlign: "center" }}>
                      {e.party_size}
                    </td>
                    <td style={{ padding: "9px 10px", color: C.text2, whiteSpace: "nowrap" }}>
                      {fmtTime(e.arrival_time)}
                    </td>
                    <td style={{ padding: "9px 10px", color: C.text2, whiteSpace: "nowrap" }}>
                      {e.quoted_wait != null ? `${e.quoted_wait}m` : <span style={{ color: C.muted }}>—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

// ── Main inner component ──────────────────────────────────────────────────────

function ClientAdminInner() {
  const params = useParams()
  const slug   = (params?.slug as string) || ""

  const [rid,      setRid]      = useState("")
  const [ridError, setRidError] = useState(false)
  const [restName, setRestName] = useState("")
  const [adminPin, setAdminPin] = useState("")
  const [pinOk,    setPinOk]    = useState(false)
  const [pinInput, setPinInput] = useState("")
  const [pinErr,   setPinErr]   = useState(false)
  const [activeTab, setActiveTab] = useState<"overview" | "logins">("overview")
  const [online,   setOnline]   = useState(true)
  const [lastSync, setLastSync] = useState<Date | null>(null)

  const [queue,    setQueue]    = useState<QueueEntry[]>([])
  const [tables,   setTables]   = useState<TableRow[]>([])
  const [history,  setHistory]  = useState<HistoryEntry[]>([])
  const [insights, setInsights] = useState<Insights>({})

  // Step 1: resolve slug → restaurant_id
  useEffect(() => {
    if (!slug) return
    fetch(`${API}/client/${encodeURIComponent(slug)}/config`, { cache: "no-store" })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.restaurant_id) {
          setRid(d.restaurant_id)
          setRidError(false)
          if (d.guest_config?.restaurantName) setRestName(d.guest_config.restaurantName)
          if (d.guest_config?.adminPin) {
            setAdminPin(String(d.guest_config.adminPin))
            try { setPinOk(localStorage.getItem(`${slug}:adminPinOk`) === "1") } catch {}
          } else {
            setPinOk(true) // no PIN configured → open
          }
        } else {
          setRidError(true)
        }
      })
      .catch(() => setRidError(true))
  }, [slug])

  // Step 2: fetch all data using rid
  const fetchAll = useCallback(async () => {
    if (!rid) return
    try {
      const [qRes, tRes, hRes, iRes] = await Promise.all([
        fetch(`${API}/queue?restaurant_id=${rid}`),
        fetch(`${API}/tables?restaurant_id=${rid}`),
        fetch(`${API}/queue/history?restaurant_id=${rid}`),
        fetch(`${API}/insights?restaurant_id=${rid}`),
      ])

      if (qRes.ok) setQueue(await qRes.json())
      if (tRes.ok) setTables(await tRes.json())
      if (hRes.ok) {
        const all: HistoryEntry[] = await hRes.json()
        // Filter to today (business day starts 3am)
        const now = new Date()
        if (now.getHours() < 3) now.setDate(now.getDate() - 1)
        const todayStr = now.toLocaleDateString("en-CA")
        setHistory(all.filter(e => {
          try {
            const d = new Date(parseUTCMs(e.arrival_time) ?? 0)
            if (d.getHours() < 3) d.setDate(d.getDate() - 1)
            return d.toLocaleDateString("en-CA") === todayStr
          } catch { return false }
        }))
      }
      if (iRes.ok) setInsights(await iRes.json())

      setOnline(true)
      setLastSync(new Date())
    } catch {
      setOnline(false)
    }
  }, [rid])

  // Initial fetch + 30-second auto-refresh
  useEffect(() => {
    if (!rid) return
    fetchAll()
    const t = setInterval(fetchAll, 30_000)
    return () => clearInterval(t)
  }, [rid, fetchAll])

  // ── Derived stats ──────────────────────────────────────────────────────────

  // Deduplicated tables for stats
  const deduped = (() => {
    const m = new Map<number, TableRow>()
    for (const t of tables) {
      const num = Number(t.table_number)
      const existing = m.get(num)
      if (!existing || t.status === "occupied") m.set(num, t)
    }
    return Array.from(m.values())
  })()

  const availableTables  = deduped.filter(t => t.status === "available").length
  const occupiedTables   = deduped.filter(t => t.status !== "available").length
  const waitingParties   = queue.filter(e => e.status === "waiting" || e.status === "ready").length
  const avgWait          = insights.avg_wait_estimate ?? 0

  // ── Loading / error states ─────────────────────────────────────────────────

  const containerStyle: React.CSSProperties = {
    minHeight: "100dvh",
    background: C.bg,
    color: C.text,
    fontFamily: "var(--font-geist, var(--font-sans), system-ui, sans-serif)",
  }

  if (ridError) {
    return (
      <div style={{ ...containerStyle, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", maxWidth: 360, padding: 32 }}>
          <p style={{ fontSize: 32, marginBottom: 12 }}>🔍</p>
          <p style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 8 }}>
            Restaurant not found
          </p>
          <p style={{ fontSize: 13, color: C.muted, marginBottom: 24, lineHeight: 1.6 }}>
            Could not find a restaurant for <strong style={{ color: C.text2 }}>&ldquo;{slug}&rdquo;</strong>.
            Check the URL and try again.
          </p>
          <Link href={`/client/${slug}/station`} style={{
            fontSize: 13, color: C.text2, textDecoration: "none",
            padding: "8px 16px", borderRadius: 10,
            border: `1px solid ${C.border}`,
            display: "inline-flex", alignItems: "center", gap: 6,
          }}>
            <ChevronLeft size={14} /> Back to station
          </Link>
        </div>
      </div>
    )
  }

  if (!rid) {
    return (
      <div style={{ ...containerStyle, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", padding: 32 }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            border: `3px solid ${C.border}`,
            borderTopColor: C.orange,
            margin: "0 auto 16px",
            animation: "spin 0.8s linear infinite",
          }} />
          <p style={{ fontSize: 13, color: C.muted }}>Loading restaurant…</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    )
  }

  // ── PIN gate ───────────────────────────────────────────────────────────────
  function tryPin() {
    if (pinInput === adminPin) {
      setPinOk(true)
      try { localStorage.setItem(`${slug}:adminPinOk`, "1") } catch {}
    } else {
      setPinErr(true)
      setPinInput("")
    }
  }

  if (adminPin && !pinOk) return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg }}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, padding: "44px 52px", textAlign: "center", width: 340 }}>
        <div style={{ fontSize: 30, marginBottom: 10 }}>🔒</div>
        <div style={{ fontSize: 17, fontWeight: 800, color: C.text, marginBottom: 4 }}>{restName || slug}</div>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 28 }}>Enter your admin PIN to continue</div>
        <input
          type="password" inputMode="numeric" placeholder="PIN"
          value={pinInput}
          onChange={e => { setPinInput(e.target.value); setPinErr(false) }}
          onKeyDown={e => e.key === "Enter" && tryPin()}
          style={{ width: "100%", padding: "13px 18px", borderRadius: 12, border: `1px solid ${pinErr ? C.red : C.border}`, background: C.surface2, color: C.text, fontSize: 22, textAlign: "center", outline: "none", letterSpacing: "0.35em", boxSizing: "border-box" }}
          autoFocus
        />
        {pinErr && <div style={{ color: C.red, fontSize: 12, marginTop: 8 }}>Incorrect PIN</div>}
        <button onClick={tryPin}
          style={{ marginTop: 18, width: "100%", padding: "13px 0", borderRadius: 12, background: C.green, color: "#fff", border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
          Unlock Admin
        </button>
        <Link href={`/client/${slug}/station`} style={{ display: "block", marginTop: 16, fontSize: 12, color: C.muted, textDecoration: "none" }}>
          ← Back to Station
        </Link>
      </div>
    </div>
  )

  // ── Full dashboard ─────────────────────────────────────────────────────────

  return (
    <div style={containerStyle}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{
        background: C.surface, borderBottom: `1px solid ${C.border}`,
        padding: "0 24px", height: 56,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 40,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link href={`/client/${slug}/station`} style={{
            display: "flex", alignItems: "center", gap: 4,
            fontSize: 12, fontWeight: 600, color: C.muted,
            textDecoration: "none", padding: "5px 10px",
            borderRadius: 8, border: `1px solid ${C.border}`,
          }}>
            <ChevronLeft size={13} /> Station
          </Link>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: C.text, lineHeight: 1.2 }}>
              {restName || slug}
            </p>
            <p style={{ fontSize: 10, color: C.muted, letterSpacing: "0.10em", textTransform: "uppercase" }}>
              Admin Dashboard
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Tabs */}
          {(["overview", "logins"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{ padding: "5px 14px", borderRadius: 8, border: `1px solid ${activeTab === tab ? C.orange : C.border}`, background: activeTab === tab ? C.orangeBg : "transparent", color: activeTab === tab ? C.orange : C.muted, fontSize: 12, fontWeight: 600, cursor: "pointer", textTransform: "capitalize" }}>
              {tab}
            </button>
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            {online ? <Wifi size={13} style={{ color: C.green }} /> : <WifiOff size={13} style={{ color: C.red }} />}
            <span style={{ fontSize: 11, fontWeight: 600, color: online ? C.green : C.red }}>{online ? "Live" : "Offline"}</span>
          </div>
          {lastSync && <span style={{ fontSize: 10, color: C.muted }}>{lastSync.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
          <button onClick={fetchAll} style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: C.muted }}>
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      {activeTab === "overview" && (
        <div style={{ padding: "24px 24px 48px", maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
            <StatCard icon={CheckCircle2} label="Tables Open" value={availableTables} sub={`of ${deduped.length} total`} color={C.green} bg={C.greenBg} bdr={C.greenBdr} />
            <StatCard icon={Users} label="Tables Seated" value={occupiedTables} sub={deduped.length > 0 ? `${Math.round(occupiedTables/deduped.length*100)}% occupancy` : "—"} color={occupiedTables > 0 ? C.red : C.muted} bg={occupiedTables > 0 ? C.redBg : C.surface2} bdr={occupiedTables > 0 ? C.redBdr : C.border} />
            <StatCard icon={Clock} label="Parties Waiting" value={waitingParties} sub={waitingParties === 0 ? "no queue" : `${waitingParties} part${waitingParties === 1 ? "y" : "ies"}`} color={waitingParties > 0 ? C.orange : C.green} bg={waitingParties > 0 ? C.orangeBg : C.greenBg} bdr={waitingParties > 0 ? C.orangeBdr : C.greenBdr} />
            <StatCard icon={BarChart2} label="Avg Wait" value={avgWait > 0 ? `${Math.round(avgWait)}m` : "—"} sub="estimated" color={avgWait > 20 ? C.red : avgWait > 0 ? C.orange : C.muted} bg={avgWait > 20 ? C.redBg : avgWait > 0 ? C.orangeBg : C.surface2} bdr={avgWait > 20 ? C.redBdr : avgWait > 0 ? C.orangeBdr : C.border} />
          </div>
          <div style={{ marginBottom: 20 }}><QueueSection queue={queue} /></div>
          <div style={{ marginBottom: 20 }}><TablesSection tables={tables} /></div>
          <div style={{ marginBottom: 20 }}><HistorySection history={history} /></div>
        </div>
      )}

      {activeTab === "logins" && (
        <LoginsTab slug={slug} adminPin={adminPin} onPinChanged={newPin => {
          setAdminPin(newPin)
          try { if (!newPin) localStorage.removeItem(`${slug}:adminPinOk`); else localStorage.setItem(`${slug}:adminPinOk`, "1") } catch {}
        }} />
      )}
    </div>
  )
}

// ── Logins Tab ────────────────────────────────────────────────────────────────

function LoginsTab({ slug, adminPin, onPinChanged }: {
  slug: string
  adminPin: string
  onPinChanged: (newPin: string) => void
}) {
  const [showPin,    setShowPin]    = useState(false)
  const [newPin,     setNewPin]     = useState("")
  const [confirmPin, setConfirmPin] = useState("")
  const [saving,     setSaving]     = useState(false)
  const [saveMsg,    setSaveMsg]    = useState<{ ok: boolean; text: string } | null>(null)

  async function changePin() {
    if (!newPin) { setSaveMsg({ ok: false, text: "New PIN cannot be empty" }); return }
    if (newPin !== confirmPin) { setSaveMsg({ ok: false, text: "PINs don't match" }); return }
    setSaving(true); setSaveMsg(null)
    try {
      const r = await fetch(`${API}/client/${encodeURIComponent(slug)}/admin/pin`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_pin: adminPin, new_pin: newPin }),
      })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        throw new Error(d.detail || "Failed to save")
      }
      onPinChanged(newPin)
      setNewPin(""); setConfirmPin("")
      setSaveMsg({ ok: true, text: "PIN updated successfully" })
    } catch (e: unknown) {
      setSaveMsg({ ok: false, text: e instanceof Error ? e.message : "Could not save PIN" })
    }
    setSaving(false)
    setTimeout(() => setSaveMsg(null), 4000)
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "11px 14px", borderRadius: 10,
    border: `1px solid ${C.border}`, background: C.surface2,
    color: C.text, fontSize: 14, outline: "none",
    boxSizing: "border-box", letterSpacing: newPin ? "0.25em" : "normal",
  }

  return (
    <div style={{ padding: "28px 24px 48px", maxWidth: 560, margin: "0 auto" }}>

      {/* Current PIN */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 22px", marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: C.muted, marginBottom: 14 }}>Current Admin PIN</div>
        {adminPin ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: C.text, letterSpacing: showPin ? "0.3em" : "0.1em", fontVariantNumeric: "tabular-nums" }}>
              {showPin ? adminPin : "•".repeat(adminPin.length)}
            </span>
            <button onClick={() => setShowPin(p => !p)}
              style={{ fontSize: 12, fontWeight: 600, color: C.text2, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 7, padding: "5px 12px", cursor: "pointer" }}>
              {showPin ? "Hide" : "Show"}
            </button>
          </div>
        ) : (
          <div style={{ fontSize: 14, color: C.muted, fontStyle: "italic" }}>No PIN set — admin is open</div>
        )}
      </div>

      {/* Change PIN form */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 22px" }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: C.muted, marginBottom: 16 }}>
          {adminPin ? "Change PIN" : "Set PIN"}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.text2, marginBottom: 5 }}>New PIN</div>
            <input type="password" inputMode="numeric" placeholder="Enter new PIN" value={newPin}
              onChange={e => setNewPin(e.target.value)}
              style={inputStyle} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.text2, marginBottom: 5 }}>Confirm PIN</div>
            <input type="password" inputMode="numeric" placeholder="Re-enter new PIN" value={confirmPin}
              onChange={e => setConfirmPin(e.target.value)}
              onKeyDown={e => e.key === "Enter" && changePin()}
              style={inputStyle} />
          </div>
          {saveMsg && (
            <div style={{ fontSize: 13, fontWeight: 600, color: saveMsg.ok ? C.green : C.red }}>{saveMsg.text}</div>
          )}
          <button onClick={changePin} disabled={saving}
            style={{ padding: "11px 0", borderRadius: 10, border: "none", background: saving ? C.muted : C.green, color: "#fff", fontSize: 14, fontWeight: 700, cursor: saving ? "default" : "pointer" }}>
            {saving ? "Saving…" : adminPin ? "Update PIN" : "Set PIN"}
          </button>
          {adminPin && (
            <button onClick={async () => {
              setSaving(true); setSaveMsg(null)
              try {
                const r = await fetch(`${API}/client/${encodeURIComponent(slug)}/admin/pin`, {
                  method: "PATCH", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ current_pin: adminPin, new_pin: "" }),
                })
                if (!r.ok) throw new Error()
                onPinChanged("")
                setSaveMsg({ ok: true, text: "PIN removed — admin is now open" })
              } catch { setSaveMsg({ ok: false, text: "Could not remove PIN" }) }
              setSaving(false)
            }}
              style={{ padding: "10px 0", borderRadius: 10, border: `1px solid ${C.redBdr}`, background: C.redBg, color: C.red, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Remove PIN (open admin)
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Export (wrapped in Suspense for useParams) ────────────────────────────────

export default function ClientAdminPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100dvh", background: "#050709", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "rgba(255,220,180,0.42)", fontSize: 13 }}>Loading…</p>
      </div>
    }>
      <ClientAdminInner />
    </Suspense>
  )
}
