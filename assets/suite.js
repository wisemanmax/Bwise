/* ============================================================================
   Domain suites — shared behaviour.
   Long reference tables are paged and long card grids are collapsed, instead
   of running for thousands of pixels. Progressive enhancement: with
   JavaScript off, every row and card is still there.
   ============================================================================ */

(function () {
  'use strict';

  var PAGE_SIZE = 20;
  var MIN_ROWS = 31; // shorter tables are left alone

  Array.prototype.forEach.call(document.querySelectorAll('table'), function (table) {
    var body = table.tBodies[0];
    if (!body || body.rows.length < MIN_ROWS) return;

    var rows = Array.prototype.slice.call(body.rows);
    var pages = Math.ceil(rows.length / PAGE_SIZE);
    var page = 0;

    var tools = document.createElement('div');
    tools.className = 'table-tools table-tools--foot';
    tools.innerHTML =
      '<span class="table-count" aria-live="polite"></span>' +
      '<div class="table-pager">' +
        '<button type="button" data-page="prev">← Previous</button>' +
        '<span class="table-count" data-page-label></span>' +
        '<button type="button" data-page="next">Next →</button>' +
      '</div>';

    var count = tools.querySelector('.table-count');
    var label = tools.querySelector('[data-page-label]');
    var prev = tools.querySelector('[data-page="prev"]');
    var next = tools.querySelector('[data-page="next"]');

    function render() {
      var start = page * PAGE_SIZE;
      rows.forEach(function (row, i) { row.hidden = i < start || i >= start + PAGE_SIZE; });
      count.textContent = (start + 1) + '–' + Math.min(start + PAGE_SIZE, rows.length) + ' of ' + rows.length.toLocaleString('en-US');
      label.textContent = 'Page ' + (page + 1) + ' of ' + pages;
      prev.disabled = page === 0;
      next.disabled = page === pages - 1;
    }

    tools.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-page]');
      if (!btn || btn.disabled) return;
      page += btn.getAttribute('data-page') === 'next' ? 1 : -1;
      render();
    });

    // Put the controls after the table's scroll container when it has one
    var host = table.closest('.table-container') || table;
    host.parentNode.insertBefore(tools, host.nextSibling);
    render();
  });

  // --------------------------------------------------------------------------
  // Long card grids: show the first two rows' worth, with a toggle for the rest
  // --------------------------------------------------------------------------
  var GRID_PREVIEW = 8;
  var GRID_MIN = 16; // smaller grids are left alone

  Array.prototype.forEach.call(document.querySelectorAll('.grid'), function (grid) {
    var cards = Array.prototype.filter.call(grid.children, function (c) { return c.classList.contains('card'); });
    if (cards.length < GRID_MIN || cards.length !== grid.children.length) return;

    var extra = cards.slice(GRID_PREVIEW);
    var open = false;

    var tools = document.createElement('div');
    tools.className = 'table-tools table-tools--foot';
    tools.innerHTML = '<span class="table-count" aria-live="polite"></span>' +
      '<div class="table-pager"><button type="button" aria-expanded="false"></button></div>';
    var count = tools.querySelector('.table-count');
    var btn = tools.querySelector('button');

    function render() {
      extra.forEach(function (card) { card.hidden = !open; });
      count.textContent = 'Showing ' + (open ? cards.length : GRID_PREVIEW) + ' of ' + cards.length;
      btn.textContent = open ? 'Show fewer' : 'Show all ' + cards.length;
      btn.setAttribute('aria-expanded', String(open));
    }

    btn.addEventListener('click', function () {
      open = !open;
      render();
      if (!open) grid.scrollIntoView({ block: 'nearest' });
    });

    grid.parentNode.insertBefore(tools, grid.nextSibling);
    render();
  });
})();
