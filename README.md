# Labour Law Alliance — website

Static rebuild of labourlawalliance.co.za (previously WordPress + Elementor), ready for GitHub + Vercel.
No build step: plain HTML, CSS and JavaScript, plus one serverless function for the two forms.

```
index.html              the page
assets/css/style.css    all styles (desktop, tablet, mobile)
assets/js/main.js       slider, mobile menu, sticky header, forms, cookie consent
assets/images/          images (filled by the script below)
api/contact.js          Vercel function that emails form submissions (via Resend)
scripts/fetch-images.mjs  one-off: copies images from the WordPress site
vercel.json             clean URLs, caching, security headers, old WP URL redirects
```

## 1. Copy the images (do this BEFORE you cancel WordPress hosting)

```bash
node scripts/fetch-images.mjs
```

This downloads the logo, hero slides, about photo, map pattern and favicons into `assets/images/`.
If it can't run, save these files manually into `assets/images/` with the names shown:

| Save as | From |
|---|---|
| logo.png | /wp-content/uploads/2026/03/Labour-Law-logo-723.png |
| about-us.png | /wp-content/uploads/2026/03/about-us.png |
| hero-1.png | /wp-content/uploads/2026/03/Untitled-3.png |
| hero-2.png | /wp-content/uploads/2026/03/Untitled-4.png |
| shape-2.webp | /wp-content/uploads/2022/05/shape-2-e1652457140698.webp |
| favicon-32.png / -180 / -192 | /wp-content/uploads/2026/03/cropped-cropped-cropped-Labour-Law-3-32x32.png (and 180x180, 192x192) |

Tip: `about-us.png` (~620 KB) and the hero PNGs are heavy. Converting them to WebP/JPG
(e.g. squoosh.app) will make the site load noticeably faster — just keep the same filenames or update the paths.

## 2. Push to GitHub

```bash
git init
git add .
git commit -m "Labour Law Alliance static site"
git branch -M main
git remote add origin https://github.com/<you>/labourlawalliance.git
git push -u origin main
```

## 3. Deploy on Vercel

1. vercel.com → **Add New → Project** → import the GitHub repo.
2. Framework preset: **Other**. Leave build command and output directory empty.
3. Deploy.

## 4. Make the forms send email

Both forms (Book Appointment + Contact Us) post to `/api/contact`, which emails you using [Resend](https://resend.com) (free tier is plenty).

1. Sign up at resend.com, add and verify the domain `labourlawalliance.co.za` (it gives you DNS records to add).
2. Create an API key.
3. In Vercel → Project → **Settings → Environment Variables**, add:
   - `RESEND_API_KEY` = your key
   - `CONTACT_TO` = `info@labourlawalliance.co.za` (comma-separate for several)
   - `CONTACT_FROM` = `Labour Law Alliance <website@labourlawalliance.co.za>`
4. Redeploy. Submissions arrive with Reply-To set to the visitor's email.

Spam protection: a hidden honeypot field (same as the WordPress site) — bots that fill it are silently dropped.

## 5. Point the domain

Vercel → Project → **Settings → Domains** → add `labourlawalliance.co.za` and `www.labourlawalliance.co.za`,
then update DNS at your registrar as Vercel instructs (A record `76.76.21.21`, CNAME `cname.vercel-dns.com` for www).
**Keep your existing MX (email) records** so info@ mail keeps working.

## What carried over

- All text, sections, links, phone/WhatsApp/email/social links, anchors (#about, #expertise, #appointment, #contact)
- Hero slider (2 slides, fade, autoplay, arrows, swipe), sticky header, mobile hamburger menu, back-to-top button
- Enquiry form + Contact form with validation and honeypot
- Cookie consent banner (Accept / Reject / Customize with categories) wired to Google Consent Mode
- Google tag `GT-PBCVP67H`, Search Console verification meta, SEO/Open Graph meta, structured data, favicon
- Theme icon fonts replaced by inline SVG icons (no external icon libraries needed)

Local preview: `npx serve .` (forms need `vercel dev` to run the API locally).
