/**
 * router.js — Hash-based SPA router.
 */

const routes = {};
let currentCleanup = null;

/**
 * Register a route handler.
 * @param {string} path - e.g. '/home'
 * @param {(params?: object) => void|Function} handler - Render function. May return a cleanup function.
 */
export function route(path, handler) {
  routes[path] = handler;
}

/**
 * Navigate to a route.
 * @param {string} path - e.g. '/add'
 * @param {object} [params] - Optional params to pass to the handler.
 */
export function navigate(path, params) {
  if (params) {
    sessionStorage.setItem('__routeParams', JSON.stringify(params));
  } else {
    sessionStorage.removeItem('__routeParams');
  }
  window.location.hash = '#' + path;
}

/**
 * Get current route params (passed via navigate).
 */
export function getRouteParams() {
  try {
    const raw = sessionStorage.getItem('__routeParams');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function handleRoute() {
  const hash = window.location.hash.slice(1) || '/home';

  // Run cleanup of previous page
  if (typeof currentCleanup === 'function') {
    currentCleanup();
    currentCleanup = null;
  }

  const handler = routes[hash];
  if (handler) {
    const result = handler(getRouteParams());
    if (typeof result === 'function') {
      currentCleanup = result;
    }
  } else {
    // Fallback to home
    navigate('/home');
  }
}

/**
 * Initialize the router. Call once on app start.
 */
export function initRouter() {
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}
