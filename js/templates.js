// 문장 틀 (AI 없이, 비용 0원) — PRD v1.2 F5 · F7 대체 경로, F1 분야 추정 (DECISION_LOG D27)
// 프로토타입(prototype.html)의 templateDraft · guessCat 규칙을 사이트용으로 옮겼어요.
// 메모에 있는 문장만 그대로 쓰고, 새 사실을 만들지 않아요.

export const CATEGORIES = ["브랜딩", "UI/UX 디자인", "콘텐츠 제작", "편집디자인"]; // 기본 이름 (관리자가 바꾼 이름은 js/categories.js)

// 한 줄 의뢰에서 분야를 단어로 추정 (프로토타입과 같은 단어 목록)
const KEYWORDS = {
  "브랜딩": ["로고", "브랜드", "브랜딩", "간판", "명함", "네이밍", "패키지", "포장"],
  "UI/UX 디자인": ["앱", "웹", "홈페이지", "사이트", "화면", "랜딩", "ui", "ux", "리디자인"],
  "콘텐츠 제작": ["상세페이지", "카드뉴스", "썸네일", "sns", "인스타", "배너", "포스터", "콘텐츠"],
  "편집디자인": ["편집", "브로슈어", "리플렛", "전단", "책자", "카탈로그", "메뉴판", "잡지", "인쇄"],
};
const SLOT = { "브랜딩": 0, "UI/UX 디자인": 1, "콘텐츠 제작": 2, "편집디자인": 3 };
// 두 분야에 걸친 의뢰: 쇼핑몰 상세페이지는 콘텐츠 제작 + UI/UX 디자인 작업을 같이 보여줘요
const BOTH = [{ words: ["상세페이지", "상세 페이지", "쇼핑몰", "스마트스토어"], slots: [2, 1] }];
// 분야 칸 번호 목록 (0 브랜딩 · 1 UI/UX · 2 콘텐츠 · 3 편집디자인). 못 찾으면 []
export function guessCategorySlots(text) {
  const t = String(text || "").toLowerCase();
  for (const b of BOTH) if (b.words.some((w) => t.includes(w))) return b.slots;
  const best = guessCategory(text);
  return best ? [SLOT[best]] : [];
}
export function guessCategory(text) {
  const t = String(text || "").toLowerCase();
  let best = "", score = 0;
  for (const [cat, words] of Object.entries(KEYWORDS)) {
    const n = words.filter((w) => t.includes(w)).length;
    if (n > score) { score = n; best = cat; }
  }
  return best; // 못 찾으면 ""
}

// 문장 끝을 마침표로 정리
export function sentence(s) {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  return t ? t.replace(/[.。]$/, "") + "." : "";
}
const tag = (s) => String(s || "").replace(/[\s/]/g, "");

// 케이스 스터디 문장 틀 초안: 메모 세 칸을 문제 · 과정 · 결과에 그대로 넣어요
export function templateDraft({ title, category, industry, memo }) {
  const m = memo || {};
  const tags = [tag(category), tag(industry)].filter(Boolean);
  return {
    title: String(title || "").trim(),
    summary: [industry ? `${String(industry).trim()} ${category || ""}`.trim() + " 작업." : "", sentence(m.request)].filter(Boolean).join(" ").slice(0, 200),
    problem: sentence(m.request),
    process: sentence(m.work),
    result: sentence(m.result),
    tags,
  };
}

// 인스타그램 문구 문장 틀 3안: 케이스 스터디 문장을 그대로 짧게 엮어요
export function templateSns({ title, summary, problem, process, result, category, industry }) {
  const first = (s) => String(s || "").split(/(?<=[.!?。])\s|\n/)[0].trim();
  const lines = {
    t: String(title || "").trim(),
    s: first(summary) || first(problem),
    p: first(problem),
    d: first(process),
    r: first(result),
  };
  const end = "👉 과정은 프로필 링크에서";
  const pick = (...xs) => xs.filter(Boolean).join("\n");
  const captions = [
    pick(lines.t && `✨ ${lines.t}`, lines.p && `💬 ${lines.p}`, lines.r && `✅ ${lines.r}`, end),
    pick(lines.s && `📌 ${lines.s}`, lines.d && `🎨 ${lines.d}`, end),
    pick(lines.t && `🗂️ ${lines.t}`, lines.d && `✏️ ${lines.d}`, lines.r && `🙌 ${lines.r}`, end),
  ].filter((c) => c !== end);
  const hashtags = [...new Set([tag(category), tag(industry), "디자인", "포트폴리오"].filter(Boolean))].slice(0, 5);
  return { captions, hashtags };
}
