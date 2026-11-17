// 첫 화면 "최근 기록" — 발행된 글을 불러와 최신순으로 보여주고, 카테고리로 걸러요.
// 첫 화면은 인라인 스타일로 만든 페이지라서, 줄도 같은 모양(인라인 스타일)으로 만들어요.
import { db, isConfigured, collection, getDocs, query, where, formatDate } from "./firebase.js";

const SHOW = 5; // 첫 화면에 보여줄 글 수
const list = document.getElementById("home-posts");
const statusEl = document.getElementById("home-status");
const chips = [...document.querySelectorAll("#home-chips button")];
let posts = [];
let current = "";

const ON = { border: "1px solid #111111", background: "#111111", color: "#FFFFFF" };
const OFF = { border: "1px solid #D0D0D0", background: "#FFFFFF", color: "#111111" };

function message(text) {
  list.hidden = true;
  statusEl.hidden = false;
  statusEl.textContent = text;
}

function rowEl(p) {
  const a = document.createElement("a");
  a.href = `post.html?id=${encodeURIComponent(p.id)}`;
  a.setAttribute("style", "text-decoration: none; display: grid; grid-template-columns: minmax(120px, 160px) minmax(0, 1fr) auto; gap: 24px; align-items: center; padding: 28px 0; border-bottom: 1px solid #E5E5E5");
  const date = document.createElement("span");
  date.setAttribute("style", "font-size: 14px; color: #5F5F5F");
  date.textContent = formatDate(p.publishedAt);
  const title = document.createElement("span");
  title.setAttribute("style", "font-size: 22px; font-weight: 500; overflow-wrap: anywhere");
  title.textContent = p.title;
  const cat = document.createElement("span");
  cat.setAttribute("style", "font-size: 13px; color: #2F6BEA");
  cat.textContent = p.category || "";
  a.append(date, title, cat);
  return a;
}

function render() {
  const shown = (current ? posts.filter((p) => p.category === current) : posts).slice(0, SHOW);
  if (!shown.length) {
    message(posts.length ? `'${current}' 카테고리에는 아직 글이 없어요.` : "아직 발행된 기록이 없어요.");
    return;
  }
  statusEl.hidden = true;
  list.hidden = false;
  list.replaceChildren(...shown.map(rowEl));
}

chips.forEach((c) => c.addEventListener("click", () => {
  current = c.dataset.cat;
  chips.forEach((x) => {
    const on = x === c;
    x.setAttribute("aria-pressed", String(on));
    Object.assign(x.style, on ? ON : OFF);
  });
  render();
}));

async function load() {
  if (!isConfigured) { message("아직 발행된 기록이 없어요."); return; }
  try {
    const snap = await getDocs(query(collection(db, "posts"), where("status", "==", "published")));
    const t = (x) => (x && typeof x.toMillis === "function" ? x.toMillis() : 0);
    posts = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => t(b.publishedAt) - t(a.publishedAt));
    render();
  } catch {
    message("기록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
  }
}
load();
