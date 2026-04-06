/**
 * records.js — Record CRUD, wraps db.js.
 */
import { getAll, getById, put, deleteById, getByIndex, generateId } from './db.js';

const STORE = 'records';

/** Record type constants */
export const RECORD_TYPES = {
  feeding: '喝奶',
  diaper: '尿布',
  temperature: '體溫',
  weight: '體重',
  height: '身長',
  food: '副食品',
  bath: '洗澡',
  sleep: '睡眠',
};

/**
 * Format date to YYYY-MM-DD.
 */
function toDateStr(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

/**
 * Create a new record.
 * @param {{ babyId: string, type: string, value: object, time?: string, note?: string }} data
 */
export async function createRecord(data) {
  const now = new Date();
  const time = data.time || now.toISOString();
  const record = {
    id: generateId(),
    babyId: data.babyId,
    type: data.type,
    date: toDateStr(time),
    time,
    value: data.value,
    note: data.note || '',
    createdAt: Date.now(),
  };
  await put(STORE, record);
  return record;
}

/**
 * Update an existing record.
 */
export async function updateRecord(id, updates) {
  const record = await getById(STORE, id);
  if (!record) throw new Error('Record not found');
  const updated = { ...record, ...updates };
  // Recompute date if time changed
  if (updates.time) {
    updated.date = toDateStr(updates.time);
  }
  await put(STORE, updated);
  return updated;
}

/**
 * Delete a record by ID.
 */
export async function deleteRecord(id) {
  return deleteById(STORE, id);
}

/**
 * Get a single record by ID.
 */
export async function getRecord(id) {
  return getById(STORE, id);
}

/**
 * Get records for a baby on a specific date.
 * @param {string} babyId
 * @param {string} dateStr - YYYY-MM-DD
 * @returns {Promise<Array>}
 */
export async function getRecordsByDate(babyId, dateStr) {
  const range = IDBKeyRange.only([babyId, dateStr]);
  const records = await getByIndex(STORE, 'by_babyId_date', range);
  return records.sort((a, b) => new Date(a.time) - new Date(b.time));
}

/**
 * Get records for a baby within a date range.
 * @param {string} babyId
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @returns {Promise<Array>}
 */
export async function getRecordsByDateRange(babyId, startDate, endDate) {
  const range = IDBKeyRange.bound(
    [babyId, startDate],
    [babyId, endDate],
    false, false
  );
  const records = await getByIndex(STORE, 'by_babyId_date', range);
  return records.sort((a, b) => new Date(a.time) - new Date(b.time));
}

/**
 * Get all records for a baby.
 * @param {string} babyId
 */
export async function getRecordsByBaby(babyId) {
  const range = IDBKeyRange.only(babyId);
  return getByIndex(STORE, 'by_babyId', range);
}

/**
 * Get dates that have records in a given month.
 * @param {string} babyId
 * @param {number} year
 * @param {number} month - 1-indexed
 * @returns {Promise<Set<string>>} Set of YYYY-MM-DD strings
 */
export async function getRecordDatesInMonth(babyId, year, month) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  const records = await getRecordsByDateRange(babyId, startDate, endDate);
  return new Set(records.map(r => r.date));
}

/**
 * Get the last record of a specific type for a baby.
 */
export async function getLastRecordByType(babyId, type) {
  const records = await getRecordsByBaby(babyId);
  const filtered = records
    .filter(r => r.type === type)
    .sort((a, b) => new Date(b.time) - new Date(a.time));
  return filtered[0] || null;
}

/**
 * Delete all records for a baby.
 * @param {string} babyId
 */
export async function deleteRecordsByBaby(babyId) {
  const records = await getRecordsByBaby(babyId);
  await Promise.all(records.map(r => deleteById(STORE, r.id)));
}
