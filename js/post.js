import { auth, db, isConfigured, onAuthStateChanged, doc, getDoc, friendlyError, formatDate } from "./firebase.js";
import { renderBody } from "./render.js";
import { sanitizeToFragment } from "./sanitize.js";
import { resolveImages, getImageData } from "./images.js";
import { adminButtons } from "./post-actions.js";

const $ = (id) => document.getElementById(id);
const id = new URLSearchParams(location.search).get("id");

function fail(msg) { $("post-status").textContent = msg; }

async function show(user) {
  try {
    const snap = await getDoc(doc(db, "posts", id));
    if (!snap.exists()) { fail("글을 찾을 수 없어요."); return; }
    const p = snap.data();
    $("post-status").hidden = true;
    document.title = `${p.title} — Yeonjae`;
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

    if (p.coverImageId && p.format === "html") {
      getImageData(p.coverImageId).then((d) => { if (d) { $("post-cover").src = d; $("post-cover-wrap").hidden = false; } });
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
