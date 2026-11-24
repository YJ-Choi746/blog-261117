// 작업 편집 (PRD v1.1 F4 작업 입력 · F5 AI 초안 · F6 미리보기와 게시, 실패 시 직접 쓰기 · F7 인스타그램 문구)
// - 왼쪽 입력 → "AI 초안 만들기" → 오른쪽 칸 채움 → 고쳐서 저장 · 게시
// - 공개 문서 works/{id}: 방문자가 볼 내용만 / 관리자 문서 workNotes/{id}: 메모 · 클라이언트 실명 · AI 기록
// - AI가 실패해도 오른쪽 칸에 직접 써서 저장 · 게시할 수 있어요 (F6)
import { getKey, setKey, clearKey, isRemembered, looksLikeKey, generateCaseDirect, generateSnsDirect } from "./ai-direct.js";
import {
  auth, db, isConfigured, onAuthStateChanged, signOut,
  collection, doc, getDoc, setDoc, serverTimestamp, friendlyError, markAdminBrowser, callFunction
} from "./firebase.js";
import { uploadImage, getImageData } from "./images.js";
import { templateDraft, templateSns } from "./templates.js";

const $ = (id) => document.getElementById(id);
const MAX_IMAGES = 4;
const REQUIRED_TO_PUBLISH = [["c-title", "제목"], ["c-summary", "한 줄 요약"], ["c-problem", "요청"], ["c-process", "과정"], ["c-result", "결과"]];

const params = new URLSearchParams(location.search);
const paramId = params.get("id");
let workId = paramId && /^[A-Za-z0-9_-]{1,40}$/.test(paramId) ? paramId : null;
let isNew = !workId;
let user = null;
let existing = null;      // 불러온 공개 문서 (createdAt · publishedAt 유지용)
let images = [];          // [{ id, data }]
let aiMeta = null;        // 마지막 AI 생성 기록
let dirty = false;

// 안내 문구: 초안 칸이 보이면 '게시하기 · 미리보기 · 초안 저장' 버튼 바로 밑에, 아니면 화면 위에 보여요
function say(msg, isError) {
  $("msg-error").hidden = true; $("msg-ok").hidden = true;
  const act = $("act-msg"); act.hidden = true; act.textContent = "";
  if (!msg) return;
  if (!$("draft").hidden) {
    act.textContent = msg; act.className = `notice ${isError ? "notice-error" : "notice-ok"}`;
    act.setAttribute("role", isError ? "alert" : "status"); act.hidden = false;
    return;
  }
  const el = $(isError ? "msg-error" : "msg-ok");
  el.textContent = msg; el.hidden = false;
}
function setState(t) { $("save-state").textContent = t; }
const val = (id) => $(id).value.trim();

// ---- 초안 영역 (프로토타입 디자인): 비어 있으면 안내, 만들거나 직접 쓰면 편집칸을 보여줘요 ----
const BADGE = { ai: "AI 초안 · 검토 필요", template: "문장 틀 초안 · AI 연결 안 됨", manual: "직접 작성", saved: "저장된 초안" };
function showDraft(kind) {
  $("draft-empty").hidden = true; $("draft").hidden = false;
  if (kind) $("ai-badge").textContent = BADGE[kind] || BADGE.saved;
  $("draft-check").hidden = kind === "manual";
  setPreview(false);
}
function syncMeta() {
  $("ms-industry").textContent = val("f-industry") || "-";
  $("ms-period").textContent = val("f-period") || "-";
  $("ms-role").textContent = val("f-role") || "-";
}
["f-industry", "f-period", "f-role"].forEach((id) => $(id).addEventListener("input", syncMeta));

// 게시 화면 미리보기: 방문자 상세와 같은 순서로 그려요 (모두 textContent)
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
function renderPreview() {
  const box = $("draft-preview");
  const parts = [el("span", "pv-cat", $("f-category").value), el("h3", "pv-t", val("c-title") || "제목 없음"), el("p", "pv-l", val("c-summary"))];
  const meta = el("div", "pw-meta-s");
  [["업종", val("f-industry")], ["기간", val("f-period")], ["맡은 일", val("f-role")]].forEach(([k, v]) => { const d = el("div"); d.append(el("span", "", k), el("span", "", v || "-")); meta.appendChild(d); });
  parts.push(meta);
  if (images[0] && images[0].data) { const img = el("img", `pv-cover sz-${sizeOf(images[0])}`); img.alt = "커버 이미지"; img.src = images[0].data; parts.push(img); }
  [["01", "요청", val("c-problem")], ["02", "과정", val("c-process")], ["03", "결과", val("c-result")]].forEach(([n, h, t]) => {
    const sec = el("div", "pv-s"); const body = el("div"); body.append(el("h4", "", h), el("p", "", t || "-"));
    if (n === "02") images.slice(1).forEach((im, i) => { if (!im.data) return; const img = el("img", `pv-img sz-${sizeOf(im)}`); img.alt = `이미지 ${i + 2}`; img.src = im.data; body.appendChild(img); });
    sec.append(el("span", "pv-no", n), body); parts.push(sec);
  });
  const tags = tagsFromInput(); if (tags.length) parts.push(el("p", "pv-tags", tags.map((t) => `#${t}`).join(" ")));
  box.replaceChildren(...parts);
}
let previewing = false;
function setPreview(on) {
  previewing = on;
  if (on) renderPreview();
  $("draft-preview").hidden = !on; $("draft-edit").hidden = on;
  $("preview-toggle").textContent = on ? "편집으로 돌아가기" : "게시 화면 미리보기";
  $("draft-hint").textContent = on ? "방문자에게 이렇게 보여요" : "고칠 곳이 있으면 바로 수정하세요";
}

// ---- 이미지 ----
const SIZES = ["l", "m", "s"];
const sizeOf = (im) => (SIZES.includes(im && im.size) ? im.size : "l");
function renderImages() {
  const box = $("images");
  box.replaceChildren(...images.map((im, i) => {
    const fig = document.createElement("figure");
    fig.className = "work-image";
    const img = document.createElement("img");
    img.alt = i === 0 ? "커버 이미지" : `이미지 ${i + 1}`;
    img.src = im.data || "";
    const cap = document.createElement("figcaption");
    cap.textContent = i === 0 ? "커버" : `${i + 1}`;
    const rm = document.createElement("button");
    rm.type = "button"; rm.className = "btn btn-text"; rm.textContent = "빼기";
    rm.setAttribute("aria-label", `${img.alt} 빼기`);
    rm.addEventListener("click", () => { images.splice(i, 1); dirty = true; renderImages(); });
    // 이미지 크기 (게시 화면에서 보이는 폭): 크게 100% · 보통 70% · 작게 45%. 자르지 않고 원래 비율로 보여요
    const size = document.createElement("select");
    size.className = "pw-size"; size.setAttribute("aria-label", `${img.alt} 크기`);
    [["l", "크게"], ["m", "보통"], ["s", "작게"]].forEach(([v, t]) => { const o = document.createElement("option"); o.value = v; o.textContent = t; size.appendChild(o); });
    size.value = SIZES.includes(im.size) ? im.size : "l";
    size.addEventListener("change", () => { im.size = size.value; dirty = true; setState("저장 안 된 변경 있음"); if (previewing) renderPreview(); });
    fig.append(img, cap, size, rm);
    return fig;
  }));
  $("add-image").disabled = images.length >= MAX_IMAGES;
}
$("add-image").addEventListener("click", () => $("image-input").click());
$("image-input").addEventListener("change", async (e) => {
  const files = [...e.target.files].slice(0, MAX_IMAGES - images.length);
  e.target.value = "";
  for (const f of files) {
    setState("이미지 올리는 중…");
    try { images.push(await uploadImage(f, user.uid)); dirty = true; renderImages(); }
    catch (err) { say(`이미지를 올리지 못했어요. ${friendlyError(err)}`, true); }
  }
  setState(dirty ? "저장 안 된 변경 있음" : "");
});

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
  $("c-title").value = r.title || ""; $("c-summary").value = r.summary || "";
  $("c-problem").value = r.problem || ""; $("c-process").value = r.process || ""; $("c-result").value = r.result || "";
  $("c-tags").value = (r.tags || []).join(", ");
}
function showWarnings(w) {
  const box = $("warn");
  const nums = w && w.unsupportedNumbers;
  box.hidden = !(nums && nums.length);
  if (nums && nums.length) box.textContent = `게시 전에 보충하면 좋아요 · 메모에 없는 숫자가 들어 있어요: ${nums.join(", ")} — 사실인지 확인하고 고치거나 지워 주세요.`;
}

$("generate").addEventListener("click", async () => {
  const input = memoInput();
  if (!input.title) { say("작업명을 먼저 써 주세요.", true); $("f-name").focus(); return; }
  if (!input.memo.request && !input.memo.work && !input.memo.result) { say("메모를 한 칸 이상 써 주세요.", true); $("m-request").focus(); return; }
  const hasDraft = REQUIRED_TO_PUBLISH.some(([id]) => val(id));
  if (hasDraft && !confirm("오른쪽에 쓴 내용을 AI 초안으로 바꿀까요?")) return;
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
      gs.textContent = `AI 초안을 만들지 못했어요 (${(out && out.reason) || "알 수 없음"}). '문장 틀로 채우기'를 누르거나 오른쪽 칸에 직접 써 주세요.`;
    }
  } catch (err) {
    // AI 서버 함수(generateCaseStudy)가 배포되지 않았거나 꺼져 있으면, 기다리게 하지 않고 문장 틀로 바로 채워요 (0원, D27)
    fillDraft(templateDraft(input));
    showDraft("template"); $("warn").hidden = true;
    aiMeta = { promptVersion: "template", ms: 0, warnings: null, generatedAt: serverTimestamp() };
    dirty = true; setState("저장 안 된 변경 있음");
    gs.className = "notice notice-info";
    gs.textContent = `AI 서버가 아직 꺼져 있어 문장 틀로 먼저 채웠어요 (${(err && err.code) || "연결 안 됨"}). 아래 '내 API 키로 AI 쓰기'에 키를 넣으면 AI가 바로 써요.`;
  } finally {
    btn.disabled = false; btn.textContent = "AI 초안 만들기";
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
    title: val("c-title"), summary: val("c-summary"), problem: val("c-problem"), process: val("c-process"), result: val("c-result"),
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
      st.textContent = `문구를 만들지 못했어요 (${(out && out.reason) || "알 수 없음"}). '문장 틀 문구'를 누르거나 직접 써서 복사할 수 있어요.`;
    }
  } catch (err) {
    st.className = "notice notice-error";
    st.textContent = `문구를 만들지 못했어요. ${friendlyError(err)} '문장 틀 문구'를 누르거나 직접 써서 복사할 수 있어요.`;
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
  if (!input.title) { say("작업명을 먼저 써 주세요.", true); $("f-name").focus(); return; }
  if (!input.memo.request && !input.memo.work && !input.memo.result) { say("메모를 한 칸 이상 써 주세요.", true); $("m-request").focus(); return; }
  if (REQUIRED_TO_PUBLISH.some(([id]) => val(id)) && !confirm("오른쪽에 쓴 내용을 문장 틀 초안으로 바꿀까요?")) return;
  fillDraft(templateDraft(input));
  showDraft("template"); $("warn").hidden = true;
  const gs = $("gen-status"); gs.hidden = false; gs.className = "notice notice-info";
  gs.textContent = "문장 틀로 채웠어요. 메모를 그대로 옮긴 초안이라 문장을 다듬어 주세요.";
  aiMeta = { promptVersion: "template", ms: 0, warnings: null, generatedAt: serverTimestamp() };
  dirty = true; setState("저장 안 된 변경 있음");
});
$("sns-template").addEventListener("click", () => {
  const miss = REQUIRED_TO_PUBLISH.filter(([id]) => id !== "c-summary" && !val(id)).map(([, n]) => n);
  if (miss.length) { say(`인스타그램 문구는 케이스 스터디로 만들어요. 먼저 채워 주세요: ${miss.join(" · ")}`, true); return; }
  if (val("s-caption") && !confirm("지금 쓴 인스타그램 문구를 문장 틀 문구로 바꿀까요?")) return;
  const out = templateSns({ title: val("c-title"), summary: val("c-summary"), problem: val("c-problem"), process: val("c-process"), result: val("c-result"), category: $("f-category").value, industry: val("f-industry") });
  snsCaptions = out.captions; snsIndex = 0; showSnsVariant();
  $("s-hashtags").value = out.hashtags.join(", ");
  $("sns-badge").hidden = true; $("sns-warn").hidden = true;
  const st = $("sns-status"); st.hidden = false; st.className = "notice notice-info"; st.textContent = "문장 틀 문구 3안이에요. 다듬어서 복사해 주세요.";
  snsMeta = { promptVersion: "template", ms: 0, warnings: null, generatedAt: serverTimestamp() };
  dirty = true; setState("저장 안 된 변경 있음");
});

// 직접 쓰기: 메모를 그대로 옮긴 편집칸을 열어요 (AI 없이)
$("c-manual").addEventListener("click", () => {
  if (REQUIRED_TO_PUBLISH.some(([id]) => val(id)) && !$("draft").hidden) { showDraft("manual"); $("c-title").focus(); return; }
  fillDraft({ title: val("f-name"), summary: "", problem: val("m-request"), process: val("m-work"), result: val("m-result"), tags: [] });
  showDraft("manual"); $("warn").hidden = true; $("gen-status").hidden = true;
  aiMeta = { promptVersion: "manual", ms: 0, warnings: null, generatedAt: serverTimestamp() };
  dirty = true; setState("저장 안 된 변경 있음"); $("c-title").focus();
});
$("regen").addEventListener("click", () => $("generate").click());
$("preview-toggle").addEventListener("click", () => setPreview(!previewing));

// ---- 저장 · 게시 (F6) ----
function tagsFromInput() {
  return [...new Set(val("c-tags").split(",").map((t) => t.replace(/^#/, "").trim()).filter(Boolean))].slice(0, 8);
}

// showDone: '게시하기'만 게시 완료 화면으로 넘어가요. '초안 저장'은 서버에 저장만 하고 화면은 그대로예요.
async function save(status, showDone = false) {
  say("");
  const name = val("f-name");
  if (!name) { say("작업명을 써 주세요.", true); $("f-name").focus(); return false; }
  if (status === "published") {
    const miss = REQUIRED_TO_PUBLISH.filter(([id]) => !val(id)).map(([, n]) => n);
    if (miss.length) { say(`게시하려면 다음 칸을 채워 주세요: ${miss.join(" · ")}`, true); return false; }
  }
  const clientPublic = $("f-client-public").checked;
  const work = {
    name, title: val("c-title"), summary: val("c-summary"), problem: val("c-problem"), process: val("c-process"), result: val("c-result"),
    tags: tagsFromInput(), category: $("f-category").value, industry: val("f-industry"), period: val("f-period"), role: val("f-role"),
    client: clientPublic ? val("f-client") : "",
    coverImageId: images[0] ? images[0].id : "", imageIds: images.map((im) => im.id), imageSizes: images.map(sizeOf),
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
  ["save", "publish", "unpublish", "regen", "preview-toggle"].forEach((id) => { $(id).disabled = true; });
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
    say(showDone ? "" : (status === "published" ? "저장했어요. 게시된 페이지에도 바로 반영돼요." : "초안으로 저장했어요."));
    if (showDone && status === "published") {
      $("done-title").textContent = `${val("c-title") || name} 게시됨`;
      $("done-view").href = `../work.html?id=${encodeURIComponent(workId)}`;
      $("published-panel").hidden = false; $("sns-panel").hidden = false;
      $("published-panel").scrollIntoView({ block: "start" });
    } else if (status !== "published") { $("published-panel").hidden = true; }
    return true;
  } catch (err) {
    setState("저장 실패"); say(friendlyError(err), true); return false;
  } finally {
    ["save", "publish", "unpublish", "regen", "preview-toggle"].forEach((id) => { $(id).disabled = false; });
  }
}
function applyStatus(status) {
  $("unpublish").hidden = status !== "published";
  $("publish").textContent = status === "published" ? "다시 게시" : "게시하기";
  $("page-title").textContent = val("f-name") || "새 케이스 스터디";
  $("sns-panel").hidden = status !== "published";
}
$("save").addEventListener("click", () => save(existing && existing.status === "published" ? "published" : "draft"));
$("publish").addEventListener("click", () => save("published", true));
$("unpublish").addEventListener("click", () => { if (confirm("게시를 취소하고 초안으로 돌릴까요? 방문자에게 더 이상 보이지 않아요.")) save("draft"); });
document.querySelectorAll("#editor input, #editor textarea, #editor select").forEach((el) => el.addEventListener("input", () => { dirty = true; setState("저장 안 된 변경 있음"); }));
window.addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

// ---- 불러오기 ----
async function load() {
  if (isNew) { workId = doc(collection(db, "works")).id; renderImages(); return; }
  const [ws, ns] = await Promise.all([getDoc(doc(db, "works", workId)), getDoc(doc(db, "workNotes", workId))]);
  if (!ws.exists()) { say("작업을 찾을 수 없어요. 새 작업으로 시작해요.", true); isNew = true; workId = doc(collection(db, "works")).id; renderImages(); return; }
  existing = ws.data();
  const n = ns.exists() ? ns.data() : {};
  $("f-name").value = existing.name || ""; $("f-category").value = existing.category || "브랜딩";
  $("f-industry").value = existing.industry || ""; $("f-period").value = existing.period || ""; $("f-role").value = existing.role || "";
  $("f-client").value = n.client || existing.client || ""; $("f-client-public").checked = !!n.clientPublic;
  $("m-request").value = (n.memo && n.memo.request) || ""; $("m-work").value = (n.memo && n.memo.work) || ""; $("m-result").value = (n.memo && n.memo.result) || "";
  fillDraft(existing);
  syncMeta();
  if (REQUIRED_TO_PUBLISH.some(([id]) => val(id))) showDraft(n.ai && n.ai.promptVersion === "template" ? "template" : n.ai && n.ai.promptVersion === "manual" ? "manual" : n.ai ? "ai" : "saved");
  if (n.ai) showWarnings(n.ai.warnings);
  if (n.sns) { snsCaptions = Array.isArray(n.sns.captions) ? n.sns.captions : []; snsIndex = Math.max(0, snsCaptions.indexOf(n.sns.caption)); if (snsCaptions.length) showSnsVariant(); $("s-caption").value = n.sns.caption || ""; $("s-hashtags").value = (n.sns.hashtags || []).join(", "); if (n.sns.ai) $("sns-badge").hidden = false; if (n.sns.copiedAt) $("sns-copied").textContent = "이전에 복사한 적 있어요."; }
  images = await Promise.all((existing.imageIds || []).map(async (id, i) => ({ id, size: (existing.imageSizes || [])[i] || "l", data: await getImageData(id) })));
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
