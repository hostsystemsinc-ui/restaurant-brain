"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Minus, Plus, Loader2 } from "lucide-react"

const API = "https://restaurant-brain-production.up.railway.app"

export default function JoinPage() {
  const router      = useRouter()
  const [partySize, setPartySize] = useState(2)
  const [name,      setName]      = useState("")
  const [phone,     setPhone]     = useState("")
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState("")
  const [queueInfo, setQueueInfo] = useState<{ ahead: number; wait: number } | null>(null)
  const [restName,  setRestName]  = useState("")

  useEffect(() => {
    fetch(`${API}/queue`)
      .then(r => r.json())
      .then(q => {
        const active = Array.isArray(q) ? q.filter((e: { status: string }) =>
          e.status === "waiting" || e.status === "ready"
        ) : []
        setQueueInfo({ ahead: active.length, wait: Math.max(0, active.length * 15) })
      })
      .catch(() => setQueueInfo({ ahead: 0, wait: 0 }))

    fetch(`${API}/restaurant`)
      .then(r => r.json())
      .then(d => setRestName(d.name || ""))
      .catch(() => {})
  }, [])

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

      {/* ── Gap ──────────────────────────────────────────────────────── */}
      <div className="shrink-0" style={{ height: "20px" }} />

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
            {restName ? restName.charAt(0).toUpperCase() : "R"}
          </span>
        </div>

        {restName && (
          <p
            className="text-lg font-semibold text-center"
            style={{ color: "rgba(255,255,255,0.9)", letterSpacing: "0.03em" }}
          >
            {restName}
          </p>
        )}

        {queueInfo !== null && (
          <p className="mt-1 text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
            {queueInfo.ahead === 0
              ? "✦ Tables available now"
              : `${queueInfo.ahead} ${queueInfo.ahead === 1 ? "party" : "parties"} ahead · ~${queueInfo.wait}m`}
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
