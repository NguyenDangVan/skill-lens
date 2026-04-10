import { fetchApi } from '../app.js';
import { createChart, getColor, getColorAlpha, trendArrow } from '../components/chart-helpers.js';

export async function renderHealth(container) {
  const data = await fetchApi('/api/health?days=14');
  const { skills } = data;

  if (!skills.length) {
    container.innerHTML = `
      <div class="empty-state">
        <h2>No Data Yet</h2>
        <p>Use some skills and check back.</p>
      </div>`;
    return;
  }

  container.innerHTML = `
    <div class="chart-grid">
      <div class="chart-card full-width">
        <h3>Satisfaction Rate by Skill</h3>
        <div style="height:300px"><canvas id="chart-sat-bar"></canvas></div>
      </div>
      <div class="chart-card full-width">
        <h3>Health Status Matrix</h3>
        <div id="health-heatmap"></div>
      </div>
      <div class="chart-card" id="skill-detail-sat">
        <h3>Satisfaction Timeline</h3>
        <div style="height:280px"><canvas id="chart-skill-sat"></canvas></div>
      </div>
      <div class="chart-card" id="skill-detail-reactions">
        <h3>Reaction Distribution</h3>
        <div style="height:280px"><canvas id="chart-skill-react"></canvas></div>
      </div>
    </div>
  `;

  // Bar chart: satisfaction per skill
  createChart(document.getElementById('chart-sat-bar'), {
    type: 'bar',
    data: {
      labels: skills.map(s => s.name),
      datasets: [{
        label: 'Satisfaction %',
        data: skills.map(s => s.satisfaction),
        backgroundColor: skills.map(s => {
          if (s.status === 'critical') return '#ef4444';
          if (s.status === 'warning') return '#eab308';
          return '#22c55e';
        }),
        borderRadius: 4,
      }],
    },
    options: {
      scales: {
        y: { beginAtZero: true, max: 100 },
        x: {},
      },
      plugins: { legend: { display: false } },
    },
  });

  // Heatmap table
  renderHeatmap(document.getElementById('health-heatmap'), skills);

  // Load detail for first skill
  if (skills.length > 0) {
    loadSkillDetail(skills[0].name);
  }
}

function renderHeatmap(el, skills) {
  const html = `
    <table class="heatmap-table">
      <thead>
        <tr>
          <th>Skill</th>
          <th>Satisfaction</th>
          <th>Token Creep</th>
          <th>Cancel Rate</th>
          <th>Correction Rate</th>
          <th>Trend</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${skills.map(s => `
          <tr class="skill-row" data-skill="${s.name}" style="cursor:pointer">
            <td class="skill-name">${s.name}</td>
            <td>${s.satisfaction != null ? s.satisfaction + '%' : '-'}</td>
            <td>${cellColor(s.token_creep, 30)}${s.token_creep > 0 ? '+' : ''}${s.token_creep}%</td>
            <td>${cellColor(s.cancel_rate, 10)}${s.cancel_rate != null ? s.cancel_rate + '%' : '-'}</td>
            <td>${cellColor(s.correction_rate, 25)}${s.correction_rate != null ? s.correction_rate + '%' : '-'}</td>
            <td>${trendArrow(s.trend.satisfaction)}</td>
            <td><span class="status-dot ${statusColor(s.status)}"></span>${s.status}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  el.innerHTML = html;

  el.querySelectorAll('.skill-row').forEach(row => {
    row.addEventListener('click', () => loadSkillDetail(row.dataset.skill));
  });
}

function cellColor(val, threshold) {
  if (val == null) return '';
  if (val > threshold) return '<span class="status-dot red"></span>';
  if (val > threshold * 0.6) return '<span class="status-dot yellow"></span>';
  return '<span class="status-dot green"></span>';
}

function statusColor(status) {
  if (status === 'critical') return 'red';
  if (status === 'warning') return 'yellow';
  return 'green';
}

let satChart = null;
let reactChart = null;

async function loadSkillDetail(skillName) {
  try {
    const data = await fetchApi(`/api/health/${encodeURIComponent(skillName)}`);

    // Destroy existing charts
    if (satChart) { satChart.destroy(); satChart = null; }
    if (reactChart) { reactChart.destroy(); reactChart = null; }

    // Satisfaction timeline
    const satEl = document.getElementById('chart-skill-sat');
    if (satEl) {
      satEl.querySelector('h3').textContent = `Satisfaction Timeline: ${skillName}`;
      satChart = createChart(document.getElementById('chart-skill-sat').querySelector('canvas'), {
        type: 'line',
        data: {
          labels: data.satisfaction_timeline.map(r => r.date),
          datasets: [{
            label: 'Satisfaction %',
            data: data.satisfaction_timeline.map(r => r.satisfaction),
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59,130,246,0.1)',
            tension: 0.3,
            fill: true,
          }],
        },
        options: {
          scales: {
            y: { beginAtZero: true, max: 100 },
            x: {},
          },
        },
      });
    }

    // Reaction distribution
    const reactEl = document.getElementById('chart-skill-react');
    if (reactEl) {
      reactEl.querySelector('h3').textContent = `Reaction Distribution: ${skillName}`;
      const reactionColors = {
        satisfied: '#22c55e',
        correction: '#eab308',
        follow_up: '#3b82f6',
        retry: '#a855f7',
        cancel: '#ef4444',
      };
      const reactions = data.reaction_distribution;
      reactChart = createChart(document.getElementById('chart-skill-react').querySelector('canvas'), {
        type: 'doughnut',
        data: {
          labels: reactions.map(r => r.reaction),
          datasets: [{
            data: reactions.map(r => r.count),
            backgroundColor: reactions.map(r => reactionColors[r.reaction] || '#6b7280'),
            borderWidth: 0,
          }],
        },
        options: {
          plugins: { legend: { position: 'right' } },
        },
      });
    }
  } catch (err) {
    console.error('Failed to load skill detail:', err);
  }
}
