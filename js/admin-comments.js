// 관리자 댓글 관리 (PRD FR-06) — 승인 대기 댓글을 승인 · 숨김 · 삭제해요
// 글마다 posts/{글ID}/comments를 불러와요 (관리자는 보안 규칙상 모든 댓글을 읽을 수 있어요)
// 닉네임 · 내용은 textContent로만 넣어요.
import {
  auth, db, isConfigured, onAuthStateChanged, signOut,
  collection, getDocs, doc, updateDoc, deleteDoc, friendlyError, formatDate, markAdminBrowser
} from "./firebase.js";

const $ = (id) => document.getElementById(id);
const list = $("manage-list");
const statusEl = $("list-status");
const LABEL = { pending: "승인 대기", approved: "공개", hidden: "숨김" };
let comments = []; // { postId, postTitle, id, nickname, body, status, createdAt }
let filter = "pending";

const millis = (t) => (t && typeof t.toMillis === "function" ? t.toMillis() : 0);
function say(msg, isError) {
  $("manage-error").hidden = true; $("manage-ok").hidden = true;
  const el = $(isError ? "manage-error" : "manage-ok");
  el.textContent = msg; el.hidden = false;
}

function button(text, cls, onClick) {
  const b = document.createElement("button");
  b.type = "button"; b.className = `btn ${cls}`; b.textContent = text;
  b.addEventListener("click", async () => {
    b.disabled = true;
    try { await onClick(); } catch (err) { say(friendlyError(err), true); } finally { b.disabled = false; }
  });
  return b;
}

async function setStatus(c, status) {
  await updateDoc(doc(db, "posts", c.postId, "comments", c.id), { status });
  c.status = status;
  say(status === "approved" ? "댓글을 공개했어요." : status === "hidden" ? "댓글을 숨겼어요." : "승인 대기로 돌렸어요.");
  render();
}

function row(c) {
  const r = document.createElement("div");
  r.className = "cmt-row";
  const main = document.createElement("div");
  const where = document.createElement("p");
  where.className = "cmt-post";
  const a = document.createElement("a");
  a.href = `../post.html?id=${encodeURIComponent(c.postId)}`;
  a.textContent = c.postTitle || "(제목 없음)";
  where.append(a, ` · ${formatDate(c.createdAt)} · `);
  const state = document.createElement("span");
  state.className = "cmt-state"; state.textContent = LABEL[c.status] || c.status;
  where.appendChild(state);
  const head = document.createElement("p");
  head.className = "comment-head";
  const nick = document.createElement("span"); nick.className = "comment-nick"; nick.textContent = c.nickname;
  head.appendChild(nick);
  const body = document.createElement("p");
  body.className = "comment-body"; body.textContent = c.body;
  main.append(where, head, body);

  const actions = document.createElement("div");
  actions.className = "cmt-actions";
  if (c.status !== "approved") actions.appendChild(button("승인", "btn-dark", () => setStatus(c, "approved")));
  if (c.status !== "hidden") actions.appendChild(button("숨기기", "btn-outline", () => setStatus(c, "hidden")));
  actions.appendChild(button("삭제", "btn-outline", async () => {
    if (!confirm("이 댓글을 지울까요? 되돌릴 수 없어요.")) return;
    await deleteDoc(doc(db, "posts", c.postId, "comments", c.id));
    comments = comments.filter((x) => x !== c);
    say("댓글을 지웠어요.");
    render();
  }));
  r.append(main, actions);
  return r;
}

function render() {
  const n = { pending: 0, approved: 0, hidden: 0 };
  comments.forEach((c) => { if (n[c.status] !== undefined) n[c.status]++; });
  $("counts").textContent = `승인 대기 ${n.pending} · 공개 ${n.approved} · 숨김 ${n.hidden}`;
  const shown = comments.filter((c) => !filter || c.status === filter);
  list.replaceChildren(...shown.map(row));
  list.hidden = !shown.length;
  statusEl.hidden = !!shown.length;
  if (!shown.length) statusEl.textContent = filter === "pending" ? "승인을 기다리는 댓글이 없어요." : "해당하는 댓글이 없어요.";
}

document.querySelectorAll("#tabs .chip").forEach((c) => c.addEventListener("click", () => {
  filter = c.dataset.status;
  document.querySelectorAll("#tabs .chip").forEach((x) => x.setAttribute("aria-pressed", String(x === c)));
  render();
}));

if (!isConfigured) {
  $("checking").hidden = true; $("config-notice").hidden = false;
} else {
  onAuthStateChanged(auth, async (user) => {
    if (!user) { location.replace("login.html?next=comments.html"); return; }
    markAdminBrowser();
    $("who").textContent = user.email || "";
    $("checking").hidden = true; $("manage").hidden = false;
    try {
      const posts = (await getDocs(collection(db, "posts"))).docs.map((d) => ({ id: d.id, title: d.data().title }));
      const per = await Promise.all(posts.map(async (p) => {
        const snap = await getDocs(collection(db, "posts", p.id, "comments"));
        return snap.docs.map((d) => ({ postId: p.id, postTitle: p.title, id: d.id, ...d.data() }));
      }));
      comments = per.flat().sort((a, b) => millis(b.createdAt) - millis(a.createdAt)); // 최근 것부터
      render();
    } catch (err) {
      statusEl.textContent = friendlyError(err);
    }
  });
  $("logout").addEventListener("click", async () => { await signOut(auth); location.replace("login.html"); });
}
