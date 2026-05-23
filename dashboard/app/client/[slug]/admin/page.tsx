"use client"

import { useState, useEffect, useCallback, useRef, Suspense } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  RefreshCw, Wifi, WifiOff, Users, Clock, CheckCircle2, BarChart2, ChevronLeft,
} from "lucide-react"

const API = "https://restaurant-brain-production.up.railway.app"

// ── Color system (light) ──────────────────────────────────────────────────────
const C = {
  bg:        "#f5f6f8",
  surface:   "#ffffff",
  surface2:  "#f0f1f3",
  border:    "rgba(0,0,0,0.09)",
  text:      "#111827",
  text2:     "#374151",
  muted:     "#9ca3af",
  green:     "#16a34a",
  greenBg:   "rgba(22,163,74,0.08)",
  greenBdr:  "rgba(22,163,74,0.22)",
  orange:    "#ea580c",
  orangeBg:  "rgba(234,88,12,0.08)",
  orangeBdr: "rgba(234,88,12,0.22)",
  red:       "#dc2626",
  redBg:     "rgba(220,38,38,0.08)",
  redBdr:    "rgba(220,38,38,0.22)",
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface QueueEntry {
  id: string
  name: string
  party_size: number
  status: "waiting" | "ready" | "seated" | "removed"
  arrival_time: string
  quoted_wait: number | null
}

interface TableRow {
  id: string
  table_number: string | number
  capacity: number
  status: "available" | "occupied" | "reserved"
}

interface HistoryEntry {
  id: string
  name: string
  party_size: number
  status: "seated" | "removed"
  arrival_time: string
  quoted_wait: number | null
  updated_at?: string
}

interface Insights {
  avg_wait_estimate?: number
  parties_waiting?: number
  available_tables?: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getBusinessDateStr(): string {
  const now = new Date()
  if (now.getHours() < 3) now.setDate(now.getDate() - 1)
  return now.toLocaleDateString("en-CA")
}

function parseUTCMs(ts: string | null | undefined): number | null {
  if (!ts) return null
  const s = ts.endsWith("Z") || /[+-]\d{2}:?\d{2}$/.test(ts)
    ? ts
    : ts.replace(" ", "T") + "Z"
  const ms = new Date(s).getTime()
  return isNaN(ms) ? null : ms
}

function timeWaiting(iso: string): string {
  const diff = Math.floor((Date.now() - (parseUTCMs(iso) ?? Date.now())) / 1000)
  if (diff < 60)   return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso.endsWith("Z") ? iso : iso + "Z")
      .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
  } catch { return "—" }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon, label, value, sub, color, bg, bdr,
}: {
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>
  label: string
  value: string | number
  sub: string
  color: string
  bg: string
  bdr: string
}) {
  return (
    <div style={{
      background: bg, border: `1px solid ${bdr}`, borderRadius: 14,
      padding: "16px 18px", display: "flex", flexDirection: "column", gap: 4,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
        <Icon size={12} style={{ color, flexShrink: 0 }} />
        <span style={{ fontSize: 10, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: ".06em" }}>
          {label}
        </span>
      </div>
      <p style={{ fontSize: 30, fontWeight: 900, color, lineHeight: 1 }}>{value}</p>
      <p style={{ fontSize: 11, color, opacity: 0.55 }}>{sub}</p>
    </div>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      fontSize: 11, fontWeight: 800, letterSpacing: "0.18em",
      textTransform: "uppercase", color: C.muted, marginBottom: 12,
    }}>
      {children}
    </h2>
  )
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`,
      borderRadius: 16, padding: "20px 22px", ...style,
    }}>
      {children}
    </div>
  )
}

// ── Queue section ─────────────────────────────────────────────────────────────

function QueueSection({ queue }: { queue: QueueEntry[] }) {
  const active = queue.filter(e => e.status === "waiting" || e.status === "ready")
  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <SectionHeading>Queue</SectionHeading>
        {active.length > 0 && (
          <span style={{
            fontSize: 11, fontWeight: 800, padding: "2px 10px", borderRadius: 20,
            background: C.orangeBg, color: C.orange, border: `1px solid ${C.orangeBdr}`,
          }}>
            {active.length} waiting
          </span>
        )}
      </div>
      {active.length === 0 ? (
        <p style={{ fontSize: 13, color: C.muted, fontStyle: "italic", textAlign: "center", padding: "20px 0" }}>
          No parties in queue
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {active.map((e, i) => {
            const isReady = e.status === "ready"
            return (
              <div key={e.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 14px", borderRadius: 12,
                background: isReady ? C.greenBg : C.surface2,
                border: `1px solid ${isReady ? C.greenBdr : C.border}`,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{
                    width: 24, height: 24, borderRadius: "50%",
                    background: isReady ? C.green : "rgba(255,190,110,0.20)",
                    color: isReady ? "#fff" : C.muted,
                    fontSize: 10, fontWeight: 800,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>{i + 1}</span>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{e.name || "Guest"}</p>
                    <p style={{ fontSize: 11, color: C.muted }}>
                      Party of {e.party_size} · waiting {timeWaiting(e.arrival_time)}
                      {e.quoted_wait != null ? ` · ${e.quoted_wait}m quoted` : ""}
                    </p>
                  </div>
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase",
                  color: isReady ? C.green : C.orange,
                }}>
                  {isReady ? "Ready" : "Waiting"}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

// ── Tables section ────────────────────────────────────────────────────────────

function TablesSection({ tables }: { tables: TableRow[] }) {
  // Deduplicate by table_number, preferring occupied rows
  const byNumber = new Map<number, TableRow>()
  for (const t of tables) {
    const num = Number(t.table_number)
    const existing = byNumber.get(num)
    if (!existing || t.status === "occupied") byNumber.set(num, t)
  }
  const deduped = Array.from(byNumber.values()).sort((a, b) => Number(a.table_number) - Number(b.table_number))

  const available = deduped.filter(t => t.status === "available").length
  const occupied  = deduped.filter(t => t.status !== "available").length

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <SectionHeading>Tables</SectionHeading>
        <div style={{ display: "flex", gap: 8 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 20,
            background: C.greenBg, color: C.green, border: `1px solid ${C.greenBdr}`,
          }}>{available} open</span>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 20,
            background: C.redBg, color: C.red, border: `1px solid ${C.redBdr}`,
          }}>{occupied} seated</span>
        </div>
      </div>
      {deduped.length === 0 ? (
        <p style={{ fontSize: 13, color: C.muted, fontStyle: "italic", textAlign: "center", padding: "20px 0" }}>
          No table data
        </p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", gap: 8 }}>
          {deduped.map(t => {
            const isOcc = t.status !== "available"
            return (
              <div key={t.id} style={{
                borderRadius: 10, padding: "10px 8px",
                background: isOcc ? C.redBg : C.greenBg,
                border: `1px solid ${isOcc ? C.redBdr : C.greenBdr}`,
                display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                textAlign: "center",
              }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: isOcc ? C.red : C.green }}>
                  {t.table_number}
                </span>
                <span style={{ fontSize: 9, fontWeight: 600, color: isOcc ? C.red : C.green, opacity: 0.7, textTransform: "uppercase", letterSpacing: ".04em" }}>
                  {t.capacity}p
                </span>
                <span style={{ fontSize: 8, fontWeight: 700, color: isOcc ? C.red : C.green, opacity: 0.55, textTransform: "uppercase", letterSpacing: ".04em" }}>
                  {isOcc ? "Seated" : "Open"}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

// ── History section ───────────────────────────────────────────────────────────

function HistorySection({ history, onClear }: { history: HistoryEntry[]; onClear?: () => void }) {
  const seated  = history.filter(e => e.status === "seated")
  const removed = history.filter(e => e.status === "removed")

  const sorted = [...history].sort((a, b) => {
    const ta = parseUTCMs(a.updated_at ?? a.arrival_time) ?? 0
    const tb = parseUTCMs(b.updated_at ?? b.arrival_time) ?? 0
    return tb - ta
  })

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <SectionHeading>History (Today)</SectionHeading>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 20,
            background: C.greenBg, color: C.green, border: `1px solid ${C.greenBdr}`,
          }}>{seated.length} seated</span>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 20,
            background: C.surface2, color: C.muted, border: `1px solid ${C.border}`,
          }}>{removed.length} removed</span>
          {onClear && history.length > 0 && (
            <button onClick={onClear}
              style={{ fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20, background: C.redBg, color: C.red, border: `1px solid ${C.redBdr}`, cursor: "pointer" }}>
              Clear
            </button>
          )}
        </div>
      </div>
      {sorted.length === 0 ? (
        <p style={{ fontSize: 13, color: C.muted, fontStyle: "italic", textAlign: "center", padding: "20px 0" }}>
          No history yet today
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {["Status", "Name", "Party", "Arrived", "Quoted"].map(h => (
                  <th key={h} style={{
                    padding: "6px 10px", textAlign: "left",
                    fontSize: 9, fontWeight: 800, color: C.muted,
                    textTransform: "uppercase", letterSpacing: "0.10em", whiteSpace: "nowrap",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((e, i) => {
                const isSeated = e.status === "seated"
                return (
                  <tr key={e.id} style={{
                    borderBottom: `1px solid ${C.border}`,
                    background: i % 2 === 0 ? "transparent" : C.surface2,
                  }}>
                    <td style={{ padding: "9px 10px", whiteSpace: "nowrap" }}>
                      <span style={{
                        fontSize: 9, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase",
                        padding: "2px 7px", borderRadius: 6,
                        background: isSeated ? C.greenBg : C.redBg,
                        color: isSeated ? C.green : C.red,
                        border: `1px solid ${isSeated ? C.greenBdr : C.redBdr}`,
                      }}>
                        {isSeated ? "Seated" : "Removed"}
                      </span>
                    </td>
                    <td style={{ padding: "9px 10px", fontWeight: 600, color: C.text, whiteSpace: "nowrap" }}>
                      {e.name || "Guest"}
                    </td>
                    <td style={{ padding: "9px 10px", color: C.text2, textAlign: "center" }}>
                      {e.party_size}
                    </td>
                    <td style={{ padding: "9px 10px", color: C.text2, whiteSpace: "nowrap" }}>
                      {fmtTime(e.arrival_time)}
                    </td>
                    <td style={{ padding: "9px 10px", color: C.text2, whiteSpace: "nowrap" }}>
                      {e.quoted_wait != null ? `${e.quoted_wait}m` : <span style={{ color: C.muted }}>—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

// ── Client Billing Tab ─────────────────────────────────────────────────────────
function ClientBillingTab({ slug }: { slug: string }) {
  const [data,    setData]    = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [opening, setOpening] = useState(false)
  const [error,   setError]   = useState("")

  const CB = {
    bg: "#0C0907", surface: "#161310", surface2: "#1E1A16", border: "rgba(255,200,150,0.12)",
    text: "#F5F0EB", text2: "rgba(245,240,235,0.7)", muted: "rgba(245,240,235,0.4)",
    green: "#22C55E", greenBg: "rgba(34,197,94,0.08)", greenBdr: "rgba(34,197,94,0.25)",
    orange: "#F59E0B", orangeBg: "rgba(245,158,11,0.08)", orangeBdr: "rgba(245,158,11,0.25)",
    red: "#EF4444", redBg: "rgba(239,68,68,0.08)", redBdr: "rgba(239,68,68,0.25)",
    blue: "#60A5FA", blueBg: "rgba(96,165,250,0.08)", blueBdr: "rgba(96,165,250,0.25)",
    accent: "rgb(255,185,100)",
  }

  useEffect(() => {
    fetch(`/api/billing/client?slug=${encodeURIComponent(slug)}`, { cache: "no-store" })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => { setError("Failed to load billing info"); setLoading(false) })
  }, [slug])

  async function openPortal() {
    setOpening(true)
    try {
      const res = await fetch("/api/billing/client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, action: "portal", returnUrl: window.location.href }),
      })
      const d = await res.json()
      if (d.portal_url) window.open(d.portal_url, "_blank")
      else setError("Could not open billing portal. Contact support.")
    } catch { setError("Could not open billing portal.") }
    finally { setOpening(false) }
  }

  if (loading) return <div style={{ padding: 32, color: CB.muted, fontSize: 14 }}>Loading billing info…</div>
  if (!data?.billing_enabled) {
    return (
      <div style={{ padding: "32px 24px", maxWidth: 540 }}>
        <div style={{ background: CB.surface, border: `1px solid ${CB.border}`, borderRadius: 14, padding: "28px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12, color: CB.muted }}>$</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: CB.text, marginBottom: 8 }}>Billing Not Active</div>
          <div style={{ fontSize: 13, color: CB.muted, lineHeight: 1.6 }}>
            Your billing account hasn&apos;t been set up yet. You&apos;ll receive an email with a link to add your payment method when your account is activated by the HOST team.
          </div>
        </div>
      </div>
    )
  }

  const status      = String(data.status || "unknown")
  const trialEnd    = data.trial_end   ? new Date(Number(data.trial_end)   * 1000) : null
  const periodEnd   = data.current_period_end ? new Date(Number(data.current_period_end) * 1000) : null
  const textsUsed   = Number(data.texts_used   || 0)
  const included    = Number(data.included_texts || 2500)
  const overageCents = Number(data.overage_rate_cents || 20)
  const textPct     = Math.min(100, Math.round((textsUsed / included) * 100))
  const cancelSoon  = data.cancel_at_period_end === true
  const customCharges = Array.isArray(data.custom_charges) ? data.custom_charges as {description:string;amount_cents:number;created_at:string}[] : []

  function statusBadge() {
    const badges: Record<string, {label:string;color:string;bg:string;bdr:string}> = {
      trialing:  { label: "Free Trial",  color: CB.blue,   bg: CB.blueBg,   bdr: CB.blueBdr   },
      active:    { label: "Active",      color: CB.green,  bg: CB.greenBg,  bdr: CB.greenBdr  },
      past_due:  { label: "Past Due",    color: CB.red,    bg: CB.redBg,    bdr: CB.redBdr    },
      canceled:  { label: "Cancelled",   color: CB.muted,  bg: CB.surface2, bdr: CB.border    },
      paused:    { label: "Paused",      color: CB.orange, bg: CB.orangeBg, bdr: CB.orangeBdr },
      incomplete:{ label: "Setup Needed",color: CB.orange, bg: CB.orangeBg, bdr: CB.orangeBdr },
    }
    const b = badges[status] || { label: status, color: CB.muted, bg: CB.surface2, bdr: CB.border }
    return <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 20, padding: "3px 10px", border: `1px solid ${b.bdr}`, background: b.bg, color: b.color, letterSpacing: "0.04em", textTransform: "uppercase" as const }}>{b.label}</span>
  }

  return (
    <div style={{ padding: "24px 24px 48px", maxWidth: 640 }}>
      {error && <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 8, background: CB.redBg, border: `1px solid ${CB.redBdr}`, color: CB.red, fontSize: 13 }}>{error}</div>}

      {/* Plan card */}
      <div style={{ background: CB.surface, border: `1px solid ${CB.border}`, borderRadius: 16, padding: "24px 22px", marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: CB.text, marginBottom: 4 }}>HOST Platform Base Plan</div>
            <div style={{ fontSize: 13, color: CB.muted }}>$149 / month · 2,500 texts included</div>
          </div>
          {statusBadge()}
        </div>

        {/* Trial banner */}
        {status === "trialing" && trialEnd && (
          <div style={{ background: CB.blueBg, border: `1px solid ${CB.blueBdr}`, borderRadius: 10, padding: "10px 14px", marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: CB.blue }}>
              Free trial ends {trialEnd.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </div>
            <div style={{ fontSize: 12, color: CB.text2, marginTop: 3 }}>You won&apos;t be charged until after your trial ends. Add a payment method to continue service.</div>
          </div>
        )}

        {/* Cancellation warning */}
        {cancelSoon && periodEnd && (
          <div style={{ background: CB.orangeBg, border: `1px solid ${CB.orangeBdr}`, borderRadius: 10, padding: "10px 14px", marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: CB.orange }}>
              Subscription cancels {periodEnd.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </div>
            <div style={{ fontSize: 12, color: CB.text2, marginTop: 3 }}>Contact HOST support to reactivate.</div>
          </div>
        )}

        {/* Past due warning */}
        {status === "past_due" && (
          <div style={{ background: CB.redBg, border: `1px solid ${CB.redBdr}`, borderRadius: 10, padding: "10px 14px", marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: CB.red }}>Payment failed — please update your payment method to avoid service interruption.</div>
          </div>
        )}

        {/* Next billing */}
        {periodEnd && !cancelSoon && status !== "trialing" && (
          <div style={{ fontSize: 13, color: CB.text2 }}>
            Next charge: <strong style={{ color: CB.text }}>{periodEnd.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</strong> · $149.00
          </div>
        )}
      </div>

      {/* SMS usage card */}
      <div style={{ background: CB.surface, border: `1px solid ${CB.border}`, borderRadius: 16, padding: "20px 22px", marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: CB.text }}>SMS Usage This Month</div>
          <div style={{ fontSize: 13, color: textsUsed > included ? CB.red : CB.text2 }}>
            {textsUsed.toLocaleString()} / {included.toLocaleString()} texts
          </div>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: CB.surface2, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${textPct}%`, borderRadius: 4, background: textPct >= 100 ? CB.red : textPct >= 80 ? CB.orange : CB.green, transition: "width 0.4s" }} />
        </div>
        {textsUsed > included && (
          <div style={{ fontSize: 12, color: CB.red, marginTop: 8 }}>
            {(textsUsed - included).toLocaleString()} overage texts · ${((textsUsed - included) * overageCents / 100).toFixed(2)} added to next invoice
          </div>
        )}
        {textsUsed <= included && (
          <div style={{ fontSize: 12, color: CB.muted, marginTop: 8 }}>
            {(included - textsUsed).toLocaleString()} texts remaining · $0.{overageCents.toString().padStart(2,"0")}/text after limit
          </div>
        )}
      </div>

      {/* Custom charges (from owner) */}
      {customCharges.length > 0 && (
        <div style={{ background: CB.surface, border: `1px solid ${CB.orangeBdr}`, borderRadius: 16, padding: "20px 22px", marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: CB.text, marginBottom: 12 }}>Pending Charges</div>
          {customCharges.map((ch, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: i < customCharges.length - 1 ? `1px solid ${CB.border}` : "none" }}>
              <div style={{ fontSize: 13, color: CB.text2 }}>{ch.description}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: CB.orange }}>${(ch.amount_cents / 100).toFixed(2)}</div>
            </div>
          ))}
          <div style={{ fontSize: 11, color: CB.muted, marginTop: 10 }}>These will appear on your next invoice.</div>
        </div>
      )}

      {/* Manage button */}
      <button
        onClick={openPortal}
        disabled={opening}
        style={{ width: "100%", padding: "13px 0", borderRadius: 12, border: `1px solid ${CB.border}`, background: CB.surface, color: CB.text, fontSize: 14, fontWeight: 700, cursor: opening ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
      >
        {opening ? "Opening…" : "Manage Payment Method & Invoices"}
      </button>
      <div style={{ fontSize: 11, color: CB.muted, textAlign: "center", marginTop: 8 }}>
        Powered by Stripe · Secure payment management
      </div>
    </div>
  )
}

// ── Main inner component ──────────────────────────────────────────────────────

function ClientAdminInner() {
  const params = useParams()
  const slug   = (params?.slug as string) || ""

  const [rid,      setRid]      = useState("")
  const [ridError, setRidError] = useState(false)
  const [restName, setRestName] = useState("")
  const [adminPin, setAdminPin]     = useState("")
  const [pinOk,    setPinOk]        = useState(false)
  const [pinInput, setPinInput]     = useState("")
  const [pinErr,   setPinErr]       = useState(false)
  const [activeTab, setActiveTab]   = useState<"overview" | "logins" | "settings" | "billing">("overview")
  const [loginsUnlocked, setLoginsUnlocked] = useState(false)
  const [loginsPinInput, setLoginsPinInput] = useState("")
  const [loginsPinErr,   setLoginsPinErr]   = useState(false)
  const [online,   setOnline]   = useState(true)
  const [lastSync, setLastSync] = useState<Date | null>(null)

  const [queue,    setQueue]    = useState<QueueEntry[]>([])
  const [tables,   setTables]   = useState<TableRow[]>([])
  const [history,  setHistory]  = useState<HistoryEntry[]>([])
  const [insights, setInsights] = useState<Insights>({})

  // Step 1: resolve slug → restaurant_id
  useEffect(() => {
    if (!slug) return
    fetch(`${API}/client/${encodeURIComponent(slug)}/config`, { cache: "no-store" })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.restaurant_id) {
          setRid(d.restaurant_id)
          setRidError(false)
          if (d.guest_config?.restaurantName) setRestName(d.guest_config.restaurantName)
          if (d.guest_config?.adminPin) {
            setAdminPin(String(d.guest_config.adminPin))
          }
          // If no PIN is configured, pinOk stays false → access is blocked
        } else {
          setRidError(true)
        }
      })
      .catch(() => setRidError(true))
  }, [slug])

  // Step 2: fetch all data using rid
  const fetchAll = useCallback(async () => {
    if (!rid) return
    try {
      const [qRes, tRes, hRes, iRes] = await Promise.all([
        fetch(`${API}/queue?restaurant_id=${rid}`),
        fetch(`${API}/tables?restaurant_id=${rid}`),
        fetch(`${API}/queue/history?restaurant_id=${rid}`),
        fetch(`${API}/insights?restaurant_id=${rid}`),
      ])

      if (qRes.ok) setQueue(await qRes.json())
      if (tRes.ok) setTables(await tRes.json())
      if (hRes.ok) {
        const all: HistoryEntry[] = await hRes.json()
        // Filter to today (business day starts 3am)
        const now = new Date()
        if (now.getHours() < 3) now.setDate(now.getDate() - 1)
        const todayStr = now.toLocaleDateString("en-CA")
        setHistory(all.filter(e => {
          try {
            const d = new Date(parseUTCMs(e.arrival_time) ?? 0)
            if (d.getHours() < 3) d.setDate(d.getDate() - 1)
            return d.toLocaleDateString("en-CA") === todayStr
          } catch { return false }
        }))
      }
      if (iRes.ok) setInsights(await iRes.json())

      setOnline(true)
      setLastSync(new Date())
    } catch {
      setOnline(false)
    }
  }, [rid])

  // Initial fetch + 30-second auto-refresh
  useEffect(() => {
    if (!rid) return
    fetchAll()
    const t = setInterval(fetchAll, 30_000)
    return () => clearInterval(t)
  }, [rid, fetchAll])

  function clearHistory() {
    // Clear today's guest log from localStorage (same key format as station page)
    try {
      const dateStr = getBusinessDateStr()
      localStorage.removeItem(`host_${slug}_log_${dateStr}`)
    } catch {}
    setHistory([])
  }

  const [clearConfirm, setClearConfirm] = useState(false)
  const [clearing, setClearing]         = useState(false)

  async function clearDayData() {
    if (!rid) return
    setClearing(true)
    try {
      await fetch(`${API}/admin/clear-day?restaurant_id=${encodeURIComponent(rid)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_pin: adminPin }),
      })
      clearHistory()
      setQueue([])
      setTables([])
      await fetchAll()
    } catch {}
    setClearing(false)
    setClearConfirm(false)
  }

  // ── Derived stats ──────────────────────────────────────────────────────────

  // Deduplicated tables for stats
  const deduped = (() => {
    const m = new Map<number, TableRow>()
    for (const t of tables) {
      const num = Number(t.table_number)
      const existing = m.get(num)
      if (!existing || t.status === "occupied") m.set(num, t)
    }
    return Array.from(m.values())
  })()

  const availableTables  = deduped.filter(t => t.status === "available").length
  const occupiedTables   = deduped.filter(t => t.status !== "available").length
  const waitingParties   = queue.filter(e => e.status === "waiting" || e.status === "ready").length
  const avgWait          = insights.avg_wait_estimate ?? 0

  // ── Loading / error states ─────────────────────────────────────────────────

  const containerStyle: React.CSSProperties = {
    minHeight: "100dvh",
    background: C.bg,
    color: C.text,
    fontFamily: "var(--font-geist, var(--font-sans), system-ui, sans-serif)",
  }

  if (ridError) {
    return (
      <div style={{ ...containerStyle, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", maxWidth: 360, padding: 32 }}>
          <p style={{ fontSize: 32, marginBottom: 12, color: C.muted }}>?</p>
          <p style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 8 }}>
            Restaurant not found
          </p>
          <p style={{ fontSize: 13, color: C.muted, marginBottom: 24, lineHeight: 1.6 }}>
            Could not find a restaurant for <strong style={{ color: C.text2 }}>&ldquo;{slug}&rdquo;</strong>.
            Check the URL and try again.
          </p>
          <Link href={`/client/${slug}/station`} style={{
            fontSize: 13, color: C.text2, textDecoration: "none",
            padding: "8px 16px", borderRadius: 10,
            border: `1px solid ${C.border}`,
            display: "inline-flex", alignItems: "center", gap: 6,
          }}>
            <ChevronLeft size={14} /> Back to station
          </Link>
        </div>
      </div>
    )
  }

  if (!rid) {
    return (
      <div style={{ ...containerStyle, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", padding: 32 }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            border: `3px solid ${C.border}`,
            borderTopColor: C.green,
            margin: "0 auto 16px",
            animation: "spin 0.8s linear infinite",
          }} />
          <p style={{ fontSize: 13, color: C.muted }}>Loading restaurant…</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    )
  }

  // ── PIN gate ───────────────────────────────────────────────────────────────
  const PIN_PAD = [["1","2","3"],["4","5","6"],["7","8","9"],["","0","⌫"]]

  function onPinDigit(d: string) {
    if (d === "⌫") {
      setPinInput(p => p.slice(0, -1)); setPinErr(false); return
    }
    if (pinInput.length >= 4) return
    const next = pinInput + d
    setPinInput(next); setPinErr(false)
    if (next.length === 4) {
      if (next === adminPin) {
        setPinOk(true)
      } else {
        setPinErr(true)
        setTimeout(() => { setPinInput(""); setPinErr(false) }, 600)
      }
    }
  }

  if (!pinOk) return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: C.bg, gap: 32 }}>
      <style>{`@keyframes pinShake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}`}</style>

      {adminPin ? (
        <>
          <p style={{ fontSize: 15, fontWeight: 700, color: C.text2, letterSpacing: "0.04em" }}>Admin PIN</p>

          {/* Dots */}
          <div style={{ display: "flex", gap: 18, animation: pinErr ? "pinShake 0.5s ease" : "none" }}>
            {[0,1,2,3].map(i => (
              <div key={i} style={{ width: 18, height: 18, borderRadius: "50%", background: pinInput.length > i ? (pinErr ? C.red : C.text) : "transparent", border: `2.5px solid ${pinInput.length > i ? (pinErr ? C.red : C.text) : C.border}`, transition: "all 0.12s" }} />
            ))}
          </div>

          {/* Numpad */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 88px)", gridTemplateRows: "repeat(4, 88px)", gap: 12 }}>
            {PIN_PAD.flat().map((d, i) => (
              <button key={i} onClick={() => d && onPinDigit(d)} disabled={!d}
                style={{ borderRadius: 20, fontSize: d === "⌫" ? 20 : 28, fontWeight: 600, background: d === "⌫" ? C.redBg : d ? C.surface : "transparent", border: d === "⌫" ? `1.5px solid ${C.redBdr}` : d ? `1.5px solid ${C.border}` : "none", color: d === "⌫" ? C.red : d ? C.text : "transparent", cursor: d ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.1s", boxShadow: d && d !== "⌫" ? "0 1px 3px rgba(0,0,0,0.06)" : "none" }}>
                {d === "⌫" ? "⌫" : d}
              </button>
            ))}
          </div>
        </>
      ) : (
        /* No PIN configured — block access entirely */
        <div style={{ textAlign: "center", maxWidth: 340, padding: "0 24px" }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: C.surface2, border: `1.5px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: 22, color: C.muted }}>
            ?
          </div>
          <p style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 10 }}>Admin PIN Required</p>
          <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, marginBottom: 0 }}>
            No Admin PIN is configured for this restaurant. Contact your HOST account manager to set one up before accessing this dashboard.
          </p>
        </div>
      )}

      <Link href={`/client/${slug}/station`} style={{ fontSize: 13, color: C.muted, textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
        ← Back to restaurant
      </Link>
    </div>
  )

  // ── Full dashboard ─────────────────────────────────────────────────────────

  return (
    <div style={containerStyle}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{
        background: C.surface, borderBottom: `1px solid ${C.border}`,
        padding: "0 20px", height: 52,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 40,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Link href={`/client/${slug}/station`} style={{
            display: "flex", alignItems: "center", gap: 4,
            fontSize: 12, fontWeight: 600, color: C.muted,
            textDecoration: "none", padding: "5px 10px",
            borderRadius: 8, border: `1px solid ${C.border}`,
            flexShrink: 0,
          }}>
            <ChevronLeft size={13} /> Station
          </Link>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: C.text, lineHeight: 1.2 }}>
              {restName || slug}
            </p>
            <p style={{ fontSize: 10, color: C.muted, letterSpacing: "0.10em", textTransform: "uppercase" }}>
              Admin Dashboard
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            {online ? <Wifi size={13} style={{ color: C.green }} /> : <WifiOff size={13} style={{ color: C.red }} />}
            <span style={{ fontSize: 11, fontWeight: 600, color: online ? C.green : C.red }}>{online ? "Live" : "Offline"}</span>
          </div>
          {lastSync && <span style={{ fontSize: 10, color: C.muted }}>{lastSync.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
          <button onClick={fetchAll} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: C.muted }}>
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* ── Tab nav bar ────────────────────────────────────────────────────────── */}
      <div style={{
        background: C.surface, borderBottom: `1px solid ${C.border}`,
        padding: "0 20px",
        display: "flex", alignItems: "center", gap: 4,
        position: "sticky", top: 52, zIndex: 39,
        overflowX: "auto",
      }}>
        {(["overview", "logins", "settings", "billing"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{
              padding: "10px 18px", borderRadius: 0, border: "none",
              borderBottom: `2px solid ${activeTab === tab ? C.green : "transparent"}`,
              background: "transparent",
              color: activeTab === tab ? C.green : C.muted,
              fontSize: 12, fontWeight: 600, cursor: "pointer",
              textTransform: "capitalize", flexShrink: 0,
              transition: "color 0.15s, border-color 0.15s",
            }}>
            {tab}
          </button>
        ))}
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      {activeTab === "overview" && (
        <div style={{ padding: "24px 24px 48px", maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
            <StatCard icon={CheckCircle2} label="Tables Open" value={availableTables} sub={`of ${deduped.length} total`} color={C.green} bg={C.greenBg} bdr={C.greenBdr} />
            <StatCard icon={Users} label="Tables Seated" value={occupiedTables} sub={deduped.length > 0 ? `${Math.round(occupiedTables/deduped.length*100)}% occupancy` : "—"} color={occupiedTables > 0 ? C.red : C.muted} bg={occupiedTables > 0 ? C.redBg : C.surface2} bdr={occupiedTables > 0 ? C.redBdr : C.border} />
            <StatCard icon={Clock} label="Parties Waiting" value={waitingParties} sub={waitingParties === 0 ? "no queue" : `${waitingParties} part${waitingParties === 1 ? "y" : "ies"}`} color={waitingParties > 0 ? C.orange : C.green} bg={waitingParties > 0 ? C.orangeBg : C.greenBg} bdr={waitingParties > 0 ? C.orangeBdr : C.greenBdr} />
            <StatCard icon={BarChart2} label="Avg Wait" value={avgWait > 0 ? `${Math.round(avgWait)}m` : "—"} sub="estimated" color={avgWait > 20 ? C.red : avgWait > 0 ? C.orange : C.muted} bg={avgWait > 20 ? C.redBg : avgWait > 0 ? C.orangeBg : C.surface2} bdr={avgWait > 20 ? C.redBdr : avgWait > 0 ? C.orangeBdr : C.border} />
          </div>
          <div style={{ marginBottom: 20 }}><QueueSection queue={queue} /></div>
          <div style={{ marginBottom: 20 }}><TablesSection tables={tables} /></div>
          <div style={{ marginBottom: 20 }}><HistorySection history={history} onClear={clearHistory} /></div>

          {/* Clear Today's Data */}
          <div style={{ background: C.surface, border: `1px solid ${C.redBdr}`, borderRadius: 14, padding: "18px 22px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4 }}>Clear Today&apos;s Data</div>
                <div style={{ fontSize: 12, color: C.muted }}>Removes queue entries, resets tables, and clears history for today. Cannot be undone.</div>
              </div>
              {!clearConfirm ? (
                <button onClick={() => setClearConfirm(true)}
                  style={{ marginLeft: 24, padding: "8px 18px", borderRadius: 10, background: C.redBg, color: C.red, border: `1px solid ${C.redBdr}`, fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                  Clear Day
                </button>
              ) : (
                <div style={{ display: "flex", gap: 8, marginLeft: 24 }}>
                  <button onClick={() => setClearConfirm(false)} disabled={clearing}
                    style={{ padding: "8px 16px", borderRadius: 10, background: C.surface2, color: C.text2, border: `1px solid ${C.border}`, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    Cancel
                  </button>
                  <button onClick={clearDayData} disabled={clearing}
                    style={{ padding: "8px 18px", borderRadius: 10, background: C.red, color: "#fff", border: "none", fontSize: 13, fontWeight: 700, cursor: clearing ? "wait" : "pointer", whiteSpace: "nowrap" }}>
                    {clearing ? "Clearing…" : "Yes, clear it"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "logins" && !loginsUnlocked && adminPin && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 24px", gap: 32 }}>
          <style>{`@keyframes loginsShake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}`}</style>

          <p style={{ fontSize: 15, fontWeight: 700, color: C.text2, letterSpacing: "0.04em" }}>Confirm PIN to view logins</p>

          {/* Dots */}
          <div style={{ display: "flex", gap: 18, animation: loginsPinErr ? "loginsShake 0.5s ease" : "none" }}>
            {[0,1,2,3].map(i => (
              <div key={i} style={{ width: 18, height: 18, borderRadius: "50%", background: loginsPinInput.length > i ? (loginsPinErr ? C.red : C.text) : "transparent", border: `2.5px solid ${loginsPinInput.length > i ? (loginsPinErr ? C.red : C.text) : C.border}`, transition: "all 0.12s" }} />
            ))}
          </div>

          {/* Numpad */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 88px)", gridTemplateRows: "repeat(4, 88px)", gap: 12 }}>
            {PIN_PAD.flat().map((d, i) => {
              function onLoginsPinDigit(digit: string) {
                if (digit === "⌫") { setLoginsPinInput(p => p.slice(0, -1)); setLoginsPinErr(false); return }
                if (loginsPinInput.length >= 4) return
                const next = loginsPinInput + digit
                setLoginsPinInput(next); setLoginsPinErr(false)
                if (next.length === 4) {
                  if (next === adminPin) { setLoginsUnlocked(true); setLoginsPinInput("") }
                  else { setLoginsPinErr(true); setTimeout(() => { setLoginsPinInput(""); setLoginsPinErr(false) }, 600) }
                }
              }
              return (
                <button key={i} onClick={() => d && onLoginsPinDigit(d)} disabled={!d}
                  style={{ borderRadius: 20, fontSize: d === "⌫" ? 20 : 28, fontWeight: 600, background: d === "⌫" ? C.redBg : d ? C.surface : "transparent", border: d === "⌫" ? `1.5px solid ${C.redBdr}` : d ? `1.5px solid ${C.border}` : "none", color: d === "⌫" ? C.red : d ? C.text : "transparent", cursor: d ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.1s", boxShadow: d && d !== "⌫" ? "0 1px 3px rgba(0,0,0,0.06)" : "none" }}>
                  {d}
                </button>
              )
            })}
          </div>
        </div>
      )}
      {activeTab === "logins" && (loginsUnlocked || !adminPin) && (
        <LoginsTab slug={slug} rid={rid} adminPin={adminPin} onPinChanged={newPin => {
          setAdminPin(newPin)
        }} onBack={() => setActiveTab("overview")} />
      )}

      {activeTab === "settings" && (
        <SettingsTab slug={slug} rid={rid} onBack={() => setActiveTab("overview")} />
      )}

      {activeTab === "billing" && rid && (
        <ClientBillingTab slug={slug} />
      )}
    </div>
  )
}

// ── Logins Tab ────────────────────────────────────────────────────────────────

const PIN_PAD_ROWS = [["1","2","3"],["4","5","6"],["7","8","9"],["","0","⌫"]]

function LoginsTab({ slug, rid, adminPin, onPinChanged, onBack }: {
  slug: string
  rid: string
  adminPin: string
  onPinChanged: (newPin: string) => void
  onBack?: () => void
}) {
  // PIN change via pad
  const [pinDigits,  setPinDigits]  = useState<string[]>([])
  const [pinStep,    setPinStep]    = useState<"entry" | "confirm">("entry")
  const [pinFirst,   setPinFirst]   = useState("")
  const [pinMsg,     setPinMsg]     = useState<{ ok: boolean; text: string } | null>(null)
  const [pinSaving,  setPinSaving]  = useState(false)

  // Login credential state
  const [credId,      setCredId]      = useState<string | null>(null)
  const [hasPassword, setHasPassword] = useState(false)
  const [newPassword, setNewPassword] = useState("")
  const [credSaving,  setCredSaving]  = useState(false)
  const [credMsg,     setCredMsg]     = useState<{ ok: boolean; text: string } | null>(null)
  const [credLoading, setCredLoading] = useState(true)

  useEffect(() => {
    if (!rid) return
    fetch(`/api/client/credentials?rid=${encodeURIComponent(rid)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const creds: Array<{ id: string; credential_type: string; value: string }> = d?.credentials || []
        const login = creds.find(c => c.credential_type === "login")
        if (login) {
          setCredId(login.id)
          // We only need to know a password exists — we never display the stored value
          // (it is now a hash, not the plaintext password)
          setHasPassword(true)
        }
      })
      .catch(() => {})
      .finally(() => setCredLoading(false))
  }, [rid])

  async function saveLoginCredential() {
    const p = newPassword.trim()
    if (!p) { setCredMsg({ ok: false, text: "Password cannot be empty" }); return }
    setCredSaving(true); setCredMsg(null)
    try {
      // Always store as "slug:password" — the credentials API route hashes the password
      // before forwarding to Railway so plaintext never reaches the database
      const r = await fetch("/api/client/credentials", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rid, cred_id: credId || undefined, value: `${slug}:${p}` }),
      })
      if (!r.ok) throw new Error()
      const d = await r.json()
      if (d.id && !credId) setCredId(d.id)
      setHasPassword(true); setNewPassword("")
      setCredMsg({ ok: true, text: "Password updated — sign in with the username above" })
    } catch { setCredMsg({ ok: false, text: "Could not save password" }) }
    setCredSaving(false)
    setTimeout(() => setCredMsg(null), 4000)
  }

  async function submitPin(pin: string) {
    setPinSaving(true); setPinMsg(null)
    try {
      const r = await fetch(`${API}/client/${encodeURIComponent(slug)}/admin/pin`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_pin: adminPin, new_pin: pin }),
      })
      if (!r.ok) throw new Error()
      onPinChanged(pin)
      setPinMsg({ ok: true, text: "PIN updated" })
    } catch { setPinMsg({ ok: false, text: "Could not save PIN" }) }
    setPinSaving(false)
    setPinDigits([]); setPinStep("entry"); setPinFirst("")
    setTimeout(() => setPinMsg(null), 4000)
  }

  function onPinKey(d: string) {
    if (d === "⌫") { setPinDigits(p => p.slice(0, -1)); return }
    if (pinDigits.length >= 4) return
    const next = [...pinDigits, d]
    setPinDigits(next)
    if (next.length === 4) {
      const pin = next.join("")
      if (pinStep === "entry") { setPinFirst(pin); setPinStep("confirm"); setPinDigits([]) }
      else if (pin === pinFirst) { submitPin(pin) }
      else { setPinMsg({ ok: false, text: "PINs didn't match — try again" }); setPinDigits([]); setPinStep("entry"); setPinFirst(""); setTimeout(() => setPinMsg(null), 3000) }
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "12px 14px", borderRadius: 10,
    border: `1px solid ${C.border}`, background: C.surface2,
    color: C.text, fontSize: 14, outline: "none", boxSizing: "border-box",
  }

  return (
    <div style={{ padding: "28px 24px 48px", maxWidth: 560, margin: "0 auto" }}>

      {onBack && (
        <button onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: C.muted, background: "none", border: "none", cursor: "pointer", padding: "0 0 20px", marginLeft: -2 }}>
          <ChevronLeft size={14} /> Back to Overview
        </button>
      )}

      {/* ── Admin PIN (pad) ── */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 22px", marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: C.muted, marginBottom: 6 }}>
          {adminPin ? "Change Admin PIN" : "Set Admin PIN"}
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>
          {pinStep === "entry" ? "Enter a new 4-digit PIN:" : "Confirm your new PIN:"}
        </div>

        {/* Dots */}
        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{ width: 16, height: 16, borderRadius: "50%", background: pinDigits.length > i ? C.text : "transparent", border: `2px solid ${pinDigits.length > i ? C.text : C.border}`, transition: "background 0.1s" }} />
          ))}
        </div>

        {/* Numpad */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6, maxWidth: 290 }}>
          {PIN_PAD_ROWS.flat().map((d, i) => (
            <button key={i} onClick={() => d && onPinKey(d)} disabled={!d || pinSaving}
              style={{ height: 44, borderRadius: 10, fontSize: d === "⌫" ? 15 : 17, fontWeight: 600, background: d === "⌫" ? C.redBg : d ? C.surface2 : "transparent", border: d === "⌫" ? `1px solid ${C.redBdr}` : d ? `1px solid ${C.border}` : "none", color: d === "⌫" ? C.red : d ? C.text : "transparent", cursor: d && !pinSaving ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {d}
            </button>
          ))}
        </div>

        {pinStep === "confirm" && (
          <button onClick={() => { setPinStep("entry"); setPinDigits([]); setPinFirst("") }}
            style={{ marginTop: 10, fontSize: 12, color: C.muted, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            ← Start over
          </button>
        )}
        {pinMsg && <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: pinMsg.ok ? C.green : C.red }}>{pinMsg.text}</div>}

        {adminPin && (
          <button onClick={() => submitPin("")}
            style={{ marginTop: 14, padding: "8px 14px", borderRadius: 8, border: `1px solid ${C.redBdr}`, background: C.redBg, color: C.red, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            Remove PIN
          </button>
        )}
      </div>

      {/* ── Station Login ── */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 22px" }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: C.muted, marginBottom: 4 }}>
          Station Login
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>
          Credentials used to sign in at hostplatform.net
        </div>

        {credLoading ? (
          <div style={{ fontSize: 13, color: C.muted }}>Loading…</div>
        ) : (
          <>
            {/* Username — fixed to slug, read-only */}
            <div style={{ marginBottom: 14, padding: "10px 14px", borderRadius: 10, background: C.surface2, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: C.muted, marginBottom: 2 }}>Username (login ID)</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text, fontFamily: "monospace" }}>{slug}</div>
            </div>

            {hasPassword && (
              <div style={{ marginBottom: 12, padding: "8px 12px", borderRadius: 8, background: C.greenBg, border: `1px solid ${C.greenBdr}`, fontSize: 12, color: C.green, fontWeight: 600 }}>
                Password is set — enter a new one below to change it
              </div>
            )}
            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.text2, display: "block", marginBottom: 6 }}>
                {hasPassword ? "Change Password" : "Set Password"}
              </label>
              <input
                type="password"
                placeholder={hasPassword ? "Enter new password" : "Set a password"}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && saveLoginCredential()}
                style={inputStyle}
                autoComplete="new-password"
              />
            </div>
            {credMsg && <div style={{ fontSize: 13, fontWeight: 600, color: credMsg.ok ? C.green : C.red, marginBottom: 8 }}>{credMsg.text}</div>}
            <button onClick={saveLoginCredential} disabled={credSaving || !newPassword.trim()}
              style={{ marginTop: 4, padding: "10px 20px", borderRadius: 10, background: newPassword.trim() ? C.green : C.surface2, color: newPassword.trim() ? "#fff" : C.muted, border: `1px solid ${newPassword.trim() ? C.green : C.border}`, fontWeight: 600, fontSize: 13, cursor: !newPassword.trim() || credSaving ? "default" : "pointer", transition: "all 0.15s", opacity: credSaving ? 0.6 : 1 }}>
              {credSaving ? "Saving…" : hasPassword ? "Update Password" : "Set Password"}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── Settings Tab ─────────────────────────────────────────────────────────────

interface EditorTable {
  number: number
  shape: string
  x: number; y: number   // center, wizard coords (0-100 height-based units)
  w: number; h: number   // size, same units
  capacity: number
}

interface FloorPage {
  id: string
  name: string
  tables: EditorTable[]
}

const EDITOR_W = 560
const EDITOR_H = 347  // 560 / 1.615 ≈ golden ratio

interface SectionsConfig { enabled: boolean; sections: string[] }

interface MenuItemAdmin { id: string; name: string; description: string; price: string }
interface MenuSectionAdmin { id: string; title: string; items: MenuItemAdmin[] }

function SettingsTab({ slug, rid, onBack }: { slug: string; rid: string; onBack?: () => void }) {
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [msg,          setMsg]          = useState<{ ok: boolean; text: string } | null>(null)
  const [showCapacity, setShowCapacity] = useState(false)
  const [alertBySize,  setAlertBySize]  = useState({ small: 30, medium: 45, large: 60, xlarge: 90 })
  const [pages,        setPages]        = useState<FloorPage[]>([{ id: "p0", name: "Main Floor", tables: [] }])
  const [pageIdx,      setPageIdx]      = useState(0)
  const [renamingPage, setRenamingPage] = useState(false)
  const [pageNameEdit, setPageNameEdit] = useState("")
  const [canvasAspect, setCanvasAspect] = useState(1.615)
  const [selectedIdx,  setSelectedIdx]  = useState<number | null>(null)

  // Derived: tables on the current page
  const tables    = pages[pageIdx]?.tables ?? []
  const setTables = (fn: (t: EditorTable[]) => EditorTable[]) =>
    setPages(p => p.map((pg, i) => i === pageIdx ? { ...pg, tables: fn(pg.tables) } : pg))

  // Sections config
  const [sections,       setSections]       = useState<SectionsConfig>({ enabled: false, sections: [] })
  const [newSectionName, setNewSectionName] = useState("")
  const [sectionsSaving, setSectionsSaving] = useState(false)
  const [sectionsMsg,    setSectionsMsg]    = useState<{ ok: boolean; text: string } | null>(null)

  // Menu editor state
  const [menuSections, setMenuSections] = useState<MenuSectionAdmin[]>([])

  // Station display settings
  const [flatQueue,        setFlatQueue]        = useState(false)
  const [showSectionBadge, setShowSectionBadge] = useState(false)
  const [waitlistTab,      setWaitlistTab]      = useState(false)
  const [queueWidth,       setQueueWidth]       = useState(300)

  // Full guest_config from Railway (to merge, not overwrite)
  const fullGuestConfigRef = useRef<Record<string, unknown>>({})

  // Auto-save station settings on toggle/slider change
  const settingsLoadedRef  = useRef(false)
  const queueWidthDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function saveStationSettingsOnly(
    opts: { fq?: boolean; ssb?: boolean; wt?: boolean; qw?: number }
  ) {
    const mergedGc = {
      ...fullGuestConfigRef.current,
      stationSettings: {
        flatQueue:        opts.fq  ?? !!(fullGuestConfigRef.current.stationSettings as Record<string,unknown> | undefined)?.flatQueue,
        showSectionBadge: opts.ssb ?? !!(fullGuestConfigRef.current.stationSettings as Record<string,unknown> | undefined)?.showSectionBadge,
        waitlistTab:      opts.wt  ?? !!(fullGuestConfigRef.current.stationSettings as Record<string,unknown> | undefined)?.waitlistTab,
        queueWidth:       opts.qw  ??  ((fullGuestConfigRef.current.stationSettings as Record<string,unknown> | undefined)?.queueWidth as number ?? 300),
      },
    }
    fullGuestConfigRef.current = mergedGc
    await fetch("/api/client/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rid, guest_config: mergedGc }),
    }).catch(() => {})
  }

  // Auto-save toggles immediately; debounce slider 600ms
  useEffect(() => {
    if (!settingsLoadedRef.current) return
    saveStationSettingsOnly({ fq: flatQueue, ssb: showSectionBadge, wt: waitlistTab })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flatQueue, showSectionBadge, waitlistTab])

  useEffect(() => {
    if (!settingsLoadedRef.current) return
    if (queueWidthDebounce.current) clearTimeout(queueWidthDebounce.current)
    queueWidthDebounce.current = setTimeout(() => {
      saveStationSettingsOnly({ qw: queueWidth })
    }, 600)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueWidth])

  const dragRef = useRef<{
    idx: number
    startClientX: number; startClientY: number
    origX: number; origY: number
  } | null>(null)

  const canvasRef   = useRef<HTMLDivElement>(null)
  const pageIdxRef  = useRef(pageIdx)
  useEffect(() => { pageIdxRef.current = pageIdx }, [pageIdx])

  useEffect(() => {
    if (!slug) return
    fetch(`https://restaurant-brain-production.up.railway.app/client/${encodeURIComponent(slug)}/config`, { cache: "no-store" })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return
        const gc = d.guest_config ?? {}
        fullGuestConfigRef.current = gc
        setShowCapacity(!!gc.showCapacity)
        if (gc.stationSettings && typeof gc.stationSettings === "object") {
          const ss = gc.stationSettings as Record<string, unknown>
          setFlatQueue(!!ss.flatQueue)
          setShowSectionBadge(!!ss.showSectionBadge)
          setWaitlistTab(!!ss.waitlistTab)
          if (typeof ss.queueWidth === "number" && ss.queueWidth > 0) setQueueWidth(ss.queueWidth)
        }
        if (gc.reservationAlertBySize) {
          setAlertBySize(prev => ({ ...prev, ...gc.reservationAlertBySize }))
        } else if (gc.reservationAlertMinutes) {
          const m = Number(gc.reservationAlertMinutes) || 45
          setAlertBySize({ small: m, medium: m, large: m, xlarge: m })
        }
        const fp = d.floor_plan
        if (fp) {
          const asp = fp.canvasAspect ?? 1.615
          setCanvasAspect(asp)
          const mapTable = (t: { number?: number; shape?: string; x?: number; y?: number; w?: number; h?: number; capacity?: number }, i: number): EditorTable => ({
            number:   t.number   ?? (i + 1),
            shape:    t.shape    ?? "square",
            x:        t.x        ?? 50,
            y:        t.y        ?? 50,
            w:        t.w        ?? 8,
            h:        t.h        ?? 8,
            capacity: t.capacity ?? 4,
          })
          if (Array.isArray(fp.pages) && fp.pages.length > 0) {
            // New multi-page format
            setPages(fp.pages.map((pg: { id?: string; name?: string; tables?: { number?: number; shape?: string; x?: number; y?: number; w?: number; h?: number; capacity?: number }[] }, pi: number) => ({
              id:     pg.id   ?? `p${pi}`,
              name:   pg.name ?? (pi === 0 ? "Main Floor" : `Page ${pi + 1}`),
              tables: Array.isArray(pg.tables) ? pg.tables.map(mapTable) : [],
            })))
            setPageIdx(0)
          } else if (Array.isArray(fp.tables) && fp.tables.length > 0) {
            // Legacy single-page format
            setPages([{ id: "p0", name: "Main Floor", tables: fp.tables.map(mapTable) }])
            setPageIdx(0)
          }
        }
        // Load menu config
        if (d.menu_config?.sections) {
          setMenuSections(d.menu_config.sections)
        }
        // Mark settings as loaded so auto-save effects don't fire during init
        setTimeout(() => { settingsLoadedRef.current = true }, 0)
      })
      .catch(() => {})
      .finally(() => setLoading(false))

    // Fetch sections config separately
    if (rid) {
      fetch(`${API}/sections?restaurant_id=${rid}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setSections(d) })
        .catch(() => {})
    }
  }, [slug, rid])

  async function saveSections(cfg: SectionsConfig) {
    if (!rid) { setSectionsMsg({ ok: false, text: "No restaurant ID — reload the page" }); return }
    setSectionsSaving(true); setSectionsMsg(null)
    try {
      const r = await fetch(`${API}/sections?restaurant_id=${rid}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg),
      })
      if (!r.ok) {
        const detail = await r.json().then(d => d?.detail ?? "Unknown error").catch(() => `HTTP ${r.status}`)
        throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail))
      }
      const resp = await r.json().catch(() => null)
      // The backend echoes back what it saved — verify it matches what we sent
      const saved = resp?.saved as SectionsConfig | null
      if (saved && (saved.enabled !== cfg.enabled || JSON.stringify(saved.sections) !== JSON.stringify(cfg.sections))) {
        throw new Error(`Server saved wrong data (rid=${rid}) — expected ${JSON.stringify(cfg)} but got ${JSON.stringify(saved)}`)
      }
      setSectionsMsg({ ok: true, text: "Saved" })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not save"
      setSectionsMsg({ ok: false, text: `Save failed: ${msg}` })
    }
    setSectionsSaving(false)
    setTimeout(() => setSectionsMsg(null), 8000)
  }

  function toggleSections() {
    const next = { ...sections, enabled: !sections.enabled }
    setSections(next)
    saveSections(next)
  }

  function addSectionItem() {
    const name = newSectionName.trim()
    if (!name || sections.sections.includes(name)) return
    const next = { ...sections, sections: [...sections.sections, name] }
    setSections(next)
    setNewSectionName("")
    saveSections(next)
  }

  function removeSectionItem(s: string) {
    const next = { ...sections, sections: sections.sections.filter(x => x !== s) }
    setSections(next)
    saveSections(next)
  }

  // Mouse/touch drag handlers
  useEffect(() => {
    function onMove(e: MouseEvent | TouchEvent) {
      const dr = dragRef.current
      if (!dr || !canvasRef.current) return
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY
      const dx = (clientX - dr.startClientX) / EDITOR_W * 100
      const dy = (clientY - dr.startClientY) / EDITOR_H * 100
      const pi = pageIdxRef.current
      setPages(prev => prev.map((pg, pgI) => {
        if (pgI !== pi) return pg
        return { ...pg, tables: pg.tables.map((t, i) => {
          if (i !== dr.idx) return t
          const newX = Math.max(t.w / 2, Math.min(100 - t.w / 2, dr.origX + dx))
          const newY = Math.max(t.h / 2, Math.min(100 - t.h / 2, dr.origY + dy))
          return { ...t, x: newX, y: newY }
        }) }
      }))
    }
    function onUp() { dragRef.current = null }
    document.addEventListener("mousemove", onMove)
    document.addEventListener("mouseup",   onUp)
    document.addEventListener("touchmove", onMove, { passive: true })
    document.addEventListener("touchend",  onUp)
    return () => {
      document.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseup",   onUp)
      document.removeEventListener("touchmove", onMove)
      document.removeEventListener("touchend",  onUp)
    }
  }, [])

  function startDrag(e: React.MouseEvent | React.TouchEvent, idx: number) {
    e.preventDefault()
    e.stopPropagation()
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY
    dragRef.current = { idx, startClientX: clientX, startClientY: clientY, origX: tables[idx].x, origY: tables[idx].y }
    setSelectedIdx(idx)
  }

  function addTable() {
    const maxNum = tables.reduce((m, t) => Math.max(m, t.number), 0)
    setTables(prev => [...prev, { number: maxNum + 1, shape: "square", x: 50, y: 50, w: 9, h: 9, capacity: 4 }])
    setSelectedIdx(tables.length)
  }

  function deleteTable(idx: number) {
    setTables(prev => prev.filter((_, i) => i !== idx))
    setSelectedIdx(null)
  }

  function updateTable(idx: number, patch: Partial<EditorTable>) {
    setTables(prev => prev.map((t, i) => i === idx ? { ...t, ...patch } : t))
  }

  async function saveSettings() {
    setSaving(true); setMsg(null)
    try {
      // Merge only our fields into the existing guest_config
      const mergedGc = {
        ...fullGuestConfigRef.current,
        showCapacity,
        reservationAlertBySize: alertBySize,
        stationSettings: { flatQueue, showSectionBadge, waitlistTab, queueWidth },
      }
      const floorPlan = { canvasAspect, pages }

      // Save config (guest_config + floor_plan)
      const r1 = await fetch("/api/client/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rid, guest_config: mergedGc, floor_plan: floorPlan, menu_config: { sections: menuSections } }),
      })
      if (!r1.ok) throw new Error("config save failed")

      // Sync capacity to tables DB (table_number + capacity) — all pages combined
      const allTables = pages.flatMap(pg => pg.tables)
      const dbTables = allTables.map(t => ({ table_number: t.number, capacity: t.capacity }))
      await fetch("/api/client/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rid, tables: dbTables }),
      })

      setMsg({ ok: true, text: "Settings saved — changes live immediately" })
    } catch {
      setMsg({ ok: false, text: "Could not save settings" })
    }
    setSaving(false)
    setTimeout(() => setMsg(null), 5000)
  }

  const sel = selectedIdx !== null ? tables[selectedIdx] : null

  if (loading) return (
    <div style={{ padding: 40, textAlign: "center", color: C.muted, fontSize: 13 }}>Loading settings…</div>
  )

  return (
    <div style={{ padding: "24px 24px 60px", maxWidth: 900, margin: "0 auto" }}>

      {onBack && (
        <button onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: C.muted, background: "none", border: "none", cursor: "pointer", padding: "0 0 20px", marginLeft: -2 }}>
          <ChevronLeft size={14} /> Back to Overview
        </button>
      )}

      {/* ── Display settings ── */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 22px", marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: C.muted, marginBottom: 16 }}>
          Display Settings
        </div>

        {/* Capacity toggle */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${C.border}` }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 2 }}>Table capacity labels</div>
            <div style={{ fontSize: 12, color: C.muted }}>Show "4P" on each table on the floor map</div>
          </div>
          <button onClick={() => setShowCapacity(p => !p)}
            style={{ width: 44, height: 24, borderRadius: 12, background: showCapacity ? C.green : C.surface2, border: `1px solid ${showCapacity ? C.greenBdr : C.border}`, position: "relative", cursor: "pointer", transition: "background 0.2s, border-color 0.2s", flexShrink: 0 }}>
            <div style={{ position: "absolute", top: 2, left: showCapacity ? 22 : 2, width: 18, height: 18, borderRadius: "50%", background: showCapacity ? "#fff" : C.muted, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
          </button>
        </div>

        {/* Reservation alert time — per party size */}
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 2 }}>Reservation alert time</div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>Minutes before a reservation when the assigned table turns yellow — set per party size</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
            {([
              { key: "small",  label: "1–2p" },
              { key: "medium", label: "3–4p" },
              { key: "large",  label: "5–6p" },
              { key: "xlarge", label: "7+p"  },
            ] as { key: keyof typeof alertBySize; label: string }[]).map(({ key, label }) => (
              <div key={key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, textAlign: "center" }}>{label}</label>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <input
                    type="number" min={5} max={240}
                    value={alertBySize[key]}
                    onChange={e => setAlertBySize(prev => ({ ...prev, [key]: Math.max(5, Math.min(240, Number(e.target.value))) }))}
                    style={{ flex: 1, padding: "7px 6px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface2, color: C.text, fontSize: 14, fontWeight: 600, textAlign: "center", outline: "none", minWidth: 0 }}
                  />
                  <span style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>m</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Table Map Editor ── */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 22px", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: C.muted }}>
            Table Map
          </div>
          <button onClick={addTable}
            style={{ padding: "5px 14px", borderRadius: 8, background: C.greenBg, border: `1px solid ${C.greenBdr}`, color: C.green, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            + Add Table
          </button>
        </div>

        {/* Page tabs */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
          {pages.map((pg, pi) => (
            <div key={pg.id} style={{ display: "flex", alignItems: "center", gap: 2 }}>
              {renamingPage && pi === pageIdx ? (
                <input
                  autoFocus
                  value={pageNameEdit}
                  onChange={e => setPageNameEdit(e.target.value)}
                  onBlur={() => {
                    const trimmed = pageNameEdit.trim()
                    if (trimmed) setPages(p => p.map((x, i) => i === pi ? { ...x, name: trimmed } : x))
                    setRenamingPage(false)
                  }}
                  onKeyDown={e => {
                    if (e.key === "Enter" || e.key === "Escape") {
                      const trimmed = pageNameEdit.trim()
                      if (e.key === "Enter" && trimmed) setPages(p => p.map((x, i) => i === pi ? { ...x, name: trimmed } : x))
                      setRenamingPage(false)
                    }
                  }}
                  style={{ padding: "3px 8px", borderRadius: 6, border: `1px solid ${C.green}`, background: C.greenBg, color: C.green, fontSize: 12, fontWeight: 600, outline: "none", minWidth: 80 }}
                />
              ) : (
                <button
                  onClick={() => { setPageIdx(pi); setSelectedIdx(null) }}
                  onDoubleClick={() => { setPageIdx(pi); setPageNameEdit(pg.name); setRenamingPage(true) }}
                  style={{ padding: "3px 10px", borderRadius: 6, border: `1px solid ${pi === pageIdx ? C.green : C.border}`, background: pi === pageIdx ? C.greenBg : "transparent", color: pi === pageIdx ? C.green : C.text2, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  {pg.name}
                </button>
              )}
              {pages.length > 1 && pi > 0 && pi === pageIdx && (
                <button
                  onClick={() => {
                    setPages(p => p.filter((_, i) => i !== pi))
                    setPageIdx(Math.max(0, pi - 1))
                    setSelectedIdx(null)
                  }}
                  style={{ padding: "2px 6px", borderRadius: 5, border: `1px solid ${C.redBdr}`, background: C.redBg, color: C.red, fontSize: 11, cursor: "pointer", fontWeight: 700 }}>
                  ×
                </button>
              )}
            </div>
          ))}
          <button
            onClick={() => {
              const newPage: FloorPage = { id: Math.random().toString(36).slice(2, 9), name: pages.length === 1 ? "Patio" : `Page ${pages.length + 1}`, tables: [] }
              setPages(p => [...p, newPage])
              setPageIdx(pages.length)
              setSelectedIdx(null)
            }}
            style={{ padding: "3px 10px", borderRadius: 6, border: `1px solid ${C.border}`, background: "transparent", color: C.muted, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            + Page
          </button>
          <span style={{ fontSize: 10, color: C.muted, marginLeft: 4 }}>(double-click tab to rename)</span>
        </div>

        <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
          {/* Canvas */}
          <div
            ref={canvasRef}
            style={{
              position: "relative",
              width: EDITOR_W,
              height: EDITOR_H,
              background: "#e8ece6",
              borderRadius: 10,
              border: `1.5px solid ${C.border}`,
              overflow: "hidden",
              flexShrink: 0,
              cursor: "default",
              touchAction: "none",
            }}
            onClick={() => setSelectedIdx(null)}
          >
            {/* Grid lines */}
            {[25, 50, 75].map(pct => (
              <div key={`h${pct}`} style={{ position: "absolute", left: 0, right: 0, top: `${pct}%`, borderTop: "1px dashed rgba(0,0,0,0.08)", pointerEvents: "none" }} />
            ))}
            {[25, 50, 75].map(pct => (
              <div key={`v${pct}`} style={{ position: "absolute", top: 0, bottom: 0, left: `${pct}%`, borderLeft: "1px dashed rgba(0,0,0,0.08)", pointerEvents: "none" }} />
            ))}

            {tables.map((t, idx) => {
              const left   = (t.x - t.w / 2) / 100 * EDITOR_W
              const top    = (t.y - t.h / 2) / 100 * EDITOR_H
              const width  = t.w / 100 * EDITOR_W
              const height = t.h / 100 * EDITOR_H
              const isSel  = idx === selectedIdx
              const borderRadius = t.shape === "round" ? "50%" : t.shape === "square" ? 8 : 6
              const clipPath = t.shape === "round"
                ? "circle(50%)"
                : t.shape === "diamond"
                ? "polygon(50% 0%,100% 50%,50% 100%,0% 50%)"
                : undefined
              return (
                <div
                  key={idx}
                  onMouseDown={e => startDrag(e, idx)}
                  onTouchStart={e => startDrag(e, idx)}
                  onClick={e => { e.stopPropagation(); setSelectedIdx(idx) }}
                  style={{
                    position: "absolute", left, top, width, height,
                    borderRadius: clipPath ? undefined : borderRadius,
                    clipPath,
                    background: isSel ? C.green : "#374151",
                    border: clipPath ? undefined : `2px solid ${isSel ? C.green : "rgba(0,0,0,0.25)"}`,
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    cursor: "grab", userSelect: "none", boxShadow: isSel ? `0 0 0 3px ${C.greenBg}` : "0 1px 4px rgba(0,0,0,0.15)",
                    transition: "background 0.1s, border-color 0.1s",
                  }}
                >
                  <span style={{ fontSize: Math.min(width, height) > 40 ? 12 : 9, fontWeight: 800, color: "#fff", lineHeight: 1 }}>
                    {t.number}
                  </span>
                  {showCapacity && width > 32 && (
                    <span style={{ fontSize: 9, color: "rgba(255,255,255,0.75)" }}>{t.capacity}p</span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Table editor panel */}
          {sel !== null && selectedIdx !== null ? (
            <div style={{ flex: 1, minWidth: 180, background: C.surface2, borderRadius: 10, padding: "14px 16px", border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 12 }}>
                Table {sel.number}
              </div>

              <label style={{ fontSize: 11, fontWeight: 600, color: C.text2, display: "block", marginBottom: 4 }}>Table #</label>
              <input type="number" min={1} max={999} value={sel.number}
                onChange={e => updateTable(selectedIdx, { number: Number(e.target.value) })}
                style={{ width: "100%", padding: "6px 10px", borderRadius: 7, border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 13, marginBottom: 10, boxSizing: "border-box", outline: "none" }} />

              <label style={{ fontSize: 11, fontWeight: 600, color: C.text2, display: "block", marginBottom: 4 }}>Shape</label>
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                {(["round", "square", "rect", "diamond"] as const).map(s => (
                  <button key={s}
                    onClick={() => {
                      const isSymmetric = s === "round" || s === "diamond"
                      const defaultW = s === "round" ? 8 : s === "square" ? 9 : s === "rect" ? 15 : 10
                      const defaultH = isSymmetric ? defaultW : 9
                      updateTable(selectedIdx, { shape: s, w: defaultW, h: defaultH })
                    }}
                    style={{ flex: 1, padding: "5px 4px", borderRadius: 6, border: `1px solid ${sel.shape === s ? C.green : C.border}`, background: sel.shape === s ? C.greenBg : "transparent", color: sel.shape === s ? C.green : C.text2, fontSize: 10, fontWeight: 600, cursor: "pointer", textTransform: "capitalize" }}>
                    {s}
                  </button>
                ))}
              </div>

              {/* Size inputs */}
              <label style={{ fontSize: 11, fontWeight: 600, color: C.text2, display: "block", marginBottom: 4 }}>
                {sel.shape === "round" || sel.shape === "diamond" ? "Size" : "Width / Height"}
              </label>
              {sel.shape === "round" || sel.shape === "diamond" ? (
                <input type="number" min={3} max={40} value={sel.w}
                  onChange={e => { const v = Math.max(3, Math.min(40, Number(e.target.value))); updateTable(selectedIdx, { w: v, h: v }) }}
                  style={{ width: "100%", padding: "6px 10px", borderRadius: 7, border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 13, marginBottom: 10, boxSizing: "border-box", outline: "none" }} />
              ) : (
                <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 10, color: C.muted, display: "block", marginBottom: 2 }}>W</label>
                    <input type="number" min={3} max={60} value={sel.w}
                      onChange={e => updateTable(selectedIdx, { w: Math.max(3, Math.min(60, Number(e.target.value))) })}
                      style={{ width: "100%", padding: "6px 8px", borderRadius: 7, border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 13, boxSizing: "border-box", outline: "none" }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 10, color: C.muted, display: "block", marginBottom: 2 }}>H</label>
                    <input type="number" min={3} max={60} value={sel.h}
                      onChange={e => updateTable(selectedIdx, { h: Math.max(3, Math.min(60, Number(e.target.value))) })}
                      style={{ width: "100%", padding: "6px 8px", borderRadius: 7, border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 13, boxSizing: "border-box", outline: "none" }} />
                  </div>
                </div>
              )}

              <label style={{ fontSize: 11, fontWeight: 600, color: C.text2, display: "block", marginBottom: 4 }}>Capacity</label>
              <input type="number" min={1} max={50} value={sel.capacity}
                onChange={e => updateTable(selectedIdx, { capacity: Number(e.target.value) })}
                style={{ width: "100%", padding: "6px 10px", borderRadius: 7, border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 13, marginBottom: 16, boxSizing: "border-box", outline: "none" }} />

              <button onClick={() => deleteTable(selectedIdx)}
                style={{ width: "100%", padding: "7px 0", borderRadius: 7, border: `1px solid ${C.redBdr}`, background: C.redBg, color: C.red, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                Delete Table
              </button>
            </div>
          ) : (
            <div style={{ flex: 1, minWidth: 160, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, fontSize: 12, textAlign: "center", padding: "20px 0" }}>
              Tap a table to edit · drag to reposition
            </div>
          )}
        </div>

        <div style={{ marginTop: 10, fontSize: 11, color: C.muted }}>
          {tables.length} table{tables.length !== 1 ? "s" : ""} on this page · {pages.flatMap(p => p.tables).length} total · Drag to reposition · Select to edit
        </div>
      </div>

      {/* ── Sections ── */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 22px", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: C.muted, marginBottom: 4 }}>Sections</div>
            <div style={{ fontSize: 12, color: C.muted }}>Let guests choose a seating preference when joining the waitlist</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {sectionsMsg && (
              <span style={{ fontSize: 12, fontWeight: 600, color: sectionsMsg.ok ? C.green : C.red }}>{sectionsMsg.text}</span>
            )}
            <button onClick={toggleSections} disabled={sectionsSaving}
              style={{ width: 44, height: 24, borderRadius: 12, background: sections.enabled ? C.green : C.surface2, border: `1px solid ${sections.enabled ? C.greenBdr : C.border}`, position: "relative", cursor: "pointer", transition: "background 0.2s", flexShrink: 0 }}>
              <div style={{ position: "absolute", top: 2, left: sections.enabled ? 22 : 2, width: 18, height: 18, borderRadius: "50%", background: sections.enabled ? "#fff" : C.muted, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
            </button>
          </div>
        </div>

        {sections.enabled && (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              {sections.sections.map(s => (
                <div key={s} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 20, background: C.surface2, border: `1px solid ${C.border}`, fontSize: 13, fontWeight: 600, color: C.text2 }}>
                  {s}
                  <button onClick={() => removeSectionItem(s)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 14, lineHeight: 1, padding: 0, display: "flex", alignItems: "center" }}>×</button>
                </div>
              ))}
              {sections.sections.length === 0 && (
                <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>No sections yet — add one below</div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                placeholder="Section name (e.g. Bar, Patio, Booth)"
                value={newSectionName}
                onChange={e => setNewSectionName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addSectionItem()}
                style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface2, color: C.text, fontSize: 13, outline: "none" }}
              />
              <button onClick={addSectionItem} disabled={!newSectionName.trim()}
                style={{ padding: "8px 16px", borderRadius: 8, background: newSectionName.trim() ? C.greenBg : C.surface2, border: `1px solid ${newSectionName.trim() ? C.greenBdr : C.border}`, color: newSectionName.trim() ? C.green : C.muted, fontSize: 13, fontWeight: 700, cursor: newSectionName.trim() ? "pointer" : "default" }}>
                + Add
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Station Display ── */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 22px", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: C.muted }}>Station Display</div>
          <div style={{ fontSize: 11, color: C.muted }}>auto-saves instantly</div>
        </div>

        {/* Flat queue */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${C.border}` }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 2 }}>Flat queue (no section groups)</div>
            <div style={{ fontSize: 12, color: C.muted }}>Show all waiting guests in one list sorted by arrival time, instead of grouped by section preference</div>
          </div>
          <button onClick={() => setFlatQueue(p => !p)}
            style={{ width: 44, height: 24, borderRadius: 12, background: flatQueue ? C.green : C.surface2, border: `1px solid ${flatQueue ? C.greenBdr : C.border}`, position: "relative", cursor: "pointer", transition: "background 0.2s, border-color 0.2s", flexShrink: 0 }}>
            <div style={{ position: "absolute", top: 2, left: flatQueue ? 22 : 2, width: 18, height: 18, borderRadius: "50%", background: flatQueue ? "#fff" : C.muted, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
          </button>
        </div>

        {/* Section badge */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${C.border}` }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 2 }}>Seating preference badge</div>
            <div style={{ fontSize: 12, color: C.muted }}>Show each guest's seating preference prominently on their card — "FIRST" for sit-anywhere, section name otherwise</div>
          </div>
          <button onClick={() => setShowSectionBadge(p => !p)}
            style={{ width: 44, height: 24, borderRadius: 12, background: showSectionBadge ? C.green : C.surface2, border: `1px solid ${showSectionBadge ? C.greenBdr : C.border}`, position: "relative", cursor: "pointer", transition: "background 0.2s, border-color 0.2s", flexShrink: 0 }}>
            <div style={{ position: "absolute", top: 2, left: showSectionBadge ? 22 : 2, width: 18, height: 18, borderRadius: "50%", background: showSectionBadge ? "#fff" : C.muted, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
          </button>
        </div>

        {/* Waitlist tab */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${C.border}` }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 2 }}>Separate waitlist view</div>
            <div style={{ fontSize: 12, color: C.muted }}>Add a Floor / Waitlist tab to the station so staff can view the full waitlist on its own page</div>
          </div>
          <button onClick={() => setWaitlistTab(p => !p)}
            style={{ width: 44, height: 24, borderRadius: 12, background: waitlistTab ? C.green : C.surface2, border: `1px solid ${waitlistTab ? C.greenBdr : C.border}`, position: "relative", cursor: "pointer", transition: "background 0.2s, border-color 0.2s", flexShrink: 0 }}>
            <div style={{ position: "absolute", top: 2, left: waitlistTab ? 22 : 2, width: 18, height: 18, borderRadius: "50%", background: waitlistTab ? "#fff" : C.muted, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
          </button>
        </div>

        {/* Queue width */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 2 }}>Queue panel width</div>
              <div style={{ fontSize: 12, color: C.muted }}>Default width of the waitlist sidebar — wider means larger cards, smaller floor map</div>
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.text, minWidth: 40, textAlign: "right" }}>{queueWidth}px</span>
          </div>
          <input
            type="range"
            min={260} max={520} step={10}
            value={queueWidth}
            onChange={e => setQueueWidth(Number(e.target.value))}
            style={{ width: "100%", accentColor: C.green, cursor: "pointer" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.muted, marginTop: 2 }}>
            <span>Compact (260px)</span>
            <span>Large (520px)</span>
          </div>
        </div>
      </div>

      {/* ── Menu ── */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 22px", marginBottom: 20 }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: C.muted, marginBottom: 4 }}>Menu</div>
          <div style={{ fontSize: 12, color: C.muted }}>Edit the menu guests see on the join page</div>
        </div>

        {menuSections.length === 0 && (
          <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic", marginBottom: 12 }}>No menu sections yet — add one below</div>
        )}

        {menuSections.map((sec, si) => (
          <div key={sec.id} style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <input
                value={sec.title}
                onChange={e => setMenuSections(p => p.map((s, i) => i === si ? { ...s, title: e.target.value } : s))}
                placeholder="Section title (e.g. Starters)"
                style={{ flex: 1, padding: "6px 10px", borderRadius: 7, border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 13, fontWeight: 700, outline: "none", boxSizing: "border-box" as const }}
              />
              <button
                onClick={() => setMenuSections(p => p.filter((_, i) => i !== si))}
                style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${C.redBdr}`, background: C.redBg, color: C.red, fontSize: 12, cursor: "pointer", fontWeight: 700, flexShrink: 0 }}>
                ×
              </button>
            </div>

            {sec.items.map((item, ii) => (
              <div key={item.id} style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
                <input
                  value={item.name}
                  onChange={e => setMenuSections(p => p.map((s, i) => i === si ? { ...s, items: s.items.map((it, j) => j === ii ? { ...it, name: e.target.value } : it) } : s))}
                  placeholder="Item name"
                  style={{ flex: 2, padding: "5px 8px", borderRadius: 6, border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 12, outline: "none", boxSizing: "border-box" as const }}
                />
                <input
                  value={item.description}
                  onChange={e => setMenuSections(p => p.map((s, i) => i === si ? { ...s, items: s.items.map((it, j) => j === ii ? { ...it, description: e.target.value } : it) } : s))}
                  placeholder="Description (opt.)"
                  style={{ flex: 3, padding: "5px 8px", borderRadius: 6, border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 12, outline: "none", boxSizing: "border-box" as const }}
                />
                <input
                  value={item.price}
                  onChange={e => setMenuSections(p => p.map((s, i) => i === si ? { ...s, items: s.items.map((it, j) => j === ii ? { ...it, price: e.target.value } : it) } : s))}
                  placeholder="Price (opt.)"
                  style={{ flex: 1, padding: "5px 8px", borderRadius: 6, border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 12, outline: "none", boxSizing: "border-box" as const }}
                />
                <button
                  onClick={() => setMenuSections(p => p.map((s, i) => i === si ? { ...s, items: s.items.filter((_, j) => j !== ii) } : s))}
                  style={{ padding: "4px 8px", borderRadius: 5, border: `1px solid ${C.redBdr}`, background: C.redBg, color: C.red, fontSize: 11, cursor: "pointer", fontWeight: 700, flexShrink: 0 }}>
                  ×
                </button>
              </div>
            ))}

            <button
              onClick={() => setMenuSections(p => p.map((s, i) => i === si ? { ...s, items: [...s.items, { id: Math.random().toString(36).slice(2, 9), name: "", description: "", price: "" }] } : s))}
              style={{ marginTop: 4, padding: "5px 12px", borderRadius: 6, border: `1px solid ${C.border}`, background: "transparent", color: C.muted, fontSize: 12, cursor: "pointer" }}>
              + Add item
            </button>
          </div>
        ))}

        <button
          onClick={() => setMenuSections(p => [...p, { id: Math.random().toString(36).slice(2, 9), title: "", items: [] }])}
          style={{ marginTop: 4, padding: "7px 16px", borderRadius: 8, border: `1px solid ${C.greenBdr}`, background: C.greenBg, color: C.green, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          + Add Section
        </button>
      </div>

      {/* ── Save ── */}
      {msg && (
        <div style={{ marginBottom: 12, padding: "10px 16px", borderRadius: 10, background: msg.ok ? C.greenBg : C.redBg, border: `1px solid ${msg.ok ? C.greenBdr : C.redBdr}`, color: msg.ok ? C.green : C.red, fontSize: 13, fontWeight: 600 }}>
          {msg.text}
        </div>
      )}
      <button onClick={saveSettings} disabled={saving}
        style={{ padding: "12px 28px", borderRadius: 12, background: saving ? C.surface2 : C.green, color: saving ? C.muted : "#fff", border: `1px solid ${saving ? C.border : C.green}`, fontWeight: 700, fontSize: 14, cursor: saving ? "default" : "pointer", transition: "all 0.15s", opacity: saving ? 0.7 : 1 }}>
        {saving ? "Saving…" : "Save Floor Map & Menu"}
      </button>
    </div>
  )
}

// ── Export (wrapped in Suspense for useParams) ────────────────────────────────

export default function ClientAdminPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100dvh", background: "#f5f6f8", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#9ca3af", fontSize: 13 }}>Loading…</p>
      </div>
    }>
      <ClientAdminInner />
    </Suspense>
  )
}
