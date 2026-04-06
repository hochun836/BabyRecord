/**
 * nav.js — Bottom tab navigation bar.
 */
import { icon } from './icons.js';

const tabs = [
  { id: 'home',     path: '/home',     label: '首頁',   icon: 'home' },
  { id: 'add',      path: '/add',      label: '新增',   icon: 'add' },
  { id: 'history',  path: '/history',  label: '歷史',   icon: 'history' },
  { id: 'stats',    path: '/stats',    label: '統計',   icon: 'stats' },
  { id: 'settings', path: '/settings', label: '設定',   icon: 'settings' },
];

/**
 * Render the bottom navigation bar.
 */
export function renderNav() {
  const nav = document.getElementById('bottom-nav');
  if (!nav) return;

  nav.innerHTML = tabs.map(tab => `
    <button class="nav-item" data-path="${tab.path}" aria-label="${tab.label}">
      ${icon(tab.icon)}
      <span>${tab.label}</span>
    </button>
  `).join('');

  nav.addEventListener('click', (e) => {
    const btn = e.target.closest('.nav-item');
    if (!btn) return;
    const path = btn.dataset.path;
    window.location.hash = '#' + path;
  });

  // Listen for hash changes to update active state
  const update = () => updateActiveTab(nav);
  window.addEventListener('hashchange', update);
  update();
}

function updateActiveTab(nav) {
  const hash = window.location.hash.slice(1) || '/home';
  nav.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.path === hash);
  });
}
