/**
 * app.js — Application entry point.
 * Registers routes, initializes SW, checks reminders.
 */
import { route, initRouter, navigate } from './router.js';
import { openDB } from './modules/db.js';
import { getAllBabies, getSelectedBabyId, setSelectedBabyId } from './modules/baby.js';
import { checkOverdueReminders, scheduleForegroundReminders } from './modules/reminder.js';
import { initTheme } from './modules/theme.js';
import { renderNav } from './components/nav.js';
import { renderHome } from './pages/home.js';
import { renderAdd } from './pages/add.js';
import { renderHistory } from './pages/history.js';
import { renderStats, cleanupStats } from './pages/stats.js';
import { renderSettings } from './pages/settings.js';

async function init() {
  // 0. Apply saved color theme immediately (before any render)
  initTheme();

  // 1. Open IndexedDB
  await openDB();

  // 2. Register Service Worker
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('./sw.js');
    } catch (err) {
      console.warn('SW registration failed:', err);
    }
  }

  // 3. Render bottom nav
  renderNav();

  // 4. Auto-select first baby if none selected
  const babies = await getAllBabies();
  if (babies.length > 0 && !getSelectedBabyId()) {
    setSelectedBabyId(babies[0].id);
  }

  // 5. Register routes
  route('/home', () => {
    renderHome();
  });

  route('/add', (params) => {
    renderAdd(params);
  });

  route('/history', () => {
    renderHistory();
  });

  route('/stats', () => {
    renderStats();
    return cleanupStats;
  });

  route('/settings', () => {
    renderSettings();
  });

  // 6. Start router
  initRouter();

  // 7. Check overdue reminders (on app open)
  try {
    await checkOverdueReminders();
    await scheduleForegroundReminders();
  } catch (err) {
    console.warn('Reminder check failed:', err);
  }

  // 8. If no babies, redirect to settings
  if (babies.length === 0) {
    navigate('/settings');
  }
}

init().catch(err => console.error('App init failed:', err));
