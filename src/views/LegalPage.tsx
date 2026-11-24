import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

// Public pages the iOS app and the App Store listing link to. They must render
// without an account and must never redirect into the workspace.
// Confirm this mailbox exists before App Review: Apple wants a working contact.
export const SUPPORT_EMAIL = 'support@youratlas.cc'
const UPDATED = '24 November 2026'

type Kind = 'privacy' | 'terms' | 'support'

function Page({ title, children }: { title: string; children: ReactNode }) {
  return <main className="legal-page">
    <nav aria-label="Legal"><Link to="/app/hub">Atlas</Link> · <Link to="/privacy">Privacy</Link> · <Link to="/terms">Terms</Link> · <Link to="/support">Support</Link></nav>
    <h1>{title}</h1>
    <p className="legal-updated">Last updated {UPDATED}</p>
    {children}
  </main>
}

function Privacy() {
  return <Page title="Privacy Policy">
    <p>Atlas shows what is in the sky tonight where you are. This page explains what the Atlas iPhone app and website collect, why, and what you can do about it.</p>
    <h2>What we collect</h2>
    <ul>
      <li><strong>Account:</strong> your email address and a password (stored hashed) if you create an account. You can use much of Atlas as a guest without one.</li>
      <li><strong>Location:</strong> the place you choose or, if you allow it, your device location while you use the app. It is used to work out what is above you and when it gets dark, and it is looked up against a weather forecast service. Your chosen place is saved to your account so it follows you between devices.</li>
      <li><strong>Your content:</strong> check-ins, notes, journal entries, saved targets, preferences and the sky photos you choose to upload.</li>
      <li><strong>Camera, photos and motion:</strong> used on your device to take and pick sky photos and to point the sky chart. Photos are uploaded only when you submit them.</li>
      <li><strong>Notifications:</strong> if you turn alerts on, a device token so we can send them.</li>
      <li><strong>Usage analytics:</strong> which screens and features are used, linked to your Atlas user ID but never to your email, notes or coordinates. We do not record your screen.</li>
      <li><strong>Purchases:</strong> Sky Pass purchases are handled by Apple (iPhone) or our payment processor (web). We receive confirmation that you hold Sky Pass, not your card details.</li>
    </ul>
    <h2>Ask Atlas and AI</h2>
    <p>When you ask Atlas a question, the app sends your question, your last few messages and a short summary of tonight (your place name, cloud cover, moon phase and top target) to our server, which forwards it to Anthropic to write the answer. Nothing is sent until you agree in the app and press Ask. Your questions are not used to advertise to you. Anthropic processes them under its own terms and privacy policy.</p>
    <h2>Who else handles data</h2>
    <p>We use service providers to run Atlas: hosting and database (Fly.io), file storage and delivery (Cloudflare), sign-in for the website (Clerk), analytics (PostHog), weather data (Open-Meteo), payments (Apple and Polar) and the AI provider above. They process data only to provide their service to us. We do not sell your data and we do not track you across other companies' apps or sites.</p>
    <h2>Keeping and deleting your data</h2>
    <p>We keep your data while your account exists. In the iPhone app go to Settings, then Account and Sky Pass, then Delete account. This permanently deletes your account, journal, saved targets and check-ins on every Atlas app and the website. Deleting your account does not cancel an App Store subscription; cancel it in Settings, then your Apple ID, then Subscriptions. You can also ask us to delete or export your data at <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>
    <h2>Children</h2>
    <p>Atlas is not directed at children under 13 and we do not knowingly collect their data.</p>
    <h2>Contact</h2>
    <p>Questions or requests: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. We may update this policy and will change the date above when we do.</p>
  </Page>
}

function Terms() {
  return <Page title="Terms of Use">
    <p>By using Atlas you agree to these terms. If you do not agree, please do not use it.</p>
    <h2>Using Atlas</h2>
    <p>Atlas gives sky information and observing guidance for personal use. Predictions, times, forecasts and Ask Atlas answers can be wrong. Do not rely on them for safety, and take care when observing at night, near roads or water, or with telescopes. Never point optics at the Sun without proper solar filters.</p>
    <h2>Your content</h2>
    <p>You keep ownership of the notes, photos and entries you add. You give Atlas permission to store and display them to you, and, where a feature such as a photo challenge says so, to show an approved submission to other people. Only upload content you have the right to share. Do not upload anything unlawful, abusive or someone else's private information. We may remove content and accounts that break these terms. You can report content or an answer from inside the app or at <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>, and we aim to review reports within 24 hours.</p>
    <h2>Sky Pass subscriptions and purchases</h2>
    <p>Sky Pass is offered as a monthly subscription, a yearly subscription or a one-time lifetime purchase. Prices are shown in the app before you buy. Subscriptions bought on iPhone are charged to your Apple ID and renew automatically unless you cancel at least 24 hours before the end of the current period. Manage or cancel in Settings, then your Apple ID, then Subscriptions. Payment is taken at confirmation of purchase. Refunds for App Store purchases are handled by Apple. Sky Pass belongs to your Atlas account and unlocks on every device where you sign in.</p>
    <h2>Apple</h2>
    <p>For the iPhone app, these terms are between you and Atlas, not Apple. Apple has no obligation to provide support or maintenance for the app and is not responsible for claims about it. Apple and its subsidiaries are third-party beneficiaries of these terms and may enforce them against you. The Apple Media Services terms also apply to purchases.</p>
    <h2>Liability</h2>
    <p>Atlas is provided as is. To the extent the law allows, we are not liable for indirect or consequential loss arising from use of Atlas.</p>
    <h2>Contact</h2>
    <p><a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. See also our <Link to="/privacy">Privacy Policy</Link>.</p>
  </Page>
}

function Support() {
  return <Page title="Support">
    <p>Need help with Atlas, want to report content or an Ask Atlas answer, or want your data deleted? Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and include the email address on your account.</p>
    <h2>Common questions</h2>
    <ul>
      <li><strong>Delete my account:</strong> iPhone app, Settings, Account and Sky Pass, Delete account.</li>
      <li><strong>Cancel a subscription:</strong> Settings on your iPhone, your Apple ID, Subscriptions.</li>
      <li><strong>Restore a purchase:</strong> open Sky Pass in the app and choose Restore Purchases.</li>
      <li><strong>Report a problem answer or content:</strong> use Report in the app, or email us.</li>
    </ul>
    <p>Read the <Link to="/privacy">Privacy Policy</Link> and <Link to="/terms">Terms of Use</Link>.</p>
  </Page>
}

export default function LegalPage({ kind }: { kind: Kind }) {
  return kind === 'privacy' ? <Privacy /> : kind === 'terms' ? <Terms /> : <Support />
}
