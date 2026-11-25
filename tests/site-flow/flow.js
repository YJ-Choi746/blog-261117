// 실행: npm i && node flow.js  (기본은 로컬 서버 http://localhost:8080 + 가짜 Firebase)
// 배포 사이트 방문자 화면만: LIVE=1 BASE=https://blog---261117.web.app node flow.js (의뢰 제출 · 관리자 단계는 건너뜀)
// 실제 사이트 유저플로우 스크린샷. 기본: 로컬(main 코드 + 가짜 Firebase). LIVE=1 BASE=https://blog---261117.web.app 이면 배포 사이트.
const { launch, ctx, BASE } = require('./lib');
const path = require('path'); const OUT = process.env.OUT || path.join(__dirname, 'out');
const results = [];
const check = (id, name, ok, note = '') => { results.push({ id, name, ok: !!ok, note }); console.log(ok ? 'PASS' : 'FAIL', id, name, note); };
const shot = (p, f, full = false) => p.screenshot({ path: path.join(OUT, f), fullPage: full });
(async () => {
  const b = await launch();
  // ---------- 방문자 (데스크톱) ----------
  const c = await ctx(b); const p = await c.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(1200);
  await shot(p, 'v01-home.png');
  check('V-01', '홈 첫 화면 헤딩 · 의뢰 버튼', await p.locator('#open-request').isVisible());
  // 한 줄 의뢰 빈 입력
  await p.locator('#ask').scrollIntoViewIfNeeded();
  await p.click('#ask-form button[type=submit]'); await p.waitForTimeout(300);
  check('V-02', '한 줄 의뢰 빈 입력 시 결과 없음', await p.locator('#ask-result').isHidden());
  await p.fill('#ask-q', '카페 로고를 새로 만들고 싶어요'); await p.click('#ask-form button[type=submit]'); await p.waitForTimeout(600);
  const msg = await p.textContent('#ask-msg');
  check('V-03', '한 줄 의뢰 → 분야 추정 · 비슷한 작업', /브랜딩/.test(msg) && (await p.locator('#ask-works a').count()) > 0, msg.trim());
  await p.locator('#ask').screenshot({ path: path.join(OUT, 'v02-ask-result.png') });
  // 작업 상세
  await p.locator('#ask-works a').first().click(); await p.waitForTimeout(1200);
  check('V-04', '작업 상세 01 요청 · 02 과정 · 03 결과', /요청/.test(await p.textContent('body')) && /과정/.test(await p.textContent('body')));
  await shot(p, 'v03-work-detail.png'); await shot(p, 'v03-work-detail-full.png', true);
  // 작업 목록
  await p.goto(BASE + '/works.html'); await p.waitForTimeout(1000);
  check('V-05', '작업 목록 게시 작업 3건', (await p.locator('a[href*="work.html?id="]').count()) >= 3);
  await shot(p, 'v04-works.png');
  // 의뢰서 열기 (홈 → 한 줄 입력 후 의뢰 문의하기)
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(800);
  await p.fill('#ask-q', '카페 로고를 새로 만들고 싶어요'); await p.click('#ask-form button[type=submit]'); await p.waitForTimeout(500);
  await p.click('#open-request'); await p.waitForTimeout(500);
  const pre = await p.inputValue('[name="프로젝트 내용"]');
  check('V-06', '의뢰서에 한 줄 내용 · 분야 미리 채움', pre.includes('카페 로고') && await p.locator('input[name="의뢰분야"][value="브랜딩"]').isChecked());
  // 잘못된 이름 · 이메일
  await p.fill('[name="이름"]', 'ㅊㅇㅈ'); await p.fill('[name="email"]', 'a@b'); await p.click('#request-form button[type=submit]'); await p.waitForTimeout(500);
  const en = (await p.textContent('#err-name')) || '', ee = (await p.textContent('#err-email')) || '';
  check('V-07', '이름 · 이메일 오류 안내, 제출 막음', en.trim() && ee.trim() && p.url().includes('index.html'), `${en.trim()} / ${ee.trim()}`);
  await p.locator('#request-dialog').screenshot({ path: path.join(OUT, 'v05-request-errors.png') });
  // 올바른 값 + 레퍼런스
  await p.fill('[name="이름"]', '테스트'); await p.fill('[name="email"]', 'tester@example.com');
  const chip = p.locator('#ref-works label').first(); if (await chip.count()) await chip.click();
  await p.fill('#link-in', 'https://example.com/ref'); await p.click('#link-add');
  await p.locator('#photo-in').setInputFiles(path.join(__dirname, 'upload0.png')); await p.waitForTimeout(600);
  await p.locator('#request-dialog').screenshot({ path: path.join(OUT, 'v06-request-filled.png') });
  check('V-08', '레퍼런스 작업 · 링크 · 사진 첨부', (await p.locator('#ref-works input:checked').count()) === 1 && (await p.locator('#photo-list img, #photo-list li, #photo-list > *').count()) >= 1);
  if (!process.env.LIVE) {
  await Promise.all([p.waitForURL(/thanks/, { timeout: 8000 }).catch(() => {}), p.click('#request-form button[type=submit]')]);
  await p.waitForTimeout(800);
  const reqs = await p.evaluate(() => Object.keys((JSON.parse(localStorage.getItem('fakefs')) || {}).requests || {}).length);
  check('V-09', '제출 → 의뢰 저장 · 접수 화면', p.url().includes('thanks') && reqs === 1, `저장 ${reqs}건`);
  await shot(p, 'v07-thanks.png');
  }
  // 영어 전환
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(800);
  await p.click('.lang-toggle'); await p.waitForTimeout(500);
  const h = await p.textContent('body');
  check('V-10', '한국어 → English 전환, 새로고침 후 유지', /Request|Work|Project/i.test(h));
  await p.reload(); await p.waitForTimeout(800);
  check('V-10b', 'English 유지', (await p.evaluate(() => localStorage.getItem('jae-lang') || Object.keys(localStorage).find(k=>/lang/.test(k)))) !== null);
  await shot(p, 'v08-home-en.png');
  await p.click('.lang-toggle'); await p.waitForTimeout(300);
  check('V-11', '방문자 화면 스크립트 오류 0건', errs.length === 0, errs.join(' | '));
  // ---------- 모바일 360 ----------
  const m = await ctx(b, { viewport: { width: 360, height: 780 }, extra: { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } }); const mp = await m.newPage();
  await mp.goto(BASE + '/index.html'); await mp.waitForTimeout(1000);
  const sw = await mp.evaluate(() => document.documentElement.scrollWidth);
  check('N-01', '모바일 360px 가로 넘침 없음', sw <= 360, `scrollWidth ${sw}`);
  await mp.screenshot({ path: path.join(OUT, 'v09-mobile-home.png') });
  await mp.goto(BASE + '/work.html?id=w1'); await mp.waitForTimeout(1000);
  const sw2 = await mp.evaluate(() => document.documentElement.scrollWidth);
  check('N-02', '모바일 작업 상세 가로 넘침 없음', sw2 <= 360, `scrollWidth ${sw2}`);
  await mp.screenshot({ path: path.join(OUT, 'v10-mobile-detail.png') });
  // 버튼 44px
  await mp.goto(BASE + '/index.html'); await mp.waitForTimeout(800);
  const small = await mp.evaluate(() => [...document.querySelectorAll('button, a.btn, .btn')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.height && r.height < 44; }).map((e) => (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 14) + ':' + Math.round(e.getBoundingClientRect().height)));
  check('N-03', '홈 버튼 높이 44px 이상', small.length === 0, small.join(', '));
  if (process.env.LIVE) { require('fs').writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 1)); await b.close(); return; }
  // ---------- 관리자 ----------
  const pa = await c.newPage(); pa.on('dialog', (d) => d.accept()); const aerr = []; pa.on('pageerror', (e) => aerr.push(e.message));
  await pa.goto(BASE + '/admin/login.html'); await pa.waitForTimeout(600);
  await shot(pa, 'a01-login.png');
  await pa.fill('#email', 'admin@example.com'); await pa.fill('#password', 'test-only'); await pa.click('#login-btn'); await pa.waitForTimeout(1200);
  check('A-01', '관리자 로그인 → 관리 화면', !pa.url().includes('login'), pa.url().replace(BASE, ''));
  await pa.goto(BASE + '/admin/works.html'); await pa.waitForTimeout(1000);
  await shot(pa, 'a02-works.png');
  await pa.goto(BASE + '/admin/work.html'); await pa.waitForTimeout(1200);
  await shot(pa, 'a03a-editor-empty.png');
  await pa.evaluate(() => document.querySelectorAll('details.pw-key')[0].open = true);
  await pa.fill('#f-name', '꽃집 온라인 주문 페이지');
  // 빈 메모로 초안
  await pa.click('#generate'); await pa.waitForTimeout(500);
  const e1 = (await pa.textContent('#act-msg')) || '';
  check('A-02', '메모 비우고 AI 초안 → 막고 안내', /메모|채워|적어/.test(e1), e1.trim().slice(0, 60));
  await pa.fill('#f-name', '꽃집 온라인 주문 페이지'); await pa.selectOption('#f-category', 'UI/UX 디자인');
  await pa.fill('#f-industry', '꽃집'); await pa.fill('#f-period-from', '2026-10'); await pa.fill('#f-period-to', '2026-11'); await pa.fill('#f-role', 'UX · UI');
  await pa.fill('#m-request', '전화로만 주문을 받아서 바쁜 시간에 주문을 놓침'); await pa.fill('#m-work', '주문 단계를 3단계로 줄이고 꽃 종류를 사진으로 고르게 함'); await pa.fill('#m-result', '사장님이 주문을 한 화면에서 확인');
  await pa.locator('#image-input').setInputFiles([path.join(__dirname, 'upload1.png')]); await pa.waitForTimeout(1200);
  await pa.locator('details.pw-key').first().scrollIntoViewIfNeeded(); await shot(pa, 'a03-memo.png');
  // AI 초안 (키 없음 → 서버 함수 미배포 → 실패 안내)
  await pa.click('#generate'); await pa.waitForTimeout(1500);
  const g = (await pa.textContent('#gen-status')) || '';
  await shot(pa, 'a04-ai-fail.png');
  check('A-03', 'AI 서버 꺼짐 → 안내 + 문장 틀로 대체, 메모 유지', (await pa.inputValue('#m-request')).length > 0, g.trim().slice(0, 70));
  await pa.click('#c-template'); await pa.waitForTimeout(600);
  const prob = await pa.inputValue('#c-problem');
  check('A-04', '직접 쓰기 → 메모를 초안 칸으로', prob.length > 0, prob.slice(0, 40));
  if (!(await pa.inputValue('#c-summary'))) await pa.fill('#c-summary', '전화 주문만 받던 꽃집에 온라인 주문 화면을 만들었어요.');
  await pa.evaluate(() => document.getElementById('draft').scrollIntoView({ block: 'start' })); await pa.waitForTimeout(200); await shot(pa, 'a05-draft.png');
  await pa.click('#preview-toggle'); await pa.waitForTimeout(800);
  check('A-05', '전체 화면 미리보기에 제목 반영', (await pa.textContent('#fp-title')).includes('꽃집'));
  await shot(pa, 'a06-preview.png');
  await pa.click('#full-pv-close'); await pa.waitForTimeout(300);
  await pa.click('#publish'); await pa.waitForTimeout(1500);
  check('A-06', '게시 → 게시 완료 패널', await pa.locator('#published-panel').isVisible());
  await pa.click('#sns-template'); await pa.waitForTimeout(600);
  const cap = await pa.inputValue('#s-caption');
  check('A-07', '인스타그램 문구 채움', cap.length > 0, cap.slice(0, 40).replace(/\n/g, ' '));
  await pa.click('#sns-copy').catch(() => {}); await pa.waitForTimeout(400);
  await pa.evaluate(() => scrollTo(0, 0)); await pa.waitForTimeout(200); await shot(pa, 'a07-published.png'); await pa.locator('#sns-panel').screenshot({ path: path.join(OUT, 'a08-sns.png') });
  // 방문자 화면에 반영
  const pv = await c.newPage(); await pv.goto(BASE + '/works.html'); await pv.waitForTimeout(1000);
  check('A-08', '게시한 작업이 작업 목록에 보임', (await pv.textContent('body')).includes('꽃집 온라인 주문'));
  await pa.goto(BASE + '/admin/requests.html'); await pa.waitForTimeout(1200);
  check('A-09', '관리자 의뢰 목록에 방금 의뢰', (await pa.textContent('body')).includes('카페 로고'));
  await shot(pa, 'a09-requests.png');
  check('A-10', '관리자 화면 스크립트 오류 0건', aerr.length === 0, aerr.join(' | '));
  require('fs').writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 1));
  await b.close();
})();
