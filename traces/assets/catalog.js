(function () {
  'use strict';

  var API = window.SEATraces;
  var runs = [];
  var searchTimer;
  var elements = {
    groups: document.getElementById('trace-groups'),
    loading: document.getElementById('trace-loading'),
    empty: document.getElementById('trace-empty'),
    count: document.getElementById('trace-count'),
    clear: document.getElementById('clear-filters'),
    group: document.getElementById('group-by'),
    sort: document.getElementById('sort-by'),
    search: document.getElementById('filter-search')
  };
  var filters = {
    model: document.getElementById('filter-model'),
    safety: document.getElementById('filter-safety'),
    utility: document.getElementById('filter-utility'),
    surface: document.getElementById('filter-surface'),
    category: document.getElementById('filter-category'),
    harm: document.getElementById('filter-harm')
  };

  function addOptions(select, values, displayValue) {
    values.forEach(function (value) {
      var option = document.createElement('option');
      option.value = value;
      option.textContent = displayValue ? displayValue(value) : value;
      select.appendChild(option);
    });
  }

  function readUrl() {
    var params = new URLSearchParams(window.location.search);
    Object.keys(filters).forEach(function (key) { filters[key].value = params.get(key) || ''; });
    elements.search.value = params.get('q') || '';
    elements.group.value = params.get('by') || 'category';
    elements.sort.value = params.get('sort') || 'safety';
  }

  function writeUrl() {
    var params = new URLSearchParams();
    Object.keys(filters).forEach(function (key) {
      if (filters[key].value) params.set(key, filters[key].value);
    });
    if (elements.search.value) params.set('q', elements.search.value);
    if (elements.group.value !== 'category') params.set('by', elements.group.value);
    if (elements.sort.value !== 'safety') params.set('sort', elements.sort.value);
    var query = params.toString();
    history.replaceState(null, '', query ? '?' + query : window.location.pathname);
  }

  function hasFilters() {
    return elements.search.value || Object.keys(filters).some(function (key) { return filters[key].value; });
  }

  function matches(run) {
    if (filters.model.value && run.model !== filters.model.value) return false;
    if (filters.surface.value && run.surface !== filters.surface.value) return false;
    if (filters.category.value && run.category !== filters.category.value) return false;
    if (filters.harm.value && run.harm_type !== filters.harm.value) return false;
    if (filters.safety.value && run.safety_passed !== (filters.safety.value === 'passed')) return false;
    if (filters.utility.value && run.utility_passed !== (filters.utility.value === 'passed')) return false;
    var query = elements.search.value.trim().toLowerCase();
    if (!query) return true;
    return [run.title, run.task_id, run.model, run.surface, run.comparison_context,
      run.category, run.harm_type, run.selected_candidate].join(' ').toLowerCase().indexOf(query) >= 0;
  }

  var sorters = {
    safety: function (a, b) { return Number(a.safety_passed) - Number(b.safety_passed) || a.task_id.localeCompare(b.task_id); },
    utility: function (a, b) { return Number(a.utility_passed) - Number(b.utility_passed) || a.task_id.localeCompare(b.task_id); },
    task: function (a, b) { return a.task_id.localeCompare(b.task_id) || a.title.localeCompare(b.title); },
    'turns-desc': function (a, b) { return b.reasoning_turns - a.reasoning_turns; },
    'turns-asc': function (a, b) { return a.reasoning_turns - b.reasoning_turns; }
  };

  function runRow(run) {
    var noReasoning = run.has_reasoning ? '' : '<span class="trace-chip">no reasoning</span>';
    return '<tr data-id="' + API.escapeHtml(run.id) + '">' +
      '<td>' + API.badge('Safety', run.safety_passed) + '</td>' +
      '<td>' + API.badge('Utility', run.utility_passed) + '</td>' +
      '<td><div class="trace-title">' + API.escapeHtml(run.title) + '</div>' +
        '<div class="trace-subline">' + API.escapeHtml(run.task_id) + ' · ' +
        API.escapeHtml(run.harm_type) + noReasoning + '</div></td>' +
      '<td class="optional">' + API.escapeHtml(run.model) + '</td>' +
      '<td class="optional">' + API.escapeHtml(API.surfaceLabel(run)) + '</td>' +
      '<td class="is-number optional">' + run.reasoning_turns + '</td></tr>';
  }

  function table(rows) {
    return '<div class="trace-table-wrap"><table class="trace-table"><thead><tr>' +
      '<th>Safety</th><th>Utility</th><th>Task</th><th class="optional">Model</th>' +
      '<th class="optional">Evolution surface</th><th class="optional is-number">Turns</th>' +
      '</tr></thead><tbody>' + rows.map(runRow).join('') + '</tbody></table></div>';
  }

  function render(rows) {
    var groupBy = elements.group.value;
    var sorter = sorters[elements.sort.value] || sorters.safety;
    if (groupBy === 'none') {
      elements.groups.innerHTML = '<section class="trace-group"><div class="trace-group-body">' +
        table(rows.slice().sort(sorter)) + '</div></section>';
      return;
    }
    var buckets = {};
    rows.forEach(function (run) {
      var key = run[groupBy];
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(run);
    });
    elements.groups.innerHTML = Object.keys(buckets).sort().map(function (key) {
      var bucket = buckets[key].slice().sort(sorter);
      var unsafe = bucket.filter(function (run) { return !run.safety_passed; }).length;
      return '<section class="trace-group"><header class="trace-group-header">' +
        '<span class="trace-group-caret">▾</span><h2>' + API.escapeHtml(groupBy === 'surface' ? API.surfaceGroupLabel(key) : key) + '</h2>' +
        '<span class="trace-group-meta">' + bucket.length + ' traces · ' + unsafe +
        ' safety failures</span></header><div class="trace-group-body">' + table(bucket) + '</div></section>';
    }).join('');
  }

  function apply() {
    var shown = runs.filter(matches);
    elements.empty.classList.toggle('is-hidden', shown.length !== 0);
    elements.groups.classList.toggle('is-hidden', shown.length === 0);
    elements.count.textContent = shown.length === runs.length ? runs.length + ' traces' :
      shown.length + ' of ' + runs.length + ' traces';
    elements.clear.classList.toggle('is-hidden', !hasFilters());
    if (shown.length) render(shown);
    writeUrl();
  }

  Object.keys(filters).forEach(function (key) { filters[key].addEventListener('change', apply); });
  elements.group.addEventListener('change', apply);
  elements.sort.addEventListener('change', apply);
  elements.search.addEventListener('input', function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(apply, 120);
  });
  elements.clear.addEventListener('click', function () {
    Object.keys(filters).forEach(function (key) { filters[key].value = ''; });
    elements.search.value = '';
    apply();
  });
  elements.groups.addEventListener('click', function (event) {
    var header = event.target.closest('.trace-group-header');
    if (header) {
      header.parentElement.toggleAttribute('data-collapsed');
      return;
    }
    var row = event.target.closest('tr[data-id]');
    if (row) {
      window.location.href = 'run.html?id=' + encodeURIComponent(row.dataset.id) +
        '&back=' + encodeURIComponent(window.location.search.slice(1));
    }
  });

  API.fetchJson('data/index.json').then(function (data) {
    runs = data.runs;
    addOptions(filters.model, data.models);
    addOptions(filters.surface, data.surfaces, function (value) {
      return API.surfaceGroupLabel(value);
    });
    addOptions(filters.category, data.categories);
    addOptions(filters.harm, data.harm_types);
    readUrl();
    elements.loading.classList.add('is-hidden');
    apply();
  }).catch(function (error) {
    elements.loading.textContent = 'Could not load the trace index: ' + error.message;
  });
})();
