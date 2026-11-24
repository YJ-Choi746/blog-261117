# Firebase 연결하기 (처음 한 번)

관리자 로그인과 글 저장은 Firebase(구글의 무료 서비스)가 처리해요. 아래 순서대로 한 번만 하면 돼요. 무료 요금제(Spark)로 충분해요.

## 1. 프로젝트 만들기
1. https://console.firebase.google.com 에 구글 계정으로 들어가요.
2. **프로젝트 추가** → 이름 예: `yourname-blog` → Google 애널리틱스는 꺼도 돼요 → 만들기.

## 2. 웹 앱 등록하고 설정값 받기
1. 프로젝트 개요 화면의 **웹 아이콘 `</>`** 을 눌러요.
2. 앱 닉네임 예: `blog` → **앱 등록** (Firebase 호스팅 체크는 안 해도 돼요).
3. 화면에 나오는 `const firebaseConfig = { ... }` 안의 값 6개를 복사해요.
4. 저장소의 `js/firebase-config.js`에 있는 `YOUR_...` 자리에 붙여넣어요. (Claude에게 붙여넣어 달라고 해도 돼요.)

> 이 값들은 비밀번호가 아니에요. 웹사이트에 공개되는 값이라 저장소에 올려도 돼요. 보안은 5번의 규칙이 지켜요.

## 3. 이메일 로그인 켜고 관리자 계정 만들기
1. 왼쪽 메뉴 **빌드 → Authentication → 시작하기**.
2. **로그인 방법** 탭 → **이메일/비밀번호** → 사용 설정 → 저장.
3. **사용자** 탭 → **사용자 추가** → 관리자로 쓸 이메일과 비밀번호 입력.
4. 만들어진 사용자의 **사용자 UID**(긴 영문·숫자)를 복사해 둬요. 5번에 필요해요.

## 4. 승인된 도메인 추가
1. Authentication → **설정** 탭 → **승인된 도메인** → **도메인 추가**.
2. `yj-choi746.github.io` 를 추가해요. (안 하면 배포된 사이트에서 로그인이 막혀요.)

## 5. 글 저장소(Firestore) 만들고 보안 규칙 넣기
1. **빌드 → Firestore Database → 데이터베이스 만들기**.
2. 위치: `asia-northeast3 (서울)` → **프로덕션 모드로 시작**.
3. **규칙** 탭을 열고, 저장소의 `firestore.rules` 내용을 전부 붙여넣어요.
4. 그 안의 `ADMIN_UID` 를 3-4에서 복사한 사용자 UID로 바꿔요.
5. **게시**를 눌러요.

## 6. 확인하기
1. 사이트의 맨 아래 **관리자** → 로그인.
2. 글쓰기 화면에서 제목·본문을 쓰고 **임시저장** → **발행하기**.
3. 글 상세 화면으로 넘어가면 성공이에요. **기록** 메뉴의 글 목록에도 보여요.
4. 로그아웃한 상태(또는 다른 브라우저)에서 임시저장 글 주소를 열면 "글을 찾을 수 없어요"가 나와야 해요.

막히면 오류 문구를 그대로 Claude에게 알려주세요. 해결 과정은 `docs/failures/로그인.md`에 이어서 적어요.

## 규칙을 바꿨을 때 (다시 게시)
`firestore.rules`가 바뀌면 콘솔의 규칙도 같은 내용으로 다시 게시해야 해요.
- 2026-11-17: 비공개 글(`private`)과 사진(`images`) 규칙이 추가됐어요. 다시 게시하지 않으면 **비공개 저장과 사진 올리기가 "권한이 없어요"로 막혀요.**

## Firebase Hosting에도 올리기 (자동 배포, 처음 한 번 설정)
사이트는 GitHub Pages(`yj-choi746.github.io/blog-261117`)와 Firebase Hosting(`blog---261117.web.app`) 두 곳에 올라가요.
`main`에 올리면 GitHub Actions(`.github/workflows/firebase-hosting.yml`)가 Firebase Hosting에도 자동으로 올려요. 그러려면 **서비스 계정 키**를 GitHub에 한 번 넣어야 해요.

1. Firebase 콘솔 → 톱니바퀴 → **프로젝트 설정** → **서비스 계정** 탭 → **새 비공개 키 생성** → JSON 파일이 내려받아져요.
   (이 파일은 비밀번호와 같아요. 저장소에 올리거나 채팅에 붙여넣지 마세요.)
2. GitHub 저장소 → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
   - Name: `FIREBASE_SERVICE_ACCOUNT`
   - Secret: 내려받은 JSON 파일 내용을 통째로 붙여넣기 → **Add secret**
3. 저장소 → **Actions** 탭 → **Deploy to Firebase Hosting** → **Run workflow** (또는 다음에 `main`에 올릴 때 자동 실행)
4. 초록색 체크가 뜨면 https://blog---261117.web.app 에서 사이트가 열려요.

- Firebase Hosting에서도 로그인이 되려면 Authentication → 설정 → 승인된 도메인에 `blog---261117.web.app`이 있어야 해요 (보통 처음부터 들어 있어요).
- `docs/`, `*.md`, `firestore.rules`, `firebase.json`은 Hosting에 올리지 않아요 (`firebase.json`의 ignore).

## AI 의뢰 분석 함수(F1) 배포 — 처음 한 번

서버 함수 `analyzeRequest`는 `functions/` 폴더에 있어요. GitHub Actions는 호스팅만 배포하므로, 함수는 아래 순서로 직접 한 번 배포해요.

1. **Blaze 요금제로 전환**: Firebase 콘솔 → 왼쪽 아래 요금제 → **Blaze(종량제)**. 함수 · Secret Manager를 쓰려면 꼭 필요해요. 무료 사용량 안에서는 요금이 거의 없지만, 놀라지 않게 Google Cloud 콘솔 → 결제 → **예산 및 알림**에서 예: 월 1만 원 알림을 걸어 두세요.
2. **Claude API 키 만들기**: https://platform.claude.com → API Keys → 새 키. 키는 어디에도 붙여넣거나 커밋하지 말고 다음 단계에서만 써요.
3. 내 컴퓨터(또는 Google Cloud Shell) 터미널에서:
   ```bash
   npm install -g firebase-tools
   firebase login
   cd blog-261117/functions && npm install && cd ..
   firebase functions:secrets:set ANTHROPIC_API_KEY
   firebase deploy --only functions
   ```
   `secrets:set`을 실행하면 키를 입력하라고 나와요. 화면에 안 보이게 입력돼요.
4. 확인: Firebase 콘솔 → Functions에 `analyzeRequest`(asia-northeast3)가 보이면 끝.

- 키를 바꾸려면 3의 `secrets:set`을 다시 하고 `firebase deploy --only functions`.
- 함수 코드를 고쳤을 때도 `firebase deploy --only functions`를 다시 해요.
