// Firebase Functions 진입점
// analyzeRequest: v0.2 의뢰 기능 AI 분석 함수 (onCall)
// - API 키는 Secret Manager의 ANTHROPIC_API_KEY에만 둬요 (코드·로그·커밋에 없음)
//     firebase functions:secrets:set ANTHROPIC_API_KEY
// - mode "check"는 누구나(의뢰 폼), mode "full"은 관리자 로그인 필수

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions";
import { analyze, validateInput, InputError } from "./analyze.js";
import { generateCase, validateCaseInput, CaseInputError, generateSns, validateSnsInput } from "./casestudy.js";

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");

// firestore.rules의 관리자 UID와 같은 값 (계정을 바꾸면 둘 다 바꿔요)
const ADMIN_UID = "MSBbFHuHxmUeHxF1UJ687xZsXeF3";

// 사이트 주소에서 온 요청만 받아요
const ALLOWED_ORIGINS = [
  "https://blog---261117.web.app",
  "https://blog---261117.firebaseapp.com",
  "https://yj-choi746.github.io",
];

export const analyzeRequest = onCall(
  {
    region: "asia-northeast3", // 서울
    secrets: [ANTHROPIC_API_KEY],
    cors: ALLOWED_ORIGINS,
    timeoutSeconds: 90,
    memory: "256MiB",
    maxInstances: 3, // 남용 시 비용 상한
  },
  async (request) => {
    let input;
    try {
      input = validateInput(request.data);
    } catch (err) {
      if (err instanceof InputError) throw new HttpsError("invalid-argument", err.message);
      throw err;
    }

    if (input.mode === "full" && request.auth?.uid !== ADMIN_UID) {
      throw new HttpsError("permission-denied", "관리자만 사용할 수 있어요.");
    }

    const out = await analyze(input, { apiKey: ANTHROPIC_API_KEY.value() });

    // 로그에는 결과 코드와 시간만 남겨요 (의뢰 원문 · 키 미기록)
    logger.info("analyzeRequest", { mode: input.mode, ok: out.ok, reason: out.reason ?? null, ms: out.ms, len: input.content.length });

    // ok:false여도 오류로 던지지 않아요 → 화면은 실패 대체(점검 생략 후 제출) 경로로
    return out;
  }
);

// generateCaseStudy: PRD v1.1 F5 AI 케이스 스터디 초안 (관리자 전용)
export const generateCaseStudy = onCall(
  {
    region: "asia-northeast3",
    secrets: [ANTHROPIC_API_KEY],
    cors: ALLOWED_ORIGINS,
    timeoutSeconds: 60,
    memory: "256MiB",
    maxInstances: 2,
  },
  async (request) => {
    if (request.auth?.uid !== ADMIN_UID) throw new HttpsError("permission-denied", "관리자만 사용할 수 있어요.");
    let input;
    try {
      input = validateCaseInput(request.data);
    } catch (err) {
      if (err instanceof CaseInputError) throw new HttpsError("invalid-argument", err.message);
      throw err;
    }
    const out = await generateCase(input, { apiKey: ANTHROPIC_API_KEY.value() });
    logger.info("generateCaseStudy", { ok: out.ok, reason: out.reason ?? null, ms: out.ms, warnings: out.warnings ? out.warnings.unsupportedNumbers.length : 0 });
    return out; // 실패해도 throw 안 함 → 화면은 직접 쓰기(F6)
  }
);

// generateSnsCopy: PRD v1.1 F7 인스타그램 문구 3안 · 해시태그 (관리자 전용)
export const generateSnsCopy = onCall(
  { region: "asia-northeast3", secrets: [ANTHROPIC_API_KEY], cors: ALLOWED_ORIGINS, timeoutSeconds: 60, memory: "256MiB", maxInstances: 2 },
  async (request) => {
    if (request.auth?.uid !== ADMIN_UID) throw new HttpsError("permission-denied", "관리자만 사용할 수 있어요.");
    let input;
    try {
      input = validateSnsInput(request.data);
    } catch (err) {
      if (err instanceof CaseInputError) throw new HttpsError("invalid-argument", err.message);
      throw err;
    }
    const out = await generateSns(input, { apiKey: ANTHROPIC_API_KEY.value() });
    logger.info("generateSnsCopy", { ok: out.ok, reason: out.reason ?? null, ms: out.ms });
    return out; // 실패해도 throw 안 함 → 화면에서 직접 작성
  }
);
