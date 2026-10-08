// Shared logic for the contact and waitlist forms. Kept out of /functions so
// Cloudflare doesn't turn it into a route, and so it can be unit-tested in Node.

const LIMITS = { name: 200, company: 200, email: 254, phone: 50, message: 5000 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TURNSTILE_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

const CREATE_TABLE = `CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  name TEXT,
  email TEXT NOT NULL,
  company TEXT,
  phone TEXT,
  message TEXT,
  marketing_opt_in INTEGER NOT NULL DEFAULT 0,
  submitted_at TEXT NOT NULL
)`;

export function validateSubmission(fields) {
  const get = (k) => String(fields[k] ?? '').trim();
  const type = get('type');
  const data = {
    type,
    name: get('name'),
    email: get('email').toLowerCase(),
    company: get('company'),
    phone: get('phone'),
    message: get('message'),
    marketing_opt_in: ['on', 'true', '1', 'yes'].includes(get('marketing_opt_in').toLowerCase()),
  };
  const errors = {};

  if (type !== 'contact' && type !== 'waitlist') errors.type = 'Unknown form.';
  if (!data.email) errors.email = 'Please enter your email address.';
  else if (!EMAIL_RE.test(data.email)) errors.email = 'Please enter a valid email address.';
  if (type === 'contact') {
    if (!data.name) errors.name = 'Please enter your name.';
    if (!data.message) errors.message = 'Please leave a short message.';
  }
  for (const [field, max] of Object.entries(LIMITS)) {
    if (data[field].length > max) errors[field] = `Please keep this under ${max} characters.`;
  }

  return { ok: Object.keys(errors).length === 0, errors, data };
}

export async function verifyTurnstile(token, secret, ip, fetchImpl = fetch) {
  if (!token) return false;
  const body = new FormData();
  body.append('secret', secret);
  body.append('response', token);
  if (ip) body.append('remoteip', ip);
  try {
    const res = await fetchImpl(TURNSTILE_URL, { method: 'POST', body });
    const json = await res.json();
    return json.success === true;
  } catch (err) {
    console.error('Turnstile verification failed', err);
    return false;
  }
}

let tableReady = false;

export async function saveSubmission(db, data, now = new Date()) {
  if (!tableReady) {
    await db.prepare(CREATE_TABLE).run();
    tableReady = true;
  }
  await db
    .prepare(
      `INSERT INTO submissions (type, name, email, company, phone, message, marketing_opt_in, submitted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(data.type, data.name, data.email, data.company, data.phone, data.message,
      data.marketing_opt_in ? 1 : 0, now.toISOString())
    .run();
}

const escapeHtml = (s) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export async function sendNotification(env, data, fetchImpl = fetch) {
  if (!env.RESEND_API_KEY || !env.NOTIFY_EMAIL || !env.FROM_EMAIL) return false;
  const subject = data.type === 'waitlist'
    ? `New waitlist sign-up: ${data.email}`
    : `New enquiry from ${data.name}${data.company ? ` (${data.company})` : ''}`;
  const rows = [
    ['Form', data.type], ['Name', data.name], ['Email', data.email], ['Company', data.company],
    ['Phone', data.phone], ['Marketing opt-in', data.marketing_opt_in ? 'Yes' : 'No'], ['Message', data.message],
  ].filter(([, v]) => v);
  const html = `<table>${rows
    .map(([k, v]) => `<tr><th align="left" valign="top">${k}</th><td style="white-space:pre-wrap">${escapeHtml(v)}</td></tr>`)
    .join('')}</table>`;

  try {
    const res = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.FROM_EMAIL, to: env.NOTIFY_EMAIL, reply_to: data.email, subject, html }),
    });
    if (!res.ok) console.error('Resend error', res.status, await res.text());
    return res.ok;
  } catch (err) {
    console.error('Resend request failed', err);
    return false;
  }
}

function respond(request, status, body) {
  const wantsJson = (request.headers.get('Accept') || '').includes('application/json');
  if (!wantsJson) {
    // Form posted without JavaScript: send the visitor back to the page.
    const result = status === 200 ? 'sent' : 'error';
    return Response.redirect(new URL(`/?form=${result}#contact`, request.url).toString(), 303);
  }
  return Response.json(body, { status });
}

export async function handleSubmission({ request, env, waitUntil = () => {}, fetchImpl = fetch }) {
  let fields;
  try {
    fields = Object.fromEntries(await request.formData());
  } catch {
    return respond(request, 400, { ok: false, error: 'Invalid form data.' });
  }

  // Honeypot: real people never see or fill the "website" field.
  if (String(fields.website ?? '').trim()) return respond(request, 200, { ok: true });

  if (!env.TURNSTILE_SECRET_KEY || !env.DB) {
    console.error('Missing TURNSTILE_SECRET_KEY or DB binding');
    return respond(request, 500, { ok: false, error: 'The form is not configured yet. Please email us instead.' });
  }

  const ip = request.headers.get('CF-Connecting-IP');
  const human = await verifyTurnstile(fields['cf-turnstile-response'], env.TURNSTILE_SECRET_KEY, ip, fetchImpl);
  if (!human) {
    return respond(request, 403, { ok: false, error: 'Spam check failed. Please refresh the page and try again.' });
  }

  const { ok, errors, data } = validateSubmission(fields);
  if (!ok) return respond(request, 400, { ok: false, error: 'Please check the highlighted fields.', errors });

  try {
    await saveSubmission(env.DB, data);
  } catch (err) {
    console.error('Failed to save submission', err);
    return respond(request, 500, { ok: false, error: 'Something went wrong. Please try again or email us.' });
  }

  // The submission is safely stored, so the email is a best-effort extra.
  waitUntil(sendNotification(env, data, fetchImpl));
  return respond(request, 200, { ok: true });
}
