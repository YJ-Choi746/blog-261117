// 작업 관리 목록 (PRD v1.1 F6) — 초안 · 게시 상태를 보고 편집 화면으로 들어가요
import {
  auth, db, isConfigured, onAuthStateChanged, signOut, collection, getDocs, friendlyError, formatDate, markAdminBrowser
} from "./firebase.js";

const $ = (id) => document.getElementById(id);
const STATE = { draft: "초안", published: "게시" };
function millis(t) { return t && typeof t.toMillis === "function" ? t.toMillis() : 0; }

function row(w) {
  const r = document.createElement("div");
  r.className = "manage-row work-row";
  const mid = document.createElement("div");
  mid.style.minWidth = "0";
  const a = document.createElement("a");
  a.className = "manage-title";
  a.href = `work.html?id=${encodeURIComponent(w.id)}`;
  a.textContent = w.title || w.name || "(이름 없음)";
  const meta = document.createElement("div");
  meta.className = "manage-meta";
  const st = document.createElement("span");
  st.className = `state state-${w.status === "published" ? "published" : "draft"}`;
  st.textContent = STATE[w.status] || "초안";
  const name = document.createElement("span"); name.textContent = w.name || "";
  const cat = document.createElement("span"); cat.textContent = w.category || "";
  const date = document.createElement("span"); date.textContent = `수정 ${formatDate(w.updatedAt)}`;
  meta.append(st, name, cat, date);
  mid.append(a, meta);
  const edit = document.createElement("a");
  edit.className = "btn btn-outline"; edit.textContent = "편집"; edit.href = a.href;
  r.append(mid, edit);
  return r;
}

if (!isConfigured) {
  $("checking").hidden = true; $("config-notice").hidden = false;
} else {
  onAuthStateChanged(auth, async (user) => {
    if (!user) { location.replace("login.html?next=works.html"); return; }
    markAdminBrowser();
    $("who").textContent = user.email || "";
    $("checking").hidden = true; $("manage").hidden = false;
    try {
      const snap = await getDocs(collection(db, "works"));
      const works = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((x, y) => millis(y.updatedAt) - millis(x.updatedAt));
      const pub = works.filter((w) => w.status === "published").length;
      $("counts").textContent = `전체 ${works.length} · 게시 ${pub} · 초안 ${works.length - pub}`;
      $("work-list").replaceChildren(...works.map(row));
      $("work-list").hidden = !works.length;
      $("list-status").hidden = !!works.length;
      if (!works.length) $("list-status").textContent = "아직 작업이 없어요. 새 작업을 만들어 보세요.";
    } catch (err) { $("list-status").textContent = friendlyError(err); }
  });
  $("logout").addEventListener("click", async () => { await signOut(auth); location.replace("login.html"); });
}
