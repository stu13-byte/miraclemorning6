import { db } from './firebase-config.js';
import { doc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getWeekStart, normRecord } from './records.js';

export const BADGE_DEFS = [
  { id: 'first',     emoji: '🌅', name: '첫 발걸음',   desc: '첫 번째 참여' },
  { id: 'three',     emoji: '🔥', name: '3일의 불꽃',  desc: '3회 참여' },
  { id: 'ten',       emoji: '💪', name: '열 번의 땀',  desc: '10회 참여' },
  { id: 'thirty',    emoji: '🏅', name: '미라클 30',   desc: '30회 참여' },
  { id: 'km5',       emoji: '📏', name: '5km 돌파',    desc: '누적 거리 5km' },
  { id: 'km20',      emoji: '🚀', name: '20km 돌파',   desc: '누적 거리 20km' },
  { id: 'marathon',  emoji: '🎽', name: '마라토너',     desc: '누적 거리 42.195km' },
  { id: 'km50',      emoji: '⚡', name: '50km 돌파',   desc: '누적 거리 50km' },
  { id: 'km100',     emoji: '🏆', name: '100km 돌파',  desc: '누적 거리 100km' },
  { id: 'daily1st',  emoji: '🥇', name: '오늘의 1등',  desc: '해당 날 반에서 가장 긴 거리' },
  { id: 'weeklyMVP', emoji: '🌟', name: '주간 MVP',    desc: '해당 주에 반에서 총 가장 긴 거리' }
];

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
  const totalDistanceKm = allUserRecords.map(normRecord).reduce((s, r) => s + r.distanceKm, 0);

  if (total >= 1)  award('first');
  if (total >= 3)  award('three');
  if (total >= 10) award('ten');
  if (total >= 30) award('thirty');

  if (totalDistanceKm >= 5)      award('km5');
  if (totalDistanceKm >= 20)     award('km20');
  if (totalDistanceKm >= 42.195) award('marathon');
  if (totalDistanceKm >= 50)     award('km50');
  if (totalDistanceKm >= 100)    award('km100');

  const today = currentRecord.date;
  const todayClass = classRecords.filter(r => r.date === today);
  if (todayClass.length > 0) {
    const myTodayKm = todayClass
      .filter(r => r.uid === uid)
      .reduce((max, r) => Math.max(max, normRecord(r).distanceKm), 0);
    const classMax = Math.max(...todayClass.map(r => normRecord(r).distanceKm));
    if (myTodayKm > 0 && myTodayKm >= classMax) award('daily1st');
  }

  const weekStart = getWeekStart(today);
  const weekClass = classRecords.filter(r => {
    const d = new Date(`${r.date}T00:00:00`);
    return d >= weekStart;
  });
  if (weekClass.length > 0) {
    const weekTotals = {};
    weekClass.forEach(r => {
      weekTotals[r.uid] = (weekTotals[r.uid] || 0) + normRecord(r).distanceKm;
    });
    const myWeekKm = weekTotals[uid] || 0;
    const weekMax = Math.max(...Object.values(weekTotals));
    if (myWeekKm > 0 && myWeekKm >= weekMax) award('weeklyMVP');
  }

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
