const NAV_ITEMS = [
  { hash: '#/overview', label: 'Overview' },
  { hash: '#/health', label: 'Health' },
  { hash: '#/ab-tests', label: 'A/B Tests' },
];

export function renderNav(activeHash) {
  const nav = document.getElementById('nav');
  nav.innerHTML = `
    <span class="logo">Skill Lens</span>
    ${NAV_ITEMS.map(item =>
      `<a href="${item.hash}" class="${item.hash === activeHash ? 'active' : ''}">${item.label}</a>`
    ).join('')}
  `;
}
