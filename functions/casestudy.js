// PRD v0.5 F2 AI 케이스 스터디 생성 — 핵심 로직 (Firebase와 분리해 테스트)
// - 입력: 작업명 · 분야 · 업종 · 기간 · 메모(요청 / 한 일 / 결과), 클라이언트 실명은 공개 동의 시에만 전달
// - 출력: { title, summary, problem, process, result, tags[] } JSON
// - 메모에 없는 숫자가 초안에 나오면 warnings로 알려줘요 (H2 "메모에 없는 사실 0건" 점검)
// - 실패(타임아웃 · 파싱 · API 오류)는 throw 하지 않고 { ok: false, reason } → 화면은 빈 템플릿(F7)으로

import Anthropic from "@anthropic-ai/sdk";
import { MODEL, classifyError } from "./analyze.js";
import { CASE_SYSTEM_PROMPT, CASE_PROMPT_VERSION, buildCaseMessage, SNS_SYSTEM_PROMPT, SNS_PROMPT_VERSION, buildSnsMessage } from "./casestudy-prompt.js";

export const CASE_CONFIG = { effort: "medium", maxTokens: 8000, timeoutMs: 25000, maxRetries: 0 }; // PRD: 20초 이내 목표
export const LIMITS = { title: 60, category: 30, industry: 30, period: 30, client: 50, memo: 1500 };

const SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    problem: { type: "string" },
    process: { type: "string" },
    result: { type: "string" },
    tags: { type: "array", items: { type: "string" } },
  },
  required: ["title", "summary", "problem", "process", "result", "tags"],
  additionalProperties: false,
};

export class CaseInputError extends Error {}

const str = (v, max, name, required = false) => {
  const s = typeof v === "string" ? v.trim() : v == null ? "" : null;
  if (s === null) throw new CaseInputError(`${name} 형식이 올바르지 않아요.`);
  if (required && !s) throw new CaseInputError(`${name}을(를) 입력해 주세요.`);
  if (s.length > max) throw new CaseInputError(`${name}은(는) ${max}자 이하로 써 주세요.`);
  return s;
};

export function validateCaseInput(data) {
  if (!data || typeof data !== "object") throw new CaseInputError("요청 형식이 올바르지 않아요.");
  const memo = data.memo && typeof data.memo === "object" ? data.memo : {};
  const out = {
    title: str(data.title, LIMITS.title, "작업명", true),
    category: str(data.category, LIMITS.category, "분야"),
    industry: str(data.industry, LIMITS.industry, "업종"),
    period: str(data.period, LIMITS.period, "기간"),
    client: str(data.client, LIMITS.client, "클라이언트"),
    clientPublic: data.clientPublic === true,
    memo: {
      request: str(memo.request, LIMITS.memo, "요청 메모"),
      work: str(memo.work, LIMITS.memo, "한 일 메모"),
      result: str(memo.result, LIMITS.memo, "결과 메모"),
    },
  };
  if (!out.memo.request && !out.memo.work && !out.memo.result) throw new CaseInputError("메모를 한 칸 이상 써 주세요.");
  return out;
}

export function parseCaseResult(text) {
  if (typeof text !== "string") return null;
  let raw = text.trim();
  const fence = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fence) raw = fence[1];
  let o;
  try { o = JSON.parse(raw); } catch { return null; }
  if (!o || typeof o !== "object") return null;
  for (const k of ["title", "summary", "problem", "process", "result"]) if (typeof o[k] !== "string" || !o[k].trim()) return null;
  if (!Array.isArray(o.tags)) return null;
  const tags = [...new Set(o.tags.filter((t) => typeof t === "string").map((t) => t.replace(/^#/, "").trim()).filter(Boolean))].slice(0, 6);
  return { title: o.title.trim(), summary: o.summary.trim(), problem: o.problem.trim(), process: o.process.trim(), result: o.result.trim(), tags };
}

// 초안에 나온 숫자 중 입력(메모 · 작업 정보)에 없는 것. "30%"와 "30"은 같은 숫자로 봐요.
export function findUnsupportedNumbers(draft, input) {
  const nums = (s) => (String(s).match(/\d+(?:[.,]\d+)*/g) || []).map((n) => n.replace(/,/g, ""));
  const source = new Set(nums([input.title, input.category, input.industry, input.period, input.client, input.memo.request, input.memo.work, input.memo.result].join(" ")));
  const text = [draft.title, draft.summary, draft.problem, draft.process, draft.result, ...(draft.tags || [])].join(" ");
  return [...new Set(nums(text))].filter((n) => !source.has(n));
}

export async function generateCase(input, { client, apiKey } = {}) {
  const started = Date.now();
  const c = client ?? new Anthropic({ apiKey, timeout: CASE_CONFIG.timeoutMs, maxRetries: CASE_CONFIG.maxRetries });
  const meta = () => ({ ms: Date.now() - started, promptVersion: CASE_PROMPT_VERSION });
  let response;
  try {
    response = await c.beta.messages.create({
      model: MODEL,
      max_tokens: CASE_CONFIG.maxTokens,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: CASE_CONFIG.effort, format: { type: "json_schema", schema: SCHEMA } },
      system: CASE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildCaseMessage(input) }],
    });
  } catch (err) {
    return { ok: false, reason: classifyError(err), ...meta() };
  }
  if (response.stop_reason === "refusal") return { ok: false, reason: "refusal", ...meta() };
  if (response.stop_reason === "max_tokens") return { ok: false, reason: "max_tokens", ...meta() };
  const text = (response.content ?? []).filter((b) => b.type === "text").map((b) => b.text).join("");
  const draft = parseCaseResult(text);
  if (!draft) return { ok: false, reason: "parse_error", ...meta() };
  const unsupported = findUnsupportedNumbers(draft, input);
  return { ok: true, result: draft, warnings: unsupported.length ? { unsupportedNumbers: unsupported } : null, ...meta() };
}

// ---- F6 인스타그램 문구 (generateSnsCopy) ----
// 입력은 운영자가 검토한 케이스 스터디(공개될 내용)만. 메모는 쓰지 않아요.
export const SNS_LIMITS = { title: 100, summary: 200, problem: 3000, process: 5000, result: 3000, category: 30, industry: 30, client: 50 };
const SNS_SCHEMA = {
  type: "object",
  properties: { caption: { type: "string" }, hashtags: { type: "array", items: { type: "string" } } },
  required: ["caption", "hashtags"],
  additionalProperties: false,
};

export function validateSnsInput(data) {
  if (!data || typeof data !== "object") throw new CaseInputError("요청 형식이 올바르지 않아요.");
  const out = {
    title: str(data.title, SNS_LIMITS.title, "제목", true),
    summary: str(data.summary, SNS_LIMITS.summary, "한 줄 요약"),
    problem: str(data.problem, SNS_LIMITS.problem, "문제", true),
    process: str(data.process, SNS_LIMITS.process, "과정", true),
    result: str(data.result, SNS_LIMITS.result, "결과", true),
    category: str(data.category, SNS_LIMITS.category, "분야"),
    industry: str(data.industry, SNS_LIMITS.industry, "업종"),
    client: str(data.client, SNS_LIMITS.client, "클라이언트"), // 공개 동의된 이름만 화면에서 보내요
    tags: Array.isArray(data.tags) ? data.tags.filter((t) => typeof t === "string").map((t) => t.slice(0, 20)).slice(0, 8) : [],
  };
  return out;
}

export function parseSnsResult(text) {
  if (typeof text !== "string") return null;
  let raw = text.trim();
  const fence = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fence) raw = fence[1];
  let o;
  try { o = JSON.parse(raw); } catch { return null; }
  if (!o || typeof o.caption !== "string" || !o.caption.trim() || !Array.isArray(o.hashtags)) return null;
  const hashtags = [...new Set(o.hashtags.filter((t) => typeof t === "string").map((t) => t.replace(/^#+/, "").replace(/\s+/g, "")).filter(Boolean))].slice(0, 15);
  return { caption: o.caption.trim(), hashtags };
}

export function findUnsupportedNumbersIn(text, sources) {
  const nums = (x) => (String(x).match(/\d+(?:[.,]\d+)*/g) || []).map((n) => n.replace(/,/g, ""));
  const src = new Set(nums(sources.join(" ")));
  return [...new Set(nums(text))].filter((n) => !src.has(n));
}

export async function generateSns(input, { client, apiKey } = {}) {
  const started = Date.now();
  const c = client ?? new Anthropic({ apiKey, timeout: CASE_CONFIG.timeoutMs, maxRetries: CASE_CONFIG.maxRetries });
  const meta = () => ({ ms: Date.now() - started, promptVersion: SNS_PROMPT_VERSION });
  let response;
  try {
    response = await c.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema: SNS_SCHEMA } },
      system: SNS_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildSnsMessage(input) }],
    });
  } catch (err) {
    return { ok: false, reason: classifyError(err), ...meta() };
  }
  if (response.stop_reason === "refusal") return { ok: false, reason: "refusal", ...meta() };
  if (response.stop_reason === "max_tokens") return { ok: false, reason: "max_tokens", ...meta() };
  const text = (response.content ?? []).filter((b) => b.type === "text").map((b) => b.text).join("");
  const draft = parseSnsResult(text);
  if (!draft) return { ok: false, reason: "parse_error", ...meta() };
  const unsupported = findUnsupportedNumbersIn([draft.caption, ...draft.hashtags].join(" "),
    [input.title, input.summary, input.problem, input.process, input.result, input.category, input.industry, input.client, ...input.tags]);
  return { ok: true, result: draft, warnings: unsupported.length ? { unsupportedNumbers: unsupported } : null, ...meta() };
}
