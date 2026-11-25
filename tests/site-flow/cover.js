// 타이틀 이미지 = 홈 화면 카드 사진. 썸네일을 누르면 정해지고 사진 순서 · 본문 위치는 그대로 (D36)
// 실행: node cover.js (로컬 서버 + 가짜 Firebase)
const { launch, ctx, BASE } = require('./lib');
const path = require('path'); const OUT = process.env.OUT || path.join(__dirname, 'out');
const results = []; const check = (id, name, ok, note = '') => { results.push({ id, name, ok: !!ok, note }); console.log(ok ? 'PASS' : 'FAIL', id, name, note); };
const TITLE = '타이틀 이미지 고르기 테스트';
(async () => {
  require('fs').mkdirSync(OUT, { recursive: true });
  const b = await launch(); const c = await ctx(b);
  const pa = await c.newPage(); pa.on('dialog', (d) => d.accept()); const errs = []; pa.on('pageerror', (e) => errs.push(e.message));
  await pa.goto(BASE + '/admin/login.html'); await pa.fill('#email', 'admin@example.com'); await pa.fill('#password', 'test-only'); await pa.click('#login-btn'); await pa.waitForTimeout(800);
  await pa.goto(BASE + '/admin/work.html'); await pa.waitForTimeout(1000);
  await pa.fill('#f-name', TITLE);
  await pa.locator('#image-input').setInputFiles(['upload3.png', 'upload1.png', 'upload2.png'].map((f) => path.join(__dirname, f))); await pa.waitForTimeout(1500);
  const srcs = async () => pa.locator('#images figure img').evaluateAll((l) => l.map((x) => x.src));
  const caps = async () => pa.locator('#images figcaption').allTextContents();
  const before = await srcs(); const liveBefore = await pa.locator('.pw-live img').evaluateAll((l) => l.map((x) => x.src));
  check('C01', '고르기 전에는 첫 장이 타이틀', (await caps())[0] === '★ 타이틀 (홈)', (await caps()).join(' / '));
  await pa.locator('#images figure').nth(2).locator('img').click(); await pa.waitForTimeout(500); // 3번째 사진을 누름
  const after = await srcs(); const liveAfter = await pa.locator('.pw-live img').evaluateAll((l) => l.map((x) => x.src));
  const cp = await caps();
  check('C02', '3번째 썸네일을 누르면 그 사진이 타이틀', cp[2] === '★ 타이틀 (홈)' && cp.filter((t) => t.includes('타이틀')).length === 1, cp.join(' / '));
  check('C03', '사진 순서와 본문 미리보기 배치는 그대로', JSON.stringify(before) === JSON.stringify(after) && JSON.stringify(liveBefore) === JSON.stringify(liveAfter));
  await pa.locator('#images').screenshot({ path: path.join(OUT, 'c01-cover-thumbs.png') });
  await pa.fill('#c-summary', '타이틀 이미지 테스트'); await pa.fill('#c-problem', '요청'); await pa.fill('#c-process', '과정'); await pa.fill('#c-result', '결과');
  await pa.click('#publish'); await pa.waitForTimeout(1500);
  const saved = await pa.evaluate((t) => { const s = JSON.parse(localStorage.getItem('fakefs')); const [id, w] = Object.entries(s.works).find(([, x]) => x.title === t); return { id, cover: w.coverImageId, coverName: s.images[w.coverImageId].name, order: w.imageIds.map((x) => s.images[x].name), coverData: s.images[w.coverImageId].data, firstData: s.images[w.imageIds[0]].data }; }, TITLE);
  check('C04', '저장: coverImageId = 누른 사진, imageIds 순서 그대로', /upload2/.test(saved.coverName) && /upload3/.test(saved.order[0]) && /upload2/.test(saved.order[2]), saved.order.join(','));
  const pv = await c.newPage(); await pv.goto(BASE + '/index.html'); await pv.waitForTimeout(1500);
  const homeSrc = await pv.evaluate((t) => { const a = [...document.querySelectorAll('#home-works a')].find((x) => x.textContent.includes(t)); const i = a && a.querySelector('img'); return i ? i.src : ''; }, TITLE);
  check('C05', '홈 화면 카드 사진 = 누른 사진', homeSrc === saved.coverData);
  await pv.locator('#home-works').screenshot({ path: path.join(OUT, 'c02-cover-home.png') });
  await pv.goto(BASE + '/work.html?id=' + saved.id); await pv.waitForTimeout(1200);
  const heroSrc = await pv.evaluate(() => { const h = document.querySelector('#work-cover .is-hero'); return h ? h.src : ''; });
  check('C06', '작업 상세 맨 위는 원래 순서 그대로(첫 장)', heroSrc === saved.firstData);
  await pa.goto(BASE + '/admin/work.html?id=' + saved.id); await pa.waitForTimeout(1500);
  const cp3 = await caps();
  check('C07', '다시 열어도 누른 사진이 타이틀, 순서 유지', cp3[2] === '★ 타이틀 (홈)' && (await srcs())[2] === saved.coverData, cp3.join(' / '));
  check('C08', '스크립트 오류 0건', errs.length === 0, errs.join(' | '));
  require('fs').writeFileSync(path.join(OUT, 'cover-results.json'), JSON.stringify(results, null, 1));
  await b.close();
})();
