/* ============================================================================
   Education suite — shared page behaviour.
   Each Education page names its area with data-edu-area on <main>. This file
   builds that area's sample records, then renders the summary strip, the
   three side lists and a filterable, paged ledger. One copy for all nine
   pages.
   ============================================================================ */

(function () {
  'use strict';

  // --------------------------------------------------------------------------
  // Seeded sample data. Every Education page shows records for its own area,
  // generated here from one vocabulary so the nine pages stay consistent with
  // each other. The generator is deterministic: the same page always shows
  // the same records.
  // --------------------------------------------------------------------------
  var TOPICS = [
    'FDCPA Foundations', 'Mini-Miranda & Call Openings', 'Reg Z Disclosures', 'SCRA Protections',
    'UDAAP Awareness', 'GLBA & Customer Privacy', 'FCRA Disputes', 'TCPA Contact Rules',
    'Hardship & Forbearance Options', 'Payment Plan Setup', 'Loss Mitigation Waterfall', 'Skip-Trace Standards',
    'Bankruptcy Handling', 'Deceased Account Handling', 'Complaint Escalation', 'Fraud Red Flags',
    'Identity Verification', 'Call Quality Standards', 'De-escalation Skills', 'Promise-to-Pay Coaching',
    'Cosigner Release', 'Autopay & ACH Rules', 'Credit Reporting Basics', 'Reg E Error Resolution',
    'Fair Lending Overview', 'Third-Party Authorization', 'Military Borrower Benefits', 'Dialer Compliance',
    'Email & SMS Consent', 'Account Notes Standards'
  ];
  var PROGRAMS = ['Collections New Hire', 'Servicing New Hire', 'Fraud Academy', 'Team Lead Development', 'Annual Compliance', 'Quality Coaching'];
  var SITES = ['Wilmington', 'Newark', 'Indianapolis', 'Salt Lake City', 'Remote'];
  var TEAMS = ['L&D Operations', 'Compliance Training', 'Collections Enablement', 'Servicing Enablement', 'Quality & Coaching', 'Fraud Academy'];

  // name(i, pick) returns one record name; `label` heads the first column.
  var AREAS = {
    overview: { seed: 11, count: 1248, label: 'Assignment', weights: [58, 27, 15], name: function (i, pick) {
      var kind = pick(['Module', 'Quiz', 'Certification test', 'Coaching session', 'Job aid review']);
      return pick(PROGRAMS) + ' · ' + pick(TOPICS) + ' · ' + kind + ' · 2026-Q' + (1 + i % 4);
    } },
    'content-studio': { seed: 23, count: 386, label: 'Content item', weights: [44, 31, 25], name: function (i, pick) {
      return pick(TOPICS) + ': ' + pick(['Video lesson', 'Interactive scenario', 'Job aid', 'Facilitator guide', 'Slide deck', 'Call recording review']) + ' v' + (1 + i % 4);
    } },
    library: { seed: 37, count: 540, label: 'Resource', weights: [72, 18, 10], name: function (i, pick) {
      return pick(TOPICS) + ' — ' + pick(['Quick reference', 'Policy summary', 'Procedure', 'Call script', 'FAQ', 'Checklist']) + ' for ' + pick(['agents', 'team leads', 'QA reviewers', 'new hires', 'compliance']);
    } },
    modules: { seed: 41, count: 164, label: 'Module', weights: [61, 24, 15], name: function (i, pick) {
      return 'Module ' + String(100 + i) + ' · ' + pick(TOPICS);
    } },
    quizzes: { seed: 53, count: 428, label: 'Quiz', weights: [55, 28, 17], name: function (i, pick) {
      return pick(TOPICS) + ' — ' + pick(['Knowledge check', 'Scenario quiz', 'Call-listening quiz', 'Refresher quiz']) + ' ' + (1 + i % 6);
    } },
    tests: { seed: 67, count: 96, label: 'Test', weights: [50, 30, 20], name: function (i, pick) {
      return pick(PROGRAMS) + ' Certification — ' + pick(['Final exam', 'Mid-program exam', 'Recertification exam', 'Practical assessment', 'Skills validation', 'Compliance attestation']) + ', Form ' + 'ABCD'.charAt(i % 4);
    } },
    cohorts: { seed: 71, count: 72, label: 'Cohort', weights: [46, 34, 20], name: function (i, pick) {
      return pick(PROGRAMS) + ' · 2026-Q' + (1 + i % 4) + ' · ' + pick(SITES) + ' ' + 'ABC'.charAt(i % 3);
    } },
    analytics: { seed: 83, count: 240, label: 'Report', weights: [66, 22, 12], name: function (i, pick) {
      return pick(['Completion rate', 'Assessment pass rate', 'Time to proficiency', 'Quiz item analysis', 'Engagement minutes', 'Certification status']) + ' — ' + pick(PROGRAMS) + ', week ' + (1 + i % 52);
    } },
    settings: { seed: 97, count: 36, label: 'Setting', weights: [70, 18, 12], name: function (i, pick) {
      return pick(['Passing score', 'Retake limit', 'Due-date reminder', 'Enrollment rule', 'SSO group mapping', 'Completion certificate', 'Content review cycle', 'Manager notification', 'Attempt time limit', 'Archive policy']) + ' — ' + pick(PROGRAMS);
    } }
  };

  // Small seeded generator (mulberry32) so the sample is stable between visits
  function prng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function buildData(area) {
    var rand = prng(area.seed);
    var pick = function (list) { return list[Math.floor(rand() * list.length)]; };
    var between = function (lo, hi) { return lo + Math.floor(rand() * (hi - lo + 1)); };
    var base = Date.UTC(2026, 10, 10); // fixed, so the dates never drift
    var seen = {};
    var out = [];
    for (var i = 1; i <= area.count; i++) {
      // Re-roll a few times so two records rarely share a name
      var name = area.name(i, pick);
      for (var tries = 1; seen[name] && tries < 16; tries++) name = area.name(i + tries * 7, pick);
      seen[name] = true;
      var roll = rand() * 100;
      var status = roll < area.weights[0] ? 'live' : roll < area.weights[0] + area.weights[1] ? 'review' : 'draft';
      var due = new Date(base + between(status === 'live' ? 20 : 2, status === 'draft' ? 75 : 150) * 86400000);
      out.push({
        id: i,
        name: name,
        owner: pick(TEAMS),
        status: status,
        score: status === 'live' ? between(74, 98) : status === 'review' ? between(62, 92) : between(48, 84),
        progress: status === 'live' ? 100 : status === 'review' ? between(70, 95) : between(10, 65),
        due: due.toISOString().slice(0, 10)
      });
    }
    return out.sort(function (a, b) { return a.due < b.due ? -1 : a.due > b.due ? 1 : a.id - b.id; });
  }

  var main = document.querySelector('[data-edu-area]');
  var area = main && AREAS[main.getAttribute('data-edu-area')];
  if (!area) return;
  var data = buildData(area);

  var PAGE_SIZE = 25;
  var STATUSES = [
    { key: 'all', label: 'All' },
    { key: 'live', label: 'Live' },
    { key: 'review', label: 'In review' },
    { key: 'draft', label: 'Draft' }
  ];
  var BADGE = { live: 'success', review: 'warning', draft: 'info' };

  function el(id) { return document.getElementById(id); }
  function esc(value) {
    return String(value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function badge(status) {
    var label = status === 'review' ? 'In review' : status.charAt(0).toUpperCase() + status.slice(1);
    return '<span class="badge ' + (BADGE[status] || 'info') + '">' + esc(label) + '</span>';
  }
  function count(status) {
    return data.filter(function (d) { return d.status === status; }).length;
  }
  function average(key) {
    if (!data.length) return 0;
    return Math.round(data.reduce(function (sum, d) { return sum + d[key]; }, 0) / data.length);
  }

  // --- Summary strip: computed from the records, never hard-coded -----------
  var kpis = el('edu-kpis');
  if (kpis) {
    var tiles = [
      ['Records', data.length.toLocaleString('en-US'), ''],
      ['Live', count('live').toLocaleString('en-US'), ''],
      ['In review', count('review').toLocaleString('en-US'), ''],
      ['Draft', count('draft').toLocaleString('en-US'), ''],
      ['Average score', average('score'), '%'],
      ['Average progress', average('progress'), '%']
    ];
    kpis.innerHTML = tiles.map(function (t) {
      return '<div class="edu-kpi"><dt>' + t[0] + '</dt><dd>' + t[1] + (t[2] ? '<small>' + t[2] + '</small>' : '') + '</dd></div>';
    }).join('');
  }

  // --- Side lists -------------------------------------------------------------
  function renderList(target, items) {
    if (!target) return;
    target.innerHTML = items.map(function (item) {
      return '<li class="data-row"><span>' + esc(item.name) + '</span>' + badge(item.status) + '</li>';
    }).join('');
  }
  renderList(el('snapshot-list'), data.slice(0, 8)); // soonest due
  renderList(el('queue-list'), data.filter(function (d) { return d.status === 'review'; }).slice(0, 8));
  renderList(el('risk-list'), data.slice().sort(function (x, y) { return x.score - y.score; }).slice(0, 8)); // lowest scores

  // --- Ledger: status filter + pages -------------------------------------------
  var table = el('ledger-table');
  var filters = el('edu-filters');
  var pager = el('table-pager');
  var counter = el('table-count');
  if (!table) return;

  var state = { status: 'all', page: 0 };

  function rows() {
    return state.status === 'all' ? data : data.filter(function (d) { return d.status === state.status; });
  }

  function renderLedger() {
    var all = rows();
    var pages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
    state.page = Math.min(state.page, pages - 1);
    var start = state.page * PAGE_SIZE;
    var slice = all.slice(start, start + PAGE_SIZE);

    table.innerHTML =
      '<thead><tr><th scope="col">' + area.label + '</th><th scope="col">Owner</th><th scope="col">Status</th>' +
      '<th scope="col">Score</th><th scope="col">Progress</th><th scope="col">Due</th></tr></thead><tbody>' +
      slice.map(function (item) {
        return '<tr><td>' + esc(item.name) + '</td><td>' + esc(item.owner) + '</td><td>' + badge(item.status) + '</td>' +
          '<td>' + esc(item.score) + '%</td>' +
          '<td><div class="progress" role="img" aria-label="' + esc(item.progress) + '% complete"><span style="width: ' + Number(item.progress) + '%"></span></div></td>' +
          '<td>' + esc(item.due) + '</td></tr>';
      }).join('') + '</tbody>';

    if (counter) {
      counter.textContent = all.length
        ? (start + 1).toLocaleString('en-US') + '–' + (start + slice.length).toLocaleString('en-US') + ' of ' + all.length.toLocaleString('en-US')
        : 'No records';
    }
    if (pager) {
      pager.querySelector('[data-page="prev"]').disabled = state.page === 0;
      pager.querySelector('[data-page="next"]').disabled = state.page >= pages - 1;
      pager.querySelector('[data-page-label]').textContent = 'Page ' + (state.page + 1) + ' of ' + pages;
    }
  }

  if (filters) {
    filters.innerHTML = STATUSES.map(function (s) {
      var n = s.key === 'all' ? data.length : count(s.key);
      return '<button type="button" class="chip' + (s.key === 'all' ? ' active' : '') + '" data-status="' + s.key + '" aria-pressed="' + (s.key === 'all') + '">' +
        s.label + ' · ' + n.toLocaleString('en-US') + '</button>';
    }).join('');
    filters.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-status]');
      if (!btn) return;
      state.status = btn.getAttribute('data-status');
      state.page = 0;
      Array.prototype.forEach.call(filters.querySelectorAll('[data-status]'), function (b) {
        var on = b === btn;
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', String(on));
      });
      renderLedger();
    });
  }

  if (pager) {
    pager.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-page]');
      if (!btn || btn.disabled) return;
      state.page += btn.getAttribute('data-page') === 'next' ? 1 : -1;
      renderLedger();
    });
  }

  renderLedger();
})();
