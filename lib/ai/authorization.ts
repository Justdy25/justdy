import prisma from "@/lib/prisma";

export type AIAuthorizationErrorCode =
  | "AI_RESOURCE_NOT_FOUND"
  | "AI_RESOURCE_FORBIDDEN";

export class AIAuthorizationError extends Error {
  readonly code: AIAuthorizationErrorCode;

  constructor(
    message: string,
    code: AIAuthorizationErrorCode = "AI_RESOURCE_NOT_FOUND",
  ) {
    super(message);
    this.name = "AIAuthorizationError";
    this.code = code;
  }
}

/**
 * Resolve an AI conversation only when it belongs to the
 * authenticated user.
 */
export async function requireOwnedAIConversation(
  userId: string,
  conversationId: string,
) {
  const conversation = await prisma.aIConversation.findFirst({
    where: {
      id: conversationId,
      userId,
    },
  });

  if (!conversation) {
    throw new AIAuthorizationError("AI conversation not found.");
  }

  return conversation;
}

/**
 * Resolve an AI message only when it belongs to both:
 * - the authenticated user
 * - the specified conversation
 */
export async function requireOwnedAIMessage({
  userId,
  conversationId,
  messageId,
}: {
  userId: string;
  conversationId: string;
  messageId: string;
}) {
  const message = await prisma.aIMessage.findFirst({
    where: {
      id: messageId,
      conversationId,
      userId,
    },
  });

  if (!message) {
    throw new AIAuthorizationError("AI message not found.");
  }

  return message;
}

/**
 * Resolve an AI generation only when it belongs to
 * the authenticated user.
 */
export async function requireOwnedAIGeneration({
  userId,
  generationId,
}: {
  userId: string;
  generationId: string;
}) {
  const generation = await prisma.aIGeneration.findFirst({
    where: {
      id: generationId,
      userId,
    },
  });

  if (!generation) {
    throw new AIAuthorizationError("AI generation not found.");
  }

  return generation;
}

/**
 * Assert ownership of an AI message without loading
 * the complete record.
 */
export async function assertOwnedAIMessage({
  userId,
  conversationId,
  messageId,
}: {
  userId: string;
  conversationId: string;
  messageId: string;
}): Promise<void> {
  const message = await prisma.aIMessage.findFirst({
    where: {
      id: messageId,
      conversationId,
      userId,
    },
    select: {
      id: true,
    },
  });

  if (!message) {
    throw new AIAuthorizationError("AI message not found.");
  }
}

/**
 * Assert ownership of an AI generation without loading
 * the complete record.
 */
export async function assertOwnedAIGeneration({
  userId,
  generationId,
}: {
  userId: string;
  generationId: string;
}): Promise<void> {
  const generation = await prisma.aIGeneration.findFirst({
    where: {
      id: generationId,
      userId,
    },
    select: {
      id: true,
    },
  });

  if (!generation) {
    throw new AIAuthorizationError("AI generation not found.");
  }
}
