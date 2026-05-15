"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Check, Loader2 } from "lucide-react"

const API   = "https://restaurant-brain-production.up.railway.app"
const LOGO  = "https://images.getbento.com/accounts/d2ce1ba3bfb5b87e1f0ba2897a682acb/media/images/28198New_Walnut_Logo.png"
const HOST_LOGO = "/host-logo.png"

const C = {
  bg:      "#F8FAFC",
  surface: "#FFFFFF",
  border:  "#E2E8F0",
  text:    "#0F172A",
  text2:   "#475569",
  muted:   "#94A3B8",
  green:   "#16A34A",
  greenBg: "#F0FDF4",
  greenBorder: "#BBF7D0",
  red:     "#DC2626",
  accent:  "#15803D",
}

// ── ToS sections ────────────────────────────────────────────────────────────

const AGREEMENT_VERSION = "2026-05-01-walnut"
const EFFECTIVE_DATE    = "May 1, 2026"
const SUPPORT_EMAIL     = "demo@hostplatform.net"

function Section({ num, title, children }: { num: number; title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h3 style={{ fontSize: 13, fontWeight: 800, color: C.text, margin: "0 0 10px", paddingBottom: 8, borderBottom: `1px solid ${C.border}` }}>
        {num}. {title}
      </h3>
      <div style={{ fontSize: 12.5, color: C.text2, lineHeight: 1.75 }}>
        {children}
      </div>
    </div>
  )
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul style={{ margin: "8px 0", paddingLeft: 18 }}>
      {items.map((item, i) => (
        <li key={i} style={{ marginBottom: 5, fontSize: 12.5, color: C.text2, lineHeight: 1.7 }}>{item}</li>
      ))}
    </ul>
  )
}

function TermsText() {
  return (
    <div>
      <Section num={1} title="The Service">
        <p style={{ margin: "0 0 10px" }}>
          HOST provides a digital waitlist and queue management platform for restaurants. The platform allows restaurant
          staff to manage guest queues and seat guests via an iPad, tablet, or any web browser. Guests join the waitlist
          by tapping an NFC-embedded object or scanning a QR code at the restaurant entrance, without downloading an application.
        </p>
        <p style={{ margin: "0 0 6px" }}>The platform includes the following features:</p>
        <Bullets items={[
          "NFC puck and QR code hardware for guest entry",
          "Real-time host dashboard accessible via iPad or any web browser",
          "Guest queue management: add, notify, seat, edit, and remove parties",
          "Analog (stylus-friendly) list mode",
          "SMS notifications sent to guests when their table is ready",
          "Admin dashboard for multi-location management",
        ]} />
      </Section>

      <Section num={2} title="Free Program Terms">
        <p style={{ margin: "0 0 10px" }}>
          Walnut Café is enrolled in the HOST Partner Free Program. Under this program:
        </p>
        <Bullets items={[
          "All features of the HOST platform are provided at no recurring charge.",
          "HOST reserves the right to modify or discontinue the free program by providing at least 30 days' written notice. In the event of discontinuation, Walnut Café may terminate this Agreement without penalty.",
          "The only financial obligation under this Agreement is set forth in Section 9 (Hardware).",
        ]} />
      </Section>

      <Section num={3} title="Account & Access">
        <p style={{ margin: "0 0 10px" }}>
          You are responsible for maintaining the confidentiality of your login credentials. You agree to notify HOST
          immediately at {SUPPORT_EMAIL} if you believe your account has been compromised. HOST accounts are for use
          only by authorized restaurant staff. You may not share, sell, or transfer access to your account.
        </p>
        <p style={{ margin: 0 }}>
          HOST reserves the right to suspend or terminate accounts that violate these terms, engage in fraudulent
          activity, or use the platform in a manner that disrupts other users or third parties.
        </p>
      </Section>

      <Section num={4} title="Restaurant Responsibilities">
        <p style={{ margin: "0 0 6px" }}>As a HOST partner, you agree to:</p>
        <Bullets items={[
          "Provide accurate business information when setting up and maintaining your account.",
          "Use the platform only for its intended purpose: managing guest waitlists and seating at your restaurant locations.",
          "Ensure that all staff who access the platform are authorized by your business.",
          "Place NFC hardware only in locations appropriate for guest interaction (e.g., entrance signage) and care for HOST-provided hardware as described in Section 9.",
          "Not attempt to reverse-engineer, copy, resell, or sublicense any part of the HOST platform.",
          "Not use the platform to collect or use guest data for any purpose beyond the legitimate management of your restaurant's guest waitlist.",
          "Comply with all applicable laws in your use of the platform, including privacy laws and SMS regulations.",
        ]} />
      </Section>

      <Section num={5} title="Guest Data & Privacy">
        <p style={{ margin: "0 0 10px" }}>
          When guests join your waitlist through HOST, they may provide their name, party size, and phone number.
          With respect to this data:
        </p>
        <Bullets items={[
          "Guest data entered into HOST is used solely for the purpose of managing your restaurant's waitlist and providing the HOST service.",
          "HOST uses guest phone numbers solely to send SMS notifications on your behalf when you initiate a notification through the dashboard.",
          "HOST does not sell, rent, or share individual guest information with any third party.",
          "HOST may use anonymized, aggregated, non-personally-identifiable data derived from platform usage (such as average wait times or queue volumes) for internal analytics and service improvement. HOST will never use individual guest names, phone numbers, or personally identifiable information for any purpose other than operating the service on your behalf.",
          "HOST stores session data and basic analytics to provide and improve the service.",
          "You are responsible for ensuring your collection and use of guest data complies with all applicable privacy laws, including the Colorado Privacy Act (CPA) and any other laws applicable to your business.",
        ]} />
        <p style={{ margin: "10px 0 0" }}>
          For questions about data handling, contact us at {SUPPORT_EMAIL}.
        </p>
      </Section>

      <Section num={6} title="SMS Notifications">
        <p style={{ margin: "0 0 10px" }}>
          HOST sends SMS messages to guests on your behalf when you initiate a notification through the dashboard.
          By using this feature:
        </p>
        <Bullets items={[
          "You represent that each guest has voluntarily provided their phone number for the purpose of receiving waitlist-related SMS notifications, and that you have obtained any consent required by applicable law, including the Telephone Consumer Protection Act (TCPA).",
          "You acknowledge that SMS delivery is subject to carrier availability and cannot be guaranteed in all circumstances.",
          "HOST is not responsible for failed or delayed message delivery due to carrier issues, network outages, or invalid phone numbers.",
          "You agree to indemnify, defend, and hold HOST harmless from any claims, fines, penalties, or liability (including reasonable attorneys' fees) arising under the TCPA or any similar law, to the extent such claims arise from your failure to obtain proper guest consent before entering phone numbers into the platform.",
        ]} />
      </Section>

      <Section num={7} title="Hardware">
        <p style={{ margin: "0 0 10px" }}>
          HOST will provide Walnut Café, at no charge, with the following hardware for use with the HOST platform:
        </p>
        <Bullets items={[
          "4 (four) NFC pucks embedded with the HOST waitlist entry link",
          "4 (four) QR code signs displaying the HOST waitlist entry link",
        ]} />
        <p style={{ margin: "10px 0 10px" }}>
          <strong>Ownership.</strong> All hardware provided by HOST remains the sole property of HOST Platform LLC
          at all times. Walnut Café is granted a license to use the hardware solely for operating the HOST platform
          during the term of this Agreement.
        </p>
        <p style={{ margin: "0 0 10px" }}>
          <strong>Care & Replacement.</strong> Walnut Café agrees to take reasonable care of all HOST-provided hardware.
          If any hardware item is lost, stolen, or damaged beyond normal wear and tear, Walnut Café is responsible for
          the cost of replacement at HOST's then-current replacement rate (available upon request at {SUPPORT_EMAIL}).
          HOST will invoice Walnut Café for any such replacement; payment is due within 30 days of invoice.
        </p>
        <p style={{ margin: 0 }}>
          <strong>Return.</strong> Upon termination of this Agreement for any reason, Walnut Café agrees to return all
          HOST-provided hardware in reasonable condition within 14 days of the termination date. Hardware not returned
          within this period will be invoiced at HOST's then-current replacement rate.
        </p>
      </Section>

      <Section num={8} title="Intellectual Property">
        <p style={{ margin: 0 }}>
          HOST and all associated software, designs, trademarks, and content are the sole property of HOST Platform LLC
          and its licensors. Nothing in this Agreement grants you any ownership interest in the platform, the software,
          or any HOST intellectual property. You may not copy, modify, distribute, or create derivative works from any
          part of the HOST platform without express prior written permission from HOST.
        </p>
      </Section>

      <Section num={9} title="Fees & Payment">
        <p style={{ margin: "0 0 10px" }}>
          Under the HOST Partner Free Program, platform services are provided at no recurring charge.
          The only financial obligations are:
        </p>
        <Bullets items={[
          "Hardware replacement costs as described in Section 7, if applicable.",
          "Any fees mutually agreed upon in writing by both parties for additional services not covered by this Agreement.",
        ]} />
        <p style={{ margin: "10px 0 0" }}>
          Any changes to fees or the introduction of new charges require at least 30 days' advance written notice
          from HOST. No fee change shall take effect without such written notice.
        </p>
      </Section>

      <Section num={10} title="Availability & Support">
        <p style={{ margin: "0 0 10px" }}>
          HOST makes commercially reasonable efforts to maintain platform availability. However, we do not guarantee
          uninterrupted service. The platform may be unavailable due to scheduled maintenance, updates, or circumstances
          beyond our control.
        </p>
        <p style={{ margin: "0 0 10px" }}>
          HOST is not liable for any losses resulting from platform downtime, including lost covers, walkouts, or revenue
          impact. We recommend maintaining a manual backup process (such as a written list) for use during any outage.
        </p>
        <p style={{ margin: 0 }}>
          Support is available by contacting {SUPPORT_EMAIL}. HOST aims to respond within one business day.
        </p>
      </Section>

      <Section num={11} title="Limitation of Liability">
        <p style={{ margin: "0 0 6px", fontWeight: 700, color: C.text }}>
          TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW:
        </p>
        <Bullets items={[
          "HOST provides the platform \"AS IS\" and \"AS AVAILABLE\" without warranties of any kind, express or implied.",
          "HOST does not warrant that the platform will be error-free, uninterrupted, or free of security vulnerabilities.",
          "In no event shall HOST be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to lost profits, lost revenue, or business interruption.",
          "HOST's total aggregate liability to Walnut Café under this Agreement, for any cause whatsoever, shall not exceed one hundred dollars ($100.00).",
        ]} />
      </Section>

      <Section num={12} title="Indemnification">
        <p style={{ margin: "0 0 10px" }}>
          <strong>By Walnut Café.</strong> You agree to indemnify, defend, and hold harmless HOST Platform LLC and its
          founders, officers, employees, and agents from and against any claims, liabilities, damages, losses, and
          expenses (including reasonable attorneys' fees) arising out of or relating to: (a) your use of the platform
          in violation of this Agreement or applicable law; (b) your negligence or willful misconduct; (c) any guest data
          you enter into the platform, including failure to obtain proper SMS consent; or (d) any claims by your guests,
          employees, or other third parties related to your restaurant operations.
        </p>
        <p style={{ margin: 0 }}>
          <strong>By HOST.</strong> HOST agrees to indemnify and hold harmless Walnut Café from any claims by third
          parties arising from HOST's infringement of a third party's intellectual property rights through the HOST
          platform itself (excluding any content you enter into the platform).
        </p>
      </Section>

      <Section num={13} title="Termination">
        <p style={{ margin: "0 0 10px" }}>
          Either party may terminate this Agreement at any time by providing written notice to the other party.
          Walnut Café may terminate by emailing {SUPPORT_EMAIL}. HOST may terminate or suspend your account at any
          time with or without cause, provided HOST will use reasonable efforts to provide at least 7 days' notice
          except in cases of material breach or fraudulent activity.
        </p>
        <p style={{ margin: "0 0 4px" }}>Upon termination:</p>
        <Bullets items={[
          "Your access to the platform will be deactivated.",
          "Walnut Café has 30 days from the termination date to request an export of its data. After this window, HOST may permanently delete all restaurant and guest data associated with your account.",
          "All HOST-provided hardware must be returned within 14 days as described in Section 7.",
        ]} />
      </Section>

      <Section num={14} title="Governing Law & Disputes">
        <p style={{ margin: "0 0 10px" }}>
          This Agreement is governed by the laws of the State of Colorado, without regard to its conflict of law
          provisions. Any disputes arising under this Agreement shall be resolved in the state or federal courts
          located in Boulder County, Colorado, and both parties consent to the personal jurisdiction of such courts.
        </p>
        <p style={{ margin: 0 }}>
          Before initiating any legal proceedings, both parties agree to make a good-faith effort to resolve disputes
          through direct written communication for a period of no less than 30 days.
        </p>
      </Section>

      <Section num={15} title="Modifications to These Terms">
        <p style={{ margin: 0 }}>
          HOST may update these Terms of Service from time to time. When we do, we will notify you by email with at
          least 14 days' advance notice before changes take effect. If you do not accept the revised terms, you must
          notify HOST in writing within that 14-day window and you may terminate this Agreement without penalty.
          Your continued use of the platform after the effective date of any update, without providing written notice
          of non-acceptance, constitutes your acceptance of the revised terms.
        </p>
      </Section>

      <Section num={16} title="Entire Agreement">
        <p style={{ margin: 0 }}>
          This Agreement constitutes the entire agreement between Walnut Café and HOST with respect to the HOST
          platform and supersedes all prior negotiations, representations, or agreements, whether written or oral.
          If any provision of this Agreement is found to be unenforceable, the remaining provisions will continue
          in full force and effect. This Agreement may not be amended except by a written instrument signed by
          authorized representatives of both parties.
        </p>
      </Section>

      <Section num={17} title="Contact">
        <p style={{ margin: 0 }}>
          For questions about these Terms, platform support, or hardware matters, contact HOST Platform LLC at{" "}
          {SUPPORT_EMAIL} or visit hostplatform.net. Boulder, Colorado.
        </p>
      </Section>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function WalnutAgreementPage() {
  const router = useRouter()

  const [checking, setChecking] = useState(true)   // checking if already signed
  const [name,     setName]     = useState("")
  const [title,    setTitle]    = useState("")
  const [email,    setEmail]    = useState("")
  const [agreed,   setAgreed]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [signed,   setSigned]   = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Agreement no longer required — redirect to logins
  useEffect(() => {
    router.replace("/walnut/logins")
  }, [router])

  const canSign = name.trim().length >= 2 && email.trim().includes("@") && agreed && !loading

  const handleSign = async () => {
    if (!canSign) return
    setLoading(true)
    setError(null)
    try {
      // Capture IP via a lightweight public service (best-effort)
      let ip = ""
      try {
        const ipRes = await fetch("https://api.ipify.org?format=json")
        const ipData = await ipRes.json()
        ip = ipData.ip ?? ""
      } catch { /* ignore */ }

      const res = await fetch(`${API}/agreements/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_name:     "Walnut Café",
          signer_name:       name.trim(),
          signer_email:      email.trim().toLowerCase(),
          signer_title:      title.trim() || null,
          location_count:    2,
          plan_type:         "free-partner",
          monthly_fee:       0,
          agreement_version: AGREEMENT_VERSION,
          ip_address:        ip,
          user_agent:        navigator.userAgent,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.detail ?? `Server error ${res.status}`)
      }
      setSigned(true)
      // Redirect to logins after 2.5s
      setTimeout(() => router.replace("/walnut/logins"), 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again or contact demo@hostplatform.net.")
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 style={{ width: 28, height: 28, color: C.green, animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  if (signed) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", padding: 40 }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: C.greenBg, border: `2px solid ${C.green}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px",
          }}>
            <Check style={{ width: 32, height: 32, color: C.green }} />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: "0 0 8px" }}>Agreement Signed</h2>
          <p style={{ fontSize: 14, color: C.text2, margin: "0 0 4px" }}>
            Thank you, {name.trim()}. Your agreement has been recorded.
          </p>
          <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>Redirecting to your dashboard…</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg }}>
      {/* Header */}
      <div style={{
        background: C.surface,
        borderBottom: `1px solid ${C.border}`,
        padding: "16px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Walnut logo */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} alt="Walnut Café" style={{ height: 36, width: "auto", objectFit: "contain" }} />
          <div style={{ width: 1, height: 28, background: C.border }} />
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.16em", color: C.muted, textTransform: "uppercase" }}>
              Powered by HOST
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Partner Agreement</div>
          </div>
        </div>
        <div style={{ fontSize: 11, color: C.muted }}>Effective {EFFECTIVE_DATE}</div>
      </div>

      <div style={{ maxWidth: 780, margin: "0 auto", padding: "32px 24px 64px" }}>

        {/* Title block */}
        <div style={{ marginBottom: 32, paddingBottom: 24, borderBottom: `2px solid ${C.border}` }}>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: C.text, margin: "0 0 6px" }}>
            HOST Platform Terms of Service
          </h1>
          <p style={{ fontSize: 14, color: C.text2, margin: "0 0 16px" }}>
            Restaurant Partner Agreement — <strong>Walnut Café</strong> (Original & Southside)
          </p>
          <div style={{
            padding: "12px 16px", borderRadius: 8,
            background: "#FFFBEB", border: "1px solid #FDE68A",
          }}>
            <p style={{ fontSize: 12.5, color: "#92400E", margin: 0, lineHeight: 1.6 }}>
              <strong>Please read this Agreement carefully before signing.</strong> By signing below, you agree to
              these Terms of Service on behalf of Walnut Café and confirm you are authorized to bind the business.
            </p>
          </div>
        </div>

        {/* ToS text */}
        <div ref={scrollRef}>
          <TermsText />
        </div>

        {/* Signature form */}
        <div style={{
          marginTop: 40,
          padding: 28,
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: C.text, margin: "0 0 4px" }}>
            Electronic Signature
          </h2>
          <p style={{ fontSize: 12.5, color: C.text2, margin: "0 0 24px", lineHeight: 1.6 }}>
            By completing this form and clicking "Sign & Agree," you are electronically signing this Agreement on
            behalf of Walnut Café. This electronic signature is legally binding under the federal ESIGN Act and
            Colorado UETA.
          </p>

          {/* Fields */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.text2, marginBottom: 6, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Full Legal Name <span style={{ color: C.red }}>*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your full legal name"
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: 8,
                  border: `1px solid ${C.border}`, fontSize: 14, color: C.text,
                  background: C.bg, outline: "none", boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.text2, marginBottom: 6, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Title / Role <span style={{ color: C.muted, fontWeight: 400, textTransform: "none" }}>(optional)</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Owner, General Manager"
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: 8,
                  border: `1px solid ${C.border}`, fontSize: 14, color: C.text,
                  background: C.bg, outline: "none", boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.text2, marginBottom: 6, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Email Address <span style={{ color: C.red }}>*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: 8,
                  border: `1px solid ${C.border}`, fontSize: 14, color: C.text,
                  background: C.bg, outline: "none", boxSizing: "border-box",
                }}
              />
            </div>

            {/* Checkbox */}
            <label style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer" }}>
              <div
                onClick={() => setAgreed(a => !a)}
                style={{
                  width: 20, height: 20, borderRadius: 5, flexShrink: 0, marginTop: 1,
                  border: `2px solid ${agreed ? C.green : C.border}`,
                  background: agreed ? C.green : C.surface,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", transition: "all 0.15s",
                }}
              >
                {agreed && <Check style={{ width: 13, height: 13, color: "#fff", strokeWidth: 3 }} />}
              </div>
              <span style={{ fontSize: 13, color: C.text2, lineHeight: 1.6 }}>
                I have read and fully understand the HOST Platform Terms of Service above, and I agree to be bound
                by this Agreement on behalf of <strong>Walnut Café</strong>. I confirm I am authorized to sign
                contracts on behalf of this business.
              </span>
            </label>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              marginTop: 16, padding: "10px 14px", borderRadius: 8,
              background: "#FEF2F2", border: "1px solid #FECACA",
              fontSize: 12.5, color: C.red, lineHeight: 1.6,
            }}>
              {error}
            </div>
          )}

          {/* Sign button */}
          <button
            onClick={handleSign}
            disabled={!canSign}
            style={{
              marginTop: 20,
              width: "100%",
              padding: "14px 0",
              borderRadius: 10,
              border: "none",
              fontSize: 15,
              fontWeight: 800,
              letterSpacing: "0.04em",
              cursor: canSign ? "pointer" : "not-allowed",
              background: canSign ? C.green : C.border,
              color: canSign ? "#fff" : C.muted,
              transition: "all 0.15s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {loading
              ? <><Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} /> Signing…</>
              : "Sign & Agree"
            }
          </button>

          <p style={{ fontSize: 11, color: C.muted, margin: "12px 0 0", textAlign: "center", lineHeight: 1.5 }}>
            Your name, email, timestamp, and IP address will be recorded as your electronic signature.
            A confirmation is available by contacting {SUPPORT_EMAIL}.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        input:focus { border-color: ${C.green} !important; box-shadow: 0 0 0 3px ${C.greenBg}; }
      `}</style>
    </div>
  )
}
