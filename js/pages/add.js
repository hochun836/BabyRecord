/**
 * add.js — Add record page: category grid + forms.
 */
import { icon } from '../components/icons.js';
import { getSelectedBaby } from '../components/babySelector.js';
import { createRecord, updateRecord, getRecord, getLastRecordByType } from '../modules/records.js';
import { showToast } from '../components/toast.js';
import { navigate, getRouteParams } from '../router.js';
import { openModal, closeModal, modalHeader } from '../components/modal.js';

const categories = [
  { type: 'feeding',     label: '喝奶',   icon: 'feeding' },
  { type: 'diaper',      label: '尿布',   icon: 'diaper' },
  { type: 'sleep',       label: '睡眠',   icon: 'sleep' },
  { type: 'temperature', label: '體溫',   icon: 'temperature' },
  { type: 'weight',      label: '體重',   icon: 'weight' },
  { type: 'height',      label: '身長',   icon: 'height' },
  { type: 'food',        label: '副食品', icon: 'food' },
  { type: 'bath',        label: '洗澡',   icon: 'bath' },
];

function nowTimeStr() {
  const d = new Date();
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

function nowDateStr() {
  const d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

export async function renderAdd(params) {
  const app = document.getElementById('app');
  const baby = await getSelectedBaby();

  if (!baby) {
    app.innerHTML = `
      <div class="page-header">
        <h1 class="page-header__title">新增記錄</h1>
      </div>
      <div class="page-content">
        <div class="empty-state">
          ${icon('baby')}
          <p class="empty-state__title">請先新增寶寶</p>
          <button class="btn btn-primary mt-lg" onclick="location.hash='#/settings'">前往設定</button>
        </div>
      </div>
    `;
    return;
  }

  // Check if editing existing record
  const editId = params?.editId;
  let editRecord = null;
  if (editId) {
    editRecord = await getRecord(editId);
  }

  const preselectedType = editRecord ? editRecord.type : (params?.type || null);

  app.innerHTML = `
    <div class="page-header">
      <button class="btn-ghost" id="add-back" style="display:flex; align-items:center; justify-content:center; width:44px; height:44px;">
        ${icon('arrowLeft')}
      </button>
      <h1 class="page-header__title">${editRecord ? '編輯記錄' : '新增記錄'}</h1>
    </div>
    <div class="page-content">
      <div id="add-categories" ${preselectedType ? 'class="hidden"' : ''}></div>
      <div id="add-form"></div>
    </div>
  `;

  document.getElementById('add-back').addEventListener('click', () => {
    if (document.getElementById('add-categories').classList.contains('hidden') && !editRecord) {
      // Go back to category selection
      document.getElementById('add-categories').classList.remove('hidden');
      document.getElementById('add-form').innerHTML = '';
    } else {
      history.back();
    }
  });

  renderCategories(baby, editRecord);

  if (preselectedType) {
    renderForm(preselectedType, baby, editRecord);
  }
}

function renderCategories(baby, editRecord) {
  const container = document.getElementById('add-categories');
  if (!container) return;

  container.innerHTML = `
    <div class="category-grid">
      ${categories.map(c => `
        <button class="category-btn" data-type="${c.type}">
          ${icon(c.icon)}
          <span>${c.label}</span>
        </button>
      `).join('')}
    </div>
  `;

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.category-btn');
    if (!btn) return;
    container.classList.add('hidden');
    renderForm(btn.dataset.type, baby, editRecord);
  });
}

async function renderForm(type, baby, editRecord, saveCallback = null) {
  const container = document.getElementById('add-form');
  if (!container) return;

  const isEdit = !!editRecord;
  const val = isEdit ? editRecord.value : {};
  const recordTime = isEdit ? new Date(editRecord.time) : new Date();
  const timeStr = String(recordTime.getHours()).padStart(2, '0') + ':' + String(recordTime.getMinutes()).padStart(2, '0');
  const dateStr = recordTime.getFullYear() + '-' + String(recordTime.getMonth() + 1).padStart(2, '0') + '-' + String(recordTime.getDate()).padStart(2, '0');
  const noteVal = isEdit ? editRecord.note : '';

  let formHtml = '';

  switch (type) {
    case 'feeding':
      formHtml = `
        <div class="form-group">
          <label class="form-label">配方奶 (ml)</label>
          <div class="stepper">
            <button class="stepper__btn" data-target="formula_ml" data-delta="-10">${icon('minus')}</button>
            <div class="stepper__value">
              <input type="number" id="formula_ml" value="${val.formula_ml || 0}" min="0" step="10" inputmode="numeric">
            </div>
            <div class="stepper__unit">ml</div>
            <button class="stepper__btn" data-target="formula_ml" data-delta="10">${icon('plus')}</button>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">母乳 (ml)</label>
          <div class="stepper">
            <button class="stepper__btn" data-target="breast_ml" data-delta="-10">${icon('minus')}</button>
            <div class="stepper__value">
              <input type="number" id="breast_ml" value="${val.breast_ml || 0}" min="0" step="10" inputmode="numeric">
            </div>
            <div class="stepper__unit">ml</div>
            <button class="stepper__btn" data-target="breast_ml" data-delta="10">${icon('plus')}</button>
          </div>
        </div>
      `;
      break;

    case 'diaper':
      formHtml = `
        <div class="form-group">
          <label class="form-label">類型</label>
          <div class="select-group" id="diaper-kind">
            <button class="select-btn ${val.kind === 'wet' ? 'active' : ''}" data-value="wet">尿尿</button>
            <button class="select-btn ${val.kind === 'dirty' ? 'active' : ''}" data-value="dirty">大便</button>
            <button class="select-btn ${val.kind === 'both' ? 'active' : ''}" data-value="both">尿+便</button>
          </div>
        </div>
      `;
      break;

    case 'temperature':
      formHtml = `
        <div class="form-group">
          <label class="form-label">體溫 (°C)</label>
          <div class="stepper">
            <button class="stepper__btn" data-target="celsius" data-delta="-0.1">${icon('minus')}</button>
            <div class="stepper__value">
              <input type="number" id="celsius" value="${val.celsius || 36.5}" min="34" max="42" step="0.1" inputmode="decimal">
            </div>
            <div class="stepper__unit">°C</div>
            <button class="stepper__btn" data-target="celsius" data-delta="0.1">${icon('plus')}</button>
          </div>
        </div>
      `;
      break;

    case 'weight':
      formHtml = `
        <div class="form-group">
          <label class="form-label">體重 (kg)</label>
          <div class="stepper">
            <button class="stepper__btn" data-target="kg" data-delta="-0.1">${icon('minus')}</button>
            <div class="stepper__value">
              <input type="number" id="kg" value="${val.kg || 3.0}" min="0" step="0.1" inputmode="decimal">
            </div>
            <div class="stepper__unit">kg</div>
            <button class="stepper__btn" data-target="kg" data-delta="0.1">${icon('plus')}</button>
          </div>
        </div>
      `;
      break;

    case 'height':
      formHtml = `
        <div class="form-group">
          <label class="form-label">身長 (cm)</label>
          <div class="stepper">
            <button class="stepper__btn" data-target="cm" data-delta="-0.5">${icon('minus')}</button>
            <div class="stepper__value">
              <input type="number" id="cm" value="${val.cm || 50}" min="0" step="0.5" inputmode="decimal">
            </div>
            <div class="stepper__unit">cm</div>
            <button class="stepper__btn" data-target="cm" data-delta="0.5">${icon('plus')}</button>
          </div>
        </div>
      `;
      break;

    case 'food':
      formHtml = `
        <div class="form-group">
          <label class="form-label">食物名稱</label>
          <input type="text" class="form-input" id="food_name" value="${escapeHtml(val.name)}" placeholder="例如：米糊、蘋果泥...">
        </div>
        <div class="form-group">
          <label class="form-label">份量</label>
          <input type="text" class="form-input" id="food_amount" value="${escapeHtml(val.amount)}" placeholder="例如：半碗、30g...">
        </div>
        <div class="form-group">
          <label class="form-label">反應</label>
          <textarea class="form-input" id="food_reaction" placeholder="（選填）食用後的反應...">${escapeHtml(val.reaction)}</textarea>
        </div>
      `;
      break;

    case 'bath':
      // Bath is simple — just time + note
      formHtml = '';
      break;

    case 'sleep': {
      const sleepDateVal = val.startAt ? val.startAt.slice(0, 10) : dateStr;
      const startTime = val.startAt ? new Date(val.startAt) : new Date();
      const endTime = val.endAt ? new Date(val.endAt) : null;
      const startHM = String(startTime.getHours()).padStart(2, '0') + ':' + String(startTime.getMinutes()).padStart(2, '0');
      const endHM = endTime ? String(endTime.getHours()).padStart(2, '0') + ':' + String(endTime.getMinutes()).padStart(2, '0') : '';
      formHtml = `
        <div class="form-group">
          <label class="form-label">日期</label>
          <input type="date" class="form-input" id="sleep_date" value="${sleepDateVal}">
        </div>
        <div class="form-group">
          <label class="form-label">開始時間</label>
          <input type="time" class="form-input" id="sleep_start" value="${startHM}">
        </div>
        <div class="form-group">
          <label class="form-label">結束時間（選填）</label>
          <input type="time" class="form-input" id="sleep_end" value="${endHM}">
        </div>
      `;
      break;
    }
  }

  // Common fields: time, date, note (sleep has its own date/time inputs)
  const showTimeDate = type !== 'sleep';

  container.innerHTML = `
    <div class="card mb-lg">
      <div class="flex items-center gap-md mb-lg">
        <div style="color: var(--primary); width: 36px; height: 36px;">${icon(type)}</div>
        <h2 style="font-size: var(--font-size-xl);">${categories.find(c => c.type === type)?.label || type}</h2>
      </div>
      ${formHtml}
      ${showTimeDate ? `
        <div class="form-group">
          <label class="form-label">日期</label>
          <input type="date" class="form-input" id="record-date" value="${dateStr}">
        </div>
        <div class="form-group">
          <label class="form-label">時間</label>
          <input type="time" class="form-input" id="record-time" value="${timeStr}">
        </div>
      ` : ''}
      <div class="form-group">
        <label class="form-label">備註（選填）</label>
        <textarea class="form-input" id="record-note" rows="2" placeholder="額外備註...">${escapeHtml(noteVal)}</textarea>
      </div>
    </div>
    <button class="btn btn-primary btn-block btn-lg" id="save-record">
      ${icon('check')} ${isEdit ? '更新記錄' : '儲存記錄'}
    </button>
  `;

  // Stepper buttons
  container.querySelectorAll('.stepper__btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.target);
      const delta = parseFloat(btn.dataset.delta);
      if (!target) return;
      let val = parseFloat(target.value) || 0;
      val = Math.max(0, +(val + delta).toFixed(1));
      target.value = val;
    });
  });

  // Select group (diaper kind)
  const diaperGroup = container.querySelector('#diaper-kind');
  if (diaperGroup) {
    diaperGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('.select-btn');
      if (!btn) return;
      diaperGroup.querySelectorAll('.select-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  }

  // Save button
  document.getElementById('save-record')?.addEventListener('click', async () => {
    try {
      const value = collectValue(type, container, isEdit);
      if (value === null) return; // Validation failed

      const dateInput = container.querySelector('#record-date');
      const timeInput = container.querySelector('#record-time');
      const noteInput = container.querySelector('#record-note');

      let time;
      if (type === 'sleep') {
        // Use startAt computed by collectValue as the record timestamp
        time = value.startAt || new Date().toISOString();
      } else if (dateInput && timeInput) {
        const [h, m] = timeInput.value.split(':').map(Number);
        const d = new Date(dateInput.value);
        d.setHours(h, m, 0, 0);
        time = d.toISOString();
      } else {
        time = new Date().toISOString();
      }

      if (isEdit) {
        await updateRecord(editRecord.id, { type, value, time, note: noteInput?.value || '' });
        showToast('已更新記錄');
      } else {
        await createRecord({ babyId: baby.id, type, value, time, note: noteInput?.value || '' });
        showToast('已儲存記錄');
      }
      if (saveCallback) {
        saveCallback();
      } else {
        navigate('/home');
      }
    } catch (err) {
      showToast('儲存失敗：' + err.message, { type: 'error' });
    }
  });
}

function collectValue(type, container, isEdit) {
  switch (type) {
    case 'feeding': {
      const formula_ml = parseFloat(document.getElementById('formula_ml')?.value) || 0;
      const breast_ml = parseFloat(document.getElementById('breast_ml')?.value) || 0;
      if (formula_ml === 0 && breast_ml === 0) {
        showToast('請輸入奶量', { type: 'error' });
        return null;
      }
      return { formula_ml, breast_ml };
    }
    case 'diaper': {
      const active = container.querySelector('#diaper-kind .select-btn.active');
      if (!active) {
        showToast('請選擇尿布類型', { type: 'error' });
        return null;
      }
      return { kind: active.dataset.value };
    }
    case 'temperature':
      return { celsius: parseFloat(document.getElementById('celsius')?.value) || 36.5 };
    case 'weight':
      return { kg: parseFloat(document.getElementById('kg')?.value) || 0 };
    case 'height':
      return { cm: parseFloat(document.getElementById('cm')?.value) || 0 };
    case 'food':
      return {
        name: document.getElementById('food_name')?.value || '',
        amount: document.getElementById('food_amount')?.value || '',
        reaction: document.getElementById('food_reaction')?.value || '',
      };
    case 'bath':
      return { note: '' };
    case 'sleep': {
      const sleepDateInput = document.getElementById('sleep_date');
      const startInput = document.getElementById('sleep_start');
      const endInput = document.getElementById('sleep_end');
      const sleepDateStr = sleepDateInput?.value || nowDateStr();
      const [sh, sm] = (startInput?.value || '00:00').split(':').map(Number);
      const startDate = new Date(sleepDateStr + 'T00:00:00');
      startDate.setHours(sh, sm, 0, 0);
      const startAt = startDate.toISOString();
      let endAt = null;
      if (endInput?.value) {
        const [eh, em] = endInput.value.split(':').map(Number);
        const endDate = new Date(sleepDateStr + 'T00:00:00');
        endDate.setHours(eh, em, 0, 0);
        // Handle cross-midnight sleep
        if (endDate <= startDate) endDate.setDate(endDate.getDate() + 1);
        endAt = endDate.toISOString();
      }
      return { startAt, endAt };
    }
    default:
      return {};
  }
}

/**
 * Open the add/edit record form as a bottom-sheet modal.
 * @param {{ type?: string, editId?: string }} opts
 * @param {Function} [onSaved] - Called after successful save (modal will already be closed).
 */
export async function openAddRecordSheet(opts = {}, onSaved) {
  const baby = await getSelectedBaby();
  if (!baby) {
    showToast('請先新增寶寶', { type: 'error' });
    return;
  }

  let editRecord = null;
  if (opts.editId) {
    editRecord = await getRecord(opts.editId);
  }

  const initialType = editRecord ? editRecord.type : (opts.type || null);
  const saveCallback = () => {
    closeModal();
    if (onSaved) onSaved();
  };

  if (!initialType) {
    // Show category grid for selection
    openModal(`
      ${modalHeader('選擇記錄類型')}
      <div class="category-grid" id="sheet-cat-grid">
        ${categories.map(c => `
          <button class="category-btn" data-type="${c.type}">
            ${icon(c.icon)}
            <span>${c.label}</span>
          </button>
        `).join('')}
      </div>
    `);
    document.getElementById('sheet-cat-grid')?.addEventListener('click', async (e) => {
      const btn = e.target.closest('.category-btn');
      if (!btn) return;
      const selectedType = btn.dataset.type;
      const title = categories.find(c => c.type === selectedType)?.label || '新增記錄';
      openModal(`
        ${modalHeader(title)}
        <div id="add-form"></div>
      `);
      await renderForm(selectedType, baby, null, saveCallback);
    });
    return;
  }

  const title = editRecord
    ? '編輯記錄'
    : (categories.find(c => c.type === initialType)?.label || '新增記錄');

  openModal(`
    ${modalHeader(title)}
    <div id="add-form"></div>
  `);
  await renderForm(initialType, baby, editRecord, saveCallback);
}
