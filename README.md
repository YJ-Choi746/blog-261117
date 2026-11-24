# Jae 블로그 — AI 케이스 스터디 작성기

웹·앱 디자이너의 블로그 겸 의뢰 페이지에 **AI로 운영자의 워크플로우를 자동화**하는 미니 프로젝트예요 (기획 · 디자인 · 개발 1인).

> 문제: 방문자는 작업물과 작업 과정을 볼 수 없어 디자이너를 믿지 못해 의뢰하지 않고, 1인 운영자는 작업을 케이스 스터디로 정리할 시간이 없다.
> 해결: 운영자가 이미지와 짧은 메모만 넣으면 AI가 케이스 스터디와 SNS 문구 초안을 만들고, 작업 상세에서 바로 의뢰로 이어진다.

## 링크
| 결과물 | 위치 |
|---|---|
| 배포된 블로그 | https://blog---261117.web.app (GitHub Pages: https://yj-choi746.github.io/blog-261117/) |
| PRD 기획서 | [docs/PRD.md](docs/PRD.md) v0.6, A4 2쪽 (v0.2 → v0.6 변화는 커밋 기록 `docs: PRD ...`) |
| 테스트 보고서 | [docs/TEST_REPORT.md](docs/TEST_REPORT.md) · 스크린샷 [docs/screenshots/](docs/screenshots/) |
| 에이전트용 지침 | [docs/AGENT_GUIDE.md](docs/AGENT_GUIDE.md) · [CLAUDE.md](CLAUDE.md) |
| 의사결정 로그 | [docs/DECISION_LOG.md](docs/DECISION_LOG.md) |
| 성공 · 실패 로그 | [docs/SUCCESS_FAILURE_LOG.md](docs/SUCCESS_FAILURE_LOG.md) · 주제별 [docs/failures/](docs/failures/) |
| 작업 일지 | [docs/WORKLOG.md](docs/WORKLOG.md) |

## 진행 상황 (2026-11-24)
| 기능 (PRD v0.6) | 상태 |
|---|---|
| F2 AI 케이스 스터디 생성 (`functions/casestudy.js`) | 완료 · 단위 테스트 7/7 |
| F1 작업 입력 · F3 편집·게시 · F7 실패 대체 (`admin/work.html`) | 완료 · 화면 7/7 · 규칙 18/18 |
| F4 목록·상세 · F5 의뢰 연결 · F6 SNS 문구 | 진행 예정 |
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
함수 배포 순서: [docs/firebase-setup.md](docs/firebase-setup.md)
