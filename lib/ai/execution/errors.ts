import type { AIOperation } from "@/lib/ai/operations";

import { AIError } from "@/lib/ai/errors";

export function createInvalidRequestError(message: string): AIError {
  return new AIError("INVALID_REQUEST", message);
}

export function createUnsupportedOperationError(
  operation: AIOperation,
): AIError {
  return new AIError(
    "UNSUPPORTED_OPERATION",
    `AI operation "${operation}" is not implemented yet.`,
    {
      details: {
        operation,
      },
    },
  );
}

export function createUnsupportedStreamingError(
  operation: AIOperation,
): AIError {
  return new AIError(
    "UNSUPPORTED_STREAMING",
    `AI operation "${operation}" does not support streaming.`,
    {
      details: {
        operation,
      },
    },
  );
}

export function createProviderNotSupportedError(
  operation: AIOperation,
  provider: string,
): AIError {
  return new AIError(
    "PROVIDER_NOT_SUPPORTED",
    `Provider "${provider}" is not permitted for AI operation "${operation}".`,
    {
      details: {
        operation,
        provider,
      },
    },
  );
}

export function createModelNotPermittedError(
  operation: AIOperation,
  model: string,
): AIError {
  return new AIError(
    "MODEL_NOT_PERMITTED",
    `Model "${model}" is not permitted for AI operation "${operation}".`,
    {
      details: {
        operation,
        model,
      },
    },
  );
}

export function createGenerationCancelledError(
  operation?: AIOperation,
): AIError {
  return new AIError("GENERATION_CANCELLED", "AI generation was cancelled.", {
    details: operation
      ? {
          operation,
        }
      : undefined,
  });
}

export function createGenerationTimeoutError(operation?: AIOperation): AIError {
  return new AIError("GENERATION_TIMEOUT", "AI generation timed out.", {
    details: operation
      ? {
          operation,
        }
      : undefined,
  });
}

export function createPersistenceError(
  message = "AI generation persistence failed.",
): AIError {
  return new AIError("PERSISTENCE_ERROR", message);
}

export function createCreditsError(
  message = "AI credit operation failed.",
): AIError {
  return new AIError("CREDITS_ERROR", message);
}
