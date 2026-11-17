import {
  auth, db, isConfigured, onAuthStateChanged, signOut,
  collection, doc, addDoc, updateDoc, getDoc, serverTimestamp, friendlyError
} from "./firebase.js";
import { sanitizeToFragment, sanitizeElementToHtml, htmlToText, imageIds } from "./sanitize.js";
import { uploadImage, resolveImages, getImageData } from "./images.js";
import { setupEditor } from "./editor.js";
import { renderBody } from "./render.js";

const $ = (id) => document.getElementById(id);
const editorEl = $("editor");
const statusEl = $("status");
const errorEl = $("form-error");
const uploadEl = $("upload-status");
const buttons = ["save-draft", "publish", "preview-btn"].map($);

const MAX_HTML = 400000; // 본문 HTML 최대 길이 (Firestore 문서 1MB 제한 안쪽으로)

let postId = new URLSearchParams(location.search).get("id");
let wasPublished = false;
let currentUser = null;
let coverImageId = null;
let dirty = false;
let uploading = 0;
let loadedAt = 0;

function setStatus(t) { statusEl.textContent = t; }
function showError(m) { errorEl.textContent = m; errorEl.hidden = !m; }
function busy(on) { buttons.forEach((b) => { b.disabled = on; }); }
function nowLabel() { const d = new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; }
function visibility() { return document.querySelector('input[name="visibility"]:checked').value; }

// ---------- 대표 이미지 ----------
function setCover(id, src) {
  coverImageId = id;
  $("cover").hidden = !id;
  if (id) {
    if (src) $("cover-img").src = src;
    else getImageData(id).then((d) => { if (d) $("cover-img").src = d; });
  }
}
$("cover-remove").addEventListener("click", () => { setCover(null); markDirty(); });

// ---------- 에디터 ----------
const ed = setupEditor({
  editor: editorEl,
  toolbar: $("toolbar"),
  imgBar: $("img-bar"),
  paper: document.querySelector(".paper"),
  linkDialog: $("link-dialog"),
  onChange: markDirty,
  onCoverPick: (id, src) => { setCover(id, src); markDirty(); },
  onImageFiles: handleImages
});

async function handleImages(files) {
  showError("");
  for (let i = 0; i < files.length; i++) {
    uploading++;
    uploadEl.hidden = false;
    uploadEl.textContent = `사진 올리는 중… (${i + 1}/${files.length})`;
    try {
      const img = await uploadImage(files[i], currentUser.uid);
      ed.insertImage(img);
    } catch (err) {
      showError(err && err.code ? friendlyError(err) : (err.message || "사진을 올리지 못했어요."));
    } finally {
      uploading--;
    }
  }
  uploadEl.hidden = true;
}

// ---------- 자동 백업 (이 브라우저에만, 저장 전 실수로 닫았을 때 대비) ----------
const backupKey = () => `write-backup:${postId || "new"}`;
function snapshot() {
  return {
    title: $("title").value, html: sanitizeElementToHtml(editorEl), category: $("category").value,
    tags: $("tags").value, summary: $("summary").value, coverImageId, at: Date.now()
  };
}
function markDirty() {
  dirty = true;
  if (!statusEl.textContent.includes("중…")) setStatus("수정 중 · 저장되지 않음");
}
setInterval(() => {
  if (!dirty || !currentUser) return;
  try { localStorage.setItem(backupKey(), JSON.stringify(snapshot())); } catch { /* 저장 공간이 없으면 건너뜀 */ }
}, 5000);
function clearBackup(keys) { try { keys.forEach((k) => localStorage.removeItem(k)); } catch { /* 무시 */ } }
function readBackup() { try { return JSON.parse(localStorage.getItem(backupKey()) || "null"); } catch { return null; } }

function applyData(d) {
  $("title").value = d.title || "";
  $("category").value = d.category || "바이브코딩";
  $("tags").value = Array.isArray(d.tags) ? d.tags.join(", ") : (d.tags || "");
  $("summary").value = d.summary || "";
  ed.setContent(sanitizeToFragment(d.html || ""));
  resolveImages(editorEl);
  setCover(d.coverImageId || null);
}

function offerRestore() {
  const b = readBackup();
  if (!b || b.at <= loadedAt) return;
  const d = new Date(b.at);
  $("restore-text").textContent = `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}에 저장하지 않은 글이 이 브라우저에 남아 있어요.`;
  $("restore-banner").hidden = false;
  $("restore-yes").onclick = () => { applyData(b); $("restore-banner").hidden = true; markDirty(); };
  $("restore-no").onclick = () => { clearBackup([backupKey()]); $("restore-banner").hidden = true; };
}

// ---------- 저장 ----------
function collect() {
  const contentHtml = sanitizeElementToHtml(editorEl);
  const body = htmlToText(contentHtml).slice(0, 100000);
  const ids = imageIds(contentHtml);
  const tags = $("tags").value.split(",").map((t) => t.trim().replace(/^#/, "")).filter(Boolean).slice(0, 10);
  const summary = $("summary").value.trim() || body.replace(/\s+/g, " ").slice(0, 120);
  const cover = coverImageId && ids.includes(coverImageId) ? coverImageId : (ids[0] || null);
  return { title: $("title").value.trim(), contentHtml, body, format: "html", category: $("category").value, tags, summary, coverImageId: cover };
}

async function save(status) {
  showError("");
  if (uploading) { showError("사진을 올리는 중이에요. 끝난 뒤 다시 눌러 주세요."); return null; }
  const data = collect();
  if (!data.title) { showError("제목을 입력해 주세요."); $("title").focus(); return null; }
  if (status !== "draft" && !data.body.trim() && !imageIds(data.contentHtml).length) {
    showError("발행하려면 본문을 입력해 주세요."); editorEl.focus(); return null;
  }
  if (data.contentHtml.length > MAX_HTML) { showError("글이 너무 길어요. 글을 나눠서 올려 주세요."); return null; }

  busy(true);
  setStatus(status === "draft" ? "저장하는 중…" : "발행하는 중…");
  const payload = { ...data, status, authorUid: currentUser.uid, updatedAt: serverTimestamp() };
  if (status !== "draft" && !wasPublished) payload.publishedAt = serverTimestamp();
  const oldKey = backupKey();
  try {
    if (postId) await updateDoc(doc(db, "posts", postId), payload);
    else {
      payload.createdAt = serverTimestamp();
      const ref = await addDoc(collection(db, "posts"), payload);
      postId = ref.id;
      history.replaceState(null, "", `write.html?id=${encodeURIComponent(postId)}`);
    }
    if (status !== "draft") wasPublished = true;
    dirty = false;
    clearBackup([oldKey, backupKey()]);
    const label = { draft: "임시저장됨", published: "발행됨", private: "비공개로 저장됨" }[status];
    setStatus(`${label} · ${nowLabel()}`);
    return postId;
  } catch (err) {
    setStatus("저장하지 못했어요");
    showError(friendlyError(err));
    return null;
  } finally {
    busy(false);
  }
}

// ---------- 글 불러오기 ----------
async function loadPost(id) {
  try {
    const snap = await getDoc(doc(db, "posts", id));
    if (!snap.exists()) {
      showError("이 글을 찾을 수 없어요. 새 글로 시작할게요.");
      postId = null; history.replaceState(null, "", "write.html");
      return;
    }
    const p = snap.data();
    let html = p.contentHtml;
    if (p.format !== "html") {
      // 예전 방식(간단한 마크다운) 글은 서식 있는 글로 바꿔서 열어요
      const tmp = document.createElement("div");
      renderBody(p.body || "", tmp);
      html = sanitizeElementToHtml(tmp);
    }
    applyData({ ...p, html });
    if (p.status === "private") document.querySelector('input[name="visibility"][value="private"]').checked = true;
    wasPublished = p.status === "published" || p.status === "private";
    loadedAt = p.updatedAt && typeof p.updatedAt.toMillis === "function" ? p.updatedAt.toMillis() : 0;
    const label = { draft: "임시저장된 글", published: "발행된 글", private: "비공개 글" }[p.status] || "글";
    setStatus(`${label} 수정 중`);
    if (wasPublished) { $("view-link").href = `../post.html?id=${encodeURIComponent(id)}`; $("view-link").hidden = false; }
  } catch (err) {
    showError(friendlyError(err));
  }
}

// ---------- 미리보기 ----------
$("preview-btn").addEventListener("click", () => {
  $("preview-title").textContent = $("title").value.trim() || "(제목 없음)";
  const frag = sanitizeToFragment(sanitizeElementToHtml(editorEl));
  $("preview-body").replaceChildren(frag);
  resolveImages($("preview-body"));
  $("preview-dialog").showModal();
});
$("preview-close").addEventListener("click", () => $("preview-dialog").close());

// ---------- 시작 ----------
if (!isConfigured) {
  $("checking").hidden = true;
  $("config-notice").hidden = false;
} else {
  onAuthStateChanged(auth, async (user) => {
    if (!user) { location.replace("login.html?next=write.html"); return; }
    if (currentUser) return;
    currentUser = user;
    $("checking").hidden = true;
    $("toolbar").hidden = false;
    $("workspace").hidden = false;
    busy(false);
    if (postId) await loadPost(postId);
    offerRestore();
    ed.updateCount();
    $("title").focus();
  });

  $("title").addEventListener("input", markDirty);
  ["category", "tags", "summary"].forEach((id) => $(id).addEventListener("input", markDirty));
  document.querySelectorAll('input[name="visibility"]').forEach((r) => r.addEventListener("change", markDirty));

  $("save-draft").addEventListener("click", () => save("draft"));
  $("publish").addEventListener("click", async () => {
    const id = await save(visibility());
    if (id) location.href = `../post.html?id=${encodeURIComponent(id)}`;
  });
  $("logout").addEventListener("click", async () => {
    if (dirty && !window.confirm("저장하지 않은 내용이 있어요. 그래도 로그아웃할까요?")) return;
    dirty = false;
    await signOut(auth);
    location.replace("login.html");
  });
  window.addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });
}
