# CLAUDE.md — 코드 개발 지침

이 저장소에서 Claude Code가 지킬 규칙이에요.

## 프로젝트 한 줄 소개
웹·앱 디자이너의 블로그 겸 프리랜서 의뢰 페이지. 바이브코딩 수업을 들으며 만들고 있어요.

- 사이트 주소: https://yj-choi746.github.io/blog-261117/
- 디자인 시안 캔버스: https://claude.ai/artifact/4WLPHZ2fxuUN4uYXBvdAvE (시안 06 결합안 + 블로그 화면 5종)

## 파일 구조
```
index.html          첫 화면 (소개 · 서비스 · 작업 · 기록 · 의뢰 폼)
thanks.html         의뢰 폼 전송 후 보여주는 완료 페이지
.nojekyll           GitHub Pages가 파일을 가공하지 않게 하는 빈 파일
CLAUDE.md           이 문서
docs/design-system.md   색 · 글꼴 · 간격 · 컴포넌트 규칙
docs/decisions.md       정한 것들 (날짜순)
docs/failures/*.md      막혔던 일과 푼 방법 (주제별)
```

## 기술 규칙
- 빌드 도구 없이 **HTML + CSS만** 써요. 프레임워크·npm 패키지를 추가하려면 먼저 물어보세요.
- 외부 리소스는 Google Fonts만 써요 (Noto Sans KR, Noto Serif KR).
- 모든 화면은 휴대폰 폭(360px)에서도 가로 스크롤 없이 보여야 해요. 고정 px 너비 대신 `max-width`, `auto-fit` 그리드, `clamp()`를 써요.

## 디자인 규칙
- 색 · 글꼴 · 버튼 모양은 **반드시 `docs/design-system.md`를 따라요.** 새 색이나 새 글꼴을 만들지 마세요.
- 디자인 시스템을 바꾸는 변경이면 `docs/design-system.md`도 같이 고쳐요.
- 눌리는 요소(버튼, 링크 버튼, 체크박스 라벨)는 높이 44px 이상.
- 글자와 배경의 명암 대비는 4.5:1 이상. 블루 배경 위 글씨는 흰색만 써요.
- 아이콘은 이모지 대신 선 SVG를 써요.

## 의뢰 폼 규칙
- 폼은 FormSubmit(`https://formsubmit.co/...`)로 이메일을 보내요.
- **받는 이메일 주소(form `action`)는 사용자에게 묻지 않고 바꾸지 마세요.**
- 입력칸을 추가하면 꼭 `name` 속성을 붙여요. `name`이 없으면 메일에 안 담겨요.

## 배포 규칙
- `main`에 커밋한 뒤 `main`과 `gh-pages` 두 브랜치에 모두 푸시해요.
  ```bash
  git push origin main && git push origin main:gh-pages
  ```
- 커밋·푸시는 사용자가 요청했을 때만 해요.
- 비밀번호, 토큰, API 키는 절대 커밋하지 않아요.

## 문서 규칙
- 무언가를 **정하면** `docs/decisions.md`에 날짜와 함께 한 줄 추가해요.
- 무언가에 **막혔다 풀면** `docs/failures/<주제>.md`에 증상 · 원인 · 해결을 적어요. 같은 주제 파일이 있으면 거기에 이어 써요.
- 사용자에게는 한국어로, 쉬운 말로 설명해요.
