"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Check, X, Zap, Building2, ChevronDown, ArrowRight,
  Smartphone, LayoutDashboard, Users, Clock, BarChart3, MapPin,
} from "lucide-react"

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:        "#F8FAFC",
  surface:   "#FFFFFF",
  border:    "#E2E8F0",
  text:      "#0F172A",
  text2:     "#475569",
  muted:     "#94A3B8",
  green:     "#16A34A",
  greenBg:   "#F0FDF4",
  greenBdr:  "#BBF7D0",
  brown:     "#7C5B3A",
  brownBg:   "rgba(124,91,58,0.08)",
  brownBdr:  "rgba(124,91,58,0.30)",
  teal:      "#3A6B5B",
  gradient:  "linear-gradient(135deg, #7C5B3A 0%, #3A6B5B 100%)",
}

const LOGO = "https://images.getbento.com/accounts/d2ce1ba3bfb5b87e1f0ba2897a682acb/media/images/28198New_Walnut_Logo.png"

// ── Feature rows for comparison table ─────────────────────────────────────────
const FEATURES = [
  { label: "Live waitlist management",          starter: true,  growth: true,  enterprise: true  },
  { label: "Real-time floor & table map",       starter: true,  growth: true,  enterprise: true  },
  { label: "Guest SMS notifications",           starter: true,  growth: true,  enterprise: true  },
  { label: "Admin dashboard",                   starter: true,  growth: true,  enterprise: true  },
  { label: "Guest history & daily log",         starter: true,  growth: true,  enterprise: true  },
  { label: "Works on iPad, tablet, phone",      starter: true,  growth: true,  enterprise: true  },
  { label: "Custom floor plan setup",           starter: true,  growth: true,  enterprise: true  },
  { label: "Multi-location admin view",         starter: false, growth: true,  enterprise: true  },
  { label: "Priority support (4hr response)",   starter: false, growth: true,  enterprise: true  },
  { label: "Dedicated onboarding call",         starter: false, growth: false, enterprise: true  },
  { label: "Custom integrations & features",    starter: false, growth: false, enterprise: true  },
  { label: "Bulk staff training session",       starter: false, growth: false, enterprise: true  },
]

const PLANS = [
  {
    key:      "starter",
    name:     "Single Location",
    price:    149,
    sub:      "per location / month",
    tagline:  "Everything you need to run a smooth floor.",
    color:    C.brown,
    bg:       C.brownBg,
    bdr:      C.brownBdr,
    cta:      "Get started",
    featured: false,
    icon:     MapPin,
  },
  {
    key:      "growth",
    name:     "Multi-Location",
    price:    129,
    sub:      "per location / month",
    tagline:  "One dashboard for all your locations.",
    color:    C.teal,
    bg:       "rgba(58,107,91,0.08)",
    bdr:      "rgba(58,107,91,0.30)",
    cta:      "Get started",
    featured: true,
    icon:     Building2,
  },
  {
    key:      "enterprise",
    name:     "Enterprise",
    price:    null,
    sub:      "custom pricing",
    tagline:  "For groups, franchises, and high-volume venues.",
    color:    "#1E3A5F",
    bg:       "rgba(30,58,95,0.06)",
    bdr:      "rgba(30,58,95,0.22)",
    cta:      "Contact us",
    featured: false,
    icon:     Zap,
  },
] as const

// ── FAQ items ──────────────────────────────────────────────────────────────────
const FAQS = [
  {
    q: "How quickly can we get set up?",
    a: "Most restaurants are live within 24–48 hours. We configure your floor plan, seed your tables, and walk your staff through the system — no IT department needed.",
  },
  {
    q: "Does it work on our existing iPad?",
    a: "Yes. Host runs in any modern browser — Safari, Chrome, etc. No app to install, no hardware to buy. Your existing iPad or phone is all you need.",
  },
  {
    q: "What about SMS costs?",
    a: "SMS notifications are included in the subscription for typical restaurant volumes (under ~500 messages/month). High-volume venues may be offered a usage add-on.",
  },
  {
    q: "Can we cancel anytime?",
    a: "Yes. Subscriptions are month-to-month and you can cancel with 15 days' notice. No long-term contracts, no cancellation fees.",
  },
  {
    q: "Do you take a percentage of our revenue or covers?",
    a: "Never. Unlike OpenTable, we charge a flat monthly fee and nothing else. No per-cover fees, no commissions.",
  },
  {
    q: "Is our guest data secure?",
    a: "Your guest data is yours. We never sell it, advertise with it, or share it with third parties except as necessary to send SMS messages. Data is encrypted in transit and at rest.",
  },
]

// ── Stat callouts ──────────────────────────────────────────────────────────────
const STATS = [
  { value: "2+",  label: "Restaurants live" },
  { value: "~0",  label: "Minutes to seat a guest" },
  { value: "0",   label: "Per-cover fees" },
  { value: "24h", label: "Typical go-live time" },
]

// ── Main component ─────────────────────────────────────────────────────────────
export default function PricingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  return (
    <div style={{
      minHeight: "100dvh",
      background: C.bg,
      fontFamily: "var(--font-geist), system-ui, -apple-system, sans-serif",
      color: C.text,
    }}>

      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(248,250,252,0.92)",
        backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${C.border}`,
        padding: "0 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: 60,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} alt="Host" style={{ height: 30, objectFit: "contain" }} />
          <span style={{ fontSize: 15, fontWeight: 800, color: C.text, letterSpacing: "-0.02em" }}>
            Host
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <a href="mailto:hostsystemsinc@gmail.com"
            style={{ fontSize: 13, fontWeight: 600, color: C.text2, textDecoration: "none",
              padding: "7px 14px", borderRadius: 8, border: `1px solid ${C.border}` }}>
            Contact
          </a>
          <Link href="/station"
            style={{ fontSize: 13, fontWeight: 700, color: "#fff", textDecoration: "none",
              padding: "7px 16px", borderRadius: 8,
              background: C.gradient }}>
            Sign in
          </Link>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section style={{ textAlign: "center", padding: "80px 24px 60px", maxWidth: 700, margin: "0 auto" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase",
          color: C.brown, background: C.brownBg, border: `1px solid ${C.brownBdr}`,
          padding: "5px 12px", borderRadius: 20, marginBottom: 22,
        }}>
          Trusted by The Walnut Cafe — Boulder, CO
        </div>

        <h1 style={{
          fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 900, lineHeight: 1.1,
          letterSpacing: "-0.03em", color: C.text, marginBottom: 18,
        }}>
          Simple pricing.<br />
          <span style={{ background: C.gradient, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Seriously powerful software.
          </span>
        </h1>

        <p style={{ fontSize: 17, color: C.text2, lineHeight: 1.65, maxWidth: 520, margin: "0 auto 32px" }}>
          Waitlist management, live floor maps, and guest SMS — built for real restaurants.
          No per-cover fees. No revenue share. Just a flat monthly rate.
        </p>

        <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
          <a href="mailto:hostsystemsinc@gmail.com?subject=Host Demo Request"
            style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              fontSize: 14, fontWeight: 700, color: "#fff",
              padding: "12px 22px", borderRadius: 10,
              background: C.gradient, textDecoration: "none",
            }}>
            Request a demo <ArrowRight size={15} />
          </a>
          <a href="#pricing"
            style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              fontSize: 14, fontWeight: 600, color: C.text2,
              padding: "12px 22px", borderRadius: 10,
              background: C.surface, border: `1px solid ${C.border}`, textDecoration: "none",
            }}>
            See pricing
          </a>
        </div>
      </section>

      {/* ── Stats bar ───────────────────────────────────────────────────────── */}
      <section style={{
        display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 0,
        borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`,
        background: C.surface, padding: "0 16px",
        margin: "0 0 72px",
      }}>
        {STATS.map((s, i) => (
          <div key={s.label} style={{
            padding: "22px 40px", textAlign: "center",
            borderRight: i < STATS.length - 1 ? `1px solid ${C.border}` : "none",
          }}>
            <p style={{ fontSize: 28, fontWeight: 900, color: C.text, lineHeight: 1, marginBottom: 4 }}>{s.value}</p>
            <p style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em" }}>{s.label}</p>
          </div>
        ))}
      </section>

      {/* ── Feature highlights ───────────────────────────────────────────────── */}
      <section style={{ maxWidth: 900, margin: "0 auto 80px", padding: "0 24px" }}>
        <h2 style={{ textAlign: "center", fontSize: 26, fontWeight: 800, marginBottom: 8, letterSpacing: "-0.02em" }}>
          Everything your floor needs
        </h2>
        <p style={{ textAlign: "center", fontSize: 14, color: C.text2, marginBottom: 40 }}>
          Built from scratch for how restaurants actually work — not adapted from a hotel booking tool.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          {[
            { icon: Users,           title: "Smart Waitlist",       desc: "Add guests, quote wait times, and notify them by text when their table is ready." },
            { icon: LayoutDashboard, title: "Live Floor Map",       desc: "Drag-and-drop table management with your actual floor plan — see every table at a glance." },
            { icon: Smartphone,      title: "Guest SMS",            desc: "Automatic text notifications so guests can wait anywhere, not just in your lobby." },
            { icon: Clock,           title: "Real-Time Admin",      desc: "Dashboard view of occupancy, wait times, and daily guest history — live, always." },
            { icon: BarChart3,       title: "Daily Analytics",      desc: "Seated count, avg wait, party sizes, and more. Know your busiest times." },
            { icon: Building2,       title: "Multi-Location",       desc: "Manage the Original and Southside from one admin login — seamlessly." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} style={{
              background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 14, padding: "20px 22px",
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: C.brownBg, border: `1px solid ${C.brownBdr}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: 12,
              }}>
                <Icon size={16} style={{ color: C.brown }} />
              </div>
              <p style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 6 }}>{title}</p>
              <p style={{ fontSize: 13, color: C.text2, lineHeight: 1.6 }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing cards ───────────────────────────────────────────────────── */}
      <section id="pricing" style={{ maxWidth: 980, margin: "0 auto 80px", padding: "0 24px" }}>
        <h2 style={{ textAlign: "center", fontSize: 26, fontWeight: 800, marginBottom: 8, letterSpacing: "-0.02em" }}>
          Straightforward pricing
        </h2>
        <p style={{ textAlign: "center", fontSize: 14, color: C.text2, marginBottom: 40 }}>
          No setup surprises. No per-cover fees. Cancel anytime.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18, alignItems: "start" }}>
          {PLANS.map(plan => {
            const Icon = plan.icon
            return (
              <div key={plan.key} style={{
                background: plan.featured ? C.text : C.surface,
                border: `2px solid ${plan.featured ? C.text : plan.bdr}`,
                borderRadius: 20,
                padding: "30px 28px",
                position: "relative",
                boxShadow: plan.featured ? "0 20px 60px rgba(15,23,42,0.18)" : "none",
              }}>
                {plan.featured && (
                  <div style={{
                    position: "absolute", top: -13, left: "50%", transform: "translateX(-50%)",
                    background: C.gradient, color: "#fff",
                    fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase",
                    padding: "4px 14px", borderRadius: 20,
                  }}>
                    Most Popular
                  </div>
                )}

                <div style={{
                  width: 42, height: 42, borderRadius: 12,
                  background: plan.featured ? "rgba(255,255,255,0.1)" : plan.bg,
                  border: `1px solid ${plan.featured ? "rgba(255,255,255,0.15)" : plan.bdr}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: 16,
                }}>
                  <Icon size={18} style={{ color: plan.featured ? "#fff" : plan.color }} />
                </div>

                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
                  color: plan.featured ? "rgba(255,255,255,0.5)" : C.muted, marginBottom: 6 }}>
                  {plan.name}
                </p>

                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
                  {plan.price ? (
                    <>
                      <span style={{ fontSize: 40, fontWeight: 900, color: plan.featured ? "#fff" : C.text, lineHeight: 1, letterSpacing: "-0.03em" }}>
                        ${plan.price}
                      </span>
                      <span style={{ fontSize: 13, color: plan.featured ? "rgba(255,255,255,0.55)" : C.muted }}>
                        {plan.sub}
                      </span>
                    </>
                  ) : (
                    <span style={{ fontSize: 30, fontWeight: 900, color: plan.featured ? "#fff" : C.text, lineHeight: 1 }}>
                      Let&apos;s talk
                    </span>
                  )}
                </div>

                <p style={{ fontSize: 13, color: plan.featured ? "rgba(255,255,255,0.65)" : C.text2, marginBottom: 24, lineHeight: 1.5 }}>
                  {plan.tagline}
                </p>

                <a
                  href={plan.key === "enterprise"
                    ? "mailto:hostsystemsinc@gmail.com?subject=Enterprise Inquiry"
                    : "mailto:hostsystemsinc@gmail.com?subject=Host Demo Request"}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    width: "100%", padding: "12px 0", borderRadius: 10,
                    background: plan.featured ? "#fff" : plan.bg,
                    border: `1.5px solid ${plan.featured ? "#fff" : plan.bdr}`,
                    color: plan.featured ? C.text : plan.color,
                    fontSize: 13, fontWeight: 700, textDecoration: "none",
                    marginBottom: 24,
                  }}>
                  {plan.cta} <ArrowRight size={13} />
                </a>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {FEATURES.filter(f => f[plan.key as keyof typeof f] === true).map(f => (
                    <div key={f.label} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <div style={{
                        width: 16, height: 16, borderRadius: "50%", flexShrink: 0, marginTop: 1,
                        background: plan.featured ? "rgba(255,255,255,0.15)" : C.greenBg,
                        border: `1px solid ${plan.featured ? "rgba(255,255,255,0.2)" : C.greenBdr}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <Check size={9} style={{ color: plan.featured ? "#fff" : C.green }} />
                      </div>
                      <span style={{ fontSize: 12.5, color: plan.featured ? "rgba(255,255,255,0.75)" : C.text2, lineHeight: 1.4 }}>
                        {f.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <p style={{ textAlign: "center", fontSize: 12, color: C.muted, marginTop: 20 }}>
          All plans include a complimentary 30-day trial. Month-to-month, cancel anytime with 15 days&apos; notice.
        </p>
      </section>

      {/* ── Comparison table ─────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 860, margin: "0 auto 80px", padding: "0 24px", overflowX: "auto" }}>
        <h2 style={{ textAlign: "center", fontSize: 22, fontWeight: 800, marginBottom: 32, letterSpacing: "-0.02em" }}>
          Plan comparison
        </h2>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${C.border}` }}>
              <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>Feature</th>
              {PLANS.map(p => (
                <th key={p.key} style={{ padding: "10px 16px", textAlign: "center", fontSize: 12, fontWeight: 800, color: C.text, width: 110 }}>
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FEATURES.map((f, i) => (
              <tr key={f.label} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? C.bg : C.surface }}>
                <td style={{ padding: "11px 16px", color: C.text2 }}>{f.label}</td>
                {(["starter", "growth", "enterprise"] as const).map(key => (
                  <td key={key} style={{ padding: "11px 16px", textAlign: "center" }}>
                    {f[key]
                      ? <Check size={15} style={{ color: C.green, margin: "0 auto" }} />
                      : <X size={13} style={{ color: C.muted, margin: "0 auto", opacity: 0.4 }} />
                    }
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* ── Social proof ────────────────────────────────────────────────────── */}
      <section style={{
        maxWidth: 700, margin: "0 auto 80px", padding: "0 24px", textAlign: "center",
      }}>
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 20, padding: "36px 40px",
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} alt="Walnut Cafe" style={{ height: 40, objectFit: "contain", marginBottom: 20 }} />
          <blockquote style={{
            fontSize: 17, lineHeight: 1.7, color: C.text2, fontStyle: "italic",
            margin: "0 0 20px",
          }}>
            &ldquo;Host handles our entire floor — the waitlist, table turnover, texting guests when
            they&apos;re ready. Our team spends less time managing the lobby and more time
            taking care of people at the table.&rdquo;
          </blockquote>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: C.brownBg, border: `1px solid ${C.brownBdr}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: C.brown }}>W</span>
            </div>
            <div style={{ textAlign: "left" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: C.text }}>The Walnut Cafe</p>
              <p style={{ fontSize: 11, color: C.muted }}>Boulder, CO · Original &amp; Southside locations</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 660, margin: "0 auto 80px", padding: "0 24px" }}>
        <h2 style={{ textAlign: "center", fontSize: 22, fontWeight: 800, marginBottom: 32, letterSpacing: "-0.02em" }}>
          Frequently asked questions
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {FAQS.map((faq, i) => (
            <div key={i} style={{
              background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 12, overflow: "hidden",
            }}>
              <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                style={{
                  width: "100%", display: "flex", alignItems: "center",
                  justifyContent: "space-between", gap: 12,
                  padding: "16px 18px", background: "transparent", border: "none",
                  cursor: "pointer", textAlign: "left",
                }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{faq.q}</span>
                <ChevronDown size={15} style={{
                  color: C.muted, flexShrink: 0,
                  transform: openFaq === i ? "rotate(180deg)" : "none",
                  transition: "transform 0.2s",
                }} />
              </button>
              {openFaq === i && (
                <div style={{
                  padding: "0 18px 16px",
                  fontSize: 13, color: C.text2, lineHeight: 1.7,
                  borderTop: `1px solid ${C.border}`, paddingTop: 14,
                }}>
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────────── */}
      <section style={{
        textAlign: "center",
        padding: "64px 24px 80px",
        background: C.text,
        margin: "0",
      }}>
        <h2 style={{
          fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 900,
          color: "#fff", letterSpacing: "-0.02em", marginBottom: 14,
        }}>
          Ready to simplify your floor?
        </h2>
        <p style={{ fontSize: 15, color: "rgba(255,255,255,0.6)", marginBottom: 30, maxWidth: 440, margin: "0 auto 30px" }}>
          We&apos;ll set up your floor plan, train your staff, and have you live in under 48 hours.
          First 30 days on us.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <a href="mailto:hostsystemsinc@gmail.com?subject=Host Demo Request"
            style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              fontSize: 14, fontWeight: 700, color: C.text,
              padding: "13px 24px", borderRadius: 10,
              background: "#fff", textDecoration: "none",
            }}>
            Request a free demo <ArrowRight size={14} />
          </a>
          <a href="mailto:hostsystemsinc@gmail.com"
            style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.75)",
              padding: "13px 24px", borderRadius: 10,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.15)",
              textDecoration: "none",
            }}>
            Email us
          </a>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer style={{
        background: "#090E1A", padding: "28px 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} alt="Host" style={{ height: 22, objectFit: "contain", opacity: 0.8 }} />
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
            © 2026 Host Systems LLC. All rights reserved.
          </span>
        </div>
        <div style={{ display: "flex", gap: 20 }}>
          <Link href="/legal/terms" style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", textDecoration: "none" }}>
            Terms of Service
          </Link>
          <Link href="/legal/privacy" style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", textDecoration: "none" }}>
            Privacy Policy
          </Link>
          <a href="mailto:hostsystemsinc@gmail.com" style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", textDecoration: "none" }}>
            Contact
          </a>
        </div>
      </footer>

    </div>
  )
}
