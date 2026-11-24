import { auth, isConfigured, onAuthStateChanged, signInWithEmailAndPassword, friendlyError, markAdminBrowser } from "./firebase.js";

const form = document.getElementById("login-form");
const email = document.getElementById("email");
const password = document.getElementById("password");
const btn = document.getElementById("login-btn");
const errorBox = document.getElementById("login-error");
const toggle = document.getElementById("toggle-pw");

// 로그인 후 이동할 곳: 정해진 관리자 페이지만 허용 (다른 사이트로 보내는 링크 악용 방지)
const ALLOWED_NEXT = ["write.html", "posts.html", "requests.html", "works.html", "work.html"];
const nextParam = new URLSearchParams(location.search).get("next");
const next = ALLOWED_NEXT.includes(nextParam) ? nextParam : "posts.html";

toggle.addEventListener("click", () => {
  const show = password.type === "password";
  password.type = show ? "text" : "password";
  toggle.textContent = show ? "숨기기" : "보기";
  toggle.setAttribute("aria-pressed", String(show));
});

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.hidden = !msg;
}

if (!isConfigured) {
  document.getElementById("config-notice").hidden = false;
  [email, password, btn].forEach((el) => { el.disabled = true; });
} else {
  // 이미 로그인돼 있으면 바로 글쓰기로
  onAuthStateChanged(auth, (user) => {
    if (user) { markAdminBrowser(); location.replace(next); }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    showError("");
    if (!email.value.trim() || !password.value) {
      showError("이메일과 비밀번호를 모두 입력해 주세요.");
      return;
    }
    btn.disabled = true;
    btn.textContent = "로그인 중…";
    try {
      await signInWithEmailAndPassword(auth, email.value.trim(), password.value);
      markAdminBrowser();
      location.replace(next);
    } catch (err) {
      showError(friendlyError(err));
      btn.disabled = false;
      btn.textContent = "로그인";
    }
  });
}
