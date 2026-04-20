"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useParams } from "next/navigation"
import { X, UtensilsCrossed, Users, Clock } from "lucide-react"
import { WALNUT_MENU } from "@/lib/walnut-menu"

const API = "https://restaurant-brain-production.up.railway.app"

const WALTERS_RID          = "272a8876-e4e6-4867-831d-0525db80a8db"
const WALNUT_ORIGINAL_RID  = "0001cafe-0001-4000-8000-000000000001"
const WALNUT_SOUTHSIDE_RID = "0002cafe-0001-4000-8000-000000000002"

interface Entry {
  id: string
  name: string
  party_size: number
  status: "waiting" | "ready" | "seated" | "removed"
  restaurant_id?: string
  position?: number
  parties_ahead?: number
  wait_estimate?: number
  quoted_wait?: number
  remaining_wait?: number
  wait_set_at?: string
  arrival_time: string
  notes?: string
  paused?: boolean
}

const WAITING_MESSAGES = [
  "Your spot is saved — feel free to step out.",
  "We'll let you know the moment your table is ready.",
  "Sit tight, we're moving quickly.",
  "Your table is being prepared.",
  "You can leave and come back — we've got your spot.",
]

// ── Demo/Walters menu data ────────────────────────────────────────────────────
const DEMO_MENU_SECTIONS = [
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

// ── Guest config ─────────────────────────────────────────────────────────────
interface GuestConfig {
  bgColor: string; accentColor: string; buttonTextColor: string
  restaurantName: string; tagline: string
  // Per-element color tokens — set light values for cream bg, dark for black bg
  textColor: string       // primary text (e.g. white or very dark brown)
  text2Color: string      // secondary / subtext
  text3Color: string      // muted / watermark
  cardBg: string          // stat card + message card background
  cardBorder: string      // card border
  progressTrack: string   // progress bar empty track
  logoUrl?: string        // show logo instead of restaurant name text
  waitMessages: string[]; seatedMessage: string
  finalButtons: Array<{ id: string; label: string; url: string; color: string }>
}

const DEFAULT_CONFIG: GuestConfig = {
  bgColor: "#000000", accentColor: "#22c55e", buttonTextColor: "#ffffff",
  restaurantName: "Demo Restaurant", tagline: "Powered by HOST",
  textColor: "#ffffff", text2Color: "rgba(255,255,255,0.50)", text3Color: "rgba(255,255,255,0.25)",
  cardBg: "#141414", cardBorder: "rgba(255,255,255,0.08)", progressTrack: "rgba(255,255,255,0.07)",
  waitMessages: ["Your spot is saved — feel free to step out.", "We'll let you know the moment your table is ready.", "Sit tight, we're moving quickly.", "Your table is being prepared.", "You can leave and come back — we've got your spot."],
  seatedMessage: "Thanks for dining with us! We hope to see you again soon.",
  finalButtons: [],
}

const WALTERS_CONFIG: GuestConfig = {
  bgColor: "#000000", accentColor: "#22c55e", buttonTextColor: "#ffffff",
  restaurantName: "Walter's 303", tagline: "Denver, CO",
  textColor: "#ffffff", text2Color: "rgba(255,255,255,0.50)", text3Color: "rgba(255,255,255,0.25)",
  cardBg: "#141414", cardBorder: "rgba(255,255,255,0.08)", progressTrack: "rgba(255,255,255,0.07)",
  waitMessages: DEFAULT_CONFIG.waitMessages,
  seatedMessage: "Thanks for dining at Walter's 303! We hope to see you again soon.",
  finalButtons: [],
}

// Walnut Cafe uses the same cream palette as the join page
const WALNUT_BG   = "#EDE8DF"
const WALNUT_DARK = "#2C2416"
const WALNUT_BASE: GuestConfig = {
  bgColor: WALNUT_BG, accentColor: "#C89060", buttonTextColor: "#ffffff",
  restaurantName: "The Walnut Cafe", tagline: "Boulder, CO",
  textColor: WALNUT_DARK, text2Color: "rgba(44,36,22,0.55)", text3Color: "rgba(44,36,22,0.30)",
  cardBg: "rgba(44,36,22,0.05)", cardBorder: "rgba(44,36,22,0.12)", progressTrack: "rgba(44,36,22,0.09)",
  logoUrl: "https://images.getbento.com/accounts/d2ce1ba3bfb5b87e1f0ba2897a682acb/media/images/28198New_Walnut_Logo.png",
  waitMessages: [
    "Your spot is saved — feel free to explore the neighborhood.",
    "We'll let you know the moment your table is ready.",
    "Sit tight, we're moving quickly.",
    "Your table is being prepared.",
    "You can step out — we've got your spot.",
  ],
  seatedMessage: "Thanks for dining with us at the Walnut Cafe! We hope to see you again soon.",
  finalButtons: [],
}

function configForRid(rid?: string): GuestConfig | null {
  if (rid === WALNUT_ORIGINAL_RID)  return { ...WALNUT_BASE, restaurantName: "The Original Walnut Cafe" }
  if (rid === WALNUT_SOUTHSIDE_RID) return { ...WALNUT_BASE, restaurantName: "The Southside Walnut Cafe" }
  if (rid === WALTERS_RID)          return WALTERS_CONFIG
  return null
}

function joinUrlForRid(rid?: string): string {
  if (rid === WALNUT_ORIGINAL_RID)  return "/walnut/original/join"
  if (rid === WALNUT_SOUTHSIDE_RID) return "/walnut/southside/join"
  return "/demo/join"
}

function isWalnutRid(rid?: string): boolean {
  return rid === WALNUT_ORIGINAL_RID || rid === WALNUT_SOUTHSIDE_RID
}

// eslint-disable-next-line @next/next/no-img-element
function GuestLogo({ src, name }: { src: string; name: string }) {
  return <img src={src} alt={name} style={{ height: 48, width: "auto", objectFit: "contain", maxWidth: 220 }} />
}

export default function WaitPage() {
  const { id } = useParams<{ id: string }>()
  const [entry,       setEntry]       = useState<Entry | null>(null)
  const [error,       setError]       = useState(false)
  const [msgIdx,      setMsgIdx]      = useState(0)
  const [menuOpen,    setMenuOpen]    = useState(false)
  const [leavePrompt, setLeavePrompt] = useState(false)
  const [leaving,     setLeaving]     = useState(false)
  const [displayWait, setDisplayWait] = useState(0)
  const [elapsedSec,  setElapsedSec]  = useState(0)
  const [progress,    setProgress]    = useState(4)
  const [joinUrl,     setJoinUrl]     = useState("/demo/join")
  const progressKeyRef = useRef<string | null>(null)
  const [cfg, setCfg] = useState<GuestConfig>(DEFAULT_CONFIG)

  // Load demo localStorage config on mount (used only if entry is demo restaurant)
  useEffect(() => {
    try {
      const s = localStorage.getItem("host_guest_config_demo")
      if (s) setCfg({ ...DEFAULT_CONFIG, ...JSON.parse(s) })
    } catch {}
  }, [])

  // Override config once entry.restaurant_id is known
  useEffect(() => {
    if (!entry?.restaurant_id) return
    const staticCfg = configForRid(entry.restaurant_id)
    if (staticCfg) setCfg(staticCfg)
    setJoinUrl(joinUrlForRid(entry.restaurant_id))
  }, [entry?.restaurant_id])

  const fetchingRef = useRef(false)

  const fetchEntry = useCallback(async () => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    try {
      const r = await fetch(`${API}/queue/${id}`, { cache: "no-store" })
      if (!r.ok) { setError(true); return }
      setEntry(await r.json())
    } catch { setError(true) }
    finally { fetchingRef.current = false }
  }, [id])

  const handleLeave = async () => {
    setLeaving(true)
    try { await fetch(`${API}/queue/${id}/remove`, { method: "POST" }) } catch {}
    sessionStorage.removeItem("host_wait_id")
    setEntry(prev => prev ? { ...prev, status: "removed" } : null)
  }

  useEffect(() => {
    fetchEntry()
    const poll = setInterval(fetchEntry, 2000)
    return () => clearInterval(poll)
  }, [fetchEntry])

  useEffect(() => {
    const onVis = () => { if (!document.hidden) fetchEntry() }
    document.addEventListener("visibilitychange", onVis)
    return () => document.removeEventListener("visibilitychange", onVis)
  }, [fetchEntry])

  useEffect(() => {
    if (!entry) return
    if (entry.quoted_wait != null && entry.quoted_wait > 0) {
      if (entry.paused) { setElapsedSec(0); setDisplayWait(entry.quoted_wait); return }
      const lsKey = entry.wait_set_at
        ? `timer_${entry.id}_${entry.wait_set_at}`
        : `timer_${entry.id}_${entry.quoted_wait}`
      progressKeyRef.current = lsKey
      if (!localStorage.getItem(lsKey)) localStorage.setItem(lsKey, String(Date.now()))
      const storedStart = Number(localStorage.getItem(lsKey))
      const sec = Math.floor((Date.now() - storedStart) / 1000)
      setElapsedSec(sec)
      setDisplayWait(Math.max(0, entry.quoted_wait - Math.floor(sec / 60)))
    } else {
      setElapsedSec(0); setDisplayWait(0)
    }
  }, [entry?.id, entry?.quoted_wait, entry?.wait_set_at, entry?.paused])

  useEffect(() => {
    if (entry?.status !== "waiting") return
    if (entry?.paused) return
    const qw = entry.quoted_wait
    if (!qw) return
    const lsKey = entry.wait_set_at
      ? `timer_${entry.id}_${entry.wait_set_at}`
      : `timer_${entry.id}_${qw}`
    const t = setInterval(() => {
      const stored = localStorage.getItem(lsKey)
      if (!stored) return
      const sec = Math.floor((Date.now() - Number(stored)) / 1000)
      setElapsedSec(sec)
      setDisplayWait(Math.max(0, qw - Math.floor(sec / 60)))
    }, 1000)
    return () => clearInterval(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry?.status, entry?.quoted_wait, entry?.wait_set_at, entry?.id, entry?.paused])

  useEffect(() => {
    if (!entry) return
    const { status, quoted_wait: qw, id } = entry
    const minKey = `minProg_${id}`
    if (status === "ready" || status === "seated") { setProgress(100); return }
    const totalSec = (qw ?? 1) * 60
    const raw = qw ? Math.min(97, Math.max(3, (elapsedSec / totalSec) * 100)) : 4
    const stored = Number(localStorage.getItem(minKey)) || 0
    setProgress(prev => {
      const next = Math.max(prev, raw, stored)
      localStorage.setItem(minKey, String(next))
      return next
    })
  }, [elapsedSec, entry?.status, entry?.quoted_wait, entry?.id])

  useEffect(() => {
    if (entry?.status === "seated" || entry?.status === "removed") sessionStorage.removeItem("host_wait_id")
  }, [entry?.status])

  useEffect(() => {
    if (entry?.status !== "waiting") return
    const t = setInterval(() => setMsgIdx(i => (i + 1) % WAITING_MESSAGES.length), 8000)
    return () => clearInterval(t)
  }, [entry?.status])

  useEffect(() => {
    if (entry?.status !== "waiting") return
    window.history.pushState(null, "", window.location.href)
    const onPop = () => { window.history.pushState(null, "", window.location.href); setLeavePrompt(true) }
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [entry?.status])

  useEffect(() => {
    if (entry?.status !== "waiting") return
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = "" }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [entry?.status])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [menuOpen])

  // ── Error state ────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div style={{
        height: "100dvh", background: cfg.bgColor, color: cfg.textColor,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "40px 32px", textAlign: "center",
      }}>
        {cfg.logoUrl ? (
          <div style={{ marginBottom: 32 }}><GuestLogo src={cfg.logoUrl} name={cfg.restaurantName} /></div>
        ) : (
          <>
            <p style={{ fontSize: 10, letterSpacing: "0.45em", textTransform: "uppercase", color: cfg.text3Color, marginBottom: 14 }}>Powered by</p>
            <p style={{ fontSize: 36, fontWeight: 900, letterSpacing: "0.3em", color: cfg.textColor, lineHeight: 1, margin: "0 0 32px" }}>HOST</p>
          </>
        )}
        <p style={{ fontSize: 18, fontWeight: 500, color: cfg.text2Color, margin: "0 0 8px" }}>Entry not found</p>
        <p style={{ fontSize: 14, color: cfg.text3Color, margin: "0 0 48px", lineHeight: 1.5 }}>
          This waitlist entry may have expired.
        </p>
        <a href={joinUrl} style={{ padding: "14px 32px", borderRadius: 14, background: cfg.accentColor, color: cfg.buttonTextColor, fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", textDecoration: "none" }}>
          Join the Waitlist
        </a>
      </div>
    )
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  if (!entry) {
    return <div style={{ height: "100dvh", background: cfg.bgColor }} />
  }

  const { status, name, party_size, parties_ahead, quoted_wait } = entry
  const isReady   = status === "ready"
  const isSeated  = status === "seated"
  const isRemoved = status === "removed"

  // ── Removed state ──────────────────────────────────────────────────────────
  if (isRemoved) {
    return (
      <div style={{
        height: "100dvh", background: cfg.bgColor, color: cfg.textColor,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "40px 32px", textAlign: "center",
      }}>
        {cfg.logoUrl ? (
          <div style={{ marginBottom: 28 }}><GuestLogo src={cfg.logoUrl} name={cfg.restaurantName} /></div>
        ) : (
          <>
            <p style={{ fontSize: 10, letterSpacing: "0.45em", textTransform: "uppercase", color: cfg.text3Color, marginBottom: 18 }}>Powered by</p>
            <p style={{ fontSize: 52, fontWeight: 900, letterSpacing: "0.3em", color: cfg.textColor, lineHeight: 1, margin: "0 0 36px" }}>HOST</p>
          </>
        )}
        <div style={{ width: 32, height: 1, background: cfg.cardBorder, marginBottom: 28 }} />
        <p style={{ fontSize: 26, fontWeight: 300, color: cfg.text2Color, margin: "0 0 10px", letterSpacing: "-0.01em" }}>
          Thanks for visiting.
        </p>
        <p style={{ fontSize: 14, color: cfg.text3Color, margin: 0, letterSpacing: "0.05em" }}>
          {cfg.restaurantName}
        </p>
      </div>
    )
  }

  // ── Seated state ───────────────────────────────────────────────────────────
  if (isSeated) {
    return (
      <div style={{
        height: "100dvh", background: cfg.bgColor, color: cfg.textColor,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "0 32px", textAlign: "center",
      }}>
        <style>{`
          @keyframes fadeUp {
            from { opacity: 0; transform: translateY(12px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>

        <div style={{
          position: "absolute", top: 44, left: 0, right: 0,
          display: "flex", justifyContent: "center",
          animation: "fadeUp 0.6s 0.0s ease-out both",
        }}>
          {cfg.logoUrl
            ? <GuestLogo src={cfg.logoUrl} name={cfg.restaurantName} />
            : <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase", color: cfg.text3Color, margin: 0 }}>
                Powered by <strong style={{ fontWeight: 800, color: cfg.text2Color }}>HOST</strong>
              </p>
          }
        </div>

        <div style={{ animation: "fadeUp 0.6s 0.08s ease-out both", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, width: "100%", maxWidth: 320 }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: `${cfg.accentColor}22`, border: `2px solid ${cfg.accentColor}88`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={cfg.accentColor} strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <p style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.01em", color: cfg.textColor, margin: 0 }}>
            Enjoy your time.
          </p>
          <p style={{ fontSize: 14, color: cfg.text2Color, margin: "4px 0 20px", lineHeight: 1.5 }}>
            {cfg.seatedMessage}
          </p>
          {cfg.finalButtons.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
              {cfg.finalButtons.map(btn => btn.url ? (
                <a key={btn.id} href={btn.url} target="_blank" rel="noopener noreferrer"
                  style={{ display: "block", width: "100%", padding: "15px 0", borderRadius: 14, textAlign: "center", fontWeight: 700, fontSize: 15, color: cfg.buttonTextColor, background: btn.color, textDecoration: "none", boxSizing: "border-box" }}>
                  {btn.label}
                </a>
              ) : null)}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Ready state ────────────────────────────────────────────────────────────
  if (isReady) {
    return (
      <div style={{
        height: "100dvh", background: cfg.bgColor, color: cfg.textColor,
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        <style>{`
          @keyframes pulseAccent {
            0%, 100% { box-shadow: 0 0 0 0 ${cfg.accentColor}55; }
            50%       { box-shadow: 0 0 0 22px ${cfg.accentColor}00; }
          }
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
        `}</style>

        {/* Restaurant header */}
        <div style={{ padding: "48px 28px 4px", flexShrink: 0, textAlign: "center" }}>
          {cfg.logoUrl
            ? <div style={{ display: "flex", justifyContent: "center" }}><GuestLogo src={cfg.logoUrl} name={cfg.restaurantName} /></div>
            : <p style={{ fontSize: 22, fontWeight: 800, color: cfg.textColor, letterSpacing: "-0.02em", margin: "0 0 3px" }}>{cfg.restaurantName}</p>
          }
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: cfg.text3Color, margin: cfg.logoUrl ? "8px 0 0" : 0 }}>Powered by HOST</p>
        </div>

        {/* Main content */}
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: "0 28px", textAlign: "center", gap: 0,
        }}>
          <div style={{
            width: 88, height: 88, borderRadius: "50%",
            background: `${cfg.accentColor}20`,
            border: `2px solid ${cfg.accentColor}70`,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: cfg.accentColor,
            marginBottom: 28,
            animation: "pulseAccent 2s ease-in-out infinite",
          }}>
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: cfg.textColor, margin: "0 0 8px", letterSpacing: "-0.01em" }}>
            Your table is ready!
          </h1>
          <p style={{ fontSize: 15, color: cfg.accentColor, fontWeight: 600, margin: "0 0 28px" }}>
            Head to the host stand
          </p>
        </div>

        {/* Footer */}
        <div style={{ padding: "0 28px 40px", flexShrink: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            onClick={() => setMenuOpen(true)}
            style={{
              width: "100%", height: 54,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              background: cfg.cardBg,
              border: `1px solid ${cfg.cardBorder}`,
              borderRadius: 14, cursor: "pointer",
              color: cfg.text2Color,
              fontSize: 14, fontWeight: 600, letterSpacing: "0.04em",
            }}
          >
            <UtensilsCrossed size={15} style={{ opacity: 0.7 }} />
            Check Out the Menu
          </button>
          <p style={{ textAlign: "center", fontSize: 10, color: cfg.text3Color, letterSpacing: "0.2em", textTransform: "uppercase" }}>
            Updates automatically · HOST
          </p>
        </div>

        {menuOpen && <MenuDrawer onClose={() => setMenuOpen(false)} restaurantId={entry.restaurant_id} restaurantName={cfg.restaurantName} />}
      </div>
    )
  }

  // ── Waiting state ──────────────────────────────────────────────────────────
  const partiesLabel = parties_ahead === 0
    ? "You're next up!"
    : `${parties_ahead} ${parties_ahead === 1 ? "party" : "parties"} ahead of you`

  return (
    <div style={{
      height: "100dvh", background: cfg.bgColor, color: cfg.textColor,
      display: "flex", flexDirection: "column",
      overflow: "hidden",
    }}>
      <style>{`
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
        @keyframes fadeMsg {
          0%   { opacity: 0; transform: translateY(4px); }
          15%  { opacity: 1; transform: translateY(0); }
          85%  { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-4px); }
        }
      `}</style>

      {/* Restaurant header */}
      <div style={{ padding: "48px 28px 4px", flexShrink: 0, textAlign: "center" }}>
        {cfg.logoUrl
          ? <div style={{ display: "flex", justifyContent: "center" }}><GuestLogo src={cfg.logoUrl} name={cfg.restaurantName} /></div>
          : <p style={{ fontSize: 22, fontWeight: 800, color: cfg.textColor, letterSpacing: "-0.02em", margin: "0 0 3px" }}>{cfg.restaurantName}</p>
        }
        <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: cfg.text3Color, margin: cfg.logoUrl ? "8px 0 0" : 0 }}>Powered by HOST</p>
      </div>

      {/* Main content */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        padding: "0 28px", justifyContent: "center", gap: 22,
      }}>

        {/* Name + parties ahead */}
        <div>
          <h1 style={{ fontSize: 30, fontWeight: 700, color: cfg.textColor, margin: "0 0 6px", letterSpacing: "-0.02em" }}>
            {name && name !== "Guest" ? `Hi, ${name}!` : "You're in line."}
          </h1>
          <p style={{ fontSize: 13, color: cfg.text2Color, margin: 0, letterSpacing: "0.02em" }}>
            {partiesLabel}
          </p>
        </div>

        {/* Progress bar */}
        <div>
          <div style={{
            width: "100%", height: 8, borderRadius: 99,
            background: cfg.progressTrack, overflow: "hidden", marginBottom: 7,
          }}>
            <div style={{
              width: `${progress}%`, height: "100%", borderRadius: 99,
              background: `linear-gradient(90deg, ${cfg.accentColor}, ${cfg.accentColor}99)`,
              transition: "width 1s linear",
            }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: cfg.text3Color }}>
            <span>Arrived</span>
            <span>Seated</span>
          </div>
        </div>

        {/* Stat cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div style={{ background: cfg.cardBg, border: `1px solid ${cfg.cardBorder}`, borderRadius: 14, padding: "14px 16px" }}>
            <p style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: cfg.text3Color, marginBottom: 8 }}>Party</p>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 18, color: cfg.textColor }}>
              <Users size={14} style={{ opacity: 0.5 }} />
              {party_size}
            </div>
          </div>
          <div style={{ background: cfg.cardBg, border: `1px solid ${cfg.cardBorder}`, borderRadius: 14, padding: "14px 16px" }}>
            <p style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: cfg.text3Color, marginBottom: 8 }}>Est. Wait</p>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 18, color: cfg.accentColor }}>
              <Clock size={14} style={{ opacity: 0.8 }} />
              {quoted_wait && displayWait > 0 ? `~${displayWait}m` : "—"}
            </div>
          </div>
        </div>

        {/* Rotating message card */}
        <div style={{ background: cfg.cardBg, border: `1px solid ${cfg.cardBorder}`, borderRadius: 14, padding: "14px 18px" }}>
          <p
            key={msgIdx}
            style={{ fontSize: 13, color: cfg.text2Color, lineHeight: 1.6, margin: 0, animation: "fadeMsg 8s ease-in-out" }}
          >
            {quoted_wait
              ? WAITING_MESSAGES[msgIdx]
              : "Your host will confirm your wait time shortly."}
          </p>
        </div>

      </div>

      {/* Footer */}
      <div style={{ padding: "0 28px 40px", flexShrink: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        <button
          onClick={() => setMenuOpen(true)}
          style={{
            width: "100%", height: 54,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            background: cfg.cardBg,
            border: `1px solid ${cfg.cardBorder}`,
            borderRadius: 14, cursor: "pointer",
            color: cfg.text2Color,
            fontSize: 14, fontWeight: 600, letterSpacing: "0.04em",
          }}
        >
          <UtensilsCrossed size={15} style={{ opacity: 0.7 }} />
          Check Out the Menu
        </button>

        <button
          onClick={() => setLeavePrompt(true)}
          style={{
            width: "100%", padding: "14px 0",
            background: "transparent", border: "none",
            color: cfg.text3Color,
            fontSize: 12, fontWeight: 500,
            letterSpacing: "0.1em", textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          Leave &amp; Rejoin Later
        </button>

        <p style={{ textAlign: "center", fontSize: 10, color: cfg.text3Color, letterSpacing: "0.2em", textTransform: "uppercase", margin: 0 }}>
          Updates automatically · HOST
        </p>
      </div>

      {/* Leave confirmation overlay — always dark regardless of page theme */}
      {leavePrompt && (
        <>
          <div
            onClick={() => setLeavePrompt(false)}
            style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
          />
          <div style={{
            position: "fixed", left: "50%", top: "50%", zIndex: 70,
            transform: "translate(-50%, -50%)",
            width: "calc(100% - 40px)", maxWidth: 340,
            background: "#111", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 22, padding: "28px 24px 24px", textAlign: "center",
          }}>
            <p style={{ fontSize: 18, fontWeight: 800, color: "#fff", margin: "0 0 8px", letterSpacing: "-0.01em" }}>
              Leave the waitlist?
            </p>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", margin: "0 0 28px", lineHeight: 1.5 }}>
              You&apos;ll lose your spot and will need to rejoin from the beginning.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                onClick={handleLeave} disabled={leaving}
                style={{ width: "100%", padding: "15px 0", borderRadius: 14, border: "1px solid rgba(239,68,68,0.35)", background: "rgba(239,68,68,0.15)", color: "#f87171", fontSize: 14, fontWeight: 700, letterSpacing: "0.04em", cursor: leaving ? "default" : "pointer", opacity: leaving ? 0.6 : 1 }}
              >
                {leaving ? "Leaving…" : "Yes, leave the waitlist"}
              </button>
              <button
                onClick={() => setLeavePrompt(false)}
                style={{ width: "100%", padding: "15px 0", borderRadius: 14, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.85)", fontSize: 14, fontWeight: 700, letterSpacing: "0.04em", cursor: "pointer" }}
              >
                Stay — keep my spot
              </button>
            </div>
          </div>
        </>
      )}

      {menuOpen && <MenuDrawer onClose={() => setMenuOpen(false)} restaurantId={entry.restaurant_id} restaurantName={cfg.restaurantName} />}
    </div>
  )
}

// ── Menu Drawer router ─────────────────────────────────────────────────────
function MenuDrawer({ onClose, restaurantId, restaurantName }: { onClose: () => void; restaurantId?: string; restaurantName: string }) {
  if (isWalnutRid(restaurantId)) return <WalnutMenuDrawer onClose={onClose} restaurantName={restaurantName} />
  return <DemoMenuDrawer onClose={onClose} restaurantName={restaurantName} />
}

// ── Demo Menu Drawer ────────────────────────────────────────────────────────
function DemoMenuDrawer({ onClose, restaurantName }: { onClose: () => void; restaurantName: string }) {
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", animation: "backdropIn 0.3s ease-out both" }} />
      <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 50, height: "88dvh", background: "#0D0D0D", borderRadius: "22px 22px 0 0", border: "1px solid rgba(255,255,255,0.09)", borderBottom: "none", display: "flex", flexDirection: "column", overflow: "hidden", animation: "sheetUp 0.42s cubic-bezier(0.32, 0.72, 0, 1) both" }}>
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 14, paddingBottom: 4, flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.12)" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 24px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
          <div>
            <p style={{ fontSize: 10, letterSpacing: "0.35em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 3 }}>{restaurantName}</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: "white", letterSpacing: "0.01em" }}>Menu</p>
          </div>
          <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.07)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.6)" }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" as never, padding: "8px 0 40px" }}>
          {DEMO_MENU_SECTIONS.map((section, si) => (
            <div key={section.title} style={{ padding: "20px 24px 0", animation: `menuItemIn 0.4s ${si * 0.06}s ease-out both` }}>
              <p style={{ fontSize: 10, letterSpacing: "0.4em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", fontWeight: 700, marginBottom: 14 }}>{section.title}</p>
              {section.items.map((item, ii) => (
                <div key={item.name}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, paddingBottom: 14 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.9)", marginBottom: 3 }}>{item.name}</p>
                      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", lineHeight: 1.5 }}>{item.desc}</p>
                    </div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.6)", whiteSpace: "nowrap", marginTop: 2, flexShrink: 0 }}>{item.price}</p>
                  </div>
                  {ii < section.items.length - 1 && <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", marginBottom: 14 }} />}
                </div>
              ))}
              {si < DEMO_MENU_SECTIONS.length - 1 && <div style={{ borderTop: "1px solid rgba(255,255,255,0.09)", marginTop: 8 }} />}
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

// ── Walnut Menu Drawer (tabbed: Breakfast / Lunch / Drinks / Kids) ──────────
function WalnutMenuDrawer({ onClose, restaurantName }: { onClose: () => void; restaurantName: string }) {
  const [activeTab, setActiveTab] = useState(0)
  const ACCENT = "#C89060"

  const category = WALNUT_MENU[activeTab]

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", animation: "backdropIn 0.3s ease-out both" }} />
      <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 50, height: "92dvh", background: "#1A1208", borderRadius: "22px 22px 0 0", border: "1px solid rgba(255,255,255,0.08)", borderBottom: "none", display: "flex", flexDirection: "column", overflow: "hidden", animation: "sheetUp 0.42s cubic-bezier(0.32, 0.72, 0, 1) both" }}>
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 14, paddingBottom: 4, flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.10)" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 24px 0", flexShrink: 0 }}>
          <div>
            <p style={{ fontSize: 10, letterSpacing: "0.35em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)", marginBottom: 3 }}>{restaurantName}</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: "white", letterSpacing: "0.01em" }}>Menu</p>
          </div>
          <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.6)" }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ display: "flex", padding: "14px 20px 0", gap: 2, flexShrink: 0, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          {WALNUT_MENU.map((cat, i) => (
            <button key={cat.label} onClick={() => setActiveTab(i)} style={{ padding: "8px 14px", fontSize: 13, fontWeight: activeTab === i ? 700 : 500, color: activeTab === i ? ACCENT : "rgba(255,255,255,0.38)", background: "transparent", border: "none", borderBottom: `2px solid ${activeTab === i ? ACCENT : "transparent"}`, cursor: "pointer", transition: "all 0.18s", letterSpacing: "0.02em", marginBottom: -1 }}>
              {cat.label}
            </button>
          ))}
        </div>
        <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" as never, padding: "8px 0 40px" }}>
          {category.sections.map((section, si) => (
            <div key={section.title} style={{ padding: "20px 24px 0", animation: `menuItemIn 0.3s ${si * 0.04}s ease-out both` }}>
              <p style={{ fontSize: 10, letterSpacing: "0.4em", textTransform: "uppercase", color: `${ACCENT}99`, fontWeight: 700, marginBottom: 14 }}>{section.title}</p>
              {section.items.map((item, ii) => (
                <div key={item.name}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, paddingBottom: 14 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.9)", marginBottom: 3 }}>{item.name}</p>
                      {item.desc && <p style={{ fontSize: 12, color: "rgba(255,255,255,0.33)", lineHeight: 1.5 }}>{item.desc}</p>}
                    </div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: ACCENT, whiteSpace: "nowrap", marginTop: 2, flexShrink: 0 }}>{item.price}</p>
                  </div>
                  {ii < section.items.length - 1 && <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", marginBottom: 14 }} />}
                </div>
              ))}
              {si < category.sections.length - 1 && <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", marginTop: 8 }} />}
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
