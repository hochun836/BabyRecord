/**
 * modal.js — Generic bottom-sheet modal.
 */

const overlay = () => document.getElementById('modal-overlay');
const modalEl = () => document.getElementById('modal');

let currentCloseHandler = null;

/**
 * Open the modal with HTML content.
 * @param {string} html - Inner HTML.
 * @param {{ onClose?: Function }} [options]
 */
export function openModal(html, options = {}) {
  const o = overlay();
  const m = modalEl();
  if (!o || !m) return;

  m.innerHTML = html;
  // Small delay for CSS transition
  requestAnimationFrame(() => {
    o.classList.add('open');
  });

  currentCloseHandler = options.onClose || null;

  // Close when clicking overlay (outside modal)
  o.addEventListener('click', handleOverlayClick);

  // Close button inside modal header — call closeModal() so onClose fires properly
  m.querySelector('.modal__close')?.addEventListener('click', closeModal);
}

/**
 * Close the modal.
 */
export function closeModal() {
  const o = overlay();
  if (!o) return;
  o.classList.remove('open');
  o.removeEventListener('click', handleOverlayClick);

  if (currentCloseHandler) {
    currentCloseHandler();
    currentCloseHandler = null;
  }
}

function handleOverlayClick(e) {
  // Only close if clicking on the overlay itself, not the modal content
  if (e.target === overlay()) {
    closeModal();
  }
}

/**
 * Helper: generate modal header HTML with close button.
 */
export function modalHeader(title) {
  return `
    <div class="modal__header">
      <h2 class="modal__title">${title}</h2>
      <button class="modal__close" type="button" aria-label="關閉">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  `;
}

/**
 * Show a confirm dialog inside the modal.
 * @param {string} message
 * @param {{ confirmText?: string, cancelText?: string, danger?: boolean }} [options]
 * @returns {Promise<boolean>}
 */
export function confirm(message, options = {}) {
  return new Promise(resolve => {
    const { confirmText = '確認', cancelText = '取消', danger = false } = options;
    const html = `
      ${modalHeader('確認')}
      <p style="font-size: var(--font-size-lg); line-height: 1.6; margin-bottom: var(--space-lg);">${message}</p>
      <div class="confirm-actions">
        <button class="btn btn-secondary btn-block" id="modal-cancel">${cancelText}</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'} btn-block" id="modal-confirm">${confirmText}</button>
      </div>
    `;

    // confirmed flag prevents onClose from resolving false when user clicks confirm
    let confirmed = false;
    openModal(html, {
      onClose: () => { if (!confirmed) resolve(false); },
    });

    const m = modalEl();
    m.querySelector('#modal-cancel')?.addEventListener('click', () => {
      closeModal();
      resolve(false);
    });
    m.querySelector('#modal-confirm')?.addEventListener('click', () => {
      confirmed = true;
      closeModal();
      resolve(true);
    });
  });
}
