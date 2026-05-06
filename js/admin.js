import { getAllUsers, getAllRecords, calcUserStats, getTodayKST, getWeekStart } from './records.js';

/** Returns all students enriched with stats, sorted by class then number */
export async function getStudentsWithStats() {
  const [users, records] = await Promise.all([getAllUsers(), getAllRecords()]);

  // Group records by uid
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
      totalLaps: stats.totalLaps,
      lastDate: sorted[0]?.date || null
    };
  });

  // Sort: grade → class → number
  students.sort((a, b) => {
    if (a.grade !== b.grade) return a.grade - b.grade;
    if (a.class !== b.class) return a.class - b.class;
    return a.number - b.number;
  });

  return students;
}

/** Today's attendance for a class (grade, class). Returns {count, uids} */
export function todayAttendance(students) {
  const today = getTodayKST();
  const present = students.filter(s => s.lastDate === today);
  return { count: present.length, total: students.length, present };
}

/** Weekly participation: returns { dayLabels, dayCounts } for Mon–Wed–Fri+Sat+Sun this week */
export function weeklyStats(students) {
  const today = getTodayKST();
  const weekStart = getWeekStart(today);

  // Build a map: dateStr → count
  const dayCounts = {};
  students.forEach(s => {
    s.records.forEach(r => {
      const d = new Date(`${r.date}T00:00:00`);
      if (d >= weekStart) {
        dayCounts[r.date] = (dayCounts[r.date] || 0) + 1;
      }
    });
  });

  // Build 7-day window starting Monday
  const dayNames = ['월', '화', '수', '목', '금', '토', '일'];
  const labels = [];
  const counts = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const iso = d.toISOString().split('T')[0];
    labels.push(dayNames[i]);
    counts.push(dayCounts[iso] || 0);
  }

  return { dayLabels: labels, dayCounts: counts };
}

/** Convert student list to CSV string */
export function buildCSV(students) {
  const headers = ['이름', '학년', '반', '번호', '성별', '학번', '총 참여', '누적 거리(m)', '마지막 기록일'];
  const rows = students.map(s => [
    s.name, s.grade, s.class, s.number, s.gender, s.studentId,
    s.total, s.totalDistance, s.lastDate || ''
  ]);
  return [headers, ...rows].map(r => r.join(',')).join('\n');
}

/** Build CSV from a student's records */
export function buildRecordCSV(student, records) {
  const headers = ['날짜', '시간(분)', '바퀴', '거리(m)'];
  const rows = records.map(r => [r.date, r.minutes, r.laps, r.distance]);
  return `${student.name} (${student.studentId}) 기록\n` +
    [headers, ...rows].map(r => r.join(',')).join('\n');
}

export async function copyToClipboard(text) {
  await navigator.clipboard.writeText(text);
}
