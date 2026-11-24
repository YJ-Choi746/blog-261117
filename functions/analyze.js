// v0.2 의뢰 기능: AI 분석 핵심 로직 (Firebase와 분리해 테스트할 수 있게 둠)
// - 입력: 의뢰 분야, 예산 선택값, 프로젝트 내용 (이름·이메일은 받지 않음)
// - mode "check": missing만 / mode "full": 전체
// - 파싱 실패 · 타임아웃 · API 오류는 throw 하지 않고 { ok: false, reason }으로 돌려줘요 → 화면은 실패 대체 경로로

import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT, PROMPT_VERSION, buildUserMessage } from "./prompt.js";

export const MODEL = "claude-opus-5-5";
export const MISSING_KEYS = ["schedule", "budget", "scope", "reference"];
export const CATEGORIES = ["branding", "uiux", "content", "other"];
export const FITS = ["high", "medium", "low"];
export const MAX_CONTENT = 3000; // 건당 비용 상한 (PRD 7)
const MIN_CONTENT = 5;

// 모드별 설정. check는 5초 목표라 재시도 없이 짧게 끊어요.
export const MODE_CONFIG = {
  check: { effort: "low", maxTokens: 4000, timeoutMs: 4500, maxRetries: 0 },
  full: { effort: "medium", maxTokens: 8000, timeoutMs: 60000, maxRetries: 1 },
};

const FULL_SCHEMA = {
  type: "object",
  properties: {
    missing: { type: "array", items: { type: "string", enum: MISSING_KEYS } },
    summary: { type: "string" },
    category: { type: "string", enum: CATEGORIES },
    fit: { type: "string", enum: FITS },
    fit_reason: { type: "string" },
    is_spam: { type: "boolean" },
    reply_draft: { type: "string" },
  },
  required: ["missing", "summary", "category", "fit", "fit_reason", "is_spam", "reply_draft"],
  additionalProperties: false,
};

const CHECK_SCHEMA = {
  type: "object",
  properties: { missing: FULL_SCHEMA.properties.missing },
  required: ["missing"],
  additionalProperties: false,
};

export class InputError extends Error {}

// 클라이언트가 보낸 값을 검사·정리. 잘못되면 InputError.
export function validateInput(data) {
  if (!data || typeof data !== "object") throw new InputError("요청 형식이 올바르지 않아요.");
  const mode = data.mode;
  if (mode !== "check" && mode !== "full") throw new InputError("mode는 check 또는 full이어야 해요.");

  let categories = data.categories ?? [];
  if (typeof categories === "string") categories = [categories];
  if (!Array.isArray(categories) || categories.length > 4 || !categories.every((c) => typeof c === "string" && c.length <= 30)) {
    throw new InputError("의뢰 분야 형식이 올바르지 않아요.");
  }

  const budget = data.budget ?? "";
  if (typeof budget !== "string" || budget.length > 50) throw new InputError("예산 형식이 올바르지 않아요.");

  const content = typeof data.content === "string" ? data.content.trim() : "";
  if (content.length < MIN_CONTENT) throw new InputError("프로젝트 내용이 너무 짧아요.");
  if (content.length > MAX_CONTENT) throw new InputError(`프로젝트 내용은 ${MAX_CONTENT}자 이하로 보내주세요.`);

  return { mode, categories: categories.map((c) => c.trim()).filter(Boolean), budget: budget.trim(), content };
}

// 모델 출력(문자열)을 JSON으로 읽고 규격에 맞는지 확인. 실패하면 null.
export function parseResult(text, mode) {
  if (typeof text !== "string") return null;
  let raw = text.trim();
  // 혹시 코드 블록으로 감싸 오면 벗겨요
  const fence = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fence) raw = fence[1];
  let obj;
  try { obj = JSON.parse(raw); } catch { return null; }
  if (!obj || typeof obj !== "object" || !Array.isArray(obj.missing)) return null;

  const missing = [...new Set(obj.missing)].filter((m) => MISSING_KEYS.includes(m));
  if (mode === "check") return { missing };

  const ok = typeof obj.summary === "string"
    && CATEGORIES.includes(obj.category)
    && FITS.includes(obj.fit)
    && typeof obj.fit_reason === "string"
    && typeof obj.is_spam === "boolean"
    && typeof obj.reply_draft === "string";
  if (!ok) return null;
  return {
    missing,
    summary: obj.summary,
    category: obj.category,
    fit: obj.fit,
    fit_reason: obj.fit_reason,
    is_spam: obj.is_spam,
    reply_draft: obj.reply_draft,
  };
}

// 실패 원인을 짧은 코드로 (로그·화면용. 키나 원문은 담지 않아요)
export function classifyError(err) {
  if (err instanceof Anthropic.APIConnectionTimeoutError) return "timeout";
  if (err instanceof Anthropic.RateLimitError) return "rate_limited";
  if (err instanceof Anthropic.AuthenticationError) return "auth";
  if (err instanceof Anthropic.BadRequestError) return "bad_request";
  if (err instanceof Anthropic.APIConnectionError) return "connection";
  if (err instanceof Anthropic.APIError) return "api_error";
  return "unknown";
}

// 실제 분석. client는 테스트에서 가짜로 바꿔 넣을 수 있어요.
export async function analyze(input, { client, apiKey } = {}) {
  const cfg = MODE_CONFIG[input.mode];
  const started = Date.now();
  const c = client ?? new Anthropic({ apiKey, timeout: cfg.timeoutMs, maxRetries: cfg.maxRetries });

  let response;
  try {
    response = await c.beta.messages.create({
      model: MODEL,
      max_tokens: cfg.maxTokens,
      // 안전 분류기가 거절하면 서버가 다른 모델로 다시 시도해요
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: {
        effort: cfg.effort,
        format: { type: "json_schema", schema: input.mode === "check" ? CHECK_SCHEMA : FULL_SCHEMA },
      },
      system: SYSTEM_PROMPT + (input.mode === "check" ? "\n\n이번 요청은 누락 항목(missing)만 판단합니다." : ""),
      messages: [{ role: "user", content: buildUserMessage(input) }],
    });
  } catch (err) {
    return { ok: false, reason: classifyError(err), ms: Date.now() - started, promptVersion: PROMPT_VERSION };
  }

  const ms = Date.now() - started;
  if (response.stop_reason === "refusal") return { ok: false, reason: "refusal", ms, promptVersion: PROMPT_VERSION };
  if (response.stop_reason === "max_tokens") return { ok: false, reason: "max_tokens", ms, promptVersion: PROMPT_VERSION };

  const text = (response.content ?? []).filter((b) => b.type === "text").map((b) => b.text).join("");
  const result = parseResult(text, input.mode);
  if (!result) return { ok: false, reason: "parse_error", ms, promptVersion: PROMPT_VERSION };
  return { ok: true, result, ms, promptVersion: PROMPT_VERSION };
}
