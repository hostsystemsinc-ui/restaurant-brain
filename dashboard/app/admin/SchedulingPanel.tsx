"use client"

import React, { useState, useMemo, useCallback } from "react"
import { Sparkles, Copy, Check, Plus, Info } from "lucide-react"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Role = "server" | "host" | "busser"
type Load = "light" | "moderate" | "busy" | "peak"

interface SlotRow {
  id:    string
  role:  Role
  label: string
  order: number
}

interface ShiftBlock {
  id:          string
  slotId:      string
  day:         number   // 0 = Mon … 6 = Sun
  start:       number   // 24-hour, e.g. 11
  end:         number   // 24-hour, e.g. 15
  aiSuggested: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

const ROLE_META: Record<Role, {
  heading:     string
  color:       string
  bgSection:   string
  bgPill:      string
  borderPill:  string
  borderLeft:  string
}> = {
  server: {
    heading:    "SERVERS",
    color:      "#2563EB",
    bgSection:  "#EFF6FF",
    bgPill:     "#DBEAFE",
    borderPill: "#BFDBFE",
    borderLeft: "#2563EB",
  },
  host: {
    heading:    "HOSTS",
    color:      "#16A34A",
    bgSection:  "#F0FDF4",
    bgPill:     "#DCFCE7",
    borderPill: "#BBF7D0",
    borderLeft: "#16A34A",
  },
  busser: {
    heading:    "BUSSERS",
    color:      "#7C3AED",
    bgSection:  "#F5F3FF",
    bgPill:     "#EDE9FE",
    borderPill: "#DDD6FE",
    borderLeft: "#7C3AED",
  },
}

const SHIFT_PRESETS = [
  { id: "lunch",  label: "Lunch",    start: 11, end: 15 },
  { id: "dinner", label: "Dinner",   start: 17, end: 22 },
  { id: "full",   label: "Full Day", start: 11, end: 22 },
  { id: "mid",    label: "Mid",      start: 14, end: 19 },
  { id: "close",  label: "Close",    start: 18, end: 23 },
] as const

type PresetId = typeof SHIFT_PRESETS[number]["id"]

// Load by day (Mon=0 … Sun=6) — reflects typical Denver casual dining week
const DAY_LOADS: Load[] = ["moderate", "moderate", "moderate", "busy", "peak", "peak", "busy"]

const STAFF_NEEDED: Record<Load, Record<Role, number>> = {
  light:    { server: 2, host: 1, busser: 1 },
  moderate: { server: 3, host: 1, busser: 1 },
  busy:     { server: 4, host: 2, busser: 2 },
  peak:     { server: 5, host: 2, busser: 3 },
}

const LOAD_STYLE: Record<Load, { bg: string; color: string; label: string }> = {
  light:    { bg: "#F0FDF4", color: "#16A34A", label: "Light"    },
  moderate: { bg: "#FFFBEB", color: "#D97706", label: "Moderate" },
  busy:     { bg: "#FFF7ED", color: "#EA580C", label: "Busy"     },
  peak:     { bg: "#FEF2F2", color: "#DC2626", label: "Peak"     },
}

// ─────────────────────────────────────────────────────────────────────────────
// Initial schedule builder
// ─────────────────────────────────────────────────────────────────────────────

function buildSlots(): SlotRow[] {
  return [
    { id: "server-1", role: "server", label: "Server 1", order: 1 },
    { id: "server-2", role: "server", label: "Server 2", order: 2 },
    { id: "server-3", role: "server", label: "Server 3", order: 3 },
    { id: "server-4", role: "server", label: "Server 4", order: 4 },
    { id: "server-5", role: "server", label: "Server 5", order: 5 },
    { id: "host-1",   role: "host",   label: "Host 1",   order: 1 },
    { id: "host-2",   role: "host",   label: "Host 2",   order: 2 },
    { id: "busser-1", role: "busser", label: "Busser 1", order: 1 },
    { id: "busser-2", role: "busser", label: "Busser 2", order: 2 },
    { id: "busser-3", role: "busser", label: "Busser 3", order: 3 },
  ]
}

function buildShifts(): ShiftBlock[] {
  const out: ShiftBlock[] = []
  let n = 0
  const id = () => `ai-${n++}`

  for (let day = 0; day < 7; day++) {
    const load   = DAY_LOADS[day]
    const needed = STAFF_NEEDED[load]

    // Servers — stagger across lunch/dinner/full
    for (let i = 1; i <= needed.server; i++) {
      let start: number, end: number
      if      (i === 1) { start = 11; end = 22 }   // full day
      else if (i === 2) { start = 17; end = 22 }   // dinner
      else if (i === 3) { start = 11; end = 15 }   // lunch
      else if (i === 4) { start = 17; end = 22 }   // extra dinner
      else              { start = 11; end = 22 }   // extra full (peak)
      out.push({ id: id(), slotId: `server-${i}`, day, start, end, aiSuggested: true })
    }

    // Hosts — full day
    for (let i = 1; i <= needed.host; i++) {
      out.push({ id: id(), slotId: `host-${i}`, day, start: 11, end: 22, aiSuggested: true })
    }

    // Bussers — third one is close shift
    for (let i = 1; i <= needed.busser; i++) {
      const start = 11, end = i === 3 ? 23 : 22
      out.push({ id: id(), slotId: `busser-${i}`, day, start, end, aiSuggested: true })
    }
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmt12(h: number): string {
  if (h === 0 || h === 24) return "12 AM"
  if (h === 12)             return "12 PM"
  return h < 12 ? `${h} AM` : `${h - 12} PM`
}

function getWeekDates(offset: number): Date[] {
  const today = new Date()
  const dow   = today.getDay()                         // 0 = Sun
  const mon   = new Date(today)
  mon.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1) + offset * 7)
  mon.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon); d.setDate(mon.getDate() + i); return d
  })
}

function weekLabel(dates: Date[]): string {
  const s = dates[0], e = dates[6]
  const ms = s.toLocaleString("en-US", { month: "short" })
  const me = e.toLocaleString("en-US", { month: "short" })
  return ms === me ? `${ms} ${s.getDate()}–${e.getDate()}` : `${ms} ${s.getDate()} – ${me} ${e.getDate()}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function ShiftPill({
  shift, role, onRemove,
}: { shift: ShiftBlock; role: Role; onRemove: () => void }) {
  const m = ROLE_META[role]
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      background: m.bgPill, border: `1px solid ${m.borderPill}`,
      borderLeft: `3px solid ${m.borderLeft}`,
      borderRadius: 5, padding: "3px 5px 3px 7px",
      marginBottom: 2,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
        {shift.aiSuggested && (
          <Sparkles style={{ width: 7, height: 7, color: m.color, flexShrink: 0 }} />
        )}
        <span style={{ fontSize: 10, fontWeight: 700, color: m.color, whiteSpace: "nowrap" }}>
          {fmt12(shift.start)}–{fmt12(shift.end)}
        </span>
      </div>
      <button
        onClick={e => { e.stopPropagation(); onRemove() }}
        style={{ background: "none", border: "none", cursor: "pointer", color: m.color, opacity: 0.45, fontSize: 14, lineHeight: 1, padding: "0 0 0 4px" }}
        title="Remove shift"
      >×</button>
    </div>
  )
}

function AddPopover({
  onSelect, onClose,
}: { onSelect: (preset: typeof SHIFT_PRESETS[number]) => void; onClose: () => void }) {
  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        position: "absolute", top: 4, left: "50%", transform: "translateX(-50%)",
        background: "#fff", border: "1px solid #E2E8F0", borderRadius: 9,
        boxShadow: "0 4px 20px rgba(0,0,0,0.13)",
        zIndex: 100, padding: 5, minWidth: 130,
      }}
    >
      {SHIFT_PRESETS.map(p => (
        <button
          key={p.id}
          onClick={() => onSelect(p)}
          style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            width: "100%", background: "none", border: "none", cursor: "pointer",
            padding: "6px 10px", borderRadius: 6, textAlign: "left",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "#F1F5F9")}
          onMouseLeave={e => (e.currentTarget.style.background = "none")}
        >
          <span style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>{p.label}</span>
          <span style={{ fontSize: 10, color: "#94A3B8", marginLeft: 8 }}>{fmt12(p.start)}–{fmt12(p.end)}</span>
        </button>
      ))}
      <div style={{ borderTop: "1px solid #F1F5F9", marginTop: 3, paddingTop: 3 }}>
        <button
          onClick={onClose}
          style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "5px 10px", borderRadius: 5, fontSize: 10, color: "#94A3B8", textAlign: "left" }}
        >Cancel</button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function SchedulingPanel() {
  const [slots,      setSlots]      = useState<SlotRow[]>(buildSlots)
  const [shifts,     setShifts]     = useState<ShiftBlock[]>(buildShifts)
  const [weekOffset, setWeekOffset] = useState(0)
  const [activeCell, setActiveCell] = useState<{ slotId: string; day: number } | null>(null)
  const [copied,     setCopied]     = useState(false)

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset])

  const todayIdx = useMemo(() => {
    const t = new Date(); t.setHours(0, 0, 0, 0)
    return weekDates.findIndex(d => d.getTime() === t.getTime())
  }, [weekDates])

  const slotsByRole = useMemo(() => ({
    server: slots.filter(s => s.role === "server").sort((a, b) => a.order - b.order),
    host:   slots.filter(s => s.role === "host"  ).sort((a, b) => a.order - b.order),
    busser: slots.filter(s => s.role === "busser" ).sort((a, b) => a.order - b.order),
  }), [slots])

  const getShifts = useCallback(
    (slotId: string, day: number) => shifts.filter(s => s.slotId === slotId && s.day === day),
    [shifts],
  )

  const dailyTotals = useMemo(() =>
    Array.from({ length: 7 }, (_, day) => ({
      count: new Set(shifts.filter(s => s.day === day).map(s => s.slotId)).size,
      load:  DAY_LOADS[day],
    })),
    [shifts],
  )

  // Actions
  function removeShift(id: string) {
    setShifts(p => p.filter(s => s.id !== id))
    setActiveCell(null)
  }

  function addShift(slotId: string, day: number, preset: typeof SHIFT_PRESETS[number]) {
    const id = `u-${Date.now()}-${Math.random().toString(36).slice(2)}`
    setShifts(p => [...p, { id, slotId, day, start: preset.start, end: preset.end, aiSuggested: false }])
    setActiveCell(null)
  }

  function addSlotRow(role: Role) {
    const existing = slots.filter(s => s.role === role)
    const order    = Math.max(0, ...existing.map(s => s.order)) + 1
    const label    = `${role.charAt(0).toUpperCase() + role.slice(1)} ${order}`
    setSlots(p => [...p, { id: `${role}-${order}`, role, label, order }])
  }

  function removeSlotRow(slotId: string) {
    setSlots(p => p.filter(s => s.id !== slotId))
    setShifts(p => p.filter(s => s.slotId !== slotId))
  }

  function copySchedule() {
    const lines: string[] = [
      `HOST AI Schedule — Walter's303 · ${weekLabel(weekDates)}`,
      `Generated ${new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`,
      "",
    ]
    const roles: Role[] = ["server", "host", "busser"]
    for (const role of roles) {
      lines.push(`${ROLE_META[role].heading}`)
      for (const slot of slotsByRole[role]) {
        const hasAny = shifts.some(s => s.slotId === slot.id)
        if (!hasAny) continue
        lines.push(`  ${slot.label}`)
        for (let d = 0; d < 7; d++) {
          for (const sh of getShifts(slot.id, d)) {
            lines.push(`    ${DAYS[d]}: ${fmt12(sh.start)} – ${fmt12(sh.end)}`)
          }
        }
      }
      lines.push("")
    }
    lines.push("Powered by HOST · tryhostapp.com")
    navigator.clipboard.writeText(lines.join("\n"))
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const roles: Role[] = ["server", "host", "busser"]
  const COL_W  = 116
  const LEFT_W = 132

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      height: "100vh", overflow: "hidden",
      background: "#F8FAFC",
      fontFamily: "var(--font-geist), system-ui, -apple-system, sans-serif",
    }}>

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0,
        display: "flex", alignItems: "center", gap: 8,
        padding: "12px 20px",
        background: "#fff", borderBottom: "1px solid #E2E8F0",
      }}>
        {/* Week nav */}
        <button onClick={() => setWeekOffset(o => o - 1)} style={navBtn}>‹</button>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#0F172A", minWidth: 148, textAlign: "center" }}>
          {weekOffset === -1 ? "Last Week" : weekOffset === 0 ? "This Week" : weekOffset === 1 ? "Next Week" : weekLabel(weekDates)}
          {"  "}
          <span style={{ fontWeight: 400, color: "#94A3B8" }}>{weekLabel(weekDates)}</span>
        </span>
        <button onClick={() => setWeekOffset(o => o + 1)} style={navBtn}>›</button>
        <button
          onClick={() => setWeekOffset(0)}
          style={{ height: 28, padding: "0 10px", borderRadius: 6, border: "1px solid #E2E8F0", background: "#F8FAFC", color: "#475569", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
        >Today</button>

        <div style={{ flex: 1 }} />

        {/* AI badge */}
        <div style={{
          display: "flex", alignItems: "center", gap: 5,
          fontSize: 11, fontWeight: 600, color: "#D9321C",
          background: "#FEF2F2", border: "1px solid #FECACA",
          borderRadius: 6, padding: "4px 10px",
        }}>
          <Sparkles style={{ width: 10, height: 10 }} /> HOST AI Suggested
        </div>

        {/* Copy */}
        <button
          onClick={copySchedule}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            height: 32, padding: "0 14px", borderRadius: 7, cursor: "pointer",
            fontSize: 12, fontWeight: 600,
            background: copied ? "#F0FDF4" : "#F8FAFC",
            border: `1px solid ${copied ? "#BBF7D0" : "#E2E8F0"}`,
            color: copied ? "#16A34A" : "#475569",
            transition: "all 0.2s",
          }}
        >
          {copied
            ? <><Check style={{ width: 12, height: 12 }} /> Copied!</>
            : <><Copy style={{ width: 12, height: 12 }} /> Copy for 7Shifts</>
          }
        </button>

        {/* Publish */}
        <button style={{
          height: 32, padding: "0 18px", borderRadius: 7,
          background: "#D9321C", border: "none", color: "#fff",
          fontSize: 12, fontWeight: 700, cursor: "pointer",
          letterSpacing: "0.02em",
        }}>
          Publish Schedule
        </button>
      </div>

      {/* ── Grid ────────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowX: "auto", overflowY: "auto" }}>
        <table style={{ borderCollapse: "collapse", minWidth: LEFT_W + COL_W * 7, width: "100%", tableLayout: "fixed" }}>

          {/* Column group definitions */}
          <colgroup>
            <col style={{ width: LEFT_W }} />
            {Array.from({ length: 7 }, (_, i) => <col key={i} style={{ width: COL_W }} />)}
          </colgroup>

          {/* Header row */}
          <thead>
            <tr>
              <th style={{
                position: "sticky", left: 0, zIndex: 4,
                background: "#fff", borderBottom: "2px solid #E2E8F0", borderRight: "1px solid #E2E8F0",
                padding: "10px 14px", textAlign: "left",
              }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.13em", textTransform: "uppercase" }}>
                  Position
                </span>
              </th>
              {weekDates.map((d, i) => {
                const isToday = i === todayIdx
                return (
                  <th key={i} style={{
                    borderBottom: "2px solid #E2E8F0", borderRight: "1px solid #F1F5F9",
                    padding: "8px 10px", textAlign: "center",
                    background: isToday ? "#EFF6FF" : "#fff",
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: isToday ? "#2563EB" : "#64748B", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                      {DAYS[i]}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: isToday ? "#2563EB" : "#0F172A", marginTop: 1 }}>
                      {d.getDate()}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>

          <tbody>
            {roles.map(role => {
              const m         = ROLE_META[role]
              const roleSlots = slotsByRole[role]
              return (
                <React.Fragment key={role}>

                  {/* Role section header */}
                  <tr>
                    <td colSpan={8} style={{
                      background: m.bgSection,
                      borderTop: "2px solid #E2E8F0",
                      borderBottom: `1px solid ${m.borderPill}`,
                      padding: "6px 14px",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: m.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 11, fontWeight: 800, color: m.color, letterSpacing: "0.15em", textTransform: "uppercase" }}>
                          {m.heading}
                        </span>
                        <span style={{ fontSize: 10, color: m.color, opacity: 0.55 }}>
                          — {roleSlots.length} position{roleSlots.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </td>
                  </tr>

                  {/* Individual slot rows */}
                  {roleSlots.map(slot => (
                    <tr key={slot.id} style={{ height: 52 }}>

                      {/* Sticky label */}
                      <td style={{
                        position: "sticky", left: 0, zIndex: 2,
                        background: "#FAFAFA",
                        borderRight: "1px solid #E2E8F0",
                        borderBottom: "1px solid #F1F5F9",
                        padding: "6px 12px", verticalAlign: "middle",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>{slot.label}</span>
                          <button
                            onClick={() => removeSlotRow(slot.id)}
                            title={`Remove ${slot.label}`}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#CBD5E1", fontSize: 16, lineHeight: 1, padding: 0, marginLeft: 4 }}
                          >×</button>
                        </div>
                      </td>

                      {/* Day cells */}
                      {Array.from({ length: 7 }, (_, day) => {
                        const cellShifts = getShifts(slot.id, day)
                        const isToday    = day === todayIdx
                        const isActive   = activeCell?.slotId === slot.id && activeCell?.day === day
                        const isEmpty    = cellShifts.length === 0

                        return (
                          <td
                            key={day}
                            onClick={() => isEmpty && setActiveCell(isActive ? null : { slotId: slot.id, day })}
                            style={{
                              borderBottom: "1px solid #F1F5F9",
                              borderRight:  "1px solid #F1F5F9",
                              background:   isToday ? "#F0F7FF" : isActive ? "#F0FDF4" : "#fff",
                              padding:      "5px 6px",
                              verticalAlign: "middle",
                              cursor: isEmpty ? "pointer" : "default",
                              position: "relative",
                              minHeight: 52,
                            }}
                          >
                            {!isEmpty ? (
                              // Shift pills
                              cellShifts.map(sh => (
                                <ShiftPill
                                  key={sh.id}
                                  shift={sh}
                                  role={role}
                                  onRemove={() => removeShift(sh.id)}
                                />
                              ))
                            ) : isActive ? (
                              // Add-shift popover
                              <AddPopover
                                onSelect={p => addShift(slot.id, day, p)}
                                onClose={() => setActiveCell(null)}
                              />
                            ) : (
                              // Empty hint
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 40 }}>
                                <span style={{ fontSize: 20, color: "#E2E8F0", lineHeight: 1, userSelect: "none" }}>+</span>
                              </div>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}

                  {/* Add position row */}
                  <tr key={`add-${role}`}>
                    <td style={{
                      position: "sticky", left: 0, zIndex: 2,
                      background: "#FAFAFA",
                      borderRight: "1px solid #E2E8F0",
                      borderBottom: "1px solid #F1F5F9",
                      padding: "6px 12px",
                    }}>
                      <button
                        onClick={() => addSlotRow(role)}
                        style={{
                          display: "flex", alignItems: "center", gap: 5,
                          background: "none",
                          border: `1px dashed ${m.borderPill}`,
                          borderRadius: 6, padding: "4px 10px",
                          color: m.color, fontSize: 11, fontWeight: 600, cursor: "pointer",
                        }}
                      >
                        <Plus style={{ width: 10, height: 10 }} />
                        Add {role.charAt(0).toUpperCase() + role.slice(1)}
                      </button>
                    </td>
                    {Array.from({ length: 7 }, (_, i) => (
                      <td key={i} style={{ background: "#FAFAFA", borderBottom: "1px solid #F1F5F9", borderRight: "1px solid #F1F5F9" }} />
                    ))}
                  </tr>

                </React.Fragment>
              )
            })}

            {/* Daily totals row */}
            <tr>
              <td style={{
                position: "sticky", left: 0, zIndex: 2,
                background: "#F1F5F9",
                borderRight: "1px solid #E2E8F0",
                borderTop: "2px solid #E2E8F0",
                padding: "10px 14px", verticalAlign: "middle",
              }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  Daily Total
                </span>
              </td>
              {dailyTotals.map(({ count, load }, day) => {
                const ls      = LOAD_STYLE[load]
                const isToday = day === todayIdx
                return (
                  <td key={day} style={{
                    borderTop: "2px solid #E2E8F0",
                    background: isToday ? "#EFF6FF" : "#F8FAFC",
                    textAlign: "center", padding: "8px 6px",
                    verticalAlign: "middle",
                  }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#0F172A" }}>{count}</div>
                    <div style={{
                      fontSize: 10, fontWeight: 700, color: ls.color,
                      background: ls.bg, borderRadius: 4,
                      padding: "1px 6px", display: "inline-block", marginTop: 3,
                    }}>
                      {ls.label}
                    </div>
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Footer tip ──────────────────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0,
        display: "flex", alignItems: "center", gap: 8,
        padding: "9px 20px",
        background: "#FFFBEB", borderTop: "1px solid #FDE68A",
      }}>
        <Info style={{ width: 12, height: 12, color: "#D97706", flexShrink: 0 }} />
        <span style={{ fontSize: 11, color: "#92400E" }}>
          <strong>HOST AI</strong> pre-filled this schedule from your queue data &amp; reservation history.
          Tap any empty cell to add a shift · Click <strong>×</strong> on a pill to remove it · Add positions with the <strong>+ Add</strong> buttons · Hit <strong>Copy for 7Shifts</strong> to paste directly into 7Shifts.
        </span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Style constant
// ─────────────────────────────────────────────────────────────────────────────

const navBtn: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 6,
  border: "1px solid #E2E8F0", background: "#F8FAFC",
  color: "#475569", cursor: "pointer",
  fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center",
}
