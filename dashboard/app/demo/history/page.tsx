"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  ChevronLeft, RefreshCw, Clock, BarChart2,
} from "lucide-react"

const API                = "https://restaurant-brain-production.up.railway.app"
const DEMO_RESTAURANT_ID = "dec0cafe-0000-4000-8000-000000000001"
const HISTORY_KEY        = "host_demo_seating_history"
const HISTORY_DATE_KEY   = "host_demo_seating_history_date"

interface HistoryEntry {
  id:           string
  name:         string
  party_size:   number
  status:       "seated" | "removed"
  arrival_time: string
  quoted_wait:  number | null
  phone:        string | null
  notes:        string | null
}

interface SeatingRecord {
  party_size:      number
  quoted_wait:     number
  actual_wait_min: number
  seated_at:       number
  day_of_week:     number
  hour_of_day:     number
}

function getHistory(): SeatingRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function suggestWait(partySize: number): number | null {
  const hist = getHistory()
  const now  = new Date()
  const dow  = now.getDay()
  const hour = now.getHours()
  const relevant = hist.filter(r =>
    r.party_size === partySize &&
    Math.abs(r.day_of_week - dow) <= 1 &&
    Math.abs(r.hour_of_day - hour) <= 2
  )
  if (relevant.length < 3) return null
  const avg = relevant.reduce((a, r) => a + r.actual_wait_min, 0) / relevant.length
  return Math.round(avg / 5) * 5
}

const PARTY_SIZES = [1, 2, 3, 4, 5, 6, 8]

export default function HistoryPage() {
  const [tab,       setTab]       = useState<"today" | "stats">("today")
  const [entries,   setEntries]   = useState<HistoryEntry[]>([])
  const [loading,   setLoading]   = useState(true)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [toast,     setToast]     = useState<{ msg: string; type: "ok" | "err" } | null>(null)

  const showToast = (msg: string, type: "ok" | "err") => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`${API}/queue/history?restaurant_id=${DEMO_RESTAURANT_ID}`)
      if (r.ok) setEntries(await r.json())
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const restore = async (entryId: string) => {
    setRestoring(entryId)
    try {
      const r = await fetch(`${API}/queue/${entryId}/restore`, { method: "POST" })
      if (!r.ok) throw new Error()
      setEntries(prev => prev.filter(e => e.id !== entryId))
      showToast("Guest restored to waitlist", "ok")
    } catch {
      showToast("Could not restore guest.", "err")
    }
    setRestoring(null)
  }

  const fmtTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
    } catch { return "—" }
  }

  const hist      = getHistory()
  const todayMs   = (() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime() })()
  const todayHist = hist.filter(r => r.seated_at >= todayMs)
  const avgQuoted = hist.length ? Math.round(hist.reduce((a, r) => a + r.quoted_wait, 0) / hist.length) : null
  const avgActual = hist.length ? Math.round(hist.reduce((a, r) => a + r.actual_wait_min, 0) / hist.length) : null
  const hourCounts: Record<number, number> = {}
  hist.forEach(r => { hourCounts[r.hour_of_day] = (hourCounts[r.hour_of_day] ?? 0) + 1 })
  let busiestHour: number | null = null; let busiestCount = 0
  for (const [h, c] of Object.entries(hourCounts)) { if (c > busiestCount) { busiestHour = Number(h); busiestCount = c } }
  const fmtHour = (h: number) => `${h % 12 || 12}${h >= 12 ? "PM" : "AM"}`

  const seated  = entries.filter(e => e.status === "seated")
  const removed = entries.filter(e => e.status === "removed")
  const sections = [
    { key: "seated",  label: "Seated",  color: "#22c55e", items: seated  },
    { key: "removed", label: "Removed", color: "#f87171", items: removed },
  ].filter(s => s.items.length > 0)

  return (
    <div style={{ height: "100dvh", background: "#0A0A0A", color: "#fff", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <header style={{
        height: 52, padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(7,4,2,0.98)", borderBottom: "1px solid rgba(255,185,100,0.18)",
        backdropFilter: "blur(20px)", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Link href="/demo/station" style={{ display: "flex", alignItems: "center", gap: 4, color: "rgba(255,200,150,0.65)", textDecoration: "none", fontSize: 13, fontWeight: 500, padding: "4px 6px", borderRadius: 8 }}>
            <ChevronLeft style={{ width: 15, height: 15 }} />
            Station
          </Link>
          <span style={{ color: "rgba(255,185,100,0.20)", fontSize: 14 }}>/</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>History</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {tab === "today" && (
            <button
              onClick={load}
              style={{ width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "1px solid rgba(255,255,255,0.07)", cursor: "pointer", color: "rgba(255,255,255,0.35)" }}
            >
              <RefreshCw style={{ width: 13, height: 13 }} />
            </button>
          )}
        </div>
      </header>

      {/* Tabs */}
      <div style={{ padding: "16px 20px 0", display: "flex", gap: 8, flexShrink: 0, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        {(["today", "stats"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              height: 36, padding: "0 18px", borderRadius: "10px 10px 0 0",
              fontSize: 13, fontWeight: 600,
              background: tab === t ? "rgba(255,255,255,0.07)" : "transparent",
              border: `1px solid ${tab === t ? "rgba(255,255,255,0.12)" : "transparent"}`,
              borderBottom: tab === t ? "2px solid rgba(255,255,255,0.85)" : "1px solid transparent",
              color: tab === t ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.38)",
              cursor: "pointer", transition: "all 0.12s",
              marginBottom: -1,
            }}
          >
            {t === "today" ? `Today${entries.length > 0 ? ` · ${entries.length}` : ""}` : "Stats"}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 20px" }}>
        {tab === "today" ? (
          loading ? (
            <div style={{ display: "flex", justifyContent: "center", paddingTop: 64 }}>
              <div className="animate-spin" style={{ width: 22, height: 22, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.08)", borderTopColor: "rgba(255,255,255,0.5)" }} />
            </div>
          ) : entries.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12, textAlign: "center" }}>
              <Clock style={{ width: 32, height: 32, color: "rgba(255,255,255,0.12)" }} />
              <p style={{ fontSize: 15, fontWeight: 500, color: "rgba(255,255,255,0.35)", margin: 0 }}>No history yet today</p>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.20)", margin: 0, lineHeight: 1.6, maxWidth: 240 }}>
                Seated and removed guests will appear here.
              </p>
            </div>
          ) : (
            <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", flexDirection: "column", gap: 28 }}>
              {sections.map(section => (
                <div key={section.key}>
                  {/* Section header */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.30)" }}>
                      {section.label}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: section.color, opacity: 0.8 }}>
                      {section.items.length}
                    </span>
                  </div>
                  {/* Row list */}
                  <div style={{ borderRadius: 16, overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)" }}>
                    {section.items.map((e, i) => (
                      <div
                        key={e.id}
                        style={{
                          display: "flex", alignItems: "center", gap: 12,
                          padding: "14px 16px",
                          background: i % 2 === 0 ? "rgba(255,255,255,0.025)" : "rgba(255,255,255,0.015)",
                          borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : "none",
                        }}
                      >
                        {/* Color bar */}
                        <div style={{ width: 3, height: 40, borderRadius: 2, background: section.color, opacity: 0.5, flexShrink: 0 }} />
                        {/* Text */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 3 }}>
                            <span style={{ fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.92)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                              {e.name || "Guest"}
                            </span>
                            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.30)", flexShrink: 0 }}>
                              {fmtTime(e.arrival_time)}
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.42)", display: "flex", gap: 6, alignItems: "center" }}>
                            <span>{e.party_size} {e.party_size === 1 ? "guest" : "guests"}</span>
                            {e.quoted_wait != null && <><span style={{ opacity: 0.4 }}>·</span><span>{e.quoted_wait}m quoted</span></>}
                          </div>
                          {e.notes && (
                            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                              {e.notes}
                            </div>
                          )}
                        </div>
                        {/* Restore */}
                        {e.status === "removed" && (
                          <button
                            onClick={() => restore(e.id)}
                            disabled={restoring === e.id}
                            style={{
                              flexShrink: 0, height: 34, padding: "0 16px",
                              borderRadius: 10, fontSize: 13, fontWeight: 600,
                              background: "rgba(147,207,255,0.08)",
                              color: "rgba(147,207,255,0.85)",
                              border: "1px solid rgba(147,207,255,0.20)",
                              cursor: "pointer", opacity: restoring === e.id ? 0.4 : 1,
                              transition: "opacity 0.15s",
                            }}
                          >
                            {restoring === e.id ? "…" : "Restore"}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          // Stats tab
          <div style={{ maxWidth: 640, margin: "0 auto" }}>
            {hist.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12, textAlign: "center" }}>
                <BarChart2 style={{ width: 32, height: 32, color: "rgba(255,255,255,0.12)" }} />
                <p style={{ fontSize: 15, fontWeight: 500, color: "rgba(255,255,255,0.32)", margin: 0 }}>No seating data yet</p>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.20)", margin: 0, lineHeight: 1.6, maxWidth: 240 }}>Seat guests to build wait-time suggestions.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
                {/* Today stats */}
                <div>
                  <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.28)", marginBottom: 12 }}>
                    Today · {todayHist.length} parties
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                    {[
                      { label: "Parties",    value: todayHist.length, unit: "" },
                      { label: "Avg Quoted", value: avgQuoted,        unit: "min" },
                      { label: "Avg Actual", value: avgActual,        unit: "min" },
                    ].map(({ label, value, unit }) => (
                      <div key={label} style={{ borderRadius: 14, padding: "18px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", textAlign: "center" as const }}>
                        <div style={{ fontSize: 30, fontWeight: 700, lineHeight: 1, color: "rgba(255,255,255,0.92)", letterSpacing: "-0.02em" }}>{value ?? "—"}</div>
                        {unit && value != null && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.30)", marginTop: 3 }}>{unit}</div>}
                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.28)", marginTop: 6 }}>{label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* All-time */}
                <div>
                  <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.28)", marginBottom: 12 }}>
                    All Time · {hist.length} parties
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {busiestHour !== null && (
                      <div style={{ borderRadius: 14, padding: "18px 16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.28)", marginBottom: 8 }}>Busiest Hour</div>
                        <div style={{ fontSize: 28, fontWeight: 700, color: "rgba(255,255,255,0.92)", lineHeight: 1, letterSpacing: "-0.02em" }}>{fmtHour(busiestHour)}</div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.32)", marginTop: 4 }}>{busiestCount} parties</div>
                      </div>
                    )}
                    {avgQuoted != null && avgActual != null && (
                      <div style={{ borderRadius: 14, padding: "18px 16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.28)", marginBottom: 8 }}>Accuracy</div>
                        <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.02em", color: Math.abs(avgQuoted - avgActual) <= 3 ? "#22c55e" : "rgba(251,191,36,0.90)" }}>
                          {Math.abs(avgQuoted - avgActual) <= 3 ? "Great" : avgActual > avgQuoted ? "Under" : "Over"}
                        </div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.32)", marginTop: 4 }}>
                          {Math.abs(avgQuoted - avgActual)}m {avgActual > avgQuoted ? "longer" : "shorter"} than quoted
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Suggested wait times */}
                <div>
                  <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.28)", marginBottom: 4 }}>Suggested Wait Times</p>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.22)", marginBottom: 12 }}>Based on {hist.length} seatings · adjusted for time of day</p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                    {PARTY_SIZES.map(n => {
                      const suggestion = suggestWait(n)
                      return (
                        <div key={n} style={{ borderRadius: 12, padding: "14px 8px", background: suggestion ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.02)", border: `1px solid ${suggestion ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.04)"}`, textAlign: "center" as const }}>
                          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.35)", marginBottom: 4 }}>{n}{n === 8 ? "+" : ""}p</div>
                          <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1, color: suggestion ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.18)", letterSpacing: "-0.02em" }}>{suggestion ?? "—"}</div>
                          {suggestion != null && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.28)", marginTop: 3 }}>min</div>}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <button
                    onClick={() => {
                      const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]
                      const headers = ["Seated At","Party Size","Quoted Wait (min)","Actual Wait (min)","Day","Hour"]
                      const rows = hist.map(r => [new Date(r.seated_at).toLocaleString(), r.party_size, r.quoted_wait, r.actual_wait_min, DAYS[r.day_of_week], r.hour_of_day])
                      const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n")
                      const blob = new Blob([csv], { type: "text/csv" })
                      const url  = URL.createObjectURL(blob)
                      const a    = document.createElement("a"); a.href = url
                      a.download = `seating-${new Date().toLocaleDateString("en-CA")}.csv`; a.click()
                      URL.revokeObjectURL(url)
                      showToast("Exported to CSV", "ok")
                    }}
                    style={{ borderRadius: 12, padding: "12px 0", fontSize: 13, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" as const, background: "rgba(34,197,94,0.07)", color: "rgba(34,197,94,0.75)", border: "1px solid rgba(34,197,94,0.18)", cursor: "pointer" }}
                  >
                    Export to CSV
                  </button>
                  <button
                    onClick={() => {
                      try { localStorage.removeItem(HISTORY_KEY); localStorage.removeItem(HISTORY_DATE_KEY) } catch {}
                      showToast("Stats cleared", "ok")
                    }}
                    style={{ borderRadius: 12, padding: "12px 0", fontSize: 13, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" as const, background: "rgba(239,68,68,0.06)", color: "rgba(239,68,68,0.45)", border: "1px solid rgba(239,68,68,0.12)", cursor: "pointer" }}
                  >
                    Clear Stats
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: toast.type === "ok" ? "rgba(34,197,94,0.16)" : "rgba(239,68,68,0.16)",
          border: `1px solid ${toast.type === "ok" ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.35)"}`,
          color: toast.type === "ok" ? "#4ade80" : "#f87171",
          padding: "10px 20px", borderRadius: 10, fontSize: 13, fontWeight: 600,
          backdropFilter: "blur(12px)", zIndex: 999,
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
