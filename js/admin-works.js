// 작업 관리 목록 (PRD v1.1 F6) — 초안 · 게시 상태를 보고 편집 화면으로 들어가요
import {
  auth, db, isConfigured, onAuthStateChanged, signOut, collection, getDocs, friendlyError, formatDate, markAdminBrowser,
  doc, setDoc, serverTimestamp
} from "./firebase.js";
import { loadCategories, normalizeCategory } from "./categories.js";

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

// ---- 분야 이름 바꾸기 (4칸): settings/categories에 저장하고, 옛 이름으로 저장된 작업도 새 이름으로 바꿔요 ----
async function setupCategoryEditor(works) {
  let labels = await loadCategories();
  labels.forEach((l, i) => { $(`cat-${i}`).value = l; });
  $("cat-save").addEventListener("click", async () => {
    const next = [0, 1, 2, 3].map((i) => $(`cat-${i}`).value.trim().slice(0, 20));
    if (next.some((x) => !x)) { $("cat-msg").textContent = "네 칸 모두 이름을 써 주세요."; return; }
    if (new Set(next).size < 4) { $("cat-msg").textContent = "이름이 서로 달라야 해요."; return; }
    const btn = $("cat-save"); btn.disabled = true; $("cat-msg").textContent = "저장하는 중…";
    try {
      await setDoc(doc(db, "settings", "categories"), { labels: next, updatedAt: serverTimestamp() });
      // 옛 이름(예전 '기타' 포함)으로 저장된 작업 → 같은 칸의 새 이름
      let moved = 0;
      for (const w of works) {
        const cur = normalizeCategory(w.category, labels);
        const slot = labels.indexOf(cur);
        if (slot >= 0 && w.category !== next[slot]) {
          await setDoc(doc(db, "works", w.id), { category: next[slot], updatedAt: serverTimestamp() }, { merge: true });
          w.category = next[slot]; moved++;
        }
      }
      labels = next;
      $("cat-msg").textContent = `저장했어요.${moved ? ` 작업 ${moved}건의 분야도 바꿨어요.` : ""}`;
      $("work-list").replaceChildren(...works.map(row));
    } catch (err) { $("cat-msg").textContent = `저장하지 못했어요. ${friendlyError(err)} (보안 규칙을 다시 게시했는지 확인해 주세요)`; }
    finally { btn.disabled = false; }
  });
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
      setupCategoryEditor(works);
    } catch (err) { $("list-status").textContent = friendlyError(err); }
  });
  $("logout").addEventListener("click", async () => { await signOut(auth); location.replace("login.html"); });
}
