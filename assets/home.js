/* ============================================================================
   byheir.com — homepage interactions
   Everything here is progressive enhancement: the page reads top to bottom
   with JavaScript off. Mobile nav + the guided tour live in script.js.
   ============================================================================ */

(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  // --------------------------------------------------------------------------
  // Theme toggle — dark by default, explicit choice is remembered
  // --------------------------------------------------------------------------
  var THEME_KEY = 'byheir-theme';
  var themeMeta = $('meta[name="theme-color"]');
  var toggles = $$('[data-theme-toggle]');

  function syncTheme() {
    var theme = root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    var next = theme === 'light' ? 'dark' : 'light';
    if (themeMeta) themeMeta.setAttribute('content', theme === 'light' ? '#f4f1ea' : '#0c0d10');
    toggles.forEach(function (btn) {
      if (btn.hasAttribute('aria-pressed')) {
        btn.setAttribute('aria-pressed', String(theme === 'light'));
        btn.setAttribute('aria-label', 'Switch to ' + next + ' theme');
      }
    });
  }

  toggles.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
      syncTheme();
    });
  });
  syncTheme();

  // --------------------------------------------------------------------------
  // Header — hairline + blur once the page has scrolled
  // --------------------------------------------------------------------------
  var header = $('[data-header]');
  if (header) {
    var onScroll = function () { header.classList.toggle('is-scrolled', window.scrollY > 8); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // --------------------------------------------------------------------------
  // Nav — mark the section in view
  // --------------------------------------------------------------------------
  var navLinks = $$('.nav-menu a[href^="#"]');
  if ('IntersectionObserver' in window && navLinks.length) {
    var byId = {};
    navLinks.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navLinks.forEach(function (a) { a.removeAttribute('aria-current'); });
        var link = byId[entry.target.id];
        if (link) link.setAttribute('aria-current', 'true');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(byId).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) spy.observe(el);
    });
    // Sections without a nav entry (hero, profile) clear the marker
    ['top', 'about'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) spy.observe(el);
    });
  }

  // --------------------------------------------------------------------------
  // Scroll reveal — siblings stagger; anything already on screen shows at once
  // --------------------------------------------------------------------------
  var reveals = $$('.reveal');
  if (!('IntersectionObserver' in window) || reduceMotion) {
    reveals.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var revealer = new IntersectionObserver(function (entries) {
      var shown = 0;
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.style.setProperty('--delay', (shown++ * 70) + 'ms');
        entry.target.classList.add('is-in');
        revealer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach(function (el) { revealer.observe(el); });
  }

  // --------------------------------------------------------------------------
  // Work gallery filter
  // --------------------------------------------------------------------------
  var filterBar = $('[data-filters]');
  var gallery = $('[data-gallery]');
  if (filterBar && gallery) {
    var cards = $$('.card', gallery);
    var buttons = $$('.filter', filterBar);
    var status = $('[data-filter-status]');

    var matches = function (card, kind) {
      return kind === 'all' || (card.getAttribute('data-kind') || '').split(' ').indexOf(kind) !== -1;
    };

    // Counts come from the markup, so they can't drift from the cards
    buttons.forEach(function (btn) {
      var kind = btn.getAttribute('data-filter');
      var sup = $('sup', btn);
      if (sup) sup.textContent = cards.filter(function (c) { return matches(c, kind); }).length;
    });

    filterBar.addEventListener('click', function (e) {
      var btn = e.target.closest('.filter');
      if (!btn || btn.classList.contains('is-active')) return;
      var kind = btn.getAttribute('data-filter');

      buttons.forEach(function (b) {
        var on = b === btn;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', String(on));
      });

      var visible = 0;
      cards.forEach(function (card) {
        var show = matches(card, kind);
        card.hidden = !show;
        if (show) {
          visible++;
          card.classList.add('is-in');
          card.style.setProperty('--delay', '0ms');
        }
      });
      if (status) status.textContent = visible + ' project' + (visible === 1 ? '' : 's') + ' shown';
    });
  }

  // The guided tour spotlights gallery cards, so starting it clears any filter
  document.addEventListener('click', function (e) {
    if (!e.target.closest('[data-tour-trigger], .tour-prompt__btn')) return;
    var all = filterBar && filterBar.querySelector('[data-filter="all"]');
    if (all && !all.classList.contains('is-active')) all.click();
  }, true);

  // --------------------------------------------------------------------------
  // Case-study index — screenshot preview follows the cursor
  // --------------------------------------------------------------------------
  var index = $('[data-index]');
  var preview = $('[data-preview-el]');
  if (index && preview && finePointer) {
    // Each row's screenshot is already in the markup; hovering just unhides it
    var previewImgs = $$('img', preview);
    var move = function (e) {
      var w = preview.offsetWidth, h = preview.offsetHeight;
      var x = Math.min(e.clientX + 28, window.innerWidth - w - 16);
      var y = Math.min(Math.max(e.clientY - h / 2, 16), window.innerHeight - h - 16);
      preview.style.setProperty('--x', x + 'px');
      preview.style.setProperty('--y', y + 'px');
    };
    $$('[data-preview-row]', index).forEach(function (row, i) {
      row.addEventListener('pointerenter', function (e) {
        previewImgs.forEach(function (img, n) { img.hidden = n !== i; });
        move(e);
        preview.classList.add('is-on');
      });
      row.addEventListener('pointermove', move);
      row.addEventListener('pointerleave', function () { preview.classList.remove('is-on'); });
    });
    window.addEventListener('scroll', function () { preview.classList.remove('is-on'); }, { passive: true });
  }

  // --------------------------------------------------------------------------
  // Hero stage — a few pixels of parallax between the layered screens
  // --------------------------------------------------------------------------
  var stage = $('[data-stage]');
  if (stage && finePointer && !reduceMotion) {
    var hero = stage.closest('.hero');
    var raf = 0;
    hero.addEventListener('pointermove', function (e) {
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = 0;
        var r = stage.getBoundingClientRect();
        var px = (e.clientX - (r.left + r.width / 2)) / r.width;
        var py = (e.clientY - (r.top + r.height / 2)) / r.height;
        stage.style.setProperty('--px', Math.max(-1, Math.min(1, px)).toFixed(3));
        stage.style.setProperty('--py', Math.max(-1, Math.min(1, py)).toFixed(3));
      });
    });
    hero.addEventListener('pointerleave', function () {
      stage.style.setProperty('--px', 0);
      stage.style.setProperty('--py', 0);
    });
  }

  // --------------------------------------------------------------------------
  // Contact — local time in Delaware
  // --------------------------------------------------------------------------
  var clock = $('[data-local-time]');
  if (clock && window.Intl && Intl.DateTimeFormat) {
    try {
      var fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
      });
      var tick = function () { clock.textContent = 'Local time ' + fmt.format(new Date()); };
      tick();
      clock.hidden = false;
      setInterval(tick, 30000);
    } catch (e) { /* unsupported time zone data — leave it hidden */ }
  }
})();
