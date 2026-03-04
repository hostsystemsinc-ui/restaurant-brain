"use client"

export default function HostPortalPage() {
  return (
    <div style={{
      background: "#080C10",
      height: "100vh",
      overflow: "hidden",
      fontFamily: "Arial, sans-serif",
      display: "flex",
      flexDirection: "column",
    }}>

      {/* ── NAV ── */}
      <nav style={{
        height: 68,
        padding: "0 48px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        flexShrink: 0,
      }}>

        {/* Wordmark */}
        <span style={{
          fontFamily: "Arial Black, Arial, sans-serif",
          fontSize: 26,
          fontWeight: 900,
          color: "#ffffff",
          letterSpacing: "-0.04em",
        }}>
          HOST
        </span>

        {/* Portal buttons */}
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>

          <a href="/login" style={{
            padding: "10px 24px",
            borderRadius: 8,
            border: "1.5px solid rgba(255,255,255,0.20)",
            color: "rgba(255,255,255,0.80)",
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
            background: "transparent",
            letterSpacing: "0.01em",
            transition: "border-color 0.15s, color 0.15s",
          }}>
            Client Portal
          </a>

          <a href="/owner" style={{
            padding: "10px 24px",
            borderRadius: 8,
            border: "1.5px solid rgba(217,50,28,0.55)",
            color: "#D9321C",
            fontSize: 13,
            fontWeight: 700,
            textDecoration: "none",
            background: "rgba(217,50,28,0.07)",
            letterSpacing: "0.01em",
            transition: "background 0.15s",
          }}>
            HOST Team
          </a>

        </div>
      </nav>

      {/* ── GHOST WORDMARK (decorative background) ── */}
      <div style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        userSelect: "none",
        overflow: "hidden",
      }}>
        <span style={{
          fontFamily: "Arial Black, Arial, sans-serif",
          fontSize: "clamp(100px, 22vw, 300px)",
          fontWeight: 900,
          color: "rgba(255,255,255,0.025)",
          letterSpacing: "-0.05em",
          lineHeight: 1,
        }}>
          HOST
        </span>
      </div>

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        a:hover { opacity: 0.75; }
      `}</style>
    </div>
  )
}
