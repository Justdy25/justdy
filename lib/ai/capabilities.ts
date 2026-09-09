import type { AIOperation } from "@/lib/ai/operations";

export type AIOutputKind =
  | "TEXT"
  | "IMAGE"
  | "VIDEO"
  | "AUDIO"
  | "DOCUMENT"
  | "WORKSHEET"
  | "QUIZ"
  | "LESSON_PLAN"
  | "PRESENTATION";

export type AIStreamingMode = "STREAM" | "NON_STREAM" | "ASYNC";

export type AIProviderName = "openai";

export type AICapabilityDefinition = {
  operation: AIOperation;
  label: string;
  description: string;

  outputKind: AIOutputKind;

  streaming: AIStreamingMode;

  defaultProvider: AIProviderName;

  defaultModel: string;

  creditCost: number;

  implemented: boolean;
};

export const AI_CAPABILITIES: Record<AIOperation, AICapabilityDefinition> = {
  CHAT: {
    operation: "CHAT",
    label: "Chat",
    description: "General-purpose AI conversation.",
    outputKind: "TEXT",
    streaming: "STREAM",
    defaultProvider: "openai",
    defaultModel: "gpt-5-mini",
    creditCost: 1,
    implemented: true,
  },

  RESEARCH: {
    operation: "RESEARCH",
    label: "Research",
    description: "Research and synthesize information.",
    outputKind: "TEXT",
    streaming: "STREAM",
    defaultProvider: "openai",
    defaultModel: "gpt-5-mini",
    creditCost: 5,
    implemented: false,
  },

  IMAGE: {
    operation: "IMAGE",
    label: "Image",
    description: "Generate images from prompts.",
    outputKind: "IMAGE",
    streaming: "NON_STREAM",
    defaultProvider: "openai",
    defaultModel: "gpt-image-2",
    creditCost: 0,
    implemented: true,
  },

  VIDEO: {
    operation: "VIDEO",
    label: "Video",
    description: "Generate videos from prompts.",
    outputKind: "VIDEO",
    streaming: "ASYNC",
    defaultProvider: "openai",
    defaultModel: "sora-2",
    creditCost: 20,
    implemented: true,
  },

  AUDIO: {
    operation: "AUDIO",
    label: "Audio",
    description: "Generate audio from text or prompts.",
    outputKind: "AUDIO",
    streaming: "NON_STREAM",
    defaultProvider: "openai",
    defaultModel: "gpt-4o-mini-tts",
    creditCost: 10,
    implemented: false,
  },

  DOCUMENT: {
    operation: "DOCUMENT",
    label: "Document",
    description: "Create structured documents.",
    outputKind: "DOCUMENT",
    streaming: "NON_STREAM",
    defaultProvider: "openai",
    defaultModel: "gpt-5-mini",
    creditCost: 3,
    implemented: false,
  },

  WORKSHEET: {
    operation: "WORKSHEET",
    label: "Worksheet",
    description: "Create educational worksheets.",
    outputKind: "WORKSHEET",
    streaming: "NON_STREAM",
    defaultProvider: "openai",
    defaultModel: "gpt-5-mini",
    creditCost: 5,
    implemented: true,
  },

  QUIZ: {
    operation: "QUIZ",
    label: "Quiz",
    description: "Create educational quizzes.",
    outputKind: "QUIZ",
    streaming: "NON_STREAM",
    defaultProvider: "openai",
    defaultModel: "gpt-5-mini",
    creditCost: 3,
    implemented: false,
  },

  LESSON_PLAN: {
    operation: "LESSON_PLAN",
    label: "Lesson Plan",
    description: "Create structured lesson plans.",
    outputKind: "LESSON_PLAN",
    streaming: "NON_STREAM",
    defaultProvider: "openai",
    defaultModel: "gpt-5-mini",
    creditCost: 3,
    implemented: false,
  },

  PRESENTATION: {
    operation: "PRESENTATION",
    label: "Presentation",
    description: "Create presentation content.",
    outputKind: "PRESENTATION",
    streaming: "NON_STREAM",
    defaultProvider: "openai",
    defaultModel: "gpt-5-mini",
    creditCost: 8,
    implemented: false,
  },
};

export function getAICapability(
  operation: AIOperation,
): AICapabilityDefinition {
  const capability = AI_CAPABILITIES[operation];

  if (!capability) {
    throw new Error(`AI capability "${operation}" is not configured.`);
  }

  return capability;
}

export function isAIOperationImplemented(operation: AIOperation): boolean {
  return getAICapability(operation).implemented;
}

export function getAICreditCost(operation: AIOperation): number {
  return getAICapability(operation).creditCost;
}
