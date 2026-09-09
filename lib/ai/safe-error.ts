import { AIError, isAIError } from "@/lib/ai/errors";

export type SafeAIError = {
  code: string;
  message: string;
};

const GENERIC_MESSAGE = "AI generation failed.";

const SENSITIVE_ERROR_PATTERNS = [
  /api[_-]?key/i,
  /authorization/i,
  /bearer\s+[a-z0-9._-]+/i,
  /token/i,
  /password/i,
  /secret/i,
  /cookie/i,
  /session/i,
  /credential/i,
  /prompt/i,
  /messages?/i,
  /content/i,
];

function containsSensitiveInformation(message: string): boolean {
  return SENSITIVE_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

function sanitizeErrorMessage(message: string): string {
  const normalized = message.trim();

  if (!normalized) {
    return GENERIC_MESSAGE;
  }

  if (containsSensitiveInformation(normalized)) {
    return GENERIC_MESSAGE;
  }

  if (normalized.length > 500) {
    return `${normalized.slice(0, 500)}…`;
  }

  return normalized;
}

export function toSafeAIError(error: unknown): SafeAIError {
  if (isAIError(error)) {
    return {
      code: error.code,
      message: sanitizeErrorMessage(error.message),
    };
  }

  if (error instanceof Error) {
    return {
      code: "GENERATION_ERROR",
      message: sanitizeErrorMessage(error.message),
    };
  }

  return {
    code: "INTERNAL_ERROR",
    message: GENERIC_MESSAGE,
  };
}

export function toSafeAIErrorMessage(error: unknown): string {
  return toSafeAIError(error).message;
}

export function isSafeAIError(error: unknown): error is AIError {
  return isAIError(error);
}
