"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

export default function OwnerConsoleLogin() {
  const [password, setPassword]   = useState("")
  const [showPass, setShowPass]   = useState(false)
  const [loading, setLoading]     = useState(false)
  const router = useRouter()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    router.push("/admin")
  }

  return (
    <div style={{
      background: "#0a0a0a", color: "#fff", minHeight: "100vh",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "inherit", position: "relative", overflow: "hidden",
    }}>
      <style>{`
        @keyframes fadein { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }

        /* subtle dot grid */
        .oc-bg::before {
          content: "";
          position: absolute; inset: 0;
          background-image: radial-gradient(circle, rgba(255,255,255,0.055) 1px, transparent 1px);
          background-size: 36px 36px;
          pointer-events: none;
        }

        .oc-input { transition: border-color .15s, box-shadow .15s; }
        .oc-input:focus { outline: none; border-color: rgba(255,255,255,0.28) !important; box-shadow: 0 0 0 3px rgba(255,255,255,0.05); }
        .oc-btn { transition: opacity .15s, transform .15s; }
        .oc-btn:hover:not(:disabled) { opacity: .9; transform: translateY(-1px); }
        .oc-btn:active:not(:disabled) { transform: translateY(0); }
        .oc-back { transition: color .15s; }
        .oc-back:hover { color: rgba(255,255,255,0.55) !important; }
      `}</style>

      {/* Dot grid layer */}
      <div className="oc-bg" style={{ position: "absolute", inset: 0 }} />

      {/* Card */}
      <div style={{
        position: "relative", zIndex: 1,
        width: "100%", maxWidth: 480, margin: "0 24px",
        background: "#181818",
        border: "1px solid rgba(255,255,255,0.09)",
        borderRadius: 22,
        padding: "52px 44px 44px",
        boxShadow: "0 48px 120px rgba(0,0,0,0.75), 0 0 0 0.5px rgba(255,255,255,0.06)",
        animation: "fadein 0.45s ease both",
      }}>

        {/* Wordmark */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Link href="/" style={{ textDecoration: "none" }}>
            <div style={{ fontSize: "2.2rem", fontWeight: 900, letterSpacing: "-0.02em", color: "#fff", lineHeight: 1 }}>
              HOST
            </div>
          </Link>
          <div style={{ fontSize: ".62rem", fontWeight: 700, letterSpacing: ".3em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginTop: 8 }}>
            Owner Console
          </div>
          <div style={{ width: 36, height: 1, background: "rgba(255,255,255,0.14)", margin: "18px auto 0" }} />
        </div>

        {/* Form */}
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <div style={{ fontSize: ".65rem", fontWeight: 800, letterSpacing: ".2em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 10 }}>
              Access Password
            </div>
            <div style={{ position: "relative" }}>
              {/* Key icon */}
              <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.3)", pointerEvents: "none" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>
                </svg>
              </div>
              <input
                className="oc-input"
                type={showPass ? "text" : "password"}
                placeholder="Enter password…"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                style={{
                  width: "100%", background: "#232323",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 12, padding: "14px 48px 14px 42px",
                  color: "#fff", fontSize: ".95rem",
                  fontFamily: "monospace", letterSpacing: showPass ? "normal" : "0.1em",
                  boxSizing: "border-box",
                }}
              />
              {/* Eye toggle */}
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", padding: 0, display: "flex" }}
              >
                {showPass ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="oc-btn"
            style={{
              marginTop: 4,
              width: "100%", background: "#dc2626",
              color: "#fff", fontWeight: 700, fontSize: "1rem",
              padding: "15px", borderRadius: 12, border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            {loading ? "Verifying…" : (
              <>
                Access Console
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
                </svg>
              </>
            )}
          </button>
        </form>

        {/* Back link */}
        <div style={{ textAlign: "center", marginTop: 28 }}>
          <Link href="/login" className="oc-back" style={{ fontSize: ".82rem", color: "rgba(255,255,255,0.25)", textDecoration: "none" }}>
            ← Back to HOST
          </Link>
        </div>
      </div>
    </div>
  )
}
