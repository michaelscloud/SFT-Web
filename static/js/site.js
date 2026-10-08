// Site behaviour: nav, ROI calculator, quiz, process timeline and forms.
// Class names toggled here must appear literally so Tailwind keeps them in the build.

(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  // --- Navigation -----------------------------------------------------------
  const nav = $('#site-nav');
  const menuToggle = $('#menu-toggle');
  const mobileMenu = $('#mobile-menu');
  const SOLID = ['bg-primary-900/95', 'backdrop-blur', 'shadow-lg'];

  function updateNav() {
    const solid = window.scrollY > 10 || !mobileMenu.classList.contains('hidden');
    SOLID.forEach((c) => nav.classList.toggle(c, solid));
  }

  function setMenu(open) {
    mobileMenu.classList.toggle('hidden', !open);
    menuToggle.setAttribute('aria-expanded', String(open));
    $('[data-menu-icon="open"]', menuToggle).classList.toggle('hidden', open);
    $('[data-menu-icon="close"]', menuToggle).classList.toggle('hidden', !open);
    $('.sr-only', menuToggle).textContent = open ? 'Close menu' : 'Open menu';
    updateNav();
  }

  menuToggle.addEventListener('click', () => setMenu(mobileMenu.classList.contains('hidden')));
  $$('a', mobileMenu).forEach((a) => a.addEventListener('click', () => setMenu(false)));
  window.addEventListener('scroll', updateNav, { passive: true });
  updateNav();

  // --- ROI calculator -------------------------------------------------------
  const FRACTIONAL_SHARE = 0.2;
  const gbp = (n) => Math.round(n).toLocaleString('en-GB');
  const calcBoxes = $$('.calc-checkbox');

  function updateCalculator() {
    const fullTime = calcBoxes.filter((cb) => cb.checked).reduce((sum, cb) => sum + Number(cb.value), 0);
    const fractional = fullTime * FRACTIONAL_SHARE;
    $('#calc-ft-cost').textContent = gbp(fullTime);
    $('#calc-sft-cost').textContent = gbp(fractional);
    $('#calc-savings').textContent = gbp(fullTime - fractional);
  }
  calcBoxes.forEach((cb) => cb.addEventListener('change', updateCalculator));

  // --- Diagnostic quiz ------------------------------------------------------
  const quizData = {
    strategy: { title: 'Strategy & Commercial', text: 'You need help defining your vision, mapping your growth path, and implementing effective strategies for long-term success.' },
    ops: { title: 'Operations', text: 'You need robust systems. We help optimise operations and manage new challenges to sustain your rapid growth.' },
    marketing: { title: 'Brand & Marketing', text: 'You need impactful marketing strategies and campaigns to build a strong brand presence and drive predictable customer acquisition.' },
    people: { title: 'People (HR & Talent)', text: 'You need robust HR strategies and a hiring roadmap to attract, recruit, and retain top talent to drive your startup forward.' },
    sales: { title: 'Sales', text: 'You need a refined Go-to-Market strategy, reliable pricing models, and structured sales processes to drive revenue.' },
    finance: { title: 'Finance', text: 'You need guidance preparing for fundraising (EIS/SEIS), managing cashflow, and building robust management reports.' },
  };
  const quizQuestions = $('#quiz-questions');
  const quizResult = $('#quiz-result');

  $$('.quiz-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const data = quizData[btn.dataset.result];
      $('#quiz-result-title').textContent = data.title;
      $('#quiz-result-text').textContent = data.text;
      quizQuestions.classList.add('hidden');
      quizResult.classList.remove('hidden');
      quizResult.focus();
    });
  });
  $('#quiz-reset').addEventListener('click', () => {
    quizResult.classList.add('hidden');
    quizQuestions.classList.remove('hidden');
    $('.quiz-btn').focus();
  });

  // --- Process timeline -----------------------------------------------------
  const steps = $$('.timeline-step');
  const ACTIVE = ['bg-accent-500', 'text-primary-900', 'shadow-lg'];
  const INACTIVE = ['bg-slate-200', 'text-slate-500'];

  function showStep(stepNum) {
    $('#timeline-progress').style.width = `${(stepNum - 0.5) * 25}%`;
    steps.forEach((step) => {
      const n = Number(step.dataset.step);
      const reached = n <= stepNum;
      const indicator = $('.step-indicator', step);
      ACTIVE.forEach((c) => indicator.classList.toggle(c, reached));
      INACTIVE.forEach((c) => indicator.classList.toggle(c, !reached));
      step.classList.toggle('opacity-60', !reached);
      $('.step-label', step).classList.toggle('text-primary-900', reached);
      $('.step-label', step).classList.toggle('text-slate-600', !reached);
      if (n === stepNum) step.setAttribute('aria-current', 'step');
      else step.removeAttribute('aria-current');
      $(`#step-content-${n}`).classList.toggle('hidden', n !== stepNum);
    });
  }
  steps.forEach((step) => step.addEventListener('click', () => showStep(Number(step.dataset.step))));
  showStep(1);

  // --- Forms ----------------------------------------------------------------
  function setStatus(form, message, ok) {
    const status = $('.form-status', form);
    status.textContent = message;
    status.classList.remove('hidden', 'text-green-600', 'text-red-600');
    status.classList.add(ok ? 'text-green-600' : 'text-red-600');
  }

  function clearErrors(form) {
    $$('[aria-invalid]', form).forEach((el) => el.removeAttribute('aria-invalid'));
    $$('.field-error', form).forEach((el) => el.remove());
  }

  function showFieldError(form, name, message) {
    const field = form.elements[name];
    if (!field || field.type === 'hidden') return;
    field.setAttribute('aria-invalid', 'true');
    const err = document.createElement('p');
    err.className = 'field-error text-xs text-red-600 mt-1';
    err.id = `${field.id}-error`;
    err.textContent = message;
    field.setAttribute('aria-describedby', err.id);
    field.insertAdjacentElement('afterend', err);
  }

  $$('.js-form').forEach((form) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors(form);

      if (!form.checkValidity()) {
        $$('input, textarea', form).forEach((el) => {
          if (!el.validity.valid) showFieldError(form, el.name, el.validationMessage);
        });
        $('[aria-invalid]', form)?.focus();
        return;
      }

      const button = $('button[type="submit"]', form);
      button.disabled = true;
      try {
        const res = await fetch(form.action, {
          method: 'POST',
          body: new FormData(form),
          headers: { Accept: 'application/json' },
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok && json.ok) {
          form.reset();
          const isWaitlist = form.elements.type.value === 'waitlist';
          setStatus(form, isWaitlist ? "Thank you! You've been added to the waitlist." : "Thank you! We'll be in touch shortly.", true);
        } else {
          Object.entries(json.errors || {}).forEach(([name, msg]) => showFieldError(form, name, msg));
          setStatus(form, json.error || 'Something went wrong. Please try again.', false);
        }
      } catch {
        setStatus(form, 'Could not send — please check your connection and try again.', false);
      } finally {
        button.disabled = false;
        // A Turnstile token can only be used once.
        const widget = $('.cf-turnstile', form);
        if (window.turnstile && widget) window.turnstile.reset(widget);
      }
    });
  });

  // Result of a form posted without JavaScript (see lib/submission.js).
  const formResult = new URLSearchParams(location.search).get('form');
  if (formResult) {
    const contactForm = $('#contact .js-form');
    setStatus(contactForm, formResult === 'sent' ? "Thank you! We'll be in touch shortly." : 'Something went wrong. Please try again.', formResult === 'sent');
    history.replaceState(null, '', location.pathname + location.hash);
  }
})();
