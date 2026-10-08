# Startup Founders Toolkit — website

The SFT marketing site, moved from Canva to Cloudflare Pages. For now it is hosted at
**https://discinc.uk**. The address is a build setting (`SITE_URL`), so moving domains needs no code change.

- **Static site:** [Astro](https://astro.build) + Tailwind CSS, built into `public/` as plain HTML.
  No Astro adapter: Cloudflare Pages serves the files plus the `functions/` directory.
- **Forms:** the contact form and waitlist both post to a Cloudflare Pages Function
  (`/api/contact`). Submissions are stored in Cloudflare D1, checked with Turnstile for
  spam, and emailed to you via Resend.

## Layout

| Path | What it is |
|---|---|
| `src/pages/` | One file per page: `index.astro`, `privacy.astro`, `404.astro`. Also `robots.txt.js` and `sitemap.xml.js`. |
| `src/layouts/BaseLayout.astro` | The page shell: `<head>` (title, description, canonical, Open Graph), CSS, fonts and scripts. |
| `src/components/` | `Nav.astro`, `Footer.astro` (with the contact form) and `Icon.astro`. |
| `src/styles/global.css` | Tailwind entry point, plus the self-hosted DM Sans font. Colours are in `tailwind.config.js`. |
| `src/config.mjs` | Build settings read from environment variables (`SITE_URL`, `TURNSTILE_SITE_KEY`). |
| `static/` | Copied into `public/` as-is: JS, images, `_headers`. |
| `functions/api/contact.js` | The form endpoint. |
| `lib/submission.js` | Form validation, Turnstile check, D1 storage and email. |
| `test/` | Tests (`npm test` builds the site, then runs them). |

`public/` is the build output (Cloudflare's build output directory), so don't put files there by hand:
they go in `static/`.

**Icons** come from [Lucide](https://lucide.dev/icons): `<Icon name="mail" class="w-5 h-5" />` inlines the
SVG at build time. An unknown name fails the build.

**Content Security Policy:** `static/_headers` only allows scripts and styles served from this site
(plus Turnstile and Cloudflare analytics). Put scripts in `static/js/` and load them with
`<script is:inline src="/js/….js" defer>`; don't add inline `<script>` or `<style>` blocks or
`style="…"` attributes. The tests check every built page for this.

## Local development

```bash
npm install
cp .dev.vars.example .dev.vars
npm run dev
```

This builds the site and runs it the way Cloudflare does, with the form endpoint and a local database,
at http://localhost:8788. The Turnstile test keys always pass. Rebuild (stop and rerun) to see changes.

For quick layout and copy changes, `npm run dev:ui` runs Astro's dev server at http://localhost:4321,
which reloads as you edit. The forms don't work there (no `/api/contact`), so test them with `npm run dev`.

`npm test` builds the site and runs the tests.

### Adding a page

Add a file to `src/pages/`, e.g. `src/pages/about.astro` for `/about`:

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import Nav from '../components/Nav.astro';
import Footer from '../components/Footer.astro';
---
<BaseLayout title="About | Startup Founders Toolkit" description="…" path="/about"
  bodyClass="min-h-screen bg-slate-50 text-slate-800 antialiased" interactive>
  <Nav />
  <main id="main" class="pt-28 md:pt-36">…</main>
  <Footer />
</BaseLayout>
```

`interactive` loads `site.js` and Turnstile, which the nav's mobile menu and the footer's contact form need.
`site.js` currently expects the home page's calculator, quiz and timeline too, so make its sections
optional before using `<Nav />` on another page. Pages are added to `sitemap.xml` automatically.

### Images

The placeholder images in `static/images/` are served as they are. When real photos arrive, put them in
`src/assets/` and use Astro's `<Image>` component (`astro:assets`) to resize and compress them at build time.

## Cloudflare setup (one-off)

1. **Create the database:**
   `npx wrangler d1 create sft-web`
   The `submissions` table is created automatically on the first form submission.
2. **Create a Turnstile widget:** in the Cloudflare dashboard, open Turnstile and choose Add widget.
   Add `discinc.uk` and your `*.pages.dev` domain. Keep a note of the site key and the secret key.
3. **Set up Resend:** create an account at resend.com, verify `discinc.uk` as a sending domain, and create an API key.
4. **Create the Pages project:** in the dashboard, go to Workers & Pages → Create → Pages →
   Connect to Git and choose this repo.
   - Build command: `npm run build`
   - Build output directory: `public`
5. **Add settings** under the Pages project's Settings tab:
   - **Variables and secrets** (Production, and Preview if you want forms to work there):

     | Name | Type | Value |
     |---|---|---|
     | `SITE_URL` | Text | The site's public address, no trailing slash. Defaults to `https://discinc.uk`. |
     | `TURNSTILE_SITE_KEY` | Text | Turnstile site key (used at build time) |
     | `TURNSTILE_SECRET_KEY` | Secret | Turnstile secret key |
     | `RESEND_API_KEY` | Secret | Resend API key |
     | `NOTIFY_EMAIL` | Text | Where enquiries are sent, e.g. `info@startupfounderstoolkit.com` |
     | `FROM_EMAIL` | Text | A sender on your verified domain, e.g. `SFT Website <website@discinc.uk>` |

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
      `src/pages/index.astro` (and `src/components/Nav.astro` for the logo) to match, or move them
      to `src/assets/` and use `astro:assets` (see Images above). Keep the hero image under ~300 KB.
- [ ] Add a 1200×630 image at `static/images/og-image.png` for link previews, then add the
      `og:image` tag to `src/layouts/BaseLayout.astro`.
- [ ] Finish `src/pages/privacy.astro`: fill in everything in [square brackets] and check it matches how
      you actually handle data.
- [ ] When the site moves to its permanent domain, change `SITE_URL` in Cloudflare, add the
      new domain to the Turnstile widget and Resend, and redeploy.
