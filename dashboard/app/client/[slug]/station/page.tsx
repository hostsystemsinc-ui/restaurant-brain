"use client"

import { useState, useEffect, useCallback, useRef, Suspense } from "react"
import { useParams } from "next/navigation"

const API = "https://restaurant-brain-production.up.railway.app"

// ── Types ─────────────────────────────────────────────────────────────────────

interface RestaurantInfo {
  id: string
  name: string
  slug: string
  adminPin?: string
}

interface QueueEntry {
  id: string
  name: string
  party_size: number
  status: "waiting" | "ready" | "seated" | "removed"
  quoted_wait: number | null
  arrival_time: string | null
  phone: string | null
  source: string
}

interface TableEntry {
  id: string
  table_number: number
  label?: string
  capacity: number
  status: "available" | "occupied"
  party_name?: string | null
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const D = {
  bg:      "#080C10",
  surface: "rgba(255,255,255,0.04)",
  surface2:"rgba(255,255,255,0.07)",
  border:  "rgba(255,255,255,0.09)",
  text:    "#FFFFFF",
  text2:   "rgba(255,255,255,0.58)",
  muted:   "rgba(255,255,255,0.28)",
  green:   "#22C55E",
  greenBg: "rgba(34,197,94,0.10)",
  greenBorder: "rgba(34,197,94,0.22)",
  orange:  "#F59E0B",
  orangeBg:"rgba(245,158,11,0.10)",
  red:     "#EF4444",
  redBg:   "rgba(239,68,68,0.10)",
  blue:    "#60A5FA",
  blueBg:  "rgba(96,165,250,0.10)",
  blueBorder: "rgba(96,165,250,0.22)",
  accent:  "#D9321C",
  yellow:  "#FBBF24",
  yellowBg:"rgba(251,191,36,0.10)",
}

function statusColor(s: string): [string, string] {
  if (s === "waiting") return [D.blue,   D.blueBg]
  if (s === "ready")   return [D.yellow, D.yellowBg]
  if (s === "seated")  return [D.green,  D.greenBg]
  return [D.muted, D.surface]
}

function minutesAgo(iso: string | null): string {
  if (!iso) return "—"
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  return mins < 60 ? `${mins}m ago` : `${Math.floor(mins/60)}h ${mins%60}m ago`
}

// ── PIN Gate ─────────────────────────────────────────────────────────────────

function PinGate({ restaurantName, onAuth }: { restaurantName: string; onAuth: (pin: string) => void }) {
  const [digits, setDigits] = useState(["","","",""])
  const refs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)]

  function handleDigit(i: number, v: string) {
    const d = v.replace(/\D/g,"").slice(-1)
    const next = [...digits]
    next[i] = d
    setDigits(next)
    if (d && i < 3) refs[i+1].current?.focus()
    if (next.every(x => x !== "")) onAuth(next.join(""))
  }

  function handleKey(i: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      refs[i-1].current?.focus()
      const next = [...digits]; next[i-1] = ""; setDigits(next)
    }
  }

  return (
    <div style={{ minHeight: "100dvh", background: D.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ textAlign: "center", maxWidth: 320 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: D.text, letterSpacing: "0.3em", marginBottom: 4 }}>HOST</div>
        <div style={{ fontSize: 13, color: D.muted, marginBottom: 8, letterSpacing: "0.05em" }}>Station View</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: D.text2, marginBottom: 32 }}>{restaurantName}</div>
        <div style={{ fontSize: 12, color: D.muted, marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.1em" }}>Enter Admin PIN</div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          {digits.map((d, i) => (
            <input key={i} ref={refs[i]} value={d} type="tel" inputMode="numeric" maxLength={1}
              onChange={e => handleDigit(i, e.target.value)}
              onKeyDown={e => handleKey(i, e)}
              onFocus={e => e.target.select()}
              style={{
                width: 56, height: 64, borderRadius: 12, textAlign: "center",
                fontSize: 28, fontWeight: 700, color: D.text,
                background: D.surface2, border: `2px solid ${D.border}`,
                outline: "none", caretColor: "transparent",
              }}
            />
          ))}
        </div>
        <p style={{ fontSize: 11, color: D.muted, marginTop: 24, lineHeight: 1.6 }}>
          Set up in HOST Owner Console → Credentials → Admin PIN
        </p>
      </div>
    </div>
  )
}

// ── Main Station ─────────────────────────────────────────────────────────────

function StationInner() {
  const params = useParams()
  const slug   = typeof params.slug === "string" ? params.slug : ""

  const [info,    setInfo]    = useState<RestaurantInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [authed,  setAuthed]  = useState(false)
  const [pinError, setPinError] = useState(false)

  const [queue,   setQueue]   = useState<QueueEntry[]>([])
  const [tables,  setTables]  = useState<TableEntry[]>([])
  const [refresh, setRefresh] = useState(0)
  const [dataLoading, setDataLoading] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [actionMsg, setActionMsg] = useState<{text:string; ok:boolean}|null>(null)
  const [tab, setTab] = useState<"queue"|"tables">("queue")
  const [expandedId, setExpandedId] = useState<string|null>(null)

  // Load restaurant info by slug
  useEffect(() => {
    if (!slug) return
    fetch(`${API}/client/${encodeURIComponent(slug)}/config`, { cache: "no-store" })
      .then(r => r.json())
      .then(d => {
        const gc = d.guest_config || {}
        setInfo({
          id:       d.restaurant_id,
          name:     gc.restaurantName || d.name || slug,
          slug,
          adminPin: gc.adminPin || "",
        })
        // Check if session already has auth for this slug
        const saved = sessionStorage.getItem(`station_auth_${slug}`)
        if (saved === "1") setAuthed(true)
      })
      .catch(() => setInfo({ id: "", name: slug, slug, adminPin: "" }))
      .finally(() => setLoading(false))
  }, [slug])

  // Load live data
  const loadData = useCallback(async () => {
    if (!info?.id || !authed) return
    setDataLoading(true)
    try {
      const [qRes, tRes] = await Promise.all([
        fetch(`${API}/queue?restaurant_id=${info.id}`, { cache: "no-store" }),
        fetch(`${API}/tables?restaurant_id=${info.id}`, { cache: "no-store" }),
      ])
      if (qRes.ok) {
        const raw = await qRes.json()
        setQueue(Array.isArray(raw) ? raw : [])
      }
      if (tRes.ok) {
        const raw = await tRes.json()
        setTables(Array.isArray(raw) ? raw : [])
      }
      setLastUpdate(new Date())
    } catch { /* non-critical */ }
    finally { setDataLoading(false) }
  }, [info?.id, authed])

  useEffect(() => {
    loadData()
    const iv = setInterval(loadData, 20_000)
    return () => clearInterval(iv)
  }, [loadData, refresh])

  // ── PIN auth ──────────────────────────────────────────────────────────────
  function tryPin(pin: string) {
    if (!info) return
    // If no admin PIN is configured, allow any 4-digit entry (open access)
    const correct = info.adminPin || ""
    if (correct === "" || pin === correct) {
      sessionStorage.setItem(`station_auth_${slug}`, "1")
      setAuthed(true)
      setPinError(false)
    } else {
      setPinError(true)
      setTimeout(() => setPinError(false), 1500)
    }
  }

  // ── Actions ───────────────────────────────────────────────────────────────
  async function seatParty(entryId: string) {
    const res = await fetch(`${API}/queue/${entryId}/seat`, { method: "POST" })
    flash(res.ok, res.ok ? "Party seated ✓" : "Failed to seat")
    if (res.ok) setRefresh(r => r + 1)
  }

  async function markReady(entryId: string) {
    const res = await fetch(`${API}/queue/${entryId}/ready`, { method: "POST" })
    flash(res.ok, res.ok ? "Marked ready ✓" : "Failed")
    if (res.ok) setRefresh(r => r + 1)
  }

  async function removeParty(entryId: string, name: string) {
    if (!confirm(`Remove ${name} from queue?`)) return
    const res = await fetch(`${API}/queue/${entryId}/remove`, { method: "POST" })
    flash(res.ok, res.ok ? "Removed ✓" : "Failed to remove")
    if (res.ok) setRefresh(r => r + 1)
  }

  async function clearTable(tableId: string) {
    const res = await fetch(`${API}/tables/${tableId}/clear`, { method: "POST" })
    flash(res.ok, res.ok ? "Table cleared ✓" : "Failed to clear table")
    if (res.ok) setRefresh(r => r + 1)
  }

  function flash(ok: boolean, text: string) {
    setActionMsg({ ok, text })
    setTimeout(() => setActionMsg(null), 2500)
  }

  // ── Loading / auth screens ────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: "100dvh", background: D.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: D.muted, fontSize: 14 }}>Loading…</div>
      </div>
    )
  }

  if (!authed) {
    return (
      <div>
        <PinGate restaurantName={info?.name || slug} onAuth={tryPin} />
        {pinError && (
          <div style={{ position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)",
            background: D.redBg, border: `1px solid ${D.red}40`, borderRadius: 10, padding: "10px 20px",
            color: D.red, fontSize: 14, fontWeight: 600 }}>
            Incorrect PIN
          </div>
        )}
      </div>
    )
  }

  // ── Active queue (waiting + ready) ────────────────────────────────────────
  const activeQueue  = queue.filter(p => p.status === "waiting" || p.status === "ready")
  const seatedToday  = queue.filter(p => p.status === "seated").length
  const tablesOpen   = tables.filter(t => t.status === "available").length
  const tablesTotal  = tables.length

  return (
    <div style={{ minHeight: "100dvh", background: D.bg, fontFamily: "system-ui, sans-serif", color: D.text }}>

      {/* ── Flash message */}
      {actionMsg && (
        <div style={{
          position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 200,
          background: actionMsg.ok ? D.greenBg : D.redBg,
          border: `1px solid ${actionMsg.ok ? D.greenBorder : D.red + "40"}`,
          borderRadius: 10, padding: "10px 22px", fontSize: 14, fontWeight: 600,
          color: actionMsg.ok ? D.green : D.red,
        }}>
          {actionMsg.text}
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${D.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: D.text, letterSpacing: "0.2em" }}>HOST</div>
          <div style={{ width: 1, height: 18, background: D.border }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: D.text2 }}>{info?.name}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {lastUpdate && <span style={{ fontSize: 11, color: D.muted }}>{lastUpdate.toLocaleTimeString()}</span>}
          <button onClick={() => setRefresh(r => r + 1)} disabled={dataLoading}
            style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${D.border}`, background: "transparent", color: D.text2, fontSize: 12, cursor: "pointer" }}>
            {dataLoading ? "…" : "↻"}
          </button>
          <button onClick={() => { sessionStorage.removeItem(`station_auth_${slug}`); setAuthed(false) }}
            style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${D.border}`, background: "transparent", color: D.muted, fontSize: 11, cursor: "pointer" }}>
            Lock
          </button>
        </div>
      </div>

      {/* ── Stat pills ─────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 12, padding: "14px 20px", borderBottom: `1px solid ${D.border}` }}>
        {[
          { label: "In Queue", value: activeQueue.length, color: activeQueue.length > 0 ? D.orange : D.green },
          { label: "Tables Open", value: `${tablesOpen}/${tablesTotal}`, color: tablesOpen > 0 ? D.green : D.red },
          { label: "Seated Today", value: seatedToday, color: D.blue },
        ].map(s => (
          <div key={s.label} style={{ background: D.surface2, border: `1px solid ${D.border}`, borderRadius: 10, padding: "10px 18px" }}>
            <div style={{ fontSize: 9, color: D.muted, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* ── Tab bar ─────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 0, padding: "12px 20px 0", borderBottom: `1px solid ${D.border}` }}>
        {(["queue","tables"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: "8px 20px", borderRadius: "8px 8px 0 0", border: `1px solid ${tab === t ? D.border : "transparent"}`,
              borderBottom: tab === t ? `1px solid ${D.bg}` : "none", marginBottom: tab === t ? -1 : 0,
              background: tab === t ? D.bg : "transparent", color: tab === t ? D.text : D.text2,
              fontSize: 13, fontWeight: tab === t ? 600 : 400, cursor: "pointer", textTransform: "capitalize" }}>
            {t === "queue" ? `Queue (${activeQueue.length})` : `Tables (${tablesOpen} open)`}
          </button>
        ))}
      </div>

      {/* ── Queue tab ─────────────────────────────────────────────────────── */}
      {tab === "queue" && (
        <div style={{ padding: 20 }}>
          {activeQueue.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: D.muted, fontSize: 15 }}>
              No parties in queue 🎉
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {activeQueue.map((p, i) => {
                const isReady = p.status === "ready"
                const isExp   = expandedId === p.id
                const [sc, sb] = statusColor(p.status)
                return (
                  <div key={p.id} style={{
                    background: isReady ? D.yellowBg : D.surface,
                    border: `1px solid ${isReady ? D.yellow + "40" : D.border}`,
                    borderRadius: 12, overflow: "hidden",
                  }}>
                    {/* Row */}
                    <div onClick={() => setExpandedId(isExp ? null : p.id)} style={{ cursor: "pointer", display: "flex", alignItems: "center", padding: "14px 16px", gap: 14 }}>
                      {/* Position */}
                      <div style={{ width: 28, height: 28, borderRadius: "50%", background: D.surface2, display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 13, fontWeight: 700, color: D.muted, flexShrink: 0 }}>
                        {i + 1}
                      </div>
                      {/* Name + party */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: D.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                        <div style={{ fontSize: 12, color: D.text2, marginTop: 2 }}>
                          {p.party_size} {p.party_size === 1 ? "guest" : "guests"}
                          {p.phone && <span style={{ marginLeft: 8, color: D.muted }}>· 📱</span>}
                          <span style={{ marginLeft: 8, color: D.muted }}>{minutesAgo(p.arrival_time)}</span>
                        </div>
                      </div>
                      {/* Status badge */}
                      <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 20, padding: "3px 10px", color: sc, background: sb, border: `1px solid ${sc}40`, whiteSpace: "nowrap" }}>
                        {p.status}
                      </span>
                      {/* Quoted wait */}
                      {p.quoted_wait && (
                        <span style={{ fontSize: 13, color: D.text2, flexShrink: 0 }}>{p.quoted_wait}m</span>
                      )}
                    </div>
                    {/* Expanded actions */}
                    {isExp && (
                      <div style={{ display: "flex", gap: 8, padding: "0 16px 14px", flexWrap: "wrap" }}>
                        {p.status === "waiting" && (
                          <button onClick={() => markReady(p.id)}
                            style={{ padding: "7px 16px", borderRadius: 8, border: `1px solid ${D.yellow}40`, background: D.yellowBg, color: D.yellow, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                            📣 Mark Ready
                          </button>
                        )}
                        <button onClick={() => seatParty(p.id)}
                          style={{ padding: "7px 16px", borderRadius: 8, border: `1px solid ${D.green}40`, background: D.greenBg, color: D.green, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                          ✓ Seat Party
                        </button>
                        <button onClick={() => removeParty(p.id, p.name)}
                          style={{ padding: "7px 16px", borderRadius: 8, border: `1px solid ${D.red}40`, background: D.redBg, color: D.red, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                          ✕ Remove
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tables tab ───────────────────────────────────────────────────── */}
      {tab === "tables" && (
        <div style={{ padding: 20 }}>
          {tables.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: D.muted, fontSize: 15 }}>
              No tables configured
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10 }}>
              {tables.map(t => {
                const isOcc = t.status === "occupied"
                return (
                  <div key={t.id} style={{
                    background: isOcc ? "rgba(239,68,68,0.08)" : D.greenBg,
                    border: `1px solid ${isOcc ? D.red + "40" : D.greenBorder}`,
                    borderRadius: 12, padding: "14px 12px", textAlign: "center",
                  }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: D.text, marginBottom: 4 }}>
                      {t.label || `T${t.table_number}`}
                    </div>
                    <div style={{ fontSize: 11, color: D.text2, marginBottom: 8 }}>{t.capacity}p</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: isOcc ? D.red : D.green,
                      textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: isOcc ? 10 : 0 }}>
                      {isOcc ? "occupied" : "available"}
                    </div>
                    {t.party_name && (
                      <div style={{ fontSize: 11, color: D.text2, marginBottom: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {t.party_name}
                      </div>
                    )}
                    {isOcc && (
                      <button onClick={() => clearTable(t.id)}
                        style={{ padding: "5px 12px", borderRadius: 7, border: `1px solid ${D.red}40`,
                          background: D.redBg, color: D.red, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                        Clear
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ClientStationPage() {
  return (
    <Suspense>
      <StationInner />
    </Suspense>
  )
}
