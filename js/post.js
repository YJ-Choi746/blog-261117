import { auth, db, isConfigured, onAuthStateChanged, doc, getDoc, friendlyError, formatDate } from "./firebase.js";
import { renderBody } from "./render.js";

const $ = (id) => document.getElementById(id);
const id = new URLSearchParams(location.search).get("id");

function fail(msg) { $("post-status").textContent = msg; }

async function show() {
  try {
    const snap = await getDoc(doc(db, "posts", id));
    if (!snap.exists()) { fail("글을 찾을 수 없어요."); return; }
    const p = snap.data();
    $("post-status").hidden = true;
    document.title = `${p.title} — your.name`;
    $("post-cat").textContent = p.category || "";
    $("post-title").textContent = p.title;
    $("post-date").textContent = formatDate(p.publishedAt || p.updatedAt);
    $("post-meta").hidden = false;
    $("draft-note").hidden = p.status === "published";
    renderBody(p.body, $("post-body"));
    const tags = $("post-tags");
    tags.replaceChildren();
    for (const t of p.tags || []) {
      const s = document.createElement("span"); s.className = "tag"; s.textContent = `#${t}`; tags.appendChild(s);
    }
  } catch (err) {
    // 임시저장 글은 관리자만 읽을 수 있어서, 다른 사람에게는 '찾을 수 없음'으로 보여요
    fail(err && err.code === "permission-denied" ? "글을 찾을 수 없어요." : friendlyError(err));
  }
}

if (!isConfigured || !id) {
  fail("글을 찾을 수 없어요.");
} else {
  // 로그인 상태가 정해진 뒤에 읽어야, 관리자가 임시저장 글도 볼 수 있어요
  let started = false;
  onAuthStateChanged(auth, () => { if (!started) { started = true; show(); } });
}
