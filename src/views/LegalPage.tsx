import { useEffect } from 'react'
import { Link } from 'react-router-dom'

const CONTACT_EMAIL = 'liam@skinetics.tech'
const LAST_UPDATED = '3 October 2026'

type Section = { heading: string; body: Array<string | string[]> }
type Doc = { title: string; lede: string; sections: Section[] }

// A string is a paragraph; a string[] is a bullet list.
const PRIVACY: Doc = {
  title: 'Privacy Policy',
  lede: 'Atlas helps you plan what to see in the night sky. This policy explains what we collect when you use the Atlas website and iPhone app, why, who else handles it, and how to delete it.',
  sections: [
    {
      heading: 'Who we are',
      body: [`Atlas is operated by Skinetics (“we”, “us”). Contact us at ${CONTACT_EMAIL} for anything in this policy.`],
    },
    {
      heading: 'What we collect',
      body: [
        [
          'Account: your email address and a password (stored only as a salted hash). On the website you may instead sign in through our identity provider, Clerk.',
          'Content you create: journal entries, check-ins, observations and the photos you attach to them, your watchlist and saved targets, your camera or telescope models, and your answers to the onboarding questions.',
          'Purchase status: whether you hold Sky Pass, which processor sold it (Polar on the web, Apple in the iPhone app) and, for Apple purchases, the transaction identifiers and expiry date. We never see your card or Apple ID payment details.',
          'Usage and diagnostics: pages and screens viewed, actions taken, device and browser type, and on the website, session recordings (see “Analytics” below).',
          'Notifications: if you opt in, the push subscription needed to send you reminders.',
        ],
      ],
    },
    {
      heading: 'Your location',
      body: [
        'Atlas uses your approximate location to work out which stars and events are visible from where you are and to fetch the local cloud forecast. In the iPhone app this is requested through the system permission prompt and is optional; if you decline, Atlas shows a default city.',
        'Star positions, darkness and Moon phase are computed on your device. Your coordinates are sent to our weather provider, Open-Meteo, to obtain the forecast, and we do not store your iPhone location on our servers. On the website, a location you choose to save in your settings is stored with your account.',
      ],
    },
    {
      heading: 'Why we use it',
      body: [
        [
          'To provide Atlas: sign you in, build your sky plan, store your journal and watchlist, and send reminders you asked for.',
          'To honour your purchase: unlock Sky Pass on every Atlas app and the website, whichever processor you paid through.',
          'To improve Atlas: understand which features work and where people get stuck, and fix errors.',
          'To keep Atlas safe: prevent abuse and fraud, and meet legal obligations.',
        ],
        'We do not sell your personal information and we do not use it for advertising or to track you across other companies’ apps and websites.',
      ],
    },
    {
      heading: 'Analytics',
      body: [
        'The website uses PostHog to measure usage. This includes session recordings, in which what you see and do on Atlas is replayed for our team to find bugs and confusing screens. Text you type into form fields is masked and not recorded. Your account id and whether you hold Sky Pass are attached to this activity so we can understand it by plan. We link your purchase status to your Atlas account id, not to your name or payment details.',
      ],
    },
    {
      heading: 'Who handles your data',
      body: [
        'We use these service providers to run Atlas. Each receives only what it needs for its job:',
        [
          'Hosting and storage: our servers and media storage (including Cloudflare and Fly.io), which hold your account and content.',
          'Clerk: website sign-in and identity. We tell Clerk whether your account holds Sky Pass.',
          'PostHog: analytics and session recordings, described above.',
          'Polar: web payments and receipts for Sky Pass bought on the website.',
          'Apple: In-App Purchase for Sky Pass bought in the iPhone app, and the App Store notifications that tell us about renewals and refunds.',
          'Open-Meteo: weather forecasts, which receive the coordinates of the place you are viewing from.',
          'Anthropic: when you use Ask Atlas or AI-assisted captions, the text of your request (and any content you submit with it) is sent to Anthropic to generate a reply.',
        ],
        'We may also disclose information where the law requires it.',
      ],
    },
    {
      heading: 'Keeping it and deleting it',
      body: [
        'We keep your account and content until you delete your account. You can delete your account at any time: in the iPhone app, open your account (top right) and choose Delete account; on the website, use Settings → Permanently delete account. Deletion removes your Atlas account, journal, watchlist and check-ins on every Atlas app and the website, and deletes your Clerk identity.',
        'Deleting your account does not cancel an App Store subscription. Cancel it in Settings → Apple ID → Subscriptions on your device, or through Polar for web purchases. We keep a minimal record of purchase transactions where needed for accounting, refund handling and legal compliance; these are not linked to your name and email once your account is deleted. Analytics data is retained for a limited period and removed or anonymised on request.',
      ],
    },
    {
      heading: 'Your choices and rights',
      body: [
        'Depending on where you live, you may have the right to access, correct, export or delete your information, to object to or restrict some processing, and to complain to your local privacy regulator. Email us and we will respond within a reasonable time. You can also turn off location and notifications in your device settings at any time.',
      ],
    },
    {
      heading: 'Children',
      body: ['Atlas is not directed at children under 13, and we do not knowingly collect their information. If you believe a child has given us personal information, contact us and we will delete it.'],
    },
    {
      heading: 'Security and transfers',
      body: ['We protect your data with encryption in transit, hashed passwords and access controls. Our providers may process data in countries other than your own; where they do, we rely on their contractual safeguards.'],
    },
    {
      heading: 'Changes',
      body: ['If we change this policy in a meaningful way we will update the date above and, where appropriate, tell you in the app.'],
    },
  ],
}

const TERMS: Doc = {
  title: 'Terms of Use (End User License Agreement)',
  lede: 'These terms are the agreement between you and Skinetics for using Atlas, including the Atlas iPhone app (the “App”) and the website, and for buying Sky Pass.',
  sections: [
    {
      heading: 'Licence',
      body: [
        'We grant you a personal, non-exclusive, non-transferable, revocable licence to use the App on Apple devices you own or control, and to use the website, for your own non-commercial stargazing and photography planning. You may not copy, modify, reverse engineer, resell or misuse Atlas, or use it to harm others or our services.',
        'This agreement is between you and Skinetics, not Apple. Apple is not responsible for the App or its content, has no obligation to provide maintenance or support, and is a third-party beneficiary of this agreement with the right to enforce it against you. If the App fails to meet any applicable warranty, you may notify Apple for a refund of the purchase price (if any); to the extent allowed by law, Apple has no other warranty obligation. Apple is not responsible for addressing claims about the App, including product liability, legal compliance or intellectual property infringement claims.',
      ],
    },
    {
      heading: 'Your account',
      body: ['You are responsible for your account credentials and for what happens under your account. Provide accurate information and tell us if you suspect unauthorised use. You can delete your account at any time from the app or website.'],
    },
    {
      heading: 'Sky Pass',
      body: [
        'Sky Pass is an optional paid upgrade. It is available as a monthly subscription, a yearly subscription, or a one-time lifetime purchase. The price is shown in the App or at checkout before you buy.',
        [
          'Entitlement: Sky Pass is attached to your Atlas account. A purchase made in the iPhone app (through Apple) or on the website (through Polar) unlocks Sky Pass everywhere you sign in to Atlas.',
          'Payment: purchases in the iPhone app are charged to your Apple ID at confirmation of purchase. Website purchases are charged by Polar.',
          'Auto-renewal: monthly and yearly subscriptions renew automatically at the same price and length unless cancelled at least 24 hours before the end of the current period. Your account is charged for renewal within 24 hours before the period ends.',
          'Managing and cancelling: for App Store purchases, manage or cancel in Settings → Apple ID → Subscriptions; deleting the App or your Atlas account does not cancel a subscription. For website purchases, manage them through Polar. After cancelling, you keep Sky Pass until the paid period ends.',
          'Lifetime: a one-time purchase that unlocks Sky Pass for as long as Atlas offers it. It is not a subscription and does not renew.',
          'Refunds: App Store purchases are refunded by Apple under its policies (request through reportaproblem.apple.com). Website purchases are refunded by us on request within 14 days of purchase. If a purchase is refunded, Sky Pass access from that purchase ends.',
          'Features: Sky Pass features can change as Atlas develops. We will not remove access you have paid for during the period you have paid for.',
        ],
      ],
    },
    {
      heading: 'Your content',
      body: ['You keep ownership of what you create in Atlas, such as journal entries and photos. You give us a licence to store, process and display it as needed to run Atlas for you, and to show anything you choose to share publicly. Do not upload anything unlawful, infringing or harmful.'],
    },
    {
      heading: 'Sky information is a guide',
      body: ['Event timings, visibility, weather and star positions are provided in good faith but may be wrong or change. Observe safely: take care in the dark and in unfamiliar places, never look at the Sun without proper filters, and do not rely on Atlas for safety-critical decisions.'],
    },
    {
      heading: 'Availability and changes',
      body: ['We may update, suspend or discontinue parts of Atlas. We may update these terms; if a change is significant we will tell you, and continuing to use Atlas after it takes effect means you accept it.'],
    },
    {
      heading: 'Disclaimer and liability',
      body: [
        'Atlas is provided “as is” and “as available”. To the fullest extent permitted by law, we exclude all implied warranties and are not liable for indirect or consequential loss, or for loss of data, profit or use. Nothing in these terms limits any right you have under consumer law that cannot be excluded, or liability that cannot be limited by law.',
      ],
    },
    {
      heading: 'Termination',
      body: ['You may stop using Atlas and delete your account at any time. We may suspend or end your access if you breach these terms. Sections that by their nature should survive termination will survive it.'],
    },
    {
      heading: 'Governing law',
      body: ['These terms are governed by the laws of Western Australia, Australia, and the courts of that State, without limiting any mandatory consumer rights you have where you live.'],
    },
    {
      heading: 'Contact',
      body: [`Questions about these terms: ${CONTACT_EMAIL}. See also our Privacy Policy.`],
    },
  ],
}

function renderBody(items: Section['body']) {
  return items.map((item, i) =>
    Array.isArray(item) ? (
      <ul key={i}>{item.map((li) => <li key={li}>{li}</li>)}</ul>
    ) : (
      <p key={i}>{item}</p>
    ),
  )
}

export function LegalPage({ kind }: { kind: 'privacy' | 'terms' }) {
  const doc = kind === 'privacy' ? PRIVACY : TERMS
  useEffect(() => {
    document.title = `${doc.title.split(' (')[0]} · Atlas`
  }, [doc])

  return (
    <div className="atlas-almanac">
      <header className="am-masthead">
        <div className="am-masthead-meta">
          <span>Legal</span>
          <Link to="/">← Atlas</Link>
        </div>
        <div className="am-masthead-title">
          <div className="am-wordmark">ATLAS</div>
          <div className="am-tagline">{doc.title}</div>
        </div>
      </header>
      <main className="am-legal">
        <p className="am-legal-updated">Last updated {LAST_UPDATED}</p>
        <p>{doc.lede}</p>
        {doc.sections.map((s) => (
          <section key={s.heading}>
            <h2>{s.heading}</h2>
            {renderBody(s.body)}
          </section>
        ))}
        <p className="am-legal-links">
          <Link to="/privacy">Privacy Policy</Link> · <Link to="/terms">Terms of Use</Link>
        </p>
      </main>
    </div>
  )
}
