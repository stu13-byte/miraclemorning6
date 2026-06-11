import { db } from './firebase-config.js';
import {
  collection, doc, updateDoc, getDocs, query, where
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getWeekStart, normRecord } from './records.js';

let _badgeDefsCache = null;
let _badgeDefsCacheTime = 0;
const CACHE_TTL = 60_000;

export async function fetchBadgeDefs() {
  const now = Date.now();
  if (_badgeDefsCache && (now - _badgeDefsCacheTime) < CACHE_TTL) {
    return _badgeDefsCache;
  }
  const snap = await getDocs(query(collection(db, 'badges'), where('active', '==', true)));
  const defs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  defs.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  _badgeDefsCache = defs;
  _badgeDefsCacheTime = now;
  return defs;
}

export function invalidateBadgeCache() {
  _badgeDefsCache = null;
}

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

  let defs;
  try {
    defs = await fetchBadgeDefs();
  } catch (e) {
    console.error('fetchBadgeDefs failed:', e);
    return { badges, newlyEarned };
  }

  const total = allUserRecords.length;
  const totalDistanceKm = allUserRecords.map(normRecord).reduce((s, r) => s + r.distanceKm, 0);
  const today = currentRecord.date;

  const todayClass = classRecords.filter(r => r.date === today);
  const myTodayKm = todayClass
    .filter(r => r.uid === uid)
    .reduce((max, r) => Math.max(max, normRecord(r).distanceKm), 0);
  const classMaxToday = todayClass.length > 0
    ? Math.max(...todayClass.map(r => normRecord(r).distanceKm))
    : 0;

  const weekStart = getWeekStart(today);
  const weekClass = classRecords.filter(r => new Date(`${r.date}T00:00:00`) >= weekStart);
  const weekTotals = {};
  weekClass.forEach(r => {
    weekTotals[r.uid] = (weekTotals[r.uid] || 0) + normRecord(r).distanceKm;
  });
  const myWeekKm = weekTotals[uid] || 0;
  const weekMax = weekClass.length > 0 ? Math.max(...Object.values(weekTotals)) : 0;

  for (const b of defs) {
    const c = b.condition;
    if (!c) continue;
    switch (c.type) {
      case 'count':
        if (total >= c.threshold) award(b.id);
        break;
      case 'totalDistance':
        if (totalDistanceKm >= c.threshold) award(b.id);
        break;
      case 'singleDistance': {
        const best = allUserRecords.map(normRecord).reduce((m, r) => Math.max(m, r.distanceKm), 0);
        if (best >= c.threshold) award(b.id);
        break;
      }
      case 'dailyTop':
        if (myTodayKm > 0 && myTodayKm >= classMaxToday) award(b.id);
        break;
      case 'weeklyMVP':
        if (myWeekKm > 0 && myWeekKm >= weekMax) award(b.id);
        break;
      case 'referralCount':
        break;
    }
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

export async function getBadgeDef(id) {
  const defs = await fetchBadgeDefs();
  return defs.find(b => b.id === id) || { id, name: '삭제된 뱃지', desc: '', imageRef: '' };
}

export function getImageSrc(imageRef) {
  if (!imageRef) return 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'56\' height=\'56\'%3E%3Crect width=\'56\' height=\'56\' rx=\'12\' fill=\'%23e0e0e0\'/%3E%3C/svg%3E';
  return imageRef;
}

export function formatBadgeDate(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} 획득`;
}
