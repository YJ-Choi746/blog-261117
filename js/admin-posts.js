import {
  auth, db, isConfigured, onAuthStateChanged, signOut,
  collection, getDocs, doc, updateDoc, serverTimestamp, friendlyError, formatDate, markAdminBrowser
} from "./firebase.js";
import { applyViewerMode, isViewer } from "./viewer.js";
import { getImageData } from "./images.js";
import { adminButtons } from "./post-actions.js";

const $ = (id) => document.getElementById(id);
const list = $("manage-list");
const statusEl = $("list-status");
const STATE_LABEL = { published: "발행", draft: "임시저장", private: "비공개" };
let posts = [];
let filter = "";
let keyword = "";

function millis(t) { return t && typeof t.toMillis === "function" ? t.toMillis() : 0; }
function nowTs() { const n = Date.now(); return { toMillis: () => n, toDate: () => new Date(n) }; }
function say(msg, isError) {
  const el = $(isError ? "manage-error" : "manage-ok");
  $("manage-error").hidden = true; $("manage-ok").hidden = true;
  el.textContent = msg; el.hidden = false;
}

// 공개 범위 바꾸기 (글을 열지 않고 목록에서 바로). 처음 공개할 때만 발행일을 정해요.
async function changeStatus(p, status) {
  const patch = { status, updatedAt: serverTimestamp() };
  if (status !== "draft" && !p.publishedAt) patch.publishedAt = serverTimestamp();
  await updateDoc(doc(db, "posts", p.id), patch);
  p.status = status;
  p.updatedAt = nowTs();
  if (patch.publishedAt) p.publishedAt = nowTs();
}

function row(p) {
  const r = document.createElement("div");
  r.className = "manage-row";

  const thumb = document.createElement("img");
  thumb.className = "thumb"; thumb.alt = "";
  if (p.coverImageId) getImageData(p.coverImageId).then((d) => { if (d) thumb.src = d; });

  const mid = document.createElement("div");
  mid.style.minWidth = "0";
  const title = document.createElement("a");
  title.className = "manage-title";
  title.href = `write.html?id=${encodeURIComponent(p.id)}`;
  title.textContent = p.title || "(제목 없음)";
  const meta = document.createElement("div");
  meta.className = "manage-meta";
  const st = document.createElement("span");
  st.className = `state state-${p.status}`; st.textContent = STATE_LABEL[p.status] || p.status;
  const cat = document.createElement("span"); cat.textContent = p.category || "";
  const date = document.createElement("span"); date.textContent = `수정 ${formatDate(p.updatedAt)}`;
  meta.append(st, cat, date);
  if (p.publishedAt) { const pd = document.createElement("span"); pd.textContent = `발행 ${formatDate(p.publishedAt)}`; meta.appendChild(pd); }
  mid.append(title, meta);

  const actions = document.createElement("div");
  const view = document.createElement("a");
  view.className = "btn btn-outline"; view.textContent = "보기";
  view.href = `../post.html?id=${encodeURIComponent(p.id)}`;
  view.style.minHeight = "40px"; view.style.padding = "0 14px"; view.style.fontSize = "14px";
  const btns = adminButtons({
    id: p.id, data: p, editHref: `write.html?id=${encodeURIComponent(p.id)}`,
    onDeleted: () => { posts = posts.filter((x) => x.id !== p.id); render(); },
    onError: (msg) => { $("manage-error").textContent = msg; $("manage-error").hidden = false; }
  });
  actions.className = "manage-actions";

  // 공개 범위 (바로 바뀌어요)
  const visId = `vis-${p.id}`;
  const visLabel = document.createElement("label");
  visLabel.className = "sr-only"; visLabel.htmlFor = visId; visLabel.textContent = `${p.title} 공개 범위`;
  const vis = document.createElement("select");
  vis.id = visId; vis.className = "tb-select vis-select";
  [["published", "전체 공개"], ["private", "비공개"], ["draft", "임시저장"]].forEach(([v, t]) => vis.add(new Option(t, v)));
  vis.value = p.status;
  vis.addEventListener("change", async () => {
    const to = vis.value; vis.disabled = true;
    try {
      await changeStatus(p, to);
      say(`"${p.title}" → ${STATE_LABEL[to]}(으)로 바꿨어요.`);
      render();
    } catch (err) { vis.value = p.status; vis.disabled = false; say(friendlyError(err), true); }
  });

  actions.append(visLabel, vis, view, btns);

  r.append(thumb, mid, actions);
  return r;
}

function render() {
  const counts = { published: 0, draft: 0, private: 0 };
  posts.forEach((p) => { if (counts[p.status] !== undefined) counts[p.status]++; });
  $("counts").textContent = `전체 ${posts.length} · 발행 ${counts.published} · 임시저장 ${counts.draft} · 비공개 ${counts.private}`;
  const k = keyword.toLowerCase();
  const shown = posts.filter((p) => (!filter || p.status === filter) &&
    (!k || (p.title || "").toLowerCase().includes(k) || (p.body || "").toLowerCase().includes(k)));
  list.replaceChildren(...shown.map(row));
  list.hidden = !shown.length;
  statusEl.hidden = !!shown.length;
  if (!shown.length) statusEl.textContent = posts.length ? "조건에 맞는 글이 없어요." : "아직 쓴 글이 없어요. 새 글을 써 보세요.";
}

document.querySelectorAll("#tabs .chip").forEach((c) => c.addEventListener("click", () => {
  filter = c.dataset.status;
  document.querySelectorAll("#tabs .chip").forEach((x) => x.setAttribute("aria-pressed", String(x === c)));
  render();
}));
$("search").addEventListener("input", (e) => { keyword = e.target.value.trim(); render(); });

if (!isConfigured) {
  $("checking").hidden = true; $("config-notice").hidden = false;
} else {
  onAuthStateChanged(auth, async (user) => {
    if (!user) { location.replace("login.html?next=posts.html"); return; }
    markAdminBrowser();
    $("who").textContent = user.email || "";
    applyViewerMode(user, () => signOut(auth)); // 평가자 보기 전용 (D39)
    $("checking").hidden = true; $("manage").hidden = false;
    try {
      const snap = await getDocs(collection(db, "posts"));
      posts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      posts.sort((a, b) => millis(b.updatedAt) - millis(a.updatedAt));
      render();
    } catch (err) {
      statusEl.textContent = friendlyError(err);
    }
  });
  $("logout").addEventListener("click", async () => { await signOut(auth); location.replace("login.html"); });
}
