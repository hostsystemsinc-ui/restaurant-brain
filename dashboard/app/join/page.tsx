"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Minus, Plus, Loader2 } from "lucide-react"

const API          = "https://restaurant-brain-production.up.railway.app"
const RESTAURANT   = "Walter's303"
const TOTAL_TABLES = 16

interface LiveInfo {
  available: number
  waitMin:   number | null
  ahead:     number
}

export default function JoinPage() {
  const router      = useRouter()
  const [partySize, setPartySize] = useState(2)
  const [name,      setName]      = useState("")
  const [phone,     setPhone]     = useState("")
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState("")
  const [live,      setLive]      = useState<LiveInfo | null>(null)
  const [joined,    setJoined]    = useState(false)   // transition overlay

  const fetchLive = useCallback(async () => {
    try {
      const [tablesRes, insightsRes] = await Promise.all([
        fetch(`${API}/tables`),
        fetch(`${API}/insights`),
      ])
      const tables   = tablesRes.ok   ? await tablesRes.json()   : []
      const insights = insightsRes.ok ? await insightsRes.json() : null

      const apiOccupied = Array.isArray(tables)
        ? tables.filter((t: { status: string }) => t.status !== "available").length
        : 0
      const available = Math.max(0, TOTAL_TABLES - apiOccupied)
      const ahead     = insights?.parties_waiting ?? 0
      const waitMin   = insights?.avg_wait_estimate > 0 ? insights.avg_wait_estimate : null

      setLive({ available, waitMin, ahead })
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
          restaurant_id: "272a8876-e4e6-4867-831d-0525db80a8db",
        }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()

      // Show brand transition animation, then navigate
      setJoined(true)
      setTimeout(() => {
        router.push(`/wait/${data.entry.id}`)
      }, 1050)
    } catch {
      setError("Something went wrong. Please try again.")
      setLoading(false)
    }
  }

  // Suppress unused variable warning — RESTAURANT used in the identity section concept
  void RESTAURANT

  return (
    <div
      className="flex flex-col"
      style={{ height: "100dvh", background: "#000", color: "#fff", overflow: "hidden" }}
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
        @keyframes fadeOut {
          0%   { opacity: 1; }
          70%  { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>

      {/* ── HOST wordmark ── */}
      <div className="flex flex-col items-center px-8 pt-12 pb-5 shrink-0">
        <p
          className="text-xs tracking-[0.4em] uppercase mb-2"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          Powered by
        </p>
        <h1 className="text-4xl font-bold" style={{ letterSpacing: "0.35em" }}>
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
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/walters-logo.png"
            alt="Walter's303"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        </div>

        {live !== null && (live.ahead > 0 || live.waitMin) && (
          <p className="mt-1 text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
            {live.ahead > 0 && (
              <span style={{ fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>
                {live.ahead} {live.ahead === 1 ? "party" : "parties"} ahead
              </span>
            )}
            {live.ahead > 0 && live.waitMin && " · "}
            {live.waitMin ? `~${live.waitMin}m wait` : ""}
          </p>
        )}
      </div>

      {/* ── Party size ── */}
      <div className="flex flex-col items-center gap-3 py-5 px-8 shrink-0">
        <p className="text-xs tracking-[0.3em] uppercase" style={{ color: "rgba(255,255,255,0.65)" }}>
          Party Size
        </p>
        <div className="flex items-center gap-9">
          <button
            onClick={() => setPartySize(s => Math.max(1, s - 1))}
            disabled={partySize <= 1}
            className="w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-95"
            style={{
              border: "1px solid rgba(255,255,255,0.22)",
              color:  partySize <= 1 ? "rgba(255,255,255,0.2)" : "white",
            }}
          >
            <Minus className="w-4 h-4" />
          </button>
          <span className="text-6xl font-light tabular-nums w-14 text-center">{partySize}</span>
          <button
            onClick={() => setPartySize(s => Math.min(20, s + 1))}
            disabled={partySize >= 20}
            className="w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-95"
            style={{
              border: "1px solid rgba(255,255,255,0.22)",
              color:  partySize >= 20 ? "rgba(255,255,255,0.2)" : "white",
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
          <p className="text-xs tracking-[0.3em] uppercase" style={{ color: "rgba(255,255,255,0.65)" }}>
            Name
          </p>
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && submit()}
            autoComplete="name"
            className="w-full bg-transparent border-b text-xl text-white outline-none pb-2"
            style={{ borderColor: "rgba(255,255,255,0.22)", caretColor: "white" }}
          />
        </div>

        {/* Phone */}
        <div className="flex flex-col gap-2">
          <p className="text-xs tracking-[0.3em] uppercase" style={{ color: "rgba(255,255,255,0.65)" }}>
            Phone{" "}
            <span style={{ color: "rgba(255,255,255,0.4)" }}>— optional</span>
          </p>
          <input
            type="tel"
            placeholder="SMS when your table is ready"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            onKeyDown={e => e.key === "Enter" && submit()}
            autoComplete="tel"
            className="w-full bg-transparent border-b text-xl text-white outline-none pb-2"
            style={{ borderColor: "rgba(255,255,255,0.22)", caretColor: "white" }}
          />
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
            background: loading || joined ? "rgba(255,255,255,0.35)" : "white",
            color:      "black",
          }}
        >
          {loading && !joined ? <Loader2 className="w-5 h-5 animate-spin" /> : "Join the Waitlist"}
        </button>
        <p className="text-xs text-center mt-4" style={{ color: "rgba(255,255,255,0.2)" }}>
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
            background: "#000",
            animation: "overlayIn 0.28s cubic-bezier(0.4, 0, 0.2, 1) both, fadeOut 1.05s 0s ease-in-out forwards",
          }}
        >
          {/* Sub-label */}
          <p
            style={{
              fontSize: 10,
              letterSpacing: "0.55em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.38)",
              marginBottom: 14,
              animation: "subtleUp 0.45s 0.18s ease-out both",
            }}
          >
            You&apos;re in the queue
          </p>

          {/* HOST stamp */}
          <p
            style={{
              fontSize: 76,
              fontWeight: 900,
              letterSpacing: "0.28em",
              color: "#fff",
              lineHeight: 1,
              animation: "logoStamp 0.5s 0.26s cubic-bezier(0.34, 1.56, 0.64, 1) both",
            }}
          >
            HOST
          </p>

          {/* Foot note */}
          <p
            style={{
              fontSize: 11,
              letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.3)",
              marginTop: 20,
              animation: "subtleUp 0.45s 0.45s ease-out both",
            }}
          >
            {phone.trim() ? "We\u2019ll text you when it\u2019s time." : "Check back anytime."}
          </p>
        </div>
      )}

    </div>
  )
}
