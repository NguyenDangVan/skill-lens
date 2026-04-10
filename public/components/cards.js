import { formatNumber } from './chart-helpers.js';

export function renderSummaryCards(container, cards) {
  container.innerHTML = cards.map(c => `
    <div class="card">
      <div class="card-label">${c.label}</div>
      <div class="card-value">${c.value}</div>
      ${c.sub ? `<div class="card-sub">${c.sub}</div>` : ''}
    </div>
  `).join('');
}

export function summaryCard(label, value, sub) {
  return { label, value: formatNumber(value), sub };
}
