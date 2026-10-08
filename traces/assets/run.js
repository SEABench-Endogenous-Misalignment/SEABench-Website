(function () {
  'use strict';

  var API = window.SEATraces;
  var data = null;
  var view = 'turns';
  var params = new URLSearchParams(window.location.search);
  var traceId = params.get('id');
  var back = params.get('back');
  var elements = {
    back: document.getElementById('back-link'),
    task: document.getElementById('summary-task'),
    title: document.getElementById('summary-title'),
    model: document.getElementById('summary-model'),
    outcomes: document.getElementById('summary-outcomes'),
    stats: document.getElementById('summary-stats'),
    id: document.getElementById('summary-id'),
    count: document.getElementById('reasoning-count'),
    timeline: document.getElementById('reasoning-timeline'),
    taskPrompt: document.getElementById('task-prompt'),
    answer: document.getElementById('final-answer'),
    evaluation: document.getElementById('evaluation'),
    jump: document.getElementById('jump-to'),
    error: document.getElementById('run-error')
  };

  if (back) elements.back.href = 'index.html?' + back;

  function renderSummary() {
    var meta = data.meta;
    document.title = meta.task_id + ' · ' + meta.model + ' · SEABench';
    elements.task.textContent = meta.task_id + ' · ' + meta.category;
    elements.title.textContent = data.title;
    elements.model.textContent = meta.model;
    elements.outcomes.innerHTML = API.badge('Safety', data.safety_passed) +
      API.badge('Utility', meta.utility_passed);
    var rows = [
      ['Evolution surface', API.surfaceLabel(meta)],
      ['Harm type', meta.harm_type],
      ['Arm', meta.arm],
      ['Candidate', meta.selected_candidate],
      ['Attempt', meta.attempt && meta.n_attempts ? meta.attempt + ' of ' + meta.n_attempts : meta.attempt],
      ['Reasoning turns', data.turns.length],
      ['Reasoning units', data.units.length]
    ];
    elements.stats.innerHTML = rows.filter(function (row) {
      return row[1] !== null && row[1] !== undefined && row[1] !== '';
    }).map(function (row) {
      return '<dt>' + API.escapeHtml(row[0]) + '</dt><dd>' + API.escapeHtml(row[1]) + '</dd>';
    }).join('');
    elements.id.textContent = meta.id;
  }

  function reasoningItems() {
    if (view === 'units') {
      return data.units.map(function (unit, index) {
        return { number: index + 1, label: 'Unit ' + (unit.index + 1) + ' · turn ' + unit.turn, text: unit.text };
      });
    }
    return data.turns.map(function (turn, index) {
      return { number: index + 1, label: 'Turn ' + turn.turn, text: turn.reasoning };
    });
  }

  function renderReasoning() {
    var items = reasoningItems();
    elements.count.textContent = items.length + ' reasoning ' + (view === 'units' ? 'units' : 'turns');
    if (!items.length) {
      elements.timeline.innerHTML = '<div class="trace-empty" style="grid-column:1/-1">' +
        'Reasoning trace unavailable. The final answer and evaluator outcomes are still available.</div>';
      return;
    }
    elements.timeline.innerHTML = items.map(function (item) {
      return '<div class="reasoning-row"><div class="reasoning-gutter">#' + item.number + '</div>' +
        '<div class="reasoning-body"><article id="reasoning-' + item.number + '" class="reasoning-card">' +
        '<div class="reasoning-label">' + API.escapeHtml(item.label) + '</div>' +
        '<div class="run-prose">' + API.markdown(item.text) + '</div></article></div></div>';
    }).join('');
  }

  function renderTask() {
    elements.taskPrompt.innerHTML = API.markdown(data.task_prompt);
    elements.answer.innerHTML = API.markdown(data.answer);
  }

  function renderEvaluation() {
    var scores = Object.keys(data.safety_scores).map(function (criterion) {
      return '<span class="score-chip">' + API.escapeHtml(criterion) + ': ' +
        API.escapeHtml(data.safety_scores[criterion]) + '</span>';
    }).join('');
    elements.evaluation.innerHTML = '<div class="evaluation-overview">' +
      '<section class="evaluation-card"><div class="run-kicker">Safety outcome</div><h2>' +
      (data.safety_passed ? 'Passed' : 'Failed') + '</h2><p class="trace-muted">Mean score: ' +
      API.escapeHtml(data.safety_mean_score === null ? '—' : data.safety_mean_score) + '</p>' +
      '<div class="score-grid">' + scores + '</div></section>' +
      '<section class="evaluation-card"><div class="run-kicker">Utility outcome</div><h2>' +
      (data.meta.utility_passed ? 'Passed' : 'Failed') + '</h2><p class="trace-muted">Task completion judgment from the safety-test evaluation.</p></section>' +
      '</div><h2 class="run-section-title">Safety evaluator feedback</h2>' +
      '<div class="evaluation-card run-prose feedback-block">' + API.escapeHtml(data.safety_feedback) + '</div>';
  }

  document.querySelectorAll('.run-tab').forEach(function (button) {
    button.addEventListener('click', function () {
      document.querySelectorAll('.run-tab').forEach(function (tab) { tab.classList.toggle('is-active', tab === button); });
      document.querySelectorAll('.run-section').forEach(function (section) {
        section.classList.toggle('is-active', section.id === 'tab-' + button.dataset.tab);
      });
    });
  });

  function setView(next) {
    view = next;
    document.getElementById('view-turns').classList.toggle('is-active', next === 'turns');
    document.getElementById('view-units').classList.toggle('is-active', next === 'units');
    renderReasoning();
  }

  document.getElementById('view-turns').addEventListener('click', function () { setView('turns'); });
  document.getElementById('view-units').addEventListener('click', function () { setView('units'); });
  elements.jump.addEventListener('change', function () {
    var target = document.getElementById('reasoning-' + parseInt(elements.jump.value, 10));
    if (!target) return;
    target.scrollIntoView({ block: 'center' });
    target.classList.remove('is-flashing');
    void target.offsetWidth;
    target.classList.add('is-flashing');
  });

  if (!traceId || !/^[a-z0-9-]+(?:--[a-z0-9-]+)+$/.test(traceId)) {
    elements.error.textContent = 'No valid trace ID was provided.';
    elements.error.classList.remove('is-hidden');
    return;
  }

  API.fetchJson('data/runs/' + encodeURIComponent(traceId) + '.json').then(function (payload) {
    data = payload;
    renderSummary();
    renderReasoning();
    renderTask();
    renderEvaluation();
  }).catch(function (error) {
    elements.error.textContent = 'Could not load this trace: ' + error.message;
    elements.error.classList.remove('is-hidden');
  });
})();
