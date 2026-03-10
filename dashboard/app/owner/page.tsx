"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Building2, TrendingUp, Users, CheckCircle2,
  AlertCircle, ArrowUpRight, RefreshCw, LogOut, Eye,
  EyeOff, Loader2, BarChart3, Zap, CircleDot, Star,
  Activity, DollarSign, MapPin, ArrowRight, Shield,
} from "lucide-react"

// ── Dark design tokens (matches HOST landing page) ─────────────────────────────
const D = {
  bg:           "#080C10",
  surface:      "rgba(255,255,255,0.03)",
  surfaceHover: "rgba(255,255,255,0.05)",
  border:       "rgba(255,255,255,0.08)",
  borderStrong: "rgba(255,255,255,0.12)",
  text:         "#FFFFFF",
  text2:        "rgba(255,255,255,0.65)",
  muted:        "rgba(255,255,255,0.30)",
  accent:       "#D9321C",
  accentBg:     "rgba(217,50,28,0.10)",
  accentBorder: "rgba(217,50,28,0.22)",
  green:        "#22C55E",
  greenBg:      "rgba(34,197,94,0.10)",
  greenBorder:  "rgba(34,197,94,0.22)",
  orange:       "#F59E0B",
  orangeBg:     "rgba(245,158,11,0.10)",
  orangeBorder: "rgba(245,158,11,0.22)",
  blue:         "#3B82F6",
  blueBg:       "rgba(59,130,246,0.10)",
  blueBorder:   "rgba(59,130,246,0.22)",
  purple:       "#A855F7",
  purpleBg:     "rgba(168,85,247,0.10)",
  purpleBorder: "rgba(168,85,247,0.22)",
}

const WALTERS_API    = "https://restaurant-brain-production.up.railway.app"
const OWNER_PASS     = "hostowner2025"
const DEMO_RID       = "dec0cafe-0000-4000-8000-000000000001"

// ── Types ──────────────────────────────────────────────────────────────────────
interface Restaurant {
  id: string; name: string; city: string
  plan: "Growth" | "Starter" | "Trial" | "Enterprise"
  status: "Active" | "Trial" | "Paused"
  since: string; mrr: number
  seatedToday: number; avgWait: number; queueNow: number; coversThisWeek: number
  nfcTaps: number; isLive?: boolean; liveRid?: string; dashboardUrl?: string
}

const MOCK_RESTAURANTS: Restaurant[] = [
  { id: "walters303",    name: "Walter's 303",      city: "Denver, CO", plan: "Growth",     status: "Active", since: "2025-01-15", mrr: 149, seatedToday: 0,  avgWait: 0,  queueNow: 0, coversThisWeek: 0,   nfcTaps: 312, isLive: true,  dashboardUrl: "/walters303" },
  { id: "demo",          name: "Demo Restaurant",   city: "Denver, CO", plan: "Trial",      status: "Trial",  since: "2026-03-10", mrr: 0,   seatedToday: 0,  avgWait: 0,  queueNow: 0, coversThisWeek: 0,   nfcTaps: 0,   isLive: true,  liveRid: DEMO_RID, dashboardUrl: "/demo/station" },
  { id: "capital",      name: "The Capital Grille", city: "Denver, CO", plan: "Enterprise", status: "Active", since: "2025-02-01", mrr: 399, seatedToday: 47, avgWait: 18, queueNow: 6, coversThisWeek: 312, nfcTaps: 541 },
  { id: "panzano",      name: "Panzano",            city: "Denver, CO", plan: "Growth",     status: "Active", since: "2025-02-14", mrr: 149, seatedToday: 31, avgWait: 12, queueNow: 3, coversThisWeek: 198, nfcTaps: 287 },
  { id: "elways",       name: "Elway's Cherry Creek",city: "Denver, CO",plan: "Trial",      status: "Trial",  since: "2025-03-01", mrr: 0,   seatedToday: 22, avgWait: 21, queueNow: 4, coversThisWeek: 134, nfcTaps: 89  },
  { id: "guard-grace",  name: "Guard and Grace",    city: "Denver, CO", plan: "Trial",      status: "Trial",  since: "2025-03-02", mrr: 0,   seatedToday: 18, avgWait: 16, queueNow: 2, coversThisWeek: 97,  nfcTaps: 43  },
]

// ── Helpers ────────────────────────────────────────────────────────────────────
function sinceLabel(iso: string) {
  const d = new Date(iso)
  return `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getMonth()]} ${d.getFullYear()}`
}

function planStyle(plan: Restaurant["plan"]) {
  switch (plan) {
    case "Enterprise": return { bg: D.purpleBg, color: D.purple, border: D.purpleBorder }
    case "Growth":     return { bg: D.blueBg,   color: D.blue,   border: D.blueBorder   }
    case "Starter":    return { bg: D.greenBg,  color: D.green,  border: D.greenBorder  }
    case "Trial":      return { bg: D.orangeBg, color: D.orange, border: D.orangeBorder }
  }
}

function statusStyle(status: Restaurant["status"]) {
  switch (status) {
    case "Active": return { color: D.green,  dot: D.green  }
    case "Trial":  return { color: D.orange, dot: D.orange }
    case "Paused": return { color: D.muted,  dot: D.muted  }
  }
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function OwnerPage() {
  const [authed,      setAuthed]      = useState(false)
  const [passInput,   setPassInput]   = useState("")
  const [passErr,     setPassErr]     = useState(false)
  const [showPass,    setShowPass]    = useState(false)
  const [restaurants, setRestaurants] = useState<Restaurant[]>(MOCK_RESTAURANTS)
  const [loading,     setLoading]     = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  useEffect(() => {
    if (sessionStorage.getItem("host_owner_authed") === "1") setAuthed(true)
  }, [])

  const fetchLive = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch live data for every restaurant that has isLive: true
      // Walter's uses no restaurant_id param; others use liveRid
      const liveRestaurants = MOCK_RESTAURANTS.filter(r => r.isLive)
      const results = await Promise.all(
        liveRestaurants.map(async r => {
          const rid    = r.liveRid ? `?restaurant_id=${r.liveRid}` : ""
          const [insRes, qRes] = await Promise.all([
            fetch(`${WALTERS_API}/insights${rid}`),
            fetch(`${WALTERS_API}/queue${rid}`),
          ])
          const ins = insRes.ok ? await insRes.json() : null
          const q   = qRes.ok  ? await qRes.json()   : []
          return {
            id:             r.id,
            seatedToday:    ins?.parties_seated_today ?? r.seatedToday,
            avgWait:        Math.round(ins?.avg_wait_estimate ?? r.avgWait),
            queueNow:       Array.isArray(q) ? q.filter((e: { status: string }) => ["waiting","ready"].includes(e.status)).length : r.queueNow,
            coversThisWeek: ins?.covers_this_week ?? r.coversThisWeek,
          }
        })
      )
      const liveMap = new Map(results.map(r => [r.id, r]))
      setRestaurants(prev => prev.map(r => {
        const live = liveMap.get(r.id)
        if (!live) return r
        return { ...r, ...live }
      }))
      setLastRefresh(new Date())
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { if (authed) fetchLive() }, [authed, fetchLive])

  function tryLogin() {
    if (passInput.trim() === OWNER_PASS) {
      sessionStorage.setItem("host_owner_authed", "1")
      setAuthed(true); setPassErr(false)
    } else { setPassErr(true) }
  }
  function logout() {
    sessionStorage.removeItem("host_owner_authed")
    setAuthed(false); setPassInput("")
  }

  const totalMRR    = restaurants.reduce((s, r) => s + r.mrr, 0)
  const activeCount = restaurants.filter(r => r.status === "Active").length
  const trialCount  = restaurants.filter(r => r.status === "Trial").length
  const totalSeated = restaurants.reduce((s, r) => s + r.seatedToday, 0)
  const totalQueue  = restaurants.reduce((s, r) => s + r.queueNow, 0)

  const font      = "var(--font-geist), 'Inter', system-ui, -apple-system, sans-serif"
  const fontSerif = "var(--font-playfair), Georgia, 'Times New Roman', serif"

  // ── PASSWORD GATE ──
  if (!authed) return (
    <div style={{
      minHeight: "100vh", background: D.bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: font, position: "relative", overflow: "hidden",
    }}>
      {/* Glow */}
      <div style={{ position: "absolute", top: "30%", left: "50%", transform: "translateX(-50%)", width: 600, height: 400, background: "radial-gradient(ellipse, rgba(217,50,28,0.10) 0%, transparent 70%)", pointerEvents: "none" }} />
      {/* Grid */}
      <div style={{ position: "absolute", inset: 0, opacity: 0.03, backgroundImage: "linear-gradient(rgba(255,255,255,0.8) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.8) 1px,transparent 1px)", backgroundSize: "60px 60px", pointerEvents: "none" }} />

      <div style={{
        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 10, padding: "44px 40px", width: 400, maxWidth: "92vw",
        display: "flex", flexDirection: "column", gap: 28,
        backdropFilter: "blur(20px)", boxShadow: "0 40px 80px rgba(0,0,0,0.5)",
        position: "relative",
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", paddingBottom: 4 }}>
          <div style={{ fontSize: 40, fontWeight: 900, color: "#fff", fontFamily: "'Arial Black', Arial, Helvetica, sans-serif", letterSpacing: "-0.04em", lineHeight: 1 }}>
            HOST
          </div>
          <div style={{ fontSize: 10, fontWeight: 600, color: D.muted, letterSpacing: "0.18em", marginTop: 6, textTransform: "uppercase" }}>
            Owner Console
          </div>
          <div style={{ width: 32, height: 1, background: D.accent, margin: "12px auto 0" }} />
        </div>

        {/* Input */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: D.muted, display: "block", marginBottom: 8, letterSpacing: "0.04em" }}>
            ACCESS PASSWORD
          </label>
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
                padding: "12px 44px 12px 16px",
                background: "rgba(255,255,255,0.05)",
                border: `1px solid ${passErr ? "rgba(217,50,28,0.5)" : "rgba(255,255,255,0.1)"}`,
                borderRadius: 10, outline: "none",
                color: "#fff", fontSize: 14, fontFamily: "monospace",
              }}
            />
            <button onClick={() => setShowPass(v => !v)} style={{
              position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", cursor: "pointer", padding: 0, color: D.muted,
              display: "flex", alignItems: "center",
            }}>
              {showPass ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
            </button>
          </div>
          {passErr && (
            <p style={{ fontSize: 11, color: D.accent, margin: "6px 0 0", fontWeight: 500 }}>
              Incorrect password
            </p>
          )}
        </div>

        {/* Submit */}
        <button onClick={tryLogin} style={{
          width: "100%", padding: "13px 20px", borderRadius: 10,
          background: "linear-gradient(135deg, #D9321C, #A52010)",
          border: "none", color: "#fff", fontSize: 14, fontWeight: 700,
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
          boxShadow: "0 4px 20px rgba(217,50,28,0.3)", fontFamily: font,
        }}>
          Access Console
          <ArrowRight style={{ width: 15, height: 15 }} />
        </button>

        <div style={{ textAlign: "center" }}>
          <a href="/" style={{ fontSize: 12, color: D.muted, textDecoration: "none" }}>← Back to HOST</a>
        </div>
      </div>
    </div>
  )

  // ── AUTHENTICATED DASHBOARD ──
  return (
    <div style={{
      minHeight: "100vh", background: D.bg,
      fontFamily: font, color: D.text,
    }}>

      {/* Top nav */}
      <div style={{
        background: "rgba(8,12,16,0.90)", backdropFilter: "blur(20px)",
        borderBottom: `1px solid ${D.border}`,
        padding: "0 32px", height: 60,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 50,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: "linear-gradient(135deg, #D9321C, #A52010)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 12px rgba(217,50,28,0.35)",
          }}>
            <Zap style={{ width: 14, height: 14, color: "#fff", fill: "#fff" }} />
          </div>
          <span style={{ fontSize: 20, fontWeight: 900, color: "#fff", fontFamily: "'Arial Black', Arial, Helvetica, sans-serif", letterSpacing: "-0.03em" }}>HOST</span>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: "0.1em",
            background: D.purpleBg, color: D.purple, border: `1px solid ${D.purpleBorder}`,
            borderRadius: 4, padding: "2px 7px",
          }}>OWNER CONSOLE</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {lastRefresh && (
            <span style={{ fontSize: 11, color: D.muted }}>
              {lastRefresh.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <button onClick={fetchLive} disabled={loading} style={{
            display: "flex", alignItems: "center", gap: 5, padding: "7px 12px",
            borderRadius: 8, border: `1px solid ${D.border}`,
            background: D.surface, color: D.text2,
            fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: font,
          }}>
            {loading
              ? <Loader2 style={{ width: 12, height: 12 }} />
              : <RefreshCw style={{ width: 12, height: 12 }} />}
            Refresh
          </button>
          <a href="/" style={{
            display: "flex", alignItems: "center", gap: 5, padding: "7px 12px",
            borderRadius: 8, border: `1px solid ${D.border}`,
            background: D.surface, color: D.muted,
            fontSize: 11, fontWeight: 600, textDecoration: "none",
          }}>
            ← HOST
          </a>
          <button onClick={logout} style={{
            display: "flex", alignItems: "center", gap: 5, padding: "7px 12px",
            borderRadius: 8, border: `1px solid ${D.border}`,
            background: D.surface, color: D.muted,
            fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: font,
          }}>
            <LogOut style={{ width: 12, height: 12 }} />
            Logout
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "36px 32px 80px" }}>

        {/* Page title */}
        <div style={{ marginBottom: 36, paddingBottom: 24, borderBottom: `1px solid ${D.border}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: D.accent, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 10 }}>
            Owner Console
          </div>
          <h1 style={{ fontSize: 36, fontWeight: 800, color: D.text, margin: "0 0 8px", fontFamily: fontSerif, letterSpacing: "-0.01em", lineHeight: 1.1 }}>
            Account Overview
          </h1>
          <p style={{ fontSize: 13, color: D.muted, margin: 0 }}>
            All HOST locations · live data where available
          </p>
        </div>

        {/* KPI row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 24 }}>
          {[
            { icon: Building2,    label: "LOCATIONS",     value: restaurants.length, color: D.purple, bg: D.purpleBg, border: D.purpleBorder },
            { icon: CheckCircle2, label: "ACTIVE",         value: activeCount,        color: D.green,  bg: D.greenBg,  border: D.greenBorder  },
            { icon: Star,         label: "TRIALS",         value: trialCount,         color: D.orange, bg: D.orangeBg, border: D.orangeBorder },
            { icon: DollarSign,   label: "MRR",            value: `$${totalMRR}`,     color: D.blue,   bg: D.blueBg,   border: D.blueBorder   },
            { icon: Users,        label: "QUEUE NOW",      value: totalQueue,         color: D.accent, bg: D.accentBg, border: D.accentBorder },
          ].map(({ icon: Icon, label, value, color, bg, border }) => (
            <div key={label} style={{
              background: D.surface, border: `1px solid ${D.border}`,
              borderRadius: 8, padding: "18px 20px",
              display: "flex", flexDirection: "column", gap: 12,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: D.muted, letterSpacing: "0.06em" }}>{label}</span>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: bg, border: `1px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon style={{ width: 13, height: 13, color }} />
                </div>
              </div>
              <div style={{ fontSize: 30, fontWeight: 800, color: D.text, lineHeight: 1, fontFamily: fontSerif, letterSpacing: "-0.02em" }}>
                {value}
              </div>
            </div>
          ))}
        </div>

        {/* Seated today banner */}
        <div style={{
          background: "linear-gradient(135deg, rgba(217,50,28,0.12), rgba(217,50,28,0.04))",
          border: `1px solid ${D.accentBorder}`,
          borderRadius: 8, padding: "20px 28px", marginBottom: 24,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: D.accentBg, border: `1px solid ${D.accentBorder}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Activity style={{ width: 18, height: 18, color: D.accent }} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: D.muted, marginBottom: 6, letterSpacing: "0.14em", textTransform: "uppercase" }}>
                Parties Seated Today · All Locations
              </div>
              <div style={{ fontSize: 42, fontWeight: 800, color: D.text, lineHeight: 1, fontFamily: fontSerif, letterSpacing: "-0.02em" }}>
                {loading ? <Loader2 style={{ width: 24, height: 24, display: "inline" }} /> : totalSeated}
              </div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: D.muted }}>{restaurants.length} locations</div>
            <div style={{ fontSize: 10, color: D.accentBorder, marginTop: 2 }}>Live · Walter&apos;s 303</div>
          </div>
        </div>

        {/* Section label */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: D.muted, letterSpacing: "0.14em", textTransform: "uppercase" }}>Locations</div>
          <div style={{ flex: 1, height: 1, background: D.border }} />
        </div>

        {/* Restaurant grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14, marginBottom: 24 }}>
          {restaurants.map(r => {
            const ps = planStyle(r.plan)
            const ss = statusStyle(r.status)
            return (
              <div key={r.id} style={{
                background: r.isLive
                  ? "linear-gradient(135deg, rgba(34,197,94,0.05), rgba(34,197,94,0.02))"
                  : D.surface,
                border: `1px solid ${r.isLive ? D.greenBorder : D.border}`,
                borderRadius: 8, padding: 22, display: "flex", flexDirection: "column", gap: 16,
              }}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: 9,
                      background: r.isLive ? D.greenBg : "rgba(255,255,255,0.04)",
                      border: `1px solid ${r.isLive ? D.greenBorder : D.border}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Building2 style={{ width: 17, height: 17, color: r.isLive ? D.green : D.muted }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: D.text, display: "flex", alignItems: "center", gap: 8, fontFamily: fontSerif, letterSpacing: "-0.01em" }}>
                        {r.name}
                        {r.isLive && <span style={{ fontSize: 9, fontWeight: 700, color: D.green, fontFamily: font }}>● LIVE</span>}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                        <MapPin style={{ width: 10, height: 10, color: D.muted }} />
                        <span style={{ fontSize: 11, color: D.muted }}>{r.city}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.04em", padding: "3px 8px", borderRadius: 4, background: ps.bg, color: ps.color, border: `1px solid ${ps.border}` }}>
                      {r.plan.toUpperCase()}
                    </span>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 4, color: ss.color, background: `${ss.dot}12`, border: `1px solid ${ss.dot}30`, display: "flex", alignItems: "center", gap: 3 }}>
                      <CircleDot style={{ width: 7, height: 7 }} />{r.status}
                    </span>
                  </div>
                </div>

                {/* Metrics */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, borderTop: `1px solid ${D.border}`, borderBottom: `1px solid ${D.border}`, padding: "14px 0" }}>
                  {[
                    { label: "Seated Today",  value: loading && r.isLive ? "…" : r.seatedToday   },
                    { label: "Avg Wait",       value: loading && r.isLive ? "…" : `${r.avgWait}m` },
                    { label: "Queue Now",      value: loading && r.isLive ? "…" : r.queueNow      },
                    { label: "Covers / Week",  value: loading && r.isLive ? "…" : r.coversThisWeek},
                  ].map(({ label, value }) => (
                    <div key={label} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 9, fontWeight: 600, color: D.muted, letterSpacing: "0.04em", marginBottom: 4 }}>{label.toUpperCase()}</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: D.text, letterSpacing: "-0.03em" }}>{value}</div>
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <span style={{ fontSize: 11, color: D.muted }}><span style={{ fontWeight: 700, color: D.text2 }}>{r.nfcTaps}</span> NFC taps</span>
                    <span style={{ fontSize: 11, color: D.muted }}>Since <span style={{ fontWeight: 700, color: D.text2 }}>{sinceLabel(r.since)}</span></span>
                    {r.mrr > 0
                      ? <span style={{ fontSize: 11, fontWeight: 700, color: D.blue }}>${r.mrr}/mo</span>
                      : <span style={{ fontSize: 10, fontWeight: 700, color: D.orange }}>Trial</span>}
                  </div>
                  {r.dashboardUrl ? (
                    <a href={r.dashboardUrl} style={{
                      display: "flex", alignItems: "center", gap: 5, padding: "7px 14px",
                      borderRadius: 8, background: "linear-gradient(135deg, #D9321C, #A52010)",
                      fontSize: 11, fontWeight: 700, color: "#fff", textDecoration: "none",
                      boxShadow: "0 2px 12px rgba(217,50,28,0.25)",
                    }}>
                      <ArrowUpRight style={{ width: 11, height: 11 }} />
                      Dashboard
                    </a>
                  ) : (
                    <span style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 8, background: D.surface, border: `1px solid ${D.border}`, fontSize: 11, fontWeight: 600, color: D.muted }}>
                      <AlertCircle style={{ width: 11, height: 11 }} />Demo
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Bottom row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 24 }}>
          {/* Revenue */}
          <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 8, padding: "22px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: D.blueBg, border: `1px solid ${D.blueBorder}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <DollarSign style={{ width: 13, height: 13, color: D.blue }} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: D.text, fontFamily: fontSerif, letterSpacing: "-0.01em" }}>Revenue Breakdown</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {restaurants.filter(r => r.mrr > 0).map(r => (
                <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: D.text2 }}>{r.name}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ height: 5, borderRadius: 3, background: `linear-gradient(90deg, #3B82F6, #60A5FA)`, width: Math.round((r.mrr / totalMRR) * 100) }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: D.text }}>${r.mrr}/mo</span>
                  </div>
                </div>
              ))}
              <div style={{ borderTop: `1px solid ${D.border}`, paddingTop: 12, marginTop: 4, display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: D.text2 }}>Total MRR</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: D.blue, fontFamily: fontSerif, letterSpacing: "-0.02em" }}>${totalMRR}/mo</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, color: D.muted }}>ARR (projected)</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: D.muted }}>${(totalMRR * 12).toLocaleString()}/yr</span>
              </div>
            </div>
          </div>

          {/* Activity */}
          <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 8, padding: "22px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: D.greenBg, border: `1px solid ${D.greenBorder}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <TrendingUp style={{ width: 13, height: 13, color: D.green }} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: D.text, fontFamily: fontSerif, letterSpacing: "-0.01em" }}>Pipeline & Activity</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { label: "Guard and Grace started trial",     time: "2h ago",  type: "trial"   },
                { label: "Elway's started trial",             time: "2d ago",  type: "trial"   },
                { label: "Panzano upgraded to Growth",        time: "18d ago", type: "upgrade" },
                { label: "Capital Grille went Enterprise",    time: "30d ago", type: "upgrade" },
                { label: "Walter's 303 launched on HOST",     time: "47d ago", type: "launch"  },
              ].map((ev, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: 4, flexShrink: 0,
                    background: ev.type === "upgrade" ? D.blueBg : ev.type === "trial" ? D.orangeBg : D.greenBg,
                    border: `1px solid ${ev.type === "upgrade" ? D.blueBorder : ev.type === "trial" ? D.orangeBorder : D.greenBorder}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {ev.type === "upgrade"
                      ? <TrendingUp style={{ width: 9, height: 9, color: D.blue }} />
                      : ev.type === "trial"
                        ? <Star style={{ width: 9, height: 9, color: D.orange }} />
                        : <CheckCircle2 style={{ width: 9, height: 9, color: D.green }} />}
                  </div>
                  <div style={{ flex: 1, fontSize: 11, color: D.text2 }}>{ev.label}</div>
                  <span style={{ fontSize: 10, color: D.muted, flexShrink: 0 }}>{ev.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Plan distribution */}
        <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 8, padding: "22px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: D.purpleBg, border: `1px solid ${D.purpleBorder}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <BarChart3 style={{ width: 13, height: 13, color: D.purple }} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: D.text, fontFamily: fontSerif, letterSpacing: "-0.01em" }}>Plan Distribution</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            {(["Enterprise","Growth","Starter","Trial"] as const).map(plan => {
              const count = restaurants.filter(r => r.plan === plan).length
              const ps    = planStyle(plan)
              return (
                <div key={plan} style={{ background: ps.bg, border: `1px solid ${ps.border}`, borderRadius: 10, padding: "14px 16px", textAlign: "center" }}>
                  <div style={{ fontSize: 30, fontWeight: 800, color: ps.color, fontFamily: fontSerif, letterSpacing: "-0.02em" }}>{count}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: ps.color, letterSpacing: "0.04em", marginTop: 4 }}>{plan.toUpperCase()}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 40, paddingTop: 24, borderTop: `1px solid ${D.border}`, textAlign: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 700, fontFamily: fontSerif, color: D.muted, letterSpacing: "0.02em" }}>HOST</div>
          <div style={{ fontSize: 10, color: D.muted, marginTop: 4, letterSpacing: "0.1em", textTransform: "uppercase" }}>Owner Console · Private · hostplatform.net</div>
        </div>
      </div>
    </div>
  )
}
