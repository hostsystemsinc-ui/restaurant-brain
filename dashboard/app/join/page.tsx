"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Minus, Plus, BrainCircuit, Loader2 } from "lucide-react"

const API = "https://restaurant-brain-production.up.railway.app"

const PREFERENCES = [
  { key: "asap",  label: "ASAP" },
  { key: "15min", label: "~15 min" },
  { key: "30min", label: "~30 min" },
]

export default function JoinPage() {
  const router = useRouter()
  const [partySize,  setPartySize]  = useState(2)
  const [name,       setName]       = useState("")
  const [phone,      setPhone]      = useState("")
  const [preference, setPreference] = useState("asap")
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState("")
  const [waitInfo,   setWaitInfo]   = useState<{ estimate: number; position: number } | null>(null)

  // Preview wait time as party size changes
  useEffect(() => {
    const controller = new AbortController()
    fetch(`${API}/queue`, { signal: controller.signal })
      .then(r => r.json())
      .then(q => {
        const ahead = Array.isArray(q) ? q.length : 0
        setWaitInfo({ estimate: Math.max(5, ahead * 15), position: ahead + 1 })
      })
      .catch(() => {})
    return () => controller.abort()
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
      if (!res.ok) throw new Error("Failed to join")
      const data = await res.json()
      router.push(`/wait/${data.entry.id}`)
    } catch {
      setError("Something went wrong. Please try again.")
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-12"
      style={{ background: "#0a0a0a" }}
    >
      <div className="w-full max-w-sm flex flex-col gap-8">

        {/* Logo */}
        <div className="flex flex-col items-center gap-2 text-center">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)" }}
          >
            <BrainCircuit className="w-7 h-7 text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mt-2">Join the Waitlist</h1>
          {waitInfo && waitInfo.position > 1 && (
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
              {waitInfo.position - 1} {waitInfo.position === 2 ? "party" : "parties"} ahead · ~{waitInfo.estimate}m wait
            </p>
          )}
          {waitInfo && waitInfo.position === 1 && (
            <p className="text-sm text-green-400">You could be seated right away!</p>
          )}
        </div>

        {/* Party Size */}
        <div
          className="rounded-2xl border p-5"
          style={{ background: "#141414", borderColor: "rgba(255,255,255,0.08)" }}
        >
          <p className="text-xs font-semibold mb-4 tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.45)" }}>
            Party Size
          </p>
          <div className="flex items-center justify-between gap-4">
            <button
              onClick={() => setPartySize(s => Math.max(1, s - 1))}
              className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold transition-colors"
              style={{ background: "rgba(255,255,255,0.06)", color: partySize <= 1 ? "rgba(255,255,255,0.2)" : "white" }}
              disabled={partySize <= 1}
            >
              <Minus className="w-5 h-5" />
            </button>
            <span className="text-5xl font-bold text-white tabular-nums">{partySize}</span>
            <button
              onClick={() => setPartySize(s => Math.min(20, s + 1))}
              className="w-12 h-12 rounded-full flex items-center justify-center transition-colors"
              style={{ background: "rgba(255,255,255,0.06)", color: partySize >= 20 ? "rgba(255,255,255,0.2)" : "white" }}
              disabled={partySize >= 20}
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Preference */}
        <div>
          <p className="text-xs font-semibold mb-3 tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.45)" }}>
            When would you like to be seated?
          </p>
          <div className="flex gap-2">
            {PREFERENCES.map(p => (
              <button
                key={p.key}
                onClick={() => setPreference(p.key)}
                className="flex-1 py-3 rounded-xl text-sm font-medium transition-all"
                style={{
                  background: preference === p.key ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.06)",
                  color:      preference === p.key ? "#22c55e" : "rgba(255,255,255,0.6)",
                  border:     `1px solid ${preference === p.key ? "rgba(34,197,94,0.35)" : "transparent"}`,
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Optional fields */}
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-semibold tracking-widest uppercase mb-2 block" style={{ color: "rgba(255,255,255,0.45)" }}>
              Name <span style={{ color: "rgba(255,255,255,0.25)" }}>(optional)</span>
            </label>
            <input
              type="text"
              placeholder="Your name"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 outline-none"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
            />
          </div>
          <div>
            <label className="text-xs font-semibold tracking-widest uppercase mb-2 block" style={{ color: "rgba(255,255,255,0.45)" }}>
              Phone <span style={{ color: "rgba(255,255,255,0.25)" }}>(for text updates)</span>
            </label>
            <input
              type="tel"
              placeholder="(555) 000-0000"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 outline-none"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-center" style={{ color: "#ef4444" }}>{error}</p>
        )}

        {/* Submit */}
        <button
          onClick={submit}
          disabled={loading}
          className="w-full py-4 rounded-2xl text-base font-semibold transition-all flex items-center justify-center gap-2"
          style={{
            background: loading ? "rgba(34,197,94,0.3)" : "rgba(34,197,94,0.9)",
            color: "white",
          }}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Joining...
            </>
          ) : (
            "Join Waitlist"
          )}
        </button>

        <p className="text-xs text-center" style={{ color: "rgba(255,255,255,0.2)" }}>
          No app download required · Powered by Restaurant Brain
        </p>
      </div>
    </div>
  )
}
