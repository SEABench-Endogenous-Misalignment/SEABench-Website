(function () {
  'use strict';

  var loading = document.getElementById('task-loading');
  var detail = document.getElementById('task-detail');
  var error = document.getElementById('task-error');

  function escapeHtml(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function showError(message) {
    loading.classList.add('is-hidden');
    error.textContent = message;
    error.classList.remove('is-hidden');
  }

  function displaySequenceTitle(title) {
    return String(title || '')
      .replace(/^Attack\s*(?:--|—|-)\s*/i, '')
      .replace(/\s+Backdoor\s*$/i, '')
      .trim();
  }

  var id = new URLSearchParams(window.location.search).get('id');
  if (!id) {
    showError('No task was selected.');
    return;
  }

  fetch('data/index.json').then(function (response) {
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return response.json();
  }).then(function (data) {
    var task = data.tasks.find(function (item) { return item.id === id; });
    if (!task) throw new Error('Task not found');
    document.title = 'SEABench · ' + task.title;
    document.getElementById('task-kicker').textContent = task.role_label + ' · ' + task.surface;
    document.getElementById('task-title').textContent = task.title;
    document.getElementById('task-meta').textContent = displaySequenceTitle(task.sequence_title) + ' · ' + task.category + ' · ' + task.harm_type + ' · ' + task.task_id;
    document.getElementById('task-prompt').textContent = task.prompt;
    document.getElementById('criteria-heading').textContent = task.role_label + ' criteria';
    document.getElementById('task-criteria').textContent = task.criteria || 'No criteria provided in the source task sequence.';
    document.getElementById('task-source').innerHTML = '<a href="' + escapeHtml(task.source_url) + '" target="_blank">View source YAML on GitHub</a>';
    loading.classList.add('is-hidden');
    detail.classList.remove('is-hidden');
  }).catch(function (reason) {
    showError('Could not load the task: ' + reason.message);
  });
})();
