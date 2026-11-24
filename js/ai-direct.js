// 관리자 전용: 운영자가 직접 넣은 Anthropic API 키로 브라우저에서 바로 AI 초안 · 인스타그램 문구를 만들어요 (D30).
// - 서버 함수(generateCaseStudy · generateSnsCopy)를 배포하지 않아도 쓸 수 있어요.
// - 키는 이 브라우저에만 둬요: 기본은 탭을 닫으면 지워지는 sessionStorage, "기억하기"를 켜면 localStorage.
//   Firestore · GA · 로그 · 커밋에는 절대 보내거나 남기지 않아요. 방문자 화면에서는 이 파일을 쓰지 않아요.
// - 규칙(프롬프트 · 출력 모양 · 메모에 없는 숫자 경고)은 서버 함수(functions/casestudy.js)와 같아요.
import { CASE_SYSTEM_PROMPT, CASE_PROMPT_VERSION, buildCaseMessage, SNS_SYSTEM_PROMPT, SNS_PROMPT_VERSION, buildSnsMessage } from "./ai-prompt.js";

const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-opus-5-5"; // functions/analyze.js와 같은 모델
const KEY_NAME = "jae-ai-key";

// ---- 키 보관 (이 브라우저에만) ----
export function getKey() {
  try { return sessionStorage.getItem(KEY_NAME) || localStorage.getItem(KEY_NAME) || ""; } catch { return ""; }
}
export function isRemembered() {
  try { return !!localStorage.getItem(KEY_NAME); } catch { return false; }
}
export function setKey(key, remember) {
  clearKey();
  const k = String(key || "").trim();
  if (!k) return;
  try { (remember ? localStorage : sessionStorage).setItem(KEY_NAME, k); } catch { /* 저장 안 되는 브라우저 */ }
}
export function clearKey() {
  try { sessionStorage.removeItem(KEY_NAME); localStorage.removeItem(KEY_NAME); } catch { /* 무시 */ }
}
export const looksLikeKey = (k) => /^sk-ant-[A-Za-z0-9_-]{20,}$/.test(String(k || "").trim());

// ---- 출력 모양 (서버 함수와 같음) ----
const CASE_SCHEMA = {
  type: "object",
  properties: { title: { type: "string" }, summary: { type: "string" }, problem: { type: "string" }, process: { type: "string" }, result: { type: "string" }, tags: { type: "array", items: { type: "string" } } },
  required: ["title", "summary", "problem", "process", "result", "tags"],
  additionalProperties: false,
};
const SNS_SCHEMA = {
  type: "object",
  properties: { captions: { type: "array", items: { type: "string" } }, hashtags: { type: "array", items: { type: "string" } } },
  required: ["captions", "hashtags"],
  additionalProperties: false,
};

function parseJson(text) {
  let raw = String(text || "").trim();
  const fence = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fence) raw = fence[1];
  try { return JSON.parse(raw); } catch { return null; }
}
export function parseCase(text) {
  const o = parseJson(text);
  if (!o || typeof o !== "object") return null;
  for (const k of ["title", "summary", "problem", "process", "result"]) if (typeof o[k] !== "string" || !o[k].trim()) return null;
  if (!Array.isArray(o.tags)) return null;
  const tags = [...new Set(o.tags.filter((t) => typeof t === "string").map((t) => t.replace(/^#/, "").trim()).filter(Boolean))].slice(0, 6);
  return { title: o.title.trim(), summary: o.summary.trim(), problem: o.problem.trim(), process: o.process.trim(), result: o.result.trim(), tags };
}
export function parseSns(text) {
  const o = parseJson(text);
  if (!o || !Array.isArray(o.captions) || !Array.isArray(o.hashtags)) return null;
  const captions = o.captions.filter((c) => typeof c === "string")
    .map((c) => c.replace(/(^|\s)#[^\s#]+/g, "").replace(/[ \t]+\n/g, "\n").trim()).filter(Boolean).slice(0, 3);
  if (!captions.length) return null;
  const hashtags = [...new Set(o.hashtags.filter((t) => typeof t === "string").map((t) => t.replace(/^#+/, "").replace(/\s+/g, "")).filter(Boolean))].slice(0, 5);
  return { captions, hashtags };
}
// 결과에 나온 숫자 중 입력에 없는 것 ("30%"와 "30"은 같은 숫자)
export function unsupportedNumbers(text, sources) {
  const nums = (x) => (String(x).match(/\d+(?:[.,]\d+)*/g) || []).map((n) => n.replace(/,/g, ""));
  const src = new Set(nums(sources.join(" ")));
  return [...new Set(nums(text))].filter((n) => !src.has(n));
}

// ---- 호출 ----
// 실패해도 throw 하지 않고 { ok: false, reason } (서버 함수와 같은 모양) → 화면은 문장 틀로 채워요
async function callClaude({ key, system, user, schema, effort, maxTokens, timeoutMs = 60000 }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2026-10-21",
        "anthropic-beta": "server-side-fallback-2026-07-01",
        "anthropic-dangerous-direct-browser-access": "true", // 브라우저에서 직접 부르기 (키는 운영자 본인 것)
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        fallbacks: "default", // 안전 분류기가 거절하면 서버가 다른 모델로 다시 시도
        output_config: { effort, format: { type: "json_schema", schema } },
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) {
      const reason = res.status === 401 ? "키가 맞지 않아요" : res.status === 403 ? "이 키로는 쓸 수 없어요"
        : res.status === 429 ? "요청이 많아요. 잠시 뒤 다시" : res.status === 400 ? "요청 형식 오류(크레딧 부족일 수 있어요)"
        : res.status >= 500 ? "AI 서버가 바빠요" : `오류 ${res.status}`;
      return { ok: false, reason };
    }
    const body = await res.json();
    if (body.stop_reason === "refusal") return { ok: false, reason: "AI가 답하지 않았어요" };
    if (body.stop_reason === "max_tokens") return { ok: false, reason: "답이 길어 잘렸어요" };
    const text = (body.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    return { ok: true, text };
  } catch (err) {
    return { ok: false, reason: err && err.name === "AbortError" ? "시간이 너무 걸렸어요" : "인터넷 연결을 확인해 주세요" };
  } finally {
    clearTimeout(timer);
  }
}

export async function generateCaseDirect(input, key = getKey()) {
  const started = Date.now();
  const meta = () => ({ ms: Date.now() - started, promptVersion: `${CASE_PROMPT_VERSION}-direct` });
  const r = await callClaude({ key, system: CASE_SYSTEM_PROMPT, user: buildCaseMessage(input), schema: CASE_SCHEMA, effort: "medium", maxTokens: 8000 });
  if (!r.ok) return { ...r, ...meta() };
  const draft = parseCase(r.text);
  if (!draft) return { ok: false, reason: "답을 읽지 못했어요", ...meta() };
  const nums = unsupportedNumbers([draft.title, draft.summary, draft.problem, draft.process, draft.result, ...draft.tags].join(" "),
    [input.title, input.category, input.industry, input.period, input.client, input.memo.request, input.memo.work, input.memo.result]);
  return { ok: true, result: draft, warnings: nums.length ? { unsupportedNumbers: nums } : null, ...meta() };
}

export async function generateSnsDirect(input, key = getKey()) {
  const started = Date.now();
  const meta = () => ({ ms: Date.now() - started, promptVersion: `${SNS_PROMPT_VERSION}-direct` });
  const r = await callClaude({ key, system: SNS_SYSTEM_PROMPT, user: buildSnsMessage(input), schema: SNS_SCHEMA, effort: "low", maxTokens: 4000 });
  if (!r.ok) return { ...r, ...meta() };
  const draft = parseSns(r.text);
  if (!draft) return { ok: false, reason: "답을 읽지 못했어요", ...meta() };
  const nums = unsupportedNumbers([...draft.captions, ...draft.hashtags].join(" "),
    [input.title, input.summary, input.problem, input.process, input.result, input.category, input.industry, input.client, ...(input.tags || [])]);
  return { ok: true, result: draft, warnings: nums.length ? { unsupportedNumbers: nums } : null, ...meta() };
}
