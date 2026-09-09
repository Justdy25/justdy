import type { AIOperation } from "@/lib/ai/operations";
import type { AIProviderName } from "@/lib/ai/providers/types";

import { assertAIStreamingSupported } from "@/lib/ai/capability-validation";

import {
  assertAIModelPolicy,
  getAIModel,
  getAIProviderName,
} from "@/lib/ai/model-policy";

import {
  assertAIExecutionRequest,
  assertAIResolvedExecutionRequest,
} from "@/lib/ai/execution/validation";

import type {
  AIExecutionRequest,
  AIResolvedExecutionRequest,
} from "@/lib/ai/execution/types";

export function resolveAIExecution(
  request: AIExecutionRequest,
): AIResolvedExecutionRequest {
  assertAIExecutionRequest(request);

  const operation = request.context.operation;

  assertAIModelPolicy(operation);

  const policyProvider = getAIProviderName(operation);
  const policyModel = getAIModel(operation);

  if (request.provider !== undefined && request.provider !== policyProvider) {
    throw new Error(
      `Provider "${request.provider}" is not permitted for AI operation "${operation}".`,
    );
  }

  if (request.model !== undefined && request.model !== policyModel) {
    throw new Error(
      `Model "${request.model}" is not permitted for AI operation "${operation}".`,
    );
  }

  const resolved: AIResolvedExecutionRequest = {
    context: request.context,
    messages: request.messages,
    provider: policyProvider,
    model: policyModel,
  };

  assertAIResolvedExecutionRequest(resolved);

  return resolved;
}

export function resolveAIStreamingExecution(
  request: AIExecutionRequest,
): AIResolvedExecutionRequest {
  const resolved = resolveAIExecution(request);

  assertAIStreamingSupported(resolved.context.operation);

  return resolved;
}

export function resolveAIProviderName(
  request: AIExecutionRequest,
): AIProviderName {
  return resolveAIExecution(request).provider;
}

export function resolveAIOperation(request: AIExecutionRequest): AIOperation {
  return resolveAIExecution(request).context.operation;
}
