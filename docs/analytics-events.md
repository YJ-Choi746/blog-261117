# 이벤트 택소노미 (GA4)

블로그에서 GA로 보내는 **이벤트 이름 · 매개변수 · 보내는 순간**을 정한 문서예요. 새 이벤트는 이 문서에 먼저 적고 코드에 넣어요.

## 1. 측정 목표 → 질문 → 이벤트

| 비즈니스 목표 | 알고 싶은 질문 | 이벤트 |
|---|---|---|
| 블로그 글이 읽힌다 | 어떤 글이 많이 열리고, 끝까지 읽히나? | `view_post` → `read_post` |
| 글을 찾아 들어온다 | 어디(홈/목록)에서, 몇 번째 글을 눌렀나? 어떤 카테고리를 고르나? | `select_post`, `filter_posts` |
| 의뢰로 이어진다 | 의뢰 버튼을 어디서 눌렀나? 폼을 시작하고 끝까지 보냈나? | `click_cta` → `form_start` → `form_submit` → **`generate_lead`** |

**전환 깔때기 (의뢰)**: `page_view(홈)` → `click_cta` → `form_start` → `form_submit` → `generate_lead`
**콘텐츠 깔때기 (읽기)**: `select_post` → `view_post` → `read_post(50)` → `read_post(90)`

## 2. 이름 규칙

- **이벤트 이름**: 영어 소문자 `snake_case`, `동사_대상` 순서 (`view_post`, `click_cta`). 40자 이하.
- GA가 정해 둔 **추천 이벤트 이름이 있으면 그대로** 써요 (`page_view`, `generate_lead`).
- **매개변수 이름**: `snake_case`, 대상을 앞에 (`post_id`, `cta_name`, `list_name`). 같은 뜻이면 이벤트가 달라도 **같은 이름**을 써요 (`post_title`은 view_post · select_post · read_post에서 같음).
- **값**: 위치 · 이름 같은 값은 영어 소문자 id (`hero_request`, `home_recent`). 글 제목 · 카테고리는 화면에 보이는 그대로.
- 개인 정보(이름 · 이메일 · 의뢰 내용)는 **절대 보내지 않아요.** 의뢰는 분야 · 예산 구간만.

## 3. 이벤트 목록 (TOBE)

### 직접 보내는 이벤트

| 이벤트 | 보내는 순간 | 매개변수 | 페이지 | 핵심 이벤트 |
|---|---|---|---|---|
| `page_view` | 페이지를 열 때. 글 상세는 **글 제목을 불러온 뒤** | `page_title`, `page_location` | 전체 (관리자 제외) | |
| `view_post` | 글 상세가 열렸을 때 | `post_id`, `post_title`, `post_category` | 글 상세 | |
| `select_post` | 목록에서 글을 눌렀을 때 | `post_id`, `post_title`, `post_category`, `list_name`, `list_position` | 홈 최근 기록, 글 목록 | |
| `filter_posts` | 카테고리 버튼을 눌렀을 때 | `filter_category`, `list_name` | 홈 최근 기록, 글 목록 | |
| `read_post` | 본문을 50% · 90%까지 읽었을 때 (각 1번) | `post_id`, `post_title`, `post_category`, `read_depth` | 글 상세 | |
| `click_cta` | 의뢰 · 기록 버튼을 눌렀을 때 | `cta_name`, `cta_location` | 홈, 글 목록, 글 상세 | |
| `form_start` | 의뢰 폼에 처음 입력할 때 (1번) | `form_name` | 홈 | |
| `form_submit` | 의뢰 폼 보내기를 눌렀을 때 | `form_name`, `request_types`, `budget_range` | 홈 | |
| `generate_lead` | 의뢰가 접수되어 완료 페이지가 열렸을 때 | `form_name` | 의뢰 완료 | **예** |

### 값 목록

| 매개변수 | 값 |
|---|---|
| `list_name` | `home_recent` (홈 최근 기록) · `blog_list` (글 목록) |
| `list_position` | 1, 2, 3 … (위에서 몇 번째) |
| `filter_category` | `전체` · `바이브코딩` · `디자인` · `콘텐츠` |
| `read_depth` | `50` · `90` |
| `cta_name` · `cta_location` | `header_request` · `header` / `hero_request` · `hero` / `hero_blog` · `hero` / `home_all_posts` · `recent_posts` / `nav_blog` · `header` |
| `form_name` | `project_request` |
| `request_types` | 고른 의뢰 분야를 쉼표로 (`브랜딩,UI/UX 디자인`) |
| `budget_range` | 고른 예산 구간 그대로 (안 고르면 `미선택`) |

### GA가 자동으로 모으는 것 (향상된 측정)
`session_start`, `first_visit`, `user_engagement`, `scroll`(90%), `click`(다른 사이트로 나가는 링크) + 지역 · 기기 · OS · 브라우저 · 유입 경로.

### 보내지 않는 것
- 관리자 화면 (`/admin/`) 전체
- 관리자로 로그인한 적 있는 브라우저 (`?ga=on`으로 다시 켤 수 있음)

## 4. GA에 등록할 것

**맞춤 측정기준 (범위: 이벤트)**

| 이름 | 매개변수 | 상태 |
|---|---|---|
| 글 제목 | `post_title` | 등록함 (2026-11-17) |
| 글 카테고리 | `post_category` | 등록함 |
| 글 ID | `post_id` | 등록함 |
| 목록 위치 | `list_name` | 등록함 (2026-11-17) |
| CTA 이름 | `cta_name` | 등록함 (2026-11-17) |
| CTA 위치 | `cta_location` | 등록함 (2026-11-17) |
| 필터 카테고리 | `filter_category` | 등록함 (2026-11-17) |
| 읽은 정도 | `read_depth` | 등록함 (2026-11-17) |
| 의뢰 분야 | `request_types` | 등록함 (2026-11-17) |

**핵심 이벤트 (전환)**: 관리 → 데이터 표시 → **이벤트** → `generate_lead` 옆 **핵심 이벤트로 표시** 켜기. (`generate_lead`는 첫 의뢰가 들어온 뒤 목록에 나타나요.) — 사용자가 설정함 (2026-11-17)

**탐색**: 탐색 → 유입경로 탐색 "의뢰 흐름" (page_view → click_cta → form_start → form_submit → generate_lead) — 사용자가 만듦 (2026-11-17)

## 5. 코드 위치

| 무엇 | 파일 |
|---|---|
| GA 불러오기 · `trackEvent()` · `data-ga-event` 클릭 자동 기록 | `js/analytics.js` |
| `click_cta` | HTML 링크의 `data-ga-event="click_cta" data-ga-cta_name="…" data-ga-cta_location="…"` |
| `select_post`, `filter_posts`, `form_start`, `form_submit` | `js/home.js`, `js/posts.js` |
| `view_post`, `read_post`, 글 상세 `page_view` | `js/post.js` |
| `generate_lead` | `thanks.html` |
