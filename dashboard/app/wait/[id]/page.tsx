"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import { Loader2 } from "lucide-react"

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

export default function WaitPage() {
  const { id } = useParams<{ id: string }>()
  const [entry, setEntry] = useState<Entry | null>(null)
  const [error, setError] = useState(false)
  const [msgIdx, setMsgIdx] = useState(0)

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

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-8" style={{ background: "#000", color: "#fff" }}>
        <p className="text-xs tracking-[0.3em] uppercase mb-8" style={{ color: "rgba(255,255,255,0.2)" }}>HOST</p>
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
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#000" }}>
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: "rgba(255,255,255,0.3)" }} />
      </div>
    )
  }

  const { status, name, party_size, position, parties_ahead, wait_estimate, quoted_wait } = entry
  const isReady  = status === "ready"
  const isSeated = status === "seated"
  const wait     = wait_estimate ?? quoted_wait ?? 0
  const original = (quoted_wait ?? 30) || 30
  const progress = isReady || isSeated
    ? 100
    : Math.min(92, Math.max(5, ((original - wait) / original) * 100))

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#000", color: "#fff" }}>

      {/* Top bar */}
      <div className="px-8 pt-12 pb-0">
        <p className="text-xs tracking-[0.3em] uppercase" style={{ color: "rgba(255,255,255,0.2)" }}>HOST</p>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col justify-center px-8 gap-10">

        {/* Status headline */}
        <div>
          {isSeated ? (
            <>
              <p className="text-xs tracking-[0.2em] uppercase mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>Enjoy your meal</p>
              <h2 className="text-4xl font-light">You've been seated.</h2>
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

      {/* Footer */}
      <div className="px-8 pb-12 pt-4">
        {!isSeated && !isReady && (
          <a
            href="/join"
            className="block w-full py-4 rounded-2xl text-sm font-medium tracking-widest uppercase text-center transition-all"
            style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.4)" }}
          >
            Leave & Rejoin Later
          </a>
        )}
        <p className="text-xs text-center mt-5" style={{ color: "rgba(255,255,255,0.1)" }}>
          Updates automatically · HOST
        </p>
      </div>

    </div>
  )
}
