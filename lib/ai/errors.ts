export type AIErrorCode =
  | "INVALID_REQUEST"
  | "UNSUPPORTED_OPERATION"
  | "UNSUPPORTED_STREAMING"
  | "PROVIDER_NOT_CONFIGURED"
  | "PROVIDER_NOT_SUPPORTED"
  | "MODEL_NOT_SUPPORTED"
  | "MODEL_NOT_PERMITTED"
  | "GENERATION_CANCELLED"
  | "GENERATION_TIMEOUT"
  | "EMPTY_RESPONSE"
  | "PROVIDER_ERROR"
  | "GENERATION_ERROR"
  | "PERSISTENCE_ERROR"
  | "CREDITS_ERROR"
  | "INTERNAL_ERROR";

export type AIErrorDetails = {
  provider?: string;
  model?: string;
  operation?: string;
  requestId?: string;
};

export class AIError extends Error {
  readonly code: AIErrorCode;
  readonly details?: AIErrorDetails;
  readonly cause?: unknown;

  constructor(
    code: AIErrorCode,
    message: string,
    options?: {
      details?: AIErrorDetails;
      cause?: unknown;
    },
  ) {
    super(message);

    this.name = "AIError";
    this.code = code;
    this.details = options?.details;
    this.cause = options?.cause;
  }
}

export function isAIError(error: unknown): error is AIError {
  return error instanceof AIError;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message || "";
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (
      error as {
        message?: unknown;
      }
    ).message;

    if (typeof message === "string") {
      return message;
    }
  }

  return "";
}

function getErrorName(error: unknown): string {
  if (error instanceof Error) {
    return error.name || "";
  }

  if (typeof error === "object" && error !== null && "name" in error) {
    const name = (
      error as {
        name?: unknown;
      }
    ).name;

    if (typeof name === "string") {
      return name;
    }
  }

  return "";
}

function getErrorCode(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (
      error as {
        code?: unknown;
      }
    ).code;

    if (typeof code === "string") {
      return code;
    }
  }

  return "";
}

function getErrorStatus(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (
      error as {
        status?: unknown;
      }
    ).status;

    if (typeof status === "number" && Number.isFinite(status)) {
      return status;
    }
  }

  return undefined;
}

function isAbortError(error: unknown): boolean {
  const name = getErrorName(error).toLowerCase();

  const code = getErrorCode(error).toLowerCase();

  const message = getErrorMessage(error).toLowerCase();

  return (
    name === "aborterror" ||
    code === "aborted" ||
    code === "abort_err" ||
    message.includes("aborted") ||
    message.includes("abort")
  );
}

function isTimeoutError(error: unknown): boolean {
  const name = getErrorName(error).toLowerCase();

  const code = getErrorCode(error).toLowerCase();

  const message = getErrorMessage(error).toLowerCase();

  return (
    name.includes("timeout") ||
    code.includes("timeout") ||
    code === "etimedout" ||
    message.includes("timeout") ||
    message.includes("timed out")
  );
}

function isProviderError(error: unknown): boolean {
  const status = getErrorStatus(error);

  const code = getErrorCode(error).toLowerCase();

  /*
   * HTTP failures from an external AI provider
   * are provider failures.
   */
  if (status !== undefined && status >= 400) {
    return true;
  }

  return (
    code.startsWith("openai") ||
    code.startsWith("rate_limit") ||
    code === "insufficient_quota" ||
    code === "invalid_api_key" ||
    code === "model_not_found" ||
    code === "server_error"
  );
}

function classifyUnknownError(error: unknown): AIErrorCode {
  if (isAbortError(error)) {
    return "GENERATION_CANCELLED";
  }

  if (isTimeoutError(error)) {
    return "GENERATION_TIMEOUT";
  }

  if (isProviderError(error)) {
    return "PROVIDER_ERROR";
  }

  return "GENERATION_ERROR";
}

export function normalizeAIError(
  error: unknown,
  fallbackMessage = "AI generation failed.",
): AIError {
  if (isAIError(error)) {
    return error;
  }

  const code = classifyUnknownError(error);

  let message = getErrorMessage(error).trim();

  /*
   * Never expose unknown structured
   * error objects directly.
   */
  if (!message) {
    message = fallbackMessage;
  }

  if (message.length > 500) {
    message = `${message.slice(0, 500)}…`;
  }

  return new AIError(code, message, {
    cause: error,
  });
}
