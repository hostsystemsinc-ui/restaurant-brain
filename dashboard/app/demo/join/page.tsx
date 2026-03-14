"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

const API                = "https://restaurant-brain-production.up.railway.app"
const DEMO_RESTAURANT_ID = "dec0cafe-0000-4000-8000-000000000001"
const DEMO_NAME          = "Demo Restaurant"
const TOTAL_TABLES       = 16

interface LiveInfo {
  available: number
  waitMin:   number | null
  ahead:     number
}

export default function DemoJoinPage() {
  const router = useRouter()
  const [partySize,   setPartySize]   = useState(2)
  const [name,        setName]        = useState("")
  const [phone,       setPhone]       = useState("")
  const [waitMinutes, setWaitMinutes] = useState(0)   // 0 = ASAP
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState("")
  const [live,        setLive]        = useState<LiveInfo | null>(null)
  const [joined,      setJoined]      = useState(false)

  const fetchLive = useCallback(async () => {
    try {
      const [tablesRes, insightsRes] = await Promise.all([
        fetch(`${API}/tables?restaurant_id=${DEMO_RESTAURANT_ID}`),
        fetch(`${API}/insights?restaurant_id=${DEMO_RESTAURANT_ID}`),
      ])
      const tables   = tablesRes.ok   ? await tablesRes.json()   : []
      const insights = insightsRes.ok ? await insightsRes.json() : null
      const apiOccupied = Array.isArray(tables)
        ? tables.filter((t: { status: string }) => t.status !== "available").length
        : 0
      setLive({
        available: Math.max(0, TOTAL_TABLES - apiOccupied),
        ahead:     insights?.parties_waiting ?? 0,
        waitMin:   insights?.avg_wait_estimate > 0 ? insights.avg_wait_estimate : null,
      })
    } catch {
      setLive(prev => prev ?? { available: 0, waitMin: null, ahead: 0 })
    }
  }, [])

  useEffect(() => {
    fetchLive()
    const t = setInterval(fetchLive, 20_000)
    return () => clearInterval(t)
  }, [fetchLive])

  const submit = async () => {
    if (!name.trim()) { setError("Please enter your name."); return }
    setLoading(true); setError("")
    try {
      const res = await fetch(`${API}/queue/join`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:          name.trim(),
          party_size:    partySize,
          phone:         phone.trim() || null,
          preference:    waitMinutes === 0 ? "asap" : `${waitMinutes}min`,
          source:        "nfc",
          restaurant_id: DEMO_RESTAURANT_ID,
        }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setJoined(true)
      setTimeout(() => router.push(`/wait/${data.entry.id}`), 1050)
    } catch {
      setError("Something went wrong. Please try again.")
      setLoading(false)
    }
  }

  return (
    <div style={{
      height: "100dvh", background: "#000", color: "#fff",
      fontFamily: "inherit", display: "flex", flexDirection: "column",
      overflow: "hidden",
    }}>
      <style>{`
        @keyframes overlayIn { from{opacity:0} to{opacity:1} }
        @keyframes logoStamp {
          0%   { opacity:0; transform:scale(0.88) translateY(4px) }
          60%  { opacity:1; transform:scale(1.03) translateY(0) }
          100% { opacity:1; transform:scale(1) translateY(0) }
        }
        @keyframes subtleUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        .jf-input { transition: border-color .15s; }
        .jf-input:focus { outline:none; border-color:rgba(255,255,255,0.35) !important; }
        .pm-btn:active:not(:disabled) { transform:scale(0.90) !important; }
        .cta-btn:active:not(:disabled) { transform:scale(0.98) !important; }
        .wt-btn { transition: background .15s, color .15s, border-color .15s; }
      `}</style>

      {/* ── HOST Wordmark ── */}
      <div style={{ textAlign: "center", paddingTop: 36, paddingBottom: 0, flexShrink: 0 }}>
        <div style={{ fontSize: "clamp(2.2rem,8vw,3rem)", fontWeight: 900, letterSpacing: "0.08em", color: "#fff", lineHeight: 1 }}>
          HOST
        </div>
        <div style={{ fontSize: ".58rem", fontWeight: 700, letterSpacing: ".28em", textTransform: "uppercase", color: "rgba(255,255,255,0.26)", marginTop: 5 }}>
          Restaurant Operating System
        </div>
      </div>

      {/* ── Restaurant + Live Info ── */}
      <div style={{ textAlign: "center", padding: "16px 24px 0", flexShrink: 0 }}>
        <div style={{
          display: "inline-block", padding: "7px 22px",
          border: "1px solid rgba(255,255,255,0.11)", borderRadius: 12,
          background: "rgba(255,255,255,0.04)",
        }}>
          <div style={{ fontSize: ".85rem", fontWeight: 800, letterSpacing: "0.14em", color: "rgba(255,255,255,0.85)" }}>
            {DEMO_NAME.toUpperCase()}
          </div>
        </div>
        {live !== null && (live.ahead > 0 || live.waitMin) && (
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, fontSize: ".78rem" }}>
            {live.ahead > 0 && (
              <span style={{ fontWeight: 700, color: "rgba(255,255,255,0.78)" }}>
                {live.ahead} {live.ahead === 1 ? "party" : "parties"} ahead
              </span>
            )}
            {live.ahead > 0 && live.waitMin && <span style={{ color: "rgba(255,255,255,0.22)" }}>·</span>}
            {live.waitMin && <span style={{ color: "rgba(255,255,255,0.48)" }}>~{live.waitMin}m wait</span>}
          </div>
        )}
      </div>

      {/* ── Form ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 11, padding: "18px 22px 0", overflow: "hidden" }}>

        {/* Party Size */}
        <div style={{ background: "#111", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "12px 16px 14px", flexShrink: 0 }}>
          <div style={{ fontSize: ".58rem", fontWeight: 800, letterSpacing: ".24em", textTransform: "uppercase", color: "rgba(255,255,255,0.32)", marginBottom: 8 }}>
            Party Size
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <button className="pm-btn" onClick={() => setPartySize(s => Math.max(1, s - 1))} disabled={partySize <= 1}
              style={{ width: 42, height: 42, borderRadius: "50%", background: "rgba(255,255,255,0.07)", border: "1.5px solid rgba(255,255,255,0.11)", color: partySize <= 1 ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.78)", fontSize: 20, cursor: partySize <= 1 ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "transform .12s" }}>−</button>
            <span style={{ fontSize: "2.8rem", fontWeight: 300, color: "#fff", letterSpacing: "-0.02em", lineHeight: 1, fontVariantNumeric: "tabular-nums", minWidth: 48, textAlign: "center" }}>
              {partySize}
            </span>
            <button className="pm-btn" onClick={() => setPartySize(s => Math.min(20, s + 1))} disabled={partySize >= 20}
              style={{ width: 42, height: 42, borderRadius: "50%", background: "rgba(255,255,255,0.07)", border: "1.5px solid rgba(255,255,255,0.11)", color: partySize >= 20 ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.78)", fontSize: 20, cursor: partySize >= 20 ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "transform .12s" }}>+</button>
          </div>
        </div>

        {/* Preferred Wait — ASAP / + increments */}
        <div style={{ flexShrink: 0 }}>
          <div style={{ fontSize: ".58rem", fontWeight: 800, letterSpacing: ".24em", textTransform: "uppercase", color: "rgba(255,255,255,0.32)", marginBottom: 7 }}>
            Preferred Wait
          </div>
          <div style={{ display: "flex", alignItems: "center", background: "#111", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 13, overflow: "hidden", height: 46 }}>

            {/* ASAP button — highlighted when active */}
            <button className="wt-btn" onClick={() => setWaitMinutes(0)}
              style={{
                flex: waitMinutes === 0 ? 1 : "none",
                padding: waitMinutes === 0 ? "0 16px" : "0 14px",
                height: "100%",
                background: waitMinutes === 0 ? "rgba(255,255,255,0.12)" : "transparent",
                border: "none",
                borderRight: "1px solid rgba(255,255,255,0.08)",
                color: waitMinutes === 0 ? "#fff" : "rgba(255,255,255,0.35)",
                fontWeight: waitMinutes === 0 ? 800 : 500,
                fontSize: ".76rem", letterSpacing: ".12em", textTransform: "uppercase",
                cursor: "pointer", whiteSpace: "nowrap",
              }}>
              {waitMinutes === 0 ? "✓  ASAP" : "ASAP"}
            </button>

            {/* Time controls — shown when > 0 */}
            {waitMinutes > 0 && (
              <>
                <button className="wt-btn" onClick={() => setWaitMinutes(w => w - 5 <= 0 ? 0 : w - 5)}
                  style={{ padding: "0 14px", height: "100%", background: "transparent", border: "none", borderRight: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.65)", fontSize: 19, cursor: "pointer" }}>−</button>
                <span style={{ flex: 1, textAlign: "center", fontSize: ".88rem", fontWeight: 700, color: "#fff", letterSpacing: "0.01em" }}>
                  {waitMinutes} min
                </span>
              </>
            )}

            {/* + button */}
            <button className="wt-btn" onClick={() => setWaitMinutes(w => Math.min(120, w + 5))} disabled={waitMinutes >= 120}
              style={{ padding: "0 16px", height: "100%", background: "transparent", border: "none", borderLeft: waitMinutes === 0 ? "none" : "1px solid rgba(255,255,255,0.07)", color: waitMinutes >= 120 ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.65)", fontSize: 19, cursor: waitMinutes >= 120 ? "default" : "pointer" }}>+</button>
          </div>
        </div>

        {/* Name */}
        <div style={{ flexShrink: 0 }}>
          <div style={{ fontSize: ".58rem", fontWeight: 800, letterSpacing: ".24em", textTransform: "uppercase", color: "rgba(255,255,255,0.32)", marginBottom: 7 }}>
            Name
          </div>
          <input className="jf-input" type="text" placeholder="Your name" value={name}
            onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()}
            autoComplete="name"
            style={{ width: "100%", background: "#111", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 13, padding: "13px 15px", color: "#fff", fontSize: ".95rem", boxSizing: "border-box", caretColor: "white" }} />
        </div>

        {/* Phone */}
        <div style={{ flexShrink: 0 }}>
          <div style={{ fontSize: ".58rem", fontWeight: 800, letterSpacing: ".24em", textTransform: "uppercase", color: "rgba(255,255,255,0.32)", marginBottom: 7 }}>
            Phone <span style={{ fontWeight: 400, letterSpacing: ".02em", textTransform: "none", color: "rgba(255,255,255,0.18)" }}>— optional</span>
          </div>
          <input className="jf-input" type="tel" placeholder="(555) 000-0000" value={phone}
            onChange={e => setPhone(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()}
            autoComplete="tel"
            style={{ width: "100%", background: "#111", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 13, padding: "13px 15px", color: "#fff", fontSize: ".95rem", boxSizing: "border-box", caretColor: "white" }} />
        </div>
      </div>

      {/* ── CTA ── */}
      <div style={{ padding: "14px 22px 32px", flexShrink: 0 }}>
        {error && <p style={{ textAlign: "center", fontSize: ".78rem", color: "rgba(255,90,90,0.9)", marginBottom: 10 }}>{error}</p>}
        <button className="cta-btn" onClick={submit} disabled={loading || joined}
          style={{ width: "100%", height: 60, borderRadius: 18, background: loading || joined ? "rgba(255,255,255,0.26)" : "#fff", color: "#000", fontWeight: 800, fontSize: ".95rem", letterSpacing: ".12em", textTransform: "uppercase", border: "none", cursor: loading || joined ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "transform .12s" }}>
          {loading && !joined
            ? <Loader2 style={{ width: 20, height: 20, animation: "spin 1s linear infinite" }} />
            : "Join Waitlist"}
        </button>
        <p style={{ textAlign: "center", marginTop: 11, fontSize: ".66rem", color: "rgba(255,255,255,0.16)", letterSpacing: ".06em" }}>
          HOST · No app download needed
        </p>
      </div>

      {/* ── Success overlay ── */}
      {joined && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#000", animation: "overlayIn 0.28s cubic-bezier(0.4,0,0.2,1) both" }}>
          <p style={{ fontSize: 10, letterSpacing: "0.55em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 14, animation: "subtleUp 0.45s 0.18s ease-out both" }}>
            You&apos;re in the queue
          </p>
          <p style={{ fontSize: 72, fontWeight: 900, letterSpacing: "0.28em", color: "#fff", lineHeight: 1, animation: "logoStamp 0.5s 0.26s cubic-bezier(0.34,1.56,0.64,1) both" }}>
            HOST
          </p>
          <p style={{ fontSize: 11, letterSpacing: "0.18em", color: "rgba(255,255,255,0.28)", marginTop: 20, animation: "subtleUp 0.45s 0.45s ease-out both" }}>
            {phone.trim() ? "We\u2019ll text you when it\u2019s time." : "Check back anytime."}
          </p>
        </div>
      )}
    </div>
  )
}
