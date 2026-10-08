import { handleSubmission } from '../../lib/submission.js';

// POST /api/contact — handles both the contact form and the waitlist form.
export const onRequestPost = (context) =>
  handleSubmission({ request: context.request, env: context.env, waitUntil: context.waitUntil.bind(context) });
