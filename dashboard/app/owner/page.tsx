"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"

// ── Design tokens ──────────────────────────────────────────────────────────────
const D = {
  bg:           "#080C10",
  surface:      "rgba(255,255,255,0.035)",
  surfaceHover: "rgba(255,255,255,0.055)",
  border:       "rgba(255,255,255,0.08)",
  borderStrong: "rgba(255,255,255,0.14)",
  text:         "#FFFFFF",
  text2:        "rgba(255,255,255,0.60)",
  muted:        "rgba(255,255,255,0.28)",
  accent:       "#D9321C",
  green:        "#22C55E",
  greenBg:      "rgba(34,197,94,0.10)",
  greenBorder:  "rgba(34,197,94,0.20)",
  orange:       "#F59E0B",
  orangeBg:     "rgba(245,158,11,0.10)",
  red:          "#EF4444",
  redBg:        "rgba(239,68,68,0.10)",
  blue:         "#60A5FA",
  blueBg:       "rgba(96,165,250,0.10)",
  yellow:       "#FBBF24",
}

const API      = "https://restaurant-brain-production.up.railway.app"
const DEMO_RID = "dec0cafe-0000-4000-8000-000000000001"

const TABS = ["Overview", "Clients", "SMS", "Customizer", "Prompts"]

// ── Customizer editor types ────────────────────────────────────────────────────
type SelectedEl =
  | { type: "background" }
  | { type: "restaurantName" }
  | { type: "tagline" }
  | { type: "partySize" }
  | { type: "joinButton" }
  | { type: "waitMessage" }
  | { type: "progressBar" }
  | { type: "seatedMessage" }
  | { type: "finalButton"; index: number }
  | null

const EDITOR_LAYERS: Record<"Join" | "Waiting" | "Seated", { type: string; icon: string; label: string }[]> = {
  Join: [
    { type: "background",     icon: "🎨", label: "Background" },
    { type: "restaurantName", icon: "🏷️",  label: "Restaurant Name" },
    { type: "partySize",      icon: "👥", label: "Party Size" },
  ],
  Waiting: [
    { type: "background",  icon: "🎨", label: "Background" },
    { type: "progressBar", icon: "📊", label: "Progress Bar" },
    { type: "waitMessage", icon: "💬", label: "Wait Messages" },
  ],
  Seated: [
    { type: "background",   icon: "🎨", label: "Background" },
    { type: "seatedMessage", icon: "💬", label: "Seated Message" },
    { type: "finalButton",  icon: "🔘", label: "Final Buttons" },
  ],
}

function elLabel(el: NonNullable<SelectedEl>): string {
  if (el.type === "background")     return "Background"
  if (el.type === "restaurantName") return "Restaurant Name"
  if (el.type === "tagline")        return "Tagline"
  if (el.type === "partySize")      return "Party Size"
  if (el.type === "joinButton")     return "Join Button"
  if (el.type === "waitMessage")    return "Wait Messages"
  if (el.type === "progressBar")    return "Progress Bar"
  if (el.type === "seatedMessage")  return "Seated Message"
  if (el.type === "finalButton")    return `Button ${(el as { type: "finalButton"; index: number }).index + 1}`
  return "Properties"
}

// ── Types ──────────────────────────────────────────────────────────────────────
type SvcStatus = "up" | "degraded" | "down" | "checking"

interface Svc {
  status:  SvcStatus
  detail:  string
  latency?: number
}

interface RestLive {
  queueNow:       number
  seatedToday:    number
  avgWait:        number
  coversThisWeek: number
  loading:        boolean
  error:          boolean
}

interface DemoReq {
  id:          string
  name:        string
  restaurant:  string
  email:       string
  phone:       string
  city:        string
  type:        string
  submittedAt: string
}

interface GuestConfig {
  bgColor:         string
  accentColor:     string
  buttonTextColor: string
  restaurantName:  string
  tagline:         string
  waitMessages:    string[]
  seatedMessage:   string
  finalButtons:    Array<{ id: string; label: string; url: string; color: string }>
}

// ── Restaurants ────────────────────────────────────────────────────────────────
const RESTS = [
  { id: "walters", name: "Walter's 303",   city: "Denver, CO", rid: null,     dashUrl: "/station",      joinUrl: "https://hostplatform.net/join",      analogUrl: "/analog",      label: "Active" },
  { id: "demo",    name: "Demo Restaurant", city: "Denver, CO", rid: DEMO_RID, dashUrl: "/demo/station", joinUrl: "https://hostplatform.net/demo/join", analogUrl: "/demo/analog", label: "Demo"   },
]

// ── Default guest config ───────────────────────────────────────────────────────
const defaultGuestConfig: GuestConfig = {
  bgColor:         "#000000",
  accentColor:     "#22c55e",
  buttonTextColor: "#ffffff",
  restaurantName:  "Demo Restaurant",
  tagline:         "Powered by HOST",
  waitMessages: [
    "Your spot is saved — feel free to step out.",
    "We'll let you know the moment your table is ready.",
    "Sit tight, we're moving quickly.",
    "Your table is being prepared.",
    "You can leave and come back — we've got your spot.",
  ],
  seatedMessage: "Thanks for dining with us! We hope to see you again soon.",
  finalButtons:  [],
}

// ── Prompt data ────────────────────────────────────────────────────────────────
interface PromptCard {
  category:    string
  title:       string
  description: string
  prompt:      string
  risk:        "Safe" | "Moderate" | "Careful"
}

const PROMPTS: PromptCard[] = [
  {
    category: "Infrastructure",
    title: "Add New Restaurant Client",
    description: "Creates a full restaurant entry in Supabase, sets up their NFC join URL, and adds them to the owner dashboard RESTS array.",
    prompt: `Add a new restaurant client named [Restaurant Name] in [City] to the HOST system. Create their restaurant entry in Supabase with 16 tables, set up their NFC join URL as hostplatform.net/join, and add them to the RESTS array in the owner dashboard.`,
    risk: "Safe",
  },
  {
    category: "Infrastructure",
    title: "Check System Status",
    description: "Verifies Railway deployment health, checks recent deploy logs, and confirms the backend API is responding.",
    prompt: `Check the current Textbelt quota and Railway deployment status. Show me the last 5 Railway deploy logs and confirm the backend is responding correctly.`,
    risk: "Safe",
  },
  {
    category: "Infrastructure",
    title: "Rotate Password / API Key",
    description: "Updates the owner console password and the Textbelt API key in Railway environment variables.",
    prompt: `Update the PASS constant in /owner/page.tsx to a new password: [NEW_PASSWORD]. Also update the TEXTBELT_KEY environment variable in Railway to [NEW_KEY].`,
    risk: "Moderate",
  },
  {
    category: "Guest Experience",
    title: "Change Join SMS Message",
    description: "Updates the SMS message sent to guests when they join the waitlist across all restaurants.",
    prompt: `Change the join SMS message for all restaurants to: [YOUR MESSAGE]. Make sure it still includes the STOP opt-out. Update _send_join_sms in main.py.`,
    risk: "Safe",
  },
  {
    category: "Guest Experience",
    title: "Update Demo Restaurant Menu",
    description: "Replaces the menu content on the guest join page for the demo restaurant.",
    prompt: `Update the demo restaurant menu on the guest join page (/demo/join/page.tsx). Change the menu sections to: [paste menu here]. Keep the same visual format.`,
    risk: "Safe",
  },
  {
    category: "Guest Experience",
    title: "Add Tables to Floor Plan",
    description: "Adds more tables to the demo restaurant floor plan in HOST standard and updates Supabase to match.",
    prompt: `Add [N] more tables to the Demo Restaurant floor plan in HOST standard. Update the FLOOR_PLAN array in /demo/station/page.tsx and also add the matching table entries to Supabase.`,
    risk: "Safe",
  },
  {
    category: "Guest Experience",
    title: "Customize Guest Waiting Page",
    description: "Changes the visual theme and final page buttons on the guest waiting page for a specific restaurant.",
    prompt: `Customize the guest waiting page (/wait/[id]/page.tsx) for [Restaurant Name] so that the background color is [COLOR], the accent color is [COLOR], and the final page shows these buttons: [BUTTON LABEL → URL].`,
    risk: "Moderate",
  },
  {
    category: "Features",
    title: "CSV Export for Guest History",
    description: "Adds a download button to the HOST standard history page that exports the day's guest log as a CSV.",
    prompt: `Add a CSV export button to the HOST standard history page that downloads the guest log for the current business day with columns: Name, Party Size, Quoted Wait, Actual Wait, Seated At, Phone.`,
    risk: "Safe",
  },
  {
    category: "Features",
    title: "Reservation Import Tool",
    description: "Builds an OpenTable/Resy CSV importer for a restaurant's reservations tab in HOST standard.",
    prompt: `Build a reservation import tool for [Restaurant Name] that accepts a CSV export from OpenTable/Resy with columns: name, party_size, time, notes. Add it as a button in HOST standard reservations tab.`,
    risk: "Moderate",
  },
  {
    category: "Features",
    title: "Per-Restaurant Analytics Dashboard",
    description: "Adds an analytics view to the owner console with daily covers trend, avg wait trend, peak hour heatmap, and SMS delivery rate.",
    prompt: `Add a per-restaurant analytics dashboard to the owner console showing: daily covers trend (7 days), avg wait trend, peak hour heatmap, and SMS delivery rate.`,
    risk: "Moderate",
  },
  {
    category: "Fixes",
    title: "Debug Guest Join Page Error",
    description: "Investigates and fixes errors on the guest join page by checking the Railway backend and recent deploy logs.",
    prompt: `The guest join page at hostplatform.net/demo/join is showing an error. Check the /queue/join endpoint on Railway, look at the recent deploy logs, and fix whatever is causing the error.`,
    risk: "Safe",
  },
  {
    category: "Fixes",
    title: "Debug SMS Not Delivering",
    description: "Checks Textbelt quota, verifies the API key is set, and inspects the SMS sending function for errors.",
    prompt: `SMS texts aren't being delivered. Check the Textbelt quota, verify the TEXTBELT_KEY is set in Railway environment variables, and check the _send_sms function in main.py for errors.`,
    risk: "Safe",
  },
  {
    category: "Fixes",
    title: "Fix Timer Discrepancy",
    description: "Debugs why HOST analog and HOST standard show different wait times for the same guest, focusing on timestamp and timezone handling.",
    prompt: `The timer countdown on HOST analog and HOST standard are showing different times for the same guest. Debug the wait_set_at timestamp handling, check for timezone parsing issues, and fix the discrepancy.`,
    risk: "Careful",
  },
  {
    category: "Fixes",
    title: "Fix Table Sync Between Views",
    description: "Investigates why tables show different occupancy states in analog vs standard views and fixes the /tables endpoint or normalizeTables function.",
    prompt: `Tables aren't syncing correctly between HOST analog and HOST standard views. One shows a table as occupied, the other shows it as empty. Debug the /tables endpoint and the normalizeTables function in station/page.tsx.`,
    risk: "Safe",
  },
]

// ── Helpers ────────────────────────────────────────────────────────────────────
function svcDot(s: SvcStatus) {
  if (s === "up")       return D.green
  if (s === "degraded") return D.yellow
  if (s === "down")     return D.red
  return D.muted
}
function svcLabel(s: SvcStatus) {
  if (s === "up")       return "Operational"
  if (s === "degraded") return "Degraded"
  if (s === "down")     return "Down"
  return "Checking…"
}
function fmtTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " · " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
}
function fmtRefresh(d: Date | null) {
  if (!d) return "Never"
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" })
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function OwnerPage() {
  const router = useRouter()
  const [authed,      setAuthed]      = useState(false)
  const [passInput,   setPassInput]   = useState("")
  const [passErr,     setPassErr]     = useState(false)
  const [showPass,    setShowPass]    = useState(false)

  // Tab state
  const [activeTab, setActiveTab] = useState("Overview")

  // Service states
  const [railway,    setRailway]    = useState<Svc>({ status: "checking", detail: "" })
  const [github,     setGithub]     = useState<Svc>({ status: "checking", detail: "" })
  const [textbelt,   setTextbelt]   = useState<Svc>({ status: "checking", detail: "" })
  const [db,         setDb]         = useState<Svc>({ status: "checking", detail: "" })

  // Per-restaurant live data
  const [liveData, setLiveData] = useState<Record<string, RestLive>>({
    walters: { queueNow: 0, seatedToday: 0, avgWait: 0, coversThisWeek: 0, loading: true, error: false },
    demo:    { queueNow: 0, seatedToday: 0, avgWait: 0, coversThisWeek: 0, loading: true, error: false },
  })

  // Demo requests
  const [demoReqs, setDemoReqs] = useState<DemoReq[]>(() => {
    try {
      const cached = localStorage.getItem("host_owner_demo_reqs")
      return cached ? JSON.parse(cached) : []
    } catch { return [] }
  })
  const [demoLoading,   setDemoLoading]   = useState(false)
  const [lastRefresh,   setLastRefresh]   = useState<Date | null>(null)
  const [refreshing,    setRefreshing]    = useState(false)

  // Client tab: localStorage edit fields per restaurant
  const [clientEdits, setClientEdits] = useState<Record<string, { name: string; nfcUrl: string; notes: string }>>(() => {
    try {
      const s = localStorage.getItem("host_client_edits")
      return s ? JSON.parse(s) : {}
    } catch { return {} }
  })
  // Client creds: owner-saved overrides from localStorage; defaults come from server via ownerSecrets
  const [clientCreds, setClientCreds] = useState<Record<string, { username: string; password: string }>>(() => {
    try {
      const s = localStorage.getItem("host_client_creds")
      return s ? JSON.parse(s) : {}
    } catch { return {} }
  })
  const [credSaved,   setCredSaved]   = useState<string | null>(null)

  // Customizer state
  const [guestConfig, setGuestConfig] = useState<GuestConfig>(() => {
    try {
      const s = localStorage.getItem(`host_guest_config_${RESTS[0].id}`)
      return s ? { ...defaultGuestConfig, ...JSON.parse(s) } : defaultGuestConfig
    } catch { return defaultGuestConfig }
  })
  const [configSaved,       setConfigSaved]       = useState(false)
  const [customizerPreview, setCustomizerPreview] = useState<"Join" | "Waiting" | "Seated">("Join")
  const [customizerRestId,  setCustomizerRestId]  = useState<string>(RESTS[0].id)
  const [selectedEl,        setSelectedEl]        = useState<SelectedEl>(null)
  const [dragIdx,           setDragIdx]           = useState<number | null>(null)
  const [dragOverIdx,       setDragOverIdx]       = useState<number | null>(null)

  // SMS tab: quota from textbelt state
  const [textbeltQuota, setTextbeltQuota] = useState<number | null>(null)

  // Secrets fetched server-side — never hardcoded in client
  const [ownerSecrets, setOwnerSecrets] = useState<{
    textbeltKey: string
    textbeltPurchaseUrl: string
    textbeltWhitelistUrl: string
    clientCreds?: Record<string, { username: string; password: string }>
  } | null>(null)

  async function fetchSecrets(token: string) {
    try {
      const r = await fetch("/api/owner/secrets", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      })
      if (r.ok) {
        const data = await r.json()
        setOwnerSecrets(data)
        // Merge server-provided defaults with any locally-saved overrides
        if (data.clientCreds) {
          setClientCreds(prev => ({ ...data.clientCreds, ...prev }))
        }
      }
    } catch { /* non-critical */ }
  }

  useEffect(() => {
    if (sessionStorage.getItem("host_owner_authed") === "1") {
      setAuthed(true)
      const token = sessionStorage.getItem("host_owner_token") || ""
      if (token) fetchSecrets(token)
    }
  }, [])

  useEffect(() => {
    try {
      const s = localStorage.getItem(`host_guest_config_${customizerRestId}`)
      setGuestConfig(s ? { ...defaultGuestConfig, ...JSON.parse(s) } : defaultGuestConfig)
    } catch { setGuestConfig(defaultGuestConfig) }
  }, [customizerRestId])

  // ── Fetch all data ────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setRefreshing(true)

    const t0 = Date.now()
    const [railwayResult, githubResult, textbeltResult] = await Promise.allSettled([
      (async () => {
        const t = Date.now()
        const r = await fetch(`${API}/queue?restaurant_id=${DEMO_RID}`, { cache: "no-store" })
        const ms = Date.now() - t
        return { ok: r.ok, ms }
      })(),
      (async () => {
        const r = await fetch("https://www.githubstatus.com/api/v2/status.json", { cache: "no-store" })
        return await r.json()
      })(),
      (async () => {
        const r = await fetch("/api/textbelt", { cache: "no-store" })
        return await r.json()
      })(),
    ])

    if (railwayResult.status === "fulfilled") {
      const { ok, ms } = railwayResult.value
      setRailway({ status: ok ? (ms > 3000 ? "degraded" : "up") : "down", detail: ok ? `${ms}ms response` : "No response", latency: ms })
      setDb({ status: ok ? "up" : "down", detail: ok ? "Connected" : "Unreachable" })
    } else {
      setRailway({ status: "down", detail: "Request failed" })
      setDb({ status: "down", detail: "Unreachable" })
    }

    if (githubResult.status === "fulfilled") {
      const d = githubResult.value
      const ind: string = d?.status?.indicator ?? "none"
      setGithub({ status: ind === "none" ? "up" : ind === "minor" ? "degraded" : "down", detail: d?.status?.description ?? "" })
    } else {
      setGithub({ status: "down", detail: "Status unavailable" })
    }

    if (textbeltResult.status === "fulfilled") {
      const d = textbeltResult.value
      // Always capture quota if Textbelt returned a number, regardless of other errors
      const quota: number | null = typeof d.quotaRemaining === "number" ? d.quotaRemaining : null
      if (d.error === "TEXTBELT_KEY not configured") {
        // Key not set in dashboard Railway env — user needs to add it there
        setTextbelt({ status: "degraded", detail: "TEXTBELT_KEY not set in dashboard env" })
        setTextbeltQuota(null)
      } else if (quota !== null) {
        setTextbelt({
          status: quota > 0 ? "up" : "down",
          detail: `${quota.toLocaleString()} texts remaining`,
        })
        setTextbeltQuota(quota)
      } else {
        // API reachable but unexpected response — key may be missing in Railway dashboard env
        setTextbelt({ status: "degraded", detail: "TEXTBELT_KEY missing from dashboard Railway env" })
        setTextbeltQuota(null)
      }
    } else {
      setTextbelt({ status: "down", detail: "Quota check failed" })
      setTextbeltQuota(null)
    }

    void t0

    await Promise.all(RESTS.map(async (rest) => {
      setLiveData(prev => ({ ...prev, [rest.id]: { ...prev[rest.id], loading: true, error: false } }))
      try {
        const ridParam = rest.rid ? `?restaurant_id=${rest.rid}` : ""
        const [insRes, qRes] = await Promise.all([
          fetch(`${API}/insights${ridParam}`, { cache: "no-store" }),
          fetch(`${API}/queue${ridParam}`,    { cache: "no-store" }),
        ])
        const ins = insRes.ok ? await insRes.json() : null
        const q   = qRes.ok  ? await qRes.json()   : []

        setLiveData(prev => ({
          ...prev,
          [rest.id]: {
            queueNow:       Array.isArray(q) ? q.filter((e: { status: string }) => ["waiting","ready"].includes(e.status)).length : 0,
            seatedToday:    ins?.parties_seated_today ?? 0,
            avgWait:        Math.round(ins?.avg_wait_estimate ?? 0),
            coversThisWeek: ins?.covers_this_week ?? 0,
            loading:        false,
            error:          false,
          }
        }))
      } catch {
        setLiveData(prev => ({ ...prev, [rest.id]: { ...prev[rest.id], loading: false, error: true } }))
      }
    }))

    setDemoLoading(true)
    try {
      const token = sessionStorage.getItem("host_owner_token") || ""
      const r = await fetch(`/api/demo?secret=${encodeURIComponent(token)}`, { cache: "no-store" })
      if (r.ok) {
        const fresh: DemoReq[] = await r.json()
        setDemoReqs(prev => {
          const map = new Map<string, DemoReq>()
          for (const req of prev)   map.set(req.id, req)
          for (const req of fresh)  map.set(req.id, req)
          const merged = Array.from(map.values()).sort(
            (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
          )
          try { localStorage.setItem("host_owner_demo_reqs", JSON.stringify(merged)) } catch {}
          return merged
        })
      }
    } catch { /* ignore */ }
    setDemoLoading(false)

    setLastRefresh(new Date())
    setRefreshing(false)
  }, [])

  useEffect(() => {
    if (authed) fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed])

  useEffect(() => {
    if (!authed) return
    const t = setInterval(fetchAll, 5 * 60_000)
    return () => clearInterval(t)
  }, [authed, fetchAll])

  async function tryLogin() {
    const token = passInput.trim()
    try {
      const res = await fetch("/api/owner/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: token }),
      })
      if (res.ok) {
        sessionStorage.setItem("host_owner_authed", "1")
        sessionStorage.setItem("host_owner_token", token)
        setAuthed(true)
        setPassErr(false)
        fetchSecrets(token)
      } else {
        setPassErr(true)
      }
    } catch {
      setPassErr(true)
    }
  }
  async function logout() {
    await fetch("/api/owner/auth", { method: "DELETE" }).catch(() => {})
    sessionStorage.removeItem("host_owner_authed")
    sessionStorage.removeItem("host_owner_token")
    setAuthed(false); setPassInput("")
    router.push("/")
  }

  function saveGuestConfig() {
    localStorage.setItem(`host_guest_config_${customizerRestId}`, JSON.stringify(guestConfig))
    setConfigSaved(true)
    setTimeout(() => setConfigSaved(false), 2000)
  }

  function saveClientEdits(id: string, edits: { name: string; nfcUrl: string; notes: string }) {
    const next = { ...clientEdits, [id]: edits }
    setClientEdits(next)
    try { localStorage.setItem("host_client_edits", JSON.stringify(next)) } catch {}
  }

  function getClientEdit(id: string) {
    return clientEdits[id] ?? { name: "", nfcUrl: "", notes: "" }
  }

  function saveClientCred(id: string, cred: { username: string; password: string }) {
    const next = { ...clientCreds, [id]: cred }
    setClientCreds(next)
    try { localStorage.setItem("host_client_creds", JSON.stringify(next)) } catch {}
    setCredSaved(id)
    setTimeout(() => setCredSaved(null), 2000)
  }

  function getClientCred(id: string) {
    return clientCreds[id] ?? { username: id, password: "" }
  }

  const font = "'Inter', system-ui, -apple-system, sans-serif"

  // ── LOGIN GATE ────────────────────────────────────────────────────────────────
  if (!authed) return (
    <div style={{
      minHeight: "100vh", background: D.bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: font, color: D.text,
    }}>
      <div style={{
        width: 380, maxWidth: "92vw",
        background: D.surface,
        border: `1px solid ${D.border}`,
        borderRadius: 10,
        padding: "40px 36px",
      }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1 }}>HOST</div>
          <div style={{ fontSize: 10, fontWeight: 600, color: D.muted, letterSpacing: "0.2em", textTransform: "uppercase", marginTop: 8 }}>
            Owner Console
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: D.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
            Password
          </div>
          <div style={{ position: "relative" }}>
            <input
              type={showPass ? "text" : "password"}
              value={passInput}
              onChange={e => { setPassInput(e.target.value); setPassErr(false) }}
              onKeyDown={e => e.key === "Enter" && tryLogin()}
              placeholder="Enter password…"
              autoFocus
              style={{
                width: "100%", boxSizing: "border-box",
                padding: "11px 42px 11px 14px",
                background: "rgba(255,255,255,0.05)",
                border: `1px solid ${passErr ? "rgba(239,68,68,0.5)" : D.border}`,
                borderRadius: 8, outline: "none",
                color: D.text, fontSize: 14, fontFamily: "monospace",
              }}
            />
            <button
              onClick={() => setShowPass(v => !v)}
              style={{
                position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer", padding: 0,
                color: D.muted, fontSize: 11, lineHeight: 1,
              }}
            >
              {showPass ? "HIDE" : "SHOW"}
            </button>
          </div>
          {passErr && (
            <div style={{ fontSize: 12, color: D.red, marginTop: 6 }}>Incorrect password.</div>
          )}
        </div>

        <button
          onClick={tryLogin}
          style={{
            width: "100%", padding: "12px", borderRadius: 8,
            background: D.accent, border: "none", color: "#fff",
            fontSize: 13, fontWeight: 700, cursor: "pointer", marginTop: 8,
          }}
        >
          Sign In
        </button>

        <div style={{ textAlign: "center", marginTop: 20 }}>
          <a href="/" style={{ fontSize: 12, color: D.muted, textDecoration: "none" }}>← Back to HOST</a>
        </div>
      </div>
    </div>
  )

  // ── DASHBOARD ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: D.bg, fontFamily: font, color: D.text }}>

      {/* ── Nav ── */}
      <div style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(8,12,16,0.95)",
        backdropFilter: "blur(16px)",
        borderBottom: `1px solid ${D.border}`,
      }}>
        {/* Top bar */}
        <div style={{
          height: 56, padding: "0 28px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.04em" }}>HOST</div>
            <div style={{ width: 1, height: 18, background: D.border }} />
            <div style={{ fontSize: 12, fontWeight: 500, color: D.muted, letterSpacing: "0.06em" }}>Owner Console</div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ fontSize: 11, color: D.muted }}>
              Refreshed {fmtRefresh(lastRefresh)}
            </div>
            <button
              onClick={fetchAll}
              disabled={refreshing}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "7px 14px", borderRadius: 7,
                background: D.surface, border: `1px solid ${D.border}`,
                color: D.text2, fontSize: 12, fontWeight: 500,
                cursor: refreshing ? "not-allowed" : "pointer", opacity: refreshing ? 0.5 : 1,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: refreshing ? "spin 1s linear infinite" : "none" }}>
                <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
              </svg>
              Refresh
            </button>
            <button
              onClick={logout}
              style={{
                padding: "7px 14px", borderRadius: 7,
                background: "none", border: `1px solid ${D.border}`,
                color: D.muted, fontSize: 12, fontWeight: 500, cursor: "pointer",
              }}
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Tab nav bar */}
        <div style={{
          padding: "0 28px",
          display: "flex", alignItems: "center", gap: 4,
          height: 44,
        }}>
          {TABS.map(tab => {
            const active = tab === activeTab
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: "6px 16px", borderRadius: 20,
                  background: active ? "rgba(255,255,255,0.10)" : "transparent",
                  border: active ? `1px solid ${D.borderStrong}` : "1px solid transparent",
                  color: active ? D.text : D.text2,
                  fontSize: 13, fontWeight: active ? 600 : 400,
                  cursor: "pointer",
                  transition: "background 0.12s, color 0.12s, border-color 0.12s",
                }}
              >
                {tab}
              </button>
            )
          })}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── Main content ── */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 28px 60px" }}>

        {/* ══════════════════════════════════════════════════════════ */}
        {/* TAB: OVERVIEW                                              */}
        {/* ══════════════════════════════════════════════════════════ */}
        {activeTab === "Overview" && (
          <>
            {/* Service Status */}
            <SectionLabel>Service Status</SectionLabel>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 12,
              marginBottom: 36,
            }}>
              <SvcCard name="HOST API (Railway)" svc={railway} icon={
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
              } extra={railway.latency != null ? `${railway.latency}ms` : undefined} />

              <SvcCard name="GitHub" svc={github} icon={
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>
              } />

              <SvcCard name="Textbelt SMS" svc={textbelt} icon={
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              } />

              <SvcCard name="Backend DB" svc={db} icon={
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
              } />
            </div>

            {/* Restaurants */}
            <SectionLabel>Restaurants</SectionLabel>
            <div style={{
              border: `1px solid ${D.border}`,
              borderRadius: 10,
              overflow: "hidden",
              marginBottom: 36,
            }}>
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 90px 90px 100px 120px 140px",
                padding: "11px 20px",
                background: D.surface,
                borderBottom: `1px solid ${D.border}`,
              }}>
                {["Restaurant","Status","In Queue","Seated Today","Avg Wait",""].map((h, i) => (
                  <div key={i} style={{ fontSize: 11, fontWeight: 600, color: D.muted, letterSpacing: "0.08em", textTransform: "uppercase", textAlign: i >= 2 ? "center" : "left" }}>
                    {h}
                  </div>
                ))}
              </div>

              {RESTS.map((rest, idx) => {
                const live = liveData[rest.id]
                return (
                  <div
                    key={rest.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 90px 90px 100px 120px 140px",
                      padding: "16px 20px",
                      borderBottom: idx < RESTS.length - 1 ? `1px solid ${D.border}` : "none",
                      alignItems: "center",
                      background: "transparent",
                      transition: "background 0.12s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = D.surfaceHover)}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: D.text }}>{rest.name}</div>
                      <div style={{ fontSize: 12, color: D.muted, marginTop: 2 }}>{rest.city}</div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{
                        width: 7, height: 7, borderRadius: "50%",
                        background: rest.label === "Active" ? D.green : D.orange,
                        flexShrink: 0,
                      }} />
                      <span style={{ fontSize: 12, color: rest.label === "Active" ? D.green : D.orange, fontWeight: 500 }}>
                        {rest.label}
                      </span>
                    </div>

                    <LiveNum live={live} value={live.queueNow} />
                    <LiveNum live={live} value={live.seatedToday} />

                    <div style={{ textAlign: "center" }}>
                      {live.loading ? (
                        <span style={{ fontSize: 13, color: D.muted }}>—</span>
                      ) : live.error ? (
                        <span style={{ fontSize: 13, color: D.red }}>Error</span>
                      ) : (
                        <span style={{ fontSize: 14, fontWeight: 600, color: live.avgWait > 0 ? D.text : D.muted }}>
                          {live.avgWait > 0 ? `${live.avgWait}m` : "—"}
                        </span>
                      )}
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <a
                        href={rest.dashUrl}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          fontSize: 12, fontWeight: 600, color: D.text2,
                          textDecoration: "none",
                          padding: "7px 12px", borderRadius: 7,
                          border: `1px solid ${D.border}`,
                          background: D.surface,
                          transition: "border-color 0.12s, color 0.12s",
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = D.borderStrong; (e.currentTarget as HTMLElement).style.color = D.text }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = D.border; (e.currentTarget as HTMLElement).style.color = D.text2 }}
                      >
                        Open Dashboard
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M7 17L17 7"/><path d="M7 7h10v10"/></svg>
                      </a>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Demo Requests */}
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: D.muted, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                Demo Requests
              </div>
              {demoReqs.length > 0 && (
                <div style={{
                  fontSize: 11, fontWeight: 700, color: D.text,
                  background: D.accent, borderRadius: 100,
                  padding: "2px 8px", lineHeight: 1.5,
                }}>
                  {demoReqs.length}
                </div>
              )}
            </div>

            {demoLoading ? (
              <div style={{ fontSize: 13, color: D.muted, padding: "24px 0" }}>Loading…</div>
            ) : demoReqs.length === 0 ? (
              <div style={{
                border: `1px solid ${D.border}`, borderRadius: 10,
                padding: "32px 20px", textAlign: "center",
                color: D.muted, fontSize: 13,
              }}>
                No demo requests yet. Submissions from hostplatform.net will appear here.
              </div>
            ) : (
              <div style={{ border: `1px solid ${D.border}`, borderRadius: 10, overflow: "hidden" }}>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1.2fr 100px 100px 100px 170px",
                  padding: "11px 20px",
                  background: D.surface,
                  borderBottom: `1px solid ${D.border}`,
                }}>
                  {["Name","Restaurant","Email","Phone","City","Type","Submitted"].map((h, i) => (
                    <div key={i} style={{ fontSize: 11, fontWeight: 600, color: D.muted, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                      {h}
                    </div>
                  ))}
                </div>

                {demoReqs.map((req, idx) => (
                  <div
                    key={req.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1.2fr 100px 100px 100px 170px",
                      padding: "14px 20px",
                      borderBottom: idx < demoReqs.length - 1 ? `1px solid ${D.border}` : "none",
                      alignItems: "center",
                      background: "transparent",
                      transition: "background 0.12s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = D.surfaceHover)}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <Cell>{req.name}</Cell>
                    <Cell>{req.restaurant}</Cell>
                    <Cell>
                      <a href={`mailto:${req.email}`} style={{ color: D.blue, textDecoration: "none", fontSize: 13 }}>
                        {req.email}
                      </a>
                    </Cell>
                    <Cell muted={!req.phone}>{req.phone || "—"}</Cell>
                    <Cell muted={!req.city}>{req.city || "—"}</Cell>
                    <Cell muted={!req.type}>{req.type || "—"}</Cell>
                    <div style={{ fontSize: 12, color: D.muted }}>{fmtTime(req.submittedAt)}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* TAB: CLIENTS                                               */}
        {/* ══════════════════════════════════════════════════════════ */}
        {activeTab === "Clients" && (
          <>
            <SectionLabel>Client Restaurants</SectionLabel>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 18,
            }}>
              {RESTS.map(rest => {
                const live = liveData[rest.id]
                const edit = getClientEdit(rest.id)
                const isDemo = rest.id === "demo"

                return (
                  <div
                    key={rest.id}
                    style={{
                      background: D.surface,
                      border: `1px solid ${D.border}`,
                      borderRadius: 10,
                      padding: "24px",
                    }}
                  >
                    {/* Header */}
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18 }}>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: D.text }}>{rest.name}</div>
                        <div style={{ fontSize: 12, color: D.muted, marginTop: 3 }}>{rest.city}</div>
                      </div>
                      <div style={{
                        fontSize: 11, fontWeight: 600,
                        color: rest.label === "Active" ? D.green : D.orange,
                        background: rest.label === "Active" ? D.greenBg : D.orangeBg,
                        border: `1px solid ${rest.label === "Active" ? D.greenBorder : "rgba(245,158,11,0.25)"}`,
                        borderRadius: 20, padding: "4px 10px",
                      }}>
                        {rest.label}
                      </div>
                    </div>

                    {/* Live stats */}
                    <div style={{
                      display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
                      gap: 10, marginBottom: 20,
                    }}>
                      {[
                        { label: "Queue Now",      value: live.loading ? "—" : live.error ? "Err" : String(live.queueNow) },
                        { label: "Seated Today",   value: live.loading ? "—" : live.error ? "Err" : String(live.seatedToday) },
                        { label: "Avg Wait",       value: live.loading ? "—" : live.error ? "Err" : live.avgWait > 0 ? `${live.avgWait}m` : "—" },
                        { label: "Covers / Week",  value: live.loading ? "—" : live.error ? "Err" : String(live.coversThisWeek) },
                      ].map(stat => (
                        <div key={stat.label} style={{
                          background: "rgba(255,255,255,0.03)",
                          border: `1px solid ${D.border}`,
                          borderRadius: 8, padding: "12px 10px", textAlign: "center",
                        }}>
                          <div style={{ fontSize: 18, fontWeight: 700, color: D.text }}>{stat.value}</div>
                          <div style={{ fontSize: 10, color: D.muted, marginTop: 3, letterSpacing: "0.04em" }}>{stat.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* SMS status chip */}
                    <div style={{ marginBottom: 18 }}>
                      <div style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        fontSize: 11, fontWeight: 600,
                        color: textbelt.status === "up" ? D.green : D.yellow,
                        background: textbelt.status === "up" ? D.greenBg : D.orangeBg,
                        border: `1px solid ${textbelt.status === "up" ? D.greenBorder : "rgba(245,158,11,0.25)"}`,
                        borderRadius: 20, padding: "4px 10px",
                      }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                        SMS {textbelt.status === "up" ? "Active" : "Degraded"}
                        {textbeltQuota != null && ` · ${textbeltQuota.toLocaleString()} left`}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
                      <a
                        href={rest.dashUrl}
                        style={{
                          flex: 1, textAlign: "center", textDecoration: "none",
                          padding: "9px 12px", borderRadius: 7, fontSize: 12, fontWeight: 600,
                          background: D.accent, color: "#fff", border: "none",
                        }}
                      >
                        HOST Standard
                      </a>
                      <a
                        href={rest.analogUrl}
                        style={{
                          flex: 1, textAlign: "center", textDecoration: "none",
                          padding: "9px 12px", borderRadius: 7, fontSize: 12, fontWeight: 600,
                          background: D.surface, color: D.text2,
                          border: `1px solid ${D.border}`,
                        }}
                      >
                        Analog
                      </a>
                      <a
                        href={rest.joinUrl}
                        target="_blank" rel="noreferrer"
                        style={{
                          flex: 1, textAlign: "center", textDecoration: "none",
                          padding: "9px 12px", borderRadius: 7, fontSize: 12, fontWeight: 600,
                          background: D.surface, color: D.text2,
                          border: `1px solid ${D.border}`,
                        }}
                      >
                        Guest Join ↗
                      </a>
                    </div>

                    {/* Edit section */}
                    <div style={{ borderTop: `1px solid ${D.border}`, paddingTop: 18 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: D.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>
                        Details
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        <div>
                          <label style={{ fontSize: 11, color: D.muted, display: "block", marginBottom: 5 }}>Restaurant Name</label>
                          <input
                            type="text"
                            value={edit.name}
                            placeholder={rest.name}
                            onChange={e => saveClientEdits(rest.id, { ...edit, name: e.target.value })}
                            style={inputStyle}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, color: D.muted, display: "block", marginBottom: 5 }}>NFC / QR Join URL</label>
                          <input
                            type="text"
                            value={edit.nfcUrl || rest.joinUrl}
                            onChange={e => saveClientEdits(rest.id, { ...edit, nfcUrl: e.target.value })}
                            style={{ ...inputStyle, fontFamily: "monospace", fontSize: 11 }}
                          />
                          <div style={{ fontSize: 10, color: D.muted, marginTop: 4 }}>This is the URL guests scan/tap to join the waitlist.</div>
                        </div>
                        <div>
                          <label style={{ fontSize: 11, color: D.muted, display: "block", marginBottom: 5 }}>Notes</label>
                          <textarea
                            value={edit.notes}
                            placeholder="Internal notes…"
                            onChange={e => saveClientEdits(rest.id, { ...edit, notes: e.target.value })}
                            rows={2}
                            style={{ ...inputStyle, resize: "vertical", fontFamily: font }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Credentials section */}
                    <div style={{ borderTop: `1px solid ${D.border}`, paddingTop: 18, marginTop: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: D.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>
                        Login Credentials
                      </div>
                      <div style={{ fontSize: 11, color: D.muted, marginBottom: 12 }}>
                        Used at <span style={{ fontFamily: "monospace", color: D.text2 }}>hostplatform.net/login/client</span>
                      </div>
                      <CredentialsEditor
                        id={rest.id}
                        cred={getClientCred(rest.id)}
                        saved={credSaved === rest.id}
                        onSave={cred => saveClientCred(rest.id, cred)}
                        inputStyle={inputStyle}
                        D={D}
                        font={font}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* TAB: SMS                                                   */}
        {/* ══════════════════════════════════════════════════════════ */}
        {activeTab === "SMS" && (
          <>
            <SectionLabel>SMS Management</SectionLabel>

            {/* Quota display */}
            <div style={{
              background: D.surface,
              border: `1px solid ${D.border}`,
              borderRadius: 10,
              padding: "32px 28px",
              marginBottom: 20,
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: D.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>
                Textbelt Quota
              </div>

              {textbeltQuota != null ? (
                <>
                  <div style={{ fontSize: 48, fontWeight: 900, letterSpacing: "-0.03em", color: textbeltQuota > 500 ? D.green : textbeltQuota >= 100 ? D.yellow : D.red, marginBottom: 6 }}>
                    {textbeltQuota.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 14, color: D.text2, marginBottom: 20 }}>
                    texts remaining
                  </div>
                  {/* Progress bar — assume 2000 as full */}
                  <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 100, height: 8, overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      width: `${Math.min(100, (textbeltQuota / 2000) * 100)}%`,
                      background: textbeltQuota > 500 ? D.green : textbeltQuota >= 100 ? D.yellow : D.red,
                      borderRadius: 100,
                      transition: "width 0.4s ease",
                    }} />
                  </div>
                  <div style={{ fontSize: 11, color: D.muted, marginTop: 8 }}>
                    {textbeltQuota > 500 ? "Healthy — plenty of quota remaining" :
                     textbeltQuota >= 100 ? "Low — consider purchasing more credits soon" :
                     "Critical — purchase credits immediately"}
                  </div>
                </>
              ) : (
                <div>
                  <div style={{ fontSize: 14, color: D.muted, marginBottom: 12 }}>
                    {textbelt.detail || "Quota unavailable — check API key configuration"}
                  </div>
                  {/* Show degraded reason clearly */}
                  {textbelt.status === "degraded" && (
                    <div style={{ fontSize: 12, color: D.orange, background: D.orangeBg, border: `1px solid rgba(245,158,11,0.2)`, borderRadius: 8, padding: "10px 14px", lineHeight: 1.6 }}>
                      <strong>Why degraded?</strong> The dashboard's Railway project needs <code style={{ background: "rgba(255,255,255,0.08)", padding: "1px 5px", borderRadius: 4 }}>TEXTBELT_KEY</code> added as an environment variable. This is separate from the Python backend env — add it in the Next.js service on Railway.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* API Key reference */}
            <ApiKeyRow apiKey={ownerSecrets?.textbeltKey ?? "••••••••••••••••••••"} />

            {/* Action buttons */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14, marginBottom: 20 }}>
              <a
                href={ownerSecrets?.textbeltPurchaseUrl ?? "#"}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "18px 24px", borderRadius: 10, textDecoration: "none",
                  background: D.green, color: "#000",
                  fontSize: 14, fontWeight: 700,
                }}
              >
                Purchase More Credits
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M7 17L17 7"/><path d="M7 7h10v10"/></svg>
              </a>
              <a
                href={ownerSecrets?.textbeltWhitelistUrl ?? "#"}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "18px 24px", borderRadius: 10, textDecoration: "none",
                  background: D.surface, color: D.text2,
                  border: `1px solid ${D.border}`,
                  fontSize: 14, fontWeight: 600,
                }}
              >
                Request URL Whitelist
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M7 17L17 7"/><path d="M7 7h10v10"/></svg>
              </a>
            </div>

            {/* URL approval status card */}
            <div style={{
              background: D.orangeBg,
              border: `1px solid rgba(245,158,11,0.25)`,
              borderRadius: 10,
              padding: "20px 24px",
              marginBottom: 20,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: D.yellow }} />
                <div style={{ fontSize: 13, fontWeight: 700, color: D.yellow }}>URL Whitelist: Pending Approval</div>
              </div>
              <div style={{ fontSize: 13, color: D.text2, lineHeight: 1.6 }}>
                Textbelt URL whitelisting is pending. This only affects whether <em>links</em> inside SMS texts are delivered — sending plain texts already works fine. Once approved, guests will receive clickable progress-tracking links in their texts.
              </div>
            </div>

            {/* Info card */}
            <div style={{
              background: D.surface,
              border: `1px solid ${D.border}`,
              borderRadius: 10,
              padding: "20px 24px",
              marginBottom: 24,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: D.text, marginBottom: 8 }}>What happens when approved?</div>
              <div style={{ fontSize: 13, color: D.text2, lineHeight: 1.7 }}>
                After whitelist approval, SMS messages sent through HOST will include your hostplatform.net join and status links as clickable URLs. Guests can tap the link to check their position in line or confirm their table. Without approval, links may be stripped or blocked by carrier spam filters.
              </div>
            </div>

            {/* Claude prompt for SMS changes */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: D.muted, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>
                Claude Prompt — Modify SMS Messages
              </div>
              <div style={{
                background: "rgba(0,0,0,0.4)",
                border: `1px solid ${D.border}`,
                borderRadius: 10,
                padding: "18px 20px",
                fontFamily: "monospace",
                fontSize: 13,
                color: D.text2,
                lineHeight: 1.7,
                whiteSpace: "pre-wrap",
              }}>
{`Change the join SMS message for all restaurants to: [YOUR MESSAGE HERE]. Make sure it still includes the STOP opt-out line at the end. Update the _send_join_sms function in main.py with the new message text.`}
              </div>
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* TAB: CUSTOMIZER                                            */}
        {/* ══════════════════════════════════════════════════════════ */}
        {activeTab === "Customizer" && (
          <div
            onClick={() => setSelectedEl(null)}
            style={{
              display: "flex",
              height: "calc(100vh - 108px)",
              margin: "0 -28px -60px",
              borderTop: `1px solid ${D.border}`,
              overflow: "hidden",
            }}
          >
            {/* ── LAYERS PANEL ─────────────────────────────────────── */}
            <div style={{
              width: 196, flexShrink: 0,
              borderRight: `1px solid ${D.border}`,
              background: "#060A0D",
              display: "flex", flexDirection: "column",
              overflow: "hidden",
            }}>
              {/* Restaurant */}
              <div style={{ padding: "14px 12px 10px", borderBottom: `1px solid ${D.border}` }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: D.muted, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>Restaurant</div>
                {RESTS.map(r => (
                  <button key={r.id} onClick={e => { e.stopPropagation(); setCustomizerRestId(r.id); setSelectedEl(null) }} style={{
                    display: "block", width: "100%", textAlign: "left",
                    padding: "6px 10px", borderRadius: 6, marginBottom: 3,
                    background: customizerRestId === r.id ? "rgba(255,255,255,0.07)" : "transparent",
                    border: customizerRestId === r.id ? `1px solid ${D.border}` : "1px solid transparent",
                    color: customizerRestId === r.id ? D.text : D.text2,
                    fontSize: 12, cursor: "pointer", fontFamily: font,
                  }}>{r.name}</button>
                ))}
              </div>

              {/* Screen */}
              <div style={{ padding: "12px 12px 8px", borderBottom: `1px solid ${D.border}` }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: D.muted, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>Screen</div>
                {(["Join", "Waiting", "Seated"] as const).map(s => (
                  <button key={s} onClick={e => { e.stopPropagation(); setCustomizerPreview(s); setSelectedEl(null) }} style={{
                    display: "flex", alignItems: "center", gap: 7, width: "100%", textAlign: "left",
                    padding: "6px 10px", borderRadius: 6, marginBottom: 3,
                    background: customizerPreview === s ? "rgba(255,255,255,0.07)" : "transparent",
                    border: customizerPreview === s ? `1px solid ${D.border}` : "1px solid transparent",
                    color: customizerPreview === s ? D.text : D.text2,
                    fontSize: 12, cursor: "pointer", fontFamily: font,
                  }}>
                    <span style={{ fontSize: 13 }}>{s === "Join" ? "📱" : s === "Waiting" ? "⏳" : "✅"}</span> {s}
                  </button>
                ))}
              </div>

              {/* Layers */}
              <div style={{ flex: 1, overflowY: "auto", padding: "12px 12px" }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: D.muted, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>Layers</div>
                {EDITOR_LAYERS[customizerPreview].map(layer => {
                  const isSel = layer.type !== "finalButton"
                    ? selectedEl?.type === layer.type
                    : selectedEl?.type === "finalButton"
                  return (
                    <button key={layer.type} onClick={e => { e.stopPropagation(); setSelectedEl(layer.type === "finalButton" ? { type: "finalButton", index: 0 } : { type: layer.type } as NonNullable<SelectedEl>) }} style={{
                      display: "flex", alignItems: "center", gap: 7,
                      width: "100%", textAlign: "left",
                      padding: "6px 10px", borderRadius: 6, marginBottom: 2,
                      background: isSel ? "rgba(59,130,246,0.10)" : "transparent",
                      border: isSel ? "1px solid rgba(59,130,246,0.25)" : "1px solid transparent",
                      color: isSel ? "#93c5fd" : D.text2,
                      fontSize: 12, cursor: "pointer", fontFamily: font,
                    }}>
                      <span style={{ fontSize: 12 }}>{layer.icon}</span> {layer.label}
                    </button>
                  )
                })}
                {/* Final button sub-layers */}
                {customizerPreview === "Seated" && guestConfig.finalButtons.map((btn, i) => (
                  <button key={btn.id} onClick={e => { e.stopPropagation(); setSelectedEl({ type: "finalButton", index: i }) }} style={{
                    display: "flex", alignItems: "center", gap: 7,
                    width: "100%", textAlign: "left",
                    padding: "5px 10px 5px 28px", borderRadius: 6, marginBottom: 2,
                    background: selectedEl?.type === "finalButton" && (selectedEl as { type: "finalButton"; index: number }).index === i ? "rgba(59,130,246,0.10)" : "transparent",
                    border: selectedEl?.type === "finalButton" && (selectedEl as { type: "finalButton"; index: number }).index === i ? "1px solid rgba(59,130,246,0.25)" : "1px solid transparent",
                    color: selectedEl?.type === "finalButton" && (selectedEl as { type: "finalButton"; index: number }).index === i ? "#93c5fd" : D.text2,
                    fontSize: 11, cursor: "pointer", fontFamily: font,
                  }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: btn.color, flexShrink: 0 }} />
                    {btn.label || `Button ${i + 1}`}
                  </button>
                ))}
              </div>

              {/* Save */}
              <div style={{ padding: "12px", borderTop: `1px solid ${D.border}` }}>
                <button onClick={e => { e.stopPropagation(); saveGuestConfig() }} style={{
                  width: "100%", padding: "10px 0", borderRadius: 8,
                  background: configSaved ? D.green : D.accent,
                  border: "none", color: "#fff",
                  fontSize: 13, fontWeight: 700, cursor: "pointer",
                  transition: "background 0.2s", fontFamily: font,
                }}>
                  {configSaved ? "✓ Saved" : "Save Changes"}
                </button>
              </div>
            </div>

            {/* ── PHONE CANVAS ─────────────────────────────────────── */}
            <div
              style={{
                flex: 1, overflowY: "auto",
                background: "#07090B",
                backgroundImage: "radial-gradient(rgba(255,255,255,0.035) 1px, transparent 1px)",
                backgroundSize: "18px 18px",
                display: "flex", alignItems: "flex-start", justifyContent: "center",
                padding: "52px 24px 80px",
              }}
            >
              {/* Phone frame */}
              <div style={{
                width: 335, flexShrink: 0,
                background: "#1C1C1E",
                border: "10px solid #2A2A2C",
                borderRadius: 54,
                position: "relative",
                boxShadow: "0 40px 100px rgba(0,0,0,0.9), inset 0 0 0 1px rgba(255,255,255,0.07)",
              }}>
                {/* Dynamic Island */}
                <div style={{ position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)", width: 96, height: 30, background: "#000", borderRadius: 15, zIndex: 20, pointerEvents: "none" }} />
                {/* Side buttons */}
                <div style={{ position: "absolute", right: -13, top: 110, width: 3, height: 60, background: "#3A3A3C", borderRadius: 2 }} />
                <div style={{ position: "absolute", left: -13, top: 100, width: 3, height: 38, background: "#3A3A3C", borderRadius: 2 }} />
                <div style={{ position: "absolute", left: -13, top: 148, width: 3, height: 38, background: "#3A3A3C", borderRadius: 2 }} />
                <div style={{ position: "absolute", left: -13, top: 76, width: 3, height: 20, background: "#3A3A3C", borderRadius: 2 }} />

                {/* Screen */}
                <div
                  onClick={e => { e.stopPropagation(); setSelectedEl({ type: "background" }) }}
                  style={{
                    minHeight: 720,
                    background: guestConfig.bgColor,
                    borderRadius: 44,
                    overflow: "hidden",
                    display: "flex", flexDirection: "column",
                    cursor: "pointer",
                    position: "relative",
                    boxShadow: selectedEl?.type === "background" ? "inset 0 0 0 2px #3b82f6" : undefined,
                  }}
                >
                  {/* Status bar */}
                  <div style={{ height: 54, flexShrink: 0, pointerEvents: "none" }} />

                  {/* ── JOIN SCREEN ── */}
                  {customizerPreview === "Join" && (
                    <>
                      {/* HOST wordmark */}
                      <div style={{ textAlign: "center", flexShrink: 0, pointerEvents: "none" }}>
                        <div style={{ fontSize: "clamp(1.6rem,5vw,2rem)", fontWeight: 900, letterSpacing: "0.08em", color: "#fff", lineHeight: 1 }}>HOST</div>
                        <div style={{ fontSize: ".42rem", fontWeight: 700, letterSpacing: ".28em", textTransform: "uppercase", color: "rgba(255,255,255,0.22)", marginTop: 4 }}>Restaurant Operating System</div>
                      </div>

                      {/* Restaurant chip */}
                      <div
                        onClick={e => { e.stopPropagation(); setSelectedEl({ type: "restaurantName" }) }}
                        title="Click to edit"
                        style={{
                          textAlign: "center", padding: "12px 20px 0", flexShrink: 0, cursor: "pointer",
                          borderRadius: 6,
                          boxShadow: selectedEl?.type === "restaurantName" ? "0 0 0 2px #3b82f6" : undefined,
                        }}
                      >
                        <div style={{
                          display: "inline-block", padding: "6px 18px",
                          border: "1px solid rgba(255,255,255,0.11)", borderRadius: 10,
                          background: "rgba(255,255,255,0.04)",
                        }}>
                          <div style={{ fontSize: ".72rem", fontWeight: 800, letterSpacing: "0.14em", color: "rgba(255,255,255,0.85)" }}>
                            {(guestConfig.restaurantName || "Demo Restaurant").toUpperCase()}
                          </div>
                        </div>
                        {guestConfig.tagline && (
                          <div style={{ marginTop: 5, fontSize: ".6rem", color: "rgba(255,255,255,0.42)" }}>{guestConfig.tagline}</div>
                        )}
                        <div style={{ marginTop: 5, fontSize: ".62rem", color: "rgba(255,255,255,0.42)" }}>2 parties ahead · ~18m wait</div>
                      </div>

                      {/* Form */}
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 9, padding: "14px 18px 0", overflow: "hidden" }}>
                        {/* Party size */}
                        <div
                          onClick={e => { e.stopPropagation(); setSelectedEl({ type: "partySize" }) }}
                          title="Click to edit"
                          style={{
                            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)",
                            borderRadius: 14, padding: "11px 14px 13px", flexShrink: 0, cursor: "pointer",
                            boxShadow: selectedEl?.type === "partySize" ? "0 0 0 2px #3b82f6" : undefined,
                          }}
                        >
                          <div style={{ fontSize: ".48rem", fontWeight: 800, letterSpacing: ".24em", textTransform: "uppercase", color: "rgba(255,255,255,0.32)", marginBottom: 7 }}>Party Size</div>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.07)", border: "1.5px solid rgba(255,255,255,0.11)", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.5)", fontSize: 18 }}>−</div>
                            <span style={{ fontSize: "2.4rem", fontWeight: 300, color: "#fff" }}>2</span>
                            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.07)", border: "1.5px solid rgba(255,255,255,0.11)", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.5)", fontSize: 18 }}>+</div>
                          </div>
                        </div>
                        {/* Name */}
                        <div style={{ flexShrink: 0, pointerEvents: "none" }}>
                          <div style={{ fontSize: ".5rem", fontWeight: 800, letterSpacing: ".24em", textTransform: "uppercase", color: "rgba(255,255,255,0.32)", marginBottom: 5 }}>Name</div>
                          <div style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 11, padding: "10px 12px", color: "rgba(255,255,255,0.22)", fontSize: ".72rem" }}>Your name</div>
                        </div>
                        {/* Phone */}
                        <div style={{ flexShrink: 0, pointerEvents: "none" }}>
                          <div style={{ fontSize: ".5rem", fontWeight: 800, letterSpacing: ".24em", textTransform: "uppercase", color: "rgba(255,255,255,0.32)", marginBottom: 5 }}>
                            Phone <span style={{ fontWeight: 400, color: "rgba(255,255,255,0.16)" }}>— optional</span>
                          </div>
                          <div style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 11, padding: "10px 12px", color: "rgba(255,255,255,0.22)", fontSize: ".72rem" }}>(555) 000-0000</div>
                        </div>
                      </div>

                      {/* CTA */}
                      <div style={{ padding: "14px 18px 28px", flexShrink: 0 }}>
                        <div
                          style={{
                            width: "100%", height: 56, borderRadius: 16,
                            background: "#fff", color: "#000",
                            fontWeight: 800, fontSize: ".82rem", letterSpacing: ".12em", textTransform: "uppercase",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            pointerEvents: "none",
                          }}
                        >
                          Join Waitlist
                        </div>
                        <div style={{
                          width: "100%", height: 44, marginTop: 8, borderRadius: 12,
                          border: "1px solid rgba(255,255,255,0.10)", background: "transparent",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: "rgba(255,255,255,0.38)", fontSize: ".72rem", fontWeight: 600,
                          pointerEvents: "none",
                        }}>
                          View Menu
                        </div>
                      </div>
                    </>
                  )}

                  {/* ── WAITING SCREEN ── */}
                  {customizerPreview === "Waiting" && (
                    <>
                      <div style={{ textAlign: "center", flexShrink: 0, pointerEvents: "none" }}>
                        <div style={{ fontSize: "1.5rem", fontWeight: 900, letterSpacing: "0.08em", color: "#fff" }}>HOST</div>
                      </div>
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 22px", gap: 12 }}>
                        <div style={{ fontSize: ".58rem", letterSpacing: ".2em", textTransform: "uppercase", color: "rgba(255,255,255,0.38)", pointerEvents: "none" }}>Your wait time</div>
                        <div style={{ fontSize: "3.8rem", fontWeight: 900, color: "#fff", letterSpacing: "-0.03em", lineHeight: 1, pointerEvents: "none" }}>
                          12<span style={{ fontSize: "1.3rem", fontWeight: 300, color: "rgba(255,255,255,0.38)" }}>m</span>
                        </div>
                        {/* Progress bar */}
                        <div
                          onClick={e => { e.stopPropagation(); setSelectedEl({ type: "progressBar" }) }}
                          title="Click to edit"
                          style={{
                            width: "100%", background: "rgba(255,255,255,0.08)", borderRadius: 100, height: 8, overflow: "hidden",
                            cursor: "pointer",
                            boxShadow: selectedEl?.type === "progressBar" ? "0 0 0 2px #3b82f6" : undefined,
                          }}
                        >
                          <div style={{ width: "65%", height: "100%", background: `linear-gradient(90deg, ${guestConfig.accentColor}, ${guestConfig.accentColor}88)`, borderRadius: 100 }} />
                        </div>
                        {/* Wait message */}
                        <div
                          onClick={e => { e.stopPropagation(); setSelectedEl({ type: "waitMessage" }) }}
                          title="Click to edit"
                          style={{
                            fontSize: ".72rem", color: "rgba(255,255,255,0.5)", textAlign: "center", lineHeight: 1.65,
                            cursor: "pointer", borderRadius: 6, padding: "6px 8px",
                            boxShadow: selectedEl?.type === "waitMessage" ? "0 0 0 2px #3b82f6" : undefined,
                          }}
                        >
                          {guestConfig.waitMessages[0] ?? "Your spot is saved — feel free to step out."}
                        </div>
                        <div style={{
                          width: "100%", height: 46, borderRadius: 12,
                          background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: "rgba(255,255,255,0.45)", fontSize: ".72rem", fontWeight: 600,
                          pointerEvents: "none",
                        }}>View Menu</div>
                      </div>
                    </>
                  )}

                  {/* ── SEATED SCREEN ── */}
                  {customizerPreview === "Seated" && (
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "28px 22px" }}>
                      <div style={{
                        width: 76, height: 76, borderRadius: "50%",
                        border: `2.5px solid ${guestConfig.accentColor}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 34, color: guestConfig.accentColor, marginBottom: 18,
                        pointerEvents: "none",
                      }}>✓</div>
                      <div style={{ fontSize: "1.05rem", fontWeight: 700, color: guestConfig.accentColor, textAlign: "center", marginBottom: 10, pointerEvents: "none" }}>
                        Your table is ready!
                      </div>
                      {/* Seated message */}
                      <div
                        onClick={e => { e.stopPropagation(); setSelectedEl({ type: "seatedMessage" }) }}
                        title="Click to edit"
                        style={{
                          fontSize: ".72rem", color: "rgba(255,255,255,0.45)", textAlign: "center", lineHeight: 1.7,
                          marginBottom: 28, cursor: "pointer", borderRadius: 6, padding: "6px 8px",
                          boxShadow: selectedEl?.type === "seatedMessage" ? "0 0 0 2px #3b82f6" : undefined,
                        }}
                      >
                        {guestConfig.seatedMessage}
                      </div>
                      {/* Final buttons — draggable */}
                      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 9 }}>
                        {guestConfig.finalButtons.map((btn, i) => (
                          <div
                            key={btn.id}
                            draggable
                            onDragStart={() => setDragIdx(i)}
                            onDragOver={e => { e.preventDefault(); setDragOverIdx(i) }}
                            onDrop={e => {
                              e.preventDefault()
                              if (dragIdx === null || dragIdx === i) { setDragIdx(null); setDragOverIdx(null); return }
                              const btns = [...guestConfig.finalButtons]
                              const [moved] = btns.splice(dragIdx, 1)
                              btns.splice(i, 0, moved)
                              setGuestConfig(c => ({ ...c, finalButtons: btns }))
                              setSelectedEl({ type: "finalButton", index: i })
                              setDragIdx(null); setDragOverIdx(null)
                            }}
                            onDragEnd={() => { setDragIdx(null); setDragOverIdx(null) }}
                            onClick={e => { e.stopPropagation(); setSelectedEl({ type: "finalButton", index: i }) }}
                            style={{
                              width: "100%", padding: "14px 0", borderRadius: 14,
                              background: btn.color, color: guestConfig.buttonTextColor,
                              textAlign: "center", fontSize: ".78rem", fontWeight: 700,
                              cursor: "grab", userSelect: "none",
                              boxShadow: (selectedEl?.type === "finalButton" && (selectedEl as { type: "finalButton"; index: number }).index === i)
                                ? "0 0 0 2px #3b82f6"
                                : dragOverIdx === i ? "0 0 0 2px rgba(59,130,246,0.5)" : undefined,
                              opacity: dragIdx === i ? 0.45 : 1,
                              transition: "opacity 0.15s",
                            }}
                          >
                            {btn.label || "Button"}
                          </div>
                        ))}
                        {guestConfig.finalButtons.length === 0 && (
                          <div style={{ fontSize: ".65rem", color: "rgba(255,255,255,0.2)", textAlign: "center", padding: "20px 0", pointerEvents: "none" }}>
                            No buttons · Add in Properties →
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── PROPERTIES PANEL ─────────────────────────────────── */}
            <div
              onClick={e => e.stopPropagation()}
              style={{
                width: 272, flexShrink: 0,
                borderLeft: `1px solid ${D.border}`,
                background: "#060A0D",
                overflow: "auto",
                display: "flex", flexDirection: "column",
              }}
            >
              {/* Header */}
              <div style={{ padding: "16px 16px 12px", borderBottom: `1px solid ${D.border}`, flexShrink: 0 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: D.muted, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                  {selectedEl ? elLabel(selectedEl) : "Properties"}
                </div>
                {!selectedEl && (
                  <div style={{ fontSize: 11, color: D.muted, marginTop: 4 }}>Click any element to edit it</div>
                )}
              </div>

              <div style={{ flex: 1, padding: "16px 16px 32px", overflowY: "auto" }}>

                {/* Nothing selected → global */}
                {!selectedEl && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <ColorField label="Background Color" value={guestConfig.bgColor} onChange={v => setGuestConfig(c => ({ ...c, bgColor: v }))} />
                    <ColorField label="Accent Color" value={guestConfig.accentColor} onChange={v => setGuestConfig(c => ({ ...c, accentColor: v }))} />
                    <ColorField label="Button Text Color" value={guestConfig.buttonTextColor} onChange={v => setGuestConfig(c => ({ ...c, buttonTextColor: v }))} />
                    <PropField label="Restaurant Name">
                      <input type="text" value={guestConfig.restaurantName} onChange={e => setGuestConfig(c => ({ ...c, restaurantName: e.target.value }))} style={inputStyle} />
                    </PropField>
                    <PropField label="Tagline">
                      <input type="text" value={guestConfig.tagline} placeholder="e.g. Fine dining in Denver" onChange={e => setGuestConfig(c => ({ ...c, tagline: e.target.value }))} style={inputStyle} />
                    </PropField>
                  </div>
                )}

                {selectedEl?.type === "background" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <ColorField label="Background Color" value={guestConfig.bgColor} onChange={v => setGuestConfig(c => ({ ...c, bgColor: v }))} />
                    <ColorField label="Accent Color" value={guestConfig.accentColor} onChange={v => setGuestConfig(c => ({ ...c, accentColor: v }))} />
                    <ColorField label="Button Text Color" value={guestConfig.buttonTextColor} onChange={v => setGuestConfig(c => ({ ...c, buttonTextColor: v }))} />
                  </div>
                )}

                {selectedEl?.type === "restaurantName" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <PropField label="Restaurant Name">
                      <input type="text" value={guestConfig.restaurantName} onChange={e => setGuestConfig(c => ({ ...c, restaurantName: e.target.value }))} style={inputStyle} />
                    </PropField>
                    <PropField label="Tagline">
                      <input type="text" value={guestConfig.tagline} placeholder="e.g. Fine dining in Denver" onChange={e => setGuestConfig(c => ({ ...c, tagline: e.target.value }))} style={inputStyle} />
                    </PropField>
                  </div>
                )}

                {selectedEl?.type === "partySize" && (
                  <div style={{ fontSize: 12, color: D.muted, lineHeight: 1.6 }}>
                    Party size control lets guests select 1–20 people. Styling follows the accent color.
                    <div style={{ marginTop: 14 }}>
                      <ColorField label="Accent Color" value={guestConfig.accentColor} onChange={v => setGuestConfig(c => ({ ...c, accentColor: v }))} />
                    </div>
                  </div>
                )}

                {selectedEl?.type === "joinButton" && (
                  <div style={{ fontSize: 12, color: D.muted, lineHeight: 1.6, padding: "4px 0" }}>
                    The "Join Waitlist" button is always white with black text — this is HOST&apos;s standard brand style for the join screen.
                    <div style={{ marginTop: 14, padding: "12px 0", borderRadius: 10, background: "#fff", color: "#000", textAlign: "center", fontSize: 12, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase" }}>
                      Join Waitlist
                    </div>
                  </div>
                )}

                {selectedEl?.type === "progressBar" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <ColorField label="Bar Color (Accent)" value={guestConfig.accentColor} onChange={v => setGuestConfig(c => ({ ...c, accentColor: v }))} />
                    <div style={{ padding: "12px 14px", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: `1px solid ${D.border}` }}>
                      <div style={{ fontSize: 11, color: D.muted, marginBottom: 8 }}>Preview</div>
                      <div style={{ width: "100%", background: "rgba(255,255,255,0.08)", borderRadius: 100, height: 8, overflow: "hidden" }}>
                        <div style={{ width: "65%", height: "100%", background: `linear-gradient(90deg, ${guestConfig.accentColor}, ${guestConfig.accentColor}88)`, borderRadius: 100 }} />
                      </div>
                    </div>
                  </div>
                )}

                {selectedEl?.type === "waitMessage" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ fontSize: 11, color: D.muted, lineHeight: 1.6 }}>One message per line. These rotate on the guest waiting screen.</div>
                    <textarea
                      value={guestConfig.waitMessages.join("\n")}
                      onChange={e => setGuestConfig(c => ({ ...c, waitMessages: e.target.value.split("\n") }))}
                      rows={7}
                      style={{ ...inputStyle, resize: "vertical", fontFamily: font, lineHeight: 1.7 }}
                    />
                  </div>
                )}

                {selectedEl?.type === "seatedMessage" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ fontSize: 11, color: D.muted }}>Shown when the guest is seated.</div>
                    <textarea
                      value={guestConfig.seatedMessage}
                      onChange={e => setGuestConfig(c => ({ ...c, seatedMessage: e.target.value }))}
                      rows={4}
                      style={{ ...inputStyle, resize: "vertical", fontFamily: font, lineHeight: 1.7 }}
                    />
                  </div>
                )}

                {selectedEl?.type === "finalButton" && (() => {
                  const idx = (selectedEl as { type: "finalButton"; index: number }).index
                  const btn = guestConfig.finalButtons[idx]
                  if (!btn) return <div style={{ fontSize: 12, color: D.muted }}>Button not found.</div>
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      <PropField label="Label">
                        <input type="text" value={btn.label} placeholder="e.g. Leave a Review" onChange={e => setGuestConfig(c => ({ ...c, finalButtons: c.finalButtons.map((b, j) => j === idx ? { ...b, label: e.target.value } : b) }))} style={inputStyle} />
                      </PropField>
                      <PropField label="URL">
                        <input type="url" value={btn.url} placeholder="https://…" onChange={e => setGuestConfig(c => ({ ...c, finalButtons: c.finalButtons.map((b, j) => j === idx ? { ...b, url: e.target.value } : b) }))} style={{ ...inputStyle, fontFamily: "monospace", fontSize: 11 }} />
                      </PropField>
                      <ColorField label="Button Color" value={btn.color} onChange={v => setGuestConfig(c => ({ ...c, finalButtons: c.finalButtons.map((b, j) => j === idx ? { ...b, color: v } : b) }))} />
                      <div style={{ padding: "10px 14px", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: `1px solid ${D.border}` }}>
                        <div style={{ fontSize: 11, color: D.muted, marginBottom: 6 }}>Preview</div>
                        <div style={{ padding: "12px 0", borderRadius: 10, background: btn.color, color: guestConfig.buttonTextColor, textAlign: "center", fontSize: 12, fontWeight: 700 }}>
                          {btn.label || "Button"}
                        </div>
                      </div>
                      <div style={{ fontSize: 10, color: D.muted, textAlign: "center" }}>Drag on canvas to reorder</div>
                      <button
                        onClick={() => { setGuestConfig(c => ({ ...c, finalButtons: c.finalButtons.filter((_, j) => j !== idx) })); setSelectedEl(null) }}
                        style={{ padding: "9px 0", borderRadius: 7, background: D.redBg, border: `1px solid rgba(239,68,68,0.2)`, color: D.red, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: font }}
                      >Delete Button</button>
                    </div>
                  )
                })()}

                {/* Add button — always visible on Seated screen */}
                {customizerPreview === "Seated" && guestConfig.finalButtons.length < 4 && (
                  <button
                    onClick={() => {
                      const newIdx = guestConfig.finalButtons.length
                      setGuestConfig(c => ({ ...c, finalButtons: [...c.finalButtons, { id: Date.now().toString(), label: "Leave a Review", url: "", color: "#3b82f6" }] }))
                      setSelectedEl({ type: "finalButton", index: newIdx })
                    }}
                    style={{
                      marginTop: selectedEl?.type === "finalButton" ? 8 : 0,
                      width: "100%", padding: "10px 0", borderRadius: 7,
                      background: "transparent", border: `1px dashed ${D.border}`,
                      color: D.text2, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: font,
                    }}
                  >+ Add Button</button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* TAB: PROMPTS                                               */}
        {/* ══════════════════════════════════════════════════════════ */}
        {activeTab === "Prompts" && (
          <>
            <SectionLabel>Claude Prompts</SectionLabel>
            <div style={{ fontSize: 13, color: D.text2, marginBottom: 24, lineHeight: 1.6 }}>
              Ready-to-use prompts for making changes to HOST via Claude. Copy and paste into any Claude session.
            </div>

            {/* Group by category */}
            {(["Infrastructure", "Guest Experience", "Features", "Fixes"] as const).map(category => {
              const cards = PROMPTS.filter(p => p.category === category)
              return (
                <div key={category} style={{ marginBottom: 32 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: D.muted, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14 }}>
                    {category}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
                    {cards.map((card, i) => (
                      <PromptCardComponent key={i} card={card} />
                    ))}
                  </div>
                </div>
              )
            })}
          </>
        )}

      </div>
    </div>
  )
}

// ── Shared input style ─────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  padding: "8px 12px",
  background: "rgba(255,255,255,0.04)",
  border: `1px solid rgba(255,255,255,0.08)`,
  borderRadius: 7, outline: "none",
  color: "#FFFFFF", fontSize: 13,
}

// ── CredentialsEditor ──────────────────────────────────────────────────────────
function CredentialsEditor({
  id, cred, saved, onSave, inputStyle, D, font,
}: {
  id: string
  cred: { username: string; password: string }
  saved: boolean
  onSave: (c: { username: string; password: string }) => void
  inputStyle: React.CSSProperties
  D: Record<string, string>
  font: string
}) {
  const [u, setU] = useState(cred.username)
  const [p, setP] = useState(cred.password)
  const [show, setShow] = useState(false)
  void id
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div>
        <label style={{ fontSize: 11, color: D.muted, display: "block", marginBottom: 5 }}>Username</label>
        <input
          type="text"
          value={u}
          onChange={e => setU(e.target.value)}
          autoComplete="off"
          style={{ ...inputStyle, fontFamily: "monospace" }}
        />
      </div>
      <div>
        <label style={{ fontSize: 11, color: D.muted, display: "block", marginBottom: 5 }}>Password</label>
        <div style={{ display: "flex", gap: 6 }}>
          <input
            type={show ? "text" : "password"}
            value={p}
            onChange={e => setP(e.target.value)}
            autoComplete="new-password"
            style={{ ...inputStyle, flex: 1, fontFamily: "monospace" }}
          />
          <button
            onClick={() => setShow(s => !s)}
            style={{
              flexShrink: 0, padding: "0 10px", borderRadius: 7,
              background: "rgba(255,255,255,0.05)", border: `1px solid rgba(255,255,255,0.08)`,
              color: D.text2, cursor: "pointer", fontSize: 12, fontFamily: font,
            }}
          >{show ? "Hide" : "Show"}</button>
        </div>
      </div>
      <button
        onClick={() => onSave({ username: u.trim(), password: p })}
        style={{
          padding: "9px 0", borderRadius: 7,
          background: saved ? D.greenBg : "rgba(255,255,255,0.06)",
          border: `1px solid ${saved ? D.greenBorder : "rgba(255,255,255,0.10)"}`,
          color: saved ? D.green : D.text2,
          fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: font,
          transition: "all 0.2s",
        }}
      >{saved ? "✓ Credentials Saved" : "Save Credentials"}</button>
    </div>
  )
}

// ── ApiKeyRow ──────────────────────────────────────────────────────────────────
function ApiKeyRow({ apiKey }: { apiKey: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      background: "rgba(255,255,255,0.03)",
      border: `1px solid rgba(255,255,255,0.07)`,
      borderRadius: 10, padding: "12px 16px",
      marginBottom: 16,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.28)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>Your API Key</div>
        <div style={{ fontFamily: "monospace", fontSize: 11, color: "rgba(255,255,255,0.55)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{apiKey}</div>
      </div>
      <button
        onClick={() => { navigator.clipboard.writeText(apiKey).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }) }}
        style={{
          flexShrink: 0, padding: "7px 14px", borderRadius: 7,
          background: copied ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.07)",
          border: `1px solid ${copied ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.10)"}`,
          color: copied ? "#22C55E" : "rgba(255,255,255,0.6)",
          fontSize: 12, fontWeight: 600, cursor: "pointer",
          transition: "all 0.15s",
        }}
      >{copied ? "Copied!" : "Copy"}</button>
    </div>
  )
}

// ── PropField ──────────────────────────────────────────────────────────────────
function PropField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.28)", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  )
}

// ── ColorField ─────────────────────────────────────────────────────────────────
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", display: "block", marginBottom: 6 }}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{
            width: 40, height: 36, flexShrink: 0,
            border: `1px solid rgba(255,255,255,0.08)`,
            borderRadius: 7, background: "none", cursor: "pointer", padding: 3,
          }}
        />
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{ ...inputStyle, fontFamily: "monospace", width: "auto", flex: 1 }}
        />
      </div>
    </div>
  )
}

// ── PromptCardComponent ────────────────────────────────────────────────────────
function PromptCardComponent({ card }: { card: PromptCard }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(card.prompt).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  const riskColor = card.risk === "Safe" ? "#22C55E" : card.risk === "Moderate" ? "#F59E0B" : "#EF4444"
  const riskBg    = card.risk === "Safe" ? "rgba(34,197,94,0.10)" : card.risk === "Moderate" ? "rgba(245,158,11,0.10)" : "rgba(239,68,68,0.10)"
  const riskBorder = card.risk === "Safe" ? "rgba(34,197,94,0.20)" : card.risk === "Moderate" ? "rgba(245,158,11,0.25)" : "rgba(239,68,68,0.25)"

  return (
    <div style={{
      background: "rgba(255,255,255,0.035)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 10,
      padding: "20px",
      display: "flex", flexDirection: "column", gap: 12,
    }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#FFFFFF", marginBottom: 4 }}>{card.title}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.50)", lineHeight: 1.5 }}>{card.description}</div>
        </div>
        <div style={{
          fontSize: 10, fontWeight: 700,
          color: riskColor, background: riskBg, border: `1px solid ${riskBorder}`,
          borderRadius: 20, padding: "3px 9px", flexShrink: 0, letterSpacing: "0.05em",
        }}>
          {card.risk}
        </div>
      </div>

      {/* Prompt block */}
      <pre style={{
        margin: 0, padding: "12px 14px",
        background: "rgba(0,0,0,0.35)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 8,
        fontSize: 11.5, fontFamily: "monospace",
        color: "rgba(255,255,255,0.75)",
        lineHeight: 1.65,
        whiteSpace: "pre-wrap", wordBreak: "break-word",
        overflow: "hidden",
      }}>
        {card.prompt}
      </pre>

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{
          fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.35)",
          letterSpacing: "0.08em", textTransform: "uppercase",
        }}>
          {card.category}
        </div>
        <button
          onClick={copy}
          style={{
            padding: "6px 14px", borderRadius: 7, fontSize: 12, fontWeight: 600,
            background: copied ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.07)",
            border: `1px solid ${copied ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.1)"}`,
            color: copied ? "#22C55E" : "rgba(255,255,255,0.7)",
            cursor: "pointer", transition: "all 0.15s",
          }}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.28)",
      letterSpacing: "0.12em", textTransform: "uppercase",
      marginBottom: 14,
    }}>
      {children}
    </div>
  )
}

function SvcCard({ name, svc, icon, extra }: { name: string; svc: Svc; icon: React.ReactNode; extra?: string }) {
  const dot = svcDot(svc.status)
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: `1px solid rgba(255,255,255,0.08)`,
      borderRadius: 10,
      padding: "18px 20px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, color: "rgba(255,255,255,0.40)" }}>
        {icon}
        <span style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.50)", letterSpacing: "0.01em" }}>{name}</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
        <div style={{
          width: 8, height: 8, borderRadius: "50%", background: dot, flexShrink: 0,
          boxShadow: svc.status === "up" ? `0 0 6px ${dot}` : "none",
        }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: dot }}>
          {svcLabel(svc.status)}
        </span>
        {extra && (
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.30)", marginLeft: 2 }}>{extra}</span>
        )}
      </div>

      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", lineHeight: 1.4 }}>
        {svc.detail || (svc.status === "checking" ? "Checking…" : "")}
      </div>
    </div>
  )
}

function LiveNum({ live, value }: { live: RestLive; value: number }) {
  return (
    <div style={{ textAlign: "center" }}>
      {live.loading ? (
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.28)" }}>—</span>
      ) : live.error ? (
        <span style={{ fontSize: 13, color: "#EF4444" }}>Error</span>
      ) : (
        <span style={{ fontSize: 14, fontWeight: 600, color: value > 0 ? "#FFFFFF" : "rgba(255,255,255,0.28)" }}>
          {value}
        </span>
      )}
    </div>
  )
}

function Cell({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <div style={{ fontSize: 13, color: muted ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.80)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 12 }}>
      {children}
    </div>
  )
}
