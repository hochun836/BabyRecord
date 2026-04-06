/**
 * history.js — History page: calendar + day timeline with edit/delete.
 */
import { icon } from '../components/icons.js';
import { renderBabySelector, getSelectedBaby, onBabyChange } from '../components/babySelector.js';
import { getRecordsByDate, getRecordDatesInMonth, deleteRecord, RECORD_TYPES } from '../modules/records.js';
import { confirm as confirmDialog } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { navigate } from '../router.js';

let currentYear, currentMonth, selectedDate;

function toDateStr(d) {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function formatTime(isoStr) {
  const d = new Date(isoStr);
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

export async function renderHistory() {
  const app = document.getElementById('app');
  const now = new Date();
  currentYear = now.getFullYear();
  currentMonth = now.getMonth() + 1;
  selectedDate = toDateStr(now);

  app.innerHTML = `
    <div class="page-header">
      <div id="baby-selector-history" style="flex:1;"></div>
    </div>
    <div class="page-content">
      <div id="history-calendar"></div>
      <div class="section-title mt-lg" id="history-date-title"></div>
      <div id="history-timeline"></div>
    </div>
  `;

  await renderBabySelector(document.getElementById('baby-selector-history'));
  onBabyChange(() => refreshHistory());

  await refreshHistory();
}

async function refreshHistory() {
  await renderCalendar();
  await renderDayTimeline();
}

async function renderCalendar() {
  const container = document.getElementById('history-calendar');
  if (!container) return;

  const baby = await getSelectedBaby();
  let recordDates = new Set();
  if (baby) {
    recordDates = await getRecordDatesInMonth(baby.id, currentYear, currentMonth);
  }

  const firstDay = new Date(currentYear, currentMonth - 1, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const today = toDateStr(new Date());

  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];

  let daysHtml = '';
  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) {
    daysHtml += '<button class="calendar__day empty"></button>';
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isToday = dateStr === today;
    const isSelected = dateStr === selectedDate;
    const hasRecords = recordDates.has(dateStr);
    const classes = [
      'calendar__day',
      isToday ? 'today' : '',
      isSelected ? 'selected' : '',
      hasRecords ? 'has-records' : '',
    ].filter(Boolean).join(' ');
    daysHtml += `<button class="${classes}" data-date="${dateStr}">${d}</button>`;
  }

  container.innerHTML = `
    <div class="calendar">
      <div class="calendar__header">
        <button class="calendar__nav" id="cal-prev">${icon('chevronLeft')}</button>
        <span class="calendar__title">${currentYear} 年 ${currentMonth} 月</span>
        <button class="calendar__nav" id="cal-next">${icon('chevronRight')}</button>
      </div>
      <div class="calendar__weekdays">
        ${weekdays.map(w => `<div class="calendar__weekday">${w}</div>`).join('')}
      </div>
      <div class="calendar__days">${daysHtml}</div>
    </div>
  `;

  // Navigation
  container.querySelector('#cal-prev').addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 1) { currentMonth = 12; currentYear--; }
    renderCalendar();
  });
  container.querySelector('#cal-next').addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 12) { currentMonth = 1; currentYear++; }
    renderCalendar();
  });

  // Date selection
  container.querySelector('.calendar__days').addEventListener('click', (e) => {
    const dayBtn = e.target.closest('.calendar__day:not(.empty)');
    if (!dayBtn) return;
    selectedDate = dayBtn.dataset.date;
    // Refresh calendar highlight + timeline
    renderCalendar();
    renderDayTimeline();
  });
}

async function renderDayTimeline() {
  const container = document.getElementById('history-timeline');
  const titleEl = document.getElementById('history-date-title');
  if (!container || !titleEl) return;

  const baby = await getSelectedBaby();
  if (!baby) {
    container.innerHTML = '';
    titleEl.textContent = '';
    return;
  }

  const d = new Date(selectedDate);
  titleEl.textContent = `${d.getMonth() + 1}/${d.getDate()} 的紀錄`;

  const records = await getRecordsByDate(baby.id, selectedDate);

  if (records.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: var(--space-xl); color: var(--text-hint);">
        <p style="font-size: var(--font-size-lg);">這天沒有紀錄</p>
      </div>
    `;
    return;
  }

  // Group by HH:MM
  const groups = {};
  for (const r of records) {
    const key = formatTime(r.time);
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  }

  const sortedKeys = Object.keys(groups).sort();

  container.innerHTML = `
    <div class="timeline">
      ${sortedKeys.map(time => `
        <div class="timeline-group">
          <div class="timeline-dot"></div>
          <div class="timeline-time">${time}</div>
          <div class="timeline-items">
            ${groups[time].map(r => renderTimelineItem(r)).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;

  // Edit / Delete handlers
  container.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', () => {
      navigate('/add', { editId: btn.dataset.id });
    });
  });

  container.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ok = await confirmDialog('確定要刪除這筆紀錄嗎？', { danger: true, confirmText: '刪除' });
      if (!ok) return;
      await deleteRecord(btn.dataset.id);
      showToast('已刪除');
      renderDayTimeline();
    });
  });
}

function renderTimelineItem(record) {
  const typeName = RECORD_TYPES[record.type] || record.type;
  let valueText = '';

  switch (record.type) {
    case 'feeding': {
      const parts = [];
      if (record.value.formula_ml) parts.push(`配方奶 ${record.value.formula_ml}ml`);
      if (record.value.breast_ml) parts.push(`母乳 ${record.value.breast_ml}ml`);
      valueText = parts.join('、') || '—';
      break;
    }
    case 'diaper': {
      const kindMap = { wet: '尿尿', dirty: '大便', both: '尿尿+大便' };
      valueText = kindMap[record.value.kind] || '—';
      break;
    }
    case 'temperature':
      valueText = `${record.value.celsius}°C`;
      break;
    case 'weight':
      valueText = `${record.value.kg} kg`;
      break;
    case 'height':
      valueText = `${record.value.cm} cm`;
      break;
    case 'food':
      valueText = escapeHtml(record.value.name || '副食品');
      if (record.value.amount) valueText += ` (${escapeHtml(record.value.amount)})`;
      break;
    case 'bath':
      valueText = '已洗澡';
      break;
    case 'sleep':
      if (record.value.endAt) {
        valueText = `${formatTime(record.value.startAt)} ~ ${formatTime(record.value.endAt)}`;
      } else {
        valueText = `${formatTime(record.value.startAt)} 開始睡（進行中）`;
      }
      break;
    default:
      valueText = '—';
  }

  return `
    <div class="timeline-item">
      <div class="timeline-item__icon">${icon(record.type)}</div>
      <div class="timeline-item__content">
        <div class="timeline-item__type">${typeName}</div>
        <div class="timeline-item__value">${valueText}</div>
        ${record.note ? `<div style="font-size: var(--font-size-sm); color: var(--text-hint); margin-top: 2px;">${escapeHtml(record.note)}</div>` : ''}
      </div>
      <div class="timeline-item__actions">
        <button data-action="edit" data-id="${record.id}" title="編輯">${icon('edit')}</button>
        <button data-action="delete" data-id="${record.id}" title="刪除" style="color: var(--danger);">${icon('delete')}</button>
      </div>
    </div>
  `;
}
