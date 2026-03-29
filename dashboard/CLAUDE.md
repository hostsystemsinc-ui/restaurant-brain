# HOST — Claude Context Document

This file gives Claude full project context. Read it entirely before making any changes.

---

## What HOST Is

HOST is a **restaurant waitlist platform** for walk-in guests. It replaces paper clipboards, pager buzzers, and shouted names with a clean digital system.

**How it works end-to-end:**
1. A physical HOST puck (NFC + printed QR) sits at the restaurant entrance
2. Guests tap their phone to the puck or scan the QR code — no app download, no account
3. They're instantly added to the live waitlist and can watch their position update in real time from their phone
4. The host manages the floor from one iPad (the HOST dashboard): they see the queue, the floor plan/table map, and can seat or notify guests
5. When a table is ready, the host taps one button — HOST fires an SMS to the guest's phone and their live wait page flips to "head to the host stand"

**Key differentiators:**
- Zero friction for guests: no app, no URL to type, just a tap or scan
- NFC-first (the HOST puck), with QR as backup
- Real-time live wait page (no refreshing)
- iPad-first host dashboard with floor plan
- One-tap SMS notification

**Current market:** Denver & Boulder restaurants. Early stage / pre-launch.

---

## The Codebase

**Stack:** Next.js 14 (App Router), TypeScript, React, plain inline styles (no Tailwind/CSS modules)

**Main file:** `app/page.tsx` — the entire marketing website lives here as one file (~1800 lines). All components are co-located in this file.

**Dev server:** `npm run dev` on port 3000. The preview server is configured in `.claude/launch.json` under the name `"dashboard"`.

**Public assets:**
- `/public/ipad-mockup.png` — 1500×1124 RGBA PNG; landscape iPad frame with the HOST dashboard (floor plan + guest queue) rendered inside. Transparent corners.
- `/public/iphone-mockup.png` — 430×932 RGBA PNG; portrait iPhone frame with the HOST guest join page rendered inside. Transparent corners.
- `/public/iphone-frame.png` — 430×932 RGBA PNG; transparent-screen iPhone frame used as a z-index overlay in the GuestJourney animated phone section.

---

## Design System

**Colors:**
- Background: `#060606` (near-black)
- Primary accent: `#22c55e` (green) — used for CTAs, highlights, active states
- Text: `#fff` (primary), `rgba(255,255,255,0.42)` (secondary/muted)
- Card backgrounds: `#141414`, `#0e0e0e`
- Borders: `rgba(255,255,255,0.06)` to `rgba(255,255,255,0.12)`

**Typography:**
- System font stack: `-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif`
- Serif italic accent: `Cormorant Garamond` (loaded via Google Fonts) — class `serif-italic`
- **Rule: ALL serif-italic `<em>` elements must use `color: "#22c55e"` (green), never white**
- Headings use `fontWeight: 900`, tight `letterSpacing: "-0.04em"` to `"-0.048em"`

**Buttons:**
- Primary CTA: class `cta-btn` — green background, black text, hover lift effect
- Ghost: class `ghost-btn` — transparent, white text, border

**Section pattern:** Each section has a label (`font-size: .72rem, letterSpacing: .18em, textTransform: uppercase, color: #22c55e`) above the heading.

---

## Page Structure (top to bottom)

1. **Fixed header** — announcement bar (green) + nav (HOST wordmark, Log In, Schedule Free Demo)
2. **Hero** — "Stop losing walk-ins before they sit down." + stat subtext + CTAs + iPad/iPhone device mockups peeking below fold
3. **How HOST Works** — 3-step flow (tap/scan → live queue → one-tap SMS)
4. **The Problem** — stat cards (1 in 3 walkouts, $135+ per walkout, etc.)
5. **The Solution** — HOST response to the problem stats
6. **Designed for the rush** — feature cards (NFC Tap & QR Join, SMS Notifications, Host Dashboard, Shift Insights)
7. **Sidewalk to seated** — 3-step visual
8. **The full guest experience** — animated phone showing all 5 stages of the guest journey
9. **Join from the sidewalk** — NFC puck tap animation (phone starts black, reveals JoinScreen on tap)
10. **FAQ**
11. **CTA / Demo booking section**

---

## Key Components in `app/page.tsx`

### Guest Journey Screens (animated phone, section 8)
Five rotating stages — all inside an iPhone frame overlay:
- `JoinScreen` (stage 0) — guest enters name, party size; shows "Demo Restaurant"
- `WaitScreen` (stages 1 & 2) — live position + progress bar; NO guest name shown
- `ReadyScreen` (stage 3) — green check, "Your table is ready!"
- `SeatedScreen` (stage 4) — "Enjoy your meal!" + "Leave a review for Demo Restaurant" button (no emoji)

**Important:** Dynamic island spacer (`<div style={{ height: 26 }}>`) at top of every screen keeps content below the notch.

**Scale trick:** Inner content div is `182×405`, `transform: scale(1.363)`, `transformOrigin: "top left"` to fill the `248×552` CSS screen area.

### PuckTap / MiniPhone (section 9 — NFC animation)
- `PuckTap` cycles through 4 phases: resting → descending → confirmed → lifting
- `MiniPhone` receives `confirmed: boolean`
- When `confirmed=false`: phone screen is completely black (off)
- When `confirmed=true`: fades in JoinScreen content (HOST wordmark, Demo Restaurant badge, party size, Join the Waitlist button)

### Hero Parallax
- `heroDevicesRef` attached to the devices container
- Scroll listener: `translateY(-sy * 0.14)` + `opacity = 1 until 700px scroll, then fades over 600px`
- Devices use `deviceRise` keyframe entrance animation on load

---

## Naming Conventions

- Restaurant name in all UI mockups: **"Demo Restaurant"** (never "The Buff" or any real restaurant)
- Phone placeholder name: **"Your name"** (never a real name like "Sarah")
- Phone placeholder phone: **"Your phone"**
- SMS preview shows: "Trattoria Napoli: Your table is ready! Head to the host stand 🍽️"

---

## How to Run

```bash
cd /Users/aaronjacobs/restaurant-brain/dashboard
npm run dev
# → http://localhost:3000
```

To regenerate device mockup images (iPad or iPhone), Playwright + Pillow are used:
- iPad screen HTML: `/tmp/host_ipad_screen.html` → screenshot → composite into `/tmp/ipad_mockup_render.html` → flood-fill transparent corners → save to `/public/ipad-mockup.png`
- iPhone mockup: similar pipeline via `/tmp/iphone_mockup_render.html` → `/public/iphone-mockup.png`
- iPhone frame overlay: PIL-generated, saved to `/public/iphone-frame.png`

```bash
pip3 install playwright pillow
python3 -m playwright install chromium
```

---

## What NOT to Do

- Do not add Tailwind or any CSS framework — all styling is inline React styles
- Do not create separate component files — keep everything in `app/page.tsx`
- Do not change "Demo Restaurant" to any real restaurant name
- Do not put guest names (like "Sarah") in any UI mockup text
- Do not use white (`#fff`) for serif-italic `<em>` elements — always use `#22c55e` green
- Do not add emoji to UI button text
- Do not add docstrings or TypeScript annotations to unchanged code
