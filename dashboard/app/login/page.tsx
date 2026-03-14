"use client"

import Link from "next/link"

export default function LoginPage() {
  return (
    <div style={{
      background: "#080A0C", color: "#fff", minHeight: "100vh",
      display: "flex", flexDirection: "column",
    }}>
      <style>{`
        .login-card {
          cursor: pointer;
          transition: border-color .18s, background .18s, transform .18s, box-shadow .18s;
        }
        .login-card:hover {
          border-color: rgba(34,197,94,0.38) !important;
          background: rgba(34,197,94,0.04) !important;
          transform: translateY(-3px);
          box-shadow: 0 24px 64px rgba(0,0,0,0.55);
        }
        .login-card:hover .card-arrow {
          color: #22c55e !important;
          transform: translateX(3px);
        }
        .card-arrow {
          transition: color .18s, transform .18s;
        }
        @keyframes fadein { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* Nav */}
      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 48px", height: 64,
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(8,10,12,0.9)", backdropFilter: "blur(20px)",
      }}>
        <Link href="/" style={{ textDecoration: "none" }}>
          <span style={{ fontWeight: 900, letterSpacing: ".22em", fontSize: ".88rem", color: "#fff" }}>HOST</span>
        </Link>
        <Link href="/" style={{ fontSize: ".82rem", color: "rgba(255,255,255,0.35)", textDecoration: "none" }}>
          ← Back to site
        </Link>
      </nav>

      {/* Main */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", padding: "60px 24px",
      }}>
        <div style={{ animation: "fadein 0.5s ease both", width: "100%", maxWidth: 560 }}>

          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.18)",
              borderRadius: 100, padding: "5px 14px", marginBottom: 24,
              fontSize: ".67rem", fontWeight: 800, letterSpacing: ".14em",
              textTransform: "uppercase", color: "#22c55e",
            }}>
              Sign in to HOST
            </div>
            <h1 style={{
              fontSize: "clamp(1.8rem,4vw,2.6rem)", fontWeight: 900,
              letterSpacing: "-0.04em", lineHeight: 1.1, marginBottom: 12,
            }}>
              Welcome back.
            </h1>
            <p style={{ fontSize: ".9rem", color: "rgba(255,255,255,0.35)", lineHeight: 1.65 }}>
              Choose how you&apos;d like to sign in.
            </p>
          </div>

          {/* Cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Restaurant login */}
            <Link href="/login/client" style={{ textDecoration: "none" }}>
              <div className="login-card" style={{
                background: "rgba(255,255,255,0.025)",
                border: "1px solid rgba(255,255,255,0.09)",
                borderRadius: 18, padding: "28px 30px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {/* Store / restaurant icon */}
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 9l1-6h16l1 6"/>
                      <path d="M3 9a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0"/>
                      <path d="M5 9v12h14V9"/>
                      <path d="M9 21v-6h6v6"/>
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: "1rem", color: "#fff", marginBottom: 5, letterSpacing: "-0.01em" }}>
                      Restaurant Login
                    </div>
                    <div style={{ fontSize: ".83rem", color: "rgba(255,255,255,0.35)", lineHeight: 1.5 }}>
                      Access your HOST dashboard, queue, and table management.
                    </div>
                  </div>
                </div>
                <div className="card-arrow" style={{ color: "rgba(255,255,255,0.25)", flexShrink: 0, marginLeft: 16 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
                  </svg>
                </div>
              </div>
            </Link>

            {/* Admin login */}
            <Link href="/login/owner" style={{ textDecoration: "none" }}>
              <div className="login-card" style={{
                background: "rgba(255,255,255,0.025)",
                border: "1px solid rgba(255,255,255,0.09)",
                borderRadius: 18, padding: "28px 30px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                    background: "rgba(34,197,94,0.06)",
                    border: "1px solid rgba(34,197,94,0.16)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {/* Shield / admin icon */}
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(34,197,94,0.8)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V7L12 2z"/>
                      <polyline points="9 12 11 14 15 10"/>
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: "1rem", color: "#fff", marginBottom: 5, letterSpacing: "-0.01em" }}>
                      HOST Admin
                    </div>
                    <div style={{ fontSize: ".83rem", color: "rgba(255,255,255,0.35)", lineHeight: 1.5 }}>
                      View all restaurants, demo requests, and platform activity.
                    </div>
                  </div>
                </div>
                <div className="card-arrow" style={{ color: "rgba(255,255,255,0.25)", flexShrink: 0, marginLeft: 16 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
                  </svg>
                </div>
              </div>
            </Link>

          </div>

          {/* Footer note */}
          <p style={{ textAlign: "center", fontSize: ".77rem", color: "rgba(255,255,255,0.18)", marginTop: 36 }}>
            Need access?{" "}
            <a href="mailto:hello@hostplatform.net" style={{ color: "rgba(255,255,255,0.32)", textDecoration: "underline" }}>
              Contact us
            </a>
          </p>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: "20px 48px", borderTop: "1px solid rgba(255,255,255,0.06)", textAlign: "center" }}>
        <span style={{ fontWeight: 900, letterSpacing: ".22em", fontSize: ".78rem", color: "rgba(255,255,255,0.35)" }}>HOST</span>
        <span style={{ fontSize: ".78rem", color: "rgba(255,255,255,0.18)", marginLeft: 7 }}>· a smarter waitlist</span>
      </div>
    </div>
  )
}
