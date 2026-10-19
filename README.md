# Grow Your Sales with AI Skills — Website

Landing page, registration, admin dashboard and certificate verification for
**Royalstars Technologies Ltd.**, built for Netlify (`royalstarstech.netlify.app`).

## What's inside

| Path | What it is |
|---|---|
| `/` | Landing page (registration form → WhatsApp group) |
| `/verify/` | Public certificate verification (`/verify/?no=RST-AICG-2026-001-XXXX` works as a direct link) |
| `/admin/` | Password-protected dashboard: registrations, cohort settings, certificates |
| `/privacy/` | Privacy notice (Nigeria Data Protection Act, 2023) |
| `/thank-you/` | Fallback page if JavaScript is off |
| `assets/js/config.js` | **The one file you edit**: Google Analytics ID, Meta Pixel ID, contact details, social links |
| `netlify/functions/` | Serverless backend (`/api/settings`, `/api/verify`, `/api/admin/*`) |

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
   (**Deploys → Trigger deploy**). A form called `registration` will appear.
2. **Site configuration → Notifications → Emails and webhooks → Form submission notifications →
   Add notification → Email notification** → form `registration` → `infoatroyalstars@gmail.com`.

Every new registration is now emailed to you and stored in Netlify.

## 3. Set environment variables (for the admin page)
Netlify → **Site configuration → Environment variables → Add a variable**:

| Key | Value |
|---|---|
| `ADMIN_PASSWORD` | A strong password (12+ characters). This is what you type at `/admin/`. |
| `NETLIFY_API_TOKEN` | A personal access token: Netlify → avatar → **User settings → Applications → Personal access tokens → New access token**. Lets the admin page read and delete form submissions. |
| `ADMIN_SECRET` *(optional)* | Any long random text. If set, changing it logs everyone out of the admin page. |

Redeploy after adding variables.

## 4. Every new cohort (every 2 weeks)
Go to `/admin/` → **Cohort settings**:
- **Cohort name**, e.g. `Cohort 3 — November 2026` (new registrations are tagged with it)
- **Class start**: the page shows the date and a countdown; past dates hide automatically
- **WhatsApp group link**: WhatsApp groups hold about 1,024 members, so use a new group or a
  WhatsApp Community per cohort when needed

No redeploy needed. The **Registrations** tab shows each cohort separately and marks the
**first 15 per cohort as EARLY BIRD**.

## 5. Certificates
Admin → **Certificates**, or tick participants in **Registrations** and click
**Issue participation certificates**. Each certificate gets a unique number like
`RST-AICG-2026-001-7K3Q`. The 4-character ending stops people guessing other participants'
numbers. Type that number on the certificate. Anyone can confirm it at `/verify/`.
**Revoke** makes a number stop verifying.

## 6. Analytics (when your IDs are ready)
Open `assets/js/config.js` and paste:
```js
GA_MEASUREMENT_ID: "G-XXXXXXXXXX",
META_PIXEL_ID: "123456789012345",
```
Both load **only after a visitor clicks Accept** on the cookie banner. The banner appears automatically
once an ID is set. Events sent: `generate_lead` (GA4) / `Lead` (Meta) on registration,
`join_whatsapp` / `Contact` on WhatsApp clicks, `cta_click` on buttons.

## 7. Social links
In `assets/js/config.js` → `SOCIAL`, paste the full URL for each platform. Empty ones show as faded
"coming soon" icons.

## 8. Testimonials
When you have real testimonials from Cohort 1 (with permission), add them in `index.html` inside the
`testimonials` section and delete the word `hidden` from `<section class="testimonials" … hidden>`.

## Good to know
- **Form limits:** Netlify's free plan includes a limited number of form submissions per month. Check
  **Forms → Usage** in your dashboard. If cohorts grow beyond it, upgrade or ask for a switch to a
  database-backed form.
- The admin password is checked on the server; login attempts with a wrong password are slowed down.
- Everything visitors type is shown in the admin page as plain text, so it can't run code there.
