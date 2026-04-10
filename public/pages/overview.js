import { fetchApi } from '../app.js';
import { createChart, getColor, getColorAlpha, formatNumber } from '../components/chart-helpers.js';
import { renderSummaryCards, summaryCard } from '../components/cards.js';

export async function renderOverview(container) {
  const data = await fetchApi('/api/overview?days=30');
  const { summary, daily_runs, top_skills, token_by_skill } = data;

  container.innerHTML = `
    <div class="summary-cards" id="overview-cards"></div>
    <div class="chart-grid">
      <div class="chart-card full-width">
        <h3>Skill Runs Over Time (30 days)</h3>
        <div style="height:300px"><canvas id="chart-runs-time"></canvas></div>
      </div>
      <div class="chart-card">
        <h3>Top Skills by Usage</h3>
        <div style="height:300px"><canvas id="chart-top-skills"></canvas></div>
      </div>
      <div class="chart-card">
        <h3>Token Consumption by Skill</h3>
        <div style="height:300px"><canvas id="chart-tokens"></canvas></div>
      </div>
    </div>
  `;

  // Summary cards
  renderSummaryCards(document.getElementById('overview-cards'), [
    summaryCard('Total Runs', summary.total_runs, '30-day period'),
    summaryCard('Total Tokens', summary.total_tokens, '30-day period'),
    { label: 'Avg Satisfaction', value: summary.avg_satisfaction != null ? summary.avg_satisfaction + '%' : '-', sub: 'Based on reactions' },
    summaryCard('Active Skills', summary.active_skills, '30-day period'),
  ]);

  // Line chart: runs over time (top 5 + other)
  const top5 = top_skills.slice(0, 5).map(s => s.skill_name);
  const dates = [...new Set(daily_runs.map(r => r.date))].sort();
  const datasets = top5.map((skill, i) => {
    const points = dates.map(d => {
      const row = daily_runs.find(r => r.date === d && r.skill_name === skill);
      return row ? row.count : 0;
    });
    return {
      label: skill,
      data: points,
      borderColor: getColor(i),
      backgroundColor: getColorAlpha(i),
      tension: 0.3,
      fill: false,
    };
  });

  // "Other" aggregation
  if (top_skills.length > 5) {
    const otherPoints = dates.map(d => {
      return daily_runs
        .filter(r => r.date === d && !top5.includes(r.skill_name))
        .reduce((s, r) => s + r.count, 0);
    });
    datasets.push({
      label: 'Other',
      data: otherPoints,
      borderColor: '#6b7280',
      backgroundColor: 'rgba(107,114,128,0.2)',
      tension: 0.3,
      fill: false,
      borderDash: [4, 4],
    });
  }

  createChart(document.getElementById('chart-runs-time'), {
    type: 'line',
    data: { labels: dates, datasets },
    options: {
      scales: { x: { type: 'category' }, y: { beginAtZero: true } },
    },
  });

  // Doughnut: top skills
  const doughnutSkills = top_skills.slice(0, 8);
  createChart(document.getElementById('chart-top-skills'), {
    type: 'doughnut',
    data: {
      labels: doughnutSkills.map(s => s.skill_name),
      datasets: [{
        data: doughnutSkills.map(s => s.count),
        backgroundColor: doughnutSkills.map((_, i) => getColor(i)),
        borderWidth: 0,
      }],
    },
    options: {
      plugins: {
        legend: { position: 'right' },
      },
    },
  });

  // Stacked bar: tokens
  createChart(document.getElementById('chart-tokens'), {
    type: 'bar',
    data: {
      labels: token_by_skill.slice(0, 10).map(s => s.skill_name),
      datasets: [
        {
          label: 'Input Tokens',
          data: token_by_skill.slice(0, 10).map(s => s.input_tokens),
          backgroundColor: getColor(0),
        },
        {
          label: 'Output Tokens',
          data: token_by_skill.slice(0, 10).map(s => s.output_tokens),
          backgroundColor: getColor(1),
        },
      ],
    },
    options: {
      scales: {
        x: { stacked: true },
        y: { stacked: true, beginAtZero: true },
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${formatNumber(ctx.raw)}`,
          },
        },
      },
    },
  });
}
