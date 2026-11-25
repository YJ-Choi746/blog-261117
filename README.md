# Jae 블로그 — AI 케이스 스터디 작성기

> **평가자용 바로가기** · 배포 블로그: https://blog---261117.web.app · PRD: [docs/PRD.md](docs/PRD.md) (v1.5, 2쪽) · 테스트 보고서: [docs/TEST_REPORT.md](docs/TEST_REPORT.md) (v1.3, 2쪽, 실제 사이트 자동 33/33)

웹·앱 디자이너의 블로그 겸 의뢰 페이지에 **AI로 운영자의 워크플로우를 자동화**하는 미니 프로젝트예요 (기획 · 디자인 · 개발 1인).

> 문제: 방문자는 작업물과 작업 과정을 볼 수 없어 디자이너를 믿지 못해 의뢰하지 않고, 1인 운영자는 작업을 케이스 스터디로 정리할 시간이 없다.
> 해결: 운영자가 이미지와 짧은 메모만 넣으면 AI가 케이스 스터디와 SNS 문구 초안을 만들고, 작업 상세에서 바로 의뢰로 이어진다.

## 링크
| 결과물 | 위치 |
|---|---|
| 배포된 블로그 | https://blog---261117.web.app (GitHub Pages: https://yj-choi746.github.io/blog-261117/) |
| PRD 기획서 | [docs/PRD.md](docs/PRD.md) v1.5, A4 2쪽 (v0.2 → v1.5 변화는 커밋 기록 `docs: PRD ...`) |
| AI 작성기 (Claude 아티팩트, 비용 0원) | https://claude.ai/artifact/P6pJ9oB2nfDGJKTfgviAzA — 메모로 AI 초안과 인스타그램 문구 3안을 만들어 사이트에 붙여 넣음 (소유자만 열림, 공유는 아티팩트 공유 메뉴에서) |
| 디자인 프로토타입 | [prototype.html](prototype.html) (배포 후 https://yj-choi746.github.io/blog-261117/prototype.html) — 방문자 · 관리자 화면 흐름을 한 파일로 클릭해 볼 수 있음 |
| 테스트 보고서 | [docs/TEST_REPORT.md](docs/TEST_REPORT.md) v1.3 (실제 사이트 자동 33/33 + 운영자 실측 + 휴리스틱 평가 + GA4) · 스크린샷 [docs/screenshots/site/](docs/screenshots/site/) · 자동 테스트 [tests/site-flow/](tests/site-flow/) (이전 프로토타입 24/24: [tests/e2e_prototype.py](tests/e2e_prototype.py)) |
| 에이전트용 지침 | [docs/AGENT_GUIDE.md](docs/AGENT_GUIDE.md) · [CLAUDE.md](CLAUDE.md) |
| 의사결정 로그 | [docs/DECISION_LOG.md](docs/DECISION_LOG.md) |
| 성공 · 실패 로그 | [docs/SUCCESS_FAILURE_LOG.md](docs/SUCCESS_FAILURE_LOG.md) · 주제별 [docs/failures/](docs/failures/) |
| 작업 일지 | [docs/WORKLOG.md](docs/WORKLOG.md) |

## 진행 상황 (PRD v1.5 기능 번호)
| 기능 | 상태 |
|---|---|
| F1 한 줄 의뢰 · F2 의뢰서 (희망 일정, 레퍼런스 작업 · 링크) — `js/ask.js` | 완료 · 화면 6/6 · 규칙 7/7 · 사진 첨부 3장(D32) · 한국어 ⇄ English(D33) |
| F3 작업 목록 · 상세 · 의뢰 버튼 (`works.html` · `work.html`) | 완료 · 화면 6/6 |
| F4 작업 입력 · F6 미리보기와 게시 · 실패 시 직접 쓰기 (`admin/work.html`) | 완료 · 화면 7/7 · 규칙 18/18 |
| F5 AI 케이스 스터디 초안 | 프로토타입(Claude 아티팩트, 0원)에서 동작 · 사이트 서버 함수 `generateCaseStudy`도 테스트 7/7 (배포는 선택) · 문장 틀 초안(0원) 완료 |
| F7 인스타그램 문구 3안 (`generateSnsCopy`) | 완료 · 서버 5/5 · 화면 확인 |
| 이전 단계(v0.2) 의뢰 기능: AI 분석 · 의뢰 저장 · 관리자 의뢰 카드 | 완료 · 유지 |

## 구조
| 경로 | 내용 |
|---|---|
| `index.html` · `posts.html` · `post.html` | 방문자 화면 (첫 화면 · 의뢰 폼 · 글) |
| `admin/` | 관리자 화면 (로그인 · 글 관리 · 글쓰기 · 의뢰 관리) |
| `js/` · `css/` | 화면 스크립트 · 스타일 (빌드 없는 순수 JS, Firebase SDK) |
| `functions/` | 서버 함수 (AI 호출, API 키는 Secret Manager에만) |
| `firestore.rules` | 데이터 보안 규칙 (관리자 UID) |

## 실행 · 테스트
```bash
cd functions && npm install && npm test
```
```bash
pip install playwright && python3 tests/e2e_prototype.py
```
함수 배포 순서: [docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md)
