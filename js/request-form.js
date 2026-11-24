// 의뢰 저장 (v0.2 의뢰 기능) — 의뢰 폼을 낼 때 Firestore `requests`에 먼저 저장하고, 원래대로 FormSubmit 메일을 보내요.
// 원칙: 저장은 접수를 절대 막지 않아요. 실패하거나 3초를 넘기면 저장 없이 메일만 보내요.
// 이름 · 이메일은 여기서 Firestore에만 저장해요 (GA · AI로는 보내지 않음). 읽기는 관리자만 (firestore.rules).
import { db, isConfigured, collection, doc, setDoc, serverTimestamp } from "./firebase.js";

const SAVE_TIMEOUT_MS = 3000;
const MAX_CONTENT = 3000; // firestore.rules · functions/analyze.js와 같은 값
const CATEGORIES = ["브랜딩", "UI/UX 디자인", "콘텐츠 제작", "기타"];

const form = document.getElementById("request-form");

// 폼 값을 저장할 모양으로 모아요 (보안 규칙과 같은 필드만)
export function collectRequest(f) {
  const val = (name) => (f.querySelector(`[name="${name}"]`)?.value || "").trim();
  return {
    name: val("이름").slice(0, 50),
    email: val("email").slice(0, 100),
    categories: [...f.querySelectorAll('input[name="의뢰분야"]:checked')]
      .map((x) => x.value).filter((v) => CATEGORIES.includes(v)),
    budget: val("예산").slice(0, 50),
    content: val("프로젝트 내용").slice(0, MAX_CONTENT),
    status: "new",
    // F2 의뢰서 (PRD v1.2): 희망 일정 · 레퍼런스 (선택)
    schedule: val("희망 일정").slice(0, 50),
    refWorks: [...f.querySelectorAll('input[name="레퍼런스 작업"]:checked')].map((x) => x.value.slice(0, 60)).slice(0, 5),
    refLinks: ["레퍼런스 링크 1", "레퍼런스 링크 2", "레퍼런스 링크 3"].map(val).filter((u) => /^https?:\/\/\S+$/.test(u)).map((u) => u.slice(0, 300)),
  };
}

// 정해진 시간 안에 끝나지 않으면 실패로 봐요
function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);
}

// 저장 성공 시 문서 ID, 실패 시 null
export async function saveRequest(data) {
  if (!isConfigured || !db) return null;
  const ref = doc(collection(db, "requests")); // ID를 먼저 받아 메일에도 같이 실어요
  try {
    await withTimeout(setDoc(ref, { ...data, createdAt: serverTimestamp() }), SAVE_TIMEOUT_MS);
    return ref.id;
  } catch {
    return null; // 원인은 화면에 띄우지 않아요 — 메일은 그대로 가요
  }
}

// 메일에 의뢰번호를 담는 숨은 칸 (name이 있어야 메일에 담겨요)
function setRequestId(f, id) {
  let input = f.querySelector('input[name="의뢰번호"]');
  if (!input) {
    input = document.createElement("input");
    input.type = "hidden";
    input.name = "의뢰번호";
    f.appendChild(input);
  }
  input.value = id;
}

// PRD v1.1 F3 의뢰 버튼: 작업 상세의 "이런 작업 의뢰하기"로 오면 ?category= 분야를 자동 선택해요 (허용된 분야만)
export function preselectCategory(f, search) {
  const cat = new URLSearchParams(search).get("category");
  if (!cat || !CATEGORIES.includes(cat)) return false;
  f.querySelectorAll('input[name="의뢰분야"]').forEach((x) => { x.checked = x.value === cat; });
  return true;
}

// ---- 의뢰서 입력 확인 (프로토타입과 같은 규칙) ----
export function checkName(v) {
  v = String(v || "").trim();
  if (!v) return "이름을 적어주세요.";
  if (/[\u3131-\u3163\u1100-\u11FF]/.test(v)) return "자음이나 모음만으로는 이름을 확인할 수 없어요. 올바른 이름을 적어주세요.";
  if (!/^[가-힣A-Za-z][가-힣A-Za-z .'-]*$/.test(v)) return "이름은 한글이나 영어로만 적어주세요. 숫자와 기호는 쓸 수 없어요.";
  if (v.replace(/[^가-힣A-Za-z]/g, "").length < 2) return "이름을 두 글자 이상 적어주세요.";
  return "";
}
export function checkEmail(v) {
  v = String(v || "").trim();
  if (!v) return "이메일을 적어주세요.";
  if (!v.includes("@")) return "이메일에 @가 빠졌어요. name@example.com 형식으로 적어주세요.";
  if (/\s/.test(v) || /\.\./.test(v) || !/^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/.test(v)) return "이메일 주소를 name@example.com 형식으로 적어주세요.";
  return "";
}
export function checkLink(v) {
  v = String(v || "").trim();
  return /^https?:\/\/[^\s/$.?#][^\s.]*\.[^\s]{2,}$/i.test(v) ? "" : "링크는 https://로 시작하는 주소로 적어주세요.";
}
function setErr(f, key, msg, inputName) {
  const p = f.querySelector(`#err-${key}`); if (p) p.textContent = msg;
  const inp = inputName && f.querySelector(`[name="${inputName}"]`);
  if (inp) { if (msg) inp.setAttribute("aria-invalid", "true"); else inp.removeAttribute("aria-invalid"); }
}
// 제출 전 확인: 틀린 칸이 있으면 안내하고 첫 칸으로 이동, 통과하면 true
export function validateRequest(f) {
  const errs = {
    content: val2(f, "프로젝트 내용") ? "" : "필요한 것을 적어주세요.",
    name: checkName(val2(f, "이름")),
    email: checkEmail(val2(f, "email")),
  };
  setErr(f, "content", errs.content, "프로젝트 내용");
  setErr(f, "name", errs.name, "이름");
  setErr(f, "email", errs.email, "email");
  const bad = Object.entries(errs).filter(([, m]) => m);
  const alert = f.querySelector("#rq-alert");
  if (alert) alert.textContent = bad.length ? `확인이 필요한 칸이 ${bad.length}개 있어요.` : "";
  if (bad.length) {
    const first = { content: "프로젝트 내용", name: "이름", email: "email" }[bad[0][0]];
    f.querySelector(`[name="${first}"]`)?.focus();
  }
  return !bad.length;
}
const val2 = (f, name) => (f.querySelector(`[name="${name}"]`)?.value || "").trim();

// 분야 칩 · 작업 카드: 체크 상태를 모양(.on)에 반영
export function syncChips(f) {
  f.querySelectorAll(".rq-chip, .rq-work").forEach((l) => { const i = l.querySelector("input"); l.classList.toggle("on", !!(i && i.checked)); });
}

// 링크 붙이기: 목록으로 보여 주고, 숨은 칸(레퍼런스 링크 1~3)에 담아 메일 · 저장에 함께 보내요
const MAX_LINKS = 3;
let links = [];
// 닫기(X) 선 아이콘 — innerHTML 없이 만들어요
function xIcon() {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  for (const [k, v] of Object.entries({ width: 14, height: 14, viewBox: "0 0 14 14", fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round", "aria-hidden": "true" })) svg.setAttribute(k, v);
  const path = document.createElementNS(NS, "path"); path.setAttribute("d", "M3 3l8 8M11 3l-8 8");
  svg.appendChild(path); return svg;
}
function renderLinks(f) {
  const ul = f.querySelector("#link-list"); if (!ul) return;
  ul.replaceChildren(...links.map((u, i) => {
    const li = document.createElement("li"); li.textContent = u;
    const b = document.createElement("button"); b.type = "button"; b.setAttribute("aria-label", "링크 삭제");
    b.appendChild(xIcon());
    b.addEventListener("click", () => { links.splice(i, 1); renderLinks(f); });
    li.appendChild(b); return li;
  }));
  [1, 2, 3].forEach((n) => { const h = f.querySelector(`[name="레퍼런스 링크 ${n}"]`); if (h) h.value = links[n - 1] || ""; });
}
function addLink(f) {
  const inp = f.querySelector("#link-in"); const v = (inp?.value || "").trim();
  let err = v ? checkLink(v) : "링크를 붙여넣어 주세요.";
  if (!err && links.length >= MAX_LINKS) err = `링크는 ${MAX_LINKS}개까지 붙일 수 있어요.`;
  setErr(f, "link", err);
  if (err) { inp?.focus(); return; }
  links.push(v.slice(0, 300)); inp.value = ""; renderLinks(f);
}

// ---- 사진 첨부 (최대 3장): FormSubmit 메일에 첨부로 가요. Firestore에는 저장하지 않아요 ----
// 메일이 무겁지 않게 긴 변 1600px JPEG로 줄여서 붙여요 (줄이기 실패하면 원본, 원본이 10MB를 넘으면 빼요)
const MAX_PHOTOS = 3;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
let photos = []; // File[]
function shrinkPhoto(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.naturalWidth * scale)); c.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = c.getContext("2d"); ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, c.width, c.height);
      ctx.imageSmoothingQuality = "high"; ctx.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((b) => resolve(b && b.size < file.size ? new File([b], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" }) : file), "image/jpeg", 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}
function syncPhotoInput(f) {
  const input = f.querySelector("#photo-in"); if (!input) return;
  try { const dt = new DataTransfer(); photos.forEach((p) => dt.items.add(p)); input.files = dt.files; } catch { /* 오래된 브라우저: 고른 그대로 보내요 */ }
}
function renderPhotos(f) {
  const ul = f.querySelector("#photo-list"); if (!ul) return;
  ul.replaceChildren(...photos.map((p, i) => {
    const li = document.createElement("li");
    const img = document.createElement("img"); img.alt = `첨부 사진 ${i + 1}`;
    const url = URL.createObjectURL(p); img.src = url; img.onload = () => URL.revokeObjectURL(url);
    const b = document.createElement("button"); b.type = "button"; b.setAttribute("aria-label", `첨부 사진 ${i + 1} 빼기`);
    b.appendChild(xIcon());
    b.addEventListener("click", () => { photos.splice(i, 1); syncPhotoInput(f); renderPhotos(f); setErr(f, "photo", ""); });
    li.append(img, b); return li;
  }));
  const add = f.querySelector(".rq-photo-add"); if (add) add.hidden = photos.length >= MAX_PHOTOS;
}
async function addPhotos(f, fileList) {
  const picked = [...fileList];
  let err = "";
  const imgs = picked.filter((x) => /^image\//.test(x.type));
  if (imgs.length < picked.length) err = "사진 파일만 첨부할 수 있어요.";
  const room = MAX_PHOTOS - photos.length;
  if (imgs.length > room) err = `사진은 ${MAX_PHOTOS}장까지 첨부할 수 있어요.`;
  for (const file of imgs.slice(0, Math.max(0, room))) {
    const small = await shrinkPhoto(file);
    if (small.size > MAX_PHOTO_BYTES) { err = "10MB가 넘는 사진은 뺐어요."; continue; }
    photos.push(small);
  }
  syncPhotoInput(f); renderPhotos(f); setErr(f, "photo", err);
}

if (form) {
  preselectCategory(form, location.search);
  form.querySelector("#photo-in")?.addEventListener("change", (e) => {
    const files = [...e.target.files];
    // 고른 파일은 목록(photos)으로 옮기고, 실제 보낼 파일은 syncPhotoInput이 다시 채워요
    addPhotos(form, files.filter((x) => !photos.includes(x)));
  });
  syncChips(form);
  form.addEventListener("change", () => syncChips(form));
  form.querySelector("#link-add")?.addEventListener("click", () => addLink(form));
  form.querySelector("#link-in")?.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addLink(form); } });
  // 칸을 떠날 때 바로 확인
  form.querySelector('[name="이름"]')?.addEventListener("blur", (e) => { if (e.target.value.trim()) setErr(form, "name", checkName(e.target.value), "이름"); });
  form.querySelector('[name="email"]')?.addEventListener("blur", (e) => { if (e.target.value.trim()) setErr(form, "email", checkEmail(e.target.value), "email"); });
  let sending = false;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (sending) return; // 두 번 눌러도 한 번만
    if (!validateRequest(form)) {
      // GA: 보내기 실패(입력 확인) — 칸 이름 · 내용은 보내지 않고 개수만
      const n = form.querySelectorAll('[aria-invalid="true"]').length;
      if (typeof window.trackEvent === "function") window.trackEvent("form_error", { form_id: "request", reason: "validation", error_count: n });
      return;
    }
    // GA: 입력 확인을 통과해 실제로 보낼 때만 (분야 · 예산 구간만, 개인 정보 없음)
    if (typeof window.trackEvent === "function") {
      const types = [...form.querySelectorAll('input[name="의뢰분야"]:checked')].map((x) => x.value).join(",");
      const budget = form.querySelector('select[name="예산"]');
      window.trackEvent("form_submit", { form_id: "request", request_types: types || "미선택", budget_range: (budget && budget.value) || "미선택" });
    }
    sending = true;
    const btn = form.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = true; btn.setAttribute("aria-busy", "true"); btn.dataset.label = btn.textContent; btn.textContent = "보내는 중…"; }

    const honey = form.querySelector('input[name="_honey"]');
    if (!(honey && honey.value)) { // 스팸 방지 칸이 채워졌으면 저장하지 않아요
      const id = await saveRequest(collectRequest(form));
      if (id) setRequestId(form, id);
    }
    // form.submit()은 submit 이벤트를 다시 일으키지 않아요 (GA form_submit도 한 번만)
    HTMLFormElement.prototype.submit.call(form);
  });

  // 완료 페이지에서 뒤로 오면 버튼을 다시 살려요 (브라우저가 페이지를 그대로 복원하는 경우)
  window.addEventListener("pageshow", () => {
    sending = false;
    const btn = form.querySelector('button[type="submit"]');
    if (btn && btn.disabled) { btn.disabled = false; btn.removeAttribute("aria-busy"); btn.textContent = btn.dataset.label || btn.textContent; }
  });
}
