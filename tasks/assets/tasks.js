(function () {
  'use strict';

  var tasks = [];
  var searchTimer;
  var filters = {
    surface: document.getElementById('filter-surface'),
    role: document.getElementById('filter-role'),
    category: document.getElementById('filter-category'),
    harm: document.getElementById('filter-harm')
  };
  var elements = {
    groups: document.getElementById('task-groups'),
    loading: document.getElementById('task-loading'),
    empty: document.getElementById('task-empty'),
    count: document.getElementById('task-count'),
    clear: document.getElementById('clear-filters'),
    group: document.getElementById('group-by'),
    search: document.getElementById('filter-search')
  };

  function escapeHtml(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function addOptions(select, values) {
    values.forEach(function (value) {
      var option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });
  }

  function readUrl() {
    var params = new URLSearchParams(window.location.search);
    Object.keys(filters).forEach(function (key) { filters[key].value = params.get(key) || ''; });
    elements.search.value = params.get('q') || '';
    elements.group.value = params.get('by') || 'surface';
  }

  function writeUrl() {
    var params = new URLSearchParams();
    Object.keys(filters).forEach(function (key) {
      if (filters[key].value) params.set(key, filters[key].value);
    });
    if (elements.search.value) params.set('q', elements.search.value);
    if (elements.group.value !== 'surface') params.set('by', elements.group.value);
    history.replaceState(null, '', params.toString() ? '?' + params.toString() : window.location.pathname);
  }

  function hasFilters() {
    return elements.search.value || Object.keys(filters).some(function (key) { return filters[key].value; });
  }

  function matches(task) {
    if (filters.surface.value && task.surface !== filters.surface.value) return false;
    if (filters.role.value && task.role_label !== filters.role.value) return false;
    if (filters.category.value && task.category !== filters.category.value) return false;
    if (filters.harm.value && task.harm_type !== filters.harm.value) return false;
    var query = elements.search.value.trim().toLowerCase();
    if (!query) return true;
    return [task.title, task.prompt, task.criteria, task.sequence_title, task.surface,
      task.category, task.harm_type, task.role_label].join(' ').toLowerCase().indexOf(query) >= 0;
  }

  function taskRow(task) {
    var criteria = task.criteria ? task.criteria.split(/\n/)[0] : 'No criteria provided';
    return '<tr data-id="' + escapeHtml(task.id) + '">' +
      '<td><span class="trace-chip">' + escapeHtml(task.role_label) + '</span></td>' +
      '<td><div class="trace-title">' + escapeHtml(task.title) + '</div>' +
        '<div class="trace-subline">' + escapeHtml(task.task_id) + ' · ' + escapeHtml(task.category) + ' · ' + escapeHtml(task.harm_type) + '</div></td>' +
      '<td class="optional">' + escapeHtml(task.surface) + '</td>' +
      '<td class="optional"><div class="task-prompt-preview">' + escapeHtml(task.prompt) + '</div></td>' +
      '<td class="optional"><div class="task-criteria-preview">' + escapeHtml(criteria) + '</div></td></tr>';
  }

  function table(rows) {
    return '<div class="trace-table-wrap"><table class="trace-table task-table"><thead><tr>' +
      '<th>Role</th><th>Task</th><th class="optional">Surface</th><th class="optional">Prompt</th><th class="optional">Criteria</th>' +
      '</tr></thead><tbody>' + rows.map(taskRow).join('') + '</tbody></table></div>';
  }

  function render(rows) {
    var groupBy = elements.group.value;
    if (groupBy === 'none') {
      elements.groups.innerHTML = '<section class="trace-group"><div class="trace-group-body">' + table(rows) + '</div></section>';
      return;
    }
    var buckets = {};
    rows.forEach(function (task) {
      var key = task[groupBy];
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(task);
    });
    elements.groups.innerHTML = Object.keys(buckets).sort().map(function (key) {
      return '<section class="trace-group"><header class="trace-group-header">' +
        '<span class="trace-group-caret">▾</span><h2>' + escapeHtml(key) + '</h2>' +
        '<span class="trace-group-meta">' + buckets[key].length + ' tasks</span></header>' +
        '<div class="trace-group-body">' + table(buckets[key]) + '</div></section>';
    }).join('');
  }

  function apply() {
    var shown = tasks.filter(matches);
    elements.empty.classList.toggle('is-hidden', shown.length !== 0);
    elements.groups.classList.toggle('is-hidden', shown.length === 0);
    elements.count.textContent = shown.length === tasks.length ? tasks.length + ' tasks' : shown.length + ' of ' + tasks.length + ' tasks';
    elements.clear.classList.toggle('is-hidden', !hasFilters());
    if (shown.length) render(shown);
    writeUrl();
  }

  Object.keys(filters).forEach(function (key) { filters[key].addEventListener('change', apply); });
  elements.group.addEventListener('change', apply);
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
    if (row) window.location.href = 'task.html?id=' + encodeURIComponent(row.dataset.id);
  });

  fetch('data/index.json').then(function (response) {
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return response.json();
  }).then(function (data) {
    tasks = data.tasks;
    addOptions(filters.surface, data.surfaces);
    addOptions(filters.role, data.roles);
    addOptions(filters.category, data.categories);
    addOptions(filters.harm, data.harm_types);
    readUrl();
    elements.loading.classList.add('is-hidden');
    apply();
  }).catch(function (error) {
    elements.loading.textContent = 'Could not load the task catalog: ' + error.message;
  });
})();
