"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import { X, UtensilsCrossed } from "lucide-react"

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
  arrival_time: string
  notes?: string
}

const WAITING_MESSAGES = [
  "Your spot is saved — feel free to step out.",
  "We'll let you know the moment your table is ready.",
  "Sit tight, we're moving quickly.",
  "Your table is being prepared.",
  "You can leave and come back — we've got your spot.",
]

// ── Menu data — update these to match Walter's actual menu ──────────────────
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

  const fetchEntry = useCallback(async () => {
    try {
      const r = await fetch(`${API}/queue/${id}`)
      if (!r.ok) { setError(true); return }
      setEntry(await r.json())
    } catch { setError(true) }
  }, [id])

  useEffect(() => {
    fetchEntry()
    const poll = setInterval(fetchEntry, 5000)
    return () => clearInterval(poll)
  }, [fetchEntry])

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

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-8" style={{ background: "#000", color: "#fff" }}>
        <p className="text-xs tracking-[0.3em] uppercase mb-8" style={{ color: "rgba(255,255,255,0.85)" }}>HOST</p>
        <p className="text-lg font-medium">Entry not found</p>
        <p className="text-sm mt-2 mb-8" style={{ color: "rgba(255,255,255,0.35)" }}>
          This waitlist entry may have expired.
        </p>
        <a
          href="/join"
          className="px-8 py-3 rounded-2xl text-sm font-semibold tracking-widest uppercase"
          style={{ background: "white", color: "black" }}
        >
          Rejoin
        </a>
      </div>
    )
  }

  if (!entry) {
    // Blank black screen — no spinner — so the white join animation flows
    // seamlessly into the dark wait page without an intermediate loading flash.
    return <div style={{ height: "100dvh", background: "#000" }} />
  }

  const { status, name, party_size, parties_ahead, wait_estimate, quoted_wait } = entry
  const isReady  = status === "ready"
  const isSeated = status === "seated"
  const wait     = wait_estimate ?? quoted_wait ?? 0
  const original = (quoted_wait ?? 30) || 30
  const progress = isReady || isSeated
    ? 100
    : Math.min(92, Math.max(5, ((original - wait) / original) * 100))

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#000", color: "#fff" }}>

      {/* ── Keyframe animations ── */}
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
      `}</style>

      {/* ── Top bar ── */}
      <div className="px-8 pt-12 pb-0">
        <p className="text-xs tracking-[0.3em] uppercase font-semibold" style={{ color: "rgba(255,255,255,0.85)" }}>HOST</p>
      </div>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col justify-center px-8 gap-10">

        {/* Status headline */}
        <div>
          {isSeated ? (
            <>
              <p className="text-xs tracking-[0.2em] uppercase mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>Enjoy your meal</p>
              <h2 className="text-4xl font-light">You&apos;ve been seated.</h2>
            </>
          ) : isReady ? (
            <>
              <p className="text-xs tracking-[0.2em] uppercase mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>Your table is ready</p>
              <h2 className="text-4xl font-light">Head to the host stand.</h2>
            </>
          ) : (
            <>
              <p className="text-xs tracking-[0.2em] uppercase mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>
                {parties_ahead === 0 ? "You're next" : `${parties_ahead} ${parties_ahead === 1 ? "party" : "parties"} ahead`}
              </p>
              <h2 className="text-4xl font-light">
                {name && name !== "Guest" ? `Hi, ${name}.` : "You're in line."}
              </h2>
            </>
          )}
        </div>

        {/* Progress bar */}
        {!isSeated && (
          <div className="flex flex-col gap-3">
            <div className="w-full h-0.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
              <div
                className="h-full rounded-full transition-all duration-[1500ms] ease-in-out"
                style={{ width: `${progress}%`, background: isReady ? "white" : "rgba(255,255,255,0.6)" }}
              />
            </div>
            <div className="flex justify-between text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
              <span>Arrived</span>
              <span>{isReady ? "Ready" : wait > 0 ? `~${wait} min` : "Almost"}</span>
              <span>Seated</span>
            </div>
          </div>
        )}

        {/* Info row */}
        {!isSeated && (
          <div
            className="flex items-center justify-between py-5 border-t border-b"
            style={{ borderColor: "rgba(255,255,255,0.08)" }}
          >
            <div>
              <p className="text-xs tracking-[0.15em] uppercase mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>Party</p>
              <p className="text-2xl font-light">{party_size}</p>
            </div>
            <div className="text-right">
              <p className="text-xs tracking-[0.15em] uppercase mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>Est. wait</p>
              <p className="text-2xl font-light" style={{ color: isReady ? "white" : "rgba(255,255,255,0.7)" }}>
                {isReady ? "Now" : wait > 0 ? `${wait}m` : "—"}
              </p>
            </div>
          </div>
        )}

        {/* Status message */}
        <p
          className="text-sm leading-relaxed transition-opacity duration-500"
          style={{ color: "rgba(255,255,255,0.4)" }}
        >
          {isSeated
            ? "Thank you for dining with us."
            : isReady
              ? "Please make your way to the front and let the host know you're here."
              : WAITING_MESSAGES[msgIdx]}
        </p>

      </div>

      {/* ── Footer ── */}
      <div className="px-8 pb-12 pt-4 flex flex-col gap-3">

        {/* Menu button */}
        {!isSeated && (
          <button
            onClick={() => setMenuOpen(true)}
            className="w-full flex items-center justify-center gap-2 rounded-2xl transition-all active:scale-[0.98]"
            style={{
              height: "58px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.14)",
              color: "rgba(255,255,255,0.75)",
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: "0.06em",
            }}
          >
            <UtensilsCrossed className="w-4 h-4" style={{ opacity: 0.7 }} />
            Check Out the Menu
          </button>
        )}

        {!isSeated && !isReady && (
          <button
            onClick={() => setLeavePrompt(true)}
            className="w-full py-4 rounded-2xl text-sm font-medium tracking-widest uppercase text-center transition-all active:scale-[0.98]"
            style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.28)", border: "none", cursor: "pointer" }}
          >
            Leave &amp; Rejoin Later
          </button>
        )}

        {/* ── Leave confirmation overlay ── */}
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
                You'll lose your spot and will need to rejoin from the beginning.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <a
                  href="/join"
                  style={{
                    display: "block", width: "100%", padding: "15px 0",
                    borderRadius: 14, textDecoration: "none",
                    background: "rgba(239,68,68,0.15)",
                    border: "1px solid rgba(239,68,68,0.35)",
                    color: "#f87171",
                    fontSize: 14, fontWeight: 700,
                    letterSpacing: "0.04em",
                    boxSizing: "border-box",
                  }}
                >
                  Yes, leave the waitlist
                </a>
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

        <p className="text-xs text-center mt-1" style={{ color: "rgba(255,255,255,0.1)" }}>
          Updates automatically · HOST
        </p>
      </div>

      {/* ── Menu Drawer ── */}
      {menuOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setMenuOpen(false)}
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
                  Walter&apos;s303
                </p>
                <p style={{ fontSize: 22, fontWeight: 700, color: "white", letterSpacing: "0.01em" }}>Menu</p>
              </div>
              <button
                onClick={() => setMenuOpen(false)}
                style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: "rgba(255,255,255,0.07)",
                  border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "rgba(255,255,255,0.6)",
                }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable menu */}
            <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" as never, padding: "8px 0 40px" }}>
              {MENU_SECTIONS.map((section, si) => (
                <div key={section.title} style={{ padding: "20px 24px 0", animation: `menuItemIn 0.4s ${si * 0.06}s ease-out both` }}>
                  {/* Section label */}
                  <p style={{
                    fontSize: 10, letterSpacing: "0.4em", textTransform: "uppercase",
                    color: "rgba(255,255,255,0.35)", fontWeight: 700,
                    marginBottom: 14,
                  }}>
                    {section.title}
                  </p>

                  {/* Items */}
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

                  {/* Section divider */}
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
      )}

    </div>
  )
}
