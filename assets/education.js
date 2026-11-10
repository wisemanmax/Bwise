/* ============================================================================
   Education suite — shared page behaviour.
   Each Education page defines `data` (its seeded records) inline; this file
   renders the summary strip, the three side lists and a filterable, paged
   ledger from it. One copy for all nine pages.
   ============================================================================ */

(function () {
  'use strict';

  /* global data */
  if (typeof data === 'undefined' || !Array.isArray(data)) return;

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
  renderList(el('snapshot-list'), data.slice(0, 8));
  renderList(el('queue-list'), data.slice(8, 16));
  renderList(el('risk-list'), data.slice(16, 24));

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
      '<thead><tr><th scope="col">Assignment</th><th scope="col">Owner</th><th scope="col">Status</th>' +
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
