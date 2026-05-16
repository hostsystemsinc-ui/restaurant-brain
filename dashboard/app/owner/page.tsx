"use client"

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { CURRENT_VERSION, EFFECTIVE_DATE, ENTITY_NAME, TERMS_SECTIONS, type TermsSection } from "@/lib/terms"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts"

// ── Design tokens ──────────────────────────────────────────────────────────────
const D = {
  bg:           "#080C10",
  sidebar:      "#0C1118",
  surface:      "rgba(255,255,255,0.035)",
  surfaceHover: "rgba(255,255,255,0.055)",
  surface2:     "rgba(255,255,255,0.06)",
  border:       "rgba(255,255,255,0.08)",
  borderStrong: "rgba(255,255,255,0.14)",
  text:         "#FFFFFF",
  text2:        "rgba(255,255,255,0.60)",
  muted:        "rgba(255,255,255,0.28)",
  accent:       "#D9321C",
  green:        "#22C55E",
  greenBg:      "rgba(34,197,94,0.10)",
  greenBorder:  "rgba(34,197,94,0.20)",
  orange:       "#F59E0B",
  orangeBg:     "rgba(245,158,11,0.10)",
  red:          "#EF4444",
  redBg:        "rgba(239,68,68,0.10)",
  blue:         "#60A5FA",
  blueBg:       "rgba(96,165,250,0.10)",
  blueBorder:   "rgba(96,165,250,0.20)",
  yellow:       "#FBBF24",
  purple:       "#A78BFA",
  purpleBg:     "rgba(167,139,250,0.10)",
}

const API  = "https://restaurant-brain-production.up.railway.app"
const DEMO_RID = "dec0cafe-0000-4000-8000-000000000001"

// Legacy hardcoded station URLs for the original 4 clients.
// New clients created via the wizard use /client/[slug]/station which is now fully functional.
// Walnut Original and Southside share /station — the page reads the client auth cookie
// to know which restaurant to show, so the user must be logged in as the right client.
const REAL_STATION_URL: Record<string, string> = {
  "272a8876-e4e6-4867-831d-0525db80a8db": "https://hostplatform.net/walters303/station",
  "0001cafe-0001-4000-8000-000000000001": "https://hostplatform.net/station",
  "0002cafe-0001-4000-8000-000000000002": "https://hostplatform.net/station",
  "dec0cafe-0000-4000-8000-000000000001": "https://hostplatform.net/demo/station",
}
// Client username to log in as for station access
const STATION_LOGIN_AS: Record<string, string> = {
  "272a8876-e4e6-4867-831d-0525db80a8db": "walters",
  "0001cafe-0001-4000-8000-000000000001": "original",
  "0002cafe-0001-4000-8000-000000000002": "southside",
  "dec0cafe-0000-4000-8000-000000000001": "demo",
}

// ── Types ──────────────────────────────────────────────────────────────────────
interface Client {
  id:             string
  name:           string
  slug:           string
  city?:          string
  display_name:   string
  join_url:       string
  station_url:    string
  plan_type:      string
  status:         string
  monthly_fee_cents?: number
  location_count?: number
  signed_at?:     string
  signer_name?:   string
  signer_email?:  string
  created_at?:    string
  location_group?: string
  location_name?:  string
}

interface Credential {
  id:              string
  restaurant_id:   string
  credential_type: string
  label:           string
  value:           string
  notes?:          string
  updated_at?:     string
}

interface MenuSection {
  id:    string
  title: string
  items: MenuItem[]
}

interface MenuItem {
  id:          string
  name:        string
  description: string
  price:       string
  tags:        string[]
}

interface FloorTable {
  id:       string
  number:   number
  label:    string
  capacity: number
  shape:    "rect" | "circle" | "booth" | "diamond"
  x:        number  // percent of canvas width
  y:        number  // percent of canvas height
  w:        number  // percent
  h:        number  // percent
}

interface FloorWall {
  x1: number; y1: number; x2: number; y2: number  // all percent
}

interface FloorObject {
  id: string; type: string
  x: number; y: number; w: number; h: number       // all percent
  label: string
}

interface AgreementRecord {
  id:               string
  business_name:    string
  signer_name:      string
  signer_title?:    string
  signer_email:     string
  plan_type:        string
  signed_at:        string
  ip_address?:      string
  agreement_version?: string
  status?:          string
  monthly_fee_cents?: number
  location_count?:  number
}

interface AnalyticsEntry {
  id:           string
  name:         string
  party_size:   number
  phone:        string | null
  source:       string
  status:       string
  arrival_time: string | null
  quoted_wait:  number | null
  seated_at:    string | null
  actual_wait:  number | null
  notes:        string | null
  restaurant_id: string | null
}

interface GAData {
  configured: boolean
  error?: string
  today?: { sessions: number; pageviews: number; activeUsers: number; newUsers: number }
  pages?: { path: string; title: string; pageviews: number; sessions: number }[]
  sources?: { source: string; sessions: number }[]
  daily?: { date: string; sessions: number; pageviews: number }[]
}

type NavView = "dashboard" | "clients" | "client-detail" | "new-client" | "billing" | "analytics" | "website" | "agreements" | "settings"

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " · " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
}

function planBadge(plan: string, status: string) {
  const color = status === "trial" ? D.orange : status === "active" ? D.green : D.muted
  const bg    = status === "trial" ? D.orangeBg : status === "active" ? D.greenBg : D.surface
  return (
    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" as const,
      borderRadius: 20, padding: "2px 10px", color, background: bg, border: `1px solid ${color}40`, whiteSpace: "nowrap" as const }}>
      {status === "trial" ? "Trial" : plan}
    </span>
  )
}

function nanoid() {
  return Math.random().toString(36).slice(2, 9)
}

// ── Sidebar ────────────────────────────────────────────────────────────────────
function Sidebar({ view, setView, onLogout }: { view: NavView; setView: (v: NavView) => void; onLogout: () => void }) {
  const items: { id: NavView; label: string; icon: string }[] = [
    { id: "dashboard",   label: "Dashboard",          icon: "⬡" },
    { id: "clients",     label: "Clients",            icon: "🏢" },
    { id: "billing",     label: "Billing",            icon: "💳" },
    { id: "website",     label: "Website Analytics",  icon: "🌐" },
    { id: "analytics",   label: "Guest Analytics",    icon: "📊" },
    { id: "agreements",  label: "Agreements",         icon: "📄" },
    { id: "settings",    label: "Settings",           icon: "⚙️" },
  ]
  const active = (view === "client-detail" || view === "new-client") ? "clients" : view
  return (
    <div style={{ width: 220, minHeight: "100dvh", background: D.sidebar, borderRight: `1px solid ${D.border}`,
      display: "flex", flexDirection: "column", flexShrink: 0, padding: "20px 0" }}>
      {/* Logo */}
      <div style={{ padding: "0 20px 24px", borderBottom: `1px solid ${D.border}` }}>
        <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: "-0.02em", color: D.text }}>
          HOST
        </div>
        <div style={{ fontSize: 10, color: D.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 2 }}>
          Owner Console
        </div>
      </div>
      {/* Nav */}
      <nav style={{ flex: 1, padding: "16px 12px", display: "flex", flexDirection: "column", gap: 2 }}>
        {items.map(item => (
          <button
            key={item.id}
            onClick={() => setView(item.id as NavView)}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "9px 12px", borderRadius: 8, border: "none", cursor: "pointer",
              background: active === item.id ? D.surface2 : "transparent",
              color: active === item.id ? D.text : D.text2,
              fontSize: 14, fontWeight: active === item.id ? 600 : 400,
              textAlign: "left", width: "100%",
              transition: "all 0.12s",
            }}
          >
            <span style={{ fontSize: 16, width: 20, textAlign: "center", flexShrink: 0 }}>{item.icon}</span>
            {item.label}
            {active === item.id && (
              <div style={{ marginLeft: "auto", width: 4, height: 4, borderRadius: 2, background: D.accent }} />
            )}
          </button>
        ))}
      </nav>
      <div style={{ padding: "16px 12px", borderTop: `1px solid ${D.border}`, display: "flex", flexDirection: "column", gap: 8 }}>
        <button
          onClick={onLogout}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, border: "none", cursor: "pointer",
            background: "transparent", color: D.muted, fontSize: 14, fontWeight: 400, textAlign: "left", width: "100%",
            transition: "all 0.12s" }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = D.red; (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.08)" }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = D.muted; (e.currentTarget as HTMLButtonElement).style.background = "transparent" }}
        >
          <span style={{ fontSize: 16, width: 20, textAlign: "center", flexShrink: 0 }}>↩</span>
          Sign Out
        </button>
        <div style={{ fontSize: 10, color: D.muted, paddingLeft: 12 }}>v2.1 · HOST Platform</div>
      </div>
    </div>
  )
}

// ── Dashboard View ─────────────────────────────────────────────────────────────
interface ServiceStatus { label: string; status: "checking"|"up"|"degraded"|"down"; detail: string }
interface RestaurantLive { id: string; name: string; queueNow: number; tablesOccupied: number; tablesTotal: number; avgWait: number|null; utilization: number }
interface DemoSubmission { id?: string; name: string; restaurant: string; email: string; phone?: string; message?: string; submittedAt?: string; receivedAt?: string }

const KNOWN_RESTAURANTS = [
  { id: "272a8876-e4e6-4867-831d-0525db80a8db", name: "Walter's 303"    },
  { id: "0001cafe-0001-4000-8000-000000000001", name: "Walnut Original"  },
  { id: "0002cafe-0001-4000-8000-000000000002", name: "Walnut Southside" },
  { id: DEMO_RID,                               name: "Demo"             },
]

function DashboardView({ token, clients: propClients, onCreateClient }: { token: string; clients: Client[]; onCreateClient: () => void }) {
  const [services,  setServices]  = useState<ServiceStatus[]>([
    { label: "Railway API", status: "checking", detail: "—" },
    { label: "Supabase DB", status: "checking", detail: "—" },
    { label: "GitHub",      status: "checking", detail: "—" },
    { label: "Textbelt",    status: "checking", detail: "—" },
  ])
  const [liveStats, setLiveStats] = useState<RestaurantLive[]>([])
  const [lastCheck, setLastCheck] = useState<Date|null>(null)
  const [demos,     setDemos]     = useState<DemoSubmission[]>([])
  const [demosLoading, setDemosLoading] = useState(true)

  const runChecks = useCallback(async () => {
    // ── Railway + Supabase (inferred from API response)
    const railwayStart = Date.now()
    let railwaySt: ServiceStatus["status"] = "down"
    let railwayDetail = "No response"
    let supabaseSt: ServiceStatus["status"] = "down"
    let supabaseDetail = "inferred from API"
    try {
      const r = await fetch(`${API}/queue?restaurant_id=${DEMO_RID}`, { cache: "no-store" })
      const ms = Date.now() - railwayStart
      if (r.ok) {
        railwaySt = ms < 600 ? "up" : "degraded"
        railwayDetail = `${ms}ms`
        supabaseSt = "up"
        supabaseDetail = "responding"
      } else {
        railwaySt = "degraded"
        railwayDetail = `HTTP ${r.status}`
        supabaseSt = "degraded"
        supabaseDetail = `HTTP ${r.status}`
      }
    } catch {
      railwayDetail = "Timeout"
    }

    // ── GitHub
    let githubSt: ServiceStatus["status"] = "down"
    let githubDetail = "—"
    try {
      const g = await fetch("https://www.githubstatus.com/api/v2/status.json", { cache: "no-store" })
      if (g.ok) {
        const gj = await g.json() as { status: { indicator: string; description: string } }
        const ind = gj.status?.indicator
        githubSt = ind === "none" ? "up" : ind === "minor" ? "degraded" : "down"
        githubDetail = gj.status?.description || ind
      }
    } catch {
      githubDetail = "Unreachable"
    }

    // ── Textbelt
    let textbeltSt: ServiceStatus["status"] = "down"
    let textbeltDetail = "—"
    try {
      const tb = await fetch(`/api/textbelt`, { cache: "no-store" })
      if (tb.ok) {
        const tj = await tb.json() as { quotaRemaining?: number; success?: boolean }
        if (tj.quotaRemaining != null) {
          textbeltSt = tj.quotaRemaining > 5 ? "up" : "degraded"
          textbeltDetail = `${tj.quotaRemaining} credits`
        } else {
          textbeltSt = "degraded"
          textbeltDetail = "Unknown quota"
        }
      }
    } catch {
      textbeltDetail = "Unreachable"
    }

    setServices([
      { label: "Railway API", status: railwaySt,   detail: railwayDetail   },
      { label: "Supabase DB", status: supabaseSt,  detail: supabaseDetail  },
      { label: "GitHub",      status: githubSt,    detail: githubDetail    },
      { label: "Textbelt",    status: textbeltSt,  detail: textbeltDetail  },
    ])
    setLastCheck(new Date())

    // ── Per-restaurant live stats
    const restaurantsToCheck = propClients.length > 0
      ? propClients.slice(0, 8).map(r => ({ id: r.id, name: r.display_name || r.name }))
      : KNOWN_RESTAURANTS
    const stats = await Promise.all(restaurantsToCheck.map(async r => {
      try {
        const iRes = await fetch(`${API}/insights?restaurant_id=${r.id}`, { cache: "no-store" })
        const ins = iRes.ok ? (await iRes.json() as {
          parties_waiting?: number; parties_ready?: number;
          avg_wait_estimate?: number; tables_occupied?: number;
          tables_total?: number; capacity_utilization?: number
        }) : null
        return {
          id:             r.id,
          name:           r.name,
          queueNow:       (ins?.parties_waiting ?? 0) + (ins?.parties_ready ?? 0),
          tablesOccupied: ins?.tables_occupied  ?? 0,
          tablesTotal:    ins?.tables_total     ?? 0,
          avgWait:        (ins?.avg_wait_estimate && ins.avg_wait_estimate > 0) ? ins.avg_wait_estimate : null,
          utilization:    ins?.capacity_utilization ?? 0,
        }
      } catch {
        return { id: r.id, name: r.name, queueNow: 0, tablesOccupied: 0, tablesTotal: 0, avgWait: null, utilization: 0 }
      }
    }))
    setLiveStats(stats)
  }, [propClients])

  useEffect(() => {
    // Load demo requests
    setDemosLoading(true)
    fetch(`/api/demo?secret=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(r => r.json())
      .then(d => { setDemos(Array.isArray(d) ? d : (d.submissions || [])); setDemosLoading(false) })
      .catch(() => setDemosLoading(false))
    // Run health checks
    runChecks()
    const interval = setInterval(runChecks, 60_000)
    return () => clearInterval(interval)
  }, [token, runChecks])

  const activeClients = propClients.filter(c => c.status === "active").length
  const trialClients  = propClients.filter(c => c.status === "trial").length
  const totalMRR      = propClients.reduce((s, c) => s + (c.monthly_fee_cents || 0), 0)

  function svcDot(st: ServiceStatus["status"]) {
    return st === "up" ? D.green : st === "degraded" ? D.orange : st === "checking" ? D.muted : D.red
  }

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: D.text, margin: 0 }}>Dashboard</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {lastCheck && <span style={{ fontSize: 11, color: D.muted }}>Checked {lastCheck.toLocaleTimeString()}</span>}
          <button onClick={runChecks}
            style={{ padding: "6px 14px", borderRadius: 7, border: `1px solid ${D.border}`, background: "transparent", color: D.text2, fontSize: 12, cursor: "pointer" }}>
            ↻ Refresh
          </button>
        </div>
      </div>
      <p style={{ color: D.text2, fontSize: 14, margin: "0 0 28px" }}>Live platform health and restaurant stats</p>

      {/* Business summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 28 }}>
        {[
          { label: "Total Clients", value: String(propClients.length), color: D.blue    },
          { label: "Active",        value: String(activeClients),   color: D.green   },
          { label: "Trial",         value: String(trialClients),    color: D.orange  },
          { label: "Monthly MRR",   value: `$${(totalMRR/100).toFixed(0)}`, color: D.purple },
        ].map(card => (
          <div key={card.label} style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, padding: "18px 20px" }}>
            <div style={{ fontSize: 11, color: D.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{card.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Service health */}
      <h2 style={{ fontSize: 14, fontWeight: 700, color: D.text, margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.07em" }}>Service Health</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 32 }}>
        {services.map(svc => (
          <div key={svc.label} style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 10, padding: "16px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: svcDot(svc.status), flexShrink: 0,
                boxShadow: svc.status !== "checking" ? `0 0 6px ${svcDot(svc.status)}80` : "none" }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: D.text }}>{svc.label}</span>
            </div>
            <div style={{ fontSize: 11, color: svc.status === "up" ? D.green : svc.status === "degraded" ? D.orange : svc.status === "checking" ? D.muted : D.red }}>
              {svc.status === "checking" ? "Checking…" : svc.status === "up" ? `● Operational · ${svc.detail}` : svc.status === "degraded" ? `⚠ Degraded · ${svc.detail}` : `✕ Down · ${svc.detail}`}
            </div>
          </div>
        ))}
      </div>

      {/* Live Restaurant Monitor */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: D.text, margin: 0, textTransform: "uppercase", letterSpacing: "0.07em" }}>Live Operations</h2>
        <a href="#" onClick={e => { e.preventDefault(); runChecks() }} style={{ fontSize: 12, color: D.blue, textDecoration: "none" }}>↻ Refresh</a>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12, marginBottom: 32 }}>
        {liveStats.length === 0 ? (
          <div style={{ gridColumn: "1/-1", padding: "24px 20px", color: D.muted, fontSize: 13, background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12 }}>Loading live data…</div>
        ) : liveStats.map(r => (
          <div key={r.id} style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: D.text }}>{r.name}</div>
              <span style={{ fontSize: 18, fontWeight: 800, color: r.queueNow > 0 ? D.orange : D.green }}>{r.queueNow} <span style={{ fontSize: 11, fontWeight: 400, color: D.muted }}>in queue</span></span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <div style={{ background: D.surface2, borderRadius: 8, padding: "8px 10px" }}>
                <div style={{ fontSize: 9, color: D.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Tables</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: D.text }}>{r.tablesOccupied}<span style={{ fontSize: 11, color: D.muted, fontWeight: 400 }}>/{r.tablesTotal}</span></div>
              </div>
              <div style={{ background: D.surface2, borderRadius: 8, padding: "8px 10px" }}>
                <div style={{ fontSize: 9, color: D.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Avg Wait</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: D.text2 }}>{r.avgWait ? `~${Math.round(r.avgWait)}m` : "—"}</div>
              </div>
              <div style={{ background: D.surface2, borderRadius: 8, padding: "8px 10px" }}>
                <div style={{ fontSize: 9, color: D.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Utilization</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: r.utilization > 70 ? D.orange : D.green }}>{r.utilization}%</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent clients */}
      <h2 style={{ fontSize: 14, fontWeight: 700, color: D.text, margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.07em" }}>Recent Clients</h2>
      <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 32 }}>
        {propClients.slice(0, 6).map((c, i) => (
          <div key={c.id} style={{ padding: "13px 20px", borderBottom: i < Math.min(5, propClients.length - 1) ? `1px solid ${D.border}` : "none",
            display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: D.text }}>{c.display_name}</div>
              <div style={{ fontSize: 12, color: D.muted }}>{c.city || "—"}</div>
            </div>
            {planBadge(c.plan_type, c.status)}
          </div>
        ))}
        {propClients.length === 0 && (
          <div style={{ padding: 32, textAlign: "center", color: D.muted, fontSize: 14 }}>No clients yet. Add your first client!</div>
        )}
      </div>

      {/* Demo Requests */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: D.text, margin: 0, textTransform: "uppercase", letterSpacing: "0.07em" }}>
          Demo Requests
          {demos.length > 0 && (
            <span style={{ marginLeft: 10, fontSize: 11, fontWeight: 700, background: D.greenBg, color: D.green,
              border: `1px solid ${D.greenBorder}`, borderRadius: 20, padding: "2px 9px" }}>
              {demos.length}
            </span>
          )}
        </h2>
        <button onClick={() => {
          setDemosLoading(true)
          fetch(`/api/demo?secret=${encodeURIComponent(token)}`, { cache: "no-store" })
            .then(r => r.json())
            .then(d => { setDemos(Array.isArray(d) ? d : (d.submissions || [])); setDemosLoading(false) })
            .catch(() => setDemosLoading(false))
        }} style={{ padding: "5px 12px", borderRadius: 7, border: `1px solid ${D.border}`, background: "transparent", color: D.text2, fontSize: 12, cursor: "pointer" }}>
          ↻ Refresh
        </button>
      </div>
      <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, overflow: "hidden" }}>
        {/* Header row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.2fr 0.8fr 120px auto", padding: "10px 20px",
          borderBottom: `1px solid ${D.border}`, fontSize: 10, color: D.muted, textTransform: "uppercase", letterSpacing: "0.07em" }}>
          <span>Name</span><span>Restaurant</span><span>Email</span><span>Phone</span><span style={{ textAlign: "right" }}>Submitted</span><span>Actions</span>
        </div>
        {demosLoading ? (
          <div style={{ padding: "24px 20px", color: D.muted, fontSize: 13 }}>Loading demo requests…</div>
        ) : demos.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
            <div style={{ color: D.muted, fontSize: 14 }}>No demo requests yet.</div>
            <div style={{ color: D.muted, fontSize: 12, marginTop: 4 }}>Requests from hostplatform.net will appear here.</div>
          </div>
        ) : demos.map((d, i) => {
          const ts = d.submittedAt || d.receivedAt
          const date = ts ? new Date(ts) : null
          const isNew = date ? (Date.now() - date.getTime()) < 48 * 60 * 60 * 1000 : false
          return (
            <div key={d.id || i} style={{
              display: "grid", gridTemplateColumns: "1fr 1fr 1.2fr 0.8fr 120px auto",
              padding: "14px 20px", borderBottom: i < demos.length - 1 ? `1px solid ${D.border}` : "none",
              alignItems: "center",
              background: isNew ? "rgba(34,197,94,0.03)" : "transparent",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {isNew && <span style={{ width: 7, height: 7, borderRadius: "50%", background: D.green, flexShrink: 0, boxShadow: `0 0 6px ${D.green}` }} />}
                <span style={{ fontSize: 14, fontWeight: 600, color: D.text }}>{d.name || "—"}</span>
              </div>
              <div style={{ fontSize: 13, color: D.text2 }}>{d.restaurant || "—"}</div>
              <div>
                <a href={`mailto:${d.email}`} style={{ fontSize: 13, color: D.blue, textDecoration: "none" }}>{d.email || "—"}</a>
              </div>
              <div style={{ fontSize: 13, color: D.text2 }}>{d.phone || "—"}</div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 12, color: isNew ? D.green : D.muted, fontWeight: isNew ? 600 : 400 }}>
                  {date ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                </div>
                <div style={{ fontSize: 11, color: D.muted }}>
                  {date ? date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : ""}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <a href={`mailto:${d.email}?subject=Your HOST Demo Request&body=Hi ${d.name},%0A%0AThank you for your interest in HOST!`}
                  style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${D.blueBorder}`, background: D.blueBg, color: D.blue, fontSize: 11, fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}>
                  ✉ Email
                </a>
                <button onClick={onCreateClient}
                  style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${D.greenBorder}`, background: D.greenBg, color: D.green, fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                  + Client
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Floor Viewer (read-only) ───────────────────────────────────────────────────
function FloorViewer({ tables, walls, objects, aspectRatio = 1.62 }: {
  tables: FloorTable[]
  walls?: FloorWall[]
  objects?: FloorObject[]
  aspectRatio?: number
}) {
  return (
    <div style={{
      width: "100%", aspectRatio: String(aspectRatio),
      background: "#08090b", borderRadius: 12,
      border: "1px solid rgba(255,255,255,0.08)",
      position: "relative", overflow: "hidden",
    }}>
      {/* Walls */}
      {(walls || []).map((w, i) => {
        const isV = Math.abs(w.x2 - w.x1) < Math.abs(w.y2 - w.y1)
        return (
          <div key={i} style={{
            position: "absolute", background: "rgba(255,185,100,0.55)", pointerEvents: "none",
            ...(isV ? {
              left: `${w.x1}%`, top: `${Math.min(w.y1, w.y2)}%`,
              width: "0.4%", height: `${Math.abs(w.y2 - w.y1)}%`,
            } : {
              left: `${Math.min(w.x1, w.x2)}%`, top: `${w.y1}%`,
              width: `${Math.abs(w.x2 - w.x1)}%`, height: "0.5%",
            }),
          }} />
        )
      })}
      {/* Objects */}
      {(objects || []).map(obj => (
        <div key={obj.id} style={{
          position: "absolute",
          left: `${obj.x}%`, top: `${obj.y}%`,
          width: `${obj.w}%`, height: `${obj.h}%`,
          display: "flex", alignItems: "center", justifyContent: "center",
          pointerEvents: "none",
          ...(obj.type === "window" ? { background: "rgba(100,160,255,0.1)", border: "1px solid rgba(100,160,255,0.25)", borderRadius: 2 } :
             obj.type === "counter" ? { background: "rgba(140,100,60,0.18)", border: "1px solid rgba(140,100,60,0.35)", borderRadius: 3 } :
             { background: "transparent" }),
        }}>
          {obj.label?.trim() && (
            <span style={{ fontSize: "clamp(7px,1.1%,11px)", color: "rgba(255,255,255,0.32)", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              {obj.label.trim()}
            </span>
          )}
        </div>
      ))}
      {/* Tables */}
      {tables.map(t => {
        const baseStyle: React.CSSProperties = {
          position: "absolute",
          left: `${t.x - t.w / 2}%`, top: `${t.y - t.h / 2}%`,
          width: `${t.w}%`, height: `${t.h}%`,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexDirection: "column", boxSizing: "border-box",
          background: "rgba(34,197,94,0.08)",
          border: "1px solid rgba(34,197,94,0.3)",
          borderRadius: t.shape === "circle" ? "50%" : t.shape === "booth" ? "4px 4px 0 0" : "5px",
        }
        if (t.shape === "diamond") {
          baseStyle.clipPath = "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)"
          baseStyle.borderRadius = 0
          baseStyle.border = "none"
          baseStyle.background = "rgba(34,197,94,0.12)"
        }
        return (
          <div key={t.id} style={baseStyle}>
            <div style={{ fontSize: "clamp(7px,1.3%,12px)", fontWeight: 700, color: "rgba(255,255,255,0.85)", lineHeight: 1, textAlign: "center" }}>
              {t.label || t.number}
            </div>
          </div>
        )
      })}
      {tables.length === 0 && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ color: "rgba(255,255,255,0.18)", fontSize: 13 }}>No floor plan configured</div>
        </div>
      )}
    </div>
  )
}

// ── Table Designer ─────────────────────────────────────────────────────────────
function TableDesigner({ tables, walls, objects, onChange, onObjectsChange, aspectRatio = 1.62 }: {
  tables: FloorTable[]
  walls?: FloorWall[]
  objects?: FloorObject[]
  onChange: (tables: FloorTable[]) => void
  onObjectsChange?: (objects: FloorObject[]) => void
  aspectRatio?: number
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [selType, setSelType] = useState<"table"|"object">("table")
  const [addMode, setAddMode] = useState<"table"|"object"|null>(null)
  const [newTbl, setNewTbl] = useState({ label: "", capacity: "4", shape: "rect" as FloorTable["shape"] })
  const [newObj, setNewObj] = useState({ type: "door", label: "" })
  const canvasRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: string; kind: "table"|"object"; startX: number; startY: number; ox: number; oy: number } | null>(null)
  const resizing = useRef<{ id: string; kind: "table"|"object"; handle: string; startX: number; startY: number; ox: number; oy: number; ow: number; oh: number } | null>(null)
  const objs = objects || []

  const selectedTable = selType === "table" ? tables.find(t => t.id === selected) : undefined
  const selectedObj   = selType === "object" ? objs.find(o => o.id === selected) : undefined

  function handleCanvasClick(e: React.MouseEvent) {
    if (drag.current || resizing.current) return
    if ((e.target as HTMLElement).closest("[data-item]")) return
    setSelected(null)
    if (!canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const xPct = ((e.clientX - rect.left) / rect.width * 100)
    const yPct = ((e.clientY - rect.top) / rect.height * 100)

    if (addMode === "table") {
      const nextNum = tables.length ? Math.max(...tables.map(t => t.number)) + 1 : 1
      const lbl = newTbl.label.trim() || String(nextNum)
      const isSmall = newTbl.shape === "circle" || newTbl.shape === "diamond"
      const w = isSmall ? 6 : newTbl.shape === "booth" ? 14 : 8
      const h = isSmall ? 6 : newTbl.shape === "booth" ? 5 : 8
      const t: FloorTable = {
        id: nanoid(), number: nextNum, label: lbl,
        capacity: parseInt(newTbl.capacity) || 4, shape: newTbl.shape,
        x: Math.max(w/2, Math.min(100-w/2, xPct)),
        y: Math.max(h/2, Math.min(100-h/2, yPct)),
        w, h,
      }
      onChange([...tables, t])
      setNewTbl(prev => ({ ...prev, label: "" }))
    } else if (addMode === "object" && onObjectsChange) {
      const w = newObj.type === "door" ? 8 : newObj.type === "bar" ? 20 : 12
      const h = newObj.type === "door" ? 4 : newObj.type === "bar" ? 6 : 3
      const o: FloorObject = {
        id: nanoid(), type: newObj.type, label: newObj.label,
        x: Math.max(0, Math.min(100-w, xPct - w/2)),
        y: Math.max(0, Math.min(100-h, yPct - h/2)),
        w, h,
      }
      onObjectsChange([...objs, o])
      setNewObj(prev => ({ ...prev, label: "" }))
    }
  }

  function startDrag(e: React.MouseEvent, id: string, kind: "table"|"object") {
    e.stopPropagation()
    if (!canvasRef.current) return
    const item = kind === "table" ? tables.find(t => t.id === id) : objs.find(o => o.id === id)
    if (!item) return
    drag.current = { id, kind, startX: e.clientX, startY: e.clientY, ox: item.x, oy: item.y }
    setSelected(id); setSelType(kind)
    const onMove = (me: MouseEvent) => {
      if (!drag.current || !canvasRef.current) return
      const r = canvasRef.current.getBoundingClientRect()
      const dx = (me.clientX - drag.current.startX) / r.width * 100
      const dy = (me.clientY - drag.current.startY) / r.height * 100
      if (drag.current.kind === "table") {
        onChange(tables.map(t => t.id === drag.current!.id
          ? { ...t, x: Math.max(t.w/2, Math.min(100-t.w/2, drag.current!.ox + dx)), y: Math.max(t.h/2, Math.min(100-t.h/2, drag.current!.oy + dy)) }
          : t))
      } else if (onObjectsChange) {
        const tgt = objs.find(o => o.id === drag.current!.id)
        if (tgt) onObjectsChange(objs.map(o => o.id === drag.current!.id
          ? { ...o, x: Math.max(0, Math.min(100-o.w, drag.current!.ox + dx)), y: Math.max(0, Math.min(100-o.h, drag.current!.oy + dy)) }
          : o))
      }
    }
    const onUp = () => { drag.current = null; window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp) }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
  }

  function startResize(e: React.MouseEvent, id: string, kind: "table"|"object", handle: string) {
    e.stopPropagation()
    if (!canvasRef.current) return
    const item = kind === "table" ? tables.find(t => t.id === id) : objs.find(o => o.id === id)
    if (!item) return
    resizing.current = { id, kind, handle, startX: e.clientX, startY: e.clientY, ox: item.x, oy: item.y, ow: item.w, oh: item.h }
    const onMove = (me: MouseEvent) => {
      if (!resizing.current || !canvasRef.current) return
      const r = canvasRef.current.getBoundingClientRect()
      const dx = (me.clientX - resizing.current.startX) / r.width * 100
      const dy = (me.clientY - resizing.current.startY) / r.height * 100
      const { ox, oy, ow, oh, handle: h } = resizing.current
      let nx = ox, ny = oy, nw = ow, nh = oh
      if (h.includes("e")) nw = Math.max(4, ow + dx)
      if (h.includes("w")) { nw = Math.max(4, ow - dx); nx = ox + (ow - nw) }
      if (h.includes("s")) nh = Math.max(3, oh + dy)
      if (h.includes("n")) { nh = Math.max(3, oh - dy); ny = oy + (oh - nh) }
      if (resizing.current.kind === "table") {
        onChange(tables.map(t => t.id === resizing.current!.id ? { ...t, x: nx + nw/2, y: ny + nh/2, w: nw, h: nh } : t))
      } else if (onObjectsChange) {
        onObjectsChange(objs.map(o => o.id === resizing.current!.id ? { ...o, x: nx, y: ny, w: nw, h: nh } : o))
      }
    }
    const onUp = () => { resizing.current = null; window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp) }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
  }

  const deleteSelected = useCallback(() => {
    if (!selected) return
    if (selType === "table") { onChange(tables.filter(t => t.id !== selected)); setSelected(null) }
    else if (selType === "object" && onObjectsChange) { onObjectsChange(objs.filter(o => o.id !== selected)); setSelected(null) }
  }, [onChange, onObjectsChange, tables, objs, selected, selType])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selected && !((e.target as HTMLElement)?.tagName?.match(/INPUT|TEXTAREA|SELECT/i))) deleteSelected()
      if (e.key === "Escape") { setSelected(null); setAddMode(null) }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [selected, deleteSelected])

  function updateTable(patch: Partial<FloorTable>) {
    onChange(tables.map(t => t.id === selected ? { ...t, ...patch } : t))
  }
  function updateObj(patch: Partial<FloorObject>) {
    if (onObjectsChange) onObjectsChange(objs.map(o => o.id === selected ? { ...o, ...patch } : o))
  }

  const shapeStyle = (t: FloorTable, isSel: boolean): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: "absolute",
      left: `${t.x - t.w/2}%`, top: `${t.y - t.h/2}%`,
      width: `${t.w}%`, height: `${t.h}%`,
      background: isSel ? "rgba(96,165,250,0.25)" : "rgba(255,255,255,0.12)",
      border: `2px solid ${isSel ? D.blue : "rgba(255,255,255,0.22)"}`,
      display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column",
      cursor: "grab", userSelect: "none", transition: "border-color 0.12s", boxSizing: "border-box",
    }
    if (t.shape === "circle") base.borderRadius = "50%"
    else if (t.shape === "diamond") { base.clipPath = "polygon(50% 0%,100% 50%,50% 100%,0% 50%)"; base.borderRadius = 0; base.border = "none"; base.background = isSel ? "rgba(96,165,250,0.35)" : "rgba(255,255,255,0.18)" }
    else if (t.shape === "booth") base.borderRadius = "4px 4px 0 0"
    else base.borderRadius = "6px"
    return base
  }

  const objStyle = (o: FloorObject, isSel: boolean): React.CSSProperties => ({
    position: "absolute", left: `${o.x}%`, top: `${o.y}%`, width: `${o.w}%`, height: `${o.h}%`,
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "grab", userSelect: "none", boxSizing: "border-box",
    border: `2px solid ${isSel ? D.blue : (
      o.type === "door" ? "rgba(20,180,180,0.5)" :
      o.type === "bar"  ? "rgba(140,100,60,0.5)" :
      o.type === "window" ? "rgba(100,160,255,0.4)" :
      o.type === "host-stand" ? "rgba(167,139,250,0.5)" :
      "rgba(255,255,255,0.3)"
    )}`,
    background: isSel ? "rgba(96,165,250,0.15)" : (
      o.type === "door" ? "rgba(20,180,180,0.12)" :
      o.type === "bar"  ? "rgba(140,100,60,0.18)" :
      o.type === "window" ? "rgba(100,160,255,0.10)" :
      o.type === "host-stand" ? "rgba(167,139,250,0.12)" :
      "rgba(255,255,255,0.05)"
    ),
    borderRadius: 4,
  })

  // Resize handle positions: 8 handles per item
  const handles = ["n","ne","e","se","s","sw","w","nw"]
  const handlePos = (h: string): React.CSSProperties => {
    const center = "50%", near = "-5px", far = "calc(100% + 1px)"
    const map: Record<string, [string,string]> = {
      n: [center, near], ne: [far, near], e: [far, center], se: [far, far],
      s: [center, far], sw: [near, far], w: [near, center], nw: [near, near],
    }
    const [l, t] = map[h]
    return { position: "absolute", left: l, top: t, width: 9, height: 9, borderRadius: 2,
      background: D.blue, border: "1.5px solid #fff", cursor: `${h}-resize`, transform: "translate(-50%,-50%)", zIndex: 10, flexShrink: 0 }
  }

  const objectTypeOptions = [
    { value: "door", label: "🚪 Door" },
    { value: "bar",  label: "🍺 Bar" },
    { value: "window", label: "🪟 Window" },
    { value: "host-stand", label: "🖥 Host Stand" },
    { value: "wall", label: "▬ Wall" },
    { value: "label", label: "🏷 Label" },
  ]

  return (
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
      {/* Left controls */}
      <div style={{ width: 210, flexShrink: 0, display: "flex", flexDirection: "column", gap: 10 }}>

        {/* Add Table panel */}
        <div style={{ background: D.surface, border: `1px solid ${addMode === "table" ? D.blue : D.border}`, borderRadius: 10, padding: 14, transition: "border-color 0.15s" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: D.muted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Add Table</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input placeholder="Label (e.g. A, B, 12, Bar)" value={newTbl.label} onChange={e => setNewTbl(p => ({ ...p, label: e.target.value }))} style={inputSm} />
            <select value={newTbl.capacity} onChange={e => setNewTbl(p => ({ ...p, capacity: e.target.value }))} style={inputSm}>
              {[1,2,3,4,5,6,7,8,10,12].map(n => <option key={n} value={n}>{n} guests</option>)}
            </select>
            <select value={newTbl.shape} onChange={e => setNewTbl(p => ({ ...p, shape: e.target.value as FloorTable["shape"] }))} style={inputSm}>
              <option value="rect">Square / Rect</option>
              <option value="circle">Round</option>
              <option value="booth">Booth</option>
              <option value="diamond">Diamond</option>
            </select>
            <button onClick={() => setAddMode(m => m === "table" ? null : "table")}
              style={{ padding: "7px 0", borderRadius: 6, border: `1px solid ${addMode === "table" ? D.blue : D.border}`,
                background: addMode === "table" ? D.blueBg : "transparent", color: addMode === "table" ? D.blue : D.text2,
                fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              {addMode === "table" ? "🖱 Click canvas to place" : "+ Add Table"}
            </button>
          </div>
        </div>

        {/* Add Object panel */}
        <div style={{ background: D.surface, border: `1px solid ${addMode === "object" ? D.purple : D.border}`, borderRadius: 10, padding: 14, transition: "border-color 0.15s" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: D.muted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Add Shape</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <select value={newObj.type} onChange={e => setNewObj(p => ({ ...p, type: e.target.value }))} style={inputSm}>
              {objectTypeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <input placeholder="Label (optional)" value={newObj.label} onChange={e => setNewObj(p => ({ ...p, label: e.target.value }))} style={inputSm} />
            <button onClick={() => setAddMode(m => m === "object" ? null : "object")}
              disabled={!onObjectsChange}
              style={{ padding: "7px 0", borderRadius: 6, border: `1px solid ${addMode === "object" ? D.purple : D.border}`,
                background: addMode === "object" ? D.purpleBg : "transparent", color: addMode === "object" ? D.purple : D.text2,
                fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              {addMode === "object" ? "🖱 Click canvas to place" : "+ Add Shape"}
            </button>
          </div>
        </div>

        {/* Edit selected table */}
        {selectedTable && (
          <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: D.muted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Edit Table</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input placeholder="Label" value={selectedTable.label} onChange={e => updateTable({ label: e.target.value, number: isNaN(parseInt(e.target.value)) ? selectedTable.number : parseInt(e.target.value) })} style={inputSm} />
              <select value={selectedTable.capacity} onChange={e => updateTable({ capacity: parseInt(e.target.value) })} style={inputSm}>
                {[1,2,3,4,5,6,7,8,10,12].map(n => <option key={n} value={n}>{n} guests</option>)}
              </select>
              <select value={selectedTable.shape} onChange={e => updateTable({ shape: e.target.value as FloorTable["shape"] })} style={inputSm}>
                <option value="rect">Square / Rect</option>
                <option value="circle">Round</option>
                <option value="booth">Booth</option>
                <option value="diamond">Diamond</option>
              </select>
              <div style={{ fontSize: 11, color: D.muted }}>Drag corners to resize</div>
              <button onClick={deleteSelected}
                style={{ padding: "7px 0", borderRadius: 6, border: `1px solid ${D.red}40`, background: D.redBg, color: D.red, fontSize: 12, fontWeight: 600, cursor: "pointer", marginTop: 4 }}>
                🗑 Delete
              </button>
            </div>
          </div>
        )}

        {/* Edit selected object */}
        {selectedObj && (
          <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: D.muted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Edit Shape</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <select value={selectedObj.type} onChange={e => updateObj({ type: e.target.value })} style={inputSm}>
                {objectTypeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <input placeholder="Label" value={selectedObj.label} onChange={e => updateObj({ label: e.target.value })} style={inputSm} />
              <div style={{ fontSize: 11, color: D.muted }}>Drag corners to resize</div>
              <button onClick={deleteSelected}
                style={{ padding: "7px 0", borderRadius: 6, border: `1px solid ${D.red}40`, background: D.redBg, color: D.red, fontSize: 12, fontWeight: 600, cursor: "pointer", marginTop: 4 }}>
                🗑 Delete Shape
              </button>
            </div>
          </div>
        )}

        {/* Arrange panel */}
        <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: D.muted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Arrange</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <button onClick={() => {
              if (tables.length === 0) return
              const minX = Math.min(...tables.map(t => t.x - t.w / 2))
              const maxX = Math.max(...tables.map(t => t.x + t.w / 2))
              const minY = Math.min(...tables.map(t => t.y - t.h / 2))
              const maxY = Math.max(...tables.map(t => t.y + t.h / 2))
              const dx = 50 - (minX + maxX) / 2
              const dy = 50 - (minY + maxY) / 2
              onChange(tables.map(t => ({ ...t, x: Math.max(t.w/2, Math.min(100-t.w/2, t.x + dx)), y: Math.max(t.h/2, Math.min(100-t.h/2, t.y + dy)) })))
            }} style={{ padding: "6px 0", borderRadius: 6, border: `1px solid ${D.border}`, background: "transparent", color: D.text2, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              ⊞ Center All
            </button>
            {selectedTable && (
              <>
                <div style={{ fontSize: 10, color: D.muted, marginTop: 2 }}>Align selected to edge:</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
                  {[
                    { label: "⬅", title: "Align left",     fn: () => updateTable({ x: selectedTable.w / 2 }) },
                    { label: "↔", title: "Center horiz",   fn: () => updateTable({ x: 50 }) },
                    { label: "➡", title: "Align right",    fn: () => updateTable({ x: 100 - selectedTable.w / 2 }) },
                    { label: "⬆", title: "Align top",      fn: () => updateTable({ y: selectedTable.h / 2 }) },
                    { label: "↕", title: "Center vert",    fn: () => updateTable({ y: 50 }) },
                    { label: "⬇", title: "Align bottom",   fn: () => updateTable({ y: 100 - selectedTable.h / 2 }) },
                  ].map(({ label, title, fn }) => (
                    <button key={title} onClick={fn} title={title}
                      style={{ padding: "5px 0", borderRadius: 5, border: `1px solid ${D.border}`, background: "transparent", color: D.text2, fontSize: 13, cursor: "pointer" }}>
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}
            {!selectedTable && <div style={{ fontSize: 11, color: D.muted }}>Select a table to align it</div>}
          </div>
        </div>

        {!selectedTable && !selectedObj && (
          <div style={{ color: D.muted, fontSize: 12, padding: "6px 4px" }}>Click to select · Drag to move · Drag corner to resize · Del to delete</div>
        )}
      </div>

      {/* Canvas */}
      <div style={{ flex: 1 }}>
      <div ref={canvasRef} onClick={handleCanvasClick}
        style={{ width: "100%", aspectRatio: String(aspectRatio), background: "rgba(0,0,0,0.45)",
          border: `2px dashed ${addMode === "table" ? D.blue : addMode === "object" ? D.purple : D.border}`,
          borderRadius: 12, position: "relative", overflow: "hidden",
          cursor: addMode ? "crosshair" : "default", transition: "border-color 0.15s" }}>

        {/* Objects (non-table shapes) */}
        {objs.map(o => {
          const isSel = selected === o.id && selType === "object"
          return (
            <div key={o.id} data-item="1" style={objStyle(o, isSel)}
              onMouseDown={e => startDrag(e, o.id, "object")}>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.6)", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", pointerEvents: "none" }}>
                {o.label || o.type}
              </span>
              {isSel && handles.map(h => (
                <div key={h} style={handlePos(h)} onMouseDown={e => startResize(e, o.id, "object", h)} />
              ))}
            </div>
          )
        })}

        {/* Tables */}
        {tables.map(t => {
          const isSel = selected === t.id && selType === "table"
          return (
            <div key={t.id} data-item="1" style={shapeStyle(t, isSel)}
              onMouseDown={e => startDrag(e, t.id, "table")}>
              <div style={{ textAlign: "center", pointerEvents: "none" }}>
                <div style={{ fontSize: Math.max(9, Math.min(13, t.w * 1.2)), fontWeight: 700, color: D.text, lineHeight: 1 }}>
                  {t.label || t.number}
                </div>
                <div style={{ fontSize: Math.max(7, Math.min(10, t.w)), color: D.muted, lineHeight: 1 }}>
                  {t.capacity}p
                </div>
              </div>
              {isSel && t.shape !== "circle" && t.shape !== "diamond" && handles.map(h => (
                <div key={h} style={handlePos(h)} onMouseDown={e => startResize(e, t.id, "table", h)} />
              ))}
              {isSel && t.shape === "circle" && ["ne","se","sw","nw"].map(h => (
                <div key={h} style={handlePos(h)} onMouseDown={e => startResize(e, t.id, "table", h)} />
              ))}
            </div>
          )
        })}

        {tables.length === 0 && objs.length === 0 && !addMode && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🗺</div>
            <div style={{ color: D.muted, fontSize: 14 }}>Click &quot;+ Add Table&quot; or &quot;+ Add Shape&quot; then click here to place</div>
          </div>
        )}

        {addMode === "table" && (
          <div style={{ position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)",
            background: D.blueBg, border: `1px solid ${D.blueBorder}`, borderRadius: 20,
            padding: "4px 14px", fontSize: 11, color: D.blue, fontWeight: 600, pointerEvents: "none" }}>
            Click to place table {newTbl.label || `#${tables.length + 1}`}
          </div>
        )}
        {addMode === "object" && (
          <div style={{ position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)",
            background: D.purpleBg, border: `1px solid rgba(167,139,250,0.3)`, borderRadius: 20,
            padding: "4px 14px", fontSize: 11, color: D.purple, fontWeight: 600, pointerEvents: "none" }}>
            Click to place {newObj.label || newObj.type}
          </div>
        )}
      </div>
      </div>
    </div>
  )
}

const inputSm: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)", border: `1px solid ${D.border}`, borderRadius: 6,
  color: D.text, padding: "6px 10px", fontSize: 12, width: "100%", boxSizing: "border-box",
  outline: "none",
}

// ── Menu Builder Error Boundary ────────────────────────────────────────────────
class MenuBuilderErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: string | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(e: unknown) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 16, background: D.redBg, border: `1px solid ${D.red}40`, borderRadius: 8, color: D.red, fontSize: 13 }}>
          ⚠ Menu editor encountered an error: {this.state.error}
          <button onClick={() => this.setState({ error: null })}
            style={{ marginLeft: 12, padding: "3px 10px", borderRadius: 6, border: `1px solid ${D.red}40`, background: "transparent", color: D.red, cursor: "pointer", fontSize: 12 }}>
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// ── Menu Builder ───────────────────────────────────────────────────────────────
function MenuBuilder({ sections, onChange }: { sections: MenuSection[]; onChange: (s: MenuSection[]) => void }) {
  const [editing, setEditing] = useState<{sectionId: string; itemId?: string} | null>(null)
  const [newSection, setNewSection] = useState("")

  // Import wizard state
  const [wizardOpen,   setWizardOpen]   = useState(false)
  const [importing,    setImporting]    = useState(false)
  const [importError,  setImportError]  = useState<string | null>(null)
  const [preview,      setPreview]      = useState<MenuSection[] | null>(null)
  const [undoSnapshot, setUndoSnapshot] = useState<MenuSection[] | null>(null)
  const [applied,      setApplied]      = useState(false)

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setImporting(true)
    setImportError(null)
    setPreview(null)
    setApplied(false)
    try {
      const fd = new FormData()
      files.forEach(f => fd.append("file", f))
      const res = await fetch("/api/owner/menu-parse", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) {
        const raw = data.error ?? data.detail ?? "Import failed"
        setImportError(typeof raw === "string" ? raw : JSON.stringify(raw))
      } else {
        // Normalize to ensure items/tags are always arrays (guards against malformed AI output)
        const raw = Array.isArray(data.sections) ? data.sections : []
        const normalized: MenuSection[] = raw.map((s: Record<string, unknown>) => ({
          id:    (s.id as string) || nanoid(),
          title: String(s.title || "Section"),
          items: (Array.isArray(s.items) ? s.items : []).map((i: Record<string, unknown>) => ({
            id:          (i.id as string) || nanoid(),
            name:        String(i.name || "Item"),
            description: String(i.description ?? ""),
            price:       String(i.price ?? ""),
            tags:        Array.isArray(i.tags) ? i.tags.map(String) : [],
          })),
        }))
        if (normalized.length === 0) {
          setImportError("AI could not find any menu sections in the uploaded files.")
        } else {
          setPreview(normalized)
        }
      }
    } catch {
      setImportError("Network error — could not reach server")
    } finally {
      setImporting(false)
      e.target.value = ""
    }
  }

  function applyImport() {
    if (!preview) return
    setUndoSnapshot(sections)
    onChange(preview)
    setApplied(true)
    setPreview(null)
  }

  function undoImport() {
    if (!undoSnapshot) return
    onChange(undoSnapshot)
    setUndoSnapshot(null)
    setApplied(false)
  }

  function cancelWizard() {
    setWizardOpen(false)
    setPreview(null)
    setImportError(null)
    setImporting(false)
    setApplied(false)
  }

  function addSection() {
    if (!newSection.trim()) return
    onChange([...sections, { id: nanoid(), title: newSection.trim(), items: [] }])
    setNewSection("")
  }

  function addItem(sectionId: string) {
    onChange(sections.map(s => s.id === sectionId
      ? { ...s, items: [...(s.items ?? []), { id: nanoid(), name: "New Item", description: "", price: "", tags: [] }] }
      : s
    ))
  }

  function updateItem(sectionId: string, itemId: string, patch: Partial<MenuItem>) {
    onChange(sections.map(s => s.id === sectionId
      ? { ...s, items: (s.items ?? []).map(i => i.id === itemId ? { ...i, ...patch } : i) }
      : s
    ))
  }

  function deleteItem(sectionId: string, itemId: string) {
    onChange(sections.map(s => s.id === sectionId ? { ...s, items: (s.items ?? []).filter(i => i.id !== itemId) } : s))
  }

  function deleteSection(sectionId: string) {
    onChange(sections.filter(s => s.id !== sectionId))
  }

  function updateSectionTitle(sectionId: string, title: string) {
    onChange(sections.map(s => s.id === sectionId ? { ...s, title } : s))
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* AI Import Wizard */}
      <div style={{ background: D.surface, border: `1px solid ${D.blueBorder}`, borderRadius: 12, overflow: "hidden" }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: wizardOpen ? `1px solid ${D.border}` : "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>✨</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: D.text }}>AI Menu Import</div>
              <div style={{ fontSize: 11, color: D.muted }}>Upload a photo or document to auto-populate the menu</div>
            </div>
          </div>
          {!wizardOpen ? (
            <button onClick={() => { setWizardOpen(true); setApplied(false) }}
              style={{ padding: "7px 16px", borderRadius: 8, border: `1px solid ${D.blueBorder}`,
                background: D.blueBg, color: D.blue, fontSize: 12, fontWeight: 700,
                cursor: "pointer", whiteSpace: "nowrap" }}>
              Open Wizard
            </button>
          ) : (
            <button onClick={cancelWizard}
              style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${D.border}`,
                background: "transparent", color: D.muted, fontSize: 12, cursor: "pointer" }}>
              ✕ Close
            </button>
          )}
        </div>

        {/* Wizard body — only visible when open */}
        {wizardOpen && (
          <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
            {!importing && !preview && !applied && (
              <div>
                <label style={{ display: "block", fontSize: 12, color: D.text2, marginBottom: 8 }}>
                  Select one or more files (JPG, PNG, WEBP, PDF, TXT) — select all pages at once:
                </label>
                <input type="file" accept="image/*,.pdf,.txt,.csv" multiple
                  onChange={handleImportFile}
                  style={{ fontSize: 12, color: D.text2, cursor: "pointer" }} />
              </div>
            )}

            {importing && (
              <div style={{ fontSize: 13, color: D.blue, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⟳</span>
                Parsing menu with AI… (this may take a few seconds)
              </div>
            )}

            {importError && (
              <div style={{ fontSize: 12, color: D.red, background: D.redBg, borderRadius: 6,
                padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
                <span>⚠</span> {importError}
                <button onClick={() => setImportError(null)}
                  style={{ marginLeft: "auto", background: "transparent", border: "none",
                    color: D.muted, cursor: "pointer", fontSize: 12 }}>
                  Retry
                </button>
              </div>
            )}

            {preview && !applied && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 13, color: D.text, background: D.greenBg,
                  border: `1px solid ${D.greenBorder}`, borderRadius: 6, padding: "8px 12px" }}>
                  Found <strong>{preview.length}</strong> section{preview.length !== 1 ? "s" : ""} with{" "}
                  <strong>{preview.reduce((n, s) => n + (s.items?.length ?? 0), 0)}</strong> items.
                  Apply to replace current menu?
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={applyImport}
                    style={{ padding: "7px 16px", borderRadius: 8, border: `1px solid ${D.green}40`,
                      background: D.greenBg, color: D.green, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    ✓ Apply
                  </button>
                  <button onClick={() => { setPreview(null); setImportError(null) }}
                    style={{ padding: "7px 12px", borderRadius: 8, border: `1px solid ${D.border}`,
                      background: "transparent", color: D.text2, fontSize: 13, cursor: "pointer" }}>
                    Discard
                  </button>
                </div>
              </div>
            )}

            {applied && undoSnapshot && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                <span style={{ color: D.green }}>✓ Menu imported — edit below, then Save Menu.</span>
                <button onClick={undoImport}
                  style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${D.border}`,
                    background: "transparent", color: D.text2, fontSize: 12, cursor: "pointer" }}>
                  Undo
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add section */}
      <div style={{ display: "flex", gap: 8 }}>
        <input placeholder="New section (e.g. Breakfast, Lunch, Drinks)"
          value={newSection} onChange={e => setNewSection(e.target.value)}
          onKeyDown={e => e.key === "Enter" && addSection()}
          style={{ ...inputSm, flex: 1, padding: "9px 12px", fontSize: 13 }} />
        <button onClick={addSection}
          style={{ padding: "9px 16px", borderRadius: 8, border: `1px solid ${D.green}40`,
            background: D.greenBg, color: D.green, fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>
          + Section
        </button>
      </div>

      {sections.length === 0 && (
        <div style={{ textAlign: "center", color: D.muted, fontSize: 13, padding: "24px 0" }}>
          Add sections to build your menu (e.g. Breakfast, Lunch, Beverages)
        </div>
      )}

      {sections.map(section => (
        <div key={section.id} style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, overflow: "hidden" }}>
          {/* Section header */}
          <div style={{ display: "flex", alignItems: "center", padding: "12px 16px", borderBottom: `1px solid ${D.border}`, gap: 10 }}>
            <input value={section.title} onChange={e => updateSectionTitle(section.id, e.target.value)}
              style={{ ...inputSm, flex: 1, fontWeight: 700, fontSize: 14, padding: "4px 8px" }} />
            <button onClick={() => addItem(section.id)}
              style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${D.border}`,
                background: "transparent", color: D.text2, fontSize: 12, cursor: "pointer" }}>
              + Item
            </button>
            <button onClick={() => deleteSection(section.id)}
              style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${D.red}30`,
                background: D.redBg, color: D.red, fontSize: 12, cursor: "pointer" }}>
              ✕
            </button>
          </div>

          {/* Items */}
          {(section.items ?? []).map(item => (
            <div key={item.id} style={{ padding: "12px 16px", borderBottom: `1px solid ${D.border}` }}>
              {editing?.sectionId === section.id && editing?.itemId === item.id ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input placeholder="Item name" value={item.name} onChange={e => updateItem(section.id, item.id, { name: e.target.value })} style={{ ...inputSm, flex: 2 }} />
                    <input placeholder="Price" value={item.price} onChange={e => updateItem(section.id, item.id, { price: e.target.value })} style={{ ...inputSm, flex: 1 }} />
                  </div>
                  <input placeholder="Description" value={item.description} onChange={e => updateItem(section.id, item.id, { description: e.target.value })} style={inputSm} />
                  <input placeholder="Tags (comma-separated: GF, Vegan, Spicy)" value={(item.tags ?? []).join(", ")}
                    onChange={e => updateItem(section.id, item.id, { tags: e.target.value.split(",").map(t => t.trim()).filter(Boolean) })}
                    style={inputSm} />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setEditing(null)}
                      style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${D.green}40`,
                        background: D.greenBg, color: D.green, fontSize: 12, cursor: "pointer" }}>
                      Done
                    </button>
                    <button onClick={() => { deleteItem(section.id, item.id); setEditing(null) }}
                      style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${D.red}30`,
                        background: D.redBg, color: D.red, fontSize: 12, cursor: "pointer" }}>
                      Delete
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
                  onClick={() => setEditing({ sectionId: section.id, itemId: item.id })}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: D.text }}>{item.name}</span>
                    {item.description && <span style={{ fontSize: 12, color: D.text2, marginLeft: 8 }}>{item.description}</span>}
                    {(item.tags ?? []).map(tag => (
                      <span key={tag} style={{ marginLeft: 6, fontSize: 10, color: D.orange, background: D.orangeBg, borderRadius: 10, padding: "1px 7px" }}>{tag}</span>
                    ))}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {item.price && <span style={{ fontSize: 13, fontWeight: 700, color: D.text }}>{item.price}</span>}
                    <span style={{ fontSize: 11, color: D.muted }}>Edit</span>
                  </div>
                </div>
              )}
            </div>
          ))}

          {!(section.items?.length) && (
            <div style={{ padding: "12px 16px", color: D.muted, fontSize: 12 }}>No items — click &quot;+ Item&quot; to add</div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── New Client Wizard ──────────────────────────────────────────────────────────
function NewClientWizard({ token, onDone, onCancel }: {
  token: string
  onDone: (client: { id: string; name: string; slug: string; join_url: string; station_url: string }) => void
  onCancel: () => void
}) {
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  // Step 1 — Basic info
  const [clientGroup,  setClientGroup]  = useState("")
  const [name,         setName]         = useState("")
  const [slug,         setSlug]         = useState("")
  const [city,         setCity]         = useState("")
  const [address,      setAddress]      = useState("")
  const [contactName,  setContactName]  = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [planType,     setPlanType]     = useState("standard")
  const [monthlyFee,   setMonthlyFee]   = useState("0")
  const [locationCount, setLocationCount] = useState("1")

  // Step 2 — Table layout
  const [floorTables, setFloorTables] = useState<FloorTable[]>([])
  const [floorObjects, setFloorObjects] = useState<FloorObject[]>([])

  // Step 1 — Website auto-build
  const [websiteUrl,   setWebsiteUrl]   = useState("")
  const [scraping,     setScraping]     = useState(false)
  const [scrapeMsg,    setScrapeMsg]    = useState<{ type: "ok" | "err"; text: string } | null>(null)
  const [scrapeBanner, setScrapeBanner] = useState("")   // shown in step 2 after auto-build

  // Step 3 — Guest page
  const [bgColor,      setBgColor]      = useState("#000000")
  const [accentColor,  setAccentColor]  = useState("#ffffff")
  const [logoUrl,      setLogoUrl]      = useState("")
  const [tagline,      setTagline]      = useState("Powered by HOST")
  const [seatedMsg,    setSeatedMsg]    = useState("Thanks for dining with us!")
  const [waitMessages, setWaitMessages] = useState("Your spot is saved — feel free to step out.\nWe'll let you know the moment your table is ready.\nSit tight, we're moving quickly.")

  // Step 4 — Menu
  const [menuSections, setMenuSections] = useState<MenuSection[]>([])

  // Step 5 — Credentials
  const [adminPin,    setAdminPin]    = useState("")
  // Login username is always the restaurant slug (shown read-only below)
  const [hvPassword,  setHvPassword]  = useState("")
  const [wifiName,    setWifiName]    = useState("")
  const [wifiPass,    setWifiPass]    = useState("")

  // Auto-generate slug from name
  function autoSlug(n: string) {
    return n.toLowerCase().replace(/[''']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
  }
  function handleNameChange(v: string) {
    setName(v)
    if (!slug || slug === autoSlug(name)) setSlug(autoSlug(v))
  }

  async function scrapeSite() {
    const url = websiteUrl.trim()
    if (!url) return
    setScraping(true); setScrapeMsg(null)
    try {
      const res = await fetch(`/api/scrape-site?url=${encodeURIComponent(url)}`)
      if (!res.ok) throw new Error("Could not reach that site")
      const d = await res.json()
      if (d.error) throw new Error(d.error)

      // Populate fields
      if (d.restaurantName) { setName(d.restaurantName); if (!slug) setSlug(autoSlug(d.restaurantName)) }
      if (d.brandColor)  setBgColor(d.brandColor)
      if (d.logoUrl)     setLogoUrl(d.logoUrl)
      if (d.menuSections?.length > 0) {
        setMenuSections(d.menuSections.map((s: { title: string; items: Array<{ name: string; description?: string; price?: string; tags?: string[] }> }) => ({
          id:    crypto.randomUUID(),
          title: s.title,
          items: s.items.map((it: { name: string; description?: string; price?: string; tags?: string[] }) => ({
            id:          crypto.randomUUID(),
            name:        it.name,
            description: it.description || "",
            price:       it.price       || "",
            tags:        it.tags        || [],
          })),
        })))
      }

      const parts: string[] = []
      if (d.restaurantName)      parts.push(`name`)
      if (d.logoUrl)             parts.push(`logo`)
      if (d.brandColor)          parts.push(`brand color`)
      if (d.menuSections?.length) parts.push(`${d.menuSections.length} menu section${d.menuSections.length === 1 ? "" : "s"}`)

      if (parts.length > 0) {
        // Auto-advance to floor map — everything else is done
        const banner = `Auto-filled from website: ${parts.join(", ")}. Now build the floor map below.`
        setScrapeBanner(banner)
        setScrapeMsg(null)
        setStep(2)
      } else {
        setScrapeMsg({ type: "ok", text: "Site scanned — couldn't extract usable data. Fill in details below." })
      }
    } catch (e: unknown) {
      setScrapeMsg({ type: "err", text: e instanceof Error ? e.message : "Failed to scan site" })
    } finally {
      setScraping(false)
    }
  }

  async function create() {
    setSaving(true); setError("")
    try {
      const r = await fetch(`${API}/owner/clients?secret=${encodeURIComponent(token)}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, slug, city, address, contact_name: contactName, contact_email: contactEmail,
          plan_type: planType, monthly_fee: parseFloat(monthlyFee) || 0,
          location_count: parseInt(locationCount) || 1,
          location_group: clientGroup.trim() || undefined,
          initial_tables: 0,
        }),
      })
      if (!r.ok) { const d = await r.json(); throw new Error(d.detail || "Failed to create client"); }
      const { restaurant_id, slug: finalSlug, join_url, station_url } = await r.json()

      // Batch-save tables if any
      if (floorTables.length > 0) {
        await fetch(`${API}/owner/clients/${restaurant_id}/tables/batch?secret=${encodeURIComponent(token)}`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tables: floorTables.map(t => ({ table_number: t.number, capacity: t.capacity, shape: t.shape, label: t.label })) }),
        })
      }

      // Save config (guest page + menu + floor plan)
      const guestConfig = {
        bgColor, accentColor, buttonTextColor: "#000000",
        restaurantName: name, tagline,
        logoUrl: logoUrl.trim() || undefined,
        waitMessages: waitMessages.split("\n").map(s => s.trim()).filter(Boolean),
        seatedMessage: seatedMsg, finalButtons: [],
        // adminPin stored in guest_config so /client/[slug]/station can validate without owner token
        adminPin: adminPin || undefined,
      }
      await fetch(`${API}/owner/clients/${restaurant_id}/config?secret=${encodeURIComponent(token)}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guest_config: guestConfig,
          menu_config: { sections: menuSections },
          floor_plan: { tables: floorTables, objects: floorObjects, canvasAspect: 1.62 },
          settings: { city, address, contact_name: contactName, contact_email: contactEmail, location_count: parseInt(locationCount) || 1, plan_type: planType, monthly_fee: parseFloat(monthlyFee) || 0 },
        }),
      })

      // Save credentials
      // Login username = slug (the restaurant's slug is the login username for the HOST app).
      const creds = [
        adminPin   && { credential_type: "admin_pin", label: "Admin PIN (4-digit dashboard access)", value: adminPin },
        hvPassword && { credential_type: "login",      label: "Host View Login",                      value: `${finalSlug}:${hvPassword}` },
        wifiName   && { credential_type: "wifi",       label: `WiFi: ${wifiName}`,                    value: wifiPass || "" },
      ].filter(Boolean) as { credential_type: string; label: string; value: string }[]
      for (const c of creds) {
        await fetch(`${API}/owner/clients/${restaurant_id}/credentials?secret=${encodeURIComponent(token)}`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(c),
        })
      }

      onDone({ id: restaurant_id, name, slug: finalSlug, join_url, station_url })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error")
    } finally {
      setSaving(false)
    }
  }

  const stepLabels = ["Info", "Floor Map", "Guest Page", "Menu", "Credentials"]

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
        <button onClick={onCancel}
          style={{ background: "none", border: "none", color: D.text2, cursor: "pointer", fontSize: 14, padding: "4px 0" }}>
          ← Cancel
        </button>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: D.text, margin: 0 }}>Add Restaurant</h1>
          <p style={{ fontSize: 13, color: D.muted, margin: "4px 0 0" }}>Configure and launch a new restaurant on HOST</p>
        </div>
      </div>

      {/* Steps */}
      <div style={{ display: "flex", gap: 0, marginBottom: 32, background: D.surface, borderRadius: 10, padding: "4px", border: `1px solid ${D.border}` }}>
        {stepLabels.map((label, i) => {
          const n = i + 1
          const active = step === n
          const done   = step > n
          return (
            <button key={n} onClick={() => n < step && setStep(n)}
              style={{ flex: 1, padding: "8px 4px", borderRadius: 8, border: "none",
                background: active ? D.surface2 : "transparent",
                color: active ? D.text : done ? D.green : D.muted,
                fontSize: 12, fontWeight: active ? 700 : 400, cursor: n < step ? "pointer" : "default" }}>
              {done ? "✓ " : ""}{label}
            </button>
          )
        })}
      </div>

      {/* Step content */}
      <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 14, padding: 28, marginBottom: 20 }}>

        {/* Step 1 — Basic Info */}
        {step === 1 && (
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: D.text, margin: "0 0 20px" }}>Restaurant Information</h2>

            {/* ── Website auto-build ── */}
            <div style={{ background: D.surface2, border: `1px solid ${D.border}`, borderRadius: 10, padding: 16, marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: D.text, marginBottom: 8 }}>✨ Auto-build from website <span style={{ fontSize: 11, color: D.muted, fontWeight: 400 }}>— paste the restaurant&apos;s URL to prefill name, logo, brand color &amp; menu</span></div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={websiteUrl}
                  onChange={e => setWebsiteUrl(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && scrapeSite()}
                  placeholder="https://restaurant.com"
                  style={{ flex: 1, background: D.bg, border: `1px solid ${D.border}`, borderRadius: 8, padding: "9px 12px", color: D.text, fontSize: 14, outline: "none" }}
                />
                <button
                  onClick={scrapeSite}
                  disabled={scraping || !websiteUrl.trim()}
                  style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: scraping || !websiteUrl.trim() ? D.muted : D.blue, color: "#fff", fontSize: 13, fontWeight: 600, cursor: scraping || !websiteUrl.trim() ? "default" : "pointer", whiteSpace: "nowrap" }}
                >
                  {scraping ? "Scanning…" : "Auto-build →"}
                </button>
              </div>
              {scrapeMsg && (
                <div style={{ marginTop: 10, fontSize: 12, color: scrapeMsg.type === "ok" ? D.green : D.red }}>
                  {scrapeMsg.type === "ok" ? "✓ " : "✗ "}{scrapeMsg.text}
                </div>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div style={{ gridColumn: "1/-1" }}>
                <FieldLabel>Restaurant Name *</FieldLabel>
                <Input value={name} onChange={handleNameChange} placeholder="The Walnut Cafe" />
              </div>
              <div>
                <FieldLabel>URL Slug *</FieldLabel>
                <Input value={slug} onChange={setSlug} placeholder="walnut-cafe" />
                {slug && <div style={{ fontSize: 11, color: D.muted, marginTop: 4 }}>hostplatform.net/client/<strong style={{color:D.blue}}>{slug}</strong>/join</div>}
              </div>
              <div>
                <FieldLabel>City</FieldLabel>
                <Input value={city} onChange={setCity} placeholder="Boulder, CO" />
              </div>
              <div>
                <FieldLabel>Client / Company Group</FieldLabel>
                <Input value={clientGroup} onChange={setClientGroup} placeholder="e.g. walnut (leave blank if standalone)" />
                <div style={{ fontSize: 11, color: D.muted, marginTop: 4 }}>Multiple restaurants with the same group name appear grouped in Clients</div>
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <FieldLabel>Address</FieldLabel>
                <Input value={address} onChange={setAddress} placeholder="3073 Walnut St, Boulder, CO 80301" />
              </div>
              <div>
                <FieldLabel>Contact Name</FieldLabel>
                <Input value={contactName} onChange={setContactName} placeholder="Jane Smith" />
              </div>
              <div>
                <FieldLabel>Contact Email</FieldLabel>
                <Input value={contactEmail} onChange={setContactEmail} placeholder="jane@restaurant.com" type="email" />
              </div>
              <div>
                <FieldLabel>Plan</FieldLabel>
                <select value={planType} onChange={e => setPlanType(e.target.value)} style={selectStyle}>
                  <option value="free-partner">Free Partner</option>
                  <option value="standard">Standard</option>
                  <option value="multi">Multi-Location</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <div>
                <FieldLabel>Monthly Fee ($)</FieldLabel>
                <Input value={monthlyFee} onChange={setMonthlyFee} placeholder="0" type="number" />
              </div>
              <div>
                <FieldLabel>Number of Locations</FieldLabel>
                <Input value={locationCount} onChange={setLocationCount} placeholder="1" type="number" />
              </div>
            </div>
          </div>
        )}

        {/* Step 2 — Floor Map */}
        {step === 2 && (
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: D.text, margin: "0 0 6px" }}>Floor Map</h2>
            {scrapeBanner ? (
              <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "0 0 16px", padding: "12px 14px", background: D.greenBg, border: `1px solid ${D.greenBorder}`, borderRadius: 10 }}>
                {logoUrl && (
                  <img src={logoUrl} alt={name || "Logo"} style={{ width: 52, height: 52, objectFit: "contain", borderRadius: 8, flexShrink: 0, background: "rgba(255,255,255,0.08)" }} />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: D.green, fontWeight: 600 }}>✓ {scrapeBanner}</div>
                  <div style={{ fontSize: 12, color: D.text2, marginTop: 3 }}>Guest page, colors &amp; menu are ready — review in the next steps if needed. This is the only manual step.</div>
                </div>
              </div>
            ) : (
              <p style={{ fontSize: 13, color: D.text2, margin: "0 0 20px" }}>Design the table layout. Drag tables to position them. You can skip this and set it up later.</p>
            )}
            <TableDesigner tables={floorTables} objects={floorObjects} onChange={setFloorTables} onObjectsChange={setFloorObjects} />
          </div>
        )}

        {/* Step 3 — Guest Page */}
        {step === 3 && (
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: D.text, margin: "0 0 20px" }}>Guest Page</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <FieldLabel>Background Color</FieldLabel>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)}
                    style={{ width: 40, height: 34, borderRadius: 6, border: `1px solid ${D.border}`, cursor: "pointer", padding: 2, background: "none" }} />
                  <Input value={bgColor} onChange={setBgColor} placeholder="#000000" />
                </div>
              </div>
              <div>
                <FieldLabel>Button Color</FieldLabel>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)}
                    style={{ width: 40, height: 34, borderRadius: 6, border: `1px solid ${D.border}`, cursor: "pointer", padding: 2, background: "none" }} />
                  <Input value={accentColor} onChange={setAccentColor} placeholder="#ffffff" />
                </div>
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <FieldLabel>Logo URL</FieldLabel>
                <Input value={logoUrl} onChange={setLogoUrl} placeholder="https://restaurant.com/logo.png (auto-filled from website scan)" />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <FieldLabel>Tagline</FieldLabel>
                <Input value={tagline} onChange={setTagline} placeholder="Powered by HOST" />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <FieldLabel>Wait Messages (one per line)</FieldLabel>
                <textarea value={waitMessages} onChange={e => setWaitMessages(e.target.value)} rows={4}
                  style={{ ...inputFull, resize: "vertical" } as React.CSSProperties}
                  placeholder="Your spot is saved — feel free to step out." />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <FieldLabel>Seated / Thank You Message</FieldLabel>
                <Input value={seatedMsg} onChange={setSeatedMsg} placeholder="Thanks for dining with us!" />
              </div>
            </div>
            {/* Preview chip */}
            <div style={{ marginTop: 20, padding: 24, borderRadius: 12, background: bgColor, border: `1px solid ${D.border}`, textAlign: "center" }}>
              {logoUrl && (
                <img src={logoUrl} alt={name || "Logo"}
                  style={{ width: 80, height: 80, objectFit: "contain", borderRadius: 10, marginBottom: 12, display: "block", marginLeft: "auto", marginRight: "auto" }} />
              )}
              <div style={{ color: "#fff", fontSize: 20, fontWeight: 700 }}>{name || "Restaurant"}</div>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 4 }}>{tagline}</div>
              <div style={{ marginTop: 12, padding: "8px 20px", background: accentColor, borderRadius: 20, display: "inline-block", color: "#000", fontSize: 13, fontWeight: 700 }}>Join Waitlist</div>
            </div>
          </div>
        )}

        {/* Step 4 — Menu */}
        {step === 4 && (
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: D.text, margin: "0 0 6px" }}>Menu</h2>
            <p style={{ fontSize: 13, color: D.text2, margin: "0 0 20px" }}>Optional — add menu sections and items for the guest join page. You can set this up later.</p>
            <MenuBuilderErrorBoundary>
              <MenuBuilder sections={menuSections} onChange={setMenuSections} />
            </MenuBuilderErrorBoundary>
          </div>
        )}

        {/* Step 5 — Credentials */}
        {step === 5 && (
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: D.text, margin: "0 0 6px" }}>Access Credentials</h2>
            <p style={{ fontSize: 13, color: D.text2, margin: "0 0 20px" }}>Set login credentials for staff. Stored securely in the owner console.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Host View Login */}
              <div style={{ background: D.surface2, border: `1px solid ${D.border}`, borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: D.text, marginBottom: 12 }}>🖥 Host View Login <span style={{ fontSize: 11, color: D.muted, fontWeight: 400 }}>— staff use this to log into the station tablet</span></div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <FieldLabel>Username</FieldLabel>
                    {/* Username is always the restaurant slug — this makes the auth lookup unambiguous */}
                    <div style={{ padding: "10px 13px", borderRadius: 10, border: `1px solid ${D.border}`, background: D.surface, color: D.muted, fontSize: 14, fontFamily: "monospace" }}>
                      {slug || <span style={{ color: D.muted, fontStyle: "italic" }}>set slug above</span>}
                    </div>
                    <div style={{ fontSize: 11, color: D.muted, marginTop: 4 }}>Username is the restaurant slug (auto-set)</div>
                  </div>
                  <div>
                    <FieldLabel>Password</FieldLabel>
                    <Input value={hvPassword} onChange={setHvPassword} placeholder="Strong password" type="text" />
                  </div>
                </div>
              </div>
              {/* Admin PIN */}
              <div style={{ background: D.surface2, border: `1px solid ${D.border}`, borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: D.text, marginBottom: 12 }}>🔐 Admin PIN <span style={{ fontSize: 11, color: D.muted, fontWeight: 400 }}>— 4-digit PIN to access this restaurant&apos;s admin dashboard</span></div>
                <div style={{ maxWidth: 200 }}>
                  <Input value={adminPin} onChange={setAdminPin} placeholder="4 digits" type="text" />
                </div>
              </div>
              {/* WiFi */}
              <div style={{ background: D.surface2, border: `1px solid ${D.border}`, borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: D.text, marginBottom: 12 }}>📶 WiFi <span style={{ fontSize: 11, color: D.muted, fontWeight: 400 }}>— optional, for staff reference</span></div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <FieldLabel>Network Name</FieldLabel>
                    <Input value={wifiName} onChange={setWifiName} placeholder="Network name" />
                  </div>
                  <div>
                    <FieldLabel>Password</FieldLabel>
                    <Input value={wifiPass} onChange={setWifiPass} placeholder="Password" type="text" />
                  </div>
                </div>
              </div>
            </div>

            {/* Summary */}
            <div style={{ marginTop: 24, padding: 20, background: D.surface2, borderRadius: 12, border: `1px solid ${D.border}` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: D.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Summary</div>
              {[
                ["Name", name],
                ["Join URL", `hostplatform.net/client/${slug}/join`],
                ["Station URL", `hostplatform.net/client/${slug}/station`],
                ["Login Username", slug || "(set slug above)"],
                ["City", city || "—"],
                ["Plan", planType],
                ["Monthly Fee", monthlyFee ? `$${monthlyFee}/mo` : "Free"],
                ["Locations", locationCount],
                ["Tables designed", String(floorTables.length)],
                ["Menu sections", String(menuSections.length)],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: D.text2, marginBottom: 6 }}>
                  <span>{k}</span>
                  <span style={{ color: k === "Login Username" ? D.blue : D.text, fontWeight: 500 }}>{v}</span>
                </div>
              ))}
            </div>

            {error && (
              <div style={{ marginTop: 16, padding: "10px 14px", background: D.redBg, border: `1px solid ${D.red}30`, borderRadius: 8, color: D.red, fontSize: 13 }}>
                {error}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <button onClick={() => step > 1 ? setStep(s => s - 1) : onCancel()}
          style={{ padding: "10px 20px", borderRadius: 8, border: `1px solid ${D.border}`,
            background: "transparent", color: D.text2, fontSize: 14, cursor: "pointer" }}>
          {step === 1 ? "Cancel" : "← Back"}
        </button>
        {step < 5 ? (
          <button onClick={() => setStep(s => s + 1)}
            disabled={step === 1 && (!name.trim() || !slug.trim())}
            style={{ padding: "10px 24px", borderRadius: 8, border: "none",
              background: (step === 1 && (!name.trim() || !slug.trim())) ? D.muted : D.accent,
              color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            {step === 4 ? "Next: Credentials" : "Next →"}
          </button>
        ) : (
          <button onClick={create} disabled={saving}
            style={{ padding: "10px 28px", borderRadius: 8, border: "none",
              background: saving ? D.muted : D.green, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            {saving ? "Creating…" : "🚀 Create Restaurant"}
          </button>
        )}
      </div>
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, fontWeight: 600, color: D.text2, marginBottom: 6 }}>{children}</div>
}

function Input({ value, onChange, placeholder, type }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input type={type || "text"} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={inputFull} />
  )
}

const inputFull: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  background: "rgba(255,255,255,0.06)", border: `1px solid ${D.border}`, borderRadius: 8,
  color: D.text, padding: "9px 12px", fontSize: 13, outline: "none",
}

const selectStyle: React.CSSProperties = {
  ...inputFull, cursor: "pointer",
}

// ── Credentials Tab ────────────────────────────────────────────────────────────
function CredentialsTab({ restaurantId, token }: { restaurantId: string; token: string }) {
  const [creds,   setCreds]   = useState<Credential[]>([])
  const [loading, setLoading] = useState(true)
  const [adding,  setAdding]  = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState({ credential_type: "other", label: "", value: "", notes: "" })
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<""|"ok"|"error">("")
  const [saveError, setSaveError] = useState("")
  const [revealed, setRevealed] = useState<Set<string>>(new Set())

  const load = useCallback(() => {
    setLoading(true)
    fetch(`${API}/owner/clients/${restaurantId}/credentials?secret=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(d => setCreds(d.credentials || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [restaurantId, token])

  useEffect(() => { load() }, [load])

  async function save() {
    if (!form.label.trim() || !form.value.trim()) {
      setSaveStatus("error"); setSaveError("Label and Value are required."); return
    }
    setSaving(true); setSaveStatus(""); setSaveError("")
    try {
      const url = editing
        ? `${API}/owner/clients/${restaurantId}/credentials/${editing}?secret=${encodeURIComponent(token)}`
        : `${API}/owner/clients/${restaurantId}/credentials?secret=${encodeURIComponent(token)}`
      const method = editing ? "PATCH" : "POST"
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        setSaveStatus("error"); setSaveError(err.error || `Server error ${res.status}`)
        return
      }
      setForm({ credential_type: "other", label: "", value: "", notes: "" })
      setAdding(false); setEditing(null)
      setSaveStatus("ok")
      load()
      setTimeout(() => setSaveStatus(""), 3000)
    } catch {
      setSaveStatus("error"); setSaveError("Network error — check connection.")
    } finally {
      setSaving(false)
    }
  }

  async function del(id: string) {
    if (!confirm("Delete this credential?")) return
    await fetch(`${API}/owner/clients/${restaurantId}/credentials/${id}?secret=${encodeURIComponent(token)}`, { method: "DELETE" })
    load()
  }

  function toggleReveal(id: string) {
    setRevealed(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const typeIcon: Record<string, string> = {
    admin_pin: "🔐", station_pin: "🔐", manager_pin: "🔑", login: "🖥️", wifi: "📶", other: "🗝",
  }

  if (loading) return <div style={{ color: D.muted, fontSize: 14 }}>Loading…</div>

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 14, color: D.text2 }}>
          {creds.length} credential{creds.length !== 1 ? "s" : ""} on file
          {saveStatus === "ok" && !adding && !editing && <span style={{ marginLeft: 10, color: D.green, fontWeight: 600, fontSize: 13 }}>✓ Saved</span>}
        </div>
        <button onClick={() => { setAdding(true); setEditing(null); setForm({ credential_type: "other", label: "", value: "", notes: "" }); setSaveStatus(""); setSaveError("") }}
          style={{ padding: "7px 16px", borderRadius: 8, border: `1px solid ${D.green}40`, background: D.greenBg, color: D.green, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          + Add Credential
        </button>
      </div>

      {/* Add / edit form */}
      {(adding || editing) && (
        <div style={{ background: D.surface2, border: `1px solid ${D.border}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: D.text, marginBottom: 14 }}>
            {editing ? "Edit Credential" : "New Credential"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <FieldLabel>Type</FieldLabel>
              <select value={form.credential_type} onChange={e => setForm(p => ({ ...p, credential_type: e.target.value }))} style={selectStyle}>
                <option value="login">Login / Password</option>
                <option value="admin_pin">Admin PIN</option>
                <option value="station_pin">Station PIN</option>
                <option value="manager_pin">Manager PIN</option>
                <option value="wifi">WiFi</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <FieldLabel>Label</FieldLabel>
              <Input value={form.label} onChange={v => setForm(p => ({ ...p, label: v }))} placeholder="e.g. Host iPad PIN" />
            </div>
            <div>
              <FieldLabel>Value / Password</FieldLabel>
              <Input value={form.value} onChange={v => setForm(p => ({ ...p, value: v }))} placeholder="Enter the credential" />
            </div>
            <div>
              <FieldLabel>Notes (optional)</FieldLabel>
              <Input value={form.notes} onChange={v => setForm(p => ({ ...p, notes: v }))} placeholder="Any notes" />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14, alignItems: "center" }}>
            <button onClick={save} disabled={saving}
              style={{ padding: "7px 18px", borderRadius: 8, border: "none", background: D.accent, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button onClick={() => { setAdding(false); setEditing(null); setSaveStatus(""); setSaveError("") }}
              style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${D.border}`, background: "transparent", color: D.text2, fontSize: 13, cursor: "pointer" }}>
              Cancel
            </button>
            {saveStatus === "ok" && <span style={{ fontSize: 13, color: D.green, fontWeight: 600 }}>✓ Saved</span>}
            {saveStatus === "error" && <span style={{ fontSize: 13, color: D.red }}>{saveError}</span>}
          </div>
        </div>
      )}

      {/* Credential list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {creds.map(c => (
          <div key={c.id} style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 10, padding: "14px 16px",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 22 }}>{typeIcon[c.credential_type] || "🗝"}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: D.text }}>{c.label}</div>
                <div style={{ fontSize: 13, color: D.text2, marginTop: 2, fontFamily: "monospace" }}>
                  {revealed.has(c.id) ? c.value : "••••••••"}
                </div>
                {c.notes && <div style={{ fontSize: 11, color: D.muted, marginTop: 2 }}>{c.notes}</div>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button onClick={() => toggleReveal(c.id)}
                style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${D.border}`, background: "transparent", color: D.text2, fontSize: 12, cursor: "pointer" }}>
                {revealed.has(c.id) ? "Hide" : "Show"}
              </button>
              <button onClick={() => { setEditing(c.id); setAdding(false); setForm({ credential_type: c.credential_type, label: c.label, value: c.value, notes: c.notes || "" }) }}
                style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${D.border}`, background: "transparent", color: D.text2, fontSize: 12, cursor: "pointer" }}>
                Edit
              </button>
              <button onClick={() => del(c.id)}
                style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${D.red}30`, background: D.redBg, color: D.red, fontSize: 12, cursor: "pointer" }}>
                ✕
              </button>
            </div>
          </div>
        ))}
        {creds.length === 0 && !adding && (
          <div style={{ color: D.muted, fontSize: 13, textAlign: "center", padding: "24px 0" }}>
            No credentials saved. Click &quot;+ Add Credential&quot; to store PINs, passwords, and access codes.
          </div>
        )}
      </div>
    </div>
  )
}

// ── Overview Tab (editable client details) ─────────────────────────────────────
function OverviewTab({ client, token, floorTables, floorWalls, floorObjects, canvasAspect, configLoaded, onUpdated }: {
  client: Client
  token: string
  floorTables: FloorTable[]
  floorWalls: FloorWall[]
  floorObjects: FloorObject[]
  canvasAspect: number
  configLoaded: boolean
  onUpdated: () => void
}) {
  const [editing,     setEditing]     = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [saveResult,  setSaveResult]  = useState<{ ok: boolean; msg: string } | null>(null)

  // Editable fields
  const [displayName, setDisplayName] = useState(client.display_name)
  const [city,        setCity]        = useState(client.city || "")
  const [joinUrl,     setJoinUrl]     = useState(client.join_url)
  const [planType,    setPlanType]    = useState(client.plan_type)
  const [status,      setStatus]      = useState(client.status)
  const [monthlyFee,  setMonthlyFee]  = useState(
    client.monthly_fee_cents != null ? String(client.monthly_fee_cents / 100) : ""
  )

  const save = async () => {
    setSaving(true); setSaveResult(null)
    try {
      const r = await fetch(`${API}/owner/clients/${client.id}?secret=${encodeURIComponent(token)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: displayName.trim() || undefined,
          city:         city.trim()        || undefined,
          join_url:     joinUrl.trim()     || undefined,
          plan_type:    planType           || undefined,
          status:       status             || undefined,
          monthly_fee:  monthlyFee ? parseFloat(monthlyFee) : undefined,
        }),
      })
      const d = await r.json()
      if (r.ok && d.ok) {
        setSaveResult({ ok: true, msg: "Saved ✓" })
        setEditing(false)
        onUpdated()
      } else {
        setSaveResult({ ok: false, msg: d.detail || "Save failed" })
      }
    } catch {
      setSaveResult({ ok: false, msg: "Network error" })
    } finally { setSaving(false) }
  }

  const cancel = () => {
    setDisplayName(client.display_name)
    setCity(client.city || "")
    setJoinUrl(client.join_url)
    setPlanType(client.plan_type)
    setStatus(client.status)
    setMonthlyFee(client.monthly_fee_cents != null ? String(client.monthly_fee_cents / 100) : "")
    setEditing(false); setSaveResult(null)
  }

  return (
    <div style={{ display: "flex", gap: 20, flexDirection: "column" }}>

      {/* Editable info block */}
      <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: `1px solid ${D.border}` }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: D.text }}>Client Details</span>
          <div style={{ display: "flex", gap: 8 }}>
            {editing && (
              <button onClick={cancel}
                style={{ padding: "5px 14px", borderRadius: 7, border: `1px solid ${D.border}`, background: "transparent", color: D.text2, fontSize: 12, cursor: "pointer" }}>
                Cancel
              </button>
            )}
            <button onClick={editing ? save : () => setEditing(true)} disabled={saving}
              style={{ padding: "5px 14px", borderRadius: 7, border: "none",
                background: editing ? D.accent : "rgba(255,255,255,0.08)",
                color: editing ? "#fff" : D.text2, fontSize: 12, fontWeight: editing ? 700 : 400, cursor: "pointer" }}>
              {saving ? "Saving…" : editing ? "Save Changes" : "✏ Edit"}
            </button>
          </div>
        </div>

        {saveResult && (
          <div style={{ padding: "8px 20px", fontSize: 12, fontWeight: 600,
            color: saveResult.ok ? D.green : D.red,
            background: saveResult.ok ? D.greenBg : D.redBg,
            borderBottom: `1px solid ${D.border}` }}>
            {saveResult.msg}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
          {[
            {
              label: "Display Name",
              view: <span>{client.display_name}</span>,
              edit: <input value={displayName} onChange={e => setDisplayName(e.target.value)} style={inputFull} />,
            },
            {
              label: "City",
              view: <span>{client.city || "—"}</span>,
              edit: <input value={city} onChange={e => setCity(e.target.value)} placeholder="Denver, CO" style={inputFull} />,
            },
            {
              label: "Join URL",
              view: <a href={client.join_url} target="_blank" rel="noopener noreferrer" style={{ color: D.blue, fontSize: 12, wordBreak: "break-all" as const }}>{client.join_url}</a>,
              edit: <input value={joinUrl} onChange={e => setJoinUrl(e.target.value)} style={inputFull} />,
            },
            {
              label: "Station URL",
              view: (() => {
                // Hardcoded known stations; fall back to generic /client/[slug]/station for new clients
                const stationUrl = REAL_STATION_URL[client.id]
                  || (client.slug ? `https://hostplatform.net/client/${client.slug}/station` : client.station_url)
                const loginAs = STATION_LOGIN_AS[client.id]
                const isGeneric = !REAL_STATION_URL[client.id]
                return (
                  <div>
                    <a href={stationUrl} target="_blank" rel="noopener noreferrer" style={{ color: D.blue, fontSize: 12, wordBreak: "break-all" as const }}>{stationUrl}</a>
                    {loginAs && <div style={{ fontSize: 11, color: D.muted, marginTop: 2 }}>Login as client: <code style={{ color: D.orange, background: "rgba(245,158,11,0.08)", padding: "1px 5px", borderRadius: 3 }}>{loginAs}</code></div>}
                    {isGeneric && <div style={{ fontSize: 11, color: D.muted, marginTop: 2 }}>PIN-protected · set Admin PIN in Credentials tab</div>}
                  </div>
                )
              })(),
              edit: (() => {
                const stationUrl = REAL_STATION_URL[client.id] || client.station_url
                return <div style={{ fontSize: 12, color: D.muted, paddingTop: 2 }}>{stationUrl} <span style={{ color: D.muted }}>(auto)</span></div>
              })(),
            },
            {
              label: "Plan",
              view: <span>{client.plan_type}</span>,
              edit: <select value={planType} onChange={e => setPlanType(e.target.value)} style={selectStyle}>
                <option value="free-partner">Free Partner</option>
                <option value="standard">Standard</option>
                <option value="multi">Multi-Location</option>
                <option value="enterprise">Enterprise</option>
              </select>,
            },
            {
              label: "Status",
              view: <span>{client.status}</span>,
              edit: <select value={status} onChange={e => setStatus(e.target.value)} style={selectStyle}>
                <option value="active">Active</option>
                <option value="trial">Trial</option>
                <option value="inactive">Inactive</option>
              </select>,
            },
            {
              label: "Monthly Fee",
              view: <span>{client.monthly_fee_cents != null ? `$${(client.monthly_fee_cents/100).toFixed(2)}/mo` : "Free"}</span>,
              edit: <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: D.muted, fontSize: 13 }}>$</span>
                <input type="number" value={monthlyFee} onChange={e => setMonthlyFee(e.target.value)}
                  placeholder="0.00" min="0" step="0.01" style={{ ...inputFull, width: 100 }} />
                <span style={{ color: D.muted, fontSize: 12 }}>/mo</span>
              </div>,
            },
            {
              label: "Signed",
              view: <span>{client.signed_at ? fmtTime(client.signed_at) : "Not signed"}</span>,
              edit: <span style={{ fontSize: 12, color: D.muted }}>{client.signed_at ? fmtTime(client.signed_at) : "Not signed"}</span>,
            },
            {
              label: "Signer",
              view: <span>{client.signer_name || "—"}</span>,
              edit: <span style={{ fontSize: 12, color: D.muted }}>{client.signer_name || "—"}</span>,
            },
            {
              label: "Client ID",
              view: <code style={{ fontSize: 11, color: D.muted }}>{client.id}</code>,
              edit: <code style={{ fontSize: 11, color: D.muted }}>{client.id}</code>,
            },
          ].map(({ label, view, edit }, i) => (
            <div key={label} style={{
              padding: "14px 20px",
              borderBottom: i < 9 ? `1px solid ${D.border}` : "none",
              borderRight: i % 2 === 0 ? `1px solid ${D.border}` : "none",
            }}>
              <div style={{ fontSize: 10, color: D.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>{label}</div>
              <div style={{ fontSize: 13, color: D.text }}>
                {editing ? edit : view}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mini floor map preview */}
      {configLoaded && floorTables.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: D.muted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Floor Plan Preview</div>
          <FloorViewer tables={floorTables} walls={floorWalls} objects={floorObjects} aspectRatio={canvasAspect} />
        </div>
      )}
    </div>
  )
}

// ── Client Detail View ─────────────────────────────────────────────────────────
function ClientDetailView({ client, token, onBack, onUpdated }: {
  client: Client
  token: string
  onBack: () => void
  onUpdated: () => void
}) {
  const [tab, setTab] = useState<"overview"|"credentials"|"floor-map"|"guest-page"|"menu"|"reservations"|"documents">("overview")
  const [config, setConfig] = useState<{ guest_config?: Record<string,unknown>; menu_config?: { sections: MenuSection[] }; floor_plan?: FloorTable[]; settings?: Record<string,unknown> } | null>(null)
  const [configLoaded, setConfigLoaded] = useState(false)
  const [savingConfig, setSavingConfig] = useState(false)
  const [saveStatus, setSaveStatus] = useState<""|"saving"|"saved"|"error">("")
  const [floorTables,  setFloorTables]  = useState<FloorTable[]>([])
  const [floorWalls,   setFloorWalls]   = useState<FloorWall[]>([])
  const [floorObjects, setFloorObjects] = useState<FloorObject[]>([])
  const [canvasAspect, setCanvasAspect] = useState<number>(1.62)
  const [menuSections, setMenuSections] = useState<MenuSection[]>([])
  // Per-party-size reservation blocking rules: party_size_str → minutes_before
  const [resBlocking, setResBlocking] = useState<Record<string, number>>({})
  const [clientAgreements, setClientAgreements] = useState<AgreementRecord[]>([])
  const [agreementsLoaded, setAgreementsLoaded] = useState(false)
  const [floorEditMode, setFloorEditMode] = useState(false)

  useEffect(() => {
    if ((tab === "overview" || tab === "floor-map" || tab === "guest-page" || tab === "menu" || tab === "reservations") && !configLoaded) {
      fetch(`${API}/owner/clients/${client.id}/config?secret=${encodeURIComponent(token)}`)
        .then(r => r.json())
        .then(async d => {
          setConfig(d)
          const mc = d.menu_config as { sections?: MenuSection[] } | null
          setMenuSections(mc?.sections || [])
          const gc = d.guest_config as { reservationBlocking?: Record<string,number> } | null
          setResBlocking(gc?.reservationBlocking || {})
          // Handle floor_plan: new format = { tables, canvasAspect } | old format = array
          const fp = d.floor_plan
          const fpTables: FloorTable[] = []
          if (fp && !Array.isArray(fp) && typeof fp === "object") {
            const fpObj = fp as { tables?: FloorTable[]; walls?: FloorWall[]; objects?: FloorObject[]; canvasAspect?: number }
            if (fpObj.canvasAspect) setCanvasAspect(fpObj.canvasAspect)
            if (Array.isArray(fpObj.tables)  && fpObj.tables.length > 0)  fpTables.push(...fpObj.tables)
            if (Array.isArray(fpObj.walls))   setFloorWalls(fpObj.walls)
            if (Array.isArray(fpObj.objects)) setFloorObjects(fpObj.objects)
          } else if (Array.isArray(fp) && fp.length > 0) {
            fpTables.push(...fp)
          }
          if (fpTables.length > 0) {
            setFloorTables(fpTables)
          } else {
            // Load real tables from DB and auto-layout them in a grid
            try {
              const tr = await fetch(`${API}/tables?restaurant_id=${client.id}`, { cache: "no-store" })
              if (tr.ok) {
                const dbTables = await tr.json() as Array<{ id: string; table_number: number; capacity: number; status: string }>
                if (Array.isArray(dbTables) && dbTables.length > 0) {
                  const COLS = 5
                  const colW = 16, rowH = 22
                  const startX = 4, startY = 6
                  const laid = dbTables.map((t, i) => ({
                    id:       t.id,
                    number:   t.table_number,
                    label:    `T${t.table_number}`,
                    capacity: t.capacity,
                    shape:    "rect" as const,
                    x:        startX + (i % COLS) * colW,
                    y:        startY + Math.floor(i / COLS) * rowH,
                    w:        12,
                    h:        16,
                  }))
                  setFloorTables(laid)
                }
              }
            } catch { /* non-critical — leave empty */ }
          }
          setConfigLoaded(true)
        })
        .catch(() => setConfigLoaded(true))
    }
    if (tab === "documents" && !agreementsLoaded) {
      fetch(`${API}/agreements/all?secret=${encodeURIComponent(token)}`)
        .then(r => r.json())
        .then(d => {
          const all: AgreementRecord[] = d.agreements || []
          setClientAgreements(all.filter(a => a.business_name?.toLowerCase().includes(client.name.toLowerCase()) || client.name.toLowerCase().includes(a.business_name?.toLowerCase())))
          setAgreementsLoaded(true)
        })
        .catch(() => setAgreementsLoaded(true))
    }
  }, [tab, configLoaded, agreementsLoaded, client.id, client.name, token])

  async function saveResBlockingRules(rules: Record<string, number>) {
    const existing = (config?.guest_config ?? {}) as Record<string, unknown>
    await saveConfig({ guest_config: { ...existing, reservationBlocking: rules } })
  }

  async function saveConfig(patch: { floor_plan?: FloorTable[]; menu_config?: { sections: MenuSection[] }; guest_config?: Record<string,unknown> }) {
    setSavingConfig(true); setSaveStatus("saving")
    try {
      const r = await fetch(`${API}/owner/clients/${client.id}/config?secret=${encodeURIComponent(token)}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      if (!r.ok) throw new Error(`Server returned ${r.status}`)
      setSaveStatus("saved")
      setTimeout(() => setSaveStatus(""), 3000)
    } catch {
      setSaveStatus("error")
    } finally {
      setSavingConfig(false)
    }
  }

  async function saveFloorPlan() {
    await saveConfig({ floor_plan: { tables: floorTables, walls: floorWalls, objects: floorObjects, canvasAspect } as unknown as FloorTable[] })
    // Sync table records so the station page shows green tables and drag-to-move works
    if (floorTables.length > 0) {
      try {
        await fetch(`${API}/owner/clients/${client.id}/tables/batch?secret=${encodeURIComponent(token)}`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tables: floorTables.map(t => ({ table_number: t.number, capacity: t.capacity, shape: t.shape, label: t.label })) }),
        })
      } catch { /* non-critical — floor plan config already saved */ }
    }
  }

  const tabs: { id: typeof tab; label: string; icon: string }[] = [
    { id: "overview",     label: "Overview",     icon: "⊞" },
    { id: "credentials",  label: "Credentials",  icon: "🔑" },
    { id: "floor-map",    label: "Floor Map",     icon: "🗺" },
    { id: "guest-page",   label: "Guest Page",    icon: "📱" },
    { id: "menu",         label: "Menu",          icon: "🍽" },
    { id: "reservations", label: "Reservations",  icon: "📅" },
    { id: "documents",    label: "Documents",     icon: "📄" },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button onClick={onBack}
            style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 8, color: D.text2, cursor: "pointer", fontSize: 13, padding: "6px 12px" }}>
            ← Clients
          </button>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: D.text, margin: 0 }}>{client.display_name}</h1>
            <div style={{ fontSize: 13, color: D.muted, marginTop: 2 }}>{client.city || "—"} · slug: <span style={{ color: D.blue }}>{client.slug}</span></div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {planBadge(client.plan_type, client.status)}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, marginBottom: 24, background: D.surface, borderRadius: 10, padding: 4, border: `1px solid ${D.border}`, overflowX: "auto" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ flex: "none", padding: "7px 16px", borderRadius: 8, border: "none",
              background: tab === t.id ? D.surface2 : "transparent",
              color: tab === t.id ? D.text : D.text2,
              fontSize: 13, fontWeight: tab === t.id ? 600 : 400, cursor: "pointer", whiteSpace: "nowrap" }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Save status — fixed top-of-screen toast */}
      {saveStatus && (
        <div style={{
          position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
          zIndex: 9999, padding: "12px 28px", borderRadius: 12, fontSize: 14, fontWeight: 700,
          boxShadow: "0 4px 24px rgba(0,0,0,0.55)", pointerEvents: "none",
          background: saveStatus === "saved" ? "rgba(34,197,94,0.18)" : saveStatus === "error" ? "rgba(239,68,68,0.18)" : "rgba(96,165,250,0.18)",
          color: saveStatus === "saved" ? D.green : saveStatus === "error" ? D.red : D.blue,
          border: `1px solid ${saveStatus === "saved" ? D.greenBorder : saveStatus === "error" ? D.red + "55" : D.blueBorder}`,
          backdropFilter: "blur(12px)",
        }}>
          {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "✓ Changes saved" : "⚠ Save failed — check your connection"}
        </div>
      )}

      {/* Overview tab */}
      {tab === "overview" && (
        <OverviewTab client={client} token={token} floorTables={floorTables} floorWalls={floorWalls} floorObjects={floorObjects} canvasAspect={canvasAspect} configLoaded={configLoaded} onUpdated={onUpdated} />
      )}

      {/* Credentials tab */}
      {tab === "credentials" && <CredentialsTab restaurantId={client.id} token={token} />}

      {/* Floor Map tab */}
      {tab === "floor-map" && (
        <div>
          {!configLoaded ? (
            <div style={{ color: D.muted, fontSize: 14 }}>Loading…</div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ fontSize: 13, color: D.muted }}>{floorTables.length} tables · {floorWalls.length} walls</div>
                  {floorEditMode && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 11, color: D.muted, whiteSpace: "nowrap" }}>Map shape:</span>
                      <select value={canvasAspect} onChange={e => setCanvasAspect(parseFloat(e.target.value))}
                        style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: `1px solid ${D.border}`, background: D.surface, color: D.text, cursor: "pointer" }}>
                        <option value={1.0}>Square (1:1)</option>
                        <option value={1.33}>Wide-ish (4:3)</option>
                        <option value={1.62}>Standard (16:10)</option>
                        <option value={2.0}>Wide (2:1)</option>
                        <option value={2.5}>Extra Wide (5:2)</option>
                        <option value={3.0}>Long (3:1)</option>
                        <option value={0.75}>Portrait (3:4)</option>
                      </select>
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setFloorEditMode(m => !m)}
                    style={{ padding: "7px 16px", borderRadius: 8, border: `1px solid ${floorEditMode ? D.blue : D.border}`,
                      background: floorEditMode ? D.blueBg : "transparent", color: floorEditMode ? D.blue : D.text2,
                      fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    {floorEditMode ? "✏ Editing" : "✏ Edit"}
                  </button>
                  {floorEditMode && (
                    <button onClick={saveFloorPlan} disabled={savingConfig}
                      style={{ padding: "7px 20px", borderRadius: 8, border: "none", background: D.accent, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                      {savingConfig ? "Saving…" : "Save"}
                    </button>
                  )}
                </div>
              </div>
              {floorEditMode
                ? <TableDesigner tables={floorTables} walls={floorWalls} objects={floorObjects} onChange={t => setFloorTables(t)} onObjectsChange={o => setFloorObjects(o)} aspectRatio={canvasAspect} />
                : <FloorViewer tables={floorTables} walls={floorWalls} objects={floorObjects} aspectRatio={canvasAspect} />
              }
            </>
          )}
        </div>
      )}

      {/* Guest Page tab */}
      {tab === "guest-page" && (
        <div>
          {!configLoaded ? <div style={{ color: D.muted, fontSize: 14 }}>Loading…</div> : (
            <GuestPageEditor
              initial={(config?.guest_config ? (config.guest_config as unknown as GuestPageConfig) : getDefaultGuestConfig(client.id, client.name))}
              onSave={gc => saveConfig({ guest_config: gc as unknown as Record<string,unknown> })}
              saving={savingConfig}
            />
          )}
        </div>
      )}

      {/* Menu tab */}
      {tab === "menu" && (
        <div>
          {!configLoaded ? <div style={{ color: D.muted, fontSize: 14 }}>Loading…</div> : (
            <>
              <MenuBuilderErrorBoundary>
                <MenuBuilder sections={menuSections} onChange={setMenuSections} />
              </MenuBuilderErrorBoundary>
              <div style={{ marginTop: 16 }}>
                <button onClick={() => saveConfig({ menu_config: { sections: menuSections } })} disabled={savingConfig}
                  style={{ padding: "9px 24px", borderRadius: 8, border: "none", background: D.accent, color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                  {savingConfig ? "Saving…" : "Save Menu"}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Reservations tab */}
      {tab === "reservations" && (
        <div>
          {!configLoaded ? <div style={{ color: D.muted, fontSize: 14 }}>Loading…</div> : (
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: D.text, margin: "0 0 6px" }}>Reservation Blocking</h2>
              <p style={{ fontSize: 13, color: D.text2, margin: "0 0 20px", lineHeight: 1.6 }}>
                Set how many minutes before a reservation the table is blocked from being seated.
                The floor map shows <span style={{ color: "#fbbf24", fontWeight: 600 }}>yellow</span> for upcoming,{" "}
                <span style={{ color: "#f97316", fontWeight: 600 }}>orange</span> within the blocking window, and{" "}
                <span style={{ color: "#ef4444", fontWeight: 600 }}>red</span> when locked.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 480 }}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(ps => {
                  const val = resBlocking[String(ps)] ?? (ps <= 2 ? 20 : ps <= 4 ? 30 : ps <= 6 ? 45 : 60)
                  return (
                    <div key={ps} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ width: 120, fontSize: 13, color: D.text2, flexShrink: 0 }}>
                        Party of {ps}{ps === 10 ? "+" : ""}
                      </div>
                      <input
                        type="number"
                        min={0}
                        max={240}
                        value={resBlocking[String(ps)] ?? ""}
                        placeholder={String(ps <= 2 ? 20 : ps <= 4 ? 30 : ps <= 6 ? 45 : 60)}
                        onChange={e => {
                          const v = parseInt(e.target.value)
                          setResBlocking(prev => ({ ...prev, [String(ps)]: isNaN(v) ? 0 : Math.max(0, Math.min(240, v)) }))
                        }}
                        style={{ width: 80, padding: "8px 10px", borderRadius: 8, border: `1px solid ${D.border}`, background: D.surface, color: D.text, fontSize: 13, textAlign: "center" }}
                      />
                      <span style={{ fontSize: 12, color: D.muted }}>minutes before</span>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", flexShrink: 0, background: val === 0 ? D.muted : val <= 15 ? "#ef4444" : val <= 30 ? "#f97316" : "#fbbf24" }} />
                    </div>
                  )
                })}
              </div>
              <div style={{ marginTop: 20, display: "flex", gap: 10, alignItems: "center" }}>
                <button onClick={() => saveResBlockingRules(resBlocking)} disabled={savingConfig}
                  style={{ padding: "9px 24px", borderRadius: 8, border: "none", background: D.accent, color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", opacity: savingConfig ? 0.6 : 1 }}>
                  {savingConfig ? "Saving…" : "Save Blocking Rules"}
                </button>
                <button onClick={() => {
                  const defaults: Record<string,number> = { "1": 20, "2": 20, "3": 30, "4": 30, "5": 45, "6": 45, "7": 60, "8": 60, "9": 60, "10": 60 }
                  setResBlocking(defaults)
                }} style={{ padding: "9px 16px", borderRadius: 8, border: `1px solid ${D.border}`, background: "transparent", color: D.text2, fontSize: 13, cursor: "pointer" }}>
                  Reset to defaults
                </button>
              </div>
              <div style={{ marginTop: 24, padding: "14px 16px", background: D.surface, borderRadius: 10, border: `1px solid ${D.border}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: D.text, marginBottom: 8 }}>How it works</div>
                <ul style={{ margin: 0, padding: "0 0 0 16px", fontSize: 12, color: D.text2, lineHeight: 1.8 }}>
                  <li>Set 0 minutes to disable blocking for that party size</li>
                  <li>Blocking only applies BEFORE the reservation starts — table clears normally after guests leave</li>
                  <li>Host can override the warning and seat anyway — it&apos;s a soft lock, not a hard block</li>
                  <li>Tables are hard-locked at the exact reservation time regardless of these settings</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Documents tab */}
      {tab === "documents" && (
        <div>
          {!agreementsLoaded ? <div style={{ color: D.muted, fontSize: 14 }}>Loading…</div> : (
            <>
              <div style={{ fontSize: 14, color: D.text2, marginBottom: 16 }}>
                {clientAgreements.length} signed agreement{clientAgreements.length !== 1 ? "s" : ""}
              </div>
              {clientAgreements.length === 0 && (
                <div style={{ color: D.muted, fontSize: 13, padding: "24px 0" }}>
                  No signed agreements found for this client.
                </div>
              )}
              {clientAgreements.map(a => (
                <div key={a.id} style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 10, padding: "16px 20px", marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: D.text }}>{a.business_name}</div>
                      <div style={{ fontSize: 13, color: D.text2, marginTop: 2 }}>
                        Signed by <strong>{a.signer_name}</strong>
                        {a.signer_title && ` · ${a.signer_title}`} · {a.signer_email}
                      </div>
                    </div>
                    {planBadge(a.plan_type, a.status || "active")}
                  </div>
                  <div style={{ display: "flex", gap: 24, marginTop: 12, flexWrap: "wrap" as const }}>
                    {[
                      ["Signed", fmtTime(a.signed_at)],
                      ["Version", a.agreement_version || "—"],
                      ["IP", a.ip_address || "—"],
                      ["Fee", a.monthly_fee_cents != null ? `$${(a.monthly_fee_cents/100).toFixed(2)}/mo` : "Free"],
                      ["Locations", String(a.location_count || 1)],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <div style={{ fontSize: 10, color: D.muted, textTransform: "uppercase", letterSpacing: "0.07em" }}>{k}</div>
                        <div style={{ fontSize: 12, color: D.text, marginTop: 2 }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Logo Drop Zone ─────────────────────────────────────────────────────────────
function LogoDropZone({ currentUrl, onUrl }: { currentUrl: string; onUrl: (url: string) => void }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function readFile(file: File) {
    const reader = new FileReader()
    reader.onload = e => {
      const result = e.target?.result
      if (typeof result === "string") onUrl(result)
    }
    reader.readAsDataURL(file)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith("image/")) readFile(file)
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) readFile(file)
  }

  const hasImage = !!currentUrl

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      style={{
        border: `2px dashed ${dragging ? D.accent : (hasImage ? D.green : D.border)}`,
        borderRadius: 12,
        padding: "16px 20px",
        display: "flex",
        alignItems: "center",
        gap: 16,
        cursor: "pointer",
        background: dragging ? "rgba(217,50,28,0.05)" : (hasImage ? D.greenBg : D.surface),
        transition: "border-color 0.15s, background 0.15s",
        minHeight: 72,
      }}
    >
      <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onFileChange} />
      {hasImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={currentUrl} alt="Logo" style={{ height: 48, maxWidth: 100, objectFit: "contain", borderRadius: 6, flexShrink: 0, background: "rgba(255,255,255,0.06)" }} />
      ) : (
        <div style={{ width: 48, height: 48, borderRadius: 8, background: D.surface2, border: `1px solid ${D.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ fontSize: 20 }}>🖼</span>
        </div>
      )}
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: D.text2 }}>
          {dragging ? "Drop to upload" : hasImage ? "Logo set — click or drop to replace" : "Click or drag an image file here"}
        </div>
        <div style={{ fontSize: 11, color: D.muted, marginTop: 2 }}>PNG, JPG, SVG, or WebP — stored as data URL</div>
      </div>
    </div>
  )
}

// ── Guest Page Editor ──────────────────────────────────────────────────────────
interface GuestPageConfig {
  bgColor:         string
  darkColor:       string   // light-theme: text + button bg (Walnut model)
  accentColor:     string   // dark-theme: button accent color (Demo model)
  buttonTextColor: string
  restaurantName:  string
  tagline?:        string
  logoUrl?:        string
  waitMessages:    string[]
  seatedMessage:   string
  finalButtons:    Array<{ id: string; label: string; url: string; color: string }>
}

function hexToRgba(hex: string, alpha: number): string {
  const h = (hex || "#000000").replace("#", "").padEnd(6, "0")
  const r = parseInt(h.slice(0, 2), 16) || 0
  const g = parseInt(h.slice(2, 4), 16) || 0
  const b = parseInt(h.slice(4, 6), 16) || 0
  return `rgba(${r},${g},${b},${alpha})`
}

/** Relative luminance of a hex color (0 = black, 1 = white) */
function bgLuminance(hex: string): number {
  const h = (hex || "#000000").replace("#", "").padEnd(6, "0")
  const lin = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  return 0.2126 * lin(parseInt(h.slice(0,2),16)/255)
       + 0.7152 * lin(parseInt(h.slice(2,4),16)/255)
       + 0.0722 * lin(parseInt(h.slice(4,6),16)/255)
}

// Smart defaults per-restaurant so the editor shows the correct color model out of the box
const WALNUT_RID_SET = new Set([
  "0001cafe-0001-4000-8000-000000000001",
  "0002cafe-0001-4000-8000-000000000002",
])
function getDefaultGuestConfig(restaurantId: string, name: string): GuestPageConfig {
  if (WALNUT_RID_SET.has(restaurantId)) {
    return { restaurantName: name, bgColor: "#EDE8DF", darkColor: "#2C2416", accentColor: "",
      buttonTextColor: "#EDE8DF", tagline: "Powered by HOST", logoUrl: "",
      waitMessages: [], seatedMessage: "Enjoy your meal!", finalButtons: [] }
  }
  // Dark / accent model (Demo + all new restaurants)
  // Demo uses white button (#ffffff) with black text (#000000) — no green anywhere
  return { restaurantName: name, bgColor: "#000000", accentColor: "#ffffff", darkColor: "",
    buttonTextColor: "#000000", tagline: "Powered by HOST", logoUrl: "",
    waitMessages: [], seatedMessage: "Enjoy your meal!", finalButtons: [] }
}

function GuestPageEditor({ initial, onSave, saving }: { initial: GuestPageConfig; onSave: (c: GuestPageConfig) => void; saving: boolean }) {
  const [cfg,      setCfg]     = useState<GuestPageConfig>(initial)
  const [waitText, setWaitText] = useState((initial.waitMessages || []).join("\n"))

  function save() {
    onSave({ ...cfg, waitMessages: waitText.split("\n").map(s => s.trim()).filter(Boolean) })
  }

  // Theme detection: dark bg → accent model (Demo), light bg → dark-text model (Walnut)
  const lum         = bgLuminance(cfg.bgColor)
  const isDarkTheme = lum < 0.25

  // Derive preview colors that match the ACTUAL guest join page rendering
  // Dark theme (Demo): white button + black text — accentColor IS the button color
  // Light theme (Walnut): darkColor IS the button color, buttonTextColor = bg
  const bg        = cfg.bgColor || (isDarkTheme ? "#000000" : "#EDE8DF")
  const btnColor  = isDarkTheme
    ? (cfg.accentColor || "#ffffff")   // Demo: white button by default
    : (cfg.darkColor   || "#2C2416")
  const btnText   = isDarkTheme ? (cfg.buttonTextColor || "#000000") : bg
  const txtColor  = isDarkTheme ? "#ffffff" : (cfg.darkColor || "#2C2416")
  const txtFaint  = isDarkTheme ? "rgba(255,255,255,0.28)" : hexToRgba(cfg.darkColor || "#2C2416", 0.30)
  // For dark theme: badge uses a faint white tint (matches demo page rgba(255,255,255,0.04/0.11))
  const badgeBg   = isDarkTheme ? "rgba(255,255,255,0.04)" : hexToRgba(cfg.darkColor || "#2C2416", 0.08)
  const badgeBdr  = isDarkTheme ? "rgba(255,255,255,0.11)" : hexToRgba(cfg.darkColor || "#2C2416", 0.12)
  // Restaurant name text: demo uses rgba(255,255,255,0.85), not the accent color
  const nameTxt   = isDarkTheme ? "rgba(255,255,255,0.85)" : (cfg.darkColor || "#2C2416")

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      <div style={{ gridColumn: "1/-1" }}>
        <FieldLabel>Restaurant Name</FieldLabel>
        <Input value={cfg.restaurantName} onChange={v => setCfg(p => ({ ...p, restaurantName: v }))} placeholder="My Restaurant" />
      </div>
      <div>
        <FieldLabel>Background Color</FieldLabel>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="color" value={cfg.bgColor || "#000000"} onChange={e => setCfg(p => ({ ...p, bgColor: e.target.value }))}
            style={{ width: 40, height: 34, borderRadius: 6, border: `1px solid ${D.border}`, cursor: "pointer", padding: 2 }} />
          <Input value={cfg.bgColor || ""} onChange={v => setCfg(p => ({ ...p, bgColor: v }))} placeholder="#000000" />
        </div>
        <div style={{ fontSize: 11, color: isDarkTheme ? D.blue : D.orange, marginTop: 4, fontWeight: 600 }}>
          {isDarkTheme ? "▪ Dark theme detected → accent model" : "▪ Light theme detected → dark-text model"}
        </div>
      </div>
      <div>
        {isDarkTheme ? (
          <>
            <FieldLabel>Button Color</FieldLabel>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="color" value={cfg.accentColor || "#ffffff"} onChange={e => setCfg(p => ({ ...p, accentColor: e.target.value }))}
                style={{ width: 40, height: 34, borderRadius: 6, border: `1px solid ${D.border}`, cursor: "pointer", padding: 2 }} />
              <Input value={cfg.accentColor || ""} onChange={v => setCfg(p => ({ ...p, accentColor: v }))} placeholder="#ffffff" />
            </div>
            <div style={{ fontSize: 11, color: D.muted, marginTop: 4 }}>Button background color on dark background</div>
          </>
        ) : (
          <>
            <FieldLabel>Text &amp; Button Color</FieldLabel>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="color" value={cfg.darkColor || "#2C2416"} onChange={e => setCfg(p => ({ ...p, darkColor: e.target.value }))}
                style={{ width: 40, height: 34, borderRadius: 6, border: `1px solid ${D.border}`, cursor: "pointer", padding: 2 }} />
              <Input value={cfg.darkColor || ""} onChange={v => setCfg(p => ({ ...p, darkColor: v }))} placeholder="#2C2416" />
            </div>
            <div style={{ fontSize: 11, color: D.muted, marginTop: 4 }}>Dark text and button color for light background</div>
          </>
        )}
      </div>
      <div>
        <FieldLabel>Button Text Color</FieldLabel>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="color" value={cfg.buttonTextColor || (isDarkTheme ? "#000000" : (cfg.bgColor || "#EDE8DF"))} onChange={e => setCfg(p => ({ ...p, buttonTextColor: e.target.value }))}
            style={{ width: 40, height: 34, borderRadius: 6, border: `1px solid ${D.border}`, cursor: "pointer", padding: 2 }} />
          <Input value={cfg.buttonTextColor || ""} onChange={v => setCfg(p => ({ ...p, buttonTextColor: v }))} placeholder={isDarkTheme ? "#000000" : "(uses bg color)"} />
        </div>
        <div style={{ fontSize: 11, color: D.muted, marginTop: 4 }}>Text color shown inside the Join Waitlist button</div>
      </div>
      <div style={{ gridColumn: "1/-1" }}>
        <FieldLabel>Tagline</FieldLabel>
        <Input value={cfg.tagline || ""} onChange={v => setCfg(p => ({ ...p, tagline: v }))} placeholder="Powered by HOST" />
      </div>
      <div style={{ gridColumn: "1/-1" }}>
        <FieldLabel>Logo</FieldLabel>
        <Input value={cfg.logoUrl || ""} onChange={v => setCfg(p => ({ ...p, logoUrl: v }))} placeholder="https://… or drag an image file below" />
        <div style={{ fontSize: 11, color: D.muted, marginTop: 4, marginBottom: 8 }}>
          Paste a direct image URL above — or drag &amp; drop / click to upload a file:
        </div>
        <LogoDropZone
          currentUrl={cfg.logoUrl || ""}
          onUrl={url => setCfg(p => ({ ...p, logoUrl: url }))}
        />
      </div>
      <div style={{ gridColumn: "1/-1" }}>
        <FieldLabel>Wait Messages (one per line — shown on the waiting page)</FieldLabel>
        <textarea value={waitText} onChange={e => setWaitText(e.target.value)} rows={4}
          style={{ ...inputFull, resize: "vertical" } as React.CSSProperties} />
      </div>
      <div style={{ gridColumn: "1/-1" }}>
        <FieldLabel>Seated / Thank You Message</FieldLabel>
        <Input value={cfg.seatedMessage} onChange={v => setCfg(p => ({ ...p, seatedMessage: v }))} placeholder="Enjoy your meal!" />
      </div>

      {/* Live preview — accurately matches actual guest join page */}
      <div style={{ gridColumn: "1/-1", borderRadius: 14, overflow: "hidden", border: `1px solid ${D.border}` }}>
        <div style={{ padding: "8px 14px", background: D.surface2, borderBottom: `1px solid ${D.border}`, fontSize: 11, color: D.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Live Preview — Guest Join Page</span>
          <span style={{ color: isDarkTheme ? D.blue : D.orange }}>
            {isDarkTheme ? "Dark / Accent theme" : "Light / Dark-text theme"}
          </span>
        </div>
        <div style={{ background: bg, padding: "24px 28px", fontFamily: "system-ui, sans-serif", maxWidth: 360, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "0.08em", color: txtColor, lineHeight: 1 }}>HOST</div>
            <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase", color: txtFaint, marginTop: 3 }}>Restaurant Operating System</div>
          </div>
          {cfg.logoUrl && (
            <div style={{ textAlign: "center", marginBottom: 10 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cfg.logoUrl} alt={cfg.restaurantName} style={{ height: 52, objectFit: "contain" }} />
            </div>
          )}
          <div style={{ textAlign: "center", marginBottom: 10 }}>
            <div style={{ display: "inline-block", padding: "5px 16px", border: `1px solid ${badgeBdr}`, borderRadius: 10, background: badgeBg }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", color: nameTxt }}>{cfg.restaurantName.toUpperCase()}</div>
            </div>
          </div>
          {(cfg.tagline || "Powered by HOST") && (
            <div style={{ textAlign: "center", fontSize: 12, color: txtFaint, marginBottom: 14 }}>{cfg.tagline || "Powered by HOST"}</div>
          )}
          <div>
            <div style={{ width: "100%", height: 44, borderRadius: 14, background: btnColor, color: btnText, fontWeight: 800, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", display: "flex", alignItems: "center", justifyContent: "center" }}>
              Join Waitlist
            </div>
          </div>
        </div>
      </div>

      <div style={{ gridColumn: "1/-1" }}>
        <button onClick={save} disabled={saving}
          style={{ padding: "9px 24px", borderRadius: 8, border: "none", background: D.accent, color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
          {saving ? "Saving…" : "Save Guest Page"}
        </button>
      </div>
    </div>
  )
}

// ── Operations View ────────────────────────────────────────────────────────────
interface OpsParty {
  id: string; name: string; partySize: number
  status: string; quotedWait: number | null; arrivedAt: string | null
}
interface OpsRestaurant {
  id: string; name: string; stationUrl: string; joinUrl: string; loginAs: string
  queue: OpsParty[]
  tablesOccupied: number; tablesTotal: number
  avgWait: number | null; utilization: number
  loaded: boolean
}

const OPS_RESTAURANTS = [
  { id: "272a8876-e4e6-4867-831d-0525db80a8db", name: "Walter's 303",
    stationUrl: "https://hostplatform.net/walters303/station",
    joinUrl:    "https://hostplatform.net/walters303/join",
    loginAs:    "walters" },
  { id: "0001cafe-0001-4000-8000-000000000001", name: "Walnut Original",
    stationUrl: "https://hostplatform.net/station",
    joinUrl:    "https://hostplatform.net/walnut/original/join",
    loginAs:    "original" },
  { id: "0002cafe-0001-4000-8000-000000000002", name: "Walnut Southside",
    stationUrl: "https://hostplatform.net/station",
    joinUrl:    "https://hostplatform.net/walnut/southside/join",
    loginAs:    "southside" },
  { id: DEMO_RID,                               name: "Demo Restaurant",
    stationUrl: "https://hostplatform.net/demo/station",
    joinUrl:    "https://hostplatform.net/demo/join",
    loginAs:    "demo" },
]

function OperationsView({ token }: { token: string }) {
  const [restaurants, setRestaurants] = useState<OpsRestaurant[]>(
    OPS_RESTAURANTS.map(r => ({ ...r, queue: [], tablesOccupied: 0, tablesTotal: 0, avgWait: null, utilization: 0, loaded: false }))
  )
  // Identify which restaurants share the /station URL (Walnut clients)
  const sharedStationIds = new Set(["0001cafe-0001-4000-8000-000000000001", "0002cafe-0001-4000-8000-000000000002"])
  const [lastUpdate,   setLastUpdate]   = useState<Date | null>(null)
  const [loading,      setLoading]      = useState(false)
  const [autoRefresh,  setAutoRefresh]  = useState(true)
  const [expandedId,   setExpandedId]   = useState<string | null>(null)

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const load = useCallback(async (_tk?: string) => {
    setLoading(true)
    const results = await Promise.all(OPS_RESTAURANTS.map(async r => {
      try {
        const [insRes, queueRes] = await Promise.all([
          fetch(`${API}/insights?restaurant_id=${r.id}`, { cache: "no-store" }),
          fetch(`${API}/queue?restaurant_id=${r.id}`,    { cache: "no-store" }),
        ])
        const ins = insRes.ok ? (await insRes.json() as Record<string,unknown>) : null
        const raw = queueRes.ok ? await queueRes.json() : []
        const queue: OpsParty[] = Array.isArray(raw)
          ? raw.slice(0, 20).map((p: Record<string,unknown>) => ({
              id:         String(p.id  || ""),
              name:       String(p.name || "Guest"),
              partySize:  Number(p.party_size) || 1,
              status:     String(p.status      || "waiting"),
              quotedWait: p.quoted_wait  != null ? Number(p.quoted_wait)  : null,
              arrivedAt:  p.arrival_time != null ? String(p.arrival_time) : null,
            }))
          : []
        return {
          ...r,
          queue,
          tablesOccupied: Number(ins?.tables_occupied)          || 0,
          tablesTotal:    Number(ins?.tables_total)             || 0,
          avgWait:        ins?.avg_wait_estimate ? Number(ins.avg_wait_estimate) : null,
          utilization:    Number(ins?.capacity_utilization)     || 0,
          loaded: true,
        }
      } catch {
        return { ...r, queue: [], tablesOccupied: 0, tablesTotal: 0, avgWait: null, utilization: 0, loaded: true }
      }
    }))
    setRestaurants(results)
    setLastUpdate(new Date())
    setLoading(false)
  }, [])

  useEffect(() => {
    load(token)
    if (!autoRefresh) return
    const iv = setInterval(() => load(token), 30_000)
    return () => clearInterval(iv)
  }, [load, token, autoRefresh])

  function statusBadge(status: string) {
    const map: Record<string, [string, string]> = {
      waiting: [D.blue,   D.blueBg],
      ready:   [D.yellow, D.orangeBg],
      seated:  [D.green,  D.greenBg],
      removed: [D.red,    D.redBg],
    }
    const [color, bg] = map[status] || [D.muted, D.surface]
    return (
      <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 20, padding: "2px 8px",
        color, background: bg, border: `1px solid ${color}40`, whiteSpace: "nowrap" as const }}>
        {status}
      </span>
    )
  }

  function minutesAgo(iso: string | null) {
    if (!iso) return null
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
    return mins < 60 ? `${mins}m` : `${Math.floor(mins/60)}h ${mins%60}m`
  }

  const totalActive = restaurants.reduce((s, r) => s + r.queue.filter(p => ["waiting","ready"].includes(p.status)).length, 0)

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: D.text, margin: "0 0 4px" }}>Live Operations</h1>
          <p style={{ color: D.text2, fontSize: 13, margin: 0 }}>
            {lastUpdate ? `Updated ${lastUpdate.toLocaleTimeString()}` : "Loading…"}
            {totalActive > 0 && (
              <span style={{ marginLeft: 12, color: D.orange, fontWeight: 600 }}>⚡ {totalActive} active in queue</span>
            )}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: D.text2, cursor: "pointer" }}>
            <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} style={{ cursor: "pointer" }} />
            Auto-refresh 30s
          </label>
          <button onClick={() => load(token)} disabled={loading}
            style={{ padding: "7px 16px", borderRadius: 7, border: `1px solid ${D.border}`, background: "transparent", color: D.text2, fontSize: 13, cursor: "pointer" }}>
            {loading ? "Refreshing…" : "↺ Refresh"}
          </button>
        </div>
      </div>

      {/* Restaurant cards grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14, marginBottom: 20, marginTop: 20 }}>
        {restaurants.map(r => {
          const activeQueue = r.queue.filter(p => ["waiting","ready"].includes(p.status))
          const isExpanded  = expandedId === r.id
          const util        = r.utilization
          const utilColor   = util > 80 ? D.red : util > 60 ? D.orange : D.green
          return (
            <div key={r.id} style={{ background: D.surface, border: `1px solid ${isExpanded ? D.borderStrong : D.border}`, borderRadius: 14, overflow: "hidden", transition: "border-color 0.15s" }}>
              {/* Card header */}
              <div style={{ padding: "16px 18px", borderBottom: isExpanded ? `1px solid ${D.border}` : "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: D.text }}>{r.name}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <a href={r.stationUrl} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 11, color: D.blue, textDecoration: "none", padding: "3px 10px", borderRadius: 6, border: `1px solid ${D.blueBorder}`, background: D.blueBg }}>
                        ↗ Station
                      </a>
                      <a href={r.joinUrl} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 11, color: D.green, textDecoration: "none", padding: "3px 10px", borderRadius: 6, border: `1px solid ${D.greenBorder}`, background: D.greenBg }}>
                        ↗ Join
                      </a>
                      <button onClick={() => setExpandedId(isExpanded ? null : r.id)}
                        style={{ fontSize: 11, color: D.text2, padding: "3px 10px", borderRadius: 6, border: `1px solid ${D.border}`, background: "transparent", cursor: "pointer" }}>
                        {isExpanded ? "Hide" : "Queue ↓"}
                      </button>
                    </div>
                    {sharedStationIds.has(r.id) && (
                      <div style={{ fontSize: 10, color: D.muted }}>
                        Station requires client login as <code style={{ color: D.orange, background: "rgba(245,158,11,0.08)", padding: "1px 5px", borderRadius: 3 }}>{r.loginAs}</code>
                      </div>
                    )}
                  </div>
                </div>

                {/* Three stat cells */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0, background: D.surface2, borderRadius: 10, overflow: "hidden", border: `1px solid ${D.border}` }}>
                  {[
                    {
                      label: "Queue",
                      value: activeQueue.length,
                      color: activeQueue.length > 0 ? D.orange : D.green,
                      big: true,
                    },
                    {
                      label: "Tables",
                      value: `${r.tablesOccupied}/${r.tablesTotal}`,
                      color: D.text,
                      big: false,
                    },
                    {
                      label: "Avg Wait",
                      value: r.avgWait ? `${Math.round(r.avgWait)}m` : "—",
                      color: D.text2,
                      big: false,
                    },
                  ].map((cell, ci) => (
                    <div key={cell.label} style={{
                      padding: "12px 14px",
                      borderRight: ci < 2 ? `1px solid ${D.border}` : "none",
                    }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: D.muted, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 4 }}>{cell.label}</div>
                      <div style={{ fontSize: cell.big ? 24 : 18, fontWeight: 700, color: cell.color, lineHeight: 1 }}>{String(cell.value)}</div>
                    </div>
                  ))}
                </div>

                {/* Utilization bar */}
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 10, color: D.muted }}>Capacity utilization</span>
                    <span style={{ fontSize: 10, color: utilColor, fontWeight: 700 }}>{util}%</span>
                  </div>
                  <div style={{ background: D.border, borderRadius: 4, height: 5 }}>
                    <div style={{ background: utilColor, height: 5, borderRadius: 4, width: `${Math.min(100, util)}%`, transition: "width 0.6s ease" }} />
                  </div>
                </div>
              </div>

              {/* Expanded queue table */}
              {isExpanded && (
                <div>
                  {activeQueue.length === 0 ? (
                    <div style={{ padding: "20px", textAlign: "center", color: D.muted, fontSize: 13 }}>No parties in queue</div>
                  ) : (
                    <div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 48px 72px 64px 56px",
                        padding: "7px 16px", fontSize: 9, color: D.muted, textTransform: "uppercase", letterSpacing: "0.07em",
                        borderBottom: `1px solid ${D.border}` }}>
                        <span>Name</span>
                        <span style={{ textAlign: "center" }}>Party</span>
                        <span style={{ textAlign: "center" }}>Status</span>
                        <span style={{ textAlign: "center" }}>Quoted</span>
                        <span style={{ textAlign: "right" }}>Waiting</span>
                      </div>
                      {activeQueue.map((p, i) => (
                        <div key={p.id} style={{ display: "grid", gridTemplateColumns: "1fr 48px 72px 64px 56px",
                          padding: "10px 16px", alignItems: "center",
                          borderBottom: i < activeQueue.length - 1 ? `1px solid ${D.border}` : "none",
                          background: p.status === "ready" ? "rgba(251,191,36,0.03)" : "transparent" }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: D.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{p.name}</span>
                          <span style={{ textAlign: "center", fontSize: 13, color: D.text2 }}>{p.partySize}</span>
                          <span style={{ textAlign: "center" }}>{statusBadge(p.status)}</span>
                          <span style={{ textAlign: "center", fontSize: 12, color: D.text2 }}>{p.quotedWait ? `${p.quotedWait}m` : "—"}</span>
                          <span style={{ textAlign: "right", fontSize: 11, color: D.muted }}>{minutesAgo(p.arrivedAt) || "—"}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Clients View ───────────────────────────────────────────────────────────────
function ClientsView({ token, onSelectClient, onAddNew }: {
  token: string
  onSelectClient: (c: Client) => void
  onAddNew: () => void
}) {
  const [clients,  setClients]  = useState<Client[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState("")
  const [search,   setSearch]   = useState("")
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    fetch(`${API}/owner/clients?secret=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(r => r.json())
      .then(d => { setClients(d.clients || []); setLastRefresh(new Date()) })
      .catch(() => setError("Failed to load clients"))
      .finally(() => setLoading(false))
  }, [token])

  useEffect(() => { load() }, [load])

  const [archiving, setArchiving] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  async function setStatus(clientId: string, status: "active" | "archived") {
    setArchiving(clientId)
    try {
      await fetch(`${API}/owner/clients/${clientId}?secret=${encodeURIComponent(token)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      setClients(prev => prev.map(c => c.id === clientId ? { ...c, status } : c))
    } catch {}
    setArchiving(null)
  }

  const activeClients   = clients.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.city || "").toLowerCase().includes(search.toLowerCase())).filter(c => c.status !== "archived")
  const archivedClients = clients.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.city || "").toLowerCase().includes(search.toLowerCase())).filter(c => c.status === "archived")

  const filtered = activeClients

  // Group clients by location_group; ungrouped = individual cards
  function formatGroupName(key: string) {
    return key.replace(/-/g, " ").replace(/\b\w/g, ch => ch.toUpperCase())
  }
  const groupMap = new Map<string, Client[]>()
  const ungrouped: Client[] = []
  for (const c of filtered) {
    if (c.location_group) {
      const list = groupMap.get(c.location_group) || []
      list.push(c)
      groupMap.set(c.location_group, list)
    } else {
      ungrouped.push(c)
    }
  }
  // Render groups first (multi-location), then single-location clients
  type CardItem = { type: "group"; groupKey: string; groupName: string; locs: Client[] } | { type: "single"; client: Client }
  const cards: CardItem[] = [
    ...Array.from(groupMap.entries()).map(([k, locs]) => ({ type: "group" as const, groupKey: k, groupName: formatGroupName(k), locs })),
    ...ungrouped.map(c => ({ type: "single" as const, client: c })),
  ]

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: D.text, margin: "0 0 4px" }}>Clients</h1>
          <p style={{ color: D.text2, fontSize: 13, margin: 0 }}>
            {clients.length} restaurant{clients.length !== 1 ? "s" : ""}
            {lastRefresh && ` · Updated ${lastRefresh.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={load}
            style={{ padding: "9px 16px", borderRadius: 8, border: `1px solid ${D.border}`, background: "transparent", color: D.text2, fontSize: 13, cursor: "pointer" }}>
            ↺ Refresh
          </button>
          <button onClick={onAddNew}
            style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: D.accent, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            + Add Restaurant
          </button>
        </div>
      </div>

      <input placeholder="Search clients…" value={search} onChange={e => setSearch(e.target.value)}
        style={{ ...inputFull, marginBottom: 20, fontSize: 14 }} />

      {loading && <div style={{ color: D.muted, fontSize: 14, textAlign: "center", padding: "40px 0" }}>Loading clients…</div>}
      {error && <div style={{ color: D.red, fontSize: 14 }}>{error}</div>}

      {!loading && cards.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 0", color: D.muted }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏢</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>No clients yet</div>
          <div style={{ fontSize: 13 }}>Click &quot;+ Add Client&quot; to onboard your first restaurant</div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16, marginBottom: archivedClients.length > 0 ? 32 : 0 }}>
        {cards.map(card => {
          if (card.type === "group") {
            // Multi-location client card
            const { groupKey, groupName, locs } = card
            const rep = locs[0] // representative for plan/status
            return (
              <div key={groupKey}
                style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 14, padding: "20px 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 10, background: D.accent + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                    🏢
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", borderRadius: 20, padding: "2px 10px",
                      color: D.blue, background: D.blueBg, border: `1px solid ${D.blueBorder}`, whiteSpace: "nowrap" }}>
                      {locs.length} Locations
                    </span>
                    {planBadge(rep.plan_type, rep.status)}
                  </div>
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: D.text, marginBottom: 4 }}>{groupName}</div>
                <div style={{ fontSize: 13, color: D.text2, marginBottom: 12 }}>{rep.city || "No city set"}</div>
                {/* Location buttons */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                  {locs.map(loc => (
                    <button key={loc.id} onClick={() => onSelectClient(loc)}
                      style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${D.borderStrong}`,
                        background: D.surface2, color: D.text, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
                      {loc.location_name || loc.name}
                    </button>
                  ))}
                </div>
                {rep.monthly_fee_cents != null && rep.monthly_fee_cents > 0 && (
                  <div style={{ fontSize: 12, color: D.muted }}>
                    💳 ${(rep.monthly_fee_cents/100).toFixed(2)}/mo per location
                  </div>
                )}
              </div>
            )
          }
          // Single-location client card
          const c = card.client
          return (
            <div key={c.id}
              style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 14, padding: "20px 20px", position: "relative" }}>
              <div onClick={() => onSelectClient(c)} style={{ cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 10, background: D.accent + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🏢</div>
                  {planBadge(c.plan_type, c.status)}
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: D.text, marginBottom: 4 }}>{c.display_name}</div>
                <div style={{ fontSize: 13, color: D.text2, marginBottom: 12 }}>{c.city || "No city set"}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ fontSize: 12, color: D.muted }}>🔗 <span style={{ color: D.blue }}>/{c.slug}</span></div>
                  {c.signed_at && <div style={{ fontSize: 12, color: D.muted }}>✍️ Signed {fmtTime(c.signed_at)}</div>}
                  {c.monthly_fee_cents != null && c.monthly_fee_cents > 0 && (
                    <div style={{ fontSize: 12, color: D.muted }}>💳 ${(c.monthly_fee_cents/100).toFixed(2)}/mo</div>
                  )}
                </div>
              </div>
              <button
                onClick={e => { e.stopPropagation(); setStatus(c.id, "archived") }}
                disabled={archiving === c.id}
                style={{ marginTop: 14, width: "100%", padding: "7px 0", borderRadius: 8, border: `1px solid ${D.border}`, background: "transparent", color: D.muted, fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: archiving === c.id ? 0.5 : 1 }}>
                {archiving === c.id ? "Archiving…" : "Archive"}
              </button>
            </div>
          )
        })}
      </div>

      {/* Archived section */}
      {archivedClients.length > 0 && (
        <div>
          <button onClick={() => setShowArchived(p => !p)}
            style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", padding: "8px 0", marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: D.muted, letterSpacing: "0.10em", textTransform: "uppercase" }}>
              Archived ({archivedClients.length})
            </span>
            <span style={{ fontSize: 12, color: D.muted }}>{showArchived ? "▲" : "▼"}</span>
          </button>
          {showArchived && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
              {archivedClients.map(c => (
                <div key={c.id} style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, padding: "16px 18px", opacity: 0.65 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: D.text2 }}>{c.display_name}</div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: D.muted, background: D.surface2, border: `1px solid ${D.border}`, borderRadius: 10, padding: "2px 8px" }}>Archived</span>
                  </div>
                  <div style={{ fontSize: 12, color: D.muted, marginBottom: 12 }}>/{c.slug}</div>
                  <button
                    onClick={() => setStatus(c.id, "active")}
                    disabled={archiving === c.id}
                    style={{ width: "100%", padding: "7px 0", borderRadius: 8, border: `1px solid ${D.green}40`, background: D.greenBg, color: D.green, fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: archiving === c.id ? 0.5 : 1 }}>
                    {archiving === c.id ? "Restoring…" : "Unarchive"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Billing View ───────────────────────────────────────────────────────────────
function BillingView({ token }: { token: string }) {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API}/owner/clients?secret=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(r => r.json())
      .then(d => setClients(d.clients || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [token])

  const paying   = clients.filter(c => (c.monthly_fee_cents || 0) > 0)
  const free     = clients.filter(c => !c.monthly_fee_cents || c.monthly_fee_cents === 0)
  const totalMRR = paying.reduce((s, c) => s + (c.monthly_fee_cents || 0), 0)

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: D.text, margin: "0 0 8px" }}>Billing</h1>
      <p style={{ color: D.text2, fontSize: 14, margin: "0 0 32px" }}>Monthly recurring revenue and plan overview</p>

      {/* MRR summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16, marginBottom: 32 }}>
        {[
          { label: "Monthly Revenue", value: `$${(totalMRR / 100).toFixed(2)}`, color: D.green },
          { label: "Paying Clients",  value: String(paying.length),  color: D.blue  },
          { label: "Free/Partner",    value: String(free.length),    color: D.muted },
          { label: "Annual Revenue",  value: `$${(totalMRR * 12 / 100).toFixed(2)}`, color: D.orange },
        ].map(card => (
          <div key={card.label} style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 11, color: D.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>{card.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      {loading && <div style={{ color: D.muted, fontSize: 14 }}>Loading…</div>}

      {!loading && (
        <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${D.border}`, display: "grid", gridTemplateColumns: "1fr auto auto auto auto", gap: 12, fontSize: 11, color: D.muted, textTransform: "uppercase", letterSpacing: "0.07em" }}>
            <span>Client</span><span>Plan</span><span>Status</span><span>Locations</span><span>Monthly</span>
          </div>
          {clients.map((c, i) => (
            <div key={c.id} style={{ padding: "14px 20px", borderBottom: i < clients.length - 1 ? `1px solid ${D.border}` : "none",
              display: "grid", gridTemplateColumns: "1fr auto auto auto auto", gap: 12, alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: D.text }}>{c.display_name}</div>
                <div style={{ fontSize: 12, color: D.muted }}>{c.city || "—"}</div>
              </div>
              <span style={{ fontSize: 13, color: D.text2, textTransform: "capitalize" }}>{c.plan_type}</span>
              {planBadge(c.plan_type, c.status)}
              <span style={{ fontSize: 13, color: D.text2 }}>{c.location_count || 1}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: (c.monthly_fee_cents || 0) > 0 ? D.green : D.muted }}>
                {(c.monthly_fee_cents || 0) > 0 ? `$${(c.monthly_fee_cents! / 100).toFixed(2)}` : "Free"}
              </span>
            </div>
          ))}
          {clients.length === 0 && (
            <div style={{ padding: "32px 20px", textAlign: "center", color: D.muted, fontSize: 14 }}>No clients yet</div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Restaurant ID → name map (used by analytics) ──────────────────────────────
const RID_NAMES: Record<string, string> = {
  "272a8876-e4e6-4867-831d-0525db80a8db": "Walter's 303",
  "0001cafe-0001-4000-8000-000000000001": "Walnut Original",
  "0002cafe-0001-4000-8000-000000000002": "Walnut Southside",
  "dec0cafe-0000-4000-8000-000000000001": "Demo",
}

// ── Website Analytics View ─────────────────────────────────────────────────────
function WebsiteAnalyticsView({ token }: { token: string }) {
  const [gaData,    setGaData]    = useState<GAData | null>(null)
  const [gaLoading, setGaLoading] = useState(true)
  const [gaError,   setGaError]   = useState<string | null>(null)

  function load() {
    setGaLoading(true); setGaError(null)
    fetch(`/api/ga?secret=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(r => r.json())
      .then(d => { setGaData(d); if (d.error) setGaError(d.error) })
      .catch(() => setGaData({ configured: false }))
      .finally(() => setGaLoading(false))
  }

  useEffect(() => { load() }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  const gaTotal = gaData?.sources?.reduce((a, b) => a + b.sessions, 0) ?? 1

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: D.text, margin: "0 0 4px" }}>Website Analytics</h1>
          <p style={{ color: D.text2, fontSize: 13, margin: 0 }}>hostplatform.net · powered by Google Analytics</p>
        </div>
        <button onClick={load} disabled={gaLoading}
          style={{ padding: "7px 16px", borderRadius: 7, border: `1px solid ${D.border}`, background: "transparent", color: D.text2, fontSize: 13, cursor: "pointer" }}>
          {gaLoading ? "Loading…" : "↺ Refresh"}
        </button>
      </div>

      {gaLoading ? (
        <div style={{ color: D.muted, fontSize: 14, textAlign: "center" as const, padding: "60px 0" }}>Loading traffic data…</div>

      ) : !gaData?.configured ? (
        <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 14, padding: "48px 32px", textAlign: "center" as const }}>
          <div style={{ fontSize: 40, marginBottom: 14 }}>📡</div>
          <div style={{ color: D.text, fontWeight: 700, fontSize: 18, marginBottom: 8 }}>GA4 Not Connected</div>
          <div style={{ color: D.text2, fontSize: 14, maxWidth: 480, margin: "0 auto 16px", lineHeight: 1.6 }}>
            To display live website traffic data here, add two environment variables to Railway and redeploy.
          </div>
          <div style={{ background: D.surface2, border: `1px solid ${D.border}`, borderRadius: 10, padding: "16px 20px", display: "inline-block", textAlign: "left" as const, fontFamily: "monospace", fontSize: 13 }}>
            <div style={{ color: D.green, marginBottom: 6 }}>GA_PROPERTY_ID=<span style={{ color: D.text2 }}>your-numeric-property-id</span></div>
            <div style={{ color: D.green }}>GA_SERVICE_ACCOUNT_JSON=<span style={{ color: D.text2 }}>{"{"}"type":"service_account",...{"}"}</span></div>
          </div>
          {gaError && <div style={{ color: D.red, fontSize: 12, marginTop: 14 }}>{gaError}</div>}
        </div>

      ) : (
        <>
          {/* ── Today's metric cards ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 16 }}>
            {([
              { label: "Sessions Today",   value: gaData.today?.sessions    ?? 0, color: D.green },
              { label: "Page Views Today", value: gaData.today?.pageviews   ?? 0, color: D.blue  },
              { label: "Active Users",     value: gaData.today?.activeUsers ?? 0, color: D.orange },
              { label: "New Users Today",  value: gaData.today?.newUsers    ?? 0, color: D.purple },
            ] as { label: string; value: number; color: string }[]).map(({ label, value, color }) => (
              <div key={label} style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, padding: "18px 20px" }}>
                <div style={{ color: D.muted, fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 8 }}>{label}</div>
                <div style={{ color, fontSize: 32, fontWeight: 700, lineHeight: 1 }}>{value.toLocaleString()}</div>
              </div>
            ))}
          </div>

          {/* ── Daily sessions chart ── */}
          {(gaData.daily?.length ?? 0) > 0 && (
            <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, padding: "18px 20px", marginBottom: 16 }}>
              <div style={{ color: D.text2, fontSize: 12, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 16 }}>
                Sessions · Last 14 Days
              </div>
              <ResponsiveContainer width="100%" height={130}>
                <BarChart data={gaData.daily} margin={{ top: 0, right: 4, left: -26, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={D.border} vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: D.muted, fontSize: 10 }} tickLine={false} axisLine={false}
                    tickFormatter={d => { const p = d.split("-"); return `${p[1]}/${p[2]}` }} />
                  <YAxis tick={{ fill: D.muted, fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: D.sidebar, border: `1px solid ${D.border}`, borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: D.text2 }}
                    cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                  <Bar dataKey="sessions" fill={D.green} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── Top pages + Traffic sources ── */}
          <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 14 }}>
            {/* Top Pages */}
            <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, overflow: "hidden" }}>
              <div style={{ padding: "12px 18px", borderBottom: `1px solid ${D.border}`, color: D.muted, fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>
                Top Pages · 7 Days
              </div>
              {(gaData.pages ?? []).slice(0, 9).map((p, i) => (
                <div key={p.path + i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "9px 18px", borderBottom: `1px solid ${D.border}` }}>
                  <div style={{ color: D.text, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis",
                    whiteSpace: "nowrap" as const, maxWidth: "78%", fontFamily: "monospace", letterSpacing: "-0.02em" }}>
                    {p.path === "/" ? "/ · Home" : p.path}
                  </div>
                  <div style={{ color: D.green, fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{p.pageviews.toLocaleString()}</div>
                </div>
              ))}
            </div>

            {/* Traffic Sources */}
            <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, overflow: "hidden" }}>
              <div style={{ padding: "12px 18px", borderBottom: `1px solid ${D.border}`, color: D.muted, fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>
                Traffic Sources · 7 Days
              </div>
              {(gaData.sources ?? []).map((s, i) => {
                const pct = Math.round((s.sessions / gaTotal) * 100)
                return (
                  <div key={s.source + i} style={{ padding: "10px 18px", borderBottom: `1px solid ${D.border}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ color: D.text, fontSize: 13 }}>{s.source}</span>
                      <span style={{ color: D.text2, fontSize: 12 }}>{s.sessions} sessions</span>
                    </div>
                    <div style={{ background: D.border, borderRadius: 4, height: 3 }}>
                      <div style={{ background: D.blue, height: 3, borderRadius: 4, width: `${pct}%`, transition: "width 0.4s ease" }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Analytics View ─────────────────────────────────────────────────────────────
function AnalyticsView({ token, clients }: { token: string; clients: Client[] }) {
  const [data,      setData]      = useState<AnalyticsEntry[]>([])
  const [loading,   setLoading]   = useState(false)
  const [fetched,   setFetched]   = useState(false)
  const [page,      setPage]      = useState(0)
  const [restFilter, setRestFilter] = useState<string>("all")
  const [sortKey,   setSortKey]   = useState<string>("arrival_time")
  const [sortDir,   setSortDir]   = useState<"asc"|"desc">("desc")
  const PAGE_SIZE = 50

  const ridNames = useMemo(() => {
    const map: Record<string, string> = {
      "272a8876-e4e6-4867-831d-0525db80a8db": "Walter's 303",
      "0001cafe-0001-4000-8000-000000000001": "Walnut Original",
      "0002cafe-0001-4000-8000-000000000002": "Walnut Southside",
      [DEMO_RID]: "Demo",
    }
    clients.forEach(c => { if (c.id) map[c.id] = c.display_name || c.name })
    return map
  }, [clients])

  const load = useCallback(() => {
    setLoading(true)
    fetch(`${API}/owner/analytics?secret=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(r => r.json())
      .then(d => { setData(d.entries || []); setFetched(true); setPage(0) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [token])

  useEffect(() => { load() }, [load])

  // Build restaurant list: active/trial clients + any IDs seen in analytics data
  const activeClientIds = new Set(
    clients.filter(c => c.status !== "archived").map(c => c.id).filter((x): x is string => !!x)
  )
  const restaurants = Array.from(new Set([
    ...activeClientIds,
    ...data.map(e => e.restaurant_id).filter((x): x is string => x !== null && activeClientIds.has(x)),
  ]))
  const filtered = data.filter(e => restFilter === "all" || e.restaurant_id === restFilter)

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    const va = (a as unknown as Record<string,unknown>)[sortKey] ?? ""
    const vb = (b as unknown as Record<string,unknown>)[sortKey] ?? ""
    const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true })
    return sortDir === "asc" ? cmp : -cmp
  })

  const slice = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE)

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortKey(key); setSortDir("desc") }
    setPage(0)
  }

  function exportCSV() {
    const cols = ["name","party_size","restaurant","phone","source","status","arrival_time","quoted_wait","actual_wait","notes"]
    const header = cols.join(",")
    const rows = sorted.map(e => cols.map(c => {
      const v = c === "restaurant"
        ? (ridNames[e.restaurant_id || ""] || e.restaurant_id || "")
        : (e as unknown as Record<string,unknown>)[c]
      const str = v == null ? "" : String(v)
      return str.includes(",") || str.includes('"') ? `"${str.replace(/"/g,'""')}"` : str
    }).join(","))
    const csv = [header, ...rows].join("\n")
    const a = document.createElement("a")
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }))
    a.download = `host-analytics-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
  }

  function sourceStyle(s: string): React.CSSProperties {
    const base: React.CSSProperties = { fontSize: 10, fontWeight: 700, borderRadius: 20, padding: "2px 8px", border: "1px solid", whiteSpace: "nowrap" }
    if (s === "nfc")    return { ...base, color: "#60A5FA", background: "rgba(96,165,250,0.12)",  borderColor: "rgba(96,165,250,0.25)"  }
    if (s === "host")   return { ...base, color: "#22C55E", background: "rgba(34,197,94,0.10)",   borderColor: "rgba(34,197,94,0.22)"   }
    if (s === "analog") return { ...base, color: "#F59E0B", background: "rgba(245,158,11,0.10)",  borderColor: "rgba(245,158,11,0.25)"  }
    return { ...base, color: D.muted, background: D.surface, borderColor: D.border }
  }

  function statusStyle(s: string): React.CSSProperties {
    const base: React.CSSProperties = { fontSize: 10, fontWeight: 700, borderRadius: 20, padding: "2px 8px", border: "1px solid", whiteSpace: "nowrap" }
    if (s === "seated")  return { ...base, color: "#22C55E", background: "rgba(34,197,94,0.10)",  borderColor: "rgba(34,197,94,0.22)" }
    if (s === "removed") return { ...base, color: "#EF4444", background: "rgba(239,68,68,0.10)",  borderColor: "rgba(239,68,68,0.22)" }
    if (s === "ready")   return { ...base, color: "#FBBF24", background: "rgba(251,191,36,0.10)", borderColor: "rgba(251,191,36,0.25)" }
    return { ...base, color: "#60A5FA", background: "rgba(96,165,250,0.10)", borderColor: "rgba(96,165,250,0.25)" }
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: D.text, margin: "0 0 4px" }}>Guest Analytics</h1>
          <p style={{ color: D.text2, fontSize: 13, margin: 0 }}>{sorted.length.toLocaleString()} records{restFilter !== "all" ? ` (filtered)` : ` total`}</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={restFilter} onChange={e => { setRestFilter(e.target.value); setPage(0) }}
            style={{ padding: "7px 10px", borderRadius: 7, border: `1px solid ${D.border}`, background: D.surface2, color: D.text2, fontSize: 13, cursor: "pointer" }}>
            <option value="all">All Restaurants</option>
            {restaurants.map(rid => <option key={rid} value={rid}>{ridNames[rid] || rid?.slice(0,8)}</option>)}
          </select>
          {fetched && <button onClick={exportCSV}
            style={{ padding: "7px 16px", borderRadius: 7, border: `1px solid ${D.greenBorder}`, background: D.greenBg, color: D.green, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            ↓ Export CSV
          </button>}
          <button onClick={load} disabled={loading}
            style={{ padding: "7px 16px", borderRadius: 7, border: `1px solid ${D.border}`, background: "transparent", color: D.text2, fontSize: 13, cursor: "pointer" }}>
            {loading ? "Loading…" : "↺ Refresh"}
          </button>
        </div>
      </div>

      {loading && <div style={{ color: D.muted, fontSize: 14, textAlign: "center", padding: "40px 0" }}>Loading analytics…</div>}

      {fetched && !loading && (() => {
        const seated    = sorted.filter(e => e.status === "seated")
        const withWait  = sorted.filter(e => e.actual_wait != null && (e.actual_wait || 0) > 0)
        const avgWait   = withWait.length ? Math.round(withWait.reduce((s, e) => s + (e.actual_wait || 0), 0) / withWait.length) : null
        const avgParty  = sorted.length ? (sorted.reduce((s, e) => s + e.party_size, 0) / sorted.length).toFixed(1) : null
        const seatedPct = sorted.length ? Math.round((seated.length / sorted.length) * 100) : 0
        // Party count by hour of day (from arrival_time)
        const byHour: number[] = Array(24).fill(0)
        sorted.forEach(e => { if (e.arrival_time) { const h = new Date(e.arrival_time).getHours(); byHour[h]++ } })
        const peakHour  = byHour.indexOf(Math.max(...byHour))
        const maxHour   = Math.max(...byHour) || 1
        return (
          <>
            {/* Stat cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
              {[
                { label: "Total Parties",     value: sorted.length.toLocaleString(),  color: D.blue   },
                { label: "Seated",            value: `${seated.length} (${seatedPct}%)`, color: D.green  },
                { label: "Avg Actual Wait",   value: avgWait ? `${avgWait} min` : "—", color: D.orange },
                { label: "Avg Party Size",    value: avgParty || "—",                  color: D.purple },
              ].map(c => (
                <div key={c.label} style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, padding: "14px 18px" }}>
                  <div style={{ fontSize: 10, color: D.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{c.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: c.color }}>{c.value}</div>
                </div>
              ))}
            </div>

            {/* Peak hours mini-chart */}
            {sorted.length > 0 && (
              <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, padding: "16px 18px", marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: D.text2, textTransform: "uppercase", letterSpacing: "0.08em" }}>Arrivals by Hour of Day</div>
                  <div style={{ fontSize: 12, color: D.text2 }}>
                    Peak: <strong style={{ color: D.orange }}>{peakHour === 0 ? "12am" : peakHour < 12 ? `${peakHour}am` : peakHour === 12 ? "12pm" : `${peakHour-12}pm`}</strong>
                    {" "}({byHour[peakHour]} parties)
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 50 }}>
                  {byHour.map((count, hour) => {
                    const pct  = (count / maxHour) * 100
                    const isP  = hour === peakHour
                    const label = hour === 0 ? "12a" : hour < 12 ? `${hour}a` : hour === 12 ? "12p" : `${hour-12}p`
                    return (
                      <div key={hour} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }} title={`${label}: ${count} parties`}>
                        <div style={{ width: "100%", background: isP ? D.orange : D.blue, opacity: count === 0 ? 0.2 : 1, borderRadius: "2px 2px 0 0", height: `${Math.max(2, pct)}%`, transition: "height 0.3s" }} />
                        {(hour % 4 === 0) && <div style={{ fontSize: 8, color: D.muted, marginTop: 3 }}>{label}</div>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )
      })()}

      {fetched && !loading && (
        <>
          <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${D.border}` }}>
                  {([
                    ["name","Name"],["party_size","Party"],["restaurant_id","Restaurant"],
                    ["source","Source"],["status","Status"],["arrival_time","Arrival"],
                    ["quoted_wait","Quoted"],["actual_wait","Actual Wait"],["phone","Phone"],["notes","Notes"]
                  ] as [string,string][]).map(([key, label]) => (
                    <th key={key} onClick={() => toggleSort(key)}
                      style={{ padding: "10px 14px", textAlign: "left", color: sortKey === key ? D.blue : D.muted,
                        fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.07em",
                        whiteSpace: "nowrap", cursor: "pointer", userSelect: "none" }}>
                      {label}{sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slice.map((e, i) => (
                  <tr key={e.id} style={{ borderBottom: i < slice.length - 1 ? `1px solid ${D.border}` : "none" }}>
                    <td style={{ padding: "10px 14px", color: D.text, fontWeight: 500 }}>{e.name}</td>
                    <td style={{ padding: "10px 14px", color: D.text2 }}>{e.party_size}</td>
                    <td style={{ padding: "10px 14px", color: D.text2, fontSize: 12 }}>{ridNames[e.restaurant_id || ""] || (e.restaurant_id?.slice(0,8) || "—")}</td>
                    <td style={{ padding: "10px 14px" }}><span style={sourceStyle(e.source)}>{e.source.toUpperCase()}</span></td>
                    <td style={{ padding: "10px 14px" }}><span style={statusStyle(e.status)}>{e.status}</span></td>
                    <td style={{ padding: "10px 14px", color: D.text2, whiteSpace: "nowrap" }}>{e.arrival_time ? new Date(e.arrival_time).toLocaleString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}) : "—"}</td>
                    <td style={{ padding: "10px 14px", color: D.text2 }}>{e.quoted_wait != null ? `${e.quoted_wait}m` : "—"}</td>
                    <td style={{ padding: "10px 14px", color: D.text2 }}>{e.actual_wait != null ? `${e.actual_wait}m` : "—"}</td>
                    <td style={{ padding: "10px 14px", color: D.text2, fontSize: 12 }}>{e.phone ? <a href={`tel:${e.phone}`} style={{ color: D.blue, textDecoration: "none" }}>{e.phone}</a> : "—"}</td>
                    <td style={{ padding: "10px 14px", color: D.text2, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
              <button onClick={() => setPage(p => Math.max(0, p-1))} disabled={page === 0}
                style={{ padding: "6px 14px", borderRadius: 6, border: `1px solid ${D.border}`, background: "transparent", color: D.text2, cursor: "pointer" }}>← Prev</button>
              <span style={{ color: D.text2, fontSize: 13, alignSelf: "center" }}>{page+1} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages-1, p+1))} disabled={page === totalPages-1}
                style={{ padding: "6px 14px", borderRadius: 6, border: `1px solid ${D.border}`, background: "transparent", color: D.text2, cursor: "pointer" }}>Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Agreements View ────────────────────────────────────────────────────────────
function AgreementsView({ token }: { token: string }) {
  const [tab,        setTab]        = useState<"signed" | "terms">("signed")
  const [agreements, setAgreements] = useState<AgreementRecord[]>([])
  const [loading,    setLoading]    = useState(false)
  const [fetched,    setFetched]    = useState(false)
  const [error,      setError]      = useState<string|null>(null)
  const [deleting,   setDeleting]   = useState<string|null>(null)
  const [copied,     setCopied]     = useState<string|null>(null)
  const [clients,    setClients]    = useState<Client[]>([])

  useEffect(() => {
    fetch(`${API}/owner/clients?secret=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(r => r.json())
      .then(d => setClients(d.clients || []))
      .catch(() => {/* non-critical */})
  }, [token])

  // Terms management state — synced from server on mount
  const [termsVersion,  setTermsVersion]  = useState(CURRENT_VERSION)
  const [termsDate,     setTermsDate]     = useState(EFFECTIVE_DATE)
  const [termsSections, setTermsSections] = useState<TermsSection[]>(TERMS_SECTIONS)
  const [termsEditing,  setTermsEditing]  = useState(false)
  const [termsPublishing, setTermsPublishing] = useState(false)
  const [termsPublished,  setTermsPublished]  = useState<string|null>(null)

  // Sync terms state from server on mount so UI reflects any active override
  useEffect(() => {
    fetch(`/api/admin/terms?secret=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(r => r.json())
      .then(t => {
        if (t.version)   setTermsVersion(t.version)
        if (t.effectiveDate) setTermsDate(t.effectiveDate)
        if (Array.isArray(t.sections) && t.sections.length > 0) setTermsSections(t.sections)
      })
      .catch(() => {/* use defaults */})
  }, [token])

  // Link generator state
  const [linkClient, setLinkClient] = useState("")
  const [linkEmail,  setLinkEmail]  = useState("")
  const [linkPlan,   setLinkPlan]   = useState("free")
  const [linkLocs,   setLinkLocs]   = useState("1")

  // Push-to-clients state
  const [pushSelected, setPushSelected] = useState<Set<string>>(new Set())
  const [pushing,      setPushing]      = useState(false)
  const [pushDone,     setPushDone]     = useState<string|null>(null)

  const generatedLink = useMemo(() => {
    const base = typeof window !== "undefined" ? window.location.origin : "https://hostplatform.net"
    const p = new URLSearchParams()
    if (linkClient) p.set("biz",   linkClient)
    if (linkEmail)  p.set("email", linkEmail)
    if (linkPlan)   p.set("plan",  linkPlan)
    if (linkLocs && linkLocs !== "1") p.set("locs", linkLocs)
    return `${base}/signup?${p.toString()}`
  }, [linkClient, linkEmail, linkPlan, linkLocs])

  function load() {
    setLoading(true); setError(null)
    fetch(`${API}/agreements/all?secret=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(r => r.json())
      .then(d => { setAgreements(d.agreements || []); setFetched(true) })
      .catch(() => setError("Failed to load agreements"))
      .finally(() => setLoading(false))
  }

  async function deleteAgreement(id: string) {
    if (!confirm("Permanently delete this agreement? This cannot be undone.")) return
    setDeleting(id)
    try {
      await fetch(`${API}/owner/agreements/${id}?secret=${encodeURIComponent(token)}`, { method: "DELETE" })
      setAgreements(prev => prev.filter(a => a.id !== id))
    } catch { setError("Delete failed") }
    finally { setDeleting(null) }
  }

  async function publishTerms() {
    if (!confirm(`Publish version "${termsVersion}" as the current Terms of Service?`)) return
    setTermsPublishing(true)
    try {
      await fetch(`/api/admin/terms?secret=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: termsVersion, effectiveDate: termsDate, sections: termsSections }),
      })
      setTermsPublished(new Date().toLocaleString())
      setTermsEditing(false)
    } catch { alert("Publish failed") }
    finally { setTermsPublishing(false) }
  }

  async function pushToClients() {
    if (pushSelected.size === 0) return
    if (!confirm(`Push terms to ${pushSelected.size} client(s)? All HOST stations that are open will see the acceptance modal within 20 seconds.`)) return
    setPushing(true)
    try {
      // How the push works:
      // Station devices store the last accepted version in localStorage.
      // On every 20-second poll, each station fetches /api/admin/terms and
      // compares the server version against localStorage. If they differ → modal.
      //
      // We ALWAYS generate a fresh unique push version on each push, so:
      //   • Stations that already accepted a previous push see the modal again
      //   • Pushing multiple times in the same day/session each produce a new string
      //
      // Format: {CANONICAL_BASE}-push{YYYYMMDDHHmmss}
      // The base is always stripped to the canonical version so the lineage is clear.
      const base = CURRENT_VERSION.replace(/-push\d+$/, "")
      const ts   = new Date().toISOString().replace(/\D/g, "").slice(0, 14) // e.g. "20260513143022"
      const versionToPush = `${base}-push${ts}`

      const pushRes = await fetch(`/api/admin/terms?secret=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version:       versionToPush,
          effectiveDate: termsDate,
          sections:      termsSections,
          publishedBy:   "Owner Push",
        }),
      })
      if (!pushRes.ok) throw new Error("Server rejected push")
      setTermsVersion(versionToPush)
      setPushDone(new Date().toLocaleString())
      setPushSelected(new Set())
    } catch { alert("Push failed — check connection and retry") }
    finally { setPushing(false) }
  }

  function copyLink(url: string, key: string) {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(key); setTimeout(() => setCopied(null), 2000)
    })
  }

  function sendLinkForClient(client: Client) {
    const base = typeof window !== "undefined" ? window.location.origin : "https://hostplatform.net"
    const p = new URLSearchParams({ biz: client.name, plan: client.plan_type || "free" })
    if (client.signer_email) p.set("email", client.signer_email)
    copyLink(`${base}/signup?${p.toString()}`, client.id)
  }

  function downloadPDF(a: AgreementRecord) {
    const sectionsHtml = TERMS_SECTIONS.map(s =>
      `<div class="terms-section">${s.heading}</div>` +
      s.body.split("\n\n").map(p => `<p>${p.replace(/\n/g, " ")}</p>`).join("")
    ).join("")

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>${ENTITY_NAME} Agreement — ${a.business_name}</title>
<style>
  body{font-family:-apple-system,system-ui,sans-serif;max-width:720px;margin:40px auto;padding:0 32px;color:#1a1a1a;font-size:14px;line-height:1.6}
  h1{font-size:22px;font-weight:700;border-bottom:2px solid #000;padding-bottom:12px;margin-bottom:24px}
  h2{font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#555;margin:28px 0 8px}
  .meta{display:grid;grid-template-columns:1fr 1fr;gap:16px 32px;margin-bottom:24px}
  .field{background:#f8f8f8;border:1px solid #e0e0e0;border-radius:6px;padding:10px 14px}
  .field-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#888;margin-bottom:4px}
  .field-value{font-size:14px;font-weight:500}
  .stamp{background:#f0f7ff;border:1px solid #b3d4f5;border-radius:6px;padding:12px 16px;margin:24px 0;font-size:12px;color:#1a4a7a}
  .sig{border:2px solid #000;border-radius:6px;padding:16px 20px;margin-top:24px;font-size:13px}
  .sig strong{display:block;font-size:16px;margin-bottom:4px}
  .terms{margin-top:40px;border-top:3px solid #000;padding-top:24px}
  .terms-title{font-size:16px;font-weight:700;margin-bottom:4px}
  .terms-sub{font-size:11px;color:#888;margin-bottom:20px}
  .terms-section{font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.07em;margin:20px 0 6px;color:#333;border-top:1px solid #e0e0e0;padding-top:12px}
  .terms p{font-size:11px;line-height:1.75;margin:0 0 8px;color:#222}
  .legal{font-size:10px;color:#888;margin-top:32px;border-top:1px solid #e0e0e0;padding-top:16px}
  @media print{body{margin:20px auto}}
</style>
</head><body>
<h1>${ENTITY_NAME} — Master Subscription Agreement</h1>
<div class="stamp">
  🔐 Signed: ${new Date(a.signed_at).toLocaleString("en-US",{dateStyle:"full",timeStyle:"long"})} &nbsp;|&nbsp;
  IP: ${a.ip_address || "not recorded"} &nbsp;|&nbsp;
  Version: ${a.agreement_version || CURRENT_VERSION}
</div>
<h2>Business Information</h2>
<div class="meta">
  <div class="field"><div class="field-label">Business Name</div><div class="field-value">${a.business_name}</div></div>
  <div class="field"><div class="field-label">Plan</div><div class="field-value">${a.plan_type}</div></div>
  <div class="field"><div class="field-label">Monthly Fee</div><div class="field-value">${a.monthly_fee_cents != null ? `$${(a.monthly_fee_cents/100).toFixed(2)}/mo` : "Free"}</div></div>
  <div class="field"><div class="field-label">Locations</div><div class="field-value">${a.location_count || 1}</div></div>
</div>
<h2>Signer</h2>
<div class="meta">
  <div class="field"><div class="field-label">Name</div><div class="field-value">${a.signer_name}</div></div>
  ${a.signer_title ? `<div class="field"><div class="field-label">Title</div><div class="field-value">${a.signer_title}</div></div>` : ""}
  <div class="field"><div class="field-label">Email</div><div class="field-value">${a.signer_email}</div></div>
</div>
<div class="sig">
  <strong>${a.signer_name}</strong>
  ${a.signer_title ? a.signer_title + "<br/>" : ""}${a.business_name}<br/>
  <span style="font-size:12px;color:#555">Signed electronically on ${new Date(a.signed_at).toLocaleString("en-US",{dateStyle:"long",timeStyle:"short"})} from IP ${a.ip_address || "unknown"}</span>
</div>
<div class="terms">
  <div class="terms-title">${ENTITY_NAME.toUpperCase()} — MASTER SUBSCRIPTION AGREEMENT</div>
  <div class="terms-sub">${a.agreement_version || CURRENT_VERSION} · Effective ${EFFECTIVE_DATE} · hostplatform.net/legal/terms</div>
  ${sectionsHtml}
</div>
<div class="legal">
  Electronically signed agreement · ${ENTITY_NAME} · Agreement ID: ${a.id} · Generated: ${new Date().toISOString()}
</div>
</body></html>`
    const w = window.open("", "_blank", "width=800,height=900")
    if (!w) return
    w.document.write(html)
    w.document.close()
    setTimeout(() => w.print(), 400)
  }

  // PDF for station re-acceptances — same full agreement text, station-appropriate header
  function downloadStationPDF(a: AgreementRecord) {
    // Use the sections stored in current terms state (best match for any active override);
    // fall back to canonical TERMS_SECTIONS from lib/terms.ts.
    const sections = termsSections.length > 0 ? termsSections : TERMS_SECTIONS
    const sectionsHtml = sections.map(s =>
      `<div class="terms-section">${s.heading}</div>` +
      s.body.split("\n\n").map(p => `<p>${p.replace(/\n/g, " ")}</p>`).join("")
    ).join("")

    const acceptedAt = new Date(a.signed_at).toLocaleString("en-US", { dateStyle: "full", timeStyle: "long" })
    const version    = a.agreement_version || CURRENT_VERSION

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>${ENTITY_NAME} Terms Re-Acceptance — ${a.business_name}</title>
<style>
  body{font-family:-apple-system,system-ui,sans-serif;max-width:720px;margin:40px auto;padding:0 32px;color:#1a1a1a;font-size:14px;line-height:1.6}
  h1{font-size:22px;font-weight:700;border-bottom:2px solid #000;padding-bottom:12px;margin-bottom:24px}
  h2{font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#555;margin:28px 0 8px}
  .meta{display:grid;grid-template-columns:1fr 1fr;gap:16px 32px;margin-bottom:24px}
  .field{background:#f8f8f8;border:1px solid #e0e0e0;border-radius:6px;padding:10px 14px}
  .field-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#888;margin-bottom:4px}
  .field-value{font-size:14px;font-weight:500}
  .stamp{background:#f0f7ff;border:1px solid #b3d4f5;border-radius:6px;padding:12px 16px;margin:24px 0;font-size:12px;color:#1a4a7a}
  .sig{border:2px solid #000;border-radius:6px;padding:16px 20px;margin-top:24px;font-size:13px}
  .sig strong{display:block;font-size:16px;margin-bottom:4px}
  .sig .method{font-size:11px;background:#f5f5f5;border:1px solid #ddd;border-radius:4px;padding:4px 8px;display:inline-block;margin-top:6px;color:#555}
  .terms{margin-top:40px;border-top:3px solid #000;padding-top:24px}
  .terms-title{font-size:16px;font-weight:700;margin-bottom:4px}
  .terms-sub{font-size:11px;color:#888;margin-bottom:20px}
  .terms-section{font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.07em;margin:20px 0 6px;color:#333;border-top:1px solid #e0e0e0;padding-top:12px}
  .terms p{font-size:11px;line-height:1.75;margin:0 0 8px;color:#222}
  .legal{font-size:10px;color:#888;margin-top:32px;border-top:1px solid #e0e0e0;padding-top:16px}
  @media print{body{margin:20px auto}}
</style>
</head><body>
<h1>${ENTITY_NAME} — Terms Re-Acceptance Record</h1>
<div class="stamp">
  ✓ Accepted: ${acceptedAt} &nbsp;|&nbsp;
  IP: ${a.ip_address || "not recorded"} &nbsp;|&nbsp;
  Version: ${version}
</div>
<h2>Business</h2>
<div class="meta">
  <div class="field"><div class="field-label">Business Name</div><div class="field-value">${a.business_name}</div></div>
  <div class="field"><div class="field-label">Record ID</div><div class="field-value" style="font-family:monospace;font-size:12px">${a.id}</div></div>
  <div class="field"><div class="field-label">Version Accepted</div><div class="field-value">${version}</div></div>
  <div class="field"><div class="field-label">IP Address</div><div class="field-value">${a.ip_address || "not recorded"}</div></div>
</div>
<div class="sig">
  <strong>${a.business_name}</strong>
  <div class="method">✓ Accepted electronically via HOST Station device</div><br/>
  <span style="font-size:12px;color:#555">
    Accepted on ${new Date(a.signed_at).toLocaleString("en-US",{dateStyle:"long",timeStyle:"short"})}
    from IP ${a.ip_address || "unknown"}<br/>
    This constitutes a valid electronic signature under the ESIGN Act and Colorado UETA.
    The authorized representative of ${a.business_name} confirmed acceptance by checking
    a checkbox and clicking &ldquo;I&rsquo;ve Read and Agree&rdquo; on the HOST Station device.
  </span>
</div>
<div class="terms">
  <div class="terms-title">${ENTITY_NAME.toUpperCase()} — MASTER SUBSCRIPTION AGREEMENT</div>
  <div class="terms-sub">${version} · Effective ${termsDate || EFFECTIVE_DATE} · hostplatform.net/legal/terms</div>
  ${sectionsHtml}
</div>
<div class="legal">
  Electronic re-acceptance record · ${ENTITY_NAME} · Record ID: ${a.id} · Generated: ${new Date().toISOString()}
</div>
</body></html>`
    const w = window.open("", "_blank", "width=800,height=900")
    if (!w) return
    w.document.write(html)
    w.document.close()
    setTimeout(() => w.print(), 400)
  }

  const TAB_BTN = (id: "signed" | "terms", label: string) => (
    <button
      onClick={() => setTab(id)}
      style={{
        padding: "8px 20px", borderRadius: 8, border: "none", cursor: "pointer",
        fontSize: 13, fontWeight: 600,
        background: tab === id ? D.surface2 : "transparent",
        color:      tab === id ? D.text     : D.text2,
        borderBottom: tab === id ? `2px solid ${D.blue}` : "2px solid transparent",
      }}
    >{label}</button>
  )

  return (
    <div>
      {/* ── Page header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: D.text, margin: 0 }}>Agreements</h1>
        {tab === "signed" && (
          <button onClick={load} disabled={loading}
            style={{ padding: "9px 20px", borderRadius: 8, border: `1px solid ${D.border}`, background: "transparent", color: D.text2, fontSize: 13, cursor: "pointer" }}>
            {loading ? "Loading…" : fetched ? "↺ Refresh" : "Load Agreements"}
          </button>
        )}
      </div>

      {/* ── Tab switcher ── */}
      <div style={{ display: "flex", gap: 4, marginBottom: 28, borderBottom: `1px solid ${D.border}` }}>
        {TAB_BTN("signed", `📄 Signed Agreements${fetched ? ` (${agreements.length})` : ""}`)}
        {TAB_BTN("terms",  "📋 Terms of Service")}
      </div>

      {error && <div style={{ color: D.red, fontSize: 14, marginBottom: 16 }}>{error}</div>}

      {/* ═══════════════════════════════════════════════════════════ SIGNED TAB */}
      {tab === "signed" && (
        <div>
          {!fetched && !loading && (
            <div style={{ textAlign: "center", padding: "60px 0", color: D.muted }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📄</div>
              <div style={{ fontSize: 14 }}>Click &quot;Load Agreements&quot; to view signed contracts</div>
            </div>
          )}

          {loading && <div style={{ color: D.muted, fontSize: 14, textAlign: "center", padding: "40px 0" }}>Loading…</div>}

          {fetched && !loading && (() => {
            // Split into full signup agreements and station re-acceptances
            const isStation = (a: AgreementRecord) => a.signer_title?.includes("Station") || a.signer_name === "HOST Station"
            const signups   = agreements.filter(a => !isStation(a))
            const stations  = agreements.filter(a =>  isStation(a))

            return (
              <>
                {/* ── Station Terms Re-Acceptances ── */}
                {stations.length > 0 && (
                  <div style={{ marginBottom: 28 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: D.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
                      Station Terms Re-Acceptances ({stations.length})
                    </div>
                    {stations.map(a => {
                      const outdated = !!a.agreement_version && a.agreement_version !== termsVersion
                      return (
                        <div key={a.id} style={{ background: D.surface, border: `1px solid ${outdated ? D.orange + "55" : D.greenBorder || D.border}`, borderRadius: 10, padding: "14px 20px", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" as const, gap: 12 }}>
                          <div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: D.text }}>{a.business_name}</div>
                            <div style={{ fontSize: 12, color: D.muted, marginTop: 2 }}>
                              ✓ Accepted via HOST Station · {fmtTime(a.signed_at)}
                            </div>
                            {outdated && (
                              <div style={{ fontSize: 11, color: D.orange, marginTop: 3 }}>
                                ⚠ Accepted old version {a.agreement_version}
                              </div>
                            )}
                          </div>
                          <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" as const }}>
                            {[
                              ["Version",    a.agreement_version || "—"],
                              ["IP Address", a.ip_address || "—"],
                              ["Record ID",  a.id.slice(0,8) + "…"],
                            ].map(([k, v]) => (
                              <div key={k}>
                                <div style={{ fontSize: 10, color: D.muted, textTransform: "uppercase", letterSpacing: "0.07em" }}>{k}</div>
                                <div style={{ fontSize: 12, color: k === "Version" && outdated ? D.orange : D.text, marginTop: 1, fontFamily: k === "Record ID" ? "monospace" : "inherit" }}>{v}</div>
                              </div>
                            ))}
                            <button onClick={() => downloadStationPDF(a)}
                              style={{ padding: "4px 12px", borderRadius: 6, border: `1px solid ${D.blueBorder}`, background: D.blueBg, color: D.blue, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                              ↓ PDF
                            </button>
                            <button onClick={() => deleteAgreement(a.id)} disabled={deleting === a.id}
                              style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${D.red}30`, background: D.redBg, color: D.red, fontSize: 12, cursor: "pointer" }}>
                              {deleting === a.id ? "…" : "✕"}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* ── Full Signup Agreements ── */}
                {(signups.length > 0 || stations.length === 0) && signups.length > 0 && (
                  <div style={{ fontSize: 11, fontWeight: 700, color: D.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
                    Full Signup Agreements ({signups.length})
                  </div>
                )}
                {signups.map(a => {
                  const outdated = !!a.agreement_version && a.agreement_version !== termsVersion
                  const matchClient = clients.find(c =>
                    c.name?.toLowerCase() === a.business_name?.toLowerCase() ||
                    c.signer_email === a.signer_email
                  )
                  return (
                    <div key={a.id} style={{ background: D.surface, border: `1px solid ${outdated ? D.orange + "55" : D.border}`, borderRadius: 12, padding: "20px 24px", marginBottom: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                        <div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: D.text }}>{a.business_name}</div>
                          <div style={{ fontSize: 13, color: D.text2, marginTop: 2 }}>
                            {a.signer_name}{a.signer_title ? ` · ${a.signer_title}` : ""} · {a.signer_email}
                          </div>
                          {outdated && (
                            <div style={{ fontSize: 11, color: D.orange, marginTop: 4 }}>
                              ⚠ Signed on old version {a.agreement_version} — current is {termsVersion}
                            </div>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" as const, justifyContent: "flex-end" }}>
                          {planBadge(a.plan_type, a.status || "active")}
                          <button onClick={() => downloadPDF(a)}
                            style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${D.blueBorder}`, background: D.blueBg, color: D.blue, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                            ↓ PDF
                          </button>
                          <button
                            title="Copy re-sign link to clipboard"
                            onClick={() => {
                              if (matchClient) { sendLinkForClient(matchClient) }
                              else {
                                const base = typeof window !== "undefined" ? window.location.origin : "https://hostplatform.net"
                                const p = new URLSearchParams({ biz: a.business_name, plan: a.plan_type || "free" })
                                if (a.signer_email) p.set("email", a.signer_email)
                                copyLink(`${base}/signup?${p.toString()}`, a.id + "-link")
                              }
                            }}
                            style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${D.border}`, background: D.surface2, color: outdated ? D.orange : D.text2, fontSize: 12, cursor: "pointer" }}>
                            {copied === (a.id + "-link") || copied === (matchClient?.id) ? "✓ Copied" : "↩ Re-sign Link"}
                          </button>
                          <button onClick={() => deleteAgreement(a.id)} disabled={deleting === a.id}
                            style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${D.red}30`, background: D.redBg, color: D.red, fontSize: 12, cursor: "pointer" }}>
                            {deleting === a.id ? "…" : "✕"}
                          </button>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 28, flexWrap: "wrap" as const }}>
                        {[
                          ["Signed",       fmtTime(a.signed_at)],
                          ["Version",      a.agreement_version || "—"],
                          ["IP Address",   a.ip_address || "—"],
                          ["Fee",          a.monthly_fee_cents != null ? `$${(a.monthly_fee_cents/100).toFixed(2)}/mo` : "Free"],
                          ["Locations",    String(a.location_count || 1)],
                          ["Agreement ID", a.id.slice(0,8) + "…"],
                        ].map(([k, v]) => (
                          <div key={k}>
                            <div style={{ fontSize: 10, color: D.muted, textTransform: "uppercase", letterSpacing: "0.07em" }}>{k}</div>
                            <div style={{ fontSize: 13, color: k === "Version" && outdated ? D.orange : D.text, marginTop: 2, fontFamily: k === "Agreement ID" ? "monospace" : "inherit" }}>{v}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}

                {agreements.length === 0 && (
                  <div style={{ color: D.muted, fontSize: 14, textAlign: "center", padding: "40px 0" }}>No signed agreements found</div>
                )}
              </>
            )
          })()}
          {fetched && agreements.length === 0 && !loading && (
            <div style={{ color: D.muted, fontSize: 14, textAlign: "center", padding: "40px 0" }}>No signed agreements found</div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ TERMS TAB */}
      {tab === "terms" && (
        <div>
          {/* Version info card */}
          <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, padding: "18px 24px", marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 11, color: D.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Current Version</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: D.text, fontFamily: "monospace" }}>{termsVersion}</div>
              <div style={{ fontSize: 12, color: D.text2, marginTop: 2 }}>Effective {termsDate}</div>
              {termsPublished && <div style={{ fontSize: 11, color: D.green, marginTop: 4 }}>✓ Published {termsPublished}</div>}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {termsEditing ? (
                <>
                  <button onClick={() => setTermsEditing(false)}
                    style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${D.border}`, background: "transparent", color: D.text2, fontSize: 13, cursor: "pointer" }}>
                    Cancel
                  </button>
                  <button onClick={publishTerms} disabled={termsPublishing}
                    style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: D.green, color: "#000", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    {termsPublishing ? "Publishing…" : "Publish New Version"}
                  </button>
                </>
              ) : (
                <button onClick={() => setTermsEditing(true)}
                  style={{ padding: "8px 18px", borderRadius: 8, border: `1px solid ${D.border}`, background: "transparent", color: D.text2, fontSize: 13, cursor: "pointer" }}>
                  ✎ Edit Terms
                </button>
              )}
            </div>
          </div>

          {/* Edit mode: version/date fields + section editors */}
          {termsEditing && (
            <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, padding: "20px 24px", marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: D.text, marginBottom: 16 }}>Edit Terms of Service</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                <div>
                  <label style={{ fontSize: 11, color: D.muted, textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 4 }}>Version String</label>
                  <input value={termsVersion} onChange={e => setTermsVersion(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 7, border: `1px solid ${D.border}`, background: D.surface2, color: D.text, fontSize: 13, boxSizing: "border-box" as const }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: D.muted, textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 4 }}>Effective Date</label>
                  <input value={termsDate} onChange={e => setTermsDate(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 7, border: `1px solid ${D.border}`, background: D.surface2, color: D.text, fontSize: 13, boxSizing: "border-box" as const }} />
                </div>
              </div>
              <div style={{ fontSize: 11, color: D.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>Sections</div>
              {termsSections.map((s, i) => (
                <div key={i} style={{ marginBottom: 16, borderBottom: `1px solid ${D.border}`, paddingBottom: 16 }}>
                  <input
                    value={s.heading}
                    onChange={e => setTermsSections(prev => prev.map((x, j) => j === i ? { ...x, heading: e.target.value } : x))}
                    style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: `1px solid ${D.border}`, background: D.surface2, color: D.text, fontSize: 12, fontWeight: 700, marginBottom: 6, boxSizing: "border-box" as const }}
                    placeholder="Section heading"
                  />
                  <textarea
                    value={s.body}
                    rows={6}
                    onChange={e => setTermsSections(prev => prev.map((x, j) => j === i ? { ...x, body: e.target.value } : x))}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: `1px solid ${D.border}`, background: D.surface2, color: D.text, fontSize: 11, lineHeight: 1.65, resize: "vertical", boxSizing: "border-box" as const }}
                    placeholder="Section body…"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Full contract text (read-only / scrollable) */}
          {!termsEditing && (
            <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, padding: "24px 28px", marginBottom: 20, maxHeight: 560, overflowY: "auto" }}>
              <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: "0.04em", color: D.text, marginBottom: 6, textTransform: "uppercase" }}>
                {ENTITY_NAME} — Master Subscription Agreement
              </div>
              <div style={{ fontSize: 11, color: D.muted, marginBottom: 20 }}>Version {termsVersion} · Effective {termsDate}</div>
              {termsSections.map((s, i) => (
                <div key={i} style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: D.text2, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 6, paddingTop: 12, borderTop: `1px solid ${D.border}` }}>
                    {s.heading}
                  </div>
                  {s.body.split("\n\n").map((para, j) => (
                    <p key={j} style={{ fontSize: 11, color: D.text2, lineHeight: 1.75, margin: "0 0 8px" }}>{para}</p>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* ── Push to existing clients ── */}
          {clients.length > 0 && (
            <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, padding: "20px 24px", marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: D.text }}>Push to Existing Clients</div>
                  <div style={{ fontSize: 12, color: D.text2, marginTop: 2 }}>
                    Select which clients to push to (for your records), then hit Push. Any HOST station that is currently open will show the acceptance modal within 20 seconds. Stations opened later will also see it until they accept.
                  </div>
                </div>
                {pushDone && <div style={{ fontSize: 11, color: D.green, whiteSpace: "nowrap" as const, marginLeft: 16 }}>✓ Pushed {pushDone}</div>}
              </div>

              {/* Client list with checkboxes */}
              <div style={{ marginTop: 16, border: `1px solid ${D.border}`, borderRadius: 8, overflow: "hidden" }}>
                {/* Select all row */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: `1px solid ${D.border}`, background: D.surface2 }}>
                  <input type="checkbox"
                    checked={pushSelected.size === clients.length}
                    onChange={e => setPushSelected(e.target.checked ? new Set(clients.map(c => c.slug)) : new Set())}
                    style={{ accentColor: D.blue, width: 14, height: 14, cursor: "pointer" }} />
                  <span style={{ fontSize: 11, color: D.text2, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                    Select All ({clients.length})
                  </span>
                </div>
                {clients.map(c => (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderBottom: `1px solid ${D.border}` }}>
                    <input type="checkbox"
                      checked={pushSelected.has(c.slug)}
                      onChange={e => setPushSelected(prev => {
                        const next = new Set(prev)
                        e.target.checked ? next.add(c.slug) : next.delete(c.slug)
                        return next
                      })}
                      style={{ accentColor: D.blue, width: 14, height: 14, cursor: "pointer" }} />
                    <span style={{ fontSize: 13, color: D.text }}>{c.name}</span>
                    <span style={{ fontSize: 11, color: D.muted, marginLeft: 4 }}>{c.slug}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
                <span style={{ fontSize: 12, color: D.muted }}>
                  {pushSelected.size} of {clients.length} selected · version {termsVersion}
                </span>
                <button
                  onClick={pushToClients}
                  disabled={pushing || pushSelected.size === 0}
                  style={{
                    padding: "9px 22px", borderRadius: 8, border: "none", cursor: pushSelected.size === 0 ? "not-allowed" : "pointer",
                    background: pushSelected.size === 0 ? D.surface2 : D.accent,
                    color: pushSelected.size === 0 ? D.muted : "#fff", fontSize: 13, fontWeight: 700,
                  }}>
                  {pushing ? "Pushing…" : `Push to ${pushSelected.size || "Selected"} Client${pushSelected.size !== 1 ? "s" : ""}`}
                </button>
              </div>
            </div>
          )}

          {/* ── Link generator ── */}
          <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, padding: "20px 24px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: D.text, marginBottom: 4 }}>Send Sign-up Link</div>
            <div style={{ fontSize: 12, color: D.text2, marginBottom: 16 }}>Generate a pre-filled sign-up URL for a client and copy it to your clipboard.</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: D.muted, textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 4 }}>Business Name</label>
                <input value={linkClient} onChange={e => setLinkClient(e.target.value)}
                  placeholder="e.g. Walnut Original"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 7, border: `1px solid ${D.border}`, background: D.surface2, color: D.text, fontSize: 13, boxSizing: "border-box" as const }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: D.muted, textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 4 }}>Email (optional)</label>
                <input value={linkEmail} onChange={e => setLinkEmail(e.target.value)}
                  placeholder="owner@restaurant.com"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 7, border: `1px solid ${D.border}`, background: D.surface2, color: D.text, fontSize: 13, boxSizing: "border-box" as const }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: D.muted, textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 4 }}>Plan</label>
                <select value={linkPlan} onChange={e => setLinkPlan(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 7, border: `1px solid ${D.border}`, background: D.surface2, color: D.text, fontSize: 13, boxSizing: "border-box" as const }}>
                  <option value="free">Free Plan</option>
                  <option value="single">Single Location ($149/mo)</option>
                  <option value="multi">Multi-Location ($129/location/mo)</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: D.muted, textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 4 }}>Locations</label>
                <input type="number" min="1" value={linkLocs} onChange={e => setLinkLocs(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 7, border: `1px solid ${D.border}`, background: D.surface2, color: D.text, fontSize: 13, boxSizing: "border-box" as const }} />
              </div>
            </div>

            {/* Also allow picking from existing clients */}
            {clients.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, color: D.muted, textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 4 }}>Or pick an existing client</label>
                <select
                  value=""
                  onChange={e => {
                    const c = clients.find(x => x.id === e.target.value)
                    if (c) {
                      setLinkClient(c.name || "")
                      if (c.signer_email) setLinkEmail(c.signer_email)
                      if (c.plan_type) setLinkPlan(c.plan_type)
                      if (c.location_count) setLinkLocs(String(c.location_count))
                    }
                  }}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 7, border: `1px solid ${D.border}`, background: D.surface2, color: D.text, fontSize: 13, boxSizing: "border-box" as const }}>
                  <option value="">— Select client —</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}

            {/* Generated URL preview + copy */}
            <div style={{ background: D.surface2, borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 12, color: D.text2, flex: 1, wordBreak: "break-all" as const, fontFamily: "monospace" }}>{generatedLink}</div>
              <button
                onClick={() => copyLink(generatedLink, "gen")}
                style={{ padding: "7px 16px", borderRadius: 7, border: "none", background: copied === "gen" ? D.green : D.blue, color: "#000", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" as const }}>
                {copied === "gen" ? "✓ Copied" : "Copy Link"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Settings View ──────────────────────────────────────────────────────────────
// ── Client Login credential row ────────────────────────────────────────────────
interface CredRow {
  username:    string
  displayName: string
  redirect:    string
  password:    string
  isOverride:  boolean
  envKey:      string
}

function CredentialRow({ cred, token, onUpdated }: { cred: CredRow; token: string; onUpdated: (username: string, newPw: string) => void }) {
  const [editing,  setEditing]  = useState(false)
  const [newPw,    setNewPw]    = useState("")
  const [showPw,   setShowPw]   = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [result,   setResult]   = useState<{ ok: boolean; msg: string } | null>(null)
  const [showCurr, setShowCurr] = useState(false)

  const save = async () => {
    if (!newPw.trim()) return
    setSaving(true); setResult(null)
    try {
      const r = await fetch("/api/owner/secrets", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ username: cred.username, password: newPw.trim() }),
      })
      const d = await r.json()
      if (r.ok) {
        setResult({ ok: true, msg: "Password updated ✓" })
        onUpdated(cred.username, newPw.trim())
        setNewPw(""); setEditing(false)
      } else {
        setResult({ ok: false, msg: d.error || "Failed to update" })
      }
    } catch {
      setResult({ ok: false, msg: "Network error" })
    } finally { setSaving(false) }
  }

  return (
    <div style={{ padding: "16px 20px", borderBottom: `1px solid ${D.border}` }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        {/* Left: account info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: D.text }}>{cred.displayName}</span>
            {cred.isOverride && (
              <span style={{ fontSize: 10, fontWeight: 700, color: D.orange, background: D.orangeBg, borderRadius: 20, padding: "1px 8px" }}>
                Runtime override
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" as const }}>
            <span style={{ fontSize: 12, color: D.muted }}>
              Username: <code style={{ color: D.text2, background: "rgba(255,255,255,0.06)", padding: "1px 6px", borderRadius: 4 }}>{cred.username}</code>
            </span>
            <span style={{ fontSize: 12, color: D.muted }}>
              Password: {showCurr
                ? <code style={{ color: D.text2, background: "rgba(255,255,255,0.06)", padding: "1px 6px", borderRadius: 4 }}>{cred.password || "(not set)"}</code>
                : <code style={{ color: D.muted, background: "rgba(255,255,255,0.04)", padding: "1px 6px", borderRadius: 4 }}>••••••••</code>
              }
              <button onClick={() => setShowCurr(s => !s)}
                style={{ marginLeft: 4, background: "none", border: "none", color: D.muted, cursor: "pointer", fontSize: 11, padding: "0 2px" }}>
                {showCurr ? "hide" : "show"}
              </button>
            </span>
            <span style={{ fontSize: 12, color: D.muted }}>→ <code style={{ color: D.text2 }}>{cred.redirect}</code></span>
          </div>
          {!cred.isOverride && (
            <div style={{ fontSize: 11, color: D.muted, marginTop: 4 }}>
              Env var: <code style={{ color: D.muted }}>{cred.envKey}</code>
            </div>
          )}
        </div>
        {/* Right: edit button */}
        <button onClick={() => { setEditing(e => !e); setResult(null); setNewPw("") }}
          style={{ flexShrink: 0, padding: "6px 14px", borderRadius: 7, border: `1px solid ${D.border}`, background: editing ? D.surface2 : "transparent", color: D.text2, fontSize: 12, cursor: "pointer" }}>
          {editing ? "Cancel" : "Change"}
        </button>
      </div>

      {/* Inline edit form */}
      {editing && (
        <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ flex: 1, position: "relative" }}>
            <input
              type={showPw ? "text" : "password"}
              placeholder="New password (min 4 chars)"
              value={newPw}
              onChange={e => setNewPw(e.target.value)}
              onKeyDown={e => e.key === "Enter" && save()}
              style={{ ...inputFull, paddingRight: 60 }}
              autoFocus
            />
            <button onClick={() => setShowPw(s => !s)}
              style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: D.muted, cursor: "pointer", fontSize: 11 }}>
              {showPw ? "hide" : "show"}
            </button>
          </div>
          <button onClick={save} disabled={saving || !newPw.trim()}
            style={{ padding: "9px 18px", borderRadius: 7, border: "none", background: newPw.trim() ? D.accent : "rgba(255,255,255,0.1)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: newPw.trim() ? "pointer" : "default", opacity: saving ? 0.7 : 1, flexShrink: 0 }}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      )}
      {result && (
        <div style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: result.ok ? D.green : D.red, padding: "6px 10px", borderRadius: 6, background: result.ok ? D.greenBg : D.redBg }}>
          {result.msg}
        </div>
      )}
    </div>
  )
}

function SettingsView({ token }: { token: string }) {
  const [smsQuota,   setSmsQuota]   = useState<number|null>(null)
  const [smsStatus,  setSmsStatus]  = useState<"checking"|"up"|"down">("checking")
  const [creds,      setCreds]      = useState<CredRow[]>([])
  const [credsLoading, setCredsLoading] = useState(true)
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/textbelt", { cache: "no-store" })
      .then(r => r.json())
      .then(d => {
        setSmsQuota(typeof d.quotaRemaining === "number" ? d.quotaRemaining : null)
        setSmsStatus(d.quotaRemaining > 0 ? "up" : "down")
      })
      .catch(() => setSmsStatus("down"))
  }, [token])

  const loadCreds = useCallback(() => {
    setCredsLoading(true)
    fetch("/api/owner/secrets", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
      .then(r => r.json())
      .then(d => { setCreds(d.clientCreds || []); setCredsLoading(false) })
      .catch(() => setCredsLoading(false))
  }, [token])

  useEffect(() => { loadCreds() }, [loadCreds])

  const handleCredUpdated = (username: string, newPw: string) => {
    setCreds(prev => prev.map(c => c.username === username ? { ...c, password: newPw, isOverride: true } : c))
  }

  const prompts = [
    { category: "Infrastructure", title: "Add New Restaurant Client", risk: "Safe",
      prompt: "Add a new restaurant client named [Restaurant Name] in [City] to the HOST system." },
    { category: "Infrastructure", title: "Check System Status", risk: "Safe",
      prompt: "Check the current Textbelt quota and Railway deployment status." },
    { category: "Infrastructure", title: "Rotate Owner Password", risk: "Moderate",
      prompt: "Update the NEXT_PUBLIC_OWNER_PASS env var in Railway to a new password: [NEW_PASSWORD]." },
    { category: "Guest Experience", title: "Change Join SMS Message", risk: "Safe",
      prompt: "Change the join SMS message for all restaurants to: [YOUR MESSAGE]." },
    { category: "Guest Experience", title: "Update Demo Restaurant Menu", risk: "Safe",
      prompt: "Update the demo restaurant menu on the guest join page (/demo/join/page.tsx)." },
    { category: "Features", title: "CSV Export for Guest History", risk: "Safe",
      prompt: "Add a CSV export button to the HOST standard history page." },
    { category: "Fixes", title: "Debug Guest Join Page Error", risk: "Safe",
      prompt: "The guest join page is showing an error. Check the /queue/join endpoint on Railway." },
    { category: "Fixes", title: "Debug SMS Not Delivering", risk: "Safe",
      prompt: "SMS texts aren't being delivered. Check the Textbelt quota and TEXTBELT_KEY." },
  ]

  const riskColor = (r: string) => r === "Safe" ? D.green : r === "Moderate" ? D.orange : D.red
  const riskBg    = (r: string) => r === "Safe" ? D.greenBg : r === "Moderate" ? D.orangeBg : D.redBg

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: D.text, margin: "0 0 32px" }}>Settings</h1>

      {/* ── Client Logins ────────────────────────────────────────────────────── */}
      <section style={{ marginBottom: 36 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: D.text, margin: 0 }}>Client Logins</h2>
            <p style={{ fontSize: 13, color: D.text2, margin: "4px 0 0" }}>
              All client portal accounts. Changes take effect immediately; reset to Railway env vars on next deploy.
            </p>
          </div>
          <button onClick={loadCreds}
            style={{ padding: "6px 14px", borderRadius: 7, border: `1px solid ${D.border}`, background: "transparent", color: D.text2, fontSize: 12, cursor: "pointer" }}>
            ↻ Refresh
          </button>
        </div>
        <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, overflow: "hidden" }}>
          {/* Header */}
          <div style={{ padding: "10px 20px", borderBottom: `1px solid ${D.border}`, background: "rgba(255,255,255,0.02)",
            display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8, fontSize: 10, color: D.muted, textTransform: "uppercase", letterSpacing: "0.07em" }}>
            <span>Account</span><span>Credentials</span><span>Redirects To</span><span></span>
          </div>
          {credsLoading ? (
            <div style={{ padding: "28px 20px", color: D.muted, fontSize: 13 }}>Loading credentials…</div>
          ) : creds.length === 0 ? (
            <div style={{ padding: "28px 20px", color: D.muted, fontSize: 13 }}>Could not load credentials. Check Railway env vars.</div>
          ) : (
            creds.map(cred => (
              <CredentialRow key={cred.username} cred={cred} token={token} onUpdated={handleCredUpdated} />
            ))
          )}
          {/* Last row: note about env vars */}
          {!credsLoading && creds.length > 0 && (
            <div style={{ padding: "12px 20px", background: "rgba(245,158,11,0.04)", borderTop: `1px solid ${D.border}` }}>
              <p style={{ fontSize: 11, color: D.orange, margin: 0 }}>
                ⚠ Runtime changes reset on Railway redeploy. For permanent changes, update the Railway environment variables.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── SMS / Textbelt ───────────────────────────────────────────────────── */}
      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: D.text, margin: "0 0 16px" }}>SMS / Textbelt</h2>
        <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: smsStatus === "up" ? D.green : smsStatus === "down" ? D.red : D.muted }} />
            <span style={{ fontSize: 14, color: D.text }}>
              {smsStatus === "checking" ? "Checking…" : smsQuota != null ? `${smsQuota.toLocaleString()} texts remaining` : "Not configured"}
            </span>
            <a href="https://textbelt.com" target="_blank" rel="noopener noreferrer"
              style={{ marginLeft: "auto", padding: "6px 14px", borderRadius: 7, border: `1px solid ${D.border}`, background: "transparent", color: D.text2, fontSize: 12, textDecoration: "none" }}>
              Buy Credits ↗
            </a>
          </div>
          <p style={{ fontSize: 12, color: D.muted, margin: 0 }}>
            API key managed via Railway env var <code style={{ color: D.text2 }}>TEXTBELT_KEY</code>.
          </p>
        </div>
      </section>

      {/* ── Claude prompts ───────────────────────────────────────────────────── */}
      <section>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: D.text, margin: "0 0 16px" }}>Claude Prompts</h2>
        <p style={{ fontSize: 13, color: D.text2, margin: "0 0 16px" }}>Ready-to-use prompts for common HOST maintenance tasks.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {prompts.map(p => (
            <div key={p.title} style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 10, padding: "14px 18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div>
                  <span style={{ fontSize: 10, color: D.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginRight: 8 }}>{p.category}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: D.text }}>{p.title}</span>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: riskColor(p.risk), background: riskBg(p.risk), borderRadius: 20, padding: "2px 10px", flexShrink: 0 }}>{p.risk}</span>
              </div>
              <div style={{ position: "relative" }}>
                <div style={{ fontSize: 12, color: D.text2, fontFamily: "monospace", background: "rgba(0,0,0,0.3)", padding: "8px 44px 8px 12px", borderRadius: 6, wordBreak: "break-all" as const }}>
                  {p.prompt}
                </div>
                <button
                  onClick={() => { navigator.clipboard.writeText(p.prompt); setCopiedPrompt(p.title); setTimeout(() => setCopiedPrompt(null), 2000) }}
                  style={{ position: "absolute", top: 6, right: 8, padding: "2px 8px", borderRadius: 5, border: `1px solid ${D.border}`, background: D.surface2, color: copiedPrompt === p.title ? D.green : D.muted, fontSize: 10, cursor: "pointer", fontWeight: 600 }}>
                  {copiedPrompt === p.title ? "✓ Copied" : "Copy"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

// ── Main OwnerPage ─────────────────────────────────────────────────────────────
export default function OwnerPage() {
  const [authed,    setAuthed]    = useState(false)
  const [passInput, setPassInput] = useState("")
  const [passErr,   setPassErr]   = useState(false)
  const [showPass,  setShowPass]  = useState(false)
  const [token,     setToken]     = useState("")

  // Navigation
  const [view,             setView]             = useState<NavView>("dashboard")
  const [selectedClient,   setSelectedClient]   = useState<Client | null>(null)
  const [wizardDone,       setWizardDone]       = useState<{ id:string; name:string; slug:string; join_url:string; station_url:string } | null>(null)
  const [clientListKey,    setClientListKey]    = useState(0)
  const [allClients,       setAllClients]       = useState<Client[]>([])

  useEffect(() => {
    if (sessionStorage.getItem("host_owner_authed") === "1") {
      const t = sessionStorage.getItem("host_owner_token") || ""
      if (t) { setToken(t); setAuthed(true) }
    }
  }, [])

  const loadAllClients = useCallback(() => {
    if (!token) return
    fetch(`${API}/owner/clients?secret=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(r => r.json())
      .then(d => setAllClients(d.clients || []))
      .catch(() => {})
  }, [token])

  useEffect(() => { if (token) loadAllClients() }, [token, loadAllClients])

  async function login() {
    try {
      const res = await fetch("/api/owner/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: passInput }),
      })
      if (res.ok) {
        sessionStorage.setItem("host_owner_authed", "1")
        sessionStorage.setItem("host_owner_token", passInput)
        setToken(passInput); setAuthed(true); setPassErr(false)
      } else {
        setPassErr(true); setPassInput("")
      }
    } catch {
      setPassErr(true); setPassInput("")
    }
  }

  function handleSetView(v: NavView) {
    setView(v)
    if (v !== "client-detail" && v !== "new-client") {
      setSelectedClient(null)
      setWizardDone(null)
    }
  }

  function handleSelectClient(c: Client) {
    setSelectedClient(c)
    setView("client-detail")
  }

  function handleAddNew() {
    setWizardDone(null)
    setView("new-client")
  }

  function handleWizardDone(result: { id:string; name:string; slug:string; join_url:string; station_url:string }) {
    setWizardDone(result)
    setClientListKey(k => k + 1)
    loadAllClients()
    setView("clients")
  }

  function handleLogout() {
    sessionStorage.removeItem("host_owner_authed")
    sessionStorage.removeItem("host_owner_token")
    fetch("/api/owner/auth", { method: "DELETE" }).catch(() => {})
    setAuthed(false)
    setToken("")
  }

  // ── Auth screen ──────────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div style={{ minHeight: "100dvh", background: D.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-geist), system-ui, sans-serif" }}>
        <div style={{ width: "100%", maxWidth: 380, padding: "40px 32px", background: "rgba(255,255,255,0.04)", borderRadius: 20, border: `1px solid ${D.border}` }}>
          <div style={{ marginBottom: 32, textAlign: "center" }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: D.text, letterSpacing: "-0.02em" }}>HOST</div>
            <div style={{ fontSize: 12, color: D.muted, marginTop: 4, letterSpacing: "0.1em", textTransform: "uppercase" }}>Owner Console</div>
          </div>
          <div style={{ marginBottom: 16, position: "relative" }}>
            <input
              type={showPass ? "text" : "password"}
              placeholder="Password"
              value={passInput}
              onChange={e => setPassInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && login()}
              style={{ width: "100%", boxSizing: "border-box", padding: "12px 44px 12px 16px", borderRadius: 10, border: `1px solid ${passErr ? D.red : D.border}`, background: D.surface, color: D.text, fontSize: 15, outline: "none" }}
            />
            <button onClick={() => setShowPass(s => !s)}
              style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: D.muted, cursor: "pointer", fontSize: 14, padding: "4px" }}>
              {showPass ? "Hide" : "Show"}
            </button>
          </div>
          {passErr && <div style={{ color: D.red, fontSize: 13, marginBottom: 12, textAlign: "center" }}>Incorrect password</div>}
          <button onClick={login}
            style={{ width: "100%", padding: "12px 0", borderRadius: 10, border: "none", background: D.accent, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
            Sign In
          </button>
        </div>
      </div>
    )
  }

  // ── Main layout ──────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100dvh", background: D.bg, display: "flex", fontFamily: "var(--font-geist), system-ui, sans-serif", color: D.text }}>
      <Sidebar view={view} setView={handleSetView} onLogout={handleLogout} />
      <main style={{ flex: 1, overflow: "auto", padding: 32, minWidth: 0 }}>

        {/* Success toast after wizard */}
        {wizardDone && (
          <div style={{ marginBottom: 24, padding: "16px 20px", background: D.greenBg, border: `1px solid ${D.greenBorder}`, borderRadius: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ color: D.green, fontWeight: 700, fontSize: 15, marginBottom: 8 }}>✓ {wizardDone.name} created!</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ fontSize: 13, color: D.text2 }}>
                    Guest join: <a href={wizardDone.join_url} target="_blank" rel="noopener noreferrer" style={{ color: D.blue }}>{wizardDone.join_url}</a>
                  </div>
                  <div style={{ fontSize: 13, color: D.text2 }}>
                    Host station: <a href={wizardDone.station_url} target="_blank" rel="noopener noreferrer" style={{ color: D.blue }}>{wizardDone.station_url}</a>
                  </div>
                  <div style={{ fontSize: 11, color: D.muted, marginTop: 2 }}>
                    Login with slug: <code style={{ color: D.orange, background: "rgba(245,158,11,0.08)", padding: "1px 5px", borderRadius: 3 }}>{wizardDone.slug}</code> + the password you set in step 5
                  </div>
                </div>
              </div>
              <button onClick={() => setWizardDone(null)}
                style={{ background: "none", border: "none", color: D.muted, cursor: "pointer", fontSize: 18, marginLeft: 16 }}>✕</button>
            </div>
          </div>
        )}

        {view === "dashboard"    && <DashboardView token={token} clients={allClients} onCreateClient={handleAddNew} />}
        {view === "clients"      && <ClientsView key={clientListKey} token={token} onSelectClient={handleSelectClient} onAddNew={handleAddNew} />}
        {view === "client-detail" && selectedClient && (
          <ClientDetailView client={selectedClient} token={token} onBack={() => setView("clients")} onUpdated={() => {}} />
        )}
        {view === "new-client"   && (
          <NewClientWizard token={token} onDone={handleWizardDone} onCancel={() => setView("clients")} />
        )}
        {view === "billing"      && <BillingView token={token} />}
        {view === "website"      && <WebsiteAnalyticsView token={token} />}
        {view === "analytics"    && <AnalyticsView token={token} clients={allClients} />}
        {view === "agreements"   && <AgreementsView token={token} />}
        {view === "settings"     && <SettingsView token={token} />}
      </main>
    </div>
  )
}
