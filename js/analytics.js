// Google Analytics 4 — 방문자 통계
// 측정 ID는 Firebase 프로젝트(blog---261117)에 연결된 GA4 속성이에요 (js/firebase-config.js의 measurementId와 같아요).
// - 방문자용 페이지에만 넣어요. 관리자 화면(/admin/)은 집계하지 않아요.
// - <html data-ga-defer>인 페이지(글 상세)는 글 제목을 불러온 뒤 직접 page_view를 보내요 (js/post.js).
// 지역 · 기기 · OS · 브라우저 · 유입 경로는 GA가 자동으로 모아요.
(function () {
  var ID = "G-04G5123MB7";
  if (/\/admin\//.test(location.pathname)) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  var deferred = document.documentElement.hasAttribute("data-ga-defer");
  window.gtag("config", ID, { send_page_view: !deferred });

  var s = document.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtag/js?id=" + ID;
  document.head.appendChild(s);
})();

// 글 상세 등에서 쓰는 도우미: GA가 없거나 막혀 있어도 오류 없이 지나가요
window.trackEvent = function (name, params) {
  try { if (typeof window.gtag === "function") window.gtag("event", name, params || {}); } catch (e) { /* 통계 실패는 무시 */ }
};
