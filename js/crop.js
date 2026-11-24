// 관리자 이미지 자르기 (작업 편집). 창을 띄워 자를 영역을 끌어서 정하고, 잘린 canvas를 돌려줘요.
// openCrop(dataUrl) → Promise<HTMLCanvasElement | null> (취소하면 null). innerHTML 없이 요소를 만들어요.
const RATIOS = [["자유", 0], ["1:1", 1], ["4:3", 4 / 3], ["3:4", 3 / 4], ["16:9", 16 / 9]];
const MIN = 0.05; // 최소 크기 (이미지 대비 5%)

function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function openCrop(dataUrl) {
  return new Promise((resolve) => {
    const dlg = el("dialog", "crop-dlg"); dlg.setAttribute("aria-label", "이미지 자르기");
    const top = el("div", "crop-top");
    const title = el("strong", "", "이미지 자르기");
    const ratios = el("div", "crop-ratios"); ratios.setAttribute("role", "group"); ratios.setAttribute("aria-label", "비율");
    top.append(title, ratios);
    const stage = el("div", "crop-stage");
    const img = el("img"); img.alt = "자를 이미지"; img.draggable = false;
    const box = el("div", "crop-box"); box.setAttribute("aria-label", "자를 영역 (끌어서 옮기기)");
    ["nw", "ne", "sw", "se"].forEach((k) => { const h = el("span", `crop-h crop-${k}`); h.dataset.k = k; box.appendChild(h); });
    stage.append(img, box);
    const info = el("p", "crop-info");
    const actions = el("div", "crop-actions");
    const cancel = el("button", "btn btn-outline", "취소"); cancel.type = "button";
    const reset = el("button", "btn btn-text", "처음 영역으로"); reset.type = "button";
    const apply = el("button", "btn btn-dark", "자르기"); apply.type = "button";
    actions.append(reset, cancel, apply);
    dlg.append(top, stage, info, actions);
    document.body.appendChild(dlg);

    let r = { x: 0, y: 0, w: 1, h: 1 }; // 이미지 대비 비율 (0~1)
    let ratio = 0;
    const W = () => img.naturalWidth, H = () => img.naturalHeight;
    function draw() {
      const iw = img.clientWidth, ih = img.clientHeight;
      Object.assign(box.style, { left: `${img.offsetLeft + r.x * iw}px`, top: `${img.offsetTop + r.y * ih}px`, width: `${r.w * iw}px`, height: `${r.h * ih}px` });
      info.textContent = `${Math.round(r.w * W())} × ${Math.round(r.h * H())}px`;
    }
    // 비율을 맞춰 가운데에 가장 크게
    function fitRatio() {
      if (!ratio) return;
      const imgRatio = W() / H();
      let w = 1, h = 1;
      if (ratio > imgRatio) h = imgRatio / ratio; else w = ratio / imgRatio;
      r = { x: (1 - w) / 2, y: (1 - h) / 2, w, h };
    }
    RATIOS.forEach(([t, v]) => {
      const b = el("button", "crop-ratio", t); b.type = "button"; b.setAttribute("aria-pressed", String(v === 0));
      b.addEventListener("click", () => { ratio = v; ratios.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); if (v) fitRatio(); else r = { x: 0, y: 0, w: 1, h: 1 }; draw(); });
      ratios.appendChild(b);
    });
    reset.addEventListener("click", () => { if (ratio) fitRatio(); else r = { x: 0, y: 0, w: 1, h: 1 }; draw(); });

    // 끌기: 영역 안 → 옮기기, 모서리 → 크기
    box.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      const k = e.target.dataset.k || "move";
      const sx = e.clientX, sy = e.clientY, r0 = { ...r };
      const iw = img.clientWidth, ih = img.clientHeight;
      const move = (ev) => {
        const dx = (ev.clientX - sx) / iw, dy = (ev.clientY - sy) / ih;
        if (k === "move") { r.x = clamp(r0.x + dx, 0, 1 - r0.w); r.y = clamp(r0.y + dy, 0, 1 - r0.h); draw(); return; }
        // 모서리: 반대쪽 모서리는 고정
        const ax = k.includes("w") ? r0.x + r0.w : r0.x, ay = k.includes("n") ? r0.y + r0.h : r0.y;
        let px = clamp((k.includes("w") ? r0.x : r0.x + r0.w) + dx, 0, 1), py = clamp((k.includes("n") ? r0.y : r0.y + r0.h) + dy, 0, 1);
        let w = Math.max(MIN, Math.abs(px - ax)), h = Math.max(MIN, Math.abs(py - ay));
        if (ratio) { // 픽셀 비율 유지: w*W / (h*H) = ratio
          const hFromW = (w * W()) / ratio / H();
          if (hFromW <= h) h = hFromW; else w = (h * H() * ratio) / W();
          const maxW = k.includes("w") ? ax : 1 - ax, maxH = k.includes("n") ? ay : 1 - ay;
          if (w > maxW) { w = maxW; h = (w * W()) / ratio / H(); }
          if (h > maxH) { h = maxH; w = (h * H() * ratio) / W(); }
        } else {
          w = Math.min(w, k.includes("w") ? ax : 1 - ax); h = Math.min(h, k.includes("n") ? ay : 1 - ay);
        }
        r = { x: k.includes("w") ? ax - w : ax, y: k.includes("n") ? ay - h : ay, w, h };
        draw();
      };
      const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
      window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
    });
    // 키보드: 화살표로 영역 옮기기
    box.tabIndex = 0;
    box.addEventListener("keydown", (e) => {
      const d = e.shiftKey ? 0.05 : 0.01;
      const m = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] }[e.key];
      if (!m) return; e.preventDefault();
      r.x = clamp(r.x + m[0], 0, 1 - r.w); r.y = clamp(r.y + m[1], 0, 1 - r.h); draw();
    });

    const onResize = () => draw();
    function done(result) { window.removeEventListener("resize", onResize); dlg.close(); dlg.remove(); resolve(result); }
    cancel.addEventListener("click", () => done(null));
    dlg.addEventListener("cancel", (e) => { e.preventDefault(); done(null); });
    apply.addEventListener("click", () => {
      const sx = Math.round(r.x * W()), sy = Math.round(r.y * H());
      const sw = Math.max(1, Math.round(r.w * W())), sh = Math.max(1, Math.round(r.h * H()));
      const c = document.createElement("canvas"); c.width = sw; c.height = sh;
      const ctx = c.getContext("2d"); ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, sw, sh);
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      done(c);
    });
    img.onload = () => { draw(); };
    window.addEventListener("resize", onResize);
    img.src = dataUrl;
    dlg.showModal();
    if (img.complete) requestAnimationFrame(draw);
  });
}
