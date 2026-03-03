"use client"

import { useState, useEffect } from "react"
import {
  Zap, ArrowRight, Smartphone, BarChart3,
  CalendarCheck, Users, Shield, ChevronRight,
  Lock,
} from "lucide-react"

// ── URLs ───────────────────────────────────────────────────────────────────────
const RESTAURANT_URL = "/admin"
const ADMIN_URL      = "/owner"

// ── Animated counter ──────────────────────────────────────────────────────────
function Counter({ end, suffix = "" }: { end: number; suffix?: string }) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    let start = 0
    const step = end / 60
    const t = setInterval(() => {
      start += step
      if (start >= end) { setVal(end); clearInterval(t) }
      else setVal(Math.floor(start))
    }, 24)
    return () => clearInterval(t)
  }, [end])
  return <>{val.toLocaleString()}{suffix}</>
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function HostHomePage() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div style={{
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      background: "#080C10",
      color: "#FFFFFF",
      minHeight: "100vh",
      overflowX: "hidden",
    }}>

      {/* ── NAV ── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        background: "rgba(8,12,16,0.85)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "0 32px", height: 64,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: "linear-gradient(135deg, #D9321C, #A52010)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 20px rgba(217,50,28,0.4)",
          }}>
            <Zap style={{ width: 18, height: 18, color: "#fff", fill: "#fff" }} />
          </div>
          <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em", color: "#fff" }}>
            HOST
          </span>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: "0.12em",
            background: "rgba(217,50,28,0.15)", color: "#D9321C",
            border: "1px solid rgba(217,50,28,0.3)",
            borderRadius: 4, padding: "2px 7px", marginLeft: 4,
          }}>PRIVATE BETA</span>
        </div>

        {/* Nav links */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <a href="#features" style={{
            fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.55)",
            textDecoration: "none", padding: "6px 14px", borderRadius: 8,
            transition: "color 0.2s",
          }}>Features</a>
          <a href="#how-it-works" style={{
            fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.55)",
            textDecoration: "none", padding: "6px 14px", borderRadius: 8,
          }}>How it works</a>
          <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.1)", margin: "0 4px" }} />
          <a href={ADMIN_URL} style={{
            fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.7)",
            textDecoration: "none", padding: "7px 14px", borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.12)",
            display: "flex", alignItems: "center", gap: 5,
          }}>
            <Lock style={{ width: 11, height: 11 }} />
            Admin
          </a>
          <a href={RESTAURANT_URL} style={{
            fontSize: 13, fontWeight: 700, color: "#fff",
            textDecoration: "none", padding: "7px 18px", borderRadius: 8,
            background: "linear-gradient(135deg, #D9321C, #B02010)",
            display: "flex", alignItems: "center", gap: 5,
            boxShadow: "0 2px 12px rgba(217,50,28,0.3)",
          }}>
            Restaurant Login
            <ArrowRight style={{ width: 13, height: 13 }} />
          </a>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{
        minHeight: "100vh",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        textAlign: "center", padding: "120px 24px 80px",
        position: "relative", overflow: "hidden",
      }}>
        {/* Background glow */}
        <div style={{
          position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)",
          width: 800, height: 500,
          background: "radial-gradient(ellipse at center, rgba(217,50,28,0.12) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
        {/* Grid texture */}
        <div style={{
          position: "absolute", inset: 0, opacity: 0.03,
          backgroundImage: "linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
          pointerEvents: "none",
        }} />

        {/* Beta badge */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "rgba(217,50,28,0.08)", border: "1px solid rgba(217,50,28,0.2)",
          borderRadius: 999, padding: "6px 16px", marginBottom: 32,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#D9321C" }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: "#D9321C", letterSpacing: "0.06em" }}>
            PRIVATE BETA — INVITE ONLY
          </span>
        </div>

        {/* Headline */}
        <h1 style={{
          fontSize: "clamp(42px, 7vw, 88px)",
          fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1.0,
          margin: "0 0 28px", maxWidth: 900,
          background: "linear-gradient(180deg, #FFFFFF 0%, rgba(255,255,255,0.65) 100%)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>
          The operating system for modern restaurants
        </h1>

        {/* Subtext */}
        <p style={{
          fontSize: "clamp(16px, 2vw, 20px)", color: "rgba(255,255,255,0.45)",
          lineHeight: 1.7, maxWidth: 580, margin: "0 0 48px",
          fontWeight: 400,
        }}>
          HOST combines AI-powered scheduling, real-time floor management,
          and NFC-powered guest experiences — all in one platform.
        </p>

        {/* CTA buttons */}
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
          <a href={RESTAURANT_URL} style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "16px 32px", borderRadius: 12,
            background: "linear-gradient(135deg, #D9321C, #B02010)",
            color: "#fff", fontSize: 15, fontWeight: 700, textDecoration: "none",
            boxShadow: "0 4px 24px rgba(217,50,28,0.35)",
            letterSpacing: "-0.01em",
          }}>
            Restaurant Login
            <ArrowRight style={{ width: 16, height: 16 }} />
          </a>
          <a href={ADMIN_URL} style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "16px 32px", borderRadius: 12,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "rgba(255,255,255,0.8)", fontSize: 15, fontWeight: 600,
            textDecoration: "none", letterSpacing: "-0.01em",
          }}>
            <Lock style={{ width: 15, height: 15 }} />
            Admin Console
          </a>
        </div>

        {/* Stats row */}
        <div style={{
          display: "flex", gap: 48, marginTop: 72,
          borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 40,
        }}>
          {[
            { value: 312, suffix: "+", label: "NFC taps" },
            { value: 99,  suffix: "%", label: "Uptime" },
            { value: 18,  suffix: "m",  label: "Avg wait reduced" },
          ].map(({ value, suffix, label }) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div style={{
                fontSize: 36, fontWeight: 900, letterSpacing: "-0.04em",
                color: "#fff", lineHeight: 1,
              }}>
                <Counter end={value} suffix={suffix} />
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 6, fontWeight: 500 }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── PRODUCT PREVIEW ── */}
      <section style={{
        padding: "0 24px 120px",
        display: "flex", justifyContent: "center",
      }}>
        <div style={{
          width: "100%", maxWidth: 1100,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 20, padding: 3,
          boxShadow: "0 40px 120px rgba(0,0,0,0.5), 0 0 0 1px rgba(217,50,28,0.08)",
        }}>
          {/* Fake browser chrome */}
          <div style={{
            background: "rgba(255,255,255,0.04)", borderRadius: "17px 17px 0 0",
            padding: "12px 16px", display: "flex", alignItems: "center", gap: 8,
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}>
            {["#FF5F57","#FFBD2E","#28C840"].map(c => (
              <div key={c} style={{ width: 12, height: 12, borderRadius: "50%", background: c }} />
            ))}
            <div style={{
              flex: 1, margin: "0 16px", background: "rgba(255,255,255,0.05)",
              borderRadius: 6, padding: "4px 12px", fontSize: 11,
              color: "rgba(255,255,255,0.3)", textAlign: "center",
            }}>
              host-digital.com/admin
            </div>
          </div>
          {/* Dashboard preview */}
          <div style={{
            background: "linear-gradient(160deg, #0D1117 0%, #080C10 100%)",
            borderRadius: "0 0 17px 17px", padding: "32px",
            minHeight: 340, display: "flex", gap: 16,
          }}>
            {/* Left sidebar preview */}
            <div style={{
              width: 56, background: "rgba(255,255,255,0.03)",
              borderRadius: 12, padding: "16px 8px",
              display: "flex", flexDirection: "column", gap: 12, alignItems: "center",
            }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(217,50,28,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Zap style={{ width: 14, height: 14, color: "#D9321C", fill: "#D9321C" }} />
              </div>
              {[BarChart3, Users, CalendarCheck].map((Icon, i) => (
                <div key={i} style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon style={{ width: 14, height: 14, color: "rgba(255,255,255,0.3)" }} />
                </div>
              ))}
            </div>
            {/* Main content area */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Top metrics */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                {[
                  { label: "Tables Available", value: "12/16", color: "#22C55E" },
                  { label: "Parties Waiting",  value: "4",     color: "#F59E0B" },
                  { label: "Avg Wait",         value: "18m",   color: "#3B82F6" },
                  { label: "Seated Today",     value: "47",    color: "#D9321C" },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{
                    background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "14px 16px",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginBottom: 6 }}>{label}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
                  </div>
                ))}
              </div>
              {/* Floor plan preview */}
              <div style={{
                flex: 1, background: "rgba(255,255,255,0.02)", borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.05)", padding: "16px",
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: 12, flexWrap: "wrap",
              }}>
                {Array.from({ length: 12 }, (_, i) => (
                  <div key={i} style={{
                    width: i % 3 === 0 ? 44 : i % 4 === 0 ? 60 : 52,
                    height: i % 3 === 0 ? 44 : 52,
                    borderRadius: i < 3 ? "50%" : 8,
                    background: i < 2 ? "rgba(34,197,94,0.15)" : i === 4 ? "rgba(217,50,28,0.15)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${i < 2 ? "rgba(34,197,94,0.3)" : i === 4 ? "rgba(217,50,28,0.3)" : "rgba(255,255,255,0.08)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)",
                  }}>
                    {i + 1}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" style={{ padding: "80px 24px 120px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          {/* Section header */}
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 999, padding: "5px 14px", marginBottom: 20,
            }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: "0.06em" }}>
                FEATURES
              </span>
            </div>
            <h2 style={{
              fontSize: "clamp(28px, 4vw, 48px)", fontWeight: 800,
              letterSpacing: "-0.03em", margin: 0, lineHeight: 1.15,
              background: "linear-gradient(180deg, #fff 0%, rgba(255,255,255,0.6) 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
              Everything your restaurant needs
            </h2>
          </div>

          {/* Feature grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
            {[
              {
                icon: Smartphone,
                title: "NFC-Powered Guest Experience",
                desc: "Guests tap an NFC tag to instantly join the waitlist — no app download, no friction. Just tap and wait.",
                highlight: true,
                tag: "Core",
              },
              {
                icon: CalendarCheck,
                title: "AI Staff Scheduling",
                desc: "HOST generates optimized weekly schedules based on your reservation data, cover counts, and labor constraints.",
                tag: "AI",
              },
              {
                icon: Users,
                title: "Real-Time Floor Management",
                desc: "Drag-and-drop table assignments, live waitlist management, and instant status updates across all devices.",
                tag: "Live",
              },
              {
                icon: BarChart3,
                title: "Analytics & Insights",
                desc: "Track covers, wait times, source attribution, and table utilization. Know your restaurant better than ever.",
                tag: "Data",
              },
            ].map(({ icon: Icon, title, desc, highlight, tag }) => (
              <div key={title} style={{
                background: highlight
                  ? "linear-gradient(135deg, rgba(217,50,28,0.08), rgba(217,50,28,0.03))"
                  : "rgba(255,255,255,0.02)",
                border: `1px solid ${highlight ? "rgba(217,50,28,0.2)" : "rgba(255,255,255,0.07)"}`,
                borderRadius: 16, padding: "32px",
                display: "flex", flexDirection: "column", gap: 16,
                transition: "transform 0.2s",
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 12,
                    background: highlight ? "rgba(217,50,28,0.12)" : "rgba(255,255,255,0.05)",
                    border: `1px solid ${highlight ? "rgba(217,50,28,0.2)" : "rgba(255,255,255,0.08)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Icon style={{ width: 22, height: 22, color: highlight ? "#D9321C" : "rgba(255,255,255,0.5)" }} />
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
                    background: highlight ? "rgba(217,50,28,0.12)" : "rgba(255,255,255,0.06)",
                    color: highlight ? "#D9321C" : "rgba(255,255,255,0.3)",
                    border: `1px solid ${highlight ? "rgba(217,50,28,0.2)" : "rgba(255,255,255,0.08)"}`,
                    borderRadius: 5, padding: "3px 8px",
                  }}>{tag}</span>
                </div>
                <div>
                  <h3 style={{
                    fontSize: 17, fontWeight: 700, margin: "0 0 8px",
                    color: "#fff", letterSpacing: "-0.02em",
                  }}>{title}</h3>
                  <p style={{
                    fontSize: 14, color: "rgba(255,255,255,0.45)",
                    lineHeight: 1.7, margin: 0,
                  }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" style={{
        padding: "80px 24px 120px",
        background: "linear-gradient(180deg, transparent, rgba(217,50,28,0.03), transparent)",
      }}>
        <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 999, padding: "5px 14px", marginBottom: 20,
          }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: "0.06em" }}>
              HOW IT WORKS
            </span>
          </div>
          <h2 style={{
            fontSize: "clamp(28px, 4vw, 48px)", fontWeight: 800,
            letterSpacing: "-0.03em", margin: "0 0 56px", lineHeight: 1.15,
            background: "linear-gradient(180deg, #fff 0%, rgba(255,255,255,0.6) 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            Up and running in minutes
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 0, textAlign: "left" }}>
            {[
              {
                step: "01",
                title: "Place your NFC tag",
                desc: "We ship pre-programmed NFC tags. Place them on tables, host stands, or entrance displays. Guests tap to instantly join the waitlist.",
              },
              {
                step: "02",
                title: "Manage in real time",
                desc: "The HOST dashboard shows your live floor plan, waitlist queue, and guest status. Seat parties with a single tap, no paper needed.",
              },
              {
                step: "03",
                title: "Let AI do the heavy lifting",
                desc: "HOST analyzes your traffic patterns and generates optimized staff schedules, syncing directly to your scheduling platform.",
              },
            ].map(({ step, title, desc }, i) => (
              <div key={step} style={{
                display: "flex", gap: 24, padding: "32px 0",
                borderBottom: i < 2 ? "1px solid rgba(255,255,255,0.06)" : "none",
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                  background: "rgba(217,50,28,0.08)", border: "1px solid rgba(217,50,28,0.15)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 800, color: "#D9321C", letterSpacing: "0.02em",
                }}>{step}</div>
                <div>
                  <h3 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 8px", color: "#fff", letterSpacing: "-0.02em" }}>
                    {title}
                  </h3>
                  <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.7, margin: 0 }}>
                    {desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ── */}
      <section style={{ padding: "0 24px 120px" }}>
        <div style={{
          maxWidth: 900, margin: "0 auto",
          background: "linear-gradient(135deg, rgba(217,50,28,0.12), rgba(217,50,28,0.04))",
          border: "1px solid rgba(217,50,28,0.2)",
          borderRadius: 24, padding: "64px 48px",
          textAlign: "center", position: "relative", overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", top: -40, right: -40,
            width: 200, height: 200, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(217,50,28,0.15), transparent 70%)",
            pointerEvents: "none",
          }} />
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "rgba(217,50,28,0.1)", border: "1px solid rgba(217,50,28,0.2)",
            borderRadius: 999, padding: "6px 16px", marginBottom: 24,
          }}>
            <Shield style={{ width: 12, height: 12, color: "#D9321C" }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: "#D9321C", letterSpacing: "0.06em" }}>
              INVITE ONLY — PRIVATE BETA
            </span>
          </div>
          <h2 style={{
            fontSize: "clamp(26px, 4vw, 42px)", fontWeight: 800,
            letterSpacing: "-0.03em", margin: "0 0 16px",
            color: "#fff", lineHeight: 1.2,
          }}>
            Ready to transform your restaurant?
          </h2>
          <p style={{
            fontSize: 16, color: "rgba(255,255,255,0.45)", lineHeight: 1.7,
            margin: "0 0 36px", maxWidth: 480, marginLeft: "auto", marginRight: "auto",
          }}>
            HOST is currently invite-only. Access your dashboard or contact the HOST team to get started.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href={RESTAURANT_URL} style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "14px 28px", borderRadius: 10,
              background: "linear-gradient(135deg, #D9321C, #B02010)",
              color: "#fff", fontSize: 14, fontWeight: 700, textDecoration: "none",
              boxShadow: "0 4px 20px rgba(217,50,28,0.3)",
            }}>
              Restaurant Login
              <ChevronRight style={{ width: 15, height: 15 }} />
            </a>
            <a href={ADMIN_URL} style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "14px 28px", borderRadius: 10,
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.7)", fontSize: 14, fontWeight: 600, textDecoration: "none",
            }}>
              <Lock style={{ width: 13, height: 13 }} />
              Admin Console
            </a>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{
        borderTop: "1px solid rgba(255,255,255,0.06)",
        padding: "36px 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 7,
            background: "linear-gradient(135deg, #D9321C, #A52010)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Zap style={{ width: 13, height: 13, color: "#fff", fill: "#fff" }} />
          </div>
          <span style={{ fontSize: 14, fontWeight: 800, color: "rgba(255,255,255,0.7)", letterSpacing: "-0.01em" }}>
            HOST
          </span>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.2)" }}>
            · Private Beta · {new Date().getFullYear()}
          </span>
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.2)" }}>
          host-digital.com
        </div>
      </footer>

      <style>{`
        * { box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        a:hover { opacity: 0.85; }
      `}</style>
    </div>
  )
}
