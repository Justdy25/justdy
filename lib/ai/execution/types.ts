import type { AIChatMessage } from "@/lib/ai/types";
import type { AIRequestContext } from "@/lib/ai/request-context";
import type { AIProviderName } from "@/lib/ai/providers/types";

export type AIExecutionRequest = {
  context: AIRequestContext;

  messages: AIChatMessage[];

  provider?: AIProviderName;

  model?: string;
};

export type AIExecutionOptions = {
  signal?: AbortSignal;
};

export type AIResolvedExecutionRequest = {
  context: AIRequestContext;

  messages: AIChatMessage[];

  provider: AIProviderName;

  model: string;
};
