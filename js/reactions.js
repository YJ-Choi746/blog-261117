// 글 반응 — 좋아요(PRD FR-04) · 저장(PRD FR-05)
// - 좋아요 수는 Firestore postStats/{글ID}.likeCount (보안 규칙이 ±1만 허용, firestore.rules)
//   누른 상태는 이 브라우저에만 기억해요 (jae-liked-{글ID}). 로그인이 없어 기기를 바꾸면 다시 누를 수 있어요.
// - 저장(스크랩)은 이 브라우저에만 (jae-bookmarks, 최대 100개). Firestore에 저장하지 않아요.
// - 화면에는 createElement / textContent만 써요.
import { db, doc, getDoc, setDoc, increment } from "./firebase.js";

const track = (name, params) => { if (typeof window.trackEvent === "function") window.trackEvent(name, params); };

// ---------- 브라우저 저장소 (막혀 있어도 오류 없이) ----------
function load(key) { try { return localStorage.getItem(key); } catch { return null; } }
function save(key, val) { try { if (val === null) localStorage.removeItem(key); else localStorage.setItem(key, val); return true; } catch { return false; } }

const BOOKMARK_KEY = "jae-bookmarks", BOOKMARK_MAX = 100;
export function getBookmarks() {
  try {
    const list = JSON.parse(load(BOOKMARK_KEY) || "[]");
    return Array.isArray(list) ? list.filter((b) => b && typeof b.id === "string") : [];
  } catch { return []; }
}
function setBookmarks(list) { return save(BOOKMARK_KEY, JSON.stringify(list.slice(0, BOOKMARK_MAX))); }

// ---------- 선 아이콘 ----------
const SVG = "http://www.w3.org/2000/svg";
function icon(pathD) {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("width", "18"); svg.setAttribute("height", "18"); svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none"); svg.setAttribute("stroke", "currentColor"); svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round"); svg.setAttribute("stroke-linejoin", "round"); svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(SVG, "path"); path.setAttribute("d", pathD);
  svg.appendChild(path);
  return svg;
}
const HEART = "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z";
const BOOKMARK = "M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z";

// ---------- 좋아요 ----------
// params: GA 매개변수 (post_id, post_title, post_category, post_published_at)
export function likeButton(postId, params) {
  const key = `jae-liked-${postId}`;
  const ref = doc(db, "postStats", postId);
  let liked = load(key) === "1";
  let count = 0;
  let busy = false;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn btn-outline react-btn like-btn";
  const num = document.createElement("span");
  num.className = "react-count";
  btn.append(icon(HEART), num);

  const paint = () => {
    btn.setAttribute("aria-pressed", String(liked));
    btn.setAttribute("aria-label", `좋아요 ${count}개${liked ? ", 눌렀어요" : ""}`);
    num.textContent = String(count);
  };
  paint();

  getDoc(ref).then((snap) => {
    const n = snap.exists() ? snap.data().likeCount : 0;
    count = Number.isInteger(n) && n >= 0 ? n : 0;
    if (liked && count === 0) { liked = false; save(key, null); } // 관리자가 숫자를 지웠으면 누른 표시도 풀어요
    paint();
  }).catch(() => { /* 숫자를 못 불러와도 버튼은 그대로 */ });

  btn.addEventListener("click", async () => {
    if (busy) return;
    const next = !liked;
    if (!next && count <= 0) return; // 0 미만으로는 내리지 않아요
    busy = true;
    // 화면 먼저 바꾸고, 저장에 실패하면 되돌려요
    liked = next; count += next ? 1 : -1; paint();
    try {
      await setDoc(ref, { likeCount: increment(next ? 1 : -1) }, { merge: true });
      save(key, next ? "1" : null);
      track(next ? "like_post" : "unlike_post", params);
    } catch {
      liked = !next; count += next ? -1 : 1; paint();
    } finally {
      busy = false;
    }
  });
  return btn;
}

// ---------- 저장 (나중에 읽기) ----------
// info: { id, title, category } · msgEl: 안내 문구를 보여줄 칸
export function bookmarkButton(info, params, msgEl) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn btn-outline react-btn bookmark-btn";
  const label = document.createElement("span");
  btn.append(icon(BOOKMARK), label);

  let saved = getBookmarks().some((b) => b.id === info.id);
  const paint = () => {
    btn.setAttribute("aria-pressed", String(saved));
    label.textContent = saved ? "저장됨" : "저장";
  };
  paint();

  btn.addEventListener("click", () => {
    const list = getBookmarks().filter((b) => b.id !== info.id);
    const next = !saved;
    if (next) list.unshift({ id: info.id, title: info.title || "", category: info.category || "", savedAt: Date.now() });
    if (!setBookmarks(list)) {
      if (msgEl) { msgEl.textContent = "이 브라우저에서는 저장할 수 없어요."; msgEl.hidden = false; }
      return;
    }
    saved = next; paint();
    if (msgEl) {
      msgEl.textContent = saved ? "저장했어요. 이 브라우저에만 저장돼요 — 기록 → 저장한 글에서 다시 볼 수 있어요." : "저장을 취소했어요.";
      msgEl.hidden = false;
    }
    track(saved ? "bookmark_post" : "unbookmark_post", params);
  });
  return btn;
}
