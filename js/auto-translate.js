// 관리자 전용: 저장 · 발행할 때 한국어 → 영어 자동 번역 (D41)
// - 크롬에 들어 있는 번역 기능(Translator API, 기기 안에서 번역)을 써요. API 키 · 서버 · 요금이 없어요.
// - 번역 결과는 문서의 en 칸에 저장돼서, 방문자가 영어로 바꾸면 기다림 없이 바로 보여요 (js/content-lang.js).
// - en.src에 번역할 때의 한국어 지문(해시)을 남겨, 한국어가 바뀐 경우에만 다시 번역해요. 영어를 손으로 고친 뒤 한국어를 안 바꾸면 고친 영어가 그대로예요.
// - 크롬이 아니거나 번역 기능이 없으면 { ok: false } — 저장은 그대로 되고 영어 화면엔 한국어 + "Korean only" 안내가 보여요.
const HANGUL = /[가-힣ㄱ-ㅎ]/;
let translatorPromise = null;
let ready = false;

export function hasTranslator() { return typeof self !== "undefined" && "Translator" in self; }
const fail = (code) => Object.assign(new Error(code), { code });
const withTimeout = (p, ms, code) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(fail(code)), ms))]);

// wait=false(저장할 때): 번역 기능이 아직 기기에 없으면 내려받기만 시작하고 바로 돌아와요 → 저장이 멈추지 않아요
// wait=true('지금 다시 번역' · '한 번에 채우기'): 내려받기가 끝날 때까지 기다려요 (진행률 표시)
async function translator(onProgress, wait) {
  if (!hasTranslator()) throw fail("unsupported");
  if (ready && translatorPromise) return translatorPromise;
  const opts = { sourceLanguage: "ko", targetLanguage: "en" };
  if (!translatorPromise) {
    const avail = await withTimeout(self.Translator.availability(opts), 5000, "unsupported").catch(() => "unavailable");
    if (avail === "unavailable") throw fail("unsupported");
    translatorPromise = withTimeout(self.Translator.create({
      ...opts,
      monitor(m) { m.addEventListener("downloadprogress", (e) => onProgress && onProgress(Math.round((e.loaded || 0) * 100))); },
    }), 10 * 60 * 1000, "download-timeout").then((t) => { ready = true; return t; }, (e) => { translatorPromise = null; throw e; });
    if (avail !== "available" && !wait) { translatorPromise.catch(() => {}); throw fail("downloading"); }
  } else if (!wait) throw fail("downloading");
  return translatorPromise;
}
const REASONS = {
  unsupported: "이 브라우저에는 자동 번역 기능이 없어요 (데스크톱 크롬에서 돼요)",
  downloading: "크롬이 번역 기능을 처음 한 번 내려받는 중이에요. 몇 분 뒤 다시 저장하면 영어가 채워져요",
  "download-timeout": "번역 기능을 내려받지 못했어요. 인터넷 연결을 확인해 주세요",
  "translate-timeout": "번역이 너무 오래 걸려 멈췄어요",
};
const reasonOf = (e) => REASONS[e && e.code] || "자동 번역을 하지 못했어요";
const tr1 = (t, s) => withTimeout(t.translate(s), 60000, "translate-timeout");

// 한국어 지문: 내용이 바뀌었는지만 알면 돼서 짧은 해시면 충분해요
export function fingerprint(obj) {
  const s = JSON.stringify(obj);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return `v1-${h.toString(36)}-${s.length}`;
}

// 줄 단위로 번역해 줄바꿈 · 빈 줄(문단)을 그대로 살려요. 한글이 없는 줄은 그대로 둬요
async function translateText(t, s) {
  const lines = String(s || "").split("\n");
  const out = [];
  for (const line of lines) out.push(HANGUL.test(line) ? (await tr1(t, line.trim())).trim() : line);
  return out.join("\n").trim();
}

// HTML 번역: 문장이 굵게 · 기울임 같은 서식으로 쪼개져 있으면 조각마다 번역하면 어색해져서,
// 서식만 들어 있는 문단(p · li · h2 · 인용 …)은 문단 전체를 한 번에 번역해요 (그 문단의 굵게 · 기울임은 빠져요).
// 링크 · 사진 · 위젯이 든 문단은 태그를 지키려고 글자 조각마다 번역해요. 사진 · 링크 · 문단 구조는 그대로예요.
const BLOCKS = "p, li, h1, h2, h3, h4, blockquote, figcaption, td, th";
const INLINE_ONLY = /^(STRONG|B|EM|I|U|S|SPAN|MARK|SMALL|SUB|SUP|CODE|BR)$/;
async function translateHtml(t, html) {
  const tpl = document.createElement("template");
  tpl.innerHTML = String(html || "");
  const cache = new Map();
  const tr = async (key) => { if (!cache.has(key)) cache.set(key, (await tr1(t, key)).trim()); return cache.get(key); };
  const done = new Set(); // 문단째 번역한 곳은 아래 조각 번역에서 건너뛰어요
  for (const el of tpl.content.querySelectorAll(BLOCKS)) {
    if (!HANGUL.test(el.textContent) || el.querySelector(BLOCKS)) continue;
    if (![...el.querySelectorAll("*")].every((c) => INLINE_ONLY.test(c.tagName))) continue;
    // <br>로 나뉜 줄은 줄마다 번역해 줄바꿈을 살려요
    const lines = [];
    let cur = "";
    el.childNodes.forEach(function walk(n) {
      if (n.nodeName === "BR") { lines.push(cur); cur = ""; } else if (n.nodeType === 3) cur += n.nodeValue; else n.childNodes.forEach(walk);
    });
    lines.push(cur);
    const out = [];
    for (const line of lines) out.push(HANGUL.test(line) ? await tr(line.replace(/\s+/g, " ").trim()) : line);
    done.add(el);
    el.replaceChildren(...out.flatMap((line, i) => (i ? [document.createElement("br"), document.createTextNode(line)] : [document.createTextNode(line)])));
  }
  // 남은 조각 (링크 · 사진이 든 문단, 문단 밖 글자)
  const walker = document.createTreeWalker(tpl.content, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let n;
  while ((n = walker.nextNode())) if (HANGUL.test(n.nodeValue) && ![...done].some((b) => b.contains(n))) nodes.push(n);
  for (const node of nodes) {
    const raw = node.nodeValue;
    node.nodeValue = raw.match(/^\s*/)[0] + (await tr(raw.trim())) + raw.match(/\s*$/)[0];
  }
  return tpl.innerHTML;
}

// 작업(케이스 스터디): 한국어 칸 → en 칸 모양 그대로
export const WORK_KEYS = ["title", "summary", "industry", "period", "role", "problem", "process", "result"];
export async function translateWork(ko, onProgress, wait = false) {
  try {
    const t = await translator(onProgress, wait);
    const en = {};
    for (const k of WORK_KEYS) en[k] = await translateText(t, ko[k]);
    en.tags = [];
    for (const tag of ko.tags || []) { const v = HANGUL.test(tag) ? (await tr1(t, tag)).trim() : tag; if (v && !en.tags.includes(v)) en.tags.push(v.slice(0, 40)); }
    en.tags = en.tags.slice(0, 8);
    en.src = fingerprint(workSource(ko));
    return { ok: true, en };
  } catch (e) {
    return { ok: false, code: e && e.code, reason: reasonOf(e) };
  }
}
export const workSource = (ko) => Object.fromEntries(WORK_KEYS.map((k) => [k, ko[k] || ""]).concat([["tags", ko.tags || []]]));

// 기록 글: 제목 · 요약 · 본문(HTML)
export async function translatePost(ko, htmlToText, onProgress, wait = false) {
  try {
    const t = await translator(onProgress, wait);
    const contentHtml = await translateHtml(t, ko.contentHtml);
    return { ok: true, en: { title: await translateText(t, ko.title), summary: await translateText(t, ko.summary), contentHtml, body: htmlToText(contentHtml).slice(0, 100000), src: fingerprint(postSource(ko)) } };
  } catch (e) {
    return { ok: false, code: e && e.code, reason: reasonOf(e) };
  }
}
export const postSource = (ko) => ({ title: ko.title || "", summary: ko.summary || "", contentHtml: ko.contentHtml || "" });

// 다시 번역해야 하나: 영어가 없거나, 번역 뒤 한국어가 바뀌었을 때
export function needsTranslation(en, src) {
  return !en || !en.title || en.src !== src;
}
