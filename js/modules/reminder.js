/**
 * reminder.js — Reminder CRUD + notification scheduling.
 */
import { getAll, getById, put, deleteById, getByIndex, generateId } from './db.js';
import { getAllBabies } from './baby.js';

const STORE = 'reminders';
let scheduledTimers = [];

/**
 * Get all reminders.
 */
export async function getAllReminders() {
  return getAll(STORE);
}

/**
 * Get reminders for a specific baby.
 */
export async function getRemindersByBaby(babyId) {
  const range = IDBKeyRange.only(babyId);
  return getByIndex(STORE, 'by_babyId', range);
}

/**
 * Get a single reminder by ID.
 */
export async function getReminder(id) {
  return getById(STORE, id);
}

/**
 * Create a new reminder.
 * @param {{ babyId: string, type: string, time: string, leadMinutes: number, message: string, note?: string, enabled?: boolean }} data
 */
export async function createReminder(data) {
  const reminder = {
    id: generateId(),
    babyId: data.babyId,
    type: data.type,           // 'feeding' | 'sleep'
    time: data.time,           // HH:MM
    date: data.date || '',     // YYYY-MM-DD (optional; empty = every day)
    leadMinutes: data.leadMinutes || 0,
    message: data.message || '',
    note: data.note || '',
    enabled: data.enabled !== false,
    createdAt: Date.now(),
  };
  await put(STORE, reminder);
  return reminder;
}

/**
 * Update a reminder.
 */
export async function updateReminder(id, updates) {
  const reminder = await getById(STORE, id);
  if (!reminder) throw new Error('Reminder not found');
  const updated = { ...reminder, ...updates };
  await put(STORE, updated);
  return updated;
}

/**
 * Delete a reminder.
 */
export async function deleteReminder(id) {
  return deleteById(STORE, id);
}

/**
 * Delete all reminders for a baby.
 * @param {string} babyId
 */
export async function deleteRemindersByBaby(babyId) {
  const reminders = await getRemindersByBaby(babyId);
  await Promise.all(reminders.map(r => deleteById(STORE, r.id)));
}

/**
 * Request notification permission.
 * @returns {Promise<boolean>} Whether permission was granted.
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

/**
 * Show a notification.
 */
function showNotification(title, body) {
  if (Notification.permission !== 'granted') return;
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then(reg => {
      reg.showNotification(title, {
        body,
        icon: 'icons/icon-192.png',
        badge: 'icons/icon-96.png',
        vibrate: [200, 100, 200],
        tag: 'baby-reminder-' + Date.now(),
      });
    });
  } else {
    new Notification(title, { body });
  }
}

/**
 * Compute today's trigger timestamps for a reminder.
 * @returns {{ notifyAt: number, eventAt: number }} Timestamps in ms.
 */
function getReminderTimestamps(reminder) {
  const [h, m] = reminder.time.split(':').map(Number);
  let year, month, day;
  if (reminder.date) {
    const parts = reminder.date.split('-').map(Number);
    year = parts[0]; month = parts[1] - 1; day = parts[2];
  } else {
    const now = new Date();
    year = now.getFullYear(); month = now.getMonth(); day = now.getDate();
  }
  const eventAt = new Date(year, month, day, h, m, 0).getTime();
  const notifyAt = eventAt - (reminder.leadMinutes || 0) * 60 * 1000;
  return { notifyAt, eventAt };
}

/**
 * Check for overdue reminders and show notifications.
 * Called on app open.
 */
export async function checkOverdueReminders() {
  const reminders = await getAllReminders();
  const babies = await getAllBabies();
  const babyMap = Object.fromEntries(babies.map(b => [b.id, b]));
  const now = Date.now();
  const lastCheck = parseInt(localStorage.getItem('lastReminderCheck') || '0', 10);

  for (const r of reminders) {
    if (!r.enabled) continue;
    const { notifyAt } = getReminderTimestamps(r);
    if (notifyAt > lastCheck && notifyAt <= now) {
      const baby = babyMap[r.babyId];
      const babyName = baby ? (baby.nickname || baby.name) : '寶寶';
      const typeLabel = r.type === 'feeding' ? '餵奶' : '睡覺';
      showNotification(
        `${babyName} — ${typeLabel}提醒`,
        r.message + (r.note ? `\n${r.note}` : '')
      );
    }
  }

  localStorage.setItem('lastReminderCheck', String(now));
}

/**
 * Schedule foreground timers for today's upcoming reminders.
 * Call on app open and when reminders change.
 */
export async function scheduleForegroundReminders() {
  // Clear existing timers
  scheduledTimers.forEach(t => clearTimeout(t));
  scheduledTimers = [];

  const reminders = await getAllReminders();
  const babies = await getAllBabies();
  const babyMap = Object.fromEntries(babies.map(b => [b.id, b]));
  const now = Date.now();

  for (const r of reminders) {
    if (!r.enabled) continue;
    const { notifyAt } = getReminderTimestamps(r);
    const delay = notifyAt - now;
    if (delay > 0 && delay < 24 * 60 * 60 * 1000) {
      const timerId = setTimeout(() => {
        const baby = babyMap[r.babyId];
        const babyName = baby ? (baby.nickname || baby.name) : '寶寶';
        const typeLabel = r.type === 'feeding' ? '餵奶' : '睡覺';
        showNotification(
          `${babyName} — ${typeLabel}提醒`,
          r.message + (r.note ? `\n${r.note}` : '')
        );
      }, delay);
      scheduledTimers.push(timerId);
    }
  }
}

/**
 * Get next upcoming reminder info for display.
 * @returns {Promise<{ babyName: string, type: string, message: string, minutesLeft: number } | null>}
 */
export async function getNextReminder() {
  const reminders = await getAllReminders();
  const babies = await getAllBabies();
  const babyMap = Object.fromEntries(babies.map(b => [b.id, b]));
  const now = Date.now();
  let nearest = null;
  let nearestDelay = Infinity;

  for (const r of reminders) {
    if (!r.enabled) continue;
    const { notifyAt } = getReminderTimestamps(r);
    const delay = notifyAt - now;
    if (delay > 0 && delay < nearestDelay) {
      nearestDelay = delay;
      const baby = babyMap[r.babyId];
      nearest = {
        babyName: baby ? (baby.nickname || baby.name) : '寶寶',
        type: r.type,
        message: r.message,
        minutesLeft: Math.ceil(delay / 60000),
      };
    }
  }

  return nearest;
}
