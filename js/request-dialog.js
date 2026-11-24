// 의뢰서 창 (프로토타입): '의뢰 문의하기' · '#request' 링크를 누르면 의뢰서가 창(dialog)으로 떠요.
// Firebase 없이 동작하도록 따로 둔 파일이에요 — Firebase가 늦거나 막혀도 창은 열려요. 전송은 js/request-form.js.
const form = document.getElementById("request-form");
const dialog = document.getElementById("request-dialog");
export function openRequest() {
  if (!dialog) return;
  if (!dialog.open) { if (dialog.showModal) dialog.showModal(); else dialog.setAttribute("open", ""); }
  form?.querySelector('[name="프로젝트 내용"]')?.focus();
}
function closeRequest() { if (dialog?.open) { if (dialog.close) dialog.close(); else dialog.removeAttribute("open"); } }
if (dialog) {
  document.getElementById("open-request")?.addEventListener("click", openRequest);
  document.getElementById("close-request")?.addEventListener("click", closeRequest);
  dialog.addEventListener("click", (e) => { if (e.target === dialog) closeRequest(); }); // 바깥(어두운 곳) 누르면 닫기
  document.querySelectorAll('a[href="#request"]').forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); openRequest(); }));
  // 작업 상세의 '이런 작업 의뢰하기'(index.html?category=…#request)로 오면 바로 띄워요
  if (location.hash === "#request") { document.getElementById("request")?.scrollIntoView(); openRequest(); }
}

