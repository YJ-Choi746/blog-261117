// 홈 '선택한 작업' (PRD v0.6 F4) — 플레이스홀더 대신 게시된 작업 최신 3개
import { loadPublishedWorks, workCard } from "./works-data.js";

const grid = document.getElementById("home-works");
const statusEl = document.getElementById("home-works-status");
if (grid) {
  loadPublishedWorks().then((works) => {
    const top = works.slice(0, 3);
    grid.replaceChildren(...top.map((w) => workCard(w)));
    grid.hidden = !top.length;
    statusEl.textContent = top.length ? "" : "지금 작업을 케이스 스터디로 정리하고 있어요. 곧 문제를 푼 과정까지 보여드릴게요.";
    statusEl.hidden = !!top.length;
  }).catch(() => { statusEl.textContent = "작업을 불러오지 못했어요. 잠시 후 다시 시도해 주세요."; });
}
