// 관리자용 글 삭제 · 수정 버튼 (글 관리, 글 목록, 글 상세에서 같이 써요)
import { db, doc, getDoc, deleteDoc, friendlyError } from "./firebase.js";
import { imageIds } from "./sanitize.js";
import { deleteImage } from "./images.js";

// 글과 그 글에 쓰인 사진을 함께 지워요 (사진 삭제가 실패해도 글 삭제는 유지)
export async function deletePost(id, data) {
  let p = data;
  if (!p) { const snap = await getDoc(doc(db, "posts", id)); p = snap.exists() ? snap.data() : {}; }
  await deleteDoc(doc(db, "posts", id));
  const ids = new Set([...imageIds(p.contentHtml || ""), p.coverImageId].filter(Boolean));
  await Promise.allSettled([...ids].map((x) => deleteImage(x)));
}

// [수정] [삭제] 버튼 묶음. 삭제는 그 자리에서 한 번 더 확인해요.
// editHref: 수정 화면 주소, onDeleted: 지운 뒤 할 일, onError: 오류 문구 보여주기
export function adminButtons({ id, data, editHref, onDeleted, onError, small = true }) {
  const box = document.createElement("div");
  box.className = "admin-actions";
  const edit = document.createElement("a");
  edit.className = "btn btn-outline"; edit.textContent = "수정"; edit.href = editHref;
  const del = document.createElement("button");
  del.type = "button"; del.className = "btn btn-outline"; del.textContent = "삭제";
  if (small) box.classList.add("small");

  del.addEventListener("click", () => {
    del.hidden = true; edit.hidden = true;
    const q = document.createElement("span"); q.className = "confirm-q"; q.textContent = "정말 삭제할까요?";
    const yes = document.createElement("button"); yes.type = "button"; yes.className = "btn btn-danger"; yes.textContent = "삭제";
    const no = document.createElement("button"); no.type = "button"; no.className = "btn btn-outline"; no.textContent = "취소";
    const reset = () => { q.remove(); yes.remove(); no.remove(); del.hidden = false; edit.hidden = false; };
    no.addEventListener("click", reset);
    yes.addEventListener("click", async () => {
      yes.disabled = true; no.disabled = true; yes.textContent = "삭제 중…";
      try { await deletePost(id, data); onDeleted(); }
      catch (err) { reset(); onError(friendlyError(err)); }
    });
    box.append(q, yes, no);
    no.focus();
  });
  box.append(edit, del);
  return box;
}
