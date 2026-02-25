"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import { BrainCircuit, Users, Clock, CheckCircle2, Loader2 } from "lucide-react"

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

const STATUS_MESSAGES: Record<string, string[]> = {
  waiting: [
    "Your spot is saved — feel free to step out.",
    "We'll alert you when your table is ready.",
    "Sit tight, we're moving quickly!",
    "Your table is being prepared.",
  ],
  ready: [
    "Please make your way to the host stand.",
    "Your table is waiting for you!",
    "Head on over — your host is ready for you.",
  ],
  seated: [
    "Enjoy your meal!",
    "Have a wonderful dining experience!",
  ],
}

function getMessage(status: string, position?: number): string {
  const msgs = STATUS_MESSAGES[status] ?? ["Checking your status..."]
  if (status === "waiting" && position) {
    return msgs[position % msgs.length]
  }
  return msgs[0]
}

export default function WaitPage() {
  const { id } = useParams<{ id: string }>()
  const [entry, setEntry] = useState<Entry | null>(null)
  const [error, setError] = useState(false)
  const [dots,  setDots]  = useState("")

  const fetch_ = useCallback(async () => {
    try {
      const r = await fetch(`${API}/queue/${id}`)
      if (!r.ok) { setError(true); return }
      setEntry(await r.json())
    } catch {
      setError(true)
    }
  }, [id])

  useEffect(() => {
    fetch_()
    const poll = setInterval(fetch_, 5000)
    return () => clearInterval(poll)
  }, [fetch_])

  // Animated dots for "waiting" status
  useEffect(() => {
    if (entry?.status !== "waiting") return
    const t = setInterval(() => {
      setDots(d => d.length >= 3 ? "" : d + ".")
    }, 500)
    return () => clearInterval(t)
  }, [entry?.status])

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: "#0a0a0a" }}>
        <BrainCircuit className="w-8 h-8 mb-4" style={{ color: "rgba(255,255,255,0.2)" }} />
        <p className="text-white font-semibold">Entry not found</p>
        <p className="text-sm mt-2" style={{ color: "rgba(255,255,255,0.4)" }}>
          This waitlist entry may have been removed.
        </p>
        <a
          href="/join"
          className="mt-6 px-6 py-3 rounded-xl text-sm font-medium"
          style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e" }}
        >
          Rejoin Waitlist
        </a>
      </div>
    )
  }

  if (!entry) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0a0a" }}>
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: "rgba(255,255,255,0.3)" }} />
      </div>
    )
  }

  const { status, name, party_size, position, parties_ahead, wait_estimate, quoted_wait } = entry
  const wait = wait_estimate ?? quoted_wait ?? 0
  const isReady  = status === "ready"
  const isSeated = status === "seated"

  // Progress: goes from 0→100 as wait_estimate decreases toward 0
  // Cap original quote, fall back to 30 min
  const original = (quoted_wait ?? 30) || 30
  const progress  = isReady || isSeated ? 100 : Math.min(95, Math.max(5, ((original - wait) / original) * 100))

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-12"
      style={{ background: "#0a0a0a" }}
    >
      <div className="w-full max-w-sm flex flex-col gap-8 text-center">

        {/* Icon / Status indicator */}
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center transition-all duration-700"
            style={{
              background: isReady  ? "rgba(34,197,94,0.15)"  :
                          isSeated ? "rgba(59,130,246,0.15)"  :
                                     "rgba(249,115,22,0.1)",
              border: `2px solid ${
                isReady  ? "rgba(34,197,94,0.5)"  :
                isSeated ? "rgba(59,130,246,0.5)"  :
                           "rgba(249,115,22,0.3)"
              }`,
            }}
          >
            {isSeated ? (
              <CheckCircle2 className="w-9 h-9 text-blue-400" />
            ) : isReady ? (
              <CheckCircle2 className="w-9 h-9 text-green-400" />
            ) : (
              <BrainCircuit className="w-9 h-9" style={{ color: "#f97316" }} />
            )}
          </div>

          {isSeated ? (
            <>
              <h1 className="text-3xl font-bold text-white">Enjoy!</h1>
              <p className="text-lg text-blue-300">You've been seated</p>
            </>
          ) : isReady ? (
            <>
              <h1 className="text-3xl font-bold text-white">Your table is ready!</h1>
              <p className="text-lg text-green-400">Head to the host stand</p>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-bold text-white">
                {name && name !== "Guest" ? `Hey, ${name}!` : "You're in line!"}
              </h1>
              <p className="text-base" style={{ color: "rgba(255,255,255,0.5)" }}>
                {parties_ahead === 0
                  ? "You're next up!"
                  : `${parties_ahead} ${parties_ahead === 1 ? "party" : "parties"} ahead of you`}
              </p>
            </>
          )}
        </div>

        {/* Progress Bar */}
        {!isSeated && (
          <div className="flex flex-col gap-3">
            <div
              className="w-full h-3 rounded-full overflow-hidden"
              style={{ background: "rgba(255,255,255,0.07)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${progress}%`,
                  background: isReady
                    ? "linear-gradient(90deg, #22c55e, #86efac)"
                    : "linear-gradient(90deg, #f97316, #fb923c)",
                }}
              />
            </div>
            <div className="flex items-center justify-between text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
              <span>Arrived</span>
              <span>{Math.round(progress)}%</span>
              <span>Seated</span>
            </div>
          </div>
        )}

        {/* Info Cards */}
        {!isSeated && (
          <div className="grid grid-cols-2 gap-3">
            <div
              className="rounded-xl p-4 flex flex-col gap-1"
              style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.4)" }}>Party</span>
              <div className="flex items-center gap-1.5 text-white font-bold text-lg">
                <Users className="w-4 h-4 text-white/40" />
                {party_size}
              </div>
            </div>
            <div
              className="rounded-xl p-4 flex flex-col gap-1"
              style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.4)" }}>Est. Wait</span>
              <div className="flex items-center gap-1.5 font-bold text-lg" style={{ color: isReady ? "#22c55e" : "#f97316" }}>
                <Clock className="w-4 h-4 opacity-60" />
                {isReady ? "Now" : wait > 0 ? `~${wait}m` : "Soon"}
              </div>
            </div>
          </div>
        )}

        {/* Message */}
        <div
          className="rounded-xl px-5 py-4"
          style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
            {getMessage(status, position)}{status === "waiting" ? dots : ""}
          </p>
        </div>

        {/* Actions */}
        {!isSeated && (
          <div className="flex flex-col gap-3">
            {!isReady && (
              <a
                href="/join"
                className="w-full py-3 rounded-xl text-sm font-medium transition-all text-center block"
                style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}
              >
                Leave & Rejoin Later
              </a>
            )}
          </div>
        )}

        <p className="text-xs" style={{ color: "rgba(255,255,255,0.18)" }}>
          This page updates automatically · Powered by Restaurant Brain
        </p>
      </div>
    </div>
  )
}
