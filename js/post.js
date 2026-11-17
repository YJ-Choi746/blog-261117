import { auth, db, isConfigured, onAuthStateChanged, doc, getDoc, friendlyError, formatDate } from "./firebase.js";
import { renderBody } from "./render.js";
import { sanitizeToFragment } from "./sanitize.js";
import { resolveImages } from "./images.js";
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
  if (p) window.trackEvent("view_post", { post_id: id, post_title: p.title, post_category: p.category || "" });
}

// GA: 본문을 50% · 90%까지 읽으면 read_post (각각 한 번)
function trackReading(p) {
  if (typeof window.trackEvent !== "function") return;
  const body = $("post-body");
  const sent = new Set();
  const check = () => {
    const r = body.getBoundingClientRect();
    if (r.height <= 0) return;
    const seen = Math.min(1, Math.max(0, (window.innerHeight - r.top) / r.height));
    for (const depth of [50, 90]) {
      if (seen * 100 >= depth && !sent.has(depth)) {
        sent.add(depth);
        window.trackEvent("read_post", { post_id: id, post_title: p.title, post_category: p.category || "", read_depth: String(depth) });
      }
    }
    if (sent.size === 2) window.removeEventListener("scroll", onScroll);
  };
  let ticking = false;
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; check(); }); } };
  window.addEventListener("scroll", onScroll, { passive: true });
  setTimeout(check, 800); // 짧은 글은 열자마자 다 보일 수 있어요
}

function fail(msg) { $("post-status").textContent = msg; trackView(null); }

async function show(user) {
  try {
    const snap = await getDoc(doc(db, "posts", id));
    if (!snap.exists()) { fail("글을 찾을 수 없어요."); return; }
    const p = snap.data();
    $("post-status").hidden = true;
    document.title = `${p.title} — Jae`;
    trackView(p);
    $("post-cat").textContent = p.category || "";
    $("post-title").textContent = p.title;
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
