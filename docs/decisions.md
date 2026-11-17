# 의사결정 기록

정한 것을 날짜와 함께 적어요. 새 결정은 맨 아래에 추가해요. 이전 결정을 뒤집으면 지우지 말고 "→ 변경"으로 새 줄을 써요.

## 2026-11-17

- **사이트 성격**: 디자인·콘텐츠 블로그이면서 프리랜서 의뢰를 받는 페이지로 정함.
- **시안**: 5종(에디토리얼 미니멀, 네온 그리드, 소프트 벤토, 데브로그 다크, 팝 컬러) 중 **01 에디토리얼**을 바탕으로 **02 네온 그리드**의 작업 이미지 배치를 합친 **시안 06 결합안**으로 정함.
- **서비스 3가지**: 01 브랜딩 · 02 UI/UX 디자인 · 03 콘텐츠 제작.
- **선택한 작업 이미지**: 세 장 모두 같은 크기(16:11)로 통일.
- **작업 프로세스**: 별도 섹션을 없애고 견적서(의뢰 폼) 안에 4단계로 통합.
- **견적서 섹션 제목**: "함께 만들어요."
- **색상**: 블루 `#2F6BEA` · 블랙 `#111111` · 화이트 `#FFFFFF` 세 가지. 처음엔 짙은 블루 `#1F45B5`였다가 → 레퍼런스 이미지에 맞춰 밝은 로열 블루 `#2F6BEA`로 변경.
- **배경색**: 옅은 크림색 `#FBF8F1`을 시도했다가 → 흰색으로 되돌림.
- **견적서 배경**: 블루. 그 위 글씨와 입력칸 예시 문구는 흰색·연한 하늘색으로 밝게.
- **기록 필터 버튼 높이**: 34px로 줄였다가 → 휴대폰 터치 기준에 맞춰 44px로 유지.
- **배포**: GitHub Pages로 정함. 저장소 `YJ-Choi746/blog-261117`, `main`과 `gh-pages` 브랜치에 같은 파일을 올림.
- **의뢰 폼 전송**: 무료 서비스 FormSubmit으로 Gmail에 받기로 정함. 전송 후 `thanks.html`로 이동.
- **블로그 화면 5종**: 첫 화면 · 글 목록 · 글 상세 · 글쓰기 · 관리자 로그인을 Claude 아티팩트 캔버스에 클릭 가능한 시안으로 만듦. 실제 로그인·글 저장 기능은 아직 없음.
- **첫 화면 헤딩 위 문구**: "WEB · APP · CONTENT DESIGN" → "BRANDING · UI/UX · CONTENT DESIGN"으로 변경 (서비스 이름과 맞춤).
- **문서 체계**: `CLAUDE.md`(개발 지침), `docs/decisions.md`(결정), `docs/failures/`(실패 로그), `docs/design-system.md`(디자인 시스템) 4가지로 정함.
- **푸터**: 고정 높이 대신 페이지 아래 남는 흰 공간을 채우고(최소 72px), © 문구와 링크를 세로 가운데 정렬. 첫 화면 · 글 목록 · 글 상세 · 배포 사이트에 적용.
- **화면 2 · 3 높이**: 글 목록 2200 → 2016px, 글 상세 2900 → 2501px. 내용 길이에 맞춰서 푸터 여백이 첫 화면과 같게(약 80px).
- **디자인 시스템 아티팩트**: 공통 요소를 claude.ai 디자인 시스템 아티팩트 "your.name 디자인 시스템"으로 저장 (https://claude.ai/artifact/9fFNM9rcdWzavxsyPd68KN). 색 15 · 글자 스타일 15 · 간격 11 · 모서리 6 · 크기 5개 토큰과 컴포넌트 7종(Button, FilterChip, ServiceColumn, WorkCard, PostRow, RequestForm, Footer). 테마는 라이트 하나.
- **디자인 시스템 관리 방식**: `docs/design-system.md`와 아티팩트를 같은 내용으로 유지. 하나를 바꾸면 둘 다 고침.
- **US-01 "관리자는 로그인 후 글을 직접 쓸 수 있다" 시작.**
- **로그인·글 저장 서비스**: Firebase로 정함 (Authentication 이메일/비밀번호 + Firestore). Supabase, GitHub만 쓰는 방법과 비교해 GitHub Pages에서 그대로 동작하고 무료라서.
- **기술 규칙 변경**: "HTML + CSS만" → "HTML + CSS + 순수 JavaScript(ES 모듈) + Firebase SDK 10.12.2" 허용.
- **관리자 판별**: 로그인 여부가 아니라 보안 규칙의 `ADMIN_UID`로. 누구나 Firebase 계정은 만들 수 있기 때문.
- **글 데이터 구조**: `posts` 컬렉션 — title, body, category, tags[], summary, status(draft/published), authorUid, createdAt, updatedAt, publishedAt.
- **글 본문 형식**: 간단한 마크다운(##, ###, -, >, ```)을 직접 그려요. HTML은 허용하지 않음.
- **글 목록 정렬**: Firestore 복합 색인 대신 브라우저에서 날짜순 정렬.
- **새 화면 주소**: `admin/login.html`, `admin/write.html`, `posts.html`, `post.html`. 첫 화면의 "기록" 메뉴·"기록 읽기"·푸터 "관리자"를 새 화면에 연결.
- **공통 스타일 파일**: 새 화면은 `css/site.css`(디자인 시스템 토큰을 CSS 변수로)를 써요. 기존 `index.html`의 인라인 스타일은 그대로 둠.
- **오류 색 추가**: `danger` `#B42318` · `danger-tint` `#FDECEA` — 로그인·저장 오류 문구 전용. 디자인 시스템 문서와 아티팩트에 함께 추가.
- **Firebase 프로젝트**: `blog---261117`. 웹 설정값을 `js/firebase-config.js`에 넣음. SDK는 콘솔 안내(13.4.0) 대신 테스트한 10.12.2 유지, Analytics는 쓰지 않음.
- **관리자 계정**: Firebase Authentication의 관리자 계정 1개. 그 UID를 `firestore.rules`의 `isAdmin()`에 넣음. 이 계정만 글을 쓰고 고칠 수 있음.
