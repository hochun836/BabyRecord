/**
 * recordDetail.js — Show a record's full details in a bottom-sheet modal.
 * Shared by home.js, history.js.
 */
import { icon } from './icons.js';
import { RECORD_TYPES } from '../modules/records.js';
import { openModal, modalHeader } from './modal.js';
import { navigate } from '../router.js';

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function formatDateTime(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatHM(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatDuration(startIso, endIso) {
  if (!startIso || !endIso) return null;
  const ms = new Date(endIso) - new Date(startIso);
  if (ms <= 0) return null;
  const totalMins = Math.round(ms / 60000);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h > 0) return `${h} 小時 ${m} 分鐘`;
  return `${m} 分鐘`;
}

/**
 * Build detail row data for a record.
 * @returns {Array<[label, value]>}
 */
function buildDetailRows(record) {
  const rows = [];
  const v = record.value || {};

  switch (record.type) {
    case 'feeding': {
      if (v.formula_ml) rows.push(['配方奶', `${v.formula_ml} ml`]);
      if (v.breast_ml)  rows.push(['母乳',   `${v.breast_ml} ml`]);
      const total = (v.formula_ml || 0) + (v.breast_ml || 0);
      if (total > 0) rows.push(['總量', `${total} ml`]);
      break;
    }
    case 'diaper': {
      const kindMap = { wet: '尿尿', dirty: '大便', both: '尿尿＋大便' };
      rows.push(['種類', kindMap[v.kind] || '—']);
      break;
    }
    case 'temperature':
      rows.push(['體溫', `${v.celsius} °C`]);
      break;
    case 'weight':
      rows.push(['體重', `${v.kg} kg`]);
      break;
    case 'height':
      rows.push(['身長', `${v.cm} cm`]);
      break;
    case 'food':
      if (v.name)     rows.push(['食物名稱', escapeHtml(v.name)]);
      if (v.amount)   rows.push(['份量',     escapeHtml(v.amount)]);
      if (v.reaction) rows.push(['反應',     escapeHtml(v.reaction)]);
      break;
    case 'bath':
      rows.push(['狀態', '✅ 已完成洗澡']);
      break;
    case 'sleep': {
      rows.push(['開始', formatHM(v.startAt)]);
      if (v.endAt) {
        rows.push(['結束', formatHM(v.endAt)]);
        const dur = formatDuration(v.startAt, v.endAt);
        if (dur) rows.push(['持續', dur]);
      } else {
        rows.push(['狀態', '💤 睡眠進行中']);
      }
      break;
    }
    default:
      break;
  }

  return rows;
}

/**
 * Open a modal showing full record detail.
 * @param {object} record - Full record object from IndexedDB.
 * @param {{ showEdit?: boolean }} opts
 */
export function showRecordDetail(record, opts = {}) {
  const typeName = RECORD_TYPES[record.type] || record.type;
  const rows = buildDetailRows(record);
  const showEdit = opts.showEdit !== false;

  const rowsHtml = rows.map(([label, val]) => `
    <div style="display:flex; justify-content:space-between; align-items:flex-start;
                padding: var(--space-sm) 0; border-bottom: 1px solid var(--border-light);">
      <span style="color: var(--text-secondary); font-size: var(--font-size-base);
                   flex-shrink:0; min-width: 80px;">${label}</span>
      <span style="font-size: var(--font-size-lg); font-weight: var(--font-weight-medium);
                   text-align:right; word-break:break-word;">${val}</span>
    </div>
  `).join('');

  const noteHtml = record.note ? `
    <div style="margin-top: var(--space-lg);">
      <div style="color: var(--text-secondary); font-size: var(--font-size-base);
                  margin-bottom: var(--space-xs);">備註</div>
      <div style="background: var(--primary-light); border-radius: var(--radius-sm);
                  padding: var(--space-md); font-size: var(--font-size-lg); line-height: 1.6;
                  white-space: pre-wrap; word-break:break-word;">${escapeHtml(record.note)}</div>
    </div>
  ` : '';

  const editBtnHtml = showEdit ? `
    <button class="btn btn-secondary btn-block mt-lg" id="detail-edit-btn">
      ${icon('edit')} 編輯此紀錄
    </button>
  ` : '';

  const html = `
    ${modalHeader(typeName)}
    <div style="display:flex; align-items:center; gap:var(--space-sm);
                margin-bottom: var(--space-lg); color: var(--text-hint);
                font-size: var(--font-size-sm);">
      <span style="display:flex;width:18px;height:18px;">${icon('clock')}</span>
      <span>${formatDateTime(record.time)}</span>
    </div>
    <div style="margin-bottom: var(--space-sm);">
      ${rowsHtml}
    </div>
    ${noteHtml}
    ${editBtnHtml}
  `;

  openModal(html);

  if (showEdit) {
    document.getElementById('detail-edit-btn')?.addEventListener('click', () => {
      navigate('/add', { editId: record.id });
    });
  }
}
