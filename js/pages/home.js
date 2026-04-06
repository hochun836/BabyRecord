/**
 * home.js — Dashboard page: today summary + quick add buttons.
 */
import { icon } from '../components/icons.js';
import { renderBabySelector, getSelectedBaby, onBabyChange } from '../components/babySelector.js';
import { getRecordsByDate, getLastRecordByType, RECORD_TYPES } from '../modules/records.js';
import { getNextReminder } from '../modules/reminder.js';
import { navigate } from '../router.js';

function toDateStr(d) {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function formatTime(isoStr) {
  const d = new Date(isoStr);
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

function timeAgo(isoStr) {
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '剛才';
  if (mins < 60) return `${mins} 分鐘前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小時前`;
  return `${Math.floor(hours / 24)} 天前`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export async function renderHome() {
  const app = document.getElementById('app');
  const baby = await getSelectedBaby();

  app.innerHTML = `
    <div class="page-header">
      <div id="baby-selector-home" style="flex:1;"></div>
    </div>
    <div class="page-content" id="home-content">
      <div id="home-reminder"></div>
      <div id="home-status"></div>
      <div class="section-title" style="margin-top: var(--space-lg);">快速新增</div>
      <div id="home-quickadd"></div>
      <div class="section-title" style="margin-top: var(--space-lg);">今日作息</div>
      <div id="home-timeline"></div>
    </div>
  `;

  await renderBabySelector(document.getElementById('baby-selector-home'));
  onBabyChange(() => renderHomeContent());

  await renderHomeContent();
}

async function renderHomeContent() {
  const baby = await getSelectedBaby();
  if (!baby) {
    document.getElementById('home-content').innerHTML = `
      <div class="empty-state">
        ${icon('baby')}
        <p class="empty-state__title">尚未新增寶寶</p>
        <p class="empty-state__desc">前往「設定」頁新增第一位寶寶</p>
        <button class="btn btn-primary mt-lg" onclick="location.hash='#/settings'">前往設定</button>
      </div>
    `;
    return;
  }

  await Promise.all([
    renderReminderBanner(),
    renderStatusCards(baby),
    renderQuickAdd(),
    renderTodayTimeline(baby),
  ]);
}

async function renderReminderBanner() {
  const container = document.getElementById('home-reminder');
  if (!container) return;
  const next = await getNextReminder();
  if (!next) {
    container.innerHTML = '';
    return;
  }
  const typeLabel = next.type === 'feeding' ? '餵奶' : '睡覺';
  container.innerHTML = `
    <div class="reminder-banner">
      ${icon('bell')}
      <div>
        <strong>${escapeHtml(next.babyName)}</strong> — ${typeLabel}提醒
        <br>還有 <strong>${next.minutesLeft}</strong> 分鐘
        ${next.message ? `<br><span style="font-size: var(--font-size-sm);">${escapeHtml(next.message)}</span>` : ''}
      </div>
    </div>
  `;
}

async function renderStatusCards(baby) {
  const container = document.getElementById('home-status');
  if (!container) return;

  const [lastFeeding, lastDiaper, lastTemp, lastSleep] = await Promise.all([
    getLastRecordByType(baby.id, 'feeding'),
    getLastRecordByType(baby.id, 'diaper'),
    getLastRecordByType(baby.id, 'temperature'),
    getLastRecordByType(baby.id, 'sleep'),
  ]);

  const cards = [];

  // Feeding card
  if (lastFeeding) {
    const v = lastFeeding.value;
    const total = (v.formula_ml || 0) + (v.breast_ml || 0);
    cards.push(`
      <div class="status-card">
        <div class="status-card__header">${icon('feeding')}<span>上次喝奶</span></div>
        <div class="status-card__value">${total} ml</div>
        <div class="status-card__time">${timeAgo(lastFeeding.time)}</div>
      </div>
    `);
  }

  // Diaper card
  if (lastDiaper) {
    const kindMap = { wet: '尿尿', dirty: '大便', both: '尿尿+大便' };
    cards.push(`
      <div class="status-card">
        <div class="status-card__header">${icon('diaper')}<span>上次尿布</span></div>
        <div class="status-card__value">${kindMap[lastDiaper.value.kind] || '—'}</div>
        <div class="status-card__time">${timeAgo(lastDiaper.time)}</div>
      </div>
    `);
  }

  // Temperature card
  if (lastTemp) {
    cards.push(`
      <div class="status-card">
        <div class="status-card__header">${icon('temperature')}<span>上次體溫</span></div>
        <div class="status-card__value">${lastTemp.value.celsius}°C</div>
        <div class="status-card__time">${timeAgo(lastTemp.time)}</div>
      </div>
    `);
  }

  // Sleep card
  if (lastSleep) {
    const isAsleep = lastSleep.value.endAt === null;
    cards.push(`
      <div class="status-card">
        <div class="status-card__header">${icon('sleep')}<span>睡眠狀態</span></div>
        <div class="status-card__value">${isAsleep ? '💤 睡覺中' : '☀️ 已醒來'}</div>
        <div class="status-card__time">${timeAgo(lastSleep.time)}</div>
      </div>
    `);
  }

  if (cards.length === 0) {
    container.innerHTML = `
      <div class="card" style="text-align: center; color: var(--text-hint); padding: var(--space-xl);">
        <p style="font-size: var(--font-size-lg);">還沒有任何紀錄</p>
        <p>點下方「快速新增」開始記錄吧！</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `<div class="status-cards">${cards.join('')}</div>`;
}

function renderQuickAdd() {
  const container = document.getElementById('home-quickadd');
  if (!container) return;

  const categories = [
    { type: 'feeding',     label: '喝奶',   icon: 'feeding' },
    { type: 'diaper',      label: '尿布',   icon: 'diaper' },
    { type: 'sleep',       label: '睡眠',   icon: 'sleep' },
    { type: 'temperature', label: '體溫',   icon: 'temperature' },
    { type: 'food',        label: '副食品', icon: 'food' },
    { type: 'bath',        label: '洗澡',   icon: 'bath' },
  ];

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
    navigate('/add', { type: btn.dataset.type });
  });
}

async function renderTodayTimeline(baby) {
  const container = document.getElementById('home-timeline');
  if (!container) return;

  const today = toDateStr(new Date());
  const records = await getRecordsByDate(baby.id, today);

  if (records.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: var(--space-lg); color: var(--text-hint);">
        今天還沒有紀錄
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
        valueText = `${formatTime(record.value.startAt)} 開始睡`;
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
      </div>
    </div>
  `;
}
