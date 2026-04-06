/**
 * stats.js — Statistics page with Chart.js charts.
 */
import { icon } from '../components/icons.js';
import { renderBabySelector, getSelectedBaby, onBabyChange } from '../components/babySelector.js';
import { getRecordsByDateRange } from '../modules/records.js';

let chartInstance = null;

function toDateStr(d) {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function getDaysArray(startDate, endDate) {
  const days = [];
  const d = new Date(startDate);
  const end = new Date(endDate);
  while (d <= end) {
    days.push(toDateStr(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

export async function renderStats() {
  const app = document.getElementById('app');

  // Default: last 7 days
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 6);

  app.innerHTML = `
    <div class="page-header">
      <div id="baby-selector-stats" style="flex:1;"></div>
    </div>
    <div class="page-content">
      <div class="tabs" id="stats-tabs">
        <button class="tab-btn active" data-tab="feeding">喝奶</button>
        <button class="tab-btn" data-tab="growth">成長</button>
        <button class="tab-btn" data-tab="diaper">尿布</button>
        <button class="tab-btn" data-tab="sleep">睡眠</button>
      </div>
      <div class="card mb-lg">
        <div style="margin-bottom: var(--space-md);">
          <label class="form-label" style="margin-bottom: var(--space-sm);">日期範圍</label>
          <div style="display:flex; align-items:center; gap:var(--space-sm);">
            <input type="date" class="form-input" id="stats-start" value="${toDateStr(startDate)}" style="flex:1; min-width:0; font-size:13px; min-height:44px; padding:8px;">
            <span style="flex-shrink:0; color:var(--text-secondary);">～</span>
            <input type="date" class="form-input" id="stats-end" value="${toDateStr(endDate)}" style="flex:1; min-width:0; font-size:13px; min-height:44px; padding:8px;">
          </div>
        </div>
        <div class="flex gap-sm">
          <button class="btn btn-sm btn-secondary flex-1" data-range="7">7 天</button>
          <button class="btn btn-sm btn-secondary flex-1" data-range="14">14 天</button>
          <button class="btn btn-sm btn-secondary flex-1" data-range="30">30 天</button>
        </div>
      </div>
      <div class="card" id="stats-chart-container" style="position:relative; height: 300px; padding: 0; overflow: hidden;">
        <canvas id="stats-chart"></canvas>
      </div>
      <div id="stats-summary" class="mt-lg"></div>
    </div>
  `;

  await renderBabySelector(document.getElementById('baby-selector-stats'));
  onBabyChange(() => refreshChart());

  // Tab switching
  const tabs = document.getElementById('stats-tabs');
  tabs.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    tabs.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    refreshChart();
  });

  // Date range shortcuts
  document.querySelectorAll('[data-range]').forEach(btn => {
    btn.addEventListener('click', () => {
      const days = parseInt(btn.dataset.range);
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - (days - 1));
      document.getElementById('stats-start').value = toDateStr(start);
      document.getElementById('stats-end').value = toDateStr(end);
      refreshChart();
    });
  });

  // Date input changes
  document.getElementById('stats-start').addEventListener('change', refreshChart);
  document.getElementById('stats-end').addEventListener('change', refreshChart);

  await refreshChart();
}

async function refreshChart() {
  const baby = await getSelectedBaby();
  if (!baby) return;

  const startDate = document.getElementById('stats-start')?.value;
  const endDate = document.getElementById('stats-end')?.value;
  if (!startDate || !endDate) return;

  const activeTab = document.querySelector('#stats-tabs .tab-btn.active')?.dataset.tab || 'feeding';
  const records = await getRecordsByDateRange(baby.id, startDate, endDate);
  const days = getDaysArray(startDate, endDate);

  // Destroy previous chart
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  // Always restore a fresh canvas (prevents tab-switch bug after empty-state replaces canvas)
  const chartContainer = document.getElementById('stats-chart-container');
  if (!chartContainer) return;
  chartContainer.innerHTML = '<canvas id="stats-chart"></canvas>';
  const canvas = document.getElementById('stats-chart');

  const Chart = window.Chart;
  if (!Chart) {
    chartContainer.innerHTML = '<p style="text-align:center;color:var(--text-hint);padding:var(--space-xl);">Chart.js 載入失敗</p>';
    return;
  }

  switch (activeTab) {
    case 'feeding':
      renderFeedingChart(Chart, canvas, records, days);
      break;
    case 'growth':
      renderGrowthChart(Chart, canvas, chartContainer, records, days);
      break;
    case 'diaper':
      renderDiaperChart(Chart, canvas, records, days);
      break;
    case 'sleep':
      renderSleepChart(Chart, canvas, records, days);
      break;
  }
}

function renderFeedingChart(Chart, canvas, records, days) {
  const feedingByDay = {};
  days.forEach(d => feedingByDay[d] = { count: 0, formula: 0, breast: 0 });

  records.filter(r => r.type === 'feeding').forEach(r => {
    const d = r.date;
    if (feedingByDay[d]) {
      feedingByDay[d].count++;
      feedingByDay[d].formula += r.value.formula_ml || 0;
      feedingByDay[d].breast += r.value.breast_ml || 0;
    }
  });

  const labels = days.map(d => d.slice(5)); // MM-DD
  chartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: '配方奶 (ml)',
          data: days.map(d => feedingByDay[d].formula),
          backgroundColor: 'rgba(67, 160, 71, 0.7)',
          borderRadius: 4,
        },
        {
          label: '母乳 (ml)',
          data: days.map(d => feedingByDay[d].breast),
          backgroundColor: 'rgba(129, 199, 132, 0.7)',
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top' },
      },
      scales: {
        x: { stacked: true },
        y: { stacked: true, beginAtZero: true, title: { display: true, text: 'ml' } },
      },
    },
  });

  // Summary
  const totalFeedings = Object.values(feedingByDay).reduce((s, d) => s + d.count, 0);
  const totalMl = Object.values(feedingByDay).reduce((s, d) => s + d.formula + d.breast, 0);
  const summary = document.getElementById('stats-summary');
  if (summary) {
    summary.innerHTML = `
      <div class="card">
        <div class="flex justify-between items-center mb-md">
          <span style="font-size: var(--font-size-lg);">期間總計</span>
        </div>
        <div class="status-cards">
          <div class="status-card">
            <div class="status-card__header"><span>總次數</span></div>
            <div class="status-card__value">${totalFeedings} 次</div>
          </div>
          <div class="status-card">
            <div class="status-card__header"><span>總奶量</span></div>
            <div class="status-card__value">${totalMl} ml</div>
          </div>
        </div>
      </div>
    `;
  }
}

function renderGrowthChart(Chart, canvas, container, records, days) {
  const weightRecords = records.filter(r => r.type === 'weight').sort((a, b) => new Date(a.time) - new Date(b.time));
  const heightRecords = records.filter(r => r.type === 'height').sort((a, b) => new Date(a.time) - new Date(b.time));

  const datasets = [];
  const labels = [];
  const labelSet = new Set();

  weightRecords.forEach(r => labelSet.add(r.date));
  heightRecords.forEach(r => labelSet.add(r.date));
  const sortedLabels = [...labelSet].sort();
  sortedLabels.forEach(l => labels.push(l.slice(5)));

  if (weightRecords.length > 0) {
    const weightByDate = {};
    weightRecords.forEach(r => weightByDate[r.date] = r.value.kg);
    datasets.push({
      label: '體重 (kg)',
      data: sortedLabels.map(d => weightByDate[d] ?? null),
      borderColor: 'rgb(67, 160, 71)',
      backgroundColor: 'rgba(67, 160, 71, 0.1)',
      fill: true,
      tension: 0.3,
      yAxisID: 'y',
      spanGaps: true,
    });
  }

  if (heightRecords.length > 0) {
    const heightByDate = {};
    heightRecords.forEach(r => heightByDate[r.date] = r.value.cm);
    datasets.push({
      label: '身長 (cm)',
      data: sortedLabels.map(d => heightByDate[d] ?? null),
      borderColor: 'rgb(255, 171, 145)',
      backgroundColor: 'rgba(255, 171, 145, 0.1)',
      fill: true,
      tension: 0.3,
      yAxisID: 'y1',
      spanGaps: true,
    });
  }

  if (datasets.length === 0) {
    container.innerHTML = '<p style="text-align:center;color:var(--text-hint);padding:var(--space-xl);">此期間沒有體重/身長紀錄</p>';
    document.getElementById('stats-summary').innerHTML = '';
    return;
  }

  const scales = {
    y: { position: 'left', title: { display: true, text: 'kg' }, beginAtZero: false },
  };
  if (heightRecords.length > 0) {
    scales.y1 = { position: 'right', title: { display: true, text: 'cm' }, beginAtZero: false, grid: { drawOnChartArea: false } };
  }

  chartInstance = new Chart(canvas, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'top' } },
      scales,
    },
  });

  document.getElementById('stats-summary').innerHTML = '';
}

function renderDiaperChart(Chart, canvas, records, days) {
  const diaperByDay = {};
  days.forEach(d => diaperByDay[d] = { wet: 0, dirty: 0, both: 0 });

  records.filter(r => r.type === 'diaper').forEach(r => {
    const d = r.date;
    if (diaperByDay[d]) {
      const kind = r.value.kind || 'wet';
      diaperByDay[d][kind]++;
    }
  });

  const labels = days.map(d => d.slice(5));
  chartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: '尿尿',
          data: days.map(d => diaperByDay[d].wet),
          backgroundColor: 'rgba(30, 136, 229, 0.7)',
          borderRadius: 4,
        },
        {
          label: '大便',
          data: days.map(d => diaperByDay[d].dirty),
          backgroundColor: 'rgba(255, 171, 0, 0.7)',
          borderRadius: 4,
        },
        {
          label: '都有',
          data: days.map(d => diaperByDay[d].both),
          backgroundColor: 'rgba(156, 39, 176, 0.5)',
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'top' } },
      scales: {
        x: { stacked: true },
        y: { stacked: true, beginAtZero: true, title: { display: true, text: '次' }, ticks: { stepSize: 1 } },
      },
    },
  });

  const totalDiaper = Object.values(diaperByDay).reduce((s, d) => s + d.wet + d.dirty + d.both, 0);
  const summary = document.getElementById('stats-summary');
  if (summary) {
    summary.innerHTML = `
      <div class="card">
        <div class="status-cards">
          <div class="status-card">
            <div class="status-card__header"><span>期間總換次數</span></div>
            <div class="status-card__value">${totalDiaper} 次</div>
          </div>
        </div>
      </div>
    `;
  }
}

function renderSleepChart(Chart, canvas, records, days) {
  const sleepByDay = {};
  days.forEach(d => sleepByDay[d] = 0);

  records.filter(r => r.type === 'sleep' && r.value.startAt && r.value.endAt).forEach(r => {
    const d = r.date;
    if (sleepByDay[d] !== undefined) {
      const start = new Date(r.value.startAt);
      const end = new Date(r.value.endAt);
      const hours = (end - start) / (1000 * 60 * 60);
      if (hours > 0 && hours < 24) {
        sleepByDay[d] += hours;
      }
    }
  });

  const labels = days.map(d => d.slice(5));
  chartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: '睡眠時數',
        data: days.map(d => +sleepByDay[d].toFixed(1)),
        borderColor: 'rgb(67, 160, 71)',
        backgroundColor: 'rgba(67, 160, 71, 0.15)',
        fill: true,
        tension: 0.3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'top' } },
      scales: {
        y: { beginAtZero: true, title: { display: true, text: '小時' } },
      },
    },
  });

  const totalHours = Object.values(sleepByDay).reduce((s, h) => s + h, 0);
  const avgHours = days.length > 0 ? (totalHours / days.length).toFixed(1) : 0;
  const summary = document.getElementById('stats-summary');
  if (summary) {
    summary.innerHTML = `
      <div class="card">
        <div class="status-cards">
          <div class="status-card">
            <div class="status-card__header"><span>平均每日睡眠</span></div>
            <div class="status-card__value">${avgHours} 小時</div>
          </div>
        </div>
      </div>
    `;
  }
}

export function cleanupStats() {
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
}
