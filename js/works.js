// 작업 목록 (PRD v1.1 F3) — 게시된 작업을 분야로 걸러 보여줘요
import { loadPublishedWorks, workCard } from "./works-data.js";
import { loadCategories, applyCategoryLabels } from "./categories.js";
import { onLangChange } from "./content-lang.js";

const list = document.getElementById("work-list");
const statusEl = document.getElementById("list-status");
const chips = [...document.querySelectorAll("#chips .chip")];
let works = [];
let current = "";

function render() {
  const shown = works.filter((w) => !current || w.category === current);
  list.replaceChildren(...shown.map((w) => workCard(w)));
  list.hidden = !shown.length;
  statusEl.hidden = !!shown.length;
  if (!shown.length) statusEl.textContent = works.length ? "이 분야의 작업은 아직 없어요." : "지금 작업을 케이스 스터디로 정리하고 있어요.";
}
chips.forEach((c) => c.addEventListener("click", () => {
  current = c.dataset.cat;
  chips.forEach((x) => x.setAttribute("aria-pressed", String(x === c)));
  render();
}));
onLangChange(() => render());
loadCategories().then((labels) => applyCategoryLabels(labels));
loadPublishedWorks().then((w) => { works = w; render(); })
  .catch(() => { statusEl.textContent = "작업을 불러오지 못했어요. 잠시 후 다시 시도해 주세요."; });
