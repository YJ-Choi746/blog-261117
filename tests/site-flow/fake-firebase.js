// 스크린샷용 가짜 Firebase (실제 js/firebase.js와 같은 내보내기). 데이터는 localStorage "fakefs"에.
const KEY = "fakefs";
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
const saveAll = (s) => localStorage.setItem(KEY, JSON.stringify(s));
class TS { constructor(ms){ this.ms = ms; } toMillis(){ return this.ms; } toDate(){ return new Date(this.ms); } }
const SERVER = { __ts: true };
const revive = (v) => v && typeof v === "object" ? (v.__tsv ? new TS(v.__tsv) : Array.isArray(v) ? v.map(revive) : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, revive(x)]))) : v;
const freeze = (v) => v === SERVER ? { __tsv: Date.now() } : v instanceof TS ? { __tsv: v.ms } : v && typeof v === "object" ? (Array.isArray(v) ? v.map(freeze) : (v.__inc !== undefined ? v : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, freeze(x)])))) : v;
export const isConfigured = true;
export const auth = { currentUser: null };
export const db = { fake: true };
const rid = () => Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
export const collection = (_db, name) => ({ type: "col", name });
export const doc = (a, name, id) => a && a.type === "col" ? { type: "doc", col: a.name, id: rid() } : { type: "doc", col: name, id };
export const where = (f, op, v) => ({ f, op, v });
export const query = (col, ...ws) => ({ ...col, ws });
export const serverTimestamp = () => SERVER;
export const increment = (n) => ({ __inc: n });
const snap = (ref, data) => ({ id: ref.id, exists: () => data !== undefined, data: () => revive(data), ref });
export async function getDoc(ref) { const s = load(); return snap(ref, (s[ref.col] || {})[ref.id]); }
export async function getDocs(q) {
  const s = load(); const c = s[q.name] || {};
  const docs = Object.entries(c).filter(([, d]) => (q.ws || []).every((w) => w.op === "==" ? d[w.f] === w.v : true)).map(([id, d]) => snap({ id, col: q.name }, d));
  return { docs, size: docs.length, empty: !docs.length, forEach: (f) => docs.forEach(f) };
}
export async function setDoc(ref, data, opt) { const s = load(); s[ref.col] = s[ref.col] || {}; const prev = opt && opt.merge ? s[ref.col][ref.id] || {} : {}; s[ref.col][ref.id] = { ...prev, ...freeze(data) }; saveAll(s); }
export async function addDoc(col, data) { const ref = { type: "doc", col: col.name, id: rid() }; await setDoc(ref, data); return ref; }
export async function updateDoc(ref, data) { const s = load(); const cur = (s[ref.col] || {})[ref.id] || {}; for (const [k, v] of Object.entries(data)) cur[k] = v && v.__inc !== undefined ? (cur[k] || 0) + v.__inc : freeze(v); s[ref.col] = s[ref.col] || {}; s[ref.col][ref.id] = cur; saveAll(s); }
export async function deleteDoc(ref) { const s = load(); if (s[ref.col]) delete s[ref.col][ref.id]; saveAll(s); }
const getUser = () => { try { return JSON.parse(localStorage.getItem("fakeuser")); } catch { return null; } };
export function onAuthStateChanged(_a, cb) { setTimeout(() => cb(getUser()), 30); return () => {}; }
export async function signInWithEmailAndPassword(_a, email) { const u = { uid: "admin-uid", email }; localStorage.setItem("fakeuser", JSON.stringify(u)); return { user: u }; }
export async function signOut() { localStorage.removeItem("fakeuser"); }
export async function callFunction(name) { const e = new Error("not deployed"); e.code = "functions/not-found"; throw e; }
export const GA_OPTOUT_KEY = "jae-ga-optout";
export function markAdminBrowser() { try { localStorage.setItem(GA_OPTOUT_KEY, "1"); } catch {} }
export function friendlyError(err) {
  const code = (err && err.code) || "";
  const map = {
    "auth/invalid-credential": "이메일 또는 비밀번호가 맞지 않아요.",
    "auth/invalid-email": "이메일 형식을 확인해 주세요.",
    "auth/user-disabled": "사용이 중지된 계정이에요.",
    "auth/too-many-requests": "로그인 시도가 너무 많아요. 잠시 후 다시 시도해 주세요.",
    "auth/network-request-failed": "인터넷 연결을 확인해 주세요.",
    "permission-denied": "권한이 없어요. 관리자 계정으로 로그인했는지 확인해 주세요.",
    "unavailable": "서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.",
    "functions/not-found": "AI 분석 함수가 아직 배포되지 않았어요. (docs/FIREBASE_SETUP.md)",
    "functions/permission-denied": "관리자 계정만 AI 분석을 쓸 수 있어요.",
    "functions/deadline-exceeded": "AI 분석이 너무 오래 걸려 멈췄어요.",
    "functions/internal": "AI 분석 서버에서 문제가 생겼어요. (함수가 배포됐는지 확인해 주세요)",
    "functions/unavailable": "AI 분석 서버에 연결할 수 없어요."
  };
  return map[code] || `문제가 생겼어요. (${code || "알 수 없는 오류"})`;
}

export function formatDate(ts) { if (!ts) return ""; const d = typeof ts.toDate === "function" ? ts.toDate() : new Date(ts); const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`; }
