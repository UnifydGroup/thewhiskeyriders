/**
 * Email Templates
 * ─────────────────────────────────────────────────────────────────────────────
 * Static email templates for the Whiskey Riders admin panel.
 *
 * HOW TO ADD A TEMPLATE:
 *   1. Add a new object to the `emailTemplates` array below.
 *   2. Give it a unique `id`, a `name`, `description`, and `category`.
 *   3. Write the full HTML into the `html` field.
 *      - Use <!-- EDIT: ... --> comments to mark editable sections.
 *      - Use [PLACEHOLDER] tokens for values admins should replace before sending.
 *      - For images, use descriptive src values like "[[IMAGE: Login screen]]"
 *        so admins know exactly which screenshot to drop in.
 *   4. The template will appear automatically in /admin/emails.
 */

export interface EmailTemplate {
  id: string;
  name: string;
  description: string;
  category: 'onboarding' | 'trip' | 'payment' | 'general';
  subject: string;
  html: string;
  updatedAt: string;
}

// ─── Welcome / Onboarding ────────────────────────────────────────────────────

const welcomeEmailHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Welcome to The Whiskey Riders Portal</title>
  <!--
  ═══════════════════════════════════════════════════════════════
  WHISKEY RIDERS — MEMBER WELCOME EMAIL TEMPLATE
  ═══════════════════════════════════════════════════════════════
  HOW TO SEND:
    1. Replace [MEMBER_NAME] with the new member's first name or nickname.
    2. Replace [PORTAL_URL] with https://www.thewhiskeyriders.com
    3. Replace each [[IMAGE: ...]] placeholder with a real <img> src.
       Export screenshots from the portal at 1200px wide, then upload
       them to your image host and paste the URL in.
    4. Paste the final HTML into your email client or Mailchimp/Campaign Monitor.
  ═══════════════════════════════════════════════════════════════
  -->
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:#111;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Georgia,sans-serif}
    .wrap{max-width:680px;margin:0 auto;background:#0D0D0D}

    /* Header */
    .header{background:linear-gradient(160deg,#0D0D0D 0%,#1c1208 60%,#2a1a08 100%);padding:52px 40px 40px;text-align:center;border-bottom:3px solid #B5621E}
    .header-logo{width:80px;height:80px;background:linear-gradient(145deg,#B5621E,#8a4515);border-radius:50%;margin:0 auto 20px;border:3px solid #C9B98A;display:flex;align-items:center;justify-content:center;font-size:32px;box-shadow:0 0 30px rgba(181,98,30,0.4)}
    .header h1{font-size:26px;font-weight:700;color:#C9B98A;letter-spacing:3px;text-transform:uppercase;margin-bottom:6px}
    .header .tagline{font-size:13px;color:#B5621E;letter-spacing:4px;text-transform:uppercase;font-style:italic}

    /* Sections */
    .greeting{padding:40px;background:#0D0D0D;border-bottom:1px solid #1e1e1e}
    .greeting h2{font-size:22px;color:#C9B98A;margin-bottom:14px}
    .section{padding:40px;border-bottom:1px solid #1e1e1e}
    p{font-size:15px;line-height:1.75;color:rgba(245,240,232,0.75);margin-bottom:12px}
    p:last-child{margin-bottom:0}
    strong{color:#F5F0E8}

    /* CTA */
    .cta-wrap{padding:28px 40px;text-align:center;background:#0D0D0D;border-bottom:1px solid #1e1e1e}
    .cta-btn{display:inline-block;background:linear-gradient(135deg,#B5621E,#8a4515);color:#fff;text-decoration:none;padding:16px 48px;border-radius:4px;font-size:14px;font-weight:700;letter-spacing:2px;text-transform:uppercase;border:1px solid #C9B98A;box-shadow:0 4px 20px rgba(181,98,30,0.4)}

    /* Section heading */
    .sec-head{display:flex;align-items:center;gap:12px;margin-bottom:12px}
    .sec-icon{width:38px;height:38px;border-radius:8px;background:linear-gradient(135deg,#B5621E,#8a4515);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
    .sec-head h3{font-size:18px;color:#C9B98A;letter-spacing:1px;font-weight:700}

    /* Screenshots */
    .ss-wrap{border-radius:8px;overflow:hidden;border:1px solid #2e2a24;margin-top:16px;box-shadow:0 8px 32px rgba(0,0,0,0.6)}
    .ss-bar{background:#1a1a1a;padding:8px 14px;display:flex;align-items:center;gap:6px;border-bottom:1px solid #2a2a2a}
    .dot{width:9px;height:9px;border-radius:50%;display:inline-block}
    .dr{background:#ff5f57}.dy{background:#febc2e}.dg{background:#28c840}
    .url-bar{margin-left:10px;background:#0D0D0D;border-radius:4px;padding:3px 12px;font-size:11px;color:#555;font-family:monospace}
    .ss-wrap img{width:100%;display:block}

    /* Features grid */
    .feat-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px}
    .feat{background:#111;border:1px solid #1e1e1e;border-radius:6px;padding:12px;display:flex;gap:10px;align-items:flex-start}
    .feat-icon{font-size:18px;flex-shrink:0;line-height:1;margin-top:2px}
    .feat-label{font-size:12px;font-weight:700;color:#C9B98A}
    .feat-desc{font-size:11px;color:#666;margin-top:3px;line-height:1.5}

    /* Footer */
    .footer{background:#070707;border-top:1px solid #1e1e1e;padding:32px 40px;text-align:center}
    .footer-brand{color:#C9B98A;font-size:13px;letter-spacing:3px;text-transform:uppercase;margin-bottom:6px}
    .footer-tagline{color:#B5621E;font-size:11px;letter-spacing:3px;font-style:italic;margin-bottom:20px}
    .footer p{font-size:12px;color:#444;line-height:1.7}
    .footer a{color:#B5621E;text-decoration:none}
    .footer-divider{width:60px;height:1px;background:#2a2218;margin:20px auto}

    @media(max-width:500px){
      .header,.section,.greeting,.cta-wrap{padding:28px 20px}
      .feat-grid{grid-template-columns:1fr}
    }
  </style>
</head>
<body>
<div class="wrap">

<!-- ════════════════════════════════════════════
     HEADER
     Edit: logo emoji, site name, tagline
════════════════════════════════════════════ -->
<div class="header">
  <div class="header-logo">🏍️</div>
  <h1>The Whiskey Riders</h1>
  <div class="tagline">Ride. Bond. Remember.</div>
</div>

<!-- ════════════════════════════════════════════
     GREETING
     Edit: replace [MEMBER_NAME]
════════════════════════════════════════════ -->
<div class="greeting">
  <h2>Welcome to the crew, [MEMBER_NAME]! 🏍️</h2>
  <p>
    You've just been granted access to <strong>The Whiskey Riders Portal</strong> — your private digital home base
    for everything the crew gets up to. From trip planning to payment tracking, battle stories to voting on who
    destroyed themselves the most — it's all here.
  </p>
  <p>
    Below is a full rundown of what the portal has to offer. Bookmark it, read it, and get amongst it —
    Morocco isn't going to plan itself.
  </p>
</div>

<!-- CTA — Edit: replace [PORTAL_URL] -->
<div class="cta-wrap">
  <a href="[PORTAL_URL]" class="cta-btn">🔑 &nbsp; Enter the Portal</a>
</div>

<!-- ════════════════════════════════════════════
     SECTION 1: SIGNING IN
════════════════════════════════════════════ -->
<div class="section">
  <div class="sec-head">
    <div class="sec-icon">🔐</div>
    <h3>Signing In</h3>
  </div>
  <p>
    Head to <strong>thewhiskeyriders.com</strong> and sign in with your email and password.
    First time in? You'll be prompted to set a new password on first login.
    There's also a <strong>magic link</strong> option — request one and we'll email you a one-click login. No password needed.
  </p>
  <!-- SCREENSHOT: Replace src with your login page image URL -->
  <div class="ss-wrap">
    <div class="ss-bar">
      <span class="dot dr"></span><span class="dot dy"></span><span class="dot dg"></span>
      <span class="url-bar">thewhiskeyriders.com/login</span>
    </div>
    <img src="[[IMAGE: Login page screenshot]]" alt="Whiskey Riders Login Page" width="640" style="width:100%;display:block" />
  </div>
</div>

<!-- ════════════════════════════════════════════
     SECTION 2: DASHBOARD
════════════════════════════════════════════ -->
<div class="section">
  <div class="sec-head">
    <div class="sec-icon">🏠</div>
    <h3>Your Dashboard</h3>
  </div>
  <p>
    The dashboard is your home base. At a glance you'll see trip stats, your payment progress on the next upcoming trip,
    quick access to all your past adventures, and your earned badges. Built to get you where you're going fast.
  </p>
  <!-- SCREENSHOT: Replace src with your dashboard image URL -->
  <div class="ss-wrap">
    <div class="ss-bar">
      <span class="dot dr"></span><span class="dot dy"></span><span class="dot dg"></span>
      <span class="url-bar">thewhiskeyriders.com/dashboard</span>
    </div>
    <img src="[[IMAGE: Dashboard screenshot]]" alt="Dashboard" width="640" style="width:100%;display:block" />
  </div>
</div>

<!-- ════════════════════════════════════════════
     SECTION 3: TRIPS
════════════════════════════════════════════ -->
<div class="section">
  <div class="sec-head">
    <div class="sec-icon">🗺️</div>
    <h3>Trips Page</h3>
  </div>
  <p>
    The Trips page gives you a bird's-eye view of every adventure — past, present, and upcoming. There's a live
    <strong>countdown ticker</strong> for the next trip, a <strong>ride map</strong> showing all the countries the crew has hit,
    and cards for each trip that drop you straight into the details.
  </p>
  <!-- SCREENSHOT: Replace src with your trips page image URL -->
  <div class="ss-wrap">
    <div class="ss-bar">
      <span class="dot dr"></span><span class="dot dy"></span><span class="dot dg"></span>
      <span class="url-bar">thewhiskeyriders.com/trips</span>
    </div>
    <img src="[[IMAGE: Trips page screenshot]]" alt="Trips Page" width="640" style="width:100%;display:block" />
  </div>
</div>

<!-- ════════════════════════════════════════════
     SECTION 4: TRIP UPDATES
════════════════════════════════════════════ -->
<div class="section">
  <div class="sec-head">
    <div class="sec-icon">📰</div>
    <h3>Trip Updates</h3>
  </div>
  <p>
    Click into any trip and you'll land on the <strong>Updates tab</strong> — the feed for all announcements,
    reminders, and news for that adventure. No more digging through WhatsApp to find what Andy posted three weeks ago.
    Everything is pinned, tagged, and timestamped.
  </p>
  <!-- SCREENSHOT: Replace src with your trip updates image URL -->
  <div class="ss-wrap">
    <div class="ss-bar">
      <span class="dot dr"></span><span class="dot dy"></span><span class="dot dg"></span>
      <span class="url-bar">thewhiskeyriders.com/trips/morocco-sahara-desert</span>
    </div>
    <img src="[[IMAGE: Trip updates screenshot]]" alt="Trip Updates" width="640" style="width:100%;display:block" />
  </div>
</div>

<!-- ════════════════════════════════════════════
     SECTION 5: KEY DATES
════════════════════════════════════════════ -->
<div class="section">
  <div class="sec-head">
    <div class="sec-icon">📅</div>
    <h3>Key Dates</h3>
  </div>
  <p>
    The <strong>Key Dates tab</strong> lays out every milestone — deposit deadlines, final payments, passport checks,
    departure and return days. There's no excuse for missing a deadline when it's all right here.
  </p>
  <!-- SCREENSHOT: Replace src with your key dates image URL -->
  <div class="ss-wrap">
    <div class="ss-bar">
      <span class="dot dr"></span><span class="dot dy"></span><span class="dot dg"></span>
      <span class="url-bar">thewhiskeyriders.com/trips/morocco-sahara-desert</span>
    </div>
    <img src="[[IMAGE: Key dates screenshot]]" alt="Key Dates" width="640" style="width:100%;display:block" />
  </div>
</div>

<!-- ════════════════════════════════════════════
     SECTION 6: PAYMENT TRACKER
════════════════════════════════════════════ -->
<div class="section">
  <div class="sec-head">
    <div class="sec-icon">💰</div>
    <h3>Payment Tracker</h3>
  </div>
  <p>
    The <strong>Payments tab</strong> shows full transparency on where the money stands — total collected,
    what's outstanding, and a per-rider breakdown. Every payment is logged so there's never
    a <em>"I'm pretty sure I paid that"</em> conversation again.
  </p>
  <!-- SCREENSHOT: Replace src with your payments image URL -->
  <div class="ss-wrap">
    <div class="ss-bar">
      <span class="dot dr"></span><span class="dot dy"></span><span class="dot dg"></span>
      <span class="url-bar">thewhiskeyriders.com/trips/morocco-sahara-desert</span>
    </div>
    <img src="[[IMAGE: Payment tracker screenshot]]" alt="Payment Tracker" width="640" style="width:100%;display:block" />
  </div>
</div>

<!-- ════════════════════════════════════════════
     SECTION 7: VOTING
════════════════════════════════════════════ -->
<div class="section">
  <div class="sec-head">
    <div class="sec-icon">🏆</div>
    <h3>Awards Voting</h3>
  </div>
  <p>
    After every trip, the <strong>Voting tab</strong> opens and you get to crown the legends (and casualties) of the journey.
    Four categories: <strong>Whiskey Rider of the Trip</strong>, <strong>Biggest Carnage</strong>,
    <strong>Best Story</strong>, and <strong>Trip MVP</strong>. One vote per category. Democracy at its finest.
  </p>
  <!-- SCREENSHOT: Replace src with your voting image URL -->
  <div class="ss-wrap">
    <div class="ss-bar">
      <span class="dot dr"></span><span class="dot dy"></span><span class="dot dg"></span>
      <span class="url-bar">thewhiskeyriders.com/trips/romania-2025</span>
    </div>
    <img src="[[IMAGE: Voting page screenshot]]" alt="Awards Voting" width="640" style="width:100%;display:block" />
  </div>
</div>

<!-- ════════════════════════════════════════════
     SECTION 8: THE CREW
════════════════════════════════════════════ -->
<div class="section">
  <div class="sec-head">
    <div class="sec-icon">👥</div>
    <h3>The Crew</h3>
  </div>
  <p>
    The <strong>Members page</strong> is the full crew roster. Click on anyone to see their rider profile —
    trips they've done, awards earned, and how long they've been part of the gang.
  </p>
  <!-- SCREENSHOT: Replace src with your members page image URL -->
  <div class="ss-wrap">
    <div class="ss-bar">
      <span class="dot dr"></span><span class="dot dy"></span><span class="dot dg"></span>
      <span class="url-bar">thewhiskeyriders.com/members</span>
    </div>
    <img src="[[IMAGE: Members page screenshot]]" alt="The Crew" width="640" style="width:100%;display:block" />
  </div>
</div>

<!-- ════════════════════════════════════════════
     SECTION 9: PROFILE
════════════════════════════════════════════ -->
<div class="section">
  <div class="sec-head">
    <div class="sec-icon">👤</div>
    <h3>Your Rider Profile</h3>
  </div>
  <p>
    Your <strong>Profile</strong> is your permanent record in the crew — trip history, earned badges, and awards.
    The more trips you do, the more glory you accumulate. Go check it out and make sure your details are up to date.
  </p>
  <!-- SCREENSHOT: Replace src with your profile image URL -->
  <div class="ss-wrap">
    <div class="ss-bar">
      <span class="dot dr"></span><span class="dot dy"></span><span class="dot dg"></span>
      <span class="url-bar">thewhiskeyriders.com/profile</span>
    </div>
    <img src="[[IMAGE: Profile page screenshot]]" alt="Rider Profile" width="640" style="width:100%;display:block" />
  </div>
</div>

<!-- ════════════════════════════════════════════
     SECTION 10: FEATURE SUMMARY
     Edit: remove any rows not relevant
════════════════════════════════════════════ -->
<div class="section">
  <div class="sec-head">
    <div class="sec-icon">✅</div>
    <h3>Everything at a Glance</h3>
  </div>
  <p>Quick cheat-sheet of what the portal does:</p>
  <div class="feat-grid">
    <div class="feat"><div class="feat-icon">🏠</div><div><div class="feat-label">Dashboard</div><div class="feat-desc">Trip stats, payment progress, and your upcoming adventure at a glance.</div></div></div>
    <div class="feat"><div class="feat-icon">🗺️</div><div><div class="feat-label">Trips</div><div class="feat-desc">Countdown ticker, ride map, and cards for every adventure.</div></div></div>
    <div class="feat"><div class="feat-icon">📰</div><div><div class="feat-label">Trip Updates</div><div class="feat-desc">All announcements and news, tagged and timestamped.</div></div></div>
    <div class="feat"><div class="feat-icon">📅</div><div><div class="feat-label">Key Dates</div><div class="feat-desc">Deposit deadlines, final payments, departure days — one tab.</div></div></div>
    <div class="feat"><div class="feat-icon">📄</div><div><div class="feat-label">Documents</div><div class="feat-desc">Itineraries, insurance, visa info — downloadable from the trip page.</div></div></div>
    <div class="feat"><div class="feat-icon">💰</div><div><div class="feat-label">Payments</div><div class="feat-desc">Live tracker: collected, outstanding, and per-rider breakdown.</div></div></div>
    <div class="feat"><div class="feat-icon">🏆</div><div><div class="feat-label">Voting</div><div class="feat-desc">Post-trip awards across four categories. One vote, all the drama.</div></div></div>
    <div class="feat"><div class="feat-icon">👤</div><div><div class="feat-label">Profile</div><div class="feat-desc">Your rider record — trips, badges, and awards all tracked.</div></div></div>
  </div>
</div>

<!-- Final CTA — Edit: replace [PORTAL_URL] -->
<div style="padding:40px;text-align:center;background:linear-gradient(160deg,#0D0D0D,#1c1208);border-top:1px solid #2a1a08">
  <p style="color:#C9B98A;font-size:18px;margin-bottom:8px">Ready to ride? 🏍️</p>
  <p style="color:#666;font-size:13px;line-height:1.75;margin-bottom:24px">
    Jump in, poke around, and make sure your profile is up to date.<br/>
    Any questions — hit up the admins in the usual channels.
  </p>
  <a href="[PORTAL_URL]" style="display:inline-block;background:linear-gradient(135deg,#B5621E,#8a4515);color:#fff;text-decoration:none;padding:16px 48px;border-radius:4px;font-size:14px;font-weight:700;letter-spacing:2px;text-transform:uppercase;border:1px solid #C9B98A;box-shadow:0 4px 20px rgba(181,98,30,0.4)">Enter the Portal →</a>
</div>

<!-- ════════════════════════════════════════════
     FOOTER — Edit: contact details
════════════════════════════════════════════ -->
<div class="footer">
  <div class="footer-brand">The Whiskey Riders</div>
  <div class="footer-tagline">Ride. Bond. Remember.</div>
  <div class="footer-divider"></div>
  <p>
    You're receiving this because you've been added to the crew.<br/>
    Portal: <a href="[PORTAL_URL]">thewhiskeyriders.com</a>
    &nbsp;·&nbsp;
    Questions? Contact an admin.
  </p>
</div>

</div>
</body>
</html>`;

// ─── Template Registry ────────────────────────────────────────────────────────

export const emailTemplates: EmailTemplate[] = [
  {
    id: 'welcome-new-member',
    name: 'New Member Welcome',
    description:
      'Sent to new riders when they are granted portal access. Covers every portal feature with screenshots and a portal link.',
    category: 'onboarding',
    subject: 'Welcome to the Whiskey Riders Portal 🏍️',
    html: welcomeEmailHtml,
    updatedAt: '2026-04-20',
  },
  // ── Add more templates here ──────────────────────────────────────────────
  // {
  //   id: 'trip-announcement',
  //   name: 'New Trip Announcement',
  //   description: 'Announce a new trip to all members.',
  //   category: 'trip',
  //   subject: 'New Adventure Announced 🌍',
  //   html: `...`,
  //   updatedAt: '2026-04-20',
  // },
];

export function getTemplateById(id: string): EmailTemplate | undefined {
  return emailTemplates.find((t) => t.id === id);
}

export const categoryLabels: Record<EmailTemplate['category'], string> = {
  onboarding: 'Onboarding',
  trip: 'Trip',
  payment: 'Payment',
  general: 'General',
};

export const categoryColors: Record<EmailTemplate['category'], string> = {
  onboarding: 'bg-brand-brown text-brand-black',
  trip: 'bg-brand-tan text-brand-black',
  payment: 'bg-green-900 text-green-100',
  general: 'bg-brand-dark-grey text-brand-cream border border-brand-brown/30',
};
