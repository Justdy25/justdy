import { getAIProvider } from "@/lib/ai/providers";

import {
  resolveAIExecution,
  resolveAIStreamingExecution,
} from "@/lib/ai/execution/resolver";

import type {
  AIExecutionOptions,
  AIExecutionRequest,
} from "@/lib/ai/execution/types";

import type {
  AIExecutionResult,
  AIExecutionStreamResult,
} from "@/lib/ai/execution/result";

/**
 * Execute a non-streaming AI request.
 *
 * The execution engine owns the execution path:
 *
 * request
 *   → resolver
 *   → provider
 *   → provider.generate()
 *
 * It deliberately does not own:
 * - authentication
 * - credits
 * - generation persistence
 * - conversation persistence
 * - API response formatting
 */
export async function executeAI(
  request: AIExecutionRequest,
  options?: AIExecutionOptions,
): Promise<AIExecutionResult> {
  const resolved = resolveAIExecution(request);

  const provider = getAIProvider(resolved.provider);

  const response = await provider.generate(resolved.messages, {
    model: resolved.model,
    signal: options?.signal,
  });

  return {
    text: response.text,
    provider: response.provider,
    model: response.model,
  };
}

/**
 * Execute a streaming AI request.
 *
 * The execution engine returns provider-neutral stream events.
 *
 * Conversion from provider events to application text chunks belongs
 * to the orchestrator/application boundary, not the provider itself.
 */
export async function executeAIStream(
  request: AIExecutionRequest,
  options?: AIExecutionOptions,
): Promise<AIExecutionStreamResult> {
  const resolved = resolveAIStreamingExecution(request);

  const provider = getAIProvider(resolved.provider);

  const response = await provider.stream(resolved.messages, {
    model: resolved.model,
    signal: options?.signal,
  });

  return {
    stream: response.stream,
    provider: response.provider,
    model: response.model,
  };
}
