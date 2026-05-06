import { formatDateShort } from './records.js';

const MINT = '#3EB489';
const MINT_LIGHT = 'rgba(168,230,207,0.35)';
const MINT_ALPHA = 'rgba(62,180,137,0.15)';
const HIGHLIGHT = '#FFD700';

const baseFont = { family: "'Noto Sans KR', sans-serif", size: 13 };

const gridColor = 'rgba(168,230,207,0.3)';

/** Line chart: laps per session for a user */
export function createLapsChart(ctx, records) {
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
  const labels = sorted.map(r => formatDateShort(r.date));
  const data   = sorted.map(r => r.laps);

  return new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: '바퀴 수',
        data,
        borderColor: MINT,
        backgroundColor: MINT_ALPHA,
        borderWidth: 2.5,
        pointBackgroundColor: MINT,
        pointBorderColor: 'white',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
        fill: true,
        tension: 0.35
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => {
              const idx = items[0].dataIndex;
              return sorted[idx] ? sorted[idx].date : '';
            },
            label: (item) => ` ${item.raw}바퀴`
          }
        }
      },
      scales: {
        x: {
          grid: { color: gridColor },
          ticks: { font: baseFont, color: '#8AAE9A' }
        },
        y: {
          beginAtZero: true,
          grid: { color: gridColor },
          ticks: {
            font: baseFont, color: '#8AAE9A',
            stepSize: 1,
            callback: v => `${v}바퀴`
          }
        }
      }
    }
  });
}

/**
 * Bar chart: total laps per student in class.
 * @param {string} myUid - highlight own bar
 * @param {object} userMap - uid → userdata
 * @param {object[]} classRecords
 */
export function createClassChart(ctx, classRecords, userMap, myUid) {
  // Aggregate laps by uid
  const totals = {};
  classRecords.forEach(r => {
    totals[r.uid] = (totals[r.uid] || 0) + r.laps;
  });

  // Sort descending
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);

  const labels = entries.map(([uid], i) => {
    if (uid === myUid) return '나';
    const u = userMap[uid];
    return u ? `${u.number}번` : `학생${i+1}`;
  });

  const data   = entries.map(([, v]) => v);
  const colors = entries.map(([uid]) =>
    uid === myUid ? MINT : MINT_LIGHT
  );
  const borders = entries.map(([uid]) =>
    uid === myUid ? MINT : 'rgba(168,230,207,0.7)'
  );

  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: '총 바퀴',
        data,
        backgroundColor: colors,
        borderColor: borders,
        borderWidth: 2,
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: item => ` ${item.raw}바퀴` } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: baseFont, color: '#8AAE9A' } },
        y: {
          beginAtZero: true,
          grid: { color: gridColor },
          ticks: { font: baseFont, color: '#8AAE9A', callback: v => `${v}바퀴` }
        }
      }
    }
  });
}

/** Bar chart: weekly attendance count per day (admin) */
export function createWeeklyChart(ctx, dayLabels, dayCounts) {
  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels: dayLabels,
      datasets: [{
        label: '참여 인원',
        data: dayCounts,
        backgroundColor: MINT_LIGHT,
        borderColor: MINT,
        borderWidth: 2,
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: item => ` ${item.raw}명` } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: baseFont, color: '#8AAE9A' } },
        y: {
          beginAtZero: true,
          grid: { color: gridColor },
          ticks: { font: baseFont, color: '#8AAE9A', stepSize: 1 }
        }
      }
    }
  });
}
