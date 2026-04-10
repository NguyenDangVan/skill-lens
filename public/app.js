import { renderNav } from './components/nav.js';
import { renderOverview } from './pages/overview.js';
import { renderHealth } from './pages/health.js';
import { renderAbTests } from './pages/ab-tests.js';

const routes = {
  '#/overview': renderOverview,
  '#/health': renderHealth,
  '#/ab-tests': renderAbTests,
};

export async function fetchApi(endpoint) {
  const res = await fetch(endpoint);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

function getRoute() {
  return location.hash || '#/overview';
}

async function navigate() {
  const hash = getRoute();
  const app = document.getElementById('app');
  const render = routes[hash] || routes['#/overview'];

  renderNav(hash);
  app.innerHTML = '<div class="loading">Loading...</div>';

  try {
    await render(app);
  } catch (err) {
    console.error('Page render error:', err);
    if (err.message.includes('Database not found')) {
      app.innerHTML = `
        <div class="db-error">
          <h2>Database Not Found</h2>
          <p>Could not connect to the skill-lens database.</p>
          <p>Make sure the database exists and the DB_PATH is set correctly.</p>
          <code>DB_PATH=~/.claude/plugins/skill-lens/data/skill-lens.db npm run dev</code>
          <p style="margin-top:16px;color:var(--text-secondary)">Or set the DB_PATH environment variable to point to your database file.</p>
        </div>`;
    } else {
      app.innerHTML = `
        <div class="empty-state">
          <h2>Something went wrong</h2>
          <p>${err.message}</p>
        </div>`;
    }
  }
}

window.addEventListener('hashchange', navigate);

if (!location.hash) location.hash = '#/overview';
navigate();
