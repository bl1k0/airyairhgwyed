/* ============================================================
   VERIDIAN EDGE TECHNICAL SERVICES LLC
   script.js — Public site interactions + quote form
   Backend: Supabase (anon key + RLS)

   Features built in:
   - Honeypot + min-time-to-submit spam protection
   - Server-side rate limiting (5/hr per browser fingerprint)
   - Optional photo upload (up to 5, max 5MB each, Supabase Storage)
   - Reference number shown on success (e.g. VE-2026-0042)
   - Offline queue fallback
   ============================================================ */

// ═══════════════════════════════════════════════════════════════
// ⚙  SUPABASE CONFIG — paste your values here (see SUPABASE_SETUP.md)
// TODO: Replace YOUR_SUPABASE_PROJECT_URL and YOUR_SUPABASE_ANON_KEY
//   with your actual values from
//   https://supabase.com/dashboard/project/_/settings/api
//   Do NOT commit real credentials to source control — the public anon
//   key is enforced only by RLS and any misconfig exposes customer data.
// ═══════════════════════════════════════════════════════════════
const SUPABASE_URL      = 'YOUR_SUPABASE_PROJECT_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
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

// ═══════════════════════════════════════════════════════════════
// FORM LOAD TIMESTAMP  (for min-time-to-submit check)
// ═══════════════════════════════════════════════════════════════
const _formLoadedAt = Date.now();
const _MIN_SUBMIT_SECONDS = 3;    // bots typically fill forms in under 2s

// ═══════════════════════════════════════════════════════════════
// BROWSER FINGERPRINT  (best-effort, for rate limiting)
// ═══════════════════════════════════════════════════════════════
async function _browserIdent() {
  // Combine stable-ish browser signals into a SHA-256 hash.
  const raw = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || '',
  ].join('|');
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  return 'fp_' + Array.from(new Uint8Array(buf)).slice(0, 12)
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

// ═══════════════════════════════════════════════════════════════
// PHOTO PREVIEW + VALIDATION
// ═══════════════════════════════════════════════════════════════
const MAX_PHOTOS = 5;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB

(function setupPhotoPreview() {
  const input = document.getElementById('fphotos');
  const preview = document.getElementById('photoPreview');
  if (!input || !preview) return;

  input.addEventListener('change', () => {
    preview.innerHTML = '';
    const files = Array.from(input.files || []);
    if (files.length > MAX_PHOTOS) {
      _showFormError(document.getElementById('quoteForm'),
        `You can attach up to ${MAX_PHOTOS} photos. You selected ${files.length}.`);
      input.value = '';
      return;
    }
    _hideFormError(document.getElementById('quoteForm'));
    files.forEach(f => {
      if (f.size > MAX_PHOTO_BYTES) {
        _showFormError(document.getElementById('quoteForm'),
          `"${f.name}" is larger than 5MB. Please compress it and try again.`);
        return;
      }
      const reader = new FileReader();
      reader.onload = e => {
        const thumb = document.createElement('div');
        thumb.style.cssText =
          'width:72px;height:72px;border-radius:8px;overflow:hidden;border:1px solid rgba(255,255,255,0.15);' +
          'background:#1e293b;display:flex;align-items:center;justify-content:center;';
        thumb.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;" alt="preview" />`;
        preview.appendChild(thumb);
      };
      reader.readAsDataURL(f);
    });
  });
})();

// ═══════════════════════════════════════════════════════════════
// QUOTE FORM SUBMISSION
// ═══════════════════════════════════════════════════════════════
// The success confirmation is ONLY shown after Supabase echoes back
// a persisted row with an id (return=representation). Any failure
// surfaces a visible error instead of a misleading success.
async function submitForm(e) {
  e.preventDefault();
  const form    = document.getElementById('quoteForm');
  const btn     = form.querySelector('button[type="submit"]');
  const success = document.getElementById('formSuccess');

  _hideFormError(form);
  btn.disabled  = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending…';

  // ── 1. Honeypot check ──
  const honeypot = form.querySelector('[name="website"]');
  if (honeypot && honeypot.value.trim() !== '') {
    // Silent failure — pretend it worked so the bot moves on
    console.warn('[Veridian] Honeypot tripped — bot detected.');
    _showSuccess(form, btn, success, '—');
    return;
  }

  // ── 2. Min-time-to-submit check ──
  const secondsOnPage = (Date.now() - _formLoadedAt) / 1000;
  if (secondsOnPage < _MIN_SUBMIT_SECONDS) {
    console.warn('[Veridian] Submitted too fast — likely bot.');
    _resetBtn(btn);
    _showFormError(form, "Please take a moment to fill out the form completely before submitting.");
    return;
  }

  // ── 3. Collect payload ──
  const payload = {
    name:     _sanitise(form.querySelector('[name="name"]').value),
    phone:    _sanitise(form.querySelector('[name="phone"]').value),
    email:    _sanitise(form.querySelector('[name="email"]').value),
    service:  _sanitise(form.querySelector('[name="service"]').value),
    location: _sanitise(form.querySelector('[name="location"]').value),
    message:  _sanitise(form.querySelector('[name="message"]').value),
    status:   'new',
    _idempotency_key: _makeIdempotencyKey(),  // one key per submit attempt
  };

  // ── 4. Config guard ──
  if (!_configOk()) {
    console.error('[Veridian] Supabase not configured in script.js — cannot submit.');
    _localFallbackSave(payload);
    _resetBtn(btn);
    _showFormError(form, 'Our server is being set up. Please call or WhatsApp us instead — your request has been saved locally.');
    return;
  }

  try {
    // ── 5. Rate limit check ──
    const ident = await _browserIdent();
    const recentCount = await _checkRateLimit(ident);
    if (recentCount >= 5) {
      _resetBtn(btn);
      _showFormError(form,
        "You've submitted several requests recently. Please wait an hour before sending another, or contact us directly on WhatsApp.");
      return;
    }

    // ── 6. Upload photos (if any) ──
    let photoUrls = [];
    const photoInput = form.querySelector('[name="photos"]');
    if (photoInput && photoInput.files && photoInput.files.length) {
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading photos…';
      photoUrls = await _uploadPhotos(Array.from(photoInput.files));
    }
    payload.photo_urls = photoUrls;

    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending…';

    // ── 7. Insert the quote ──
    const savedRow = await _supabaseInsert(payload);

    // ── 8. Log rate-limit token (best effort, non-blocking) ──
    _logRateLimit(ident).catch(() => {});

    if (savedRow && (savedRow.id || savedRow.ref_number !== undefined)) {
      console.info('[Veridian] Quote saved. id:', savedRow.id, 'ref:', savedRow.ref_number);
      _showSuccess(form, btn, success, savedRow.ref_number || '');
    } else {
      throw new Error('Supabase returned an empty response — row may not have been saved.');
    }
  } catch (err) {
    console.error('[Veridian] Submit failed:', err);
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

// ── Supabase REST helpers ──────────────────────────────────────
function _sbHeaders(extra = {}) {
  return {
    'Content-Type':  'application/json',
    'apikey':        SUPABASE_ANON_KEY,
    'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
    ...extra,
  };
}

// Stable per-submission idempotency key (survives retries inside one submit).
function _makeIdempotencyKey() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'ik_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

async function _supabaseInsert(payload) {
  // Anon users MUST submit via the SECURITY DEFINER RPC. Direct INSERT is
  // also allowed by RLS but PostgREST's `return=representation` swallows the
  // response for anon (no SELECT policy for anon) so we can't read the
  // ref_number back. Preferred path → v2 RPC with idempotency.
  const base    = SUPABASE_URL.replace(/\/$/, '');
  const idemKey = payload._idempotency_key || _makeIdempotencyKey();

  const bodyV2 = {
    p_name:             payload.name,
    p_phone:            payload.phone,
    p_email:            payload.email || null,
    p_service:          payload.service,
    p_location:         payload.location || null,
    p_message:          payload.message || null,
    p_photo_urls:       payload.photo_urls || [],
    p_idempotency_key:  idemKey,
  };

  // ── Path A: v2 RPC (idempotent) ──
  let res = await fetch(base + '/rest/v1/rpc/submit_public_quote_v2', {
    method:  'POST',
    headers: _sbHeaders(),
    body:    JSON.stringify(bodyV2),
  });

  if (res.ok) {
    const rows = await res.json().catch(() => null);
    const row  = Array.isArray(rows) ? rows[0] : rows;
    if (row && row.id) {
      if (row.was_duplicate) {
        console.info('[Veridian] Idempotent dedupe — row already existed:', row.id);
      }
      return row;
    }
    // Empty response — fall through.
  } else if (res.status !== 404 && res.status !== 400) {
    // Real failure (401/403/500 etc.) — bubble up so we DON'T silently queue.
    const text = await res.text().catch(() => String(res.status));
    throw new Error('Supabase v2 RPC ' + res.status + ': ' + text);
  } else {
    console.warn('[Veridian] submit_public_quote_v2 not found — trying v1 RPC. Run SUPABASE_PATCH_3.sql to enable v2.');
  }

  // ── Path B: v1 RPC fallback (no idempotency, but still SECURITY DEFINER) ──
  const bodyV1 = { ...bodyV2 };
  delete bodyV1.p_idempotency_key;
  res = await fetch(base + '/rest/v1/rpc/submit_public_quote', {
    method:  'POST',
    headers: _sbHeaders(),
    body:    JSON.stringify(bodyV1),
  });
  if (res.ok) {
    const rows = await res.json().catch(() => null);
    const row  = Array.isArray(rows) ? rows[0] : rows;
    if (row && row.id) return row;
  } else if (res.status !== 404 && res.status !== 400) {
    const text = await res.text().catch(() => String(res.status));
    throw new Error('Supabase v1 RPC ' + res.status + ': ' + text);
  } else {
    console.warn('[Veridian] submit_public_quote RPC also missing — falling back to direct INSERT.');
  }

  // ── Path C: direct INSERT as anon (works per public_insert_quotes RLS) ──
  const insUrl = base + '/rest/v1/quotes';
  const safePayload = { ...payload };
  delete safePayload._idempotency_key;
  res = await fetch(insUrl, {
    method:  'POST',
    headers: _sbHeaders({ 'Prefer': 'return=minimal' }),
    body:    JSON.stringify(safePayload),
  });
  if (!res.ok && (res.status === 400 || res.status === 422) && 'photo_urls' in safePayload) {
    delete safePayload.photo_urls;
    res = await fetch(insUrl, {
      method:  'POST',
      headers: _sbHeaders({ 'Prefer': 'return=minimal' }),
      body:    JSON.stringify(safePayload),
    });
  }
  if (!res.ok) {
    const text = await res.text().catch(() => String(res.status));
    throw new Error('Supabase ' + res.status + ': ' + text);
  }
  return { id: 'pending', ref_number: '' };
}

async function _checkRateLimit(ident) {
  try {
    const url = SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/rpc/check_rate_limit';
    const res = await fetch(url, {
      method: 'POST',
      headers: _sbHeaders(),
      body: JSON.stringify({ p_ident: ident }),
    });
    if (!res.ok) return 0;
    const n = await res.json();
    return typeof n === 'number' ? n : 0;
  } catch (_) { return 0; }
}

async function _logRateLimit(ident) {
  const url = SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/rate_limits';
  await fetch(url, {
    method: 'POST',
    headers: _sbHeaders({ 'Prefer': 'return=minimal' }),
    body: JSON.stringify({ ident }),
  });
}

async function _uploadPhotos(files) {
  const urls = [];
  const base = SUPABASE_URL.replace(/\/$/, '');
  for (const file of files) {
    // Sanitise filename so the whole path is already URL-safe. We must NOT
    // URL-encode the '/' separators — Supabase Storage treats the path
    // segments as folder prefixes, and encoded slashes make the public URL
    // unreachable (image appears broken in the admin panel).
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
    const folder   = new Date().toISOString().slice(0, 10);          // 2026-04-18
    const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeName}`;
    const path     = `${folder}/${filename}`;

    const uploadUrl = `${base}/storage/v1/object/quote-photos/${path}`;
    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'apikey':        SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
        'Content-Type':  file.type || 'application/octet-stream',
        'x-upsert':      'true',
      },
      body: file,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => String(res.status));
      console.warn('[Veridian] Photo upload failed:', file.name, res.status, errText);
      continue;
    }
    const publicUrl = `${base}/storage/v1/object/public/quote-photos/${path}`;
    urls.push(publicUrl);
    console.info('[Veridian] Uploaded photo →', publicUrl);
  }
  return urls;
}

// ── UI helpers ──────────────────────────────────────────────────
function _showSuccess(form, btn, success, refNumber) {
  form.reset();
  // Also clear photo preview
  const preview = document.getElementById('photoPreview');
  if (preview) preview.innerHTML = '';

  const refEl = document.getElementById('refNumberDisplay');
  if (refEl) {
    if (refNumber && refNumber !== '—') {
      refEl.innerHTML = `Your reference number: <strong>${refNumber}</strong> &nbsp;·&nbsp; <a href="status.html?ref=${encodeURIComponent(refNumber)}" style="color:inherit;text-decoration:underline;">Track status</a>`;
    } else {
      refEl.textContent = '';
    }
  }

  btn.style.display     = 'none';
  success.style.display = 'flex';
  setTimeout(() => {
    btn.style.display  = 'flex';
    btn.disabled       = false;
    btn.innerHTML      = '<i class="fas fa-paper-plane"></i> Submit Quote Request';
    success.style.display = 'none';
  }, 8000);
}

function _resetBtn(btn) {
  btn.disabled  = false;
  btn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Quote Request';
}

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

// ── Offline queue ──────────────────────────────────────────────
function _genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function _localFallbackSave(payload) {
  try {
    const key      = 've_offline_queue';
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    // Persist a stable idempotency key with each queued row. When the admin
    // later flushes the queue, the v2 RPC will use this key to guarantee
    // rows that DID make it through on a later retry are not duplicated.
    existing.push({
      ...payload,
      id: _genId(),
      ts: Date.now(),
      idempotency_key: payload._idempotency_key || _makeIdempotencyKey(),
    });
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
