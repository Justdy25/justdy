import type { AIChatMessage, AIChatResponse } from "@/lib/ai/types";

export type AIProviderName = "openai";

export type AIProviderStreamEvent = {
  type: string;
  delta?: string;
};

export type AIProviderModel = {
  id: string;
  operations: readonly string[];
  default?: boolean;
};

export type AIProviderCapabilities = {
  operations: readonly string[];
  models: readonly AIProviderModel[];
};

export type AIProviderGenerateOptions = {
  model?: string;
  signal?: AbortSignal;
};

export type AIProviderStreamOptions = {
  model?: string;
  signal?: AbortSignal;
};

export type AIProviderStreamResult = {
  stream: AsyncIterable<AIProviderStreamEvent>;
  provider: AIProviderName;
  model: string;
};

export interface AIProvider {
  readonly name: AIProviderName;
  readonly capabilities: AIProviderCapabilities;

  generate(
    messages: AIChatMessage[],
    options?: AIProviderGenerateOptions,
  ): Promise<AIChatResponse>;

  stream(
    messages: AIChatMessage[],
    options?: AIProviderStreamOptions,
  ): Promise<AIProviderStreamResult>;
}
