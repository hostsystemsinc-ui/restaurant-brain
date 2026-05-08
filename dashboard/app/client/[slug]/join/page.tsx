"use client"

import { useState, useEffect, useCallback, Suspense } from "react"
import { useRouter, useSearchParams, useParams } from "next/navigation"

const API = "https://restaurant-brain-production.up.railway.app"

interface GuestConfig {
  bgColor:         string
  accentColor:     string
  buttonTextColor: string
  restaurantName:  string
  tagline:         string
  waitMessages:    string[]
  seatedMessage:   string
  finalButtons:    Array<{ id: string; label: string; url: string; color: string }>
}

interface MenuSection {
  id:    string
  title: string
  items: Array<{ id: string; name: string; description: string; price: string; tags: string[] }>
}

interface LiveInfo {
  available: number
  waitMin: number | null
  ahead: number
}

const DEFAULT_CONFIG: GuestConfig = {
  bgColor: "#000000", accentColor: "#22c55e", buttonTextColor: "#ffffff",
  restaurantName: "Restaurant", tagline: "Powered by HOST",
  waitMessages: ["Your spot is saved — feel free to step out.", "We'll let you know the moment your table is ready.", "Sit tight, we're moving quickly."],
  seatedMessage: "Thanks for dining with us!",
  finalButtons: [],
}

export default function ClientJoinPage() {
  return (
    <Suspense>
      <ClientJoinInner />
    </Suspense>
  )
}

function ClientJoinInner() {
  const params       = useParams()
  const slug         = typeof params.slug === "string" ? params.slug : ""
  const router       = useRouter()
  const searchParams = useSearchParams()
  const src          = searchParams.get("src") ?? "qr"

  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [cfg,          setCfg]          = useState<GuestConfig>(DEFAULT_CONFIG)
  const [menuSections, setMenuSections] = useState<MenuSection[]>([])
  const [configLoaded, setConfigLoaded] = useState(false)
  const [live,         setLive]         = useState<LiveInfo | null>(null)

  const [name,      setName]      = useState("")
  const [phone,     setPhone]     = useState("")
  const [partySize, setPartySize] = useState(2)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState("")
  const [joined,    setJoined]    = useState(false)
  const [menuOpen,  setMenuOpen]  = useState(false)
  const [entryId,   setEntryId]   = useState<string | null>(null)

  // Load config by slug
  useEffect(() => {
    if (!slug) return
    fetch(`${API}/client/${encodeURIComponent(slug)}/config`)
      .then(r => r.json())
      .then(d => {
        setRestaurantId(d.restaurant_id)
        if (d.guest_config) setCfg({ ...DEFAULT_CONFIG, ...d.guest_config })
        if (d.menu_config?.sections) setMenuSections(d.menu_config.sections)
        setConfigLoaded(true)
      })
      .catch(() => setConfigLoaded(true))
  }, [slug])

  // Live queue/table info
  const fetchLive = useCallback(async () => {
    if (!restaurantId) return
    try {
      const [tRes, iRes] = await Promise.all([
        fetch(`${API}/tables?restaurant_id=${restaurantId}`),
        fetch(`${API}/insights?restaurant_id=${restaurantId}`),
      ])
      const tables   = tRes.ok ? await tRes.json() : []
      const insights = iRes.ok ? await iRes.json() : null
      const total    = Array.isArray(tables) ? tables.length : 0
      const occupied = Array.isArray(tables) ? tables.filter((t: { status: string }) => t.status !== "available").length : 0
      setLive({
        available: Math.max(0, total - occupied),
        ahead:     insights?.parties_waiting ?? 0,
        waitMin:   insights?.avg_wait_estimate > 0 ? insights.avg_wait_estimate : null,
      })
    } catch { /* non-critical */ }
  }, [restaurantId])

  useEffect(() => {
    if (restaurantId) {
      fetchLive()
      const id = setInterval(fetchLive, 30_000)
      return () => clearInterval(id)
    }
  }, [restaurantId, fetchLive])

  async function join() {
    if (!name.trim() || !phone.trim() || !restaurantId) { setError("Please enter your name and phone number"); return }
    setLoading(true); setError("")
    try {
      const r = await fetch(`${API}/queue/join`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim(), party_size: partySize, source: src, restaurant_id: restaurantId }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.detail || "Failed to join")
      setEntryId(d.entry_id || d.id || null)
      setJoined(true)
      if (d.entry_id || d.id) {
        setTimeout(() => router.push(`/wait/${d.entry_id || d.id}`), 1500)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const bg = cfg.bgColor || "#000"
  const accent = cfg.accentColor || "#22c55e"
  const btnColor = cfg.buttonTextColor || "#fff"
  const isDark = !bg.includes("F") && !bg.includes("f") && !bg.startsWith("#F") && !bg.startsWith("#E")
  const textColor = isDark ? "#fff" : "#111"
  const text2Color = isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)"
  const surfaceBg  = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"
  const borderColor = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)"
  const inputBg    = isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.05)"

  if (!configLoaded) {
    return (
      <div style={{ minHeight: "100dvh", background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid rgba(255,255,255,0.15)", borderTopColor: "#22c55e", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  // ── Menu overlay ──────────────────────────────────────────────────────────────
  if (menuOpen) {
    return (
      <div style={{ minHeight: "100dvh", background: bg, fontFamily: "system-ui, -apple-system, sans-serif" }}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 0", borderBottom: `1px solid ${borderColor}` }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: textColor, margin: 0 }}>Menu</h2>
            <button onClick={() => setMenuOpen(false)}
              style={{ background: surfaceBg, border: `1px solid ${borderColor}`, borderRadius: 8, color: textColor, fontSize: 14, padding: "6px 14px", cursor: "pointer" }}>
              ← Back
            </button>
          </div>
          {menuSections.length === 0 ? (
            <p style={{ color: text2Color, fontSize: 14, textAlign: "center", padding: "40px 0" }}>Menu not available</p>
          ) : menuSections.map(section => (
            <div key={section.id} style={{ marginTop: 28 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 12px" }}>{section.title}</h3>
              {section.items.map(item => (
                <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, paddingBottom: 14, borderBottom: `1px solid ${borderColor}` }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: textColor }}>{item.name}</div>
                    {item.description && <div style={{ fontSize: 13, color: text2Color, marginTop: 2 }}>{item.description}</div>}
                    {item.tags.length > 0 && (
                      <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
                        {item.tags.map(tag => (
                          <span key={tag} style={{ fontSize: 10, color: accent, background: accent + "20", borderRadius: 10, padding: "1px 7px" }}>{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  {item.price && <div style={{ fontSize: 15, fontWeight: 700, color: textColor, marginLeft: 16, flexShrink: 0 }}>{item.price}</div>}
                </div>
              ))}
            </div>
          ))}
          <div style={{ height: 40 }} />
        </div>
      </div>
    )
  }

  // ── Joined confirmation ──────────────────────────────────────────────────────
  if (joined) {
    return (
      <div style={{ minHeight: "100dvh", background: bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "system-ui, -apple-system, sans-serif", textAlign: "center" }}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ fontSize: 56, marginBottom: 20 }}>✓</div>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: textColor, margin: "0 0 8px" }}>You&apos;re on the list!</h2>
        <p style={{ fontSize: 15, color: text2Color, margin: "0 0 24px" }}>
          {cfg.waitMessages[0] || "Your spot is saved — feel free to step out."}
        </p>
        <p style={{ fontSize: 13, color: text2Color }}>Taking you to your wait page…</p>
        {entryId && (
          <button onClick={() => router.push(`/wait/${entryId}`)}
            style={{ marginTop: 20, padding: "12px 28px", borderRadius: 24, border: "none", background: accent, color: btnColor, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
            View My Wait →
          </button>
        )}
      </div>
    )
  }

  // ── Join form ────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100dvh", background: bg, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} input::placeholder{color:${text2Color}}`}</style>
      <div style={{ maxWidth: 420, margin: "0 auto", padding: "0 20px" }}>

        {/* Header */}
        <div style={{ textAlign: "center", padding: "48px 0 32px" }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: textColor, margin: "0 0 8px", letterSpacing: "-0.02em" }}>
            {cfg.restaurantName}
          </h1>
          <p style={{ fontSize: 14, color: text2Color, margin: "0 0 20px" }}>{cfg.tagline}</p>

          {/* Live status pill */}
          {live && (
            <div style={{ display: "inline-flex", gap: 16, background: surfaceBg, border: `1px solid ${borderColor}`, borderRadius: 20, padding: "8px 18px", fontSize: 13, color: text2Color }}>
              {live.available > 0
                ? <span>🪑 {live.available} table{live.available !== 1 ? "s" : ""} open</span>
                : <span>🔴 Full right now</span>}
              {live.ahead > 0 && <span>· {live.ahead} ahead</span>}
              {live.waitMin && <span>· ~{Math.round(live.waitMin)}m wait</span>}
            </div>
          )}
        </div>

        {/* Form */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Party size */}
          <div style={{ background: surfaceBg, border: `1px solid ${borderColor}`, borderRadius: 14, padding: "16px 18px" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: text2Color, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Party Size</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[1,2,3,4,5,6,7,8].map(n => (
                <button key={n} onClick={() => setPartySize(n)}
                  style={{ width: 44, height: 44, borderRadius: 10, border: `2px solid ${partySize === n ? accent : borderColor}`,
                    background: partySize === n ? accent + "20" : "transparent",
                    color: partySize === n ? accent : text2Color,
                    fontSize: 16, fontWeight: 700, cursor: "pointer", transition: "all 0.12s" }}>
                  {n}
                </button>
              ))}
              {partySize > 8 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, width: "100%" }}>
                  <input type="number" value={partySize} onChange={e => setPartySize(Math.max(1, parseInt(e.target.value) || 1))} min={1} max={20}
                    style={{ width: 80, padding: "10px 12px", borderRadius: 10, border: `1px solid ${accent}`, background: inputBg, color: textColor, fontSize: 16, fontWeight: 700, outline: "none", textAlign: "center" }} />
                  <span style={{ color: text2Color, fontSize: 13 }}>guests</span>
                </div>
              )}
            </div>
            {partySize <= 8 && partySize >= 8 && (
              <button onClick={() => setPartySize(9)}
                style={{ marginTop: 10, background: "none", border: "none", color: accent, fontSize: 13, cursor: "pointer", padding: 0, textDecoration: "underline" }}>
                Larger party?
              </button>
            )}
          </div>

          {/* Name */}
          <input
            placeholder="Your name"
            value={name}
            onChange={e => setName(e.target.value)}
            style={{ padding: "14px 18px", borderRadius: 12, border: `1px solid ${borderColor}`, background: inputBg, color: textColor, fontSize: 16, outline: "none", width: "100%", boxSizing: "border-box" }}
          />

          {/* Phone */}
          <input
            placeholder="Phone number (for your text alert)"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            type="tel"
            style={{ padding: "14px 18px", borderRadius: 12, border: `1px solid ${borderColor}`, background: inputBg, color: textColor, fontSize: 16, outline: "none", width: "100%", boxSizing: "border-box" }}
          />

          {error && <div style={{ fontSize: 14, color: "#ef4444", textAlign: "center" }}>{error}</div>}

          {/* Join button */}
          <button onClick={join} disabled={loading}
            style={{ padding: "16px 0", borderRadius: 14, border: "none", background: loading ? text2Color : accent,
              color: btnColor, fontSize: 17, fontWeight: 800, cursor: loading ? "default" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10, transition: "opacity 0.15s" }}>
            {loading ? (
              <>
                <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", animation: "spin 0.8s linear infinite" }} />
                Joining…
              </>
            ) : "Join Waitlist →"}
          </button>

          {/* Menu link */}
          {menuSections.length > 0 && (
            <button onClick={() => setMenuOpen(true)}
              style={{ background: "none", border: "none", color: accent, fontSize: 14, cursor: "pointer", textDecoration: "underline", padding: "4px 0" }}>
              📋 View Menu
            </button>
          )}

          <p style={{ fontSize: 11, color: text2Color, textAlign: "center", margin: "4px 0 0", lineHeight: 1.5 }}>
            By joining you agree to receive a one-time text message when your table is ready.
            Reply STOP to opt out.
          </p>
        </div>
        <div style={{ height: 40 }} />
      </div>
    </div>
  )
}
