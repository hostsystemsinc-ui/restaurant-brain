"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Delete, X, Plus, ToggleLeft, ToggleRight, Check, ArrowLeft } from "lucide-react"

const API  = "https://restaurant-brain-production.up.railway.app"
const LOGO = "https://images.getbento.com/accounts/d2ce1ba3bfb5b87e1f0ba2897a682acb/media/images/28198New_Walnut_Logo.png"

const C = {
  bg:       "#F8FAFC",
  surface:  "#FFFFFF",
  border:   "#E2E8F0",
  text:     "#0F172A",
  text2:    "#475569",
  muted:    "#94A3B8",
  green:    "#16A34A",
  greenBg:  "#F0FDF4",
  red:      "#DC2626",
  redBg:    "#FEF2F2",
  blue:     "#2563EB",
  blueBg:   "#EFF6FF",
  blueBorder: "#BFDBFE",
}

const RESTAURANTS = [
  {
    key:   "original",
    name:  "The Original",
    short: "Original",
    rid:   "0001cafe-0001-4000-8000-000000000001",
    color: "#7C5B3A",
  },
  {
    key:   "southside",
    name:  "The Southside",
    short: "Southside",
    rid:   "0002cafe-0001-4000-8000-000000000002",
    color: "#3A6B5B",
  },
] as const

interface SectionsConfig { enabled: boolean; sections: string[] }

// ── PIN Screen ─────────────────────────────────────────────────────────────────
function PinScreen({ onSuccess }: { onSuccess: () => void }) {
  const [digits,  setDigits]  = useState<string[]>([])
  const [error,   setError]   = useState("")
  const [loading, setLoading] = useState(false)
  const [shake,   setShake]   = useState(false)

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
    <div style={{ minHeight: "100dvh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{
        width: "100%", maxWidth: 340, padding: "40px 32px",
        background: C.surface, borderRadius: 24, boxShadow: "0 8px 40px rgba(0,0,0,0.08)",
        border: `1px solid ${C.border}`,
        transform: shake ? "translateX(-4px)" : "none", transition: "transform 0.06s",
      }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 28 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} alt="Walnut Cafe" style={{ height: 44, objectFit: "contain", marginBottom: 12 }} />
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: C.muted }}>
            Sections Settings
          </p>
          <p style={{ fontSize: 13, color: C.text2, marginTop: 4 }}>Enter your 4-digit PIN</p>
        </div>
        <div style={{ display: "flex", gap: 14, justifyContent: "center", marginBottom: 28 }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{
              width: 18, height: 18, borderRadius: "50%",
              background: digits.length > i ? C.text : "transparent",
              border: `2px solid ${error ? C.red : digits.length > i ? C.text : C.border}`,
              transition: "background 0.1s",
            }} />
          ))}
        </div>
        {error && <p style={{ textAlign: "center", fontSize: 12, color: C.red, fontWeight: 600, marginBottom: 16, marginTop: -12 }}>{error}</p>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {PAD.flat().map((d, i) => (
            <button key={i}
              onClick={() => d === "⌫" ? backspace() : d ? addDigit(d) : undefined}
              disabled={loading || (!d && d !== "0")}
              style={{
                height: 64, borderRadius: 14, fontSize: d === "⌫" ? 20 : 24, fontWeight: 600,
                background: d === "⌫" ? "rgba(220,38,38,0.05)" : d ? C.bg : "transparent",
                border: d === "⌫" ? "1px solid rgba(220,38,38,0.15)" : d ? `1px solid ${C.border}` : "none",
                color: d === "⌫" ? C.red : d ? C.text : "transparent",
                cursor: d ? "pointer" : "default",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background 0.1s", opacity: loading ? 0.5 : 1,
              }}
            >
              {d === "⌫" ? <Delete size={18} /> : d}
            </button>
          ))}
        </div>
        {loading && <p style={{ textAlign: "center", fontSize: 12, color: C.muted, marginTop: 16 }}>Verifying…</p>}
        <div style={{ marginTop: 20, textAlign: "center" }}>
          <Link href="/walnut/dashboard" style={{ fontSize: 12, color: C.muted, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: 8, border: `1px solid ${C.border}` }}>
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}

// ── Restaurant Sections Panel ──────────────────────────────────────────────────
function RestaurantSectionsPanel({ rid, color, name }: { rid: string; color: string; name: string }) {
  const [config,   setConfig]   = useState<SectionsConfig>({ enabled: false, sections: [] })
  const [loaded,   setLoaded]   = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [newName,  setNewName]  = useState("")

  useEffect(() => {
    fetch(`${API}/sections?restaurant_id=${rid}`)
      .then(r => r.json())
      .then(d => { setConfig(d); setLoaded(true) })
      .catch(() => setLoaded(true))
  }, [rid])

  const save = async (cfg: SectionsConfig) => {
    setSaving(true); setSaved(false)
    try {
      await fetch(`${API}/sections?restaurant_id=${rid}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const toggle = () => {
    const next = { ...config, enabled: !config.enabled }
    setConfig(next)
    save(next)
  }

  const addSection = () => {
    const name = newName.trim()
    if (!name || config.sections.includes(name)) return
    const next = { ...config, sections: [...config.sections, name] }
    setConfig(next)
    setNewName("")
    save(next)
  }

  const removeSection = (s: string) => {
    const next = { ...config, sections: config.sections.filter(x => x !== s) }
    setConfig(next)
    save(next)
  }

  if (!loaded) {
    return <div style={{ padding: "20px 0", color: C.muted, fontSize: 13 }}>Loading…</div>
  }

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: "20px 24px", marginBottom: 20 }}>
      {/* Header + toggle */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color, marginBottom: 2 }}>
            {name}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
            Section Requests
          </div>
        </div>
        <button onClick={toggle} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 10, border: `1px solid ${config.enabled ? color + "60" : C.border}`, background: config.enabled ? color + "10" : C.bg, cursor: "pointer", fontSize: 13, fontWeight: 600, color: config.enabled ? color : C.text2, transition: "all .15s" }}>
          {config.enabled
            ? <><ToggleRight size={18} /> Enabled</>
            : <><ToggleLeft size={18} /> Disabled</>
          }
        </button>
      </div>

      {/* Description */}
      <p style={{ fontSize: 13, color: C.text2, marginBottom: 18, lineHeight: 1.6 }}>
        When enabled, guests can choose a preferred seating section on the join page. The queue splits into per-section groups on the host station.
      </p>

      {/* Sections list */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted, marginBottom: 10 }}>
          Sections
        </div>
        {config.sections.length === 0 && (
          <div style={{ fontSize: 13, color: C.muted, padding: "12px 0", fontStyle: "italic" }}>
            No sections added yet. Add your first one below.
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {config.sections.map(s => (
            <div key={s} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{s}</span>
              <button onClick={() => removeSection(s)} style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: C.muted }}>
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Add new section */}
      <div style={{ display: "flex", gap: 8 }}>
        <input
          placeholder="e.g. Outside, Bar, Main Floor"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && addSection()}
          style={{ flex: 1, padding: "9px 13px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 13, color: C.text, background: C.bg, outline: "none" }}
        />
        <button onClick={addSection} disabled={!newName.trim()}
          style={{ padding: "9px 16px", borderRadius: 10, border: "none", background: newName.trim() ? color : C.border, color: "#fff", fontWeight: 700, fontSize: 13, cursor: newName.trim() ? "pointer" : "default", display: "flex", alignItems: "center", gap: 6, transition: "background .15s" }}>
          <Plus size={14} /> Add
        </button>
      </div>

      {/* Save status */}
      {(saving || saved) && (
        <div style={{ marginTop: 12, fontSize: 12, color: saved ? C.green : C.muted, display: "flex", alignItems: "center", gap: 6 }}>
          {saved ? <><Check size={13} /> Saved</> : "Saving…"}
        </div>
      )}
    </div>
  )
}

const SESSION_KEY = "walnut_sections_authed"

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SectionsPage() {
  const [authed, setAuthed] = useState(false)

  // Restore auth from sessionStorage so navigating away and back doesn't re-prompt
  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY) === "1") setAuthed(true)
  }, [])

  function handlePinSuccess() {
    sessionStorage.setItem(SESSION_KEY, "1")
    setAuthed(true)
  }

  if (!authed) return <PinScreen onSuccess={handlePinSuccess} />

  return (
    <div style={{ minHeight: "100dvh", background: C.bg, fontFamily: "var(--font-geist), system-ui, -apple-system, sans-serif" }}>
      {/* Header */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 28px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} alt="Walnut Cafe" style={{ height: 32, objectFit: "contain" }} />
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: C.text, lineHeight: 1.2 }}>The Walnut Cafe</p>
            <p style={{ fontSize: 10, color: C.muted }}>Sections Settings</p>
          </div>
        </div>
        <Link href="/walnut/dashboard" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: C.text2, padding: "7px 14px", borderRadius: 8, border: `1px solid ${C.border}`, textDecoration: "none" }}>
          <ArrowLeft size={13} /> Dashboard
        </Link>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "32px 28px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 6 }}>Section Requests</h1>
        <p style={{ fontSize: 14, color: C.text2, marginBottom: 32, lineHeight: 1.6 }}>
          Configure seating sections for each location. Guests can select their preferred section when joining the waitlist, and the host station queue splits by section automatically.
        </p>
        {RESTAURANTS.map(r => (
          <RestaurantSectionsPanel key={r.rid} rid={r.rid} color={r.color} name={r.name} />
        ))}
      </div>
    </div>
  )
}
