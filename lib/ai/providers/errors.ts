import type { AIOperation } from "@/lib/ai/operations";

import { AIError, isAIError, normalizeAIError } from "@/lib/ai/errors";

export function createProviderError({
  provider,
  operation,
  model,
  error,
}: {
  provider: string;
  operation: AIOperation;
  model: string;
  error: unknown;
}): AIError {
  if (isAIError(error)) {
    return error;
  }

  const normalized = normalizeAIError(error, "AI provider request failed.");

  /*
   * Preserve explicit cancellation and timeout
   * classifications.
   */
  if (
    normalized.code === "GENERATION_CANCELLED" ||
    normalized.code === "GENERATION_TIMEOUT"
  ) {
    return new AIError(normalized.code, normalized.message, {
      details: {
        ...normalized.details,
        provider,
        operation,
        model,
      },
      cause: normalized.cause ?? error,
    });
  }

  return new AIError("PROVIDER_ERROR", normalized.message, {
    details: {
      ...normalized.details,
      provider,
      operation,
      model,
    },
    cause: normalized.cause ?? error,
  });
}

export function createProviderNotConfiguredError(
  provider: string,
  operation: AIOperation,
): AIError {
  return new AIError(
    "PROVIDER_NOT_CONFIGURED",
    `AI provider "${provider}" is not configured.`,
    {
      details: {
        provider,
        operation,
      },
    },
  );
}
