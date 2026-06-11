# 미라클모닝 (miraclemorning6)

Firebase 기반 학생 달리기 기록 관리 앱.

---

## Cloud Functions 배포 안내

기능 6 (비밀번호 초기화) 및 기능 7 (추천인 뱃지)은 Cloud Functions가 필요합니다.
**Firebase Blaze(종량제) 플랜이 필요합니다.**

```bash
# 1. Firebase CLI 로그인
firebase login

# 2. functions 초기화 (이미 functions/ 폴더가 존재하므로 덮어쓰기 없이 진행)
firebase init functions
# → 언어: JavaScript, Node 20, 기존 파일 덮어쓰기 NO

# 3. 의존성 설치
cd functions
npm install firebase-admin firebase-functions
cd ..

# 4. 두 함수 배포
firebase deploy --only functions
# 배포되는 함수:
#   adminResetPassword  — 관리자 비밀번호 초기화 (onCall)
#   onUserCreated       — 신규 가입 시 추천인 뱃지 부여 (onDocumentCreated)
```

### Firestore 보안 규칙 추가 (badges 컬렉션)

Firebase Console → Firestore → 규칙에 아래 내용 추가:

```
match /badges/{badgeId} {
  allow read: if request.auth != null;
  allow write: if isTeacher();
}
```

---

## 기본 뱃지 시드 절차

1. 관리자(선생님) 계정으로 `admin.html` 접속
2. **"🌱 기본 뱃지 시드"** 카드 → **"기본 뱃지 시드 실행"** 버튼 클릭
3. 14개 뱃지가 Firestore `badges` 컬렉션에 삽입됨 (멱등 — 이미 존재하면 스킵)
4. `/img/badges/badge-{id}.png` 경로에 이미지 파일을 배치하거나,
   **"🏅 뱃지·업적 관리"** 카드에서 각 뱃지 수정 → 이미지 업로드

---

## 주요 기능 요약

| 기능 | 설명 |
|------|------|
| 5. 뱃지 시스템 동적화 | Firestore `badges` 컬렉션 기반, 관리자 CRUD |
| 6. 학생 비밀번호 초기화 | 관리자 패널에서 Cloud Function 호출 |
| 7. 친구 추천 시스템 | 가입 시 추천인 학번 입력 → 뱃지 자동 부여 |
| 8. 학생 비밀번호 변경 | 현재 비밀번호 재인증 후 변경 |
