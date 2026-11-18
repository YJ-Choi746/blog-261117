// 댓글 (PRD FR-06, 관리자 승인제) — 글 상세 아래
// - 승인된 댓글만 보여줘요 (보안 규칙도 승인된 것만 읽게 해요, firestore.rules)
// - 등록하면 status "pending"으로 저장되고, 관리자가 admin/comments.html에서 승인 · 숨김
// - 스팸 방지: 미끼 칸(website), 페이지 연 지 5초 안 등록 막기, 30초 안 재등록 막기, 링크 막기 (링크 · 미끼 칸은 보안 규칙도 막아요)
// - 닉네임 · 내용은 textContent로만 넣어요. GA에는 보내지 않아요.
import { db, collection, addDoc, getDocs, query, where, serverTimestamp, formatDate } from "./firebase.js";

const NICK_MIN = 2, NICK_MAX = 20, BODY_MAX = 500;
const MIN_OPEN_MS = 5000, COOLDOWN_MS = 30000, LAST_KEY = "jae-comment-last";
// 보안 규칙의 링크 검사와 같은 규칙이에요 (firestore.rules)
const LINK_RE = /(https?:\/\/|www[.]|[a-z0-9-][.](com|net|org|kr|io|me|xyz|ly)([^a-z]|$))/i;
const openedAt = Date.now();

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};
function lastSent() { try { return Number(localStorage.getItem(LAST_KEY)) || 0; } catch { return 0; } }
function markSent() { try { localStorage.setItem(LAST_KEY, String(Date.now())); } catch { /* 저장 안 되면 건너뜀 */ } }

// 바깥에서 확인하기 쉽게 따로 내보내요 (테스트용)
export function checkComment({ nickname, body, website }, now = Date.now()) {
  if (website) return "등록하지 못했어요.";
  if (nickname.length < NICK_MIN || nickname.length > NICK_MAX) return `닉네임은 ${NICK_MIN}~${NICK_MAX}자로 써 주세요.`;
  if (!body.length) return "내용을 써 주세요.";
  if (body.length > BODY_MAX) return `내용은 ${BODY_MAX}자까지 쓸 수 있어요.`;
  if (LINK_RE.test(body) || LINK_RE.test(nickname)) return "링크는 넣을 수 없어요. 주소 없이 써 주세요.";
  if (now - openedAt < MIN_OPEN_MS) return "조금만 천천히 써 주세요. 몇 초 뒤에 다시 눌러 주세요.";
  const wait = COOLDOWN_MS - (now - lastSent());
  if (wait > 0) return `댓글은 30초에 한 번 남길 수 있어요. ${Math.ceil(wait / 1000)}초 뒤에 다시 눌러 주세요.`;
  return "";
}

function commentItem(c) {
  const li = el("li", "comment");
  const head = el("p", "comment-head");
  head.append(el("span", "comment-nick", c.nickname), el("span", "comment-date", formatDate(c.createdAt)));
  li.append(head, el("p", "comment-body", c.body));
  return li;
}

// root: 댓글 칸을 넣을 요소 · postId · params: GA 매개변수
export function mountComments(root, postId, params) {
  const col = collection(db, "posts", postId, "comments");

  const title = el("h2", "comments-title", "댓글");
  const count = el("span", "comments-count");
  title.appendChild(count);
  const list = el("ol", "comment-list");
  const empty = el("p", "comments-empty", "아직 공개된 댓글이 없어요. 첫 댓글을 남겨 주세요.");

  // ---------- 입력 폼 ----------
  const form = el("form", "comment-form");
  form.noValidate = true;
  const nickField = el("label", "field");
  nickField.append("닉네임");
  const nick = el("input", "input");
  Object.assign(nick, { name: "nickname", maxLength: NICK_MAX, autocomplete: "nickname", placeholder: "2~20자" });
  nickField.appendChild(nick);

  const bodyField = el("label", "field");
  bodyField.append("내용");
  const body = el("textarea", "textarea");
  Object.assign(body, { name: "body", maxLength: BODY_MAX, rows: 4, placeholder: "질문이나 의견을 남겨 주세요. 링크는 넣을 수 없어요." });
  const counter = el("span", "comment-counter", `0 / ${BODY_MAX}`);
  bodyField.append(body, counter);

  // 미끼 칸: 사람에게는 안 보여요. 자동 프로그램이 채우면 등록되지 않아요 (보안 규칙도 막아요)
  const trap = el("input", "comment-trap");
  Object.assign(trap, { name: "website", tabIndex: -1, autocomplete: "off", type: "text" });
  trap.setAttribute("aria-hidden", "true");

  const submit = el("button", "btn btn-dark", "댓글 남기기");
  submit.type = "submit";
  const note = el("p", "comment-note", "남긴 댓글은 확인 후 공개돼요.");
  const msg = el("p", "comment-msg");
  msg.setAttribute("role", "status");
  msg.hidden = true;
  const actions = el("div", "comment-actions");
  actions.append(submit, note);
  form.append(nickField, bodyField, trap, actions, msg);

  body.addEventListener("input", () => { counter.textContent = `${body.value.length} / ${BODY_MAX}`; });

  const say = (text, isError) => { msg.textContent = text; msg.className = `comment-msg notice ${isError ? "notice-error" : "notice-ok"}`; msg.hidden = false; };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = { nickname: nick.value.trim(), body: body.value.trim(), website: trap.value };
    const problem = checkComment(data);
    if (problem) { say(problem, true); return; }
    submit.disabled = true;
    try {
      await addDoc(col, { nickname: data.nickname, body: data.body, website: "", status: "pending", createdAt: serverTimestamp() });
      markSent();
      body.value = ""; counter.textContent = `0 / ${BODY_MAX}`;
      say("댓글을 남겼어요. 확인 후 공개돼요.", false);
      if (typeof window.trackEvent === "function") window.trackEvent("comment_post", params);
    } catch {
      say("댓글을 남기지 못했어요. 잠시 뒤 다시 시도해 주세요.", true);
    } finally {
      submit.disabled = false;
    }
  });

  root.replaceChildren(title, list, empty, form);
  root.hidden = false;

  // ---------- 승인된 댓글 불러오기 (오래된 것부터) ----------
  getDocs(query(col, where("status", "==", "approved"))).then((snap) => {
    const t = (c) => (c.createdAt && typeof c.createdAt.toMillis === "function" ? c.createdAt.toMillis() : 0);
    const items = snap.docs.map((d) => d.data()).sort((a, b) => t(a) - t(b));
    list.replaceChildren(...items.map(commentItem));
    count.textContent = items.length ? ` ${items.length}` : "";
    empty.hidden = items.length > 0;
    list.hidden = !items.length;
  }).catch(() => { empty.textContent = "댓글을 불러오지 못했어요."; });
}
