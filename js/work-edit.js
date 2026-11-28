// 작업 편집 (PRD v1.1 F4 작업 입력 · F5 AI 초안 · F6 미리보기와 게시, 실패 시 직접 쓰기 · F7 인스타그램 문구)
// - 왼쪽 입력 → "AI 초안 만들기" → 오른쪽 칸 채움 → 고쳐서 저장 · 게시
// - 공개 문서 works/{id}: 방문자가 볼 내용만 / 관리자 문서 workNotes/{id}: 메모 · 클라이언트 실명 · AI 기록
// - AI가 실패해도 오른쪽 칸에 직접 써서 저장 · 게시할 수 있어요 (F6)
import { getKey, setKey, clearKey, isRemembered, looksLikeKey, generateCaseDirect, generateSnsDirect, polishCaseDirect, translateDirect } from "./ai-direct.js";
import { translateWork, workSource, fingerprint, needsTranslation, hasTranslator } from "./auto-translate.js";
import {
  auth, db, isConfigured, onAuthStateChanged, signOut,
  collection, doc, getDoc, setDoc, serverTimestamp, friendlyError, markAdminBrowser, callFunction
} from "./firebase.js";
import { uploadImage, uploadCanvas, getImageData } from "./images.js";
import { openCrop } from "./crop.js";
import { templateDraft, templateSns } from "./templates.js";
import { SPOTS, normLayout, applyLayout, sortBySpot, clampW, withCaption } from "./image-layout.js";
import { loadCategories, applyCategoryLabels, normalizeCategory } from "./categories.js";

const $ = (id) => document.getElementById(id);
const MAX_IMAGES = 4;
const REQUIRED_TO_PUBLISH = [["f-name", "제목"], ["c-summary", "한 줄 요약"], ["c-problem", "요청"], ["c-process", "과정"], ["c-result", "결과"]];

const params = new URLSearchParams(location.search);
const paramId = params.get("id");
let workId = paramId && /^[A-Za-z0-9_-]{1,40}$/.test(paramId) ? paramId : null;
let isNew = !workId;
let user = null;
let existing = null;      // 불러온 공개 문서 (createdAt · publishedAt 유지용)
let images = [];          // [{ id, data }]
let aiMeta = null;        // 마지막 AI 생성 기록
let dirty = false;

// 안내 문구: '게시하기 · 초안 저장' 버튼 바로 밑에 보여요
function say(msg, isError) {
  $("msg-error").hidden = true; $("msg-ok").hidden = true;
  const act = $("act-msg"); act.hidden = !msg; act.textContent = msg || "";
  if (!msg) return;
  act.className = `notice ${isError ? "notice-error" : "notice-ok"}`;
  act.setAttribute("role", isError ? "alert" : "status");
}
function setState(t) { $("save-state").textContent = t; }
const val = (id) => $(id).value.trim();

// ---- 초안 표시: 누가 썼는지 배지 (AI가 쓴 글이면 '확인해 주세요' 안내) ----
const BADGE = { ai: "AI 초안 · 검토 필요", polish: "AI로 수정함 · 검토 필요", template: "직접 작성", manual: "직접 작성", saved: "저장된 초안" };
function showDraft(kind) {
  if (kind) $("ai-badge").textContent = BADGE[kind] || BADGE.saved;
  $("draft-check").hidden = !(kind === "ai" || kind === "polish");
  renderLive();
}
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }

// ---- 되돌리기: 'AI로 수정하기' · 메모로 초안 · 문장 틀이 칸을 바꾸기 직전 내용을 쌓아 둬요 ----
const DRAFT_IDS = ["f-name", "c-summary", "c-problem", "c-process", "c-result", "c-tags"];
const undoStack = [];
function snapshot() { return { fields: DRAFT_IDS.map((id) => $(id).value), badge: $("ai-badge").textContent, check: $("draft-check").hidden, warn: $("warn").hidden, warnText: $("warn").textContent }; }
function pushUndo() { undoStack.push(snapshot()); if (undoStack.length > 20) undoStack.shift(); $("undo").disabled = false; }
$("undo").addEventListener("click", () => {
  const snap = undoStack.pop(); if (!snap) return;
  DRAFT_IDS.forEach((id, i) => { $(id).value = snap.fields[i]; });
  $("ai-badge").textContent = snap.badge; $("draft-check").hidden = snap.check; $("warn").hidden = snap.warn; $("warn").textContent = snap.warnText;
  $("undo").disabled = !undoStack.length;
  const gs = $("gen-status"); gs.hidden = false; gs.className = "notice notice-info"; gs.textContent = "바꾸기 전 내용으로 되돌렸어요.";
  dirty = true; setState("저장 안 된 변경 있음"); renderLive();
});

// ---- 이미지 ----
// 위치 · 폭 · 정렬은 오른쪽 미리보기에서 바로 바꿔요 (끌어서 옮기기 · 모서리로 크기). js/image-layout.js
const layoutOf = (im) => normLayout({ w: im.w, align: im.align, at: im.at, cap: im.cap }, 0);
function reorderImages() { images = sortBySpot(images, layoutOf); }
// 타이틀 이미지 = 홈 화면 · 작업 목록 카드 사진. 썸네일을 누르면 정해지고, 고르지 않았으면 첫 장
const coverImg = () => images.find((x) => x.cover) || images[0];
function setCover(im) {
  // 홈 화면 · 작업 목록 카드에 보이는 사진만 바꿔요. 사진 순서와 본문 위치는 그대로 (D36)
  if (im === coverImg()) return;
  images.forEach((x) => { delete x.cover; });
  im.cover = true; changed(); renderImages();
  say("타이틀 이미지(홈 화면 카드)로 정했어요. 사진 순서는 그대로예요. 저장해야 반영돼요.");
}
let selImg = -1; // 미리보기에서 고른 이미지 번호
function renderImages() {
  const box = $("images");
  box.replaceChildren(...images.map((im, i) => {
    const fig = document.createElement("figure");
    fig.className = "work-image";
    const img = document.createElement("img");
    const isCover = im === coverImg();
    img.alt = isCover ? "타이틀 이미지" : `이미지 ${i + 1}`;
    img.src = im.data || "";
    const cap = document.createElement("figcaption");
    cap.textContent = isCover ? "★ 타이틀 (홈)" : `${i + 1}`;
    // 썸네일을 누르면 타이틀 이미지(홈 화면 카드)로 정해요. 끌어서 옮기기는 그대로
    img.classList.toggle("pw-cover-on", isCover);
    img.tabIndex = 0; img.setAttribute("role", "button"); img.setAttribute("aria-pressed", String(isCover));
    img.title = isCover ? "홈 화면에 보이는 타이틀 이미지" : "눌러서 홈 화면 타이틀 이미지로";
    img.addEventListener("click", () => setCover(im));
    img.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setCover(im); } });
    const rm = document.createElement("button");
    rm.type = "button"; rm.className = "pw-x"; rm.title = "이미지 빼기";
    rm.setAttribute("aria-label", `${img.alt} 빼기`);
    rm.appendChild(xIcon());
    rm.addEventListener("click", () => { images.splice(i, 1); selImg = -1; dirty = true; renderImages(); });
    // 폭 슬라이더 (미리보기 모서리를 끌어도 같이 바뀌어요)
    const size = document.createElement("label");
    size.className = "pw-size";
    const out = document.createElement("span"); out.textContent = `${layoutOf(im).w}%`;
    const range = document.createElement("input");
    range.type = "range"; range.min = "20"; range.max = "100"; range.step = "1"; range.value = String(layoutOf(im).w);
    range.setAttribute("aria-label", `${img.alt} 폭 (%)`);
    range.addEventListener("input", () => { im.w = Number(range.value); out.textContent = `${im.w}%`; changed(); renderLive(); });
    size.append(out, range);
    const crop = document.createElement("button");
    crop.type = "button"; crop.className = "btn btn-text pw-crop"; crop.textContent = "자르기";
    crop.setAttribute("aria-label", `${img.alt} 자르기`);
    crop.addEventListener("click", () => cropImage(im));
    fig.append(rm, img, cap, size, crop);
    // 끌어서 순서 바꾸기 (컴퓨터): 다른 썸네일 위에 놓으면 그 자리로 가요
    fig.draggable = true; fig.dataset.i = String(i);
    fig.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/x-work-image", String(i)); e.dataTransfer.effectAllowed = "move"; fig.classList.add("pw-dragging"); });
    fig.addEventListener("dragend", () => fig.classList.remove("pw-dragging"));
    fig.addEventListener("dragover", (e) => { if ([...e.dataTransfer.types].includes("text/x-work-image")) { e.preventDefault(); fig.classList.add("pw-drop-here"); } });
    fig.addEventListener("dragleave", () => fig.classList.remove("pw-drop-here"));
    fig.addEventListener("drop", (e) => {
      const from = Number(e.dataTransfer.getData("text/x-work-image"));
      fig.classList.remove("pw-drop-here");
      if (!Number.isInteger(from) || e.dataTransfer.files.length) return;
      e.preventDefault(); e.stopPropagation();
      moveImage(from, i);
    });
    return fig;
  }));
  $("add-image").disabled = images.length >= MAX_IMAGES;
  renderLive();
}
function changed() { dirty = true; setState("저장 안 된 변경 있음"); }
// 썸네일 순서 바꾸기: 옮긴 사진은 놓은 자리 사진과 같은 칸(맨 위 · 01 · 02 · 03)으로 가요. 타이틀 이미지는 순서와 따로 '타이틀로'로 정해요
function moveImage(from, to) {
  if (from === to || !images[from] || !images[to]) return;
  const im = images[from];
  im.at = layoutOf(images[to]).at;
  images.splice(from, 1); images.splice(to, 0, im);
  reorderImages(); selImg = -1; changed(); renderImages();
}
// 파일 올리기 (버튼 · 끌어다 놓기 공용). at을 주면 미리보기의 그 칸에 넣어요
async function addFiles(fileList, at) {
  const files = [...fileList].filter((f) => /^image\//.test(f.type)).slice(0, MAX_IMAGES - images.length);
  if (!files.length) { if (fileList.length) say(images.length >= MAX_IMAGES ? `이미지는 ${MAX_IMAGES}장까지예요.` : "이미지 파일만 올릴 수 있어요.", true); return; }
  for (const f of files) {
    setState("이미지 올리는 중…");
    try {
      const lay = normLayout(null, images.length);
      if (at) lay.at = at;
      images.push({ ...(await uploadImage(f, user.uid)), ...lay });
      reorderImages(); dirty = true; renderImages();
    } catch (err) { say(`이미지를 올리지 못했어요. ${friendlyError(err)}`, true); }
  }
  setState(dirty ? "저장 안 된 변경 있음" : "");
}
// 컴퓨터에서 파일을 끌어다 놓기: 왼쪽 이미지 줄 · 오른쪽 미리보기 (미리보기에선 놓은 칸에 들어가요)
function fileDropZone(zone, atFrom) {
  zone.addEventListener("dragover", (e) => { if ([...e.dataTransfer.types].includes("Files")) { e.preventDefault(); zone.classList.add("pw-file-over"); } });
  zone.addEventListener("dragleave", (e) => { if (!zone.contains(e.relatedTarget)) zone.classList.remove("pw-file-over"); });
  zone.addEventListener("drop", (e) => {
    if (!e.dataTransfer.files.length) return;
    e.preventDefault(); zone.classList.remove("pw-file-over");
    addFiles(e.dataTransfer.files, atFrom ? atFrom(e) : undefined);
  });
}
fileDropZone(document.querySelector(".pw-thumbs"));
fileDropZone(document.querySelector(".pw-live"), (e) => {
  const step = e.target.closest && e.target.closest(".case-step");
  if (!step) return "cover";
  return step.querySelector("#lp-imgs-problem") ? "problem" : step.querySelector("#lp-imgs-result") ? "result" : "process";
});
// 자르기: 창에서 영역을 정하면 잘린 이미지를 새로 저장하고 바꿔 끼워요 (원본은 이 화면에서 '원본으로'로 되돌릴 수 있어요)
async function cropImage(im) {
  if (!im.data) return;
  const canvas = await openCrop(im.data, { ratio: im === coverImg() || images.indexOf(im) === 0 ? 16 / 11 : 0 }); // 타이틀(카드) · 맨 위 첫 장은 16:11로 시작
  if (!canvas) return;
  setState("자른 이미지 저장하는 중…");
  try {
    const up = await uploadCanvas(canvas, user.uid, "cropped");
    if (!im.orig) im.orig = { id: im.id, data: im.data };
    im.id = up.id; im.data = up.data;
    selImg = images.indexOf(im); changed(); renderImages();
    say("이미지를 잘랐어요. '원본으로'로 되돌릴 수 있어요. 저장해야 반영돼요.");
  } catch (err) { setState("자르기 실패"); say(`이미지를 자르지 못했어요. ${friendlyError(err)}`, true); }
}
// 닫기(X) 선 아이콘 — innerHTML 없이 만들어요
function xIcon() {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  for (const [k, v] of Object.entries({ width: 16, height: 16, viewBox: "0 0 14 14", fill: "none", stroke: "currentColor", "stroke-width": 2.2, "stroke-linecap": "round", "aria-hidden": "true" })) svg.setAttribute(k, v);
  const path = document.createElementNS(NS, "path"); path.setAttribute("d", "M3 3l8 8M11 3l-8 8");
  svg.appendChild(path); return svg;
}
$("add-image").addEventListener("click", () => $("image-input").click());
$("image-input").addEventListener("change", (e) => { const files = [...e.target.files]; e.target.value = ""; addFiles(files); });

// ---- AI 초안 (F5) · 실패 시 직접 작성 (F6) ----
function memoInput() {
  return {
    title: val("f-name"), category: $("f-category").value, industry: val("f-industry"), period: val("f-period"),
    // 공개 동의가 없으면 클라이언트 이름은 서버(AI)로 보내지도 않아요
    client: $("f-client-public").checked ? val("f-client") : "", clientPublic: $("f-client-public").checked,
    memo: { request: val("m-request"), work: val("m-work"), result: val("m-result") },
  };
}
function fillDraft(r) {
  if (r.title) $("f-name").value = r.title; $("c-summary").value = r.summary || "";
  $("c-problem").value = r.problem || ""; $("c-process").value = r.process || ""; $("c-result").value = r.result || "";
  $("c-tags").value = (r.tags || []).join(", ");
  renderLive();
}
function showWarnings(w) {
  const box = $("warn");
  const nums = w && w.unsupportedNumbers;
  box.hidden = !(nums && nums.length);
  if (nums && nums.length) box.textContent = `게시 전에 보충하면 좋아요 · 쓴 내용에 없는 숫자가 들어 있어요: ${nums.join(", ")} — 사실인지 확인하고 고치거나 지워 주세요.`;
}

$("generate").addEventListener("click", async () => {
  const input = memoInput();
  if (!input.title) { say("제목을 먼저 써 주세요.", true); $("f-name").focus(); return; }
  if (!input.memo.request && !input.memo.work && !input.memo.result) { say("메모를 한 칸 이상 써 주세요.", true); $("m-request").focus(); return; }
  const hasDraft = REQUIRED_TO_PUBLISH.some(([id]) => val(id));
  if (hasDraft && !confirm("위 칸에 쓴 내용을 AI 초안으로 바꿀까요? ('되돌리기'로 돌아올 수 있어요)")) return;
  pushUndo();
  say("");
  const btn = $("generate"); btn.disabled = true; btn.textContent = "AI가 쓰는 중… (20초 안팎)";
  const gs = $("gen-status"); gs.hidden = false; gs.className = "notice notice-info"; gs.textContent = "AI가 메모로 초안을 쓰고 있어요.";
  try {
    const out = await (getKey() ? generateCaseDirect(input) : callFunction("generateCaseStudy", input, 60000));
    if (out && out.ok) {
      fillDraft(out.result);
      showDraft("ai");
      showWarnings(out.warnings);
      aiMeta = { promptVersion: out.promptVersion || "", ms: out.ms || 0, warnings: out.warnings || null, generatedAt: serverTimestamp() };
      gs.textContent = "AI 초안이에요. 사실과 다른 곳을 고친 뒤 게시해 주세요.";
      dirty = true; setState("저장 안 된 변경 있음");
    } else {
      gs.className = "notice notice-error";
      gs.textContent = `AI 초안을 만들지 못했어요 (${(out && out.reason) || "알 수 없음"}). '직접 쓰기'를 누르거나 칸에 바로 써 주세요.`;
    }
  } catch (err) {
    // AI 서버 함수(generateCaseStudy)가 배포되지 않았거나 꺼져 있으면, 기다리게 하지 않고 문장 틀로 바로 채워요 (0원, D27)
    fillDraft(templateDraft(input));
    showDraft("template"); $("warn").hidden = true;
    aiMeta = { promptVersion: "template", ms: 0, warnings: null, generatedAt: serverTimestamp() };
    dirty = true; setState("저장 안 된 변경 있음");
    gs.className = "notice notice-info";
    gs.textContent = `AI 서버가 아직 꺼져 있어 메모를 칸에 먼저 옮겼어요 (${(err && err.code) || "연결 안 됨"}). 아래 '내 API 키로 AI 쓰기'에 키를 넣으면 AI가 바로 써요.`;
  } finally {
    btn.disabled = false; btn.textContent = "메모로 AI 초안";
  }
});

// ---- AI로 수정하기 (D31): 칸에 간단히 쓴 글을 같은 칸 그대로 AI가 다듬어요. '되돌리기'로 돌아갈 수 있어요 ----
$("polish").addEventListener("click", async () => {
  const draft = { title: val("f-name"), summary: val("c-summary"), problem: val("c-problem"), process: val("c-process"), result: val("c-result"), tags: tagsFromInput() };
  if (!draft.title && !draft.problem && !draft.process && !draft.result) { say("고칠 글을 먼저 간단히 써 주세요. (제목이나 01 · 02 · 03 칸)", true); $("f-name").focus(); return; }
  const gs = $("gen-status"); gs.hidden = false;
  if (!getKey()) {
    gs.className = "notice notice-error"; gs.textContent = "AI로 수정하려면 아래 '내 API 키로 AI 쓰기'에서 키를 연결해 주세요.";
    const box = $("ai-key").closest("details"); if (box) { box.open = true; $("ai-key").focus(); }
    return;
  }
  say("");
  const btn = $("polish"); btn.disabled = true; btn.textContent = "AI가 고치는 중…";
  gs.className = "notice notice-info"; gs.textContent = "AI가 쓴 글을 같은 형식으로 다듬고 있어요. (20초 안팎)";
  const input = { ...draft, category: $("f-category").value, industry: val("f-industry"), period: val("f-period"), role: val("f-role"),
    client: $("f-client-public").checked ? val("f-client") : "" }; // 공개 동의 없으면 이름은 보내지 않아요
  try {
    const out = await polishCaseDirect(input);
    if (out && out.ok) {
      pushUndo();
      fillDraft(out.result);
      showDraft("polish");
      showWarnings(out.warnings);
      aiMeta = { promptVersion: out.promptVersion || "", ms: out.ms || 0, warnings: out.warnings || null, generatedAt: serverTimestamp() };
      gs.textContent = "AI가 다듬었어요. 오른쪽 미리보기로 확인하고, 마음에 안 들면 '되돌리기'를 누르세요.";
      dirty = true; setState("저장 안 된 변경 있음");
    } else {
      gs.className = "notice notice-error";
      gs.textContent = `AI로 고치지 못했어요 (${(out && out.reason) || "알 수 없음"}). 쓴 글은 그대로예요.`;
    }
  } finally {
    btn.disabled = false; btn.textContent = "AI로 수정하기";
  }
});

// ---- 인스타그램 문구 3안 (F7) · 실패 시 직접 작성 ----
let snsMeta = null;   // 마지막 AI 생성 기록
let snsCopiedAt = null;
let snsCaptions = [];  // AI가 만든 문구 3안
let snsIndex = 0;     // 지금 보고 있는 안
const hashtagsFromInput = () => [...new Set(val("s-hashtags").split(/[,\s]+/).map((t) => t.replace(/^#+/, "")).filter(Boolean))].slice(0, 15);
export function snsText(caption, tags) {
  return [caption.trim(), tags.map((t) => `#${t}`).join(" ")].filter(Boolean).join("\n\n");
}

$("sns-generate").addEventListener("click", async () => {
  const miss = REQUIRED_TO_PUBLISH.filter(([id]) => id !== "c-summary" && !val(id)).map(([, n]) => n);
  if (miss.length) { say(`인스타그램 문구는 케이스 스터디로 만들어요. 먼저 채워 주세요: ${miss.join(" · ")}`, true); return; }
  if (val("s-caption") && !confirm("지금 쓴 인스타그램 문구를 AI 초안으로 바꿀까요?")) return;
  say("");
  const btn = $("sns-generate"); btn.disabled = true; btn.textContent = "만드는 중…";
  const st = $("sns-status"); st.hidden = false; st.className = "notice notice-info"; st.textContent = "AI가 케이스 스터디로 문구를 쓰고 있어요.";
  const input = {
    title: val("f-name"), summary: val("c-summary"), problem: val("c-problem"), process: val("c-process"), result: val("c-result"),
    category: $("f-category").value, industry: val("f-industry"),
    client: $("f-client-public").checked ? val("f-client") : "", // 공개 동의 없으면 이름은 보내지 않아요
    tags: tagsFromInput(),
  };
  try {
    const out = await (getKey() ? generateSnsDirect(input) : callFunction("generateSnsCopy", input, 60000));
    if (out && out.ok) {
      snsCaptions = out.result.captions.slice(0, 3); snsIndex = 0;
      showSnsVariant();
      $("s-hashtags").value = out.result.hashtags.join(", ");
      const nums = out.warnings && out.warnings.unsupportedNumbers;
      $("sns-warn").hidden = !(nums && nums.length);
      if (nums && nums.length) $("sns-warn").textContent = `케이스 스터디에 없는 숫자가 들어 있어요: ${nums.join(", ")} — 확인하고 고쳐 주세요.`;
      $("sns-badge").hidden = false;
      snsMeta = { promptVersion: out.promptVersion || "", ms: out.ms || 0, warnings: out.warnings || null, generatedAt: serverTimestamp() };
      st.textContent = "AI 초안이에요. 고친 뒤 복사해서 인스타그램에 올려 주세요.";
      dirty = true; setState("저장 안 된 변경 있음");
    } else {
      st.className = "notice notice-error";
      st.textContent = `문구를 만들지 못했어요 (${(out && out.reason) || "알 수 없음"}). '직접 쓰기'를 누르거나 바로 써서 복사할 수 있어요.`;
    }
  } catch (err) {
    st.className = "notice notice-error";
    st.textContent = `문구를 만들지 못했어요. ${friendlyError(err)} '직접 쓰기'를 누르거나 바로 써서 복사할 수 있어요.`;
  } finally { btn.disabled = false; btn.textContent = "인스타그램 문구 만들기"; }
});

// 문구 3안 중 지금 안을 칸에 보여줘요. 고친 내용은 그 안에 남겨요
function showSnsVariant() {
  $("s-caption").value = snsCaptions[snsIndex] || "";
  $("sns-variant").textContent = snsCaptions.length > 1 ? `${snsIndex + 1} / ${snsCaptions.length}` : "";
  $("sns-next").hidden = snsCaptions.length < 2;
}
$("s-caption").addEventListener("input", () => { if (snsCaptions.length) snsCaptions[snsIndex] = $("s-caption").value; });
$("sns-next").addEventListener("click", () => {
  if (snsCaptions.length < 2) return;
  snsCaptions[snsIndex] = $("s-caption").value;
  snsIndex = (snsIndex + 1) % snsCaptions.length;
  showSnsVariant();
});

$("sns-copy").addEventListener("click", async () => {
  const text = snsText(val("s-caption"), hashtagsFromInput());
  if (!text) { $("sns-copied").textContent = "복사할 문구가 없어요."; return; }
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // 클립보드 권한이 없는 브라우저: 직접 선택해서 복사하도록 문구 칸을 선택해 둬요
    $("s-caption").select();
    $("sns-copied").textContent = "자동 복사가 막혔어요. 선택된 문구를 직접 복사해 주세요.";
    return;
  }
  $("sns-copied").textContent = "복사했어요.";
  // H4(SNS 공유 비율) 측정용 복사 시각 기록 — 이미 저장된 작업이면 바로 남겨요
  snsCopiedAt = serverTimestamp();
  if (!isNew) {
    try { await setDoc(doc(db, "workNotes", workId), { sns: { caption: val("s-caption"), captions: snsCaptions, hashtags: hashtagsFromInput(), copiedAt: snsCopiedAt, ...(snsMeta ? { ai: snsMeta } : {}) } }, { merge: true }); }
    catch { /* 기록 실패는 복사를 막지 않아요 */ }
  }
});

// ---- 문장 틀 (AI 없이 0원, D27) ----
$("c-template").addEventListener("click", () => {
  const input = memoInput();
  if (!input.title) { say("제목을 먼저 써 주세요.", true); $("f-name").focus(); return; }
  if (!input.memo.request && !input.memo.work && !input.memo.result) { say("메모를 한 칸 이상 써 주세요.", true); $("m-request").focus(); return; }
  if (REQUIRED_TO_PUBLISH.some(([id]) => val(id)) && !confirm("위 칸에 쓴 내용을 메모로 바꿀까요? ('되돌리기'로 돌아올 수 있어요)")) return;
  pushUndo();
  fillDraft(templateDraft(input));
  showDraft("template"); $("warn").hidden = true;
  const gs = $("gen-status"); gs.hidden = false; gs.className = "notice notice-info";
  gs.textContent = "메모를 칸에 옮겼어요. 문장을 다듬거나 'AI로 수정하기'를 눌러 주세요.";
  aiMeta = { promptVersion: "template", ms: 0, warnings: null, generatedAt: serverTimestamp() };
  dirty = true; setState("저장 안 된 변경 있음");
});
$("sns-template").addEventListener("click", () => {
  const miss = REQUIRED_TO_PUBLISH.filter(([id]) => id !== "c-summary" && !val(id)).map(([, n]) => n);
  if (miss.length) { say(`인스타그램 문구는 케이스 스터디로 만들어요. 먼저 채워 주세요: ${miss.join(" · ")}`, true); return; }
  if (val("s-caption") && !confirm("지금 쓴 인스타그램 문구를 기본 문구로 바꿀까요?")) return;
  const out = templateSns({ title: val("f-name"), summary: val("c-summary"), problem: val("c-problem"), process: val("c-process"), result: val("c-result"), category: $("f-category").value, industry: val("f-industry") });
  snsCaptions = out.captions; snsIndex = 0; showSnsVariant();
  $("s-hashtags").value = out.hashtags.join(", ");
  $("sns-badge").hidden = true; $("sns-warn").hidden = true;
  const st = $("sns-status"); st.hidden = false; st.className = "notice notice-info"; st.textContent = "기본 문구 3안이에요. 다듬어서 복사해 주세요.";
  snsMeta = { promptVersion: "template", ms: 0, warnings: null, generatedAt: serverTimestamp() };
  dirty = true; setState("저장 안 된 변경 있음");
});

// 게시 화면 미리보기: 전체 화면으로 방문자 작업 상세와 똑같이 보여 줘요 (모두 textContent)
function paragraphsInto(box, text) {
  box.replaceChildren(...String(text || "").split(/\n{2,}/).map((t) => t.trim()).filter(Boolean).map((t) => {
    const p = document.createElement("p");
    t.split("\n").forEach((line, i) => { if (i) p.appendChild(document.createElement("br")); p.appendChild(document.createTextNode(line)); });
    return p;
  }));
}
function renderFullPreview(px = "fp") {
  const $p = (k) => $(`${px}-${k}`);
  const title = val("f-name") || "제목 없음";
  $p("cat").textContent = $("f-category").value;
  $p("title").textContent = title;
  $p("summary").textContent = val("c-summary");
  const meta = [["업종", val("f-industry") || "-"], ["기간", val("f-period") || "-"], ["맡은 일", val("f-role") || "-"]];
  if ($("f-client-public").checked && val("f-client")) meta.push(["클라이언트", val("f-client")]);
  $p("meta").replaceChildren(...meta.map(([k, v]) => { const d = document.createElement("div"); const dt = document.createElement("dt"); dt.textContent = k; const dd = document.createElement("dd"); dd.textContent = v; d.append(dt, dd); return d; }));
  paragraphsInto($p("problem"), val("c-problem") || "-");
  paragraphsInto($p("process"), val("c-process") || "-");
  paragraphsInto($p("result"), val("c-result") || "-");
  // 이미지: 위치 · 폭 · 정렬대로 (방문자 화면과 같은 규칙)
  const boxes = spotBoxes(px);
  Object.values(boxes).forEach((b) => b.replaceChildren());
  const live = px === "lp";
  images.forEach((im, i) => {
    if (!im.data) return;
    const l = layoutOf(im);
    const img = document.createElement("img"); img.alt = `${title} 이미지 ${i + 1}`; img.src = im.data; img.draggable = false;
    const hero = i === 0 && l.at === "cover"; // 맨 위 첫 장: 16:11 꽉 차게 (방문자 화면과 같게). 타이틀 이미지와는 따로예요
    if (!live) { if (hero) img.classList.add("is-hero"); boxes[l.at].appendChild(withCaption(img, l)); return; }
    boxes[l.at].appendChild(editableFigure(im, i, img, l));
  });
  Object.values(boxes).forEach((b) => { b.hidden = !b.children.length && !(live && dragging); });
  $p("tags").replaceChildren(...tagsFromInput().map((t) => { const sp = document.createElement("span"); sp.className = "tag"; sp.textContent = `#${t}`; return sp; }));
}
const spotBoxes = (px) => ({ cover: $(`${px}-cover`), problem: $(`${px}-imgs-problem`), process: $(`${px}-images`), result: $(`${px}-imgs-result`) });

// ---- 미리보기 안에서 이미지 고르기 · 끌어서 옮기기 · 모서리로 크기 바꾸기 · 정렬 ----
let dragging = false;
function editableFigure(im, i, img, l) {
  const fig = document.createElement("figure");
  fig.className = "pv-fig" + (i === selImg ? " on" : "") + (i === 0 && l.at === "cover" ? " is-hero" : "");
  fig.dataset.i = String(i);
  applyLayout(fig, l);
  fig.tabIndex = 0;
  fig.setAttribute("aria-label", `이미지 ${i + 1} · 폭 ${l.w}% · 눌러서 편집`);
  const wrap = document.createElement("div"); wrap.className = "pv-imgwrap"; wrap.appendChild(img);
  fig.appendChild(wrap);
  // 캡션 (사진 아래 작은 글씨)
  const capEl = document.createElement("figcaption"); capEl.className = "pv-cap"; capEl.textContent = l.cap || ""; capEl.hidden = !l.cap;
  fig.appendChild(capEl);
  fig.addEventListener("keydown", (e) => { if (e.target !== fig) return; if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selImg = i; renderLive(); } });
  // 끌어서 옮기기: 사진을 누른 채 다른 칸(맨 위 · 01 · 02 · 03)으로 옮겨요
  img.addEventListener("pointerdown", (e) => startMove(e, i, fig));
  if (i === selImg) {
    const handle = document.createElement("span");
    handle.className = "pv-handle"; handle.title = "끌어서 크기 바꾸기";
    handle.addEventListener("pointerdown", (e) => startResize(e, im, fig));
    wrap.appendChild(handle);
    fig.appendChild(imageToolbar(im, i, capEl));
  }
  return fig;
}
function tbButton(text, label, on, fn) {
  const b = document.createElement("button");
  b.type = "button"; b.textContent = text; b.setAttribute("aria-label", label);
  if (on) b.setAttribute("aria-pressed", "true");
  b.addEventListener("click", (e) => { e.stopPropagation(); fn(); });
  return b;
}
function imageToolbar(im, i, capEl) {
  const bar = document.createElement("div");
  bar.className = "pv-tools";
  // 캡션 입력: 쓰는 대로 사진 아래에 보여요 (다시 그리지 않아 입력이 끊기지 않아요)
  const capIn = document.createElement("input");
  capIn.className = "pv-cap-in"; capIn.maxLength = 120; capIn.placeholder = "캡션 (선택) · 예: 매장 간판 시안"; capIn.setAttribute("aria-label", "이미지 캡션");
  capIn.value = im.cap || "";
  capIn.addEventListener("input", () => { im.cap = capIn.value; if (capEl) { capEl.textContent = capIn.value.trim(); capEl.hidden = !capIn.value.trim(); } changed(); });
  capIn.addEventListener("pointerdown", (e) => e.stopPropagation());
  bar.appendChild(capIn);
  const l = layoutOf(im);
  const wlab = document.createElement("span"); wlab.className = "pv-w"; wlab.textContent = `${l.w}%`;
  bar.append(wlab,
    tbButton("왼쪽", "왼쪽 정렬", l.align === "left", () => { im.align = "left"; changed(); renderLive(); }),
    tbButton("가운데", "가운데 정렬", l.align === "center", () => { im.align = "center"; changed(); renderLive(); }),
    tbButton("오른쪽", "오른쪽 정렬", l.align === "right", () => { im.align = "right"; changed(); renderLive(); }));
  const sel = document.createElement("select");
  sel.setAttribute("aria-label", "이미지 위치");
  SPOTS.forEach(([k, t]) => { const o = document.createElement("option"); o.value = k; o.textContent = t; sel.appendChild(o); });
  sel.value = l.at;
  sel.addEventListener("click", (e) => e.stopPropagation());
  sel.addEventListener("change", () => { im.at = sel.value; moveSelected(im); });
  bar.append(sel,
    tbButton("위로", "같은 칸에서 위로", false, () => { swapInSpot(i, -1); }),
    tbButton("아래로", "같은 칸에서 아래로", false, () => { swapInSpot(i, 1); }),
    tbButton("자르기", "이미지 자르기", false, () => cropImage(im)));
  if (im.orig) bar.append(tbButton("원본으로", "자르기 전 원본으로", false, () => { im.id = im.orig.id; im.data = im.orig.data; delete im.orig; changed(); renderImages(); }));
  bar.append(tbButton("완료", "편집 끝내기", false, () => { selImg = -1; renderLive(); }));
  return bar;
}
function moveSelected(im) { reorderImages(); selImg = images.indexOf(im); changed(); renderImages(); }
function swapInSpot(i, dir) {
  const at = layoutOf(images[i]).at;
  let j = i + dir;
  while (j >= 0 && j < images.length && layoutOf(images[j]).at !== at) j += dir;
  if (j < 0 || j >= images.length) return;
  [images[i], images[j]] = [images[j], images[i]]; selImg = j; changed(); renderImages();
}
function startResize(e, im, fig) {
  e.preventDefault(); e.stopPropagation();
  const box = fig.parentElement.getBoundingClientRect();
  const r0 = fig.getBoundingClientRect();
  const align = layoutOf(im).align;
  const wlab = fig.querySelector(".pv-w");
  const move = (ev) => {
    let px = align === "left" ? ev.clientX - r0.left : align === "right" ? r0.right - ev.clientX : (ev.clientX - (r0.left + r0.width / 2)) * 2;
    im.w = clampW((px / box.width) * 100);
    applyLayout(fig, layoutOf(im));
    if (wlab) wlab.textContent = `${im.w}%`;
  };
  const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); changed(); renderImages(); };
  window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
}
function startMove(e, i, fig) {
  if (e.button !== 0) return;
  const sx = e.clientX, sy = e.clientY; let moved = false; let ghost = null;
  const boxes = spotBoxes("lp");
  const target = (x, y) => {
    // 가장 가까운 칸 (맨 위 · 01 · 02 · 03): 칸이 차지하는 세로 범위로 찾아요
    const zones = [["cover", boxes.cover], ["problem", boxes.problem.closest(".case-step")], ["process", boxes.process.closest(".case-step")], ["result", boxes.result.closest(".case-step")]];
    let best = null, dist = Infinity;
    zones.forEach(([k, z]) => { const r = z.getBoundingClientRect(); const d = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0; if (d < dist) { dist = d; best = k; } });
    return best;
  };
  const move = (ev) => {
    if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
    if (!moved) {
      moved = true; dragging = true; selImg = i;
      Object.values(boxes).forEach((b) => { b.hidden = false; b.classList.add("pv-drop"); });
      ghost = fig.cloneNode(true); ghost.className = "pv-ghost"; ghost.style.width = `${fig.getBoundingClientRect().width}px`; document.body.appendChild(ghost);
      fig.classList.add("pv-moving");
    }
    ghost.style.left = `${ev.clientX + 8}px`; ghost.style.top = `${ev.clientY + 8}px`;
    const at = target(ev.clientX, ev.clientY);
    Object.entries(boxes).forEach(([k, b]) => b.classList.toggle("pv-drop-on", k === at));
  };
  const up = (ev) => {
    window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
    if (!moved) { selImg = selImg === i ? -1 : i; renderLive(); return; } // 그냥 누르면 고르기
    ghost?.remove(); dragging = false;
    Object.values(boxes).forEach((b) => b.classList.remove("pv-drop", "pv-drop-on"));
    const im = images[i];
    const at = target(ev.clientX, ev.clientY);
    // 같은 칸 안 순서: 놓은 높이보다 아래에 있는 첫 이미지 앞에
    const others = images.filter((x) => x !== im && layoutOf(x).at === at);
    const figs = [...boxes[at].querySelectorAll(".pv-fig")].filter((f) => Number(f.dataset.i) !== i);
    let before = figs.findIndex((f) => { const r = f.getBoundingClientRect(); return ev.clientY < r.top + r.height / 2; });
    im.at = at;
    const rest = images.filter((x) => x !== im);
    const anchor = before >= 0 ? others[before] : null;
    const pos = anchor ? rest.indexOf(anchor) : (() => { let last = -1; rest.forEach((x, k) => { if (layoutOf(x).at === at) last = k; }); return last + 1; })();
    rest.splice(pos, 0, im); images = rest; reorderImages(); selImg = images.indexOf(im); changed(); renderImages();
  };
  window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
}
// 미리보기 빈 곳을 누르면 고르기 해제
document.addEventListener("pointerdown", (e) => { if (selImg >= 0 && !e.target.closest(".pv-fig") && !e.target.closest(".pw-thumbs")) { selImg = -1; renderLive(); } });

// 오른쪽 화면 미리보기: 쓰는 대로 바로 바뀌어요
function renderLive() { if ($("lp-title")) renderFullPreview("lp"); }
document.querySelectorAll("#editor .pw-left input, #editor .pw-left textarea, #editor .pw-left select").forEach((x) => x.addEventListener("input", renderLive));
$("preview-toggle").addEventListener("click", () => {
  renderFullPreview();
  const d = $("full-pv");
  if (d.showModal) d.showModal(); else d.setAttribute("open", "");
  d.scrollTop = 0; $("full-pv-close").focus();
});
$("full-pv-close").addEventListener("click", () => { const d = $("full-pv"); if (d.close) d.close(); else d.removeAttribute("open"); });

// ---- 저장 · 게시 (F6) ----
function tagsFromInput() {
  return [...new Set(val("c-tags").split(",").map((t) => t.replace(/^#/, "").trim()).filter(Boolean))].slice(0, 8);
}

// showDone: '게시하기'만 게시 완료 화면으로 넘어가요. '초안 저장'은 서버에 저장만 하고 화면은 그대로예요.
async function save(status, showDone = false) {
  say("");
  const name = val("f-name").slice(0, 60);
  if (!name) { say("제목을 써 주세요.", true); $("f-name").focus(); return false; }
  if (status === "published") {
    const miss = REQUIRED_TO_PUBLISH.filter(([id]) => !val(id)).map(([, n]) => n);
    if (miss.length) { say(`게시하려면 다음 칸을 채워 주세요: ${miss.join(" · ")}`, true); return false; }
  }
  const clientPublic = $("f-client-public").checked;
  const work = {
    name, title: val("f-name"), summary: val("c-summary"), problem: val("c-problem"), process: val("c-process"), result: val("c-result"),
    tags: tagsFromInput(), category: $("f-category").value, industry: val("f-industry"), period: val("f-period"), role: val("f-role"),
    client: clientPublic ? val("f-client") : "",
    coverImageId: coverImg() ? coverImg().id : "", imageIds: images.map((im) => im.id), imageSizes: images.map(layoutOf),
    status, createdAt: existing && existing.createdAt ? existing.createdAt : serverTimestamp(), updatedAt: serverTimestamp(),
    publishedAt: existing && existing.publishedAt ? existing.publishedAt : (status === "published" ? serverTimestamp() : null),
    authorUid: user.uid,
  };
  const notes = {
    memo: { request: val("m-request"), work: val("m-work"), result: val("m-result") },
    client: val("f-client"), clientPublic, updatedAt: serverTimestamp(),
  };
  if (aiMeta) notes.ai = aiMeta;
  notes.sns = { caption: val("s-caption"), captions: snsCaptions, hashtags: hashtagsFromInput(), ...(snsMeta ? { ai: snsMeta } : {}), ...(snsCopiedAt ? { copiedAt: snsCopiedAt } : {}) };
  ["save", "publish", "unpublish", "polish", "preview-toggle"].forEach((id) => { $(id).disabled = true; });
  // 영어 버전: 한국어가 바뀌었거나 아직 없으면 자동 번역 (크롬 내장 번역, D41) — 실패해도 저장은 계속
  const ko = { title: work.title, summary: work.summary, industry: work.industry, period: work.period, role: work.role, problem: work.problem, process: work.process, result: work.result, tags: work.tags };
  let en = enValues();
  let enNote = "";
  if (needsTranslation(en, fingerprint(workSource(ko)))) {
    setState("영어로 자동 번역하는 중…");
    const r = await translateWork(ko, (p) => setState(`번역 기능 내려받는 중… ${p}%`));
    if (r.ok) { en = r.en; fillEn(en); }
    else {
      // 이유를 접힌 영어 칸 안에만 두면 안 보여서, 칸을 펼치고 저장 안내에도 붙여요
      $("en-status").textContent = `${r.reason}. 한국어는 저장하고, 영어 화면엔 한국어가 보여요.`;
      $("en-box").open = true;
      enNote = ` 영어 번역은 안 됐어요: ${r.reason}.`;
    }
  }
  work.en = en;
  setState("저장하는 중…");
  try {
    await setDoc(doc(db, "workNotes", workId), notes, { merge: true });
    await setDoc(doc(db, "works", workId), work);
    // 서버에 저장된 진짜 시간값(Timestamp)으로 다시 읽어 둬요.
    // 가짜 객체를 넣어 두면 다음 저장 때 Firestore가 invalid-argument로 거절해요.
    try { const fresh = await getDoc(doc(db, "works", workId)); existing = fresh.exists() ? fresh.data() : { ...work, createdAt: null, publishedAt: null }; }
    catch { existing = { ...work, createdAt: null, publishedAt: null }; }
    dirty = false;
    if (isNew) { isNew = false; history.replaceState(null, "", `work.html?id=${encodeURIComponent(workId)}`); }
    applyStatus(status);
    setState(status === "published" ? "게시됨" : "초안 저장됨");
    say((showDone ? "" : (status === "published" ? "저장했어요. 게시된 페이지에도 바로 반영돼요." : "초안으로 저장했어요.")) + enNote);
    if (showDone && status === "published") {
      $("done-title").textContent = "게시됐어요.";
      $("done-view").href = `../work.html?id=${encodeURIComponent(workId)}`;
      $("published-panel").hidden = false;
      $("published-panel").scrollIntoView({ block: "start" });
    } else if (status !== "published") { $("published-panel").hidden = true; }
    return true;
  } catch (err) {
    setState("저장 실패"); say(friendlyError(err), true); return false;
  } finally {
    ["save", "publish", "unpublish", "polish", "preview-toggle"].forEach((id) => { $(id).disabled = false; });
  }
}
function applyStatus(status) {
  $("unpublish").hidden = status !== "published";
  $("publish").textContent = status === "published" ? "다시 게시" : "게시하기";
  $("page-title").textContent = val("f-name") || "새 케이스 스터디";
}
$("save").addEventListener("click", () => save(existing && existing.status === "published" ? "published" : "draft"));
$("publish").addEventListener("click", () => save("published", true));
$("unpublish").addEventListener("click", () => { if (confirm("게시를 취소하고 초안으로 돌릴까요? 방문자에게 더 이상 보이지 않아요.")) save("draft"); });
document.querySelectorAll("#editor input, #editor textarea, #editor select").forEach((el) => el.addEventListener("input", () => { dirty = true; setState("저장 안 된 변경 있음"); }));
window.addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

// ---- 불러오기 ----
// 작업 기간: 시작 · 끝 월 → works.period "2026.03 – 2026.05" (작업 목록 · 홈은 이 날짜로 정렬)
const ym = (v) => (v ? v.replace("-", ".") : "");
function syncPeriod() {
  const a = ym($("f-period-from").value), b = ym($("f-period-to").value);
  if (!a && !b) return; // 둘 다 비우면 예전 글자(예: '3주')를 그대로 둬요
  $("f-period").value = a && b && a !== b ? `${a} – ${b}` : a || b;
  changed(); renderLive();
}
["f-period-from", "f-period-to"].forEach((id) => $(id).addEventListener("change", syncPeriod));
function fillPeriod(text) {
  $("f-period").value = text || "";
  const ds = [...String(text || "").matchAll(/(\d{4})[.\-/년]\s*(\d{1,2})/g)].map((m) => `${m[1]}-${m[2].padStart(2, "0")}`);
  $("f-period-from").value = ds[0] || ""; $("f-period-to").value = ds[1] || ds[0] || "";
}

async function load() {
  const labels = await loadCategories(); // 관리자가 정한 분야 이름 (예전 '기타'는 편집디자인 칸)
  applyCategoryLabels(labels);
  if (isNew) { workId = doc(collection(db, "works")).id; renderImages(); return; }
  const [ws, ns] = await Promise.all([getDoc(doc(db, "works", workId)), getDoc(doc(db, "workNotes", workId)).catch(() => null)]); // 평가자 보기는 메모를 못 읽어요
  if (!ws.exists()) { say("작업을 찾을 수 없어요. 새 작업으로 시작해요.", true); isNew = true; workId = doc(collection(db, "works")).id; renderImages(); return; }
  existing = ws.data();
  const n = ns && ns.exists() ? ns.data() : {};
  $("f-name").value = existing.title || existing.name || ""; $("f-category").value = normalizeCategory(existing.category, labels) || labels[0];
  $("f-industry").value = existing.industry || ""; fillPeriod(existing.period); $("f-role").value = existing.role || "";
  $("f-client").value = n.client || existing.client || ""; $("f-client-public").checked = !!n.clientPublic;
  $("m-request").value = (n.memo && n.memo.request) || ""; $("m-work").value = (n.memo && n.memo.work) || ""; $("m-result").value = (n.memo && n.memo.result) || "";
  fillDraft(existing);
  fillEn(existing.en);
  if (REQUIRED_TO_PUBLISH.some(([id]) => val(id))) showDraft(n.ai && n.ai.promptVersion === "template" ? "template" : n.ai && n.ai.promptVersion === "manual" ? "manual" : n.ai ? "ai" : "saved");
  if (n.ai) showWarnings(n.ai.warnings);
  if (n.sns) { snsCaptions = Array.isArray(n.sns.captions) ? n.sns.captions : []; snsIndex = Math.max(0, snsCaptions.indexOf(n.sns.caption)); if (snsCaptions.length) showSnsVariant(); $("s-caption").value = n.sns.caption || ""; $("s-hashtags").value = (n.sns.hashtags || []).join(", "); if (n.sns.ai) $("sns-badge").hidden = false; if (n.sns.copiedAt) $("sns-copied").textContent = "이전에 복사한 적 있어요."; }
  images = await Promise.all((existing.imageIds || []).map(async (id, i) => ({ id, ...normLayout((existing.imageSizes || [])[i], i), data: await getImageData(id) })));
  const savedCover = images.find((x) => x.id === existing.coverImageId);
  if (savedCover) savedCover.cover = true;
  renderImages();
  applyStatus(existing.status);
  setState(existing.status === "published" ? "게시됨" : "초안");
}

if (!isConfigured) {
  $("checking").hidden = true; $("config-notice").hidden = false;
} else {
  onAuthStateChanged(auth, async (u) => {
    if (!u) { location.replace(`login.html?next=${isNew ? "work.html" : "works.html"}`); return; }
    user = u; markAdminBrowser();
    $("who").textContent = u.email || "";
    $("checking").hidden = true; $("editor").hidden = false;
    try { await load(); } catch (err) { say(friendlyError(err), true); }
  });
  $("logout").addEventListener("click", async () => { await signOut(auth); location.replace("login.html"); });
}

// ---- 내 API 키로 AI 쓰기 (D30): 키는 이 브라우저에만, 서버 · Firestore로 보내지 않아요 ----
function showKeyState() {
  const has = !!getKey();
  $("ai-key-state").textContent = has ? `키 연결됨${isRemembered() ? " · 이 브라우저에 기억" : " · 탭을 닫으면 지워져요"}` : "키 없음 · 서버 함수나 문장 틀을 써요";
  $("ai-key-clear").hidden = !has;
  $("ai-key").value = "";
  $("ai-key").placeholder = has ? "새 키로 바꾸려면 붙여넣기" : "sk-ant-...";
}
$("ai-key-save").addEventListener("click", () => {
  const k = $("ai-key").value.trim();
  if (!looksLikeKey(k)) { $("ai-key-state").textContent = "키 모양이 아니에요. sk-ant-로 시작하는 키를 붙여넣어 주세요."; $("ai-key").focus(); return; }
  setKey(k, $("ai-key-remember").checked); showKeyState();
});
$("ai-key-clear").addEventListener("click", () => { clearKey(); showKeyState(); });
$("ai-key-remember").checked = isRemembered();
showKeyState();

// ---- English 버전 (해외 방문자용): works.en 칸 — 방문자 영어 화면은 js/content-lang.js가 이 칸을 써요 ----
const EN_TEXT = ["title", "summary", "industry", "period", "role", "problem", "process", "result"];
let enSrc = ""; // 마지막으로 번역한 한국어의 지문 — 한국어가 그대로면 손으로 고친 영어를 지켜요
function enValues() {
  const o = Object.fromEntries(EN_TEXT.map((k) => [k, val(`en-${k}`)]));
  o.src = enSrc;
  o.tags = [...new Set(val("en-tags").split(",").map((t) => t.replace(/^#/, "").trim()).filter(Boolean))].slice(0, 8);
  return o;
}
function enSummary() {
  const o = enValues();
  const done = o.title && (o.problem || o.process || o.result);
  $("en-sum").textContent = done ? "자동 번역됨 · 고치고 싶을 때만 열어요" : "저장 · 게시할 때 자동으로 번역돼요";
}
function fillEn(en) {
  en = en || {};
  EN_TEXT.forEach((k) => { $(`en-${k}`).value = en[k] || ""; });
  $("en-tags").value = (en.tags || []).join(", ");
  enSrc = en.src || "";
  enSummary();
}
document.querySelectorAll("#en-box input, #en-box textarea").forEach((el) => el.addEventListener("input", enSummary));
$("en-translate").addEventListener("click", async () => {
  const st = $("en-status");
  const src = { title: val("f-name"), summary: val("c-summary"), industry: val("f-industry"), period: val("f-period"), role: val("f-role"),
    problem: val("c-problem"), process: val("c-process"), result: val("c-result"), tags: tagsFromInput() };
  if (!src.title || !(src.problem || src.process || src.result)) { st.textContent = "제목과 01 요청 · 02 과정 · 03 결과 중 하나 이상을 먼저 채워 주세요."; return; }
  if (EN_TEXT.some((k) => val(`en-${k}`)) && !confirm("영어 칸에 쓴 내용을 번역으로 바꿀까요?")) return;
  const btn = $("en-translate"); btn.disabled = true; st.textContent = "번역하는 중…";
  try {
    let r = await translateWork(src, (p) => { st.textContent = `번역 기능 내려받는 중… ${p}% (처음 한 번만)`; }, true);
    if (r.ok) { fillEn(r.en); changed(); st.textContent = "다시 번역했어요. 저장하면 반영돼요."; return; }
    if (!getKey()) { st.textContent = `${r.reason}.`; return; }
    r = await translateDirect(src); // 크롬 번역이 없으면 연결한 키로
    if (!r.ok) { st.textContent = `번역하지 못했어요: ${r.reason}. 영어 칸은 그대로예요.`; return; }
    fillEn({ ...r.result, src: fingerprint(workSource(src)) });
    changed();
    const nums = r.warnings && r.warnings.unsupportedNumbers;
    st.textContent = nums && nums.length ? `번역했어요. 한국어에 없는 숫자(${nums.join(", ")})가 있어요 — 확인해 주세요.` : "번역했어요. 읽어보고 어색한 곳을 고친 뒤 저장해 주세요.";
  } finally { btn.disabled = false; }
});
