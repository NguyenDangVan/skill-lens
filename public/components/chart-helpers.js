const COLORS = [
  '#3b82f6', '#a855f7', '#22c55e', '#eab308', '#ef4444', '#06b6d4', '#f97316',
  '#ec4899', '#8b5cf6', '#14b8a6',
];

export function getColor(i) {
  return COLORS[i % COLORS.length];
}

export function getColorAlpha(i, alpha = 0.2) {
  const hex = COLORS[i % COLORS.length];
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const darkDefaults = {
  color: '#8b8fa3',
  borderColor: '#2a2d3a',
};

export function createChart(canvas, config) {
  const ctx = canvas.getContext('2d');
  return new Chart(ctx, {
    ...config,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: darkDefaults.color, boxWidth: 12, padding: 16 },
          ...config.options?.plugins?.legend,
        },
        tooltip: {
          backgroundColor: '#1a1d27',
          titleColor: '#e1e4ea',
          bodyColor: '#e1e4ea',
          borderColor: '#2a2d3a',
          borderWidth: 1,
          ...config.options?.plugins?.tooltip,
        },
        ...config.options?.plugins,
      },
      scales: applyDarkScales(config.options?.scales),
      ...config.options,
      plugins: {
        legend: {
          labels: { color: darkDefaults.color, boxWidth: 12, padding: 16 },
        },
        tooltip: {
          backgroundColor: '#1a1d27',
          titleColor: '#e1e4ea',
          bodyColor: '#e1e4ea',
          borderColor: '#2a2d3a',
          borderWidth: 1,
        },
        ...(config.options?.plugins || {}),
      },
    },
  });
}

function applyDarkScales(scales) {
  if (!scales) return undefined;
  const out = {};
  for (const [key, val] of Object.entries(scales)) {
    out[key] = {
      ...val,
      ticks: { color: darkDefaults.color, ...val?.ticks },
      grid: { color: 'rgba(42,45,58,0.5)', ...val?.grid },
    };
  }
  return out;
}

export function formatNumber(n) {
  if (n == null) return '-';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

export function trendArrow(val) {
  if (val == null) return '<span class="trend-flat">-</span>';
  if (val > 0) return `<span class="trend-up">+${val.toFixed(1)}%</span>`;
  if (val < 0) return `<span class="trend-down">${val.toFixed(1)}%</span>`;
  return '<span class="trend-flat">0%</span>';
}
