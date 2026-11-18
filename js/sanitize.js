// 글 본문 HTML 정리기 (허용 목록 방식)
// 에디터에서 만든 HTML이나 붙여넣은 HTML을 "허용한 태그 · 속성 · 스타일"만 남겨 새로 만들어요.
// - 해석은 DOMParser(스크립트가 실행되지 않는 문서)로만 해요.
// - 결과는 createElement / createTextNode로 다시 만들어서, 원래 HTML의 위험한 부분(script, onclick, javascript: 링크 등)은 남지 않아요.
// - 화면에 넣을 때도 이 결과(DocumentFragment)를 append 해요. innerHTML에 값을 넣지 않아요.

// 본문에서 고를 수 있는 글꼴 (Google Fonts로 불러와요)
export const FONTS = [
  { id: "sans", label: "기본 고딕", css: "'Noto Sans KR', sans-serif", match: ["noto sans kr", "sans-serif"] },
  { id: "serif", label: "명조", css: "'Noto Serif KR', serif", match: ["noto serif kr", "serif"] },
  { id: "nanumgothic", label: "나눔고딕", css: "'Nanum Gothic', sans-serif", match: ["nanum gothic"] },
  { id: "nanummyeongjo", label: "나눔명조", css: "'Nanum Myeongjo', serif", match: ["nanum myeongjo"] },
  { id: "gowun", label: "고운돋움", css: "'Gowun Dodum', sans-serif", match: ["gowun dodum"] },
  { id: "pen", label: "나눔손글씨 펜", css: "'Nanum Pen Script', cursive", match: ["nanum pen script"] }
];
export const FONT_LINK = "https://fonts.googleapis.com/css2?family=Gowun+Dodum&family=Nanum+Gothic:wght@400;700&family=Nanum+Myeongjo:wght@400;700&family=Nanum+Pen+Script&family=Noto+Sans+KR:wght@400;500;600&family=Noto+Serif+KR:wght@400;600&display=swap";
export const SIZES = [13, 15, 17, 19, 24, 30, 38];
export const COLORS = ["#111111", "#5F5F5F", "#2F6BEA", "#1F4FB8", "#B42318", "#C2410C", "#2B8A3E", "#6741D9", "#FFFFFF"];
export const HIGHLIGHTS = ["#FFF3BF", "#D3F9D8", "#E8EFFD", "#FFE3E3", "#F3F0FF"];
export const IMAGE_SIZES = ["full", "medium", "small"];
// 본문에 넣을 수 있는 위젯 (이름 → 에디터에 보이는 안내 글). 화면에서는 js/widgets.js가 그려요.
export const WIDGETS = {
  "daily-quote": "오늘의 명언 — 방문할 때마다 새 명언이 나와요",
  "pokemon-match": "성격별 포켓몬 추천 — 성격을 누르면 포켓몬이 나와요"
};

const DROP_WITH_CONTENT = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "SVG", "MATH", "NOSCRIPT", "TEMPLATE", "TEXTAREA", "SELECT", "BUTTON", "INPUT", "FORM", "HEAD", "TITLE", "META", "LINK"]);
const RENAME = { B: "strong", I: "em", STRIKE: "s", DEL: "s", INS: "u", H1: "h2", H4: "h3", H5: "h3", H6: "h3", FONT: "span" };
const ALLOWED = new Set(["p", "br", "h2", "h3", "strong", "em", "u", "s", "span", "a", "ul", "ol", "li", "blockquote", "hr", "img", "figure", "figcaption", "pre", "code"]);
const STYLED = new Set(["p", "h2", "h3", "span", "strong", "em", "u", "s", "a", "li", "blockquote", "figure", "figcaption"]);
const BLOCK = new Set(["P", "DIV", "H1", "H2", "H3", "H4", "H5", "H6", "UL", "OL", "LI", "BLOCKQUOTE", "PRE", "FIGURE", "HR", "TABLE", "SECTION", "ARTICLE"]);
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

function cleanColor(v) {
  v = String(v || "").trim().toLowerCase();
  let m = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (m) return v;
  m = v.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d.]+)\s*)?\)$/);
  if (m) {
    if (m[4] !== undefined && Number(m[4]) === 0) return null; // 투명
    const h = (n) => Math.min(255, Number(n)).toString(16).padStart(2, "0");
    return `#${h(m[1])}${h(m[2])}${h(m[3])}`;
  }
  return null;
}

function cleanFont(v) {
  const first = String(v || "").split(",")[0].replace(/['"]/g, "").trim().toLowerCase();
  const f = FONTS.find((x) => x.match.includes(first));
  return f ? f.css : null;
}

function cleanSize(v) {
  const m = String(v || "").trim().match(/^(\d+(?:\.\d+)?)px$/);
  if (!m) return null;
  const n = Math.round(Number(m[1]));
  return n >= 10 && n <= 48 ? `${n}px` : null;
}

function cleanStyle(src) {
  const out = [];
  const decl = src.style;
  const color = cleanColor(decl.color);
  if (color) out.push(["color", color]);
  const bg = cleanColor(decl.backgroundColor);
  if (bg && bg !== "#ffffff") out.push(["background-color", bg]);
  const font = decl.fontFamily && cleanFont(decl.fontFamily);
  if (font) out.push(["font-family", font]);
  const size = decl.fontSize && cleanSize(decl.fontSize);
  if (size) out.push(["font-size", size]);
  if (["left", "center", "right", "justify"].includes(decl.textAlign)) out.push(["text-align", decl.textAlign]);
  if (["bold", "700", "800", "900"].includes(decl.fontWeight)) out.push(["font-weight", "600"]);
  if (decl.fontStyle === "italic") out.push(["font-style", "italic"]);
  const deco = String(decl.textDecorationLine || decl.textDecoration || "");
  const decos = ["underline", "line-through"].filter((d) => deco.includes(d));
  if (decos.length) out.push(["text-decoration", decos.join(" ")]);
  return out;
}

// <font face color size> (오래된 방식) → 스타일로
function fontTagStyle(src) {
  const out = [];
  const c = cleanColor(src.getAttribute("color"));
  if (c) out.push(["color", c]);
  const f = src.getAttribute("face") && cleanFont(src.getAttribute("face"));
  if (f) out.push(["font-family", f]);
  return out;
}

function hasBlockChild(node) {
  for (const c of node.childNodes) if (c.nodeType === 1 && BLOCK.has(c.tagName)) return true;
  return false;
}

function copyChildren(src, dest, depth) {
  for (const child of src.childNodes) {
    const n = cleanNode(child, depth + 1);
    if (n) dest.appendChild(n);
  }
}

function cleanNode(node, depth) {
  if (depth > 40) return null;
  if (node.nodeType === 3) return document.createTextNode(node.nodeValue);
  if (node.nodeType !== 1) return null;
  const tagUp = node.tagName.toUpperCase();
  if (DROP_WITH_CONTENT.has(tagUp)) return null;

  // 위젯 자리: 허용한 이름만, 속성은 data-widget 하나만, 안의 글은 우리가 정한 안내 글로 바꿔요
  if (tagUp === "DIV" && Object.hasOwn(WIDGETS, node.getAttribute("data-widget") || "")) {
    const name = node.getAttribute("data-widget");
    const w = document.createElement("div");
    w.setAttribute("data-widget", name);
    w.textContent = WIDGETS[name];
    return w;
  }

  // div: 줄 단위면 문단으로, 안에 블록이 있으면 껍데기만 벗겨요
  let tag;
  if (tagUp === "DIV" || tagUp === "SECTION" || tagUp === "ARTICLE") {
    if (hasBlockChild(node)) {
      const frag = document.createDocumentFragment();
      copyChildren(node, frag, depth);
      return frag;
    }
    tag = "p";
  } else {
    tag = RENAME[tagUp] || tagUp.toLowerCase();
  }

  if (!ALLOWED.has(tag)) {
    // 모르는 태그는 껍데기만 벗기고 내용(글자)은 남겨요
    const frag = document.createDocumentFragment();
    copyChildren(node, frag, depth);
    return frag;
  }

  if (tag === "img") {
    const id = node.getAttribute("data-img");
    if (!id || !ID_RE.test(id)) return null; // 우리가 올린 이미지만
    const img = document.createElement("img");
    img.setAttribute("data-img", id);
    img.setAttribute("alt", (node.getAttribute("alt") || "").slice(0, 200));
    const size = node.getAttribute("data-size");
    if (IMAGE_SIZES.includes(size)) img.setAttribute("data-size", size);
    img.setAttribute("loading", "lazy");
    return img;
  }

  const el = document.createElement(tag);
  if (tag === "a") {
    const href = String(node.getAttribute("href") || "").trim();
    if (/^(https?:|mailto:)/i.test(href)) {
      el.setAttribute("href", href);
      el.setAttribute("target", "_blank");
      el.setAttribute("rel", "noopener noreferrer nofollow");
    }
  }
  if (STYLED.has(tag)) {
    const styles = tagUp === "FONT" ? fontTagStyle(node).concat(cleanStyle(node)) : cleanStyle(node);
    for (const [k, v] of styles) el.style.setProperty(k, v);
    if (!el.getAttribute("style")) el.removeAttribute("style");
  }
  copyChildren(node, el, depth);
  // 사진이 없는 figure(빈 칸)는 껍데기를 벗겨요
  if (tag === "figure" && !el.querySelector("img")) {
    const frag = document.createDocumentFragment();
    if ((el.textContent || "").trim()) { const p = document.createElement("p"); while (el.firstChild) p.appendChild(el.firstChild); frag.appendChild(p); }
    return frag;
  }
  // 내용도 스타일도 없는 span은 버려요
  if (tag === "span" && !el.getAttribute("style")) {
    const frag = document.createDocumentFragment();
    while (el.firstChild) frag.appendChild(el.firstChild);
    return frag;
  }
  return el;
}

// HTML 문자열 → 안전한 DocumentFragment
export function sanitizeToFragment(html) {
  const parsed = new DOMParser().parseFromString(`<!doctype html><body>${String(html || "")}`, "text/html");
  const frag = document.createDocumentFragment();
  for (const child of parsed.body.childNodes) {
    const n = cleanNode(child, 0);
    if (n) frag.appendChild(n);
  }
  return frag;
}

// DOM 요소(에디터 내용) → 안전한 HTML 문자열 (저장용)
export function sanitizeElementToHtml(root) {
  const frag = document.createDocumentFragment();
  for (const child of root.childNodes) {
    const n = cleanNode(child, 0);
    if (n) frag.appendChild(n);
  }
  const box = document.createElement("div");
  box.appendChild(frag);
  return box.innerHTML; // 읽기만 해요 (정리된 결과를 문자열로)
}

// 저장된 HTML의 순수 글자 (검색·요약·글자 수용)
export function htmlToText(html) {
  const frag = sanitizeToFragment(html);
  const box = document.createElement("div");
  box.appendChild(frag);
  box.querySelectorAll("[data-widget]").forEach((w) => w.remove()); // 위젯 안내 글은 요약 · 글자 수에서 빼요
  box.querySelectorAll("p, h2, h3, li, blockquote, figcaption, pre").forEach((b) => b.append("\n"));
  return (box.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
}

// 본문 안 이미지 id 목록
export function imageIds(html) {
  const frag = sanitizeToFragment(html);
  return [...frag.querySelectorAll("img[data-img]")].map((i) => i.getAttribute("data-img"));
}
