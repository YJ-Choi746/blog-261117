// 의뢰 저장 (PRD F3) — 의뢰 폼을 낼 때 Firestore `requests`에 먼저 저장하고, 원래대로 FormSubmit 메일을 보내요.
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

if (form) {
  let sending = false;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (sending) return; // 두 번 눌러도 한 번만
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
