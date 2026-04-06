/**
 * gdrive.js — Google Drive backup/restore via GIS Token Model.
 */
import { getAll, put, clearStore } from './db.js';

const SCOPES = 'https://www.googleapis.com/auth/drive.appdata';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const BACKUP_FILENAME = 'babyrecord-backup.json';
const FILEID_KEY = 'gdrive_fileId';
const CLIENTID_KEY = 'gdrive_clientId';

let tokenClient = null;
let gapiInited = false;
let gisInited = false;

/**
 * Get/set the user-configured Client ID.
 */
export function getClientId() {
  return localStorage.getItem(CLIENTID_KEY) || '';
}

export function setClientId(id) {
  localStorage.setItem(CLIENTID_KEY, id);
  // Reset state so next call re-initializes
  tokenClient = null;
  gapiInited = false;
  gisInited = false;
}

/**
 * Dynamically load a script.
 */
function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

/**
 * Initialize Google API client + GIS token client.
 */
async function initGapi() {
  const clientId = getClientId();
  if (!clientId) throw new Error('請先設定 Google OAuth Client ID');

  if (!gapiInited) {
    await loadScript('https://apis.google.com/js/api.js');
    await new Promise((resolve, reject) => {
      window.gapi.load('client', { callback: resolve, onerror: reject });
    });
    await window.gapi.client.init({
      discoveryDocs: [DISCOVERY_DOC],
    });
    gapiInited = true;
  }

  if (!gisInited) {
    await loadScript('https://accounts.google.com/gsi/client');
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: () => {}, // Will be overridden per-call
    });
    gisInited = true;
  }
}

/**
 * Request an access token (popup auth).
 * @returns {Promise<string>} access_token
 */
function requestToken() {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      reject(new Error('GIS not initialized'));
      return;
    }
    tokenClient.callback = (resp) => {
      if (resp.error) {
        reject(new Error(resp.error_description || resp.error));
        return;
      }
      // Required: set the token on gapi.client so all Drive API calls are authenticated
      window.gapi.client.setToken(resp);
      resolve(resp.access_token);
    };
    tokenClient.error_callback = (err) => {
      reject(new Error(err.message || 'Auth failed'));
    };

    // Check if we already have a valid token
    const token = window.gapi.client.getToken();
    if (token && token.access_token) {
      resolve(token.access_token);
    } else {
      tokenClient.requestAccessToken({ prompt: 'consent' });
    }
  });
}

/**
 * Find existing backup file in appDataFolder.
 */
async function findBackupFile() {
  const cached = localStorage.getItem(FILEID_KEY);
  if (cached) {
    // Verify it still exists
    try {
      await window.gapi.client.drive.files.get({ fileId: cached, fields: 'id' });
      return cached;
    } catch {
      localStorage.removeItem(FILEID_KEY);
    }
  }

  const resp = await window.gapi.client.drive.files.list({
    spaces: 'appDataFolder',
    fields: 'files(id, name, modifiedTime)',
    q: `name='${BACKUP_FILENAME}'`,
  });

  const files = resp.result.files || [];
  if (files.length > 0) {
    const fileId = files[0].id;
    localStorage.setItem(FILEID_KEY, fileId);
    return fileId;
  }
  return null;
}

/**
 * Export all data to Google Drive.
 */
export async function exportToGDrive(onProgress) {
  await initGapi();
  await requestToken();
  onProgress?.('正在準備資料...');

  const [babies, records, reminders, settings] = await Promise.all([
    getAll('babies'),
    getAll('records'),
    getAll('reminders'),
    getAll('settings'),
  ]);

  const backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    babies,
    records,
    reminders,
    settings,
  };

  const content = JSON.stringify(backup);
  const blob = new Blob([content], { type: 'application/json' });

  onProgress?.('正在上傳...');

  const fileId = await findBackupFile();

  if (fileId) {
    // Update existing file
    await updateFile(fileId, blob);
  } else {
    // Create new file
    const newId = await createFile(blob);
    localStorage.setItem(FILEID_KEY, newId);
  }

  onProgress?.('備份完成！');
}

async function createFile(blob) {
  const metadata = {
    name: BACKUP_FILENAME,
    parents: ['appDataFolder'],
    mimeType: 'application/json',
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', blob);

  const token = window.gapi.client.getToken().access_token;
  const resp = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  if (!resp.ok) throw new Error('上傳失敗: ' + resp.status);
  const data = await resp.json();
  return data.id;
}

async function updateFile(fileId, blob) {
  const token = window.gapi.client.getToken().access_token;
  const resp = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=media`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: blob,
  });
  if (!resp.ok) throw new Error('更新失敗: ' + resp.status);
}

/**
 * Import data from Google Drive. Returns the backup object for confirmation.
 */
export async function importFromGDrive(onProgress) {
  await initGapi();
  await requestToken();
  onProgress?.('正在搜尋備份檔案...');

  const fileId = await findBackupFile();
  if (!fileId) throw new Error('找不到備份檔案');

  onProgress?.('正在下載...');

  const token = window.gapi.client.getToken().access_token;
  const resp = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!resp.ok) throw new Error('下載失敗: ' + resp.status);
  const backup = await resp.json();

  return backup;
}

/**
 * Restore a backup object to IndexedDB.
 */
export async function restoreBackup(backup) {
  if (!backup || backup.version !== 1) throw new Error('無效的備份格式');

  // Clear all stores
  await Promise.all([
    clearStore('babies'),
    clearStore('records'),
    clearStore('reminders'),
    clearStore('settings'),
  ]);

  // Restore data
  const putAll = (store, items) => Promise.all((items || []).map(item => put(store, item)));
  await Promise.all([
    putAll('babies', backup.babies),
    putAll('records', backup.records),
    putAll('reminders', backup.reminders),
    putAll('settings', backup.settings),
  ]);
}

/**
 * Get last backup info from the file metadata.
 */
export async function getBackupInfo() {
  try {
    await initGapi();
    const token = window.gapi.client.getToken();
    if (!token) return null;

    const fileId = await findBackupFile();
    if (!fileId) return null;

    const resp = await window.gapi.client.drive.files.get({
      fileId,
      fields: 'modifiedTime, size',
    });
    return {
      lastModified: resp.result.modifiedTime,
      size: resp.result.size,
    };
  } catch {
    return null;
  }
}
