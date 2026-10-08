# Startup Founders Toolkit — website

The SFT marketing site, moved from Canva to Cloudflare Pages.

- **Static site:** HTML + Tailwind CSS, built into `public/`.
- **Forms:** the contact form and waitlist both post to a Cloudflare Pages Function
  (`/api/contact`). Submissions are stored in Cloudflare D1, checked with Turnstile for
  spam, and emailed to you via Resend.

## Layout

| Path | What it is |
|---|---|
| `src/*.html` | Page sources. `<i data-lucide="name">` becomes an inline SVG icon at build time. |
| `src/input.css` | Tailwind entry point, plus the self-hosted DM Sans font. |
| `static/` | Copied into `public/` as-is: JS, images, `_headers`, `robots.txt`, `sitemap.xml`. |
| `functions/api/contact.js` | The form endpoint. |
| `lib/submission.js` | Form validation, Turnstile check, D1 storage and email. |
| `scripts/build.mjs` | The build. |
| `test/` | Tests (`npm test`). |

## Local development

```bash
npm install
cp .dev.vars.example .dev.vars
npm run dev
```

The site runs at http://localhost:8788 with a local database. The Turnstile test keys always pass.

## Cloudflare setup (one-off)

1. **Create the database:**
   `npx wrangler d1 create sft-web`
   The `submissions` table is created automatically on the first form submission.
2. **Create a Turnstile widget:** in the Cloudflare dashboard, open Turnstile and choose Add widget.
   Add your domain and your `*.pages.dev` domain. Keep a note of the site key and the secret key.
3. **Set up Resend:** create an account at resend.com, verify your domain, and create an API key.
4. **Create the Pages project:** in the dashboard, go to Workers & Pages → Create → Pages →
   Connect to Git and choose this repo.
   - Build command: `npm run build`
   - Build output directory: `public`
5. **Add settings** under the Pages project's Settings tab:
   - **Variables and secrets** (Production, and Preview if you want forms to work there):

     | Name | Type | Value |
     |---|---|---|
     | `TURNSTILE_SITE_KEY` | Text | Turnstile site key (used at build time) |
     | `TURNSTILE_SECRET_KEY` | Secret | Turnstile secret key |
     | `RESEND_API_KEY` | Secret | Resend API key |
     | `NOTIFY_EMAIL` | Text | Where enquiries are sent, e.g. `info@startupfounderstoolkit.com` |
     | `FROM_EMAIL` | Text | A sender on your verified domain, e.g. `SFT Website <website@startupfounderstoolkit.com>` |

   - **Bindings:** add a D1 database binding named `DB` that points to `sft-web`.
6. Redeploy, test the forms on the `*.pages.dev` address, then add your domain under
   **Custom domains**.

If the email part fails, the submission is still saved. If the database or Turnstile
secret is missing, the form shows an error asking people to email you instead.

## Viewing submissions

```bash
npx wrangler d1 execute sft-web --remote --command "SELECT * FROM submissions ORDER BY id DESC LIMIT 50"
```

You can also browse them in the dashboard under Storage & Databases → D1 → sft-web.

## Before launch

- [ ] Replace the placeholder images in `static/images/`: `logo.svg`, `hero.svg` and the
      three `director-*.svg` files. If you use JPG or WebP files, update the `src` in
      `src/index.html` to match. Keep the hero image under ~300 KB.
- [ ] Add a 1200×630 image at `static/images/og-image.png` for link previews, then add the
      `og:image` tag back to `src/index.html`.
- [ ] Finish `src/privacy.html`: fill in everything in [square brackets] and check it matches how
      you actually handle data.
- [ ] Check the domain `startupfounderstoolkit.com` in the canonical link, `robots.txt` and
      `sitemap.xml`.
