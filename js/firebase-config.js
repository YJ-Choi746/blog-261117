// Firebase 웹 앱 설정값
// Firebase 콘솔 → 프로젝트 설정 → 내 앱 → 웹 앱 → "SDK 설정 및 구성"의 firebaseConfig를 그대로 붙여넣어요.
// 이 값들은 비밀번호가 아니에요. 브라우저에 공개되는 값이고, 보안은 firestore.rules가 지켜요.
// 자세한 순서: docs/firebase-setup.md
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
