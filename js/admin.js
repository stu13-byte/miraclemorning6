import { getAllUsers, getAllRecords, calcUserStats, getTodayKST, getWeekStart, normRecord, upsertRecord } from './records.js';
import { functions } from './firebase-config.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';

/** Returns all students enriched with stats, sorted by grade → class → number */
export async function getStudentsWithStats() {
  const [users, records] = await Promise.all([getAllUsers(), getAllRecords()]);

  const recordsByUid = {};
  records.forEach(r => {
    if (!recordsByUid[r.uid]) recordsByUid[r.uid] = [];
    recordsByUid[r.uid].push(r);
  });

  const students = users.map(u => {
    const recs = recordsByUid[u.uid || u.id] || [];
    const stats = calcUserStats(recs);
    const sorted = [...recs].sort((a, b) => b.date.localeCompare(a.date));
    return {
      ...u,
      records: sorted,
      total: stats.total,
      totalDistance: stats.totalDistance,
      totalDistanceKm: stats.totalDistanceKm,
      bestDistanceKm: stats.bestDistanceKm,
      lastDate: sorted[0]?.date || null
    };
  });

  students.sort((a, b) => {
    if (a.grade !== b.grade) return a.grade - b.grade;
    if (a.class !== b.class) return a.class - b.class;
    return a.number - b.number;
  });

  return students;
}

export function todayAttendance(students) {
  const today = getTodayKST();
  const present = students.filter(s => s.lastDate === today);
  return { count: present.length, total: students.length, present };
}

export function weeklyStats(students) {
  const today = getTodayKST();
  const weekStart = getWeekStart(today);

  const dayCounts = {};
  students.forEach(s => {
    s.records.forEach(r => {
      const d = new Date(`${r.date}T00:00:00`);
      if (d >= weekStart) dayCounts[r.date] = (dayCounts[r.date] || 0) + 1;
    });
  });

  const dayNames = ['월', '화', '수', '목', '금', '토', '일'];
  const labels = [], counts = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const iso = d.toISOString().split('T')[0];
    labels.push(dayNames[i]);
    counts.push(dayCounts[iso] || 0);
  }

  return { dayLabels: labels, dayCounts: counts };
}

export function buildCSV(students) {
  const headers = ['이름', '학년', '반', '번호', '성별', '학번', '총 참여', '누적 거리(km)', '마지막 기록일'];
  const rows = students.map(s => [
    s.name, s.grade, s.class, s.number, s.gender, s.studentId,
    s.total, (s.totalDistanceKm || 0).toFixed(2), s.lastDate || ''
  ]);
  return [headers, ...rows].map(r => r.join(',')).join('\n');
}

export function buildRecordCSV(student, records) {
  const headers = ['날짜', '시간', '거리(km)', '페이스'];
  const rows = records.map(r => {
    const n = normRecord(r);
    const mins = Math.floor(n.seconds / 60);
    const secs = n.seconds % 60;
    const pace = n.distanceKm >= 0.1
      ? `${Math.floor(n.seconds / n.distanceKm / 60)}'${String(Math.round(n.seconds / n.distanceKm % 60)).padStart(2,'0')}"`
      : '-';
    return [r.date, `${mins}:${String(secs).padStart(2,'0')}`, n.distanceKm.toFixed(2), pace];
  });
  return `${student.name} (${student.studentId}) 기록\n` +
    [headers, ...rows].map(r => r.join(',')).join('\n');
}

export async function copyToClipboard(text) {
  await navigator.clipboard.writeText(text);
}

/**
 * Parse sheet-style text input into structured rows.
 * Accepts tab, multi-space, or comma-separated columns.
 * Columns: 학번  날짜  거리(km)  시간(MM:SS)
 */
export function parseSheetInput(text, students) {
  const uidByStudentId = {};
  students.forEach(s => { uidByStudentId[String(s.studentId)] = s.uid || s.id; });

  const lines = text.trim().split('\n').filter(l => l.trim());
  if (!lines.length) return { rows: [], validCount: 0, invalidCount: 0 };

  // Skip header if first token is non-numeric
  const firstToken = lines[0].trim().split(/[\t,]+|\s{2,}|\s+/)[0];
  const dataLines = isNaN(firstToken) ? lines.slice(1) : lines;

  const rows = dataLines.map(line => {
    const parts = line.trim().split(/[\t,]+|\s{2,}|\s+/);
    const studentId = (parts[0] || '').trim();
    const date      = (parts[1] || '').trim();
    const distStr   = (parts[2] || '').trim();
    const timeStr   = (parts[3] || '').trim();

    const errors = [];
    const uid = uidByStudentId[studentId];
    if (!uid) errors.push('학번 없음');

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push('날짜 형식 오류');

    const distanceKm = parseFloat(distStr);
    if (isNaN(distanceKm) || distanceKm < 0.1 || distanceKm > 30) errors.push('거리 범위 오류(0.1~30km)');

    const timeMatch = timeStr.match(/^(\d{1,3}):(\d{2})$/);
    let seconds = 0;
    if (!timeMatch) {
      errors.push('시간 형식 오류(MM:SS)');
    } else {
      seconds = parseInt(timeMatch[1]) * 60 + parseInt(timeMatch[2]);
      if (seconds <= 0) errors.push('시간 값 오류');
    }

    return {
      studentId, uid: uid || null, date,
      distanceKm: isNaN(distanceKm) ? null : distanceKm,
      seconds,
      valid: errors.length === 0,
      errors
    };
  });

  return {
    rows,
    validCount: rows.filter(r => r.valid).length,
    invalidCount: rows.filter(r => !r.valid).length
  };
}

/**
 * Reset a student's password via Cloud Function (teacher only).
 */
export async function resetPassword(targetUid, newPassword) {
  const fn = httpsCallable(functions, 'adminResetPassword');
  const result = await fn({ targetUid, newPassword });
  return result.data;
}

/**
 * Bulk upsert valid rows into Firestore.
 * @param {object[]} validRows - rows with valid:true from parseSheetInput
 * @param {Function} onProgress - (done, total, saved, errors) => void
 */
export async function bulkSaveRecords(validRows, onProgress) {
  let saved = 0, errors = 0;
  for (const row of validRows) {
    try {
      await upsertRecord(row.uid, row.date, { distanceKm: row.distanceKm, seconds: row.seconds });
      saved++;
    } catch {
      errors++;
    }
    if (onProgress) onProgress(saved + errors, validRows.length, saved, errors);
  }
  return { saved, errors };
}
