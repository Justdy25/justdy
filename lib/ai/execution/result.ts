import type { AIProviderStreamEvent } from "@/lib/ai/providers/types";

export type AIExecutionResult = {
  text: string;
  provider: string;
  model: string;
};

export type AIExecutionStreamResult = {
  stream: AsyncIterable<AIProviderStreamEvent>;
  provider: string;
  model: string;
};
