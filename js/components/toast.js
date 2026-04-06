/**
 * toast.js — Toast notification component.
 */

/**
 * Show a toast message.
 * @param {string} message
 * @param {{ type?: 'success'|'error'|'info', duration?: number }} [options]
 */
export function showToast(message, options = {}) {
  const { type = 'success', duration = 2500 } = options;
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}
