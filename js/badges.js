import { db } from './firebase-config.js';
import { doc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getWeekStart } from './records.js';

export const BADGE_DEFS = [
  { id: 'first',     emoji: '🌅', name: '첫 발걸음',   desc: '첫 번째 참여' },
  { id: 'three',     emoji: '🔥', name: '3일의 불꽃',  desc: '3회 참여' },
  { id: 'ten',       emoji: '💪', name: '열 번의 땀',  desc: '10회 참여' },
  { id: 'thirty',    emoji: '🏅', name: '미라클 30',   desc: '30회 참여' },
  { id: 'km1',       emoji: '📏', name: '1km 돌파',    desc: '누적 거리 1,000m' },
  { id: 'km10',      emoji: '🚀', name: '10km 돌파',   desc: '누적 거리 10,000m' },
  { id: 'marathon',  emoji: '⚡', name: '마라토너',     desc: '누적 거리 42,195m' },
  { id: 'daily1st',  emoji: '🥇', name: '오늘의 1등',  desc: '해당 날 반에서 가장 많은 바퀴' },
  { id: 'weeklyMVP', emoji: '🌟', name: '주간 MVP',    desc: '해당 주에 반에서 총 가장 많은 바퀴' }
];

/**
 * Check all badge conditions and award newly earned badges.
 * @param {string} uid
 * @param {object} currentRecord   - the record just saved { laps, date, ... }
 * @param {object[]} allUserRecords - all records for this user (including current)
 * @param {object[]} classRecords   - all records for the class (including current)
 * @param {object}  existingBadges  - current badges object from user doc
 * @returns {{ badges: object, newlyEarned: string[] }}
 */
export async function checkAndAwardBadges(uid, currentRecord, allUserRecords, classRecords, existingBadges) {
  const badges = { ...existingBadges };
  const now = new Date().toISOString();
  const newlyEarned = [];

  function award(id) {
    if (!badges[id]) {
      badges[id] = now;
      newlyEarned.push(id);
    }
  }

  const total = allUserRecords.length;
  const totalDistance = allUserRecords.reduce((s, r) => s + (r.distance || 0), 0);

  // Participation count
  if (total >= 1)  award('first');
  if (total >= 3)  award('three');
  if (total >= 10) award('ten');
  if (total >= 30) award('thirty');

  // Cumulative distance
  if (totalDistance >= 1000)   award('km1');
  if (totalDistance >= 10000)  award('km10');
  if (totalDistance >= 42195)  award('marathon');

  // 오늘의 1등: best laps in class today
  const today = currentRecord.date;
  const todayClass = classRecords.filter(r => r.date === today);
  if (todayClass.length > 0) {
    const myTodayLaps = todayClass
      .filter(r => r.uid === uid)
      .reduce((max, r) => Math.max(max, r.laps), 0);
    const classMax = Math.max(...todayClass.map(r => r.laps));
    if (myTodayLaps > 0 && myTodayLaps >= classMax) award('daily1st');
  }

  // 주간 MVP: most total laps in class this week
  const weekStart = getWeekStart(today);
  const weekClass = classRecords.filter(r => {
    const d = new Date(`${r.date}T00:00:00`);
    return d >= weekStart;
  });
  if (weekClass.length > 0) {
    const weekTotals = {};
    weekClass.forEach(r => {
      weekTotals[r.uid] = (weekTotals[r.uid] || 0) + r.laps;
    });
    const myWeekLaps = weekTotals[uid] || 0;
    const weekMax = Math.max(...Object.values(weekTotals));
    if (myWeekLaps > 0 && myWeekLaps >= weekMax) award('weeklyMVP');
  }

  // Persist only if something changed
  if (newlyEarned.length > 0) {
    try {
      await updateDoc(doc(db, 'users', uid), { badges });
    } catch (e) {
      console.error('Badge update failed:', e);
    }
  }

  return { badges, newlyEarned };
}

export function getBadgeDef(id) {
  return BADGE_DEFS.find(b => b.id === id);
}

export function formatBadgeDate(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} 획득`;
}
