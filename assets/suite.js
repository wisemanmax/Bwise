/* ============================================================================
   Domain suites — shared behaviour.
   Long reference tables are paged instead of running for hundreds of rows.
   Progressive enhancement: with JavaScript off, every row is still there.
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
})();
