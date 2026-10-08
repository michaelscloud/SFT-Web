// Builds the static site into public/ (the Cloudflare Pages output directory):
//  - copies static/ as-is
//  - renders src/*.html, swapping <i data-lucide="name"> for the inline SVG icon,
//    %%TURNSTILE_SITE_KEY%% for TURNSTILE_SITE_KEY and %%SITE_URL%% for SITE_URL
//  - writes robots.txt and sitemap.xml for SITE_URL
//  - copies the self-hosted DM Sans font files
// The CSS is built afterwards by the Tailwind CLI (see package.json).

import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = path.join(root, 'public');
const iconDir = path.join(root, 'node_modules/lucide-static/icons');
const fontDir = path.join(root, 'node_modules/@fontsource/dm-sans/files');

// Cloudflare's published test key: always passes. Production must set a real one.
const TEST_SITE_KEY = '1x00000000000000000000AA';
// The site's public address. Override with the SITE_URL environment variable.
const DEFAULT_SITE_URL = 'https://discinc.uk';
const PAGES = ['/', '/privacy'];
const ICON_RE = /<i data-lucide="([a-z0-9-]+)"(?: class="([^"]*)")?><\/i>/g;

async function renderIcon(name, cls = '') {
  let svg;
  try {
    svg = await readFile(path.join(iconDir, `${name}.svg`), 'utf8');
  } catch {
    throw new Error(`Unknown Lucide icon "${name}"`);
  }
  return svg
    .replace(/<!--[\s\S]*?-->/, '')
    .replace(`class="lucide lucide-${name}"`, `class="${`lucide lucide-${name} ${cls}`.trim()}" aria-hidden="true" focusable="false"`)
    .replace(/\s+/g, ' ')
    .replace(/> </g, '><')
    .trim();
}

export async function renderPage(html, { siteKey, siteUrl }) {
  const matches = [...html.matchAll(ICON_RE)];
  const icons = await Promise.all(matches.map(([, name, cls]) => renderIcon(name, cls)));
  let i = 0;
  return html
    .replace(ICON_RE, () => icons[i++])
    .replaceAll('%%TURNSTILE_SITE_KEY%%', siteKey)
    .replaceAll('%%SITE_URL%%', siteUrl);
}

export const robotsTxt = (siteUrl) => `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`;

export const sitemapXml = (siteUrl) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${PAGES.map((p) => `  <url><loc>${siteUrl}${p}</loc></url>`).join('\n')}
</urlset>
`;

async function build() {
  const siteKey = process.env.TURNSTILE_SITE_KEY || TEST_SITE_KEY;
  if (siteKey === TEST_SITE_KEY) console.warn('⚠ TURNSTILE_SITE_KEY not set — using Cloudflare test key (not for production).');
  const siteUrl = (process.env.SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, '');

  await rm(out, { recursive: true, force: true });
  await cp(path.join(root, 'static'), out, { recursive: true });

  for (const file of await readdir(path.join(root, 'src'))) {
    if (!file.endsWith('.html')) continue;
    const html = await readFile(path.join(root, 'src', file), 'utf8');
    await writeFile(path.join(out, file), await renderPage(html, { siteKey, siteUrl }));
  }
  await writeFile(path.join(out, 'robots.txt'), robotsTxt(siteUrl));
  await writeFile(path.join(out, 'sitemap.xml'), sitemapXml(siteUrl));

  await mkdir(path.join(out, 'fonts'), { recursive: true });
  for (const weight of [400, 500, 600, 700, 800]) {
    const name = `dm-sans-latin-${weight}-normal.woff2`;
    await cp(path.join(fontDir, name), path.join(out, 'fonts', name));
  }
  console.log(`Built pages into public/ for ${siteUrl}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await build();
