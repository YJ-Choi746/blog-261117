// 운영자가 쓴 글 · 작업의 영어 버전 고르기 (방문자 페이지 전용)
// - 고정 문구(메뉴 · 버튼)는 js/i18n.js 사전이 바꾸고, DB에 저장된 내용은 문서의 en 칸(관리자가 쓰거나 AI로 번역)에서 가져와요.
// - 영어 칸이 비어 있으면 한국어를 그대로 보여주고, 상세 페이지에는 "Korean only" 안내를 붙여요.
const KEY = "jae-lang";

export function isEn() {
  try { return localStorage.getItem(KEY) === "en"; } catch { return false; }
}
const filled = (v) => (Array.isArray(v) ? v.length > 0 : String(v ?? "").trim() !== "");

// 영어 화면이고 en 칸이 차 있으면 영어, 아니면 원래 값
export function pick(o, key) {
  if (!o) return "";
  if (isEn() && o.en && filled(o.en[key])) return o.en[key];
  return o[key];
}
// 이 문서에 영어 버전이 있나 (제목 + 본문 하나 이상)
export function hasEn(o, bodyKeys) {
  return !!(o && o.en && filled(o.en.title) && bodyKeys.some((k) => filled(o.en[k])));
}
// 영어 화면인데 영어 버전이 없을 때 붙이는 작은 안내 (i18n 사전을 거치지 않게 data-no-i18n)
export function koreanOnlyNote() {
  const p = document.createElement("p");
  p.className = "lang-note";
  p.setAttribute("data-no-i18n", "");
  p.setAttribute("lang", "en");
  p.style.cssText = "margin: 0 0 16px; padding: 8px 12px; background: #E8EFFD; color: #1F4FB8; font-size: 14px; border-radius: 4px"; // blue-tint
  p.textContent = "This entry is available in Korean only for now.";
  return p;
}
// 언어 버튼을 누르면 i18n.js가 보내요 → 목록 화면은 다시 그려요
export function onLangChange(fn) { window.addEventListener("jae:langchange", fn); }
