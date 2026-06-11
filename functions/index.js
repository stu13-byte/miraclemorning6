const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
admin.initializeApp();

/* ─────────────────────────────────────────────
   Feature 6: 관리자 비밀번호 초기화
───────────────────────────────────────────── */
exports.adminResetPassword = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError('unauthenticated', '로그인 필요');

  const callerDoc = await admin.firestore().doc(`users/${callerUid}`).get();
  if (callerDoc.data()?.role !== 'teacher') {
    throw new HttpsError('permission-denied', '관리자 권한 필요');
  }

  const { targetUid, newPassword } = request.data;
  if (!targetUid || !newPassword || newPassword.length < 4) {
    throw new HttpsError('invalid-argument', '입력값 오류: targetUid와 4자 이상 newPassword 필요');
  }

  await admin.auth().updateUser(targetUid, { password: newPassword });
  return { success: true };
});

/* ─────────────────────────────────────────────
   Feature 7: 신규 사용자 생성 시 추천인 뱃지 부여
───────────────────────────────────────────── */
exports.onUserCreated = onDocumentCreated('users/{uid}', async (event) => {
  const newUser = event.data?.data();
  if (!newUser?.referredBy) return;

  const referrerRef = admin.firestore().doc(`users/${newUser.referredBy}`);
  const referrerSnap = await referrerRef.get();
  if (!referrerSnap.exists) return;

  const referralsSnap = await admin.firestore().collection('users')
    .where('referredBy', '==', newUser.referredBy).get();
  const count = referralsSnap.size;

  const badgesSnap = await admin.firestore().collection('badges')
    .where('active', '==', true).get();

  const badges = { ...(referrerSnap.data().badges || {}) };
  const now = new Date().toISOString();
  let changed = false;

  badgesSnap.forEach(docSnap => {
    const b = docSnap.data();
    if (b.condition?.type === 'referralCount' && count >= b.condition.threshold) {
      if (!badges[docSnap.id]) {
        badges[docSnap.id] = now;
        changed = true;
      }
    }
  });

  if (changed) await referrerRef.update({ badges });
});
