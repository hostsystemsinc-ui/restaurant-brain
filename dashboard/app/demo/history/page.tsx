"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import {
  ChevronLeft, RefreshCw, Download, ChevronDown,
  Users, Clock, TrendingUp, TrendingDown, Minus,
  CheckCircle2, XCircle, BarChart2,
} from "lucide-react"

const API                = "https://restaurant-brain-production.up.railway.app"
const DEMO_RESTAURANT_ID = "dec0cafe-0000-4000-8000-000000000001"

// ── Types ──────────────────────────────────────────────────────────────────────

interface GuestLogRecord {
  id:              string
  name:            string
  party_size:      number
  source:          string
  phone:           string | null
  notes:           string | null
  quoted_wait:     number | null
  actual_wait_min: number | null
  joined_ms:       number
  resolved_ms:     number
  status:          "seated" | "removed"
}

// Fallback record from backend API (less detail)
interface ApiHistoryEntry {
  id:           string
  name:         string
  party_size:   number
  status:       "seated" | "removed"
  arrival_time: string
  quoted_wait:  number | null
  phone:        string | null
  notes:        string | null
  source:       string
}

// ── Storage helpers ────────────────────────────────────────────────────────────

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function getGuestLog(dateStr: string): GuestLogRecord[] {
  try {
    return JSON.parse(localStorage.getItem(`host_demo_log_${dateStr}`) ?? "[]")
  } catch { return [] }
}

// Build last-N-days date options
function buildDateOptions(n = 8) {
  const opts: { label: string; value: string }[] = []
  for (let i = 0; i < n; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const val = toLocalDateStr(d)
    opts.push({ label: i === 0 ? "Today" : i === 1 ? "Yesterday" : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }), value: val })
  }
  return opts
}

// ── Formatting helpers ─────────────────────────────────────────────────────────

function fmtTime(ms: number) {
  return new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
}

function fmtDuration(min: number | null) {
  if (min == null) return "—"
  if (min < 1) return "<1m"
  return `${min}m`
}

function fmtSource(s: string) {
  const map: Record<string, string> = { nfc: "NFC", host: "Host", phone: "Phone", web: "Web", app: "App", opentable: "OpenTable", "walk-in": "Walk-in" }
  return map[s?.toLowerCase()] ?? s ?? "—"
}

// ── Excel export ───────────────────────────────────────────────────────────────

async function exportExcel(records: GuestLogRecord[], dateStr: string) {
  const XLSX = (await import("xlsx")).default
  const rows = [
    ["Time In", "Name", "Party Size", "Source", "Quoted Wait (min)", "Actual Wait (min)", "Status", "Phone", "Notes"],
    ...records.map(r => [
      fmtTime(r.joined_ms),
      r.name,
      r.party_size,
      fmtSource(r.source),
      r.quoted_wait ?? "",
      r.actual_wait_min ?? "",
      r.status.charAt(0).toUpperCase() + r.status.slice(1),
      r.phone ?? "",
      r.notes ?? "",
    ])
  ]
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws["!cols"] = [{ wch: 10 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 10 }, { wch: 16 }, { wch: 30 }]

  // Summary block below data
  const summaryStart = rows.length + 2
  const seated = records.filter(r => r.status === "seated")
  const covers = records.reduce((a, r) => a + r.party_size, 0)
  const avgQuoted = seated.length ? Math.round(seated.filter(r => r.quoted_wait).reduce((a, r) => a + (r.quoted_wait ?? 0), 0) / seated.filter(r => r.quoted_wait).length) : null
  const avgActual = seated.length ? Math.round(seated.filter(r => r.actual_wait_min != null).reduce((a, r) => a + (r.actual_wait_min ?? 0), 0) / seated.filter(r => r.actual_wait_min != null).length) : null
  const summaryRows = [
    ["SUMMARY"],
    ["Total Parties", records.length],
    ["Seated", seated.length],
    ["Removed", records.length - seated.length],
    ["Total Covers", covers],
    ["Avg Quoted Wait", avgQuoted != null ? `${avgQuoted} min` : "—"],
    ["Avg Actual Wait", avgActual != null ? `${avgActual} min` : "—"],
  ]
  XLSX.utils.sheet_add_aoa(ws, summaryRows, { origin: { r: summaryStart, c: 0 } })

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Guest Log")
  XLSX.writeFile(wb, `HOST_GuestLog_DemoRestaurant_${dateStr}.xlsx`)
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const searchParams = useSearchParams()
  const isAnalog     = searchParams.get("analog") === "1"

  // Theme tokens — dark (station) vs light (analog)
  const T = isAnalog ? {
    page:       "#FAFAF8",
    header:     "rgba(255,255,255,0.96)",
    headerBdr:  "rgba(0,0,0,0.09)",
    cardBg:     "rgba(0,0,0,0.03)",
    cardBdr:    "rgba(0,0,0,0.07)",
    text:       "#111",
    textSub:    "rgba(0,0,0,0.45)",
    textMuted:  "rgba(0,0,0,0.28)",
    tabActive:  "#111",
    tabInactive:"rgba(0,0,0,0.35)",
    tabBdr:     "rgba(0,0,0,0.12)",
    tabActiveBg:"rgba(0,0,0,0.04)",
    sectionBdr: "rgba(0,0,0,0.06)",
    rowEven:    "rgba(0,0,0,0.02)",
    rowOdd:     "transparent",
    rowBdr:     "rgba(0,0,0,0.04)",
    backColor:  "rgba(0,0,0,0.35)",
    backHref:   "/demo/analog",
  } : {
    page:       "#0A0A0A",
    header:     "rgba(7,4,2,0.98)",
    headerBdr:  "rgba(255,185,100,0.18)",
    cardBg:     "rgba(255,255,255,0.04)",
    cardBdr:    "rgba(255,255,255,0.07)",
    text:       "rgba(255,255,255,0.92)",
    textSub:    "rgba(255,255,255,0.45)",
    textMuted:  "rgba(255,255,255,0.28)",
    tabActive:  "rgba(255,255,255,0.92)",
    tabInactive:"rgba(255,255,255,0.35)",
    tabBdr:     "rgba(255,255,255,0.12)",
    tabActiveBg:"rgba(255,255,255,0.07)",
    sectionBdr: "rgba(255,255,255,0.06)",
    rowEven:    "rgba(255,255,255,0.02)",
    rowOdd:     "transparent",
    rowBdr:     "rgba(255,255,255,0.04)",
    backColor:  "rgba(255,200,150,0.65)",
    backHref:   "/demo/station",
  }

  const dateOptions = useMemo(() => buildDateOptions(), [])

  const [tab,        setTab]        = useState<"log" | "stats">("log")
  const [selectedDate, setSelectedDate] = useState(dateOptions[0].value)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [records,    setRecords]    = useState<GuestLogRecord[]>([])
  const [loading,    setLoading]    = useState(false)
  const [restoring,  setRestoring]  = useState<string | null>(null)
  const [toast,      setToast]      = useState<{ msg: string; type: "ok" | "err" } | null>(null)
  const [exporting,  setExporting]  = useState(false)

  const showToast = (msg: string, type: "ok" | "err") => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  // Load records for selected date — prefer localStorage, fall back to API for today
  const loadRecords = useCallback(async (dateStr: string) => {
    setLoading(true)
    const local = getGuestLog(dateStr)
    const isToday = dateStr === toLocalDateStr(new Date())

    if (local.length > 0) {
      setRecords(local)
      setLoading(false)
      return
    }

    // For today with no local data, try backend API
    if (isToday) {
      try {
        const r = await fetch(`${API}/queue/history?restaurant_id=${DEMO_RESTAURANT_ID}`)
        if (r.ok) {
          const data: ApiHistoryEntry[] = await r.json()
          // Convert to GuestLogRecord shape (less detail — no actual_wait_min)
          const converted: GuestLogRecord[] = data.map(e => ({
            id:              e.id,
            name:            e.name || "Guest",
            party_size:      e.party_size,
            source:          e.source || "walk-in",
            phone:           e.phone,
            notes:           e.notes,
            quoted_wait:     e.quoted_wait,
            actual_wait_min: null,
            joined_ms:       new Date(e.arrival_time).getTime(),
            resolved_ms:     new Date(e.arrival_time).getTime(), // no resolved time from API
            status:          e.status,
          }))
          setRecords(converted)
          setLoading(false)
          return
        }
      } catch {}
    }

    setRecords([])
    setLoading(false)
  }, [])

  useEffect(() => { loadRecords(selectedDate) }, [selectedDate, loadRecords])

  const restore = async (entryId: string) => {
    setRestoring(entryId)
    try {
      const r = await fetch(`${API}/queue/${entryId}/restore`, { method: "POST" })
      if (!r.ok) throw new Error()
      setRecords(prev => prev.filter(e => e.id !== entryId))
      showToast("Guest restored to waitlist", "ok")
    } catch {
      showToast("Could not restore guest.", "err")
    }
    setRestoring(null)
  }

  // ── Computed stats ────────────────────────────────────────────────────────────
  const seated  = records.filter(r => r.status === "seated")
  const removed = records.filter(r => r.status === "removed")
  const covers  = records.reduce((a, r) => a + r.party_size, 0)
  const withActual = seated.filter(r => r.actual_wait_min != null)
  const withQuoted = seated.filter(r => r.quoted_wait != null)
  const avgActual  = withActual.length ? Math.round(withActual.reduce((a, r) => a + (r.actual_wait_min ?? 0), 0) / withActual.length) : null
  const avgQuoted  = withQuoted.length ? Math.round(withQuoted.reduce((a, r) => a + (r.quoted_wait ?? 0), 0) / withQuoted.length) : null
  const accuracy   = avgActual != null && avgQuoted != null ? avgActual - avgQuoted : null

  const hourCounts: Record<number, number> = {}
  records.forEach(r => {
    const h = new Date(r.joined_ms).getHours()
    hourCounts[h] = (hourCounts[h] ?? 0) + 1
  })
  const peakHour = Object.entries(hourCounts).sort((a, b) => Number(b[1]) - Number(a[1]))[0]

  const sourceCounts: Record<string, number> = {}
  records.forEach(r => { const s = fmtSource(r.source); sourceCounts[s] = (sourceCounts[s] ?? 0) + 1 })

  const sizeDistrib: Record<number, number> = {}
  records.forEach(r => { sizeDistrib[r.party_size] = (sizeDistrib[r.party_size] ?? 0) + 1 })

  const isToday = selectedDate === dateOptions[0].value
  const selectedLabel = dateOptions.find(o => o.value === selectedDate)?.label ?? selectedDate

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ height: "100dvh", background: T.page, color: T.text, display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>

      {/* ── Header ── */}
      <header style={{ height: 52, padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", background: T.header, borderBottom: `1px solid ${T.headerBdr}`, backdropFilter: "blur(20px)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Link href={T.backHref} style={{ display: "flex", alignItems: "center", gap: 4, color: T.backColor, textDecoration: "none", fontSize: 13, fontWeight: 500, padding: "4px 6px", borderRadius: 8 }}>
            <ChevronLeft style={{ width: 15, height: 15 }} />
            {isAnalog ? "Analog" : "Station"}
          </Link>
          <span style={{ color: T.textMuted, fontSize: 14 }}>/</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>History</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Date picker */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowDatePicker(p => !p)}
              style={{ display: "flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px", borderRadius: 8, fontSize: 13, fontWeight: 500, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.75)", cursor: "pointer" }}
            >
              {selectedLabel}
              <ChevronDown style={{ width: 13, height: 13, opacity: 0.5 }} />
            </button>
            {showDatePicker && (
              <div style={{ position: "absolute", top: 38, right: 0, width: 180, background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, padding: 4, zIndex: 100 }}>
                {dateOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setSelectedDate(opt.value); setShowDatePicker(false) }}
                    style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", borderRadius: 7, fontSize: 13, fontWeight: opt.value === selectedDate ? 600 : 400, background: opt.value === selectedDate ? "rgba(255,255,255,0.08)" : "transparent", color: opt.value === selectedDate ? "rgba(255,255,255,0.90)" : "rgba(255,255,255,0.55)", border: "none", cursor: "pointer" }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Refresh (today only) */}
          {isToday && tab === "log" && (
            <button
              onClick={() => loadRecords(selectedDate)}
              style={{ width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "1px solid rgba(255,255,255,0.07)", cursor: "pointer", color: "rgba(255,255,255,0.35)" }}
            >
              <RefreshCw style={{ width: 13, height: 13 }} />
            </button>
          )}

          {/* Export */}
          {records.length > 0 && (
            <button
              onClick={async () => {
                setExporting(true)
                try { await exportExcel(records, selectedDate); showToast("Exported to Excel", "ok") }
                catch { showToast("Export failed", "err") }
                setExporting(false)
              }}
              disabled={exporting}
              style={{ display: "flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "rgba(34,197,94,0.08)", color: "rgba(34,197,94,0.80)", border: "1px solid rgba(34,197,94,0.20)", cursor: "pointer", opacity: exporting ? 0.5 : 1 }}
            >
              <Download style={{ width: 13, height: 13 }} />
              {exporting ? "Exporting…" : "Export"}
            </button>
          )}
        </div>
      </header>

      {/* ── Tabs ── */}
      <div style={{ padding: "12px 20px 0", display: "flex", gap: 6, flexShrink: 0, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        {(["log", "stats"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              height: 34, padding: "0 16px", borderRadius: "8px 8px 0 0",
              fontSize: 13, fontWeight: 600,
              background: tab === t ? "rgba(255,255,255,0.07)" : "transparent",
              border: `1px solid ${tab === t ? "rgba(255,255,255,0.12)" : "transparent"}`,
              borderBottom: tab === t ? "2px solid rgba(255,255,255,0.85)" : "1px solid transparent",
              color: tab === t ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.35)",
              cursor: "pointer", transition: "all 0.12s", marginBottom: -1,
            }}
          >
            {t === "log" ? `Guest Log${records.length > 0 ? ` · ${records.length}` : ""}` : "Stats"}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 64 }}>
            <div className="animate-spin" style={{ width: 22, height: 22, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.08)", borderTopColor: "rgba(255,255,255,0.5)" }} />
          </div>

        ) : tab === "log" ? (
          records.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12, textAlign: "center" }}>
              <Clock style={{ width: 32, height: 32, color: "rgba(255,255,255,0.12)" }} />
              <p style={{ fontSize: 15, fontWeight: 500, color: "rgba(255,255,255,0.35)", margin: 0 }}>No records for {selectedLabel.toLowerCase()}</p>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.20)", margin: 0, lineHeight: 1.6, maxWidth: 240 }}>Seated and removed guests will appear here once activity is recorded.</p>
            </div>
          ) : (
            <div style={{ maxWidth: 900, margin: "0 auto" }}>
              {/* Summary strip */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 20 }}>
                {[
                  { label: "Parties",  value: records.length,  unit: "",    icon: <Users style={{ width: 14, height: 14 }} /> },
                  { label: "Covers",   value: covers,          unit: "",    icon: <Users style={{ width: 14, height: 14 }} /> },
                  { label: "Seated",   value: seated.length,   unit: "",    icon: <CheckCircle2 style={{ width: 14, height: 14 }} /> },
                  { label: "Avg Wait", value: avgActual != null ? `${avgActual}m` : avgQuoted != null ? `${avgQuoted}m*` : "—", unit: "", icon: <Clock style={{ width: 14, height: 14 }} /> },
                ].map(({ label, value, icon }) => (
                  <div key={label} style={{ borderRadius: 12, padding: "14px 16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, color: "rgba(255,255,255,0.30)" }}>{icon}<span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const }}>{label}</span></div>
                    <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1, color: "rgba(255,255,255,0.92)", letterSpacing: "-0.02em" }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Guest log table */}
              <div style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden" }}>
                {/* Table header */}
                <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 70px 80px 90px 90px 80px 80px", gap: 0, background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "10px 16px" }}>
                  {["Time In", "Name", "Party", "Source", "Quoted", "Actual", "Status", ""].map(h => (
                    <div key={h} style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.28)" }}>{h}</div>
                  ))}
                </div>

                {/* Rows */}
                {records
                  .slice()
                  .sort((a, b) => b.joined_ms - a.joined_ms)
                  .map((r, i) => (
                    <div
                      key={r.id}
                      style={{
                        display: "grid", gridTemplateColumns: "80px 1fr 70px 80px 90px 90px 80px 80px",
                        alignItems: "center", gap: 0, padding: "12px 16px",
                        background: i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent",
                        borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : "none",
                      }}
                    >
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", fontVariantNumeric: "tabular-nums" }}>{fmtTime(r.joined_ms)}</div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.88)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{r.name}</div>
                        {r.notes && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, marginTop: 1 }}>{r.notes}</div>}
                      </div>
                      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.60)" }}>{r.party_size}p</div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.42)" }}>{fmtSource(r.source)}</div>
                      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", fontVariantNumeric: "tabular-nums" }}>{r.quoted_wait != null ? `${r.quoted_wait}m` : "—"}</div>
                      <div style={{ fontSize: 13, fontVariantNumeric: "tabular-nums", color: r.actual_wait_min != null ? (Math.abs((r.actual_wait_min ?? 0) - (r.quoted_wait ?? 0)) <= 3 ? "#4ade80" : (r.actual_wait_min ?? 0) > (r.quoted_wait ?? 0) ? "#f87171" : "#facc15") : "rgba(255,255,255,0.35)" }}>
                        {fmtDuration(r.actual_wait_min)}
                      </div>
                      <div>
                        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, padding: "3px 8px", borderRadius: 6, background: r.status === "seated" ? "rgba(34,197,94,0.10)" : "rgba(239,68,68,0.10)", color: r.status === "seated" ? "#4ade80" : "#f87171" }}>
                          {r.status}
                        </span>
                      </div>
                      <div>
                        {r.status === "removed" && isToday && (
                          <button
                            onClick={() => restore(r.id)}
                            disabled={restoring === r.id}
                            style={{ height: 28, padding: "0 10px", borderRadius: 7, fontSize: 12, fontWeight: 600, background: "rgba(147,207,255,0.07)", color: "rgba(147,207,255,0.80)", border: "1px solid rgba(147,207,255,0.18)", cursor: "pointer", opacity: restoring === r.id ? 0.4 : 1 }}
                          >
                            {restoring === r.id ? "…" : "Restore"}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
              </div>

              {avgActual == null && avgQuoted != null && (
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.22)", marginTop: 10, textAlign: "center" as const }}>* Actual wait times only recorded when guests are seated from this device.</p>
              )}
            </div>
          )

        ) : (
          // ── Stats tab ────────────────────────────────────────────────────────
          records.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12, textAlign: "center" }}>
              <BarChart2 style={{ width: 32, height: 32, color: "rgba(255,255,255,0.12)" }} />
              <p style={{ fontSize: 15, fontWeight: 500, color: "rgba(255,255,255,0.32)", margin: 0 }}>No data for {selectedLabel.toLowerCase()}</p>
            </div>
          ) : (
            <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>

              {/* KPI cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                {[
                  { label: "Total Parties",  value: records.length,                   sub: `${covers} covers total` },
                  { label: "Seated",         value: seated.length,                    sub: `${removed.length} removed` },
                  { label: "Seat Rate",      value: records.length ? `${Math.round((seated.length / records.length) * 100)}%` : "—", sub: "parties seated" },
                ].map(({ label, value, sub }) => (
                  <div key={label} style={{ borderRadius: 14, padding: "20px 18px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.28)", marginBottom: 8 }}>{label}</div>
                    <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.02em", color: "rgba(255,255,255,0.92)" }}>{value}</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.32)", marginTop: 6 }}>{sub}</div>
                  </div>
                ))}
              </div>

              {/* Wait time accuracy */}
              {(avgActual != null || avgQuoted != null) && (
                <div style={{ borderRadius: 14, padding: "20px 18px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.28)", marginBottom: 16 }}>Wait Time Performance</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 4 }}>Avg Quoted</div>
                      <div style={{ fontSize: 28, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>{avgQuoted != null ? `${avgQuoted}m` : "—"}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 4 }}>Avg Actual</div>
                      <div style={{ fontSize: 28, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>{avgActual != null ? `${avgActual}m` : "—"}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 4 }}>Accuracy</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{
                          fontSize: 28, fontWeight: 700,
                          color: accuracy == null
                            ? "rgba(255,255,255,0.30)"
                            : accuracy < -3   ? "#4ade80"   // beat it — green
                            : accuracy <= 3   ? "#facc15"   // close   — yellow
                            :                  "#f87171"    // over    — red
                        }}>
                          {accuracy == null ? "—" : accuracy < -3 ? "Early" : accuracy <= 3 ? "On Time" : "Late"}
                        </span>
                        {accuracy != null && (
                          accuracy < -3
                            ? <TrendingDown style={{ width: 18, height: 18, color: "#4ade80" }} />
                            : accuracy <= 3
                            ? <Minus style={{ width: 18, height: 18, color: "#facc15" }} />
                            : <TrendingUp style={{ width: 18, height: 18, color: "#f87171" }} />
                        )}
                      </div>
                      {accuracy != null && (
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.32)", marginTop: 2 }}>
                          {accuracy < -3
                            ? `${Math.abs(accuracy)}m faster than quoted`
                            : accuracy > 3
                            ? `${accuracy}m longer than quoted`
                            : `Within ${Math.abs(accuracy)}m of quoted`}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Peak hour + source distribution */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {/* Peak hour */}
                <div style={{ borderRadius: 14, padding: "20px 18px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.28)", marginBottom: 12 }}>Activity by Hour</div>
                  {Object.keys(hourCounts).length === 0 ? (
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.25)" }}>No data</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
                      {Object.entries(hourCounts)
                        .sort((a, b) => Number(a[0]) - Number(b[0]))
                        .map(([h, count]) => {
                          const max = Math.max(...Object.values(hourCounts))
                          const pct = Math.round((count / max) * 100)
                          const hour = Number(h)
                          const label = `${hour % 12 || 12}${hour >= 12 ? "PM" : "AM"}`
                          return (
                            <div key={h} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ width: 44, fontSize: 11, color: "rgba(255,255,255,0.45)", textAlign: "right" as const, flexShrink: 0 }}>{label}</div>
                              <div style={{ flex: 1, height: 20, borderRadius: 4, background: "rgba(255,255,255,0.04)", overflow: "hidden" }}>
                                <div style={{ width: `${pct}%`, height: "100%", background: pct === 100 ? "rgba(251,191,36,0.50)" : "rgba(255,255,255,0.18)", borderRadius: 4, transition: "width 0.4s" }} />
                              </div>
                              <div style={{ width: 20, fontSize: 11, color: "rgba(255,255,255,0.45)", textAlign: "right" as const, flexShrink: 0 }}>{count}</div>
                            </div>
                          )
                        })}
                    </div>
                  )}
                </div>

                {/* Source breakdown */}
                <div style={{ borderRadius: 14, padding: "20px 18px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.28)", marginBottom: 12 }}>Join Source</div>
                  <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
                    {Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]).map(([src, count]) => (
                      <div key={src} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.65)" }}>{src}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 80, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                            <div style={{ width: `${Math.round((count / records.length) * 100)}%`, height: "100%", background: "rgba(255,185,100,0.45)", borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.40)", width: 20, textAlign: "right" as const }}>{count}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Party size distribution */}
                  <div style={{ marginTop: 20 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.28)", marginBottom: 10 }}>Party Size Mix</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
                      {Object.entries(sizeDistrib).sort((a, b) => Number(a[0]) - Number(b[0])).map(([size, count]) => (
                        <div key={size} style={{ borderRadius: 8, padding: "6px 10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", textAlign: "center" as const, minWidth: 44 }}>
                          <div style={{ fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>{count}</div>
                          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.30)", marginTop: 1 }}>{size}p</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Export section */}
              <div style={{ borderRadius: 14, padding: "16px 18px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.75)" }}>Export {selectedLabel} Guest Log</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.30)", marginTop: 2 }}>Download as Excel (.xlsx) with full guest details and summary</div>
                </div>
                <button
                  onClick={async () => {
                    setExporting(true)
                    try { await exportExcel(records, selectedDate); showToast("Exported to Excel", "ok") }
                    catch { showToast("Export failed", "err") }
                    setExporting(false)
                  }}
                  disabled={exporting}
                  style={{ display: "flex", alignItems: "center", gap: 6, height: 36, padding: "0 16px", borderRadius: 9, fontSize: 13, fontWeight: 600, background: "rgba(34,197,94,0.10)", color: "rgba(34,197,94,0.80)", border: "1px solid rgba(34,197,94,0.22)", cursor: "pointer", opacity: exporting ? 0.5 : 1, flexShrink: 0 }}
                >
                  <Download style={{ width: 14, height: 14 }} />
                  {exporting ? "Exporting…" : "Export Excel"}
                </button>
              </div>

            </div>
          )
        )}
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: toast.type === "ok" ? "rgba(34,197,94,0.16)" : "rgba(239,68,68,0.16)", border: `1px solid ${toast.type === "ok" ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.35)"}`, color: toast.type === "ok" ? "#4ade80" : "#f87171", padding: "10px 20px", borderRadius: 10, fontSize: 13, fontWeight: 600, backdropFilter: "blur(12px)", zIndex: 999 }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
