"use client"

import { useState, useEffect, useCallback, useRef, Suspense } from "react"
import { useParams } from "next/navigation"

const API = "https://restaurant-brain-production.up.railway.app"

// ── Design tokens ─────────────────────────────────────────────────────────────
const D = {
  bg:          "#080C10",
  sidebar:     "#0C1118",
  surface:     "rgba(255,255,255,0.04)",
  surface2:    "rgba(255,255,255,0.07)",
  border:      "rgba(255,255,255,0.09)",
  borderStrong:"rgba(255,255,255,0.16)",
  text:        "#FFFFFF",
  text2:       "rgba(255,255,255,0.60)",
  muted:       "rgba(255,255,255,0.30)",
  accent:      "#D9321C",
  green:       "#22C55E",
  greenBg:     "rgba(34,197,94,0.10)",
  greenBorder: "rgba(34,197,94,0.22)",
  orange:      "#F59E0B",
  orangeBg:    "rgba(245,158,11,0.10)",
  orangeBorder:"rgba(245,158,11,0.25)",
  red:         "#EF4444",
  redBg:       "rgba(239,68,68,0.10)",
  blue:        "#60A5FA",
  blueBg:      "rgba(96,165,250,0.10)",
  blueBorder:  "rgba(96,165,250,0.22)",
  yellow:      "#FBBF24",
  yellowBg:    "rgba(251,191,36,0.10)",
  yellowBorder:"rgba(251,191,36,0.25)",
  purple:      "#A78BFA",
  purpleBg:    "rgba(167,139,250,0.10)",
  purpleBorder:"rgba(167,139,250,0.22)",
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface RestaurantInfo {
  id: string
  name: string
  slug: string
  adminPin: string
  logoUrl?: string
}

interface FloorTablePos {
  id: string; number: number; label: string; capacity: number
  shape: string; x: number; y: number; w: number; h: number
}

interface QueueEntry {
  id: string; name: string; party_size: number
  status: "waiting" | "ready" | "seated" | "removed"
  quoted_wait: number | null; arrival_time: string | null
  phone: string | null; source: string; notes?: string | null
}

interface TableEntry {
  id: string; table_number: number; label?: string; capacity: number
  status: "available" | "occupied"; party_name?: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function minutesWaiting(iso: string | null): string {
  if (!iso) return "—"
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (mins < 1) return "just now"
  return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`
}

function nowTimeStr(): string {
  return new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
}

function sourceBadge(source: string) {
  if (source === "nfc")         return { label: "NFC",         color: D.blue,   bg: D.blueBg   }
  if (source === "host")        return { label: "Host",        color: D.green,  bg: D.greenBg  }
  if (source === "analog")      return { label: "Walk-in",     color: D.orange, bg: D.orangeBg }
  if (source === "reservation") return { label: "Reservation", color: D.purple, bg: D.purpleBg }
  if (source === "qr")          return { label: "QR",          color: D.blue,   bg: D.blueBg   }
  return { label: source, color: D.muted, bg: D.surface }
}

// ── PIN Gate ─────────────────────────────────────────────────────────────────
function PinGate({ name, onAuth, error }: { name: string; onAuth: (pin: string) => void; error: boolean }) {
  const [digits, setDigits] = useState(["", "", "", ""])
  const refs = [
    useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null),
  ]

  function handleDigit(i: number, v: string) {
    const d = v.replace(/\D/g, "").slice(-1)
    const next = [...digits]; next[i] = d; setDigits(next)
    if (d && i < 3) refs[i + 1].current?.focus()
    if (d && i === 3 && next.every(x => x)) onAuth(next.join(""))
    if (!d && i === 3 && next.filter(Boolean).length === 3) {
      const full = next.join(""); if (full.length === 4) onAuth(full)
    }
  }
  function handleKey(i: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      const next = [...digits]; next[i - 1] = ""; setDigits(next)
      refs[i - 1].current?.focus()
    }
  }

  return (
    <div style={{ minHeight: "100dvh", background: D.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: "0.32em", color: D.text, marginBottom: 4 }}>HOST</div>
        <div style={{ fontSize: 12, color: D.muted, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>Station</div>
        <div style={{ fontSize: 18, fontWeight: 600, color: D.text2, marginBottom: 40 }}>{name}</div>
        <div style={{ fontSize: 11, color: D.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>Admin PIN</div>
        <div style={{ display: "flex", gap: 14, justifyContent: "center", marginBottom: 24 }}>
          {digits.map((d, i) => (
            <input key={i} ref={refs[i]} value={d} type="tel" inputMode="numeric" maxLength={1}
              onChange={e => handleDigit(i, e.target.value)}
              onKeyDown={e => handleKey(i, e)}
              onFocus={e => e.target.select()}
              autoFocus={i === 0}
              style={{
                width: 60, height: 72, borderRadius: 14, textAlign: "center",
                fontSize: 30, fontWeight: 700, color: D.text,
                background: D.surface2,
                border: `2px solid ${error ? D.red : D.border}`,
                outline: "none", caretColor: "transparent", transition: "border-color 0.2s",
              }}
            />
          ))}
        </div>
        {error && (
          <div style={{ color: D.red, fontSize: 13, fontWeight: 600 }}>Incorrect PIN</div>
        )}
        <p style={{ fontSize: 11, color: D.muted, marginTop: 32, maxWidth: 260, lineHeight: 1.6 }}>
          Set Admin PIN in HOST Owner Console → Credentials
        </p>
      </div>
    </div>
  )
}

// ── Walk-in Modal ─────────────────────────────────────────────────────────────
function WalkInModal({ onClose, onAdd, restaurantId }: { onClose: () => void; onAdd: () => void; restaurantId: string }) {
  const [name,      setName]      = useState("")
  const [partySize, setPartySize] = useState(2)
  const [phone,     setPhone]     = useState("")
  const [notes,     setNotes]     = useState("")
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState("")

  async function submit() {
    if (!name.trim()) { setError("Name required"); return }
    setLoading(true); setError("")
    try {
      const r = await fetch(`${API}/queue/join`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(), party_size: partySize,
          phone: phone.trim() || null,
          source: "analog",
          restaurant_id: restaurantId,
          notes: notes.trim() || null,
        }),
      })
      if (!r.ok) { const d = await r.json(); throw new Error(d.detail || "Failed") }
      onAdd()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong")
    } finally { setLoading(false) }
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
      <div style={{ background: D.sidebar, border: `1px solid ${D.borderStrong}`, borderRadius: 18, padding: 28, width: "100%", maxWidth: 420, fontFamily: "system-ui, sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: D.text }}>Walk-in Entry</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: D.muted, fontSize: 22, cursor: "pointer", lineHeight: 1 }}>✕</button>
        </div>

        {/* Party size */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: D.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Party Size</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[1,2,3,4,5,6,7,8].map(n => (
              <button key={n} onClick={() => setPartySize(n)}
                style={{ width: 44, height: 44, borderRadius: 10, border: `2px solid ${partySize === n ? D.accent : D.border}`,
                  background: partySize === n ? D.accent + "20" : "transparent",
                  color: partySize === n ? D.accent : D.text2,
                  fontSize: 16, fontWeight: 700, cursor: "pointer" }}>
                {n}
              </button>
            ))}
          </div>
          {partySize >= 8 && (
            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
              <input type="number" value={partySize} min={1} max={50} onChange={e => setPartySize(parseInt(e.target.value) || 1)}
                style={{ width: 70, padding: "8px 10px", borderRadius: 8, border: `1px solid ${D.border}`, background: D.surface, color: D.text, fontSize: 16, outline: "none", textAlign: "center" }} />
              <span style={{ color: D.text2, fontSize: 13 }}>guests</span>
              {partySize < 9 && <button onClick={() => setPartySize(9)} style={{ background: "none", border: "none", color: D.blue, fontSize: 12, cursor: "pointer" }}>Larger party?</button>}
            </div>
          )}
        </div>

        {/* Name */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: D.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Name *</div>
          <input placeholder="Guest name" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()}
            style={{ width: "100%", boxSizing: "border-box", padding: "11px 14px", borderRadius: 10, border: `1px solid ${D.border}`, background: D.surface2, color: D.text, fontSize: 15, outline: "none" }} />
        </div>

        {/* Phone */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: D.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Phone <span style={{ color: D.muted, fontWeight: 400, textTransform: "none" }}>— optional (SMS alert)</span></div>
          <input placeholder="(555) 555-5555" value={phone} onChange={e => setPhone(e.target.value)} type="tel"
            style={{ width: "100%", boxSizing: "border-box", padding: "11px 14px", borderRadius: 10, border: `1px solid ${D.border}`, background: D.surface2, color: D.text, fontSize: 15, outline: "none" }} />
        </div>

        {/* Notes */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: D.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Notes <span style={{ color: D.muted, fontWeight: 400, textTransform: "none" }}>— optional</span></div>
          <input placeholder="e.g. Birthday, high chair needed" value={notes} onChange={e => setNotes(e.target.value)}
            style={{ width: "100%", boxSizing: "border-box", padding: "11px 14px", borderRadius: 10, border: `1px solid ${D.border}`, background: D.surface2, color: D.text, fontSize: 15, outline: "none" }} />
        </div>

        {error && <div style={{ color: D.red, fontSize: 13, marginBottom: 12 }}>{error}</div>}

        <button onClick={submit} disabled={loading}
          style={{ width: "100%", padding: "14px 0", borderRadius: 12, border: "none", background: loading ? D.muted : D.green, color: "#fff", fontSize: 16, fontWeight: 700, cursor: loading ? "default" : "pointer" }}>
          {loading ? "Adding…" : "Add to Queue"}
        </button>
      </div>
    </div>
  )
}

// ── Reservation Modal ─────────────────────────────────────────────────────────
function ReservationModal({ onClose, onAdd, restaurantId }: { onClose: () => void; onAdd: () => void; restaurantId: string }) {
  const today = new Date().toISOString().slice(0, 10)
  const [name,      setName]      = useState("")
  const [partySize, setPartySize] = useState(2)
  const [phone,     setPhone]     = useState("")
  const [date,      setDate]      = useState(today)
  const [time,      setTime]      = useState("19:00")
  const [notes,     setNotes]     = useState("")
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState("")

  async function submit() {
    if (!name.trim()) { setError("Name required"); return }
    setLoading(true); setError("")
    try {
      const arrival = new Date(`${date}T${time}:00`).toISOString()
      const r = await fetch(`${API}/queue/join`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(), party_size: partySize,
          phone: phone.trim() || null, source: "reservation",
          restaurant_id: restaurantId,
          arrival_time: arrival,
          notes: notes.trim() || null,
        }),
      })
      if (!r.ok) { const d = await r.json(); throw new Error(d.detail || "Failed") }
      onAdd()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong")
    } finally { setLoading(false) }
  }

  const inp: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "10px 13px", borderRadius: 10, border: `1px solid ${D.border}`, background: D.surface2, color: D.text, fontSize: 14, outline: "none" }
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: D.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5, display: "block" }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
      <div style={{ background: D.sidebar, border: `1px solid ${D.borderStrong}`, borderRadius: 18, padding: 28, width: "100%", maxWidth: 420, fontFamily: "system-ui, sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: D.text }}>Add Reservation</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: D.muted, fontSize: 22, cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={lbl}>Guest Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Name" style={inp} />
          </div>
          <div>
            <label style={lbl}>Party Size</label>
            <input type="number" value={partySize} min={1} max={50} onChange={e => setPartySize(parseInt(e.target.value)||1)} style={inp} />
          </div>
          <div>
            <label style={lbl}>Phone (optional)</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(555) 555-5555" type="tel" style={inp} />
          </div>
          <div>
            <label style={lbl}>Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inp, colorScheme: "dark" }} />
          </div>
          <div>
            <label style={lbl}>Time</label>
            <input type="time" value={time} onChange={e => setTime(e.target.value)} style={{ ...inp, colorScheme: "dark" }} />
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={lbl}>Notes (optional)</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Anniversary, allergies" style={inp} />
          </div>
        </div>
        {error && <div style={{ color: D.red, fontSize: 13, marginBottom: 10 }}>{error}</div>}
        <button onClick={submit} disabled={loading}
          style={{ width: "100%", padding: "13px 0", borderRadius: 12, border: "none", background: loading ? D.muted : D.purple, color: "#fff", fontSize: 15, fontWeight: 700, cursor: loading ? "default" : "pointer" }}>
          {loading ? "Saving…" : "Save Reservation"}
        </button>
      </div>
    </div>
  )
}

// ── Admin Modal ───────────────────────────────────────────────────────────────
function AdminModal({ info, onClose, onLock }: { info: RestaurantInfo; onClose: () => void; onLock: () => void }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
      <div style={{ background: D.sidebar, border: `1px solid ${D.borderStrong}`, borderRadius: 18, padding: 28, width: "100%", maxWidth: 400, fontFamily: "system-ui, sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: D.text }}>Admin</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: D.muted, fontSize: 22, cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ background: D.surface2, borderRadius: 10, padding: "12px 16px" }}>
            <div style={{ fontSize: 11, color: D.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Restaurant</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: D.text }}>{info.name}</div>
            <div style={{ fontSize: 11, color: D.muted, fontFamily: "monospace", marginTop: 2 }}>{info.id}</div>
          </div>
          <a href={`/owner`} target="_blank" rel="noopener noreferrer"
            style={{ display: "block", padding: "12px 16px", borderRadius: 10, border: `1px solid ${D.border}`, background: D.surface,
              color: D.blue, fontSize: 14, fontWeight: 600, textDecoration: "none", textAlign: "center" }}>
            ↗ Open Owner Console
          </a>
          <a href={`/client/${info.slug}/join`} target="_blank" rel="noopener noreferrer"
            style={{ display: "block", padding: "12px 16px", borderRadius: 10, border: `1px solid ${D.border}`, background: D.surface,
              color: D.green, fontSize: 14, fontWeight: 600, textDecoration: "none", textAlign: "center" }}>
            ↗ Guest Join Page
          </a>
          <button onClick={onLock}
            style={{ padding: "12px 16px", borderRadius: 10, border: `1px solid ${D.red}40`, background: D.redBg, color: D.red, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            🔒 Lock Station
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Floor Plan Viewer (positioned) ────────────────────────────────────────────
function FloorPlanView({ tables, liveStatus }: {
  tables: FloorTablePos[]
  liveStatus: Record<string, { status: string; partyName?: string }>
}) {
  return (
    <div style={{ width: "100%", aspectRatio: "16/9", background: "rgba(0,0,0,0.5)", borderRadius: 12, border: `1px solid ${D.border}`, position: "relative", overflow: "hidden", minHeight: 280 }}>
      {tables.map(t => {
        const live = liveStatus[t.id] || {}
        const isOcc = live.status === "occupied"
        const baseStyle: React.CSSProperties = {
          position: "absolute",
          left: `${t.x - t.w / 2}%`, top: `${t.y - t.h / 2}%`,
          width: `${t.w}%`, height: `${t.h}%`,
          display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column",
          background: isOcc ? "rgba(239,68,68,0.18)" : "rgba(34,197,94,0.12)",
          border: `1.5px solid ${isOcc ? D.red + "60" : D.green + "50"}`,
          borderRadius: t.shape === "circle" ? "50%" : t.shape === "booth" ? "4px 4px 0 0" : "6px",
          boxSizing: "border-box",
        }
        if (t.shape === "diamond") {
          baseStyle.clipPath = "polygon(50% 0%,100% 50%,50% 100%,0% 50%)"
          baseStyle.borderRadius = 0; baseStyle.border = "none"
          baseStyle.background = isOcc ? "rgba(239,68,68,0.2)" : "rgba(34,197,94,0.15)"
        }
        return (
          <div key={t.id} style={baseStyle}>
            <div style={{ fontSize: "clamp(7px,1.2%,11px)", fontWeight: 700, color: D.text, lineHeight: 1, textAlign: "center" }}>
              {t.label || t.number}
            </div>
            {isOcc && live.partyName && (
              <div style={{ fontSize: "clamp(6px,0.9%,9px)", color: D.text2, lineHeight: 1, marginTop: 1, textAlign: "center", overflow: "hidden", maxWidth: "90%" }}>
                {live.partyName}
              </div>
            )}
          </div>
        )
      })}
      {tables.length === 0 && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: D.muted, fontSize: 13 }}>
          No floor plan configured — add one in the Owner Console
        </div>
      )}
    </div>
  )
}

// ── Main Station ──────────────────────────────────────────────────────────────
function StationInner() {
  const params = useParams()
  const slug   = typeof params.slug === "string" ? params.slug : ""

  // Auth
  const [info,      setInfo]      = useState<RestaurantInfo | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [authed,    setAuthed]    = useState(false)
  const [pinError,  setPinError]  = useState(false)

  // Floor plan from config
  const [floorPlan, setFloorPlan] = useState<FloorTablePos[]>([])

  // Live data
  const [queue,   setQueue]   = useState<QueueEntry[]>([])
  const [tables,  setTables]  = useState<TableEntry[]>([])
  const [lastUpd, setLastUpd] = useState<Date | null>(null)
  const [dataLoading, setDataLoading] = useState(false)
  const [refreshKey,  setRefreshKey]  = useState(0)

  // UI state
  const [tab,         setTab]         = useState<"queue"|"tables"|"reservations">("queue")
  const [expandedId,  setExpandedId]  = useState<string | null>(null)
  const [showWalkIn,  setShowWalkIn]  = useState(false)
  const [showReserv,  setShowReserv]  = useState(false)
  const [showAdmin,   setShowAdmin]   = useState(false)
  const [flashMsg,    setFlashMsg]    = useState<{ text: string; ok: boolean } | null>(null)
  const [clockStr,    setClockStr]    = useState(nowTimeStr())

  // Terms acceptance state
  interface TermsSectionData { heading: string; body: string }
  const [termsPending,   setTermsPending]   = useState(false)
  const [termsVersion,   setTermsVersion]   = useState("")
  const [termsDate,      setTermsDate]      = useState("")
  const [termsSections,  setTermsSections]  = useState<TermsSectionData[]>([])
  const [termsExpanded,  setTermsExpanded]  = useState(false)
  const [termsRead,      setTermsRead]      = useState(false)
  const [termsAccepting, setTermsAccepting] = useState(false)

  // Table/queue action guards — prevent double-clicks and duplicate mutations
  const [seatingId,  setSeatingId]  = useState<string | null>(null)
  const [clearingId, setClearingId] = useState<string | null>(null)

  // Clock
  useEffect(() => {
    const iv = setInterval(() => setClockStr(nowTimeStr()), 30_000)
    return () => clearInterval(iv)
  }, [])

  // Load restaurant info by slug
  useEffect(() => {
    if (!slug) return
    fetch(`${API}/client/${encodeURIComponent(slug)}/config`, { cache: "no-store" })
      .then(r => r.json())
      .then(d => {
        const gc = (d.guest_config || {}) as Record<string, unknown>
        const adminPin = typeof gc.adminPin === "string" ? gc.adminPin : ""
        setInfo({
          id:       String(d.restaurant_id || ""),
          name:     String(gc.restaurantName || d.name || slug),
          slug,
          adminPin,
          logoUrl:  typeof gc.logoUrl === "string" ? gc.logoUrl : "",
        })
        // Load floor plan tables
        const fp = d.floor_plan
        if (fp && !Array.isArray(fp) && typeof fp === "object") {
          const fpObj = fp as { tables?: FloorTablePos[] }
          if (Array.isArray(fpObj.tables)) setFloorPlan(fpObj.tables)
        } else if (Array.isArray(fp)) {
          setFloorPlan(fp as FloorTablePos[])
        }
        // Check session auth
        if (sessionStorage.getItem(`station_auth_${slug}`) === "1") setAuthed(true)

        // ── Check terms acceptance from config (persistent, survives restarts) ──
        // If termsRequiredVersion is set and doesn't match termsAcceptedVersion,
        // the client must accept before using the station.
        const required = typeof gc.termsRequiredVersion === "string" ? gc.termsRequiredVersion : ""
        const accepted = typeof gc.termsAcceptedVersion === "string" ? gc.termsAcceptedVersion : ""
        if (required && required !== accepted) {
          setTermsVersion(required)
          setTermsPending(true)
          // Load full terms text from the terms API (does not contain client data)
          fetch("/api/admin/terms")
            .then(r => r.json())
            .then(t => {
              if (t.version) setTermsVersion(t.version)
              if (t.effectiveDate) setTermsDate(t.effectiveDate)
              if (Array.isArray(t.sections)) setTermsSections(t.sections)
            })
            .catch(() => {/* non-critical — show modal with version only if text fails to load */})
        }
      })
      .catch(() => setInfo({ id: "", name: slug, slug, adminPin: "" }))
      .finally(() => setLoading(false))
  }, [slug])

  // Keep a ref so the polling callback can read termsPending without being
  // recreated every time it changes (avoids cancelling the interval needlessly).
  const termsPendingRef = useRef(termsPending)
  termsPendingRef.current = termsPending

  // Load live data + check for terms push on every poll cycle
  const loadData = useCallback(async () => {
    if (!info?.id || !authed) return
    setDataLoading(true)
    try {
      const [qRes, tRes, cfgRes] = await Promise.all([
        fetch(`${API}/queue?restaurant_id=${info.id}`, { cache: "no-store" }),
        fetch(`${API}/tables?restaurant_id=${info.id}`, { cache: "no-store" }),
        // Re-check config every cycle so a terms push shows up on open stations
        // without requiring a page refresh.
        fetch(`${API}/client/${encodeURIComponent(slug)}/config`, { cache: "no-store" }),
      ])
      if (qRes.ok) setQueue(await qRes.json())
      if (tRes.ok) setTables(await tRes.json())
      if (cfgRes.ok && !termsPendingRef.current) {
        const d   = await cfgRes.json()
        const gc  = (d.guest_config || {}) as Record<string, unknown>
        const req = typeof gc.termsRequiredVersion === "string" ? gc.termsRequiredVersion : ""
        const acc = typeof gc.termsAcceptedVersion === "string" ? gc.termsAcceptedVersion : ""
        if (req && req !== acc) {
          setTermsVersion(req)
          setTermsPending(true)
          fetch("/api/admin/terms")
            .then(r => r.json())
            .then(t => {
              if (t.version)              setTermsVersion(t.version)
              if (t.effectiveDate)        setTermsDate(t.effectiveDate)
              if (Array.isArray(t.sections)) setTermsSections(t.sections)
            })
            .catch(() => {})
        }
      }
      setLastUpd(new Date())
    } catch { /* non-critical */ }
    finally { setDataLoading(false) }
  }, [info?.id, authed, slug])

  useEffect(() => {
    loadData()
    const iv = setInterval(loadData, 20_000)
    return () => clearInterval(iv)
  }, [loadData, refreshKey])

  // ── Auth ──────────────────────────────────────────────────────────────────
  function tryPin(pin: string) {
    if (!info) return
    const correct = info.adminPin || ""
    if (correct === "" || pin === correct) {
      sessionStorage.setItem(`station_auth_${slug}`, "1")
      setAuthed(true); setPinError(false)
    } else {
      setPinError(true)
      setTimeout(() => setPinError(false), 1500)
    }
  }

  function lock() {
    sessionStorage.removeItem(`station_auth_${slug}`)
    setAuthed(false); setShowAdmin(false)
  }

  async function acceptTerms() {
    if (!termsRead) return
    setTermsAccepting(true)
    try {
      // Write acceptance into the DB via server-side route — persists across restarts
      await fetch("/api/client/terms-accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, version: termsVersion }),
      })
    } catch { /* best-effort — don't block the user if the accept call fails */ }
    finally {
      // Always dismiss the modal — the station must never be permanently blocked
      setTermsPending(false)
      setTermsAccepting(false)
    }
  }

  // ── Actions ───────────────────────────────────────────────────────────────
  function flash(ok: boolean, text: string) {
    setFlashMsg({ ok, text }); setTimeout(() => setFlashMsg(null), 2500)
  }

  async function act(endpoint: string, method = "POST"): Promise<boolean> {
    const res = await fetch(`${API}${endpoint}`, { method })
    return res.ok
  }

  async function markReady(id: string) {
    const ok = await act(`/queue/${id}/ready`)
    flash(ok, ok ? "Marked ready — SMS sent if phone on file" : "Failed")
    if (ok) setRefreshKey(k => k + 1)
  }

  async function seatParty(id: string) {
    if (seatingId) return // guard: prevent double-tap / double-click
    setSeatingId(id)
    // Optimistic update — remove from active queue immediately so the UI feels instant
    // and staff can't accidentally re-seat the same party
    setQueue(prev => prev.map(p => p.id === id ? { ...p, status: "seated" as const } : p))
    setExpandedId(null)
    try {
      const ok = await act(`/queue/${id}/seat`)
      flash(ok, ok ? "Party seated ✓" : "Seat failed — refreshing")
      setRefreshKey(k => k + 1) // sync with server
    } catch {
      flash(false, "Network error — refreshing")
      setRefreshKey(k => k + 1)
    } finally {
      setSeatingId(null)
    }
  }

  async function removeParty(id: string, name: string) {
    if (!confirm(`Remove ${name} from the queue?`)) return
    // Optimistic remove
    setQueue(prev => prev.filter(p => p.id !== id))
    setExpandedId(null)
    try {
      const ok = await act(`/queue/${id}/remove`)
      flash(ok, ok ? "Removed from queue" : "Remove failed — refreshing")
    } catch {
      flash(false, "Network error — refreshing")
    } finally {
      setRefreshKey(k => k + 1)
    }
  }

  async function clearTable(id: string) {
    if (clearingId) return // guard: prevent double-tap
    setClearingId(id)
    // Optimistic update
    setTables(prev => prev.map(t => t.id === id ? { ...t, status: "available" as const, party_name: undefined } : t))
    try {
      const ok = await act(`/tables/${id}/clear`)
      flash(ok, ok ? "Table cleared ✓" : "Clear failed — refreshing")
    } catch {
      flash(false, "Network error — refreshing")
    } finally {
      setRefreshKey(k => k + 1)
      setClearingId(null)
    }
  }

  // ── Derived data ──────────────────────────────────────────────────────────
  const activeQueue = queue.filter(p => p.status === "waiting" || p.status === "ready")
  const seatedToday = queue.filter(p => p.status === "seated").length
  const reservations = queue.filter(p => p.source === "reservation" && (p.status === "waiting" || p.status === "ready"))
  const tablesOpen  = tables.filter(t => t.status === "available").length

  // Build live status map for floor plan
  const liveStatus: Record<string, { status: string; partyName?: string }> = {}
  tables.forEach(t => {
    liveStatus[t.id] = { status: t.status, partyName: t.party_name || undefined }
  })

  // ── Render: loading ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: "100dvh", background: D.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: D.muted, fontSize: 14, fontFamily: "system-ui, sans-serif" }}>Loading…</div>
      </div>
    )
  }

  // ── Render: PIN gate ──────────────────────────────────────────────────────
  if (!authed) {
    return <PinGate name={info?.name || slug} onAuth={tryPin} error={pinError} />
  }

  // ── Render: terms acceptance modal (overlay, blocks station) ────────────────
  if (termsPending) {
    return (
      <div style={{ minHeight: "100dvh", background: D.bg, fontFamily: "system-ui, sans-serif", color: D.text,
        display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
        <div style={{ width: "100%", maxWidth: 640, background: "#0E141C", border: `1px solid ${D.borderStrong}`,
          borderRadius: 20, overflow: "hidden", boxShadow: "0 24px 80px rgba(0,0,0,0.7)" }}>

          {/* Header */}
          <div style={{ padding: "28px 32px 20px", borderBottom: `1px solid ${D.border}` }}>
            <div style={{ fontSize: 11, color: D.muted, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>
              Host Platform LLC
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: D.text, letterSpacing: "-0.02em", marginBottom: 4 }}>
              Updated Terms of Service
            </div>
            <div style={{ fontSize: 13, color: D.text2 }}>
              Version {termsVersion}{termsDate ? ` · Effective ${termsDate}` : ""}
            </div>
          </div>

          {/* Body */}
          <div style={{ padding: "24px 32px" }}>
            <p style={{ fontSize: 14, color: D.text2, lineHeight: 1.7, margin: "0 0 20px" }}>
              We&apos;ve updated the agreement between your business and Host Platform LLC.
              Please review the terms below and confirm your acceptance to continue using HOST.
            </p>

            {/* Expandable terms text */}
            <div style={{ border: `1px solid ${D.border}`, borderRadius: 10, overflow: "hidden", marginBottom: 20 }}>
              <button
                onClick={() => setTermsExpanded(e => !e)}
                style={{ width: "100%", padding: "12px 16px", background: D.surface2, border: "none", cursor: "pointer",
                  display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: D.text, fontWeight: 600 }}>Read Full Agreement</span>
                <span style={{ fontSize: 16, color: D.text2 }}>{termsExpanded ? "▲" : "▼"}</span>
              </button>
              {termsExpanded && (
                <div style={{ maxHeight: 340, overflowY: "auto", padding: "16px 20px", background: D.surface }}>
                  {termsSections.map((s, i) => (
                    <div key={i} style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: D.text2, textTransform: "uppercase",
                        letterSpacing: "0.09em", marginBottom: 4, paddingTop: 10,
                        borderTop: i > 0 ? `1px solid ${D.border}` : "none" }}>
                        {s.heading}
                      </div>
                      {s.body.split("\n\n").map((para, j) => (
                        <p key={j} style={{ fontSize: 11, color: D.muted, lineHeight: 1.75, margin: "0 0 6px" }}>{para}</p>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* I've read checkbox */}
            <label style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer", marginBottom: 24 }}>
              <input type="checkbox" checked={termsRead} onChange={e => setTermsRead(e.target.checked)}
                style={{ marginTop: 2, width: 18, height: 18, accentColor: D.accent, cursor: "pointer", flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: D.text2, lineHeight: 1.6 }}>
                I confirm that I am authorized to accept agreements on behalf of <strong style={{ color: D.text }}>{info?.name || slug}</strong>, and I have read and agree to the Host Platform LLC Master Subscription Agreement version <strong style={{ color: D.text }}>{termsVersion}</strong>.
              </span>
            </label>

            {/* Accept button */}
            <button
              onClick={acceptTerms}
              disabled={!termsRead || termsAccepting}
              style={{
                width: "100%", padding: "14px 0", borderRadius: 10, border: "none",
                background: termsRead ? D.accent : D.surface2,
                color: termsRead ? "#fff" : D.muted,
                fontSize: 15, fontWeight: 700, cursor: termsRead ? "pointer" : "not-allowed",
                transition: "background 0.15s",
              }}>
              {termsAccepting ? "Recording agreement…" : "I've Read and Agree — Continue to HOST"}
            </button>

            <p style={{ fontSize: 11, color: D.muted, textAlign: "center", marginTop: 14, marginBottom: 0 }}>
              Your acceptance will be recorded with a timestamp and your IP address as a valid electronic signature under the ESIGN Act and Colorado UETA.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Render: main station ──────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100dvh", background: D.bg, fontFamily: "system-ui, sans-serif", color: D.text, display: "flex", flexDirection: "column" }}>

      {/* Flash message */}
      {flashMsg && (
        <div style={{ position: "fixed", top: 14, left: "50%", transform: "translateX(-50%)", zIndex: 400,
          background: flashMsg.ok ? D.greenBg : D.redBg,
          border: `1px solid ${flashMsg.ok ? D.greenBorder : D.red + "40"}`,
          borderRadius: 10, padding: "10px 22px", fontSize: 14, fontWeight: 600,
          color: flashMsg.ok ? D.green : D.red, whiteSpace: "nowrap" }}>
          {flashMsg.text}
        </div>
      )}

      {/* Modals */}
      {showWalkIn && info && (
        <WalkInModal restaurantId={info.id} onClose={() => setShowWalkIn(false)} onAdd={() => { setShowWalkIn(false); setRefreshKey(k => k+1); flash(true, "Walk-in added ✓") }} />
      )}
      {showReserv && info && (
        <ReservationModal restaurantId={info.id} onClose={() => setShowReserv(false)} onAdd={() => { setShowReserv(false); setRefreshKey(k=>k+1); flash(true, "Reservation saved ✓") }} />
      )}
      {showAdmin && info && (
        <AdminModal info={info} onClose={() => setShowAdmin(false)} onLock={lock} />
      )}

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ padding: "12px 18px", borderBottom: `1px solid ${D.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, background: D.sidebar }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: "0.25em", color: D.text }}>HOST</div>
          <div style={{ width: 1, height: 20, background: D.border }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: D.text2 }}>{info?.name}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, color: D.muted, fontVariantNumeric: "tabular-nums" }}>{clockStr}</span>
          {lastUpd && <span style={{ fontSize: 11, color: D.muted }}>{lastUpd.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>}
          <button onClick={() => setRefreshKey(k => k + 1)} disabled={dataLoading}
            style={{ padding: "5px 12px", borderRadius: 7, border: `1px solid ${D.border}`, background: "transparent", color: D.text2, fontSize: 12, cursor: "pointer" }}>
            {dataLoading ? "…" : "↻"}
          </button>
          <button onClick={() => setShowAdmin(true)}
            style={{ padding: "5px 14px", borderRadius: 7, border: `1px solid ${D.border}`, background: D.surface, color: D.text2, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            ⚙ Admin
          </button>
        </div>
      </div>

      {/* ── Stat pills ─────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 10, padding: "12px 18px", borderBottom: `1px solid ${D.border}`, flexShrink: 0, overflowX: "auto" }}>
        {[
          { label: "In Queue",     value: activeQueue.length, color: activeQueue.length > 0 ? D.orange : D.green },
          { label: "Tables Open",  value: `${tablesOpen}/${tables.length}`, color: tablesOpen > 0 ? D.green : D.red },
          { label: "Reservations", value: reservations.length, color: reservations.length > 0 ? D.purple : D.muted },
          { label: "Seated Today", value: seatedToday, color: D.blue },
        ].map(s => (
          <div key={s.label} style={{ background: D.surface2, border: `1px solid ${D.border}`, borderRadius: 10, padding: "9px 16px", flexShrink: 0 }}>
            <div style={{ fontSize: 9, color: D.muted, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 3 }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
          </div>
        ))}
        {/* Walk-in button */}
        <button onClick={() => setShowWalkIn(true)}
          style={{ marginLeft: "auto", padding: "9px 18px", borderRadius: 10, border: "none", background: D.accent, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
          + Walk-in
        </button>
        <button onClick={() => setShowReserv(true)}
          style={{ padding: "9px 16px", borderRadius: 10, border: `1px solid ${D.purpleBorder}`, background: D.purpleBg, color: D.purple, fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>
          + Reservation
        </button>
      </div>

      {/* ── Tab bar ─────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 2, padding: "0 18px", borderBottom: `1px solid ${D.border}`, flexShrink: 0, background: D.sidebar }}>
        {([
          { id: "queue" as const,        label: `Queue (${activeQueue.length})` },
          { id: "tables" as const,       label: `Tables (${tablesOpen} open)` },
          { id: "reservations" as const, label: `Reservations (${reservations.length})` },
        ]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: "10px 16px", borderRadius: "8px 8px 0 0", border: "none",
              borderBottom: tab === t.id ? `2px solid ${D.accent}` : "2px solid transparent",
              background: "transparent", color: tab === t.id ? D.text : D.text2,
              fontSize: 13, fontWeight: tab === t.id ? 600 : 400, cursor: "pointer" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: "auto", padding: 18 }}>

        {/* Queue tab */}
        {tab === "queue" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 700 }}>
            {activeQueue.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: D.muted, fontSize: 15 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
                Queue is empty — no parties waiting
              </div>
            ) : activeQueue.map((p, i) => {
              const isReady = p.status === "ready"
              const isExp   = expandedId === p.id
              const sb      = sourceBadge(p.source)
              return (
                <div key={p.id} style={{
                  background: isReady ? "rgba(251,191,36,0.06)" : D.surface,
                  border: `1px solid ${isReady ? D.yellow + "50" : D.border}`,
                  borderRadius: 12, overflow: "hidden", transition: "border-color 0.15s",
                }}>
                  <div onClick={() => setExpandedId(isExp ? null : p.id)}
                    style={{ display: "flex", alignItems: "center", padding: "12px 14px", gap: 12, cursor: "pointer" }}>
                    {/* Position */}
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: isReady ? D.yellowBg : D.surface2,
                      border: `1px solid ${isReady ? D.yellowBorder : D.border}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, fontWeight: 700, color: isReady ? D.yellow : D.muted, flexShrink: 0 }}>
                      {i + 1}
                    </div>
                    {/* Name */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: D.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                        {isReady && <span style={{ fontSize: 10, fontWeight: 800, color: D.yellow, letterSpacing: "0.06em" }}>READY</span>}
                      </div>
                      <div style={{ fontSize: 12, color: D.text2, marginTop: 2, display: "flex", gap: 10, alignItems: "center" }}>
                        <span>{p.party_size} {p.party_size === 1 ? "guest" : "guests"}</span>
                        <span style={{ color: D.muted }}>·</span>
                        <span>{minutesWaiting(p.arrival_time)}</span>
                        {p.quoted_wait && <><span style={{ color: D.muted }}>·</span><span>~{p.quoted_wait}m quoted</span></>}
                        {p.phone && <><span style={{ color: D.muted }}>·</span><span>📱</span></>}
                        {p.notes && <><span style={{ color: D.muted }}>·</span><span style={{ fontStyle: "italic" }}>{p.notes}</span></>}
                      </div>
                    </div>
                    {/* Source badge */}
                    <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 20, padding: "3px 9px", color: sb.color, background: sb.bg, border: `1px solid ${sb.color}40`, whiteSpace: "nowrap", flexShrink: 0 }}>
                      {sb.label}
                    </span>
                    <span style={{ color: D.muted, fontSize: 16, flexShrink: 0 }}>{isExp ? "▲" : "▼"}</span>
                  </div>

                  {/* Expanded actions */}
                  {isExp && (
                    <div style={{ display: "flex", gap: 8, padding: "0 14px 12px", flexWrap: "wrap", borderTop: `1px solid ${D.border}`, paddingTop: 10 }}>
                      {p.status === "waiting" && (
                        <button onClick={() => markReady(p.id)}
                          style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${D.yellowBorder}`, background: D.yellowBg, color: D.yellow, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                          📣 Mark Ready
                        </button>
                      )}
                      <button
                        onClick={() => seatParty(p.id)}
                        disabled={!!seatingId}
                        style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: seatingId === p.id ? D.muted : D.green, color: "#fff", fontSize: 13, fontWeight: 700, cursor: seatingId ? "not-allowed" : "pointer" }}>
                        {seatingId === p.id ? "Seating…" : "✓ Seat Party"}
                      </button>
                      <button onClick={() => removeParty(p.id, p.name)}
                        style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${D.red}40`, background: D.redBg, color: D.red, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                        ✕ Remove
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Tables tab */}
        {tab === "tables" && (
          <div>
            {/* Show positioned floor plan if available */}
            {floorPlan.length > 0 ? (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: D.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Floor Plan</div>
                <FloorPlanView tables={floorPlan} liveStatus={liveStatus} />
              </div>
            ) : null}

            {/* Table grid */}
            <div style={{ fontSize: 11, fontWeight: 700, color: D.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
              {floorPlan.length > 0 ? "All Tables" : "Tables"}
            </div>
            {tables.length === 0 ? (
              <div style={{ color: D.muted, fontSize: 14, textAlign: "center", padding: "40px 0" }}>
                No tables configured — add them in Owner Console → Floor Map
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10 }}>
                {tables.map(t => {
                  const isOcc = t.status === "occupied"
                  return (
                    <div key={t.id} style={{
                      background: isOcc ? D.redBg : D.greenBg,
                      border: `1px solid ${isOcc ? D.red + "40" : D.greenBorder}`,
                      borderRadius: 12, padding: "14px 10px", textAlign: "center",
                    }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: D.text }}>{t.label || `T${t.table_number}`}</div>
                      <div style={{ fontSize: 11, color: D.text2, marginBottom: 6 }}>{t.capacity}p</div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: isOcc ? D.red : D.green, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: isOcc ? 8 : 0 }}>
                        {isOcc ? "occupied" : "available"}
                      </div>
                      {t.party_name && <div style={{ fontSize: 11, color: D.text2, marginBottom: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.party_name}</div>}
                      {isOcc && (
                        <button
                          onClick={() => clearTable(t.id)}
                          disabled={clearingId === t.id}
                          style={{ padding: "5px 12px", borderRadius: 7, border: `1px solid ${D.red}40`, background: D.redBg, color: clearingId === t.id ? D.muted : D.red, fontSize: 11, fontWeight: 600, cursor: clearingId === t.id ? "not-allowed" : "pointer" }}>
                          {clearingId === t.id ? "…" : "Clear"}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Reservations tab */}
        {tab === "reservations" && (
          <div style={{ maxWidth: 700 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 14, color: D.text2 }}>{reservations.length} upcoming reservation{reservations.length !== 1 ? "s" : ""}</div>
              <button onClick={() => setShowReserv(true)}
                style={{ padding: "7px 16px", borderRadius: 8, border: `1px solid ${D.purpleBorder}`, background: D.purpleBg, color: D.purple, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                + Add Reservation
              </button>
            </div>

            {reservations.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: D.muted, fontSize: 14 }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📅</div>
                No upcoming reservations
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {reservations.map(p => {
                  const isExp = expandedId === p.id
                  const arrTime = p.arrival_time ? new Date(p.arrival_time) : null
                  return (
                    <div key={p.id} style={{ background: D.surface, border: `1px solid ${D.purpleBorder}`, borderRadius: 12, overflow: "hidden" }}>
                      <div onClick={() => setExpandedId(isExp ? null : p.id)} style={{ display: "flex", alignItems: "center", padding: "12px 14px", gap: 12, cursor: "pointer" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 15, fontWeight: 700, color: D.text }}>{p.name}</div>
                          <div style={{ fontSize: 12, color: D.text2, marginTop: 2 }}>
                            {p.party_size} guests
                            {arrTime && <span style={{ marginLeft: 10, color: D.purple }}>
                              {arrTime.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} at {arrTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                            </span>}
                            {p.phone && <span style={{ marginLeft: 10 }}>📱</span>}
                          </div>
                          {p.notes && <div style={{ fontSize: 11, color: D.muted, marginTop: 2, fontStyle: "italic" }}>{p.notes}</div>}
                        </div>
                        <span style={{ color: D.muted, fontSize: 16 }}>{isExp ? "▲" : "▼"}</span>
                      </div>
                      {isExp && (
                        <div style={{ display: "flex", gap: 8, padding: "0 14px 12px", borderTop: `1px solid ${D.border}`, paddingTop: 10 }}>
                          <button
                            onClick={() => seatParty(p.id)}
                            disabled={!!seatingId}
                            style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: seatingId === p.id ? D.muted : D.green, color: "#fff", fontSize: 13, fontWeight: 700, cursor: seatingId ? "not-allowed" : "pointer" }}>
                            {seatingId === p.id ? "Seating…" : "✓ Seat"}
                          </button>
                          <button onClick={() => removeParty(p.id, p.name)}
                            style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${D.red}40`, background: D.redBg, color: D.red, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
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
      </div>
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
