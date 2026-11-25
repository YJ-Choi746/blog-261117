// 브라우저: 설치된 playwright가 있으면 그것을, 없으면 @sparticuz/chromium(리눅스)을 써요
let pw, sparticuz = null;
try { pw = require('playwright').chromium; } catch { pw = require('playwright-core').chromium; sparticuz = require('@sparticuz/chromium'); }
const fs = require('fs'); const path = require('path');
const BASE = process.env.BASE || 'http://localhost:8080';
const FAKE = fs.readFileSync(path.join(__dirname, 'fake-firebase.js'), 'utf8');
const IM = JSON.parse(fs.readFileSync(path.join(__dirname, 'imgs.json')));
const ts = (d) => ({ __tsv: new Date(d).getTime() });
const works = {
  w1: { name: "동네 베이커리 브랜드 리뉴얼", title: "동네 베이커리 브랜드 리뉴얼", category: "브랜딩", industry: "식음료", period: "2주", role: "브랜딩 · 패키지", client: "", summary: "손님이 간판만 보고 빵집인지 몰랐던 문제를 로고와 패키지로 풀었어요.", problem: "오래된 간판과 제각각인 포장 때문에 처음 온 손님이 가게 성격을 알기 어려웠어요.", process: "손님 동선을 관찰하고, 대표 메뉴 세 가지를 중심으로 로고와 스티커 체계를 만들었어요.", result: "간판, 봉투, 스티커를 같은 체계로 바꿔 매장과 SNS의 첫인상을 맞췄어요.", tags: ["브랜딩","패키지"], coverImageId: "img0", imageIds: ["img0"], imageSizes: [{w:100,align:"center",at:"top"}], status: "published", createdAt: ts("2026-11-20"), updatedAt: ts("2026-11-20"), publishedAt: ts("2026-11-20"), authorUid: "admin-uid" },
  w2: { name: "예약 앱 첫 화면 개선", title: "예약 앱 첫 화면 개선", category: "UI/UX 디자인", industry: "서비스", period: "3주", role: "UX 리서치 · UI", client: "", summary: "예약 버튼을 찾지 못하던 첫 화면을 한 번에 예약할 수 있게 바꿨어요.", problem: "첫 화면에 메뉴가 많아 예약 버튼이 묻혀 있었어요.", process: "사용 흐름을 다시 그리고 핵심 행동 하나만 남기는 시안 두 개를 비교했어요.", result: "예약 버튼을 첫 화면 위로 올리고 단계를 줄인 화면을 넘겼어요.", tags: ["UX","앱"], coverImageId: "img1", imageIds: ["img1"], imageSizes: [{w:100,align:"center",at:"top"}], status: "published", createdAt: ts("2026-11-21"), updatedAt: ts("2026-11-21"), publishedAt: ts("2026-11-21"), authorUid: "admin-uid" },
  w3: { name: "전시 홍보 카드뉴스", title: "전시 홍보 카드뉴스", category: "콘텐츠 제작", industry: "문화예술", period: "1주", role: "콘텐츠 디자인", client: "", summary: "전시 정보를 다섯 장 카드뉴스로 정리했어요.", problem: "전시 정보가 길어 SNS에서 끝까지 읽히지 않았어요.", process: "관람객이 묻는 질문 순서대로 정보를 나눴어요.", result: "다섯 장 카드뉴스와 스토리용 이미지를 만들었어요.", tags: ["콘텐츠"], coverImageId: "img2", imageIds: ["img2"], imageSizes: [{w:100,align:"center",at:"top"}], status: "published", createdAt: ts("2026-11-22"), updatedAt: ts("2026-11-22"), publishedAt: ts("2026-11-22"), authorUid: "admin-uid" },
};
const images = Object.fromEntries(Object.entries(IM).map(([k, v]) => [k, { data: v, width: 1600, height: 1100, ownerUid: "admin-uid" }]));
const SEED = { works, images };
async function launch() {
  const browser = sparticuz ? await pw.launch({ executablePath: await sparticuz.executablePath(), args: sparticuz.args, headless: true }) : await pw.launch();
  return browser;
}
async function ctx(browser, opt = {}) {
  const c = await browser.newContext({ viewport: opt.viewport || { width: 1280, height: 860 }, deviceScaleFactor: 1, locale: 'ko-KR', reducedMotion: 'reduce', ...opt.extra });
  if (!process.env.LIVE) {
    await c.route('**/js/firebase.js', (r) => r.fulfill({ contentType: 'application/javascript', body: FAKE }));
    await c.route(/googletagmanager|google-analytics|fonts\.googleapis|fonts\.gstatic/, (r) => r.abort());
    await c.route(/formsubmit\.co/, (r) => r.fulfill({ status: 302, headers: { location: BASE + '/thanks.html' } }));
    if (opt.seed !== false) await c.addInitScript((s) => { if (!localStorage.getItem('fakefs')) localStorage.setItem('fakefs', JSON.stringify(s)); }, SEED);
  }
  return c;
}
module.exports = { launch, ctx, BASE };
