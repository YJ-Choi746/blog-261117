// 이미지 올리기 · 불러오기
// Firebase Storage는 이 프로젝트에서 유료 요금제(Blaze)가 필요해서, 무료로 쓰려고
// 이미지를 브라우저에서 줄인 뒤 Firestore의 images 컬렉션에 문서 하나씩 저장해요.
// (Firestore 문서 한 개는 1MB까지라서, 그보다 작아질 때까지 줄여요.)
import { db, collection, addDoc, doc, getDoc, deleteDoc, serverTimestamp } from "./firebase.js";

const MAX_SIDE = 2000;          // 긴 변 최대 px (화질 우선, 크면 아래에서 단계적으로 줄여요)
const MAX_CHARS = 900000;       // 저장 문자열 최대 길이 (1MB 제한보다 여유 있게)
const cache = new Map();        // id → data URL

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("이미지를 읽을 수 없어요.")); };
    img.src = url;
  });
}

// 큰 이미지를 한 번에 줄이면 흐려져서, 절반씩 여러 번 줄여요 (선명하게)
function drawScaled(img, nw, nh, w, h) {
  let src = img, sw = nw, sh = nh;
  while (sw / 2 >= w && sh / 2 >= h) {
    const c = document.createElement("canvas");
    c.width = Math.round(sw / 2); c.height = Math.round(sh / 2);
    const cx = c.getContext("2d"); cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = "high";
    cx.drawImage(src, 0, 0, c.width, c.height);
    src = c; sw = c.width; sh = c.height;
  }
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#FFFFFF"; // 투명 배경은 흰색으로
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, w, h);
  return canvas;
}

// 파일 → 줄인 data URL. 같은 용량에서 더 선명한 WebP를 먼저 쓰고, 안 되는 브라우저는 JPEG.
// 화질(0.92 → 0.86 → 0.8)을 먼저 낮춰 보고, 그래도 크면 크기를 15%씩 줄여요.
export async function compressImage(file) {
  if (!file || !/^image\//.test(file.type)) throw new Error("이미지 파일만 올릴 수 있어요.");
  const img = await loadImage(file);
  return compressFrom(img, img.naturalWidth, img.naturalHeight);
}
// 이미지 · canvas(원래 크기 nw × nh) → 줄인 data URL
function compressFrom(img, nw, nh) {
  let scale = Math.min(1, MAX_SIDE / Math.max(nw, nh));
  for (let round = 0; round < 10; round++) {
    const w = Math.max(1, Math.round(nw * scale));
    const h = Math.max(1, Math.round(nh * scale));
    const canvas = drawScaled(img, nw, nh, w, h);
    for (const q of [0.92, 0.86, 0.8]) {
      let data = canvas.toDataURL("image/webp", q);
      if (!data.startsWith("data:image/webp")) data = canvas.toDataURL("image/jpeg", q);
      if (data.length <= MAX_CHARS) return { data, width: w, height: h };
    }
    scale *= 0.85;
  }
  throw new Error("이미지가 너무 커서 줄일 수 없어요.");
}

// 잘라낸 canvas → 저장 → { id, data } (작업 편집 '자르기')
export async function uploadCanvas(canvas, ownerUid, name = "cropped") {
  const { data, width, height } = compressFrom(canvas, canvas.width, canvas.height);
  const ref = await addDoc(collection(db, "images"), { data, width, height, ownerUid, name: String(name).slice(0, 120), createdAt: serverTimestamp() });
  cache.set(ref.id, data);
  return { id: ref.id, data, width, height };
}

// 파일 → 저장 → { id, data }
export async function uploadImage(file, ownerUid) {
  const { data, width, height } = await compressImage(file);
  const ref = await addDoc(collection(db, "images"), {
    data, width, height, ownerUid, name: String(file.name || "").slice(0, 120), createdAt: serverTimestamp()
  });
  cache.set(ref.id, data);
  return { id: ref.id, data, width, height };
}

export async function getImageData(id) {
  if (cache.has(id)) return cache.get(id);
  const snap = await getDoc(doc(db, "images", id));
  const data = snap.exists() ? snap.data().data : null;
  if (data && /^data:image\/(jpeg|png|webp|gif);base64,/.test(data)) {
    cache.set(id, data);
    return data;
  }
  return null;
}

// 영역 안 <img data-img> 들에 실제 그림을 채워요
export async function resolveImages(root) {
  const imgs = [...root.querySelectorAll("img[data-img]")];
  await Promise.all(imgs.map(async (img) => {
    try {
      const data = await getImageData(img.getAttribute("data-img"));
      if (data) img.src = data; else img.alt = img.alt || "이미지를 불러올 수 없어요";
    } catch { img.alt = img.alt || "이미지를 불러올 수 없어요"; }
  }));
}

export async function deleteImage(id) {
  cache.delete(id);
  await deleteDoc(doc(db, "images", id));
}
