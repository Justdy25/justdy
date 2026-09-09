import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import prisma from "@/lib/prisma";
import {
  AIGenerationStatus,
  AIGenerationType,
} from "@/lib/generated/prisma/enums";
import { Prisma } from "@/lib/generated/prisma/client";

/**
 * ============================================================
 * TEST FIXTURES
 * ============================================================
 */

const testUserId = `worksheet-completed-replay-user-${Date.now()}`;
const testUserEmail = `${testUserId}@example.test`;

let testUserCreated = false;

/**
 * ============================================================
 * SERIALIZATION-CONFLICT DETECTION
 * ============================================================
 */

function isSerializationConflict(error: unknown): boolean {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  ) {
    return true;
  }

  if (typeof error === "object" && error !== null) {
    const candidate = error as {
      originalCode?: unknown;
      code?: unknown;
      cause?: unknown;
      message?: unknown;
    };

    if (candidate.originalCode === "40001" || candidate.code === "40001") {
      return true;
    }

    if (typeof candidate.cause === "object" && candidate.cause !== null) {
      const cause = candidate.cause as {
        originalCode?: unknown;
        code?: unknown;
      };

      if (cause.originalCode === "40001" || cause.code === "40001") {
        return true;
      }
    }

    if (
      typeof candidate.message === "string" &&
      candidate.message.includes("could not serialize access")
    ) {
      return true;
    }
  }

  return false;
}

/**
 * ============================================================
 * SERIALIZABLE TRANSACTION HELPER
 * ============================================================
 */

async function runSerializableTransaction<T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  const maxAttempts = 5;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await prisma.$transaction(callback, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (!isSerializationConflict(error) || attempt === maxAttempts) {
        throw error;
      }

      await new Promise<void>((resolve) => {
        setTimeout(resolve, 25 * 2 ** (attempt - 1));
      });
    }
  }

  throw new Error("Serializable transaction failed unexpectedly.");
}

/**
 * ============================================================
 * WORKSHEET REQUEST CLAIM
 * ============================================================
 *
 * This mirrors the durable AIGeneration.requestId boundary
 * used by the production worksheet route.
 *
 * First request:
 *
 *     requestId
 *        ↓
 *     CREATE AIGeneration
 *        ↓
 *     claimed = true
 *
 * Replay:
 *
 *     same requestId
 *        ↓
 *     UNIQUE constraint
 *        ↓
 *     existing COMPLETED generation
 *        ↓
 *     claimed = false
 *
 * The production route maps this duplicate condition to:
 *
 *     409 DUPLICATE_GENERATION_REQUEST
 */

async function claimWorksheetGeneration({
  userId,
  requestId,
  conversationId,
}: {
  userId: string;
  requestId: string;
  conversationId: string;
}) {
  try {
    const generation = await runSerializableTransaction((tx) =>
      tx.aIGeneration.create({
        data: {
          userId,
          requestId,
          type: AIGenerationType.WORKSHEET,
          operation: "WORKSHEET",
          status: AIGenerationStatus.PENDING,
          prompt: "Create a Grade 1 mathematics counting worksheet.",
          inputData: {
            source: "AI_CHAT_TEST",
            conversationId,
          },
          provider: "openai",
          model: "gpt-5",
          startedAt: new Date(),
        },
        select: {
          id: true,
          userId: true,
          requestId: true,
          type: true,
          status: true,
        },
      }),
    );

    return {
      claimed: true as const,
      generation,
    };
  } catch (error) {
    if (
      !(
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
    ) {
      throw error;
    }

    const existing = await prisma.aIGeneration.findUnique({
      where: {
        requestId,
      },
      select: {
        id: true,
        userId: true,
        requestId: true,
        type: true,
        status: true,
      },
    });

    if (
      !existing ||
      existing.userId !== userId ||
      existing.type !== AIGenerationType.WORKSHEET
    ) {
      throw new Error("The request ID is already in use.");
    }

    return {
      claimed: false as const,
      generation: existing,
    };
  }
}

/**
 * ============================================================
 * ASSISTANT PERSISTENCE
 * ============================================================
 */

async function persistWorksheetAssistant({
  userId,
  conversationId,
  generationId,
  requestId,
  parentMessageId,
}: {
  userId: string;
  conversationId: string;
  generationId: string;
  requestId: string;
  parentMessageId: string;
}) {
  const worksheet = {
    gradeLevel: "Grade 1",
    subject: "Mathematics",
    topic: "Counting",
    title: "Counting to 10",
    learningObjective: "Students will practice counting numbers from 1 to 10.",
    questions: [
      {
        number: 1,
        type: "multiple_choice",
        question: "What number comes after 4?",
        options: [
          {
            id: "a",
            text: "5",
          },
          {
            id: "b",
            text: "6",
          },
        ],
        answer: "5",
        explanation: "5 comes immediately after 4.",
        points: 1,
      },
    ],
    answerKey: [
      {
        number: 1,
        answer: "5",
      },
    ],
    totalPoints: 1,
  };

  const command = {
    gradeLevel: "Grade 1",
    subject: "Mathematics",
    topic: "Counting",
    title: "Counting to 10",
    questionCount: 1,
    difficulty: "easy",
    questionTypes: ["multiple_choice"],
  };

  const assistantContent = `Your worksheet "${worksheet.title}" is ready.`;

  return runSerializableTransaction(async (tx) => {
    const assistantMessage = await tx.aIMessage.create({
      data: {
        conversationId,
        userId,
        role: "ASSISTANT",
        content: assistantContent,
        generationId,
        parentMessageId,
        metadata: {
          type: "WORKSHEET",
          requestId,
          worksheet,
          command,
        },
      },
      select: {
        id: true,
        conversationId: true,
        userId: true,
        role: true,
        content: true,
        generationId: true,
        parentMessageId: true,
        metadata: true,
      },
    });

    const updatedConversation = await tx.aIConversation.updateMany({
      where: {
        id: conversationId,
        userId,
        status: "ACTIVE",
        activeMessageId: parentMessageId,
      },
      data: {
        activeMessageId: assistantMessage.id,
        updatedAt: new Date(),
      },
    });

    if (updatedConversation.count !== 1) {
      throw new Error(
        "Conversation changed while finalizing worksheet assistant.",
      );
    }

    await tx.aIGeneration.update({
      where: {
        id: generationId,
      },
      data: {
        status: AIGenerationStatus.COMPLETED,
        outputData: {
          worksheet,
          command,
        },
        completedAt: new Date(),
      },
    });

    return assistantMessage;
  });
}

/**
 * ============================================================
 * TEST SUITE
 * ============================================================
 */

describe("Worksheet request-id idempotency — completed replay", () => {
  beforeAll(async () => {
    await prisma.user.create({
      data: {
        id: testUserId,
        name: "Worksheet Completed Replay Test",
        email: testUserEmail,
      },
    });

    testUserCreated = true;
  });

  beforeEach(async () => {
    await prisma.aIMessage.deleteMany({
      where: {
        userId: testUserId,
      },
    });

    await prisma.aIGeneration.deleteMany({
      where: {
        userId: testUserId,
      },
    });

    await prisma.aIConversation.deleteMany({
      where: {
        userId: testUserId,
      },
    });
  });

  afterAll(async () => {
    await prisma.aIMessage.deleteMany({
      where: {
        userId: testUserId,
      },
    });

    await prisma.aIGeneration.deleteMany({
      where: {
        userId: testUserId,
      },
    });

    await prisma.aIConversation.deleteMany({
      where: {
        userId: testUserId,
      },
    });

    if (testUserCreated) {
      await prisma.user.deleteMany({
        where: {
          id: testUserId,
        },
      });
    }

    await prisma.$disconnect();
  });

  /**
   * ========================================================
   * TEST 1
   * ========================================================
   *
   * Complete a worksheet request and then replay the exact
   * same requestId.
   *
   * The replay must NOT create another generation.
   * The replay must NOT create another assistant.
   */

  it("rejects a completed requestId replay without creating another generation or assistant", async () => {
    const conversation = await prisma.aIConversation.create({
      data: {
        userId: testUserId,
        title: "Completed Replay Test",
        status: "ACTIVE",
      },
      select: {
        id: true,
        activeMessageId: true,
      },
    });

    const userMessage = await prisma.aIMessage.create({
      data: {
        conversationId: conversation.id,
        userId: testUserId,
        role: "USER",
        content: "Create a Grade 1 mathematics counting worksheet.",
        metadata: {
          source: "AI_CHAT_TEST",
        },
      },
      select: {
        id: true,
      },
    });

    await prisma.aIConversation.update({
      where: {
        id: conversation.id,
      },
      data: {
        activeMessageId: userMessage.id,
      },
    });

    const requestId = `worksheet-completed-replay-${Date.now()}-${Math.random()}`;

    /**
     * ------------------------------------------------------
     * FIRST REQUEST
     * ------------------------------------------------------
     */

    const firstRequest = await claimWorksheetGeneration({
      userId: testUserId,
      requestId,
      conversationId: conversation.id,
    });

    expect(firstRequest.claimed).toBe(true);

    const firstAssistant = await persistWorksheetAssistant({
      userId: testUserId,
      conversationId: conversation.id,
      generationId: firstRequest.generation.id,
      requestId,
      parentMessageId: userMessage.id,
    });

    /**
     * ------------------------------------------------------
     * SNAPSHOT AFTER COMPLETION
     * ------------------------------------------------------
     */

    const generationsBeforeReplay = await prisma.aIGeneration.findMany({
      where: {
        userId: testUserId,
        requestId,
      },
      select: {
        id: true,
        requestId: true,
        userId: true,
        type: true,
        status: true,
        outputData: true,
      },
    });

    const assistantsBeforeReplay = await prisma.aIMessage.findMany({
      where: {
        userId: testUserId,
        conversationId: conversation.id,
        role: "ASSISTANT",
        generationId: firstRequest.generation.id,
      },
      select: {
        id: true,
        conversationId: true,
        generationId: true,
        parentMessageId: true,
        metadata: true,
      },
    });

    const conversationBeforeReplay = await prisma.aIConversation.findUnique({
      where: {
        id: conversation.id,
      },
      select: {
        id: true,
        activeMessageId: true,
        status: true,
      },
    });

    expect(generationsBeforeReplay).toHaveLength(1);

    expect(generationsBeforeReplay[0].id).toBe(firstRequest.generation.id);

    expect(generationsBeforeReplay[0].status).toBe(
      AIGenerationStatus.COMPLETED,
    );

    expect(assistantsBeforeReplay).toHaveLength(1);

    expect(assistantsBeforeReplay[0].id).toBe(firstAssistant.id);

    expect(conversationBeforeReplay?.activeMessageId).toBe(firstAssistant.id);

    /**
     * ------------------------------------------------------
     * SECOND REQUEST — SAME requestId
     * ------------------------------------------------------
     */

    const replayRequest = await claimWorksheetGeneration({
      userId: testUserId,
      requestId,
      conversationId: conversation.id,
    });

    /**
     * CRITICAL IDEMPOTENCY INVARIANT:
     *
     * The replay must NOT become a new claimant.
     */

    expect(replayRequest.claimed).toBe(false);

    /**
     * The replay must resolve to the ORIGINAL generation.
     */

    expect(replayRequest.generation.id).toBe(firstRequest.generation.id);

    expect(replayRequest.generation.requestId).toBe(requestId);

    expect(replayRequest.generation.userId).toBe(testUserId);

    expect(replayRequest.generation.type).toBe(AIGenerationType.WORKSHEET);

    expect(replayRequest.generation.status).toBe(AIGenerationStatus.COMPLETED);

    /**
     * ------------------------------------------------------
     * DATABASE COUNT ASSERTIONS
     * ------------------------------------------------------
     */

    const generationsAfterReplay = await prisma.aIGeneration.findMany({
      where: {
        userId: testUserId,
        requestId,
      },
      select: {
        id: true,
        requestId: true,
        status: true,
      },
    });

    expect(generationsAfterReplay).toHaveLength(1);

    expect(generationsAfterReplay[0].id).toBe(firstRequest.generation.id);

    expect(generationsAfterReplay[0].status).toBe(AIGenerationStatus.COMPLETED);

    /**
     * ------------------------------------------------------
     * ASSISTANT COUNT ASSERTION
     * ------------------------------------------------------
     */

    const assistantsAfterReplay = await prisma.aIMessage.findMany({
      where: {
        userId: testUserId,
        conversationId: conversation.id,
        role: "ASSISTANT",
        generationId: firstRequest.generation.id,
      },
      select: {
        id: true,
        conversationId: true,
        generationId: true,
        parentMessageId: true,
      },
    });

    /**
     * Exactly ONE assistant must still exist.
     */

    expect(assistantsAfterReplay).toHaveLength(1);

    expect(assistantsAfterReplay[0].id).toBe(firstAssistant.id);

    expect(assistantsAfterReplay[0].conversationId).toBe(conversation.id);

    expect(assistantsAfterReplay[0].generationId).toBe(
      firstRequest.generation.id,
    );

    expect(assistantsAfterReplay[0].parentMessageId).toBe(userMessage.id);

    /**
     * ------------------------------------------------------
     * CONVERSATION ASSERTION
     * ------------------------------------------------------
     *
     * The replay must not move the conversation pointer.
     */

    const conversationAfterReplay = await prisma.aIConversation.findUnique({
      where: {
        id: conversation.id,
      },
      select: {
        id: true,
        userId: true,
        status: true,
        activeMessageId: true,
      },
    });

    expect(conversationAfterReplay).not.toBeNull();

    expect(conversationAfterReplay?.userId).toBe(testUserId);

    expect(conversationAfterReplay?.status).toBe("ACTIVE");

    expect(conversationAfterReplay?.activeMessageId).toBe(
      conversationBeforeReplay?.activeMessageId,
    );

    expect(conversationAfterReplay?.activeMessageId).toBe(firstAssistant.id);

    /**
     * ------------------------------------------------------
     * GLOBAL ASSISTANT COUNT
     * ------------------------------------------------------
     *
     * There must be exactly one assistant belonging to this
     * completed request.
     */

    const allRequestAssistants = await prisma.aIMessage.findMany({
      where: {
        userId: testUserId,
        role: "ASSISTANT",
      },
      select: {
        id: true,
        generationId: true,
      },
    });

    expect(allRequestAssistants).toHaveLength(1);

    expect(allRequestAssistants[0].id).toBe(firstAssistant.id);

    expect(allRequestAssistants[0].generationId).toBe(
      firstRequest.generation.id,
    );
  });
});
