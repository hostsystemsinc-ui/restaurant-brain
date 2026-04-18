"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Loader2, UtensilsCrossed, X } from "lucide-react"
import { WALNUT_MENU } from "@/lib/walnut-menu"

const API             = "https://restaurant-brain-production.up.railway.app"
const RESTAURANT_ID   = "0002cafe-0001-4000-8000-000000000002"
const RESTAURANT_NAME = "The Southside Walnut Cafe"
const TOTAL_TABLES    = 17 // 16 + bar

const BG     = "#EDE8DF"
const DARK   = "#2C2416"
const DARK2  = "rgba(44,36,22,0.55)"
const DARK3  = "rgba(44,36,22,0.30)"
const DARK4  = "rgba(44,36,22,0.08)"
const DARK5  = "rgba(44,36,22,0.12)"
const LOGO   = "https://images.getbento.com/accounts/d2ce1ba3bfb5b87e1f0ba2897a682acb/media/images/28198New_Walnut_Logo.png"

interface LiveInfo { available: number; waitMin: number | null; ahead: number }

export default function SouthsideJoinPage() {
  const router = useRouter()
  const [partySize,  setPartySize]  = useState(2)
  const [name,       setName]       = useState("")
  const [phone,      setPhone]      = useState("")
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState("")
  const [live,       setLive]       = useState<LiveInfo | null>(null)
  const [joined,     setJoined]     = useState(false)
  const [menuOpen,   setMenuOpen]   = useState(false)

  const fetchLive = useCallback(async () => {
    try {
      const [tablesRes, insightsRes] = await Promise.all([
        fetch(`${API}/tables?restaurant_id=${RESTAURANT_ID}`),
        fetch(`${API}/insights?restaurant_id=${RESTAURANT_ID}`),
      ])
      const tables   = tablesRes.ok   ? await tablesRes.json()   : []
      const insights = insightsRes.ok ? await insightsRes.json() : null
      const apiOccupied = Array.isArray(tables)
        ? tables.filter((t: { status: string }) => t.status !== "available").length : 0
      setLive({
        available: Math.max(0, TOTAL_TABLES - apiOccupied),
        ahead:     insights?.parties_waiting ?? 0,
        waitMin:   insights?.avg_wait_estimate > 0 ? insights.avg_wait_estimate : null,
      })
    } catch {
      setLive(prev => prev ?? { available: 0, waitMin: null, ahead: 0 })
    }
  }, [])

  useEffect(() => { fetchLive(); const t = setInterval(fetchLive, 20_000); return () => clearInterval(t) }, [fetchLive])

  useEffect(() => {
    const id = sessionStorage.getItem("host_wait_id_walnut_southside")
    if (!id) return
    fetch(`${API}/queue/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && (data.status === "waiting" || data.status === "ready")) {
          router.replace(`/wait/${id}`)
        } else { sessionStorage.removeItem("host_wait_id_walnut_southside") }
      })
      .catch(() => sessionStorage.removeItem("host_wait_id_walnut_southside"))
  }, [router])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [menuOpen])

  const submit = async () => {
    if (!name.trim()) { setError("Please enter your name."); return }
    setLoading(true); setError("")
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)
    try {
      const res = await fetch(`${API}/queue/join`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        signal:  controller.signal,
        body: JSON.stringify({
          name:          name.trim(),
          party_size:    partySize,
          phone:         phone.trim() || null,
          preference:    "asap",
          source:        "nfc",
          restaurant_id: RESTAURANT_ID,
        }),
      })
      clearTimeout(timeout)
      if (!res.ok) throw new Error()
      const data = await res.json()
      sessionStorage.setItem("host_wait_id_walnut_southside", data.entry.id)
      setJoined(true)
      setTimeout(() => router.push(`/wait/${data.entry.id}`), 1050)
    } catch (err: unknown) {
      clearTimeout(timeout)
      const isTimeout = err instanceof Error && err.name === "AbortError"
      setError(isTimeout ? "Request timed out. Please try again." : "Something went wrong. Please try again.")
      setLoading(false)
    }
  }

  return (
    <div style={{
      height: "100dvh", background: BG, color: DARK,
      fontFamily: "inherit", display: "flex", flexDirection: "column",
      overflow: "hidden",
    }}>
      <style>{`
        @keyframes overlayIn { from{opacity:0} to{opacity:1} }
        @keyframes logoStamp {
          0%  {opacity:0;transform:scale(0.88) translateY(4px)}
          60% {opacity:1;transform:scale(1.03) translateY(0)}
          100%{opacity:1;transform:scale(1) translateY(0)}
        }
        @keyframes subtleUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes sheetUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
        @keyframes backdropIn { from{opacity:0} to{opacity:1} }
        @keyframes menuItemIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        .wj-input { transition: border-color .15s; background: ${DARK4}; border: 1px solid ${DARK5}; }
        .wj-input:focus { outline:none; border-color: ${DARK2} !important; }
        .pm-btn:active:not(:disabled) { transform:scale(0.90) !important; }
        .cta-btn:active:not(:disabled) { transform:scale(0.98) !important; }
        .menu-btn:active { transform:scale(0.97) !important; }
        .wj-input::placeholder { color: ${DARK3}; }
      `}</style>

      {/* ── HOST Wordmark ── */}
      <div style={{ textAlign: "center", paddingTop: 30, flexShrink: 0 }}>
        <div style={{ fontSize: "clamp(1.8rem,7vw,2.6rem)", fontWeight: 900, letterSpacing: "0.08em", color: DARK, lineHeight: 1 }}>
          HOST
        </div>
        <div style={{ fontSize: ".55rem", fontWeight: 700, letterSpacing: ".28em", textTransform: "uppercase", color: DARK3, marginTop: 4 }}>
          Restaurant Operating System
        </div>
      </div>

      {/* ── Walnut Cafe Logo ── */}
      <div style={{ textAlign: "center", padding: "16px 24px 0", flexShrink: 0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={LOGO}
          alt="The Walnut Cafe"
          style={{ height: 72, objectFit: "contain", display: "inline-block" }}
        />
      </div>

      {/* ── Restaurant + Live Info ── */}
      <div style={{ textAlign: "center", padding: "10px 24px 0", flexShrink: 0 }}>
        <div style={{
          display: "inline-block", padding: "6px 20px",
          border: `1px solid ${DARK5}`, borderRadius: 12,
          background: DARK4,
        }}>
          <div style={{ fontSize: ".78rem", fontWeight: 800, letterSpacing: "0.14em", color: DARK }}>
            {RESTAURANT_NAME.toUpperCase()}
          </div>
        </div>
        {live !== null && (live.ahead > 0 || live.waitMin) && (
          <div style={{ marginTop: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, fontSize: ".78rem" }}>
            {live.ahead > 0 && (
              <span style={{ fontWeight: 700, color: DARK2 }}>
                {live.ahead} {live.ahead === 1 ? "party" : "parties"} ahead
              </span>
            )}
            {live.ahead > 0 && live.waitMin && <span style={{ color: DARK3 }}>·</span>}
            {live.waitMin && <span style={{ color: DARK3 }}>~{live.waitMin}m wait</span>}
          </div>
        )}
      </div>

      {/* ── Form ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 11, padding: "16px 22px 0", overflow: "hidden" }}>

        {/* Party Size */}
        <div style={{ background: DARK4, border: `1px solid ${DARK5}`, borderRadius: 16, padding: "12px 16px 14px", flexShrink: 0 }}>
          <div style={{ fontSize: ".57rem", fontWeight: 800, letterSpacing: ".24em", textTransform: "uppercase", color: DARK3, marginBottom: 8 }}>
            Party Size
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <button className="pm-btn" onClick={() => setPartySize(s => Math.max(1, s - 1))} disabled={partySize <= 1}
              style={{ width: 42, height: 42, borderRadius: "50%", background: DARK4, border: `1.5px solid ${DARK5}`, color: partySize <= 1 ? DARK3 : DARK, fontSize: 20, cursor: partySize <= 1 ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "transform .12s" }}>−</button>
            <span style={{ fontSize: "2.8rem", fontWeight: 300, color: DARK, letterSpacing: "-0.02em", lineHeight: 1, fontVariantNumeric: "tabular-nums", minWidth: 48, textAlign: "center" }}>
              {partySize}
            </span>
            <button className="pm-btn" onClick={() => setPartySize(s => Math.min(20, s + 1))} disabled={partySize >= 20}
              style={{ width: 42, height: 42, borderRadius: "50%", background: DARK4, border: `1.5px solid ${DARK5}`, color: partySize >= 20 ? DARK3 : DARK, fontSize: 20, cursor: partySize >= 20 ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "transform .12s" }}>+</button>
          </div>
        </div>

        {/* Name */}
        <div style={{ flexShrink: 0 }}>
          <div style={{ fontSize: ".57rem", fontWeight: 800, letterSpacing: ".24em", textTransform: "uppercase", color: DARK3, marginBottom: 7 }}>
            Name
          </div>
          <input className="wj-input" type="text" placeholder="Your name" value={name}
            onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()}
            autoComplete="name"
            style={{ width: "100%", borderRadius: 13, padding: "13px 15px", color: DARK, fontSize: ".95rem", boxSizing: "border-box", caretColor: DARK }} />
        </div>

        {/* Phone */}
        <div style={{ flexShrink: 0 }}>
          <div style={{ fontSize: ".57rem", fontWeight: 800, letterSpacing: ".24em", textTransform: "uppercase", color: DARK3, marginBottom: 7 }}>
            Phone <span style={{ fontWeight: 400, letterSpacing: ".02em", textTransform: "none", color: DARK3 }}>— optional</span>
          </div>
          <input className="wj-input" type="tel" placeholder="(720) 000-0000" value={phone}
            onChange={e => setPhone(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()}
            autoComplete="tel"
            style={{ width: "100%", borderRadius: 13, padding: "13px 15px", color: DARK, fontSize: ".95rem", boxSizing: "border-box", caretColor: DARK }} />
          <p style={{ fontSize: 10, color: DARK3, marginTop: 6 }}>
            By providing your number you agree to receive SMS updates. Reply STOP to opt out.
          </p>
        </div>
      </div>

      {/* ── CTA ── */}
      <div style={{ padding: "14px 22px 28px", flexShrink: 0 }}>
        {error && <p style={{ textAlign: "center", fontSize: ".78rem", color: "rgba(180,40,40,0.9)", marginBottom: 10 }}>{error}</p>}
        <button className="cta-btn" onClick={submit} disabled={loading || joined}
          style={{ width: "100%", height: 60, borderRadius: 18, background: loading || joined ? DARK2 : DARK, color: BG, fontWeight: 800, fontSize: ".95rem", letterSpacing: ".12em", textTransform: "uppercase", border: "none", cursor: loading || joined ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "transform .12s" }}>
          {loading && !joined
            ? <Loader2 style={{ width: 20, height: 20, animation: "spin 1s linear infinite" }} />
            : "Join Waitlist"}
        </button>

        <button className="menu-btn" onClick={() => setMenuOpen(true)}
          style={{ width: "100%", height: 48, marginTop: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, background: "transparent", border: `1px solid ${DARK5}`, borderRadius: 14, cursor: "pointer", color: DARK2, fontSize: ".82rem", fontWeight: 600, letterSpacing: ".04em", transition: "transform .12s" }}>
          <UtensilsCrossed size={14} style={{ opacity: 0.7 }} />
          View Menu
        </button>

        <p style={{ textAlign: "center", marginTop: 10, fontSize: ".66rem", color: DARK3, letterSpacing: ".06em" }}>
          HOST · No app download needed
        </p>
      </div>

      {/* ── Success overlay ── */}
      {joined && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: BG, animation: "overlayIn 0.28s cubic-bezier(0.4,0,0.2,1) both" }}>
          <p style={{ fontSize: 10, letterSpacing: "0.55em", textTransform: "uppercase", color: DARK3, marginBottom: 14, animation: "subtleUp 0.45s 0.18s ease-out both" }}>
            You&apos;re in the queue
          </p>
          <p style={{ fontSize: 64, fontWeight: 900, letterSpacing: "0.28em", color: DARK, lineHeight: 1, animation: "logoStamp 0.5s 0.26s cubic-bezier(0.34,1.56,0.64,1) both" }}>
            HOST
          </p>
          <p style={{ fontSize: 11, letterSpacing: "0.18em", color: DARK3, marginTop: 20, animation: "subtleUp 0.45s 0.45s ease-out both" }}>
            {phone.trim() ? "We\u2019ll text you when it\u2019s time." : "Check back anytime."}
          </p>
        </div>
      )}

      {/* ── Menu Drawer ── */}
      {menuOpen && <WalnutMenuDrawer onClose={() => setMenuOpen(false)} />}
    </div>
  )
}

// ── Menu Drawer ────────────────────────────────────────────────────────────────
function WalnutMenuDrawer({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState(0)
  const category = WALNUT_MENU[activeTab]

  return (
    <>
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, zIndex: 40,
        background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)", animation: "backdropIn 0.3s ease-out both",
      }} />

      <div style={{
        position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 50,
        height: "90dvh", background: "#0D0D0D",
        borderRadius: "22px 22px 0 0", border: "1px solid rgba(255,255,255,0.09)",
        borderBottom: "none", display: "flex", flexDirection: "column", overflow: "hidden",
        animation: "sheetUp 0.42s cubic-bezier(0.32,0.72,0,1) both",
      }}>
        {/* Drag handle */}
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 14, paddingBottom: 4, flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.12)" }} />
        </div>

        {/* Sheet header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 24px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0,
        }}>
          <div>
            <p style={{ fontSize: 10, letterSpacing: "0.35em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 3 }}>
              The Walnut Cafe
            </p>
            <p style={{ fontSize: 22, fontWeight: 700, color: "white", letterSpacing: "0.01em" }}>Menu</p>
          </div>
          <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.07)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.6)" }}>
            <X size={16} />
          </button>
        </div>

        {/* Category tabs */}
        <div style={{
          display: "flex", gap: 6, padding: "12px 20px",
          borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0,
          overflowX: "auto", WebkitOverflowScrolling: "touch" as never,
        }}>
          {WALNUT_MENU.map((cat, i) => (
            <button key={cat.label} onClick={() => setActiveTab(i)}
              style={{
                padding: "7px 16px", borderRadius: 20, border: "none", cursor: "pointer",
                fontSize: ".78rem", fontWeight: 700, whiteSpace: "nowrap" as never,
                flexShrink: 0,
                background: activeTab === i ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.08)",
                color: activeTab === i ? "#0D0D0D" : "rgba(255,255,255,0.55)",
                transition: "background .15s, color .15s",
              }}>
              {cat.label}
            </button>
          ))}
        </div>

        {/* Scrollable menu sections */}
        <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" as never, padding: "8px 0 40px" }}>
          {category.sections.map((section, si) => (
            <div key={section.title} style={{ padding: "20px 24px 0", animation: `menuItemIn 0.35s ${si * 0.05}s ease-out both` }}>
              <p style={{ fontSize: 10, letterSpacing: "0.4em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", fontWeight: 700, marginBottom: 14 }}>
                {section.title}
              </p>
              {section.items.map((item, ii) => (
                <div key={item.name}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, paddingBottom: 14 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.9)", marginBottom: item.desc ? 3 : 0 }}>{item.name}</p>
                      {item.desc && <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", lineHeight: 1.5 }}>{item.desc}</p>}
                    </div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.6)", whiteSpace: "nowrap" as never, marginTop: 2, flexShrink: 0 }}>
                      {item.price}
                    </p>
                  </div>
                  {ii < section.items.length - 1 && (
                    <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", marginBottom: 14 }} />
                  )}
                </div>
              ))}
              {si < category.sections.length - 1 && (
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.09)", marginTop: 8 }} />
              )}
            </div>
          ))}
          <p style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.15)", padding: "28px 24px 0", letterSpacing: "0.1em" }}>
            Ask your server about daily specials &amp; dietary options
          </p>
        </div>
      </div>
    </>
  )
}
