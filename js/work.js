// 작업 상세 (PRD v1.3 F3, 프로토타입 디자인) — 제목 · 요약 → 정보 줄 → 커버 → 01 요청 · 02 과정 · 03 결과 → 다른 프로젝트 → 의뢰 띠
// 공개 문서(works)만 읽어요. 메모 · 비공개 실명은 관리자 문서(workNotes)에 있어 여기서 읽을 수 없어요.
// 모든 내용은 textContent로만 넣어요 (XSS)
import { db, isConfigured, doc, getDoc } from "./firebase.js";
import { getImageData } from "./images.js";
import { CATEGORIES, loadPublishedWorks } from "./works-data.js";

const $ = (id) => document.getElementById(id);
const id = new URLSearchParams(location.search).get("id");

// 문단(\n\n)을 <p>로 나눠 넣어요
function paragraphs(el, text) {
  el.replaceChildren(...String(text || "").split(/\n{2,}/).map((t) => t.trim()).filter(Boolean).map((t) => {
    const p = document.createElement("p");
    t.split("\n").forEach((line, i) => { if (i) p.appendChild(document.createElement("br")); p.appendChild(document.createTextNode(line)); });
    return p;
  }));
}
function image(id, alt, size) {
  const img = document.createElement("img");
  // 크기: 관리자가 고른 폭 (크게 · 보통 · 작게), 자르지 않고 원래 비율
  img.className = `sz-${["l", "m", "s"].includes(size) ? size : "l"}`;
  img.alt = alt; img.loading = "lazy";
  getImageData(id).then((d) => { if (d) img.src = d; });
  return img;
}

async function load() {
  if (!isConfigured || !db || !id || !/^[A-Za-z0-9_-]{1,40}$/.test(id)) { $("work-status").textContent = "작업을 찾을 수 없어요."; return; }
  let w;
  try {
    const snap = await getDoc(doc(db, "works", id));
    if (!snap.exists()) { $("work-status").textContent = "작업을 찾을 수 없어요."; return; }
    w = snap.data();
  } catch {
    $("work-status").textContent = "공개되지 않았거나 불러올 수 없는 작업이에요."; // 초안은 규칙상 읽기 거부
    return;
  }
  if (w.status !== "published") { $("work-status").textContent = "공개되지 않은 작업이에요."; return; }

  document.title = `${w.title || w.name} — Jae`;
  const desc = document.querySelector('meta[name="description"]');
  if (desc && w.summary) desc.setAttribute("content", w.summary);

  if (w.coverImageId) $("work-cover").appendChild(image(w.coverImageId, `${w.title || w.name} 커버 이미지`, (w.imageSizes || [])[0]));
  else $("work-cover").hidden = true;
  $("work-cat").textContent = w.category || "";
  $("work-title").textContent = w.title || w.name || "";
  $("work-summary").textContent = w.summary || "";
  // 정보 줄: 업종 · 기간 · 맡은 일 (+ 공개 동의한 클라이언트)
  const meta = [["업종", w.industry || "-"], ["기간", w.period || "-"], ["맡은 일", w.role || "-"]];
  if (w.client) meta.push(["클라이언트", w.client]);
  $("work-meta").replaceChildren(...meta.map(([k, v]) => {
    const box = document.createElement("div");
    const dt = document.createElement("dt"); dt.textContent = k;
    const dd = document.createElement("dd"); dd.textContent = v;
    box.append(dt, dd); return box;
  }));
  paragraphs($("work-problem"), w.problem);
  paragraphs($("work-process"), w.process);
  paragraphs($("work-result"), w.result);
  $("work-images").replaceChildren(...(w.imageIds || []).slice(1).map((im, i) => image(im, `${w.title || w.name} 이미지 ${i + 2}`, (w.imageSizes || [])[i + 1])));
  $("work-images").hidden = (w.imageIds || []).length < 2;
  pager(w);
  $("work-tags").replaceChildren(...(w.tags || []).map((t) => { const s = document.createElement("span"); s.className = "tag"; s.textContent = `#${t}`; return s; }));

  // F3 의뢰 버튼: 의뢰 폼으로 가면서 이 작업의 분야를 자동 선택 (허용된 분야만 넘겨요)
  const cta = $("work-cta");
  const cat = CATEGORIES.includes(w.category) ? w.category : "";
  cta.href = `index.html${cat ? `?category=${encodeURIComponent(cat)}` : ""}#request`;

  $("work-status").hidden = true;
  $("work").hidden = false;
}

// 다른 프로젝트 보기: 게시된 작업 안에서 이전 · 다음 (끝에서는 처음으로 돌아가요)
async function pager(w) {
  let list = [];
  try { list = await loadPublishedWorks(); } catch { return; }
  const i = list.findIndex((x) => x.id === id);
  if (i < 0 || list.length < 2) return;
  const prev = list[(i - 1 + list.length) % list.length], next = list[(i + 1) % list.length];
  $("pg-prev").href = `work.html?id=${encodeURIComponent(prev.id)}`; $("pg-prev-t").textContent = prev.title || prev.name || "";
  $("pg-next").href = `work.html?id=${encodeURIComponent(next.id)}`; $("pg-next-t").textContent = next.title || next.name || "";
  $("work-pager").hidden = false;
}
load();
