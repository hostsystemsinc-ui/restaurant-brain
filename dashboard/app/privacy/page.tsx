import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Privacy Policy — HOST",
  description: "HOST Platform Privacy Policy — how we collect, use, and protect personal information.",
}

export default function PrivacyPage() {
  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", color: "#fff", fontFamily: "var(--font-geist), -apple-system, 'Helvetica Neue', sans-serif" }}>

      {/* Nav */}
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 56px", height: 64, background: "rgba(6,6,6,0.96)", backdropFilter: "blur(24px)", borderBottom: "1px solid rgba(255,255,255,0.06)", position: "sticky", top: 0, zIndex: 100 }}>
        <Link href="/" style={{ textDecoration: "none" }}>
          <span style={{ fontWeight: 900, letterSpacing: ".22em", fontSize: ".88rem", color: "#fff" }}>HOST</span>
        </Link>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link href="/login" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none", fontSize: ".85rem", padding: "8px 16px", borderRadius: 8 }}>Log In</Link>
          <Link href="/#demo" style={{ background: "#22c55e", color: "#000", fontWeight: 700, fontSize: ".85rem", padding: "9px 22px", borderRadius: 9, textDecoration: "none" }}>
            Schedule Free Demo
          </Link>
        </div>
      </nav>

      {/* Page header */}
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "72px 40px 48px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ fontSize: ".72rem", fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "#22c55e", marginBottom: 16 }}>Legal</div>
        <h1 style={{ fontSize: "2.4rem", fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1.15, marginBottom: 16 }}>Privacy Policy</h1>
        <p style={{ fontSize: ".88rem", color: "rgba(255,255,255,0.4)" }}>Effective date: May 26, 2026 &nbsp;·&nbsp; HOST Platform, Inc.</p>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "56px 40px 100px" }}>

        <Section title="Overview">
          <P>HOST Platform, Inc. ("HOST," "we," "us") provides a waitlist management system used by restaurants and their guests. This Privacy Policy explains what information we collect, how we use it, and the rights you have regarding your personal information.</P>
          <P>This policy applies to two groups: <strong>Restaurant Clients</strong> — businesses that subscribe to HOST — and <strong>Guests</strong> — individuals who join a waitlist at a restaurant that uses our system.</P>
        </Section>

        <Section title="Information We Collect">
          <P><strong>From Guests (people joining a waitlist):</strong></P>
          <UL items={[
            "Name (required to join the waitlist)",
            "Phone number (optional — provided only if the guest wants SMS updates)",
            "Party size and seating preference",
            "Any notes entered by restaurant staff (e.g., allergies, special occasion)",
          ]} />
          <P><strong>From Restaurant Clients:</strong></P>
          <UL items={[
            "Restaurant name, address, and contact information",
            "Account login credentials (stored hashed — never as plaintext)",
            "Billing information (processed by our payment processor; HOST does not store card numbers)",
            "Floor plan layout and configuration preferences",
          ]} />
          <P><strong>Automatically collected:</strong></P>
          <UL items={[
            "Basic usage data for system reliability",
            "IP addresses and browser/device type for security and debugging",
            "Session cookies used to keep restaurant staff logged in",
          ]} />
        </Section>

        <Section title="How We Use Your Information">
          <P>Guest information is used solely to operate the waitlist — notifying guests when their table is ready, tracking position in line, and enabling hosts to manage seating. Guest phone numbers are never used for marketing.</P>
          <P>Restaurant client information is used to provide and maintain the HOST service, process billing, and communicate about the account.</P>
          <P>Automatically collected data is used for service reliability and security. We do not use it for advertising.</P>
        </Section>

        <Section title="SMS Notifications">
          <div style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.1)", borderLeft: "3px solid #22c55e", borderRadius: 8, padding: "16px 20px", marginBottom: 12 }}>
            <p style={{ fontSize: ".9rem", color: "rgba(255,255,255,0.7)", lineHeight: 1.7, margin: 0 }}>
              Guests who provide a phone number consent to receive a single SMS notification when their table is ready. Message and data rates may apply. Reply <strong style={{ color: "#fff" }}>STOP</strong> to opt out at any time. HOST will not send marketing messages to guest phone numbers.
            </p>
          </div>
          <P>SMS delivery is handled by third-party messaging providers. Guest phone numbers are used only to send the table-ready notification and are not retained beyond the active waitlist session.</P>
        </Section>

        <Section title="Information Sharing">
          <P>We do not sell personal information. We do not share personal information with third parties for their own marketing purposes.</P>
          <P>We share information only with service providers that help us operate HOST:</P>
          <UL items={[
            "Twilio / TextBelt — SMS delivery",
            "Supabase — database hosting",
            "Railway — application hosting",
            "Payment processor — billing for restaurant subscriptions",
          ]} />
          <P>These providers are contractually required to use information only to perform services for HOST. We may also disclose information if required by law or to protect the safety of HOST or others.</P>
        </Section>

        <Section title="Data Retention">
          <P>Guest waitlist data is cleared at the close of each business day. Phone numbers are not retained after a guest is seated.</P>
          <P>Restaurant client account data is retained for the duration of the subscription and up to 90 days after cancellation, after which it is deleted.</P>
        </Section>

        <Section title="California Residents — Your Rights Under the CCPA">
          <P>If you are a California resident, the California Consumer Privacy Act (Cal. Civ. Code § 1798.100 et seq., as amended by the CPRA) gives you the following rights:</P>
          <UL items={[
            "Right to Know — request disclosure of the categories and specific pieces of personal information we have collected about you.",
            "Right to Delete — request deletion of personal information we have collected from you, subject to certain exceptions.",
            "Right to Correct — request correction of inaccurate personal information we hold about you.",
            "Right to Opt Out of Sale or Sharing — HOST does not sell or share personal information for cross-context behavioral advertising. No opt-out is necessary, but you may contact us to confirm.",
            "Right to Non-Discrimination — we will not discriminate against you for exercising any of these rights.",
          ]} />
          <P>To submit a request, email <a href="mailto:privacy@hostplatform.net" style={{ color: "#22c55e", textDecoration: "none" }}>privacy@hostplatform.net</a> with the subject line "California Privacy Request." We will respond within 45 days. We may ask you to verify your identity before processing the request.</P>
          <P>For guest-side requests, please include the restaurant name, approximate date of visit, and the name used when joining the waitlist.</P>
        </Section>

        <Section title="Cookies">
          <P>This site uses minimal cookies — primarily a session cookie that keeps restaurant staff logged into the HOST dashboard. We do not use advertising cookies or third-party tracking cookies.</P>
        </Section>

        <Section title="Security">
          <P>We protect personal information using industry-standard measures including encrypted storage, hashed credentials, HTTPS in transit, and access controls. No system is perfectly secure, but we take the protection of your data seriously.</P>
        </Section>

        <Section title="Children's Privacy">
          <P>HOST is not directed at children under 13. We do not knowingly collect personal information from children. Contact us if you believe a child has provided us with personal information and we will delete it promptly.</P>
        </Section>

        <Section title="Changes to This Policy">
          <P>We may update this Privacy Policy from time to time. When we do, we will update the effective date at the top of this page. For material changes, we will notify restaurant clients via email.</P>
        </Section>

        <Section title="Contact Us" last>
          <P>For questions or privacy requests:</P>
          <UL items={[
            "Privacy requests: privacy@hostplatform.net",
            "General: hello@hostplatform.net",
          ]} />
          <P>HOST Platform, Inc.</P>
        </Section>

      </div>

      {/* Footer */}
      <footer style={{ padding: "28px 56px", borderTop: "1px solid rgba(255,255,255,0.06)", background: "#080A0C" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <span style={{ fontWeight: 900, letterSpacing: ".22em", fontSize: ".82rem", color: "rgba(255,255,255,0.5)" }}>HOST</span>
          <span style={{ fontSize: ".82rem", color: "rgba(255,255,255,0.22)" }}>· a smarter waitlist</span>
        </div>
      </footer>

    </div>
  )
}

/* ── Sub-components ──────────────────────────────────────────────────────── */

function Section({ title, children, last = false }: { title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div style={{ marginBottom: last ? 0 : 48 }}>
      <h2 style={{
        fontSize: "1.05rem", fontWeight: 700, marginBottom: 14,
        paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.07)",
        color: "#fff",
      }}>{title}</h2>
      {children}
    </div>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: ".93rem", color: "rgba(255,255,255,0.65)", lineHeight: 1.75, marginBottom: 12 }}>
      {children}
    </p>
  )
}

function UL({ items }: { items: string[] }) {
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: "0 0 12px 0", display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((item, i) => (
        <li key={i} style={{ fontSize: ".93rem", color: "rgba(255,255,255,0.65)", lineHeight: 1.7, paddingLeft: 18, position: "relative" }}>
          <span style={{ position: "absolute", left: 0, color: "#22c55e" }}>–</span>
          {item}
        </li>
      ))}
    </ul>
  )
}
