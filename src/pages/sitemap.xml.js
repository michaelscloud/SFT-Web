// Lists every page in src/pages (except 404 and non-HTML endpoints like this one).
// When the blog arrives, add its posts here too.
const pages = Object.keys(import.meta.glob('./**/*.astro'))
  .filter((file) => !file.includes('[') && !file.endsWith('/404.astro'))
  .map((file) => file.replace(/^\.\//, '/').replace(/\.astro$/, '').replace(/(^|\/)index$/, '$1'))
  .sort();

export const GET = ({ site }) => {
  const base = String(site).replace(/\/+$/, '');
  const urls = pages.map((p) => `  <url><loc>${base}${p}</loc></url>`).join('\n');
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    { headers: { 'Content-Type': 'application/xml' } },
  );
};
