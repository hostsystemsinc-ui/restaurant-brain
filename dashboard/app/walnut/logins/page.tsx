"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Delete, Eye, EyeOff, ArrowLeft, Check, AlertCircle } from "lucide-react"

const LOGO = "https://images.getbento.com/accounts/d2ce1ba3bfb5b87e1f0ba2897a682acb/media/images/28198New_Walnut_Logo.png"

const C = {
  bg:      "#F8FAFC",
  surface: "#FFFFFF",
  border:  "#E2E8F0",
  text:    "#0F172A",
  text2:   "#475569",
  muted:   "#94A3B8",
  green:   "#16A34A",
  greenBg: "#F0FDF4",
  red:     "#DC2626",
  redBg:   "#FEF2F2",
  blue:    "#2563EB",
  blueBg:  "#EFF6FF",
}

// ── PIN Screen (reused here) ───────────────────────────────────────────────────

function PinScreen({ onSuccess }: { onSuccess: () => void }) {
  const [digits, setDigits]   = useState<string[]>([])
  const [error,  setError]    = useState("")
  const [loading, setLoading] = useState(false)
  const [shake,  setShake]    = useState(false)

  const verifyPin = useCallback(async (pin: string) => {
    setLoading(true)
    try {
      const r = await fetch("/api/walnut/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      })
      const d = await r.json()
      if (d.ok) {
        onSuccess()
      } else {
        setShake(true)
        setTimeout(() => setShake(false), 600)
        setError("Incorrect PIN")
        setDigits([])
      }
    } catch {
      setError("Connection error — try again")
      setDigits([])
    } finally {
      setLoading(false)
    }
  }, [onSuccess])

  const addDigit = useCallback((d: string) => {
    if (loading) return
    setError("")
    setDigits(prev => {
      if (prev.length >= 4) return prev
      const next = [...prev, d]
      if (next.length === 4) verifyPin(next.join(""))
      return next
    })
  }, [loading, verifyPin])

  const backspace = useCallback(() => {
    if (loading) return
    setError("")
    setDigits(prev => prev.slice(0, -1))
  }, [loading])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") addDigit(e.key)
      else if (e.key === "Backspace") backspace()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [addDigit, backspace])

  const PAD = [["1","2","3"],["4","5","6"],["7","8","9"],["","0","⌫"]]

  return (
    <div style={{ minHeight: "100dvh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-geist), system-ui, -apple-system, sans-serif" }}>
      <div style={{
        width: "100%", maxWidth: 340, padding: "40px 32px",
        background: C.surface, borderRadius: 24, boxShadow: "0 8px 40px rgba(0,0,0,0.08)", border: `1px solid ${C.border}`,
        transform: shake ? "translateX(-4px)" : "none", transition: "transform 0.06s",
      }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 28 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} alt="Walnut Cafe" style={{ height: 40, objectFit: "contain", marginBottom: 10 }} />
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: C.muted }}>Logins & Credentials</p>
          <p style={{ fontSize: 13, color: C.text2, marginTop: 4 }}>Enter your admin PIN to continue</p>
        </div>
        <div style={{ display: "flex", gap: 14, justifyContent: "center", marginBottom: 28 }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{ width: 18, height: 18, borderRadius: "50%", background: digits.length > i ? C.text : "transparent", border: `2px solid ${error ? C.red : digits.length > i ? C.text : C.border}`, transition: "background 0.1s, border-color 0.2s" }} />
          ))}
        </div>
        {error && <p style={{ textAlign: "center", fontSize: 12, color: C.red, fontWeight: 600, marginBottom: 16, marginTop: -12 }}>{error}</p>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {PAD.flat().map((d, i) => (
            <button key={i} onClick={() => d === "⌫" ? backspace() : d ? addDigit(d) : undefined} disabled={loading || (!d && d !== "0")}
              style={{ height: 64, borderRadius: 14, fontSize: d === "⌫" ? 20 : 24, fontWeight: 600, background: d === "⌫" ? "rgba(220,38,38,0.05)" : d ? C.bg : "transparent", border: d === "⌫" ? `1px solid rgba(220,38,38,0.15)` : d ? `1px solid ${C.border}` : "none", color: d === "⌫" ? C.red : d ? C.text : "transparent", cursor: d ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", opacity: loading ? 0.5 : 1 }}>
              {d === "⌫" ? <Delete size={18} /> : d}
            </button>
          ))}
        </div>
        {loading && <p style={{ textAlign: "center", fontSize: 12, color: C.muted, marginTop: 16 }}>Verifying…</p>}
      </div>
    </div>
  )
}

// ── Password field with show/hide toggle ──────────────────────────────────────

function PasswordField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "0 12px" }}>
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? "New password"}
        autoComplete="new-password"
        style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 14, color: C.text, padding: "12px 0" }}
      />
      <button onClick={() => setShow(s => !s)} style={{ border: "none", background: "transparent", cursor: "pointer", color: C.muted, display: "flex", alignItems: "center", padding: 0 }}>
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  )
}

// ── Section card ─────────────────────────────────────────────────────────────

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: "22px 24px", marginBottom: 16 }}>
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{title}</p>
        {subtitle && <p style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

// ── Result message ────────────────────────────────────────────────────────────

function ResultMsg({ result }: { result: { ok: boolean; msg: string } | null }) {
  if (!result) return null
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, padding: "8px 12px", borderRadius: 8, background: result.ok ? C.greenBg : C.redBg, border: `1px solid ${result.ok ? "#BBF7D0" : "#FECACA"}` }}>
      {result.ok
        ? <Check size={14} style={{ color: C.green, flexShrink: 0 }} />
        : <AlertCircle size={14} style={{ color: C.red, flexShrink: 0 }} />
      }
      <span style={{ fontSize: 12, fontWeight: 600, color: result.ok ? C.green : C.red }}>{result.msg}</span>
    </div>
  )
}

// ── Logins Page ───────────────────────────────────────────────────────────────

export default function LoginsPage() {
  const [pinOk,      setPinOk]      = useState<boolean | null>(null)

  // PIN change
  const [newPin,     setNewPin]     = useState<string[]>([])
  const [pinResult,  setPinResult]  = useState<{ ok: boolean; msg: string } | null>(null)
  const [pinStep,    setPinStep]    = useState<"entry" | "confirm">("entry")
  const [pinFirst,   setPinFirst]   = useState<string>("")

  // Password change state per account
  const [origPw,     setOrigPw]     = useState("")
  const [sidePw,     setSidePw]     = useState("")
  const [walnutPw,   setWalnutPw]   = useState("")
  const [origResult, setOrigResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [sideResult, setSideResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [walnutResult, setWalnutResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [saving,     setSaving]     = useState<string | null>(null)

  // Check PIN cookie on mount
  useEffect(() => {
    fetch("/api/walnut/check-pin")
      .then(r => r.ok ? r.json() : { ok: false })
      .then(d => setPinOk(!!d.ok))
      .catch(() => setPinOk(false))
  }, [])

  const savePassword = async (account: string, password: string, setResult: (r: { ok: boolean; msg: string }) => void) => {
    setSaving(account)
    try {
      const r = await fetch("/api/walnut/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account, password }),
      })
      const d = await r.json()
      if (d.ok) {
        setResult({ ok: true, msg: "Password updated successfully" })
      } else {
        setResult({ ok: false, msg: d.error ?? "Failed to update password" })
      }
    } catch {
      setResult({ ok: false, msg: "Connection error" })
    } finally {
      setSaving(null)
    }
  }

  // ── PIN setting UI ─────────────────────────────────────────────────────────
  const addPinDigit = (d: string) => {
    if (newPin.length >= 4) return
    const next = [...newPin, d]
    setNewPin(next)

    if (next.length === 4) {
      const entered = next.join("")
      if (pinStep === "entry") {
        setPinFirst(entered)
        setPinStep("confirm")
        setNewPin([])
      } else {
        // Confirm step
        if (entered === pinFirst) {
          // Save
          fetch("/api/walnut/set-pin", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pin: entered }),
          })
            .then(r => r.json())
            .then(d => {
              if (d.ok) {
                setPinResult({ ok: true, msg: "PIN updated successfully" })
              } else {
                setPinResult({ ok: false, msg: d.error ?? "Failed to update PIN" })
              }
              setPinStep("entry")
              setNewPin([])
              setPinFirst("")
            })
            .catch(() => {
              setPinResult({ ok: false, msg: "Connection error" })
              setPinStep("entry")
              setNewPin([])
              setPinFirst("")
            })
        } else {
          setPinResult({ ok: false, msg: "PINs don't match — try again" })
          setPinStep("entry")
          setNewPin([])
          setPinFirst("")
        }
      }
    }
  }

  const backspacePinDigit = () => setNewPin(prev => prev.slice(0, -1))

  const PAD = [["1","2","3"],["4","5","6"],["7","8","9"],["","0","⌫"]]

  // ── Loading / PIN gate ──────────────────────────────────────────────────────
  if (pinOk === null) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 13, color: C.muted }}>Loading…</div>
      </div>
    )
  }

  if (!pinOk) {
    return <PinScreen onSuccess={() => setPinOk(true)} />
  }

  // ── Logins page content ────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "var(--font-geist), system-ui, -apple-system, sans-serif", color: C.text }}>

      {/* Header */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 28px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Link href="/walnut/dashboard" style={{ display: "flex", alignItems: "center", gap: 6, color: C.text2, textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
            <ArrowLeft size={15} /> Dashboard
          </Link>
          <div style={{ width: 1, height: 20, background: C.border }} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} alt="Walnut Cafe" style={{ height: 28, objectFit: "contain" }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Logins & Credentials</span>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "28px 24px 60px" }}>

        {/* ── Admin PIN ── */}
        <Section
          title="Admin PIN"
          subtitle="4-digit PIN required to access this dashboard from any HOST station."
        >
          <div style={{ marginBottom: 10 }}>
            <p style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>
              {pinStep === "entry" ? "Enter a new 4-digit PIN:" : "Confirm your new PIN:"}
            </p>
            {/* PIN dots */}
            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
              {[0,1,2,3].map(i => (
                <div key={i} style={{ width: 16, height: 16, borderRadius: "50%", background: newPin.length > i ? C.text : "transparent", border: `2px solid ${newPin.length > i ? C.text : C.border}`, transition: "background 0.1s" }} />
              ))}
              <span style={{ fontSize: 12, color: C.muted, marginLeft: 8, alignSelf: "center" }}>
                {pinStep === "confirm" ? "Confirm PIN" : ""}
              </span>
            </div>
            {/* Compact numpad */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6, maxWidth: 300 }}>
              {PAD.flat().map((d, i) => (
                <button key={i} onClick={() => d === "⌫" ? backspacePinDigit() : d ? addPinDigit(d) : undefined} disabled={!d && d !== "0"}
                  style={{ height: 44, borderRadius: 10, fontSize: d === "⌫" ? 16 : 18, fontWeight: 600, background: d === "⌫" ? "rgba(220,38,38,0.05)" : d ? C.bg : "transparent", border: d === "⌫" ? `1px solid rgba(220,38,38,0.15)` : d ? `1px solid ${C.border}` : "none", color: d === "⌫" ? C.red : d ? C.text : "transparent", cursor: d ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {d === "⌫" ? <Delete size={14} /> : d}
                </button>
              ))}
            </div>
          </div>
          {pinStep === "confirm" && (
            <button onClick={() => { setPinStep("entry"); setNewPin([]); setPinFirst("") }}
              style={{ fontSize: 12, color: C.muted, background: "none", border: "none", cursor: "pointer", padding: 0, marginTop: 4 }}>
              ← Start over
            </button>
          )}
          <ResultMsg result={pinResult} />
        </Section>

        {/* ── Original Restaurant ── */}
        <Section
          title="The Original Walnut Cafe"
          subtitle={<>Login username: <strong style={{ color: C.text }}>original</strong></>  as unknown as string}
        >
          <div style={{ marginBottom: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.text2, display: "block", marginBottom: 6 }}>New Password</label>
            <PasswordField value={origPw} onChange={setOrigPw} placeholder="Enter new password" />
          </div>
          <button
            onClick={() => { setOrigResult(null); savePassword("original", origPw, setOrigResult) }}
            disabled={!origPw.trim() || saving === "original"}
            style={{ marginTop: 12, padding: "10px 20px", borderRadius: 10, background: origPw.trim() ? C.blue : C.bg, color: origPw.trim() ? "white" : C.muted, border: `1px solid ${origPw.trim() ? C.blue : C.border}`, fontWeight: 600, fontSize: 13, cursor: origPw.trim() ? "pointer" : "default", transition: "all 0.15s", opacity: saving === "original" ? 0.6 : 1 }}>
            {saving === "original" ? "Saving…" : "Update Password"}
          </button>
          <ResultMsg result={origResult} />
        </Section>

        {/* ── Southside Restaurant ── */}
        <Section
          title="The Southside Walnut Cafe"
          subtitle={<>Login username: <strong style={{ color: C.text }}>southside</strong></> as unknown as string}
        >
          <div style={{ marginBottom: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.text2, display: "block", marginBottom: 6 }}>New Password</label>
            <PasswordField value={sidePw} onChange={setSidePw} placeholder="Enter new password" />
          </div>
          <button
            onClick={() => { setSideResult(null); savePassword("southside", sidePw, setSideResult) }}
            disabled={!sidePw.trim() || saving === "southside"}
            style={{ marginTop: 12, padding: "10px 20px", borderRadius: 10, background: sidePw.trim() ? C.blue : C.bg, color: sidePw.trim() ? "white" : C.muted, border: `1px solid ${sidePw.trim() ? C.blue : C.border}`, fontWeight: 600, fontSize: 13, cursor: sidePw.trim() ? "pointer" : "default", transition: "all 0.15s", opacity: saving === "southside" ? 0.6 : 1 }}>
            {saving === "southside" ? "Saving…" : "Update Password"}
          </button>
          <ResultMsg result={sideResult} />
        </Section>

        {/* ── Walnut Owner Account ── */}
        <Section
          title="Walnut Owner Account"
          subtitle={<>Login username: <strong style={{ color: C.text }}>walnut</strong> — used for the unified HOST station</> as unknown as string}
        >
          <div style={{ marginBottom: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.text2, display: "block", marginBottom: 6 }}>New Password</label>
            <PasswordField value={walnutPw} onChange={setWalnutPw} placeholder="Enter new password" />
          </div>
          <button
            onClick={() => { setWalnutResult(null); savePassword("walnut", walnutPw, setWalnutResult) }}
            disabled={!walnutPw.trim() || saving === "walnut"}
            style={{ marginTop: 12, padding: "10px 20px", borderRadius: 10, background: walnutPw.trim() ? C.blue : C.bg, color: walnutPw.trim() ? "white" : C.muted, border: `1px solid ${walnutPw.trim() ? C.blue : C.border}`, fontWeight: 600, fontSize: 13, cursor: walnutPw.trim() ? "pointer" : "default", transition: "all 0.15s", opacity: saving === "walnut" ? 0.6 : 1 }}>
            {saving === "walnut" ? "Saving…" : "Update Password"}
          </button>
          <ResultMsg result={walnutResult} />
        </Section>

        <div style={{ marginTop: 24, padding: "16px 20px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 12 }}>
          <p style={{ fontSize: 12, color: "#92400E", fontWeight: 600, marginBottom: 4 }}>⚠️ Note about passwords</p>
          <p style={{ fontSize: 12, color: "#B45309" }}>
            Password changes take effect immediately on this server. If the server restarts after a deployment, passwords revert to their original values until updated again here.
          </p>
        </div>
      </div>
    </div>
  )
}
