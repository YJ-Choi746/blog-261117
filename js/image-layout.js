// 작업 이미지 배치 (작업 상세 · 관리자 미리보기 공용, Firebase 없음)
// 이미지마다 { w: 폭 %(20~100), align: "left" | "center" | "right", at: "cover" | "problem" | "process" | "result", cap: 캡션(선택, 120자) }
// Firestore에는 works.imageSizes 목록에 같은 순서로 저장해요 (예전 값: 숫자 폭, "l" · "m" · "s"도 읽어요).
export const SPOTS = [["cover", "맨 위 (커버 자리)"], ["problem", "01 요청 아래"], ["process", "02 과정 아래"], ["result", "03 결과 아래"]];
const SPOT_KEYS = SPOTS.map(([k]) => k);
const ALIGNS = ["left", "center", "right"];
const LEGACY = { l: 100, m: 70, s: 45 };

export const clampW = (n) => (Number.isFinite(n) ? Math.min(100, Math.max(20, Math.round(n))) : 100);

export function normLayout(entry, i) {
  const base = { w: 100, align: "center", at: i === 0 ? "cover" : "process" };
  if (entry == null) return base;
  if (typeof entry === "number") return { ...base, w: clampW(entry) };
  if (typeof entry === "string") return { ...base, w: clampW(LEGACY[entry] ?? Number(entry)) };
  if (typeof entry === "object") {
    return {
      w: clampW(Number(entry.w)),
      align: ALIGNS.includes(entry.align) ? entry.align : base.align,
      at: SPOT_KEYS.includes(entry.at) ? entry.at : base.at,
      ...(typeof entry.cap === "string" && entry.cap.trim() ? { cap: entry.cap.trim().slice(0, 120) } : {}),
    };
  }
  return base;
}

// 폭 · 정렬을 요소에 적용 (휴대폰에서 너무 작아지지 않게 최소 200px)
export function applyLayout(elm, l) {
  elm.style.width = `max(${clampW(l.w)}%, min(100%, 200px))`;
  elm.style.display = "block";
  elm.style.marginLeft = l.align === "left" ? "0" : "auto";
  elm.style.marginRight = l.align === "right" ? "0" : "auto";
}

// 사진 + 캡션: 캡션이 있으면 figure로 감싸 사진 아래 작은 글씨로 (textContent만, 본문보다 작게)
export function withCaption(img, l) {
  if (!l.cap) { applyLayout(img, l); return img; }
  const fig = document.createElement("figure");
  fig.className = "img-cap";
  applyLayout(fig, l);
  img.style.width = "100%";
  const cap = document.createElement("figcaption");
  cap.textContent = l.cap;
  fig.append(img, cap);
  return fig;
}

// 위치 순서대로 정렬 (같은 위치 안에서는 원래 순서 유지) — 첫 장이 대표 이미지(커버 · 카드)
export function sortBySpot(list, layoutOf) {
  return list.map((x, i) => [x, i]).sort((a, b) => (SPOT_KEYS.indexOf(layoutOf(a[0]).at) - SPOT_KEYS.indexOf(layoutOf(b[0]).at)) || (a[1] - b[1])).map(([x]) => x);
}
