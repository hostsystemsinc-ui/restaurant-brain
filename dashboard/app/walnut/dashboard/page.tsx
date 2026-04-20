"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Wifi, WifiOff, RefreshCw, Users, CheckCircle2, Clock, Delete, LogIn, TrendingUp } from "lucide-react"

const API  = "https://restaurant-brain-production.up.railway.app"
const LOGO = "https://images.getbento.com/accounts/d2ce1ba3bfb5b87e1f0ba2897a682acb/media/images/28198New_Walnut_Logo.png"

// ── Floor plan ─────────────────────────────────────────────────────────────────

const CANVAS_W = 920
const CANVAS_H = 500

const FLOOR_PLAN = [
  // Window 2-tops (far left, round)
  { number: 1,  shape: "round",  x: 28,  y: 32,  w: 72,  h: 72,  section: "main" },
  { number: 2,  shape: "round",  x: 28,  y: 148, w: 72,  h: 72,  section: "main" },
  { number: 3,  shape: "round",  x: 28,  y: 264, w: 72,  h: 72,  section: "main" },
  // 4-tops (second column, square)
  { number: 4,  shape: "square", x: 148, y: 26,  w: 95,  h: 95,  section: "main" },
  { number: 5,  shape: "square", x: 148, y: 163, w: 95,  h: 95,  section: "main" },
  { number: 6,  shape: "square", x: 148, y: 298, w: 95,  h: 95,  section: "main" },
  // Center feature tables (rect)
  { number: 7,  shape: "rect",   x: 293, y: 26,  w: 162, h: 112, section: "main" },
  { number: 8,  shape: "rect",   x: 293, y: 196, w: 162, h: 112, section: "main" },
  { number: 9,  shape: "rect",   x: 293, y: 366, w: 162, h: 98,  section: "main" },
  // Right 4-tops
  { number: 10, shape: "square", x: 506, y: 26,  w: 95,  h: 95,  section: "main" },
  { number: 11, shape: "square", x: 506, y: 163, w: 95,  h: 95,  section: "main" },
  { number: 12, shape: "square", x: 506, y: 298, w: 95,  h: 95,  section: "main" },
  // Bar stools (far right, behind divider)
  { number: 13, shape: "round",  x: 748, y: 36,  w: 60,  h: 60,  section: "bar" },
  { number: 14, shape: "round",  x: 748, y: 134, w: 60,  h: 60,  section: "bar" },
  { number: 15, shape: "round",  x: 748, y: 232, w: 60,  h: 60,  section: "bar" },
  { number: 16, shape: "round",  x: 748, y: 330, w: 60,  h: 60,  section: "bar" },
] as const

// ── Restaurant config ──────────────────────────────────────────────────────────

const RESTAURANTS = [
  {
    key:          "original" as const,
    name:         "The Original Walnut Cafe",
    short:        "Original",
    rid:          "0001cafe-0001-4000-8000-000000000001",
    joinUrl:      "https://hostplatform.net/walnut/original/join",
    color:        "#7C5B3A",
    accent:       "rgba(124,91,58,0.12)",
    accentBorder: "rgba(124,91,58,0.35)",
  },
  {
    key:          "southside" as const,
    name:         "The Southside Walnut Cafe",
    short:        "Southside",
    rid:          "0002cafe-0001-4000-8000-000000000002",
    joinUrl:      "https://hostplatform.net/walnut/southside/join",
    color:        "#3A6B5B",
    accent:       "rgba(58,107,91,0.12)",
    accentBorder: "rgba(58,107,91,0.35)",
  },
] as const

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
  blue:     "#2563EB",
  blueBg:   "#EFF6FF",
}

// ── Floor map ─────────────────────────────────────────────────────────────────

function FloorMap({ tables }: { tables: Table[] }) {
  const tableByNumber = new Map(tables.map(t => [t.table_number, t]))

  return (
    <div style={{
      position: "relative",
      width: "100%",
      aspectRatio: `${CANVAS_W} / ${CANVAS_H}`,
      background: "#F1F5F9",
      borderRadius: 10,
      overflow: "hidden",
    }}>
      {/* Bar section background */}
      <div style={{
        position: "absolute",
        left: `${(726 / CANVAS_W * 100).toFixed(2)}%`,
        top: 0, right: 0, bottom: 0,
        background: "rgba(180,140,80,0.07)",
        borderLeft: "1px solid rgba(180,140,80,0.22)",
      }} />

      {/* Labels */}
      <span style={{
        position: "absolute",
        left: `${(762 / CANVAS_W * 100).toFixed(2)}%`,
        top: "4%",
        fontSize: 7, fontWeight: 800,
        letterSpacing: "0.2em",
        color: "rgba(100,70,30,0.45)",
        textTransform: "uppercase",
        pointerEvents: "none",
      }}>BAR</span>
      <span style={{
        position: "absolute",
        left: "3%", bottom: "5%",
        fontSize: 7, fontWeight: 800,
        letterSpacing: "0.18em",
        color: "rgba(80,60,40,0.38)",
        textTransform: "uppercase",
        pointerEvents: "none",
      }}>Main Dining</span>

      {/* Tables */}
      {FLOOR_PLAN.map(pos => {
        const table = tableByNumber.get(pos.number)
        const isOcc = table ? table.status !== "available" : false
        const isUnknown = !table
        const radius = pos.shape === "round" ? "50%" : "11%"

        return (
          <div
            key={pos.number}
            title={`Table ${pos.number}${table ? ` — ${table.status}` : ""}`}
            style={{
              position: "absolute",
              left:   `${(pos.x / CANVAS_W * 100).toFixed(3)}%`,
              top:    `${(pos.y / CANVAS_H * 100).toFixed(3)}%`,
              width:  `${(pos.w / CANVAS_W * 100).toFixed(3)}%`,
              height: `${(pos.h / CANVAS_H * 100).toFixed(3)}%`,
              borderRadius: radius,
              background: isUnknown ? "#E2E8F0" : isOcc ? "#FEE2E2" : "#DCFCE7",
              border: `1.5px solid ${isUnknown ? "#CBD5E1" : isOcc ? "#FCA5A5" : "#86EFAC"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 800,
              fontSize: "min(1.5cqi, 11px)",
              color: isUnknown ? "#94A3B8" : isOcc ? "#DC2626" : "#16A34A",
              transition: "background .3s, border-color .3s",
              userSelect: "none",
            }}
          >
            {pos.number}
          </div>
        )
      })}

      {/* Legend */}
      <div style={{
        position: "absolute", right: "1%", bottom: "4%",
        display: "flex", gap: 8, alignItems: "center",
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: "#DCFCE7", border: "1px solid #86EFAC", display: "inline-block" }} />
          <span style={{ fontSize: 6.5, color: "rgba(60,60,60,0.5)", fontWeight: 700 }}>Open</span>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: "#FEE2E2", border: "1px solid #FCA5A5", display: "inline-block" }} />
          <span style={{ fontSize: 6.5, color: "rgba(60,60,60,0.5)", fontWeight: 700 }}>Seated</span>
        </span>
      </div>
    </div>
  )
}

// ── Queue list ─────────────────────────────────────────────────────────────────

function QueueList({ queue }: { queue: QueueEntry[] }) {
  const active = queue.filter(e => e.status === "waiting" || e.status === "ready")
  if (!active.length) {
    return <p style={{ fontSize: 13, color: C.muted, fontStyle: "italic" }}>No parties waiting</p>
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, overflowY: "auto", maxHeight: 340 }}>
      {active.slice(0, 10).map((e, i) => {
        const isReady  = e.status === "ready"
        const minsAgo  = Math.round((Date.now() - new Date(e.arrival_time).getTime()) / 60_000)
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
                flexShrink: 0,
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
      {active.length > 10 && (
        <p style={{ fontSize: 11, color: C.muted, textAlign: "center", marginTop: 2 }}>
          +{active.length - 10} more in queue
        </p>
      )}
    </div>
  )
}

// ── PIN screen ─────────────────────────────────────────────────────────────────

function PinScreen({ onSuccess }: { onSuccess: () => void }) {
  const [digits,  setDigits]  = useState<string[]>([])
  const [error,   setError]   = useState("")
  const [loading, setLoading] = useState(false)
  const [shake,   setShake]   = useState(false)

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

  const addDigit = useCallback((d: string) => {
    if (loading) return
    setError("")
    setDigits(prev => {
      if (prev.length >= 4) return prev
      const next = [...prev, d]
      if (next.length === 4) verifyPin(next.join(""))
      return next
    })
  }, [loading, verifyPin])

  const backspace = useCallback(() => {
    if (loading) return
    setError("")
    setDigits(prev => prev.slice(0, -1))
  }, [loading])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") addDigit(e.key)
      else if (e.key === "Backspace") backspace()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [addDigit, backspace])

  const PAD = [["1","2","3"],["4","5","6"],["7","8","9"],["","0","⌫"]]

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
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 28 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} alt="Walnut Cafe" style={{ height: 44, objectFit: "contain", marginBottom: 12 }} />
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: C.muted }}>
            Admin Dashboard
          </p>
          <p style={{ fontSize: 13, color: C.text2, marginTop: 4 }}>Enter your 4-digit PIN</p>
        </div>

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

        {error && (
          <p style={{ textAlign: "center", fontSize: 12, color: C.red, fontWeight: 600, marginBottom: 16, marginTop: -12 }}>
            {error}
          </p>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {PAD.flat().map((d, i) => (
            <button
              key={i}
              onClick={() => d === "⌫" ? backspace() : d ? addDigit(d) : undefined}
              disabled={loading || (!d && d !== "0")}
              style={{
                height: 64, borderRadius: 14, fontSize: d === "⌫" ? 20 : 24, fontWeight: 600,
                background: d === "⌫" ? "rgba(220,38,38,0.05)" : d ? C.bg : "transparent",
                border: d === "⌫" ? "1px solid rgba(220,38,38,0.15)" : d ? `1px solid ${C.border}` : "none",
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

// ── Main dashboard ─────────────────────────────────────────────────────────────

export default function WalnutDashboard() {
  const [pinOk,     setPinOk]     = useState<boolean | null>(null)
  const [activeTab, setActiveTab] = useState<0 | 1>(0)
  const [entering,  setEntering]  = useState<string | null>(null)
  const [data, setData] = useState<[RestaurantData, RestaurantData]>([
    { tables: [], queue: [], insights: null, online: true,  lastSync: new Date() },
    { tables: [], queue: [], insights: null, online: true,  lastSync: new Date() },
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
        const tables   = tRes.ok ? await tRes.json() : []
        const queue    = qRes.ok ? await qRes.json() : []
        const insights = iRes.ok ? await iRes.json() : null
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

  async function enterRestaurant(key: "original" | "southside") {
    setEntering(key)
    try {
      const r = await fetch("/api/walnut/enter-restaurant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account: key }),
      })
      if (r.ok) {
        const d = await r.json()
        window.location.href = d.redirect
      } else {
        alert("Could not enter station — PIN may have expired")
      }
    } catch {
      alert("Connection error — try again")
    } finally {
      setEntering(null)
    }
  }

  // ── Loading / PIN gate ───────────────────────────────────────────────────────
  if (pinOk === null) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 13, color: C.muted }}>Loading…</div>
      </div>
    )
  }
  if (!pinOk) return <PinScreen onSuccess={() => setPinOk(true)} />

  // ── Data for selected restaurant ─────────────────────────────────────────────
  const restaurant = RESTAURANTS[activeTab]
  const d          = data[activeTab]
  const total      = d.insights?.tables_total      ?? d.tables.length
  const available  = d.insights?.tables_available  ?? d.tables.filter(t => t.status === "available").length
  const occupied   = d.insights?.tables_occupied   ?? d.tables.filter(t => t.status !== "available").length
  const waiting    = d.insights?.parties_waiting   ?? d.queue.filter(e => e.status === "waiting" || e.status === "ready").length
  const waitMin    = d.insights?.avg_wait_estimate ?? null
  const occupancy  = total > 0 ? Math.round(occupied / total * 100) : 0

  const activeQueue = d.queue.filter(e => e.status === "waiting" || e.status === "ready")
  const longestWait = activeQueue.length > 0
    ? Math.max(...activeQueue.map(e => Math.round((Date.now() - new Date(e.arrival_time).getTime()) / 60_000)))
    : null
  const avgPartySize = activeQueue.length > 0
    ? (activeQueue.reduce((s, e) => s + e.party_size, 0) / activeQueue.length).toFixed(1)
    : null

  return (
    <div style={{
      minHeight: "100vh", background: C.bg,
      fontFamily: "var(--font-geist), system-ui, -apple-system, sans-serif",
      color: C.text,
    }}>

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
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
          <button onClick={fetchAll}
            style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: C.muted }}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* ── Summary cards (both restaurants) ─────────────────────────────────── */}
      <div style={{ padding: "24px 28px 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {RESTAURANTS.map((r, i) => {
          const rd  = data[i]
          const avl = rd.insights?.tables_available ?? rd.tables.filter(t => t.status === "available").length
          const occ = rd.insights?.tables_occupied  ?? rd.tables.filter(t => t.status !== "available").length
          const wt  = rd.insights?.parties_waiting  ?? rd.queue.filter(e => e.status === "waiting" || e.status === "ready").length
          const tot = rd.insights?.tables_total ?? rd.tables.length
          const pct = tot > 0 ? Math.round(occ / tot * 100) : 0
          const isActive = activeTab === i
          return (
            <div key={r.key} style={{
              background: C.surface,
              border: `2px solid ${isActive ? r.color : C.border}`,
              borderRadius: 16, padding: "18px 20px",
              boxShadow: isActive ? `0 0 0 3px ${r.color}22` : "none",
              transition: "border-color .15s, box-shadow .15s",
            }}>
              <button onClick={() => setActiveTab(i as 0 | 1)}
                style={{ all: "unset", cursor: "pointer", display: "block", width: "100%" }}>
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

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
                  <div style={{ background: C.greenBg, borderRadius: 10, padding: "8px 10px", border: "1px solid #BBF7D0", textAlign: "center" }}>
                    <p style={{ fontSize: 9, color: C.green, fontWeight: 700, marginBottom: 2, letterSpacing: ".04em" }}>OPEN</p>
                    <p style={{ fontSize: 20, fontWeight: 800, color: C.green }}>{avl}</p>
                  </div>
                  <div style={{ background: "#FEF2F2", borderRadius: 10, padding: "8px 10px", border: "1px solid #FECACA", textAlign: "center" }}>
                    <p style={{ fontSize: 9, color: C.red, fontWeight: 700, marginBottom: 2, letterSpacing: ".04em" }}>OCC.</p>
                    <p style={{ fontSize: 20, fontWeight: 800, color: C.red }}>{occ}</p>
                  </div>
                  <div style={{ background: "#F8FAFC", borderRadius: 10, padding: "8px 10px", border: `1px solid ${C.border}`, textAlign: "center" }}>
                    <p style={{ fontSize: 9, color: C.text2, fontWeight: 700, marginBottom: 2, letterSpacing: ".04em" }}>OCC%</p>
                    <p style={{ fontSize: 20, fontWeight: 800, color: C.text }}>{pct}%</p>
                  </div>
                  <div style={{ background: C.orangeBg, borderRadius: 10, padding: "8px 10px", border: "1px solid #FDE68A", textAlign: "center" }}>
                    <p style={{ fontSize: 9, color: C.orange, fontWeight: 700, marginBottom: 2, letterSpacing: ".04em" }}>WAIT</p>
                    <p style={{ fontSize: 20, fontWeight: 800, color: C.orange }}>{wt}</p>
                  </div>
                </div>
              </button>

              {/* Enter station button */}
              <button
                onClick={() => enterRestaurant(r.key)}
                disabled={entering === r.key}
                style={{
                  width: "100%", padding: "9px 0", borderRadius: 10,
                  background: isActive ? r.color : "#F1F5F9",
                  border: `1.5px solid ${isActive ? r.color : C.border}`,
                  color: isActive ? "#fff" : C.text2,
                  fontSize: 12, fontWeight: 700, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                  opacity: entering === r.key ? 0.6 : 1,
                  transition: "background .15s, border-color .15s, color .15s",
                }}>
                <LogIn size={13} />
                {entering === r.key ? "Entering…" : `Enter ${r.short} Station`}
              </button>
            </div>
          )
        })}
      </div>

      {/* ── Detailed view for selected restaurant ────────────────────────────── */}
      <div style={{ padding: "20px 28px 40px" }}>

        {/* Section header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 4, height: 22, borderRadius: 2, background: restaurant.color }} />
            <h2 style={{ fontSize: 17, fontWeight: 800, color: C.text }}>{restaurant.name}</h2>
          </div>
          <span style={{ fontSize: 11, color: C.muted }}>
            Last sync {d.lastSync.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>

        {/* Stats card */}
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 16, padding: "18px 22px", marginBottom: 16,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 14 }}>
            <TrendingUp size={14} style={{ color: restaurant.color }} />
            <h3 style={{ fontSize: 12, fontWeight: 800, color: C.text, letterSpacing: ".04em", textTransform: "uppercase" }}>
              Stats
            </h3>
          </div>

          {/* Occupancy bar */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.text2 }}>Occupancy</span>
              <span style={{ fontSize: 22, fontWeight: 900, color: restaurant.color }}>{occupancy}%</span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: C.border, overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 4,
                width: `${occupancy}%`,
                background: occupancy >= 80 ? C.red : occupancy >= 50 ? C.orange : C.green,
                transition: "width .5s ease",
              }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 10, color: C.muted }}>
              <span>{occupied} seated of {total} tables</span>
              <span>{available} available</span>
            </div>
          </div>

          {/* Stat pills row */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {[
              {
                label: "Waiting",
                value: waiting > 0 ? `${waiting} ${waiting === 1 ? "party" : "parties"}` : "No queue",
                icon: Users,
                color: waiting > 0 ? C.orange : C.green,
                bg: waiting > 0 ? C.orangeBg : C.greenBg,
                border: waiting > 0 ? "#FDE68A" : "#BBF7D0",
              },
              ...(waitMin && waitMin > 0 ? [{
                label: "Avg Wait",
                value: `~${waitMin}m`,
                icon: Clock,
                color: C.orange,
                bg: C.orangeBg,
                border: "#FDE68A",
              }] : []),
              ...(longestWait !== null && longestWait > 0 ? [{
                label: "Longest Wait",
                value: `${longestWait}m`,
                icon: Clock,
                color: longestWait >= 30 ? C.red : C.orange,
                bg: longestWait >= 30 ? "#FEF2F2" : C.orangeBg,
                border: longestWait >= 30 ? "#FECACA" : "#FDE68A",
              }] : []),
              ...(avgPartySize !== null && waiting > 0 ? [{
                label: "Avg Party",
                value: `${avgPartySize} guests`,
                icon: Users,
                color: C.blue,
                bg: C.blueBg,
                border: "#BFDBFE",
              }] : []),
              ...(d.tables.length === 0 ? [{
                label: "Status",
                value: "No data",
                icon: CheckCircle2,
                color: C.muted,
                bg: C.bg,
                border: C.border,
              }] : []),
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
        </div>

        {/* Floor map + Queue grid */}
        <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 16, marginBottom: 16 }}>

          {/* Floor map */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Floor Map</h3>
              <span style={{ fontSize: 11, color: C.muted }}>16 tables</span>
            </div>
            {d.tables.length > 0
              ? <FloorMap tables={d.tables} />
              : (
                <div style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <p style={{ fontSize: 13, color: C.muted, fontStyle: "italic" }}>Loading table data…</p>
                </div>
              )
            }
          </div>

          {/* Queue */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: "18px 20px" }}>
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

        {/* Guest join links */}
        <div>
          <h3 style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
            Guest Join Links
          </h3>
          <div style={{ display: "flex", gap: 10 }}>
            {RESTAURANTS.map(r => (
              <div key={r.key} style={{
                background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 12, padding: "14px 18px", flex: 1,
              }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: r.color, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
                  {r.short}
                </p>
                <p style={{ fontSize: 11, color: C.text2, marginBottom: 8, wordBreak: "break-all" }}>{r.joinUrl}</p>
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
