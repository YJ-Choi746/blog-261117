# 소스 코드 안내

<sub>v1.0 · 2026-11-25 J · [README](../README.md) · [PRD](PRD.md) · [테스트 보고서](TEST_REPORT.md) · [에이전트 지침](AGENT_GUIDE.md)</sub>

빌드 없는 순수 HTML · JS(ES 모듈) · CSS와 Firebase(Auth · Firestore · Hosting)로 만들었어요. 서버 함수(`functions/`)는 선택이고, AI는 운영자 키로 브라우저에서 바로 부를 수도 있어요(D30). 개발 과정은 이 저장소 `main`의 커밋 기록에 있어요.

## 1. 기능별로 찾기 (PRD v1.5 기능 번호)

| 기능 | 화면 | 핵심 코드 | 테스트 |
|---|---|---|---|
| F1 한 줄 의뢰 | `index.html` | `js/ask.js`, `js/templates.js`(분야 추정) | `tests/site-flow/flow.js` |
| F2 의뢰서 · 저장 | `index.html`, `thanks.html`, `admin/requests.html` | `js/request-dialog.js`, `js/request-form.js`, `js/admin-requests.js`, `functions/analyze.js` | `functions/test/analyze.test.js`, `flow.js` |
| F3 작업 목록 · 상세 | `works.html`, `work.html`, `index.html` | `js/works.js`, `js/work.js`, `js/works-data.js`, `js/home-works.js`, `js/categories.js` | `flow.js` |
| F4 작업 입력 | `admin/work.html`, `admin/works.html` | `js/work-edit.js`, `js/admin-works.js`, `js/images.js`, `js/crop.js`, `js/image-layout.js` | `tests/site-flow/cover.js`, `flow.js` |
| F5 AI 케이스 스터디 초안 | `admin/work.html` | `js/ai-direct.js`, `js/ai-prompt.js`, `functions/casestudy.js`, `functions/casestudy-prompt.js`, AI 없을 때 `js/templates.js` | `functions/test/casestudy.test.js` |
| F6 미리보기 · 게시 | `admin/work.html` | `js/work-edit.js`, `js/image-layout.js` | `flow.js` |
| F7 인스타그램 문구 3안 | `admin/work.html` | `js/ai-direct.js`, `functions/casestudy.js` | `functions/test/sns.test.js` |
| 공통: 언어 · 통계 | 방문자 화면 전체 | `js/i18n.js`(D33), `js/analytics.js`(D34) | `flow.js` |
| 기록(블로그 글) | `posts.html`, `post.html`, `admin/write.html`, `admin/posts.html` | `js/posts.js`, `js/post.js`, `js/write.js`, `js/editor.js`, `js/sanitize.js`, `js/render.js`, `js/widgets.js`, `js/reactions.js` | — |

## 2. 폴더 · 파일 목록

### 방문자 화면 (루트)
| 파일 | 역할 | 불러오는 스크립트 |
|---|---|---|
| `index.html` | 첫 화면: 한 줄 의뢰, 선택한 작업 6개, 최근 기록, 의뢰서 창 | `ask.js` `home-works.js` `home.js` `request-dialog.js` `request-form.js` |
| `works.html` · `work.html` | 작업 목록(분야 필터) · 작업 상세(요청 → 과정 → 결과 → 의뢰 띠) | `works.js` · `work.js` |
| `posts.html` · `post.html` | 기록 목록 · 글 상세(좋아요 · 저장) | `posts.js` · `post.js` |
| `thanks.html` | 의뢰 접수 완료 | — |
| `prototype.html` | 디자인 프로토타입(방문자 · 관리자 흐름을 한 파일로, Firebase 없음) | 파일 안에 포함 |

방문자 화면은 모두 `js/i18n.js`(한국어 ⇄ English)와 `js/analytics.js`(GA4)를 함께 불러요.

### 관리자 화면 (`admin/`)
| 파일 | 역할 | 스크립트 |
|---|---|---|
| `login.html` | 관리자 로그인 | `js/login.js` |
| `works.html` · `work.html` | 작업 관리 목록 · 작업 편집(입력 → AI 초안 → 미리보기 → 게시) | `js/admin-works.js` · `js/work-edit.js` |
| `requests.html` | 의뢰 관리(AI 요약 · 빠진 항목 · 적합도) | `js/admin-requests.js` |
| `posts.html` · `write.html` | 기록 관리 · 글쓰기 | `js/admin-posts.js` · `js/write.js` |

로그인 뒤 관리자 화면은 `js/viewer.js`(평가자 보기 전용 안내, D39)를 함께 써요. GA4 · 언어 바꾸기는 넣지 않아요.

### `js/` 공통 모듈
| 파일 | 역할 |
|---|---|
| `firebase.js` · `firebase-config.js` | Firebase 연결(SDK 버전은 여기 한곳) · 공개 웹 설정값 |
| `images.js` · `crop.js` · `image-layout.js` | 이미지 줄여서 Firestore에 저장(무료 요금제) · 자르기 · 폭/위치/캡션 배치 |
| `templates.js` | AI 없이 쓰는 문장 틀(비용 0원, D27), 메모에 없는 사실은 만들지 않음 |
| `ai-direct.js` · `ai-prompt.js` | 운영자 키로 브라우저에서 AI 호출(키는 이 브라우저에만) · 프롬프트 사본(`functions/casestudy-prompt.js`와 같게 유지) |
| `sanitize.js` · `render.js` | 허용 목록 방식 HTML 정리 · textContent로만 본문 그리기(XSS 방지) |
| `editor.js` · `widgets.js` · `reactions.js` · `post-actions.js` | 글쓰기 에디터 · 본문 위젯 · 좋아요/저장 · 관리자 글 삭제/수정 |
| `categories.js` | 작업 분야 4칸 이름(관리자가 변경, D38) |
| `data/advices.js` | 본문 위젯용 한국어 명언 목록(출처는 파일 머리말) |

### 서버 · 설정 · 배포
| 경로 | 역할 |
|---|---|
| `functions/index.js` | 서버 함수 진입점(onCall). API 키는 Secret Manager `ANTHROPIC_API_KEY`에만 |
| `functions/casestudy.js` · `casestudy-prompt.js` | F5 케이스 스터디 · F7 문구 핵심 로직과 프롬프트(Firebase와 분리해 테스트) |
| `functions/analyze.js` · `prompt.js` | 의뢰 AI 분석 로직과 프롬프트(이름 · 이메일은 받지 않음) |
| `firestore.rules` | 보안 규칙: 관리자 UID만 쓰기, 평가자는 읽기만, 의뢰 · 메모는 관리자만 |
| `firebase.json` · `.firebaserc` | Hosting 설정(`tests/` 배포 제외, D37) |
| `.github/workflows/firebase-hosting.yml` | `main`에 올리면 Firebase Hosting 자동 배포 |
| `.github/scripts/share-pages.mjs` | 글마다 카카오톡 · SNS 미리보기용 공유 페이지(og 태그) 생성 |
| `css/site.css` · `editor.css` · `fx.css` | 공통 스타일 · 에디터와 글 본문 · 버튼 효과 |

### 테스트 (`tests/`, `functions/test/`)
| 경로 | 내용 | 실행 |
|---|---|---|
| `functions/test/*.test.js` | F2 의뢰 분석 · F5 초안 · F7 문구 단위 테스트(가짜 AI, 키 없이) | `cd functions && npm test` |
| `tests/site-flow/flow.js` | 전체 유저플로우 자동 테스트 + 스크린샷(로컬 가짜 Firebase 또는 `LIVE=1` 배포 사이트) | `cd tests/site-flow && npm test` |
| `tests/site-flow/cover.js` | 타이틀 이미지 지정 회귀 테스트(D36) | `node cover.js` |
| `tests/e2e_prototype.py` | 프로토타입 흐름 테스트(이전 24/24) | `python3 tests/e2e_prototype.py` |

결과와 스크린샷은 [TEST_REPORT.md](TEST_REPORT.md), `docs/screenshots/site/`에 있어요.

## 3. 규모 (2026-11-25 기준)
| 구분 | 파일 | 줄 수 |
|---|---|---|
| HTML(방문자 · 관리자 · 프로토타입) | 13 | 1,966 |
| JS(`js/`, 명언 목록 722줄 포함) | 35 | 5,205 |
| 서버 함수(`functions/*.js`) | 5 | 565 |
| CSS | 3 | 682 |

## 4. 코드를 고칠 때 지킬 것
- 화면에 사용자 내용을 넣을 때는 `textContent`만 써요(본문 HTML은 `sanitize.js`를 거쳐요).
- 프롬프트를 바꾸면 `functions/casestudy-prompt.js`와 `js/ai-prompt.js`를 같이 고치고, 이유를 [SUCCESS_FAILURE_LOG.md](SUCCESS_FAILURE_LOG.md)에 남긴 뒤 `prompt:` 커밋으로 올려요.
- 공개 문서(`works`)와 관리자 문서(`workNotes`: 메모 · 클라이언트 실명)를 나눠 저장해요.
- 자세한 작업 규칙은 [AGENT_GUIDE.md](AGENT_GUIDE.md), 결정 이유는 [DECISION_LOG.md](DECISION_LOG.md)에 있어요.
