// 작업 상세 (PRD v1.1 F3) — 커버 → 제목 · 요약 → 문제 → 과정 → 결과 → 의뢰 버튼
// 공개 문서(works)만 읽어요. 메모 · 비공개 실명은 관리자 문서(workNotes)에 있어 여기서 읽을 수 없어요.
// 모든 내용은 textContent로만 넣어요 (XSS)
import { db, isConfigured, doc, getDoc } from "./firebase.js";
import { getImageData } from "./images.js";
import { CATEGORIES } from "./works-data.js";

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
function image(id, alt) {
  const img = document.createElement("img");
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

  if (w.coverImageId) $("work-cover").appendChild(image(w.coverImageId, `${w.title || w.name} 커버 이미지`));
  else $("work-cover").hidden = true;
  $("work-cat").textContent = w.category || "";
  $("work-title").textContent = w.title || w.name || "";
  $("work-summary").textContent = w.summary || "";
  const meta = [["작업", w.name], ["업종", w.industry], ["기간", w.period], ["클라이언트", w.client]].filter(([, v]) => v);
  $("work-meta").replaceChildren(...meta.flatMap(([k, v]) => { const dt = document.createElement("dt"); dt.textContent = k; const dd = document.createElement("dd"); dd.textContent = v; return [dt, dd]; }));
  paragraphs($("work-problem"), w.problem);
  paragraphs($("work-process"), w.process);
  paragraphs($("work-result"), w.result);
  $("work-images").replaceChildren(...(w.imageIds || []).slice(1).map((im, i) => image(im, `${w.title || w.name} 이미지 ${i + 2}`)));
  $("work-images").hidden = (w.imageIds || []).length < 2;
  $("work-tags").replaceChildren(...(w.tags || []).map((t) => { const s = document.createElement("span"); s.className = "tag"; s.textContent = `#${t}`; return s; }));

  // F3 의뢰 버튼: 의뢰 폼으로 가면서 이 작업의 분야를 자동 선택 (허용된 분야만 넘겨요)
  const cta = $("work-cta");
  const cat = CATEGORIES.includes(w.category) ? w.category : "";
  cta.href = `index.html${cat ? `?category=${encodeURIComponent(cat)}` : ""}#request`;

  $("work-status").hidden = true;
  $("work").hidden = false;
}
load();
