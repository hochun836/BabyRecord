/**
 * theme.js — Color theme management.
 * Themes are applied via `data-theme` attribute on <html>.
 * Persisted in localStorage under the key 'babyrecord_theme'.
 */

const STORAGE_KEY = 'babyrecord_theme';

export const THEMES = {
  'light-green': '白底綠色系',
  'dark-green':  '黑底綠色系',
  'light-blue':  '白底藍色系',
  'dark-blue':   '黑底藍色系',
};

/**
 * Get current theme id. Defaults to 'light-green'.
 */
export function getTheme() {
  return localStorage.getItem(STORAGE_KEY) || 'light-green';
}

/**
 * Set and immediately apply a theme.
 * @param {string} themeId - One of the THEMES keys.
 */
export function setTheme(themeId) {
  if (!THEMES[themeId]) themeId = 'light-green';
  localStorage.setItem(STORAGE_KEY, themeId);
  applyTheme(themeId);
}

/**
 * Apply a theme to <html> by setting data-theme attribute.
 * 'light-green' removes the attribute (CSS default).
 */
export function applyTheme(themeId) {
  if (!themeId || themeId === 'light-green') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', themeId);
  }
}

/**
 * Load and apply the saved theme. Call once on app init.
 */
export function initTheme() {
  applyTheme(getTheme());
}
