# Grow Your Sales with AI Skills — Website

Landing page, registration, admin dashboard and certificate verification for
**Royalstars Technologies Ltd.**, built for Netlify (`royalstarstech.netlify.app`).

## What's inside

| Path | What it is |
|---|---|
| `/` | Landing page with paid enrollment form (bank transfer + receipt upload) |
| `/verify/` | Public certificate verification (`/verify/?no=RST-AICG-2026-001-XXXX` works as a direct link) |
| `/admin/` | Password-protected dashboard: enrollments and payment confirmation, cohort settings, certificates |
| `/privacy/` | Privacy notice (Nigeria Data Protection Act, 2023) |
| `/thank-you/` | Fallback page if JavaScript is off |
| `assets/js/config.js` | **The one file you edit**: Google Analytics ID, Meta Pixel ID, contact details, social links |
| `netlify/functions/` | Serverless backend (`/api/settings`, `/api/stats`, `/api/verify`, `/api/admin/*`) |

## 1. Deploy (5 minutes)

> Drag-and-drop uploads to Netlify only publish the static pages. The admin dashboard and certificate
> verification need the functions, so deploy with **GitHub** (recommended) or the **Netlify CLI**.

**Option A: GitHub (auto-deploys every time you push)**
1. Create a GitHub repository and push this folder to it.
2. In Netlify: **Add new site → Import an existing project → GitHub** → choose the repo.
3. Leave the build settings as they are (read from `netlify.toml`) and click **Deploy**.

**Option B: Netlify CLI**
```bash
npm install -g netlify-cli
npm install
netlify login
netlify init        # create the site
netlify deploy --prod
```

**Site address:** in Netlify go to **Site configuration → Change site name** and enter `royalstarstech`.

## 2. Turn on the form and email alerts
1. Netlify → your site → **Forms** → **Enable form detection**, then redeploy once
   (**Deploys → Trigger deploy**). A form called `enrollment` will appear. (The old `registration`
   form stays there with its past entries; the admin page can still show them.)
2. **Site configuration → Notifications → Emails and webhooks → Form submission notifications →
   Add notification → Email notification** → form `enrollment` → `infoatroyalstars@gmail.com`.

Every new enrollment is now emailed to you (with a link to the receipt, if one was uploaded) and stored in Netlify.

## 3. Set environment variables (for the admin page)
Netlify → **Site configuration → Environment variables → Add a variable**:

| Key | Value |
|---|---|
| `ADMIN_PASSWORD` | A strong password (12+ characters). This is what you type at `/admin/`. |
| `NETLIFY_API_TOKEN` | A personal access token: Netlify → avatar → **User settings → Applications → Personal access tokens → New access token**. Lets the admin page read and delete form submissions. |
| `ADMIN_SECRET` *(optional)* | Any long random text. If set, changing it logs everyone out of the admin page. |

Redeploy after adding variables.

## 4. Confirming payments (daily routine)
1. Open `/admin/` → **Enrollments** → set the filter to **Pending**.
2. For each person, open your Opay app and find a transfer matching **Paid from · amount · date**.
   Click **View** to see their receipt (or check WhatsApp if they sent it there).
3. Found it → **Confirm**. Not found after a day → message them; if it never came → **Reject**.
4. On a confirmed person, click **Send link**. WhatsApp opens with their name and your class link
   already typed. Just press send.

5. If the person ticked 📣 (OK to welcome in group), click **Share to group**. WhatsApp opens with a
   welcome message (first name, business type, city, number confirmed, early-bird spots left).
   Choose your community group and send. Receipts and phone numbers are never shared.

**Live counter:** the website shows "N participants confirmed · X of 15 early-bird spots left" near the price
and in the early-bird band. It counts **confirmed** payments only and updates within about a minute of
each Confirm. The participant number appears from 3 confirmed upward; the early-bird spots always show.

Set the class link (Google Meet or Telegram) and the message once in **Cohort settings → Class link**.
The class link is private: it is never shown on the public website.

## 4b. Training portal (`/portal/`)
Every confirmed participant gets a personal access code (e.g. `RST-7K3Q-92XM`) automatically. It is added to the
**Send link** WhatsApp message, and the **Training** tab has a **Send code** button for each person.
With the code, participants open `/portal/` and find: the live-class link, the pre-test, their training files,
attendance check-in and (from Day 2) the post-test.

Admin → **Training**:
- **Class control:** switch the pre-test and post-test on/off; type a session code and tick **Open** to start
  check-in during class (close it after ~30 minutes). Attendance can also be ticked by hand.
- **Training materials:** upload PDFs (up to 18 MB) and choose when each opens (after the pre-test is recommended).
  Every PDF is stamped with the participant's name and a licence number on every page when they download it.
- **Participants:** scores, improvement, attendance, downloads, and **Switch off** for a code that is being shared.
- **Question analysis:** % correct per topic before vs after, to see what to teach better.
- **Download results CSV** for your evaluation records.

The test questions live in `netlify/lib/questions.mjs`.

**Reviews:** after the post-test, participants rate the class (overall, content, facilitator, practical value,
platform), say how likely they are to recommend it (0–10), and write what they gained, gaps and suggestions.
They can tick permission to publish a short public review. Admin → **Reviews**: **Approve** puts it on `/reviews/`;
**Feature** also shows it on the home page (up to 3). **Hide** removes it. Gains, gaps and suggestions are never public.
The home-page "What participants say" section appears automatically once you approve your first review.

## 4c. Certificates, Practitioner upgrade, challenge, referrals, report
- **Automatic certificates:** when a participant has Day 1 + Day 2 attendance and the post-test, their
  Certificate of Participation is created and appears in their portal (switch in Training → Class control).
- **Certificate designer** (Certificates tab): pick a participant or type a name, see a live preview, **Issue**,
  then download PDF/JPG or send the personal link (`/certificate/?no=…`). Each certificate carries a QR code to
  `/verify/` and Christopher's signature (`assets/img/signature.png`). **Issue to all who qualify** does a batch.
  Wrong name? Training → **Edit name**, then revoke and re-issue.
- **30-day challenge:** tasks from the manual (business-owner or starting-out lane). One day unlocks each day
  from the start date set in Class control. Day 30 scorecard opens on day 28.
- **Practitioner upgrade (₦10,000):** offered in the portal after the post-test and review. Bank transfer +
  form + receipt. Training → **Practitioner upgrades**: Confirm payment → when it shows **READY** (25+ days
  with notes + Day 30 scorecard) → **Issue Practitioner certificate**.
- **Referrals:** each participant has a link `/?ref=XXXXXX`. Enrollments through it show "Referred by" and
  count in the portal. Reward: 1 extra week of free AI-deployment consulting + the Automation Guide (upload it
  in Training materials with "Referral reward" so it unlocks after 1 paid referral).
- **Report tab:** enrollment, attendance, learning gain, confidence, topic analysis, satisfaction/NPS, Day 1 → Day 30
  impact, upgrades and referrals. **Print / Save as PDF** for sponsors. No names are shown.

## 5. Every new cohort (every 2 weeks)
Go to `/admin/` → **Cohort settings**:
- **Cohort name**, e.g. `Cohort 3 — November 2026` (new registrations are tagged with it)
- **Class start**: the page shows the date and a countdown; past dates hide automatically
- **WhatsApp group link**: WhatsApp groups hold about 1,024 members, so use a new group or a
  WhatsApp Community per cohort when needed

- **Class link**: a fresh Google Meet or Telegram link for that cohort

Also update the dates and fee text in `index.html` if they change. The **Enrollments** tab shows each
cohort separately and marks the **first 15 confirmed per cohort as EARLY BIRD**.

## 6. Certificates
Admin → **Certificates**, or tick participants in **Enrollments** and click
**Issue participation certificates**. Each certificate gets a unique number like
`RST-AICG-2026-001-7K3Q`. The 4-character ending stops people guessing other participants'
numbers. Type that number on the certificate. Anyone can confirm it at `/verify/`.
**Revoke** makes a number stop verifying.

## 7. Analytics (when your IDs are ready)
Open `assets/js/config.js` and paste:
```js
GA_MEASUREMENT_ID: "G-XXXXXXXXXX",
META_PIXEL_ID: "123456789012345",
```
Both load **only after a visitor clicks Accept** on the cookie banner. The banner appears automatically
once an ID is set. Events sent: `generate_lead` (GA4) / `Lead` (Meta) on enrollment,
`join_whatsapp` / `Contact` on WhatsApp clicks, `cta_click` on buttons.

## 8. Social links
In `assets/js/config.js` → `SOCIAL`, paste the full URL for each platform. Empty ones show as faded
"coming soon" icons.

## 9. Testimonials
When you have real testimonials from Cohort 1 (with permission), add them in `index.html` inside the
`testimonials` section and delete the word `hidden` from `<section class="testimonials" … hidden>`.

## Good to know
- **Form and upload limits:** Netlify's free plan limits form submissions and uploaded files per month.
  Check **Forms → Usage** in your dashboard. Receipt photos are shrunk in the visitor's phone before upload
  to save space. If cohorts grow beyond the limit, upgrade or ask for a payment gateway (Paystack/Flutterwave).
- Payments are confirmed by hand. Always check your bank app; a screenshot alone is not proof of payment.
- The admin password is checked on the server; login attempts with a wrong password are slowed down.
- Everything visitors type is shown in the admin page as plain text, so it can't run code there.
