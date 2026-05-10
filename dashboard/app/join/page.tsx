"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Minus, Plus, Loader2 } from "lucide-react"

const API         = "https://restaurant-brain-production.up.railway.app"
const WALTERS_RID = "272a8876-e4e6-4867-831d-0525db80a8db"

interface LiveInfo {
  available: number
  waitMin:   number | null
  ahead:     number
}

interface WaltersConfig {
  bgColor:         string
  accentColor:     string
  buttonTextColor: string
  restaurantName:  string
  tagline:         string
  logoUrl:         string
}

const DEFAULT_CFG: WaltersConfig = {
  bgColor:         "#000000",
  accentColor:     "#ffffff",
  buttonTextColor: "#000000",
  restaurantName:  "Walter's 303",
  tagline:         "Denver, CO",
  logoUrl:         "",
}

export default function JoinPage() {
  const router      = useRouter()
  const [partySize, setPartySize] = useState(2)
  const [name,      setName]      = useState("")
  const [phone,     setPhone]     = useState("")
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState("")
  const [live,      setLive]      = useState<LiveInfo | null>(null)
  const [joined,    setJoined]    = useState(false)
  const [cfg,       setCfg]       = useState<WaltersConfig>(DEFAULT_CFG)

  // Load live config from DB so owner console edits are reflected here
  useEffect(() => {
    fetch(`${API}/public/guest-config/${WALTERS_RID}`, { cache: "no-store" })
      .then(r => r.json())
      .then((d: { guest_config?: Record<string, unknown> | null }) => {
        const gc = d.guest_config
        if (gc && typeof gc === "object") {
          setCfg(prev => ({
            ...prev,
            bgColor:         (gc.bgColor         as string) || prev.bgColor,
            accentColor:     (gc.accentColor      as string) || prev.accentColor,
            buttonTextColor: (gc.buttonTextColor  as string) || prev.buttonTextColor,
            restaurantName:  (gc.restaurantName   as string) || prev.restaurantName,
            tagline:         (gc.tagline          as string) ?? prev.tagline,
            logoUrl:         (gc.logoUrl          as string) ?? prev.logoUrl,
          }))
        }
      })
      .catch(() => {}) // non-critical — defaults apply
  }, [])

  const fetchLive = useCallback(async () => {
    try {
      const [tablesRes, insightsRes] = await Promise.all([
        fetch(`${API}/tables?restaurant_id=${WALTERS_RID}`),
        fetch(`${API}/insights?restaurant_id=${WALTERS_RID}`),
      ])
      const tables   = tablesRes.ok   ? await tablesRes.json()   : []
      const insights = insightsRes.ok ? await insightsRes.json() : null

      const total    = Array.isArray(tables) ? tables.length : 0
      const occupied = Array.isArray(tables)
        ? tables.filter((t: { status: string }) => t.status !== "available").length
        : 0
      const ahead   = insights?.parties_waiting ?? 0
      const waitMin = insights?.avg_wait_estimate > 0 ? insights.avg_wait_estimate : null

      setLive({ available: Math.max(0, total - occupied), waitMin, ahead })
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
          preference:    "asap",
          source:        "nfc",
          restaurant_id: WALTERS_RID,
        }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()

      sessionStorage.setItem("host_wait_id", data.entry.id)
      setJoined(true)
      setTimeout(() => {
        router.push(`/wait/${data.entry.id}`)
      }, 1050)
    } catch {
      setError("Something went wrong. Please try again.")
      setLoading(false)
    }
  }

  // Derived colors from config
  const BG     = cfg.bgColor || "#000"
  const BTN    = cfg.accentColor || "#fff"
  const BTNTXT = cfg.buttonTextColor || "#000"
  // Text colors derived from bg luminance (black bg → white text)
  const h   = BG.replace("#","").padEnd(6,"0")
  const lin = (c: number) => c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4)
  const lum = 0.2126*lin(parseInt(h.slice(0,2),16)/255)+0.7152*lin(parseInt(h.slice(2,4),16)/255)+0.0722*lin(parseInt(h.slice(4,6),16)/255)
  const isDark = lum < 0.25
  const TXT   = isDark ? "#ffffff"                  : "#000000"
  const TXT2  = isDark ? "rgba(255,255,255,0.55)"  : "rgba(0,0,0,0.55)"
  const TXT3  = isDark ? "rgba(255,255,255,0.20)"  : "rgba(0,0,0,0.20)"

  // Logo: use configured URL if provided, else fall back to local file
  const logoSrc = cfg.logoUrl && cfg.logoUrl.startsWith("http") ? cfg.logoUrl : "/walters-logo.png"

  return (
    <div
      className="flex flex-col"
      style={{ height: "100dvh", background: BG, color: TXT, overflow: "hidden" }}
    >
      {/* ── Keyframe animations ── */}
      <style>{`
        @keyframes overlayIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes logoStamp {
          0%   { opacity: 0; transform: scale(0.88) translateY(4px); }
          60%  { opacity: 1; transform: scale(1.03) translateY(0); }
          100% { opacity: 1; transform: scale(1)    translateY(0); }
        }
        @keyframes subtleUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ── HOST wordmark ── */}
      <div className="flex flex-col items-center px-8 pt-12 pb-5 shrink-0">
        <p
          className="text-xs tracking-[0.4em] uppercase mb-2"
          style={{ color: TXT2 }}
        >
          Powered by
        </p>
        <h1 className="text-4xl font-bold" style={{ letterSpacing: "0.35em", color: TXT }}>
          HOST
        </h1>
      </div>

      {/* ── Flex spacer ── */}
      <div className="flex-1" style={{ maxHeight: "72px" }} />

      {/* ── Restaurant identity ── */}
      <div className="flex flex-col items-center px-8 pb-5 shrink-0">
        <div
          className="mb-3 overflow-hidden"
          style={{
            width: "200px",
            height: "76px",
            borderRadius: "14px",
            border: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)"}`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoSrc}
            alt={cfg.restaurantName}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        </div>

        {live !== null && live.ahead > 0 && (
          <p className="mt-1 text-sm" style={{ color: TXT2 }}>
            <span style={{ fontWeight: 600, color: TXT }}>
              {live.ahead} {live.ahead === 1 ? "party" : "parties"} ahead
            </span>
          </p>
        )}
      </div>

      {/* ── Party size ── */}
      <div className="flex flex-col items-center gap-3 py-5 px-8 shrink-0">
        <p className="text-xs tracking-[0.3em] uppercase" style={{ color: TXT2 }}>
          Party Size
        </p>
        <div className="flex items-center gap-9">
          <button
            onClick={() => setPartySize(s => Math.max(1, s - 1))}
            disabled={partySize <= 1}
            className="w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-95"
            style={{
              border: `1px solid ${isDark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.22)"}`,
              color:  partySize <= 1 ? (isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)") : TXT,
            }}
          >
            <Minus className="w-4 h-4" />
          </button>
          <span className="text-6xl font-light tabular-nums w-14 text-center" style={{ color: TXT }}>{partySize}</span>
          <button
            onClick={() => setPartySize(s => Math.min(20, s + 1))}
            disabled={partySize >= 20}
            className="w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-95"
            style={{
              border: `1px solid ${isDark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.22)"}`,
              color:  partySize >= 20 ? (isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)") : TXT,
            }}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Fields ── */}
      <div className="flex-1 flex flex-col justify-center gap-6 px-8">
        {/* Name */}
        <div className="flex flex-col gap-2">
          <p className="text-xs tracking-[0.3em] uppercase" style={{ color: TXT2 }}>
            Name
          </p>
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && submit()}
            autoComplete="name"
            className="w-full bg-transparent border-b text-xl outline-none pb-2"
            style={{ borderColor: isDark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.22)", caretColor: TXT, color: TXT }}
          />
        </div>

        {/* Phone */}
        <div className="flex flex-col gap-2">
          <p className="text-xs tracking-[0.3em] uppercase" style={{ color: TXT2 }}>
            Phone{" "}
            <span style={{ color: TXT3 }}>— optional</span>
          </p>
          <input
            type="tel"
            placeholder="SMS when your table is ready"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            onKeyDown={e => e.key === "Enter" && submit()}
            autoComplete="tel"
            className="w-full bg-transparent border-b text-xl outline-none pb-2"
            style={{ borderColor: isDark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.22)", caretColor: TXT, color: TXT }}
          />
          {phone.trim() && (
            <p style={{ fontSize: 10, color: TXT3, marginTop: 4 }}>
              By providing your number you agree to receive SMS updates. Reply STOP to opt out.
            </p>
          )}
        </div>
      </div>

      {/* ── CTA ── */}
      <div className="px-8 pb-8 pt-4 shrink-0">
        {error && (
          <p className="text-sm text-center mb-4" style={{ color: "rgba(255,80,80,0.9)" }}>
            {error}
          </p>
        )}
        <button
          onClick={submit}
          disabled={loading || joined}
          className="w-full rounded-2xl text-base font-bold tracking-[0.15em] uppercase transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          style={{
            height:     "64px",
            background: loading || joined ? (isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)") : BTN,
            color:      BTNTXT,
          }}
        >
          {loading && !joined ? <Loader2 className="w-5 h-5 animate-spin" /> : "Join the Waitlist"}
        </button>
        <p className="text-xs text-center mt-4" style={{ color: TXT3 }}>
          HOST · No app download needed
        </p>
      </div>

      {/* ── Join transition overlay ── */}
      {joined && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 100,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            background: BG,
            animation: "overlayIn 0.28s cubic-bezier(0.4, 0, 0.2, 1) both",
          }}
        >
          <p
            style={{
              fontSize: 10,
              letterSpacing: "0.55em",
              textTransform: "uppercase",
              color: TXT3,
              marginBottom: 14,
              animation: "subtleUp 0.45s 0.18s ease-out both",
            }}
          >
            You&apos;re in the queue
          </p>
          <p
            style={{
              fontSize: 76,
              fontWeight: 900,
              letterSpacing: "0.28em",
              color: TXT,
              lineHeight: 1,
              animation: "logoStamp 0.5s 0.26s cubic-bezier(0.34, 1.56, 0.64, 1) both",
            }}
          >
            HOST
          </p>
          <p
            style={{
              fontSize: 11,
              letterSpacing: "0.18em",
              color: TXT3,
              marginTop: 20,
              animation: "subtleUp 0.45s 0.45s ease-out both",
            }}
          >
            {phone.trim() ? "We’ll text you when it’s time." : "Check back anytime."}
          </p>
        </div>
      )}
    </div>
  )
}
