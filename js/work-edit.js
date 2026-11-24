// 작업 편집 (PRD v0.6 F1 작업 입력 · F2 AI 초안 · F3 편집·게시 · F7 실패 대체)
// - 왼쪽 입력 → "AI 초안 만들기" → 오른쪽 칸 채움 → 고쳐서 저장 · 게시
// - 공개 문서 works/{id}: 방문자가 볼 내용만 / 관리자 문서 workNotes/{id}: 메모 · 클라이언트 실명 · AI 기록
// - AI가 실패해도 오른쪽 칸에 직접 써서 저장 · 게시할 수 있어요 (F7)
import {
  auth, db, isConfigured, onAuthStateChanged, signOut,
  collection, doc, getDoc, setDoc, serverTimestamp, friendlyError, markAdminBrowser, callFunction
} from "./firebase.js";
import { uploadImage, getImageData } from "./images.js";

const $ = (id) => document.getElementById(id);
const MAX_IMAGES = 4;
const REQUIRED_TO_PUBLISH = [["c-title", "제목"], ["c-summary", "한 줄 요약"], ["c-problem", "문제"], ["c-process", "과정"], ["c-result", "결과"]];

const params = new URLSearchParams(location.search);
const paramId = params.get("id");
let workId = paramId && /^[A-Za-z0-9_-]{1,40}$/.test(paramId) ? paramId : null;
let isNew = !workId;
let user = null;
let existing = null;      // 불러온 공개 문서 (createdAt · publishedAt 유지용)
let images = [];          // [{ id, data }]
let aiMeta = null;        // 마지막 AI 생성 기록
let dirty = false;

function say(msg, isError) {
  $("msg-error").hidden = true; $("msg-ok").hidden = true;
  if (!msg) return;
  const el = $(isError ? "msg-error" : "msg-ok");
  el.textContent = msg; el.hidden = false;
}
function setState(t) { $("save-state").textContent = t; }
const val = (id) => $(id).value.trim();

// ---- 이미지 ----
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
    fig.append(img, cap, rm);
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

// ---- AI 초안 (F2) · 실패 시 직접 작성 (F7) ----
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
  if (nums && nums.length) box.textContent = `메모에 없는 숫자가 들어 있어요: ${nums.join(", ")} — 사실인지 확인하고 고치거나 지워 주세요.`;
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
    const out = await callFunction("generateCaseStudy", input, 60000);
    if (out && out.ok) {
      fillDraft(out.result);
      showWarnings(out.warnings);
      aiMeta = { promptVersion: out.promptVersion || "", ms: out.ms || 0, warnings: out.warnings || null, generatedAt: serverTimestamp() };
      $("ai-badge").hidden = false;
      gs.textContent = "AI 초안이에요. 사실과 다른 곳을 고친 뒤 게시해 주세요.";
      dirty = true; setState("저장 안 된 변경 있음");
    } else {
      gs.className = "notice notice-error";
      gs.textContent = `AI 초안을 만들지 못했어요 (${(out && out.reason) || "알 수 없음"}). 오른쪽 칸에 직접 써서 저장할 수 있어요.`;
    }
  } catch (err) {
    gs.className = "notice notice-error";
    gs.textContent = `AI 초안을 만들지 못했어요. ${friendlyError(err)} 오른쪽 칸에 직접 써서 저장할 수 있어요.`;
  } finally {
    btn.disabled = false; btn.textContent = "AI 초안 만들기";
  }
});

// ---- 저장 · 게시 (F3) ----
function tagsFromInput() {
  return [...new Set(val("c-tags").split(",").map((t) => t.replace(/^#/, "").trim()).filter(Boolean))].slice(0, 8);
}

async function save(status) {
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
    tags: tagsFromInput(), category: $("f-category").value, industry: val("f-industry"), period: val("f-period"),
    client: clientPublic ? val("f-client") : "",
    coverImageId: images[0] ? images[0].id : "", imageIds: images.map((im) => im.id),
    status, createdAt: existing && existing.createdAt ? existing.createdAt : serverTimestamp(), updatedAt: serverTimestamp(),
    publishedAt: existing && existing.publishedAt ? existing.publishedAt : (status === "published" ? serverTimestamp() : null),
    authorUid: user.uid,
  };
  const notes = {
    memo: { request: val("m-request"), work: val("m-work"), result: val("m-result") },
    client: val("f-client"), clientPublic, updatedAt: serverTimestamp(),
  };
  if (aiMeta) notes.ai = aiMeta;
  ["save", "publish", "unpublish"].forEach((id) => { $(id).disabled = true; });
  setState("저장하는 중…");
  try {
    await setDoc(doc(db, "workNotes", workId), notes, { merge: true });
    await setDoc(doc(db, "works", workId), work);
    existing = { ...work, createdAt: existing && existing.createdAt ? existing.createdAt : { toMillis: () => Date.now() },
      publishedAt: work.publishedAt ? (existing && existing.publishedAt) || { toMillis: () => Date.now() } : null };
    dirty = false;
    if (isNew) { isNew = false; history.replaceState(null, "", `work.html?id=${encodeURIComponent(workId)}`); }
    applyStatus(status);
    setState(status === "published" ? "게시됨" : "초안 저장됨");
    say(status === "published" ? "게시했어요. 방문자에게 보여요." : "초안으로 저장했어요.");
    return true;
  } catch (err) {
    setState("저장 실패"); say(friendlyError(err), true); return false;
  } finally {
    ["save", "publish", "unpublish"].forEach((id) => { $(id).disabled = false; });
  }
}
function applyStatus(status) {
  $("unpublish").hidden = status !== "published";
  $("publish").textContent = status === "published" ? "다시 게시" : "게시";
  $("page-title").textContent = val("f-name") || "새 작업";
}
$("save").addEventListener("click", () => save(existing && existing.status === "published" ? "published" : "draft"));
$("publish").addEventListener("click", () => save("published"));
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
  $("f-industry").value = existing.industry || ""; $("f-period").value = existing.period || "";
  $("f-client").value = n.client || existing.client || ""; $("f-client-public").checked = !!n.clientPublic;
  $("m-request").value = (n.memo && n.memo.request) || ""; $("m-work").value = (n.memo && n.memo.work) || ""; $("m-result").value = (n.memo && n.memo.result) || "";
  fillDraft(existing);
  if (n.ai) { $("ai-badge").hidden = false; showWarnings(n.ai.warnings); }
  images = await Promise.all((existing.imageIds || []).map(async (id) => ({ id, data: await getImageData(id) })));
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
