"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Loader2, UtensilsCrossed, X } from "lucide-react"

const API                = "https://restaurant-brain-production.up.railway.app"
const DEMO_RESTAURANT_ID = "dec0cafe-0000-4000-8000-000000000001"
const DEMO_NAME          = "Demo Restaurant"
const TOTAL_TABLES       = 16

interface LiveInfo {
  available: number
  waitMin:   number | null
  ahead:     number
}

// ── Menu data ─────────────────────────────────────────────────────────────
const MENU_SECTIONS = [
  {
    title: "Starters",
    items: [
      { name: "Charcuterie & Cheese",    desc: "Cured meats, artisan cheeses, seasonal accompaniments, grilled bread", price: "$24" },
      { name: "Roasted Bone Marrow",     desc: "Charred sourdough, chimichurri, fleur de sel",                          price: "$18" },
      { name: "Crispy Calamari",         desc: "Lemon aioli, fresno chili, fresh herbs",                                 price: "$16" },
      { name: "Soup of the Day",         desc: "Ask your server for today's selection",                                  price: "$12" },
    ],
  },
  {
    title: "Mains",
    items: [
      { name: "303 Wagyu Burger",        desc: "8oz wagyu patty, aged cheddar, caramelized onion, house pickles, brioche", price: "$22" },
      { name: "Pan-Seared Salmon",       desc: "Lemon beurre blanc, broccolini, roasted fingerling potatoes",              price: "$32" },
      { name: "Braised Short Rib",       desc: "Truffle polenta, crispy shallots, red wine reduction",                     price: "$42" },
      { name: "Pasta Cacio e Pepe",      desc: "Housemade tagliatelle, aged pecorino, freshly cracked pepper",             price: "$26" },
      { name: "Free-Range Half Chicken", desc: "Herb-roasted, pan jus, seasonal vegetables",                              price: "$28" },
    ],
  },
  {
    title: "Sides",
    items: [
      { name: "Truffle Fries",           desc: "Parmesan, fresh herbs, house aioli",              price: "$12" },
      { name: "Roasted Brussels",        desc: "Bacon lardons, balsamic glaze, toasted almonds", price: "$11" },
      { name: "Mac & Cheese",            desc: "Four cheese blend, breadcrumb crust",             price: "$14" },
    ],
  },
  {
    title: "Cocktails",
    items: [
      { name: "303 Old Fashioned",       desc: "Rye whiskey, chocolate bitters, smoked cherry, orange peel", price: "$16" },
      { name: "Colorado Mule",           desc: "Vodka, ginger beer, fresh lime, mint",                        price: "$14" },
      { name: "Aperol Spritz",           desc: "Aperol, prosecco, soda water, orange",                        price: "$13" },
      { name: "Seasonal Margarita",      desc: "Blanco tequila, fresh citrus, seasonal fruit, salted rim",    price: "$15" },
    ],
  },
  {
    title: "Wine & Beer",
    items: [
      { name: "Wine by the Glass",       desc: "Red, white, rosé, and sparkling selections",         price: "From $11" },
      { name: "Local Draft Beer",        desc: "Rotating Colorado craft selections on tap",           price: "From $8"  },
      { name: "Bottle of Wine",          desc: "Curated list — ask your server for the wine menu",   price: "From $38" },
    ],
  },
]

export default function DemoJoinPage() {
  const router = useRouter()
  const [partySize,   setPartySize]   = useState(2)
  const [name,        setName]        = useState("")
  const [phone,       setPhone]       = useState("")
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState("")
  const [live,        setLive]        = useState<LiveInfo | null>(null)
  const [joined,      setJoined]      = useState(false)
  const [menuOpen,    setMenuOpen]    = useState(false)

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

  // Redirect back to wait page if guest already joined and is still active
  useEffect(() => {
    const storedId = sessionStorage.getItem("host_wait_id")
    if (!storedId) return
    fetch(`${API}/queue/${storedId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && (data.status === "waiting" || data.status === "ready")) {
          router.replace(`/wait/${storedId}`)
        } else {
          sessionStorage.removeItem("host_wait_id")
        }
      })
      .catch(() => sessionStorage.removeItem("host_wait_id"))
  }, [router])

  // Prevent body scroll when menu is open
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
          restaurant_id: DEMO_RESTAURANT_ID,
        }),
      })
      clearTimeout(timeout)
      if (!res.ok) throw new Error()
      const data = await res.json()
      sessionStorage.setItem("host_wait_id", data.entry.id)
      setJoined(true)
      setTimeout(() => router.push(`/wait/${data.entry.id}`), 1050)
    } catch (err: unknown) {
      clearTimeout(timeout)
      const isTimeout = err instanceof Error && err.name === "AbortError"
      setError(isTimeout ? "Request timed out. Please check your connection and try again." : "Something went wrong. Please try again.")
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
        @keyframes sheetUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        @keyframes backdropIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes menuItemIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .jf-input { transition: border-color .15s; }
        .jf-input:focus { outline:none; border-color:rgba(255,255,255,0.35) !important; }
        .pm-btn:active:not(:disabled) { transform:scale(0.90) !important; }
        .cta-btn:active:not(:disabled) { transform:scale(0.98) !important; }
        .menu-btn:active { transform:scale(0.97) !important; }
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
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 6 }}>
            By providing your number you agree to receive SMS updates. Reply STOP to opt out.
          </p>
        </div>
      </div>

      {/* ── CTA ── */}
      <div style={{ padding: "14px 22px 28px", flexShrink: 0 }}>
        {error && <p style={{ textAlign: "center", fontSize: ".78rem", color: "rgba(255,90,90,0.9)", marginBottom: 10 }}>{error}</p>}
        <button className="cta-btn" onClick={submit} disabled={loading || joined}
          style={{ width: "100%", height: 60, borderRadius: 18, background: loading || joined ? "rgba(255,255,255,0.26)" : "#fff", color: "#000", fontWeight: 800, fontSize: ".95rem", letterSpacing: ".12em", textTransform: "uppercase", border: "none", cursor: loading || joined ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "transform .12s" }}>
          {loading && !joined
            ? <Loader2 style={{ width: 20, height: 20, animation: "spin 1s linear infinite" }} />
            : "Join Waitlist"}
        </button>

        {/* View Menu ghost button */}
        <button
          className="menu-btn"
          onClick={() => setMenuOpen(true)}
          style={{
            width: "100%", height: 48, marginTop: 10,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 14, cursor: "pointer",
            color: "rgba(255,255,255,0.42)",
            fontSize: ".82rem", fontWeight: 600, letterSpacing: ".04em",
            transition: "transform .12s",
          }}
        >
          <UtensilsCrossed size={14} style={{ opacity: 0.7 }} />
          View Menu
        </button>

        <p style={{ textAlign: "center", marginTop: 10, fontSize: ".66rem", color: "rgba(255,255,255,0.16)", letterSpacing: ".06em" }}>
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

      {/* ── Menu Drawer ── */}
      {menuOpen && <JoinMenuDrawer onClose={() => setMenuOpen(false)} />}
    </div>
  )
}

// ── Menu Drawer ────────────────────────────────────────────────────────────
function JoinMenuDrawer({ onClose }: { onClose: () => void }) {
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 40,
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          animation: "backdropIn 0.3s ease-out both",
        }}
      />

      {/* Sheet */}
      <div
        style={{
          position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 50,
          height: "88dvh",
          background: "#0D0D0D",
          borderRadius: "22px 22px 0 0",
          border: "1px solid rgba(255,255,255,0.09)",
          borderBottom: "none",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          animation: "sheetUp 0.42s cubic-bezier(0.32, 0.72, 0, 1) both",
        }}
      >
        {/* Drag handle */}
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 14, paddingBottom: 4, flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.12)" }} />
        </div>

        {/* Sheet header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 24px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          flexShrink: 0,
        }}>
          <div>
            <p style={{ fontSize: 10, letterSpacing: "0.35em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 3 }}>
              Demo Restaurant
            </p>
            <p style={{ fontSize: 22, fontWeight: 700, color: "white", letterSpacing: "0.01em" }}>Menu</p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 36, height: 36, borderRadius: "50%",
              background: "rgba(255,255,255,0.07)",
              border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "rgba(255,255,255,0.6)",
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable menu */}
        <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" as never, padding: "8px 0 40px" }}>
          {MENU_SECTIONS.map((section, si) => (
            <div key={section.title} style={{ padding: "20px 24px 0", animation: `menuItemIn 0.4s ${si * 0.06}s ease-out both` }}>
              <p style={{
                fontSize: 10, letterSpacing: "0.4em", textTransform: "uppercase",
                color: "rgba(255,255,255,0.35)", fontWeight: 700,
                marginBottom: 14,
              }}>
                {section.title}
              </p>

              {section.items.map((item, ii) => (
                <div key={item.name}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, paddingBottom: 14 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.9)", marginBottom: 3 }}>{item.name}</p>
                      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", lineHeight: 1.5 }}>{item.desc}</p>
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

              {si < MENU_SECTIONS.length - 1 && (
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
