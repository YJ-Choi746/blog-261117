"""AI 케이스 스터디 작성기 프로토타입(prototype.html) — 유저플로우 자동 테스트 (docs/TEST_REPORT.md의 A-01~A-10, U-01~U-13, N-01)"""
import json, os, time
from playwright.sync_api import sync_playwright

# 실행: 저장소 맨 위 폴더에서 `python3 tests/e2e_prototype.py`
# 준비: pip install playwright && playwright install chromium
# 이미 설치된 Chromium을 쓰려면 환경변수 CHROMIUM_PATH에 실행 파일 경로를 넣어요
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = 'file://' + os.path.join(ROOT, 'prototype.html')
SHOTS = os.path.join(ROOT, 'docs', 'screenshots', 'prototype')
FIX = os.path.join(ROOT, 'tests', 'fixtures')
os.makedirs(SHOTS, exist_ok=True)
R = []  # (id, feature, name, expected, ok, note)

def rec(tid, feat, name, exp, ok, note=''):
    R.append(dict(id=tid, f=feat, name=name, exp=exp, ok=bool(ok), note=note))
    print(('PASS' if ok else 'FAIL'), tid, name, note)

HL_JS = """(sels) => {
  document.querySelectorAll('.qa-hl').forEach(e => e.remove());
  const els = sels.flatMap(s => Array.from(document.querySelectorAll(s))).filter(e => e.getClientRects().length);
  if (!els.length) return 0;
  els[0].scrollIntoView({block: 'center'});
  els.forEach(el => {
    const r = el.getBoundingClientRect();
    const d = document.createElement('div');
    d.className = 'qa-hl';
    Object.assign(d.style, {position: 'fixed', left: (r.left - 4) + 'px', top: (r.top - 4) + 'px', width: (r.width + 8) + 'px', height: (r.height + 8) + 'px',
      background: 'rgba(255, 221, 0, .32)', border: '3px solid #F2B705', borderRadius: '6px', pointerEvents: 'none', zIndex: 2147483647, mixBlendMode: 'multiply'});
    (el.closest('dialog') || document.body).appendChild(d);
  });
  return els.length;
}"""

def shot(page, name, hl=None):
    """해당 테스트에서 확인한 부분을 형광펜으로 표시하고 화면을 찍는다."""
    if hl:
        page.wait_for_timeout(100)
        n = page.evaluate(HL_JS, hl)
        if not n: print('형광펜 대상 없음:', name, hl)
        page.wait_for_timeout(150)
        n = page.evaluate(HL_JS, hl)  # 스크롤 후 위치 다시 계산
    page.screenshot(path=os.path.join(SHOTS, name + '.png'))
    page.evaluate("() => document.querySelectorAll('.qa-hl').forEach(e => e.remove())")

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or None)
    ctx = b.new_context(viewport={'width': 1280, 'height': 860}, device_scale_factor=1)
    page = ctx.new_page()
    page.route('**/fonts.googleapis.com/**', lambda r: r.abort())
    page.route('**/fonts.gstatic.com/**', lambda r: r.abort())
    page.goto(URL + '#home'); page.wait_for_timeout(300)
    page.click('#resetAll'); page.wait_for_timeout(300)

    # ================= 관리자 =================
    page.goto(URL + '#admin'); page.wait_for_timeout(200)
    page.click('[data-act="gen"]'); page.wait_for_timeout(200)
    t = page.inner_text('.admin main')
    rec('A-01', 'F1', '필수 메모 비우고 AI 초안 만들기', '생성 막고 빠진 항목 안내', '작업명' in t and '적어주세요' in t)

    page.fill('#fName', '동네 빵집 리브랜딩')
    page.select_option('#fCat', '브랜딩')
    page.fill('#fInd', '베이커리'); page.fill('#fPer', '3주'); page.fill('#fRole', '로고, 간판')
    page.fill('#fReq', '오래된 로고가 젊은 손님에게 안 맞는다고 느낌. 매장 분위기는 유지하고 싶어 함')
    page.fill('#fDid', '매장 방문, 주변 가게 간판 비교. 시안 3개 제안 후 2번 수정')
    page.fill('#fRes', '간판, 포장지, 인스타그램 프로필에 새 로고 적용')
    shot(page, '07-admin-input', ['.meta-in', '.memo textarea', '[data-act="gen"]'])

    # F7 실패
    page.check('#fFail'); page.click('[data-act="gen"]'); page.wait_for_timeout(1600)
    t = page.inner_text('.admin main')
    memo_kept = page.input_value('#fReq').startswith('오래된 로고')
    rec('A-02', 'F7', 'AI 응답 실패 상황', '오류 안내 · 메모 유지 · 직접 쓰기 버튼', '만들지 못했어요' in t and memo_kept and page.locator('[data-act="manual"]').count() > 0)
    shot(page, '10-admin-ai-fail', ['.panel[aria-label="초안 미리보기"] .alert', '.panel[aria-label="초안 미리보기"] [data-act="manual"]'])
    page.uncheck('#fFail')

    # F2 생성
    page.click('[data-act="gen"]'); page.wait_for_timeout(200)
    loading = page.locator('.loading').count() > 0
    page.wait_for_timeout(1400)
    ok = all(page.input_value(i).strip() for i in ['#dTitle', '#dReq', '#dDid', '#dResult'])
    badge = page.inner_text('.panel[aria-label="초안 미리보기"] .badge')
    rec('A-03', 'F2', '메모로 초안 생성', '로딩 표시 후 제목·요청·과정·결과 채움, 출처 배지 표시', loading and ok and bool(badge), f'배지: {badge}')
    shot(page, '08-admin-draft-edit', ['#dTitle', '#dReq', '#dDid', '#dResult', '.panel[aria-label="초안 미리보기"] .badge'])

    # F3 편집 -> 미리보기
    page.fill('#dTitle', '분위기는 지키고 첫인상은 새로')
    btns = page.locator('.actions .btn')
    tops = set(round(btns.nth(i).bounding_box()['y']) for i in range(btns.count()))
    rec('A-04', 'F3', '초안 버튼 배치', '게시하기 · 미리보기 · 다시 만들기 · 초안 저장 4개가 한 줄', btns.count() == 4 and len(tops) == 1, f'버튼 {btns.count()}개, 줄 {len(tops)}개')
    page.click('[data-dview="preview"]'); page.wait_for_timeout(200)
    pv = page.inner_text('.pv')
    rec('A-05', 'F3', '게시 화면 미리보기', '편집한 제목이 게시 화면 형태로 보임', '분위기는 지키고 첫인상은 새로' in pv and '01' in pv)
    shot(page, '09-admin-preview', ['.pv-t', '.pv .meta-s', '.actions'])

    # F3 게시
    page.click('[data-act="publish"]'); page.wait_for_timeout(400)
    rows = page.inner_text('.tbl')
    rec('A-06', 'F3', '게시하기', '작업 목록 맨 위에 “게시” 상태로 추가', rows.split('\n')[1].startswith('분위기는 지키고') and '게시' in rows.split('\n')[1])

    # F6 SNS
    c1 = page.inner_text('#copyText')
    lines = [l for l in c1.split('\n') if l.strip() and not l.startswith('#')]
    emoji_front = sum(1 for l in lines if ord(l[0]) > 0x2000)
    page.click('[data-act="nextCopy"]'); page.wait_for_timeout(150)
    c2 = page.inner_text('#copyText')
    rec('A-07', 'F6', '인스타그램 문구 · 다른 문구 보기', '이모지가 줄 앞에 오고, 다른 문구로 바뀜', emoji_front >= len(lines) - 1 and c1 != c2, f'이모지 줄 앞 {emoji_front}/{len(lines)}')
    page.click('[data-act="copy"]'); page.wait_for_timeout(300)
    rec('A-08', 'F6', '문구 복사', '“복사했어요” 표시', '복사했어요' in page.inner_text('#copyToast'))
    rec('A-09', 'F6', '비핸스 탭 삭제', '인스타그램 문구만 표시', '비핸스' not in page.inner_text('#app'))
    shot(page, '11-admin-published-sns', ['#copyText', '[data-act="nextCopy"]', '.tbl tbody tr:first-child'])

    # F3 초안 저장 -> 홈 미노출
    page.goto(URL + '#admin'); page.wait_for_timeout(200)
    page.fill('#fName', '비공개 테스트 작업'); page.fill('#fReq', '테스트 요청'); page.fill('#fDid', '테스트'); page.fill('#fRes', '테스트')
    page.click('[data-act="manual"]'); page.wait_for_timeout(200)
    page.click('[data-act="saveDraft"]'); page.wait_for_timeout(300)
    page.goto(URL + '#home'); page.wait_for_timeout(300)
    home = page.inner_text('#work')
    rec('A-10', 'F3 · F4', '직접 쓰기 후 초안 저장', '홈에 노출되지 않고, 게시한 작업만 홈에 표시', '비공개 테스트 작업' not in home and '분위기는 지키고' in home)

    # ================= 사용자 =================
    page.click('#logToggle'); page.click('#logClear'); page.click('#logToggle')
    shot(page, '01-user-home', ['#askForm', '.ex'])
    page.click('#askForm button[type=submit]'); page.wait_for_timeout(150)
    rec('U-01', 'F5', '한 줄 의뢰 빈 입력', '“한 줄로 적어주세요” 안내', '한 줄로 적어주세요' in page.inner_text('.hero'))
    page.fill('#askQ', '카페 로고를 새로 만들고 싶어요'); page.click('#askForm button[type=submit]'); page.wait_for_timeout(500)
    hint = page.inner_text('.hint')
    content = page.input_value('#h-form [data-v="c"]')
    chip = page.locator('#h-form [data-pick="브랜딩"]').get_attribute('aria-pressed')
    rec('U-02', 'F5', '한 줄 의뢰 → 관련 작업 · 의뢰서 미리 채움', '브랜딩 추정, 관련 작업 표시, 내용 자동 입력', '브랜딩' in hint and content.startswith('카페 로고') and chip == 'true')

    def name_err(v):
        page.fill('#h-form [data-v="n"]', v); page.locator('#h-form [data-v="e"]').focus(); page.wait_for_timeout(80)
        return page.inner_text('#h-err-n')
    cases = {'ㅊㅇㅈ': '자음이나 모음', '최ㅇ재': '자음이나 모음', '홍1': '한글이나 영어', 'J': '두 글자', '최연재': '', 'Yeonjae Choi': ''}
    res = {k: name_err(k) for k in cases}
    ok = all((v == '' and res[k] == '') or (v and v in res[k]) for k, v in cases.items())
    rec('U-03', 'F5', '이름 검증 (6개 입력)', '한글·영어 이름 통과, 자음·모음만/숫자/한 글자는 안내', ok, ', '.join(f'{k}→{"통과" if not res[k] else "막힘"}' for k in cases))

    def mail_err(v):
        page.fill('#h-form [data-v="e"]', v); page.locator('#h-form [data-v="n"]').focus(); page.wait_for_timeout(80)
        return page.inner_text('#h-err-e')
    mcases = {'abc': '@가 빠졌어요', 'a@b': '형식', 'a@@b.com': '형식', 'a@b..com': '형식', 'name@example.com': ''}
    mres = {k: mail_err(k) for k in mcases}
    ok = all((v == '' and mres[k] == '') or (v and v in mres[k]) for k, v in mcases.items())
    rec('U-04', 'F5', '이메일 검증 (5개 입력)', '@ 없음·잘못된 형식은 안내, 올바른 주소만 통과', ok, ', '.join(f'{k}→{"통과" if not mres[k] else "막힘"}' for k in mcases))
    page.fill('#h-form [data-v="n"]', 'ㅊㅇㅈ'); page.fill('#h-form [data-v="e"]', 'abc')
    page.click('#h-form button[type=submit]'); page.wait_for_timeout(200)
    shot(page, '03-user-validation', ['#h-err-n', '#h-err-e', '#h-form [data-v="n"]', '#h-form [data-v="e"]'])

    # 레퍼런스
    page.locator('#h-form [data-ref]').first.click(); page.wait_for_timeout(150)
    pressed = page.locator('#h-form [data-ref][aria-pressed="true"]').count()
    page.fill('#h-form [data-linkin]', 'www.example.com'); page.click('#h-form [data-act="addLink"]'); page.wait_for_timeout(150)
    bad_link = 'https://' in page.inner_text('#h-form .refbox')
    page.fill('#h-form [data-linkin]', 'https://www.instagram.com/p/example'); page.click('#h-form [data-act="addLink"]'); page.wait_for_timeout(150)
    links = page.locator('#h-form .linkitem').count()
    page.set_input_files('#h-form [data-files]', [os.path.join(FIX, 'ref.png'), os.path.join(FIX, 'note.txt')]); page.wait_for_timeout(300)
    files = page.locator('#h-form .file').count()
    file_err = '이미지 파일만' in page.inner_text('#h-err-files')
    up = page.locator('#h-form .upl').bounding_box()
    rec('U-05', 'F5', '레퍼런스 첨부', '내 작업 선택 · 잘못된 링크 안내 · 이미지만 업로드', pressed == 1 and bad_link and links == 1 and files == 1 and file_err,
        f'작업 {pressed}개, 링크 {links}개, 사진 {files}장, txt 거부 {file_err}')

    # 정렬
    boxes = [page.locator(f'#h-form .fields .lab:nth-child({i}) input, #h-form .fields .lab:nth-child({i}) select').first.bounding_box() for i in range(1, 5)]
    same_h = len(set(round(b['height']) for b in boxes)) == 1
    same_w = len(set(round(b['width']) for b in boxes)) == 1
    rec('U-06', 'F5', '희망 일정 · 예산 · 이름 · 이메일 정렬', '네 칸의 높이와 너비가 같음', same_h and same_w, f'높이 {set(round(b["height"]) for b in boxes)}, 너비 {set(round(b["width"]) for b in boxes)}')

    page.fill('#h-form [data-v="n"]', '최연재'); page.fill('#h-form [data-v="e"]', 'name@example.com')
    page.fill('#h-form [data-v="w"]', time.strftime('%Y-%m-%d', time.localtime(time.time() + 30 * 86400)))
    page.locator('#askResult').scroll_into_view_if_needed()
    shot(page, '02-user-ask-form', ['#h-form .mywork [aria-pressed="true"]', '#h-form .file', '#h-form .linkitem', '#h-err-files'])
    page.click('#h-form button[type=submit]'); page.wait_for_timeout(300)
    done = page.inner_text('#askResult')
    rec('U-07', 'F5', '정상 제출', '접수 화면에 분야·레퍼런스 개수 표시', '접수됐어요' in done and '레퍼런스 3개' in done)
    shot(page, '04-user-done', ['#askResult .done'])

    # 상세 + 이전/다음
    page.goto(URL + '#home'); page.wait_for_timeout(200)
    page.locator('#work .card').first.click(); page.wait_for_timeout(300)
    title1 = page.inner_text('.article h1')
    no_inline = page.locator('.article [data-cta]').count() == 0
    rec('U-08', 'F4', '작업 상세 의뢰 입구 정리', '본문 의뢰 버튼 없음, 하단 배너에만 의뢰 버튼', no_inline and page.locator('.band [data-cta="case_band"]').count() == 1)
    shot(page, '05-user-case-pager', ['.pg', '.band [data-cta="case_band"]'])
    page.click('.pg a[rel="next"]'); page.wait_for_timeout(300)
    title2 = page.inner_text('.article h1')
    page.click('.pg a[rel="prev"]'); page.wait_for_timeout(300)
    rec('U-09', 'F4', '다른 프로젝트 보기 (이전 · 다음)', '다음 → 다른 작업, 이전 → 원래 작업', title2 != title1 and page.inner_text('.article h1') == title1)

    page.click('.band [data-cta="case_band"]'); page.wait_for_timeout(300)
    dlg_open = page.locator('#reqDialog[open]').count() == 1
    rec('U-10', 'F5', '하단 배너 의뢰하기 → 의뢰 창', '폼만 있는 창이 열리고, “~에서 넘어왔어요” 문구 없음', dlg_open and '넘어왔어요' not in page.inner_text('#reqDialog'))
    up = page.locator('#reqDialog .upl')
    bb = up.bounding_box()
    rec('U-11', 'F5', '사진 선택 버튼 표기', '+ 아이콘과 ‘사진 선택’이 가로 한 줄', bb['height'] < 60, f'버튼 높이 {round(bb["height"])}px')
    rec('U-12', 'F5', '희망 일정 입력 방식', '날짜 직접 선택, ‘선택’ 표시 없음', page.locator('#reqDialog input[type=date]').count() == 1 and '희망 일정 선택' not in page.inner_text('#reqDialog').replace('\n', ' '))
    page.locator('#reqDialog textarea').first.click()
    shot(page, '06-user-dialog', ['#reqDialog .upl', '#reqDialog .fields'])
    page.fill('#reqDialog [data-v="c"]', '상세페이지 리뉴얼'); page.fill('#reqDialog [data-v="n"]', 'Yeonjae Choi'); page.fill('#reqDialog [data-v="e"]', 'yj@example.com')
    page.click('#reqDialog button[type=submit]'); page.wait_for_timeout(300)
    page.locator('#reqDialog [data-act="reqClose"]').first.click(); page.wait_for_timeout(200)
    page.click('#logToggle'); page.wait_for_timeout(100)
    log = page.inner_text('#logList')
    order = [n for n in ['case_view', 'case_cta_click', 'form_start', 'form_submit']]
    pos = [log.find(n) for n in order]  # 목록은 최신이 위: 마지막 의뢰 흐름은 아래에서 위로 이어짐
    rec('U-13', 'F8', 'GA4 퍼널 이벤트', 'case_view → case_cta_click → form_start → form_submit 순서로 기록', all(x >= 0 for x in pos) and pos == sorted(pos, reverse=True), ' > '.join(order))

    # 모바일
    m = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1).new_page()
    m.route('**/fonts.g*/**', lambda r: r.abort())
    m.goto(URL + '#home'); m.wait_for_timeout(300)
    sw = m.evaluate('document.documentElement.scrollWidth')
    rec('N-01', '비기능', '모바일(390px) 가로 넘침', '페이지가 옆으로 밀리지 않음', sw <= 390, f'scrollWidth {sw}')
    b.close()

json.dump(R, open(os.path.join(SHOTS, 'test-results.json'), 'w'), ensure_ascii=False, indent=1)
print(sum(r['ok'] for r in R), '/', len(R))
