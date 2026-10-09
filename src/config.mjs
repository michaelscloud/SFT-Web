// Build-time settings, read from environment variables (set in Cloudflare Pages).

// Cloudflare's published Turnstile test key: always passes. Production must set a real one.
export const TEST_SITE_KEY = '1x00000000000000000000AA';

// The site's public address, no trailing slash.
export const SITE_URL = (process.env.SITE_URL || 'https://discinc.uk').replace(/\/+$/, '');

export const TURNSTILE_SITE_KEY = process.env.TURNSTILE_SITE_KEY || TEST_SITE_KEY;
