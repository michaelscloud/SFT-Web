import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateSubmission, handleSubmission } from '../lib/submission.js';

// Synthetic test data only.
const CONTACT = { type: 'contact', name: 'Test Person', email: 'Test@Example.com', message: 'Hello', 'cf-turnstile-response': 'tok' };

function fakeDb() {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      return {
        bind: (...args) => ({ run: async () => calls.push({ sql, args }) }),
        run: async () => calls.push({ sql, args: [] }),
      };
    },
  };
}

function fakeFetch({ turnstileOk = true } = {}) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    if (url.includes('turnstile')) return Response.json({ success: turnstileOk });
    return new Response('{}', { status: 200 });
  };
  fn.calls = calls;
  return fn;
}

function makeRequest(fields, { json = true } = {}) {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) body.append(k, v);
  return new Request('https://example.test/api/contact', {
    method: 'POST',
    body,
    headers: json ? { Accept: 'application/json' } : {},
  });
}

const baseEnv = () => ({ TURNSTILE_SECRET_KEY: 'secret', DB: fakeDb() });

test('validateSubmission accepts a complete contact form and normalises email', () => {
  const r = validateSubmission(CONTACT);
  assert.equal(r.ok, true);
  assert.equal(r.data.email, 'test@example.com');
  assert.equal(r.data.marketing_opt_in, false);
});

test('validateSubmission requires name and message for contact, only email for waitlist', () => {
  assert.deepEqual(Object.keys(validateSubmission({ type: 'contact', email: 'a@b.co' }).errors).sort(), ['message', 'name']);
  assert.equal(validateSubmission({ type: 'waitlist', email: 'a@b.co' }).ok, true);
});

test('validateSubmission rejects bad email, unknown type and over-long fields', () => {
  assert.ok(validateSubmission({ type: 'waitlist', email: 'not-an-email' }).errors.email);
  assert.ok(validateSubmission({ type: 'other', email: 'a@b.co' }).errors.type);
  assert.ok(validateSubmission({ ...CONTACT, message: 'x'.repeat(5001) }).errors.message);
});

test('validateSubmission reads the marketing checkbox', () => {
  assert.equal(validateSubmission({ ...CONTACT, marketing_opt_in: 'on' }).data.marketing_opt_in, true);
});

test('honeypot submissions get a fake success and are not stored', async () => {
  const env = baseEnv();
  const res = await handleSubmission({ request: makeRequest({ ...CONTACT, website: 'spam.example' }), env, fetchImpl: fakeFetch() });
  assert.equal(res.status, 200);
  assert.equal(env.DB.calls.length, 0);
});

test('missing configuration returns 500 rather than silently dropping messages', async () => {
  const res = await handleSubmission({ request: makeRequest(CONTACT), env: {}, fetchImpl: fakeFetch() });
  assert.equal(res.status, 500);
});

test('failed Turnstile check returns 403 and stores nothing', async () => {
  const env = baseEnv();
  const res = await handleSubmission({ request: makeRequest(CONTACT), env, fetchImpl: fakeFetch({ turnstileOk: false }) });
  assert.equal(res.status, 403);
  assert.equal(env.DB.calls.length, 0);
});

test('invalid fields return 400 with per-field errors', async () => {
  const res = await handleSubmission({ request: makeRequest({ ...CONTACT, email: 'nope' }), env: baseEnv(), fetchImpl: fakeFetch() });
  assert.equal(res.status, 400);
  assert.ok((await res.json()).errors.email);
});

test('valid submission is stored and the notification email is sent', async () => {
  const env = { ...baseEnv(), RESEND_API_KEY: 're_test', NOTIFY_EMAIL: 'inbox@example.test', FROM_EMAIL: 'site@example.test' };
  const fetchImpl = fakeFetch();
  const pending = [];
  const res = await handleSubmission({ request: makeRequest(CONTACT), env, fetchImpl, waitUntil: (p) => pending.push(p) });
  await Promise.all(pending);

  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  const insert = env.DB.calls.find((c) => c.sql.startsWith('INSERT'));
  assert.deepEqual(insert.args.slice(0, 7), ['contact', 'Test Person', 'test@example.com', '', '', 'Hello', 0]);

  const email = fetchImpl.calls.find((c) => c.url.includes('resend'));
  const payload = JSON.parse(email.init.body);
  assert.equal(payload.to, 'inbox@example.test');
  assert.equal(payload.reply_to, 'test@example.com');
});

test('notification email escapes HTML in user input', async () => {
  const env = { ...baseEnv(), RESEND_API_KEY: 're_test', NOTIFY_EMAIL: 'i@example.test', FROM_EMAIL: 's@example.test' };
  const fetchImpl = fakeFetch();
  const pending = [];
  await handleSubmission({ request: makeRequest({ ...CONTACT, message: '<script>x</script>' }), env, fetchImpl, waitUntil: (p) => pending.push(p) });
  await Promise.all(pending);
  const html = JSON.parse(fetchImpl.calls.find((c) => c.url.includes('resend')).init.body).html;
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('without JavaScript the visitor is redirected back to the contact section', async () => {
  const res = await handleSubmission({ request: makeRequest(CONTACT, { json: false }), env: baseEnv(), fetchImpl: fakeFetch() });
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('Location'), 'https://example.test/?form=sent#contact');
});
