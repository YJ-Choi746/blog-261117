# 디자인 시스템

your.name 블로그의 공통 디자인 규칙이에요. 새 화면이나 섹션을 만들 때 여기 있는 값만 써요.
기준 화면: 시안 06 결합안, 블로그 화면 5종 (https://claude.ai/artifact/4WLPHZ2fxuUN4uYXBvdAvE)
디자인 시스템 아티팩트: https://claude.ai/artifact/9fFNM9rcdWzavxsyPd68KN — 이 문서와 같은 내용이에요. 하나를 바꾸면 다른 하나도 고쳐요.

**분위기**: 깔끔한 에디토리얼. 흰 바탕에 큰 명조 제목, 얇은 선, 블루 포인트 한 가지.

---

## 1. 색

| 이름 | 값 | 쓰는 곳 |
|---|---|---|
| Blue (메인) | `#2F6BEA` | 포인트 글자, 주요 버튼, 견적서·CTA 배경 |
| Black | `#111111` | 본문 글자, 검정 버튼, 굵은 구분선 |
| White | `#FFFFFF` | 페이지 배경, 블루 위 글자 |
| Gray 700 | `#3A3A3A` | 긴 설명 글 |
| Gray 600 | `#5F5F5F` | 날짜, 보조 글, 작은 라벨 |
| Gray 500 | `#6B6B6B` | 이미지 자리 안내 글 |
| Line | `#E5E5E5` | 얇은 구분선 |
| Line Strong | `#D0D0D0` | 테두리 버튼, 입력칸 테두리 |
| Surface | `#F2F2F0` | 이미지 자리, 빈 카드 |
| Surface Admin | `#F7F7F5` | 관리자 화면 배경 |
| Blue Line | `#82A6F2` | 블루 배경 위 구분선 |
| Blue Border | `#A9C3F7` | 블루 배경 위 입력칸 테두리 |
| Blue Placeholder | `#DCE7FD` | 블루 배경 위 입력칸 예시 문구 |
| Blue Tint | `#E8EFFD` / 글자 `#1F4FB8` | 작은 배지 (예: "관리자"), 안내 문구 상자 |
| Danger | `#B42318` | 오류 문구 글자 (로그인 실패, 저장 실패). 오류에만 써요 |
| Danger Tint | `#FDECEA` | 오류 문구 상자 배경 (그 위 Danger 5.8:1) |

**규칙**
- 블루는 한 화면에서 포인트로만 써요. 넓은 면은 견적서·CTA 띠에만.
- 블루 배경 위 글씨는 **흰색만** 써요. 회색 글씨는 안 보여요.
- 명암 대비 4.5:1 이상을 지켜요. `#2F6BEA` 글씨는 흰 배경에서 13px 이상만.

---

## 2. 글꼴

| 용도 | 글꼴 | 굵기 |
|---|---|---|
| 제목, 로고, 번호, 인용 | Noto Serif KR | 700 (제목) / 500 |
| 본문, 버튼, 라벨 | Noto Sans KR | 400 · 500 · 700 |
| 코드 | JetBrains Mono | 400 |

```html
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&family=Noto+Serif+KR:wght@500;700&display=swap" rel="stylesheet">
```

| 단계 | 크기 | 행간 | 예 |
|---|---|---|---|
| Display | `clamp(44px, 7vw, 96px)` | 1.15 | 첫 화면 큰 제목 |
| H1 (페이지) | `clamp(44px, 6vw, 80px)` | 1.15 | "기록" |
| H1 (글) | `clamp(34px, 4.6vw, 54px)` | 1.25 | 글 상세 제목 |
| H2 (섹션) | 40px | 1.3 | "선택한 작업", "기록" |
| H2 (CTA) | `clamp(36px, 4.5vw, 56px)` | 1.2 | "함께 만들어요." |
| H3 / 카드 제목 | 26px · 22px · 18px | 1.4 | 서비스, 목록, 작업 |
| 본문 | 16px (글 상세 18px) | 1.6 (글 1.85) | |
| 작은 글 | 14px · 13px | | 날짜, 카테고리 |
| 상단 라벨 | 13px, 자간 0.16em, 대문자 | | "BRANDING · UI/UX · CONTENT DESIGN" |

---

## 3. 간격 · 레이아웃

- 콘텐츠 최대 너비 **1200px**, 좌우 여백 **24px** (관리자 화면 1280px, 글 본문 760px).
- 섹션 위아래 여백: 96~120px (큰 섹션), 48px (서비스 칸).
- 간격 단위: 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64px.
- 그리드: `repeat(auto-fit, minmax(280~320px, 1fr))` — 휴대폰에서 자동으로 한 줄씩 쌓여요.
- 구분선: 섹션 경계는 `1px #E5E5E5`, 목록 맨 위는 `1px #111111`.

---

## 4. 모서리 · 크기

| 요소 | 값 |
|---|---|
| 버튼 · 필터 · 태그 | `border-radius: 999px` (알약 모양) |
| 입력칸 | 8~10px |
| 카드 (관리자) | 16px |
| 코드 블록 | 12px |
| 이미지 자리 | 0 (각진 모서리) |
| 눌리는 요소 최소 높이 | **44px** |

---

## 5. 컴포넌트

**헤더**: 왼쪽 로고(Noto Serif KR 700, 22px) · 오른쪽 메뉴(15px, 간격 28px) + 검정 알약 버튼 "프로젝트 의뢰". 아래 `1px #E5E5E5`.

**버튼**
| 종류 | 모양 |
|---|---|
| 주요 | 배경 `#2F6BEA`, 흰 글자, 패딩 14px 24px, 알약 |
| 검정 | 배경 `#111111`, 흰 글자, 알약 |
| 테두리 | 테두리 `1px #111111`, 검정 글자, 알약 |
| 블루 위 버튼 | 배경 흰색, 검정 글자 700, 알약 |

**카테고리 필터**: 높이 44px, 패딩 0 16px, 14px. 선택됨 = 검정 배경·흰 글자, 기본 = `1px #D0D0D0` 테두리.

**서비스 칸**: 3칸 그리드, 칸 사이 `1px #E5E5E5` 세로선. 번호(명조, 블루) → 제목(26px 700) → 설명(Gray 600).

**작업 카드**: 이미지 16:11, 카드 사이 간격 48px. 아래 제목(18px) + 오른쪽 분류(블루 14px).

**기록 목록 한 줄**: 3칸 그리드 `날짜 | 제목(22px 500) | 카테고리(블루 13px)`, 위아래 패딩 28px, 아래 `1px #E5E5E5`.

**견적서 (의뢰 폼)**: 블루 배경, 왼쪽 제목 + 4단계 프로세스, 오른쪽 폼. 입력칸 배경 투명, 테두리 `#A9C3F7`, 글자 흰색, 높이 48px.

**푸터**: 14px Gray 600, 왼쪽 © · 오른쪽 링크. 페이지 전체를 세로 flex로 두고 푸터에 `flex: 1 0 auto; min-height: 72px; align-items: center`를 줘서, 아래 남는 흰 공간을 채우고 글자를 세로 가운데에 둬요.

---

## 6. 접근성 체크리스트

- [ ] 눌리는 요소 44px 이상
- [ ] 글자 대비 4.5:1 이상 (큰 제목 3:1)
- [ ] 버튼은 `<button>`, 이동은 `<a href>`, 입력칸에는 `<label>`
- [ ] 아이콘만 있는 버튼엔 `aria-label`
- [ ] 휴대폰 폭에서 가로 스크롤 없음

---

## 7. 토큰 이름 (아티팩트와 같은 이름)

| 토큰 | 값 | | 토큰 | 값 |
|---|---|---|---|---|
| `blue` | `#2F6BEA` | | `line` | `#E5E5E5` |
| `black` | `#111111` | | `line-strong` | `#D0D0D0` |
| `white` | `#FFFFFF` | | `surface` | `#F2F2F0` |
| `gray-700` | `#3A3A3A` | | `surface-admin` | `#F7F7F5` |
| `gray-600` | `#5F5F5F` | | `blue-line` | `#82A6F2` |
| `gray-500` | `#6B6B6B` | | `blue-border` | `#A9C3F7` |
| `blue-tint` | `#E8EFFD` | | `blue-placeholder` | `#DCE7FD` |
| `blue-tint-ink` | `#1F4FB8` | | `danger` | `#B42318` |
| | | | `danger-tint` | `#FDECEA` |

- 간격: `space-4` `8` `12` `16` `20` `24` `32` `48` `64` `96` `120`
- 모서리: `radius-none` 0 · `radius-input` 8 · `radius-field` 10 · `radius-code` 12 · `radius-card` 16 · `radius-pill` 999
- 크기: `touch-min` 44 · `input-height` 48 · `container` 1200 · `container-article` 760 · `footer-min` 72
- 글꼴 묶음: `serif`(Noto Serif KR) · `sans`(Noto Sans KR) · `mono`(JetBrains Mono)

## 8. 컴포넌트 목록 (아티팩트에 미리보기 있음)

Button · FilterChip · ServiceColumn · WorkCard · PostRow · RequestForm · Footer

## 9. 글 본문 꾸미기 (에디터에서 고를 수 있는 것)

사이트 화면(제목·메뉴·버튼)은 위 규칙만 써요. **글 본문 안**에서만 아래 목록을 쓸 수 있어요. 목록은 `js/sanitize.js`에 있고, 여기 없는 것은 저장할 때 지워져요.

- **글꼴 6가지**: 기본 고딕(Noto Sans KR) · 명조(Noto Serif KR) · 나눔고딕 · 나눔명조 · 고운돋움 · 나눔손글씨 펜
- **크기 7단계**: 13 · 15 · 17(기본) · 19 · 24 · 30 · 38px
- **글자 색 9가지**: `#111111` `#5F5F5F` `#2F6BEA`(blue) `#1F4FB8` `#B42318` `#C2410C` `#2B8A3E` `#6741D9` `#FFFFFF`
- **배경 색(형광펜) 5가지**: `#FFF3BF` `#D3F9D8` `#E8EFFD` `#FFE3E3` `#F3F0FF`
- **사진 크기**: 크게(100%) · 중간(66%) · 작게(40%), 가운데 정렬
- 본문 기본: 17px, 줄 간격 1.85, 소제목 명조 28px, 인용구 blue 왼쪽 선
