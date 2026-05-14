"use client"

/**
 * /client/[slug]/station — Full HOST station for any restaurant.
 *
 * DATA ISOLATION GUARANTEE:
 *   Every fetch uses `slug` from the URL params → restaurant_id from Railway.
 *   No session cookies, no RESTAURANT_CONFIG, no connection to any other client.
 *   Joe's Pizza sees only Joe's Pizza data. Walnut sees only Walnut data.
 */

import { useState, useEffect, useCallback, useRef, Suspense } from "react"
import { useParams } from "next/navigation"

const RAILWAY = "https://restaurant-brain-production.up.railway.app"

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:           "#080C10",
  panel:        "#0C1118",
  surface:      "rgba(255,255,255,0.04)",
  surface2:     "rgba(255,255,255,0.07)",
  border:       "rgba(255,255,255,0.09)",
  borderHi:     "rgba(255,255,255,0.16)",
  text:         "#FFFFFF",
  text2:        "rgba(255,255,255,0.60)",
  muted:        "rgba(255,255,255,0.30)",
  accent:       "#D9321C",
  green:        "#22C55E",
  greenBg:      "rgba(34,197,94,0.12)",
  greenBorder:  "rgba(34,197,94,0.30)",
  orange:       "#F59E0B",
  orangeBg:     "rgba(245,158,11,0.12)",
  orangeBorder: "rgba(245,158,11,0.30)",
  red:          "#EF4444",
  redBg:        "rgba(239,68,68,0.12)",
  redBorder:    "rgba(239,68,68,0.30)",
  purple:       "#A78BFA",
  purpleBg:     "rgba(167,139,250,0.12)",
  purpleBorder: "rgba(167,139,250,0.30)",
  yellow:       "#FBBF24",
  yellowBg:     "rgba(251,191,36,0.12)",
  yellowBorder: "rgba(251,191,36,0.30)",
  blue:         "#60A5FA",
  blueBg:       "rgba(96,165,250,0.12)",
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface RestaurantInfo {
  id:       string
  name:     string
  slug:     string
  adminPin: string
  logoUrl?: string
}

// Visual floor plan table (from config.floor_plan — wizard format)
interface FloorPos {
  id?:      string
  number:   number
  label?:   string
  capacity?: number
  shape:    string   // "rect" | "circle" | "square" | "booth" | "diamond"
  x:        number   // center_x as % of canvas width
  y:        number   // center_y as % of canvas height
  w:        number   // width  as % of canvas width
  h:        number   // height as % of canvas height
}

// Live table record (from GET /tables?restaurant_id=X)
interface LiveTable {
  id:           string
  table_number: number
  label?:       string
  capacity:     number
  status:       "available" | "occupied"
  party_name?:  string | null
}

interface QueueEntry {
  id:           string
  name:         string
  party_size:   number
  status:       "waiting" | "ready" | "seated" | "removed"
  quoted_wait:  number | null
  arrival_time: string | null
  phone:        string | null
  source:       string
  notes?:       string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(iso: string | null): string {
  if (!iso) return "—"
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (m < 1)  return "just now"
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}
function clock(): string {
  return new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
}
function sourceBadge(src: string) {
  if (src === "host")        return { label: "Host",        color: C.green,  bg: C.greenBg  }
  if (src === "analog")      return { label: "Walk-in",     color: C.orange, bg: C.orangeBg }
  if (src === "reservation") return { label: "Reservation", color: C.purple, bg: C.purpleBg }
  if (src === "nfc")         return { label: "NFC",         color: C.blue,   bg: C.blueBg   }
  if (src === "qr")          return { label: "QR",          color: C.blue,   bg: C.blueBg   }
  return { label: src, color: C.muted, bg: C.surface }
}

// ── PIN Gate ──────────────────────────────────────────────────────────────────
function PinGate({ name, onAuth, err }: { name: string; onAuth: (p: string) => void; err: boolean }) {
  const [digits, setDigits] = useState(["", "", "", ""])
  const refs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)]
  function onDigit(i: number, v: string) {
    const d = v.replace(/\D/g, "").slice(-1)
    const next = [...digits]; next[i] = d; setDigits(next)
    if (d && i < 3) refs[i + 1].current?.focus()
    if (d && i === 3 && next.every(x => x)) onAuth(next.join(""))
  }
  function onKey(i: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      const next = [...digits]; next[i - 1] = ""; setDigits(next); refs[i - 1].current?.focus()
    }
  }
  return (
    <div style={{ minHeight: "100dvh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: "0.3em", color: C.text, marginBottom: 4 }}>HOST</div>
        <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>Station</div>
        <div style={{ fontSize: 18, fontWeight: 600, color: C.text2, marginBottom: 36 }}>{name}</div>
        <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 14 }}>Admin PIN</div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 20 }}>
          {digits.map((d, i) => (
            <input key={i} ref={refs[i]} value={d} type="tel" inputMode="numeric" maxLength={1}
              onChange={e => onDigit(i, e.target.value)} onKeyDown={e => onKey(i, e)}
              onFocus={e => e.target.select()} autoFocus={i === 0}
              style={{ width: 56, height: 68, borderRadius: 12, textAlign: "center", fontSize: 28, fontWeight: 700,
                color: C.text, background: C.surface2, border: `2px solid ${err ? C.red : C.border}`,
                outline: "none", caretColor: "transparent" }} />
          ))}
        </div>
        {err && <div style={{ color: C.red, fontSize: 13, fontWeight: 600 }}>Incorrect PIN</div>}
        <p style={{ fontSize: 11, color: C.muted, marginTop: 28, maxWidth: 240, lineHeight: 1.6 }}>
          Set your Admin PIN in HOST Owner Console → Credentials
        </p>
      </div>
    </div>
  )
}

// ── Walk-in Modal ─────────────────────────────────────────────────────────────
function WalkInModal({ rid, tableNumber, onClose, onDone }: {
  rid: string; tableNumber?: number; onClose: () => void; onDone: () => void
}) {
  const [name,      setName]      = useState("")
  const [partySize, setPartySize] = useState(2)
  const [phone,     setPhone]     = useState("")
  const [notes,     setNotes]     = useState("")
  const [busy,      setBusy]      = useState(false)
  const [error,     setError]     = useState("")

  async function submit() {
    if (!name.trim()) { setError("Name required"); return }
    setBusy(true); setError("")
    try {
      const r = await fetch(`${RAILWAY}/queue/join`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), party_size: partySize,
          phone: phone.trim() || null, source: "analog",
          restaurant_id: rid, notes: notes.trim() || null }),
      })
      if (!r.ok) { const d = await r.json(); throw new Error(d.detail || "Failed") }
      onDone()
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Error") }
    finally { setBusy(false) }
  }

  const inp: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "11px 14px",
    borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface2,
    color: C.text, fontSize: 15, outline: "none" }
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: C.muted,
    textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6, display: "block" }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 400, display: "flex", alignItems: "center",
      justifyContent: "center", background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
      <div style={{ background: C.panel, border: `1px solid ${C.borderHi}`, borderRadius: 18,
        padding: 28, width: "100%", maxWidth: 420, fontFamily: "system-ui, sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>
            Walk-in{tableNumber != null ? ` — Table ${tableNumber}` : ""}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>
        {/* Party size */}
        <label style={lbl}>Party Size</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {[1,2,3,4,5,6,7,8].map(n => (
            <button key={n} onClick={() => setPartySize(n)}
              style={{ width: 44, height: 44, borderRadius: 10,
                border: `2px solid ${partySize === n ? C.accent : C.border}`,
                background: partySize === n ? C.accent + "20" : "transparent",
                color: partySize === n ? C.accent : C.text2,
                fontSize: 16, fontWeight: 700, cursor: "pointer" }}>{n}</button>
          ))}
        </div>
        <label style={lbl}>Name *</label>
        <input value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && submit()}
          placeholder="Guest name" style={{ ...inp, marginBottom: 12 }} autoFocus />
        <label style={lbl}>Phone <span style={{ fontWeight: 400, textTransform: "none", color: C.muted }}>— optional</span></label>
        <input value={phone} onChange={e => setPhone(e.target.value)} type="tel"
          placeholder="(555) 555-5555" style={{ ...inp, marginBottom: 12 }} />
        <label style={lbl}>Notes <span style={{ fontWeight: 400, textTransform: "none", color: C.muted }}>— optional</span></label>
        <input value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="e.g. Birthday, high chair" style={{ ...inp, marginBottom: 20 }} />
        {error && <div style={{ color: C.red, fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <button onClick={submit} disabled={busy}
          style={{ width: "100%", padding: "14px 0", borderRadius: 12, border: "none",
            background: busy ? C.muted : C.green, color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>
          {busy ? "Adding…" : "Add to Queue"}
        </button>
      </div>
    </div>
  )
}

// ── Table Action Modal (click a table) ───────────────────────────────────────
function TableModal({ table, queue, rid, onClose, onDone }: {
  table: LiveTable; queue: QueueEntry[]; rid: string
  onClose: () => void; onDone: () => void
}) {
  const [busy,      setBusy]      = useState(false)
  const [showAdd,   setShowAdd]   = useState(false)
  const waiting = queue.filter(q => q.status === "waiting" || q.status === "ready")

  async function seatFromQueue(entryId: string) {
    setBusy(true)
    await fetch(`${RAILWAY}/queue/${entryId}/seat-to-table/${table.id}`, { method: "POST" }).catch(() => {})
    onDone()
  }
  async function clearTable() {
    setBusy(true)
    await fetch(`${RAILWAY}/tables/${table.id}/clear`, { method: "POST" }).catch(() => {})
    onDone()
  }

  if (showAdd) return <WalkInModal rid={rid} tableNumber={table.table_number} onClose={onClose} onDone={onDone} />

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 400, display: "flex", alignItems: "center",
      justifyContent: "center", background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
      <div style={{ background: C.panel, border: `1px solid ${C.borderHi}`, borderRadius: 18,
        padding: 28, width: "100%", maxWidth: 420, fontFamily: "system-ui, sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>
              Table {table.label || table.table_number}
            </div>
            <div style={{ fontSize: 12, color: C.text2, marginTop: 2 }}>
              {table.capacity} seats · {table.status === "occupied" ? `Occupied${table.party_name ? ` — ${table.party_name}` : ""}` : "Available"}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>

        {table.status === "occupied" ? (
          <button onClick={clearTable} disabled={busy}
            style={{ width: "100%", padding: "14px 0", borderRadius: 12, border: `1px solid ${C.redBorder}`,
              background: C.redBg, color: C.red, fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 8 }}>
            {busy ? "Clearing…" : "✓ Clear Table"}
          </button>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
            {waiting.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
                  Seat from queue
                </div>
                {waiting.slice(0, 5).map(q => (
                  <button key={q.id} onClick={() => seatFromQueue(q.id)} disabled={busy}
                    style={{ padding: "12px 16px", borderRadius: 10, border: `1px solid ${C.border}`,
                      background: C.surface2, color: C.text, fontSize: 14, cursor: "pointer",
                      textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 600 }}>{q.name}</span>
                    <span style={{ color: C.text2, fontSize: 12 }}>Party of {q.party_size} · {timeAgo(q.arrival_time)}</span>
                  </button>
                ))}
                <div style={{ height: 1, background: C.border, margin: "4px 0" }} />
              </>
            )}
            <button onClick={() => setShowAdd(true)}
              style={{ padding: "13px 0", borderRadius: 12, border: "none",
                background: C.accent, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
              + Walk-in at This Table
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Visual Floor Map ──────────────────────────────────────────────────────────
function FloorMap({ positions, liveTables, onTableClick }: {
  positions:   FloorPos[]
  liveTables:  LiveTable[]
  onTableClick: (t: LiveTable | null, pos: FloorPos) => void
}) {
  // Build a lookup: table_number → live table record
  const liveByNumber: Record<number, LiveTable> = {}
  liveTables.forEach(t => { liveByNumber[t.table_number] = t })

  if (positions.length === 0) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        color: C.muted, fontSize: 14, textAlign: "center", padding: 40 }}>
        <div>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🗺</div>
          No floor plan configured.<br />Add one in Owner Console → Floor Map.
        </div>
      </div>
    )
  }

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden",
      background: "rgba(0,0,0,0.4)", borderRadius: 12, border: `1px solid ${C.border}` }}>
      {positions.map(pos => {
        const live    = liveByNumber[pos.number]
        const isOcc   = live?.status === "occupied"
        const label   = pos.label || String(pos.number)

        // Center-based percentage positioning (wizard format)
        const left   = `${pos.x - pos.w / 2}%`
        const top    = `${pos.y - pos.h / 2}%`
        const width  = `${pos.w}%`
        const height = `${pos.h}%`

        const shape = pos.shape === "circle" || pos.shape === "round" ? "50%"
          : pos.shape === "diamond" ? "0"
          : pos.shape === "booth"   ? "6px 6px 0 0"
          : "8px"

        const clipPath = pos.shape === "diamond"
          ? "polygon(50% 0%,100% 50%,50% 100%,0% 50%)" : undefined

        return (
          <button key={pos.number} onClick={() => onTableClick(live ?? null, pos)}
            title={isOcc ? `Table ${label} — ${live?.party_name || "Occupied"}` : `Table ${label} — Available`}
            style={{
              position: "absolute", left, top, width, height,
              border: `2px solid ${isOcc ? C.red + "80" : C.green + "70"}`,
              background: isOcc ? C.redBg : C.greenBg,
              borderRadius: shape, clipPath,
              cursor: "pointer",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              transition: "filter 0.15s",
              boxSizing: "border-box", padding: 2,
            }}>
            <span style={{ fontSize: "clamp(8px,1.4vw,13px)", fontWeight: 700,
              color: C.text, lineHeight: 1, textAlign: "center" }}>
              {label}
            </span>
            {isOcc && live?.party_name && (
              <span style={{ fontSize: "clamp(6px,0.9vw,9px)", color: C.text2,
                lineHeight: 1, marginTop: 2, overflow: "hidden",
                maxWidth: "90%", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {live.party_name}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ── Queue Card ────────────────────────────────────────────────────────────────
function QueueCard({ entry, idx, onSeat, onReady, onRemove, busy }: {
  entry:    QueueEntry
  idx:      number
  onSeat:   () => void
  onReady:  () => void
  onRemove: () => void
  busy:     boolean
}) {
  const [exp, setExp] = useState(false)
  const isReady = entry.status === "ready"
  const sb      = sourceBadge(entry.source)
  return (
    <div style={{
      background: isReady ? "rgba(251,191,36,0.06)" : C.surface,
      border: `1px solid ${isReady ? C.yellowBorder : C.border}`,
      borderRadius: 12, overflow: "hidden",
    }}>
      <div onClick={() => setExp(e => !e)}
        style={{ display: "flex", alignItems: "center", padding: "12px 14px", gap: 10, cursor: "pointer" }}>
        {/* Position badge */}
        <div style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
          background: isReady ? C.yellowBg : C.surface2,
          border: `1px solid ${isReady ? C.yellowBorder : C.border}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 700, color: isReady ? C.yellow : C.muted }}>
          {idx + 1}
        </div>
        {/* Name + meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.text,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {entry.name}
            </span>
            {isReady && <span style={{ fontSize: 9, fontWeight: 800, color: C.yellow, letterSpacing: "0.06em" }}>READY</span>}
          </div>
          <div style={{ fontSize: 11, color: C.text2, marginTop: 2, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span>{entry.party_size} {entry.party_size === 1 ? "guest" : "guests"}</span>
            <span style={{ color: C.muted }}>·</span>
            <span>{timeAgo(entry.arrival_time)}</span>
            {entry.quoted_wait && <><span style={{ color: C.muted }}>·</span><span>~{entry.quoted_wait}m</span></>}
            {entry.phone && <><span style={{ color: C.muted }}>·</span><span>📱</span></>}
          </div>
          {entry.notes && <div style={{ fontSize: 11, color: C.muted, marginTop: 2, fontStyle: "italic" }}>{entry.notes}</div>}
        </div>
        {/* Source badge */}
        <span style={{ fontSize: 9, fontWeight: 700, borderRadius: 20, padding: "3px 8px",
          color: sb.color, background: sb.bg, border: `1px solid ${sb.color}40`,
          whiteSpace: "nowrap", flexShrink: 0 }}>
          {sb.label}
        </span>
        <span style={{ color: C.muted, fontSize: 14, flexShrink: 0 }}>{exp ? "▲" : "▼"}</span>
      </div>
      {exp && (
        <div style={{ display: "flex", gap: 8, padding: "0 14px 12px", borderTop: `1px solid ${C.border}`, paddingTop: 10, flexWrap: "wrap" }}>
          {entry.status === "waiting" && (
            <button onClick={onReady} disabled={busy}
              style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${C.yellowBorder}`,
                background: C.yellowBg, color: C.yellow, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              📣 Mark Ready
            </button>
          )}
          <button onClick={onSeat} disabled={busy}
            style={{ padding: "8px 16px", borderRadius: 8, border: "none",
              background: busy ? C.muted : C.green, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            ✓ Seat Party
          </button>
          <button onClick={onRemove} disabled={busy}
            style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${C.redBorder}`,
              background: C.redBg, color: C.red, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            ✕ Remove
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main Station ──────────────────────────────────────────────────────────────
function StationInner() {
  const params = useParams()
  const slug   = typeof params.slug === "string" ? params.slug : ""

  // Restaurant info (loaded from Railway by slug — this restaurant ONLY)
  const [info,       setInfo]       = useState<RestaurantInfo | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [authed,     setAuthed]     = useState(false)
  const [pinErr,     setPinErr]     = useState(false)

  // Floor plan from restaurant config (visual layout, wizard format)
  const [positions,  setPositions]  = useState<FloorPos[]>([])

  // Live data — all scoped to this restaurant's ID only
  const [queue,      setQueue]      = useState<QueueEntry[]>([])
  const [tables,     setTables]     = useState<LiveTable[]>([])
  const [lastUpd,    setLastUpd]    = useState<Date | null>(null)
  const [syncing,    setSyncing]    = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  // UI
  const [clockStr,   setClockStr]   = useState(clock())
  const [showAdd,    setShowAdd]    = useState(false)
  const [tableModal, setTableModal] = useState<{ pos: FloorPos; live: LiveTable | null } | null>(null)
  const [flash,      setFlash]      = useState<{ ok: boolean; msg: string } | null>(null)
  const [busyId,     setBusyId]     = useState<string | null>(null)

  // Clock
  useEffect(() => {
    const iv = setInterval(() => setClockStr(clock()), 30_000)
    return () => clearInterval(iv)
  }, [])

  // Flash helper
  function showFlash(ok: boolean, msg: string) {
    setFlash({ ok, msg }); setTimeout(() => setFlash(null), 2500)
  }

  // ── Load restaurant info by slug ──────────────────────────────────────────
  // Uses ONLY the slug from the URL to identify this restaurant.
  // No session cookie, no shared config — completely isolated.
  useEffect(() => {
    if (!slug) return
    fetch(`${RAILWAY}/client/${encodeURIComponent(slug)}/config`, { cache: "no-store" })
      .then(r => r.ok ? r.json() : Promise.reject("not found"))
      .then(d => {
        const gc = (d.guest_config || {}) as Record<string, unknown>
        setInfo({
          id:       String(d.restaurant_id || ""),
          name:     String(gc.restaurantName || d.name || slug),
          slug,
          adminPin: typeof gc.adminPin === "string" ? gc.adminPin : "",
          logoUrl:  typeof gc.logoUrl  === "string" ? gc.logoUrl  : undefined,
        })
        // Load visual floor plan positions (wizard format: center-based %)
        const fp = d.floor_plan
        if (fp && typeof fp === "object" && !Array.isArray(fp)) {
          const tables = (fp as Record<string, unknown>).tables
          if (Array.isArray(tables)) setPositions(tables as FloorPos[])
        }
        // Restore station auth from sessionStorage
        if (sessionStorage.getItem(`station_auth_${slug}`) === "1") setAuthed(true)
      })
      .catch(() => setInfo({ id: "", name: slug, slug, adminPin: "" }))
      .finally(() => setLoading(false))
  }, [slug])

  // ── Load live data (queue + tables) ──────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!info?.id || !authed) return
    setSyncing(true)
    try {
      const [qr, tr] = await Promise.all([
        fetch(`${RAILWAY}/queue?restaurant_id=${info.id}`,  { cache: "no-store" }),
        fetch(`${RAILWAY}/tables?restaurant_id=${info.id}`, { cache: "no-store" }),
      ])
      if (qr.ok) setQueue(await qr.json())
      if (tr.ok) setTables(await tr.json())
      setLastUpd(new Date())
    } catch { /* network hiccup — keep existing data */ }
    finally { setSyncing(false) }
  }, [info?.id, authed])

  useEffect(() => {
    loadData()
    const iv = setInterval(loadData, 20_000)
    return () => clearInterval(iv)
  }, [loadData, refreshKey])

  // ── Auth ──────────────────────────────────────────────────────────────────
  function tryPin(pin: string) {
    if (!info) return
    const correct = info.adminPin
    if (!correct || pin === correct) {
      sessionStorage.setItem(`station_auth_${slug}`, "1")
      setAuthed(true); setPinErr(false)
    } else {
      setPinErr(true); setTimeout(() => setPinErr(false), 1500)
    }
  }

  // ── Actions ───────────────────────────────────────────────────────────────
  async function seatParty(id: string) {
    if (busyId) return; setBusyId(id)
    setQueue(prev => prev.map(q => q.id === id ? { ...q, status: "seated" as const } : q))
    try {
      const ok = (await fetch(`${RAILWAY}/queue/${id}/seat`, { method: "POST" })).ok
      showFlash(ok, ok ? "Party seated ✓" : "Seat failed")
    } catch { showFlash(false, "Network error") }
    finally { setBusyId(null); setRefreshKey(k => k + 1) }
  }

  async function markReady(id: string) {
    const ok = (await fetch(`${RAILWAY}/queue/${id}/ready`, { method: "POST" })).ok
    showFlash(ok, ok ? "Marked ready — SMS sent if phone on file" : "Failed")
    setRefreshKey(k => k + 1)
  }

  async function removeParty(id: string, name: string) {
    if (!confirm(`Remove ${name} from the queue?`)) return
    setQueue(prev => prev.filter(q => q.id !== id))
    try { await fetch(`${RAILWAY}/queue/${id}/remove`, { method: "POST" }) }
    catch { /* best effort */ }
    finally { setRefreshKey(k => k + 1) }
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const active      = queue.filter(q => q.status === "waiting" || q.status === "ready")
  const reservations = queue.filter(q => q.source === "reservation" && (q.status === "waiting" || q.status === "ready"))
  const seatedToday = queue.filter(q => q.status === "seated").length
  const openTables  = tables.filter(t => t.status === "available").length

  // ── Loading / PIN / Render ────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: "100dvh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: C.muted, fontSize: 14, fontFamily: "system-ui, sans-serif" }}>Loading…</div>
      </div>
    )
  }
  if (!authed) return <PinGate name={info?.name || slug} onAuth={tryPin} err={pinErr} />

  const SIDEBAR = 340  // px — queue panel width

  return (
    <div style={{ minHeight: "100dvh", background: C.bg, fontFamily: "system-ui, sans-serif",
      color: C.text, display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Flash */}
      {flash && (
        <div style={{ position: "fixed", top: 14, left: "50%", transform: "translateX(-50%)", zIndex: 500,
          background: flash.ok ? C.greenBg : C.redBg,
          border: `1px solid ${flash.ok ? C.greenBorder : C.redBorder}`,
          borderRadius: 10, padding: "10px 22px", fontSize: 14, fontWeight: 600,
          color: flash.ok ? C.green : C.red, whiteSpace: "nowrap" }}>
          {flash.msg}
        </div>
      )}

      {/* Modals */}
      {showAdd && info && (
        <WalkInModal rid={info.id} onClose={() => setShowAdd(false)} onDone={() => { setShowAdd(false); setRefreshKey(k => k+1); showFlash(true, "Walk-in added ✓") }} />
      )}
      {tableModal && info && (
        <TableModal
          table={tableModal.live ?? { id: "", table_number: tableModal.pos.number, label: tableModal.pos.label,
            capacity: tableModal.pos.capacity || 2, status: "available", party_name: null }}
          queue={active} rid={info.id}
          onClose={() => setTableModal(null)}
          onDone={() => { setTableModal(null); setRefreshKey(k => k + 1); showFlash(true, "Done ✓") }}
        />
      )}

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ height: 52, padding: "0 18px", borderBottom: `1px solid ${C.border}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexShrink: 0, background: C.panel }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 16, fontWeight: 900, letterSpacing: "0.28em", color: C.text }}>HOST</span>
          <div style={{ width: 1, height: 18, background: C.border }} />
          {info?.logoUrl && (
            <img src={info.logoUrl} alt="" style={{ height: 26, width: "auto", objectFit: "contain", borderRadius: 4 }} />
          )}
          <span style={{ fontSize: 15, fontWeight: 600, color: C.text2 }}>{info?.name}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, color: C.muted, fontVariantNumeric: "tabular-nums" }}>{clockStr}</span>
          {lastUpd && <span style={{ fontSize: 11, color: C.muted }}>{lastUpd.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>}
          <button onClick={() => setRefreshKey(k => k + 1)} disabled={syncing}
            style={{ padding: "5px 12px", borderRadius: 7, border: `1px solid ${C.border}`,
              background: "transparent", color: C.text2, fontSize: 13, cursor: "pointer" }}>
            {syncing ? "…" : "↻"}
          </button>
          <button onClick={() => { sessionStorage.removeItem(`station_auth_${slug}`); setAuthed(false) }}
            style={{ padding: "5px 12px", borderRadius: 7, border: `1px solid ${C.border}`,
              background: C.surface, color: C.text2, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            ⚙ Admin
          </button>
        </div>
      </div>

      {/* ── Stat bar ────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 10, padding: "10px 18px",
        borderBottom: `1px solid ${C.border}`, flexShrink: 0, background: C.panel,
        alignItems: "center" }}>
        {[
          { label: "In Queue",     value: active.length,        color: active.length > 0 ? C.orange : C.green },
          { label: "Tables Open",  value: `${openTables}/${tables.length}`, color: openTables > 0 ? C.green : C.red },
          { label: "Reservations", value: reservations.length,  color: reservations.length > 0 ? C.purple : C.muted },
          { label: "Seated Today", value: seatedToday,          color: C.blue },
        ].map(s => (
          <div key={s.label} style={{ background: C.surface2, border: `1px solid ${C.border}`,
            borderRadius: 10, padding: "8px 14px", flexShrink: 0 }}>
            <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 2 }}>{s.label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
          </div>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button onClick={() => setShowAdd(true)}
            style={{ padding: "9px 18px", borderRadius: 10, border: "none",
              background: C.accent, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            + Walk-in
          </button>
        </div>
      </div>

      {/* ── Main area: floor map (left) + queue (right) ──────────────── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* Floor map panel */}
        <div style={{ flex: 1, padding: 16, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase",
            letterSpacing: "0.1em", marginBottom: 10 }}>
            Floor Plan
            {tables.length > 0 && (
              <span style={{ marginLeft: 10, color: C.text2, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                {openTables} open · {tables.length - openTables} occupied
              </span>
            )}
          </div>
          {/* Floor map — fills available space */}
          <div style={{ flex: 1, position: "relative" }}>
            <FloorMap
              positions={positions}
              liveTables={tables}
              onTableClick={(live, pos) => {
                // If we have a live table record, use it; otherwise create a stub from floor plan pos
                const liveRecord = live ?? tables.find(t => t.table_number === pos.number) ?? null
                setTableModal({ pos, live: liveRecord })
              }}
            />
          </div>

          {/* Table grid legend (below map) */}
          {tables.length > 0 && positions.length === 0 && (
            <div style={{ marginTop: 16, display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 8 }}>
              {tables.map(t => {
                const isOcc = t.status === "occupied"
                return (
                  <button key={t.id} onClick={() => setTableModal({ pos: { number: t.table_number, label: t.label, shape: "rect", x: 0, y: 0, w: 0, h: 0 }, live: t })}
                    style={{ background: isOcc ? C.redBg : C.greenBg, border: `1px solid ${isOcc ? C.redBorder : C.greenBorder}`,
                      borderRadius: 10, padding: "12px 8px", textAlign: "center", cursor: "pointer" }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{t.label || `T${t.table_number}`}</div>
                    <div style={{ fontSize: 10, color: isOcc ? C.red : C.green, fontWeight: 700, textTransform: "uppercase", marginTop: 2 }}>
                      {isOcc ? "occupied" : "open"}
                    </div>
                    {t.party_name && <div style={{ fontSize: 10, color: C.text2, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.party_name}</div>}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Queue panel */}
        <div style={{ width: SIDEBAR, flexShrink: 0, borderLeft: `1px solid ${C.border}`,
          display: "flex", flexDirection: "column", overflow: "hidden", background: C.panel }}>
          <div style={{ padding: "14px 16px 10px", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
              Queue {active.length > 0 ? `(${active.length} waiting)` : "(empty)"}
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
            {active.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 0", color: C.muted, fontSize: 14 }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>🎉</div>
                Queue is empty
              </div>
            ) : active.map((q, i) => (
              <QueueCard key={q.id} entry={q} idx={i}
                onSeat={() => seatParty(q.id)}
                onReady={() => markReady(q.id)}
                onRemove={() => removeParty(q.id, q.name)}
                busy={busyId === q.id}
              />
            ))}
          </div>
          {/* Reservations section */}
          {reservations.length > 0 && (
            <div style={{ borderTop: `1px solid ${C.border}`, padding: "12px", flexShrink: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.purple, textTransform: "uppercase",
                letterSpacing: "0.08em", marginBottom: 8 }}>
                Reservations ({reservations.length})
              </div>
              {reservations.map(r => {
                const arr = r.arrival_time ? new Date(r.arrival_time) : null
                return (
                  <div key={r.id} style={{ padding: "8px 10px", borderRadius: 8,
                    background: C.purpleBg, border: `1px solid ${C.purpleBorder}`,
                    marginBottom: 6, fontSize: 13 }}>
                    <div style={{ fontWeight: 600, color: C.text }}>{r.name}</div>
                    <div style={{ color: C.text2, fontSize: 11, marginTop: 2 }}>
                      Party of {r.party_size}
                      {arr && <span style={{ color: C.purple, marginLeft: 8 }}>
                        {arr.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                      </span>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
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
