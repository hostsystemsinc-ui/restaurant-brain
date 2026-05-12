"use client"

import { useState, useRef, useEffect, useCallback, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Check, ChevronRight, AlertCircle, Loader2, ShieldCheck } from "lucide-react"
import { TERMS_SECTIONS, CURRENT_VERSION, EFFECTIVE_DATE, ENTITY_NAME } from "@/lib/terms"

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
    key:   "free",
    name:  "Free Plan",
    price: 0,
    desc:  "HOST platform + 2 NFC signs per location",
  },
  {
    key:   "single",
    name:  "Single Location",
    price: 149,
    desc:  "One restaurant location",
  },
  {
    key:   "multi",
    name:  "Multi-Location",
    price: 129,
    desc:  "Per location — 2 or more locations",
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

// ── Full contract renderer ─────────────────────────────────────────────────────
function ContractText({ version = CURRENT_VERSION, effectiveDate = EFFECTIVE_DATE }: { version?: string; effectiveDate?: string }) {
  return (
    <div style={{ fontSize: 11, lineHeight: 1.75, color: C.text2 }}>
      <p style={{ fontWeight: 900, fontSize: 13, color: C.text, marginBottom: 2 }}>
        {ENTITY_NAME.toUpperCase()} — MASTER SUBSCRIPTION AGREEMENT
      </p>
      <p style={{ fontSize: 10, color: C.muted, marginBottom: 16 }}>
        {version} · Effective {effectiveDate} · Full text: hostplatform.net/legal/terms
      </p>
      {TERMS_SECTIONS.map((section, i) => (
        <div key={i} style={{ marginBottom: 16 }}>
          <p style={{ fontWeight: 800, fontSize: 11, color: C.text, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {section.heading}
          </p>
          {section.body.split("\n\n").map((para, j) => (
            <p key={j} style={{ marginBottom: 8, fontSize: 11 }}>
              {para}
            </p>
          ))}
        </div>
      ))}
      <div style={{ marginTop: 16, padding: "12px 14px", background: "#f0f0f0", borderRadius: 8, fontSize: 10, color: C.text2 }}>
        <strong>ELECTRONIC SIGNATURE NOTICE:</strong> By signing below, you confirm you have read this entire Agreement,
        are authorized to bind your business to its terms, and agree that your typed name constitutes a legally
        binding electronic signature under the ESIGN Act (15 U.S.C. § 7001) and Colorado UETA (C.R.S. § 24-71.3-101).
      </div>
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

// ── Inner page (needs useSearchParams) ────────────────────────────────────────
function SignupInner() {
  const params = useSearchParams()

  const [step,       setStep]       = useState<1 | 2 | 3>(1)
  const [submitting, setSubmitting] = useState(false)
  const [done,       setDone]       = useState(false)
  const [error,      setError]      = useState("")

  // Step 1 — business info (pre-fillable via query params)
  const [bizName,       setBizName]       = useState(params.get("biz")  || "")
  const [ownerName,     setOwnerName]     = useState(params.get("name") || "")
  const [email,         setEmail]         = useState(params.get("email")|| "")
  const [phone,         setPhone]         = useState(params.get("phone")|| "")
  const [address,       setAddress]       = useState(params.get("addr") || "")
  const [locationCount, setLocationCount] = useState(params.get("locs") || "1")

  // Step 2 — plan (pre-fillable)
  const [plan, setPlan] = useState<"free" | "single" | "multi">(
    (params.get("plan") as "free" | "single" | "multi") || "free"
  )

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

  const monthlyFee = useCallback(() => {
    if (plan === "free")  return 0
    if (plan === "multi") return 129 * (parseInt(locationCount, 10) || 1)
    return 149
  }, [plan, locationCount])

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
          monthly_fee:    monthlyFee(),
          agreement_version: CURRENT_VERSION,
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

  const locs    = parseInt(locationCount, 10) || 1
  const monthly = monthlyFee()
  const isFree  = plan === "free"

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
            {isFree ? "Get started with HOST" : "Start your free trial"}
          </h1>
          <p style={{ fontSize: 13, color: C.text2 }}>
            {isFree ? "Free plan · 2 NFC signs included · No credit card" : "30 days free · No credit card required · Cancel anytime"}
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
                  I have read and agree to the {ENTITY_NAME} Master Subscription Agreement ({CURRENT_VERSION}).
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
                <p style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Summary</p>
                {[
                  { label: "Business",  value: bizName },
                  { label: "Plan",      value: isFree ? "Free Plan" : plan === "multi" ? `Multi-Location (${locs})` : "Single Location" },
                  { label: "Monthly",   value: isFree ? "Free" : `$${monthly}/mo after trial` },
                  ...(isFree ? [] : [{ label: "Trial", value: `Free through ${new Date(Date.now() + 30 * 86400000).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}` }]),
                  { label: "Signs",     value: `2 HOST NFC signs per location` },
                  { label: "Agreement", value: CURRENT_VERSION },
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
                  {submitting ? "Saving…" : isFree ? "Sign Agreement" : "Sign & Start Free Trial"}
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

// ── Export with Suspense boundary (required for useSearchParams) ───────────────
export default function SignupPage() {
  return (
    <Suspense>
      <SignupInner />
    </Suspense>
  )
}
