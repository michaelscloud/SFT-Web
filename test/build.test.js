// Checks the built site in public/. Run after `npm run build` (the `test` script does this).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, access } from 'node:fs/promises';
import { SITE_URL } from '../src/config.mjs';

const out = new URL('../public/', import.meta.url);
const read = (p) => readFile(new URL(p, out), 'utf8');
const pages = (await readdir(out, { recursive: true })).filter((f) => f.endsWith('.html')).sort();

test('the expected pages were built', () => {
  for (const page of ['index.html', 'privacy.html', '404.html']) assert.ok(pages.includes(page), `missing ${page}`);
});

for (const page of pages) {
  test(`${page} has no Canva leftovers or unrendered placeholders`, async () => {
    const html = await read(page);
    for (const leftover of ['canva://', '/_sdk/', 'dataSdk', 'data-template-id', 'data-lucide', '%%', '{TURNSTILE', 'cdn.tailwindcss.com', 'fonts.googleapis.com']) {
      assert.ok(!html.includes(leftover), `${page} still contains ${leftover}`);
    }
  });

  test(`every local file referenced by ${page} exists`, async () => {
    const html = await read(page);
    const refs = [...html.matchAll(/(?:src|href)="(\/[^"#?]*)"/g)].map((m) => m[1]);
    // Every candidate in a srcset, e.g. srcset="/a.webp 1x, /b.webp 2x".
    for (const [, srcset] of html.matchAll(/srcset="([^"]*)"/g)) {
      refs.push(...srcset.split(',').map((c) => c.trim().split(/\s+/)[0]));
    }
    assert.ok(refs.length > 0);
    for (const ref of refs) {
      // Page links like "/" and "/privacy" are served from index.html and privacy.html.
      const file = ref.endsWith('/') ? `${ref}index.html` : /\.[a-z0-9]+$/i.test(ref) ? ref : `${ref}.html`;
      await assert.doesNotReject(access(new URL(`.${file}`, out)), `${page} links to ${ref}, which doesn't exist`);
    }
  });

  // static/_headers sets script-src and style-src to 'self' (plus Turnstile and Cloudflare
  // analytics), so pages must not rely on inline scripts or styles.
  test(`${page} works under the strict Content Security Policy`, async () => {
    const html = await read(page);
    for (const [, attrs, body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      assert.match(attrs, /\bsrc="(\/|https:\/\/challenges\.cloudflare\.com\/)/, `${page} has a script that isn't a file from this site or Turnstile: <script${attrs}>`);
      assert.equal(body.trim(), '', `${page} has an inline script`);
    }
    assert.doesNotMatch(html, /<style[\s>]/i, `${page} has an inline <style> block`);
    assert.doesNotMatch(html, /\sstyle\s*=/i, `${page} has a style="…" attribute`);
    assert.doesNotMatch(html, /\son[a-z]+\s*=\s*["']/i, `${page} has an inline event handler`);
    assert.doesNotMatch(html, /href="javascript:/i, `${page} has a javascript: link`);
  });
}

test('director photos are optimised WebP with a 2x version', async () => {
  const html = await read('index.html');
  for (const name of ['Rob Kerner', 'Jonathan Evans', 'Caroline Hall']) {
    const img = html.match(new RegExp(`<img [^>]*alt="${name}"[^>]*>`))?.[0];
    assert.ok(img, `no photo for ${name}`);
    assert.match(img, /src="\/_astro\/[\w.-]+\.webp"/);
    assert.match(img, /srcset="\/_astro\/[\w.-]+\.webp 1x, \/_astro\/[\w.-]+\.webp 2x"/);
    assert.match(img, /class="[^"]*\bgrayscale\b/);
  }
});

test('icons are inlined as SVGs that screen readers skip', async () => {
  const html = await read('index.html');
  assert.match(html, /<svg [^>]*class="lucide lucide-mail w-5 h-5" aria-hidden="true" focusable="false"/);
  assert.match(html, /class="lucide lucide-chart-pie w-8 h-8 text-accent-500 mb-4"/);
});

test('the forms carry a Turnstile site key', async () => {
  const html = await read('index.html');
  const keys = [...html.matchAll(/data-sitekey="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(keys.length, 2);
  assert.deepEqual(new Set(keys), new Set([process.env.TURNSTILE_SITE_KEY || '1x00000000000000000000AA']));
});

test('nav links work from any page', async () => {
  const html = await read('index.html');
  const nav = html.slice(html.indexOf('<header id="site-nav"'), html.indexOf('</header>'));
  const hrefs = [...nav.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(hrefs.length > 0);
  for (const href of hrefs) assert.match(href, /^\/#[a-z]+$/, `nav link ${href} only works on the home page`);
});

test('canonical URLs use SITE_URL', async () => {
  assert.match(await read('index.html'), new RegExp(`<link rel="canonical" href="${SITE_URL}/">`));
  assert.match(await read('privacy.html'), new RegExp(`<link rel="canonical" href="${SITE_URL}/privacy">`));
});

test('the stylesheet is a file with the custom colours and self-hosted fonts', async () => {
  const html = await read('index.html');
  const hrefs = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(hrefs.length, 1);
  const css = await read(`.${hrefs[0]}`);
  assert.match(css, /\.bg-accent-500/);
  assert.match(css, /\.bg-primary-900\\\/95/);
  assert.match(css, /\.text-accent-700/);
  // The privacy page's arbitrary variants and the timeline's starting width.
  assert.match(css, /\.\\\[\\&_h2\\\]\\:text-2xl/);
  assert.match(css, /\.w-\\\[12\\\.5\\%\\\]/);
  // Fonts are files (font-src 'self' doesn't allow data: URLs) and exist.
  const fonts = [...css.matchAll(/url\(([^)]+)\)/g)].map((m) => m[1].replace(/["']/g, ''));
  assert.equal(fonts.length, 5);
  for (const font of fonts) {
    assert.match(font, /^\/_astro\/dm-sans-latin-\d00-normal\.[\w-]+\.woff2$/);
    await access(new URL(`.${font}`, out));
  }
  // Older browsers still get the nav's blur, and media queries use the long-supported syntax.
  assert.match(css, /-webkit-backdrop-filter/);
  assert.doesNotMatch(css, /@media \(width/);
});

test('robots.txt and sitemap.xml point at SITE_URL', async () => {
  assert.equal(await read('robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
  const xml = await read('sitemap.xml');
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.deepEqual(locs, [`${SITE_URL}/`, `${SITE_URL}/privacy`]);
});

test('static files are copied as-is', async () => {
  assert.equal(await read('js/site.js'), await readFile(new URL('../static/js/site.js', import.meta.url), 'utf8'));
  assert.match(await read('_headers'), /Content-Security-Policy: default-src 'self'; script-src 'self' https:\/\/challenges\.cloudflare\.com/);
});
