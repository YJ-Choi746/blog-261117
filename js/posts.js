import { db, isConfigured, collection, getDocs, query, where, friendlyError, formatDate } from "./firebase.js";
import { getImageData } from "./images.js";
import { auth, onAuthStateChanged } from "./firebase.js";
import { adminButtons } from "./post-actions.js";

let isAdminView = false;

// GA: 목록의 글 줄에 select_post 정보를 달아 둬요 (클릭은 js/analytics.js가 보내요)
function tagSelectPost(a, p, listName, position) {
  a.setAttribute("data-ga-event", "select_post");
  a.setAttribute("data-ga-post_id", p.id);
  a.setAttribute("data-ga-post_title", p.title || "");
  a.setAttribute("data-ga-post_category", p.category || "");
  a.setAttribute("data-ga-list_name", listName);
  a.setAttribute("data-ga-list_position", String(position));
}
function trackFilter(cat, listName) {
  if (typeof window.trackEvent === "function") window.trackEvent("filter_posts", { filter_category: cat || "전체", list_name: listName });
}


const list = document.getElementById("post-list");
const statusEl = document.getElementById("list-status");
const chips = [...document.querySelectorAll("#chips .chip")];
let posts = [];
let current = "";

function render() {
  const shown = current ? posts.filter((p) => p.category === current) : posts;
  list.replaceChildren();
  if (!shown.length) {
    list.hidden = true;
    statusEl.hidden = false;
    statusEl.textContent = posts.length ? "이 카테고리에는 아직 글이 없어요." : "아직 발행된 글이 없어요.";
    return;
  }
  statusEl.hidden = true;
  list.hidden = false;
  shown.forEach((p, i) => {
    const a = document.createElement("a");
    a.className = "post-row";
    a.href = `post.html?id=${encodeURIComponent(p.id)}`;
    tagSelectPost(a, p, "blog_list", i + 1);
    const date = document.createElement("span"); date.className = "date"; date.textContent = formatDate(p.publishedAt);
    const mid = document.createElement("span");
    const t = document.createElement("span"); t.className = "title"; t.textContent = p.title;
    mid.appendChild(t);
    if (p.summary) { const d = document.createElement("span"); d.className = "desc"; d.textContent = p.summary; mid.appendChild(d); }
    const cat = document.createElement("span"); cat.className = "cat"; cat.textContent = p.category || "";
    a.append(date, mid, cat);
    if (p.coverImageId) {
      a.classList.add("has-thumb");
      const img = document.createElement("img"); img.className = "row-thumb"; img.alt = ""; img.loading = "lazy";
      getImageData(p.coverImageId).then((d) => { if (d) img.src = d; });
      a.appendChild(img);
    }
    if (isAdminView) {
      const item = document.createElement("div");
      item.className = "post-item";
      const btns = adminButtons({
        id: p.id, data: p, editHref: `admin/write.html?id=${encodeURIComponent(p.id)}`,
        onDeleted: () => { posts = posts.filter((x) => x.id !== p.id); render(); },
        onError: (msg) => { statusEl.hidden = false; statusEl.textContent = msg; }
      });
      item.append(a, btns);
      list.appendChild(item);
    } else {
      list.appendChild(a);
    }
  });
}

chips.forEach((c) => c.addEventListener("click", () => {
  current = c.dataset.cat;
  trackFilter(current, "blog_list");
  chips.forEach((x) => x.setAttribute("aria-pressed", String(x === c)));
  render();
}));

async function load() {
  if (!isConfigured) { statusEl.textContent = "아직 발행된 글이 없어요."; return; }
  try {
    // 발행된 글만. 정렬은 브라우저에서 해요 (where + orderBy를 같이 쓰면 Firestore 색인을 따로 만들어야 해서)
    const snap = await getDocs(query(collection(db, "posts"), where("status", "==", "published")));
    posts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const t = (p) => (p.publishedAt && typeof p.publishedAt.toMillis === "function" ? p.publishedAt.toMillis() : 0);
    posts.sort((a, b) => t(b) - t(a));
    render();
  } catch (err) {
    statusEl.textContent = friendlyError(err);
  }
}
// 로그인한 관리자에게만 수정·삭제 버튼을 보여줘요 (실제로 막는 건 보안 규칙)
if (isConfigured) {
  let first = true;
  onAuthStateChanged(auth, (user) => { isAdminView = !!user; if (first) { first = false; load(); } else render(); });
} else {
  load();
}
