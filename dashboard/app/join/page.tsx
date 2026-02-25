"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Minus, Plus, Loader2 } from "lucide-react"

const API = "https://restaurant-brain-production.up.railway.app"

const PREFERENCES = [
  { key: "asap",  label: "Now" },
  { key: "15min", label: "15 min" },
  { key: "30min", label: "30 min" },
]

export default function JoinPage() {
  const router       = useRouter()
  const [partySize,  setPartySize]  = useState(2)
  const [name,       setName]       = useState("")
  const [phone,      setPhone]      = useState("")
  const [preference, setPreference] = useState("asap")
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState("")
  const [queueInfo,  setQueueInfo]  = useState<{ ahead: number; wait: number } | null>(null)

  useEffect(() => {
    fetch(`${API}/queue`)
      .then(r => r.json())
      .then(q => {
        const ahead = Array.isArray(q) ? q.length : 0
        setQueueInfo({ ahead, wait: Math.max(0, ahead * 15) })
      })
      .catch(() => {})
  }, [])

  const submit = async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`${API}/queue/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:       name.trim() || null,
          party_size: partySize,
          phone:      phone.trim() || null,
          preference,
          source:     "nfc",
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
    <div className="min-h-screen flex flex-col" style={{ background: "#000", color: "#fff" }}>

      {/* Header */}
      <div className="px-8 pt-14 pb-2">
        <p className="text-xs tracking-[0.3em] uppercase mb-2" style={{ color: "rgba(255,255,255,0.35)" }}>
          Welcome to
        </p>
        <h1 className="text-5xl font-bold uppercase" style={{ letterSpacing: "0.15em" }}>
          HOST
        </h1>
        {queueInfo !== null && (
          <p className="mt-3 text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
            {queueInfo.ahead === 0
              ? "Tables available now"
              : `${queueInfo.ahead} ${queueInfo.ahead === 1 ? "party" : "parties"} ahead · ~${queueInfo.wait}m`}
          </p>
        )}
      </div>

      <div className="mx-8 mt-8 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />

      <div className="flex-1 px-8 pt-8 flex flex-col gap-8">

        {/* Party Size */}
        <div>
          <p className="text-xs tracking-[0.2em] uppercase mb-5" style={{ color: "rgba(255,255,255,0.35)" }}>
            Party size
          </p>
          <div className="flex items-center gap-6">
            <button
              onClick={() => setPartySize(s => Math.max(1, s - 1))}
              disabled={partySize <= 1}
              className="w-11 h-11 rounded-full flex items-center justify-center"
              style={{ border: "1px solid rgba(255,255,255,0.15)", color: partySize <= 1 ? "rgba(255,255,255,0.2)" : "white" }}
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="text-6xl font-light tabular-nums w-12 text-center">{partySize}</span>
            <button
              onClick={() => setPartySize(s => Math.min(20, s + 1))}
              disabled={partySize >= 20}
              className="w-11 h-11 rounded-full flex items-center justify-center"
              style={{ border: "1px solid rgba(255,255,255,0.15)", color: partySize >= 20 ? "rgba(255,255,255,0.2)" : "white" }}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="h-px" style={{ background: "rgba(255,255,255,0.06)" }} />

        {/* Timing */}
        <div>
          <p className="text-xs tracking-[0.2em] uppercase mb-4" style={{ color: "rgba(255,255,255,0.35)" }}>
            Timing
          </p>
          <div className="flex gap-3">
            {PREFERENCES.map(p => (
              <button
                key={p.key}
                onClick={() => setPreference(p.key)}
                className="flex-1 py-3 rounded-xl text-sm font-medium transition-all"
                style={{
                  background: preference === p.key ? "white" : "rgba(255,255,255,0.05)",
                  color:      preference === p.key ? "black" : "rgba(255,255,255,0.5)",
                  border:     `1px solid ${preference === p.key ? "white" : "rgba(255,255,255,0.08)"}`,
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="h-px" style={{ background: "rgba(255,255,255,0.06)" }} />

        {/* Optional fields */}
        <div className="flex flex-col gap-6">
          <div>
            <p className="text-xs tracking-[0.2em] uppercase mb-3" style={{ color: "rgba(255,255,255,0.35)" }}>
              Name <span style={{ color: "rgba(255,255,255,0.2)" }}>— optional</span>
            </p>
            <input
              type="text"
              placeholder="Your name"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-transparent border-b text-base text-white outline-none pb-2"
              style={{ borderColor: "rgba(255,255,255,0.15)", caretColor: "white" }}
            />
          </div>
          <div>
            <p className="text-xs tracking-[0.2em] uppercase mb-3" style={{ color: "rgba(255,255,255,0.35)" }}>
              Phone <span style={{ color: "rgba(255,255,255,0.2)" }}>— optional</span>
            </p>
            <input
              type="tel"
              placeholder="(555) 000-0000"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full bg-transparent border-b text-base text-white outline-none pb-2"
              style={{ borderColor: "rgba(255,255,255,0.15)", caretColor: "white" }}
            />
          </div>
        </div>

      </div>

      {/* CTA */}
      <div className="px-8 pb-12 pt-6">
        {error && (
          <p className="text-sm text-center mb-4" style={{ color: "rgba(255,80,80,0.9)" }}>{error}</p>
        )}
        <button
          onClick={submit}
          disabled={loading}
          className="w-full py-4 rounded-2xl text-base font-semibold tracking-widest uppercase transition-all flex items-center justify-center gap-2"
          style={{ background: loading ? "rgba(255,255,255,0.4)" : "white", color: "black" }}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Join the Wait"}
        </button>
        <p className="text-xs text-center mt-5" style={{ color: "rgba(255,255,255,0.12)" }}>
          HOST · Powered by Restaurant Brain
        </p>
      </div>
    </div>
  )
}
