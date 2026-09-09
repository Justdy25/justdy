import { assertAIRequestContext } from "@/lib/ai/request-context";

import type {
  AIExecutionRequest,
  AIResolvedExecutionRequest,
} from "@/lib/ai/execution/types";

import { createInvalidRequestError } from "@/lib/ai/execution/errors";

export function assertAIExecutionRequest(request: AIExecutionRequest): void {
  try {
    assertAIRequestContext(request.context);
  } catch (error) {
    throw createInvalidRequestError(
      error instanceof Error ? error.message : "Invalid AI request context.",
    );
  }

  if (!Array.isArray(request.messages)) {
    throw createInvalidRequestError("AI messages must be an array.");
  }

  if (request.messages.length === 0) {
    throw createInvalidRequestError("AI messages cannot be empty.");
  }

  if (request.provider !== undefined && !request.provider.trim()) {
    throw createInvalidRequestError("AI provider cannot be empty.");
  }

  if (request.model !== undefined && !request.model.trim()) {
    throw createInvalidRequestError("AI model cannot be empty.");
  }
}

export function assertAIResolvedExecutionRequest(
  request: AIResolvedExecutionRequest,
): void {
  try {
    assertAIRequestContext(request.context);
  } catch (error) {
    throw createInvalidRequestError(
      error instanceof Error ? error.message : "Invalid AI request context.",
    );
  }

  if (!Array.isArray(request.messages)) {
    throw createInvalidRequestError("AI messages must be an array.");
  }

  if (request.messages.length === 0) {
    throw createInvalidRequestError("AI messages cannot be empty.");
  }

  if (!request.provider.trim()) {
    throw createInvalidRequestError("AI provider is required.");
  }

  if (!request.model.trim()) {
    throw createInvalidRequestError("AI model is required.");
  }
}
