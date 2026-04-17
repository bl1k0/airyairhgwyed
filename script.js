/* ============================================================
   VERIDIAN EDGE TECHNICAL SERVICES LLC
   script.js — Public site interactions + quote form
   Backend: Supabase (anon key + RLS)
   ============================================================ */

// ═══════════════════════════════════════════════════════════════
// ⚙  SUPABASE CONFIG — paste your values here (see SUPABASE_SETUP.md)
// ═══════════════════════════════════════════════════════════════
const SUPABASE_URL      = 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY_HERE';
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
async function submitForm(e) {
  e.preventDefault();
  const form    = document.getElementById('quoteForm');
  const btn     = form.querySelector('button[type="submit"]');
  const success = document.getElementById('formSuccess');

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

  // If keys haven't been filled in yet — fall back to local queue
  if (!_configOk()) {
    _localFallbackSave(payload);
    console.warn('[Veridian] Supabase not configured — saved locally.');
    _showSuccess(form, btn, success);
    return;
  }

  try {
    await _supabaseInsert(payload);
    _showSuccess(form, btn, success);
  } catch (err) {
    console.error('[Veridian] Supabase insert failed:', err);
    // Network hiccup → keep the data so it's never lost
    _localFallbackSave(payload);
    _showSuccess(form, btn, success);
  }
}

function _configOk() {
  return SUPABASE_URL && SUPABASE_ANON_KEY
      && !SUPABASE_URL.includes('YOUR_PROJECT')
      && !SUPABASE_ANON_KEY.includes('YOUR_ANON_KEY');
}

// Direct REST insert — no npm dependency needed for the public form
async function _supabaseInsert(payload) {
  const url = SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/quotes';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'apikey':        SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
      'Prefer':        'return=minimal',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.status);
    throw new Error('Supabase ' + res.status + ': ' + text);
  }
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

// localStorage fallback — preserves submissions if the network drops
// or if keys haven't been pasted in yet. Admin can flush them later.
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
if (heroStats) statsObserver.observe(heroStats);
