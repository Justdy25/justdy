import type { AIOperation } from "@/lib/ai/operations";

export type AIRequestContext = {
  requestId: string;
  userId: string;
  operation: AIOperation;

  conversationId?: string;
  messageId?: string;

  metadata?: Record<string, unknown>;
};

export function assertAIRequestContext(context: AIRequestContext): void {
  if (!context.requestId.trim()) {
    throw new Error("AI requestId is required.");
  }

  if (!context.userId.trim()) {
    throw new Error("AI userId is required.");
  }

  if (!context.operation) {
    throw new Error("AI operation is required.");
  }

  if (context.conversationId !== undefined && !context.conversationId.trim()) {
    throw new Error("AI conversationId cannot be empty.");
  }

  if (context.messageId !== undefined && !context.messageId.trim()) {
    throw new Error("AI messageId cannot be empty.");
  }
}
