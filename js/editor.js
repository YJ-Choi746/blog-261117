// 글쓰기 에디터 — 서식 도구, 사진 넣기, 붙여넣기 정리, 링크
// 브라우저의 contenteditable + execCommand를 써요 (오래된 방식이지만 모든 주요 브라우저에서 동작하고,
// 실행 취소(Ctrl+Z)가 자연스럽게 돼요). 저장할 때는 sanitize.js가 허용한 것만 남겨요.
import { FONTS, SIZES, COLORS, HIGHLIGHTS, sanitizeToFragment } from "./sanitize.js";

const BLOCK_TAGS = ["P", "H2", "H3", "BLOCKQUOTE", "PRE", "LI", "FIGURE", "UL", "OL", "HR", "DIV"];

export function setupEditor({ editor, toolbar, imgBar, paper, onChange, onImageFiles, onCoverPick, linkDialog }) {
  let savedRange = null;
  let selectedImg = null;

  const exec = (cmd, value = null) => document.execCommand(cmd, false, value);
  try { exec("defaultParagraphSeparator", "p"); } catch { /* 일부 브라우저는 무시 */ }
  if (!editor.firstChild) editor.appendChild(emptyPara());

  function emptyPara() { const p = document.createElement("p"); p.appendChild(document.createElement("br")); return p; }

  // ---------- 선택 영역 기억 (툴바를 눌러도 선택이 풀리지 않게) ----------
  function inEditor(node) { return node && (node === editor || editor.contains(node)); }
  document.addEventListener("selectionchange", () => {
    const s = getSelection();
    if (s.rangeCount && inEditor(s.anchorNode)) {
      savedRange = s.getRangeAt(0).cloneRange();
      updateState();
    }
  });
  function restore() {
    // 지금 선택이 에디터 안이면 그걸 우선 써요 (selectionchange 이벤트보다 버튼이 먼저 눌린 경우)
    const cur = getSelection();
    if (cur.rangeCount && inEditor(cur.anchorNode)) savedRange = cur.getRangeAt(0).cloneRange();
    editor.focus({ preventScroll: true });
    if (savedRange) { const s = getSelection(); s.removeAllRanges(); s.addRange(savedRange); }
  }
  function changed() { updateCount(); onChange(); }

  // ---------- 툴바 채우기 ----------
  const fontSel = toolbar.querySelector("#tb-font");
  const sizeSel = toolbar.querySelector("#tb-size");
  const blockSel = toolbar.querySelector("#tb-block");
  fontSel.replaceChildren(...FONTS.map((f) => { const o = new Option(f.label, f.id); o.style.fontFamily = f.css; return o; }));
  sizeSel.replaceChildren(...SIZES.map((s) => new Option(String(s), String(s))));
  sizeSel.value = "17";

  function makeSwatches(panel, colors, onPick, withNone) {
    const btns = colors.map((c) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "swatch"; b.style.background = c; b.setAttribute("aria-label", `색 ${c}`);
      b.addEventListener("mousedown", (e) => e.preventDefault());
      b.addEventListener("click", () => { onPick(c); panel.hidden = true; });
      return b;
    });
    if (withNone) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "swatch swatch-none"; b.textContent = "없음"; b.setAttribute("aria-label", "배경 색 없음");
      b.addEventListener("mousedown", (e) => e.preventDefault());
      b.addEventListener("click", () => { onPick(null); panel.hidden = true; });
      btns.push(b);
    }
    panel.replaceChildren(...btns);
  }
  const popColor = toolbar.querySelector("#pop-color");
  const popHl = toolbar.querySelector("#pop-hl");
  makeSwatches(popColor, COLORS, (c) => {
    restore(); exec("styleWithCSS", true); exec("foreColor", c);
    toolbar.querySelector("#color-bar").style.background = c; changed();
  });
  makeSwatches(popHl, HIGHLIGHTS, (c) => {
    restore(); exec("styleWithCSS", true); exec("hiliteColor", c || "transparent"); changed();
  }, true);
  function togglePop(btn, panel) {
    const open = panel.hidden;
    [popColor, popHl].forEach((p) => { p.hidden = true; });
    toolbar.querySelectorAll("[aria-expanded]").forEach((b) => b.setAttribute("aria-expanded", "false"));
    panel.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
  }
  const colorBtn = toolbar.querySelector("#tb-color");
  const hlBtn = toolbar.querySelector("#tb-hl");
  [colorBtn, hlBtn].forEach((b) => b.addEventListener("mousedown", (e) => e.preventDefault()));
  colorBtn.addEventListener("click", () => togglePop(colorBtn, popColor));
  hlBtn.addEventListener("click", () => togglePop(hlBtn, popHl));
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".pop")) { popColor.hidden = true; popHl.hidden = true; colorBtn.setAttribute("aria-expanded", "false"); hlBtn.setAttribute("aria-expanded", "false"); }
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { popColor.hidden = true; popHl.hidden = true; hideImgBar(); } });

  // ---------- 명령 버튼 ----------
  toolbar.querySelectorAll("[data-cmd]").forEach((btn) => {
    btn.addEventListener("mousedown", (e) => e.preventDefault());
    btn.addEventListener("click", () => {
      restore();
      const cmd = btn.dataset.cmd;
      if (cmd === "formatBlock") toggleBlock(btn.dataset.value);
      else if (cmd === "insertHorizontalRule") { exec("insertHorizontalRule"); ensureTrailingPara(); }
      else exec(cmd);
      changed(); updateState();
    });
  });

  function currentBlock() {
    let n = savedRange ? savedRange.startContainer : null;
    while (n && n !== editor) {
      if (n.nodeType === 1 && BLOCK_TAGS.includes(n.tagName)) return n;
      n = n.parentNode;
    }
    return null;
  }
  function toggleBlock(tag) {
    const b = currentBlock();
    const target = b && b.tagName.toLowerCase() === tag ? "p" : tag;
    exec("formatBlock", `<${target}>`);
  }
  blockSel.addEventListener("change", () => { restore(); exec("formatBlock", `<${blockSel.value}>`); changed(); updateState(); });

  fontSel.addEventListener("change", () => {
    const f = FONTS.find((x) => x.id === fontSel.value);
    restore(); exec("styleWithCSS", true); exec("fontName", f.css); changed();
  });

  sizeSel.addEventListener("change", () => {
    const px = `${sizeSel.value}px`;
    restore();
    exec("styleWithCSS", false);
    exec("fontSize", "7");
    // 브라우저가 만든 <font size="7"> 또는 font-size: xxx-large 를 고른 px 크기로 바꿔요
    editor.querySelectorAll('font[size="7"]').forEach((f) => {
      const span = document.createElement("span");
      span.style.fontSize = px;
      while (f.firstChild) span.appendChild(f.firstChild);
      f.replaceWith(span);
    });
    editor.querySelectorAll("span").forEach((s) => { if (s.style.fontSize === "xxx-large" || s.style.fontSize === "-webkit-xxx-large") s.style.fontSize = px; });
    exec("styleWithCSS", true);
    changed();
  });

  // ---------- 지금 서식을 툴바에 표시 ----------
  function updateState() {
    toolbar.querySelectorAll("[data-cmd][aria-pressed]").forEach((btn) => {
      let on = false;
      try { on = document.queryCommandState(btn.dataset.cmd); } catch { on = false; }
      btn.setAttribute("aria-pressed", String(on));
    });
    const b = currentBlock();
    const tag = b ? b.tagName.toLowerCase() : "p";
    blockSel.value = ["h2", "h3", "blockquote", "pre"].includes(tag) ? tag : "p";
    let el = savedRange ? savedRange.startContainer : null;
    if (el && el.nodeType === 3) el = el.parentNode;
    if (el && inEditor(el)) {
      const cs = getComputedStyle(el);
      const first = cs.fontFamily.split(",")[0].replace(/['"]/g, "").trim().toLowerCase();
      const f = FONTS.find((x) => x.match.includes(first));
      if (f) fontSel.value = f.id;
      const px = Math.round(parseFloat(cs.fontSize));
      if (SIZES.includes(px)) sizeSel.value = String(px);
    }
  }

  // ---------- 글자 수 ----------
  const countEl = document.getElementById("char-count");
  function updateCount() {
    const t = editor.textContent || "";
    countEl.textContent = `글자 수 ${t.length.toLocaleString()} (공백 제외 ${t.replace(/\s/g, "").length.toLocaleString()})`;
  }

  // ---------- 링크 ----------
  const linkBtn = toolbar.querySelector("#tb-link");
  const linkUrl = linkDialog.querySelector("#link-url");
  const linkErr = linkDialog.querySelector("#link-error");
  linkBtn.addEventListener("mousedown", (e) => e.preventDefault());
  linkBtn.addEventListener("click", () => { linkUrl.value = ""; linkErr.hidden = true; linkDialog.showModal(); linkUrl.focus(); });
  linkDialog.querySelector("#link-cancel").addEventListener("click", () => linkDialog.close());
  linkDialog.querySelector("#link-form").addEventListener("submit", (e) => {
    const url = linkUrl.value.trim();
    if (!/^https?:\/\/\S+$/i.test(url)) { e.preventDefault(); linkErr.hidden = false; return; }
    linkDialog.close();
    restore();
    const s = getSelection();
    if (s.rangeCount && !s.getRangeAt(0).collapsed) exec("createLink", url);
    else {
      const a = document.createElement("a"); a.href = url; a.textContent = url;
      insertNodeAtCaret(a);
    }
    changed();
  });

  function insertNodeAtCaret(node) {
    restore();
    const s = getSelection();
    if (!s.rangeCount) { editor.appendChild(node); return; }
    const r = s.getRangeAt(0);
    // 조각(DocumentFragment)은 넣고 나면 비어서 부모가 없어요 → 마지막 자식 뒤로 커서를 옮겨요
    const last = node.nodeType === 11 ? node.lastChild : node;
    r.deleteContents();
    r.insertNode(node);
    if (last && last.parentNode) r.setStartAfter(last);
    r.collapse(true);
    s.removeAllRanges(); s.addRange(r);
    savedRange = r.cloneRange();
  }

  // ---------- 사진 ----------
  const fileInput = toolbar.querySelector("#image-input");
  const imgBtn = toolbar.querySelector("#tb-image");
  imgBtn.addEventListener("mousedown", (e) => e.preventDefault());
  imgBtn.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    const files = [...fileInput.files];
    fileInput.value = "";
    if (files.length) onImageFiles(files);
  });

  function topBlockAt(range) {
    let n = range ? range.startContainer : null;
    while (n && n.parentNode !== editor) n = n.parentNode;
    return n && n.parentNode === editor ? n : null;
  }
  function ensureTrailingPara() {
    const last = editor.lastElementChild;
    if (!last || last.tagName !== "P") editor.appendChild(emptyPara());
  }

  // 업로드된 사진을 지금 위치(문단 다음)에 넣어요
  function insertImage({ id, data }) {
    const fig = document.createElement("figure");
    const img = document.createElement("img");
    img.setAttribute("data-img", id);
    img.setAttribute("alt", "");
    img.src = data;
    fig.appendChild(img);
    const block = topBlockAt(savedRange);
    if (block) {
      const isEmpty = block.tagName === "P" && !(block.textContent || "").trim() && !block.querySelector("img");
      if (isEmpty) block.replaceWith(fig); else block.after(fig);
    } else editor.appendChild(fig);
    let next = fig.nextElementSibling;
    if (!next || next.tagName !== "P") { next = emptyPara(); fig.after(next); }
    const r = document.createRange(); r.setStart(next, 0); r.collapse(true);
    savedRange = r;
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    changed();
  }

  // 붙여넣기: 사진 파일이면 올리고, 글이면 허용된 서식만 남겨서 넣어요
  editor.addEventListener("paste", (e) => {
    const dt = e.clipboardData;
    if (!dt) return;
    const files = [...dt.files].filter((f) => /^image\//.test(f.type));
    e.preventDefault();
    if (files.length) { onImageFiles(files); return; }
    const html = dt.getData("text/html");
    if (html) {
      insertNodeAtCaret(sanitizeToFragment(html));
    } else {
      exec("insertText", dt.getData("text/plain"));
    }
    changed();
  });

  // 끌어다 놓기
  editor.addEventListener("dragover", (e) => { if ([...e.dataTransfer.types].includes("Files")) e.preventDefault(); });
  editor.addEventListener("drop", (e) => {
    const files = [...e.dataTransfer.files].filter((f) => /^image\//.test(f.type));
    if (!files.length) return;
    e.preventDefault();
    const r = document.caretRangeFromPoint ? document.caretRangeFromPoint(e.clientX, e.clientY) : null;
    if (r && inEditor(r.startContainer)) savedRange = r;
    onImageFiles(files);
  });

  // ---------- 사진 도구 (사진을 누르면) ----------
  function hideImgBar() { imgBar.hidden = true; if (selectedImg) selectedImg.classList.remove("selected"); selectedImg = null; }
  function showImgBar(img) {
    if (selectedImg) selectedImg.classList.remove("selected");
    selectedImg = img; img.classList.add("selected");
    const size = img.getAttribute("data-size") || "full";
    imgBar.querySelectorAll("[data-img-size]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.imgSize === size)));
    const pr = paper.getBoundingClientRect(); const ir = img.getBoundingClientRect();
    imgBar.style.top = `${ir.top - pr.top + 8}px`;
    imgBar.style.left = `${Math.max(8, ir.left - pr.left + 8)}px`;
    imgBar.hidden = false;
  }
  editor.addEventListener("click", (e) => { if (e.target.tagName === "IMG") showImgBar(e.target); else hideImgBar(); });
  imgBar.addEventListener("mousedown", (e) => e.preventDefault());
  imgBar.querySelectorAll("[data-img-size]").forEach((b) => b.addEventListener("click", () => {
    if (!selectedImg) return;
    if (b.dataset.imgSize === "full") selectedImg.removeAttribute("data-size"); else selectedImg.setAttribute("data-size", b.dataset.imgSize);
    showImgBar(selectedImg); changed();
  }));
  imgBar.querySelector("#img-cover").addEventListener("click", () => { if (selectedImg) { onCoverPick(selectedImg.getAttribute("data-img"), selectedImg.src); hideImgBar(); } });
  imgBar.querySelector("#img-delete").addEventListener("click", () => {
    if (!selectedImg) return;
    const fig = selectedImg.closest("figure");
    (fig && editor.contains(fig) ? fig : selectedImg).remove();
    hideImgBar(); ensureTrailingPara(); changed();
  });

  editor.addEventListener("input", () => { if (!editor.firstChild) editor.appendChild(emptyPara()); changed(); });
  editor.addEventListener("keyup", updateState);

  return {
    insertImage,
    setContent(fragment) { editor.replaceChildren(fragment); if (!editor.firstChild) editor.appendChild(emptyPara()); ensureTrailingPara(); updateCount(); },
    updateCount,
    hideImgBar
  };
}
