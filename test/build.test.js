// Run after `npm run build` (the `test` script does this).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { renderPage, robotsTxt, sitemapXml } from '../scripts/build.mjs';

const read = (p) => readFile(new URL(`../${p}`, import.meta.url), 'utf8');

test('renderPage inlines icons with their classes and fills the site key and URL', async () => {
  const html = await renderPage('<i data-lucide="mail" class="w-5 h-5"></i><div data-sitekey="%%TURNSTILE_SITE_KEY%%"><link href="%%SITE_URL%%/privacy">', { siteKey: 'KEY', siteUrl: 'https://example.test' });
  assert.match(html, /<svg class="lucide lucide-mail w-5 h-5" aria-hidden="true"/);
  assert.match(html, /data-sitekey="KEY"/);
  assert.match(html, /href="https:\/\/example.test\/privacy"/);
});

test('robots.txt and sitemap.xml point at the site URL', () => {
  assert.match(robotsTxt('https://example.test'), /Sitemap: https:\/\/example.test\/sitemap.xml/);
  const xml = sitemapXml('https://example.test');
  assert.match(xml, /<loc>https:\/\/example.test\/<\/loc>/);
  assert.match(xml, /<loc>https:\/\/example.test\/privacy<\/loc>/);
});

test('renderPage fails loudly on an unknown icon', async () => {
  await assert.rejects(renderPage('<i data-lucide="no-such-icon"></i>', { siteKey: 'k', siteUrl: 'u' }), /Unknown Lucide icon/);
});

for (const page of ['index.html', 'privacy.html', '404.html']) {
  test(`built ${page} has no Canva leftovers or unrendered placeholders`, async () => {
    const html = await read(`public/${page}`);
    for (const leftover of ['canva://', '/_sdk/', 'dataSdk', 'data-template-id', 'data-lucide', '%%', 'cdn.tailwindcss.com', 'fonts.googleapis.com']) {
      assert.ok(!html.includes(leftover), `${page} still contains ${leftover}`);
    }
  });

  test(`every local asset referenced by ${page} exists`, async () => {
    const html = await read(`public/${page}`);
    const refs = [...html.matchAll(/(?:src|href)="(\/[^"#?]*)"/g)].map((m) => m[1]).filter((r) => r !== '/' && r !== '/privacy');
    for (const ref of refs) await access(new URL(`../public${ref}`, import.meta.url));
  });
}

test('the stylesheet was generated and includes the custom colours', async () => {
  const css = await read('public/css/site.css');
  assert.match(css, /\.bg-accent-500/);
  assert.match(css, /\.bg-primary-900\\\/95/);
});
