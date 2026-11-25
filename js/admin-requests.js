// 의뢰 관리 (v0.2 의뢰 기능: 관리자 의뢰 카드)
// - 카드 순서는 판단 순서: AI 요약 → 빠진 항목 → 적합도 (PRD 8)
// - 분석 안 된 의뢰는 화면을 열 때 한 번 자동 분석해서 결과를 문서(ai)에 저장해요
// - AI가 실패해도 원문은 항상 보여요 (실패 대체). 의뢰자가 쓴 글은 textContent로만 넣어요 (XSS)
// - 읽기 · 수정 권한은 firestore.rules의 관리자 UID가 지켜요
import {
  auth, db, isConfigured, onAuthStateChanged, signOut,
  collection, getDocs, doc, updateDoc, serverTimestamp, friendlyError, markAdminBrowser, callFunction
} from "./firebase.js";

const $ = (id) => document.getElementById(id);
const list = $("request-list");
const statusEl = $("list-status");

export const STATUS_LABEL = { new: "신규", reviewing: "검토중", replied: "답장완료" };
export const MISSING_LABEL = { schedule: "일정", budget: "예산", scope: "범위", reference: "레퍼런스" };
export const FIT_LABEL = { high: "적합 높음", medium: "적합 보통", low: "적합 낮음" };
export const CATEGORY_LABEL = { branding: "브랜딩", uiux: "UI/UX", content: "콘텐츠", other: "기타" };

let requests = [];
let filter = "";
const analyzing = new Set();

function millis(t) { return t && typeof t.toMillis === "function" ? t.toMillis() : 0; }
function nowTs() { const n = Date.now(); return { toMillis: () => n, toDate: () => new Date(n) }; }
function say(msg, isError) {
  $("manage-error").hidden = true; $("manage-ok").hidden = true;
  const el = $(isError ? "manage-error" : "manage-ok");
  el.textContent = msg; el.hidden = false;
}
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
function dateTime(ts) {
  const d = ts && typeof ts.toDate === "function" ? ts.toDate() : null;
  if (!d) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// ---- AI 분석 ----
// 성공하면 ai, 실패하면 aiError를 문서에 남겨요. 실패 기록이 있으면 자동으로 다시 부르지 않아요 (버튼으로만).
async function analyzeOne(r) {
  if (analyzing.has(r.id)) return;
  analyzing.add(r.id);
  render();
  let patch;
  try {
    const out = await callFunction("analyzeRequest", {
      mode: "full", categories: r.categories || [], budget: r.budget || "", content: r.content || ""
    });
    if (out && out.ok) {
      patch = { ai: { ...out.result, promptVersion: out.promptVersion || "", analyzedAt: serverTimestamp() }, aiError: null };
    } else {
      patch = { aiError: { reason: (out && out.reason) || "unknown", at: serverTimestamp() } };
    }
  } catch (err) {
    patch = { aiError: { reason: err && err.code ? err.code : "call_failed", at: serverTimestamp() } };
    say(friendlyError(err), true);
  }
  try {
    await updateDoc(doc(db, "requests", r.id), patch);
  } catch (err) { say(friendlyError(err), true); }
  if (patch.ai) { r.ai = { ...patch.ai, analyzedAt: nowTs() }; r.aiError = null; }
  else r.aiError = { ...patch.aiError, at: nowTs() };
  analyzing.delete(r.id);
  render();
}

// 분석 안 된 의뢰를 오래된 것부터 하나씩 (동시에 몰아서 부르지 않게)
async function autoAnalyze() {
  const todo = requests.filter((r) => !r.ai && !r.aiError).sort((a, b) => millis(a.createdAt) - millis(b.createdAt));
  for (const r of todo) await analyzeOne(r);
}

// ---- 상태 ----
async function changeStatus(r, status) {
  const patch = { status, statusUpdatedAt: serverTimestamp() };
  if (status === "replied" && !r.repliedAt) patch.repliedAt = serverTimestamp(); // 첫 답장 시각 (KPI1)
  await updateDoc(doc(db, "requests", r.id), patch);
  r.status = status;
  if (patch.repliedAt) r.repliedAt = nowTs();
}

// ---- 카드 ----
function section(title, aiBadge) {
  const s = el("section", "req-section");
  const h = el("h3", "req-h", title);
  if (aiBadge) h.appendChild(el("span", "ai-badge", "AI 초안"));
  s.appendChild(h);
  return s;
}

export function card(r) {
  const c = el("article", "req-card");
  c.dataset.id = r.id;

  // 머리: 이름 · 접수 시각 · 상태
  const head = el("div", "req-head");
  const who = el("div", "req-who");
  who.append(el("strong", "req-name", r.name || "(이름 없음)"));
  const meta = el("div", "req-meta");
  meta.append(el("span", "", `접수 ${dateTime(r.createdAt)}`));
  if (r.repliedAt) meta.append(el("span", "", `답장 ${dateTime(r.repliedAt)}`));
  who.append(meta);

  const selId = `st-${r.id}`;
  const lab = el("label", "sr-only", `${r.name || "의뢰"} 상태`); lab.htmlFor = selId;
  const sel = el("select", "tb-select req-status"); sel.id = selId;
  Object.entries(STATUS_LABEL).forEach(([v, t]) => sel.add(new Option(t, v)));
  sel.value = STATUS_LABEL[r.status] ? r.status : "new";
  sel.addEventListener("change", async () => {
    const to = sel.value; sel.disabled = true;
    try { await changeStatus(r, to); say(`${r.name || "의뢰"} → ${STATUS_LABEL[to]}(으)로 바꿨어요.`); render(); }
    catch (err) { sel.value = r.status; sel.disabled = false; say(friendlyError(err), true); }
  });
  const stWrap = el("div", "req-status-wrap"); stWrap.append(lab, sel);
  head.append(who, stWrap);
  c.appendChild(head);

  const ai = r.ai;
  const busy = analyzing.has(r.id);

  // 판단 줄: 적합도 · 분야 · 스팸
  if (ai) {
    const tags = el("div", "req-tags");
    if (ai.is_spam) tags.append(el("span", "fit fit-low", "스팸 의심"));
    tags.append(el("span", `fit fit-${ai.fit}`, FIT_LABEL[ai.fit] || ai.fit));
    tags.append(el("span", "req-cat", CATEGORY_LABEL[ai.category] || ai.category));
    c.appendChild(tags);
  }

  // 1) 요약
  const s1 = section("요약", !!ai);
  if (ai) {
    const p = el("p", "req-summary");
    String(ai.summary || "").split("\n").forEach((line, i) => { if (i) p.appendChild(document.createElement("br")); p.appendChild(document.createTextNode(line)); });
    s1.appendChild(p);
  } else if (busy) {
    s1.appendChild(el("p", "req-muted", "AI가 분석하는 중이에요…"));
  } else {
    s1.appendChild(el("p", "req-muted", r.aiError ? "AI 분석에 실패했어요. 아래 원문을 보고 처리해 주세요." : "아직 AI 분석 전이에요."));
  }
  c.appendChild(s1);

  // 2) 빠진 항목
  if (ai) {
    const s2 = section("빠진 항목", true);
    if (ai.missing && ai.missing.length) {
      const chips = el("div", "req-missing");
      ai.missing.forEach((m) => chips.append(el("span", "miss", MISSING_LABEL[m] || m)));
      s2.appendChild(chips);
    } else s2.appendChild(el("p", "req-muted", "빠진 항목 없음"));
    c.appendChild(s2);

    // 3) 적합도 이유
    const s3 = section("적합도", true);
    s3.appendChild(el("p", "", `${FIT_LABEL[ai.fit] || ai.fit} — ${ai.fit_reason || ""}`));
    c.appendChild(s3);
  }

  // 원문 (항상). AI 결과가 없으면 펼쳐 둬요
  const det = el("details", "req-raw");
  det.open = !ai;
  det.appendChild(el("summary", "", "의뢰 원문"));
  const dl = el("dl", "req-dl");
  const row = (k, v) => { dl.append(el("dt", "", k), el("dd", "", v)); };
  row("이메일", r.email || "");
  row("분야", (r.categories || []).join(", ") || "선택 안 함");
  row("예산", r.budget || "선택 안 함");
  row("내용", r.content || "");
  if (r.schedule) row("희망 일정", r.schedule);
  if (r.refWorks && r.refWorks.length) row("레퍼런스 작업", r.refWorks.join(", "));
  if (r.refLinks && r.refLinks.length) row("레퍼런스 링크", r.refLinks.join("\n"));
  det.appendChild(dl);
  c.appendChild(det);

  // 분석 버튼
  const actions = el("div", "req-actions");
  const btn = el("button", "btn btn-outline", busy ? "분석 중…" : ai ? "다시 분석" : r.aiError ? "다시 분석" : "AI 분석");
  btn.type = "button"; btn.disabled = busy;
  btn.addEventListener("click", () => analyzeOne(r));
  actions.appendChild(btn);
  if (r.aiError && !ai) actions.appendChild(el("span", "req-muted", `실패 원인: ${r.aiError.reason}`));
  c.appendChild(actions);

  return c;
}

function render() {
  const counts = { new: 0, reviewing: 0, replied: 0 };
  requests.forEach((r) => { const s = STATUS_LABEL[r.status] ? r.status : "new"; counts[s]++; });
  $("counts").textContent = `전체 ${requests.length} · 신규 ${counts.new} · 검토중 ${counts.reviewing} · 답장완료 ${counts.replied}`;
  const shown = requests.filter((r) => !filter || (STATUS_LABEL[r.status] ? r.status : "new") === filter);
  list.replaceChildren(...shown.map(card));
  list.hidden = !shown.length;
  statusEl.hidden = !!shown.length;
  if (!shown.length) statusEl.textContent = requests.length ? "이 상태의 의뢰가 없어요." : "아직 들어온 의뢰가 없어요.";
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
    if (!user) { location.replace("login.html?next=requests.html"); return; }
    markAdminBrowser();
    $("who").textContent = user.email || "";
    $("checking").hidden = true; $("manage").hidden = false;
    try {
      const snap = await getDocs(collection(db, "requests"));
      requests = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      requests.sort((a, b) => millis(b.createdAt) - millis(a.createdAt));
      render();
      autoAnalyze();
    } catch (err) {
      statusEl.textContent = friendlyError(err);
    }
  });
  $("logout").addEventListener("click", async () => { await signOut(auth); location.replace("login.html"); });
}
