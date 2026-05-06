import { db } from './firebase-config.js';
import {
  collection, doc, addDoc, setDoc, deleteDoc,
  query, where, getDocs, orderBy, getDoc
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

/* ===== TIME HELPERS ===== */

export function getKSTDate() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
}

export function getTodayKST() {
  const d = getKSTDate();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isRecordingAllowed() {
  const d = getKSTDate();
  const dayOfWeek = d.getDay(); // 0=Sun,1=Mon,...,6=Sat
  const mins = d.getHours() * 60 + d.getMinutes();
  const start = 7 * 60 + 30;
  const end   = 9 * 60;
  return (dayOfWeek === 1 || dayOfWeek === 3) && mins >= start && mins < end;
}

export function getNextSessionDate() {
  const d = getKSTDate();
  const day  = d.getDay();
  const mins = d.getHours() * 60 + d.getMinutes();
  const start = 7 * 60 + 30;
  const end   = 9 * 60;

  const inWindow = (day === 1 || day === 3) && mins >= start && mins < end;
  if (inWindow) return d; // currently in session

  // Days until next Mon(1) or Wed(3)
  const daysUntil = {
    0: 1, // Sun  → Mon
    1: 2, // Mon  → Wed (window has passed or not started past window)
    2: 1, // Tue  → Wed
    3: 5, // Wed  → Mon (next week)
    4: 4, // Thu  → Mon
    5: 3, // Fri  → Mon
    6: 2  // Sat  → Mon
  };

  // Special case: Mon or Wed before window starts → today is the next session
  if ((day === 1 || day === 3) && mins < start) return d;

  const next = new Date(d);
  next.setDate(next.getDate() + (daysUntil[day] || 1));
  return next;
}

export function formatDateKorean(dateStr) {
  // dateStr: YYYY-MM-DD
  const [y, m, d] = dateStr.split('-');
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const dateObj = new Date(`${y}-${m}-${d}T00:00:00`);
  const dayName = dayNames[dateObj.getDay()];
  return `${y}년 ${parseInt(m)}월 ${parseInt(d)}일 (${dayName})`;
}

export function formatDateShort(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${parseInt(m)}/${parseInt(d)}`;
}

export function getWeekStart(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday as week start
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return monday;
}

/* ===== BYPASS FLAG ===== */

export async function checkBypassFlag() {
  try {
    const snap = await getDoc(doc(db, 'settings', 'recordLock'));
    if (snap.exists()) return snap.data().bypass === true;
    return false;
  } catch {
    return false;
  }
}

export async function setBypassFlag(value) {
  await setDoc(doc(db, 'settings', 'recordLock'), { bypass: Boolean(value) });
}

/* ===== RECORD CRUD ===== */

export async function getTodayRecord(uid) {
  const today = getTodayKST();
  const q = query(
    collection(db, 'records'),
    where('uid', '==', uid),
    where('date', '==', today)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

export async function saveRecord(uid, { minutes, laps }, existingId = null) {
  const today = getTodayKST();
  const distance = Number(laps) * 100;
  const data = {
    uid,
    date: today,
    minutes: Number(minutes),
    laps: Number(laps),
    distance,
    createdAt: new Date().toISOString()
  };

  if (existingId) {
    await setDoc(doc(db, 'records', existingId), data);
    return existingId;
  } else {
    const ref = await addDoc(collection(db, 'records'), data);
    return ref.id;
  }
}

export async function deleteRecord(recordId) {
  await deleteDoc(doc(db, 'records', recordId));
}

export async function getUserRecords(uid) {
  const q = query(
    collection(db, 'records'),
    where('uid', '==', uid),
    orderBy('date', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getUserRecordsDesc(uid) {
  const q = query(
    collection(db, 'records'),
    where('uid', '==', uid),
    orderBy('date', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getClassData(grade, classNum) {
  // Get all users in this class
  const usersQ = query(
    collection(db, 'users'),
    where('grade', '==', Number(grade)),
    where('class', '==', Number(classNum))
  );
  const usersSnap = await getDocs(usersQ);
  const uids = usersSnap.docs.map(d => d.id);
  const userMap = {};
  usersSnap.docs.forEach(d => { userMap[d.id] = d.data(); });

  if (uids.length === 0) return { records: [], userMap };

  // Chunk to handle Firestore 'in' limit of 30
  let allRecords = [];
  for (let i = 0; i < uids.length; i += 30) {
    const chunk = uids.slice(i, i + 30);
    const q2 = query(collection(db, 'records'), where('uid', 'in', chunk));
    const snap = await getDocs(q2);
    snap.docs.forEach(d => allRecords.push({ id: d.id, ...d.data() }));
  }

  return { records: allRecords, userMap };
}

export async function getAllUsers() {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(u => u.role !== 'teacher');
}

export async function getAllRecords() {
  const snap = await getDocs(collection(db, 'records'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/* ===== STATS HELPERS ===== */

export function calcUserStats(records) {
  if (!records.length) return { total: 0, totalDistance: 0, totalLaps: 0, bestLaps: 0 };
  return {
    total: records.length,
    totalDistance: records.reduce((s, r) => s + (r.distance || 0), 0),
    totalLaps: records.reduce((s, r) => s + (r.laps || 0), 0),
    bestLaps: Math.max(...records.map(r => r.laps || 0))
  };
}
