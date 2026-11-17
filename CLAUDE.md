# CLAUDE.md — 코드 개발 지침

이 저장소에서 Claude Code가 지킬 규칙이에요.

## 프로젝트 한 줄 소개
웹·앱 디자이너의 블로그 겸 프리랜서 의뢰 페이지. 바이브코딩 수업을 들으며 만들고 있어요.

- 사이트 주소: https://yj-choi746.github.io/blog-261117/ (GitHub Pages) · https://blog---261117.web.app (Firebase Hosting)
- 디자인 시안 캔버스: https://claude.ai/artifact/4WLPHZ2fxuUN4uYXBvdAvE (시안 06 결합안 + 블로그 화면 5종)
- 디자인 시스템 아티팩트: https://claude.ai/artifact/9fFNM9rcdWzavxsyPd68KN (색 · 글꼴 · 간격 · 컴포넌트 7종)

## 파일 구조
```
index.html          첫 화면 (소개 · 서비스 · 작업 · 기록 · 의뢰 폼)
thanks.html         의뢰 폼 전송 후 보여주는 완료 페이지
posts.html          글 목록 (발행된 글, 카테고리 필터, 관리자면 수정·삭제)
post.html           글 상세 (?id=글ID)
admin/login.html    관리자 로그인
admin/posts.html    글 관리 (공개 범위 · 보기 · 수정 · 삭제)
admin/write.html    글쓰기 에디터 (서식 · 사진 · 미리보기 · 자동 백업, ?id=로 수정)
css/site.css        공통 스타일 (디자인 시스템 토큰 = CSS 변수)
css/editor.css      에디터 · 서식 있는 본문(.rich) · 글 관리 스타일
js/firebase.js      Firebase 연결 · SDK 버전은 여기 한 곳에서만
js/firebase-config.js  Firebase 웹 설정값 (공개값)
js/sanitize.js      본문 HTML 허용 목록 정리기 + 허용 글꼴·크기·색 목록
js/editor.js        에디터 서식 도구 · 사진 넣기 · 붙여넣기
js/images.js        사진 줄이기 · Firestore images 저장 · 불러오기
js/post-actions.js  관리자 수정·삭제 버튼, 글+사진 삭제
js/home.js          첫 화면 최근 기록
js/analytics.js     Google Analytics 4 (방문자 페이지에만, 관리자 화면 제외)
js/*.js             그 밖의 페이지별 스크립트 (login, write, admin-posts, posts, post, render)
firestore.rules     Firestore 보안 규칙 (콘솔에 붙여넣음)
.nojekyll           GitHub Pages가 파일을 가공하지 않게 하는 빈 파일
CLAUDE.md           이 문서
docs/design-system.md   색 · 글꼴 · 간격 · 컴포넌트 규칙
docs/decisions.md       정한 것들 (날짜순)
docs/user-stories.md    사용자 스토리와 완료 기준
docs/firebase-setup.md  Firebase 연결 순서 (처음 한 번)
docs/analytics.md       방문자 통계(GA4) 보는 법
docs/failures/*.md      막혔던 일과 푼 방법 (주제별: 깃허브-배포, 의뢰폼-이메일, 캔버스-레이아웃, 로그인, 에디터)
```

## 기술 규칙
- 빌드 도구 없이 **HTML + CSS + 순수 JavaScript(ES 모듈)**만 써요. 프레임워크·npm 패키지를 추가하려면 먼저 물어보세요.
- 외부 리소스는 Google Fonts, **Firebase SDK**(`www.gstatic.com/firebasejs/10.12.2/`), **Google Analytics**(`www.googletagmanager.com`, `js/analytics.js`)만 써요. 새 방문자 페이지를 만들면 `<head>`에 `js/analytics.js`를 넣고, 관리자 화면에는 넣지 않아요. Firebase는 `js/firebase.js`에서만 불러오고, 다른 스크립트는 `./firebase.js`를 import해요.
- 사용자가 쓴 글의 제목·태그는 **`textContent`로만** 넣어요. 서식 있는 본문은 **반드시 `js/sanitize.js`를 거친 요소만** 넣어요. HTML 문자열을 `innerHTML`/`insertAdjacentHTML`에 넣지 않아요 (XSS).
- 본문에 새 태그·스타일·글꼴을 허용하려면 `js/sanitize.js`의 허용 목록에만 추가해요.
- 사진은 `js/images.js`로만 올리고 불러와요 (Firestore `images`, 900KB 이하로 줄여서).
- 관리자 권한은 `firestore.rules`의 관리자 UID로 지켜요. 화면에서 숨기는 것만으로는 보안이 아니에요. 규칙을 바꾸면 Firebase 콘솔에도 다시 게시해야 해요.
- `js/firebase-config.js`의 값은 공개값이라 커밋해도 돼요. 그 밖의 비밀번호·서비스 계정 키는 절대 커밋하지 않아요.
- 로그인 후 이동 주소(`?next=`)는 허용 목록에 있는 곳만 써요.
- 모든 화면은 휴대폰 폭(360px)에서도 가로 스크롤 없이 보여야 해요. 고정 px 너비 대신 `max-width`, `auto-fit` 그리드, `clamp()`를 써요.

## 디자인 규칙
- 색 · 글꼴 · 버튼 모양은 **반드시 `docs/design-system.md`를 따라요.** 새 색이나 새 글꼴을 만들지 마세요. 예외: 글 본문 꾸미기용 글꼴·색 (디자인 시스템 문서의 "글 본문 꾸미기" 목록만).
- 디자인 시스템은 **두 곳에 같은 내용**으로 있어요: `docs/design-system.md`(코드용)와 디자인 시스템 아티팩트(시안·덱용). 하나를 바꾸면 다른 하나도 같이 고쳐요.
- 색 값을 코드에 쓸 때는 디자인 시스템의 토큰 이름(`blue`, `gray-600`, `line` …)을 주석이나 CSS 변수 이름으로 남겨요.
- 푸터는 고정 `height`를 주지 않아요. 페이지 루트를 세로 flex로 두고 푸터에 `flex: 1 0 auto; min-height: 72px; align-items: center`.
- 눌리는 요소(버튼, 링크 버튼, 체크박스 라벨)는 높이 44px 이상.
- 글자와 배경의 명암 대비는 4.5:1 이상. 블루 배경 위 글씨는 흰색만 써요.
- 아이콘은 이모지 대신 선 SVG를 써요.

## 의뢰 폼 규칙
- 폼은 FormSubmit(`https://formsubmit.co/...`)로 이메일을 보내요.
- **받는 이메일 주소(form `action`)는 사용자에게 묻지 않고 바꾸지 마세요.**
- 입력칸을 추가하면 꼭 `name` 속성을 붙여요. `name`이 없으면 메일에 안 담겨요.

## 배포 규칙
- `main`에 커밋한 뒤 `main`과 `gh-pages` 두 브랜치에 모두 푸시해요. `main`에 올리면 GitHub Actions가 Firebase Hosting(`blog---261117.web.app`)에도 자동 배포해요 (`.github/workflows/firebase-hosting.yml`, 비밀 키는 GitHub Secret `FIREBASE_SERVICE_ACCOUNT`).
  ```bash
  git push origin main && git push origin main:gh-pages
  ```
- 커밋·푸시는 사용자가 요청했을 때만 해요.
- 비밀번호, 토큰, API 키는 절대 커밋하지 않아요.

## 문서 규칙
- 무언가를 **정하면** `docs/decisions.md`에 날짜와 함께 한 줄 추가해요.
- 무언가에 **막혔다 풀면** `docs/failures/<주제>.md`에 증상 · 원인 · 해결을 적어요. 같은 주제 파일이 있으면 거기에 이어 써요.
- 기능은 `docs/user-stories.md`에 스토리와 완료 기준을 먼저 적고, 기준마다 테스트 결과를 남겨요.
- 사용자에게는 한국어로, 쉬운 말로 설명해요.
