export type AIIntent =
  | "CHAT"
  | "VIDEO"
  | "WORKSHEET"
  | "IMAGE"
  | "AUDIO"
  | "DOCUMENT"
  | "QUIZ"
  | "LESSON_PLAN";

export interface AIIntentResult {
  intent: AIIntent;
  confidence: number;
  reasoning?: string;
}

export interface OrchestratorContext {
  userId: string;
  conversationId?: string;
  projectId?: string;
}

export interface OrchestrateAIInput extends OrchestratorContext {
  prompt: string;
  requestId: string;
}

export interface OrchestrateAIResult {
  intent: AIIntent;
  handled: boolean;
  result?: unknown;
}
