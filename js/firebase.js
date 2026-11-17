// Firebase 연결 — 다른 스크립트는 이 파일만 불러요.
// SDK 버전은 한곳(여기)에서만 정해요.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, doc, addDoc, updateDoc, getDoc, getDocs,
  query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

// 설정값을 아직 안 넣었으면 false — 페이지가 안내 문구를 보여줘요.
export const isConfigured = !String(firebaseConfig.apiKey || "").startsWith("YOUR_");

const app = isConfigured ? initializeApp(firebaseConfig) : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;

export {
  onAuthStateChanged, signInWithEmailAndPassword, signOut,
  collection, doc, addDoc, updateDoc, getDoc, getDocs, query, where, serverTimestamp
};

// Firebase 오류 코드를 사용자가 이해할 수 있는 문장으로 바꿔요.
export function friendlyError(err) {
  const code = (err && err.code) || "";
  const map = {
    "auth/invalid-credential": "이메일 또는 비밀번호가 맞지 않아요.",
    "auth/invalid-email": "이메일 형식을 확인해 주세요.",
    "auth/user-disabled": "사용이 중지된 계정이에요.",
    "auth/too-many-requests": "로그인 시도가 너무 많아요. 잠시 후 다시 시도해 주세요.",
    "auth/network-request-failed": "인터넷 연결을 확인해 주세요.",
    "permission-denied": "권한이 없어요. 관리자 계정으로 로그인했는지 확인해 주세요.",
    "unavailable": "서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요."
  };
  return map[code] || `문제가 생겼어요. (${code || "알 수 없는 오류"})`;
}

// 날짜를 "2026.11.17" 형식으로
export function formatDate(ts) {
  if (!ts) return "";
  const d = typeof ts.toDate === "function" ? ts.toDate() : new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}
