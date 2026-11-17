import {
  auth, db, isConfigured, onAuthStateChanged, signOut,
  collection, doc, addDoc, updateDoc, getDoc, serverTimestamp, friendlyError
} from "./firebase.js";

const $ = (id) => document.getElementById(id);
const form = $("editor");
const statusEl = $("status");
const errorEl = $("form-error");
const saveBtn = $("save-draft");
const publishBtn = $("publish");

// 수정 중인 글의 id (새 글이면 null). 주소의 ?id= 로도 열 수 있어요.
let postId = new URLSearchParams(location.search).get("id");
let wasPublished = false;
let currentUser = null;

function setStatus(text) { statusEl.textContent = text; }
function showError(msg) { errorEl.textContent = msg; errorEl.hidden = !msg; }
function busy(on) { saveBtn.disabled = on; publishBtn.disabled = on; }

function readForm() {
  return {
    title: $("title").value.trim(),
    body: $("body").value,
    category: $("category").value,
    tags: $("tags").value.split(",").map((t) => t.trim().replace(/^#/, "")).filter(Boolean).slice(0, 10),
    summary: $("summary").value.trim()
  };
}

function fillForm(p) {
  $("title").value = p.title || "";
  $("body").value = p.body || "";
  $("category").value = p.category || "바이브코딩";
  $("tags").value = (p.tags || []).join(", ");
  $("summary").value = p.summary || "";
}

function nowLabel() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

async function save(status) {
  showError("");
  const data = readForm();
  if (!data.title) {
    showError("제목을 입력해 주세요.");
    $("title").focus();
    return null;
  }
  if (status === "published" && !data.body.trim()) {
    showError("발행하려면 본문을 입력해 주세요.");
    $("body").focus();
    return null;
  }

  busy(true);
  setStatus(status === "published" ? "발행하는 중…" : "저장하는 중…");
  const payload = { ...data, status, authorUid: currentUser.uid, updatedAt: serverTimestamp() };
  if (status === "published" && !wasPublished) payload.publishedAt = serverTimestamp();

  try {
    if (postId) {
      await updateDoc(doc(db, "posts", postId), payload);
    } else {
      payload.createdAt = serverTimestamp();
      const ref = await addDoc(collection(db, "posts"), payload);
      postId = ref.id;
      // 새로고침해도 같은 글을 이어서 쓰도록 주소에 id를 남겨요
      history.replaceState(null, "", `write.html?id=${encodeURIComponent(postId)}`);
    }
    if (status === "published") wasPublished = true;
    setStatus(status === "published" ? `발행됨 · ${nowLabel()}` : `임시저장됨 · ${nowLabel()}`);
    return postId;
  } catch (err) {
    setStatus("저장하지 못했어요");
    showError(friendlyError(err));
    return null;
  } finally {
    busy(false);
  }
}

async function loadPost(id) {
  try {
    const snap = await getDoc(doc(db, "posts", id));
    if (!snap.exists()) {
      showError("이 글을 찾을 수 없어요. 새 글로 시작할게요.");
      postId = null;
      history.replaceState(null, "", "write.html");
      return;
    }
    const p = snap.data();
    fillForm(p);
    wasPublished = p.status === "published";
    setStatus(wasPublished ? "발행된 글 수정 중" : "임시저장된 글 수정 중");
    if (wasPublished) {
      $("view-link").href = `../post.html?id=${encodeURIComponent(id)}`;
      $("view-link").hidden = false;
    }
  } catch (err) {
    showError(friendlyError(err));
  }
}

if (!isConfigured) {
  $("checking").hidden = true;
  $("config-notice").hidden = false;
} else {
  // 로그인 확인: 로그인 안 했으면 로그인 페이지로
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      location.replace("login.html?next=write.html");
      return;
    }
    currentUser = user;
    $("who").textContent = user.email || "";
    $("checking").hidden = true;
    form.hidden = false;
    if (postId) await loadPost(postId);
    $("title").focus();
  });

  saveBtn.addEventListener("click", () => save("draft"));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = await save("published");
    if (id) location.href = `../post.html?id=${encodeURIComponent(id)}`;
  });

  $("logout").addEventListener("click", async () => {
    await signOut(auth);
    location.replace("login.html");
  });
}
