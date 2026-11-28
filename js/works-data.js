// 게시된 작업 불러오기 · 카드 만들기 (PRD v1.1 F3) — 홈 '선택한 작업'과 작업 목록이 같이 써요
// 첫 화면처럼 인라인 스타일 페이지에서도 쓰도록 카드는 인라인 스타일로 만들어요 (색은 디자인 시스템 토큰 값)
// 작업 내용은 모두 textContent로만 넣어요 (XSS)
import { db, isConfigured, collection, getDocs, query, where } from "./firebase.js";
import { getImageData } from "./images.js";
import { DEFAULT_CATEGORIES, loadCategories, normalizeCategory } from "./categories.js";
import { pick } from "./content-lang.js";

export const CATEGORIES = DEFAULT_CATEGORIES; // 기본 이름 (관리자가 바꾼 이름은 loadCategories())
const millis = (t) => (t && typeof t.toMillis === "function" ? t.toMillis() : 0);

export async function loadPublishedWorks() {
  if (!isConfigured || !db) return [];
  const [snap, labels] = await Promise.all([getDocs(query(collection(db, "works"), where("status", "==", "published"))), loadCategories()]);
  return snap.docs.map((d) => { const w = { id: d.id, ...d.data() }; w.category = normalizeCategory(w.category, labels); return w; })
    .sort((a, b) => (periodKey(b) - periodKey(a)) || (millis(b.publishedAt) - millis(a.publishedAt)));
}

// 정렬 기준: 작업 기간(works.period, 예: "2026.03 – 2026.05")의 가장 늦은 날짜. 날짜가 없으면 맨 뒤, 그 안에서는 게시일 순
export function periodKey(w) {
  const ds = [...String(w.period || "").matchAll(/(\d{4})[.\-/년]\s*(\d{1,2})(?:[.\-/월]\s*(\d{1,2}))?/g)]
    .map((m) => Number(m[1]) * 10000 + Number(m[2]) * 100 + Number(m[3] || 0));
  return ds.length ? Math.max(...ds) : 0;
}

// 작업 카드: 커버 → 제목 · 분야 → 한 줄 요약
export function workCard(w, base = "") {
  const a = document.createElement("a");
  a.href = `${base}work.html?id=${encodeURIComponent(w.id)}`;
  a.style.cssText = "padding: 32px 0; display: flex; flex-direction: column; gap: 14px; text-decoration: none; color: #111111"; // black
  const cover = document.createElement("div");
  cover.style.cssText = "aspect-ratio: 16 / 11; background: #F2F2F0; overflow: hidden; border-radius: 4px"; // surface
  if (w.coverImageId) {
    // 대표 이미지는 16:11 틀을 빈 공간 없이 꽉 채워요. 보이는 부분은 관리자가 자르기(카드 16:11)로 정해요
    const img = document.createElement("img");
    img.alt = ""; img.loading = "lazy";
    img.style.cssText = "width: 100%; height: 100%; object-fit: cover; display: block";
    getImageData(w.coverImageId).then((d) => { if (d) img.src = d; });
    cover.appendChild(img);
  }
  const row = document.createElement("div");
  row.style.cssText = "display: flex; justify-content: space-between; gap: 12px; align-items: baseline";
  const h = document.createElement("h3");
  h.style.cssText = "margin: 0; font-size: 18px; font-weight: 600; word-break: keep-all; overflow-wrap: break-word; hyphens: auto";
  h.textContent = pick(w, "title") || w.name || "";
  const cat = document.createElement("span");
  cat.style.cssText = "color: #2F6BEA; font-size: 14px; white-space: nowrap"; // blue
  cat.textContent = w.category || "";
  row.append(h, cat);
  const sum = document.createElement("p");
  sum.style.cssText = "margin: 0; color: #5F5F5F; font-size: 15px; line-height: 1.6"; // gray-600
  sum.textContent = pick(w, "summary") || "";
  a.append(cover, row, sum);
  return a;
}
