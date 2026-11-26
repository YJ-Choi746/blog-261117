# Jae 블로그 — AI 케이스 스터디 작성기

> **평가자용 바로가기** · 배포 블로그: https://jae-design.web.app (제출 시 주소 https://blog---261117.web.app 도 같은 내용) · PRD: [docs/PRD.md](docs/PRD.md) (v1.5, 2쪽) · 테스트 보고서: [docs/TEST_REPORT.md](docs/TEST_REPORT.md) (v1.4, 2쪽, 실제 사이트 자동 37/37) · 결과보고서: [docs/RESULT_REPORT.md](docs/RESULT_REPORT.md) (2쪽)

웹·앱 디자이너의 블로그 겸 의뢰 페이지에 **AI로 운영자의 워크플로우를 자동화**하는 미니 프로젝트예요 (기획 · 디자인 · 개발 1인).

> 문제: 방문자는 작업물과 작업 과정을 볼 수 없어 디자이너를 믿지 못해 의뢰하지 않고, 1인 운영자는 작업을 케이스 스터디로 정리할 시간이 없다.
> 해결: 운영자가 이미지와 짧은 메모만 넣으면 AI가 케이스 스터디와 SNS 문구 초안을 만들고, 작업 상세에서 바로 의뢰로 이어진다.

## 링크
| 결과물 | 위치 |
|---|---|
| 배포된 블로그 | https://jae-design.web.app (이전 주소 https://blog---261117.web.app 도 같은 내용 · GitHub Pages: https://yj-choi746.github.io/blog-261117/) · 관리자 로그인 https://jae-design.web.app/admin/login.html |
| PRD 기획서 | [docs/PRD.md](docs/PRD.md) v1.5, A4 2쪽 (v0.2 → v1.5 변화는 커밋 기록 `docs: PRD ...`) |
| 테스트 보고서 | [docs/TEST_REPORT.md](docs/TEST_REPORT.md) v1.4, A4 2쪽 (실제 사이트 자동 37/37 + 운영자 실측 + 휴리스틱 평가 + GA4 실제 방문자) · 스크린샷 [docs/screenshots/site/](docs/screenshots/site/) · 자동 테스트 [tests/site-flow/](tests/site-flow/) (이전 프로토타입 24/24: [tests/e2e_prototype.py](tests/e2e_prototype.py)) |
| 결과보고서 | [docs/RESULT_REPORT.md](docs/RESULT_REPORT.md) v2.0 최종, A4 2쪽 (개요 · PRD 요약 · 화면별 유저플로우 · 테스트 성공/실패/예외 · 기술 스택 · 회고) · 분석 코드 [analysis/eda_project.py](analysis/eda_project.py) |
| 소스 코드 | 이 저장소 `main` (커밋 기록이 개발 과정) · 파일별 역할 · 기능(F1~F7)별 대응표는 [docs/SOURCE_CODE.md](docs/SOURCE_CODE.md) · 요약은 아래 [구조](#구조) |
| 에이전트용 지침 | [docs/AGENT_GUIDE.md](docs/AGENT_GUIDE.md) · [CLAUDE.md](CLAUDE.md) |
| 의사결정 로그 | [docs/DECISION_LOG.md](docs/DECISION_LOG.md) (D1~D39) |
| 성공 · 실패 로그 | [docs/SUCCESS_FAILURE_LOG.md](docs/SUCCESS_FAILURE_LOG.md) · 주제별 [docs/failures/](docs/failures/) |
| 작업 일지 | [docs/WORKLOG.md](docs/WORKLOG.md) |
| 디자인 프로토타입 | [prototype.html](prototype.html) (https://yj-choi746.github.io/blog-261117/prototype.html) — 방문자 · 관리자 화면 흐름을 한 파일로 클릭해 볼 수 있음 |
| 디자인 시스템 · 사용자 스토리 | [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) · [docs/USER_STORIES.md](docs/USER_STORIES.md) |
| GA4 이벤트 · 통계 | [docs/ANALYTICS_EVENTS.md](docs/ANALYTICS_EVENTS.md) (이벤트 이름 · 기존 → 새 이름 표, D34) · [docs/ANALYTICS.md](docs/ANALYTICS.md) |
| AI 작성기 (Claude 아티팩트, 비용 0원) | https://claude.ai/artifact/P6pJ9oB2nfDGJKTfgviAzA — 메모로 AI 초안과 인스타그램 문구 3안 (소유자만 열림, 공유는 아티팩트 공유 메뉴에서) |

## 진행 상황 (PRD v1.5 기능 번호)
| 기능 | 상태 |
|---|---|
| F1 한 줄 의뢰 (`js/ask.js`) | 완료 · 분야 추정, 쇼핑몰 · 상세페이지는 콘텐츠 제작과 UI/UX 작업을 함께 추천 |
| F2 의뢰서 (희망 일정, 레퍼런스 작업 · 링크 · 사진 3장) | 완료 · '의뢰 문의하기' 창 · 입력 확인 · 사진 첨부(D32) · Firestore 저장 + 메일 |
| F3 작업 목록 · 상세 · 의뢰 버튼 (`works.html` · `work.html`) | 완료 · 작업 기간 최근 순 정렬, 홈 6개, 분야 4칸(편집디자인 포함, 관리자가 이름 변경, D38) |
| F4 작업 입력 (`admin/work.html`) | 완료 · 제목 · 정보 · 작업 기간, 사진 끌어다 놓기 · 순서 · 자르기 · 폭/위치 · 캡션, 썸네일을 눌러 홈 카드 사진 지정(D36) |
| F5 AI 케이스 스터디 초안 | 완료 · 운영자 키로 'AI로 수정하기' + 되돌리기(D30 · D31), Claude 아티팩트(0원), AI가 안 되면 직접 쓰기 |
| F6 미리보기와 게시 | 완료 · 오른쪽 실시간 미리보기, 전체 화면 미리보기, 초안 저장 |
| F7 인스타그램 문구 3안 | 완료 · 작업 글 아래 문구 칸, 복사 · 다른 문구 |
| 방문자 공통 | 한국어 ⇄ English(D33) · GA4 이벤트(D34) · 360px 화면 |

## 구조
| 경로 | 내용 |
|---|---|
| `index.html` · `works.html` · `work.html` · `posts.html` · `post.html` | 방문자 화면 (첫 화면 · 작업 · 기록 · 의뢰서) |
| `admin/` | 관리자 화면 (로그인 · 기록 관리 · 글쓰기 · 작업 관리 · 작업 편집 · 의뢰 관리) |
| `js/` · `css/` | 화면 스크립트 · 스타일 (빌드 없는 순수 JS, Firebase SDK) |
| `functions/` | 서버 함수 (AI 호출, API 키는 Secret Manager에만, 배포는 선택) |
| `firestore.rules` | 데이터 보안 규칙 (관리자 UID) |
| `tests/` | 자동 테스트 (`site-flow/` 실제 사이트 · `e2e_prototype.py` 프로토타입) |

## 실행 · 테스트
```bash
cd functions && npm install && npm test
```
```bash
cd tests/site-flow && npm install && npm test
```
```bash
pip install playwright && python3 tests/e2e_prototype.py
```
함수 배포 순서: [docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md)
