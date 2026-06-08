"use client"

import { useState, useEffect, useCallback, Suspense } from "react"
import { useRouter, useSearchParams, useParams } from "next/navigation"
import { Loader2, UtensilsCrossed, X } from "lucide-react"

const API = "https://restaurant-brain-production.up.railway.app"

interface GuestConfig {
  bgColor:         string
  darkColor?:      string
  accentColor?:    string
  buttonTextColor: string
  restaurantName:  string
  tagline?:        string
  logoUrl?:        string
  waitMessages?:   string[]
  seatedMessage?:  string
}

interface MenuSection {
  id:    string
  title: string
  items: Array<{ id: string; name: string; description?: string; price?: string; tags?: string[] }>
}

interface LiveInfo {
  available: number
  waitMin:   number | null
  ahead:     number
}

interface SectionsConfig {
  enabled:  boolean
  sections: string[]
}

const DEFAULT_CONFIG: GuestConfig = {
  bgColor:         "#000000",
  accentColor:     "#ffffff",
  buttonTextColor: "#000000",
  restaurantName:  "Restaurant",
  tagline:         "Powered by HOST",
  logoUrl:         "",
}

const formatPhone = (val: string) => {
  const d = val.replace(/\D/g, "").slice(0, 10)
  if (d.length <= 3) return d
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
}

function hexToRgba(hex: string, alpha: number): string {
  const h = (hex || "#000000").replace("#", "").padEnd(6, "0")
  const r = parseInt(h.slice(0, 2), 16) || 0
  const g = parseInt(h.slice(2, 4), 16) || 0
  const b = parseInt(h.slice(4, 6), 16) || 0
  return `rgba(${r},${g},${b},${alpha})`
}

function bgLuminance(hex: string): number {
  const h = (hex || "#000000").replace("#", "").padEnd(6, "0")
  const lin = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  return 0.2126 * lin(parseInt(h.slice(0,2),16)/255)
       + 0.7152 * lin(parseInt(h.slice(2,4),16)/255)
       + 0.0722 * lin(parseInt(h.slice(4,6),16)/255)
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

  const [restaurantId,   setRestaurantId]   = useState<string | null>(null)
  const [cfg,            setCfg]            = useState<GuestConfig>(DEFAULT_CONFIG)
  const [menuSections,   setMenuSections]   = useState<MenuSection[]>([])
  const [configLoaded,   setConfigLoaded]   = useState(false)
  const [live,           setLive]           = useState<LiveInfo | null>(null)
  const [sectionsConfig, setSectionsConfig] = useState<SectionsConfig | null>(null)
  const [selectedSection, setSelectedSection] = useState<string>("anywhere")
  const [sectionCounts,  setSectionCounts]  = useState<Record<string, number>>({})

  const [name,      setName]      = useState("")
  const [phone,     setPhone]     = useState("")
  const [partySize, setPartySize] = useState(2)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState("")
  const [joined,    setJoined]    = useState(false)
  const [menuOpen,  setMenuOpen]  = useState(false)
  const [entryId,   setEntryId]   = useState<string | null>(null)

  useEffect(() => {
    if (!slug) return
    fetch(`${API}/client/${encodeURIComponent(slug)}/config`, { cache: "no-store" })
      .then(r => r.json())
      .then(d => {
        setRestaurantId(d.restaurant_id)
        if (d.guest_config) setCfg({ ...DEFAULT_CONFIG, ...d.guest_config })
        if (d.menu_config?.sections) setMenuSections(d.menu_config.sections)
        setConfigLoaded(true)
      })
      .catch(() => setConfigLoaded(true))
  }, [slug])

  useEffect(() => {
    if (!restaurantId) return
    fetch(`${API}/sections?restaurant_id=${restaurantId}`)
      .then(r => r.json())
      .then(d => setSectionsConfig(d))
      .catch(() => {})
  }, [restaurantId])

  const fetchLive = useCallback(async () => {
    if (!restaurantId) return
    try {
      const [tRes, iRes, qRes] = await Promise.all([
        fetch(`${API}/tables?restaurant_id=${restaurantId}`),
        fetch(`${API}/insights?restaurant_id=${restaurantId}`),
        fetch(`${API}/queue?restaurant_id=${restaurantId}`),
      ])
      const tables   = tRes.ok ? await tRes.json() : []
      const insights = iRes.ok ? await iRes.json() : null
      const queueRaw = qRes.ok ? await qRes.json() : []
      const total    = Array.isArray(tables) ? tables.length : 0
      const occupied = Array.isArray(tables) ? tables.filter((t: { status: string }) => t.status !== "available").length : 0

      const waiting: { status: string; section_preference?: string | null }[] =
        Array.isArray(queueRaw) ? queueRaw.filter((e: { status: string }) => e.status === "waiting") : []
      const counts: Record<string, number> = { anywhere: waiting.length }
      for (const e of waiting) {
        if (e.section_preference) counts[e.section_preference] = (counts[e.section_preference] ?? 0) + 1
      }
      setSectionCounts(counts)

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
      const id = setInterval(fetchLive, 20_000)
      return () => clearInterval(id)
    }
  }, [restaurantId, fetchLive])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [menuOpen])

  async function join() {
    if (!name.trim() || !restaurantId) { setError("Please enter your name"); return }
    setLoading(true); setError("")
    const controller = new AbortController()
    const timeout    = setTimeout(() => controller.abort(), 10_000)
    try {
      const r = await fetch(`${API}/queue/join`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        signal:  controller.signal,
        body:    JSON.stringify({
          name:               name.trim(),
          phone:              phone.trim() || null,
          party_size:         partySize,
          source:             src,
          restaurant_id:      restaurantId,
          section_preference: sectionsConfig?.enabled && selectedSection !== "anywhere" ? selectedSection : null,
        }),
      })
      clearTimeout(timeout)
      const d = await r.json()
      if (!r.ok) throw new Error(d.detail || "Failed to join")
      const id = d.entry?.id ?? d.entry_id ?? d.id ?? null
      setEntryId(id)
      if (id) sessionStorage.setItem(`host_wait_id_${slug}`, id)
      setJoined(true)
      if (id) setTimeout(() => router.push(`/wait/${id}`), 1200)
    } catch (e: unknown) {
      clearTimeout(timeout)
      const isTimeout = e instanceof Error && e.name === "AbortError"
      setError(isTimeout ? "Request timed out. Please try again." : "Something went wrong. Please try again.")
      setLoading(false)
    }
  }

  // ── Theme derivation ───────────────────────────────────────────────────────────
  const BG       = cfg.bgColor || "#000000"
  const lum      = bgLuminance(BG)
  const isDark   = lum < 0.25
  const DARK     = isDark ? "" : (cfg.darkColor || "#111111")
  const ACCENT   = isDark ? (cfg.accentColor || "#ffffff") : (cfg.darkColor || "#111111")
  const BTN_TEXT = isDark ? (cfg.buttonTextColor || "#000000") : BG
  const TXT      = isDark ? "rgba(255,255,255,0.92)" : DARK
  const TXT2     = isDark ? "rgba(255,255,255,0.55)" : hexToRgba(DARK, 0.55)
  const TXT3     = isDark ? "rgba(255,255,255,0.28)" : hexToRgba(DARK, 0.28)
  const SURFACE  = isDark ? "rgba(255,255,255,0.04)" : hexToRgba(DARK, 0.05)
  const BORDER   = isDark ? "rgba(255,255,255,0.10)" : hexToRgba(DARK, 0.10)

  if (!configLoaded) {
    return (
      <div style={{ minHeight: "100dvh", background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.10)", borderTopColor: "rgba(255,255,255,0.6)", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  if (joined) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: BG, animation: "overlayIn 0.28s ease both" }}>
        <style>{`@keyframes overlayIn{from{opacity:0}to{opacity:1}} @keyframes logoStamp{0%{opacity:0;transform:scale(0.85) translateY(4px)} 60%{opacity:1;transform:scale(1.04) translateY(0)} 100%{opacity:1;transform:scale(1) translateY(0)}} @keyframes subtleUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <p style={{ fontSize: 10, letterSpacing: "0.55em", textTransform: "uppercase", color: TXT3, marginBottom: 14, animation: "subtleUp 0.45s 0.18s ease-out both" }}>You&apos;re in the queue</p>
        <p style={{ fontSize: 64, fontWeight: 900, letterSpacing: "0.28em", color: TXT, lineHeight: 1, animation: "logoStamp 0.5s 0.26s cubic-bezier(0.34,1.56,0.64,1) both" }}>HOST</p>
        <p style={{ fontSize: 11, letterSpacing: "0.18em", color: TXT3, marginTop: 20, animation: "subtleUp 0.45s 0.45s ease-out both" }}>
          {phone.trim() ? "We'll text you when it's time." : "Check back anytime."}
        </p>
        {entryId && (
          <button onClick={() => router.push(`/wait/${entryId}`)}
            style={{ marginTop: 28, padding: "12px 28px", borderRadius: 24, border: "none", background: ACCENT, color: BTN_TEXT, fontSize: 14, fontWeight: 700, cursor: "pointer", letterSpacing: "0.08em" }}>
            View Wait Status →
          </button>
        )}
      </div>
    )
  }

  // ── Join form ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ height: "100dvh", background: BG, color: TXT, fontFamily: "system-ui, -apple-system, sans-serif", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes sheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @keyframes backdropIn{from{opacity:0}to{opacity:1}}
        @keyframes menuItemIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        .jw-input{background:${SURFACE};border:1px solid ${BORDER};color:${TXT};transition:border-color .15s;}
        .jw-input:focus{outline:none;border-color:${TXT2} !important;}
        .jw-input::placeholder{color:${TXT3};}
        .pm-btn:active:not(:disabled){transform:scale(0.88) !important;}
        .cta-btn:active:not(:disabled){transform:scale(0.98) !important;}
      `}</style>

      {/* HOST Wordmark */}
      <div style={{ textAlign: "center", paddingTop: 16, flexShrink: 0 }}>
        <div style={{ fontSize: "clamp(1.8rem,7vw,2.4rem)", fontWeight: 900, letterSpacing: "0.08em", color: TXT, lineHeight: 1 }}>HOST</div>
        <div style={{ fontSize: ".55rem", fontWeight: 700, letterSpacing: ".28em", textTransform: "uppercase", color: TXT3, marginTop: 3 }}>Restaurant Operating System</div>
      </div>

      {/* Logo */}
      {cfg.logoUrl && (
        <div style={{ textAlign: "center", padding: "10px 24px 0", flexShrink: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cfg.logoUrl} alt={cfg.restaurantName} style={{ height: 72, objectFit: "contain", display: "inline-block" }} />
        </div>
      )}

      {/* Restaurant name badge + live info */}
      <div style={{ textAlign: "center", padding: `${cfg.logoUrl ? 10 : 16}px 24px 0`, flexShrink: 0 }}>
        <div style={{ display: "inline-block", padding: "5px 18px", border: `1px solid ${BORDER}`, borderRadius: 12, background: SURFACE }}>
          <div style={{ fontSize: ".76rem", fontWeight: 800, letterSpacing: "0.14em", color: TXT }}>{cfg.restaurantName.toUpperCase()}</div>
        </div>
        {cfg.tagline && cfg.tagline !== "Powered by HOST" && (
          <div style={{ fontSize: ".7rem", color: TXT3, marginTop: 5 }}>{cfg.tagline}</div>
        )}
        {live !== null && (() => {
          const count = sectionsConfig?.enabled && sectionsConfig.sections.length > 0
            ? (sectionCounts[selectedSection] ?? 0)
            : live.ahead
          if (count === 0 && !live.waitMin) return null
          return (
            <div style={{ marginTop: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, fontSize: ".78rem" }}>
              <span style={{ fontWeight: 700, color: TXT2 }}>{count} {count === 1 ? "party" : "parties"} ahead</span>
              {count > 0 && live.waitMin && <span style={{ color: TXT3 }}>·</span>}
              {count > 0 && live.waitMin && <span style={{ color: TXT3 }}>~{Math.round(live.waitMin)}m wait</span>}
            </div>
          )
        })()}
      </div>

      {/* Form */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 10, padding: "14px 22px 0", overflowY: "auto" }}>

        {/* Party size stepper */}
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: "12px 16px 14px", flexShrink: 0 }}>
          <div style={{ fontSize: ".57rem", fontWeight: 800, letterSpacing: ".24em", textTransform: "uppercase", color: TXT3, marginBottom: 10 }}>Party Size</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <button className="pm-btn" onClick={() => setPartySize(s => Math.max(1, s - 1))} disabled={partySize <= 1}
              style={{ width: 42, height: 42, borderRadius: "50%", background: SURFACE, border: `1.5px solid ${BORDER}`, color: partySize <= 1 ? TXT3 : TXT, fontSize: 22, cursor: partySize <= 1 ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "transform .12s" }}>
              −
            </button>
            <span style={{ fontSize: "2.6rem", fontWeight: 300, color: TXT, letterSpacing: "-0.02em", lineHeight: 1, fontVariantNumeric: "tabular-nums", minWidth: 48, textAlign: "center" }}>
              {partySize}
            </span>
            <button className="pm-btn" onClick={() => setPartySize(s => Math.min(20, s + 1))} disabled={partySize >= 20}
              style={{ width: 42, height: 42, borderRadius: "50%", background: SURFACE, border: `1.5px solid ${BORDER}`, color: partySize >= 20 ? TXT3 : TXT, fontSize: 22, cursor: partySize >= 20 ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "transform .12s" }}>
              +
            </button>
          </div>
        </div>

        {/* Section picker */}
        {sectionsConfig?.enabled && sectionsConfig.sections.length > 0 && (
          <div style={{ flexShrink: 0, paddingLeft: 2 }}>
            <div style={{ fontSize: ".57rem", fontWeight: 800, letterSpacing: ".24em", textTransform: "uppercase", color: TXT3, marginBottom: 7 }}>Seating Preference</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {["anywhere", ...sectionsConfig.sections].map(sec => {
                const label    = sec === "anywhere" ? "Sit Anywhere" : sec
                const count    = sectionCounts[sec] ?? 0
                const isActive = selectedSection === sec
                return (
                  <button key={sec} onClick={() => setSelectedSection(sec)} style={{
                    padding: "5px 13px", borderRadius: 20,
                    background: isActive ? ACCENT : "transparent",
                    border: `1.5px solid ${isActive ? ACCENT : BORDER}`,
                    color: isActive ? BTN_TEXT : TXT2,
                    fontSize: ".78rem", fontWeight: 700, cursor: "pointer",
                    display: "inline-flex", alignItems: "center", gap: 5,
                    transition: "all .12s",
                  }}>
                    {label}
                    <span style={{ fontSize: ".65rem", fontWeight: 400, opacity: 0.7 }}>
                      {count === 0 ? "no wait" : `${count} ahead`}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Name */}
        <div style={{ flexShrink: 0 }}>
          <div style={{ fontSize: ".57rem", fontWeight: 800, letterSpacing: ".24em", textTransform: "uppercase", color: TXT3, marginBottom: 7 }}>Name</div>
          <input className="jw-input" type="text" placeholder="Your name" value={name}
            onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && join()} autoComplete="name"
            style={{ width: "100%", borderRadius: 13, padding: "13px 15px", fontSize: ".95rem", boxSizing: "border-box" as const, caretColor: TXT }} />
        </div>

        {/* Phone */}
        <div style={{ flexShrink: 0 }}>
          <div style={{ fontSize: ".57rem", fontWeight: 800, letterSpacing: ".24em", textTransform: "uppercase", color: TXT3, marginBottom: 7 }}>
            Phone <span style={{ fontWeight: 400, letterSpacing: ".02em", textTransform: "none", color: TXT3 }}>— optional</span>
          </div>
          <input className="jw-input" type="tel" placeholder="(720) 000-0000" value={phone}
            onChange={e => setPhone(formatPhone(e.target.value))} onKeyDown={e => e.key === "Enter" && join()} autoComplete="tel"
            style={{ width: "100%", borderRadius: 13, padding: "13px 15px", fontSize: ".95rem", boxSizing: "border-box" as const, caretColor: TXT }} />
          <p style={{ fontSize: 10, color: TXT3, marginTop: 5, lineHeight: 1.4 }}>By providing your number, you agree to receive an SMS from the restaurant (via HOST) when your table is ready — about one message per visit. Message and data rates may apply. Reply STOP to opt out, HELP for help.</p>
        </div>
      </div>

      {/* CTA */}
      <div style={{ padding: "12px 22px 20px", flexShrink: 0 }}>
        {error && <p style={{ textAlign: "center", fontSize: ".78rem", color: "rgba(220,60,60,0.9)", marginBottom: 8 }}>{error}</p>}
        <button className="cta-btn" onClick={join} disabled={loading || joined}
          style={{ width: "100%", height: 52, borderRadius: 18, background: loading ? hexToRgba(ACCENT, 0.6) : ACCENT, color: BTN_TEXT, fontWeight: 800, fontSize: ".95rem", letterSpacing: ".12em", textTransform: "uppercase", border: "none", cursor: loading ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "transform .12s" }}>
          {loading
            ? <><Loader2 style={{ width: 20, height: 20, animation: "spin 1s linear infinite" }} /> Joining…</>
            : "Join Waitlist"}
        </button>

        {menuSections.length > 0 && (
          <button onClick={() => setMenuOpen(true)}
            style={{ width: "100%", height: 40, marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, background: "transparent", border: `1px solid ${BORDER}`, borderRadius: 14, cursor: "pointer", color: TXT2, fontSize: ".82rem", fontWeight: 600, letterSpacing: ".04em", transition: "opacity .15s" }}>
            <UtensilsCrossed size={14} style={{ opacity: 0.7 }} />
            View Menu
          </button>
        )}

        <p style={{ textAlign: "center", marginTop: 7, fontSize: ".62rem", color: TXT3, letterSpacing: ".06em" }}>
          HOST · No app download needed
        </p>
      </div>

      {/* Menu drawer */}
      {menuOpen && (
        <MenuDrawer
          sections={menuSections}
          restaurantName={cfg.restaurantName}
          onClose={() => setMenuOpen(false)}
        />
      )}
    </div>
  )
}

// ── Menu Drawer ────────────────────────────────────────────────────────────────

function MenuDrawer({ sections, restaurantName, onClose }: {
  sections: MenuSection[]
  restaurantName: string
  onClose: () => void
}) {
  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", animation: "backdropIn 0.3s ease-out both" }}
      />
      <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 50, height: "90dvh", background: "#0D0D0D", borderRadius: "22px 22px 0 0", border: "1px solid rgba(255,255,255,0.09)", borderBottom: "none", display: "flex", flexDirection: "column", overflow: "hidden", animation: "sheetUp 0.42s cubic-bezier(0.32,0.72,0,1) both" }}>
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 14, paddingBottom: 4, flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.12)" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 24px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
          <div>
            <p style={{ fontSize: 10, letterSpacing: "0.35em", textTransform: "uppercase", color: "rgba(255,255,255,0.30)", marginBottom: 3 }}>{restaurantName}</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: "white", letterSpacing: "0.01em" }}>Menu</p>
          </div>
          <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.07)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.6)" }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0 40px" }}>
          {sections.length === 0 ? (
            <p style={{ textAlign: "center", fontSize: 13, color: "rgba(255,255,255,0.28)", padding: "40px 24px" }}>Menu not available</p>
          ) : sections.map((section, si) => (
            <div key={section.id ?? section.title} style={{ padding: "20px 24px 0", animation: `menuItemIn 0.35s ${si * 0.05}s ease-out both` }}>
              <p style={{ fontSize: 10, letterSpacing: "0.4em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", fontWeight: 700, marginBottom: 14 }}>{section.title}</p>
              {section.items.map((item, ii) => (
                <div key={item.id ?? item.name}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, paddingBottom: 14 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.9)", marginBottom: item.description && !/^(none|n\/a|na|-|—|null|undefined)$/i.test(item.description.trim()) ? 3 : 0 }}>{item.name}</p>
                      {item.description && !/^(none|n\/a|na|-|—|null|undefined)$/i.test(item.description.trim()) && <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", lineHeight: 1.5 }}>{item.description}</p>}
                      {item.tags && item.tags.length > 0 && (
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                          {item.tags.map(tag => (
                            <span key={tag} style={{ fontSize: 9, color: "rgba(255,185,100,0.80)", background: "rgba(255,185,100,0.10)", borderRadius: 8, padding: "1px 6px" }}>{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    {item.price && <p style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.6)", whiteSpace: "nowrap", marginTop: 2, flexShrink: 0 }}>{item.price}</p>}
                  </div>
                  {ii < section.items.length - 1 && <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", marginBottom: 14 }} />}
                </div>
              ))}
              {si < sections.length - 1 && <div style={{ borderTop: "1px solid rgba(255,255,255,0.09)", marginTop: 8 }} />}
            </div>
          ))}
          <p style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.15)", padding: "28px 24px 0", letterSpacing: "0.10em" }}>Ask your server about daily specials &amp; dietary options</p>
        </div>
      </div>
    </>
  )
}
