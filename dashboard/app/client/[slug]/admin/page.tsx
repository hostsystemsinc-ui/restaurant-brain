"use client"

import { useState, useEffect, useCallback, useRef, Suspense } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  RefreshCw, Wifi, WifiOff, Users, Clock, CheckCircle2, BarChart2, ChevronLeft,
} from "lucide-react"

const API = "https://restaurant-brain-production.up.railway.app"

// ── Color system (light) ──────────────────────────────────────────────────────
const C = {
  bg:        "#f5f6f8",
  surface:   "#ffffff",
  surface2:  "#f0f1f3",
  border:    "rgba(0,0,0,0.09)",
  text:      "#111827",
  text2:     "#374151",
  muted:     "#9ca3af",
  green:     "#16a34a",
  greenBg:   "rgba(22,163,74,0.08)",
  greenBdr:  "rgba(22,163,74,0.22)",
  orange:    "#ea580c",
  orangeBg:  "rgba(234,88,12,0.08)",
  orangeBdr: "rgba(234,88,12,0.22)",
  red:       "#dc2626",
  redBg:     "rgba(220,38,38,0.08)",
  redBdr:    "rgba(220,38,38,0.22)",
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

function getBusinessDateStr(): string {
  const now = new Date()
  if (now.getHours() < 3) now.setDate(now.getDate() - 1)
  return now.toLocaleDateString("en-CA")
}

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

function HistorySection({ history, onClear }: { history: HistoryEntry[]; onClear?: () => void }) {
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
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 20,
            background: C.greenBg, color: C.green, border: `1px solid ${C.greenBdr}`,
          }}>{seated.length} seated</span>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 20,
            background: C.surface2, color: C.muted, border: `1px solid ${C.border}`,
          }}>{removed.length} removed</span>
          {onClear && history.length > 0 && (
            <button onClick={onClear}
              style={{ fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20, background: C.redBg, color: C.red, border: `1px solid ${C.redBdr}`, cursor: "pointer" }}>
              Clear
            </button>
          )}
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
  const [adminPin, setAdminPin]     = useState("")
  const [pinOk,    setPinOk]        = useState(false)
  const [pinInput, setPinInput]     = useState("")
  const [pinErr,   setPinErr]       = useState(false)
  const [activeTab, setActiveTab]   = useState<"overview" | "logins" | "settings">("overview")
  const [loginsUnlocked, setLoginsUnlocked] = useState(false)
  const [loginsPinInput, setLoginsPinInput] = useState("")
  const [loginsPinErr,   setLoginsPinErr]   = useState(false)
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
            // always require PIN on every visit
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

  function clearHistory() {
    // Clear today's guest log from localStorage (same key format as station page)
    try {
      const dateStr = getBusinessDateStr()
      localStorage.removeItem(`host_${slug}_log_${dateStr}`)
    } catch {}
    setHistory([])
  }

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
            borderTopColor: C.green,
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
  const PIN_PAD = [["1","2","3"],["4","5","6"],["7","8","9"],["","0","⌫"]]

  function onPinDigit(d: string) {
    if (d === "⌫") {
      setPinInput(p => p.slice(0, -1)); setPinErr(false); return
    }
    if (pinInput.length >= 4) return
    const next = pinInput + d
    setPinInput(next); setPinErr(false)
    if (next.length === 4) {
      if (next === adminPin) {
        setPinOk(true)
      } else {
        setPinErr(true)
        setTimeout(() => { setPinInput(""); setPinErr(false) }, 600)
      }
    }
  }

  if (adminPin && !pinOk) return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: C.bg, gap: 32 }}>
      <style>{`@keyframes pinShake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}`}</style>

      <p style={{ fontSize: 15, fontWeight: 700, color: C.text2, letterSpacing: "0.04em" }}>Admin PIN</p>

      {/* Dots */}
      <div style={{ display: "flex", gap: 18, animation: pinErr ? "pinShake 0.5s ease" : "none" }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ width: 18, height: 18, borderRadius: "50%", background: pinInput.length > i ? (pinErr ? C.red : C.text) : "transparent", border: `2.5px solid ${pinInput.length > i ? (pinErr ? C.red : C.text) : C.border}`, transition: "all 0.12s" }} />
        ))}
      </div>

      {/* Numpad */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 88px)", gridTemplateRows: "repeat(4, 88px)", gap: 12 }}>
        {PIN_PAD.flat().map((d, i) => (
          <button key={i} onClick={() => d && onPinDigit(d)} disabled={!d}
            style={{ borderRadius: 20, fontSize: d === "⌫" ? 20 : 28, fontWeight: 600, background: d === "⌫" ? C.redBg : d ? C.surface : "transparent", border: d === "⌫" ? `1.5px solid ${C.redBdr}` : d ? `1.5px solid ${C.border}` : "none", color: d === "⌫" ? C.red : d ? C.text : "transparent", cursor: d ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.1s", boxShadow: d && d !== "⌫" ? "0 1px 3px rgba(0,0,0,0.06)" : "none" }}>
            {d === "⌫" ? "⌫" : d}
          </button>
        ))}
      </div>

      <Link href={`/client/${slug}/station`} style={{ fontSize: 13, color: C.muted, textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
        ← Back to restaurant
      </Link>
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
          {(["overview", "logins", "settings"] as const).map(tab => (
            <button key={tab} onClick={() => { setActiveTab(tab); if (tab !== "logins") setLoginsUnlocked(false) }}
              style={{ padding: "5px 14px", borderRadius: 8, border: `1px solid ${activeTab === tab ? C.green : C.border}`, background: activeTab === tab ? C.greenBg : "transparent", color: activeTab === tab ? C.green : C.muted, fontSize: 12, fontWeight: 600, cursor: "pointer", textTransform: "capitalize" }}>
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
          <div style={{ marginBottom: 20 }}><HistorySection history={history} onClear={clearHistory} /></div>
        </div>
      )}

      {activeTab === "logins" && !loginsUnlocked && adminPin && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 24px", gap: 32 }}>
          <style>{`@keyframes loginsShake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}`}</style>

          <p style={{ fontSize: 15, fontWeight: 700, color: C.text2, letterSpacing: "0.04em" }}>Confirm PIN to view logins</p>

          {/* Dots */}
          <div style={{ display: "flex", gap: 18, animation: loginsPinErr ? "loginsShake 0.5s ease" : "none" }}>
            {[0,1,2,3].map(i => (
              <div key={i} style={{ width: 18, height: 18, borderRadius: "50%", background: loginsPinInput.length > i ? (loginsPinErr ? C.red : C.text) : "transparent", border: `2.5px solid ${loginsPinInput.length > i ? (loginsPinErr ? C.red : C.text) : C.border}`, transition: "all 0.12s" }} />
            ))}
          </div>

          {/* Numpad */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 88px)", gridTemplateRows: "repeat(4, 88px)", gap: 12 }}>
            {PIN_PAD.flat().map((d, i) => {
              function onLoginsPinDigit(digit: string) {
                if (digit === "⌫") { setLoginsPinInput(p => p.slice(0, -1)); setLoginsPinErr(false); return }
                if (loginsPinInput.length >= 4) return
                const next = loginsPinInput + digit
                setLoginsPinInput(next); setLoginsPinErr(false)
                if (next.length === 4) {
                  if (next === adminPin) { setLoginsUnlocked(true); setLoginsPinInput("") }
                  else { setLoginsPinErr(true); setTimeout(() => { setLoginsPinInput(""); setLoginsPinErr(false) }, 600) }
                }
              }
              return (
                <button key={i} onClick={() => d && onLoginsPinDigit(d)} disabled={!d}
                  style={{ borderRadius: 20, fontSize: d === "⌫" ? 20 : 28, fontWeight: 600, background: d === "⌫" ? C.redBg : d ? C.surface : "transparent", border: d === "⌫" ? `1.5px solid ${C.redBdr}` : d ? `1.5px solid ${C.border}` : "none", color: d === "⌫" ? C.red : d ? C.text : "transparent", cursor: d ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.1s", boxShadow: d && d !== "⌫" ? "0 1px 3px rgba(0,0,0,0.06)" : "none" }}>
                  {d}
                </button>
              )
            })}
          </div>
        </div>
      )}
      {activeTab === "logins" && (loginsUnlocked || !adminPin) && (
        <LoginsTab slug={slug} rid={rid} adminPin={adminPin} onPinChanged={newPin => {
          setAdminPin(newPin)
        }} onBack={() => setActiveTab("overview")} />
      )}

      {activeTab === "settings" && (
        <SettingsTab slug={slug} rid={rid} onBack={() => setActiveTab("overview")} />
      )}
    </div>
  )
}

// ── Logins Tab ────────────────────────────────────────────────────────────────

const PIN_PAD_ROWS = [["1","2","3"],["4","5","6"],["7","8","9"],["","0","⌫"]]

function LoginsTab({ slug, rid, adminPin, onPinChanged, onBack }: {
  slug: string
  rid: string
  adminPin: string
  onPinChanged: (newPin: string) => void
  onBack?: () => void
}) {
  // PIN change via pad
  const [pinDigits,  setPinDigits]  = useState<string[]>([])
  const [pinStep,    setPinStep]    = useState<"entry" | "confirm">("entry")
  const [pinFirst,   setPinFirst]   = useState("")
  const [pinMsg,     setPinMsg]     = useState<{ ok: boolean; text: string } | null>(null)
  const [pinSaving,  setPinSaving]  = useState(false)

  // Login credential state
  const [credId,       setCredId]       = useState<string | null>(null)
  const [credPassword, setCredPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [newPassword,  setNewPassword]  = useState("")
  const [credSaving,   setCredSaving]   = useState(false)
  const [credMsg,      setCredMsg]      = useState<{ ok: boolean; text: string } | null>(null)
  const [credLoading,  setCredLoading]  = useState(true)

  useEffect(() => {
    if (!rid) return
    fetch(`/api/client/credentials?rid=${encodeURIComponent(rid)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const creds: Array<{ id: string; credential_type: string; value: string }> = d?.credentials || []
        const login = creds.find(c => c.credential_type === "login")
        if (login) {
          setCredId(login.id)
          const idx = login.value.indexOf(":")
          // Password is always the portion after the first colon
          setCredPassword(idx >= 0 ? login.value.slice(idx + 1) : login.value)
        }
      })
      .catch(() => {})
      .finally(() => setCredLoading(false))
  }, [rid])

  async function saveLoginCredential() {
    const p = newPassword.trim()
    if (!p) { setCredMsg({ ok: false, text: "Password cannot be empty" }); return }
    setCredSaving(true); setCredMsg(null)
    try {
      // Always store as "slug:password" — slug is the permanent login username
      const r = await fetch("/api/client/credentials", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rid, cred_id: credId || undefined, value: `${slug}:${p}` }),
      })
      if (!r.ok) throw new Error()
      const d = await r.json()
      if (d.id && !credId) setCredId(d.id)
      setCredPassword(p); setNewPassword("")
      setCredMsg({ ok: true, text: "Password updated — sign in with the username above" })
    } catch { setCredMsg({ ok: false, text: "Could not save password" }) }
    setCredSaving(false)
    setTimeout(() => setCredMsg(null), 4000)
  }

  async function submitPin(pin: string) {
    setPinSaving(true); setPinMsg(null)
    try {
      const r = await fetch(`${API}/client/${encodeURIComponent(slug)}/admin/pin`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_pin: adminPin, new_pin: pin }),
      })
      if (!r.ok) throw new Error()
      onPinChanged(pin)
      setPinMsg({ ok: true, text: "PIN updated" })
    } catch { setPinMsg({ ok: false, text: "Could not save PIN" }) }
    setPinSaving(false)
    setPinDigits([]); setPinStep("entry"); setPinFirst("")
    setTimeout(() => setPinMsg(null), 4000)
  }

  function onPinKey(d: string) {
    if (d === "⌫") { setPinDigits(p => p.slice(0, -1)); return }
    if (pinDigits.length >= 4) return
    const next = [...pinDigits, d]
    setPinDigits(next)
    if (next.length === 4) {
      const pin = next.join("")
      if (pinStep === "entry") { setPinFirst(pin); setPinStep("confirm"); setPinDigits([]) }
      else if (pin === pinFirst) { submitPin(pin) }
      else { setPinMsg({ ok: false, text: "PINs didn't match — try again" }); setPinDigits([]); setPinStep("entry"); setPinFirst(""); setTimeout(() => setPinMsg(null), 3000) }
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "12px 14px", borderRadius: 10,
    border: `1px solid ${C.border}`, background: C.surface2,
    color: C.text, fontSize: 14, outline: "none", boxSizing: "border-box",
  }

  return (
    <div style={{ padding: "28px 24px 48px", maxWidth: 560, margin: "0 auto" }}>

      {onBack && (
        <button onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: C.muted, background: "none", border: "none", cursor: "pointer", padding: "0 0 20px", marginLeft: -2 }}>
          <ChevronLeft size={14} /> Back to Overview
        </button>
      )}

      {/* ── Admin PIN (pad) ── */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 22px", marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: C.muted, marginBottom: 6 }}>
          {adminPin ? "Change Admin PIN" : "Set Admin PIN"}
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>
          {pinStep === "entry" ? "Enter a new 4-digit PIN:" : "Confirm your new PIN:"}
        </div>

        {/* Dots */}
        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{ width: 16, height: 16, borderRadius: "50%", background: pinDigits.length > i ? C.text : "transparent", border: `2px solid ${pinDigits.length > i ? C.text : C.border}`, transition: "background 0.1s" }} />
          ))}
        </div>

        {/* Numpad */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6, maxWidth: 290 }}>
          {PIN_PAD_ROWS.flat().map((d, i) => (
            <button key={i} onClick={() => d && onPinKey(d)} disabled={!d || pinSaving}
              style={{ height: 44, borderRadius: 10, fontSize: d === "⌫" ? 15 : 17, fontWeight: 600, background: d === "⌫" ? C.redBg : d ? C.surface2 : "transparent", border: d === "⌫" ? `1px solid ${C.redBdr}` : d ? `1px solid ${C.border}` : "none", color: d === "⌫" ? C.red : d ? C.text : "transparent", cursor: d && !pinSaving ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {d}
            </button>
          ))}
        </div>

        {pinStep === "confirm" && (
          <button onClick={() => { setPinStep("entry"); setPinDigits([]); setPinFirst("") }}
            style={{ marginTop: 10, fontSize: 12, color: C.muted, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            ← Start over
          </button>
        )}
        {pinMsg && <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: pinMsg.ok ? C.green : C.red }}>{pinMsg.text}</div>}

        {adminPin && (
          <button onClick={() => submitPin("")}
            style={{ marginTop: 14, padding: "8px 14px", borderRadius: 8, border: `1px solid ${C.redBdr}`, background: C.redBg, color: C.red, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            Remove PIN
          </button>
        )}
      </div>

      {/* ── Station Login ── */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 22px" }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: C.muted, marginBottom: 4 }}>
          Station Login
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>
          Credentials used to sign in at hostplatform.net
        </div>

        {credLoading ? (
          <div style={{ fontSize: 13, color: C.muted }}>Loading…</div>
        ) : (
          <>
            {/* Username — fixed to slug, read-only */}
            <div style={{ marginBottom: 14, padding: "10px 14px", borderRadius: 10, background: C.surface2, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: C.muted, marginBottom: 2 }}>Username (login ID)</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text, fontFamily: "monospace" }}>{slug}</div>
            </div>

            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.text2, display: "block", marginBottom: 6 }}>
                {credPassword ? "Change Password" : "Set Password"}
                {credPassword && (
                  <button onClick={() => setShowPassword(p => !p)}
                    style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: C.muted, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                    {showPassword ? "Hide" : "Show current"}
                  </button>
                )}
              </label>
              {credPassword && showPassword && (
                <div style={{ marginBottom: 8, padding: "8px 12px", borderRadius: 8, background: C.surface2, border: `1px solid ${C.border}`, fontSize: 14, fontFamily: "monospace", color: C.text, letterSpacing: "0.08em" }}>
                  {credPassword}
                </div>
              )}
              <input
                type={showPassword ? "text" : "password"}
                placeholder={credPassword ? "Enter new password" : "Set a password"}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && saveLoginCredential()}
                style={inputStyle}
                autoComplete="new-password"
              />
            </div>
            {credMsg && <div style={{ fontSize: 13, fontWeight: 600, color: credMsg.ok ? C.green : C.red, marginBottom: 8 }}>{credMsg.text}</div>}
            <button onClick={saveLoginCredential} disabled={credSaving || !newPassword.trim()}
              style={{ marginTop: 4, padding: "10px 20px", borderRadius: 10, background: newPassword.trim() ? C.green : C.surface2, color: newPassword.trim() ? "#fff" : C.muted, border: `1px solid ${newPassword.trim() ? C.green : C.border}`, fontWeight: 600, fontSize: 13, cursor: !newPassword.trim() || credSaving ? "default" : "pointer", transition: "all 0.15s", opacity: credSaving ? 0.6 : 1 }}>
              {credSaving ? "Saving…" : credPassword ? "Update Password" : "Set Password"}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── Settings Tab ─────────────────────────────────────────────────────────────

interface EditorTable {
  number: number
  shape: string
  x: number; y: number   // center, wizard coords (0-100 height-based units)
  w: number; h: number   // size, same units
  capacity: number
}

const EDITOR_W = 560
const EDITOR_H = 347  // 560 / 1.615 ≈ golden ratio

function SettingsTab({ slug, rid, onBack }: { slug: string; rid: string; onBack?: () => void }) {
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [msg,          setMsg]          = useState<{ ok: boolean; text: string } | null>(null)
  const [showCapacity, setShowCapacity] = useState(false)
  const [alertBySize,  setAlertBySize]  = useState({ small: 30, medium: 45, large: 60, xlarge: 90 })
  const [tables,       setTables]       = useState<EditorTable[]>([])
  const [canvasAspect, setCanvasAspect] = useState(1.615)
  const [selectedIdx,  setSelectedIdx]  = useState<number | null>(null)

  // Full guest_config from Railway (to merge, not overwrite)
  const fullGuestConfigRef = useRef<Record<string, unknown>>({})

  const dragRef = useRef<{
    idx: number
    startClientX: number; startClientY: number
    origX: number; origY: number
  } | null>(null)

  const canvasRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!slug) return
    fetch(`https://restaurant-brain-production.up.railway.app/client/${encodeURIComponent(slug)}/config`, { cache: "no-store" })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return
        const gc = d.guest_config ?? {}
        fullGuestConfigRef.current = gc
        setShowCapacity(!!gc.showCapacity)
        if (gc.reservationAlertBySize) {
          setAlertBySize(prev => ({ ...prev, ...gc.reservationAlertBySize }))
        } else if (gc.reservationAlertMinutes) {
          const m = Number(gc.reservationAlertMinutes) || 45
          setAlertBySize({ small: m, medium: m, large: m, xlarge: m })
        }
        const fp = d.floor_plan
        if (fp?.tables?.length) {
          const asp = fp.canvasAspect ?? 1.615
          setCanvasAspect(asp)
          setTables(fp.tables.map((t: { number?: number; shape?: string; x?: number; y?: number; w?: number; h?: number; capacity?: number }, i: number) => ({
            number:   t.number   ?? (i + 1),
            shape:    t.shape    ?? "square",
            x:        t.x        ?? 50,
            y:        t.y        ?? 50,
            w:        t.w        ?? 8,
            h:        t.h        ?? 8,
            capacity: t.capacity ?? 4,
          })))
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [slug])

  // Mouse/touch drag handlers
  useEffect(() => {
    function onMove(e: MouseEvent | TouchEvent) {
      const dr = dragRef.current
      if (!dr || !canvasRef.current) return
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY
      const dx = (clientX - dr.startClientX) / EDITOR_W * 100
      const dy = (clientY - dr.startClientY) / EDITOR_H * 100
      setTables(prev => prev.map((t, i) => {
        if (i !== dr.idx) return t
        const newX = Math.max(t.w / 2, Math.min(100 - t.w / 2, dr.origX + dx))
        const newY = Math.max(t.h / 2, Math.min(100 - t.h / 2, dr.origY + dy))
        return { ...t, x: newX, y: newY }
      }))
    }
    function onUp() { dragRef.current = null }
    document.addEventListener("mousemove", onMove)
    document.addEventListener("mouseup",   onUp)
    document.addEventListener("touchmove", onMove, { passive: true })
    document.addEventListener("touchend",  onUp)
    return () => {
      document.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseup",   onUp)
      document.removeEventListener("touchmove", onMove)
      document.removeEventListener("touchend",  onUp)
    }
  }, [])

  function startDrag(e: React.MouseEvent | React.TouchEvent, idx: number) {
    e.preventDefault()
    e.stopPropagation()
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY
    dragRef.current = { idx, startClientX: clientX, startClientY: clientY, origX: tables[idx].x, origY: tables[idx].y }
    setSelectedIdx(idx)
  }

  function addTable() {
    const maxNum = tables.reduce((m, t) => Math.max(m, t.number), 0)
    setTables(prev => [...prev, { number: maxNum + 1, shape: "square", x: 50, y: 50, w: 9, h: 9, capacity: 4 }])
    setSelectedIdx(tables.length)
  }

  function deleteTable(idx: number) {
    setTables(prev => prev.filter((_, i) => i !== idx))
    setSelectedIdx(null)
  }

  function updateTable(idx: number, patch: Partial<EditorTable>) {
    setTables(prev => prev.map((t, i) => i === idx ? { ...t, ...patch } : t))
  }

  async function saveSettings() {
    setSaving(true); setMsg(null)
    try {
      // Merge only our fields into the existing guest_config
      const mergedGc = {
        ...fullGuestConfigRef.current,
        showCapacity,
        reservationAlertBySize: alertBySize,
      }
      const floorPlan = { tables, canvasAspect }

      // Save config (guest_config + floor_plan)
      const r1 = await fetch("/api/client/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rid, guest_config: mergedGc, floor_plan: floorPlan }),
      })
      if (!r1.ok) throw new Error("config save failed")

      // Sync capacity to tables DB (table_number + capacity)
      const dbTables = tables.map(t => ({ table_number: t.number, capacity: t.capacity }))
      await fetch("/api/client/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rid, tables: dbTables }),
      })

      setMsg({ ok: true, text: "Settings saved — changes live immediately" })
    } catch {
      setMsg({ ok: false, text: "Could not save settings" })
    }
    setSaving(false)
    setTimeout(() => setMsg(null), 5000)
  }

  const sel = selectedIdx !== null ? tables[selectedIdx] : null

  if (loading) return (
    <div style={{ padding: 40, textAlign: "center", color: C.muted, fontSize: 13 }}>Loading settings…</div>
  )

  return (
    <div style={{ padding: "24px 24px 60px", maxWidth: 900, margin: "0 auto" }}>

      {onBack && (
        <button onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: C.muted, background: "none", border: "none", cursor: "pointer", padding: "0 0 20px", marginLeft: -2 }}>
          <ChevronLeft size={14} /> Back to Overview
        </button>
      )}

      {/* ── Display settings ── */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 22px", marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: C.muted, marginBottom: 16 }}>
          Display Settings
        </div>

        {/* Capacity toggle */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${C.border}` }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 2 }}>Table capacity labels</div>
            <div style={{ fontSize: 12, color: C.muted }}>Show "4P" on each table on the floor map</div>
          </div>
          <button onClick={() => setShowCapacity(p => !p)}
            style={{ width: 44, height: 24, borderRadius: 12, background: showCapacity ? C.green : C.surface2, border: `1px solid ${showCapacity ? C.greenBdr : C.border}`, position: "relative", cursor: "pointer", transition: "background 0.2s, border-color 0.2s", flexShrink: 0 }}>
            <div style={{ position: "absolute", top: 2, left: showCapacity ? 22 : 2, width: 18, height: 18, borderRadius: "50%", background: showCapacity ? "#fff" : C.muted, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
          </button>
        </div>

        {/* Reservation alert time — per party size */}
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 2 }}>Reservation alert time</div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>Minutes before a reservation when the assigned table turns yellow — set per party size</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
            {([
              { key: "small",  label: "1–2p" },
              { key: "medium", label: "3–4p" },
              { key: "large",  label: "5–6p" },
              { key: "xlarge", label: "7+p"  },
            ] as { key: keyof typeof alertBySize; label: string }[]).map(({ key, label }) => (
              <div key={key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, textAlign: "center" }}>{label}</label>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <input
                    type="number" min={5} max={240}
                    value={alertBySize[key]}
                    onChange={e => setAlertBySize(prev => ({ ...prev, [key]: Math.max(5, Math.min(240, Number(e.target.value))) }))}
                    style={{ flex: 1, padding: "7px 6px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface2, color: C.text, fontSize: 14, fontWeight: 600, textAlign: "center", outline: "none", minWidth: 0 }}
                  />
                  <span style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>m</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Table Map Editor ── */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 22px", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: C.muted }}>
            Table Map
          </div>
          <button onClick={addTable}
            style={{ padding: "5px 14px", borderRadius: 8, background: C.greenBg, border: `1px solid ${C.greenBdr}`, color: C.green, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            + Add Table
          </button>
        </div>

        <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
          {/* Canvas */}
          <div
            ref={canvasRef}
            style={{
              position: "relative",
              width: EDITOR_W,
              height: EDITOR_H,
              background: "#e8ece6",
              borderRadius: 10,
              border: `1.5px solid ${C.border}`,
              overflow: "hidden",
              flexShrink: 0,
              cursor: "default",
              touchAction: "none",
            }}
            onClick={() => setSelectedIdx(null)}
          >
            {/* Grid lines */}
            {[25, 50, 75].map(pct => (
              <div key={`h${pct}`} style={{ position: "absolute", left: 0, right: 0, top: `${pct}%`, borderTop: "1px dashed rgba(0,0,0,0.08)", pointerEvents: "none" }} />
            ))}
            {[25, 50, 75].map(pct => (
              <div key={`v${pct}`} style={{ position: "absolute", top: 0, bottom: 0, left: `${pct}%`, borderLeft: "1px dashed rgba(0,0,0,0.08)", pointerEvents: "none" }} />
            ))}

            {tables.map((t, idx) => {
              const left   = (t.x - t.w / 2) / 100 * EDITOR_W
              const top    = (t.y - t.h / 2) / 100 * EDITOR_H
              const width  = t.w / 100 * EDITOR_W
              const height = t.h / 100 * EDITOR_H
              const isSel  = idx === selectedIdx
              const borderRadius = t.shape === "round" ? "50%" : t.shape === "square" ? 8 : 6
              return (
                <div
                  key={idx}
                  onMouseDown={e => startDrag(e, idx)}
                  onTouchStart={e => startDrag(e, idx)}
                  onClick={e => { e.stopPropagation(); setSelectedIdx(idx) }}
                  style={{
                    position: "absolute", left, top, width, height,
                    borderRadius,
                    clipPath: t.shape === "round" ? "circle(50%)" : undefined,
                    background: isSel ? C.green : "#374151",
                    border: `2px solid ${isSel ? C.green : "rgba(0,0,0,0.25)"}`,
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    cursor: "grab", userSelect: "none", boxShadow: isSel ? `0 0 0 3px ${C.greenBg}` : "0 1px 4px rgba(0,0,0,0.15)",
                    transition: "background 0.1s, border-color 0.1s",
                  }}
                >
                  <span style={{ fontSize: Math.min(width, height) > 40 ? 12 : 9, fontWeight: 800, color: "#fff", lineHeight: 1 }}>
                    {t.number}
                  </span>
                  {showCapacity && width > 32 && (
                    <span style={{ fontSize: 9, color: "rgba(255,255,255,0.75)" }}>{t.capacity}p</span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Table editor panel */}
          {sel !== null && selectedIdx !== null ? (
            <div style={{ flex: 1, minWidth: 180, background: C.surface2, borderRadius: 10, padding: "14px 16px", border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 12 }}>
                Table {sel.number}
              </div>

              <label style={{ fontSize: 11, fontWeight: 600, color: C.text2, display: "block", marginBottom: 4 }}>Table #</label>
              <input type="number" min={1} max={999} value={sel.number}
                onChange={e => updateTable(selectedIdx, { number: Number(e.target.value) })}
                style={{ width: "100%", padding: "6px 10px", borderRadius: 7, border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 13, marginBottom: 10, boxSizing: "border-box", outline: "none" }} />

              <label style={{ fontSize: 11, fontWeight: 600, color: C.text2, display: "block", marginBottom: 4 }}>Shape</label>
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                {(["round", "square", "rect"] as const).map(s => (
                  <button key={s} onClick={() => updateTable(selectedIdx, { shape: s, w: s === "round" ? 8 : s === "square" ? 9 : 15, h: s === "round" ? 8 : s === "square" ? 9 : 9 })}
                    style={{ flex: 1, padding: "5px 4px", borderRadius: 6, border: `1px solid ${sel.shape === s ? C.green : C.border}`, background: sel.shape === s ? C.greenBg : "transparent", color: sel.shape === s ? C.green : C.text2, fontSize: 10, fontWeight: 600, cursor: "pointer", textTransform: "capitalize" }}>
                    {s}
                  </button>
                ))}
              </div>

              <label style={{ fontSize: 11, fontWeight: 600, color: C.text2, display: "block", marginBottom: 4 }}>Capacity</label>
              <input type="number" min={1} max={50} value={sel.capacity}
                onChange={e => updateTable(selectedIdx, { capacity: Number(e.target.value) })}
                style={{ width: "100%", padding: "6px 10px", borderRadius: 7, border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 13, marginBottom: 16, boxSizing: "border-box", outline: "none" }} />

              <button onClick={() => deleteTable(selectedIdx)}
                style={{ width: "100%", padding: "7px 0", borderRadius: 7, border: `1px solid ${C.redBdr}`, background: C.redBg, color: C.red, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                Delete Table
              </button>
            </div>
          ) : (
            <div style={{ flex: 1, minWidth: 160, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, fontSize: 12, textAlign: "center", padding: "20px 0" }}>
              Tap a table to edit · drag to reposition
            </div>
          )}
        </div>

        <div style={{ marginTop: 10, fontSize: 11, color: C.muted }}>
          {tables.length} table{tables.length !== 1 ? "s" : ""} · Drag to reposition · Select to edit shape and capacity
        </div>
      </div>

      {/* ── Save ── */}
      {msg && (
        <div style={{ marginBottom: 12, padding: "10px 16px", borderRadius: 10, background: msg.ok ? C.greenBg : C.redBg, border: `1px solid ${msg.ok ? C.greenBdr : C.redBdr}`, color: msg.ok ? C.green : C.red, fontSize: 13, fontWeight: 600 }}>
          {msg.text}
        </div>
      )}
      <button onClick={saveSettings} disabled={saving}
        style={{ padding: "12px 28px", borderRadius: 12, background: saving ? C.surface2 : C.green, color: saving ? C.muted : "#fff", border: `1px solid ${saving ? C.border : C.green}`, fontWeight: 700, fontSize: 14, cursor: saving ? "default" : "pointer", transition: "all 0.15s", opacity: saving ? 0.7 : 1 }}>
        {saving ? "Saving…" : "Save Settings"}
      </button>
    </div>
  )
}

// ── Export (wrapped in Suspense for useParams) ────────────────────────────────

export default function ClientAdminPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100dvh", background: "#f5f6f8", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#9ca3af", fontSize: 13 }}>Loading…</p>
      </div>
    }>
      <ClientAdminInner />
    </Suspense>
  )
}
