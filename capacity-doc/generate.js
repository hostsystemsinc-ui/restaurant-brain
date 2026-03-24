const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, HeadingLevel, BorderStyle, WidthType, ShadingType,
  VerticalAlign, PageNumber, Header, Footer, LevelFormat, PageBreak,
} = require("docx")
const fs = require("fs")

// ── Colors ────────────────────────────────────────────────────────────────────
const RED     = "D9321C"
const BLACK   = "0C0907"
const DARK    = "0F172A"
const SLATE   = "334155"
const GRAY    = "64748B"
const LGRAY   = "94A3B8"
const WHITE   = "FFFFFF"
const RED_BG  = "FEF2F2"
const AMBER   = "D97706"
const AMBER_BG = "FFFBEB"
const GREEN   = "16A34A"
const GREEN_BG = "F0FDF4"
const BLUE    = "2563EB"
const BLUE_BG  = "EFF6FF"
const SURFACE = "F8FAFC"

const border = (color = "E2E8F0", size = 4) => ({ style: BorderStyle.SINGLE, size, color })
const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }
const allBorders = (color, size) => ({ top: border(color, size), bottom: border(color, size), left: border(color, size), right: border(color, size) })
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder }

// ── Helpers ───────────────────────────────────────────────────────────────────
function run(text, opts = {}) {
  return new TextRun({ text, font: "Arial", size: 22, color: DARK, ...opts })
}

function para(children, opts = {}) {
  if (typeof children === "string") children = [run(children)]
  return new Paragraph({ children, spacing: { after: 80 }, ...opts })
}

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text, font: "Arial", size: 36, bold: true, color: RED })],
    spacing: { before: 360, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: RED, space: 4 } },
  })
}

function h2(text, color = DARK) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text, font: "Arial", size: 28, bold: true, color })],
    spacing: { before: 280, after: 80 },
  })
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    children: [new TextRun({ text, font: "Arial", size: 24, bold: true, color: SLATE })],
    spacing: { before: 200, after: 60 },
  })
}

function body(text, opts = {}) {
  return para([run(text, { size: 22, color: SLATE, ...opts })])
}

function bullet(text, bold_prefix = "") {
  const children = bold_prefix
    ? [run(bold_prefix, { bold: true, color: DARK }), run(text, { color: SLATE })]
    : [run(text, { color: SLATE })]
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    children,
    spacing: { after: 60 },
  })
}

function spacer(before = 120) {
  return new Paragraph({ children: [], spacing: { before, after: 0 } })
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] })
}

// ── Alert box (colored row) ───────────────────────────────────────────────────
function alertBox(icon, title, lines, bg, borderColor, textColor) {
  const cellBorders = allBorders(borderColor, 8)
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [9360],
    rows: [new TableRow({
      children: [new TableCell({
        borders: cellBorders,
        shading: { fill: bg, type: ShadingType.CLEAR },
        margins: { top: 160, bottom: 160, left: 200, right: 200 },
        width: { size: 9360, type: WidthType.DXA },
        children: [
          new Paragraph({
            children: [run(`${icon}  ${title}`, { bold: true, color: textColor, size: 24 })],
            spacing: { after: 60 },
          }),
          ...lines.map(l => new Paragraph({
            children: [run(l, { color: textColor, size: 21 })],
            spacing: { after: 40 },
          })),
        ],
      })],
    })],
  })
}

// ── Main table builder ────────────────────────────────────────────────────────
function makeTable(headers, rows, colWidths) {
  const total = colWidths.reduce((a, b) => a + b, 0)
  const hdrRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => new TableCell({
      borders: allBorders("CBD5E1", 4),
      shading: { fill: "1E293B", type: ShadingType.CLEAR },
      width: { size: colWidths[i], type: WidthType.DXA },
      margins: { top: 100, bottom: 100, left: 140, right: 140 },
      verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({
        children: [run(h, { bold: true, color: WHITE, size: 20 })],
        alignment: AlignmentType.LEFT,
      })],
    })),
  })

  const dataRows = rows.map((row, ri) => new TableRow({
    children: row.map((cell, ci) => {
      const isFirst = ci === 0
      return new TableCell({
        borders: allBorders("E2E8F0", 4),
        shading: { fill: ri % 2 === 0 ? "FFFFFF" : "F8FAFC", type: ShadingType.CLEAR },
        width: { size: colWidths[ci], type: WidthType.DXA },
        margins: { top: 80, bottom: 80, left: 140, right: 140 },
        children: [new Paragraph({
          children: [run(cell, { bold: isFirst, color: isFirst ? DARK : SLATE, size: 21 })],
        })],
      })
    }),
  }))

  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [hdrRow, ...dataRows],
  })
}

// ── Document ──────────────────────────────────────────────────────────────────
const children = []
const add = (...items) => items.forEach(i => children.push(i))

// ── Cover Block ───────────────────────────────────────────────────────────────
add(
  spacer(0),
  new Paragraph({
    children: [run("HOST", { bold: true, size: 72, color: RED })],
    alignment: AlignmentType.LEFT,
    spacing: { after: 40 },
  }),
  new Paragraph({
    children: [run("Platform Capacity & Technology Specification", { size: 30, bold: true, color: DARK })],
    spacing: { after: 40 },
  }),
  new Paragraph({
    children: [run("Confidential — Internal Use Only", { size: 22, color: LGRAY, italics: true })],
    spacing: { after: 40 },
  }),
  new Paragraph({
    children: [run(`Prepared March 2026  ·  hostplatform.net`, { size: 21, color: LGRAY })],
    spacing: { after: 0 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: RED, space: 4 } },
  }),
  spacer(200),
)

// ═══════════════════════════════════════════════════════════════════════════════
// PART 1 — CAPACITY SPECIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════════
add(
  h1("PART 1 — CAPACITY SPECIFICATIONS"),
  body(
    "This section documents the operational capacity of the HOST platform as a whole — " +
    "including the volume of users, restaurants, API calls, database records, and concurrent " +
    "connections the system can sustain before performance degrades or a component fails."
  ),
  spacer(100),
)

// 1.1 — Throughput overview
add(
  h2("1.1  Current Production Limits"),
  body("The following are the real, enforceable ceilings on the live system as of March 2026."),
  spacer(60),
  makeTable(
    ["Component", "Current Limit", "Hard Cap?", "Consequence if Exceeded"],
    [
      ["Simultaneous guest joins (waitlist)",        "~50/min per restaurant",       "No",  "Queue slowdown; Supabase may throttle writes"],
      ["Concurrent dashboard admin sessions",        "Unlimited (stateless)",         "No",  "Railway container CPU spikes above ~200 req/min"],
      ["SMS notifications (Twilio)",                  "1 msg/sec on free trial",       "Yes", "429 rate-limit error; guest not notified"],
      ["Twilio SMS trial balance",                    "$15.50 balance or 0 credits",   "Yes", "All SMS silently fail; no alerting built in"],
      ["AI insight calls (Claude Haiku)",             "~5 req/min at 300 tokens each", "No",  "Anthropic 429; insights panel goes blank"],
      ["Supabase DB connections (Hobby)",             "60 concurrent connections",      "Yes", "Connection pool exhausted; 500 errors"],
      ["Supabase DB storage (Hobby)",                 "500 MB",                         "Yes", "Writes fail; data loss risk"],
      ["Supabase API requests (Hobby)",               "500K/month",                     "Yes", "Requests blocked until next billing cycle"],
      ["Railway backend memory",                      "512 MB RAM (Starter plan)",      "Yes", "OOM kill; app restarts (max 3 retries)"],
      ["Railway request timeout",                     "300 seconds",                    "Yes", "iCal sync / long polls time out"],
      ["Active queue entries per restaurant",         "No code limit enforced",         "No",  "UI performance drops above ~200 entries"],
      ["Reservation records (total)",                 "No code limit enforced",         "No",  "Query speed degrades above ~10K records without indexing"],
      ["iCal external sync timeout",                  "15 seconds per request",         "Yes", "Sync silently skipped; no retry logic"],
      ["Square OAuth token",                          "30-day expiry",                  "Yes", "POS integration disconnects; manual re-auth required"],
    ],
    [2600, 1900, 1000, 3860]
  ),
  spacer(120),
)

// 1.2 — What can crash HOST
add(
  h2("1.2  What Can Crash HOST"),
  body("The following failure scenarios represent the highest-risk paths to a full or partial system outage."),
  spacer(80),
)

add(
  alertBox(
    "🔴", "CRITICAL — Will cause immediate downtime",
    [
      "Supabase connection pool exhausted (60 connections): All reads/writes fail. Every page that calls the API returns a 500 error. Happens if too many Railway instances spin up or long-lived connections are not released.",
      "Railway OOM (Out of Memory) kill: The FastAPI + Uvicorn process uses over 512 MB RAM. App restarts automatically, but up to 3 retries before Railway stops attempting. All in-flight requests during restart are dropped.",
      "Supabase storage hits 500 MB cap: New writes (queue joins, seating events, reservations) are rejected. Existing data remains intact but the app appears broken to users.",
      "Railway service stops (billing or deploy failure): Both frontend (Next.js) and backend (FastAPI) are on Railway. A billing lapse or a broken deploy takes down the entire platform simultaneously.",
    ],
    RED_BG, RED, "991B1B"
  ),
  spacer(120),
  alertBox(
    "🟠", "HIGH — Degrades core functionality",
    [
      "Twilio credits exhausted: SMS 'Table ready' notifications silently fail. Guests are never texted. Host staff would need to notify guests manually. No alerting exists in HOST to flag this condition.",
      "Anthropic API rate limit hit: The AI insights panel goes blank. Not a crash, but the dashboard loses its most visible differentiator. Happens if dashboard auto-refreshes (every 8 seconds) overlap and all trigger an AI call simultaneously.",
      "Square OAuth token expired (30-day expiry): The POS integration disconnects. No guest data is lost, but Square-linked features stop working until the owner re-authenticates manually.",
      "iCal sync source goes down or changes URL: Reservations from OpenTable/Resy/SevenRooms stop syncing. HOST calendar shows stale data with no visible error to staff.",
    ],
    AMBER_BG, AMBER, "92400E"
  ),
  spacer(120),
  alertBox(
    "🟡", "MEDIUM — Reduces reliability, no immediate outage",
    [
      "Supabase API request limit hit (500K/month): All API calls are blocked until the next billing cycle. Typically ~17K requests/day needed to hit this — realistic at 5+ restaurants.",
      "7Shifts/Homebase API key revoked or expired: Schedule publish fails. Staff scheduling still works as a local tool; only the 'push to 7Shifts' button breaks.",
      "Network partition between Railway backend and Supabase: All DB reads/writes fail. Railway backend returns 500. Next.js frontend can still serve cached pages but data is stale.",
      "CORS is fully open (allow_origins=['*']): Any website can call the HOST API. Not a crash risk but a security vulnerability — especially for restaurant data and queue manipulation.",
      "No retry logic on iCal sync: If an external calendar (OpenTable, Resy) returns a temporary 503, the sync fails silently with no automatic retry or operator alert.",
    ],
    AMBER_BG, "FDE68A", "78350F"
  ),
  spacer(100),
)

// 1.3 — Single points of failure
add(
  h2("1.3  Single Points of Failure"),
  body("Components with no redundancy — if one fails, the entire function fails."),
  spacer(60),
  makeTable(
    ["Component", "Function", "Redundancy", "Risk"],
    [
      ["Railway (single region)", "Hosts both frontend + backend",     "None", "Regional outage = full platform down"],
      ["Supabase (single instance)", "All data storage",               "None (Hobby plan)", "Data unavailable during Supabase incidents"],
      ["Twilio phone number",  "All SMS notifications",               "None", "Number flagged as spam = no SMS delivery"],
      ["Anthropic API",        "AI insights panel",                   "None", "Insights go blank on Anthropic incidents"],
      ["iCal URLs (external)", "Reservation sync from 3rd party",     "None", "Single URL — source change breaks sync"],
      ["Square OAuth session", "POS integration",                     "None", "Token expiry = full POS disconnect"],
    ],
    [2200, 2400, 1800, 2960]
  ),
  spacer(100),
)

// 1.4 — Capacity thresholds by restaurant count
add(
  h2("1.4  Scaling Thresholds — Restaurants Onboarded"),
  body("At what point does each component need to be upgraded as HOST adds more restaurants?"),
  spacer(60),
  makeTable(
    ["# Restaurants", "Supabase Requests/Day", "Hits Limit?", "Action Required"],
    [
      ["1 (current)",   "~3,000 – 5,000",   "No (500K/mo cap)",   "No action needed"],
      ["5",             "~15,000 – 25,000",  "No",                  "Monitor usage"],
      ["10",            "~30,000 – 50,000",  "Approaching",         "Upgrade Supabase to Pro ($25/mo)"],
      ["25",            "~75,000 – 125,000", "Yes — will hit cap",  "Supabase Pro + connection pooling (PgBouncer)"],
      ["50+",           "~150,000+",         "Exceeds Hobby",       "Supabase Pro + Railway Team plan + read replicas"],
      ["100+",          "~300,000+",         "Exceeds Pro free tier","Supabase Enterprise or self-hosted Postgres on Railway"],
    ],
    [1600, 2200, 1800, 3760]
  ),
  spacer(100),
)

// 1.5 — Performance tuning
add(
  h2("1.5  Known Performance Gaps to Address Before Scaling"),
  spacer(40),
)
add(
  bullet("No database indexes on queue_entries.status or reservations.date — queries will slow past ~10K rows."),
  bullet("Admin dashboard polls /insights every 8 seconds; this triggers an Anthropic API call every 8 seconds per open tab — expensive and rate-limited."),
  bullet("iCal sync has no retry logic and a 15-second hard timeout — unreliable for restaurants on spotty connections."),
  bullet("CORS is fully open (allow_origins=['*']) — must be locked to hostplatform.net before public launch."),
  bullet("No background worker or job queue — all operations (iCal sync, SMS sends) are synchronous in the request/response cycle."),
  bullet("SMS send failures are logged but not alerted — Twilio credit exhaustion is invisible to HOST operators."),
  bullet("Square OAuth tokens expire every 30 days with no auto-refresh — requires manual re-authentication."),
  spacer(80),
)

add(pageBreak())

// ═══════════════════════════════════════════════════════════════════════════════
// PART 2 — TECHNOLOGY STACK
// ═══════════════════════════════════════════════════════════════════════════════
add(
  h1("PART 2 — TECHNOLOGY STACK"),
  body(
    "This section catalogs every piece of software HOST runs on, their individual capacity limits, " +
    "how they connect to each other, and the current and future cost of each service as the platform grows."
  ),
  spacer(100),
)

// ── Architecture overview
add(
  h2("2.1  Architecture Overview"),
  body("HOST is a multi-layer SaaS platform. Here is how each layer connects:"),
  spacer(60),
  makeTable(
    ["Layer", "Technology", "Role"],
    [
      ["Guest Interface",     "Next.js (React 19)  —  /wait/[id], /join", "NFC tap-to-join, live queue status, leave flow"],
      ["Host Dashboard",      "Next.js (React 19)  —  /station",          "Drag-to-seat queue, floor plan, table management"],
      ["Admin Dashboard",     "Next.js (React 19)  —  /admin",            "Analytics, scheduling, settings, T&C, integrations"],
      ["Backend API",         "FastAPI (Python) + Uvicorn",                "37 REST endpoints; all business logic lives here"],
      ["Database",            "Supabase (PostgreSQL 15)",                  "All persistent data: queue, tables, reservations, settings"],
      ["AI Layer",            "Anthropic Claude Haiku",                    "Real-time insights; called per /insights request"],
      ["SMS Layer",           "Twilio REST API",                           "Queue-ready notifications to guests"],
      ["Scheduling Layer",    "7Shifts / Homebase / When I Work APIs",     "Staff schedule publish; proxied through Next.js API routes"],
      ["POS Layer",           "Square OAuth 2.0",                          "Merchant identity; future order/payment integration"],
      ["Calendar Layer",      "iCal (RFC 5545)",                           "Read external reservations from OpenTable, Resy, etc."],
      ["Hosting",             "Railway (Starter plan)",                    "Runs both Next.js frontend and FastAPI backend"],
    ],
    [2000, 2560, 4800]
  ),
  spacer(100),
)

// ── Service detail cards
add(h2("2.2  Individual Service Breakdown"))
add(spacer(40))

// ─ Railway
add(h3("Railway — Application Hosting"))
add(body("Hosts both the Next.js dashboard and the FastAPI backend as separate Railway services on the same project."))
add(spacer(40))
add(makeTable(
  ["Attribute", "Details"],
  [
    ["Current Plan",       "Starter ($5/mo credit included)"],
    ["RAM",                "512 MB per service"],
    ["CPU",                "Shared vCPU (burstable)"],
    ["Disk",               "1 GB ephemeral (no persistent disk on Starter)"],
    ["Outbound bandwidth", "100 GB/month"],
    ["Restart policy",     "ON_FAILURE, max 3 retries"],
    ["Sleep behavior",     "No sleep on Starter (always-on)"],
    ["Deploy trigger",     "Git push to main branch"],
    ["Upgrade path",       "Team plan: $20/mo base + $0.000463/vCPU-sec, $0.000231/GB-sec"],
    ["Crash risk",         "OOM kill if FastAPI + Uvicorn exceed 512 MB RAM under load"],
  ],
  [3000, 6360]
))
add(spacer(80))

// ─ Supabase
add(h3("Supabase — Database & Backend-as-a-Service"))
add(body("All HOST data lives in Supabase. Key tables: queue_entries, tables, restaurants, reservations, restaurant_settings, camera_events, nfc_tags."))
add(spacer(40))
add(makeTable(
  ["Attribute", "Details"],
  [
    ["Current Plan",          "Free (Hobby)"],
    ["Database size",         "500 MB storage cap"],
    ["API requests",          "500,000/month cap"],
    ["Concurrent connections","60 (no PgBouncer pooling on Free)"],
    ["Realtime connections",  "200 simultaneous"],
    ["Bandwidth",             "5 GB/month"],
    ["Auth users",            "50,000"],
    ["Row-level security",    "Available but not yet enforced"],
    ["Backup policy",         "Daily backups on Pro only — Free has no backups"],
    ["Pausing behavior",      "Projects inactive for 7+ days are paused on Free tier"],
    ["Upgrade: Pro",          "$25/month — 8 GB storage, 5M API req/mo, daily backups, no pausing"],
    ["Upgrade: Team",         "$599/month — SLA, priority support, advanced logs"],
    ["Crash risk",            "Connection pool exhausted at 60 connections; storage cap at 500 MB"],
  ],
  [3000, 6360]
))
add(spacer(80))

// ─ Anthropic
add(h3("Anthropic Claude — AI Insights"))
add(body("Called on every /insights API request from the admin dashboard. Uses claude-haiku-4-5-20251001 with max 300 output tokens."))
add(spacer(40))
add(makeTable(
  ["Attribute", "Details"],
  [
    ["Model used",         "claude-haiku-4-5-20251001 (fastest, cheapest Haiku)"],
    ["Cost per call",      "~$0.0004 per call (300 tokens in + ~150 out at Haiku pricing)"],
    ["Calls per open tab", "~1 call every 8 seconds (dashboard auto-refresh)"],
    ["Daily cost estimate","~$0.07/day per active restaurant (8hr shift, 1 open tab)"],
    ["Rate limit",         "Tier 1: 50 requests/min; exceeding returns 429 — insights go blank"],
    ["Failure behavior",   "Returns None gracefully; dashboard shows no insights (no crash)"],
    ["Upgrade risk",       "At 5+ restaurants with dashboards open simultaneously, rate limit is reachable"],
    ["Recommended fix",    "Cache insights response for 30–60 seconds to reduce call frequency by 4–8x"],
  ],
  [3000, 6360]
))
add(spacer(80))

// ─ Twilio
add(h3("Twilio — SMS Notifications"))
add(body("Sends 'Your table is ready' SMS to guests when host clicks Notify on the station page."))
add(spacer(40))
add(makeTable(
  ["Attribute", "Details"],
  [
    ["Current status",     "Trial account ($15.50 free credit)"],
    ["Trial restriction",  "Can only send to verified numbers — must upgrade for real guests"],
    ["Send rate",          "1 message/second (trial); 100/sec on paid plans"],
    ["Cost (US SMS)",      "~$0.0079/message + $1.15/month phone number"],
    ["Cost at 50 msg/day", "~$11.85/month + number fee"],
    ["Cost at 200 msg/day","~$47.40/month + number fee"],
    ["Failure behavior",   "Errors are caught and logged; queue operation continues — guest not notified"],
    ["No alerting",        "Twilio credit exhaustion is invisible to HOST — must add balance monitoring"],
    ["Upgrade path",       "Upgrade trial to paid, add webhook alert when balance < $5"],
  ],
  [3000, 6360]
))
add(spacer(80))

// ─ 7Shifts
add(h3("7Shifts — Staff Scheduling Integration"))
add(body("Connected via REST API through HOST's /api/7shifts proxy. Allows publishing AI-generated schedules directly to 7Shifts."))
add(spacer(40))
add(makeTable(
  ["Attribute", "Details"],
  [
    ["7Shifts plan required", "The Works ($43.99/location/month) or higher for API access"],
    ["API version",           "v2 (https://api.7shifts.com/v2)"],
    ["Auth",                  "Bearer token, stored in localStorage (client-side only)"],
    ["HOST proxy route",      "POST /api/7shifts — server-side CORS bypass"],
    ["What HOST pushes",      "Open shifts (unassigned) for each scheduled block"],
    ["Rate limits",           "7Shifts: 100 req/min per API key"],
    ["Failure behavior",      "Push fails silently — UI shows 'Shifts pushed' but result not verified"],
    ["Cost to restaurant",    "$43.99/mo (7Shifts) — this is on top of HOST subscription"],
  ],
  [3000, 6360]
))
add(spacer(40))
add(body("Other scheduling platforms supported via CSV import: Homebase ($24.95+/mo), When I Work ($4/user/mo), Deputy ($4.50/user/mo), Sling (free–$4/user/mo)."))
add(spacer(80))

// ─ Square
add(h3("Square — POS Integration"))
add(body("OAuth 2.0 flow connects HOST to a restaurant's Square merchant account. Token is stored server-side."))
add(spacer(40))
add(makeTable(
  ["Attribute", "Details"],
  [
    ["Auth type",          "OAuth 2.0 (standard web flow)"],
    ["Token expiry",       "30 days — requires manual re-auth; no auto-refresh built in"],
    ["Square API version", "2024-01-17"],
    ["Scope",              "MERCHANT_PROFILE_READ (currently — expand as features grow)"],
    ["Square plan cost",   "Free to use Square APIs; Square charges 2.6% + $0.10/in-person transaction"],
    ["Crash risk",         "Token expiry disconnects integration — no automatic alerting"],
    ["Upgrade needed",     "Add token refresh endpoint and ORDERS_READ scope for future order data"],
  ],
  [3000, 6360]
))
add(spacer(80))

// ─ iCal
add(h3("iCal Feed — Reservation Sync (OpenTable, Resy, SevenRooms, Toast Tables)"))
add(body("HOST syncs external reservations by fetching an iCal (.ics) URL. No OAuth required — just a URL paste in Admin → Inputs."))
add(spacer(40))
add(makeTable(
  ["Attribute", "Details"],
  [
    ["Supported sources",  "OpenTable, Resy, SevenRooms, Toast Tables, any RFC 5545 iCal feed"],
    ["Sync method",        "Manual trigger via POST /settings/sync-ical or (future) scheduled job"],
    ["Fetch timeout",      "15 seconds hard limit per sync request"],
    ["Retry logic",        "None — a timeout or 503 from the source silently skips the sync"],
    ["Parsing library",    "Python icalendar (RFC 5545 compliant)"],
    ["Failure behavior",   "Malformed events are skipped; no alert to staff"],
    ["Scheduling cost",    "OpenTable: $39–$249/mo; Resy: ~$0/mo (commission-based); SevenRooms: custom"],
    ["Recommended fix",    "Add APScheduler to run sync 3x/day automatically + alert on consecutive failures"],
  ],
  [3000, 6360]
))
add(spacer(80))

// ─ Next.js / Frontend
add(h3("Next.js (React 19) — Frontend Dashboard"))
add(body("The entire HOST UI: admin dashboard, station view, guest waitlist page, and landing page. Deployed on Railway as a Node.js process."))
add(spacer(40))
add(makeTable(
  ["Attribute", "Details"],
  [
    ["Framework",         "Next.js v16 (App Router) + React 19 + TypeScript 5"],
    ["Styling",           "Tailwind CSS v4 + inline styles"],
    ["Key libraries",     "recharts (charts), @dnd-kit (drag-drop), xlsx (Excel export), lucide-react (icons)"],
    ["Hosting",           "Railway Node.js service (same project as backend)"],
    ["Port",              "3000 (configurable via PORT env)"],
    ["API proxy routes",  "/api/7shifts, /api/homebase, /api/wheniwork, /api/square"],
    ["Build cmd",         "next build → next start -p $PORT"],
    ["Polling interval",  "Admin dashboard: 8s; Guest wait page: 20s; Station: event-driven"],
    ["PWA",               "manifest.json configured — installable on mobile"],
  ],
  [3000, 6360]
))
add(spacer(80))

// ─ FastAPI
add(h3("FastAPI (Python) — Backend API"))
add(body("37 REST endpoints handling all queue, table, reservation, and event logic. Runs with Uvicorn as the ASGI server."))
add(spacer(40))
add(makeTable(
  ["Attribute", "Details"],
  [
    ["Framework",          "FastAPI + Uvicorn (ASGI)"],
    ["Language",           "Python 3.x"],
    ["Key dependencies",   "supabase, anthropic, twilio, icalendar, requests"],
    ["CORS setting",       "allow_origins=['*'] — fully open (security risk for production)"],
    ["Hosting",            "Railway (512 MB RAM, shared CPU)"],
    ["Concurrency model",  "Async (uvicorn async workers)"],
    ["Endpoints",          "37 routes across queue, tables, reservations, events, settings, setup"],
    ["Error handling",     "SMS/AI failures are non-fatal; DB failures return 500"],
    ["iCal export",        "Generates RFC 5545 iCal feed at /reservations.ics — subscribable by calendar apps"],
    ["Timezone",           "America/Denver (hardcoded — must parameterize for multi-city scale)"],
  ],
  [3000, 6360]
))
add(spacer(100))

// 2.3 — How they connect
add(
  h2("2.3  How the Services Connect"),
  body("The following describes the flow of data through HOST on a typical service."),
  spacer(60),
  makeTable(
    ["Event", "Flow"],
    [
      ["Guest taps NFC tag",           "NFC → /join page (Next.js) → POST /queue/join (FastAPI) → Supabase insert"],
      ["Host marks table ready",       "Station (Next.js) → POST /queue/{id}/notify (FastAPI) → Twilio SMS → Guest phone"],
      ["Host seats guest",             "Station (Next.js) → POST /queue/{id}/seat-to-table/{id} (FastAPI) → Supabase update × 2"],
      ["Admin views insights",         "Admin (Next.js) → GET /insights (FastAPI) → Supabase read → Anthropic API → JSON response"],
      ["Admin syncs reservations",     "Admin (Next.js) → POST /settings/sync-ical (FastAPI) → Fetch external .ics → icalendar parse → Supabase upsert"],
      ["Admin publishes schedule",     "SchedulingPanel (Next.js) → POST /api/7shifts (Next.js proxy) → 7Shifts REST API"],
      ["Square connect",               "Admin (Next.js) → Square OAuth redirect → Square callback → /api/square/callback → token stored"],
      ["Guest checks wait status",     "/wait/[id] (Next.js) → GET /queue/{id} (FastAPI) → Supabase read → position + ETA shown"],
    ],
    [2800, 6560]
  ),
  spacer(100),
)

// 2.4 — Cost projections
add(
  h2("2.4  Plans & Cost Projections by Growth Stage"),
  body("Current monthly cost is minimal (mostly free tiers). Below are the projected costs as HOST onboards restaurants."),
  spacer(60),
  makeTable(
    ["Service", "Now (1 rest.)", "5 Restaurants", "25 Restaurants", "100 Restaurants"],
    [
      ["Railway",    "$0 (credit)",  "$10/mo",          "$40/mo",          "$100–200/mo (Team)"],
      ["Supabase",   "$0 (Free)",    "$25/mo (Pro)",     "$25/mo (Pro)",    "$25–599/mo (Pro/Team)"],
      ["Anthropic",  "~$2/mo",       "~$10/mo",          "~$50/mo",         "~$200/mo (optimize first)"],
      ["Twilio",     "$0 (trial)",   "~$50/mo",          "~$250/mo",        "~$1,000/mo"],
      ["7Shifts*",   "$0 (resto pays)","$0",             "$0",              "$0 (restaurant cost)"],
      ["Square",     "$0",           "$0",               "$0",              "$0"],
      ["Domain/DNS", "~$15/yr",      "~$15/yr",          "~$15/yr",         "~$15/yr"],
      ["TOTAL EST.", "~$2–5/mo",     "~$95–100/mo",      "~$365/mo",        "~$1,325–1,800/mo"],
    ],
    [2000, 1700, 1700, 1930, 2030]
  ),
  spacer(60),
  body("* 7Shifts, Homebase, Square, OpenTable, and Resy are costs paid by the restaurant — not by HOST.", { italics: true, color: LGRAY }),
  spacer(100),
)

// 2.5 — Upgrade decision points
add(
  h2("2.5  When to Upgrade Each Service"),
  spacer(40),
  makeTable(
    ["Service", "Upgrade Trigger", "Action", "Monthly Cost Increase"],
    [
      ["Supabase",    "Hitting 500K req/mo OR 60 connections OR 500 MB storage", "Upgrade to Pro",        "+$25/mo"],
      ["Supabase",    "Needing SLA / priority support",                          "Upgrade to Team",       "+$574/mo"],
      ["Railway",     "OOM kills under load OR need >512 MB RAM",                "Upgrade to Team plan",  "+$15–40/mo"],
      ["Railway",     "Multi-region uptime requirement",                         "Add second service region","varies"],
      ["Twilio",      "Trial exhausted OR sending to unverified numbers",        "Upgrade to paid account","~$1.15/mo + usage"],
      ["Anthropic",   "Rate limit hits (50 req/min exceeded)",                   "Upgrade to Tier 2+",    "usage-based"],
      ["Anthropic",   "Cost optimization needed at scale",                       "Add 60-sec insight cache","$0 (code change)"],
      ["7Shifts",     "Restaurant wants live API push (not CSV)",                "Restaurant buys The Works","$43.99/mo (their cost)"],
      ["Square",      "Adding order/payment data to HOST",                       "Expand OAuth scope",     "$0 (code change)"],
    ],
    [1800, 2800, 2400, 2360]
  ),
  spacer(100),
)

// 2.6 — Recommended immediate actions
add(
  h2("2.6  Recommended Actions Before First Paying Customer"),
  spacer(40),
)
add(bullet("Upgrade Twilio to paid account — trial account cannot send SMS to unverified numbers.", "Critical: "))
add(bullet("Lock CORS to hostplatform.net — fully open CORS is a security risk on a production app.", "Critical: "))
add(bullet("Upgrade Supabase to Pro ($25/mo) before onboarding 3+ restaurants — connection pooling and daily backups are needed.", "High: "))
add(bullet("Add insight caching (30–60 sec) in FastAPI to prevent rate-limiting Anthropic with multi-tab dashboard sessions.", "High: "))
add(bullet("Add APScheduler for automatic iCal sync 3× daily and alert on consecutive sync failures.", "Medium: "))
add(bullet("Add Square token refresh logic — 30-day expiry with no auto-refresh will frustrate restaurant owners.", "Medium: "))
add(bullet("Add database indexes on queue_entries.status and reservations.date before data grows past 10K rows.", "Medium: "))
add(bullet("Parameterize timezone (currently hardcoded to America/Denver) to support restaurants outside Colorado.", "Low (pre-expansion): "))
add(spacer(80))

// ── Footer note
add(
  new Paragraph({
    children: [
      run("HOST Systems Inc. · hostplatform.net · legal@hostplatform.net", {
        size: 18, color: LGRAY, italics: true
      })
    ],
    alignment: AlignmentType.CENTER,
    spacing: { before: 240 },
    border: { top: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0", space: 4 } },
  })
)

// ── Build ─────────────────────────────────────────────────────────────────────
const doc = new Document({
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [{
          level: 0,
          format: LevelFormat.BULLET,
          text: "\u2022",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      },
    ],
  },
  styles: {
    default: {
      document: { run: { font: "Arial", size: 22, color: DARK } },
    },
    paragraphStyles: [
      {
        id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal",
        run: { size: 36, bold: true, font: "Arial", color: RED },
        paragraph: { spacing: { before: 360, after: 120 }, outlineLevel: 0 },
      },
      {
        id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal",
        run: { size: 28, bold: true, font: "Arial", color: DARK },
        paragraph: { spacing: { before: 280, after: 80 }, outlineLevel: 1 },
      },
      {
        id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal",
        run: { size: 24, bold: true, font: "Arial", color: SLATE },
        paragraph: { spacing: { before: 200, after: 60 }, outlineLevel: 2 },
      },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      },
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          children: [
            run("HOST  ·  Platform Capacity & Technology Specification", { size: 18, color: LGRAY }),
            run("        CONFIDENTIAL", { size: 16, color: RED, bold: true }),
          ],
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0", space: 2 } },
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          children: [
            run("hostplatform.net  ·  March 2026", { size: 18, color: LGRAY }),
            run("    Page ", { size: 18, color: LGRAY }),
            new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 18, color: LGRAY }),
          ],
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0", space: 2 } },
        })],
      }),
    },
    children,
  }],
})

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync("/Users/aaronjacobs/restaurant-brain/HOST_Capacity_Spec.docx", buf)
  console.log("Saved: /Users/aaronjacobs/restaurant-brain/HOST_Capacity_Spec.docx")
})
