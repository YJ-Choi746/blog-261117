// 작업 분야 이름 (4칸 고정, 관리자가 이름만 바꿀 수 있어요) — Firestore settings/categories { labels: [4개] }
// - 칸 순서: 0 브랜딩 · 1 UI/UX · 2 콘텐츠 · 3 편집디자인(예전 이름 '기타')
// - 작업(works.category)에는 이름 글자를 그대로 저장해요. 관리자가 이름을 바꾸면 작업들도 새 이름으로 같이 바꿔요 (admin/works.html).
// - 화면의 분야 칩 · 선택칸은 data-cat-slot="0~3"을 붙여 두면 여기서 이름을 채워요 (textContent만).
import { db, isConfigured, doc, getDoc } from "./firebase.js";

export const DEFAULT_CATEGORIES = ["브랜딩", "UI/UX 디자인", "콘텐츠 제작", "편집디자인"];
const LEGACY = { "기타": 3 }; // 예전 이름 → 칸

let cached = null;
export function loadCategories() {
  if (cached) return cached;
  cached = (async () => {
    if (!isConfigured || !db) return [...DEFAULT_CATEGORIES];
    try {
      const snap = await getDoc(doc(db, "settings", "categories"));
      const labels = snap.exists() ? snap.data().labels : null;
      if (Array.isArray(labels) && labels.length === 4 && labels.every((x) => typeof x === "string" && x.trim())) return labels.map((x) => x.trim());
    } catch { /* 못 읽으면 기본 이름 */ }
    return [...DEFAULT_CATEGORIES];
  })();
  return cached;
}

// 작업에 저장된 분야 → 지금 이름 (예전 '기타'는 편집디자인 칸으로)
export function normalizeCategory(cat, labels) {
  if (labels.includes(cat)) return cat;
  if (cat in LEGACY) return labels[LEGACY[cat]];
  return cat || "";
}

// data-cat-slot이 붙은 칩 · 선택칸 · 체크박스에 이름 채우기
export function applyCategoryLabels(labels, root = document) {
  root.querySelectorAll("[data-cat-slot]").forEach((el) => {
    const name = labels[Number(el.dataset.catSlot)]; if (!name) return;
    if (el.tagName === "OPTION") { el.value = name; el.textContent = name; }
    else if (el.tagName === "INPUT") el.value = name;
    else {
      if ("cat" in el.dataset) el.dataset.cat = name;
      const label = el.querySelector("[data-cat-text]") || (el.children.length ? null : el);
      if (label) label.textContent = name;
      else { // 체크박스 라벨: 마지막 글자 노드만 바꿔요
        const t = [...el.childNodes].reverse().find((n) => n.nodeType === 3 && n.nodeValue.trim());
        if (t) t.nodeValue = name;
      }
    }
  });
}
