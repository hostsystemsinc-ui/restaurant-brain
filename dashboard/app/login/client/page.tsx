"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

export default function ClientPortalLogin() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError]       = useState("")
  const [loading, setLoading]   = useState(false)
  const router = useRouter()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (username === "demo" && password === "demo") {
      setLoading(true)
      sessionStorage.setItem("host_demo_authed", "1")
      router.push("/demo/station")
    } else if (username === "walters" && password === "walters303") {
      setLoading(true)
      router.push("/station")
    } else {
      setError("Incorrect username or password.")
    }
  }

  return (
    <div style={{
      background: "#0c0c0e", color: "#fff", minHeight: "100vh",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "space-between", fontFamily: "inherit",
    }}>
      <style>{`
        @keyframes fadein { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        .cp-input { transition: border-color .15s, box-shadow .15s; }
        .cp-input:focus { outline: none; border-color: rgba(255,255,255,0.3) !important; box-shadow: 0 0 0 3px rgba(255,255,255,0.05); }
        .cp-btn { transition: opacity .15s, transform .15s; }
        .cp-btn:hover:not(:disabled) { opacity: .9; transform: translateY(-1px); }
        .cp-btn:active:not(:disabled) { transform: translateY(0); }
      `}</style>

      {/* Top wordmark */}
      <div style={{ textAlign: "center", paddingTop: 64, animation: "fadein 0.5s ease both", width: "100%" }}>
        <Link href="/" style={{ textDecoration: "none" }}>
          <div style={{ fontSize: "clamp(2.4rem,6vw,3.6rem)", fontWeight: 900, letterSpacing: "-0.03em", color: "#fff", lineHeight: 1 }}>
            HOST
          </div>
        </Link>
        <div style={{ fontSize: ".65rem", fontWeight: 700, letterSpacing: ".28em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)", marginTop: 10 }}>
          Restaurant Operating System
        </div>
        <div style={{ width: 420, maxWidth: "90vw", height: 1, background: "rgba(255,255,255,0.08)", margin: "28px auto 0" }} />
      </div>

      {/* Card */}
      <div style={{ animation: "fadein 0.5s ease 0.1s both", width: "100%", maxWidth: 480, padding: "0 24px" }}>
        <div style={{
          background: "#18181b",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 20,
          padding: "40px 40px 44px",
          boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
        }}>
          <div style={{ marginBottom: 32 }}>
            <h1 style={{ fontSize: "1.6rem", fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 8 }}>
              Client Portal
            </h1>
            <p style={{ fontSize: ".88rem", color: "rgba(255,255,255,0.38)", lineHeight: 1.6 }}>
              Sign in to your restaurant dashboard
            </p>
          </div>

          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <input
              className="cp-input"
              type="text"
              placeholder="Username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              style={{
                width: "100%", background: "#232325",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 12, padding: "14px 16px",
                color: "#fff", fontSize: ".95rem",
                boxSizing: "border-box",
              }}
            />
            <input
              className="cp-input"
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              style={{
                width: "100%", background: "#232325",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 12, padding: "14px 16px",
                color: "#fff", fontSize: ".95rem",
                boxSizing: "border-box",
              }}
            />

            {error && (
              <div style={{ fontSize: ".82rem", color: "#f87171", padding: "10px 14px", background: "rgba(239,68,68,0.08)", borderRadius: 8, border: "1px solid rgba(239,68,68,0.2)" }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="cp-btn"
              style={{
                marginTop: 6,
                width: "100%", background: "#dc2626",
                color: "#fff", fontWeight: 700, fontSize: "1rem",
                padding: "15px", borderRadius: 12, border: "none",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>
        </div>

        <p style={{ textAlign: "center", marginTop: 24, fontSize: ".78rem", color: "rgba(255,255,255,0.2)" }}>
          Need access?{" "}
          <a href="mailto:demo@hostplatform.net" style={{ color: "rgba(255,255,255,0.38)", textDecoration: "underline" }}>
            Contact us
          </a>
          {" · "}
          <Link href="/login" style={{ color: "rgba(255,255,255,0.25)", textDecoration: "none" }}>
            ← Back
          </Link>
        </p>
      </div>

      {/* Footer */}
      <div style={{ padding: "28px 24px", textAlign: "center" }}>
        <span style={{ fontSize: ".76rem", color: "rgba(255,255,255,0.16)" }}>
          HOST · Restaurant Operating System · hostplatform.net
        </span>
      </div>
    </div>
  )
}
