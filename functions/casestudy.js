// PRD v0.5 F2 AI 케이스 스터디 생성 — 핵심 로직 (Firebase와 분리해 테스트)
// - 입력: 작업명 · 분야 · 업종 · 기간 · 메모(요청 / 한 일 / 결과), 클라이언트 실명은 공개 동의 시에만 전달
// - 출력: { title, summary, problem, process, result, tags[] } JSON
// - 메모에 없는 숫자가 초안에 나오면 warnings로 알려줘요 (H2 "메모에 없는 사실 0건" 점검)
// - 실패(타임아웃 · 파싱 · API 오류)는 throw 하지 않고 { ok: false, reason } → 화면은 빈 템플릿(F7)으로

import Anthropic from "@anthropic-ai/sdk";
import { MODEL, classifyError } from "./analyze.js";
import { CASE_SYSTEM_PROMPT, CASE_PROMPT_VERSION, buildCaseMessage } from "./casestudy-prompt.js";

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
