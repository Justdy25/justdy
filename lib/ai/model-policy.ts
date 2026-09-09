import type { AIOperation } from "@/lib/ai/operations";
import type { AIProviderName } from "@/lib/ai/providers/types";

import {
  getAICapability,
  isAIOperationImplemented,
} from "@/lib/ai/capabilities";

import { assertAIProviderSupports } from "@/lib/ai/providers";

import { getConfiguredModel } from "@/lib/ai/config";

export type AIModelPolicy = {
  operation: AIOperation;
  provider: AIProviderName;
  model: string;
};

const MODEL_POLICIES: Record<AIOperation, AIModelPolicy> = {
  CHAT: {
    operation: "CHAT",
    provider: "openai",
    model: "gpt-5-mini",
  },

  RESEARCH: {
    operation: "RESEARCH",
    provider: "openai",
    model: "gpt-5-mini",
  },

  IMAGE: {
    operation: "IMAGE",
    provider: "openai",
    model: "gpt-image-1",
  },

  VIDEO: {
    operation: "VIDEO",
    provider: "openai",
    model: "sora",
  },

  AUDIO: {
    operation: "AUDIO",
    provider: "openai",
    model: "gpt-4o-mini-tts",
  },

  DOCUMENT: {
    operation: "DOCUMENT",
    provider: "openai",
    model: "gpt-5-mini",
  },

  WORKSHEET: {
    operation: "WORKSHEET",
    provider: "openai",
    model: "gpt-5-mini",
  },

  QUIZ: {
    operation: "QUIZ",
    provider: "openai",
    model: "gpt-5-mini",
  },

  LESSON_PLAN: {
    operation: "LESSON_PLAN",
    provider: "openai",
    model: "gpt-5-mini",
  },

  PRESENTATION: {
    operation: "PRESENTATION",
    provider: "openai",
    model: "gpt-5-mini",
  },
};

export function getAIModelPolicy(operation: AIOperation): AIModelPolicy {
  const capability = getAICapability(operation);
  const policy = MODEL_POLICIES[operation];

  if (!policy) {
    throw new Error(`No model policy exists for AI operation "${operation}".`);
  }

  if (policy.provider !== capability.defaultProvider) {
    throw new Error(`Model policy provider mismatch for "${operation}".`);
  }

  if (policy.model !== capability.defaultModel) {
    throw new Error(`Model policy mismatch for "${operation}".`);
  }

  return policy;
}

export function resolveAIModel(operation: AIOperation): string {
  const policy = getAIModelPolicy(operation);
  const configuredModel = getConfiguredModel(operation);

  /*
   * An environment override is allowed only if the provider
   * explicitly supports the configured model for this operation.
   */
  if (configuredModel) {
    try {
      assertAIProviderSupports(policy.provider, operation, configuredModel);

      return configuredModel;
    } catch {
      throw new Error(
        `Configured model "${configuredModel}" is not permitted for AI operation "${operation}".`,
      );
    }
  }

  return policy.model;
}

export function assertAIModelPolicy(operation: AIOperation): void {
  if (!isAIOperationImplemented(operation)) {
    throw new Error(`AI operation "${operation}" is not implemented yet.`);
  }

  const policy = getAIModelPolicy(operation);
  const model = resolveAIModel(operation);

  assertAIProviderSupports(policy.provider, operation, model);
}

export function getAIModel(operation: AIOperation): string {
  assertAIModelPolicy(operation);

  return resolveAIModel(operation);
}

export function getAIProviderName(operation: AIOperation): AIProviderName {
  assertAIModelPolicy(operation);

  return getAIModelPolicy(operation).provider;
}
