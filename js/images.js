// 이미지 올리기 · 불러오기
// Firebase Storage는 이 프로젝트에서 유료 요금제(Blaze)가 필요해서, 무료로 쓰려고
// 이미지를 브라우저에서 줄인 뒤 Firestore의 images 컬렉션에 문서 하나씩 저장해요.
// (Firestore 문서 한 개는 1MB까지라서, 그보다 작아질 때까지 줄여요.)
import { db, collection, addDoc, doc, getDoc, deleteDoc, serverTimestamp } from "./firebase.js";

const MAX_SIDE = 1600;          // 긴 변 최대 px
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

// 파일 → 줄인 JPEG data URL
export async function compressImage(file) {
  if (!file || !/^image\//.test(file.type)) throw new Error("이미지 파일만 올릴 수 있어요.");
  const img = await loadImage(file);
  let scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  let quality = 0.85;
  for (let tries = 0; tries < 8; tries++) {
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#FFFFFF"; // 투명 배경은 흰색으로
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const data = canvas.toDataURL("image/jpeg", quality);
    if (data.length <= MAX_CHARS) return { data, width: w, height: h };
    if (quality > 0.6) quality -= 0.1; else scale *= 0.8;
  }
  throw new Error("이미지가 너무 커서 줄일 수 없어요.");
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
