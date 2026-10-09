import { defineConfig } from 'astro/config';
import { SITE_URL, TURNSTILE_SITE_KEY, TEST_SITE_KEY } from './src/config.mjs';

if (TURNSTILE_SITE_KEY === TEST_SITE_KEY) {
  console.warn('⚠ TURNSTILE_SITE_KEY not set — using Cloudflare test key (not for production).');
}

export default defineConfig({
  site: SITE_URL,
  // Cloudflare Pages serves public/ (the build output) plus functions/. Files in
  // static/ are copied into the output as-is.
  outDir: './public',
  publicDir: './static',
  // privacy.html rather than privacy/index.html, so /privacy doesn't redirect to /privacy/.
  build: {
    format: 'file',
    // The CSP (static/_headers) has style-src 'self', so no inline <style> blocks.
    inlineStylesheets: 'never',
  },
  trailingSlash: 'ignore',
  // Keep the HTML whitespace as written, so inline spacing matches the original pages exactly.
  compressHTML: false,
  devToolbar: { enabled: false },
  vite: {
    build: {
      // The same older browsers the previous Tailwind CLI build supported: keeps vendor
      // prefixes (e.g. -webkit-backdrop-filter for the nav blur on Safari < 18) and
      // min-width media queries rather than the newer range syntax.
      cssTarget: ['chrome87', 'edge88', 'firefox78', 'safari14'],
    },
  },
});
