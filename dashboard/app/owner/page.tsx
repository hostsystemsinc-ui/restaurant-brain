"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"

// ── Design tokens ──────────────────────────────────────────────────────────────
const D = {
  bg:           "#080C10",
  surface:      "rgba(255,255,255,0.035)",
  surfaceHover: "rgba(255,255,255,0.055)",
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
  yellow:       "#FBBF24",
}

const API       = "https://restaurant-brain-production.up.railway.app"
const DEMO_RID  = "dec0cafe-0000-4000-8000-000000000001"
const PASS      = "hostowner2025"

// ── Types ──────────────────────────────────────────────────────────────────────
type SvcStatus = "up" | "degraded" | "down" | "checking"

interface Svc {
  status:  SvcStatus
  detail:  string
  latency?: number
}

interface RestLive {
  queueNow:       number
  seatedToday:    number
  avgWait:        number
  coversThisWeek: number
  loading:        boolean
  error:          boolean
}

interface DemoReq {
  id:          string
  name:        string
  restaurant:  string
  email:       string
  phone:       string
  city:        string
  type:        string
  submittedAt: string
}

// ── Restaurants (real only) ────────────────────────────────────────────────────
const RESTS = [
  { id: "walters", name: "Walter's 303",   city: "Denver, CO", rid: null,      dashUrl: "/station",      label: "Active" },
  { id: "demo",    name: "Demo Restaurant", city: "Denver, CO", rid: DEMO_RID,  dashUrl: "/demo/station", label: "Demo"   },
]

// ── Helpers ────────────────────────────────────────────────────────────────────
function svcDot(s: SvcStatus) {
  if (s === "up")       return D.green
  if (s === "degraded") return D.yellow
  if (s === "down")     return D.red
  return D.muted
}
function svcLabel(s: SvcStatus) {
  if (s === "up")       return "Operational"
  if (s === "degraded") return "Degraded"
  if (s === "down")     return "Down"
  return "Checking…"
}
function fmtTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " · " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
}
function fmtRefresh(d: Date | null) {
  if (!d) return "Never"
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" })
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function OwnerPage() {
  const router = useRouter()
  const [authed,      setAuthed]      = useState(false)
  const [passInput,   setPassInput]   = useState("")
  const [passErr,     setPassErr]     = useState(false)
  const [showPass,    setShowPass]    = useState(false)

  // Service states
  const [railway,    setRailway]    = useState<Svc>({ status: "checking", detail: "" })
  const [github,     setGithub]     = useState<Svc>({ status: "checking", detail: "" })
  const [textbelt,   setTextbelt]   = useState<Svc>({ status: "checking", detail: "" })
  const [db,         setDb]         = useState<Svc>({ status: "checking", detail: "" })

  // Per-restaurant live data
  const [liveData, setLiveData] = useState<Record<string, RestLive>>({
    walters: { queueNow: 0, seatedToday: 0, avgWait: 0, coversThisWeek: 0, loading: true, error: false },
    demo:    { queueNow: 0, seatedToday: 0, avgWait: 0, coversThisWeek: 0, loading: true, error: false },
  })

  // Demo requests — seeded from localStorage cache so they survive backend restarts
  const [demoReqs, setDemoReqs] = useState<DemoReq[]>(() => {
    try {
      const cached = localStorage.getItem("host_owner_demo_reqs")
      return cached ? JSON.parse(cached) : []
    } catch { return [] }
  })
  const [demoLoading,   setDemoLoading]   = useState(false)
  const [lastRefresh,   setLastRefresh]   = useState<Date | null>(null)
  const [refreshing,    setRefreshing]    = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem("host_owner_authed") === "1") setAuthed(true)
  }, [])

  // ── Fetch all data ────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setRefreshing(true)

    // --- Service checks (parallel) ---
    const t0 = Date.now()
    const [railwayResult, githubResult, textbeltResult] = await Promise.allSettled([
      // Railway + DB
      (async () => {
        const t = Date.now()
        const r = await fetch(`${API}/queue?restaurant_id=${DEMO_RID}`, { cache: "no-store" })
        const ms = Date.now() - t
        return { ok: r.ok, ms }
      })(),
      // GitHub status
      (async () => {
        const r = await fetch("https://www.githubstatus.com/api/v2/status.json", { cache: "no-store" })
        return await r.json()
      })(),
      // Textbelt quota (server-side proxy)
      (async () => {
        const r = await fetch("/api/textbelt", { cache: "no-store" })
        return await r.json()
      })(),
    ])

    // Railway
    if (railwayResult.status === "fulfilled") {
      const { ok, ms } = railwayResult.value
      setRailway({ status: ok ? (ms > 3000 ? "degraded" : "up") : "down", detail: ok ? `${ms}ms response` : "No response", latency: ms })
      setDb({ status: ok ? "up" : "down", detail: ok ? "Connected" : "Unreachable" })
    } else {
      setRailway({ status: "down", detail: "Request failed" })
      setDb({ status: "down", detail: "Unreachable" })
    }

    // GitHub
    if (githubResult.status === "fulfilled") {
      const d = githubResult.value
      const ind: string = d?.status?.indicator ?? "none"
      setGithub({ status: ind === "none" ? "up" : ind === "minor" ? "degraded" : "down", detail: d?.status?.description ?? "" })
    } else {
      setGithub({ status: "down", detail: "Status unavailable" })
    }

    // Textbelt
    if (textbeltResult.status === "fulfilled") {
      const d = textbeltResult.value
      if (d.error && d.quotaRemaining === null && d.error === "TEXTBELT_KEY not configured") {
        setTextbelt({ status: "degraded", detail: "API key not set in environment" })
      } else if (typeof d.quotaRemaining === "number") {
        const quota = d.quotaRemaining as number
        setTextbelt({
          status: quota > 0 ? "up" : "down",
          detail: `${quota.toLocaleString()} texts remaining`,
        })
      } else {
        setTextbelt({ status: "degraded", detail: "Awaiting whitelist approval" })
      }
    } else {
      setTextbelt({ status: "down", detail: "Quota check failed" })
    }

    void t0 // suppress lint

    // --- Restaurant live data (parallel) ---
    await Promise.all(RESTS.map(async (rest) => {
      setLiveData(prev => ({ ...prev, [rest.id]: { ...prev[rest.id], loading: true, error: false } }))
      try {
        const ridParam = rest.rid ? `?restaurant_id=${rest.rid}` : ""
        const [insRes, qRes] = await Promise.all([
          fetch(`${API}/insights${ridParam}`, { cache: "no-store" }),
          fetch(`${API}/queue${ridParam}`,    { cache: "no-store" }),
        ])
        const ins = insRes.ok ? await insRes.json() : null
        const q   = qRes.ok  ? await qRes.json()   : []

        setLiveData(prev => ({
          ...prev,
          [rest.id]: {
            queueNow:       Array.isArray(q) ? q.filter((e: { status: string }) => ["waiting","ready"].includes(e.status)).length : 0,
            seatedToday:    ins?.parties_seated_today ?? 0,
            avgWait:        Math.round(ins?.avg_wait_estimate ?? 0),
            coversThisWeek: ins?.covers_this_week ?? 0,
            loading:        false,
            error:          false,
          }
        }))
      } catch {
        setLiveData(prev => ({ ...prev, [rest.id]: { ...prev[rest.id], loading: false, error: true } }))
      }
    }))

    // --- Demo requests — merge with localStorage cache so entries survive backend restarts ---
    setDemoLoading(true)
    try {
      const r = await fetch(`/api/demo?secret=${PASS}`, { cache: "no-store" })
      if (r.ok) {
        const fresh: DemoReq[] = await r.json()
        setDemoReqs(prev => {
          // Merge: union of cached + fresh, deduped by id, sorted newest first
          const map = new Map<string, DemoReq>()
          for (const req of prev)   map.set(req.id, req)
          for (const req of fresh)  map.set(req.id, req)
          const merged = Array.from(map.values()).sort(
            (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
          )
          try { localStorage.setItem("host_owner_demo_reqs", JSON.stringify(merged)) } catch {}
          return merged
        })
      }
    } catch { /* ignore */ }
    setDemoLoading(false)

    setLastRefresh(new Date())
    setRefreshing(false)
  }, [])

  useEffect(() => {
    if (authed) fetchAll()
    // Re-poll services every 5 min
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed])

  useEffect(() => {
    if (!authed) return
    const t = setInterval(fetchAll, 5 * 60_000)
    return () => clearInterval(t)
  }, [authed, fetchAll])

  function tryLogin() {
    if (passInput.trim() === PASS) {
      sessionStorage.setItem("host_owner_authed", "1")
      setAuthed(true); setPassErr(false)
    } else { setPassErr(true) }
  }
  function logout() {
    sessionStorage.removeItem("host_owner_authed")
    setAuthed(false); setPassInput("")
    router.push("/")
  }

  const font = "'Inter', system-ui, -apple-system, sans-serif"

  // ── LOGIN GATE ────────────────────────────────────────────────────────────────
  if (!authed) return (
    <div style={{
      minHeight: "100vh", background: D.bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: font, color: D.text,
    }}>
      <div style={{
        width: 380, maxWidth: "92vw",
        background: D.surface,
        border: `1px solid ${D.border}`,
        borderRadius: 10,
        padding: "40px 36px",
      }}>
        {/* Wordmark */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1 }}>HOST</div>
          <div style={{ fontSize: 10, fontWeight: 600, color: D.muted, letterSpacing: "0.2em", textTransform: "uppercase", marginTop: 8 }}>
            Owner Console
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: D.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
            Password
          </div>
          <div style={{ position: "relative" }}>
            <input
              type={showPass ? "text" : "password"}
              value={passInput}
              onChange={e => { setPassInput(e.target.value); setPassErr(false) }}
              onKeyDown={e => e.key === "Enter" && tryLogin()}
              placeholder="Enter password…"
              autoFocus
              style={{
                width: "100%", boxSizing: "border-box",
                padding: "11px 42px 11px 14px",
                background: "rgba(255,255,255,0.05)",
                border: `1px solid ${passErr ? "rgba(239,68,68,0.5)" : D.border}`,
                borderRadius: 8, outline: "none",
                color: D.text, fontSize: 14, fontFamily: "monospace",
              }}
            />
            <button
              onClick={() => setShowPass(v => !v)}
              style={{
                position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer", padding: 0,
                color: D.muted, fontSize: 11, lineHeight: 1,
              }}
            >
              {showPass ? "HIDE" : "SHOW"}
            </button>
          </div>
          {passErr && (
            <div style={{ fontSize: 12, color: D.red, marginTop: 6 }}>Incorrect password.</div>
          )}
        </div>

        <button
          onClick={tryLogin}
          style={{
            width: "100%", padding: "12px", borderRadius: 8,
            background: D.accent, border: "none", color: "#fff",
            fontSize: 13, fontWeight: 700, cursor: "pointer", marginTop: 8,
          }}
        >
          Sign In
        </button>

        <div style={{ textAlign: "center", marginTop: 20 }}>
          <a href="/" style={{ fontSize: 12, color: D.muted, textDecoration: "none" }}>← Back to HOST</a>
        </div>
      </div>
    </div>
  )

  // ── DASHBOARD ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: D.bg, fontFamily: font, color: D.text }}>

      {/* ── Nav ── */}
      <div style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(8,12,16,0.95)",
        backdropFilter: "blur(16px)",
        borderBottom: `1px solid ${D.border}`,
        height: 56, padding: "0 28px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        {/* Left: wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.04em" }}>HOST</div>
          <div style={{ width: 1, height: 18, background: D.border }} />
          <div style={{ fontSize: 12, fontWeight: 500, color: D.muted, letterSpacing: "0.06em" }}>Owner Console</div>
        </div>

        {/* Right: last refresh + buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontSize: 11, color: D.muted }}>
            Refreshed {fmtRefresh(lastRefresh)}
          </div>
          <button
            onClick={fetchAll}
            disabled={refreshing}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 14px", borderRadius: 7,
              background: D.surface, border: `1px solid ${D.border}`,
              color: D.text2, fontSize: 12, fontWeight: 500,
              cursor: refreshing ? "not-allowed" : "pointer", opacity: refreshing ? 0.5 : 1,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: refreshing ? "spin 1s linear infinite" : "none" }}>
              <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
            </svg>
            Refresh
          </button>
          <button
            onClick={logout}
            style={{
              padding: "7px 14px", borderRadius: 7,
              background: "none", border: `1px solid ${D.border}`,
              color: D.muted, fontSize: 12, fontWeight: 500, cursor: "pointer",
            }}
          >
            Sign Out
          </button>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── Main content ── */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 28px 60px" }}>

        {/* ── Section: Service Status ── */}
        <SectionLabel>Service Status</SectionLabel>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
          marginBottom: 36,
        }}>
          <SvcCard name="HOST API (Railway)" svc={railway} icon={
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
          } extra={railway.latency != null ? `${railway.latency}ms` : undefined} />

          <SvcCard name="GitHub" svc={github} icon={
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>
          } />

          <SvcCard name="Textbelt SMS" svc={textbelt} icon={
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          } />

          <SvcCard name="Backend DB" svc={db} icon={
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
          } />
        </div>

        {/* ── Section: Restaurants ── */}
        <SectionLabel>Restaurants</SectionLabel>
        <div style={{
          border: `1px solid ${D.border}`,
          borderRadius: 10,
          overflow: "hidden",
          marginBottom: 36,
        }}>
          {/* Table header */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 90px 90px 100px 120px 140px",
            padding: "11px 20px",
            background: D.surface,
            borderBottom: `1px solid ${D.border}`,
          }}>
            {["Restaurant","Status","In Queue","Seated Today","Avg Wait",""].map((h, i) => (
              <div key={i} style={{ fontSize: 11, fontWeight: 600, color: D.muted, letterSpacing: "0.08em", textTransform: "uppercase", textAlign: i >= 2 ? "center" : "left" }}>
                {h}
              </div>
            ))}
          </div>

          {RESTS.map((rest, idx) => {
            const live = liveData[rest.id]
            return (
              <div
                key={rest.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 90px 90px 100px 120px 140px",
                  padding: "16px 20px",
                  borderBottom: idx < RESTS.length - 1 ? `1px solid ${D.border}` : "none",
                  alignItems: "center",
                  background: "transparent",
                  transition: "background 0.12s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = D.surfaceHover)}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                {/* Name + city */}
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: D.text }}>{rest.name}</div>
                  <div style={{ fontSize: 12, color: D.muted, marginTop: 2 }}>{rest.city}</div>
                </div>

                {/* Status */}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{
                    width: 7, height: 7, borderRadius: "50%",
                    background: rest.label === "Active" ? D.green : D.orange,
                    flexShrink: 0,
                  }} />
                  <span style={{ fontSize: 12, color: rest.label === "Active" ? D.green : D.orange, fontWeight: 500 }}>
                    {rest.label}
                  </span>
                </div>

                {/* In Queue */}
                <LiveNum live={live} value={live.queueNow} />

                {/* Seated Today */}
                <LiveNum live={live} value={live.seatedToday} />

                {/* Avg Wait */}
                <div style={{ textAlign: "center" }}>
                  {live.loading ? (
                    <span style={{ fontSize: 13, color: D.muted }}>—</span>
                  ) : live.error ? (
                    <span style={{ fontSize: 13, color: D.red }}>Error</span>
                  ) : (
                    <span style={{ fontSize: 14, fontWeight: 600, color: live.avgWait > 0 ? D.text : D.muted }}>
                      {live.avgWait > 0 ? `${live.avgWait}m` : "—"}
                    </span>
                  )}
                </div>

                {/* Dashboard link */}
                <div style={{ textAlign: "right" }}>
                  <a
                    href={rest.dashUrl}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      fontSize: 12, fontWeight: 600, color: D.text2,
                      textDecoration: "none",
                      padding: "7px 12px", borderRadius: 7,
                      border: `1px solid ${D.border}`,
                      background: D.surface,
                      transition: "border-color 0.12s, color 0.12s",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = D.borderStrong; (e.currentTarget as HTMLElement).style.color = D.text }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = D.border; (e.currentTarget as HTMLElement).style.color = D.text2 }}
                  >
                    Open Dashboard
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M7 17L17 7"/><path d="M7 7h10v10"/></svg>
                  </a>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Section: Demo Requests ── */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: D.muted, letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Demo Requests
          </div>
          {demoReqs.length > 0 && (
            <div style={{
              fontSize: 11, fontWeight: 700, color: D.text,
              background: D.accent, borderRadius: 100,
              padding: "2px 8px", lineHeight: 1.5,
            }}>
              {demoReqs.length}
            </div>
          )}
        </div>

        {demoLoading ? (
          <div style={{ fontSize: 13, color: D.muted, padding: "24px 0" }}>Loading…</div>
        ) : demoReqs.length === 0 ? (
          <div style={{
            border: `1px solid ${D.border}`, borderRadius: 10,
            padding: "32px 20px", textAlign: "center",
            color: D.muted, fontSize: 13,
          }}>
            No demo requests yet. Submissions from hostplatform.net will appear here.
          </div>
        ) : (
          <div style={{ border: `1px solid ${D.border}`, borderRadius: 10, overflow: "hidden" }}>
            {/* Header */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1.2fr 100px 100px 100px 170px",
              padding: "11px 20px",
              background: D.surface,
              borderBottom: `1px solid ${D.border}`,
            }}>
              {["Name","Restaurant","Email","Phone","City","Type","Submitted"].map((h, i) => (
                <div key={i} style={{ fontSize: 11, fontWeight: 600, color: D.muted, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  {h}
                </div>
              ))}
            </div>

            {demoReqs.map((req, idx) => (
              <div
                key={req.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1.2fr 100px 100px 100px 170px",
                  padding: "14px 20px",
                  borderBottom: idx < demoReqs.length - 1 ? `1px solid ${D.border}` : "none",
                  alignItems: "center",
                  background: "transparent",
                  transition: "background 0.12s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = D.surfaceHover)}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <Cell>{req.name}</Cell>
                <Cell>{req.restaurant}</Cell>
                <Cell>
                  <a href={`mailto:${req.email}`} style={{ color: D.blue, textDecoration: "none", fontSize: 13 }}>
                    {req.email}
                  </a>
                </Cell>
                <Cell muted={!req.phone}>{req.phone || "—"}</Cell>
                <Cell muted={!req.city}>{req.city || "—"}</Cell>
                <Cell muted={!req.type}>{req.type || "—"}</Cell>
                <div style={{ fontSize: 12, color: D.muted }}>{fmtTime(req.submittedAt)}</div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.28)",
      letterSpacing: "0.12em", textTransform: "uppercase",
      marginBottom: 14,
    }}>
      {children}
    </div>
  )
}

function SvcCard({ name, svc, icon, extra }: { name: string; svc: Svc; icon: React.ReactNode; extra?: string }) {
  const dot = svcDot(svc.status)
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: `1px solid rgba(255,255,255,0.08)`,
      borderRadius: 10,
      padding: "18px 20px",
    }}>
      {/* Icon + name row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, color: "rgba(255,255,255,0.40)" }}>
        {icon}
        <span style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.50)", letterSpacing: "0.01em" }}>{name}</span>
      </div>

      {/* Status */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
        <div style={{
          width: 8, height: 8, borderRadius: "50%", background: dot, flexShrink: 0,
          boxShadow: svc.status === "up" ? `0 0 6px ${dot}` : "none",
        }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: dot }}>
          {svcLabel(svc.status)}
        </span>
        {extra && (
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.30)", marginLeft: 2 }}>{extra}</span>
        )}
      </div>

      {/* Detail */}
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", lineHeight: 1.4 }}>
        {svc.detail || (svc.status === "checking" ? "Checking…" : "")}
      </div>
    </div>
  )
}

function LiveNum({ live, value }: { live: RestLive; value: number }) {
  return (
    <div style={{ textAlign: "center" }}>
      {live.loading ? (
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.28)" }}>—</span>
      ) : live.error ? (
        <span style={{ fontSize: 13, color: "#EF4444" }}>Error</span>
      ) : (
        <span style={{ fontSize: 14, fontWeight: 600, color: value > 0 ? "#FFFFFF" : "rgba(255,255,255,0.28)" }}>
          {value}
        </span>
      )}
    </div>
  )
}

function Cell({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <div style={{ fontSize: 13, color: muted ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.80)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 12 }}>
      {children}
    </div>
  )
}
