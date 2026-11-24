// 사이트 언어 바꾸기 (한국어 ⇄ English) — 방문자 페이지 전용, 관리자 화면에는 넣지 않아요.
// - 헤더 '작업' 메뉴 왼쪽에 국기 동그라미 버튼을 넣어요. 누르면 언어가 바뀌고, 고른 언어는 이 브라우저에 기억해요.
// - 화면의 고정 문구(메뉴 · 버튼 · 안내)만 아래 사전으로 바꿔요. 운영자가 쓴 글 · 작업 내용은 쓴 언어 그대로예요.
// - 글자는 textContent · setAttribute로만 바꿔요 (innerHTML 없음). 의뢰서 칸의 name · value는 그대로라 메일 내용은 같아요.
(() => {
  const KEY = "jae-lang";
  const T = {
    // 메뉴 · 공통
    "작업": "Work", "기록": "Journal", "서비스": "Services", "프로젝트 의뢰": "Start a project", "관리자": "Admin",
    "주요 메뉴": "Main menu", "닫기": "Close", "카테고리": "Category", "전체": "All", "선택": "optional",
    // 첫 화면
    "생각을 화면으로,": "From ideas to screens,", "화면을": "from screens", "경험": "to experiences", "으로.": ".",
    "웹·앱 디자인과 콘텐츠를 만드는 디자이너입니다. 지금은 바이브코딩으로 디자인을 직접 구현하는 과정을 기록하고 있어요.": "I'm a designer who makes web and app designs and content. Right now I'm documenting how I build my own designs with vibe coding.",
    "의뢰 문의하기": "Request a project", "기록 읽기": "Read the journal",
    "브랜딩": "Branding", "UI/UX 디자인": "UI/UX Design", "콘텐츠 제작": "Content Design", "기타": "Other",
    "바이브코딩": "Vibe coding", "디자인": "Design", "콘텐츠": "Content",
    "로고, 브랜드 컬러·타이포그래피, 브랜드 가이드까지 브랜드의 첫인상을 설계합니다.": "From logos, brand colors and typography to brand guides, I design a brand's first impression.",
    "웹·앱 화면 설계, 사용자 흐름, 디자인 시스템과 프로토타입.": "Web and app screens, user flows, design systems and prototypes.",
    "SNS 카드뉴스, 썸네일, 상세페이지, 브랜드 콘텐츠 디자인.": "Social cards, thumbnails, product detail pages and brand content.",
    "어떤 디자인이": "What do you", "필요하세요?": "need designed?",
    "한 줄만 적어주세요. 비슷한 작업과 함께 의뢰서를 미리 채워드릴게요.": "Just write one line. I'll show similar work and fill in the request form for you.",
    "시작하기": "Start", "예시 문장": "Example sentences",
    "카페 로고를 새로 만들고 싶어요": "I want a new logo for my café", "쇼핑몰 상세페이지가 필요해요": "I need a product page for my online shop", "앱 화면을 다시 정리하고 싶어요": "I want to clean up my app screens",
    "필요한 디자인 한 줄로 적기": "Describe what you need in one line", "예: 동네 카페 로고를 새로 만들고 싶어요": "e.g. I want a new logo for my neighborhood café",
    "미리 채운 의뢰서 마저 쓰기": "Finish the pre-filled request",
    "선택한 작업": "Selected work", "전체 작업 보기 →": "See all work →", "작업을 불러오는 중…": "Loading work…",
    "최근 기록": "Latest journal", "기록을 불러오는 중…": "Loading journal…", "모든 기록 보기 →": "See all entries →",
    "결과물만이 아니라 문제를 푼 과정까지 보여드려요.": "Not just the results — I show how each problem was solved.",
    // 의뢰서
    "함께 만들어요.": "Let's make it together.", "영업일 기준 3일 안에 답장드립니다.": "I'll reply within 3 business days.",
    "남겨주시면 영업일 기준 3일 안에 답장드립니다.": "Leave the details and I'll reply within 3 business days.",
    "필요한 것": "What you need", "분야": "Field", "레퍼런스": "References",
    "원하는 느낌을 보여주시면 설명이 짧아져요.": "Showing the feel you want saves a lot of explaining.",
    "제 작업에서 고르기": "Pick from my work", "게시된 작업이 아직 없어요.": "No published work yet.", "선택됨": "Selected",
    "링크 붙이기": "Add links", "최대 3개": "up to 3", "추가": "Add", "레퍼런스 링크": "Reference link", "링크 삭제": "Remove link",
    "사진 붙이기": "Add photos", "최대 3장": "up to 3", "링크 추가": "Add link", "사진 고르기": "Choose photos",
    "희망 일정": "Preferred date", "예산 범위": "Budget", "선택 안 함": "Not selected", "협의": "To discuss",
    "이름": "Name", "이메일": "Email", "의뢰 보내기": "Send request", "보내는 중…": "Sending…",
    "예: 동네 카페 로고를 새로 만들고 싶어요. 4월 오픈 전에 필요해요. 원하는 느낌을 설명해주시고, 아래 레퍼런스에서 보여주셔도 좋아요.": "e.g. I want a new logo for my neighborhood café before the April opening.\nDescribe the feel you want — you can also show it with references below.", "(선택)": "(optional)",
    "홍길동 또는 Gildong Hong": "Your name",
    "필요한 것을 적어주세요.": "Please describe what you need.",
    "이름을 적어주세요.": "Please enter your name.",
    "자음이나 모음만으로는 이름을 확인할 수 없어요. 올바른 이름을 적어주세요.": "Please enter a real name, not just single Korean letters.",
    "이름은 한글이나 영어로만 적어주세요. 숫자와 기호는 쓸 수 없어요.": "Please use only Korean or English letters in your name.",
    "이름을 두 글자 이상 적어주세요.": "Please enter at least 2 letters.",
    "이메일을 적어주세요.": "Please enter your email.",
    "이메일에 @가 빠졌어요. name@example.com 형식으로 적어주세요.": "Your email is missing @. Please use the name@example.com format.",
    "이메일 주소를 name@example.com 형식으로 적어주세요.": "Please use the name@example.com format.",
    "링크는 https://로 시작하는 주소로 적어주세요.": "Links must start with https://.", "링크를 붙여넣어 주세요.": "Please paste a link.",
    "사진 파일만 첨부할 수 있어요.": "Only image files can be attached.", "10MB가 넘는 사진은 뺐어요.": "Photos over 10MB were left out.",
    "곧 작업을 소개할게요. 의뢰서는 미리 채워 두었어요.": "Work is coming soon. I've pre-filled the request form for you.",
    "분야를 정확히 몰라도 괜찮아요. 최근 작업을 보여드릴게요.": "Not sure of the field? No problem — here's my recent work.",
    "의뢰가 잘 도착했어요.": "Your request has arrived.", "남겨주신 내용을 확인한 뒤 영업일 기준 3일 안에 이메일로 답장드릴게요.": "I'll read it and reply by email within 3 business days.",
    "홈으로 돌아가기": "Back to home",
    // 작업
    "← 선택한 작업": "← Selected work", "요청": "Brief", "과정": "Process", "결과": "Result",
    "업종": "Industry", "기간": "Duration", "맡은 일": "My role", "클라이언트": "Client",
    "다른 프로젝트 보기": "More projects", "이전": "Previous", "다음": "Next", "이런 작업 의뢰하기": "Request work like this",
    "지금 작업을 케이스 스터디로 정리하고 있어요. 곧 문제를 푼 과정까지 보여드릴게요.": "I'm writing up my work as case studies. Soon you'll see how each problem was solved.",
    "지금 작업을 케이스 스터디로 정리하고 있어요.": "I'm writing up my work as case studies.",
    "이 분야의 작업은 아직 없어요.": "No work in this field yet.", "작업을 찾을 수 없어요.": "Work not found.",
    "공개되지 않은 작업이에요.": "This work isn't published.", "공개되지 않았거나 불러올 수 없는 작업이에요.": "This work isn't published or couldn't be loaded.",
    "작업을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.": "Couldn't load work. Please try again shortly.",
    // 기록
    "바이브코딩을 배우며 만든 것, 디자인하며 고민한 것, 콘텐츠를 만드는 방법을 적습니다.": "What I build while learning vibe coding, what I think about while designing, and how I make content.",
    "저장한 글": "Saved", "글을 불러오는 중…": "Loading entries…", "← 기록으로": "← Journal", "공유 링크 복사": "Copy share link",
    "이전 글, 다음 글": "Previous and next entries", "이전 글 · 다음 글": "Previous · Next", "← 이전 글": "← Previous", "다음 글 →": "Next →",
    "← 가장 최근 글로": "← Latest entry", "처음 글로 →": "First entry →",
    "아직 발행된 글이 없어요.": "No entries yet.", "아직 발행된 기록이 없어요.": "No journal entries yet.", "이 카테고리에는 아직 글이 없어요.": "No entries in this category yet.",
    "기록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.": "Couldn't load the journal. Please try again shortly.", "글을 찾을 수 없어요.": "Entry not found.",
    "저장": "Save", "저장됨": "Saved", "저장을 취소했어요.": "Removed from saved.",
    "저장했어요. 이 브라우저에 저장돼요 — 기록 → 저장한 글에서 다시 볼 수 있어요.": "Saved in this browser — find it under Journal → Saved.",
    "저장했어요. 이 브라우저에만 저장돼요 — 기록 → 저장한 글에서 다시 볼 수 있어요.": "Saved in this browser — find it under Journal → Saved.",
    "저장한 글은 이 브라우저에만 저장돼요. 다른 기기에서는 보이지 않아요.": "Saved entries live only in this browser, not on your other devices.",
    "이 브라우저에서는 저장할 수 없어요.": "This browser can't save entries.",
    "공유 링크를 복사했어요. 카카오톡 · SNS에 붙여 넣으세요.": "Link copied. Paste it into a chat or social post.",
    "(제목 없음)": "(Untitled)",
    // 페이지 제목 · 설명
    "Jae — 웹·앱 디자인 & 콘텐츠": "Jae — Web & App Design and Content",
    "웹·앱 디자인과 콘텐츠를 만드는 디자이너의 블로그이자 프로젝트 의뢰 페이지": "Blog and project request page of a web, app and content designer",
    "작업 — Jae": "Work — Jae", "Jae의 작업 — 문제를 푼 과정까지 보여드리는 케이스 스터디": "Jae's work — case studies that show how each problem was solved",
    "기록 — Jae": "Journal — Jae", "바이브코딩, 디자인, 콘텐츠 제작 기록": "Notes on vibe coding, design and content",
    "Jae의 기록 — 브랜딩 · UI/UX · 콘텐츠 디자인": "Jae's journal — Branding · UI/UX · Content design",
    "의뢰 접수 완료 — Jae": "Request received — Jae",
  };
  // 숫자 · 이름이 들어가는 문장
  const P = [
    [/^(.+) 작업이 필요하신 것 같아요\. 이런 작업을 했어요\.$/, (m) => `Looks like you need ${tr(m[1])}. Here's similar work.`],
    [/^링크는 (\d+)개까지 붙일 수 있어요\.$/, (m) => `You can add up to ${m[1]} links.`],
    [/^사진은 (\d+)장까지 첨부할 수 있어요\.$/, (m) => `You can attach up to ${m[1]} photos.`],
    [/^확인이 필요한 칸이 (\d+)개 있어요\.$/, (m) => `${m[1]} field${m[1] === "1" ? " needs" : "s need"} checking.`],
    [/^'(.+)' 카테고리에는 아직 글이 없어요\.$/, (m) => `No entries in '${tr(m[1])}' yet.`],
    [/^첨부 사진 (\d+) 빼기$/, (m) => `Remove photo ${m[1]}`],
    [/^첨부 사진 (\d+)$/, (m) => `Attached photo ${m[1]}`],
    [/^좋아요 (\d+)개$/, (m) => `${m[1]} like${m[1] === "1" ? "" : "s"}`],
  ];
  const tr = (s) => T[s] ?? s;
  function translate(raw) {
    const s = raw.replace(/\s+/g, " ").trim();
    if (!s || !/[가-힣]/.test(s)) return null;
    const keep = (t) => raw.match(/^\s*/)[0] + t + raw.match(/\s*$/)[0]; // 앞뒤 빈칸은 그대로
    if (T[s] !== undefined) return keep(T[s]);
    for (const [re, fn] of P) { const m = s.match(re); if (m) return keep(fn(m)); }
    return null;
  }

  let lang = "ko";
  try { lang = localStorage.getItem(KEY) === "en" ? "en" : "ko"; } catch { /* 저장 안 되는 브라우저 */ }
  const done = []; // [node, attr|null, 원래 값] — 한국어로 돌아갈 때 되돌려요
  const SKIP = "script, style, textarea, [data-no-i18n], .rich, #work-problem, #work-process, #work-result, #post-body";
  const ATTRS = ["placeholder", "aria-label", "title"];

  function applyNode(root) {
    if (root.nodeType === 3) { textNode(root); return; }
    if (root.nodeType !== 1 || root.closest?.(SKIP)) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode: (n) => (n.nodeType === 1 && n.matches(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    let n = root;
    do {
      if (n.nodeType === 3) textNode(n);
      else ATTRS.forEach((a) => { const v = n.getAttribute(a); if (v) { const t = translate(v); if (t) { done.push([n, a, v]); n.setAttribute(a, t); } } });
    } while ((n = w.nextNode()));
  }
  function textNode(n) {
    if (n.parentElement?.closest(SKIP)) return;
    const t = translate(n.nodeValue);
    if (t) { done.push([n, null, n.nodeValue]); n.nodeValue = t; }
  }
  let observer = null;
  function toEnglish() {
    document.documentElement.lang = "en";
    applyNode(document.body);
    const tt = translate(document.title); if (tt) { done.push([document, "title", document.title]); document.title = tt; }
    const d = document.querySelector('meta[name="description"]'); if (d) { const td = translate(d.content); if (td) { done.push([d, "content", d.content]); d.content = td; } }
    observer = new MutationObserver((list) => {
      for (const m of list) {
        if (m.type === "characterData") textNode(m.target);
        else if (m.type === "attributes") applyNode(m.target);
        else m.addedNodes.forEach(applyNode);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  function toKorean() {
    observer?.disconnect(); observer = null;
    document.documentElement.lang = "ko";
    for (const [n, a, v] of done.reverse()) {
      if (a === "title" && n === document) document.title = v;
      else if (a === "content") n.content = v;
      else if (a) n.setAttribute(a, v);
      else n.nodeValue = v;
    }
    done.length = 0;
  }

  // ---- 국기 동그라미 버튼 (선 SVG, 이모지 아님) ----
  const NS = "http://www.w3.org/2000/svg";
  function svgEl(tag, attrs) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; }
  let uid = 0;
  function flag(which) {
    const id = `flag-clip-${++uid}`;
    const svg = svgEl("svg", { width: 28, height: 28, viewBox: "0 0 36 36", "aria-hidden": "true" });
    const defs = svgEl("defs", {}); const cp = svgEl("clipPath", { id }); cp.appendChild(svgEl("circle", { cx: 18, cy: 18, r: 18 })); defs.appendChild(cp); svg.appendChild(defs);
    const g = svgEl("g", { "clip-path": `url(#${id})` });
    if (which === "ko") {
      // 태극기 (국기 색: 빨강 #CD2E3A · 파랑 #0047A0 · 검정)
      g.appendChild(svgEl("rect", { width: 36, height: 36, fill: "#FFFFFF" }));
      const t = svgEl("g", { transform: "rotate(33.69 18 18)" });
      t.appendChild(svgEl("path", { d: "M9 18a9 9 0 0 1 18 0a4.5 4.5 0 0 0 -9 0a4.5 4.5 0 0 1 -9 0z", fill: "#CD2E3A" }));
      t.appendChild(svgEl("path", { d: "M9 18a4.5 4.5 0 0 0 9 0a4.5 4.5 0 0 1 9 0a9 9 0 0 1 -18 0z", fill: "#0047A0" }));
      g.appendChild(t);
      // 네 귀퉁이 괘 (작게, 동그라미 안에 들어오게)
      const bars = (cx, cy, rot, pattern) => {
        const b = svgEl("g", { transform: `rotate(${rot} ${cx} ${cy})` });
        pattern.forEach((broken, i) => {
          const y = cy - 2.6 + i * 2.6;
          if (broken) { b.appendChild(svgEl("rect", { x: cx - 3.2, y, width: 2.8, height: 1.5, fill: "#111111" })); b.appendChild(svgEl("rect", { x: cx + 0.4, y, width: 2.8, height: 1.5, fill: "#111111" })); }
          else b.appendChild(svgEl("rect", { x: cx - 3.2, y, width: 6.4, height: 1.5, fill: "#111111" }));
        });
        g.appendChild(b);
      };
      bars(7.5, 9, -56.31, [0, 0, 0]);   // 건
      bars(28.5, 27, -56.31, [1, 1, 1]); // 곤
      bars(28.5, 9, 56.31, [1, 0, 1]);   // 감
      bars(7.5, 27, 56.31, [0, 1, 0]);   // 리
    } else {
      // 미국 국기 (빨강 #B22234 · 남색 #3C3B6E)
      g.appendChild(svgEl("rect", { width: 36, height: 36, fill: "#FFFFFF" }));
      for (let i = 0; i < 7; i++) g.appendChild(svgEl("rect", { y: i * 5.54, width: 36, height: 2.77, fill: "#B22234" }));
      g.appendChild(svgEl("rect", { width: 17, height: 16.6, fill: "#3C3B6E" }));
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) g.appendChild(svgEl("circle", { cx: 2.4 + c * 4 + (r % 2) * 1.6, cy: 2.4 + r * 3.9, r: 0.8, fill: "#FFFFFF" }));
    }
    svg.appendChild(g);
    svg.appendChild(svgEl("circle", { cx: 18, cy: 18, r: 17.5, fill: "none", stroke: "#D0D0D0", "stroke-width": 1 })); // line-strong
    return svg;
  }
  function makeButton() {
    const b = document.createElement("button");
    b.type = "button"; b.className = "lang-toggle";
    b.style.cssText = "width: 44px; height: 44px; padding: 0; border: 0; border-radius: 999px; background: transparent; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; flex: none";
    const paint = () => {
      b.replaceChildren(flag(lang)); // 지금 언어의 국기
      b.setAttribute("aria-label", lang === "en" ? "Language: English. Switch to Korean (한국어)" : "언어: 한국어. 영어(English)로 바꾸기");
      b.title = lang === "en" ? "한국어로 보기" : "View in English";
    };
    paint();
    b.addEventListener("click", () => {
      lang = lang === "en" ? "ko" : "en";
      try { localStorage.setItem(KEY, lang); } catch { /* 이번 화면에서만 바뀌어요 */ }
      if (lang === "en") toEnglish(); else toKorean();
      paint();
    });
    return b;
  }
  function mount() {
    // 헤더 메뉴의 '작업' 링크 바로 왼쪽
    const nav = document.querySelector('header nav[aria-label="주요 메뉴"], header nav.nav');
    if (nav) {
      const work = [...nav.querySelectorAll("a")].find((a) => /(^#work$|works\.html)/.test(a.getAttribute("href") || ""));
      nav.insertBefore(makeButton(), work || nav.firstChild);
    }
    if (lang === "en") toEnglish();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
})();
