"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { ChevronLeft, Users, Clock, CheckCircle2, XCircle, TrendingUp } from "lucide-react"

type Visual = "basic" | "classic" | "modern"

interface GuestRecord {
  id: string; name: string; party_size: number; source: string
  quoted_wait: number | null; actual_wait_min: number | null
  joined_ms: number; resolved_ms: number; status: "seated" | "removed"
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function toLocalDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

// Business day starts at 3:00 AM — before 3am we're still on the previous day
function getBusinessDate(): string {
  const now = new Date()
  if (now.getHours() < 3) {
    const prev = new Date(now)
    prev.setDate(prev.getDate() - 1)
    return toLocalDateStr(prev)
  }
  return toLocalDateStr(now)
}

function getRecords(dateStr: string): GuestRecord[] {
  try { return JSON.parse(localStorage.getItem(`host_demo_log_${dateStr}`) ?? "[]") } catch { return [] }
}

function timeUntilReset(): { h: number; m: number } {
  const now = new Date()
  const reset = new Date(now)
  reset.setDate(reset.getDate() + (now.getHours() >= 3 ? 1 : 0))
  reset.setHours(3, 0, 0, 0)
  const diff = reset.getTime() - now.getTime()
  return { h: Math.floor(diff / 3_600_000), m: Math.floor((diff % 3_600_000) / 60_000) }
}

// ── Theme tokens ──────────────────────────────────────────────────────────────

function makeT(v: Visual) {
  if (v === "modern") return {
    bg:         "#0A0A0A",
    header:     "rgba(10,10,10,0.97)",
    headerBdr:  "rgba(255,185,100,0.15)",
    text:       "rgba(255,255,255,0.92)",
    textSub:    "rgba(255,255,255,0.45)",
    textMuted:  "rgba(255,255,255,0.25)",
    card:       "rgba(255,255,255,0.04)",
    cardBdr:    "rgba(255,255,255,0.07)",
    accent:     "#fb923c",
    accentBg:   "rgba(251,146,60,0.08)",
    accentBdr:  "rgba(251,146,60,0.22)",
    barHi:      "#fb923c",
    barLo:      "rgba(255,255,255,0.11)",
    seated:     "#4ade80",
    seatedBg:   "rgba(34,197,94,0.08)",
    removed:    "#f87171",
    divider:    "rgba(255,255,255,0.07)",
    back:       "rgba(255,200,150,0.65)",
    empty:      "rgba(255,255,255,0.12)",
  }
  if (v === "classic") return {
    bg:         "#FFFDE7",
    header:     "rgba(255,252,220,0.97)",
    headerBdr:  "rgba(0,0,0,0.09)",
    text:       "rgba(0,0,0,0.84)",
    textSub:    "rgba(0,0,0,0.45)",
    textMuted:  "rgba(0,0,0,0.30)",
    card:       "rgba(255,255,255,0.55)",
    cardBdr:    "rgba(168,210,228,0.55)",
    accent:     "rgba(90,165,195,0.92)",
    accentBg:   "rgba(90,165,195,0.08)",
    accentBdr:  "rgba(90,165,195,0.28)",
    barHi:      "rgba(90,165,195,0.80)",
    barLo:      "rgba(0,0,0,0.07)",
    seated:     "#15803d",
    seatedBg:   "rgba(21,128,61,0.07)",
    removed:    "#b91c1c",
    divider:    "rgba(168,210,228,0.45)",
    back:       "rgba(0,0,0,0.40)",
    empty:      "rgba(0,0,0,0.18)",
  }
  // basic
  return {
    bg:         "#FAFAF8",
    header:     "rgba(250,250,248,0.97)",
    headerBdr:  "rgba(0,0,0,0.08)",
    text:       "#111",
    textSub:    "rgba(0,0,0,0.45)",
    textMuted:  "rgba(0,0,0,0.28)",
    card:       "rgba(0,0,0,0.03)",
    cardBdr:    "rgba(0,0,0,0.07)",
    accent:     "#111",
    accentBg:   "rgba(0,0,0,0.04)",
    accentBdr:  "rgba(0,0,0,0.10)",
    barHi:      "rgba(0,0,0,0.50)",
    barLo:      "rgba(0,0,0,0.07)",
    seated:     "#15803d",
    seatedBg:   "rgba(21,128,61,0.07)",
    removed:    "#b91c1c",
    divider:    "rgba(0,0,0,0.06)",
    back:       "rgba(0,0,0,0.42)",
    empty:      "rgba(0,0,0,0.18)",
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtH(h: number) { return `${h % 12 || 12}${h >= 12 ? "PM" : "AM"}` }

function fmtSource(s: string) {
  const m: Record<string, string> = { nfc: "NFC", host: "Host", analog: "Host Stand", phone: "Phone", web: "Web", app: "App", opentable: "OpenTable", "walk-in": "Walk-in" }
  return m[s?.toLowerCase()] ?? s ?? "—"
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function StatsPage() {
  const [visual,   setVisual]   = useState<Visual>("basic")
  const [records,  setRecords]  = useState<GuestRecord[]>([])
  const [bizDate,  setBizDate]  = useState("")
  const [lastSync, setLastSync] = useState(new Date())
  const [reset,    setReset]    = useState(timeUntilReset())

  const load = useCallback(() => {
    const v = localStorage.getItem("analog_visual")
    if (v === "classic" || v === "modern") setVisual(v)
    const bd = getBusinessDate()
    setBizDate(bd)
    setRecords(getRecords(bd))
    setLastSync(new Date())
    setReset(timeUntilReset())
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 15_000)
    return () => clearInterval(t)
  }, [load])

  const T = makeT(visual)

  // ── Derived stats ─────────────────────────────────────────────────────────

  const seated   = records.filter(r => r.status === "seated")
  const removed  = records.filter(r => r.status === "removed")
  const covers   = records.reduce((a, r) => a + r.party_size, 0)
  const seatRate = records.length ? Math.round((seated.length / records.length) * 100) : null

  const withQuoted = seated.filter(r => r.quoted_wait != null)
  const avgQuoted  = withQuoted.length
    ? Math.round(withQuoted.reduce((a, r) => a + (r.quoted_wait ?? 0), 0) / withQuoted.length)
    : null

  const hourCounts: Record<number, number> = {}
  records.forEach(r => { const h = new Date(r.joined_ms).getHours(); hourCounts[h] = (hourCounts[h] ?? 0) + 1 })
  const maxHourCount = Math.max(...Object.values(hourCounts), 1)
  const peakEntry    = Object.entries(hourCounts).sort((a, b) => Number(b[1]) - Number(a[1]))[0]

  const sizeDistrib: Record<number, number> = {}
  records.forEach(r => { sizeDistrib[r.party_size] = (sizeDistrib[r.party_size] ?? 0) + 1 })

  const sourceCounts: Record<string, number> = {}
  records.forEach(r => { const s = fmtSource(r.source); sourceCounts[s] = (sourceCounts[s] ?? 0) + 1 })

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{
      height: "100dvh", background: T.bg, color: T.text,
      display: "flex", flexDirection: "column", overflow: "hidden",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>

      {/* ── Header ── */}
      <header style={{
        height: 52, padding: "0 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: T.header, borderBottom: `1px solid ${T.headerBdr}`,
        backdropFilter: "blur(16px)", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Link href="/demo/analog" style={{
            display: "flex", alignItems: "center", gap: 4,
            color: T.back, textDecoration: "none",
            fontSize: 13, fontWeight: 500, padding: "4px 6px", borderRadius: 8,
          }}>
            <ChevronLeft style={{ width: 15, height: 15 }} />
            Analog
          </Link>
          <span style={{ color: T.textMuted, fontSize: 14, margin: "0 2px" }}>/</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Today&apos;s Stats</span>
        </div>
        <span style={{ fontSize: 11, color: T.textMuted, letterSpacing: "0.04em" }}>
          Resets at 3 AM · {reset.h}h {reset.m}m
        </span>
      </header>

      {/* ── Scrollable body ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 40px" }}>

        {records.length === 0 ? (

          /* Empty state */
          <div style={{
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            paddingTop: 100, gap: 14, textAlign: "center",
          }}>
            <TrendingUp style={{ width: 40, height: 40, color: T.empty }} />
            <p style={{ fontSize: 16, fontWeight: 600, color: T.textSub, margin: 0 }}>No activity yet today</p>
            <p style={{ fontSize: 13, color: T.textMuted, margin: 0, lineHeight: 1.6, maxWidth: 240 }}>
              Stats appear as guests are seated or removed from the waitlist.
            </p>
          </div>

        ) : (

          <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>

            {/* ── KPI row ── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>

              {/* Total Parties */}
              <div style={{ borderRadius: 16, padding: "22px 20px", background: T.card, border: `1px solid ${T.cardBdr}` }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: T.textMuted, marginBottom: 8 }}>Total Parties</div>
                <div style={{ fontSize: 44, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.02em", color: T.text }}>{records.length}</div>
                <div style={{ fontSize: 12, color: T.textSub, marginTop: 6 }}>{covers} covers</div>
              </div>

              {/* Seat Rate */}
              <div style={{ borderRadius: 16, padding: "22px 20px", background: T.seatedBg, border: `1px solid ${T.cardBdr}` }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: T.textMuted, marginBottom: 8 }}>Seat Rate</div>
                <div style={{ fontSize: 44, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.02em", color: T.seated }}>
                  {seatRate != null ? `${seatRate}%` : "—"}
                </div>
                <div style={{ fontSize: 12, color: T.textSub, marginTop: 6 }}>
                  {seated.length} seated · {removed.length} removed
                </div>
              </div>
            </div>

            {/* ── Avg Wait (only if any quoted) ── */}
            {avgQuoted != null && (
              <div style={{
                borderRadius: 16, padding: "20px 20px", background: T.card, border: `1px solid ${T.cardBdr}`,
                display: "flex", alignItems: "center", gap: 0,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: T.textMuted, marginBottom: 6 }}>Avg Quoted Wait</div>
                  <div style={{ fontSize: 38, fontWeight: 700, letterSpacing: "-0.02em", color: T.text }}>{avgQuoted}m</div>
                </div>
                <div style={{ width: 1, alignSelf: "stretch", background: T.divider, margin: "0 24px" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: T.textMuted, marginBottom: 6 }}>Quoted Today</div>
                  <div style={{ fontSize: 38, fontWeight: 700, letterSpacing: "-0.02em", color: T.text }}>{withQuoted.length}</div>
                </div>
              </div>
            )}

            {/* ── Activity by Hour ── */}
            {Object.keys(hourCounts).length > 0 && (
              <div style={{ borderRadius: 16, padding: "20px 20px", background: T.card, border: `1px solid ${T.cardBdr}` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: T.textMuted }}>
                    Activity by Hour
                  </div>
                  {peakEntry && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: T.accent }}>
                      Peak: {fmtH(Number(peakEntry[0]))}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {Object.entries(hourCounts)
                    .sort((a, b) => Number(a[0]) - Number(b[0]))
                    .map(([h, count]) => {
                      const pct = Math.round((count / maxHourCount) * 100)
                      return (
                        <div key={h} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 44, fontSize: 11, fontWeight: 500, color: T.textSub, textAlign: "right", flexShrink: 0 }}>{fmtH(Number(h))}</div>
                          <div style={{ flex: 1, height: 22, borderRadius: 5, background: T.barLo, overflow: "hidden" }}>
                            <div style={{ width: `${pct}%`, height: "100%", background: pct === 100 ? T.barHi : T.accentBg === T.barLo ? T.barHi : T.accent, borderRadius: 5, opacity: pct === 100 ? 1 : 0.65, transition: "width 0.5s" }} />
                          </div>
                          <div style={{ width: 20, fontSize: 12, fontWeight: 600, color: T.textSub, textAlign: "right", flexShrink: 0 }}>{count}</div>
                        </div>
                      )
                    })}
                </div>
              </div>
            )}

            {/* ── Party Size + Source ── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>

              {/* Party size mix */}
              <div style={{ borderRadius: 16, padding: "20px 18px", background: T.card, border: `1px solid ${T.cardBdr}` }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: T.textMuted, marginBottom: 14 }}>Party Size</div>
                <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                  {Object.entries(sizeDistrib)
                    .sort((a, b) => Number(a[0]) - Number(b[0]))
                    .map(([size, count]) => (
                      <div key={size} style={{
                        borderRadius: 10, padding: "10px 12px",
                        background: T.accentBg, border: `1px solid ${T.accentBdr}`,
                        textAlign: "center", minWidth: 48,
                      }}>
                        <div style={{ fontSize: 20, fontWeight: 700, color: T.text, lineHeight: 1 }}>{count}</div>
                        <div style={{ fontSize: 10, color: T.textMuted, marginTop: 3 }}>{size}p</div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Join source */}
              <div style={{ borderRadius: 16, padding: "20px 18px", background: T.card, border: `1px solid ${T.cardBdr}` }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: T.textMuted, marginBottom: 14 }}>Join Source</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                  {Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]).map(([src, count]) => (
                    <div key={src} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <span style={{ fontSize: 13, color: T.textSub }}>{src}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 60, height: 5, borderRadius: 3, background: T.barLo, overflow: "hidden" }}>
                          <div style={{ width: `${Math.round((count / records.length) * 100)}%`, height: "100%", background: T.accent, borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: T.text, width: 18, textAlign: "right" }}>{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Footer ── */}
            <p style={{ textAlign: "center", fontSize: 11, color: T.textMuted, margin: "6px 0 0", letterSpacing: "0.03em" }}>
              Updated {lastSync.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} · refreshes every 15s
            </p>

          </div>
        )}
      </div>
    </div>
  )
}
