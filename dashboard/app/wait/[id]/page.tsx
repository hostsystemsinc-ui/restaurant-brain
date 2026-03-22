"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useParams } from "next/navigation"
import { X, UtensilsCrossed, Users, Clock } from "lucide-react"

const API = "https://restaurant-brain-production.up.railway.app"

interface Entry {
  id: string
  name: string
  party_size: number
  status: "waiting" | "ready" | "seated" | "removed"
  position?: number
  parties_ahead?: number
  wait_estimate?: number
  quoted_wait?: number
  remaining_wait?: number
  wait_set_at?: string    // ISO timestamp set by server when host writes quoted_wait
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

// ── Menu data ────────────────────────────────────────────────────────────────
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
  const progressKeyRef = useRef<string | null>(null)

  const fetchEntry = useCallback(async () => {
    try {
      const r = await fetch(`${API}/queue/${id}`, { cache: "no-store" })
      if (!r.ok) { setError(true); return }
      setEntry(await r.json())
    } catch { setError(true) }
  }, [id])

  const handleLeave = async () => {
    setLeaving(true)
    try { await fetch(`${API}/queue/${id}/remove`, { method: "POST" }) } catch { /* best-effort */ }
    setEntry(prev => prev ? { ...prev, status: "removed" } : null)
  }

  useEffect(() => {
    fetchEntry()
    const poll = setInterval(fetchEntry, 3000)
    return () => clearInterval(poll)
  }, [fetchEntry])

  // Sync displayWait + elapsedSec when quoted_wait, wait_set_at, or paused changes
  useEffect(() => {
    if (!entry) return
    if (entry.quoted_wait != null && entry.quoted_wait > 0) {
      // Paused: freeze elapsed at 0 so displayWait = remaining exactly
      if (entry.paused) {
        setElapsedSec(0)
        setDisplayWait(entry.quoted_wait)
        return
      }
      const lsKey = entry.wait_set_at
        ? `timer_${entry.id}_${entry.wait_set_at}`
        : `timer_${entry.id}_${entry.quoted_wait}`
      progressKeyRef.current = lsKey
      if (!localStorage.getItem(lsKey)) {
        localStorage.setItem(lsKey, String(Date.now()))
      }
      const storedStart = Number(localStorage.getItem(lsKey))
      const sec = Math.floor((Date.now() - storedStart) / 1000)
      setElapsedSec(sec)
      setDisplayWait(Math.max(0, entry.quoted_wait - Math.floor(sec / 60)))
    } else {
      setElapsedSec(0)
      setDisplayWait(0)
    }
  }, [entry?.id, entry?.quoted_wait, entry?.wait_set_at, entry?.paused])

  // Per-second tick — stops when paused
  useEffect(() => {
    if (entry?.status !== "waiting") return
    if (entry?.paused) return   // freeze when paused
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

  // Progress bar: never goes backward, persists across reloads via localStorage
  useEffect(() => {
    if (!entry) return
    const { status, quoted_wait: qw, id } = entry
    const minKey = `minProg_${id}`
    if (status === "ready" || status === "seated") {
      setProgress(100)
      return
    }
    const totalSec = (qw ?? 1) * 60
    const raw = qw ? Math.min(97, Math.max(3, (elapsedSec / totalSec) * 100)) : 4
    const stored = Number(localStorage.getItem(minKey)) || 0
    setProgress(prev => {
      const next = Math.max(prev, raw, stored)
      localStorage.setItem(minKey, String(next))
      return next
    })
  }, [elapsedSec, entry?.status, entry?.quoted_wait, entry?.id])

  // Rotate messages every 8 seconds while waiting
  useEffect(() => {
    if (entry?.status !== "waiting") return
    const t = setInterval(() => setMsgIdx(i => (i + 1) % WAITING_MESSAGES.length), 8000)
    return () => clearInterval(t)
  }, [entry?.status])

  // Prevent body scroll when menu is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [menuOpen])

  // ── Error state ────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div style={{
        height: "100dvh", background: "#000", color: "#fff",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "40px 32px", textAlign: "center",
      }}>
        <p style={{ fontSize: 10, letterSpacing: "0.45em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)", marginBottom: 14 }}>
          Powered by
        </p>
        <p style={{ fontSize: 36, fontWeight: 900, letterSpacing: "0.3em", color: "#fff", lineHeight: 1, margin: "0 0 32px" }}>
          HOST
        </p>
        <p style={{ fontSize: 18, fontWeight: 500, color: "rgba(255,255,255,0.85)", margin: "0 0 8px" }}>Entry not found</p>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.35)", margin: "0 0 48px", lineHeight: 1.5 }}>
          This waitlist entry may have expired.
        </p>
        <a
          href="/join"
          style={{
            padding: "14px 32px", borderRadius: 14,
            background: "white", color: "black",
            fontSize: 13, fontWeight: 700, letterSpacing: "0.06em",
            textDecoration: "none",
          }}
        >
          Rejoin
        </a>
      </div>
    )
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  if (!entry) {
    return <div style={{ height: "100dvh", background: "#000" }} />
  }

  const { status, name, party_size, parties_ahead, quoted_wait } = entry
  const isReady   = status === "ready"
  const isSeated  = status === "seated"
  const isRemoved = status === "removed"

  // ── Removed state ──────────────────────────────────────────────────────────
  if (isRemoved) {
    return (
      <div style={{
        height: "100dvh", background: "#000", color: "#fff",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "40px 32px", textAlign: "center",
      }}>
        <p style={{ fontSize: 10, letterSpacing: "0.45em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)", marginBottom: 18 }}>
          Powered by
        </p>
        <p style={{ fontSize: 52, fontWeight: 900, letterSpacing: "0.3em", color: "#fff", lineHeight: 1, margin: "0 0 36px" }}>
          HOST
        </p>
        <div style={{ width: 32, height: 1, background: "rgba(255,255,255,0.12)", marginBottom: 36 }} />
        <p style={{ fontSize: 26, fontWeight: 300, color: "rgba(255,255,255,0.9)", margin: "0 0 10px", letterSpacing: "-0.01em" }}>
          Thanks for visiting.
        </p>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.38)", margin: "0 0 56px", letterSpacing: "0.05em" }}>
          Demo Restaurant
        </p>
        <a
          href="/join"
          style={{ fontSize: 12, color: "rgba(255,255,255,0.22)", textDecoration: "none", letterSpacing: "0.12em", textTransform: "uppercase" }}
        >
          Rejoin the waitlist →
        </a>
      </div>
    )
  }


  // ── Seated state ───────────────────────────────────────────────────────────
  if (isSeated) {
    return (
      <div style={{
        height: "100dvh", background: "#000", color: "#fff",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        <style>{`
          @keyframes fadeUp {
            from { opacity: 0; transform: translateY(10px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>

        {/* HOST wordmark top */}
        <div style={{ padding: "52px 28px 0", flexShrink: 0 }}>
          <p style={{
            fontSize: 11, fontWeight: 900, letterSpacing: "0.35em",
            textTransform: "uppercase", color: "#fff",
          }}>HOST</p>
        </div>

        {/* Main content */}
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: "0 28px", textAlign: "center",
        }}>

          {/* Headline */}
          <h1 style={{
            fontSize: 36, fontWeight: 300, letterSpacing: "-0.02em",
            color: "#fff", margin: "0 0 10px", lineHeight: 1.15,
            animation: "fadeUp 0.5s 0.1s ease-out both",
          }}>
            Enjoy your meal.
          </h1>
          <p style={{
            fontSize: 12, color: "rgba(255,255,255,0.28)", fontWeight: 500,
            margin: "0 0 36px", letterSpacing: "0.12em", textTransform: "uppercase",
            animation: "fadeUp 0.5s 0.18s ease-out both",
          }}>
            Demo Restaurant
          </p>

          {/* Divider */}
          <div style={{ width: 32, height: 1, background: "rgba(255,255,255,0.08)", marginBottom: 36 }} />

          {/* Thank-you note */}
          <p style={{
            fontSize: 14, color: "rgba(255,255,255,0.38)",
            lineHeight: 1.7, maxWidth: 220,
            animation: "fadeUp 0.5s 0.3s ease-out both",
          }}>
            Thank you for dining with us tonight.<br />We hope to see you again soon.
          </p>
        </div>

        {/* Footer */}
        <div style={{
          padding: "0 28px 40px", flexShrink: 0,
          display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
        }}>
          <div style={{ width: 28, height: 1, background: "rgba(255,255,255,0.06)", marginBottom: 6 }} />
          <p style={{ fontSize: 9, letterSpacing: "0.35em", textTransform: "uppercase", color: "rgba(255,255,255,0.12)" }}>
            Powered by HOST
          </p>
        </div>
      </div>
    )
  }

  // ── Ready state ────────────────────────────────────────────────────────────
  if (isReady) {
    return (
      <div style={{
        height: "100dvh", background: "#000", color: "#fff",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        <style>{`
          @keyframes pulseGreen {
            0%, 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.35); }
            50%       { box-shadow: 0 0 0 22px rgba(34,197,94,0); }
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

        {/* Top HOST wordmark */}
        <div style={{ padding: "52px 28px 0", flexShrink: 0 }}>
          <p style={{
            fontSize: 11, fontWeight: 900, letterSpacing: "0.35em",
            textTransform: "uppercase", color: "#fff",
          }}>HOST</p>
        </div>

        {/* Main content */}
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: "0 28px", textAlign: "center", gap: 0,
        }}>

          {/* Green pulsing circle */}
          <div style={{
            width: 88, height: 88, borderRadius: "50%",
            background: "rgba(34,197,94,0.12)",
            border: "2px solid rgba(34,197,94,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#22c55e",
            marginBottom: 28,
            animation: "pulseGreen 2s ease-in-out infinite",
          }}>
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>

          {/* Headline */}
          <h1 style={{
            fontSize: 28, fontWeight: 700, color: "#fff",
            margin: "0 0 8px", letterSpacing: "-0.01em",
          }}>
            Your table is ready!
          </h1>
          <p style={{ fontSize: 15, color: "#22c55e", fontWeight: 600, margin: "0 0 28px" }}>
            Head to the host stand
          </p>

          {/* Full green progress bar */}
          <div style={{ width: "100%", marginBottom: 6 }}>
            <div style={{
              width: "100%", height: 8, borderRadius: 99,
              background: "rgba(255,255,255,0.07)", overflow: "hidden", marginBottom: 6,
            }}>
              <div style={{
                width: "100%", height: "100%", borderRadius: 99,
                background: "linear-gradient(90deg, #22c55e, #86efac)",
                transition: "width 1.2s ease",
              }} />
            </div>
            <div style={{
              display: "flex", justifyContent: "space-between",
              fontSize: 10, color: "rgba(255,255,255,0.25)",
            }}>
              <span>Arrived</span>
              <span>Seated</span>
            </div>
          </div>

          {/* Stat cards */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr",
            gap: 10, width: "100%", marginTop: 20, marginBottom: 20,
          }}>
            <div style={{
              background: "#141414", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 14, padding: "14px 16px",
            }}>
              <p style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 8 }}>Party</p>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 18, color: "#fff" }}>
                <Users size={14} style={{ opacity: 0.5 }} />
                {party_size}
              </div>
            </div>
            <div style={{
              background: "#141414", border: "1px solid rgba(34,197,94,0.2)",
              borderRadius: 14, padding: "14px 16px",
            }}>
              <p style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 8 }}>Wait</p>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 18, color: "#22c55e" }}>
                <Clock size={14} style={{ opacity: 0.7 }} />
                Now
              </div>
            </div>
          </div>

          {/* Message card */}
          <div style={{
            background: "rgba(34,197,94,0.07)",
            border: "1px solid rgba(34,197,94,0.18)",
            borderRadius: 14, padding: "14px 18px", width: "100%",
          }}>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.6 }}>
              Please make your way to the front and let the host know you&apos;re here.
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
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 14, cursor: "pointer",
              color: "rgba(255,255,255,0.7)",
              fontSize: 14, fontWeight: 600, letterSpacing: "0.04em",
            }}
          >
            <UtensilsCrossed size={15} style={{ opacity: 0.7 }} />
            Check Out the Menu
          </button>
          <p style={{ textAlign: "center", fontSize: 10, color: "rgba(255,255,255,0.1)", letterSpacing: "0.2em", textTransform: "uppercase" }}>
            Updates automatically · HOST
          </p>
        </div>

        {/* Menu Drawer */}
        {menuOpen && <MenuDrawer onClose={() => setMenuOpen(false)} />}
      </div>
    )
  }

  // ── Waiting state ──────────────────────────────────────────────────────────
  const partiesLabel = parties_ahead === 0
    ? "You're next up!"
    : `${parties_ahead} ${parties_ahead === 1 ? "party" : "parties"} ahead of you`

  return (
    <div style={{
      height: "100dvh", background: "#000", color: "#fff",
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

      {/* Top HOST wordmark */}
      <div style={{ padding: "52px 28px 0", flexShrink: 0 }}>
        <p style={{
          fontSize: 11, fontWeight: 900, letterSpacing: "0.35em",
          textTransform: "uppercase", color: "#fff",
        }}>HOST</p>
      </div>

      {/* Main content */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        padding: "0 28px", justifyContent: "center", gap: 22,
      }}>

        {/* Name + parties ahead */}
        <div>
          <h1 style={{
            fontSize: 30, fontWeight: 700, color: "#fff",
            margin: "0 0 6px", letterSpacing: "-0.02em",
          }}>
            {name && name !== "Guest" ? `Hi, ${name}!` : "You're in line."}
          </h1>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", margin: 0, letterSpacing: "0.02em" }}>
            {partiesLabel}
          </p>
        </div>

        {/* Orange progress bar */}
        <div>
          <div style={{
            width: "100%", height: 8, borderRadius: 99,
            background: "rgba(255,255,255,0.07)", overflow: "hidden", marginBottom: 7,
          }}>
            <div style={{
              width: `${progress}%`, height: "100%", borderRadius: 99,
              background: "linear-gradient(90deg, #22c55e, #86efac)",
              transition: "width 1s linear",
            }} />
          </div>
          <div style={{
            display: "flex", justifyContent: "space-between",
            fontSize: 10, color: "rgba(255,255,255,0.25)",
          }}>
            <span>Arrived</span>
            <span>Seated</span>
          </div>
        </div>

        {/* Stat cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div style={{
            background: "#141414", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 14, padding: "14px 16px",
          }}>
            <p style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 8 }}>Party</p>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 18, color: "#fff" }}>
              <Users size={14} style={{ opacity: 0.5 }} />
              {party_size}
            </div>
          </div>
          <div style={{
            background: "#141414", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 14, padding: "14px 16px",
          }}>
            <p style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 8 }}>Est. Wait</p>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 18, color: "#22c55e" }}>
              <Clock size={14} style={{ opacity: 0.8 }} />
              {quoted_wait && displayWait > 0 ? `~${displayWait}m` : "—"}
            </div>
          </div>
        </div>

        {/* Rotating message card */}
        <div style={{
          background: "#141414", border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 14, padding: "14px 18px",
        }}>
          <p
            key={msgIdx}
            style={{
              fontSize: 13, color: "rgba(255,255,255,0.5)",
              lineHeight: 1.6, margin: 0,
              animation: "fadeMsg 8s ease-in-out",
            }}
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
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 14, cursor: "pointer",
            color: "rgba(255,255,255,0.7)",
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
            color: "rgba(255,255,255,0.22)",
            fontSize: 12, fontWeight: 500,
            letterSpacing: "0.1em", textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          Leave &amp; Rejoin Later
        </button>

        <p style={{ textAlign: "center", fontSize: 10, color: "rgba(255,255,255,0.1)", letterSpacing: "0.2em", textTransform: "uppercase", margin: 0 }}>
          Updates automatically · HOST
        </p>
      </div>

      {/* Leave confirmation overlay */}
      {leavePrompt && (
        <>
          <div
            onClick={() => setLeavePrompt(false)}
            style={{
              position: "fixed", inset: 0, zIndex: 60,
              background: "rgba(0,0,0,0.72)",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
            }}
          />
          <div style={{
            position: "fixed", left: "50%", top: "50%", zIndex: 70,
            transform: "translate(-50%, -50%)",
            width: "calc(100% - 40px)", maxWidth: 340,
            background: "#111",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 22,
            padding: "28px 24px 24px",
            textAlign: "center",
          }}>
            <p style={{ fontSize: 18, fontWeight: 800, color: "#fff", margin: "0 0 8px", letterSpacing: "-0.01em" }}>
              Leave the waitlist?
            </p>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", margin: "0 0 28px", lineHeight: 1.5 }}>
              You&apos;ll lose your spot and will need to rejoin from the beginning.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                onClick={handleLeave}
                disabled={leaving}
                style={{
                  width: "100%", padding: "15px 0",
                  borderRadius: 14, border: "1px solid rgba(239,68,68,0.35)",
                  background: "rgba(239,68,68,0.15)",
                  color: "#f87171",
                  fontSize: 14, fontWeight: 700,
                  letterSpacing: "0.04em",
                  cursor: leaving ? "default" : "pointer",
                  opacity: leaving ? 0.6 : 1,
                }}
              >
                {leaving ? "Leaving…" : "Yes, leave the waitlist"}
              </button>
              <button
                onClick={() => setLeavePrompt(false)}
                style={{
                  width: "100%", padding: "15px 0",
                  borderRadius: 14, border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.06)",
                  color: "rgba(255,255,255,0.85)",
                  fontSize: 14, fontWeight: 700,
                  letterSpacing: "0.04em",
                  cursor: "pointer",
                }}
              >
                Stay — keep my spot
              </button>
            </div>
          </div>
        </>
      )}

      {/* Menu Drawer */}
      {menuOpen && <MenuDrawer onClose={() => setMenuOpen(false)} />}
    </div>
  )
}

// ── Menu Drawer (shared across waiting + ready states) ─────────────────────
function MenuDrawer({ onClose }: { onClose: () => void }) {
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
                    <p style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.6)", whiteSpace: "nowrap", marginTop: 2, flexShrink: 0 }}>
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
