(function () {
  'use strict';

  function escapeHtml(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function markdown(source) {
    var text = escapeHtml(source || '');
    var blocks = [];
    text = text.replace(/```[^\n]*\n([\s\S]*?)```/g, function (_, body) {
      blocks.push('<pre><code>' + body.replace(/\n$/, '') + '</code></pre>');
      return '\u0000' + (blocks.length - 1) + '\u0000';
    });
    text = text.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    text = text.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    var html = text.split(/\n{2,}/).map(function (paragraph) {
      var clean = paragraph.trim();
      if (/^\u0000\d+\u0000$/.test(clean)) return clean;
      var heading = clean.match(/^(#{1,6})\s+(.*)$/);
      if (heading) {
        var level = Math.min(heading[1].length + 2, 6);
        return '<h' + level + '>' + heading[2] + '</h' + level + '>';
      }
      var lines = clean.split('\n');
      if (lines.length && lines.every(function (line) { return /^\s*[-*]\s+/.test(line); })) {
        return '<ul>' + lines.map(function (line) {
          return '<li>' + line.replace(/^\s*[-*]\s+/, '') + '</li>';
        }).join('') + '</ul>';
      }
      if (lines.length && lines.every(function (line) { return /^\s*\d+[.)]\s+/.test(line); })) {
        return '<ol>' + lines.map(function (line) {
          return '<li>' + line.replace(/^\s*\d+[.)]\s+/, '') + '</li>';
        }).join('') + '</ol>';
      }
      return clean ? '<p>' + lines.join('<br>') + '</p>' : '';
    }).join('');
    return html.replace(/\u0000(\d+)\u0000/g, function (_, index) { return blocks[index]; });
  }

  function badge(label, passed) {
    return '<span class="outcome-badge ' + (passed ? 'outcome-pass' : 'outcome-fail') + '">' +
      escapeHtml(label) + ' ' + (passed ? 'passed' : 'failed') + '</span>';
  }

  function surfaceLabel(meta) {
    return meta.surface === 'none'
      ? 'none · ' + meta.comparison_context + ' comparison'
      : meta.surface === 'STM' ? 'memory'
      : meta.surface;
  }

  function surfaceGroupLabel(surface) {
    return surface === 'STM' ? 'memory' : surface;
  }

  function fetchJson(path) {
    return fetch(path).then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    });
  }

  window.SEATraces = {
    badge: badge,
    escapeHtml: escapeHtml,
    fetchJson: fetchJson,
    markdown: markdown,
    surfaceLabel: surfaceLabel,
    surfaceGroupLabel: surfaceGroupLabel
  };
})();
