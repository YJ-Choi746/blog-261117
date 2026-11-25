// 평가자 보기 전용 (2026-11-25 17:00 KST까지, D39) — 관리자 화면을 둘러볼 수만 있어요.
// 실제 권한은 firestore.rules의 isViewer()가 지켜요(읽기만, 의뢰 · 메모 제외). 여기서는 안내 띠와 버튼 잠금만 해요.
export const VIEWER_EMAIL = "evaluator@example.com";
export const VIEWER_UNTIL = Date.parse("2026-11-25T17:00:00+09:00");

export const isViewer = (user) => !!user && user.email === VIEWER_EMAIL;

// 관리자 화면에서 호출: 평가자면 안내 띠를 붙이고 저장 · 게시 · 삭제 버튼을 잠가요. 시간이 지나면 로그아웃
export function applyViewerMode(user, signOutFn) {
  if (!isViewer(user)) return false;
  if (Date.now() >= VIEWER_UNTIL) {
    signOutFn?.().finally(() => location.replace("login.html"));
    return true;
  }
  document.body.classList.add("is-viewer");
  const bar = document.createElement("p");
  bar.className = "viewer-bar"; bar.setAttribute("role", "status");
  bar.textContent = "평가자 보기 전용 계정이에요 · 화면을 둘러볼 수만 있고 저장 · 게시 · 삭제는 막혀 있어요 · 의뢰 목록과 작업 메모는 개인정보 보호로 숨겼어요 · 오늘 17:00까지";
  document.body.prepend(bar);
  const lock = () => document.querySelectorAll("#save, #publish, #unpublish, #cat-save, #sns-copy, [data-write], .post-delete, .btn-danger").forEach((b) => { b.disabled = true; b.title = "평가자 보기에서는 쓸 수 없어요"; });
  lock(); new MutationObserver(lock).observe(document.body, { childList: true, subtree: true });
  return true;
}
