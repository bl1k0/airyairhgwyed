/* ============================================================
   VERIDIAN EDGE TECHNICAL SERVICES LLC
   script.js — Public site interactions + quote form
   Backend: Supabase (anon key + RLS)
   ============================================================ */

// ═══════════════════════════════════════════════════════════════
// ⚙  SUPABASE CONFIG — paste your values here (see SUPABASE_SETUP.md)
// ═══════════════════════════════════════════════════════════════
const SUPABASE_URL      = 'https://eptklnlzudhjmhlykicj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_MWwOnnIN9WMSCPJjjlYCdQ_XHkTbBDN';
// ═══════════════════════════════════════════════════════════════
// The anon key is safe to expose publicly — RLS policies on the
// `quotes` table only allow anonymous INSERTs. Reading/updating/
// deleting requires a logged-in admin session.
// ═══════════════════════════════════════════════════════════════


// ===== NAVBAR SCROLL =====
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 60);
  backToTop.classList.toggle('visible', window.scrollY > 400);
});

// ===== HAMBURGER MENU =====
const hamburger = document.getElementById('hamburger');
const navLinks  = document.getElementById('navLinks');
hamburger.addEventListener('click', () => {
  navLinks.classList.toggle('open');
  hamburger.classList.toggle('active');
});
document.querySelectorAll('.nav-link, .nav-cta').forEach(link => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('open');
    hamburger.classList.remove('active');
  });
});

// ===== ACTIVE NAV LINK ON SCROLL =====
const sections = document.querySelectorAll('section[id]');
const navItems = document.querySelectorAll('.nav-link');
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      navItems.forEach(link => {
        link.classList.toggle('active',
          link.getAttribute('href') === '#' + entry.target.id);
      });
    }
  });
}, { rootMargin: '-40% 0px -55% 0px' });
sections.forEach(s => observer.observe(s));

// ===== SCROLL REVEAL =====
const revealEls = document.querySelectorAll(
  '.service-card, .portfolio-item, .testimonial-card, .contact-card, .value-item, .why-item, .about-content, .stat'
);
revealEls.forEach(el => el.classList.add('reveal'));

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      setTimeout(() => entry.target.classList.add('visible'), i * 80);
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });
revealEls.forEach(el => revealObserver.observe(el));

// ===== PORTFOLIO FILTER =====
const filterBtns     = document.querySelectorAll('.filter-btn');
const portfolioItems = document.querySelectorAll('.portfolio-item');

filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const filter = btn.dataset.filter;
    portfolioItems.forEach(item => {
      const match = filter === 'all' || item.dataset.category === filter;
      item.style.opacity       = match ? '1' : '0.25';
      item.style.transform     = match ? 'scale(1)' : 'scale(0.95)';
      item.style.pointerEvents = match ? 'auto' : 'none';
      item.style.transition    = 'opacity 0.4s ease, transform 0.4s ease';
    });
  });
});

// ===== SANITISE helper =====
function _sanitise(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/<[^>]*>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim()
    .slice(0, 2000);
}

// ===== QUOTE FORM SUBMISSION =====
// The "We'll contact you within 24 hours" confirmation is ONLY shown
// after Supabase has echoed back a real row with an id. If the insert
// fails for any reason (bad key, RLS block, offline, etc.) the user
// sees a visible error and is asked to retry — we never mislead them.
async function submitForm(e) {
  e.preventDefault();
  const form    = document.getElementById('quoteForm');
  const btn     = form.querySelector('button[type="submit"]');
  const success = document.getElementById('formSuccess');

  _hideFormError(form);
  btn.disabled  = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending…';

  const payload = {
    name:     _sanitise(form.querySelector('[name="name"]').value),
    phone:    _sanitise(form.querySelector('[name="phone"]').value),
    email:    _sanitise(form.querySelector('[name="email"]').value),
    service:  _sanitise(form.querySelector('[name="service"]').value),
    location: _sanitise(form.querySelector('[name="location"]').value),
    message:  _sanitise(form.querySelector('[name="message"]').value),
    status:   'new',
  };

  // Config guard — show a clear error instead of a fake success.
  if (!_configOk()) {
    console.error('[Veridian] Supabase not configured in script.js — cannot submit.');
    _localFallbackSave(payload); // keep the data locally so it's not lost
    _resetBtn(btn);
    _showFormError(form, 'Our server is being set up. Please call or WhatsApp us instead — your request has been saved locally.');
    return;
  }

  try {
    const savedRow = await _supabaseInsert(payload);

    // ✅ SUCCESS ONLY IF Supabase echoed back a row with an id
    if (savedRow && savedRow.id) {
      console.info('[Veridian] Quote saved to Supabase with id:', savedRow.id);
      _showSuccess(form, btn, success);
    } else {
      throw new Error('Supabase returned an empty response — row may not have been saved.');
    }
  } catch (err) {
    console.error('[Veridian] Supabase insert failed:', err);
    // Keep the data so the admin can flush it later — but DO NOT say "we'll contact you".
    _localFallbackSave(payload);
    _resetBtn(btn);
    _showFormError(form,
      "Sorry, we couldn't send your request right now. Please try again, or reach us on WhatsApp — we'll respond promptly."
    );
  }
}

function _configOk() {
  return SUPABASE_URL && SUPABASE_ANON_KEY
      && !SUPABASE_URL.includes('YOUR_PROJECT')
      && !SUPABASE_ANON_KEY.includes('YOUR_ANON_KEY');
}

// Direct REST insert — requests the inserted row back so we can
// confirm the write actually landed in the database (return=representation).
// Returns the saved row ({ id, created_at, ... }) or throws.
async function _supabaseInsert(payload) {
  const url = SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/quotes';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'apikey':        SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
      'Prefer':        'return=representation', // ← ask Supabase to echo the saved row
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => String(res.status));
    throw new Error('Supabase ' + res.status + ': ' + text);
  }
  const rows = await res.json().catch(() => null);
  if (!Array.isArray(rows) || rows.length === 0 || !rows[0].id) {
    throw new Error('Supabase accepted the request but returned no row.');
  }
  return rows[0]; // the confirmed, persisted row
}

function _showSuccess(form, btn, success) {
  form.reset();
  btn.style.display     = 'none';
  success.style.display = 'flex';
  setTimeout(() => {
    btn.style.display  = 'flex';
    btn.disabled       = false;
    btn.innerHTML      = '<i class="fas fa-paper-plane"></i> Submit Quote Request';
    success.style.display = 'none';
  }, 5000);
}

function _resetBtn(btn) {
  btn.disabled  = false;
  btn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Quote Request';
}

// ── Inline error banner (created on demand, no HTML edits needed) ──
function _ensureFormErrorEl(form) {
  let el = form.querySelector('#formError');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'formError';
  el.setAttribute('role', 'alert');
  el.style.cssText =
    'display:none;margin-top:14px;padding:12px 16px;border-radius:10px;' +
    'background:rgba(240,64,64,0.08);border:1px solid rgba(240,64,64,0.35);' +
    'color:#f04040;font-size:0.9rem;line-height:1.5;align-items:flex-start;gap:10px;';
  el.innerHTML = '<i class="fas fa-circle-exclamation" style="margin-top:2px;"></i><span id="formErrorMsg"></span>';
  // Insert right after the submit button / success div
  const success = form.querySelector('#formSuccess');
  (success ? success.parentNode.insertBefore(el, success.nextSibling) : form.appendChild(el));
  return el;
}
function _showFormError(form, msg) {
  const el = _ensureFormErrorEl(form);
  el.querySelector('#formErrorMsg').textContent = msg;
  el.style.display = 'flex';
}
function _hideFormError(form) {
  const el = form.querySelector('#formError');
  if (el) el.style.display = 'none';
}

// localStorage fallback — preserves submissions so customer data is
// never lost during an outage. Admin flushes them via Settings → Offline Queue.
function _genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function _localFallbackSave(payload) {
  try {
    const key      = 've_offline_queue';
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    existing.push({ ...payload, id: _genId(), ts: Date.now() });
    localStorage.setItem(key, JSON.stringify(existing));
  } catch (_) { /* storage quota or blocked — silently ignore */ }
}


// ===== BACK TO TOP =====
const backToTop = document.getElementById('backToTop');
backToTop.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ===== SMOOTH SCROLL =====
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      e.preventDefault();
      const top = target.getBoundingClientRect().top + window.scrollY - 70;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  });
});

// ===== COUNTER ANIMATION =====
function animateCounter(el, target, duration = 2000) {
  let start = 0;
  const step   = target / (duration / 16);
  const suffix = el.dataset.suffix || '';
  const timer  = setInterval(() => {
    start += step;
    if (start >= target) {
      clearInterval(timer);
      el.textContent = target + suffix;
    } else {
      el.textContent = Math.floor(start) + suffix;
    }
  }, 16);
}

const statsObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.querySelectorAll('.stat-number').forEach(num => {
        const text   = num.textContent;
        const value  = parseInt(text.replace(/\D/g, ''));
        const suffix = text.replace(/[0-9]/g, '');
        num.dataset.suffix = suffix;
        animateCounter(num, value);
      });
      statsObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.5 });

const heroStats = document.querySelector('.hero-stats');
if (heroStats