/**
 * baby.js — Baby profile CRUD, wraps db.js.
 */
import { getAll, getById, put, deleteById, generateId } from './db.js';

const STORE = 'babies';
const SELECTED_KEY = 'selectedBabyId';

/**
 * Get all babies.
 * @returns {Promise<Array>}
 */
export async function getAllBabies() {
  const babies = await getAll(STORE);
  return babies.sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * Get a baby by ID.
 */
export async function getBaby(id) {
  return getById(STORE, id);
}

/**
 * Create a new baby.
 * @param {{ name: string, nickname?: string, birthday?: string, avatar?: string }} data
 * @returns {Promise<object>} The created baby.
 */
export async function createBaby(data) {
  const baby = {
    id: generateId(),
    name: data.name,
    nickname: data.nickname || '',
    birthday: data.birthday || '',
    avatar: data.avatar || '',
    createdAt: Date.now(),
  };
  await put(STORE, baby);
  return baby;
}

/**
 * Update an existing baby.
 * @param {string} id
 * @param {object} updates
 */
export async function updateBaby(id, updates) {
  const baby = await getById(STORE, id);
  if (!baby) throw new Error('Baby not found');
  const updated = { ...baby, ...updates };
  await put(STORE, updated);
  return updated;
}

/**
 * Delete a baby by ID.
 */
export async function deleteBaby(id) {
  return deleteById(STORE, id);
}

/**
 * Get currently selected baby ID from localStorage.
 */
export function getSelectedBabyId() {
  return localStorage.getItem(SELECTED_KEY);
}

/**
 * Set selected baby ID.
 */
export function setSelectedBabyId(id) {
  if (id) {
    localStorage.setItem(SELECTED_KEY, id);
  } else {
    localStorage.removeItem(SELECTED_KEY);
  }
}
