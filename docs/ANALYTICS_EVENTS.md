# 이벤트 택소노미 (GA4)

블로그에서 GA로 보내는 **이벤트 이름 · 매개변수 · 보내는 순간**을 정한 문서예요. 새 이벤트는 이 문서에 먼저 적고 코드에 넣어요.

## 1. 측정 목표 → 질문 → 이벤트

| 비즈니스 목표 | 알고 싶은 질문 | 이벤트 |
|---|---|---|
| 블로그 글이 읽힌다 | 어떤 글이 많이 열리고, 끝까지 읽히나? | `view_post` → `read_post` |
| 어디서 떠나나 | 본문 어디까지 내려갔고, 몇 초 만에 · 어느 지점에서 떠났나? | `scroll_post`, `leave_post` |
| 글이 퍼진다 | 어떤 글의 공유 링크를 복사하나? | `share_post` |
| 글에 반응한다 | 어떤 글에 좋아요 · 저장을 누르나? (PRD 반응률) | `like_post` · `unlike_post`, `bookmark_post` · `unbookmark_post` |
| 글을 찾아 들어온다 | 어디(홈/목록)에서, 몇 번째 글을 눌렀나? 어떤 카테고리를 고르나? | `select_post`, `filter_posts` |
| 의뢰로 이어진다 | 의뢰 버튼을 어디서 눌렀나? 폼을 시작하고 끝까지 보냈나? 어디서 막혔나? | `request_click` → `form_start` → `form_submit` → **`generate_lead`** (막히면 `form_error`) |
| 작업이 읽힌다 | 어떤 작업(케이스 스터디)이 열리나? | `case_view` |

**전환 깔때기 (의뢰)**: `page_view(홈)` → `request_click` → `form_start` → `form_submit` → `generate_lead`
**콘텐츠 깔때기 (읽기)**: `select_post` → `view_post` → `scroll_post(30 · 50 · 90)` → `read_post(50)` → `read_post(90)` → `leave_post`

## 2. 이름 규칙

- **이벤트 이름**: 영어 소문자 `snake_case`, 40자 이하. 기존 이벤트는 `동사_대상`(`view_post`), 2026-11-24에 새로 정한 의뢰 · 작업 이벤트는 `대상_동작`(`request_click`, `case_view`)이에요. 한 번 정한 이름은 바꾸지 않아요 (바꾸면 GA 보고서가 끊겨요).
- GA가 정해 둔 **추천 이벤트 이름이 있으면 그대로** 써요 (`page_view`, `generate_lead`).
- **매개변수 이름**: `snake_case`, 대상을 앞에 (`post_id`, `cta_name`, `list_name`). 같은 뜻이면 이벤트가 달라도 **같은 이름**을 써요 (`post_title`은 view_post · select_post · read_post에서 같음).
- **값**: 위치 · 이름 같은 값은 영어 소문자 id (`hero_request`, `home_recent`). 글 제목 · 카테고리는 화면에 보이는 그대로.
- 개인 정보(이름 · 이메일 · 의뢰 내용)는 **절대 보내지 않아요.** 의뢰는 분야 · 예산 구간만.

## 3. 이벤트 목록 (TOBE)

### 직접 보내는 이벤트

| 이벤트 | 보내는 순간 | 매개변수 | 페이지 | 핵심 이벤트 |
|---|---|---|---|---|
| `page_view` | 페이지를 열 때. 글 상세는 **글 제목을 불러온 뒤**, 주소를 `/post/글ID`로 바꿔서 (GA는 `?id=`를 떼고 경로만 보여줘서 모든 글이 `/post.html` 한 줄로 합쳐지기 때문) | `page_title`, `page_location` | 전체 (관리자 제외) | |
| `view_post` | 글 상세가 열렸을 때 | `post_id`, `post_title`, `post_category`, `post_published_at` | 글 상세 | |
| `select_post` | 목록에서 글을 눌렀을 때 · 글 아래 이전/다음 글을 눌렀을 때 | `post_id`, `post_title`, `post_category`, `list_name`, `list_position` | 홈 최근 기록, 글 목록, 글 상세 | |
| `share_post` | 글 상세에서 "공유 링크 복사"를 눌렀을 때 | `post_id`, `post_title`, `post_category`, `method` | 글 상세 | |
| `filter_posts` | 카테고리 버튼을 눌렀을 때 | `filter_category`, `list_name` | 홈 최근 기록, 글 목록 | |
| `read_post` | 본문을 50% · 90%까지 읽었을 때 (각 1번). **완독 보정**: 스크롤 위치와 함께 *화면을 보고 있던 시간*도 채워야 보내요 (아래 "완독 보정") | `post_id`, `post_title`, `post_category`, `post_published_at`, `read_depth` | 글 상세 | |
| `scroll_post` | 본문의 30% · 50% · 90%가 화면 아래 끝을 지났을 때 (각 1번, **시간 조건 없음**) | `post_id`, `post_title`, `post_category`, `post_published_at`, `scroll_depth`, `engaged_seconds` | 글 상세 | |
| `leave_post` | 글 상세를 떠날 때 1번 (탭 닫기 · 다른 페이지로 이동 · 뒤로 가기, `pagehide`) | `post_id`, `post_title`, `post_category`, `post_published_at`, `max_scroll_depth`, `engaged_seconds`, `read_completed` | 글 상세 | |
| `like_post` | 글 상세에서 좋아요(하트)를 눌러 **저장에 성공했을 때** | `post_id`, `post_title`, `post_category`, `post_published_at` | 글 상세 | |
| `unlike_post` | 좋아요를 다시 눌러 취소하고 저장에 성공했을 때 | 위와 같음 | 글 상세 | |
| `bookmark_post` | 글 상세에서 "저장"을 눌렀을 때 (이 브라우저에 저장) | 위와 같음 | 글 상세 | |
| `unbookmark_post` | "저장됨"을 눌러 저장을 취소했을 때 | 위와 같음 | 글 상세 | |
| `request_click` | 의뢰 버튼(프로젝트 의뢰 · 의뢰 문의하기 · 이런 작업 의뢰하기 등)을 눌렀을 때 | `cta_location` | 홈, 작업 · 글 페이지 | |
| `click_cta` | 기록(블로그)으로 가는 버튼을 눌렀을 때 | `cta_name`, `cta_location` | 홈 | |
| `case_view` | 작업 상세(케이스 스터디)가 열렸을 때 | `post_id`, `post_title`, `post_category` | 작업 상세 | |
| `form_start` | 의뢰 폼에 처음 입력할 때 (1번) | `form_id` | 홈 | |
| `form_submit` | 의뢰 폼 보내기를 눌러 **입력 확인을 통과했을 때** | `form_id`, `request_types`, `budget_range` | 홈 | |
| `form_error` | 보내기를 눌렀는데 입력 확인에서 막혔을 때 | `form_id`, `reason`, `error_count` | 홈 | |
| `generate_lead` | 의뢰가 접수되어 완료 페이지가 열렸을 때 (**전송 성공일 때만**) | `form_id` | 의뢰 완료 | **예** |
| `refresh_quote` | 오늘의 명언 위젯에서 "다른 명언 보기"를 눌렀을 때 | `widget_name` | 글 상세 (위젯이 있는 글) | |
| `select_personality` | 성격별 포켓몬 위젯에서 성격 버튼 · "같은 성격의 다른 포켓몬"을 눌렀을 때 | `personality`, `pokemon_id`, `widget_name` | 글 상세 (위젯이 있는 글) | |

### 값 목록

| 매개변수 | 값 |
|---|---|
| `list_name` | `home_recent` (홈 최근 기록) · `blog_list` (글 목록) · `post_nav_prev` · `post_nav_next` (글 상세 아래 이전 글 · 다음 글) |
| `list_position` | 1, 2, 3 … (위에서 몇 번째) |
| `method` | `copy_link` (공유 링크 복사) |
| `filter_category` | `전체` · `바이브코딩` · `디자인` · `콘텐츠` · `저장한 글`(글 목록만) |
| `read_depth` | `50` · `90` |
| `scroll_depth` | `30` · `50` · `90` |
| `max_scroll_depth` | 떠날 때까지 가장 많이 내려간 본문 비율, 10 단위로 내림 (`0` · `10` … `100`) |
| `engaged_seconds` | 그때까지 탭을 보고 있던 시간(초, 정수). 탭을 숨긴 시간은 빼요 |
| `read_completed` | 떠날 때까지 `read_post(90)`(완독)을 보냈으면 `yes`, 아니면 `no` |
| `post_published_at` | 글 발행일 `YYYY-MM-DD` (한국 시간). 발행 전 글(임시저장 · 비공개)은 `미발행` |
| `cta_location` (`request_click`) | `header` (헤더 프로젝트 의뢰) · `hero` (첫 화면 의뢰 문의하기) · `ask_result` (한 줄 의뢰 결과 '의뢰서 마저 쓰기') · `home_band` (홈 아래 '의뢰 문의하기') · `case_end` (작업 상세 아래 '이런 작업 의뢰하기') |
| `cta_name` · `cta_location` (`click_cta`) | `hero_blog` · `hero` / `home_all_posts` · `recent_posts` / `nav_blog` · `header` |
| `form_id` | `request` |
| `reason` (`form_error`) | `validation` (이름 · 이메일 · 필요한 것 확인에서 막힘) |
| `post_id` (`case_view`) | 작업 ID (`work.html?id=` 값) |

### 기존 이름 → 새 이름 (2026-11-24)

| 기존 | 새 이름 | 바뀐 점 |
|---|---|---|
| `click_cta` (의뢰 버튼, `cta_name: *_request`) | `request_click` | 이름 통일, `cta_location`만 보냄. 홈 아래 · 한 줄 의뢰 결과 · 작업 상세 의뢰 버튼도 새로 기록 |
| `click_cta` (기록 버튼) | `click_cta` (그대로) | 바뀌지 않음 |
| `form_name: project_request` | `form_id: request` | `form_start` · `form_submit` · `generate_lead` 매개변수 이름 |
| (없음) | `form_error` | 새로 추가 |
| (없음) | `case_view` | 새로 추가 |

2026-11-24 이전 기록은 GA에 옛 이름으로 남아 있어요. 기간을 겹쳐 볼 때는 두 이름을 같이 골라요.
| `request_types` | 고른 의뢰 분야를 쉼표로 (`브랜딩,UI/UX 디자인`) |
| `budget_range` | 고른 예산 구간 그대로 (안 고르면 `미선택`) |
| `widget_name` | `daily_quote` · `pokemon_match` |
| `personality` | `challenger` · `mood_maker` · `healer` · `thinker` · `strategist` · `explorer` |
| `pokemon_id` | PokéAPI 도감 번호 (`6`, `25` …) |

### 완독 보정 (`read_post`)

보정 전에는 스크롤 위치만 봐서, 짧은 글은 열자마자 50 · 90이 같이 찍히고 빠르게 훑고 내려가도 "완독"으로 셌어요. 그리고 사진이 늦게 뜨면 본문 길이가 바뀌는데 다시 재지 않았어요.

기준: PRD "블로그 인기 글 분석 체계" v2.0 FR-02.

| 깊이 | 스크롤 조건 | 시간 조건 (탭을 보고 있던 시간) |
|---|---|---|
| `90` | 본문의 90%가 화면 아래 끝을 지남 | 글자 수(공백 뺌) ÷ 500 × 60초 × 0.5, **5~60초** 범위 |
| `50` | 본문의 50%가 화면 아래 끝을 지남 | 90 시간의 **절반**, 단 **최소 5초** (PRD 인수조건 "5초 안에 닫으면 read_post 없음"을 지키려고) |

- 스크롤 없는 짧은 글도 **2초마다** 조건을 다시 확인해요. 50과 90은 각각 한 번만.
- 사진이 늦게 떠서 본문 높이가 바뀌면 다시 재요.
- 탭을 숨기거나 다른 앱으로 가 있던 시간은 세지 않아요.

### `scroll_post` · `leave_post` 와 `read_post` 의 차이

- `read_post` = **읽었다** (위치 + 최소 시간). PRD 완독률 계산용.
- `scroll_post` = **거기까지 내려갔다** (위치만). 단계별로 몇 명이 남는지 보는 깔때기용. 짧은 글은 열자마자 다 보여서 바로 30 · 50 · 90이 가요 → `engaged_seconds`로 구분.
- `leave_post` = **여기서 떠났다**. 떠난 깊이 · 머문 시간 · 완독 여부. 이전 · 다음 글로 넘어가도 떠남으로 기록돼요 (`select_post`와 같이 보면 구분돼요).
- 한계: 브라우저가 강제로 꺼지거나 휴대폰에서 앱을 바로 지우면 `leave_post`가 빠질 수 있어요. 다른 탭으로 잠깐 가는 건 떠남이 아니에요.

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
| 폼 ID | `form_id` | **등록 필요** (2026-11-24 추가) |
| 오류 이유 | `reason` | **등록 필요** (2026-11-24 추가) |
| CTA 위치 | `cta_location` | 등록함 (2026-11-17) |
| 필터 카테고리 | `filter_category` | 등록함 (2026-11-17) |
| 읽은 정도 | `read_depth` | 등록함 (2026-11-17) |
| 의뢰 분야 | `request_types` | 등록함 (2026-11-17) |
| 글 발행일 | `post_published_at` | **등록 필요** (2026-11-18 추가) |
| 스크롤 깊이 | `scroll_depth` | **등록 필요** (2026-11-18 추가) |
| 떠난 깊이 | `max_scroll_depth` | **등록 필요** (2026-11-18 추가) |
| 완독 여부 | `read_completed` | **등록 필요** (2026-11-18 추가) |

**맞춤 측정항목 (범위: 이벤트)**

| 이름 | 매개변수 | 단위 | 상태 |
|---|---|---|---|
| 머문 시간 | `engaged_seconds` | 초 | **등록 필요** (2026-11-18 추가) |
| 틀린 칸 수 | `error_count` | 개 | **등록 필요** (2026-11-24 추가) |

**핵심 이벤트 (전환)**: 관리 → 데이터 표시 → **이벤트** → `generate_lead` 옆 **핵심 이벤트로 표시** 켜기. (`generate_lead`는 첫 의뢰가 들어온 뒤 목록에 나타나요.) — 사용자가 설정함 (2026-11-17)

**탐색**: 탐색 → 유입경로 탐색 "의뢰 흐름" (page_view → click_cta → form_start → form_submit → generate_lead) — 사용자가 만듦 (2026-11-17). **2026-11-24부터 두 번째 단계를 `request_click`으로 바꿔야 해요.**

**향상된 측정**: 관리 → 데이터 수집 및 수정 → 데이터 스트림 → Blog-web → 향상된 측정 켜기, 톱니바퀴에서 스크롤 · 이탈 클릭 · 파일 다운로드 확인.

## 5. 코드 위치

| 무엇 | 파일 |
|---|---|
| GA 불러오기 · `trackEvent()` · `data-ga-event` 클릭 자동 기록 | `js/analytics.js` |
| `request_click`, `click_cta` | HTML 링크 · 버튼의 `data-ga-event="request_click" data-ga-cta_location="…"` (기록 버튼은 `click_cta` + `cta_name`) |
| `case_view` | `js/work.js` |
| `form_error` | `js/request-form.js` |
| `select_post`, `filter_posts`, `form_start` | `js/home.js`, `js/posts.js` |
| `form_submit` | `js/request-form.js` |
| `view_post`, `read_post`, `scroll_post`, `leave_post`, 글 상세 `page_view` | `js/post.js` |
| `like_post` · `unlike_post` · `bookmark_post` · `unbookmark_post` | `js/reactions.js` |
| `generate_lead` | `thanks.html` |
