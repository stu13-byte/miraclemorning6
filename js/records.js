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

/* ===== SETTINGS CACHE (60s TTL) ===== */

let _settingsCache = null;
let _settingsCacheAt = 0;
const _DEFAULT_SETTINGS = { bypass: false, days: [1, 3], startMinute: 450, endMinute: 540 };

async function _loadSettings() {
  const now = Date.now();
  if (_settingsCache && now - _settingsCacheAt < 60000) return _settingsCache;
  try {
    const snap = await getDoc(doc(db, 'settings', 'recordLock'));
    _settingsCache = snap.exists() ? { ..._DEFAULT_SETTINGS, ...snap.data() } : { ..._DEFAULT_SETTINGS };
  } catch {
    _settingsCache = { ..._DEFAULT_SETTINGS };
  }
  _settingsCacheAt = now;
  return _settingsCache;
}

export async function isRecordingAllowed() {
  const s = await _loadSettings();
  const d = getKSTDate();
  const dayOfWeek = d.getDay();
  const mins = d.getHours() * 60 + d.getMinutes();
  const days = s.days ?? [1, 3];
  const start = s.startMinute ?? 450;
  const end = s.endMinute ?? 540;
  return days.includes(dayOfWeek) && mins >= start && mins < end;
}

export function getNextSessionDate() {
  const d = getKSTDate();
  const day  = d.getDay();
  const mins = d.getHours() * 60 + d.getMinutes();
  const start = 7 * 60 + 30;
  const end   = 9 * 60;

  const inWindow = (day === 1 || day === 3) && mins >= start && mins < end;
  if (inWindow) return d;

  const daysUntil = { 0: 1, 1: 2, 2: 1, 3: 5, 4: 4, 5: 3, 6: 2 };
  if ((day === 1 || day === 3) && mins < start) return d;

  const next = new Date(d);
  next.setDate(next.getDate() + (daysUntil[day] || 1));
  return next;
}

export function formatDateKorean(dateStr) {
  const [y, m, d] = dateStr.split('-');
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const dateObj = new Date(`${y}-${m}-${d}T00:00:00`);
  const dayName = dayNames[dateObj.getDay()];
  return `${y}년 ${parseInt(m)}월 ${parseInt(d)}일 (${dayName})`;
}

export function formatDateShort(dateStr) {
  const [, m, d] = dateStr.split('-');
  return `${parseInt(m)}/${parseInt(d)}`;
}

export function getWeekStart(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return monday;
}

/* ===== FORMAT HELPERS ===== */

export function formatTime(totalSeconds) {
  const s = Math.round(totalSeconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function formatPace(distanceKm, totalSeconds) {
  if (!distanceKm || distanceKm < 0.1) return '-';
  const paceS = totalSeconds / distanceKm;
  return `${Math.floor(paceS / 60)}'${String(Math.round(paceS % 60)).padStart(2, '0')}"`;
}

/* ===== BYPASS / SETTINGS ===== */

export async function checkBypassFlag() {
  const s = await _loadSettings();
  return s.bypass === true;
}

export async function setBypassFlag(value) {
  await setDoc(doc(db, 'settings', 'recordLock'), { bypass: Boolean(value) }, { merge: true });
  _settingsCache = null;
}

export async function getRecordLockSettings() {
  return _loadSettings();
}

export async function saveRecordLockSettings(settings) {
  await setDoc(doc(db, 'settings', 'recordLock'), settings);
  _settingsCache = null;
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

export async function saveRecord(uid, { distanceKm, seconds }, existingId = null, date = null) {
  const recordDate = date || getTodayKST();
  const data = {
    uid,
    date: recordDate,
    distanceKm: Number(distanceKm),
    seconds: Number(seconds),
    distance: Math.round(Number(distanceKm) * 1000),
    createdAt: new Date().toISOString()
  };
  if (existingId) {
    await setDoc(doc(db, 'records', existingId), data);
    return existingId;
  }
  const ref = await addDoc(collection(db, 'records'), data);
  return ref.id;
}

export async function upsertRecord(uid, date, { distanceKm, seconds }) {
  const q = query(
    collection(db, 'records'),
    where('uid', '==', uid),
    where('date', '==', date)
  );
  const snap = await getDocs(q);
  const existingId = snap.empty ? null : snap.docs[0].id;
  return saveRecord(uid, { distanceKm, seconds }, existingId, date);
}

export async function addMigrationFields(recordId, fields) {
  await setDoc(doc(db, 'records', recordId), fields, { merge: true });
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

/* ===== NORMALIZER (laps/minutes → distanceKm/seconds fallback) ===== */

export function normRecord(r) {
  return {
    ...r,
    distanceKm: r.distanceKm != null ? r.distanceKm : (r.laps != null ? r.laps * 0.1 : 0),
    seconds:    r.seconds    != null ? r.seconds    : (r.minutes != null ? r.minutes * 60 : 0)
  };
}

/* ===== STATS HELPERS ===== */

export function calcUserStats(records) {
  if (!records.length) return { total: 0, totalDistance: 0, totalDistanceKm: 0, bestDistanceKm: 0 };
  const normed = records.map(normRecord);
  return {
    total: records.length,
    totalDistance: records.reduce((s, r) => s + (r.distance || 0), 0),
    totalDistanceKm: normed.reduce((s, r) => s + r.distanceKm, 0),
    bestDistanceKm: Math.max(...normed.map(r => r.distanceKm))
  };
}

/* ===== PERCENTILE HELPER ===== */

export function calcPercentile(values, myValue) {
  if (values.length <= 1) return null;
  const rank = values.filter(v => v > myValue).length + 1;
  const topPct = Math.round((rank / values.length) * 100);
  return { rank, total: values.length, topPct };
}
