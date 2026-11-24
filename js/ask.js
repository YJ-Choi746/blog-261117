// F1 한 줄 의뢰 · F2 의뢰서 레퍼런스 (PRD v1.2) — 첫 화면
// - 한 줄을 받으면 단어로 분야를 추정해(js/templates.js) 비슷한 게시 작업을 보여 주고, 의뢰서를 미리 채워요
// - 의뢰서의 "제 작업에서 고르기"에 게시된 작업을 체크 칩으로 그려요 (최대 5개)
// - 입력과 작업 이름은 textContent로만 넣어요 (XSS)
import { loadPublishedWorks, workCard } from "./works-data.js";
import { guessCategory, CATEGORIES } from "./templates.js";

const MAX_REF_WORKS = 5;
const askForm = document.getElementById("ask-form");
const askQ = document.getElementById("ask-q");
const result = document.getElementById("ask-result");
const msg = document.getElementById("ask-msg");
const worksBox = document.getElementById("ask-works");
const refBox = document.getElementById("ref-works");
const requestForm = document.getElementById("request-form");
let works = [];
const ready = loadPublishedWorks().then((w) => { works = w; renderRefWorks(); }).catch(() => {});

// 의뢰서: 제 작업에서 고르기 (게시된 작업 체크 칩)
function renderRefWorks() {
  if (!refBox || !works.length) return;
  refBox.replaceChildren(...works.slice(0, 12).map((w) => {
    const label = document.createElement("label");
    label.className = "rq-work";
    const box = document.createElement("input");
    box.type = "checkbox"; box.className = "rq-sr"; box.name = "레퍼런스 작업"; box.value = (w.title || w.name || "").slice(0, 60);
    box.addEventListener("change", () => {
      if (refBox.querySelectorAll("input:checked").length > MAX_REF_WORKS) box.checked = false;
      label.classList.toggle("on", box.checked);
    });
    const name = document.createElement("span"); name.textContent = w.title || w.name || "";
    const cat = document.createElement("small"); cat.textContent = w.category || "";
    box.addEventListener("change", () => { cat.textContent = box.checked ? "선택됨" : (w.category || ""); });
    label.append(box, name, cat);
    return label;
  }));
}

// 의뢰서 미리 채우기: 내용이 비어 있으면 한 줄을 넣고, 분야를 하나만 체크
export function prefillRequest(form, q, cat) {
  if (!form) return;
  const content = form.querySelector('[name="프로젝트 내용"]');
  if (content && !content.value.trim()) content.value = q;
  if (cat && CATEGORIES.includes(cat)) form.querySelectorAll('input[name="의뢰분야"]').forEach((x) => { x.checked = x.value === cat; });
  form.querySelectorAll(".rq-chip").forEach((l) => l.classList.toggle("on", !!l.querySelector("input")?.checked));
}

async function handleAsk(q) {
  q = String(q || "").trim().slice(0, 200);
  if (!q) return;
  await ready;
  const cat = guessCategory(q);
  const same = cat ? works.filter((w) => w.category === cat) : [];
  const shown = (same.length ? same : works).slice(0, 3);
  msg.textContent = !works.length ? "곧 작업을 소개할게요. 의뢰서는 미리 채워 두었어요."
    : same.length ? `${cat} 작업이 필요하신 것 같아요. 이런 작업을 했어요.`
    : "분야를 정확히 몰라도 괜찮아요. 최근 작업을 보여드릴게요.";
  worksBox.replaceChildren(...shown.map((w) => workCard(w)));
  prefillRequest(requestForm, q, cat);
  result.hidden = false;
}

if (askForm) {
  askForm.addEventListener("submit", (e) => { e.preventDefault(); handleAsk(askQ.value); });
  document.querySelectorAll("#ask-examples [data-ask]").forEach((b) => b.addEventListener("click", () => {
    askQ.value = b.dataset.ask; handleAsk(b.dataset.ask);
  }));
}
