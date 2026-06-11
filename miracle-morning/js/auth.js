import { auth, db } from './firebase-config.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  doc, setDoc, getDoc
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

export function buildEmail(studentId) {
  return `${studentId}@miracle.school`;
}

export function buildStudentId(grade, classNum, number) {
  return `${grade}${String(classNum).padStart(2, '0')}${String(number).padStart(2, '0')}`;
}

export async function register({ name, grade, classNum, number, gender, password }) {
  const studentId = buildStudentId(grade, classNum, number);
  const email = buildEmail(studentId);

  const credential = await createUserWithEmailAndPassword(auth, email, password);
  const uid = credential.user.uid;

  await setDoc(doc(db, 'users', uid), {
    name,
    studentId,
    grade: Number(grade),
    class: Number(classNum),
    number: Number(number),
    gender,
    role: 'student',
    badges: {},
    createdAt: new Date().toISOString()
  });

  return { uid, studentId };
}

export async function login(studentId, password) {
  const email = buildEmail(studentId);
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function logout() {
  await signOut(auth);
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function getUserData(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  return { uid, ...snap.data() };
}

export function getKoreanError(error) {
  const code = error?.code || '';
  if (code.includes('user-not-found') || code.includes('wrong-password') || code.includes('invalid-credential')) {
    return '학번 또는 비밀번호가 잘못되었습니다.';
  }
  if (code.includes('email-already-in-use')) {
    return '이미 등록된 학번입니다. 학번을 확인해 주세요.';
  }
  if (code.includes('weak-password')) {
    return '비밀번호가 너무 짧습니다. 4자 이상 입력해 주세요.';
  }
  if (code.includes('too-many-requests')) {
    return '로그인 시도가 너무 많습니다. 잠시 후 다시 시도하세요.';
  }
  if (code.includes('network-request-failed')) {
    return '네트워크 오류가 발생했습니다. 인터넷 연결을 확인해 주세요.';
  }
  return error?.message || '오류가 발생했습니다. 다시 시도해 주세요.';
}

/**
 * Auth guard for pages requiring login.
 * Call at page load. On success calls initFn(userData).
 * role: 'student' | 'teacher' | null (any)
 */
export function requireAuth(role, initFn) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = 'login.html';
      return;
    }
    try {
      const userData = await getUserData(user.uid);
      if (!userData) {
        await signOut(auth);
        window.location.href = 'login.html';
        return;
      }
      if (role === 'student' && userData.role === 'teacher') {
        window.location.href = 'admin.html';
        return;
      }
      if (role === 'teacher' && userData.role !== 'teacher') {
        window.location.href = 'dashboard.html';
        return;
      }
      initFn(userData);
    } catch (err) {
      console.error(err);
      window.location.href = 'login.html';
    }
  });
}
