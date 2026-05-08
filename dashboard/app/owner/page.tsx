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
  id:            string
  name:          string
  slug:          string
  city?:         string
  display_name:  string
  join_url:      string
  station_url:   string
  plan_type:     string
  status:        string
  monthly_fee_cents?: number
  location_count?: number
  signed_at?:    string
  signer_name?:  string
  signer_email?: string
  created_at?:   string
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
function DashboardView({ token }: { token: string }) {
  const [status, setStatus] = useState<"checking"|"up"|"degraded"|"down">("checking")
  const [latency, setLatency] = useState<number|null>(null)
  const [clients, setClients] = useState<Client[]>([])

  useEffect(() => {
    const t = Date.now()
    fetch(`${API}/queue?restaurant_id=${DEMO_RID}`, { cache: "no-store" })
      .then(r => { setStatus(r.ok ? "up" : "down"); setLatency(Date.now() - t) })
      .catch(() => setStatus("down"))
    fetch(`${API}/owner/clients?secret=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(r => r.json())
      .then(d => setClients(d.clients || []))
      .catch(() => {})
  }, [token])

  const dotColor = status === "up" ? D.green : status === "degraded" ? D.orange : status === "checking" ? D.muted : D.red
  const activeClients = clients.filter(c => c.status === "active" || !c.signed_at).length
  const trialClients  = clients.filter(c => c.status === "trial").length

  return (
    <div style={{ padding: 32 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: D.text, margin: "0 0 8px" }}>Dashboard</h1>
      <p style={{ color: D.text2, fontSize: 14, margin: "0 0 32px" }}>HOST platform health and quick stats</p>

      {/* Status cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16, marginBottom: 32 }}>
        {[
          { label: "Railway API", value: status === "checking" ? "Checking…" : status === "up" ? `Up · ${latency}ms` : "Down", dot: dotColor },
          { label: "Total Clients", value: String(clients.length), dot: D.blue },
          { label: "Active", value: String(activeClients), dot: D.green },
          { label: "Trial", value: String(trialClients), dot: D.orange },
        ].map(card => (
          <div key={card.label} style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, padding: "20px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: card.dot, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: D.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>{card.label}</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: D.text }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Recent clients */}
      <h2 style={{ fontSize: 16, fontWeight: 600, color: D.text, margin: "0 0 16px" }}>Recent Clients</h2>
      <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, overflow: "hidden" }}>
        {clients.slice(0, 5).map((c, i) => (
          <div key={c.id} style={{ padding: "14px 20px", borderBottom: i < Math.min(4, clients.length - 1) ? `1px solid ${D.border}` : "none",
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
function TableDesigner({ tables, onChange }: {
  tables: FloorTable[]
  onChange: (tables: FloorTable[]) => void
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
      background: isSel ? "rgba(96,165,250,0.25)" : "rgba(255,255,255,0.10)",
      border: `2px solid ${isSel ? D.blue : "rgba(255,255,255,0.20)"}`,
      display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column",
      cursor: "grab", userSelect: "none", transition: "border-color 0.12s",
      boxSizing: "border-box",
    }
    if (t.shape === "circle") base.borderRadius = "50%"
    else if (t.shape === "diamond") base.transform = "rotate(45deg)"
    else if (t.shape === "booth") base.borderRadius = "4px 4px 0 0"
    else base.borderRadius = "6px"
    return base
  }

  const innerStyle = (t: FloorTable): React.CSSProperties =>
    t.shape === "diamond" ? { transform: "rotate(-45deg)", textAlign: "center" } : {}

  return (
    <div style={{ display: "flex", gap: 16, height: 520 }}>
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

      {/* Canvas */}
      <div ref={canvasRef} onClick={handleCanvasClick}
        style={{ flex: 1, background: "rgba(0,0,0,0.4)", border: `2px dashed ${adding ? D.blue : D.border}`,
          borderRadius: 12, position: "relative", overflow: "hidden", cursor: adding ? "crosshair" : "default",
          transition: "border-color 0.15s" }}>
        {tables.length === 0 && !adding && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🗺</div>
            <div style={{ color: D.muted, fontSize: 14 }}>Click &quot;+ Add Table&quot; then click here to place tables</div>
          </div>
        )}
        {tables.map(t => (
          <div key={t.id} data-table="1" style={shapeStyle(t, t.id === selected)}
            onMouseDown={e => startDrag(e, t.id)}>
            <div style={innerStyle(t)}>
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
  const [floorTables, setFloorTables] = useState<FloorTable[]>([])
  const [menuSections, setMenuSections] = useState<MenuSection[]>([])
  const [agreements, setAgreements] = useState<AgreementRecord[]>([])
  const [agreementsLoaded, setAgreementsLoaded] = useState(false)

  useEffect(() => {
    if ((tab === "floor-map" || tab === "guest-page" || tab === "menu") && !configLoaded) {
      fetch(`${API}/owner/clients/${client.id}/config?secret=${encodeURIComponent(token)}`)
        .then(r => r.json())
        .then(d => {
          setConfig(d)
          setFloorTables(Array.isArray(d.floor_plan) ? d.floor_plan : [])
          const mc = d.menu_config as { sections?: MenuSection[] } | null
          setMenuSections(mc?.sections || [])
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
              <TableDesigner tables={floorTables} onChange={t => setFloorTables(t)} />
              <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
                <button onClick={() => saveConfig({ floor_plan: floorTables })} disabled={savingConfig}
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
              initial={(config?.guest_config || { restaurantName: client.name, bgColor: "#000", accentColor: "#22c55e", tagline: "Powered by HOST", waitMessages: [], seatedMessage: "", finalButtons: [] }) as unknown as GuestPageConfig}
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
  bgColor: string; accentColor: string; buttonTextColor: string
  restaurantName: string; tagline: string
  waitMessages: string[]; seatedMessage: string
  finalButtons: Array<{ id: string; label: string; url: string; color: string }>
}

function GuestPageEditor({ initial, onSave, saving }: { initial: GuestPageConfig; onSave: (c: GuestPageConfig) => void; saving: boolean }) {
  const [cfg, setCfg] = useState<GuestPageConfig>(initial)
  const [waitText, setWaitText] = useState(initial.waitMessages.join("\n"))

  function save() {
    onSave({ ...cfg, waitMessages: waitText.split("\n").map(s => s.trim()).filter(Boolean) })
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      <div>
        <FieldLabel>Restaurant Name</FieldLabel>
        <Input value={cfg.restaurantName} onChange={v => setCfg(p => ({ ...p, restaurantName: v }))} placeholder="My Restaurant" />
      </div>
      <div>
        <FieldLabel>Tagline</FieldLabel>
        <Input value={cfg.tagline} onChange={v => setCfg(p => ({ ...p, tagline: v }))} placeholder="Powered by HOST" />
      </div>
      <div>
        <FieldLabel>Background Color</FieldLabel>
        <div style={{ display: "flex", gap: 8 }}>
          <input type="color" value={cfg.bgColor} onChange={e => setCfg(p => ({ ...p, bgColor: e.target.value }))}
            style={{ width: 40, height: 34, borderRadius: 6, border: `1px solid ${D.border}`, cursor: "pointer", padding: 2 }} />
          <Input value={cfg.bgColor} onChange={v => setCfg(p => ({ ...p, bgColor: v }))} />
        </div>
      </div>
      <div>
        <FieldLabel>Accent Color</FieldLabel>
        <div style={{ display: "flex", gap: 8 }}>
          <input type="color" value={cfg.accentColor} onChange={e => setCfg(p => ({ ...p, accentColor: e.target.value }))}
            style={{ width: 40, height: 34, borderRadius: 6, border: `1px solid ${D.border}`, cursor: "pointer", padding: 2 }} />
          <Input value={cfg.accentColor} onChange={v => setCfg(p => ({ ...p, accentColor: v }))} />
        </div>
      </div>
      <div style={{ gridColumn: "1/-1" }}>
        <FieldLabel>Wait Messages (one per line)</FieldLabel>
        <textarea value={waitText} onChange={e => setWaitText(e.target.value)} rows={4}
          style={{ ...inputFull, resize: "vertical" } as React.CSSProperties} />
      </div>
      <div style={{ gridColumn: "1/-1" }}>
        <FieldLabel>Seated Message</FieldLabel>
        <Input value={cfg.seatedMessage} onChange={v => setCfg(p => ({ ...p, seatedMessage: v }))} />
      </div>
      {/* Preview */}
      <div style={{ gridColumn: "1/-1", padding: 20, borderRadius: 12, background: cfg.bgColor, border: `1px solid ${D.border}`, textAlign: "center" }}>
        <div style={{ color: "#fff", fontSize: 18, fontWeight: 700 }}>{cfg.restaurantName}</div>
        <div style={{ color: cfg.accentColor, fontSize: 12, marginTop: 4 }}>{cfg.tagline}</div>
        <div style={{ marginTop: 10, padding: "7px 18px", background: cfg.accentColor, borderRadius: 20, display: "inline-block", color: cfg.buttonTextColor, fontSize: 12, fontWeight: 700 }}>Join Waitlist</div>
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

      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 0", color: D.muted }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏢</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>No clients yet</div>
          <div style={{ fontSize: 13 }}>Click &quot;+ Add Client&quot; to onboard your first restaurant</div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
        {filtered.map(c => (
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
        ))}
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

// ── Analytics View ─────────────────────────────────────────────────────────────
function AnalyticsView({ token }: { token: string }) {
  const [data,    setData]    = useState<AnalyticsEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [fetched, setFetched] = useState(false)
  const [page,    setPage]    = useState(0)
  const PAGE_SIZE = 50

  function load() {
    setLoading(true)
    fetch(`${API}/owner/analytics?secret=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(r => r.json())
      .then(d => { setData(d.entries || []); setFetched(true) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  const slice = data.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(data.length / PAGE_SIZE)

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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: D.text, margin: "0 0 4px" }}>Analytics</h1>
          <p style={{ color: D.text2, fontSize: 13, margin: 0 }}>{data.length.toLocaleString()} guest records</p>
        </div>
        <button onClick={load} disabled={loading}
          style={{ padding: "9px 20px", borderRadius: 8, border: `1px solid ${D.border}`, background: "transparent", color: D.text2, fontSize: 13, cursor: "pointer" }}>
          {loading ? "Loading…" : fetched ? "↺ Refresh" : "Load Analytics"}
        </button>
      </div>

      {!fetched && !loading && (
        <div style={{ textAlign: "center", padding: "60px 0", color: D.muted }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
          <div style={{ fontSize: 14 }}>Click &quot;Load Analytics&quot; to fetch guest data</div>
        </div>
      )}

      {loading && <div style={{ color: D.muted, fontSize: 14, textAlign: "center", padding: "40px 0" }}>Loading analytics…</div>}

      {fetched && !loading && (
        <>
          <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${D.border}` }}>
                  {["Name","Party","Source","Status","Arrival","Quoted","Actual Wait","Notes"].map(h => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: D.muted, fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slice.map((e, i) => (
                  <tr key={e.id} style={{ borderBottom: i < slice.length - 1 ? `1px solid ${D.border}` : "none" }}>
                    <td style={{ padding: "10px 14px", color: D.text, fontWeight: 500 }}>{e.name}</td>
                    <td style={{ padding: "10px 14px", color: D.text2 }}>{e.party_size}</td>
                    <td style={{ padding: "10px 14px" }}><span style={sourceStyle(e.source)}>{e.source.toUpperCase()}</span></td>
                    <td style={{ padding: "10px 14px" }}><span style={statusStyle(e.status)}>{e.status}</span></td>
                    <td style={{ padding: "10px 14px", color: D.text2, whiteSpace: "nowrap" }}>{e.arrival_time ? new Date(e.arrival_time).toLocaleString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}) : "—"}</td>
                    <td style={{ padding: "10px 14px", color: D.text2 }}>{e.quoted_wait != null ? `${e.quoted_wait}m` : "—"}</td>
                    <td style={{ padding: "10px 14px", color: D.text2 }}>{e.actual_wait != null ? `${e.actual_wait}m` : "—"}</td>
                    <td style={{ padding: "10px 14px", color: D.text2, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}>{e.notes || "—"}</td>
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

  function load() {
    setLoading(true); setError(null)
    fetch(`${API}/agreements/all?secret=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(r => r.json())
      .then(d => { setAgreements(d.agreements || []); setFetched(true) })
      .catch(() => setError("Failed to load agreements"))
      .finally(() => setLoading(false))
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
            {planBadge(a.plan_type, a.status || "active")}
          </div>
          <div style={{ display: "flex", gap: 28, flexWrap: "wrap" as const }}>
            {[
              ["Signed", fmtTime(a.signed_at)],
              ["Version", a.agreement_version || "—"],
              ["IP", a.ip_address || "—"],
              ["Fee", a.monthly_fee_cents != null ? `$${(a.monthly_fee_cents/100).toFixed(2)}/mo` : "Free"],
              ["Locations", String(a.location_count || 1)],
            ].map(([k, v]) => (
              <div key={k}>
                <div style={{ fontSize: 10, color: D.muted, textTransform: "uppercase", letterSpacing: "0.07em" }}>{k}</div>
                <div style={{ fontSize: 13, color: D.text, marginTop: 2 }}>{v}</div>
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
