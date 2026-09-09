import type { AIOperation } from "@/lib/ai/operations";
export type { AIOperation } from "@/lib/ai/operations";

import type { AIChatMessage, AIChatResponse } from "@/lib/ai/types";

import { AIError, normalizeAIError } from "@/lib/ai/errors";

import { assertAIRequestContext } from "@/lib/ai/request-context";

import { executeAI, executeAIStream } from "@/lib/ai/execution/engine";

import type { AIExecutionStreamResult } from "@/lib/ai/execution/result";

export type AIOrchestratorRequest = {
  userId: string;
  requestId?: string;
  operation: AIOperation;
  messages: AIChatMessage[];
  signal?: AbortSignal;
};

function buildExecutionRequest({
  userId,
  requestId,
  operation,
  messages,
}: AIOrchestratorRequest) {
  const context = {
    requestId: requestId?.trim() || crypto.randomUUID(),
    userId,
    operation,
  };

  assertAIRequestContext(context);

  return {
    context,
    messages,
  };
}

function normalizeOrchestratorError(
  error: unknown,
  {
    operation,
    requestId,
    provider,
    model,
  }: {
    operation: AIOperation;
    requestId: string;
    provider?: string;
    model?: string;
  },
): AIError {
  const normalized = normalizeAIError(error);

  return new AIError(normalized.code, normalized.message, {
    details: {
      ...normalized.details,
      operation,
      requestId,
      ...(provider ? { provider } : {}),
      ...(model ? { model } : {}),
    },
    cause: normalized.cause ?? error,
  });
}

/**
 * Public orchestrator entry point for non-streaming AI execution.
 *
 * API/application
 *   → orchestrator
 *   → execution engine
 *   → resolver
 *   → provider
 */
export async function generateAIResponse({
  userId,
  requestId,
  operation,
  messages,
  signal,
}: AIOrchestratorRequest): Promise<AIChatResponse> {
  const executionRequest = buildExecutionRequest({
    userId,
    requestId,
    operation,
    messages,
    signal,
  });

  const resolvedRequestId = executionRequest.context.requestId;

  try {
    const response = await executeAI(executionRequest, {
      signal,
    });

    return {
      text: response.text,
      provider: response.provider,
      model: response.model,
    };
  } catch (error) {
    /*
     * Abort/cancellation is intentionally allowed to cross the
     * orchestrator unchanged.
     *
     * The generation/chat lifecycle owns cancellation semantics.
     */
    if (signal?.aborted) {
      throw error;
    }

    throw normalizeOrchestratorError(error, {
      operation,
      requestId: resolvedRequestId,
    });
  }
}

export type AIStreamResponse = {
  stream: AsyncIterable<string>;
  provider: string;
  model: string;
};

/**
 * Public orchestrator entry point for streaming AI execution.
 *
 * The execution engine returns provider-neutral stream events.
 * The orchestrator converts text-delta events into the
 * application-level AsyncIterable<string>.
 */
export async function streamAIResponse({
  userId,
  requestId,
  operation,
  messages,
  signal,
}: AIOrchestratorRequest): Promise<AIStreamResponse> {
  const executionRequest = buildExecutionRequest({
    userId,
    requestId,
    operation,
    messages,
    signal,
  });

  const resolvedRequestId = executionRequest.context.requestId;

  let response: AIExecutionStreamResult;

  try {
    response = await executeAIStream(executionRequest, {
      signal,
    });
  } catch (error) {
    if (signal?.aborted) {
      throw error;
    }

    throw normalizeOrchestratorError(error, {
      operation,
      requestId: resolvedRequestId,
    });
  }

  async function* textStream(): AsyncIterable<string> {
    try {
      for await (const event of response.stream) {
        if (
          event.type === "response.output_text.delta" &&
          typeof event.delta === "string"
        ) {
          yield event.delta;
        }
      }
    } catch (error) {
      if (signal?.aborted) {
        throw error;
      }

      throw normalizeOrchestratorError(error, {
        operation,
        requestId: resolvedRequestId,
        provider: response.provider,
        model: response.model,
      });
    }
  }

  return {
    stream: textStream(),
    provider: response.provider,
    model: response.model,
  };
}
