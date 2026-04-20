"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Wifi, WifiOff, RefreshCw, Users, CheckCircle2, Clock, Delete } from "lucide-react"

const API = "https://restaurant-brain-production.up.railway.app"
const LOGO = "https://images.getbento.com/accounts/d2ce1ba3bfb5b87e1f0ba2897a682acb/media/images/28198New_Walnut_Logo.png"

const RESTAURANTS = [
  {
    key:     "original",
    name:    "The Original Walnut Cafe",
    short:   "Original",
    rid:     "0001cafe-0001-4000-8000-000000000001",
    joinUrl: "https://hostplatform.net/walnut/original/join",
    color:   "#7C5B3A",
    accent:  "rgba(124,91,58,0.15)",
    accentBorder: "rgba(124,91,58,0.40)",
  },
  {
    key:     "southside",
    name:    "The Southside Walnut Cafe",
    short:   "Southside",
    rid:     "0002cafe-0001-4000-8000-000000000002",
    joinUrl: "https://hostplatform.net/walnut/southside/join",
    color:   "#3A6B5B",
    accent:  "rgba(58,107,91,0.15)",
    accentBorder: "rgba(58,107,91,0.40)",
  },
] as const

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
  arrival_time: string
  position?: number
}

interface Insights {
  tables_total: number
  tables_available: number
  tables_occupied: number
  parties_waiting: number
  avg_wait_estimate: number
}

interface RestaurantData {
  tables:   Table[]
  queue:    QueueEntry[]
  insights: Insights | null
  online:   boolean
  lastSync: Date
}

// ── Color system ───────────────────────────────────────────────────────────────

const C = {
  bg:       "#F8FAFC",
  surface:  "#FFFFFF",
  border:   "#E2E8F0",
  text:     "#0F172A",
  text2:    "#475569",
  muted:    "#94A3B8",
  green:    "#16A34A",
  greenBg:  "#F0FDF4",
  orange:   "#D97706",
  orangeBg: "#FFFBEB",
  red:      "#DC2626",
  redBg:    "#FEF2F2",
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function TableGrid({ tables }: { tables: Table[] }) {
  const sorted = [...tables].sort((a, b) => a.table_number - b.table_number)
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {sorted.map(t => {
        const isOcc = t.status !== "available"
        return (
          <div key={t.id} title={`Table ${t.table_number} — ${t.status}`}
            style={{
              width: 38, height: 38, borderRadius: 8,
              background: isOcc ? "#FEE2E2" : "#DCFCE7",
              border: `1.5px solid ${isOcc ? "#FCA5A5" : "#86EFAC"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 700,
              color: isOcc ? C.red : C.green,
            }}>
            {t.table_number}
          </div>
        )
      })}
    </div>
  )
}

function QueueList({ queue }: { queue: QueueEntry[] }) {
  const active = queue.filter(e => e.status === "waiting" || e.status === "ready")
  if (!active.length) {
    return <p style={{ fontSize: 13, color: C.muted, fontStyle: "italic" }}>No parties waiting</p>
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {active.slice(0, 8).map((e, i) => {
        const isReady = e.status === "ready"
        const arrival = new Date(e.arrival_time)
        const minsAgo = Math.round((Date.now() - arrival.getTime()) / 60_000)
        return (
          <div key={e.id} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "8px 12px", borderRadius: 10,
            background: isReady ? C.greenBg : C.bg,
            border: `1px solid ${isReady ? "#BBF7D0" : C.border}`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{
                width: 22, height: 22, borderRadius: "50%",
                background: isReady ? C.green : C.muted,
                color: "#fff", fontSize: 10, fontWeight: 800,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>{i + 1}</span>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{e.name}</p>
                <p style={{ fontSize: 11, color: C.muted }}>Party of {e.party_size} · {minsAgo}m ago</p>
              </div>
            </div>
            {isReady && (
              <span style={{ fontSize: 10, fontWeight: 800, color: C.green, letterSpacing: ".06em", textTransform: "uppercase" }}>
                Ready
              </span>
            )}
          </div>
        )
      })}
      {active.length > 8 && (
        <p style={{ fontSize: 11, color: C.muted, textAlign: "center", marginTop: 2 }}>
          +{active.length - 8} more
        </p>
      )}
    </div>
  )
}

// ── PIN entry screen ───────────────────────────────────────────────────────────

function PinScreen({ onSuccess }: { onSuccess: () => void }) {
  const [digits, setDigits]   = useState<string[]>([])
  const [error,  setError]    = useState("")
  const [loading, setLoading] = useState(false)
  const [shake,  setShake]    = useState(false)

  const addDigit = useCallback((d: string) => {
    if (loading) return
    setError("")
    setDigits(prev => {
      if (prev.length >= 4) return prev
      const next = [...prev, d]
      if (next.length === 4) {
        // Auto-submit
        verifyPin(next.join(""))
      }
      return next
    })
  }, [loading]) // eslint-disable-line react-hooks/exhaustive-deps

  const backspace = useCallback(() => {
    if (loading) return
    setError("")
    setDigits(prev => prev.slice(0, -1))
  }, [loading])

  const verifyPin = useCallback(async (pin: string) => {
    setLoading(true)
    try {
      const r = await fetch("/api/walnut/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      })
      const d = await r.json()
      if (d.ok) {
        onSuccess()
      } else {
        setShake(true)
        setTimeout(() => setShake(false), 600)
        setError("Incorrect PIN")
        setDigits([])
      }
    } catch {
      setError("Connection error — try again")
      setDigits([])
    } finally {
      setLoading(false)
    }
  }, [onSuccess])

  // Keyboard support
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") addDigit(e.key)
      else if (e.key === "Backspace") backspace()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [addDigit, backspace])

  const PAD = [
    ["1","2","3"],
    ["4","5","6"],
    ["7","8","9"],
    ["","0","⌫"],
  ]

  return (
    <div style={{
      minHeight: "100dvh", background: C.bg, display: "flex", alignItems: "center",
      justifyContent: "center", fontFamily: "var(--font-geist), system-ui, -apple-system, sans-serif",
    }}>
      <div style={{
        width: "100%", maxWidth: 340, padding: "40px 32px",
        background: C.surface, borderRadius: 24, boxShadow: "0 8px 40px rgba(0,0,0,0.08)",
        border: `1px solid ${C.border}`,
        transform: shake ? "translateX(-4px)" : "none",
        transition: "transform 0.06s",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 28 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} alt="Walnut Cafe" style={{ height: 44, objectFit: "contain", marginBottom: 12 }} />
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: C.muted }}>
            Admin Dashboard
          </p>
          <p style={{ fontSize: 13, color: C.text2, marginTop: 4 }}>Enter your 4-digit PIN</p>
        </div>

        {/* PIN dots */}
        <div style={{ display: "flex", gap: 14, justifyContent: "center", marginBottom: 28 }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{
              width: 18, height: 18, borderRadius: "50%",
              background: digits.length > i ? C.text : "transparent",
              border: `2px solid ${error ? C.red : digits.length > i ? C.text : C.border}`,
              transition: "background 0.1s, border-color 0.2s",
            }} />
          ))}
        </div>

        {/* Error */}
        {error && (
          <p style={{ textAlign: "center", fontSize: 12, color: C.red, fontWeight: 600, marginBottom: 16, marginTop: -12 }}>
            {error}
          </p>
        )}

        {/* Numpad */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {PAD.flat().map((d, i) => (
            <button
              key={i}
              onClick={() => d === "⌫" ? backspace() : d ? addDigit(d) : undefined}
              disabled={loading || (!d && d !== "0")}
              style={{
                height: 64, borderRadius: 14, fontSize: d === "⌫" ? 20 : 24, fontWeight: 600,
                background: d === "⌫" ? "rgba(220,38,38,0.05)" : d ? C.bg : "transparent",
                border: d === "⌫" ? `1px solid rgba(220,38,38,0.15)` : d ? `1px solid ${C.border}` : "none",
                color: d === "⌫" ? C.red : d ? C.text : "transparent",
                cursor: d ? "pointer" : "default",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background 0.1s",
                opacity: loading ? 0.5 : 1,
              }}
            >
              {d === "⌫" ? <Delete size={18} /> : d}
            </button>
          ))}
        </div>

        {loading && (
          <p style={{ textAlign: "center", fontSize: 12, color: C.muted, marginTop: 16 }}>Verifying…</p>
        )}
      </div>
    </div>
  )
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────

export default function WalnutDashboard() {
  const [pinOk,     setPinOk]     = useState<boolean | null>(null) // null = checking
  const [activeTab, setActiveTab] = useState<0 | 1>(0)
  const [data, setData] = useState<[RestaurantData, RestaurantData]>([
    { tables: [], queue: [], insights: null, online: true, lastSync: new Date() },
    { tables: [], queue: [], insights: null, online: true, lastSync: new Date() },
  ])

  // Check PIN cookie on mount
  useEffect(() => {
    fetch("/api/walnut/check-pin")
      .then(r => r.ok ? r.json() : { ok: false })
      .then(d => setPinOk(!!d.ok))
      .catch(() => setPinOk(false))
  }, [])

  const fetchAll = useCallback(async () => {
    const results = await Promise.allSettled(
      RESTAURANTS.map(async (r, i) => {
        const [tRes, qRes, iRes] = await Promise.all([
          fetch(`${API}/tables?restaurant_id=${r.rid}`),
          fetch(`${API}/queue?restaurant_id=${r.rid}`),
          fetch(`${API}/insights?restaurant_id=${r.rid}`),
        ])
        const tables   = tRes.ok ? await tRes.json()   : []
        const queue    = qRes.ok ? await qRes.json()   : []
        const insights = iRes.ok ? await iRes.json()   : null
        return { index: i, tables, queue, insights }
      })
    )

    setData(prev => {
      const next: [RestaurantData, RestaurantData] = [{ ...prev[0] }, { ...prev[1] }]
      results.forEach((r, i) => {
        if (r.status === "fulfilled") {
          const { tables, queue, insights } = r.value
          next[i] = { tables, queue, insights, online: true, lastSync: new Date() }
        } else {
          next[i] = { ...prev[i], online: false }
        }
      })
      return next
    })
  }, [])

  useEffect(() => {
    if (!pinOk) return
    fetchAll()
    const t = setInterval(fetchAll, 10_000)
    return () => clearInterval(t)
  }, [pinOk, fetchAll])

  // ── Loading / PIN gate ─────────────────────────────────────────────────────
  if (pinOk === null) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 13, color: C.muted }}>Loading…</div>
      </div>
    )
  }

  if (!pinOk) {
    return <PinScreen onSuccess={() => setPinOk(true)} />
  }

  // ── Dashboard ──────────────────────────────────────────────────────────────
  const restaurant = RESTAURANTS[activeTab]
  const d          = data[activeTab]
  const available  = d.insights?.tables_available ?? d.tables.filter(t => t.status === "available").length
  const occupied   = d.insights?.tables_occupied  ?? d.tables.filter(t => t.status !== "available").length
  const waiting    = d.insights?.parties_waiting  ?? d.queue.filter(e => e.status === "waiting" || e.status === "ready").length
  const waitMin    = d.insights?.avg_wait_estimate ?? null

  return (
    <div style={{
      minHeight: "100vh", background: C.bg,
      fontFamily: "var(--font-geist), system-ui, -apple-system, sans-serif",
      color: C.text,
    }}>

      {/* ── Top bar ── */}
      <div style={{
        background: C.surface, borderBottom: `1px solid ${C.border}`,
        padding: "0 28px", display: "flex", alignItems: "center",
        justifyContent: "space-between", height: 60,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} alt="Walnut Cafe" style={{ height: 32, objectFit: "contain" }} />
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: C.text, lineHeight: 1.2 }}>The Walnut Cafe</p>
            <p style={{ fontSize: 10, color: C.muted }}>Admin Dashboard</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link href="/walnut/logins"
            style={{ fontSize: 12, fontWeight: 600, color: C.text2, padding: "7px 14px", borderRadius: 8, border: `1px solid ${C.border}`, textDecoration: "none", background: "transparent" }}>
            Logins
          </Link>
          <Link href="/walnut/station"
            style={{ fontSize: 12, fontWeight: 600, color: C.text2, padding: "7px 14px", borderRadius: 8, border: `1px solid ${C.border}`, textDecoration: "none", background: "transparent" }}>
            Station →
          </Link>
          <button onClick={fetchAll}
            style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: C.muted }}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* ── Summary cards (both restaurants) ── */}
      <div style={{ padding: "24px 28px 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {RESTAURANTS.map((r, i) => {
          const rd   = data[i]
          const avl  = rd.insights?.tables_available ?? rd.tables.filter(t => t.status === "available").length
          const occ  = rd.insights?.tables_occupied  ?? rd.tables.filter(t => t.status !== "available").length
          const wt   = rd.insights?.parties_waiting  ?? rd.queue.filter(e => e.status === "waiting" || e.status === "ready").length
          const isActive = activeTab === i
          return (
            <button key={r.key} onClick={() => setActiveTab(i as 0 | 1)}
              style={{
                all: "unset", cursor: "pointer", display: "block",
                background: C.surface,
                border: `2px solid ${isActive ? r.color : C.border}`,
                borderRadius: 16, padding: "18px 20px",
                boxShadow: isActive ? `0 0 0 3px ${r.color}22` : "none",
                transition: "border-color .15s, box-shadow .15s",
              }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
                <div>
                  <p style={{ fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: C.muted, marginBottom: 3 }}>
                    {r.short}
                  </p>
                  <p style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{r.name}</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  {rd.online
                    ? <Wifi size={13} style={{ color: C.green }} />
                    : <WifiOff size={13} style={{ color: C.red }} />
                  }
                  <span style={{ fontSize: 10, color: rd.online ? C.green : C.red, fontWeight: 600 }}>
                    {rd.online ? "Live" : "Offline"}
                  </span>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div style={{ background: C.greenBg, borderRadius: 10, padding: "10px 12px", border: "1px solid #BBF7D0" }}>
                  <p style={{ fontSize: 10, color: C.green, fontWeight: 700, marginBottom: 3, letterSpacing: ".04em" }}>AVAIL.</p>
                  <p style={{ fontSize: 22, fontWeight: 800, color: C.green }}>{avl}</p>
                </div>
                <div style={{ background: "#FEF2F2", borderRadius: 10, padding: "10px 12px", border: "1px solid #FECACA" }}>
                  <p style={{ fontSize: 10, color: C.red, fontWeight: 700, marginBottom: 3, letterSpacing: ".04em" }}>OCC.</p>
                  <p style={{ fontSize: 22, fontWeight: 800, color: C.red }}>{occ}</p>
                </div>
                <div style={{ background: C.orangeBg, borderRadius: 10, padding: "10px 12px", border: "1px solid #FDE68A" }}>
                  <p style={{ fontSize: 10, color: C.orange, fontWeight: 700, marginBottom: 3, letterSpacing: ".04em" }}>WAIT</p>
                  <p style={{ fontSize: 22, fontWeight: 800, color: C.orange }}>{wt}</p>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* ── Detailed view for selected restaurant ── */}
      <div style={{ padding: "20px 28px 40px" }}>

        {/* Section header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 4, height: 20, borderRadius: 2, background: restaurant.color }} />
            <h2 style={{ fontSize: 17, fontWeight: 800, color: C.text }}>{restaurant.name}</h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {waitMin && waitMin > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: C.orange }}>
                <Clock size={13} />
                ~{waitMin}m avg wait
              </div>
            )}
            <span style={{ fontSize: 11, color: C.muted }}>
              Last sync {d.lastSync.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        </div>

        {/* Stat pills */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          {[
            { label: "Available", value: available, icon: CheckCircle2, color: C.green,  bg: C.greenBg,  border: "#BBF7D0" },
            { label: "Occupied",  value: occupied,  icon: Users,        color: C.red,    bg: "#FEF2F2",  border: "#FECACA" },
            { label: "Waiting",   value: waiting,   icon: Clock,        color: C.orange, bg: C.orangeBg, border: "#FDE68A" },
          ].map(({ label, value, icon: Icon, color, bg, border }) => (
            <div key={label} style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "8px 14px", borderRadius: 10, background: bg, border: `1px solid ${border}`,
            }}>
              <Icon size={14} style={{ color }} />
              <span style={{ fontSize: 13, fontWeight: 700, color }}>{value}</span>
              <span style={{ fontSize: 12, color, opacity: 0.7 }}>{label}</span>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

          {/* Tables grid */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: "20px 22px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Floor Status</h3>
              <div style={{ display: "flex", gap: 12, fontSize: 11, color: C.muted }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: "#DCFCE7", border: "1px solid #86EFAC", display: "inline-block" }} />
                  Available
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: "#FEE2E2", border: "1px solid #FCA5A5", display: "inline-block" }} />
                  Occupied
                </span>
              </div>
            </div>
            {d.tables.length > 0
              ? <TableGrid tables={d.tables} />
              : <p style={{ fontSize: 13, color: C.muted, fontStyle: "italic" }}>No table data yet</p>
            }
          </div>

          {/* Queue */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: "20px 22px" }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 14 }}>
              Waitlist
              {waiting > 0 && (
                <span style={{
                  marginLeft: 8, fontSize: 11, fontWeight: 800,
                  background: C.orange, color: "#fff",
                  padding: "2px 7px", borderRadius: 20,
                }}>
                  {waiting}
                </span>
              )}
            </h3>
            <QueueList queue={d.queue} />
          </div>
        </div>

        {/* NFC Join Links */}
        <div style={{ marginTop: 20 }}>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>
            Guest Join Links
          </h3>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {RESTAURANTS.map(r => (
              <div key={r.key} style={{
                background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 12, padding: "14px 18px",
                flex: 1, minWidth: 200,
              }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: r.color, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
                  {r.short}
                </p>
                <p style={{ fontSize: 12, color: C.text2, marginBottom: 8, wordBreak: "break-all" }}>{r.joinUrl}</p>
                <a href={r.joinUrl} target="_blank" rel="noreferrer"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    fontSize: 11, fontWeight: 600, color: r.color,
                    padding: "6px 12px", borderRadius: 8,
                    background: r.accent, border: `1px solid ${r.accentBorder}`,
                    textDecoration: "none",
                  }}>
                  Open ↗
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
