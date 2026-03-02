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

  const fetchLive = useCallback(async () => {
    try {
      const [tablesRes, insightsRes] = await Promise.all([
        fetch(`${API}/tables`),
        fetch(`${API}/insights`),
      ])
      const tables   = tablesRes.ok   ? await tablesRes.json()   : []
      const insights = insightsRes.ok ? await insightsRes.json() : null

      // Tables available from API; fallback to TOTAL_TABLES if none returned
      const occupied  = Array.isArray(tables)
        ? tables.filter((t: { status: string }) => t.status !== "available").length
        : 0
      const apiTotal  = Array.isArray(tables) && tables.length > 0 ? tables.length : TOTAL_TABLES
      const available = Math.max(0, apiTotal - occupied)

      const ahead   = insights?.parties_waiting ?? 0
      const waitMin = insights?.avg_wait_estimate > 0 ? insights.avg_wait_estimate : null

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
      router.push(`/wait/${data.entry.id}`)
    } catch {
      setError("Something went wrong. Please try again.")
      setLoading(false)
    }
  }

  return (
    <div
      className="flex flex-col"
      style={{ height: "100dvh", background: "#000", color: "#fff", overflow: "hidden" }}
    >
      {/* ── HOST wordmark — alone at the top ─────────────────────────── */}
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

      {/* ── Flexible gap — grows to push party size down ─────────────── */}
      <div className="flex-1" style={{ maxHeight: "72px" }} />

      {/* ── Restaurant identity ───────────────────────────────────────── */}
      <div className="flex flex-col items-center px-8 pb-5 shrink-0">
        {/* Avatar */}
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
          style={{
            background: "rgba(255,255,255,0.07)",
            border: "1px solid rgba(255,255,255,0.13)",
          }}
        >
          <span className="text-2xl font-bold" style={{ color: "rgba(255,255,255,0.85)" }}>
            W
          </span>
        </div>

        <p
          className="text-lg font-semibold text-center"
          style={{ color: "rgba(255,255,255,0.9)", letterSpacing: "0.03em" }}
        >
          {RESTAURANT}
        </p>

        {live !== null && (
          <p className="mt-1 text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
            {live.available > 0
              ? <>
                  <span style={{ color: "rgba(100,230,130,0.9)", fontWeight: 600 }}>
                    {live.available} {live.available === 1 ? "table" : "tables"} available
                  </span>
                  {" — "}
                  {live.waitMin ? `~${live.waitMin}m wait` : "no wait"}
                </>
              : live.waitMin
                ? `All tables occupied · ~${live.waitMin}m wait`
                : "All tables occupied"}
          </p>
        )}
      </div>

      {/* divider */}
      <div className="mx-8 shrink-0" style={{ height: "1px", background: "rgba(255,255,255,0.08)" }} />

      {/* ── Party size ───────────────────────────────────────────────── */}
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

      {/* divider */}
      <div className="mx-8 shrink-0" style={{ height: "1px", background: "rgba(255,255,255,0.08)" }} />

      {/* ── Fields: fill remaining space ─────────────────────────────── */}
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

      {/* ── CTA — pinned to bottom ────────────────────────────────────── */}
      <div className="px-8 pb-8 pt-4 shrink-0">
        {error && (
          <p className="text-sm text-center mb-4" style={{ color: "rgba(255,80,80,0.9)" }}>
            {error}
          </p>
        )}
        <button
          onClick={submit}
          disabled={loading}
          className="w-full rounded-2xl text-base font-bold tracking-[0.15em] uppercase transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          style={{
            height:     "64px",
            background: loading ? "rgba(255,255,255,0.35)" : "white",
            color:      "black",
          }}
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Join the Waitlist"}
        </button>
        <p className="text-xs text-center mt-4" style={{ color: "rgba(255,255,255,0.2)" }}>
          HOST · No app download needed
        </p>
      </div>
    </div>
  )
}
