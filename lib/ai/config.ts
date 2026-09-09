import type { AIOperation } from "@/lib/ai/operations";

export type AIEnvironment = "development" | "production" | "test";

export function getAIEnvironment(): AIEnvironment {
  if (process.env.NODE_ENV === "production") {
    return "production";
  }

  if (process.env.NODE_ENV === "test") {
    return "test";
  }

  return "development";
}

export function getRequiredOpenAIAPIKey(): string {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  return apiKey;
}

export function getConfiguredChatModel(): string | undefined {
  const model = process.env.OPENAI_CHAT_MODEL?.trim();

  return model || undefined;
}

export function getConfiguredModel(operation: AIOperation): string | undefined {
  switch (operation) {
    case "CHAT":
      return getConfiguredChatModel();

    default:
      return undefined;
  }
}
