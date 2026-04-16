/* ============================================================
   VERIDIAN EDGE TECHNICAL SERVICES LLC
   script.js — Interactions & Functionality
   ============================================================ */

// ===== NAVBAR SCROLL =====
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 60);
  // Back to top visibility
  backToTop.classList.toggle('visible', window.scrollY > 400);
});

// ===== HAMBURGER MENU =====
const hamburger = document.getElementById('hamburger');
const navLinks  = document.getElementById('navLinks');
hamburger.addEventListener('click', () => {
  navLinks.classList.toggle('open');
  hamburger.classList.toggle('active');
});
// Close on link click
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
const filterBtns = document.querySelectorAll('.filter-btn');
const portfolioItems = document.querySelectorAll('.portfolio-item');

filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const filter = btn.dataset.filter;
    portfolioItems.forEach(item => {
      const match = filter === 'all' || item.dataset.category === filter;
      item.style.opacity = match ? '1' : '0.25';
      item.style.transform = match ? 'scale(1)' : 'scale(0.95)';
      item.style.pointerEvents = match ? 'auto' : 'none';
      item.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
    });
  });
});

// ===== QUOTE FORM SUBMISSION =====
function submitForm(e) {
  e.preventDefault();
  const form = document.getElementById('quoteForm');
  const btn  = form.querySelector('button[type="submit"]');
  const success = document.getElementById('formSuccess');

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

  // Simulate submission delay (replace with real backend/EmailJS)
  setTimeout(() => {
    form.reset();
    btn.style.display = 'none';
    success.style.display = 'flex';
    setTimeout(() => {
      btn.style.display = 'flex';
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Quote Request';
      success.style.display = 'none';
    }, 5000);
  }, 1400);
}

// ===== BACK TO TOP =====
const backToTop = document.getElementById('backToTop');
backToTop.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ===== SMOOTH SCROLL for anchor links =====
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      e.preventDefault();
      const offset = 70;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  });
});

// ===== COUNTER ANIMATION for hero stats =====
function animateCounter(el, target, duration = 2000) {
  let start = 0;
  const step = target / (duration / 16);
  const suffix = el.dataset.suffix || '';
  const timer = setInterval(() => {
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
      const numbers = entry.target.querySelectorAll('.stat-number');
      numbers.forEach(num => {
        const text = num.textContent;
        const value = parseInt(text.replace(/\D/g, ''));
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
