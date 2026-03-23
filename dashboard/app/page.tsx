"use client"

import React from "react"
import Link from "next/link"
import { useState, useEffect, useRef, useCallback } from "react"

/* ─── Scroll fade ──────────────────────────────────────────── */
function useFade(delay = 0) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current; if (!el) return
    el.style.opacity = "0"
    el.style.transform = "translateY(24px)"
    el.style.transition = `opacity 0.65s ease ${delay}ms, transform 0.65s ease ${delay}ms`
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { el.style.opacity = "1"; el.style.transform = "translateY(0)"; obs.disconnect() }
    }, { threshold: 0.08 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [delay])
  return ref
}

/* ─── Counter ──────────────────────────────────────────────── */
function Counter({ to, suffix = "", duration = 1400 }: { to: number; suffix?: string; duration?: number }) {
  const [val, setVal] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const started = useRef(false)
  const start = useCallback(() => {
    if (started.current) return; started.current = true
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min((now - t0) / duration, 1)
      setVal(Math.round((1 - Math.pow(1 - p, 3)) * to))
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [to, duration])
  useEffect(() => {
    const el = ref.current; if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { start(); obs.disconnect() } }, { threshold: 0.3 })
    obs.observe(el); return () => obs.disconnect()
  }, [start])
  return <span ref={ref}>{val}{suffix}</span>
}

/* ─── Icons ────────────────────────────────────────────────── */
const Icon = {
  Nfc: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 6a6 6 0 0 1 6 6"/><path d="M12 10a2 2 0 0 1 2 2"/>
    </svg>
  ),
  Sparkle: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 9.5 9.5 3 12l6.5 2.5L12 21l2.5-6.5L21 12l-6.5-2.5Z"/>
    </svg>
  ),
  Phone: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>
    </svg>
  ),
  Message: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  Monitor: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
    </svg>
  ),
  BarChart: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>
    </svg>
  ),
  Arrow: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
    </svg>
  ),
  Check: () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  X: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  Users: () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  Clock: () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  Brain: () => (
    <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.04em", color: "#fff", lineHeight: 1, fontFamily: "inherit" }}>HOST</span>
  ),
  CheckCircle: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  ),
  Trash: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
    </svg>
  ),
  Bell: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  ),
}

/* ─── Hero Image Slideshow ──────────────────────────────────── */
// Replace these Unsplash URLs with your own photos — or drop files into
// /public/hero/1.jpg, 2.jpg, 3.jpg and update the slides array below
function HeroSlideshow() {
  const slides = [
    "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1920&q=80",
    "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=1920&q=80",
    "https://images.unsplash.com/photo-1424847651672-bf20a4b0982b?w=1920&q=80",
  ]
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % slides.length), 5500)
    return () => clearInterval(t)
  }, [])
  return (
    <>
      {slides.map((src, i) => (
        <div key={src} style={{
          position: "absolute", inset: 0, zIndex: 0,
          backgroundImage: `url(${src})`,
          backgroundSize: "cover", backgroundPosition: "center 40%",
          opacity: i === idx ? 1 : 0,
          transition: "opacity 2s ease",
          filter: "brightness(0.72) saturate(0.9)",
        }} />
      ))}
    </>
  )
}

/* ─── iPad Mockup — clean realistic host dashboard ──────────── */
function IPadMockup() {
  // Queue entries
  const queue = [
    { name: "Sarah M.", party: 2, wait: "~10m", note: "Birthday 🎂", elapsed: "4m", color: "#f97316" },
    { name: "Chen Party", party: 4, wait: "~18m", note: "", elapsed: "12m", color: "#f97316" },
    { name: "Rodriguez", party: 3, wait: "~26m", note: "Outdoor pref", elapsed: "18m", color: "#ef4444" },
  ]
  // Table helper — cleaner dots-and-rectangle style
  const tbl = (n: number, x: number, y: number, w: number, h: number, round: boolean, occupied: boolean) => (
    <div key={n} style={{ position: "absolute", left: x, top: y, width: w, height: h }}>
      <div style={{
        width: "100%", height: "100%",
        borderRadius: round ? 99 : 8,
        background: occupied ? "rgba(249,115,22,0.12)" : "rgba(34,197,94,0.06)",
        border: `1px solid ${occupied ? "rgba(249,115,22,0.35)" : "rgba(34,197,94,0.22)"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ fontSize: 7, fontWeight: 800, color: occupied ? "rgba(249,115,22,0.8)" : "rgba(34,197,94,0.7)" }}>{n}</span>
      </div>
    </div>
  )

  return (
    <div style={{
      width: 640, height: 450, flexShrink: 0, borderRadius: 22,
      background: "linear-gradient(160deg, #38383c 0%, #222226 40%, #1e1e22 100%)",
      boxShadow: "0 0 0 0.5px rgba(255,255,255,0.12), 0 0 0 1px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.08)",
      padding: 11, position: "relative",
    }}>
      {/* Hardware */}
      <div style={{ position: "absolute", top: 5, left: "50%", transform: "translateX(-50%)", width: 6, height: 6, borderRadius: "50%", background: "#28282c", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.8)" }} />
      <div style={{ position: "absolute", right: -3, top: 80, width: 3, height: 44, borderRadius: "0 2px 2px 0", background: "#28282c" }} />
      <div style={{ position: "absolute", left: -3, top: 72, width: 3, height: 28, borderRadius: "2px 0 0 2px", background: "#28282c" }} />
      <div style={{ position: "absolute", left: -3, top: 108, width: 3, height: 28, borderRadius: "2px 0 0 2px", background: "#28282c" }} />

      <div style={{ borderRadius: 13, overflow: "hidden", height: "100%", background: "#080a0c", display: "flex", flexDirection: "column" }}>

        {/* Header bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 14px", background: "#080a0c", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.24em", color: "#fff" }}>HOST</span>
            <div style={{ width: 1, height: 13, background: "rgba(255,255,255,0.08)" }} />
            <span style={{ fontSize: 8, fontWeight: 600, color: "rgba(255,255,255,0.45)" }}>The Buff · Boulder</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.25)", borderRadius: 6, padding: "2px 7px" }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#f97316" }} />
              <span style={{ fontSize: 7.5, fontWeight: 700, color: "#f97316" }}>3 waiting</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 6, padding: "2px 7px" }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e" }} />
              <span style={{ fontSize: 7.5, fontWeight: 700, color: "#22c55e" }}>14 free</span>
            </div>
            <span style={{ fontSize: 7.5, color: "rgba(255,255,255,0.2)" }}>8:42 PM</span>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

          {/* Queue panel */}
          <div style={{ width: 168, borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", background: "#090b0d", flexShrink: 0 }}>
            <div style={{ padding: "8px 10px 6px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ fontSize: 6.5, fontWeight: 800, letterSpacing: ".18em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>WAITLIST</div>
            </div>
            <div style={{ padding: "8px 8px 0", display: "flex", flexDirection: "column", gap: 6 }}>
              {queue.map((g, i) => (
                <div key={g.name} style={{ borderRadius: 10, border: `1px solid ${i === 0 ? "rgba(249,115,22,0.25)" : "rgba(255,255,255,0.07)"}`, background: i === 0 ? "rgba(249,115,22,0.05)" : "rgba(255,255,255,0.015)", overflow: "hidden" }}>
                  <div style={{ padding: "7px 9px 5px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#fff" }}>{g.name}</span>
                      <span style={{ fontSize: 7, color: "rgba(255,255,255,0.28)" }}>#{i + 1}</span>
                    </div>
                    <div style={{ display: "flex", gap: 7, fontSize: 6.5, color: "rgba(255,255,255,0.35)", marginBottom: g.note ? 4 : 0 }}>
                      <span>👥 {g.party}p</span>
                      <span style={{ color: g.color }}>{g.elapsed}</span>
                      <span style={{ color: "rgba(255,255,255,0.28)" }}>{g.wait}</span>
                    </div>
                    {g.note && <span style={{ fontSize: 6, padding: "1px 5px", borderRadius: 3, background: "rgba(249,115,22,0.1)", color: "rgba(249,115,22,0.65)", border: "1px solid rgba(249,115,22,0.2)" }}>{g.note}</span>}
                  </div>
                  {i === 0 && (
                    <div style={{ display: "flex", borderTop: "1px solid rgba(255,255,255,0.06)", height: 24 }}>
                      <button style={{ flex: 1, background: "rgba(34,197,94,0.12)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}>
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                        <span style={{ fontSize: 6, color: "#22c55e", fontWeight: 700 }}>Seat</span>
                      </button>
                      <div style={{ width: 1, background: "rgba(255,255,255,0.05)" }} />
                      <button style={{ flex: 1, background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}>
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                        <span style={{ fontSize: 6, color: "#f97316", fontWeight: 700 }}>Notify</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Floor plan */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#0a0c0e" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 13px 4px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <span style={{ fontSize: 6.5, fontWeight: 700, letterSpacing: ".18em", textTransform: "uppercase", color: "rgba(255,255,255,0.18)" }}>FLOOR PLAN</span>
              <span style={{ fontSize: 7, color: "rgba(255,255,255,0.2)" }}>14 available · 2 occupied</span>
            </div>
            <div style={{ flex: 1, position: "relative", padding: "12px" }}>
              {/* Section labels */}
              <div style={{ position: "absolute", top: 10, left: 18, fontSize: 6, fontWeight: 700, letterSpacing: ".18em", textTransform: "uppercase", color: "rgba(255,255,255,0.12)" }}>MAIN DINING</div>
              <div style={{ position: "absolute", top: 10, right: 18, fontSize: 6, fontWeight: 700, letterSpacing: ".18em", textTransform: "uppercase", color: "rgba(255,255,255,0.12)" }}>BAR</div>

              {/* Tables — col 1 round */}
              {tbl(1, 8,   28,  48, 48, true,  false)}
              {tbl(2, 8,   88,  48, 48, true,  false)}
              {tbl(3, 8,   148, 48, 48, true,  false)}
              {/* col 2 */}
              {tbl(4, 70,  22,  60, 44, false, true)}
              {tbl(5, 70,  80,  60, 44, false, false)}
              {tbl(6, 70,  138, 60, 44, false, false)}
              {/* col 3 */}
              {tbl(7, 144, 18,  88, 50, false, false)}
              {tbl(8, 144, 82,  88, 58, false, false)}
              {tbl(9, 144, 154, 88, 50, false, true)}
              {/* col 4 */}
              {tbl(10, 246, 18,  74, 46, false, false)}
              {tbl(11, 246, 78,  60, 42, false, false)}
              {tbl(12, 246, 134, 60, 42, false, false)}
              {/* Bar stools */}
              {tbl(13, 334, 22,  34, 34, true, false)}
              {tbl(14, 334, 66,  34, 34, true, false)}
              {tbl(15, 334, 110, 34, 34, true, false)}
              {tbl(16, 334, 154, 34, 34, true, false)}

              {/* Add guest FAB */}
              <div style={{ position: "absolute", bottom: 10, right: 10, background: "#22c55e", color: "#fff", borderRadius: 99, padding: "5px 13px", fontSize: 7.5, fontWeight: 800, display: "flex", alignItems: "center", gap: 4, boxShadow: "0 4px 18px rgba(34,197,94,0.4)", letterSpacing: "0.04em" }}>
                <span style={{ fontSize: 11, lineHeight: 1 }}>+</span> ADD GUEST
              </div>
            </div>
          </div>
        </div>

        {/* Status bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3px 13px", borderTop: "1px solid rgba(255,255,255,0.04)", background: "#060809" }}>
          <span style={{ fontSize: 6.5, color: "rgba(255,255,255,0.15)" }}>Synced · 8:42:17 PM</span>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e" }} />
            <span style={{ fontSize: 6.5, color: "rgba(255,255,255,0.22)" }}>Live</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── iPhone Mockup — clean realistic wait page ─────────────── */
function IPhoneMockup() {
  return (
    <div style={{
      position: "relative", width: 200, height: 420, flexShrink: 0,
      borderRadius: 46,
      background: "linear-gradient(160deg, #404044 0%, #232325 30%, #1a1a1c 70%, #28282c 100%)",
      boxShadow: [
        "0 0 0 0.5px rgba(255,255,255,0.18)",
        "0 0 0 1px rgba(0,0,0,0.8)",
        "inset 0 1px 0 rgba(255,255,255,0.12)",
        "inset 0 -1px 0 rgba(0,0,0,0.5)",
      ].join(", "),
      padding: 8,
    }}>
      {/* Hardware buttons */}
      <div style={{ position: "absolute", left: -2.5, top: 80, width: 3, height: 15, borderRadius: "3px 0 0 3px", background: "linear-gradient(180deg,#404044,#2c2c2e)" }} />
      <div style={{ position: "absolute", left: -2.5, top: 110, width: 3, height: 34, borderRadius: "3px 0 0 3px", background: "linear-gradient(180deg,#404044,#2c2c2e)" }} />
      <div style={{ position: "absolute", left: -2.5, top: 152, width: 3, height: 34, borderRadius: "3px 0 0 3px", background: "linear-gradient(180deg,#404044,#2c2c2e)" }} />
      <div style={{ position: "absolute", right: -2.5, top: 120, width: 3, height: 60, borderRadius: "0 3px 3px 0", background: "linear-gradient(180deg,#404044,#2c2c2e)" }} />

      {/* Screen */}
      <div style={{ borderRadius: 39, overflow: "hidden", height: "100%", background: "#060608", display: "flex", flexDirection: "column" }}>
        {/* Dynamic Island */}
        <div style={{ height: 40, flexShrink: 0, display: "flex", justifyContent: "center", alignItems: "flex-end", paddingBottom: 6, background: "#060608" }}>
          <div style={{ width: 80, height: 22, background: "#000", borderRadius: 99, boxShadow: "inset 0 1px 3px rgba(0,0,0,1)" }} />
        </div>

        {/* App content */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "14px 16px 16px", textAlign: "center" }}>
          {/* Brand */}
          <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: "0.18em", color: "#f97316", marginBottom: 14 }}>HOST</div>

          {/* Name + status */}
          <div style={{ marginBottom: 16, width: "100%" }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", marginBottom: 6 }}>Hey, Sarah.</div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.3)", borderRadius: 99, padding: "4px 12px" }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#f97316", flexShrink: 0 }} />
              <span style={{ fontSize: 9, fontWeight: 700, color: "#f97316" }}>3 parties ahead of you</span>
            </div>
          </div>

          {/* Progress */}
          <div style={{ width: "100%", marginBottom: 16 }}>
            <div style={{ width: "100%", height: 6, borderRadius: 99, background: "rgba(255,255,255,0.06)", overflow: "hidden", marginBottom: 5 }}>
              <div style={{ width: "22%", height: "100%", borderRadius: 99, background: "linear-gradient(90deg,#f97316,#fb923c)" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: "rgba(255,255,255,0.22)" }}>
              <span>Joined</span>
              <span style={{ color: "#f97316", fontWeight: 700 }}>22%</span>
              <span>Seated</span>
            </div>
          </div>

          {/* Info cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, width: "100%", marginBottom: 12 }}>
            <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "10px 12px" }}>
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 5 }}>Party</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", lineHeight: 1 }}>2</div>
            </div>
            <div style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.18)", borderRadius: 12, padding: "10px 12px" }}>
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 5 }}>Est. Wait</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#f97316", lineHeight: 1 }}>~45m</div>
            </div>
          </div>

          {/* Message card */}
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "10px 13px", width: "100%", marginBottom: 14 }}>
            <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.5)", lineHeight: 1.6, textAlign: "left" }}>
              Your spot is saved — feel free to step outside.
            </div>
          </div>

          {/* Live dot */}
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: "auto" }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e" }} />
            <span style={{ fontSize: 8, color: "rgba(255,255,255,0.22)", letterSpacing: ".03em" }}>Updates automatically</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Mini phone for puck tap demo ─────────────────────────── */
function MiniPhone({ confirmed }: { confirmed: boolean }) {
  return (
    <div style={{
      width: 76, height: 152, borderRadius: 20,
      background: "linear-gradient(155deg, #343436 0%, #1c1c1e 30%, #1a1a1c 100%)",
      boxShadow: [
        "0 28px 60px rgba(0,0,0,0.95)",
        "0 0 0 0.5px rgba(255,255,255,0.15)",
        "inset 0 1px 0 rgba(255,255,255,0.07)",
      ].join(", "),
      padding: 4,
    }}>
      <div style={{ borderRadius: 16, overflow: "hidden", height: "100%", background: "#050505", display: "flex", flexDirection: "column", boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,0.9)" }}>
        <div style={{ height: 18, flexShrink: 0, display: "flex", justifyContent: "center", alignItems: "flex-end", paddingBottom: 3, background: "#050505" }}>
          <div style={{ width: 29, height: 8, background: "#000", borderRadius: 99 }} />
        </div>
        {confirmed ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, padding: "4px 8px" }}>
            <div style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(34,197,94,0.15)", border: "1.5px solid rgba(34,197,94,0.5)", display: "flex", alignItems: "center", justifyContent: "center", color: "#22c55e" }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div style={{ fontSize: 6.5, fontWeight: 700, color: "#22c55e", textAlign: "center", lineHeight: 1.4 }}>You&apos;re on<br/>the list!</div>
          </div>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "7px 8px", gap: 5 }}>
            <span style={{ fontSize: 8, fontWeight: 900, letterSpacing: "0.04em", color: "#22c55e" }}>HOST</span>
            <div style={{ fontSize: 6, fontWeight: 700, color: "#fff", textAlign: "center" }}>Join the Waitlist</div>
            <div style={{ fontSize: 5.5, color: "rgba(255,255,255,0.4)", textAlign: "center" }}>Trattoria Napoli</div>
            <div style={{ width: "100%", background: "rgba(34,197,94,0.88)", borderRadius: 7, padding: "4px 0", fontSize: 5.5, fontWeight: 700, color: "#000", textAlign: "center", marginTop: 2 }}>
              Join Waitlist
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── HOST Puck Tap Animation ───────────────────────────────── */
function PuckTap() {
  // phases: 0 = phone resting above, 1 = descending, 2 = confirmed, 3 = lifting
  const [phase, setPhase] = useState(0)
  useEffect(() => {
    const run = () => {
      setPhase(0)
      setTimeout(() => setPhase(1), 900)
      setTimeout(() => setPhase(2), 1600)
      setTimeout(() => setPhase(3), 3600)
      setTimeout(() => setPhase(0), 4400)
    }
    run()
    const id = setInterval(run, 5200)
    return () => clearInterval(id)
  }, [])

  const phoneDown = phase === 1 || phase === 2
  const glowing   = phase === 2

  return (
    <div style={{ position: "relative", width: 240, height: 400, display: "flex", alignItems: "center", justifyContent: "center" }}>

      {/* Phone — descends toward puck on tap */}
      <div style={{
        position: "absolute", left: "50%", top: 8,
        transform: `translateX(-50%) translateY(${phoneDown ? 66 : 0}px)`,
        transition: phase === 1 ? "transform 0.55s cubic-bezier(0.4,0,0.2,1)"
                  : phase === 3 ? "transform 0.45s cubic-bezier(0.4,0,0.6,1)"
                  : "none",
        zIndex: 10,
      }}>
        <MiniPhone confirmed={phase === 2} />
      </div>

      {/* Ripple rings when tapped */}
      {glowing && (
        <>
          <div style={{ position: "absolute", top: 210, left: "50%", transform: "translate(-50%,-50%)", width: 190, height: 190, borderRadius: "50%", border: "1.5px solid rgba(34,197,94,0.5)", animation: "puckring 1.3s ease-out forwards", pointerEvents: "none", zIndex: 2 }} />
          <div style={{ position: "absolute", top: 210, left: "50%", transform: "translate(-50%,-50%)", width: 190, height: 190, borderRadius: "50%", border: "1.5px solid rgba(34,197,94,0.25)", animation: "puckring 1.3s ease-out 0.28s forwards", pointerEvents: "none", zIndex: 2 }} />
        </>
      )}

      {/* HOST Puck — exactly matches real sticker: HOST top, 4 downward NFC arcs, tagline bottom, no dot */}
      <div style={{
        position: "absolute", top: 122, left: "50%", transform: "translateX(-50%)",
        width: 178, height: 178, borderRadius: "50%", overflow: "hidden",
        background: glowing
          ? "radial-gradient(circle at 35% 28%, #1e2024 0%, #08090b 100%)"
          : "radial-gradient(circle at 35% 28%, #181a1e 0%, #060708 100%)",
        border: `2px solid ${glowing ? "rgba(34,197,94,0.5)" : "rgba(255,255,255,0.22)"}`,
        boxShadow: glowing
          ? "0 0 0 5px rgba(34,197,94,0.08), 0 0 64px rgba(34,197,94,0.28), 0 32px 72px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.06)"
          : "0 32px 72px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.05)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 2, transition: "box-shadow 0.4s ease, border-color 0.4s ease",
        zIndex: 5,
      }}>
        {/* HOST — very large bold, dominant top element, exactly like sticker */}
        <span style={{ fontSize: 40, fontWeight: 900, letterSpacing: "0.05em", color: "#fff", lineHeight: 1 }}>HOST</span>

        {/* NFC signal — 4 ∩ arches bowing upward (sweep=1), widest at top, narrowest at bottom */}
        <svg width="88" height="70" viewBox="0 0 120 94" fill="none">
          <path d="M8,30   A67,67 0 0,1 112,30" stroke="white" strokeWidth="6" strokeLinecap="round"/>
          <path d="M22,56  A49,49 0 0,1 98,56"  stroke="white" strokeWidth="6" strokeLinecap="round"/>
          <path d="M38,76  A28,28 0 0,1 82,76"  stroke="white" strokeWidth="6" strokeLinecap="round"/>
          <path d="M52,88  A10,10 0 0,1 68,88"  stroke="white" strokeWidth="6" strokeLinecap="round"/>
        </svg>

        {/* TAP TO JOIN THE LINE — spaced small caps at bottom, exactly like sticker */}
        <span style={{ fontSize: 6.5, fontWeight: 700, letterSpacing: "0.24em", color: "rgba(255,255,255,0.8)", textTransform: "uppercase" }}>TAP TO JOIN THE LINE</span>
      </div>

      {/* Puck base/shadow */}
      <div style={{ position: "absolute", top: 292, left: "50%", transform: "translateX(-50%)", width: 120, height: 10, background: "rgba(0,0,0,0.5)", borderRadius: "50%", filter: "blur(6px)", zIndex: 4 }} />

      {/* You're on the list badge — pops in on confirm */}
      {phase === 2 && (
        <div style={{
          position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)",
          background: "rgba(10,12,14,0.97)", border: "1px solid rgba(34,197,94,0.32)",
          borderRadius: 14, padding: "10px 16px", whiteSpace: "nowrap",
          display: "flex", alignItems: "center", gap: 10,
          boxShadow: "0 16px 48px rgba(0,0,0,.8)",
          animation: "badgein 0.45s cubic-bezier(0.34,1.56,0.64,1) both",
          zIndex: 20,
        }}>
          <div style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(34,197,94,0.12)", border: "1.5px solid rgba(34,197,94,0.4)", display: "flex", alignItems: "center", justifyContent: "center", color: "#22c55e", flexShrink: 0 }}>
            <Icon.Check />
          </div>
          <div>
            <div style={{ fontSize: ".7rem", fontWeight: 700, color: "#fff" }}>You&apos;re on the list</div>
            <div style={{ fontSize: ".6rem", color: "rgba(255,255,255,0.35)", marginTop: 2 }}>~18 min · 2 parties ahead</div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Guest Journey Phone Animation ────────────────────────── */
function GuestJourney() {
  const [stage, setStage] = useState(0)
  const [visible, setVisible] = useState(true)
  const ref = useRef<HTMLDivElement>(null)
  const active = useRef(false)

  // Start cycling only when in viewport
  useEffect(() => {
    const el = ref.current; if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !active.current) { active.current = true }
    }, { threshold: 0.3 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    const durations = [4000, 5000, 4500, 4500, 4000]
    const t = setTimeout(() => {
      setVisible(false)
      setTimeout(() => { setStage(s => (s + 1) % 5); setVisible(true) }, 380)
    }, durations[stage])
    return () => clearTimeout(t)
  }, [stage])

  const stageLabels = ["Tap or Scan", "Watching the Queue", "Almost There", "Table's Ready", "Enjoy"]
  const stageDescs = [
    "Guest taps the HOST puck on the sign out front or scans the QR code. They're in the queue in under 10 seconds — before they even reach the host stand.",
    "Their phone shows their position, party size, and a live wait estimate. It updates automatically as other parties are seated.",
    "The progress bar moves and the wait estimate counts down. They can be anywhere — outside, at the bar, down the street.",
    "One tap in the HOST dashboard fires an SMS instantly. Their live page flips to 'head to the host stand.' No buzzers.",
    "They walk in, you seat them. Clean, fast, no chaos.",
  ]

  return (
    <div ref={ref} style={{ display: "flex", gap: 64, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
      {/* Phone */}
      <div style={{ position: "relative" }}>
        {/* SMS overlay for stage 3 */}
        {stage === 3 && (
          <div style={{
            position: "absolute", top: 8, left: -80, zIndex: 20,
            background: "#1c1c1e", border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 16, padding: "10px 13px", width: 160,
            boxShadow: "0 16px 48px rgba(0,0,0,0.8)",
            animation: "smsin 0.4s cubic-bezier(0.34,1.3,0.64,1) both",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <div style={{ width: 20, height: 20, borderRadius: 6, background: "linear-gradient(135deg, #22c55e, #16a34a)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 9, color: "#fff" }}>✉</span>
              </div>
              <div>
                <div style={{ fontSize: 8.5, fontWeight: 700, color: "#fff" }}>Messages</div>
                <div style={{ fontSize: 7.5, color: "rgba(255,255,255,0.4)" }}>now</div>
              </div>
            </div>
            <div style={{ fontSize: 8, color: "rgba(255,255,255,0.7)", lineHeight: 1.45 }}>
              <span style={{ color: "#22c55e", fontWeight: 700 }}>Trattoria Napoli:</span>{" "}
              Your table is ready! Head to the host stand 🍽️
            </div>
          </div>
        )}

        {/* Phone frame */}
        <div style={{
          width: 220, height: 460, borderRadius: 50,
          background: "linear-gradient(155deg, #343436 0%, #1c1c1e 25%, #1a1a1c 75%, #222224 100%)",
          boxShadow: [
            "0 80px 160px rgba(0,0,0,0.98)",
            "0 30px 60px rgba(0,0,0,0.7)",
            "0 8px 20px rgba(0,0,0,0.5)",
            "0 0 0 0.5px rgba(255,255,255,0.16)",
            "inset 0 1px 0 rgba(255,255,255,0.09)",
            "inset 0 -1px 0 rgba(0,0,0,0.6)",
          ].join(", "),
          padding: 10, position: "relative",
        }}>
          {/* Left side — action + vol up + vol down */}
          <div style={{ position: "absolute", left: -2.5, top: 86, width: 3, height: 17, borderRadius: "3px 0 0 3px", background: "linear-gradient(180deg,#3c3c3e,#2c2c2e)" }} />
          <div style={{ position: "absolute", left: -2.5, top: 118, width: 3, height: 34, borderRadius: "3px 0 0 3px", background: "linear-gradient(180deg,#3c3c3e,#2c2c2e)" }} />
          <div style={{ position: "absolute", left: -2.5, top: 160, width: 3, height: 34, borderRadius: "3px 0 0 3px", background: "linear-gradient(180deg,#3c3c3e,#2c2c2e)" }} />
          {/* Right side — power */}
          <div style={{ position: "absolute", right: -2.5, top: 126, width: 3, height: 62, borderRadius: "0 3px 3px 0", background: "linear-gradient(180deg,#3c3c3e,#2c2c2e)" }} />

          <div style={{ borderRadius: 41, overflow: "hidden", height: "100%", background: "#050505", display: "flex", flexDirection: "column", boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,0.9)" }}>
            {/* Dynamic Island */}
            <div style={{ height: 46, flexShrink: 0, display: "flex", justifyContent: "center", alignItems: "flex-end", paddingBottom: 7, background: "#050505" }}>
              <div style={{ width: 88, height: 24, background: "#000", borderRadius: 99, boxShadow: "0 0 0 0.5px rgba(255,255,255,0.04), inset 0 1px 3px rgba(0,0,0,0.9)" }} />
            </div>

            {/* Screen content */}
            <div style={{ flex: 1, overflow: "hidden", opacity: visible ? 1 : 0, transition: "opacity 0.35s ease" }}>
              {stage === 0 && <JoinScreen />}
              {stage === 1 && <WaitScreen position={3} wait={45} progress={20} />}
              {stage === 2 && <WaitScreen position={1} wait={12} progress={72} />}
              {stage === 3 && <ReadyScreen />}
              {stage === 4 && <SeatedScreen />}
            </div>
          </div>
        </div>
      </div>

      {/* Stage info */}
      <div style={{ maxWidth: 320 }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: ".72rem", fontWeight: 800, letterSpacing: ".14em", textTransform: "uppercase", color: "#22c55e", marginBottom: 10 }}>
            Step {stage + 1} of 5
          </div>
          <div style={{ opacity: visible ? 1 : 0, transition: "opacity 0.35s ease" }}>
            <h3 style={{ fontSize: "1.5rem", fontWeight: 900, letterSpacing: "-0.03em", marginBottom: 10, color: "#fff" }}>
              {stageLabels[stage]}
            </h3>
            <p style={{ fontSize: ".9rem", color: "rgba(255,255,255,0.45)", lineHeight: 1.7 }}>
              {stageDescs[stage]}
            </p>
          </div>
        </div>

        {/* Stage dots */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {stageLabels.map((_, i) => (
            <div
              key={i}
              onClick={() => { setVisible(false); setTimeout(() => { setStage(i); setVisible(true) }, 200) }}
              style={{
                width: stage === i ? 28 : 8,
                height: 8, borderRadius: 99, cursor: "pointer",
                background: stage === i ? "#22c55e" : "rgba(255,255,255,0.14)",
                transition: "width 0.3s ease, background 0.3s ease",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── Join Screen (stage 0) ────────────────────────────────── */
function JoinScreen() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#000" }}>
      {/* HOST wordmark — top center, matches real join page */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "14px 16px 8px" }}>
        <div style={{ fontSize: 6.5, letterSpacing: "0.4em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", marginBottom: 2 }}>Powered by</div>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "0.35em", color: "#fff" }}>HOST</div>
      </div>

      {/* Restaurant identity */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingBottom: 8 }}>
        <div style={{ width: 64, height: 24, borderRadius: 6, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.03)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 4 }}>
          <span style={{ fontSize: 7.5, fontWeight: 600, color: "rgba(255,255,255,0.45)", letterSpacing: "0.06em" }}>The Buff</span>
        </div>
        <div style={{ fontSize: 8, color: "rgba(255,255,255,0.5)" }}>3 parties ahead</div>
      </div>

      {/* Party size */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "4px 16px 6px" }}>
        <div style={{ fontSize: 6.5, letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(255,255,255,0.55)" }}>Party Size</div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 22, height: 22, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.22)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "rgba(255,255,255,0.5)" }}>−</div>
          <span style={{ fontSize: 30, fontWeight: 300, color: "#fff", minWidth: 24, textAlign: "center" }}>2</span>
          <div style={{ width: 22, height: 22, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.22)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#fff" }}>+</div>
        </div>
      </div>

      {/* Name + Phone — underline fields like real page */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 10, padding: "0 16px" }}>
        <div>
          <div style={{ fontSize: 6.5, letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(255,255,255,0.55)", marginBottom: 4 }}>Name</div>
          <div style={{ borderBottom: "1px solid rgba(255,255,255,0.22)", paddingBottom: 4, fontSize: 12, color: "#fff" }}>Sarah</div>
        </div>
        <div>
          <div style={{ fontSize: 6.5, letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(255,255,255,0.55)", marginBottom: 4 }}>
            Phone <span style={{ color: "rgba(255,255,255,0.3)", textTransform: "none", letterSpacing: 0 }}>— optional</span>
          </div>
          <div style={{ borderBottom: "1px solid rgba(255,255,255,0.22)", paddingBottom: 4, fontSize: 11, color: "rgba(255,255,255,0.7)" }}>(720) 555-0182</div>
        </div>
      </div>

      {/* CTA — white button, black text, matches real page */}
      <div style={{ padding: "6px 16px 10px" }}>
        <div style={{ background: "white", borderRadius: 12, height: 32, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#000", letterSpacing: "0.14em", textTransform: "uppercase" }}>
          Join the Waitlist
        </div>
        <div style={{ textAlign: "center", fontSize: 6.5, color: "rgba(255,255,255,0.2)", marginTop: 5, letterSpacing: "0.05em" }}>HOST · No app download needed</div>
      </div>
    </div>
  )
}

/* ─── Wait Screen (stages 1 & 2) ───────────────────────────── */
function WaitScreen({ position, wait, progress }: { position: number; wait: number; progress: number }) {
  const isClose = position === 1
  const partiesLabel = position === 0 ? "You're next up!" : `${position} ${position === 1 ? "party" : "parties"} ahead of you`
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#000", overflow: "hidden" }}>
      {/* HOST wordmark — top left, small, matches real wait page */}
      <div style={{ padding: "14px 16px 0", flexShrink: 0 }}>
        <span style={{ fontSize: 8, fontWeight: 900, letterSpacing: "0.35em", textTransform: "uppercase", color: "#fff" }}>HOST</span>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "0 16px", justifyContent: "center", gap: 8 }}>
        {/* Hi Sarah + parties ahead — plain text, no pill */}
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 3, letterSpacing: "-0.02em" }}>
            {isClose ? "You're next up!" : "Hi, Sarah!"}
          </div>
          {!isClose && <div style={{ fontSize: 9, color: "rgba(255,255,255,0.45)" }}>{partiesLabel}</div>}
        </div>

        {/* Green progress bar — always green, matches real page */}
        <div>
          <div style={{ width: "100%", height: 5, borderRadius: 99, background: "rgba(255,255,255,0.07)", overflow: "hidden", marginBottom: 4 }}>
            <div style={{ width: `${progress}%`, height: "100%", borderRadius: 99, background: "linear-gradient(90deg, #22c55e, #86efac)", transition: "width 1.2s ease" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 6.5, color: "rgba(255,255,255,0.25)" }}>
            <span>Arrived</span><span>Seated</span>
          </div>
        </div>

        {/* Stat cards — PARTY and EST. WAIT */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
          <div style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "7px 9px" }}>
            <div style={{ fontSize: 6.5, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 4 }}>Party</div>
            <div style={{ display: "flex", alignItems: "center", gap: 3, fontWeight: 700, fontSize: 13, color: "#fff" }}><Icon.Users /> 2</div>
          </div>
          <div style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "7px 9px" }}>
            <div style={{ fontSize: 6.5, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 4 }}>Est. Wait</div>
            <div style={{ display: "flex", alignItems: "center", gap: 3, fontWeight: 700, fontSize: 13, color: "#22c55e" }}><Icon.Clock /> ~{wait}m</div>
          </div>
        </div>

        {/* Message card — dark, like real page */}
        <div style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "7px 10px" }}>
          <div style={{ fontSize: 8, color: "rgba(255,255,255,0.5)", lineHeight: 1.55 }}>
            {isClose ? "Sit tight — we're moving fast!" : "Your spot is saved — feel free to step out."}
          </div>
        </div>
      </div>

      {/* Footer — menu button + leave link + footer text */}
      <div style={{ padding: "0 16px 10px", flexShrink: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ height: 26, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, fontSize: 7.5, fontWeight: 600, color: "rgba(255,255,255,0.65)" }}>
          🍴 Check Out the Menu
        </div>
        <div style={{ textAlign: "center", fontSize: 7, color: "rgba(255,255,255,0.22)", letterSpacing: "0.08em", textTransform: "uppercase", padding: "2px 0" }}>
          Leave &amp; Rejoin Later
        </div>
        <div style={{ textAlign: "center", fontSize: 6.5, color: "rgba(255,255,255,0.1)", letterSpacing: "0.16em", textTransform: "uppercase" }}>
          Updates automatically · HOST
        </div>
      </div>
    </div>
  )
}

/* ─── Ready Screen (stage 3) ───────────────────────────────── */
function ReadyScreen() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#000", overflow: "hidden" }}>
      {/* HOST wordmark — top left, matches real ready page */}
      <div style={{ padding: "14px 16px 0", flexShrink: 0 }}>
        <span style={{ fontSize: 8, fontWeight: 900, letterSpacing: "0.35em", textTransform: "uppercase", color: "#fff" }}>HOST</span>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "0 16px", justifyContent: "center", gap: 8 }}>
        {/* Green pulsing circle */}
        <div style={{ width: 60, height: 60, borderRadius: "50%", background: "rgba(34,197,94,0.12)", border: "2px solid rgba(34,197,94,0.45)", display: "flex", alignItems: "center", justifyContent: "center", color: "#22c55e" }}>
          <Icon.CheckCircle />
        </div>

        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 3 }}>Your table is ready!</div>
          <div style={{ fontSize: 10, color: "#22c55e", fontWeight: 600 }}>Head to the host stand</div>
        </div>

        {/* Full green progress bar */}
        <div style={{ width: "100%" }}>
          <div style={{ width: "100%", height: 5, borderRadius: 99, background: "rgba(255,255,255,0.07)", overflow: "hidden", marginBottom: 4 }}>
            <div style={{ width: "100%", height: "100%", borderRadius: 99, background: "linear-gradient(90deg, #22c55e, #86efac)" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 6.5, color: "rgba(255,255,255,0.25)" }}>
            <span>Arrived</span><span>Seated</span>
          </div>
        </div>

        {/* PARTY | Now stat cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, width: "100%" }}>
          <div style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "7px 9px" }}>
            <div style={{ fontSize: 6.5, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 4 }}>Party</div>
            <div style={{ display: "flex", alignItems: "center", gap: 3, fontWeight: 700, fontSize: 13, color: "#fff" }}><Icon.Users /> 2</div>
          </div>
          <div style={{ background: "#141414", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 8, padding: "7px 9px" }}>
            <div style={{ fontSize: 6.5, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 4 }}>Wait</div>
            <div style={{ display: "flex", alignItems: "center", gap: 3, fontWeight: 700, fontSize: 13, color: "#22c55e" }}><Icon.Clock /> Now</div>
          </div>
        </div>

        {/* Message — green tint, matches real page */}
        <div style={{ background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.18)", borderRadius: 8, padding: "7px 10px", width: "100%" }}>
          <div style={{ fontSize: 8, color: "rgba(255,255,255,0.65)", lineHeight: 1.55 }}>
            Please make your way to the front and let the host know you&apos;re here.
          </div>
        </div>
      </div>

      {/* Footer — menu button + footer text */}
      <div style={{ padding: "0 16px 10px", flexShrink: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ height: 26, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, fontSize: 7.5, fontWeight: 600, color: "rgba(255,255,255,0.65)" }}>
          🍴 Check Out the Menu
        </div>
        <div style={{ textAlign: "center", fontSize: 6.5, color: "rgba(255,255,255,0.1)", letterSpacing: "0.16em", textTransform: "uppercase" }}>
          Updates automatically · HOST
        </div>
      </div>
    </div>
  )
}

/* ─── Seated Screen (stage 4) ──────────────────────────────── */
function SeatedScreen() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 0, padding: "24px 20px", height: "100%", background: "#000" }}>
      {/* Matches real seated page: "Enjoy your meal." / circle logo / "Enjoy your time." */}
      <div style={{ fontSize: 16, fontWeight: 300, color: "rgba(255,255,255,0.88)", marginBottom: 28, letterSpacing: "0.01em" }}>
        Enjoy your meal.
      </div>
      <div style={{ marginBottom: 28 }}>
        <div style={{ width: 50, height: 50, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px" }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: "rgba(255,255,255,0.5)" }}>B</span>
        </div>
        <div style={{ fontSize: 8, fontWeight: 500, color: "rgba(255,255,255,0.28)", letterSpacing: "0.12em", textTransform: "uppercase" }}>The Buff · Boulder</div>
      </div>
      <div style={{ fontSize: 16, fontWeight: 300, color: "rgba(255,255,255,0.88)", letterSpacing: "0.01em" }}>
        Enjoy your time.
      </div>
    </div>
  )
}

/* ─── FAQ Section ──────────────────────────────────────────── */
const FAQ_ITEMS = [
  {
    q: "Does the guest need to download an app?",
    a: "No — and never will. The guest taps the HOST puck or scans the QR code and their phone opens a web page. No app store, no login, no account. It works on every iPhone and Android made in the last five years.",
  },
  {
    q: "How exactly does a guest join the waitlist?",
    a: "They scan the large QR code on the sign out front — or tap the HOST puck near the entrance with their phone for NFC. Either way, a form opens instantly: name, party size, phone number. Two taps and they're on the list before they've even walked through the door. Total time: under 10 seconds.",
  },
  {
    q: "What does the guest see on their phone?",
    a: "A live wait page that shows their name, party size, position in the queue, and an estimated wait time. It updates in real time as other parties are seated — no refreshing needed. When their table is ready, the page flips to 'Head to the host stand' and they get a text at the same moment.",
  },
  {
    q: "How do I notify a guest their table is ready?",
    a: "One tap in the HOST dashboard. The moment you press the notify button next to their party, HOST fires an SMS to their phone and their live page updates automatically. No buzzers. No calling out names. No manual texting.",
  },
  {
    q: "Can the puck go outside — like on a sign by the door?",
    a: "Yes, and that's exactly how we recommend using it. Mount the HOST puck on a sign at your entrance so guests can join the waitlist before they even walk in. The puck is weatherproof and works through most sign materials. A QR code is always printed on the puck as a backup.",
  },
  {
    q: "What if a guest doesn't have a smartphone?",
    a: "Your host can add any guest manually in seconds — just tap 'Add Guest' in the dashboard and enter their name and party size. They won't get the SMS, but they'll be in the queue and you can call their name when ready. The system handles both.",
  },
  {
    q: "Does HOST replace our POS or reservation system?",
    a: "No. HOST sits alongside your existing setup and handles walk-in waitlist management. You keep your POS, your payment flow, and any reservation system you already use. HOST is specifically for the host stand and the wait — it doesn't touch anything else.",
  },
  {
    q: "How long does setup take?",
    a: "Under an hour for most restaurants. We walk you through the dashboard, set up your floor plan, connect your phone number for SMS, and get the puck configured. By the time we're done, your staff is running it and you're live.",
  },
  {
    q: "What happens if a guest leaves before their table is ready?",
    a: "They can leave the queue themselves from their wait page if they need to. You can also remove any party from the dashboard instantly. The queue reorders automatically — no gaps, no confusion.",
  },
  {
    q: "How much does HOST cost?",
    a: "Pricing depends on your restaurant's size and volume. We're currently onboarding founding restaurants in Denver and Boulder — schedule a free demo and we'll talk through what makes sense for you.",
  },
]

function FaqSection() {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {FAQ_ITEMS.map((item, i) => (
        <div
          key={i}
          style={{
            background: open === i ? "rgba(34,197,94,0.03)" : "#080A0C",
            border: "1px solid",
            borderColor: open === i ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.07)",
            borderRadius: i === 0 ? "16px 16px 0 0" : i === FAQ_ITEMS.length - 1 ? "0 0 16px 16px" : 0,
            overflow: "hidden",
            transition: "background 0.2s, border-color 0.2s",
          }}
        >
          <button
            onClick={() => setOpen(open === i ? null : i)}
            style={{
              width: "100%", background: "none", border: "none", cursor: "pointer",
              padding: "22px 28px", display: "flex", alignItems: "center", justifyContent: "space-between",
              gap: 16, textAlign: "left",
            }}
          >
            <span style={{ fontSize: ".95rem", fontWeight: 700, color: open === i ? "#fff" : "rgba(255,255,255,0.75)", letterSpacing: "-0.01em", lineHeight: 1.4 }}>
              {item.q}
            </span>
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke={open === i ? "#22c55e" : "rgba(255,255,255,0.3)"}
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ flexShrink: 0, transform: open === i ? "rotate(180deg)" : "none", transition: "transform 0.25s ease, stroke 0.2s" }}
            >
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>
          {open === i && (
            <div style={{ padding: "0 28px 24px", animation: "badgein 0.22s ease both" }}>
              <p style={{ fontSize: ".9rem", color: "rgba(255,255,255,0.45)", lineHeight: 1.75, margin: 0 }}>
                {item.a}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

/* ─── Demo Modal ───────────────────────────────────────────── */
function DemoModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ name: "", restaurant: "", email: "", phone: "", city: "", type: "" })
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState("")

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.restaurant || !form.email) { setError("Please fill in all required fields."); return }
    setLoading(true); setError("")
    try {
      const res = await fetch("/api/demo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, submittedAt: new Date().toISOString() }) })
      if (res.ok) setDone(true)
      else setError("Something went wrong. Email us at demo@hostplatform.net")
    } catch { setError("Something went wrong. Email us at demo@hostplatform.net") }
    setLoading(false)
  }

  const inputStyle = {
    width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10, padding: "12px 14px", color: "#fff", fontSize: ".9rem", outline: "none",
    transition: "border-color 0.15s",
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }} onClick={onClose} />
      <div className="demo-card" style={{ position: "relative", width: "100%", maxWidth: 480, background: "#0e1012", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 24, padding: "40px 36px", boxShadow: "0 40px 80px rgba(0,0,0,0.6)" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 18, right: 18, background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.35)", padding: 4, display: "flex" }}>
          <Icon.X />
        </button>
        {done ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", color: "#22c55e" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h3 style={{ fontSize: "1.4rem", fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 10 }}>You&apos;re on the list.</h3>
            <p style={{ fontSize: ".9rem", color: "rgba(255,255,255,0.45)", lineHeight: 1.65 }}>We&apos;ll reach out within 24 hours to walk you through everything.</p>
            <button onClick={onClose} style={{ marginTop: 32, background: "#22c55e", color: "#000", fontWeight: 700, fontSize: ".9rem", padding: "12px 28px", borderRadius: 10, border: "none", cursor: "pointer" }}>Done</button>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e" }} />
                <span style={{ fontSize: ".7rem", fontWeight: 800, letterSpacing: ".18em", textTransform: "uppercase", color: "#22c55e" }}>Schedule a Demo</span>
              </div>
              <h3 style={{ fontSize: "1.5rem", fontWeight: 900, letterSpacing: "-0.03em", marginBottom: 6 }}>Let&apos;s talk about your restaurant.</h3>
              <p style={{ fontSize: ".85rem", color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>We&apos;ll reach out within 24 hours to set up a free walkthrough.</p>
            </div>
            <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="demo-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: ".76rem", color: "rgba(255,255,255,0.4)", marginBottom: 6, fontWeight: 600 }}>Your name <span style={{ color: "#ef4444" }}>*</span></label>
                  <input style={inputStyle} placeholder="Alex Rivera" value={form.name} onChange={set("name")}
                    onFocus={e=>(e.currentTarget.style.borderColor="rgba(34,197,94,0.4)")}
                    onBlur={e=>(e.currentTarget.style.borderColor="rgba(255,255,255,0.1)")} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: ".76rem", color: "rgba(255,255,255,0.4)", marginBottom: 6, fontWeight: 600 }}>Restaurant name <span style={{ color: "#ef4444" }}>*</span></label>
                  <input style={inputStyle} placeholder="Trattoria Napoli" value={form.restaurant} onChange={set("restaurant")}
                    onFocus={e=>(e.currentTarget.style.borderColor="rgba(34,197,94,0.4)")}
                    onBlur={e=>(e.currentTarget.style.borderColor="rgba(255,255,255,0.1)")} />
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: ".76rem", color: "rgba(255,255,255,0.4)", marginBottom: 6, fontWeight: 600 }}>Email <span style={{ color: "#ef4444" }}>*</span></label>
                <input type="email" style={inputStyle} placeholder="alex@trattorianapoli.com" value={form.email} onChange={set("email")}
                  onFocus={e=>(e.currentTarget.style.borderColor="rgba(34,197,94,0.4)")}
                  onBlur={e=>(e.currentTarget.style.borderColor="rgba(255,255,255,0.1)")} />
              </div>
              <div className="demo-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: ".76rem", color: "rgba(255,255,255,0.4)", marginBottom: 6, fontWeight: 600 }}>Phone</label>
                  <input type="tel" style={inputStyle} placeholder="(720) 555-0100" value={form.phone} onChange={set("phone")}
                    onFocus={e=>(e.currentTarget.style.borderColor="rgba(34,197,94,0.4)")}
                    onBlur={e=>(e.currentTarget.style.borderColor="rgba(255,255,255,0.1)")} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: ".76rem", color: "rgba(255,255,255,0.4)", marginBottom: 6, fontWeight: 600 }}>City</label>
                  <input style={inputStyle} placeholder="Denver" value={form.city} onChange={set("city")}
                    onFocus={e=>(e.currentTarget.style.borderColor="rgba(34,197,94,0.4)")}
                    onBlur={e=>(e.currentTarget.style.borderColor="rgba(255,255,255,0.1)")} />
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: ".76rem", color: "rgba(255,255,255,0.4)", marginBottom: 6, fontWeight: 600 }}>Restaurant type</label>
                <select style={{ ...inputStyle, cursor: "pointer" }} value={form.type} onChange={set("type")}
                  onFocus={e=>(e.currentTarget.style.borderColor="rgba(34,197,94,0.4)")}
                  onBlur={e=>(e.currentTarget.style.borderColor="rgba(255,255,255,0.1)")}>
                  <option value="" style={{ background: "#0e1012" }}>Select type...</option>
                  {["Full service","Fast casual","Bar / Nightlife","Cafe","Food hall","Other"].map(t=><option key={t} value={t} style={{ background: "#0e1012" }}>{t}</option>)}
                </select>
              </div>
              {error && <p style={{ fontSize: ".82rem", color: "#ef4444", marginTop: -4 }}>{error}</p>}
              <button type="submit" disabled={loading} style={{ marginTop: 6, background: loading ? "rgba(34,197,94,0.5)" : "#22c55e", color: "#000", fontWeight: 800, fontSize: ".95rem", padding: "14px", borderRadius: 11, border: "none", cursor: loading ? "not-allowed" : "pointer" }}>
                {loading ? "Sending..." : "Request Demo"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

/* ─── Page ─────────────────────────────────────────────────── */
export default function MarketingPage() {
  const [showDemo, setShowDemo] = useState(false)
  const [activeFeature, setActiveFeature] = useState<number | null>(null)
  const deviceRef    = useFade(100)
  const howWorksRef  = useFade(0)
  const statsRef     = useFade(0)
  const featRef   = useFade(0)
  const howRef    = useFade(0)
  const journeyRef = useFade(0)
  const nfcRef    = useFade(0)
  const ctaRef    = useFade(0)

  const openDemo = (e: React.MouseEvent) => { e.preventDefault(); setShowDemo(true) }

  return (
    <div style={{ background: "#060606", color: "#fff", minHeight: "100vh", overflowX: "clip" }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@1,600;1,700&display=swap');
        .serif-italic { font-family: 'Cormorant Garamond', Georgia, serif; font-style: italic; font-weight: 600; }
        @keyframes glow    { 0%,100%{opacity:.5} 50%{opacity:1} }
        @keyframes fadein  { from{opacity:0;transform:translateX(16px)} to{opacity:1;transform:translateX(0)} }
        @keyframes scanline {
          0%   { top: 12px; opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { top: calc(100% - 12px); opacity: 0; }
        }
        @keyframes standpulse {
          0%,100% { box-shadow: 0 32px 80px rgba(0,0,0,.8), 0 0 0 1px rgba(34,197,94,.06); }
          50%     { box-shadow: 0 32px 80px rgba(0,0,0,.8), 0 0 0 1px rgba(34,197,94,.14), 0 0 80px rgba(34,197,94,.09); }
        }
        @keyframes badgein {
          from { opacity:0; transform:scale(0.85) translateY(6px); }
          to   { opacity:1; transform:scale(1) translateY(0); }
        }
        @keyframes smsin {
          from { opacity:0; transform:scale(0.9) translateX(-8px); }
          to   { opacity:1; transform:scale(1) translateX(0); }
        }
        @keyframes herofade {
          from { opacity:0; transform:translateY(20px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes puckring {
          0%   { opacity:1; transform:translate(-50%,-50%) scale(1); }
          100% { opacity:0; transform:translate(-50%,-50%) scale(1.85); }
        }
        .cta-btn {
          background:#22c55e; color:#000; font-weight:700;
          transition:transform .15s ease,box-shadow .15s ease,background .15s ease;
        }
        .cta-btn:hover { transform:translateY(-2px) scale(1.015); box-shadow:0 14px 40px rgba(34,197,94,.35); background:#16a34a; }
        .ghost-btn { transition:background .15s,color .15s,transform .15s; }
        .ghost-btn:hover { background:rgba(255,255,255,.06)!important; color:#fff!important; transform:translateY(-1px); }
        .feat-card { transition:background .2s,transform .2s,box-shadow .2s; }
        .feat-card:hover { background:rgba(255,255,255,.03)!important; transform:translateY(-3px); box-shadow:0 16px 50px rgba(0,0,0,.5); }
        html { scroll-behavior:smooth; }
        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-track { background:#060606; }
        ::-webkit-scrollbar-thumb { background:rgba(255,255,255,.08); border-radius:99px; }
        input::placeholder,select::placeholder { color:rgba(255,255,255,.2); }

        /* ─── Mobile Responsive ──────────────────────────────────── */
        @media (max-width: 760px) {
          nav.host-nav { padding-left: 20px !important; padding-right: 20px !important; }
          .mob-px { padding-left: 20px !important; padding-right: 20px !important; }
          .how-flow { grid-template-columns: 1fr !important; }
          .how-arrow { display: none !important; }
          .device-row { padding: 28px 20px 28px !important; gap: 16px !important; }
          .ipad-hide { display: none !important; }
          .stats-wrap { padding-left: 20px !important; padding-right: 20px !important; }
          .stats-grid { grid-template-columns: repeat(2,1fr) !important; gap: 1px !important; }
          .feat-grid { grid-template-columns: 1fr !important; }
          .feat-detail { padding: 28px 20px 32px !important; }
          .feat-detail-inner { flex-direction: column !important; gap: 24px !important; }
          .steps-grid { grid-template-columns: 1fr !important; gap: 32px !important; }
          .steps-line { display: none !important; }
          .nfc-sec { grid-template-columns: 1fr !important; gap: 0 !important; padding-top: 60px !important; padding-bottom: 60px !important; }
          .demo-card { padding: 28px 22px 32px !important; }
          .demo-2col { grid-template-columns: 1fr !important; gap: 12px !important; }
          .nav-demo-full { display: none !important; }
          .nav-demo-short::after { content: "Demo"; }
        }
        @media (max-width: 480px) {
          nav.host-nav .nav-login { display: none !important; }
        }
      `}</style>

      {/* Fixed header wrapper — announcement + nav always on screen */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 200 }}>

      {/* Announcement */}
      <div style={{ background: "#22c55e", color: "#000", textAlign: "center", padding: "10px 20px", fontSize: ".78rem", fontWeight: 700, letterSpacing: ".04em" }}>
        Now accepting restaurants in Denver &amp; Boulder —{" "}
        <a href="#" onClick={openDemo} style={{ color: "#000", textDecoration: "underline", fontWeight: 800 }}>schedule your free demo →</a>
      </div>

      {/* Nav */}
      <nav className="host-nav" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 56px", height: 64, background: "rgba(6,6,6,0.92)", backdropFilter: "blur(24px) saturate(160%)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <Link href="/" style={{ textDecoration: "none" }}>
          <span style={{ fontWeight: 900, letterSpacing: ".22em", fontSize: ".88rem", color: "#fff" }}>HOST</span>
        </Link>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link href="/login" className="ghost-btn nav-login" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none", fontSize: ".85rem", padding: "8px 16px", borderRadius: 8 }}>Log In</Link>
          <a href="#" onClick={openDemo} className="cta-btn" style={{ fontSize: ".85rem", padding: "9px 22px", borderRadius: 9, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 7, whiteSpace: "nowrap" }}>
            <span className="nav-demo-full">Schedule Free Demo</span><span className="nav-demo-short" style={{ display: "none" }} /><Icon.Arrow />
          </a>
        </div>
      </nav>
      </div>{/* end fixed header */}

      {/* ── HERO with video background ─────────────────────────── */}
      {/* paddingTop offsets the fixed header (announcement ~38px + nav 64px) */}
      <section style={{ position: "relative", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", paddingTop: 102 }}>

        {/* Rotating photo background — drop images into /public/hero/1.jpg … 4.jpg */}
        <HeroSlideshow />

        {/* Gradient overlay */}
        <div style={{
          position: "absolute", inset: 0, zIndex: 1,
          background: "linear-gradient(180deg, rgba(5,5,5,0.62) 0%, rgba(5,5,5,0.22) 35%, rgba(5,5,5,0.42) 60%, rgba(5,5,5,0.97) 100%)",
        }} />

        {/* Subtle vignette */}
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 60%, transparent 40%, rgba(0,0,0,0.55) 100%)", zIndex: 1, pointerEvents: "none" }} />

        {/* Hero content */}
        <div className="mob-px" style={{ position: "relative", zIndex: 2, textAlign: "center", padding: "0 56px", maxWidth: 900, margin: "0 auto" }}>

          {/* Big HOST wordmark */}
          <div style={{ animation: "herofade 0.8s ease 0.1s both" }}>
            <h1 style={{
              fontSize: "clamp(5rem, 15vw, 11rem)", fontWeight: 900,
              letterSpacing: "-0.055em", lineHeight: 0.88, color: "#fff",
              textShadow: "0 2px 40px rgba(0,0,0,0.5)",
              marginBottom: 0,
            }}>
              HOST
            </h1>
          </div>

          {/* Subtitle */}
          <div style={{ animation: "herofade 0.8s ease 0.3s both" }}>
            <p style={{
              fontSize: "clamp(1.1rem, 2.8vw, 1.7rem)", fontWeight: 300,
              color: "rgba(255,255,255,0.7)", letterSpacing: "0.01em",
              marginTop: 20, marginBottom: 0, lineHeight: 1.2,
            }}>
              The smarter{" "}
              <em className="serif-italic" style={{ fontSize: "1.3em", color: "#fff", letterSpacing: "-0.01em" }}>waitlist.</em>
            </p>
          </div>

          {/* Tagline */}
          <div style={{ animation: "herofade 0.8s ease 0.55s both" }}>
            <p style={{
              fontSize: "clamp(.9rem, 1.5vw, 1.05rem)",
              color: "rgba(255,255,255,0.36)",
              lineHeight: 1.7,
              maxWidth: 520, margin: "28px auto 0",
            }}>
              Tap or scan to join. Real-time updates. One dashboard.<br />
              No buzzers. No clipboards. No chaos.
            </p>
          </div>

          {/* CTAs */}
          <div style={{ animation: "herofade 0.8s ease 0.75s both", display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 44 }}>
            <a href="#" onClick={openDemo} className="cta-btn" style={{ fontSize: "1rem", padding: "15px 34px", borderRadius: 12, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 9 }}>
              Schedule Free Demo <Icon.Arrow />
            </a>
            <a href="#devices" className="ghost-btn" style={{ color: "rgba(255,255,255,0.5)", fontWeight: 500, fontSize: "1rem", padding: "15px 26px", borderRadius: 12, textDecoration: "none", border: "1px solid rgba(255,255,255,0.12)" }}>
              See how it works
            </a>
          </div>
        </div>

        {/* Scroll cue */}
        <div style={{ position: "absolute", bottom: 32, left: "50%", transform: "translateX(-50%)", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, opacity: 0.35 }}>
          <div style={{ fontSize: ".65rem", letterSpacing: ".14em", textTransform: "uppercase", color: "#fff" }}>Scroll</div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>
        </div>
      </section>

      {/* ── How HOST Works ──────────────────────────────────────── */}
      <section id="how-it-works" className="mob-px" style={{ padding: "100px 56px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div ref={howWorksRef} style={{ maxWidth: 1100, margin: "0 auto" }}>
          {/* Label + heading */}
          <div style={{ marginBottom: 80, textAlign: "center" }}>
            <div style={{ fontSize: ".72rem", fontWeight: 800, letterSpacing: ".18em", textTransform: "uppercase", color: "#22c55e", marginBottom: 16 }}>
              how HOST works
            </div>
            <h2 style={{ fontSize: "clamp(2rem,4vw,3rem)", fontWeight: 900, letterSpacing: "-0.035em", lineHeight: 1.08, margin: 0 }}>
              Simple by design.{" "}
              <em className="serif-italic" style={{ fontWeight: 700, fontSize: "1.06em", color: "#fff" }}>Fast by default.</em>
            </h2>
          </div>

          {/* 3-step flow */}
          <div className="how-flow" style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr auto 1fr", gap: 0, alignItems: "start" }}>

            {/* Step 1 */}
            <div style={{ textAlign: "center", padding: "0 24px" }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.22)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", position: "relative" }}>
                <div style={{ position: "absolute", inset: -7, borderRadius: "50%", border: "1px solid rgba(34,197,94,0.07)" }} />
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 6a6 6 0 0 1 6 6"/><path d="M12 10a2 2 0 0 1 2 2"/>
                </svg>
              </div>
              <div style={{ fontSize: ".68rem", fontWeight: 800, letterSpacing: ".16em", textTransform: "uppercase", color: "#22c55e", marginBottom: 10 }}>Step 1</div>
              <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#fff", letterSpacing: "-0.02em", marginBottom: 10 }}>Guest taps or scans</div>
              <div style={{ fontSize: ".88rem", color: "rgba(255,255,255,0.38)", lineHeight: 1.65, maxWidth: 240, margin: "0 auto" }}>
                They hold their phone over the HOST puck or scan the QR code at the stand. On the list in two seconds. No app, no typing.
              </div>
            </div>

            {/* Arrow 1 */}
            <div className="how-arrow" style={{ paddingTop: 32, color: "rgba(34,197,94,0.3)", display: "flex", alignItems: "flex-start", justifyContent: "center" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
              </svg>
            </div>

            {/* Step 2 */}
            <div style={{ textAlign: "center", padding: "0 24px" }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.22)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", position: "relative" }}>
                <div style={{ position: "absolute", inset: -7, borderRadius: "50%", border: "1px solid rgba(34,197,94,0.07)" }} />
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
                </svg>
              </div>
              <div style={{ fontSize: ".68rem", fontWeight: 800, letterSpacing: ".16em", textTransform: "uppercase", color: "#22c55e", marginBottom: 10 }}>Step 2</div>
              <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#fff", letterSpacing: "-0.02em", marginBottom: 10 }}>HOST runs the queue</div>
              <div style={{ fontSize: ".88rem", color: "rgba(255,255,255,0.38)", lineHeight: 1.65, maxWidth: 240, margin: "0 auto" }}>
                Your iPad shows every party in order — wait times, table availability, and one-tap controls. The queue manages itself.
              </div>
            </div>

            {/* Arrow 2 */}
            <div className="how-arrow" style={{ paddingTop: 32, color: "rgba(34,197,94,0.3)", display: "flex", alignItems: "flex-start", justifyContent: "center" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
              </svg>
            </div>

            {/* Step 3 */}
            <div style={{ textAlign: "center", padding: "0 24px" }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.22)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", position: "relative" }}>
                <div style={{ position: "absolute", inset: -7, borderRadius: "50%", border: "1px solid rgba(34,197,94,0.07)" }} />
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <div style={{ fontSize: ".68rem", fontWeight: 800, letterSpacing: ".16em", textTransform: "uppercase", color: "#22c55e", marginBottom: 10 }}>Step 3</div>
              <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#fff", letterSpacing: "-0.02em", marginBottom: 10 }}>Table&apos;s ready — guest is notified</div>
              <div style={{ fontSize: ".88rem", color: "rgba(255,255,255,0.38)", lineHeight: 1.65, maxWidth: 240, margin: "0 auto" }}>
                When you call their party, HOST fires an SMS and their live page flips to "head to the host stand." You seat them. Done.
              </div>
            </div>
          </div>

          {/* Bottom tagline */}
          <div style={{ marginTop: 80, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 28, flexWrap: "wrap" }}>
            {["Zero app downloads", "Works on any phone", "Live in under an hour"].map((t, i) => (
              <div key={t} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: ".84rem", color: "rgba(255,255,255,0.35)" }}>
                <span style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", display: "flex", alignItems: "center", justifyContent: "center", color: "#22c55e", flexShrink: 0 }}><Icon.Check /></span>
                {t}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Device Showcase ─────────────────────────────────────── */}
      <section id="devices" style={{ padding: "60px 40px 100px", position: "relative", overflow: "hidden" }}>
        {/* Deep ambient glow behind devices */}
        <div style={{ position: "absolute", top: "30%", left: "50%", transform: "translate(-50%,-50%)", width: 700, height: 500, background: "radial-gradient(ellipse, rgba(34,197,94,0.07) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: "30%", left: "35%", transform: "translate(-50%,-50%)", width: 400, height: 300, background: "radial-gradient(ellipse, rgba(34,197,94,0.04) 0%, transparent 70%)", pointerEvents: "none" }} />

        <div ref={deviceRef} className="device-row" style={{ maxWidth: 1160, margin: "0 auto", position: "relative", display: "flex", justifyContent: "center", alignItems: "center", gap: 0, flexWrap: "wrap" }}>

          {/* Floating notification — top left */}
          <div style={{ position: "absolute", top: 10, left: 20, background: "rgba(8,10,12,0.97)", border: "1px solid rgba(34,197,94,0.28)", borderRadius: 14, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, boxShadow: "0 16px 48px rgba(0,0,0,.7)", animation: "fadein 0.5s ease 0.8s both", zIndex: 20 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg,#22c55e,#16a34a)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div>
              <div style={{ fontSize: ".72rem", fontWeight: 700, color: "#fff", marginBottom: 2 }}>Table ready for Martinez</div>
              <div style={{ fontSize: ".62rem", color: "rgba(255,255,255,0.38)" }}>SMS sent · just now</div>
            </div>
          </div>

          {/* Floating queue badge — bottom right */}
          <div style={{ position: "absolute", bottom: 24, right: 16, background: "rgba(8,10,12,0.97)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, boxShadow: "0 16px 48px rgba(0,0,0,.7)", animation: "fadein 0.5s ease 1.2s both", zIndex: 20 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
              <div style={{ fontSize: "1.1rem", fontWeight: 900, color: "#f97316", lineHeight: 1 }}>4</div>
              <div style={{ fontSize: ".55rem", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: ".08em" }}>waiting</div>
            </div>
            <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.08)" }} />
            <div>
              <div style={{ fontSize: ".72rem", fontWeight: 700, color: "#fff", marginBottom: 2 }}>All tables occupied</div>
              <div style={{ fontSize: ".62rem", color: "rgba(255,255,255,0.38)" }}>Avg wait · ~22 min</div>
            </div>
          </div>

          {/* iPad — 3D perspective tilt left */}
          <div className="ipad-hide" style={{
            transform: "perspective(1400px) rotateY(8deg) rotateX(2deg) scale(0.97)",
            transformOrigin: "right center",
            filter: "drop-shadow(0 40px 80px rgba(0,0,0,0.9)) drop-shadow(0 0 1px rgba(255,255,255,0.05))",
            transition: "transform 0.4s ease",
            marginRight: -24,
            zIndex: 1,
          }}>
            <IPadMockup />
          </div>

          {/* iPhone — 3D perspective, slightly forward */}
          <div style={{
            transform: "perspective(900px) rotateY(-4deg) rotateX(1.5deg) scale(1.03)",
            transformOrigin: "left center",
            filter: "drop-shadow(0 60px 100px rgba(0,0,0,0.95)) drop-shadow(0 0 1px rgba(255,255,255,0.06))",
            transition: "transform 0.4s ease",
            zIndex: 2,
            marginTop: 0,
          }}>
            <IPhoneMockup />
          </div>
        </div>
      </section>

      {/* ── The Cost of Walking Away ────────────────────────────── */}
      <section className="mob-px" style={{ padding: "100px 56px", borderTop: "1px solid rgba(255,255,255,0.06)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 100%, rgba(217,50,28,0.05) 0%, transparent 60%)", pointerEvents: "none" }} />
        <div ref={statsRef} style={{ maxWidth: 1060, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <div style={{ fontSize: ".72rem", fontWeight: 800, letterSpacing: ".18em", textTransform: "uppercase", color: "rgba(217,50,28,0.75)", marginBottom: 16 }}>
              The problem
            </div>
            <h2 style={{ fontSize: "clamp(2rem,4vw,3rem)", fontWeight: 900, letterSpacing: "-0.035em", lineHeight: 1.08, margin: 0 }}>
              The wait is costing you{" "}
              <em className="serif-italic" style={{ color: "#fff", fontSize: "1.06em" }}>real revenue.</em>
            </h2>
          </div>

          {/* 4 pain stats — 2×2 grid */}
          <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 1, background: "rgba(255,255,255,0.05)", borderRadius: 24, overflow: "hidden", marginBottom: 1 }}>
            {[
              { stat: "1 in 3", label: "guests have walked away from a restaurant because the wait felt uncertain or disorganized", source: "National Restaurant Association" },
              { stat: "$150+", label: "in revenue lost every time a party of four walks out before they're seated", source: "avg. check × party size" },
              { stat: "45 min", label: "per shift your host spends managing a clipboard or shouting names across the room", source: "industry average" },
              { stat: "60%", label: "of guests who walk out say they're unlikely to return to that restaurant again", source: "customer experience research" },
            ].map(s => (
              <div key={s.stat} style={{ background: "#08090B", padding: "44px 40px", textAlign: "center" }}>
                <div style={{ fontSize: "clamp(2.8rem,5vw,4.2rem)", fontWeight: 900, letterSpacing: "-0.05em", color: "rgba(217,50,28,0.85)", lineHeight: 1, marginBottom: 18 }}>{s.stat}</div>
                <div style={{ fontSize: ".9rem", color: "rgba(255,255,255,0.42)", lineHeight: 1.65, marginBottom: 10 }}>{s.label}</div>
                <div style={{ fontSize: ".68rem", color: "rgba(255,255,255,0.15)", letterSpacing: ".08em", textTransform: "uppercase" }}>{s.source}</div>
              </div>
            ))}
          </div>

          {/* HOST solution strip */}
          <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1, background: "rgba(255,255,255,0.05)", borderRadius: "0 0 24px 24px", overflow: "hidden" }}>
            {[
              { n: 2, s: " sec", l: "to join with a tap or scan" },
              { n: 55, s: "%", l: "fewer no-shows with SMS" },
              { n: 0, s: "", l: "app downloads required" },
              { n: 15, s: " min", l: "average setup time" },
            ].map(s => (
              <div key={s.l} style={{ background: "rgba(34,197,94,0.03)", padding: "28px 20px", textAlign: "center", borderTop: "1px solid rgba(34,197,94,0.1)" }}>
                <div style={{ fontSize: "2.2rem", fontWeight: 900, color: "#22c55e", letterSpacing: "-0.045em", lineHeight: 1, marginBottom: 7 }}><Counter to={s.n} suffix={s.s} /></div>
                <div style={{ fontSize: ".78rem", color: "rgba(255,255,255,0.32)" }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Statement */}
      <div className="mob-px" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "80px 56px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 50%, rgba(34,197,94,0.04) 0%, transparent 65%)", pointerEvents: "none" }} />
        <p style={{
          fontSize: "clamp(2.2rem, 5.5vw, 4.2rem)",
          fontWeight: 900,
          letterSpacing: "-0.04em",
          lineHeight: 1.08,
          color: "#fff",
          margin: 0,
          position: "relative",
        }}>
          No more{" "}
          <em className="serif-italic" style={{ color: "#22c55e", fontSize: "1.12em", letterSpacing: "-0.02em" }}>waiting</em>
          {" "}to wait.
        </p>
      </div>

      {/* Features */}
      <section id="features" className="mob-px" style={{ padding: "110px 56px", maxWidth: 1100, margin: "0 auto" }}>
        <div ref={featRef}>
          <div style={{ marginBottom: 64 }}>
            <h2 style={{ fontSize: "clamp(2rem,4vw,3rem)", fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1.1, maxWidth: 520 }}>
              Designed for<br />
              <em className="serif-italic" style={{ fontWeight: 700, fontSize: "1.08em", letterSpacing: "-0.02em", color: "#fff" }}>the rush.</em>
            </h2>
          </div>
          {(() => {
            const features = [
              {
                Icon: Icon.Nfc, title: "NFC Tap & QR Join",
                sub: "Guests tap the NFC puck or scan a QR code. On the list in two seconds. No app, no URL.",
                detail: "The HOST puck lives at your host stand. Guests hold their phone over it — no app, no URL, no typing. The moment they tap, they're in your queue and receive a link to their live wait page. A QR code is printed on the puck as a backup. Every join is timestamped and logged to your dashboard in real time.",
                bullets: ["Works on every modern iPhone and Android", "No app install required — ever", "QR backup always available at the stand", "Every join is timestamped and logged"],
              },
              {
                Icon: Icon.Message, title: "SMS Notifications",
                sub: "A text fires the moment their table is called, plus their live page tells them to head to the host stand.",
                detail: "When you call a party, HOST fires an SMS to the guest instantly. The message includes a link to their live wait page which flips to 'head to the host stand.' No buzzers, no shouting names, no manual texting. Guests can step out, grab a drink, and come back right when you're ready for them.",
                bullets: ["Instant text the moment you call their table", "Live status page updates in real time", "No buzzer hardware to manage or replace", "Guests stay close — they know exactly when to return"],
              },
              {
                Icon: Icon.Monitor, title: "Host Dashboard",
                sub: "iPad-first. The whole queue, table map, and controls in one view.",
                detail: "Built for the iPad at your host stand. The live queue shows every party in order — wait time, party size, and how they joined. The floor plan shows real-time table availability. One tap to notify, one tap to seat, one tap to remove. No training required — your staff is running it within minutes.",
                bullets: ["iPad-first, designed for the host stand", "Live queue + table map in one view", "One-tap notify, seat, or remove", "Full shift history after every service"],
              },
              {
                Icon: Icon.BarChart, title: "Shift Insights",
                sub: "See your peak times, average turns, and party flow after every service.",
                detail: "After each service, HOST compiles your shift data automatically. See your busiest hour, average wait time by party size, turn time per table, and how many guests joined via NFC vs QR. No setup needed — the data is captured the moment HOST goes live at your restaurant.",
                bullets: ["Busiest periods by day and time", "Average wait and turn time tracking", "Party size and entry source breakdown", "No manual data entry — ever"],
              },
            ]
            return (
              <div className="feat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 24, overflow: "hidden" }}>
                {features.map((f, i) => {
                  const active = activeFeature === i
                  return (
                    <div
                      key={f.title}
                      className="feat-card"
                      onClick={() => setActiveFeature(active ? null : i)}
                      style={{
                        background: active ? "rgba(34,197,94,0.05)" : "#080A0C",
                        padding: "38px 30px",
                        cursor: "pointer",
                        borderBottom: active ? "2px solid rgba(34,197,94,0.25)" : "2px solid transparent",
                        transition: "background 0.2s, border-color 0.2s",
                      }}
                    >
                      {/* Summary — always visible */}
                      <div style={{ color: active ? "#22c55e" : "rgba(255,255,255,0.5)", marginBottom: 18, transition: "color 0.2s" }}><f.Icon /></div>
                      <div style={{ fontWeight: 800, fontSize: ".95rem", color: "#fff", marginBottom: 8, letterSpacing: "-0.01em" }}>{f.title}</div>
                      <div style={{ fontSize: ".84rem", color: "rgba(255,255,255,0.36)", lineHeight: 1.6, marginBottom: 16 }}>{f.sub}</div>
                      <div style={{ fontSize: ".78rem", fontWeight: 700, color: active ? "rgba(34,197,94,0.6)" : "rgba(255,255,255,0.22)", display: "flex", alignItems: "center", gap: 5, transition: "color 0.2s" }}>
                        {active ? "Close" : "Learn more"}
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: active ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>
                          <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
                        </svg>
                      </div>

                      {/* Detail — expands inline inside this card, no below-fold scroll */}
                      {active && (
                        <div style={{ marginTop: 28, paddingTop: 28, borderTop: "1px solid rgba(34,197,94,0.14)", animation: "badgein 0.25s ease both" }}
                          onClick={e => e.stopPropagation()}>
                          <p style={{ fontSize: ".88rem", color: "rgba(255,255,255,0.5)", lineHeight: 1.78, marginBottom: 22 }}>
                            {f.detail}
                          </p>
                          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            {f.bullets.map(b => (
                              <div key={b} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: ".85rem", color: "rgba(255,255,255,0.45)" }}>
                                <span style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", display: "flex", alignItems: "center", justifyContent: "center", color: "#22c55e", flexShrink: 0, marginTop: 2 }}><Icon.Check /></span>
                                {b}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      </section>

      {/* How It Works */}
      <section id="how" className="mob-px" style={{ padding: "80px 56px", background: "rgba(255,255,255,0.016)", borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div ref={howRef}>
            <div style={{ marginBottom: 72 }}>
              <h2 style={{ fontSize: "clamp(2rem,4vw,3rem)", fontWeight: 900, letterSpacing: "-0.035em", lineHeight: 1.1 }}>
                Sidewalk to{" "}
              <em className="serif-italic" style={{ fontWeight: 700, fontSize: "1.06em", letterSpacing: "-0.02em", color: "#fff" }}>seated.</em>
              <br /><span style={{ color: "rgba(255,255,255,0.22)", fontStyle: "normal", fontFamily: "inherit", fontSize: "0.92em" }}>Three steps.</span>
              </h2>
            </div>
            <div className="steps-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 60, position: "relative" }}>
              <div className="steps-line" style={{ position: "absolute", top: 27, left: 27, right: "calc((100% - 120px) / 3 - 27px)", height: 1, background: "linear-gradient(90deg, rgba(34,197,94,0.55), rgba(34,197,94,0.08))" }} />
              {[
                { n:"1", title:"Guest taps or scans.", sub:"They tap the NFC puck or scan the QR code at the stand. Two seconds later, they're in the queue." },
                { n:"2", title:"Host manages.",        sub:"Your iPad shows the live queue, table status, and wait times — all in one place." },
                { n:"3", title:"Guest is seated.",     sub:"We text them and their live page tells them to head to the host stand. You seat them." },
              ].map(s=>(
                <div key={s.n} style={{ position: "relative", zIndex: 1 }}>
                  <div style={{ width: 54, height: 54, borderRadius: "50%", border: "1.5px solid rgba(34,197,94,0.32)", background: "#080A0C", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: "1.1rem", color: "#22c55e", marginBottom: 24, position: "relative" }}>
                    <div style={{ position: "absolute", inset: -6, borderRadius: "50%", border: "1px solid rgba(34,197,94,0.1)" }} />
                    {s.n}
                  </div>
                  <div style={{ fontWeight: 800, fontSize: "1.15rem", marginBottom: 10, color: "#fff", letterSpacing: "-0.02em" }}>{s.title}</div>
                  <div style={{ fontSize: ".88rem", color: "rgba(255,255,255,0.38)", lineHeight: 1.65 }}>{s.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Guest Journey Animation ─────────────────────────────── */}
      <section className="mob-px" style={{ padding: "110px 56px", maxWidth: 1100, margin: "0 auto" }}>
        <div ref={journeyRef}>
          <div style={{ marginBottom: 72, textAlign: "center" }}>
            <h2 style={{ fontSize: "clamp(2rem,4vw,3rem)", fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1.1, marginBottom: 16 }}>
              The full guest{" "}
              <em className="serif-italic" style={{ fontWeight: 700, fontSize: "1.06em", letterSpacing: "-0.02em", color: "#fff" }}>experience.</em>
            </h2>
            <p style={{ fontSize: "1rem", color: "rgba(255,255,255,0.38)", maxWidth: 440, margin: "0 auto" }}>
              From tap to table — everything happens on their phone without downloading anything.
            </p>
          </div>
          <GuestJourney />
        </div>
      </section>

      {/* NFC + QR Spotlight */}
      <section className="nfc-sec mob-px" style={{ padding: "80px 56px 110px", maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div ref={nfcRef} style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 380 }}>
          <PuckTap />
        </div>
        <div ref={useFade(150)}>
          <h2 style={{ fontSize: "clamp(1.8rem,3.5vw,2.8rem)", fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1.05, marginBottom: 20 }}>
            Join from the sidewalk.<br />
            <em className="serif-italic" style={{ fontSize: "1.05em", color: "#22c55e" }}>Before they even walk in.</em>
          </h2>
          <p style={{ fontSize: ".95rem", color: "rgba(255,255,255,0.4)", lineHeight: 1.75, marginBottom: 32 }}>
            Mount the HOST puck on a sign out front. Guests tap or scan on the way in — they&apos;re already in the queue before they reach the host stand. No app, no URL, no clipboard.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
            {[
              "Works on a sign by the door, at the stand — anywhere",
              "NFC tap works on every modern iPhone and Android",
              "QR code always printed on the puck as backup",
              "Zero staff time to onboard a single guest",
              "Branded HOST pucks included at launch",
            ].map(b=>(
              <div key={b} style={{ display: "flex", gap: 12, alignItems: "center", fontSize: ".88rem", color: "rgba(255,255,255,0.48)" }}>
                <span style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.28)", display: "flex", alignItems: "center", justifyContent: "center", color: "#22c55e", flexShrink: 0 }}><Icon.Check /></span>
                {b}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────── */}
      <section className="mob-px" style={{ padding: "110px 56px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 72 }}>
            <div style={{ fontSize: ".72rem", fontWeight: 800, letterSpacing: ".18em", textTransform: "uppercase", color: "#22c55e", marginBottom: 16 }}>FAQ</div>
            <h2 style={{ fontSize: "clamp(2rem,4vw,3rem)", fontWeight: 900, letterSpacing: "-0.035em", lineHeight: 1.08, margin: 0 }}>
              Everything you want{" "}
              <em className="serif-italic" style={{ fontSize: "1.06em", color: "#fff" }}>to know.</em>
            </h2>
          </div>
          <FaqSection />
        </div>
      </section>

      {/* Final CTA */}
      <section className="mob-px" style={{ padding: "130px 56px", textAlign: "center", position: "relative", overflow: "hidden", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 0%, rgba(34,197,94,0.07) 0%, transparent 55%)", pointerEvents: "none" }} />
        <div ref={ctaRef} style={{ position: "relative", zIndex: 1, maxWidth: 560, margin: "0 auto" }}>
          <h2 style={{ fontSize: "clamp(2.5rem,5.5vw,4.2rem)", fontWeight: 900, letterSpacing: "-0.045em", lineHeight: 0.98, marginBottom: 22 }}>
            Ready when<br />you are.
          </h2>
          <p style={{ fontSize: "1rem", color: "rgba(255,255,255,0.36)", marginBottom: 44, lineHeight: 1.65 }}>
            Live in under an hour. We&apos;ll walk you through every step.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="#" onClick={openDemo} className="cta-btn" style={{ fontSize: "1rem", padding: "15px 34px", borderRadius: 12, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 9 }}>
              Get Started <Icon.Arrow />
            </a>
            <Link href="/login" className="ghost-btn" style={{ color: "rgba(255,255,255,0.4)", fontWeight: 500, fontSize: "1rem", padding: "15px 26px", borderRadius: 12, textDecoration: "none", border: "1px solid rgba(255,255,255,0.1)" }}>Log in</Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mob-px" style={{ padding: "28px 56px", borderTop: "1px solid rgba(255,255,255,0.06)", background: "#080A0C" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <span style={{ fontWeight: 900, letterSpacing: ".22em", fontSize: ".82rem", color: "rgba(255,255,255,0.5)" }}>HOST</span>
          <span style={{ fontSize: ".82rem", color: "rgba(255,255,255,0.22)" }}>· a smarter waitlist</span>
        </div>
      </footer>

      {showDemo && <DemoModal onClose={() => setShowDemo(false)} />}
    </div>
  )
}
