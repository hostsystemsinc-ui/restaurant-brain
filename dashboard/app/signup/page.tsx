"use client"

import { useState, useRef, useEffect } from "react"
import { Check, ChevronRight, AlertCircle, Loader2, ShieldCheck } from "lucide-react"

// ── Design tokens ──────────────────────────────────────────────────────────────
const C = {
  bg:       "#F8FAFC",
  surface:  "#FFFFFF",
  border:   "#E2E8F0",
  text:     "#0F172A",
  text2:    "#475569",
  muted:    "#94A3B8",
  green:    "#16A34A",
  greenBg:  "#F0FDF4",
  greenBdr: "#BBF7D0",
  red:      "#DC2626",
  redBg:    "#FEF2F2",
  redBdr:   "#FECACA",
  brown:    "#7C5B3A",
  brownBg:  "rgba(124,91,58,0.08)",
  brownBdr: "rgba(124,91,58,0.28)",
  gradient: "linear-gradient(135deg, #7C5B3A 0%, #3A6B5B 100%)",
}

const LOGO = "https://images.getbento.com/accounts/d2ce1ba3bfb5b87e1f0ba2897a682acb/media/images/28198New_Walnut_Logo.png"

const PLANS = [
  {
    key:      "single",
    name:     "Single Location",
    price:    149,
    desc:     "One restaurant location",
  },
  {
    key:      "multi",
    name:     "Multi-Location",
    price:    129,
    desc:     "Per location — 2 or more locations",
  },
]

// ── Step indicator ─────────────────────────────────────────────────────────────
function Steps({ step }: { step: number }) {
  const labels = ["Your info", "Plan", "Review & Sign"]
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0, marginBottom: 32 }}>
      {labels.map((label, i) => {
        const n = i + 1
        const done    = step > n
        const current = step === n
        return (
          <div key={label} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: done ? C.green : current ? C.brown : C.bg,
                border: `2px solid ${done ? C.green : current ? C.brown : C.border}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: done || current ? "#fff" : C.muted,
                fontSize: 13, fontWeight: 700,
                transition: "all 0.2s",
              }}>
                {done ? <Check size={14} /> : n}
              </div>
              <span style={{
                fontSize: 10, fontWeight: current ? 700 : 500,
                color: current ? C.brown : done ? C.green : C.muted,
                textTransform: "uppercase", letterSpacing: "0.08em",
                whiteSpace: "nowrap",
              }}>{label}</span>
            </div>
            {i < labels.length - 1 && (
              <div style={{
                width: 60, height: 2, margin: "0 6px",
                background: step > n ? C.green : C.border,
                marginBottom: 22, transition: "background 0.3s",
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Contract text component ────────────────────────────────────────────────────
function ContractText() {
  return (
    <div style={{ fontSize: 11, lineHeight: 1.7, color: C.text2 }}>
      <p style={{ fontWeight: 800, fontSize: 13, color: C.text, marginBottom: 4 }}>HOST SYSTEMS LLC — MASTER SUBSCRIPTION AGREEMENT</p>
      <p style={{ marginBottom: 8, fontSize: 10, color: C.muted }}>Version 1.0 · Full text available at hostplatform.net/legal/terms</p>

      <p style={{ marginBottom: 10 }}>
        This Master Subscription Agreement ("Agreement") governs your access to and use of the Host restaurant
        management platform ("Services") provided by Host Systems LLC, a Colorado limited liability company.
        By completing this onboarding, you agree to all terms of this Agreement.
      </p>

      <p style={{ fontWeight: 700, color: C.text, marginBottom: 4 }}>FREE TRIAL (Article 2)</p>
      <p style={{ marginBottom: 10 }}>
        You receive a 30-day free trial beginning today. No charge during the trial. On Day 31, your subscription
        converts automatically to the paid plan you select. You'll receive reminder emails at 7 days and 3 days
        before billing begins. Cancel anytime before Day 31 at no charge. One trial per business entity.
      </p>

      <p style={{ fontWeight: 700, color: C.text, marginBottom: 4 }}>SUBSCRIPTION & PAYMENT (Articles 3–4)</p>
      <p style={{ marginBottom: 10 }}>
        Monthly subscription billed in advance via Stripe. Auto-renews monthly. Price adjustments require
        30 days' notice. Late payments accrue interest at 1.5%/month. Accounts suspended after 10 days
        of non-payment; terminated after 30 days. All fees are non-refundable except as stated in the Agreement.
      </p>

      <p style={{ fontWeight: 700, color: C.text, marginBottom: 4 }}>YOUR DATA (Article 6)</p>
      <p style={{ marginBottom: 10 }}>
        You own your guest data. We process it only to provide the Services and never sell it or use it
        for advertising. We maintain reasonable security measures. You are responsible for obtaining
        guest consent to receive SMS messages under the TCPA.
      </p>

      <p style={{ fontWeight: 700, color: C.text, marginBottom: 4 }}>SMS COMPLIANCE (Article 7)</p>
      <p style={{ marginBottom: 10 }}>
        You are solely responsible for TCPA compliance, including obtaining prior express written consent
        from every guest before texting them. Host Systems is not liable for your SMS practices.
      </p>

      <p style={{ fontWeight: 700, color: C.text, marginBottom: 4 }}>INTELLECTUAL PROPERTY (Article 8)</p>
      <p style={{ marginBottom: 10 }}>
        Host Systems owns the platform and all related software. You retain your guest data and brand assets.
      </p>

      <p style={{ fontWeight: 700, color: C.text, marginBottom: 4 }}>LIMITATION OF LIABILITY (Article 11)</p>
      <p style={{ marginBottom: 10 }}>
        <strong>IMPORTANT: HOST SYSTEMS' TOTAL LIABILITY IS CAPPED AT ONE MONTH'S SUBSCRIPTION FEES.
        NEITHER PARTY IS LIABLE FOR INDIRECT, CONSEQUENTIAL, OR PUNITIVE DAMAGES.</strong> These limitations
        are a fundamental part of the agreement.
      </p>

      <p style={{ fontWeight: 700, color: C.text, marginBottom: 4 }}>TERMINATION (Article 5)</p>
      <p style={{ marginBottom: 10 }}>
        Cancel anytime with 15 days' written notice (after the trial). No long-term contract, no cancellation fees.
        Termination for cause (non-payment or material breach) requires 30 days' cure notice.
      </p>

      <p style={{ fontWeight: 700, color: C.text, marginBottom: 4 }}>GOVERNING LAW & ARBITRATION (Article 13)</p>
      <p style={{ marginBottom: 10 }}>
        Colorado law governs this Agreement. Disputes are resolved by binding JAMS arbitration in Denver,
        Colorado. <strong>You waive your right to a jury trial and to participate in class actions.</strong>
      </p>

      <p style={{ fontWeight: 700, color: C.text, marginBottom: 4 }}>ELECTRONIC SIGNATURE (Exhibit C)</p>
      <p style={{ marginBottom: 2 }}>
        By signing below, you confirm that you have read this Agreement, are authorized to bind your
        business, and agree to be bound by all its terms. This signature is legally binding under the
        ESIGN Act (15 U.S.C. § 7001) and the Colorado Uniform Electronic Transactions Act (C.R.S. § 24-71.3-101).
      </p>
    </div>
  )
}

// ── Field component ────────────────────────────────────────────────────────────
function Field({
  label, value, onChange, type = "text", placeholder = "", required = true, hint,
}: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; placeholder?: string; required?: boolean; hint?: string
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: C.text }}>
        {label}{required && <span style={{ color: C.red, marginLeft: 2 }}>*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        style={{
          padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.border}`,
          fontSize: 13, color: C.text, background: C.surface, outline: "none",
          fontFamily: "inherit",
        }}
      />
      {hint && <p style={{ fontSize: 11, color: C.muted }}>{hint}</p>}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function SignupPage() {
  const [step,       setStep]       = useState<1 | 2 | 3>(1)
  const [submitting, setSubmitting] = useState(false)
  const [done,       setDone]       = useState(false)
  const [error,      setError]      = useState("")

  // Step 1 — business info
  const [bizName,       setBizName]       = useState("")
  const [ownerName,     setOwnerName]     = useState("")
  const [email,         setEmail]         = useState("")
  const [phone,         setPhone]         = useState("")
  const [address,       setAddress]       = useState("")
  const [locationCount, setLocationCount] = useState("1")

  // Step 2 — plan
  const [plan, setPlan] = useState<"single" | "multi">("single")

  // Step 3 — signature
  const [scrolledToBottom, setScrolledToBottom] = useState(false)
  const [agreed,           setAgreed]           = useState(false)
  const [sigName,          setSigName]          = useState("")
  const [sigTitle,         setSigTitle]         = useState("")
  const contractRef = useRef<HTMLDivElement>(null)

  // Track scroll to bottom of contract
  useEffect(() => {
    if (step !== 3) return
    const el = contractRef.current
    if (!el) return
    const handler = () => {
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 40) {
        setScrolledToBottom(true)
      }
    }
    el.addEventListener("scroll", handler)
    return () => el.removeEventListener("scroll", handler)
  }, [step])

  const step1Valid = bizName.trim() && ownerName.trim() && email.trim() && address.trim()
  const step3Valid = scrolledToBottom && agreed && sigName.trim().length >= 2

  async function handleSubmit() {
    if (!step3Valid) return
    setSubmitting(true)
    setError("")
    try {
      const res = await fetch("/api/agreements/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_name:  bizName.trim(),
          signer_name:    sigName.trim(),
          signer_title:   sigTitle.trim() || null,
          signer_email:   email.trim(),
          phone:          phone.trim() || null,
          address:        address.trim(),
          location_count: parseInt(locationCount, 10),
          plan_type:      plan,
          monthly_fee:    plan === "multi" ? 129 * parseInt(locationCount, 10) : 149,
          agreement_version: "MSA-v1.0-2026-05",
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || "Submission failed. Please try again.")
      }
      setDone(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "An unexpected error occurred.")
    } finally {
      setSubmitting(false)
    }
  }

  // ── Success screen ─────────────────────────────────────────────────────────
  if (done) {
    return (
      <div style={{
        minHeight: "100dvh", background: C.bg, display: "flex", alignItems: "center",
        justifyContent: "center", padding: 24,
        fontFamily: "var(--font-geist), system-ui, sans-serif",
      }}>
        <div style={{ maxWidth: 460, width: "100%", textAlign: "center" }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: C.greenBg, border: `2px solid ${C.greenBdr}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px",
          }}>
            <Check size={28} style={{ color: C.green }} />
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: C.text, marginBottom: 10, letterSpacing: "-0.02em" }}>
            You&apos;re all set!
          </h1>
          <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.65, marginBottom: 24 }}>
            Your 30-day free trial has started. We&apos;ll send a copy of your signed agreement
            to <strong>{email}</strong>. Your team will hear from us within one business day
            to get your floor plan configured and your staff trained.
          </p>
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 14, padding: "16px 20px", marginBottom: 24, textAlign: "left",
          }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Your trial summary</p>
            {[
              { label: "Business",       value: bizName },
              { label: "Plan",           value: plan === "multi" ? `Multi-Location · ${locationCount} locations` : "Single Location" },
              { label: "Trial ends",     value: new Date(Date.now() + 30 * 86400000).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) },
              { label: "Billing starts", value: `$${plan === "multi" ? 129 * parseInt(locationCount, 10) : 149}/mo after trial` },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 12, color: C.muted }}>{label}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{value}</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: C.muted }}>
            Questions? Email us at{" "}
            <a href="mailto:hostsystemsinc@gmail.com" style={{ color: C.brown }}>hostsystemsinc@gmail.com</a>
          </p>
        </div>
      </div>
    )
  }

  const locs = parseInt(locationCount, 10) || 1
  const monthly = plan === "multi" ? 129 * locs : 149

  return (
    <div style={{
      minHeight: "100dvh", background: C.bg, padding: "32px 16px",
      fontFamily: "var(--font-geist), system-ui, sans-serif", color: C.text,
    }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} alt="Host" style={{ height: 36, objectFit: "contain", marginBottom: 12 }} />
          <h1 style={{ fontSize: 22, fontWeight: 900, color: C.text, letterSpacing: "-0.02em", marginBottom: 4 }}>
            Start your free trial
          </h1>
          <p style={{ fontSize: 13, color: C.text2 }}>
            30 days free · No credit card required · Cancel anytime
          </p>
        </div>

        <Steps step={step} />

        <div style={{
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 18, padding: "28px 28px",
        }}>

          {/* ── STEP 1: Business Info ────────────────────────────────────────── */}
          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <p style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 2 }}>Tell us about your restaurant</p>
                <p style={{ fontSize: 12, color: C.muted }}>This information will appear in your signed agreement.</p>
              </div>
              <Field label="Restaurant / Business Name" value={bizName} onChange={setBizName} placeholder="e.g. The Walnut Cafe LLC" />
              <Field label="Your Full Name" value={ownerName} onChange={setOwnerName} placeholder="Legal name of the owner or manager" />
              <Field label="Business Email" value={email} onChange={setEmail} type="email" placeholder="you@yourrestaurant.com" hint="Agreement copy will be sent here" />
              <Field label="Phone Number" value={phone} onChange={setPhone} type="tel" placeholder="(303) 555-0100" required={false} />
              <Field label="Restaurant Address" value={address} onChange={setAddress} placeholder="123 Main St, Boulder, CO 80302" />
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.text }}>Number of Locations<span style={{ color: C.red, marginLeft: 2 }}>*</span></label>
                <select value={locationCount} onChange={e => { setLocationCount(e.target.value); if (parseInt(e.target.value) > 1) setPlan("multi") }}
                  style={{ padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, color: C.text, background: C.surface, fontFamily: "inherit" }}>
                  {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n} location{n > 1 ? "s" : ""}</option>)}
                </select>
              </div>
              <button
                onClick={() => setStep(2)}
                disabled={!step1Valid}
                style={{
                  padding: "12px 0", borderRadius: 10, marginTop: 4,
                  background: step1Valid ? C.gradient : C.border,
                  border: "none", color: "#fff",
                  fontSize: 14, fontWeight: 700, cursor: step1Valid ? "pointer" : "not-allowed",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}>
                Continue <ChevronRight size={15} />
              </button>
            </div>
          )}

          {/* ── STEP 2: Plan ─────────────────────────────────────────────────── */}
          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <p style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 2 }}>Choose your plan</p>
                <p style={{ fontSize: 12, color: C.muted }}>
                  {locs > 1 ? `You entered ${locs} locations — Multi-Location pricing applies.` : "Prices shown are after your 30-day free trial."}
                </p>
              </div>
              {PLANS.map(p => {
                const sel = plan === p.key
                return (
                  <button key={p.key}
                    onClick={() => setPlan(p.key as "single" | "multi")}
                    style={{
                      all: "unset", cursor: "pointer",
                      display: "block", width: "100%",
                      background: sel ? C.brownBg : C.bg,
                      border: `2px solid ${sel ? C.brown : C.border}`,
                      borderRadius: 12, padding: "16px 18px",
                      boxSizing: "border-box",
                    }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{p.name}</p>
                        <p style={{ fontSize: 12, color: C.text2 }}>{p.desc}</p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ fontSize: 22, fontWeight: 900, color: sel ? C.brown : C.text }}>
                          ${p.key === "multi" ? p.price * locs : p.price}
                          <span style={{ fontSize: 12, fontWeight: 600, color: C.muted }}>/mo</span>
                        </p>
                        {p.key === "multi" && locs > 1 && (
                          <p style={{ fontSize: 10, color: C.muted }}>${p.price}/location</p>
                        )}
                      </div>
                    </div>
                    {sel && (
                      <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 5 }}>
                        <Check size={12} style={{ color: C.green }} />
                        <span style={{ fontSize: 11, color: C.green, fontWeight: 600 }}>Selected</span>
                      </div>
                    )}
                  </button>
                )
              })}

              {/* Trial callout */}
              <div style={{
                background: C.greenBg, border: `1px solid ${C.greenBdr}`,
                borderRadius: 10, padding: "12px 14px",
              }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: C.green, marginBottom: 2 }}>🎉 30-day free trial included</p>
                <p style={{ fontSize: 11, color: C.text2, lineHeight: 1.5 }}>
                  Your first 30 days are completely free. On{" "}
                  <strong>{new Date(Date.now() + 30 * 86400000).toLocaleDateString("en-US", { month: "long", day: "numeric" })}</strong>,
                  billing begins at <strong>${monthly}/month</strong>. Cancel anytime before then.
                </p>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setStep(1)}
                  style={{ flex: 1, padding: "11px 0", borderRadius: 10, background: C.bg, border: `1px solid ${C.border}`, color: C.text2, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  Back
                </button>
                <button onClick={() => setStep(3)}
                  style={{ flex: 2, padding: "11px 0", borderRadius: 10, background: C.gradient, border: "none", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  Review Agreement <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Contract + Signature ─────────────────────────────────── */}
          {step === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <p style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 2 }}>Review and sign</p>
                <p style={{ fontSize: 12, color: C.muted }}>Scroll through the agreement below, then sign at the bottom.</p>
              </div>

              {/* Contract scroll box */}
              <div
                ref={contractRef}
                style={{
                  height: 300, overflowY: "auto", border: `1px solid ${C.border}`,
                  borderRadius: 10, padding: "16px",
                  background: "#FAFBFC",
                }}>
                <ContractText />
              </div>

              {!scrolledToBottom && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.muted }}>
                  <AlertCircle size={12} />
                  Scroll to the bottom of the agreement to enable signing.
                </div>
              )}

              {/* Agree checkbox */}
              <label style={{
                display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer",
                opacity: scrolledToBottom ? 1 : 0.4, pointerEvents: scrolledToBottom ? "auto" : "none",
              }}>
                <div
                  onClick={() => setAgreed(a => !a)}
                  style={{
                    width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                    border: `2px solid ${agreed ? C.green : C.border}`,
                    background: agreed ? C.green : C.surface,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", marginTop: 1,
                  }}>
                  {agreed && <Check size={11} style={{ color: "#fff" }} />}
                </div>
                <span style={{ fontSize: 12, color: C.text2, lineHeight: 1.5 }}>
                  I have read and agree to the Host Systems LLC Master Subscription Agreement.
                  I am authorized to sign on behalf of <strong>{bizName || "my business"}</strong>.
                </span>
              </label>

              {/* Signature fields */}
              <div style={{
                opacity: agreed ? 1 : 0.4, pointerEvents: agreed ? "auto" : "none",
                display: "flex", flexDirection: "column", gap: 12,
              }}>
                <div style={{
                  background: C.brownBg, border: `1px solid ${C.brownBdr}`,
                  borderRadius: 10, padding: "12px 14px",
                }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: C.brown, marginBottom: 2 }}>
                    ✍️ Electronic Signature
                  </p>
                  <p style={{ fontSize: 11, color: C.text2 }}>
                    Type your full legal name below to create your binding electronic signature.
                  </p>
                </div>
                <Field
                  label="Full Legal Name (Signature)"
                  value={sigName}
                  onChange={setSigName}
                  placeholder="Your full legal name"
                  hint="This will be recorded as your electronic signature"
                />
                <Field
                  label="Your Title"
                  value={sigTitle}
                  onChange={setSigTitle}
                  placeholder="e.g. Owner, General Manager, CEO"
                  required={false}
                />
              </div>

              {/* Order summary */}
              <div style={{
                background: C.bg, border: `1px solid ${C.border}`,
                borderRadius: 10, padding: "12px 14px",
              }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Order Summary</p>
                {[
                  { label: "Business",      value: bizName },
                  { label: "Plan",          value: plan === "multi" ? `Multi-Location (${locs})` : "Single Location" },
                  { label: "Monthly (after trial)", value: `$${monthly}` },
                  { label: "Trial period",  value: `Free through ${new Date(Date.now() + 30 * 86400000).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}` },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, paddingBottom: 5 }}>
                    <span style={{ color: C.muted }}>{label}</span>
                    <span style={{ fontWeight: 600, color: C.text }}>{value}</span>
                  </div>
                ))}
              </div>

              {error && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 12px", borderRadius: 8, background: C.redBg, border: `1px solid ${C.redBdr}` }}>
                  <AlertCircle size={14} style={{ color: C.red, flexShrink: 0 }} />
                  <p style={{ fontSize: 12, color: C.red }}>{error}</p>
                </div>
              )}

              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setStep(2)} disabled={submitting}
                  style={{ flex: 1, padding: "11px 0", borderRadius: 10, background: C.bg, border: `1px solid ${C.border}`, color: C.text2, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  Back
                </button>
                <button onClick={handleSubmit} disabled={!step3Valid || submitting}
                  style={{
                    flex: 2, padding: "11px 0", borderRadius: 10,
                    background: step3Valid && !submitting ? C.gradient : C.border,
                    border: "none", color: "#fff",
                    fontSize: 14, fontWeight: 700,
                    cursor: step3Valid && !submitting ? "pointer" : "not-allowed",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                  }}>
                  {submitting ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <ShieldCheck size={15} />}
                  {submitting ? "Saving…" : "Sign & Start Free Trial"}
                </button>
              </div>

              <p style={{ fontSize: 10, color: C.muted, textAlign: "center", lineHeight: 1.5 }}>
                By signing, you confirm you have authority to bind your business to this agreement.
                Your signature timestamp and IP address will be recorded. A copy will be emailed to {email || "you"}.
              </p>
            </div>
          )}

        </div>

        <p style={{ textAlign: "center", fontSize: 11, color: C.muted, marginTop: 16 }}>
          Have questions?{" "}
          <a href="mailto:hostsystemsinc@gmail.com" style={{ color: C.brown }}>hostsystemsinc@gmail.com</a>
          {" · "}
          <a href="/legal/terms" target="_blank" rel="noreferrer" style={{ color: C.brown }}>Full agreement</a>
        </p>
      </div>
    </div>
  )
}
