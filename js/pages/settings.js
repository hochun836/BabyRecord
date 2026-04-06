/**
 * settings.js — Settings page: babies | reminders | backup | appearance tabs.
 */
import { icon } from '../components/icons.js';
import { getAllBabies, createBaby, updateBaby, deleteBaby, getSelectedBabyId, setSelectedBabyId } from '../modules/baby.js';
import { getAllReminders, getRemindersByBaby, createReminder, updateReminder, deleteReminder, deleteRemindersByBaby, requestNotificationPermission, scheduleForegroundReminders } from '../modules/reminder.js';
import { deleteRecordsByBaby } from '../modules/records.js';
import { openModal, closeModal, modalHeader, confirm as confirmDialog } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { getClientId, setClientId, exportToGDrive, importFromGDrive, restoreBackup } from '../modules/gdrive.js';
import { getTheme, setTheme, THEMES } from '../modules/theme.js';

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

export async function renderSettings() {
  const app = document.getElementById('app');

  app.innerHTML = `
    <div class="page-header">
      <h1 class="page-header__title">設定</h1>
    </div>
    <div class="page-content">
      <div class="tabs" id="settings-tabs">
        <button class="tab-btn active" data-tab="babies">寶寶</button>
        <button class="tab-btn" data-tab="reminders">提醒</button>
        <button class="tab-btn" data-tab="backup">資料</button>
        <button class="tab-btn" data-tab="appearance">外觀</button>
      </div>
      <div id="settings-content"></div>
    </div>
  `;

  const tabs = document.getElementById('settings-tabs');
  tabs.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    tabs.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderTabContent(btn.dataset.tab);
  });

  renderTabContent('babies');
}

function renderTabContent(tab) {
  switch (tab) {
    case 'babies': renderBabiesTab(); break;
    case 'reminders': renderRemindersTab(); break;
    case 'backup': renderBackupTab(); break;
    case 'appearance': renderAppearanceTab(); break;
  }
}

// ===================== Babies Tab =====================

async function renderBabiesTab() {
  const container = document.getElementById('settings-content');
  const babies = await getAllBabies();

  container.innerHTML = `
    <div id="babies-list">
      ${babies.length === 0
        ? `<div class="empty-state">
            ${icon('baby')}
            <p class="empty-state__title">還沒有寶寶</p>
            <p class="empty-state__desc">點下方按鈕新增第一位寶寶</p>
          </div>`
        : babies.map(b => `
          <div class="card" style="display:flex; align-items:center; gap: var(--space-md);">
            <div class="avatar avatar--lg">
              ${b.avatar ? `<img src="${b.avatar}" alt="${b.name}">` : icon('baby')}
            </div>
            <div class="flex-1">
              <div style="font-size: var(--font-size-xl); font-weight: var(--font-weight-bold);">${escapeHtml(b.nickname || b.name)}</div>
              ${b.nickname && b.nickname !== b.name ? `<div style="color: var(--text-secondary);">${escapeHtml(b.name)}</div>` : ''}
              ${b.birthday ? `<div style="font-size: var(--font-size-sm); color: var(--text-hint);">生日：${b.birthday}</div>` : ''}
            </div>
            <div class="flex gap-sm">
              <button class="btn btn-sm btn-secondary" data-edit-baby="${b.id}">${icon('edit')}</button>
              <button class="btn btn-sm btn-danger" data-delete-baby="${b.id}">${icon('delete')}</button>
            </div>
          </div>
        `).join('')
      }
    </div>
    <button class="btn btn-primary btn-block btn-lg mt-lg" id="add-baby-btn">
      ${icon('plus')} 新增寶寶
    </button>
  `;

  document.getElementById('add-baby-btn').addEventListener('click', () => openBabyForm());

  container.querySelectorAll('[data-edit-baby]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const baby = babies.find(b => b.id === btn.dataset.editBaby);
      if (baby) openBabyForm(baby);
    });
  });

  container.querySelectorAll('[data-delete-baby]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ok = await confirmDialog('確定要刪除這位寶寶嗎？寶寶的所有紀錄與提醒將一併刪除，且無法復原。', { danger: true, confirmText: '刪除' });
      if (!ok) return;
      const babyId = btn.dataset.deleteBaby;
      await Promise.all([
        deleteBaby(babyId),
        deleteRecordsByBaby(babyId),
        deleteRemindersByBaby(babyId),
      ]);
      // If deleted baby was selected, clear selection
      if (getSelectedBabyId() === babyId) {
        setSelectedBabyId(null);
      }
      showToast('已刪除');
      renderBabiesTab();
    });
  });
}

function openBabyForm(existing = null) {
  const isEdit = !!existing;
  const html = `
    ${modalHeader(isEdit ? '編輯寶寶' : '新增寶寶')}
    <div class="form-group text-center">
      <div class="avatar avatar--xl" style="margin: 0 auto; cursor: pointer;" id="avatar-preview">
        ${existing?.avatar ? `<img src="${existing.avatar}" alt="avatar">` : icon('camera')}
      </div>
      <input type="file" accept="image/*" id="avatar-input" style="display:none;">
      <p class="form-hint mt-sm">點擊上傳頭貼</p>
    </div>
    <div class="form-group">
      <label class="form-label">名字 *</label>
      <input type="text" class="form-input" id="baby-name" value="${escapeHtml(existing?.name)}" placeholder="例如：王小明">
    </div>
    <div class="form-group">
      <label class="form-label">暱稱</label>
      <input type="text" class="form-input" id="baby-nickname" value="${escapeHtml(existing?.nickname)}" placeholder="例如：小明、寶寶">
    </div>
    <div class="form-group">
      <label class="form-label">生日</label>
      <input type="date" class="form-input" id="baby-birthday" value="${existing?.birthday || ''}">
    </div>
    <button class="btn btn-primary btn-block btn-lg mt-lg" id="save-baby">
      ${icon('check')} ${isEdit ? '儲存修改' : '新增寶寶'}
    </button>
  `;

  openModal(html);

  let avatarData = existing?.avatar || '';

  // Avatar upload
  const preview = document.getElementById('avatar-preview');
  const fileInput = document.getElementById('avatar-input');
  preview?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    // Resize to 200x200 max
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 200;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        // Center crop
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
        avatarData = canvas.toDataURL('image/jpeg', 0.8);
        preview.innerHTML = `<img src="${avatarData}" alt="avatar">`;
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });

  // Save
  document.getElementById('save-baby')?.addEventListener('click', async () => {
    const name = document.getElementById('baby-name')?.value.trim();
    if (!name) {
      showToast('請輸入名字', { type: 'error' });
      return;
    }

    const data = {
      name,
      nickname: document.getElementById('baby-nickname')?.value.trim() || '',
      birthday: document.getElementById('baby-birthday')?.value || '',
      avatar: avatarData,
    };

    if (isEdit) {
      await updateBaby(existing.id, data);
      showToast('已更新');
    } else {
      const baby = await createBaby(data);
      // Auto-select new baby if it's the first one
      if (!getSelectedBabyId()) {
        setSelectedBabyId(baby.id);
      }
      showToast('已新增寶寶');
    }
    closeModal();
    renderBabiesTab();
  });
}

// ===================== Reminders Tab =====================

async function renderRemindersTab() {
  const container = document.getElementById('settings-content');
  const babies = await getAllBabies();
  const allReminders = await getAllReminders();

  if (babies.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        ${icon('bell')}
        <p class="empty-state__title">請先新增寶寶</p>
        <p class="empty-state__desc">新增寶寶後才能設定提醒</p>
      </div>
    `;
    return;
  }

  const grouped = {};
  babies.forEach(b => grouped[b.id] = []);
  allReminders.forEach(r => {
    if (grouped[r.babyId]) grouped[r.babyId].push(r);
  });

  container.innerHTML = `
    ${babies.map(b => `
      <div class="card mb-md">
        <div class="flex items-center gap-md mb-md">
          <div class="avatar avatar--sm">
            ${b.avatar ? `<img src="${b.avatar}" alt="${b.name}">` : icon('baby')}
          </div>
          <span style="font-size: var(--font-size-lg); font-weight: var(--font-weight-bold);">${escapeHtml(b.nickname || b.name)}</span>
        </div>
        <div id="reminders-${b.id}">
          ${grouped[b.id].length === 0
            ? '<p style="color: var(--text-hint);">尚無提醒</p>'
            : grouped[b.id].map(r => renderReminderItem(r)).join('')
          }
        </div>
        <button class="btn btn-sm btn-secondary mt-md" data-add-reminder="${b.id}">
          ${icon('plus')} 新增提醒
        </button>
      </div>
    `).join('')}
  `;

  // Add reminder buttons
  container.querySelectorAll('[data-add-reminder]').forEach(btn => {
    btn.addEventListener('click', () => openReminderForm(btn.dataset.addReminder));
  });

  // Edit reminder buttons
  container.querySelectorAll('[data-edit-reminder]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const r = allReminders.find(rem => rem.id === btn.dataset.editReminder);
      if (r) openReminderForm(r.babyId, r);
    });
  });

  // Delete reminder buttons
  container.querySelectorAll('[data-delete-reminder]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ok = await confirmDialog('確定要刪除這個提醒嗎？', { danger: true });
      if (!ok) return;
      await deleteReminder(btn.dataset.deleteReminder);
      showToast('已刪除');
      renderRemindersTab();
    });
  });

  // Toggle buttons
  container.querySelectorAll('[data-toggle-reminder]').forEach(toggle => {
    toggle.addEventListener('change', async () => {
      await updateReminder(toggle.dataset.toggleReminder, { enabled: toggle.checked });
      await scheduleForegroundReminders();
    });
  });
}

function renderReminderItem(r) {
  const _iconHtml = (name) => `<span style="display:inline-block;width:18px;height:18px;vertical-align:middle;margin-right:4px;">${icon(name)}</span>`;
  const typeLabel = r.type === 'feeding'
    ? `${_iconHtml('feeding')}餵奶`
    : `${_iconHtml('sleep')}睡覺`;
  return `
    <div class="flex items-center gap-md" style="padding: var(--space-sm) 0; border-bottom: 1px solid var(--border-light);">
      <div class="flex-1">
        <div style="font-size: var(--font-size-lg); font-weight: var(--font-weight-medium);">
          ${typeLabel} — ${r.time}
        </div>
        <div style="font-size: var(--font-size-sm); color: var(--text-secondary);">
          ${r.date ? r.date + ' ' : '每天 '}${r.time} · 提前 ${r.leadMinutes} 分鐘${r.message ? ' · ' + escapeHtml(r.message) : ''}
        </div>
        ${r.note ? `<div style="font-size: var(--font-size-sm); color: var(--text-hint);">${escapeHtml(r.note)}</div>` : ''}
      </div>
      <label class="toggle">
        <input type="checkbox" ${r.enabled ? 'checked' : ''} data-toggle-reminder="${r.id}">
        <span class="toggle__slider"></span>
      </label>
      <button class="btn-ghost" data-edit-reminder="${r.id}" style="width:36px;height:36px;display:flex;align-items:center;justify-content:center;">
        ${icon('edit')}
      </button>
      <button class="btn-ghost" data-delete-reminder="${r.id}" style="width:36px;height:36px;display:flex;align-items:center;justify-content:center;color:var(--danger);">
        ${icon('delete')}
      </button>
    </div>
  `;
}

function openReminderForm(babyId, existing = null) {
  const isEdit = !!existing;
  const html = `
    ${modalHeader(isEdit ? '編輯提醒' : '新增提醒')}
    <div class="form-group">
      <label class="form-label">類型</label>
      <div class="select-group" id="reminder-type">
        <button class="select-btn ${(!existing || existing.type === 'feeding') ? 'active' : ''}" data-value="feeding">${icon('feeding')} 餵奶</button>
        <button class="select-btn ${existing?.type === 'sleep' ? 'active' : ''}" data-value="sleep">${icon('sleep')} 睡覺</button>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">日期（選填）</label>
      <input type="date" class="form-input" id="reminder-date" value="${existing?.date || ''}">
      <p class="form-hint">留空代表每天提醒；填入日期則僅在該日提醒</p>
    </div>
    <div class="form-group">
      <label class="form-label">時間</label>
      <input type="time" class="form-input" id="reminder-time" value="${existing?.time || '08:00'}">
    </div>
    <div class="form-group">
      <label class="form-label">提前幾分鐘提醒</label>
      <div class="stepper">
        <button class="stepper__btn" data-target="reminder-lead" data-delta="-5">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
        <div class="stepper__value">
          <input type="number" id="reminder-lead" value="${existing?.leadMinutes ?? 10}" min="0" step="5" inputmode="numeric">
        </div>
        <div class="stepper__unit">分鐘</div>
        <button class="stepper__btn" data-target="reminder-lead" data-delta="5">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">提醒訊息</label>
      <input type="text" class="form-input" id="reminder-message" value="${escapeHtml(existing?.message)}" placeholder="例如：該喝奶囉！">
    </div>
    <div class="form-group">
      <label class="form-label">注意事項（選填）</label>
      <textarea class="form-input" id="reminder-note" rows="2" placeholder="額外注意事項...">${escapeHtml(existing?.note)}</textarea>
    </div>
    <button class="btn btn-primary btn-block btn-lg mt-lg" id="save-reminder">
      ${icon('check')} ${isEdit ? '儲存修改' : '新增提醒'}
    </button>
  `;

  openModal(html);

  const modal = document.getElementById('modal');

  // Type select
  modal.querySelector('#reminder-type')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.select-btn');
    if (!btn) return;
    modal.querySelectorAll('#reminder-type .select-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });

  // Stepper
  modal.querySelectorAll('.stepper__btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = modal.querySelector(`#${btn.dataset.target}`);
      const delta = parseFloat(btn.dataset.delta);
      if (!target) return;
      let val = parseFloat(target.value) || 0;
      val = Math.max(0, val + delta);
      target.value = val;
    });
  });

  // Save
  modal.querySelector('#save-reminder')?.addEventListener('click', async () => {
    const type = modal.querySelector('#reminder-type .select-btn.active')?.dataset.value || 'feeding';
    const date = modal.querySelector('#reminder-date')?.value || '';
    const time = modal.querySelector('#reminder-time')?.value || '08:00';
    const leadMinutes = parseInt(modal.querySelector('#reminder-lead')?.value) || 0;
    const message = modal.querySelector('#reminder-message')?.value.trim() || '';
    const note = modal.querySelector('#reminder-note')?.value.trim() || '';

    // Request notification permission
    const granted = await requestNotificationPermission();
    if (!granted) {
      showToast('通知權限被拒絕，提醒可能無法正常顯示', { type: 'error' });
    }

    const data = { babyId, type, date, time, leadMinutes, message, note };

    if (isEdit) {
      await updateReminder(existing.id, data);
      showToast('已更新提醒');
    } else {
      await createReminder(data);
      showToast('已新增提醒');
    }

    await scheduleForegroundReminders();
    closeModal();
    renderRemindersTab();
  });
}

// ===================== Backup Tab =====================

async function renderBackupTab() {
  const container = document.getElementById('settings-content');
  const clientId = getClientId();

  container.innerHTML = `
    <div class="card mb-lg">
      <h3 style="font-size: var(--font-size-lg); margin-bottom: var(--space-md);">Google Drive 設定</h3>
      <div class="form-group">
        <label class="form-label">OAuth Client ID</label>
        <input type="text" class="form-input" id="gdrive-client-id" value="${escapeHtml(clientId)}" placeholder="xxxx.apps.googleusercontent.com">
        <p class="form-hint">請參考 README 取得 Client ID</p>
      </div>
      <button class="btn btn-secondary btn-block" id="save-client-id">
        ${icon('check')} 儲存 Client ID
      </button>
    </div>

    <div class="card mb-lg">
      <h3 style="font-size: var(--font-size-lg); margin-bottom: var(--space-md);">備份</h3>
      <p style="color: var(--text-secondary); margin-bottom: var(--space-md);">
        將所有資料匯出到你的 Google Drive 隱藏資料夾。
      </p>
      <button class="btn btn-primary btn-block btn-lg" id="export-btn" ${!clientId ? 'disabled style="opacity:0.5"' : ''}>
        ${icon('upload')} 匯出備份
      </button>
      <div id="export-status" class="mt-md" style="color: var(--text-secondary); text-align: center;"></div>
    </div>

    <div class="card">
      <h3 style="font-size: var(--font-size-lg); margin-bottom: var(--space-md);">還原</h3>
      <p style="color: var(--text-secondary); margin-bottom: var(--space-md);">
        從 Google Drive 下載備份並還原。<strong style="color: var(--danger);">此操作會覆蓋目前所有資料。</strong>
      </p>
      <button class="btn btn-danger btn-block btn-lg" id="import-btn" ${!clientId ? 'disabled style="opacity:0.5"' : ''}>
        ${icon('download')} 匯入還原
      </button>
      <div id="import-status" class="mt-md" style="color: var(--text-secondary); text-align: center;"></div>
    </div>
  `;

  // Save Client ID
  document.getElementById('save-client-id')?.addEventListener('click', () => {
    const val = document.getElementById('gdrive-client-id')?.value.trim();
    setClientId(val);
    showToast('已儲存 Client ID');
    renderBackupTab(); // Re-render to update button states
  });

  // Export
  document.getElementById('export-btn')?.addEventListener('click', async () => {
    const status = document.getElementById('export-status');
    try {
      await exportToGDrive((msg) => {
        if (status) status.textContent = msg;
      });
      showToast('備份成功！');
    } catch (err) {
      if (status) status.textContent = '';
      const msg = err?.message || err?.result?.error?.message || JSON.stringify(err) || '未知錯誤';
      showToast('備份失敗：' + msg, { type: 'error' });
    }
  });

  // Import
  document.getElementById('import-btn')?.addEventListener('click', async () => {
    const status = document.getElementById('import-status');
    try {
      const backup = await importFromGDrive((msg) => {
        if (status) status.textContent = msg;
      });

      const info = `備份時間：${new Date(backup.exportedAt).toLocaleString('zh-TW')}\n寶寶 ${backup.babies?.length || 0} 位、紀錄 ${backup.records?.length || 0} 筆`;
      const ok = await confirmDialog(
        `確定要還原嗎？\n\n${info}\n\n此操作會覆蓋目前所有資料。`,
        { danger: true, confirmText: '還原' }
      );

      if (!ok) {
        if (status) status.textContent = '已取消';
        return;
      }

      if (status) status.textContent = '正在還原...';
      await restoreBackup(backup);
      showToast('還原成功！');
      if (status) status.textContent = '還原完成！請重新整理頁面。';
    } catch (err) {
      if (status) status.textContent = '';
      const msg = err?.message || err?.result?.error?.message || JSON.stringify(err) || '未知錯誤';
      showToast('還原失敗：' + msg, { type: 'error' });
    }
  });
}

// ===================== Appearance Tab =====================

function renderAppearanceTab() {
  const container = document.getElementById('settings-content');
  const current = getTheme();

  const themeList = [
    { id: 'light-green', label: '白底綠色系', bg: '#F5F9F5', primary: '#43A047', dark: false },
    { id: 'dark-green',  label: '黑底綠色系', bg: '#1E1E1E', primary: '#66BB6A', dark: true },
    { id: 'light-blue',  label: '白底藍色系', bg: '#F5F8FF', primary: '#1E88E5', dark: false },
    { id: 'dark-blue',   label: '黑底藍色系', bg: '#111827', primary: '#42A5F5', dark: true },
  ];

  container.innerHTML = `
    <div class="card">
      <h3 style="font-size: var(--font-size-lg); font-weight: var(--font-weight-bold); margin-bottom: var(--space-lg);">色系主題</h3>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:var(--space-md);" id="theme-grid">
        ${themeList.map(t => `
          <button class="theme-card ${current === t.id ? 'selected' : ''}" data-theme-id="${t.id}"
            style="
              border: 3px solid ${current === t.id ? t.primary : '#ccc'};
              border-radius: var(--radius-md);
              padding: var(--space-md);
              background: ${t.bg};
              cursor: pointer;
              display: flex;
              flex-direction: column;
              gap: var(--space-sm);
              align-items: flex-start;
              transition: border-color 0.2s;
            ">
            <!-- Mini preview -->
            <div style="display:flex; gap:6px; margin-bottom:4px;">
              <div style="width:32px; height:32px; border-radius:50%; background:${t.primary};"></div>
              <div style="flex:1; display:flex; flex-direction:column; gap:4px; justify-content:center;">
                <div style="height:6px; border-radius:3px; background:${t.primary}; opacity:0.7;"></div>
                <div style="height:6px; border-radius:3px; background:${t.dark ? '#555' : '#ccc'}; width:70%;"></div>
              </div>
            </div>
            <span style="font-size:14px; font-weight:600; color:${t.dark ? '#eee' : '#333'};">
              ${t.label}
            </span>
            ${current === t.id ? `<span style="font-size:12px; color:${t.primary};">✓ 目前使用</span>` : ''}
          </button>
        `).join('')}
      </div>
    </div>
  `;

  container.querySelectorAll('.theme-card').forEach(btn => {
    btn.addEventListener('click', () => {
      const themeId = btn.dataset.themeId;
      setTheme(themeId);
      showToast('已切換主題');
      renderAppearanceTab(); // re-render to show selected state
    });
  });
}
