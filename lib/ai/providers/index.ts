import type { AIProvider, AIProviderName } from "@/lib/ai/providers/types";

import { openAIProvider } from "@/lib/ai/providers/openai";

export const AI_PROVIDERS: Record<AIProviderName, AIProvider> = {
  openai: openAIProvider,
};

export function getAIProvider(providerName: AIProviderName): AIProvider {
  const provider = AI_PROVIDERS[providerName];

  if (!provider) {
    throw new Error(`AI provider "${providerName}" is not configured.`);
  }

  return provider;
}

export function assertAIProviderSupports(
  providerName: AIProviderName,
  operation: string,
  model: string,
): void {
  const provider = getAIProvider(providerName);

  if (!provider.capabilities.operations.includes(operation)) {
    throw new Error(
      `Provider "${providerName}" does not support operation "${operation}".`,
    );
  }

  const supportedModel = provider.capabilities.models.find(
    (candidate) => candidate.id === model,
  );

  if (!supportedModel) {
    throw new Error(
      `Provider "${providerName}" does not support model "${model}".`,
    );
  }

  if (!supportedModel.operations.includes(operation)) {
    throw new Error(
      `Model "${model}" from provider "${providerName}" does not support operation "${operation}".`,
    );
  }
}
