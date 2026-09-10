/* ============================================================================
   HUD — homepage workstation controller.

   Loaded synchronously before assets/script.js so `window.hudRevealTarget`
   exists before the SiteTour can start. Does nothing unless the inline switch
   in index.html added `html.hud` (classic view and sub-pages are untouched).

   Responsibilities
     - Boot sequence (once per session, skippable, skipped for deep links)
     - PanelManager: open/close/prev/next holographic panels, focus trap
     - Router: #hash ↔ panel, capture-phase interception of in-page anchors
     - Chrome: clock, telemetry stream, tour chip, decode-text effect
     - CommandPalette: `/` console with a DOM-built index
     - Scene bridge: mounts the three.js scene from hud-scene.js, or leaves
       the CSS orb fallback in place
     - window.hudRevealTarget: lets the SiteTour open the right panel
   ============================================================================ */

(function () {
  'use strict';

  var html = document.documentElement;
  if (!html.classList.contains('hud')) return;

  var body = document.body;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var PANEL_ORDER = ['about', 'experience', 'projects', 'work', 'skills', 'contact'];
  var BOOT_KEY = 'byheir-hud-booted';
  // The inline head script stashes the fragment (and strips it from the URL)
  // so the browser can't fragment-scroll inside a hidden panel.
  var initialHash = window.__hudHash || location.hash || '';

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function isMobile() { return window.innerWidth <= 768; }

  var els = {
    boot: $('[data-hud-boot]'),
    bootLog: $('[data-hud-boot-log]'),
    bootProgress: $('[data-hud-boot-progress]'),
    stage: $('[data-hud-stage]'),
    canvas: $('[data-hud-canvas]'),
    nodes: $$('[data-hud-node]'),
    miniNav: $$('[data-hud-mini-nav] a'),
    panels: $$('.hud-panel'),
    clock: $('[data-hud-clock]'),
    stream: $('[data-hud-stream]'),
    tourChip: $('[data-hud-tour]'),
    home: $('[data-hud-home]'),
    consoleWrap: $('[data-hud-console]'),
    consoleForm: $('[data-hud-command-form]'),
    consoleInput: $('#hud-command'),
    consoleResults: $('#hud-command-results'),
    paletteOpen: $('[data-hud-palette-open]'),
    heroTitle: $('.hero-title'),
    heroSubtitle: $('.hero-subtitle')
  };

  var liveRegion = null;
  function announce(text) {
    if (!liveRegion) {
      liveRegion = document.createElement('div');
      liveRegion.className = 'hud-sr-only';
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.setAttribute('aria-atomic', 'true');
      body.appendChild(liveRegion);
    }
    liveRegion.textContent = '';
    setTimeout(function () { liveRegion.textContent = text; }, 30);
  }

  // --------------------------------------------------------------------------
  // Decode-text effect: scrambles glyphs then resolves to the original text.
  // Preserves the exact final textContent; screen readers get the real label
  // throughout via aria-label.
  // --------------------------------------------------------------------------
  var GLYPHS = '01ABCDEF<>/\\|=+*#%&$@:;';
  function decodeText(el, duration, lockWidth) {
    if (!el || reduceMotion) return;
    if (el.__decodeRaf) cancelAnimationFrame(el.__decodeRaf);
    var original = el.__decodeOriginal || el.textContent;
    el.__decodeOriginal = original;
    duration = duration || 600;
    var start = null;
    var hadLabel = el.hasAttribute('aria-label');
    if (!hadLabel) el.setAttribute('aria-label', original);
    el.classList.add('hud-decoding');
    // Single-line proportional text: pin the box so wider scramble glyphs
    // can't reflow the layout mid-effect.
    var lockedStyle = null;
    if (lockWidth) {
      var rect = el.getBoundingClientRect();
      lockedStyle = { width: el.style.width, whiteSpace: el.style.whiteSpace, overflow: el.style.overflow };
      el.style.width = rect.width + 'px';
      el.style.whiteSpace = 'nowrap';
      el.style.overflow = 'hidden';
    }

    function frame(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / duration, 1);
      var resolved = Math.floor(original.length * p);
      var out = '';
      for (var i = 0; i < original.length; i++) {
        var ch = original[i];
        if (i < resolved || ch === ' ' || ch === '\n') out += ch;
        else out += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      }
      el.textContent = out;
      if (p < 1) {
        el.__decodeRaf = requestAnimationFrame(frame);
      } else {
        el.textContent = original;
        el.classList.remove('hud-decoding');
        if (!hadLabel) el.removeAttribute('aria-label');
        if (lockedStyle) {
          el.style.width = lockedStyle.width;
          el.style.whiteSpace = lockedStyle.whiteSpace;
          el.style.overflow = lockedStyle.overflow;
        }
        el.__decodeRaf = null;
      }
    }
    el.__decodeRaf = requestAnimationFrame(frame);
  }

  // --------------------------------------------------------------------------
  // Boot sequence
  // --------------------------------------------------------------------------
  var BOOT_LINES = [
    ['BYHEIR.OS v2026.09 — SECURE BOOT', 0, ''],
    ['> mounting profile: WISE, BYHEIR ............ OK', 220, 'ok'],
    ['> loading servicing & collections systems .. OK', 480, 'ok'],
    ['> indexing 5 case studies · 9 demos · 4 live apps', 760, ''],
    ['> calibrating holographic display .......... OK', 1040, 'ok'],
    ['> status: AVAILABLE FOR OPPORTUNITIES', 1320, 'amber'],
    ['> location: BEAR, DE · 39.63°N 75.66°W', 1560, ''],
    ['> all systems online — press any key', 1800, 'ok']
  ];
  var BOOT_REVEAL_AT = 2300;
  var bootTimers = [];
  var bootDone = false;

  function shouldSkipBoot() {
    if (reduceMotion || !els.boot) return true;
    try {
      var params = new URLSearchParams(location.search);
      if (params.has('tour') || params.has('view')) return true;
      if (sessionStorage.getItem(BOOT_KEY) === '1') return true;
    } catch (e) {}
    if (initialHash.length > 1) return true;
    return false;
  }

  function finishBoot() {
    if (bootDone) return;
    bootDone = true;
    bootTimers.forEach(clearTimeout);
    bootTimers = [];
    html.classList.remove('hud-booting');
    html.classList.add('hud-ready');
    if (els.boot) {
      els.boot.classList.add('is-done');
      els.boot.setAttribute('aria-hidden', 'true');
      setTimeout(function () { if (els.boot && els.boot.parentNode) els.boot.parentNode.removeChild(els.boot); }, 500);
    }
    try { sessionStorage.setItem(BOOT_KEY, '1'); } catch (e) {}
    document.removeEventListener('keydown', onBootKey, true);
    decodeText(els.heroTitle, 700, true);
    decodeText(els.heroSubtitle, 900);
    window.dispatchEvent(new Event('hud:ready'));
  }

  function onBootKey(e) {
    if (e.key === 'Tab' || e.key === 'Shift' || e.key === 'Alt' || e.key === 'Control' || e.key === 'Meta') return;
    e.preventDefault();
    finishBoot();
  }

  function boot() {
    if (shouldSkipBoot()) {
      finishBoot();
      return;
    }
    if (els.bootLog) els.bootLog.textContent = '';
    BOOT_LINES.forEach(function (line, idx) {
      bootTimers.push(setTimeout(function () {
        if (!els.bootLog) return;
        var span = document.createElement('span');
        if (line[2]) span.className = line[2];
        span.textContent = line[0] + (idx < BOOT_LINES.length - 1 ? '\n' : '');
        els.bootLog.appendChild(span);
        if (els.bootProgress) {
          els.bootProgress.style.width = Math.round(((idx + 1) / BOOT_LINES.length) * 100) + '%';
        }
      }, line[1]));
    });
    bootTimers.push(setTimeout(finishBoot, BOOT_REVEAL_AT));
    els.boot.addEventListener('click', finishBoot);
    document.addEventListener('keydown', onBootKey, true);
  }

  // --------------------------------------------------------------------------
  // PanelManager
  // --------------------------------------------------------------------------
  var currentPanel = null;
  var lastNode = null;

  function panelByName(name) {
    return $('.hud-panel[data-panel="' + name + '"]');
  }

  function nodeByName(name) {
    return $('[data-hud-node="' + name + '"]');
  }

  function setHash(name, replace) {
    var url = location.pathname + location.search + (name ? '#' + name : '');
    try {
      if (replace) history.replaceState(null, '', url);
      else history.pushState(null, '', url);
    } catch (e) {}
  }

  function openPanel(name, opts) {
    opts = opts || {};
    var panel = panelByName(name);
    if (!panel) return false;
    var focus = opts.focus !== false;
    var updateHash = opts.updateHash !== false;

    if (currentPanel && currentPanel !== name) {
      var prevPanel = panelByName(currentPanel);
      if (prevPanel) prevPanel.classList.remove('is-open');
      var prevNode = nodeByName(currentPanel);
      if (prevNode) prevNode.setAttribute('aria-expanded', 'false');
    }

    var alreadyOpen = currentPanel === name;
    currentPanel = name;
    panel.classList.add('is-open');
    if (els.stage) els.stage.classList.add('is-dimmed');
    body.classList.add('hud-panel-open');
    var node = nodeByName(name);
    if (node) {
      node.setAttribute('aria-expanded', 'true');
      if (opts.source === 'node') lastNode = node;
    }
    els.miniNav.forEach(function (a) {
      a.classList.toggle('is-active', a.getAttribute('href') === '#' + name);
    });
    if (updateHash && location.hash !== '#' + name) setHash(name, false);

    if (!alreadyOpen) {
      panel.scrollTop = 0;
      var heading = $('.section-title, .contact-title', panel);
      decodeText(heading, 500);
      announce((heading ? heading.textContent : name) + ' panel opened');
    }
    if (focus) {
      // Focus the panel container so screen readers land at the top; keyboard
      // users then Tab straight into the panel bar controls.
      panel.focus({ preventScroll: true });
    }
    return true;
  }

  function closePanel(opts) {
    opts = opts || {};
    if (!currentPanel) return;
    var name = currentPanel;
    var panel = panelByName(name);
    var node = nodeByName(name);
    if (panel) panel.classList.remove('is-open');
    if (node) node.setAttribute('aria-expanded', 'false');
    els.miniNav.forEach(function (a) { a.classList.remove('is-active'); });
    if (els.stage) els.stage.classList.remove('is-dimmed');
    body.classList.remove('hud-panel-open');
    currentPanel = null;
    if (location.hash) setHash('', true);
    announce('Returned to hub');
    if (opts.restoreFocus !== false) {
      var target = lastNode || node || els.nodes[0];
      if (target) target.focus({ preventScroll: true });
    }
  }

  function stepPanel(delta) {
    if (!currentPanel) return;
    var idx = PANEL_ORDER.indexOf(currentPanel);
    var next = PANEL_ORDER[(idx + delta + PANEL_ORDER.length) % PANEL_ORDER.length];
    openPanel(next, { focus: true });
  }

  // Offset of `el` from the top of the panel's scrollable content. Uses the
  // offsetTop chain rather than bounding rects so the materialize animation
  // (which transforms the panel) can't skew the measurement.
  function offsetWithin(panel, el) {
    var top = 0;
    var n = el;
    while (n && n !== panel) {
      top += n.offsetTop;
      n = n.offsetParent;
    }
    return top;
  }

  // Scroll `el` into a sensible slot inside the panel's own scroll container.
  function scrollPanelTo(panel, el, behavior) {
    if (!panel || !el || el === panel) return;
    var panelH = panel.clientHeight;
    var elH = el.offsetHeight;
    var barH = 64;
    var offset;
    if (isMobile()) {
      offset = Math.max(72, Math.round(panelH * 0.18));
    } else {
      offset = Math.max(barH + 16, Math.round((panelH - elH) / 2));
    }
    var top = offsetWithin(panel, el) - offset;
    try {
      panel.scrollTo({ top: Math.max(0, top), behavior: behavior || (reduceMotion ? 'auto' : 'smooth') });
    } catch (e) {
      panel.scrollTop = Math.max(0, top);
    }
  }

  function trapFocus(e) {
    if (e.key !== 'Tab' || !currentPanel) return;
    if (body.classList.contains('tour-active')) return;
    var panel = panelByName(currentPanel);
    if (!panel) return;
    if (document.activeElement === els.consoleInput) return;
    var focusables = $$('a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])', panel)
      .filter(function (n) { return n.offsetParent !== null; });
    if (!focusables.length) return;
    var first = focusables[0];
    var last = focusables[focusables.length - 1];
    var active = document.activeElement;
    var inside = panel.contains(active);
    if (!inside) {
      // Focus is outside the panel (e.g. on the panel container itself or the
      // console); let the first Tab land on the first control.
      if (active !== panel && active !== els.consoleInput) {
        e.preventDefault();
        first.focus();
      }
      return;
    }
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function bindPanels() {
    els.panels.forEach(function (panel) {
      var prev = $('[data-hud-prev]', panel);
      var next = $('[data-hud-next]', panel);
      var close = $('[data-hud-close]', panel);
      if (prev) prev.addEventListener('click', function () { stepPanel(-1); });
      if (next) next.addEventListener('click', function () { stepPanel(1); });
      if (close) close.addEventListener('click', function () { closePanel(); });
      // Let the SiteTour's window-scroll reposition follow panel scrolling
      panel.addEventListener('scroll', function () {
        window.dispatchEvent(new Event('scroll'));
      }, { passive: true });
    });

    els.nodes.forEach(function (node) {
      node.addEventListener('click', function () {
        var name = node.dataset.hudNode;
        if (currentPanel === name) {
          closePanel();
        } else {
          lastNode = node;
          openPanel(name, { source: 'node' });
        }
      });
    });

    if (els.home) {
      els.home.addEventListener('click', function (e) {
        e.preventDefault();
        closePanel();
        if (els.nodes[0]) els.nodes[0].focus({ preventScroll: true });
      });
    }
  }

  // --------------------------------------------------------------------------
  // Router — hash ↔ panel, and capture-phase interception of in-page anchors
  // --------------------------------------------------------------------------
  function resolveHash(hash) {
    var id = (hash || '').replace(/^#/, '');
    if (!id) return null;
    var el;
    try { el = document.getElementById(id); } catch (e) { el = null; }
    if (!el) return { id: id, el: null, panel: null };
    var panel = el.closest ? el.closest('.hud-panel') : null;
    return { id: id, el: el, panel: panel };
  }

  function route(hash, opts) {
    opts = opts || {};
    var r = resolveHash(hash);
    if (!r) {
      closePanel({ restoreFocus: opts.restoreFocus !== false });
      return;
    }
    if (r.id === 'main' || r.id === 'hud-nodes') {
      closePanel({ restoreFocus: false });
      if (els.nodes[0]) els.nodes[0].focus({ preventScroll: true });
      return;
    }
    if (!r.panel) return;
    var name = r.panel.dataset.panel;
    var wasOpen = currentPanel === name;
    openPanel(name, { focus: opts.focus !== false, updateHash: false });
    if (r.el !== r.panel) {
      var doScroll = function () { scrollPanelTo(r.panel, r.el); };
      if (wasOpen) doScroll(); else requestAnimationFrame(function () { requestAnimationFrame(doScroll); });
    }
  }

  function bindRouter() {
    window.addEventListener('hashchange', function () {
      route(location.hash, { focus: true });
    });

    // Intercept every same-page anchor before script.js's smooth-scroll and
    // mobile-nav handlers see it (capture phase).
    document.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('a[href]') : null;
      if (!a) return;
      var href = a.getAttribute('href');
      if (!href || href.charAt(0) !== '#') return;
      if (a.closest('.tour-tooltip, .tour-prompt')) return;
      e.preventDefault();
      e.stopPropagation();
      if (href === '#') { closePanel(); return; }
      var r = resolveHash(href);
      if (r && r.panel) {
        if (location.hash !== href) setHash(r.panel.dataset.panel, false);
      }
      route(href, { focus: true });
    }, true);
  }

  // --------------------------------------------------------------------------
  // Chrome — clock, telemetry stream, tour chip
  // --------------------------------------------------------------------------
  function startClock() {
    if (!els.clock) return;
    function tick() {
      var now = new Date();
      var s = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      els.clock.textContent = s;
      els.clock.setAttribute('datetime', now.toISOString());
    }
    tick();
    setInterval(tick, reduceMotion ? 60000 : 1000);
  }

  function startStream() {
    if (!els.stream || reduceMotion) return;
    var lines = [];
    var LINES = 14;
    function hex(n) { return Math.floor(Math.random() * 256).toString(16).toUpperCase().padStart(2, '0'); }
    function line() {
      var addr = (0x2000 + Math.floor(Math.random() * 0xDFFF)).toString(16).toUpperCase();
      return addr + '  ' + [hex(), hex(), hex(), hex()].join(' ');
    }
    for (var i = 0; i < LINES; i++) lines.push(line());
    els.stream.textContent = lines.join('\n');
    setInterval(function () {
      if (document.hidden) return;
      lines.shift();
      lines.push(line());
      els.stream.textContent = lines.join('\n');
    }, 520);
  }

  function bindTourChip() {
    if (!els.tourChip) return;
    els.tourChip.addEventListener('click', function () {
      var real = $('[data-tour-trigger]');
      if (real) real.click();
    });
  }

  // --------------------------------------------------------------------------
  // Command palette
  // --------------------------------------------------------------------------
  var index = [];
  var results = [];
  var selected = -1;

  function addEntry(entry) {
    entry.haystack = (entry.label + ' ' + (entry.hint || '') + ' ' + (entry.keywords || '')).toLowerCase();
    index.push(entry);
  }

  function buildIndex() {
    index = [];
    PANEL_ORDER.forEach(function (name) {
      var panel = panelByName(name);
      if (!panel) return;
      var h = $('.section-title, .contact-title', panel);
      var node = nodeByName(name);
      addEntry({
        kind: 'section',
        label: node ? $('.hud-node__label', node).textContent : name,
        hint: h ? h.textContent.trim() : '',
        keywords: name + ' section panel open',
        run: function () { openPanel(name, { focus: true }); }
      });
    });

    $$('#work .work-card').forEach(function (card) {
      var title = $('.work-card__title', card);
      var status = $('.work-card__status', card);
      var chips = $$('.work-card__chips li', card).map(function (li) { return li.textContent; }).join(' ');
      var href = card.getAttribute('href');
      var external = card.getAttribute('target') === '_blank';
      addEntry({
        kind: external ? 'live app' : 'build',
        label: title ? title.textContent.replace(/↗/g, '').trim() : href,
        hint: status ? status.textContent.trim() : '',
        keywords: chips + ' ' + ($('.work-card__tagline', card) || {}).textContent,
        run: function () { if (external) window.open(href, '_blank', 'noopener'); else location.assign(href); },
        reveal: card
      });
    });

    $$('#projects .experience-card').forEach(function (card) {
      var title = $('.card-title', card);
      addEntry({
        kind: 'project',
        label: title ? title.textContent.trim() : 'Project',
        hint: ($('.card-company', card) || {}).textContent || '',
        keywords: card.textContent.slice(0, 400),
        run: function () {
          openPanel('projects', { focus: false });
          requestAnimationFrame(function () { scrollPanelTo(panelByName('projects'), card); });
        }
      });
    });

    $$('#skills .skill-card').forEach(function (card) {
      var h = $('.skill-header', card);
      addEntry({
        kind: 'skills',
        label: h ? h.textContent.trim() : 'Skills',
        hint: $$('.skill-pill', card).slice(0, 3).map(function (p) { return p.textContent; }).join(' · '),
        keywords: card.textContent.slice(0, 600),
        run: function () {
          openPanel('skills', { focus: false });
          requestAnimationFrame(function () { scrollPanelTo(panelByName('skills'), card); });
        }
      });
    });

    $$('.code-samples__list a').forEach(function (a) {
      addEntry({
        kind: 'code',
        label: a.textContent.trim() + ' code sample',
        hint: a.getAttribute('href'),
        keywords: 'code sample walkthrough',
        run: function () { location.assign(a.getAttribute('href')); }
      });
    });

    addEntry({ kind: 'action', label: 'Guided tour', hint: 'Recruiter or full tour', keywords: 'tour walkthrough start', run: function () { var t = $('[data-tour-trigger]'); if (t) t.click(); } });
    addEntry({ kind: 'action', label: 'Classic view', hint: 'Plain scrolling page', keywords: 'classic scroll simple', run: function () { location.assign('?view=classic'); } });
    addEntry({ kind: 'page', label: 'For hiring managers', hint: 'Resume claims mapped to evidence', keywords: 'hiring recruiter evidence', run: function () { location.assign('pages/for-hiring-managers.html'); } });
    addEntry({ kind: 'action', label: 'Download resume', hint: 'PDF', keywords: 'resume cv pdf download', run: function () { location.assign('assets/byheir-wise-resume.pdf'); } });
    addEntry({ kind: 'action', label: 'Email me', hint: 'byheirw@gmail.com', keywords: 'email contact mail', run: function () { location.assign('mailto:byheirw@gmail.com'); } });
    addEntry({ kind: 'link', label: 'LinkedIn', hint: 'Opens in a new tab', keywords: 'linkedin profile social', run: function () { window.open('https://www.linkedin.com/in/byheir-wise-976253265', '_blank', 'noopener'); } });
    addEntry({ kind: 'action', label: 'Close panel', hint: 'Return to hub', keywords: 'close hub home back', run: function () { closePanel(); } });
  }

  function match(query) {
    var q = query.trim().toLowerCase();
    if (!q) return [];
    var tokens = q.split(/\s+/);
    return index
      .map(function (entry) {
        var score = 0;
        for (var i = 0; i < tokens.length; i++) {
          var pos = entry.haystack.indexOf(tokens[i]);
          if (pos < 0) return null;
          score += pos;
          if (entry.label.toLowerCase().indexOf(tokens[i]) === 0) score -= 50;
        }
        return { entry: entry, score: score };
      })
      .filter(Boolean)
      .sort(function (a, b) { return a.score - b.score; })
      .slice(0, 8)
      .map(function (r) { return r.entry; });
  }

  function renderResults() {
    var list = els.consoleResults;
    if (!list) return;
    list.innerHTML = '';
    if (!results.length) {
      var q = els.consoleInput.value.trim();
      if (q) {
        var empty = document.createElement('li');
        empty.className = 'hud-console__empty';
        empty.setAttribute('role', 'presentation');
        empty.textContent = 'NO MATCH — try "skills", "sql", "cowork", "resume"';
        list.appendChild(empty);
        list.hidden = false;
        els.consoleInput.setAttribute('aria-expanded', 'true');
      } else {
        list.hidden = true;
        els.consoleInput.setAttribute('aria-expanded', 'false');
      }
      els.consoleInput.removeAttribute('aria-activedescendant');
      return;
    }
    results.forEach(function (entry, i) {
      var li = document.createElement('li');
      li.className = 'hud-console__result';
      li.id = 'hud-opt-' + i;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', i === selected ? 'true' : 'false');
      var kind = document.createElement('span');
      kind.className = 'hud-console__result-kind';
      kind.textContent = entry.kind;
      var label = document.createElement('span');
      label.className = 'hud-console__result-label';
      label.textContent = entry.label;
      var hint = document.createElement('span');
      hint.className = 'hud-console__result-hint';
      hint.textContent = entry.hint || '';
      li.appendChild(kind);
      li.appendChild(label);
      li.appendChild(hint);
      li.addEventListener('mousedown', function (e) { e.preventDefault(); });
      li.addEventListener('click', function () { runEntry(entry); });
      list.appendChild(li);
    });
    list.hidden = false;
    els.consoleInput.setAttribute('aria-expanded', 'true');
    if (selected >= 0) els.consoleInput.setAttribute('aria-activedescendant', 'hud-opt-' + selected);
    else els.consoleInput.removeAttribute('aria-activedescendant');
  }

  function closeResults() {
    results = [];
    selected = -1;
    renderResults();
  }

  function runEntry(entry) {
    els.consoleInput.value = '';
    closeResults();
    els.consoleInput.blur();
    body.classList.remove('hud-console-open');
    if (entry.reveal) {
      openPanel('work', { focus: false });
      requestAnimationFrame(function () {
        scrollPanelTo(panelByName('work'), entry.reveal, 'auto');
        setTimeout(function () { entry.run(); }, reduceMotion ? 0 : 140);
      });
      return;
    }
    entry.run();
  }

  function bindPalette() {
    if (!els.consoleInput) return;
    buildIndex();

    els.consoleInput.addEventListener('input', function () {
      results = match(els.consoleInput.value);
      selected = results.length ? 0 : -1;
      renderResults();
    });

    els.consoleInput.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' && results.length) {
        e.preventDefault();
        selected = (selected + 1) % results.length;
        renderResults();
      } else if (e.key === 'ArrowUp' && results.length) {
        e.preventDefault();
        selected = (selected - 1 + results.length) % results.length;
        renderResults();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (els.consoleInput.value) {
          els.consoleInput.value = '';
          closeResults();
        } else {
          els.consoleInput.blur();
          body.classList.remove('hud-console-open');
        }
      }
    });

    els.consoleForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!results.length) {
        results = match(els.consoleInput.value);
        selected = results.length ? 0 : -1;
      }
      if (results.length) runEntry(results[Math.max(0, selected)]);
      else renderResults();
    });

    els.consoleInput.addEventListener('blur', function () {
      setTimeout(function () {
        if (document.activeElement !== els.consoleInput) closeResults();
      }, 120);
    });

    if (els.paletteOpen) {
      els.paletteOpen.addEventListener('click', function () {
        var open = body.classList.toggle('hud-console-open');
        if (open) setTimeout(function () { els.consoleInput.focus(); }, 60);
      });
    }
  }

  // --------------------------------------------------------------------------
  // Global keyboard
  // --------------------------------------------------------------------------
  function bindKeyboard() {
    document.addEventListener('keydown', function (e) {
      var tag = (document.activeElement && document.activeElement.tagName) || '';
      var typing = tag === 'INPUT' || tag === 'TEXTAREA' || (document.activeElement && document.activeElement.isContentEditable);

      if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        if (isMobile()) body.classList.add('hud-console-open');
        els.consoleInput.focus();
        return;
      }

      if (e.key === 'Escape') {
        if (typing) return; // input handles its own Escape
        if (body.classList.contains('tour-active')) return; // SiteTour owns Escape
        if (body.classList.contains('hud-console-open')) {
          body.classList.remove('hud-console-open');
          return;
        }
        if (currentPanel) {
          e.preventDefault();
          closePanel();
        }
        return;
      }

      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !typing && !currentPanel) {
        var focused = document.activeElement;
        var all = $$('.hud-node');
        var i = all.indexOf(focused);
        if (i < 0) return;
        e.preventDefault();
        var next = all[(i + (e.key === 'ArrowRight' ? 1 : -1) + all.length) % all.length];
        next.focus();
      }
    });

    document.addEventListener('keydown', trapFocus);
  }

  // --------------------------------------------------------------------------
  // Scene bridge — three.js hologram (hud-scene.js) or the CSS orb fallback
  // --------------------------------------------------------------------------
  var sceneCtrl = null;

  function mountScene() {
    if (sceneCtrl) return;
    var ok = !!(window.THREE && window.HudScene && els.canvas && !reduceMotion && window.HudScene.supportsWebGL());
    if (!ok) {
      html.classList.add('hud-scene-fallback');
      return;
    }
    try {
      sceneCtrl = window.HudScene.mount(els.canvas);
      html.classList.remove('hud-scene-fallback');
    } catch (err) {
      html.classList.add('hud-scene-fallback');
      if (window.console) console.warn('[hud] scene failed, using CSS fallback', err);
    }
  }

  function bindScene() {
    window.addEventListener('hud:scene-ready', mountScene);
    if (window.HudScene) mountScene();

    document.addEventListener('visibilitychange', function () {
      if (!sceneCtrl) return;
      if (document.hidden) sceneCtrl.pause(); else sceneCtrl.resume();
    });

    var pending = false, px = 0, py = 0;
    document.addEventListener('pointermove', function (e) {
      if (!sceneCtrl || e.pointerType === 'touch') return;
      px = (e.clientX / window.innerWidth) * 2 - 1;
      py = (e.clientY / window.innerHeight) * 2 - 1;
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () {
        pending = false;
        sceneCtrl.setParallax(px, py);
      });
    }, { passive: true });
  }

  // --------------------------------------------------------------------------
  // Tour hook — SiteTour.place() calls this before positioning its spotlight
  // --------------------------------------------------------------------------
  window.hudRevealTarget = function (target) {
    if (!target) return;
    var panel = target.closest ? target.closest('.hud-panel') : null;
    if (!panel) {
      closePanel({ restoreFocus: false });
      return;
    }
    var name = panel.dataset.panel;
    if (currentPanel !== name) openPanel(name, { focus: false, updateHash: true });
    if (target !== panel) scrollPanelTo(panel, target, reduceMotion ? 'auto' : 'smooth');
  };

  // --------------------------------------------------------------------------
  // Init
  // --------------------------------------------------------------------------
  function init() {
    bindPanels();
    bindRouter();
    bindKeyboard();
    bindPalette();
    bindTourChip();
    startClock();
    startStream();
    bindScene();
    boot();
    if (initialHash.length > 1) {
      // Chrome keeps retrying its own scroll-to-fragment until the load event.
      // Route only after that so the panel has no box while it retries, then
      // restore the deep link (replaceState never triggers fragment scrolling).
      var routeInitial = function () {
        setTimeout(function () {
          route(initialHash, { focus: true });
          try { history.replaceState(null, '', location.pathname + location.search + initialHash); } catch (e) {}
        }, 40);
      };
      if (document.readyState === 'complete') routeInitial();
      else window.addEventListener('load', routeInitial, { once: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
