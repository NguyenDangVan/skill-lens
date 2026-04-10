import { fetchApi } from '../app.js';
import { createChart, getColor, formatNumber } from '../components/chart-helpers.js';

let metricsChart = null;
let timelineChart = null;

export async function renderAbTests(container) {
  const data = await fetchApi('/api/ab-tests');
  const { tests } = data;

  if (!tests.length) {
    container.innerHTML = `
      <div class="empty-state">
        <h2>No A/B Tests</h2>
        <p>Create A/B tests to see them visualized here.</p>
      </div>`;
    return;
  }

  container.innerHTML = `
    <div class="ab-test-list" id="ab-list"></div>
    <div class="chart-grid" id="ab-detail" style="display:none">
      <div class="chart-card">
        <h3 id="ab-metrics-title">Version Comparison</h3>
        <div style="height:300px"><canvas id="chart-ab-metrics"></canvas></div>
      </div>
      <div class="chart-card">
        <h3>Cumulative Runs Over Time</h3>
        <div style="height:300px"><canvas id="chart-ab-timeline"></canvas></div>
      </div>
      <div class="chart-card full-width">
        <h3>Results Summary</h3>
        <div id="ab-results-table"></div>
      </div>
    </div>
  `;

  renderTestList(tests);
  loadTestDetail(tests[0].id);
}

function renderTestList(tests) {
  const el = document.getElementById('ab-list');
  el.innerHTML = tests.map(t => {
    const progress = t.target_runs > 0
      ? Math.min(100, Math.round((t.completed_runs / t.target_runs) * 100))
      : 0;
    return `
      <div class="ab-test-card" data-id="${t.id}">
        <div class="ab-header">
          <h4>${t.skill}: ${t.version_a} vs ${t.version_b}</h4>
          <span class="badge ${t.status}">${t.status}</span>
        </div>
        <div class="ab-meta">
          ${t.completed_runs}${t.target_runs ? ' / ' + t.target_runs : ''} runs
        </div>
        <div class="progress-bar">
          <div class="fill" style="width:${progress}%"></div>
        </div>
      </div>
    `;
  }).join('');

  el.querySelectorAll('.ab-test-card').forEach(card => {
    card.addEventListener('click', () => {
      el.querySelectorAll('.ab-test-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      loadTestDetail(card.dataset.id);
    });
  });
}

async function loadTestDetail(testId) {
  try {
    const data = await fetchApi(`/api/ab-tests/${encodeURIComponent(testId)}`);
    const { test_info, metrics_a, metrics_b, timeline } = data;

    document.getElementById('ab-detail').style.display = '';

    if (metricsChart) { metricsChart.destroy(); metricsChart = null; }
    if (timelineChart) { timelineChart.destroy(); timelineChart = null; }

    document.getElementById('ab-metrics-title').textContent =
      `${test_info.version_a} vs ${test_info.version_b}`;

    // Grouped bar: metrics comparison
    const metricLabels = ['Satisfaction %', 'Avg Tokens', 'Correction %', 'Avg Duration (ms)'];
    const aValues = [metrics_a.satisfaction || 0, metrics_a.avg_tokens, metrics_a.correction_rate || 0, metrics_a.avg_duration];
    const bValues = [metrics_b.satisfaction || 0, metrics_b.avg_tokens, metrics_b.correction_rate || 0, metrics_b.avg_duration];

    metricsChart = createChart(document.getElementById('chart-ab-metrics'), {
      type: 'bar',
      data: {
        labels: metricLabels,
        datasets: [
          {
            label: test_info.version_a,
            data: aValues,
            backgroundColor: getColor(0),
            borderRadius: 4,
          },
          {
            label: test_info.version_b,
            data: bValues,
            backgroundColor: getColor(1),
            borderRadius: 4,
          },
        ],
      },
      options: {
        scales: { x: {}, y: { beginAtZero: true } },
      },
    });

    // Line chart: cumulative runs
    const dates = [...new Set(timeline.map(r => r.date))].sort();
    const versions = [test_info.version_a, test_info.version_b];
    const cumDatasets = versions.map((v, i) => {
      let cum = 0;
      const points = dates.map(d => {
        const row = timeline.find(r => r.date === d && r.version === v);
        cum += row ? row.count : 0;
        return cum;
      });
      return {
        label: v,
        data: points,
        borderColor: getColor(i),
        backgroundColor: 'transparent',
        tension: 0.3,
      };
    });

    timelineChart = createChart(document.getElementById('chart-ab-timeline'), {
      type: 'line',
      data: { labels: dates, datasets: cumDatasets },
      options: {
        scales: { x: {}, y: { beginAtZero: true } },
      },
    });

    // Results table
    renderResultsTable(test_info, metrics_a, metrics_b);

  } catch (err) {
    console.error('Failed to load A/B test detail:', err);
  }
}

function renderResultsTable(info, a, b) {
  const rows = [
    { metric: 'Total Runs', a: a.total, b: b.total, higher: 'neutral' },
    { metric: 'Satisfaction', a: fmtPct(a.satisfaction), b: fmtPct(b.satisfaction), winner: pickWinner(a.satisfaction, b.satisfaction, 'higher') },
    { metric: 'Avg Tokens', a: formatNumber(a.avg_tokens), b: formatNumber(b.avg_tokens), winner: pickWinner(a.avg_tokens, b.avg_tokens, 'lower') },
    { metric: 'Correction Rate', a: fmtPct(a.correction_rate), b: fmtPct(b.correction_rate), winner: pickWinner(a.correction_rate, b.correction_rate, 'lower') },
    { metric: 'Avg Duration', a: a.avg_duration + 'ms', b: b.avg_duration + 'ms', winner: pickWinner(a.avg_duration, b.avg_duration, 'lower') },
  ];

  document.getElementById('ab-results-table').innerHTML = `
    <table class="results-table">
      <thead>
        <tr>
          <th>Metric</th>
          <th>${info.version_a}</th>
          <th>${info.version_b}</th>
          <th>Winner</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => `
          <tr>
            <td>${r.metric}</td>
            <td class="${r.winner === 'a' ? 'winner' : ''}">${r.a}</td>
            <td class="${r.winner === 'b' ? 'winner' : ''}">${r.b}</td>
            <td class="winner">${r.winner === 'a' ? info.version_a : r.winner === 'b' ? info.version_b : '-'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function fmtPct(v) { return v != null ? v + '%' : '-'; }

function pickWinner(a, b, direction) {
  if (a == null || b == null) return 'neutral';
  if (a === b) return 'neutral';
  if (direction === 'higher') return a > b ? 'a' : 'b';
  return a < b ? 'a' : 'b';
}
