"use client"

import { useState, useEffect, useCallback, useRef } from "react"

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

type NavView = "dashboard" | "clients" | "client-detail" | "new-client" | "billing" | "analytics" | "agreements" | "settings"

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
function Sidebar({ view, setView }: { view: NavView; setView: (v: NavView) => void }) {
  const items: { id: NavView; label: string; icon: string }[] = [
    { id: "dashboard",   label: "Dashboard",   icon: "⬡" },
    { id: "clients",     label: "Clients",     icon: "🏢" },
    { id: "billing",     label: "Billing",     icon: "💳" },
    { id: "analytics",   label: "Analytics",   icon: "📊" },
    { id: "agreements",  label: "Agreements",  icon: "📄" },
    { id: "settings",    label: "Settings",    icon: "⚙️" },
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
      <div style={{ padding: "16px 20px", borderTop: `1px solid ${D.border}` }}>
        <div style={{ fontSize: 10, color: D.muted }}>v2.0 · HOST Platform</div>
      </div>
    </div>
  )
}

// ── Dashboard View ─────────────────────────────────────────────────────────────
interface ServiceStatus { label: string; status: "checking"|"up"|"degraded"|"down"; detail: string }
interface RestaurantLive { id: string; name: string; queueNow: number; tablesOccupied: number; tablesTotal: number; avgWait: number|null; utilization: number }

const KNOWN_RESTAURANTS = [
  { id: "0001cafe-0001-4000-8000-000000000001", name: "Walnut Original" },
  { id: "0002cafe-0001-4000-8000-000000000002", name: "Walnut Southside" },
  { id: DEMO_RID,                               name: "Demo"            },
]

function DashboardView({ token }: { token: string }) {
  const [services,  setServices]  = useState<ServiceStatus[]>([
    { label: "Railway API", status: "checking", detail: "—" },
    { label: "Supabase DB", status: "checking", detail: "—" },
    { label: "GitHub",      status: "checking", detail: "—" },
    { label: "Textbelt",    status: "checking", detail: "—" },
  ])
  const [clients,   setClients]   = useState<Client[]>([])
  const [liveStats, setLiveStats] = useState<RestaurantLive[]>([])
  const [lastCheck, setLastCheck] = useState<Date|null>(null)

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
    const stats = await Promise.all(KNOWN_RESTAURANTS.map(async r => {
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
  }, [])

  useEffect(() => {
    // Load clients list
    fetch(`${API}/owner/clients?secret=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(r => r.json())
      .then(d => setClients(d.clients || []))
      .catch(() => {})
    // Run health checks
    runChecks()
    const interval = setInterval(runChecks, 60_000)
    return () => clearInterval(interval)
  }, [token, runChecks])

  const activeClients = clients.filter(c => c.status === "active").length
  const trialClients  = clients.filter(c => c.status === "trial").length
  const totalMRR      = clients.reduce((s, c) => s + (c.monthly_fee_cents || 0), 0)

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
          { label: "Total Clients", value: String(clients.length), color: D.blue    },
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

      {/* Per-restaurant live stats */}
      <h2 style={{ fontSize: 14, fontWeight: 700, color: D.text, margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.07em" }}>Live Restaurant Stats</h2>
      <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 32 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 110px 80px 90px", padding: "10px 20px",
          borderBottom: `1px solid ${D.border}`, fontSize: 10, color: D.muted, textTransform: "uppercase", letterSpacing: "0.07em" }}>
          <span>Restaurant</span><span style={{ textAlign: "center" }}>Queue</span>
          <span style={{ textAlign: "center" }}>Tables Occupied</span><span style={{ textAlign: "center" }}>Avg Wait</span>
          <span style={{ textAlign: "center" }}>Utilization</span>
        </div>
        {liveStats.length === 0 ? (
          <div style={{ padding: "24px 20px", color: D.muted, fontSize: 13 }}>Loading live data…</div>
        ) : liveStats.map((r, i) => (
          <div key={r.id} style={{ display: "grid", gridTemplateColumns: "1fr 80px 110px 80px 90px",
            padding: "14px 20px", borderBottom: i < liveStats.length - 1 ? `1px solid ${D.border}` : "none",
            alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: D.text }}>{r.name}</div>
              <div style={{ fontSize: 10, color: D.muted, fontFamily: "monospace", marginTop: 1 }}>{r.id.slice(0,8)}…</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: r.queueNow > 0 ? D.orange : D.green }}>{r.queueNow}</span>
            </div>
            <div style={{ textAlign: "center", fontSize: 15, fontWeight: 600, color: D.text }}>{r.tablesOccupied}<span style={{ fontSize: 11, color: D.muted, fontWeight: 400 }}>/{r.tablesTotal}</span></div>
            <div style={{ textAlign: "center", fontSize: 13, color: D.text2 }}>{r.avgWait ? `~${Math.round(r.avgWait)}m` : "—"}</div>
            <div style={{ textAlign: "center", fontSize: 14, fontWeight: 600, color: r.utilization > 70 ? D.orange : D.green }}>{r.utilization}%</div>
          </div>
        ))}
      </div>

      {/* Recent clients */}
      <h2 style={{ fontSize: 14, fontWeight: 700, color: D.text, margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.07em" }}>Recent Clients</h2>
      <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, overflow: "hidden" }}>
        {clients.slice(0, 6).map((c, i) => (
          <div key={c.id} style={{ padding: "13px 20px", borderBottom: i < Math.min(5, clients.length - 1) ? `1px solid ${D.border}` : "none",
            display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: D.text }}>{c.display_name}</div>
              <div style={{ fontSize: 12, color: D.muted }}>{c.city || "—"}</div>
            </div>
            {planBadge(c.plan_type, c.status)}
          </div>
        ))}
        {clients.length === 0 && (
          <div style={{ padding: 32, textAlign: "center", color: D.muted, fontSize: 14 }}>No clients yet. Add your first client!</div>
        )}
      </div>
    </div>
  )
}

// ── Table Designer ─────────────────────────────────────────────────────────────
function TableDesigner({ tables, walls, objects, onChange, aspectRatio = 1.62 }: {
  tables: FloorTable[]
  walls?: FloorWall[]
  objects?: FloorObject[]
  onChange: (tables: FloorTable[]) => void
  aspectRatio?: number
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [adding,   setAdding]   = useState(false)
  const [newTbl,   setNewTbl]   = useState({ number: "", capacity: "4", shape: "rect" as FloorTable["shape"], label: "" })
  const canvasRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: string; startX: number; startY: number; ox: number; oy: number } | null>(null)

  const selectedTable = tables.find(t => t.id === selected)

  function handleCanvasClick(e: React.MouseEvent) {
    if (drag.current) return
    if ((e.target as HTMLElement).closest("[data-table]")) return
    setSelected(null)
    if (adding) {
      const rect = canvasRef.current!.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width * 100).toFixed(1)
      const y = ((e.clientY - rect.top) / rect.height * 100).toFixed(1)
      const num = parseInt(newTbl.number) || (tables.length ? Math.max(...tables.map(t => t.number)) + 1 : 1)
      const isSmall = newTbl.shape === "circle" || newTbl.shape === "diamond"
      const w = isSmall ? 6 : newTbl.shape === "booth" ? 14 : 8
      const h = isSmall ? 6 : newTbl.shape === "booth" ? 5 : 8
      const t: FloorTable = {
        id: nanoid(), number: num, label: newTbl.label || String(num),
        capacity: parseInt(newTbl.capacity) || 4, shape: newTbl.shape,
        x: Math.max(0, Math.min(92, parseFloat(x) - w / 2)),
        y: Math.max(0, Math.min(92, parseFloat(y) - h / 2)),
        w, h,
      }
      onChange([...tables, t])
      setNewTbl(prev => ({ ...prev, number: String(num + 1), label: "" }))
    }
  }

  function startDrag(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    const tbl = tables.find(t => t.id === id)!
    const rect = canvasRef.current!.getBoundingClientRect()
    drag.current = {
      id,
      startX: e.clientX, startY: e.clientY,
      ox: tbl.x, oy: tbl.y,
    }
    setSelected(id)
    const onMove = (me: MouseEvent) => {
      if (!drag.current) return
      const rect2 = canvasRef.current!.getBoundingClientRect()
      const dx = (me.clientX - drag.current.startX) / rect2.width * 100
      const dy = (me.clientY - drag.current.startY) / rect2.height * 100
      onChange(tables.map(t => t.id === drag.current!.id
        ? { ...t, x: Math.max(0, Math.min(90, drag.current!.ox + dx)), y: Math.max(0, Math.min(90, drag.current!.oy + dy)) }
        : t
      ))
    }
    const onUp = () => { drag.current = null; window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp) }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
  }

  function deleteSelected() {
    onChange(tables.filter(t => t.id !== selected))
    setSelected(null)
  }

  function updateSelected(patch: Partial<FloorTable>) {
    onChange(tables.map(t => t.id === selected ? { ...t, ...patch } : t))
  }

  const shapeStyle = (t: FloorTable, isSel: boolean): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: "absolute", left: `${t.x}%`, top: `${t.y}%`,
      width: `${t.w}%`, height: `${t.h}%`,
      background: isSel ? "rgba(96,165,250,0.25)" : "rgba(255,255,255,0.12)",
      border: `2px solid ${isSel ? D.blue : "rgba(255,255,255,0.22)"}`,
      display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column",
      cursor: "grab", userSelect: "none", transition: "border-color 0.12s",
      boxSizing: "border-box",
    }
    if (t.shape === "circle") {
      base.borderRadius = "50%"
    } else if (t.shape === "diamond") {
      // Use clipPath (same as station page) so the label stays upright and shape looks correct
      base.clipPath = "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)"
      base.borderRadius = 0
      base.border = "none"
      base.background = isSel ? "rgba(96,165,250,0.35)" : "rgba(255,255,255,0.18)"
    } else if (t.shape === "booth") {
      base.borderRadius = "4px 4px 0 0"
    } else {
      base.borderRadius = "6px"
    }
    return base
  }

  const innerStyle = (): React.CSSProperties => ({ textAlign: "center" })

  return (
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
      {/* Controls panel */}
      <div style={{ width: 200, flexShrink: 0, display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Add table */}
        <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: D.muted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Add Table</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input placeholder="Table #" value={newTbl.number} onChange={e => setNewTbl(p => ({ ...p, number: e.target.value }))}
              style={inputSm} />
            <input placeholder="Label (opt)" value={newTbl.label} onChange={e => setNewTbl(p => ({ ...p, label: e.target.value }))}
              style={inputSm} />
            <select value={newTbl.capacity} onChange={e => setNewTbl(p => ({ ...p, capacity: e.target.value }))} style={inputSm}>
              {[1,2,3,4,5,6,7,8,10,12].map(n => <option key={n} value={n}>{n} guests</option>)}
            </select>
            <select value={newTbl.shape} onChange={e => setNewTbl(p => ({ ...p, shape: e.target.value as FloorTable["shape"] }))} style={inputSm}>
              <option value="rect">Square</option>
              <option value="circle">Round</option>
              <option value="booth">Booth</option>
              <option value="diamond">Diamond</option>
            </select>
            <button onClick={() => setAdding(a => !a)}
              style={{ padding: "7px 0", borderRadius: 6, border: `1px solid ${adding ? D.blue : D.border}`,
                background: adding ? D.blueBg : "transparent", color: adding ? D.blue : D.text2,
                fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              {adding ? "🖱 Click canvas to place" : "+ Add Table"}
            </button>
          </div>
        </div>

        {/* Selected table edit */}
        {selectedTable && (
          <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 10, padding: 14, flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: D.muted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Edit Table</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input placeholder="Number" value={selectedTable.number} type="number"
                onChange={e => updateSelected({ number: parseInt(e.target.value) || 0 })} style={inputSm} />
              <input placeholder="Label" value={selectedTable.label}
                onChange={e => updateSelected({ label: e.target.value })} style={inputSm} />
              <select value={selectedTable.capacity} onChange={e => updateSelected({ capacity: parseInt(e.target.value) })} style={inputSm}>
                {[1,2,3,4,5,6,7,8,10,12].map(n => <option key={n} value={n}>{n} guests</option>)}
              </select>
              <select value={selectedTable.shape} onChange={e => updateSelected({ shape: e.target.value as FloorTable["shape"] })} style={inputSm}>
                <option value="rect">Square</option>
                <option value="circle">Round</option>
                <option value="booth">Booth</option>
                <option value="diamond">Diamond</option>
              </select>
              <button onClick={deleteSelected}
                style={{ padding: "7px 0", borderRadius: 6, border: `1px solid ${D.red}40`,
                  background: D.redBg, color: D.red, fontSize: 12, fontWeight: 600, cursor: "pointer", marginTop: 4 }}>
                🗑 Delete Table
              </button>
            </div>
          </div>
        )}

        {!selectedTable && (
          <div style={{ color: D.muted, fontSize: 12, padding: "8px 4px" }}>
            Click a table to edit · Drag to move
          </div>
        )}
      </div>

      {/* Canvas — aspect-ratio matches the original floor plan canvas to prevent distortion */}
      <div ref={canvasRef} onClick={handleCanvasClick}
        style={{ flex: 1, aspectRatio: String(aspectRatio), background: "rgba(0,0,0,0.45)",
          border: `2px dashed ${adding ? D.blue : D.border}`,
          borderRadius: 12, position: "relative", overflow: "hidden", cursor: adding ? "crosshair" : "default",
          transition: "border-color 0.15s" }}>

        {/* Walls — read-only structural lines */}
        {(walls || []).map((w, i) => {
          const isVertical = Math.abs(w.x2 - w.x1) < Math.abs(w.y2 - w.y1)
          return (
            <div key={`wall-${i}`} style={{
              position: "absolute",
              background: "rgba(255,185,100,0.45)",
              pointerEvents: "none",
              ...(isVertical ? {
                left: `${w.x1}%`,
                top:  `${Math.min(w.y1, w.y2)}%`,
                width: "0.5%",
                height: `${Math.abs(w.y2 - w.y1)}%`,
              } : {
                left:   `${Math.min(w.x1, w.x2)}%`,
                top:    `${w.y1}%`,
                width:  `${Math.abs(w.x2 - w.x1)}%`,
                height: "0.8%",
              }),
            }} />
          )
        })}

        {/* Objects — doors, counters, labels (read-only) */}
        {(objects || []).map(obj => (
          <div key={obj.id} style={{
            position: "absolute",
            left: `${obj.x}%`, top: `${obj.y}%`,
            width: `${obj.w}%`, height: `${obj.h}%`,
            display: "flex", alignItems: "center", justifyContent: "center",
            pointerEvents: "none",
            ...(obj.type === "door"    ? { background: "rgba(20,180,180,0.18)", border: "1px solid rgba(20,180,180,0.4)", borderRadius: 4 } :
               obj.type === "counter" ? { background: "rgba(140,100,60,0.22)", border: "1px solid rgba(140,100,60,0.4)", borderRadius: 3 } :
               obj.type === "window"  ? { background: "rgba(100,160,255,0.15)", border: "1px solid rgba(100,160,255,0.35)", borderRadius: 2 } :
               { background: "transparent" }),
          }}>
            {obj.label && obj.type !== "label" && (
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.55)", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                {obj.label}
              </span>
            )}
            {obj.type === "label" && obj.label.trim() && (
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                {obj.label.trim()}
              </span>
            )}
          </div>
        ))}

        {tables.length === 0 && !adding && (walls || []).length === 0 && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🗺</div>
            <div style={{ color: D.muted, fontSize: 14 }}>Click &quot;+ Add Table&quot; then click here to place tables</div>
          </div>
        )}

        {tables.map(t => (
          <div key={t.id} data-table="1" style={shapeStyle(t, t.id === selected)}
            onMouseDown={e => startDrag(e, t.id)}>
            <div style={innerStyle()}>
              <div style={{ fontSize: Math.max(9, Math.min(13, t.w * 1.2)), fontWeight: 700, color: D.text, lineHeight: 1 }}>
                {t.label || t.number}
              </div>
              <div style={{ fontSize: Math.max(8, Math.min(10, t.w)), color: D.muted, lineHeight: 1 }}>
                {t.capacity}p
              </div>
            </div>
          </div>
        ))}

        {adding && (
          <div style={{ position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)",
            background: D.blueBg, border: `1px solid ${D.blueBorder}`, borderRadius: 20,
            padding: "4px 14px", fontSize: 11, color: D.blue, fontWeight: 600, pointerEvents: "none" }}>
            Click to place table #{newTbl.number || (tables.length + 1)}
          </div>
        )}
      </div>
    </div>
  )
}

const inputSm: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)", border: `1px solid ${D.border}`, borderRadius: 6,
  color: D.text, padding: "6px 10px", fontSize: 12, width: "100%", boxSizing: "border-box",
  outline: "none",
}

// ── Menu Builder ───────────────────────────────────────────────────────────────
function MenuBuilder({ sections, onChange }: { sections: MenuSection[]; onChange: (s: MenuSection[]) => void }) {
  const [editing, setEditing] = useState<{sectionId: string; itemId?: string} | null>(null)
  const [newSection, setNewSection] = useState("")

  function addSection() {
    if (!newSection.trim()) return
    onChange([...sections, { id: nanoid(), title: newSection.trim(), items: [] }])
    setNewSection("")
  }

  function addItem(sectionId: string) {
    onChange(sections.map(s => s.id === sectionId
      ? { ...s, items: [...s.items, { id: nanoid(), name: "New Item", description: "", price: "", tags: [] }] }
      : s
    ))
  }

  function updateItem(sectionId: string, itemId: string, patch: Partial<MenuItem>) {
    onChange(sections.map(s => s.id === sectionId
      ? { ...s, items: s.items.map(i => i.id === itemId ? { ...i, ...patch } : i) }
      : s
    ))
  }

  function deleteItem(sectionId: string, itemId: string) {
    onChange(sections.map(s => s.id === sectionId ? { ...s, items: s.items.filter(i => i.id !== itemId) } : s))
  }

  function deleteSection(sectionId: string) {
    onChange(sections.filter(s => s.id !== sectionId))
  }

  function updateSectionTitle(sectionId: string, title: string) {
    onChange(sections.map(s => s.id === sectionId ? { ...s, title } : s))
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
          {section.items.map(item => (
            <div key={item.id} style={{ padding: "12px 16px", borderBottom: `1px solid ${D.border}` }}>
              {editing?.sectionId === section.id && editing?.itemId === item.id ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input placeholder="Item name" value={item.name} onChange={e => updateItem(section.id, item.id, { name: e.target.value })} style={{ ...inputSm, flex: 2 }} />
                    <input placeholder="Price" value={item.price} onChange={e => updateItem(section.id, item.id, { price: e.target.value })} style={{ ...inputSm, flex: 1 }} />
                  </div>
                  <input placeholder="Description" value={item.description} onChange={e => updateItem(section.id, item.id, { description: e.target.value })} style={inputSm} />
                  <input placeholder="Tags (comma-separated: GF, Vegan, Spicy)" value={item.tags.join(", ")}
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
                    {item.tags.map(tag => (
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

          {section.items.length === 0 && (
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

  // Step 3 — Guest page
  const [bgColor,      setBgColor]      = useState("#000000")
  const [accentColor,  setAccentColor]  = useState("#22c55e")
  const [tagline,      setTagline]      = useState("Powered by HOST")
  const [seatedMsg,    setSeatedMsg]    = useState("Thanks for dining with us!")
  const [waitMessages, setWaitMessages] = useState("Your spot is saved — feel free to step out.\nWe'll let you know the moment your table is ready.\nSit tight, we're moving quickly.")

  // Step 4 — Menu
  const [menuSections, setMenuSections] = useState<MenuSection[]>([])

  // Step 5 — Credentials
  const [stationPin,  setStationPin]  = useState("")
  const [managerPin,  setManagerPin]  = useState("")
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

  async function create() {
    setSaving(true); setError("")
    try {
      const r = await fetch(`${API}/owner/clients?secret=${encodeURIComponent(token)}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, slug, city, address, contact_name: contactName, contact_email: contactEmail,
          plan_type: planType, monthly_fee: parseFloat(monthlyFee) || 0,
          location_count: parseInt(locationCount) || 1,
          initial_tables: 0,  // we'll batch them ourselves
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
        bgColor, accentColor, buttonTextColor: "#ffffff",
        restaurantName: name, tagline,
        waitMessages: waitMessages.split("\n").map(s => s.trim()).filter(Boolean),
        seatedMessage: seatedMsg, finalButtons: [],
      }
      await fetch(`${API}/owner/clients/${restaurant_id}/config?secret=${encodeURIComponent(token)}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guest_config: guestConfig,
          menu_config: { sections: menuSections },
          floor_plan: floorTables,
          settings: { city, address, contact_name: contactName, contact_email: contactEmail, location_count: parseInt(locationCount) || 1, plan_type: planType, monthly_fee: parseFloat(monthlyFee) || 0 },
        }),
      })

      // Save credentials
      const creds = [
        stationPin  && { credential_type: "station_pin",  label: "Station PIN",       value: stationPin },
        managerPin  && { credential_type: "manager_pin",  label: "Manager PIN",       value: managerPin },
        wifiName    && { credential_type: "wifi",          label: `WiFi: ${wifiName}`, value: wifiPass || "" },
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
          <h1 style={{ fontSize: 22, fontWeight: 700, color: D.text, margin: 0 }}>New Client</h1>
          <p style={{ fontSize: 13, color: D.muted, margin: "4px 0 0" }}>Set up a new restaurant from scratch</p>
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
            <p style={{ fontSize: 13, color: D.text2, margin: "0 0 20px" }}>Design the table layout. Drag tables to position them. You can skip this and set it up later.</p>
            <TableDesigner tables={floorTables} onChange={setFloorTables} />
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
                <FieldLabel>Accent Color</FieldLabel>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)}
                    style={{ width: 40, height: 34, borderRadius: 6, border: `1px solid ${D.border}`, cursor: "pointer", padding: 2, background: "none" }} />
                  <Input value={accentColor} onChange={setAccentColor} placeholder="#22c55e" />
                </div>
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
            <div style={{ marginTop: 20, padding: 20, borderRadius: 12, background: bgColor, border: `1px solid ${D.border}`, textAlign: "center" }}>
              <div style={{ color: "#fff", fontSize: 20, fontWeight: 700 }}>{name || "Restaurant"}</div>
              <div style={{ color: accentColor, fontSize: 13, marginTop: 4 }}>{tagline}</div>
              <div style={{ marginTop: 12, padding: "8px 20px", background: accentColor, borderRadius: 20, display: "inline-block", color: "#fff", fontSize: 13, fontWeight: 700 }}>Join Waitlist</div>
            </div>
          </div>
        )}

        {/* Step 4 — Menu */}
        {step === 4 && (
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: D.text, margin: "0 0 6px" }}>Menu</h2>
            <p style={{ fontSize: 13, color: D.text2, margin: "0 0 20px" }}>Optional — add menu sections and items for the guest join page. You can set this up later.</p>
            <MenuBuilder sections={menuSections} onChange={setMenuSections} />
          </div>
        )}

        {/* Step 5 — Credentials */}
        {step === 5 && (
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: D.text, margin: "0 0 6px" }}>Access Credentials</h2>
            <p style={{ fontSize: 13, color: D.text2, margin: "0 0 20px" }}>Set up initial PINs and access codes. These are stored securely in the owner console.</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <FieldLabel>Station PIN</FieldLabel>
                <Input value={stationPin} onChange={setStationPin} placeholder="4-digit PIN" type="text" />
                <div style={{ fontSize: 11, color: D.muted, marginTop: 4 }}>For host tablet login</div>
              </div>
              <div>
                <FieldLabel>Manager PIN</FieldLabel>
                <Input value={managerPin} onChange={setManagerPin} placeholder="4-digit PIN" type="text" />
                <div style={{ fontSize: 11, color: D.muted, marginTop: 4 }}>For manager access</div>
              </div>
              <div>
                <FieldLabel>WiFi Network</FieldLabel>
                <Input value={wifiName} onChange={setWifiName} placeholder="Network name" />
              </div>
              <div>
                <FieldLabel>WiFi Password</FieldLabel>
                <Input value={wifiPass} onChange={setWifiPass} placeholder="Password" type="text" />
              </div>
            </div>

            {/* Summary */}
            <div style={{ marginTop: 24, padding: 20, background: D.surface2, borderRadius: 12, border: `1px solid ${D.border}` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: D.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Summary</div>
              {[
                ["Name", name],
                ["URL", `hostplatform.net/client/${slug}/join`],
                ["City", city || "—"],
                ["Plan", planType],
                ["Monthly Fee", monthlyFee ? `$${monthlyFee}/mo` : "Free"],
                ["Locations", locationCount],
                ["Tables designed", String(floorTables.length)],
                ["Menu sections", String(menuSections.length)],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: D.text2, marginBottom: 6 }}>
                  <span>{k}</span>
                  <span style={{ color: D.text, fontWeight: 500 }}>{v}</span>
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
    setSaving(true)
    const url = editing
      ? `${API}/owner/clients/${restaurantId}/credentials/${editing}?secret=${encodeURIComponent(token)}`
      : `${API}/owner/clients/${restaurantId}/credentials?secret=${encodeURIComponent(token)}`
    const method = editing ? "PATCH" : "POST"
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
    setForm({ credential_type: "other", label: "", value: "", notes: "" })
    setAdding(false); setEditing(null); setSaving(false)
    load()
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
    station_pin: "🔐", manager_pin: "🔑", wifi: "📶", other: "🗝",
  }

  if (loading) return <div style={{ color: D.muted, fontSize: 14 }}>Loading…</div>

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 14, color: D.text2 }}>
          {creds.length} credential{creds.length !== 1 ? "s" : ""} on file
        </div>
        <button onClick={() => { setAdding(true); setEditing(null); setForm({ credential_type: "other", label: "", value: "", notes: "" }) }}
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
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button onClick={save} disabled={saving}
              style={{ padding: "7px 18px", borderRadius: 8, border: "none", background: D.accent, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button onClick={() => { setAdding(false); setEditing(null) }}
              style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${D.border}`, background: "transparent", color: D.text2, fontSize: 13, cursor: "pointer" }}>
              Cancel
            </button>
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

// ── Client Detail View ─────────────────────────────────────────────────────────
function ClientDetailView({ client, token, onBack, onUpdated }: {
  client: Client
  token: string
  onBack: () => void
  onUpdated: () => void
}) {
  const [tab, setTab] = useState<"overview"|"credentials"|"floor-map"|"guest-page"|"menu"|"documents">("overview")
  const [config, setConfig] = useState<{ guest_config?: Record<string,unknown>; menu_config?: { sections: MenuSection[] }; floor_plan?: FloorTable[]; settings?: Record<string,unknown> } | null>(null)
  const [configLoaded, setConfigLoaded] = useState(false)
  const [savingConfig, setSavingConfig] = useState(false)
  const [saveStatus, setSaveStatus] = useState<""|"saving"|"saved"|"error">("")
  const [floorTables,  setFloorTables]  = useState<FloorTable[]>([])
  const [floorWalls,   setFloorWalls]   = useState<FloorWall[]>([])
  const [floorObjects, setFloorObjects] = useState<FloorObject[]>([])
  const [canvasAspect, setCanvasAspect] = useState<number>(1.62)
  const [menuSections, setMenuSections] = useState<MenuSection[]>([])
  const [agreements, setAgreements] = useState<AgreementRecord[]>([])
  const [agreementsLoaded, setAgreementsLoaded] = useState(false)

  useEffect(() => {
    if ((tab === "floor-map" || tab === "guest-page" || tab === "menu") && !configLoaded) {
      fetch(`${API}/owner/clients/${client.id}/config?secret=${encodeURIComponent(token)}`)
        .then(r => r.json())
        .then(async d => {
          setConfig(d)
          const mc = d.menu_config as { sections?: MenuSection[] } | null
          setMenuSections(mc?.sections || [])
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
          setAgreements(all.filter(a => a.business_name?.toLowerCase().includes(client.name.toLowerCase()) || client.name.toLowerCase().includes(a.business_name?.toLowerCase())))
          setAgreementsLoaded(true)
        })
        .catch(() => setAgreementsLoaded(true))
    }
  }, [tab, configLoaded, agreementsLoaded, client.id, client.name, token])

  async function saveConfig(patch: { floor_plan?: FloorTable[]; menu_config?: { sections: MenuSection[] }; guest_config?: Record<string,unknown> }) {
    setSavingConfig(true); setSaveStatus("saving")
    try {
      await fetch(`${API}/owner/clients/${client.id}/config?secret=${encodeURIComponent(token)}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      setSaveStatus("saved")
      setTimeout(() => setSaveStatus(""), 2500)
    } catch {
      setSaveStatus("error")
    } finally {
      setSavingConfig(false)
    }
  }

  const tabs: { id: typeof tab; label: string }[] = [
    { id: "overview",    label: "Overview"    },
    { id: "credentials", label: "Credentials" },
    { id: "floor-map",   label: "Floor Map"   },
    { id: "guest-page",  label: "Guest Page"  },
    { id: "menu",        label: "Menu"        },
    { id: "documents",   label: "Documents"   },
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
            {t.label}
          </button>
        ))}
      </div>

      {/* Save status */}
      {saveStatus && (
        <div style={{ marginBottom: 16, padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600,
          background: saveStatus === "saved" ? D.greenBg : saveStatus === "error" ? D.redBg : D.blueBg,
          color: saveStatus === "saved" ? D.green : saveStatus === "error" ? D.red : D.blue,
          border: `1px solid ${saveStatus === "saved" ? D.greenBorder : saveStatus === "error" ? D.red + "40" : D.blueBorder}` }}>
          {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "✓ Saved" : "Error saving"}
        </div>
      )}

      {/* Overview tab */}
      {tab === "overview" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {[
            { label: "Join URL",         value: client.join_url,    link: true  },
            { label: "Station URL",      value: client.station_url, link: true  },
            { label: "Plan",             value: client.plan_type              },
            { label: "Status",           value: client.status                 },
            { label: "Monthly Fee",      value: client.monthly_fee_cents != null ? `$${(client.monthly_fee_cents/100).toFixed(2)}/mo` : "Free" },
            { label: "Locations",        value: String(client.location_count || 1) },
            { label: "Signed",           value: client.signed_at ? fmtTime(client.signed_at) : "Not signed" },
            { label: "Signer",           value: client.signer_name || "—"     },
            { label: "Signer Email",     value: client.signer_email || "—"    },
            { label: "Client ID",        value: client.id                     },
          ].map(({ label, value, link }) => (
            <div key={label} style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ fontSize: 11, color: D.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>{label}</div>
              {link ? (
                <a href={value} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 13, color: D.blue, wordBreak: "break-all" as const }}>{value}</a>
              ) : (
                <div style={{ fontSize: 13, color: D.text, wordBreak: "break-all" as const }}>{value}</div>
              )}
            </div>
          ))}
        </div>
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
              <TableDesigner tables={floorTables} walls={floorWalls} objects={floorObjects} onChange={t => setFloorTables(t)} aspectRatio={canvasAspect} />
              <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
                <button onClick={() => saveConfig({ floor_plan: { tables: floorTables, walls: floorWalls, objects: floorObjects, canvasAspect } as unknown as FloorTable[] })} disabled={savingConfig}
                  style={{ padding: "9px 24px", borderRadius: 8, border: "none", background: D.accent, color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                  {savingConfig ? "Saving…" : "Save Floor Map"}
                </button>
                <div style={{ color: D.muted, fontSize: 12, alignSelf: "center" }}>{floorTables.length} tables</div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Guest Page tab */}
      {tab === "guest-page" && (
        <div>
          {!configLoaded ? <div style={{ color: D.muted, fontSize: 14 }}>Loading…</div> : (
            <GuestPageEditor
              initial={(config?.guest_config || { restaurantName: client.name, bgColor: "#EDE8DF", darkColor: "#2C2416", accentColor: "#22c55e", buttonTextColor: "#fff", tagline: "Powered by HOST", logoUrl: "", waitMessages: [], seatedMessage: "", finalButtons: [] }) as unknown as GuestPageConfig}
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
              <MenuBuilder sections={menuSections} onChange={setMenuSections} />
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

      {/* Documents tab */}
      {tab === "documents" && (
        <div>
          {!agreementsLoaded ? <div style={{ color: D.muted, fontSize: 14 }}>Loading…</div> : (
            <>
              <div style={{ fontSize: 14, color: D.text2, marginBottom: 16 }}>
                {agreements.length} signed agreement{agreements.length !== 1 ? "s" : ""}
              </div>
              {agreements.length === 0 && (
                <div style={{ color: D.muted, fontSize: 13, padding: "24px 0" }}>
                  No signed agreements found for this client.
                </div>
              )}
              {agreements.map(a => (
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

// ── Guest Page Editor ──────────────────────────────────────────────────────────
interface GuestPageConfig {
  bgColor:         string
  darkColor:       string   // main text + button bg color
  accentColor:     string   // legacy field (kept for compat)
  buttonTextColor: string
  restaurantName:  string
  tagline?:        string
  logoUrl?:        string   // restaurant logo image URL
  waitMessages:    string[]
  seatedMessage:   string
  finalButtons:    Array<{ id: string; label: string; url: string; color: string }>
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "")
  const r = parseInt(h.slice(0, 2), 16) || 0
  const g = parseInt(h.slice(2, 4), 16) || 0
  const b = parseInt(h.slice(4, 6), 16) || 0
  return `rgba(${r},${g},${b},${alpha})`
}

function GuestPageEditor({ initial, onSave, saving }: { initial: GuestPageConfig; onSave: (c: GuestPageConfig) => void; saving: boolean }) {
  const [cfg,      setCfg]     = useState<GuestPageConfig>(initial)
  const [waitText, setWaitText] = useState((initial.waitMessages || []).join("\n"))

  function save() {
    onSave({ ...cfg, waitMessages: waitText.split("\n").map(s => s.trim()).filter(Boolean) })
  }

  const bg    = cfg.bgColor   || "#EDE8DF"
  const dark  = cfg.darkColor || cfg.accentColor || "#2C2416"
  const dark2 = hexToRgba(dark, 0.55)
  const dark3 = hexToRgba(dark, 0.30)
  const dark4 = hexToRgba(dark, 0.08)
  const dark5 = hexToRgba(dark, 0.12)

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      <div style={{ gridColumn: "1/-1" }}>
        <FieldLabel>Restaurant Name</FieldLabel>
        <Input value={cfg.restaurantName} onChange={v => setCfg(p => ({ ...p, restaurantName: v }))} placeholder="My Restaurant" />
      </div>
      <div>
        <FieldLabel>Background Color</FieldLabel>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="color" value={cfg.bgColor || "#EDE8DF"} onChange={e => setCfg(p => ({ ...p, bgColor: e.target.value }))}
            style={{ width: 40, height: 34, borderRadius: 6, border: `1px solid ${D.border}`, cursor: "pointer", padding: 2 }} />
          <Input value={cfg.bgColor || ""} onChange={v => setCfg(p => ({ ...p, bgColor: v }))} placeholder="#EDE8DF" />
        </div>
      </div>
      <div>
        <FieldLabel>Text &amp; Button Color</FieldLabel>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="color" value={cfg.darkColor || cfg.accentColor || "#2C2416"} onChange={e => setCfg(p => ({ ...p, darkColor: e.target.value }))}
            style={{ width: 40, height: 34, borderRadius: 6, border: `1px solid ${D.border}`, cursor: "pointer", padding: 2 }} />
          <Input value={cfg.darkColor || ""} onChange={v => setCfg(p => ({ ...p, darkColor: v }))} placeholder="#2C2416" />
        </div>
      </div>
      <div style={{ gridColumn: "1/-1" }}>
        <FieldLabel>Logo URL</FieldLabel>
        <Input value={cfg.logoUrl || ""} onChange={v => setCfg(p => ({ ...p, logoUrl: v }))} placeholder="https://…" />
        <div style={{ fontSize: 11, color: D.muted, marginTop: 4 }}>Direct image URL for your restaurant logo (PNG, JPG, or SVG)</div>
      </div>
      <div style={{ gridColumn: "1/-1" }}>
        <FieldLabel>Wait Messages (one per line — shown on the waiting page)</FieldLabel>
        <textarea value={waitText} onChange={e => setWaitText(e.target.value)} rows={4}
          style={{ ...inputFull, resize: "vertical" } as React.CSSProperties} />
      </div>
      <div style={{ gridColumn: "1/-1" }}>
        <FieldLabel>Seated / Thank You Message</FieldLabel>
        <Input value={cfg.seatedMessage} onChange={v => setCfg(p => ({ ...p, seatedMessage: v }))} placeholder="Thanks for dining with us!" />
      </div>

      {/* Live preview — matches actual guest join page layout */}
      <div style={{ gridColumn: "1/-1", borderRadius: 14, overflow: "hidden", border: `1px solid ${D.border}` }}>
        <div style={{ padding: "8px 14px", background: D.surface2, borderBottom: `1px solid ${D.border}`, fontSize: 11, color: D.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em" }}>
          Live Preview — Guest Join Page
        </div>
        <div style={{ background: bg, padding: "20px 24px", fontFamily: "system-ui, sans-serif" }}>
          {/* HOST wordmark */}
          <div style={{ textAlign: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "0.08em", color: dark, lineHeight: 1 }}>HOST</div>
            <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase", color: dark3, marginTop: 3 }}>Restaurant Operating System</div>
          </div>
          {/* Logo */}
          {cfg.logoUrl && (
            <div style={{ textAlign: "center", marginBottom: 8 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cfg.logoUrl} alt={cfg.restaurantName} style={{ height: 52, objectFit: "contain" }} />
            </div>
          )}
          {/* Restaurant badge */}
          <div style={{ textAlign: "center", marginBottom: 12 }}>
            <div style={{ display: "inline-block", padding: "5px 16px", border: `1px solid ${dark5}`, borderRadius: 10, background: dark4 }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", color: dark }}>{cfg.restaurantName.toUpperCase()}</div>
            </div>
          </div>
          {/* Join button */}
          <div style={{ padding: "8px 0 4px" }}>
            <div style={{ width: "100%", height: 42, borderRadius: 14, background: dark, color: bg, fontWeight: 800, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", display: "flex", alignItems: "center", justifyContent: "center" }}>
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

  const filtered = clients.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.city || "").toLowerCase().includes(search.toLowerCase())
  )

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
            + Add Client
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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
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
            <div key={c.id} onClick={() => onSelectClient(c)}
              style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 14, padding: "20px 20px",
                cursor: "pointer", transition: "all 0.12s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = D.surfaceHover; (e.currentTarget as HTMLElement).style.borderColor = D.borderStrong }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = D.surface; (e.currentTarget as HTMLElement).style.borderColor = D.border }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: 10, background: D.accent + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                  🏢
                </div>
                {planBadge(c.plan_type, c.status)}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: D.text, marginBottom: 4 }}>{c.display_name}</div>
              <div style={{ fontSize: 13, color: D.text2, marginBottom: 12 }}>{c.city || "No city set"}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ fontSize: 12, color: D.muted }}>
                  🔗 <span style={{ color: D.blue }}>/{c.slug}</span>
                </div>
                {c.signed_at && (
                  <div style={{ fontSize: 12, color: D.muted }}>
                    ✍️ Signed {fmtTime(c.signed_at)}
                  </div>
                )}
                {c.monthly_fee_cents != null && c.monthly_fee_cents > 0 && (
                  <div style={{ fontSize: 12, color: D.muted }}>
                    💳 ${(c.monthly_fee_cents/100).toFixed(2)}/mo
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
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
  "0001cafe-0001-4000-8000-000000000001": "Walnut Original",
  "0002cafe-0001-4000-8000-000000000002": "Walnut Southside",
  "dec0cafe-0000-4000-8000-000000000001": "Demo",
}

// ── Analytics View ─────────────────────────────────────────────────────────────
function AnalyticsView({ token }: { token: string }) {
  const [data,      setData]      = useState<AnalyticsEntry[]>([])
  const [loading,   setLoading]   = useState(false)
  const [fetched,   setFetched]   = useState(false)
  const [page,      setPage]      = useState(0)
  const [restFilter, setRestFilter] = useState<string>("all")
  const [sortKey,   setSortKey]   = useState<string>("arrival_time")
  const [sortDir,   setSortDir]   = useState<"asc"|"desc">("desc")
  const PAGE_SIZE = 50

  function load() {
    setLoading(true)
    fetch(`${API}/owner/analytics?secret=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(r => r.json())
      .then(d => { setData(d.entries || []); setFetched(true); setPage(0) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  // Build restaurant list from data
  const restaurants = Array.from(new Set(data.map(e => e.restaurant_id).filter((x): x is string => x !== null)))
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
    const cols = ["name","party_size","restaurant","source","status","arrival_time","quoted_wait","actual_wait","notes"]
    const header = cols.join(",")
    const rows = sorted.map(e => cols.map(c => {
      const v = c === "restaurant"
        ? (RID_NAMES[e.restaurant_id || ""] || e.restaurant_id || "")
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
          <h1 style={{ fontSize: 24, fontWeight: 700, color: D.text, margin: "0 0 4px" }}>Analytics</h1>
          <p style={{ color: D.text2, fontSize: 13, margin: 0 }}>{sorted.length.toLocaleString()} records{restFilter !== "all" ? ` (filtered)` : ` total`}</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={restFilter} onChange={e => { setRestFilter(e.target.value); setPage(0) }}
            style={{ padding: "7px 10px", borderRadius: 7, border: `1px solid ${D.border}`, background: D.surface2, color: D.text2, fontSize: 13, cursor: "pointer" }}>
            <option value="all">All Restaurants</option>
            {restaurants.map(rid => <option key={rid} value={rid}>{RID_NAMES[rid] || rid?.slice(0,8)}</option>)}
          </select>
          {fetched && <button onClick={exportCSV}
            style={{ padding: "7px 16px", borderRadius: 7, border: `1px solid ${D.greenBorder}`, background: D.greenBg, color: D.green, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            ↓ Export CSV
          </button>}
          <button onClick={load} disabled={loading}
            style={{ padding: "7px 16px", borderRadius: 7, border: `1px solid ${D.border}`, background: "transparent", color: D.text2, fontSize: 13, cursor: "pointer" }}>
            {loading ? "Loading…" : fetched ? "↺ Refresh" : "Load Data"}
          </button>
        </div>
      </div>

      {!fetched && !loading && (
        <div style={{ textAlign: "center", padding: "60px 0", color: D.muted }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
          <div style={{ fontSize: 14 }}>Click &quot;Load Data&quot; to fetch guest records</div>
        </div>
      )}

      {loading && <div style={{ color: D.muted, fontSize: 14, textAlign: "center", padding: "40px 0" }}>Loading analytics…</div>}

      {fetched && !loading && (
        <>
          <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${D.border}` }}>
                  {([
                    ["name","Name"],["party_size","Party"],["restaurant_id","Restaurant"],
                    ["source","Source"],["status","Status"],["arrival_time","Arrival"],
                    ["quoted_wait","Quoted"],["actual_wait","Actual Wait"],["notes","Notes"]
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
                    <td style={{ padding: "10px 14px", color: D.text2, fontSize: 12 }}>{RID_NAMES[e.restaurant_id || ""] || (e.restaurant_id?.slice(0,8) || "—")}</td>
                    <td style={{ padding: "10px 14px" }}><span style={sourceStyle(e.source)}>{e.source.toUpperCase()}</span></td>
                    <td style={{ padding: "10px 14px" }}><span style={statusStyle(e.status)}>{e.status}</span></td>
                    <td style={{ padding: "10px 14px", color: D.text2, whiteSpace: "nowrap" }}>{e.arrival_time ? new Date(e.arrival_time).toLocaleString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}) : "—"}</td>
                    <td style={{ padding: "10px 14px", color: D.text2 }}>{e.quoted_wait != null ? `${e.quoted_wait}m` : "—"}</td>
                    <td style={{ padding: "10px 14px", color: D.text2 }}>{e.actual_wait != null ? `${e.actual_wait}m` : "—"}</td>
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
  const [agreements, setAgreements] = useState<AgreementRecord[]>([])
  const [loading,    setLoading]    = useState(false)
  const [fetched,    setFetched]    = useState(false)
  const [error,      setError]      = useState<string|null>(null)
  const [deleting,   setDeleting]   = useState<string|null>(null)

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

  function downloadPDF(a: AgreementRecord) {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>HOST Agreement — ${a.business_name}</title>
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
  .legal{font-size:11px;color:#888;margin-top:32px;border-top:1px solid #e0e0e0;padding-top:16px}
  @media print{body{margin:20px auto}}
</style>
</head><body>
<h1>HOST Platform — Service Agreement</h1>
<div class="stamp">
  🔐 Signed: ${new Date(a.signed_at).toLocaleString("en-US",{dateStyle:"full",timeStyle:"long"})} &nbsp;|&nbsp;
  IP Address: ${a.ip_address || "not recorded"} &nbsp;|&nbsp;
  Version: ${a.agreement_version || "v1"}
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
<div class="legal">
  This document is a record of an electronically signed service agreement between HOST Systems Inc. and the signatory above.
  Agreement ID: ${a.id} · Generated: ${new Date().toISOString()}
</div>
</body></html>`
    const w = window.open("", "_blank", "width=800,height=900")
    if (!w) return
    w.document.write(html)
    w.document.close()
    setTimeout(() => w.print(), 400)
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: D.text, margin: "0 0 4px" }}>Agreements</h1>
          <p style={{ color: D.text2, fontSize: 13, margin: 0 }}>{agreements.length} signed agreement{agreements.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={load} disabled={loading}
          style={{ padding: "9px 20px", borderRadius: 8, border: `1px solid ${D.border}`, background: "transparent", color: D.text2, fontSize: 13, cursor: "pointer" }}>
          {loading ? "Loading…" : fetched ? "↺ Refresh" : "Load Agreements"}
        </button>
      </div>

      {error && <div style={{ color: D.red, fontSize: 14, marginBottom: 16 }}>{error}</div>}

      {!fetched && !loading && (
        <div style={{ textAlign: "center", padding: "60px 0", color: D.muted }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📄</div>
          <div style={{ fontSize: 14 }}>Click &quot;Load Agreements&quot; to view signed contracts</div>
        </div>
      )}

      {loading && <div style={{ color: D.muted, fontSize: 14, textAlign: "center", padding: "40px 0" }}>Loading…</div>}

      {fetched && !loading && agreements.map(a => (
        <div key={a.id} style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, padding: "20px 24px", marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: D.text }}>{a.business_name}</div>
              <div style={{ fontSize: 13, color: D.text2, marginTop: 2 }}>
                {a.signer_name}{a.signer_title ? ` · ${a.signer_title}` : ""} · {a.signer_email}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {planBadge(a.plan_type, a.status || "active")}
              <button onClick={() => downloadPDF(a)}
                style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${D.blueBorder}`, background: D.blueBg, color: D.blue, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                ↓ PDF
              </button>
              <button onClick={() => deleteAgreement(a.id)} disabled={deleting === a.id}
                style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${D.red}30`, background: D.redBg, color: D.red, fontSize: 12, cursor: "pointer" }}>
                {deleting === a.id ? "…" : "✕"}
              </button>
            </div>
          </div>
          <div style={{ display: "flex", gap: 28, flexWrap: "wrap" as const }}>
            {[
              ["Signed", fmtTime(a.signed_at)],
              ["Version", a.agreement_version || "—"],
              ["IP Address", a.ip_address || "—"],
              ["Fee", a.monthly_fee_cents != null ? `$${(a.monthly_fee_cents/100).toFixed(2)}/mo` : "Free"],
              ["Locations", String(a.location_count || 1)],
              ["Agreement ID", a.id.slice(0,8) + "…"],
            ].map(([k, v]) => (
              <div key={k}>
                <div style={{ fontSize: 10, color: D.muted, textTransform: "uppercase", letterSpacing: "0.07em" }}>{k}</div>
                <div style={{ fontSize: 13, color: D.text, marginTop: 2, fontFamily: k === "Agreement ID" ? "monospace" : "inherit" }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {fetched && agreements.length === 0 && (
        <div style={{ color: D.muted, fontSize: 14, textAlign: "center", padding: "40px 0" }}>No signed agreements found</div>
      )}
    </div>
  )
}

// ── Settings View ──────────────────────────────────────────────────────────────
function SettingsView({ token }: { token: string }) {
  const [textbeltKey,      setTextbeltKey]      = useState("")
  const [smsQuota,         setSmsQuota]         = useState<number|null>(null)
  const [smsStatus,        setSmsStatus]        = useState<"checking"|"up"|"down">("checking")

  useEffect(() => {
    fetch("/api/textbelt", { cache: "no-store" })
      .then(r => r.json())
      .then(d => {
        setSmsQuota(typeof d.quotaRemaining === "number" ? d.quotaRemaining : null)
        setSmsStatus(d.quotaRemaining > 0 ? "up" : "down")
      })
      .catch(() => setSmsStatus("down"))
  }, [token])

  const prompts = [
    { category: "Infrastructure", title: "Add New Restaurant Client", risk: "Safe",
      prompt: "Add a new restaurant client named [Restaurant Name] in [City] to the HOST system." },
    { category: "Infrastructure", title: "Check System Status", risk: "Safe",
      prompt: "Check the current Textbelt quota and Railway deployment status." },
    { category: "Infrastructure", title: "Rotate Password / API Key", risk: "Moderate",
      prompt: "Update the PASS constant in /owner/page.tsx to a new password: [NEW_PASSWORD]." },
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

      {/* SMS status */}
      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: D.text, margin: "0 0 16px" }}>SMS / Textbelt</h2>
        <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: smsStatus === "up" ? D.green : smsStatus === "down" ? D.red : D.muted }} />
            <span style={{ fontSize: 14, color: D.text }}>
              {smsStatus === "checking" ? "Checking…" : smsQuota != null ? `${smsQuota.toLocaleString()} texts remaining` : "Not configured"}
            </span>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <input placeholder="Textbelt API key" value={textbeltKey} onChange={e => setTextbeltKey(e.target.value)}
              type="password" style={{ ...inputFull, flex: 1 }} />
            <a href="https://textbelt.com" target="_blank" rel="noopener noreferrer"
              style={{ padding: "9px 16px", borderRadius: 8, border: `1px solid ${D.border}`, background: "transparent", color: D.text2, fontSize: 13, textDecoration: "none", display: "flex", alignItems: "center", flexShrink: 0 }}>
              Buy Credits ↗
            </a>
          </div>
          <p style={{ fontSize: 12, color: D.muted, margin: "10px 0 0" }}>
            API key is managed via Railway environment variable TEXTBELT_KEY.
          </p>
        </div>
      </section>

      {/* Claude prompts */}
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
              <div style={{ fontSize: 12, color: D.text2, fontFamily: "monospace", background: "rgba(0,0,0,0.3)", padding: "8px 12px", borderRadius: 6, wordBreak: "break-all" as const }}>
                {p.prompt}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

// ── Main OwnerPage ─────────────────────────────────────────────────────────────
const PASS = process.env.NEXT_PUBLIC_OWNER_PASS || "host2024"

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

  useEffect(() => {
    if (sessionStorage.getItem("host_owner_authed") === "1") {
      const t = sessionStorage.getItem("host_owner_token") || PASS
      setToken(t); setAuthed(true)
    }
  }, [])

  function login() {
    if (passInput === PASS) {
      sessionStorage.setItem("host_owner_authed", "1")
      sessionStorage.setItem("host_owner_token", passInput)
      setToken(passInput); setAuthed(true); setPassErr(false)
    } else { setPassErr(true); setPassInput("") }
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
    setView("clients")
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
      <Sidebar view={view} setView={handleSetView} />
      <main style={{ flex: 1, overflow: "auto", padding: 32, minWidth: 0 }}>

        {/* Success toast after wizard */}
        {wizardDone && (
          <div style={{ marginBottom: 24, padding: "14px 20px", background: D.greenBg, border: `1px solid ${D.greenBorder}`, borderRadius: 10,
            display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <span style={{ color: D.green, fontWeight: 700 }}>✓ {wizardDone.name} created!</span>
              <span style={{ color: D.text2, fontSize: 13, marginLeft: 12 }}>
                Join: <a href={wizardDone.join_url} target="_blank" rel="noopener noreferrer" style={{ color: D.blue }}>{wizardDone.join_url}</a>
              </span>
            </div>
            <button onClick={() => setWizardDone(null)}
              style={{ background: "none", border: "none", color: D.muted, cursor: "pointer", fontSize: 18 }}>✕</button>
          </div>
        )}

        {view === "dashboard"    && <DashboardView token={token} />}
        {view === "clients"      && <ClientsView key={clientListKey} token={token} onSelectClient={handleSelectClient} onAddNew={handleAddNew} />}
        {view === "client-detail" && selectedClient && (
          <ClientDetailView client={selectedClient} token={token} onBack={() => setView("clients")} onUpdated={() => {}} />
        )}
        {view === "new-client"   && (
          <NewClientWizard token={token} onDone={handleWizardDone} onCancel={() => setView("clients")} />
        )}
        {view === "billing"      && <BillingView token={token} />}
        {view === "analytics"    && <AnalyticsView token={token} />}
        {view === "agreements"   && <AgreementsView token={token} />}
        {view === "settings"     && <SettingsView token={token} />}
      </main>
    </div>
  )
}
