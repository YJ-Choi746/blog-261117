import { auth, db, isConfigured, onAuthStateChanged, doc, getDoc, collection, getDocs, query, where, friendlyError, formatDate } from "./firebase.js";
import { renderBody } from "./render.js";
import { sanitizeToFragment } from "./sanitize.js";
import { resolveImages, getImageData } from "./images.js";
import { adminButtons } from "./post-actions.js";

const $ = (id) => document.getElementById(id);
const id = new URLSearchParams(location.search).get("id");

let tracked = false;
// GA: 글 제목이 정해진 뒤 한 번만 기록해요 (글 상세는 자동 page_view를 끄고 여기서 보내요)
function trackView(p) {
  if (tracked || typeof window.trackEvent !== "function") return;
  tracked = true;
  // GA는 주소의 ?id= 를 떼고 경로만 보여줘요 → 글마다 따로 보이도록 /post/글ID 경로로 기록해요
  // (GitHub Pages는 /blog-261117/post/글ID, Firebase는 /post/글ID)
  const pageLocation = p
    ? location.origin + location.pathname.replace(/post\.html$/, "post/" + encodeURIComponent(id))
    : location.href;
  window.trackEvent("page_view", { page_title: document.title, page_location: pageLocation });
  if (p) window.trackEvent("view_post", postParams(p));
}

// GA: 글마다 같이 보내는 매개변수 (docs/analytics-events.md)
function postParams(p) {
  return { post_id: id, post_title: p.title, post_category: p.category || "", post_published_at: publishedDate(p) };
}

// 발행일 YYYY-MM-DD (한국 시간). 발행 전 글은 "미발행"
function publishedDate(p) {
  const ts = p.status === "published" ? p.publishedAt : null;
  const d = ts && typeof ts.toDate === "function" ? ts.toDate() : null;
  if (!d || Number.isNaN(d.getTime())) return "미발행";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

// GA: 본문을 50% · 90%까지 읽으면 read_post (각각 한 번)
// 완독 보정 (PRD FR-02): 본문 도달 비율 + 최소 읽기 시간을 둘 다 채워야 보내요 (docs/analytics-events.md "완독 보정")
// 90% 최소 시간 = 글자 수 ÷ 500 × 60초 × 0.5 (5~60초), 50% = 그 절반 (단, 5초 안 이탈은 0건이 되도록 최소 5초)
const CHARS_PER_MIN = 500, MIN_SEC = 5, MAX_SEC_90 = 60, RECHECK_MS = 2000;

function trackReading(p) {
  if (typeof window.trackEvent !== "function") return;
  const body = $("post-body");
  const sent = new Set();
  let maxSeen = 0;

  // 탭을 보고 있던 시간만 세요
  let activeMs = 0, since = document.visibilityState === "visible" ? performance.now() : null;
  const activeSec = () => (activeMs + (since === null ? 0 : performance.now() - since)) / 1000;
  const onVisibility = () => {
    if (document.visibilityState === "visible") { if (since === null) since = performance.now(); }
    else if (since !== null) { activeMs += performance.now() - since; since = null; }
    check();
  };

  const required90 = () => {
    const chars = (body.textContent || "").replace(/\s+/g, "").length;
    return Math.min(MAX_SEC_90, Math.max(MIN_SEC, (chars / CHARS_PER_MIN) * 60 * 0.5));
  };
  const requiredSec = (depth) => (depth === 90 ? required90() : Math.max(MIN_SEC, required90() / 2));

  const check = () => {
    const r = body.getBoundingClientRect();
    if (r.height > 0) maxSeen = Math.max(maxSeen, Math.min(1, Math.max(0, (window.innerHeight - r.top) / r.height)));
    const t = activeSec();
    for (const depth of [50, 90]) {
      if (sent.has(depth) || maxSeen * 100 < depth || t < requiredSec(depth)) continue;
      sent.add(depth);
      window.trackEvent("read_post", { ...postParams(p), read_depth: String(depth) });
    }
    if (sent.size === 2) stop();
  };

  let ticking = false;
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; check(); }); } };
  // 사진이 늦게 떠서 본문 높이가 바뀌면 다시 재요
  const resize = typeof ResizeObserver === "function" ? new ResizeObserver(onScroll) : null;
  const timer = setInterval(check, RECHECK_MS); // 스크롤 없는 짧은 글 · 멈춰서 읽는 동안에도 2초마다 다시 확인
  function stop() {
    clearInterval(timer);
    window.removeEventListener("scroll", onScroll);
    document.removeEventListener("visibilitychange", onVisibility);
    if (resize) resize.disconnect();
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);
  if (resize) resize.observe(body);
  check();
}

// 글 아래 "이전 글 · 다음 글" — 발행된 글을 발행일 순으로 놓고 바로 앞 · 뒤 글을 보여줘요
// 이전 글 = 이 글보다 먼저 발행된 글, 다음 글 = 이 글 다음에 발행된 글
// 모든 글에서 두 칸 다 누를 수 있게, 끝에 닿으면 한 바퀴 돌아요 (가장 최근 글의 다음 = 처음 글)
async function renderPostNav() {
  const nav = $("post-nav");
  try {
    const snap = await getDocs(query(collection(db, "posts"), where("status", "==", "published")));
    const t = (x) => (x && typeof x.toMillis === "function" ? x.toMillis() : 0);
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => t(a.publishedAt) - t(b.publishedAt));
    const i = list.findIndex((x) => x.id === id);
    const n = list.length;
    if (i < 0 || n < 2) return; // 임시저장 · 비공개 글, 또는 발행 글이 하나뿐이면 보여주지 않아요
    const prev = list[(i - 1 + n) % n], next = list[(i + 1) % n];
    nav.replaceChildren(navItem(prev, "prev", i === 0), navItem(next, "next", i === n - 1));
    nav.hidden = false;
  } catch { /* 이전 · 다음 글을 못 불러와도 글은 그대로 보여요 */ }
}

// wrapped: 끝에서 한 바퀴 돈 칸 (첫 글의 이전 = 가장 최근 글, 가장 최근 글의 다음 = 첫 글)
function navItem(p, dir, wrapped) {
  const a = document.createElement("a");
  a.className = `post-nav-item ${dir}`;
  a.href = `post.html?id=${encodeURIComponent(p.id)}`;
  // GA: 이전 · 다음 글 클릭도 select_post로 (docs/analytics-events.md)
  a.setAttribute("data-ga-event", "select_post");
  a.setAttribute("data-ga-post_id", p.id);
  a.setAttribute("data-ga-post_title", p.title || "");
  a.setAttribute("data-ga-post_category", p.category || "");
  a.setAttribute("data-ga-list_name", dir === "prev" ? "post_nav_prev" : "post_nav_next");
  a.setAttribute("data-ga-list_position", "1");

  const text = document.createElement("span");
  text.className = "post-nav-text";
  const label = document.createElement("span");
  label.className = "post-nav-label";
  label.textContent = dir === "prev"
    ? (wrapped ? "← 가장 최근 글로" : "← 이전 글")
    : (wrapped ? "처음 글로 →" : "다음 글 →");
  const title = document.createElement("span");
  title.className = "post-nav-title";
  title.textContent = p.title || "(제목 없음)";
  const meta = document.createElement("span");
  meta.className = "post-nav-meta";
  meta.textContent = [p.category, formatDate(p.publishedAt)].filter(Boolean).join(" · ");
  text.append(label, title, meta);
  a.appendChild(text);

  if (p.coverImageId) {
    const img = document.createElement("img");
    img.className = "post-nav-thumb"; img.alt = ""; img.loading = "lazy";
    getImageData(p.coverImageId).then((d) => { if (d) img.src = d; else img.remove(); });
    if (dir === "prev") a.prepend(img); else a.appendChild(img);
  }
  return a;
}

// 공유 링크: 카카오톡 · SNS에 붙이면 글마다 제목 · 요약 · 대표 이미지 카드가 떠요.
// 이 주소(p/글ID.html)는 GitHub Actions가 Firebase에 올릴 때 글마다 만들어요 (.github/scripts/share-pages.mjs).
// 새로 발행한 글은 다음 배포(늦어도 1시간 안) 뒤에 공유 페이지가 생겨요.
const SHARE_BASE = "https://blog---261117.web.app/p/";
function setupShare(p) {
  const btn = $("share-btn"), msg = $("share-msg");
  const url = SHARE_BASE + encodeURIComponent(id) + ".html";
  // GA: share_post (docs/analytics-events.md)
  btn.setAttribute("data-ga-event", "share_post");
  btn.setAttribute("data-ga-post_id", id);
  btn.setAttribute("data-ga-post_title", p.title || "");
  btn.setAttribute("data-ga-post_category", p.category || "");
  btn.setAttribute("data-ga-method", "copy_link");
  btn.hidden = false;
  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(url);
      msg.textContent = "공유 링크를 복사했어요. 카카오톡 · SNS에 붙여 넣으세요.";
    } catch {
      msg.textContent = url; // 복사가 막힌 브라우저에서는 주소를 보여줘서 직접 복사하게 해요
    }
    msg.hidden = false;
  });
}

function fail(msg) { $("post-status").textContent = msg; trackView(null); }

async function show(user) {
  try {
    const snap = await getDoc(doc(db, "posts", id));
    if (!snap.exists()) { fail("글을 찾을 수 없어요."); return; }
    const p = snap.data();
    $("post-status").hidden = true;
    document.title = `${p.title} — Jae`;
    // 글마다 제목 · 설명(요약)을 페이지 정보에도 넣어요 (검색 결과 · 브라우저 탭)
    const desc = (p.summary || (p.body || "").replace(/\s+/g, " ").slice(0, 120) || "").trim();
    if (desc) { $("meta-desc").setAttribute("content", desc); $("og-desc").setAttribute("content", desc); }
    $("og-title").setAttribute("content", document.title);
    trackView(p);
    $("post-cat").textContent = p.category || "";
    $("post-title").textContent = p.title;
    if (p.summary) { $("post-summary").textContent = p.summary; $("post-summary").hidden = false; }
    if (p.status === "published") setupShare(p);
    $("post-date").textContent = formatDate(p.publishedAt || p.updatedAt);
    $("post-meta").hidden = false;
    const note = { draft: "임시저장된 글이에요. 관리자에게만 보여요.", private: "비공개 글이에요. 관리자에게만 보여요." }[p.status];
    $("draft-note").textContent = note || "";
    $("draft-note").hidden = !note;
    if (user) {
      $("admin-slot").appendChild(adminButtons({
        id, data: p, editHref: `admin/write.html?id=${encodeURIComponent(id)}`,
        onDeleted: () => location.replace("posts.html"),
        onError: (msg) => { $("post-status").hidden = false; $("post-status").textContent = msg; }
      }));
    }

    const body = $("post-body");
    if (p.format === "html") {
      body.className = "rich";
      body.style.padding = "40px 0 56px";
      body.replaceChildren(sanitizeToFragment(p.contentHtml || ""));
      resolveImages(body);
    } else {
      renderBody(p.body, body);
    }
    trackReading(p);
    renderPostNav();
    const tags = $("post-tags");
    tags.replaceChildren();
    for (const t of p.tags || []) {
      const s = document.createElement("span"); s.className = "tag"; s.textContent = `#${t}`; tags.appendChild(s);
    }
  } catch (err) {
    // 임시저장·비공개 글은 관리자만 읽을 수 있어서, 다른 사람에게는 '찾을 수 없음'으로 보여요
    fail(err && err.code === "permission-denied" ? "글을 찾을 수 없어요." : friendlyError(err));
  }
}

if (!isConfigured || !id) {
  fail("글을 찾을 수 없어요.");
} else {
  let started = false;
  onAuthStateChanged(auth, (user) => { if (!started) { started = true; show(user); } });
}
