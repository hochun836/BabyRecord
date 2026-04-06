/**
 * babySelector.js — Header baby picker component.
 */
import { icon } from './icons.js';
import { getAllBabies, getSelectedBabyId, setSelectedBabyId } from '../modules/baby.js';

let onChangeCallback = null;

/**
 * Register a callback when baby selection changes.
 */
export function onBabyChange(cb) {
  onChangeCallback = cb;
}

/**
 * Get current selected baby (resolves the stored ID).
 */
export async function getSelectedBaby() {
  const babies = await getAllBabies();
  if (babies.length === 0) return null;

  let id = getSelectedBabyId();
  let baby = babies.find(b => b.id === id);
  if (!baby) {
    baby = babies[0];
    setSelectedBabyId(baby.id);
  }
  return baby;
}

/**
 * Render the baby selector inside a container element.
 * @param {HTMLElement} container
 */
export async function renderBabySelector(container) {
  const babies = await getAllBabies();

  if (babies.length === 0) {
    container.innerHTML = `
      <div class="flex items-center gap-md" style="padding: var(--space-md);">
        <div class="avatar">${icon('baby')}</div>
        <span style="font-size: var(--font-size-lg); color: var(--text-hint);">請先新增寶寶</span>
      </div>`;
    return;
  }

  const selected = await getSelectedBaby();

  container.innerHTML = `
    <button class="baby-selector flex items-center gap-md" style="padding: var(--space-sm) var(--space-md); border-radius: var(--radius-md); width: 100%; background: none; border: none; cursor: pointer;" aria-label="選擇寶寶">
      <div class="avatar">
        ${selected.avatar
          ? `<img src="${selected.avatar}" alt="${selected.name}">`
          : icon('baby')
        }
      </div>
      <div class="flex-1" style="text-align: left;">
        <div style="font-size: var(--font-size-lg); font-weight: var(--font-weight-bold);">
          ${escapeHtml(selected.nickname || selected.name)}
        </div>
        ${selected.nickname && selected.nickname !== selected.name
          ? `<div style="font-size: var(--font-size-sm); color: var(--text-secondary);">${escapeHtml(selected.name)}</div>`
          : ''
        }
      </div>
      ${babies.length > 1 ? `<span style="display:flex;align-items:center;width:24px;height:24px;flex-shrink:0;">${icon('chevronDown')}</span>` : ''}
    </button>
    ${babies.length > 1 ? `
      <div class="baby-dropdown hidden" style="position: absolute; top: 100%; left: 0; right: 0; background: var(--surface); border: 1px solid var(--border-light); border-radius: var(--radius-md); box-shadow: var(--shadow-lg); z-index: 150; margin-top: var(--space-xs);">
        ${babies.map(b => `
          <button class="baby-option flex items-center gap-md ${b.id === selected.id ? 'active' : ''}"
                  data-id="${b.id}"
                  style="width: 100%; padding: var(--space-md); background: ${b.id === selected.id ? 'var(--primary-light)' : 'none'}; border: none; cursor: pointer; text-align: left;">
            <div class="avatar avatar--sm">
              ${b.avatar ? `<img src="${b.avatar}" alt="${b.name}">` : icon('baby')}
            </div>
            <span style="font-size: var(--font-size-lg);">${escapeHtml(b.nickname || b.name)}</span>
          </button>
        `).join('')}
      </div>
    ` : ''}
  `;

  // Make container relatively positioned for dropdown
  container.style.position = 'relative';

  // Toggle dropdown
  const selectorBtn = container.querySelector('.baby-selector');
  const dropdown = container.querySelector('.baby-dropdown');

  if (selectorBtn && dropdown) {
    selectorBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('hidden');
    });

    dropdown.addEventListener('click', (e) => {
      const option = e.target.closest('.baby-option');
      if (!option) return;
      const id = option.dataset.id;
      setSelectedBabyId(id);
      dropdown.classList.add('hidden');
      renderBabySelector(container);
      if (onChangeCallback) onChangeCallback(id);
    });

    // Close on outside click
    document.addEventListener('click', () => {
      dropdown.classList.add('hidden');
    }, { once: true });
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
