/* Labour Law Alliance — site behaviour (no dependencies) */
(function () {
  'use strict';

  /* ---------- Anonymous visit counting (no cookies) ----------
     Remembers, for this browser tab only, how the visitor first arrived (search engine, social media, direct)
     so an enquiry can show where it came from. Skipped if the visitor turned analytics off. */
  var visit = (function () {
    var v = null;
    try { v = JSON.parse(sessionStorage.getItem('lla_visit')); } catch (e) {}
    if (!v) {
      var q = new URLSearchParams(location.search);
      v = { s: Math.random().toString(36).slice(2, 12), r: document.referrer || '', us: q.get('utm_source') || '', um: q.get('utm_medium') || '', uc: q.get('utm_campaign') || '', lp: location.pathname, first: true };
      try { sessionStorage.setItem('lla_visit', JSON.stringify(v)); } catch (e) {}
    } else v.first = false;
    return v;
  })();
  (function () {
    var c = null;
    try { c = JSON.parse(localStorage.getItem('lla_cookie_consent')); } catch (e) {}
    if (c && c.analytics === false) return;
    if (/^\/(admin|api)/.test(location.pathname)) return;
    var body = JSON.stringify({ p: location.pathname, r: visit.first ? visit.r : '', us: visit.first ? visit.us : '', um: visit.first ? visit.um : '', uc: visit.first ? visit.uc : '', s: visit.s, l: visit.first, w: window.innerWidth });
    try {
      if (navigator.sendBeacon) navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }));
      else fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true });
    } catch (e) {}
  })();

  /* ---------- Footer year ---------- */
  var y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  /* ---------- Mobile menu ---------- */
  var toggle = document.getElementById('menuToggle');
  var nav = document.getElementById('mainNav');
  var headerBottom = document.getElementById('headerBottom');
  function closeMenu() {
    nav.classList.remove('open');
    headerBottom.classList.remove('menu-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open menu');
  }
  toggle.addEventListener('click', function () {
    var open = !nav.classList.contains('open');
    nav.classList.toggle('open', open);
    headerBottom.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  });
  nav.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', closeMenu); });

  /* ---------- Services dropdown (click/tap toggle; hover also opens it on desktop) ---------- */
  var subs = nav.querySelectorAll('.has-sub');
  function closeSubs(except) {
    subs.forEach(function (li) {
      if (li === except) return;
      li.classList.remove('open');
      var b = li.querySelector('.sub-toggle');
      if (b) { b.setAttribute('aria-expanded', 'false'); b.setAttribute('aria-label', 'Show services'); }
    });
  }
  subs.forEach(function (li) {
    var btn = li.querySelector('.sub-toggle');
    if (!btn) return;
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = !li.classList.contains('open');
      closeSubs(li);
      li.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-label', open ? 'Hide services' : 'Show services');
    });
  });
  document.addEventListener('click', function (e) { if (!e.target.closest('.has-sub')) closeSubs(); });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var openLi = nav.querySelector('.has-sub.open');
    closeSubs();
    if (openLi) openLi.querySelector('.sub-toggle').focus();
  });

  /* ---------- Sticky header + scroll-to-top ---------- */
  var scrollBtn = document.getElementById('scrollTop');
  function onScroll() {
    var s = window.scrollY;
    if (window.innerWidth > 767) headerBottom.classList.toggle('is-sticky', s > 300);
    else headerBottom.classList.remove('is-sticky');
    scrollBtn.classList.toggle('show', s > 500);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();
  scrollBtn.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });

  /* ---------- Hero slider (fade, autoplay, arrows, swipe, keyboard) ---------- */
  var hero = document.querySelector('.hero');
  if (hero) {
    var slides = hero.querySelectorAll('.slide');
    var current = 0, timer = null, DELAY = 6000;
    function go(i) {
      slides[current].classList.remove('is-active');
      slides[current].setAttribute('aria-hidden', 'true');
      current = (i + slides.length) % slides.length;
      slides[current].classList.add('is-active');
      slides[current].removeAttribute('aria-hidden');
    }
    function start() { stop(); timer = setInterval(function () { go(current + 1); }, DELAY); }
    function stop() { if (timer) clearInterval(timer); }
    slides.forEach(function (s, i) { if (i !== 0) s.setAttribute('aria-hidden', 'true'); });
    hero.querySelector('.slide-arrow.prev').addEventListener('click', function () { go(current - 1); start(); });
    hero.querySelector('.slide-arrow.next').addEventListener('click', function () { go(current + 1); start(); });
    hero.addEventListener('mouseenter', stop);
    hero.addEventListener('mouseleave', start);
    hero.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { go(current - 1); start(); }
      if (e.key === 'ArrowRight') { go(current + 1); start(); }
    });
    var x0 = null;
    hero.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    hero.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 50) { go(current + (dx < 0 ? 1 : -1)); start(); }
      x0 = null;
    });
    start();
  }

  /* ---------- Forms → /api/contact ---------- */
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  document.querySelectorAll('.js-form').forEach(function (form) {
    var msg = form.querySelector('.frm-message');
    var btn = form.querySelector('button[type=submit]');

    function clearErrors() {
      form.querySelectorAll('.field-error').forEach(function (e) { e.remove(); });
      form.querySelectorAll('.is-invalid').forEach(function (e) { e.classList.remove('is-invalid'); e.removeAttribute('aria-invalid'); });
    }
    function fieldError(el, text) {
      el.classList.add('is-invalid');
      el.setAttribute('aria-invalid', 'true');
      var d = document.createElement('div');
      d.className = 'field-error';
      d.textContent = text;
      el.insertAdjacentElement('afterend', d);
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearErrors();
      msg.className = 'frm-message';
      msg.textContent = '';

      var ok = true;
      form.querySelectorAll('[required]').forEach(function (el) {
        if (!el.value.trim()) { fieldError(el, 'This field cannot be blank.'); ok = false; }
      });
      var email = form.querySelector('input[type=email]');
      if (email && email.value.trim() && !EMAIL_RE.test(email.value.trim())) {
        fieldError(email, 'Please enter a valid email address.'); ok = false;
      }
      if (form.dataset.form === 'enquiry') {
        var any = ['first_name', 'last_name', 'email', 'phone', 'message'].some(function (n) {
          var f = form.elements[n]; return f && f.value.trim();
        });
        if (!any) { msg.className = 'frm-message err'; msg.textContent = 'Please fill in the form before submitting.'; return; }
      }
      if (!ok) {
        msg.className = 'frm-message err';
        msg.textContent = 'There was a problem with your submission. Errors are marked below.';
        var first = form.querySelector('.is-invalid'); if (first) first.focus();
        return;
      }

      var data = { form: form.dataset.form };
      new FormData(form).forEach(function (v, k) { data[k] = String(v); });
      data.visit_ref = visit.r; data.visit_us = visit.us; data.visit_um = visit.um; data.visit_landing = visit.lp;

      btn.disabled = true;
      var label = btn.textContent;
      btn.textContent = 'Sending…';

      fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (res.ok) {
            form.reset();
            msg.className = 'frm-message ok';
            msg.textContent = 'Your responses were submitted successfully. Thank you!';
          } else {
            throw new Error(res.j.error || 'Submission failed');
          }
        })
        .catch(function () {
          msg.className = 'frm-message err';
          msg.innerHTML = 'Sorry, your message could not be sent. Please email us at <a href="mailto:info@labourlawalliance.co.za">info@labourlawalliance.co.za</a> or call <a href="tel:+27697711060">069 771 1060</a>.';
        })
        .finally(function () { btn.disabled = false; btn.textContent = label; });
    });
  });

  /* ---------- Cookie consent (Google Consent Mode v2) ---------- */
  var KEY = 'lla_cookie_consent';
  var banner = document.getElementById('cookieBanner');
  var modal = document.getElementById('cookieModal');
  var reBtn = document.getElementById('cookieReconsent');
  var boxes = modal.querySelectorAll('input[data-cat]');

  function read() { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } }
  function apply(c) {
    if (typeof gtag !== 'function') return;
    gtag('consent', 'update', {
      functionality_storage: c.functional ? 'granted' : 'denied',
      analytics_storage: c.analytics ? 'granted' : 'denied',
      ad_storage: c.ads ? 'granted' : 'denied',
      ad_user_data: c.ads ? 'granted' : 'denied',
      ad_personalization: c.ads ? 'granted' : 'denied'
    });
  }
  function save(c) {
    try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {}
    apply(c);
    banner.hidden = true;
    modal.hidden = true;
    reBtn.hidden = false;
  }
  function openModal() {
    var c = read() || {};
    boxes.forEach(function (b) { b.checked = !!c[b.dataset.cat]; });
    modal.hidden = false;
  }

  var existing = read();
  if (existing) { apply(existing); reBtn.hidden = false; } else { banner.hidden = false; }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-ck]');
    if (!t) return;
    var a = t.dataset.ck;
    if (a === 'accept') save({ functional: true, analytics: true, ads: true });
    else if (a === 'reject') save({ functional: false, analytics: false, ads: false });
    else if (a === 'customize') openModal();
    else if (a === 'close') modal.hidden = true;
    else if (a === 'save') {
      var c = {}; boxes.forEach(function (b) { c[b.dataset.cat] = b.checked; }); save(c);
    }
  });
  reBtn.addEventListener('click', openModal);
  modal.addEventListener('click', function (e) { if (e.target === modal) modal.hidden = true; });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modal.hidden) modal.hidden = true; });
})();
