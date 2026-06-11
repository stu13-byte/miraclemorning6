import { formatDateShort, normRecord } from './records.js';

const MINT = '#3EB489';
const MINT_LIGHT = 'rgba(168,230,207,0.35)';
const MINT_ALPHA = 'rgba(62,180,137,0.15)';

const baseFont = { family: "'Noto Sans KR', sans-serif", size: 13 };
const gridColor = 'rgba(168,230,207,0.3)';

/** Line chart: distance (km) per session */
export function createDistanceChart(ctx, records) {
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
  const normed = sorted.map(normRecord);
  const labels = sorted.map(r => formatDateShort(r.date));
  const data   = normed.map(r => parseFloat(r.distanceKm.toFixed(2)));

  return new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: '거리(km)',
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
            title: (items) => sorted[items[0].dataIndex]?.date ?? '',
            label: (item) => ` ${item.raw}km`
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
            callback: v => `${v}km`
          }
        }
      }
    }
  });
}

/** Bar chart: total distance (km) per student in class */
export function createClassChart(ctx, classRecords, userMap, myUid) {
  const totals = {};
  classRecords.forEach(r => {
    totals[r.uid] = (totals[r.uid] || 0) + normRecord(r).distanceKm;
  });

  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const labels  = entries.map(([uid], i) => {
    if (uid === myUid) return '나';
    const u = userMap[uid];
    return u ? `${u.number}번` : `학생${i+1}`;
  });
  const data    = entries.map(([, v]) => parseFloat(v.toFixed(2)));
  const colors  = entries.map(([uid]) => uid === myUid ? MINT : MINT_LIGHT);
  const borders = entries.map(([uid]) => uid === myUid ? MINT : 'rgba(168,230,207,0.7)');

  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: '누적 거리',
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
        tooltip: { callbacks: { label: item => ` ${item.raw}km` } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: baseFont, color: '#8AAE9A' } },
        y: {
          beginAtZero: true,
          grid: { color: gridColor },
          ticks: { font: baseFont, color: '#8AAE9A', callback: v => `${v}km` }
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

/**
 * Histogram: distribution of distanceKm values with own bar highlighted.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number[]} valuesArray  - all classmates' distanceKm for a given date
 * @param {number}   myValue      - current user's distanceKm
 * @param {number}   binCount     - number of bins (default 7)
 */
export function createDistributionChart(ctx, valuesArray, myValue, binCount = 7) {
  if (!valuesArray.length) return null;

  const min = Math.min(...valuesArray);
  const max = Math.max(...valuesArray);
  const range = max - min;
  const binSize = range > 0 ? range / binCount : 1;

  const bins = Array.from({ length: binCount }, (_, i) => ({
    lo: min + i * binSize,
    hi: min + (i + 1) * binSize,
    count: 0
  }));

  valuesArray.forEach(v => {
    let idx = range > 0 ? Math.floor((v - min) / binSize) : 0;
    if (idx >= binCount) idx = binCount - 1;
    bins[idx].count++;
  });

  const myBinIdx = range > 0
    ? Math.min(Math.floor((myValue - min) / binSize), binCount - 1)
    : 0;

  const labels  = bins.map(b => `${b.lo.toFixed(1)}~${b.hi.toFixed(1)}`);
  const data    = bins.map(b => b.count);
  const colors  = bins.map((_, i) => i === myBinIdx ? MINT : MINT_LIGHT);
  const borders = bins.map((_, i) => i === myBinIdx ? MINT : 'rgba(168,230,207,0.7)');

  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderColor: borders,
        borderWidth: 2,
        borderRadius: 6
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
        x: {
          grid: { display: false },
          ticks: { font: { family: "'Noto Sans KR', sans-serif", size: 11 }, color: '#8AAE9A' }
        },
        y: {
          beginAtZero: true,
          grid: { color: gridColor },
          ticks: { font: baseFont, color: '#8AAE9A', stepSize: 1 }
        }
      }
    }
  });
}
