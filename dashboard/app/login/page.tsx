"use client";

import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const handleSignIn = () => {
    console.log("Sign in attempted", { email, password });
  };

  const handleContinueWithout = () => {
    window.location.href = "/admin";
  };

  const pageStyle: React.CSSProperties = {
    backgroundColor: "#080C10",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "Arial, sans-serif",
    padding: "24px",
  };

  const headerStyle: React.CSSProperties = {
    textAlign: "center",
    marginBottom: "24px",
  };

  const wordmarkStyle: React.CSSProperties = {
    fontFamily: "Arial Black, Arial, sans-serif",
    fontSize: "32px",
    fontWeight: 900,
    color: "#ffffff",
    letterSpacing: "-0.04em",
    margin: 0,
    lineHeight: 1,
  };

  const subtitleStyle: React.CSSProperties = {
    fontSize: "10px",
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.30)",
    marginTop: "8px",
    margin: "8px 0 0 0",
  };

  const dividerStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: "380px",
    height: "1px",
    backgroundColor: "rgba(255,255,255,0.08)",
    marginBottom: "24px",
  };

  const cardStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "12px",
    padding: "36px",
    maxWidth: "380px",
    width: "100%",
  };

  const cardHeadingStyle: React.CSSProperties = {
    fontSize: "18px",
    fontWeight: 700,
    color: "#ffffff",
    margin: "0 0 6px 0",
  };

  const cardSubtextStyle: React.CSSProperties = {
    fontSize: "13px",
    color: "rgba(255,255,255,0.40)",
    margin: "0 0 28px 0",
  };

  const inputStyle = (focused: boolean): React.CSSProperties => ({
    width: "100%",
    background: "rgba(255,255,255,0.06)",
    border: `1px solid ${focused ? "rgba(255,255,255,0.30)" : "rgba(255,255,255,0.10)"}`,
    borderRadius: "8px",
    padding: "12px 14px",
    color: "#ffffff",
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box",
    marginBottom: "12px",
    transition: "border-color 0.15s ease",
  });

  const signInButtonStyle: React.CSSProperties = {
    width: "100%",
    background: "linear-gradient(135deg, #D9321C, #A52010)",
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: 700,
    borderRadius: "8px",
    padding: "13px",
    border: "none",
    cursor: "pointer",
    marginTop: "4px",
    marginBottom: "20px",
  };

  const orDividerContainerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "16px",
  };

  const orDividerLineStyle: React.CSSProperties = {
    flex: 1,
    height: "1px",
    backgroundColor: "rgba(255,255,255,0.08)",
  };

  const orTextStyle: React.CSSProperties = {
    fontSize: "12px",
    color: "rgba(255,255,255,0.25)",
    flexShrink: 0,
  };

  const continueButtonStyle: React.CSSProperties = {
    width: "100%",
    background: "none",
    border: "none",
    color: "rgba(255,255,255,0.45)",
    fontSize: "13px",
    cursor: "pointer",
    textAlign: "center",
    padding: "6px 0",
  };

  const footerStyle: React.CSSProperties = {
    fontSize: "11px",
    color: "rgba(255,255,255,0.20)",
    textAlign: "center",
    paddingTop: "24px",
  };

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <p style={wordmarkStyle}>HOST</p>
        <p style={subtitleStyle}>Restaurant Operating System</p>
      </div>

      <div style={dividerStyle} />

      <div style={cardStyle}>
        <h1 style={cardHeadingStyle}>Client Portal</h1>
        <p style={cardSubtextStyle}>Sign in to your restaurant dashboard</p>

        <input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onFocus={() => setEmailFocused(true)}
          onBlur={() => setEmailFocused(false)}
          style={inputStyle(emailFocused)}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onFocus={() => setPasswordFocused(true)}
          onBlur={() => setPasswordFocused(false)}
          style={inputStyle(passwordFocused)}
        />

        <button style={signInButtonStyle} onClick={handleSignIn}>
          Sign In
        </button>

        <div style={orDividerContainerStyle}>
          <div style={orDividerLineStyle} />
          <span style={orTextStyle}>or</span>
          <div style={orDividerLineStyle} />
        </div>

        <button style={continueButtonStyle} onClick={handleContinueWithout}>
          Continue without signing in →
        </button>
      </div>

      <p style={footerStyle}>Walter&apos;s303 · Denver, CO</p>
    </div>
  );
}
