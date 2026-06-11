import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getFunctions } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';

/*
 * ============================================================
 *  FIREBASE 설정 방법
 * ============================================================
 * 1. https://console.firebase.google.com 에서 프로젝트 생성
 * 2. 웹 앱 추가 → 아래 firebaseConfig 값 교체
 * 3. Authentication → 로그인 방법 → 이메일/비밀번호 활성화
 * 4. Firestore Database 생성 (테스트 모드로 시작 후 보안 규칙 적용)
 *
 * ============================================================
 *  선생님(관리자) 계정 초기 설정
 * ============================================================
 * 1. Firebase Console → Authentication → 사용자 추가
 *    이메일: admin@miracle.school  |  비밀번호: 원하는 비밀번호
 * 2. 생성된 UID 복사
 * 3. Firestore → users → {UID} 문서 생성:
 *    {
 *      name: "선생님",
 *      studentId: "admin",
 *      grade: 0, class: 0, number: 0,
 *      gender: "남",
 *      role: "teacher",
 *      badges: {}
 *    }
 *
 * ============================================================
 *  Firestore 보안 규칙 (Firebase Console → Firestore → 규칙)
 * ============================================================
 * rules_version = '2';
 * service cloud.firestore {
 *   match /databases/{database}/documents {
 *     function isTeacher() {
 *       return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'teacher';
 *     }
 *     match /users/{uid} {
 *       allow read: if request.auth != null;
 *       allow create: if request.auth.uid == uid;
 *       allow update: if request.auth.uid == uid || isTeacher();
 *     }
 *     match /records/{recordId} {
 *       allow read: if request.auth != null;
 *       allow create: if request.auth != null && request.resource.data.uid == request.auth.uid;
 *       allow update: if request.auth != null &&
 *         (resource.data.uid == request.auth.uid || isTeacher());
 *       allow delete: if request.auth != null &&
 *         (resource.data.uid == request.auth.uid || isTeacher());
 *     }
 *     match /settings/{docId} {
 *       allow read: if request.auth != null;
 *       allow write: if isTeacher();
 *     }
 *   }
 * }
 *
 * ============================================================
 *  필요한 Firestore 복합 인덱스
 * ============================================================
 * records 컬렉션:
 *   - uid (오름차순) + date (내림차순)
 *   - uid (오름차순) + date (오름차순)
 * (인덱스 오류 발생 시 콘솔에 표시되는 링크로 자동 생성 가능)
 */

const firebaseConfig = {
  apiKey: "AIzaSyD7Km5cZBv_TIzQP2nEIXP5XXvIkTgfeyQ",
  authDomain: "miracle-morning6.firebaseapp.com",
  projectId: "miracle-morning6",
  storageBucket: "miracle-morning6.firebasestorage.app",
  messagingSenderId: "462812064087",
  appId: "1:462812064087:web:0f2bd7525040a73015f612",
  measurementId: "G-T7TC8PJD68"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, 'asia-northeast3');
