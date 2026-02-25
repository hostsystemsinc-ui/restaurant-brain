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
    // Fetch queue status
    fetch(`${API}/queue`)
      .then(r => r.json())
      .then(q => {
        const active = Array.isArray(q) ? q.filter((e: { status: string }) =>
          e.status === "waiting" || e.status === "ready"
        ) : []
        const ahead = active.length
        setQueueInfo({ ahead, wait: Math.max(0, ahead * 15) })
      })
      .catch(() => setQueueInfo({ ahead: 0, wait: 0 }))

    // Fetch restaurant name
    fetch(`${API}/restaurant`)
      .then(r => r.json())
      .then(d => setRestName(d.name || ""))
      .catch(() => {})
  }, [])

  const submit = async () => {
    if (!name.trim()) {
      setError("Please enter your name.")
      return
    }
    setLoading(true)
    setError("")
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
      className="min-h-screen flex flex-col items-center"
      style={{ background: "#000", color: "#fff" }}
    >
      {/* ── Top wordmark ───────────────────────────────────────────────── */}
      <div className="w-full flex flex-col items-center pt-16 pb-8 px-8">
        <p className="text-xs tracking-[0.4em] uppercase mb-3" style={{ color: "rgba(255,255,255,0.4)" }}>
          Powered by
        </p>
        <h1
          className="text-4xl font-bold"
          style={{ letterSpacing: "0.35em" }}
        >
          HOST
        </h1>
      </div>

      {/* ── Restaurant identity ────────────────────────────────────────── */}
      <div
        className="w-full flex flex-col items-center py-10 px-8"
        style={{ borderTop: "1px solid rgba(255,255,255,0.08)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}
      >
        {/* Logo placeholder — replace src with your logo image */}
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          <span className="text-3xl font-bold" style={{ letterSpacing: "0.05em" }}>
            {restName ? restName.charAt(0).toUpperCase() : "R"}
          </span>
        </div>
        <h2 className="text-2xl font-semibold text-center" style={{ letterSpacing: "0.05em" }}>
          {restName || "Welcome"}
        </h2>
        {queueInfo !== null && (
          <p className="mt-3 text-sm text-center" style={{ color: "rgba(255,255,255,0.5)" }}>
            {queueInfo.ahead === 0
              ? "✦ Tables available now"
              : `${queueInfo.ahead} ${queueInfo.ahead === 1 ? "party" : "parties"} ahead · ~${queueInfo.wait}m wait`}
          </p>
        )}
      </div>

      {/* ── Form ───────────────────────────────────────────────────────── */}
      <div className="w-full flex-1 flex flex-col gap-10 px-8 pt-10 max-w-sm mx-auto">

        {/* Party size */}
        <div className="flex flex-col items-center gap-6">
          <p className="text-xs tracking-[0.3em] uppercase text-white">
            Party Size
          </p>
          <div className="flex items-center gap-8">
            <button
              onClick={() => setPartySize(s => Math.max(1, s - 1))}
              disabled={partySize <= 1}
              className="w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-95"
              style={{
                border: "1px solid rgba(255,255,255,0.2)",
                color:  partySize <= 1 ? "rgba(255,255,255,0.2)" : "white",
              }}
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="text-7xl font-light tabular-nums w-16 text-center">{partySize}</span>
            <button
              onClick={() => setPartySize(s => Math.min(20, s + 1))}
              disabled={partySize >= 20}
              className="w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-95"
              style={{
                border: "1px solid rgba(255,255,255,0.2)",
                color:  partySize >= 20 ? "rgba(255,255,255,0.2)" : "white",
              }}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="h-px" style={{ background: "rgba(255,255,255,0.08)" }} />

        {/* Name */}
        <div className="flex flex-col gap-3">
          <p className="text-xs tracking-[0.3em] uppercase text-white">
            Name
          </p>
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && submit()}
            className="w-full bg-transparent border-b text-lg text-white outline-none pb-3"
            style={{
              borderColor:   "rgba(255,255,255,0.2)",
              caretColor:    "white",
            }}
          />
        </div>

        {/* Phone */}
        <div className="flex flex-col gap-3">
          <p className="text-xs tracking-[0.3em] uppercase text-white">
            Phone <span style={{ color: "rgba(255,255,255,0.35)" }}>— optional</span>
          </p>
          <input
            type="tel"
            placeholder="For SMS when your table is ready"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            onKeyDown={e => e.key === "Enter" && submit()}
            className="w-full bg-transparent border-b text-lg text-white outline-none pb-3"
            style={{
              borderColor: "rgba(255,255,255,0.2)",
              caretColor:  "white",
            }}
          />
        </div>

      </div>

      {/* ── CTA ────────────────────────────────────────────────────────── */}
      <div className="w-full max-w-sm mx-auto px-8 pb-14 pt-10">
        {error && (
          <p className="text-sm text-center mb-5" style={{ color: "rgba(255,80,80,0.9)" }}>
            {error}
          </p>
        )}
        <button
          onClick={submit}
          disabled={loading}
          className="w-full py-5 rounded-2xl text-base font-bold tracking-[0.15em] uppercase transition-all active:scale-95 flex items-center justify-center gap-2"
          style={{
            background: loading ? "rgba(255,255,255,0.35)" : "white",
            color:      "black",
          }}
        >
          {loading
            ? <Loader2 className="w-5 h-5 animate-spin" />
            : "Join the Waitlist"}
        </button>
        <p className="text-xs text-center mt-6" style={{ color: "rgba(255,255,255,0.15)" }}>
          HOST · No app download needed
        </p>
      </div>
    </div>
  )
}
