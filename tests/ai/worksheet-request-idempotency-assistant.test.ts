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

const testUserId = `worksheet-assistant-idempotency-user-${Date.now()}`;
const testUserEmail = `${testUserId}@example.test`;

let testUserCreated = false;

/**
 * ============================================================
 * SERIALIZATION-CONFLICT DETECTION
 * ============================================================
 *
 * Prisma 7 + @prisma/adapter-pg can surface PostgreSQL
 * serialization failures in two different forms:
 *
 * 1. PrismaClientKnownRequestError / P2034
 * 2. DriverAdapterError with PostgreSQL SQLSTATE 40001
 *
 * Both mean the same thing:
 *
 *     SERIALIZABLE transaction lost the race
 *
 * The correct behavior is to retry the transaction.
 */
function isSerializationConflict(error: unknown): boolean {
  /**
   * Prisma's traditional P2034 representation.
   */
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  ) {
    return true;
  }

  /**
   * Prisma adapter representation.
   *
   * @prisma/adapter-pg exposes the PostgreSQL SQLSTATE through
   * the serialized error as:
   *
   *     originalCode: "40001"
   *
   * We intentionally inspect the unknown error defensively
   * rather than depending on an adapter-specific class.
   */
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

    /**
     * Some adapter versions wrap the original PostgreSQL error
     * inside `cause`.
     */
    if (typeof candidate.cause === "object" && candidate.cause !== null) {
      const cause = candidate.cause as {
        originalCode?: unknown;
        code?: unknown;
      };

      if (cause.originalCode === "40001" || cause.code === "40001") {
        return true;
      }
    }

    /**
     * Final defensive check for the PostgreSQL serialization
     * message.
     */
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
 *
 * This mirrors the production retry strategy while also
 * supporting Prisma's pg adapter error representation.
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

      /**
       * Small exponential backoff.
       *
       * Attempt 1 → 25ms
       * Attempt 2 → 50ms
       * Attempt 3 → 100ms
       * Attempt 4 → 200ms
       */
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
 * This mirrors the durable AIGeneration.requestId idempotency
 * boundary used by the production worksheet route.
 *
 * The invariant:
 *
 *     requestId UNIQUE
 *          ↓
 *     exactly one claimant
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
          prompt: "Create a Grade 1 mathematics worksheet.",
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
    /**
     * A duplicate requestId is expected to produce P2002.
     *
     * Do not treat unrelated database errors as duplicates.
     */
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
 *
 * Mirrors the important persistence boundary in the production
 * worksheet route:
 *
 *     AIGeneration
 *          ↓
 *     AIMessage
 *          ↓
 *     AIConversation.activeMessageId
 *
 * OpenAI is deliberately NOT called here.
 *
 * This test is focused on persistence and concurrency.
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
    /**
     * Create the assistant message.
     */
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

    /**
     * CAS-style conversation update.
     *
     * The conversation must still point to the same parent
     * message before this assistant can become active.
     */
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

    /**
     * Complete the generation in the SAME transaction.
     */
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

describe("Worksheet request-id idempotency — assistant persistence", () => {
  beforeAll(async () => {
    await prisma.user.create({
      data: {
        id: testUserId,
        name: "Worksheet Assistant Idempotency Test",
        email: testUserEmail,
      },
    });

    testUserCreated = true;
  });

  beforeEach(async () => {
    /**
     * Clean the test user's AI records before every test.
     */
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
    /**
     * Explicit cleanup.
     */
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
   * SAME requestId concurrently:
   *
   *      request A ─┐
   *                  ├──→ one AIGeneration
   *      request B ─┘
   *
   * Only the winner continues into assistant persistence.
   */
  it("persists exactly one assistant response for two concurrent requests with the same requestId", async () => {
    const conversation = await prisma.aIConversation.create({
      data: {
        userId: testUserId,
        title: "Worksheet Idempotency Test",
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

    const requestId = `worksheet-assistant-same-${Date.now()}-${Math.random()}`;

    /**
     * True concurrent request-ID claims.
     */
    const [requestA, requestB] = await Promise.all([
      claimWorksheetGeneration({
        userId: testUserId,
        requestId,
        conversationId: conversation.id,
      }),

      claimWorksheetGeneration({
        userId: testUserId,
        requestId,
        conversationId: conversation.id,
      }),
    ]);

    const winners = [requestA, requestB].filter((result) => result.claimed);

    const duplicates = [requestA, requestB].filter((result) => !result.claimed);

    expect(winners).toHaveLength(1);
    expect(duplicates).toHaveLength(1);

    /**
     * Both callers must resolve to the same generation.
     */
    expect(requestA.generation.id).toBe(requestB.generation.id);

    expect(requestA.generation.requestId).toBe(requestId);

    expect(requestB.generation.requestId).toBe(requestId);

    const winningRequest = winners[0] === requestA ? requestA : requestB;

    expect(winningRequest.claimed).toBe(true);

    /**
     * Only the winner persists the assistant.
     */
    const assistant = await persistWorksheetAssistant({
      userId: testUserId,
      conversationId: conversation.id,
      generationId: winningRequest.generation.id,
      requestId,
      parentMessageId: userMessage.id,
    });

    /**
     * ====================================================
     * GENERATION ASSERTIONS
     * ====================================================
     */

    const generations = await prisma.aIGeneration.findMany({
      where: {
        userId: testUserId,
        requestId,
      },
      select: {
        id: true,
        userId: true,
        requestId: true,
        type: true,
        status: true,
        outputData: true,
      },
    });

    expect(generations).toHaveLength(1);

    expect(generations[0].id).toBe(winningRequest.generation.id);

    expect(generations[0].userId).toBe(testUserId);

    expect(generations[0].requestId).toBe(requestId);

    expect(generations[0].type).toBe(AIGenerationType.WORKSHEET);

    expect(generations[0].status).toBe(AIGenerationStatus.COMPLETED);

    /**
     * ====================================================
     * ASSISTANT ASSERTIONS
     * ====================================================
     */

    const assistantMessages = await prisma.aIMessage.findMany({
      where: {
        userId: testUserId,
        conversationId: conversation.id,
        role: "ASSISTANT",
        metadata: {
          path: ["requestId"],
          equals: requestId,
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

    /**
     * CRITICAL INVARIANT:
     *
     * One requestId must produce one assistant.
     */
    expect(assistantMessages).toHaveLength(1);

    expect(assistantMessages[0].id).toBe(assistant.id);

    expect(assistantMessages[0].conversationId).toBe(conversation.id);

    expect(assistantMessages[0].userId).toBe(testUserId);

    expect(assistantMessages[0].role).toBe("ASSISTANT");

    expect(assistantMessages[0].generationId).toBe(generations[0].id);

    expect(assistantMessages[0].parentMessageId).toBe(userMessage.id);

    /**
     * ====================================================
     * ACTIVE MESSAGE ASSERTION
     * ====================================================
     */

    const persistedConversation = await prisma.aIConversation.findUnique({
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

    expect(persistedConversation).not.toBeNull();

    expect(persistedConversation?.userId).toBe(testUserId);

    expect(persistedConversation?.status).toBe("ACTIVE");

    expect(persistedConversation?.activeMessageId).toBe(assistant.id);

    /**
     * ====================================================
     * GENERATION → ASSISTANT ONE-TO-ONE ASSERTION
     * ====================================================
     */

    const assistantsForGeneration = await prisma.aIMessage.findMany({
      where: {
        userId: testUserId,
        conversationId: conversation.id,
        role: "ASSISTANT",
        generationId: generations[0].id,
      },
      select: {
        id: true,
        generationId: true,
      },
    });

    expect(assistantsForGeneration).toHaveLength(1);

    expect(assistantsForGeneration[0].id).toBe(assistant.id);

    expect(assistantsForGeneration[0].generationId).toBe(generations[0].id);
  });

  /**
   * ========================================================
   * TEST 2
   * ========================================================
   *
   * DIFFERENT requestIds concurrently:
   *
   *      request A ───→ generation A ───→ assistant A
   *
   *      request B ───→ generation B ───→ assistant B
   *
   * They must remain completely independent.
   */
  it("persists two independent assistants for two concurrent requests with different requestIds", async () => {
    const conversationA = await prisma.aIConversation.create({
      data: {
        userId: testUserId,
        title: "Worksheet Request A",
        status: "ACTIVE",
      },
      select: {
        id: true,
      },
    });

    const conversationB = await prisma.aIConversation.create({
      data: {
        userId: testUserId,
        title: "Worksheet Request B",
        status: "ACTIVE",
      },
      select: {
        id: true,
      },
    });

    const userMessageA = await prisma.aIMessage.create({
      data: {
        conversationId: conversationA.id,
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

    const userMessageB = await prisma.aIMessage.create({
      data: {
        conversationId: conversationB.id,
        userId: testUserId,
        role: "USER",
        content: "Create a Grade 1 mathematics addition worksheet.",
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
        id: conversationA.id,
      },
      data: {
        activeMessageId: userMessageA.id,
      },
    });

    await prisma.aIConversation.update({
      where: {
        id: conversationB.id,
      },
      data: {
        activeMessageId: userMessageB.id,
      },
    });

    const requestIdA = `worksheet-assistant-different-a-${Date.now()}-${Math.random()}`;

    const requestIdB = `worksheet-assistant-different-b-${Date.now()}-${Math.random()}`;

    /**
     * True concurrent claims with different request IDs.
     */
    const [requestA, requestB] = await Promise.all([
      claimWorksheetGeneration({
        userId: testUserId,
        requestId: requestIdA,
        conversationId: conversationA.id,
      }),

      claimWorksheetGeneration({
        userId: testUserId,
        requestId: requestIdB,
        conversationId: conversationB.id,
      }),
    ]);

    /**
     * Both legitimate requests must win.
     */
    expect(requestA.claimed).toBe(true);
    expect(requestB.claimed).toBe(true);

    /**
     * They must have distinct generation records.
     */
    expect(requestA.generation.id).not.toBe(requestB.generation.id);

    expect(requestA.generation.requestId).toBe(requestIdA);

    expect(requestB.generation.requestId).toBe(requestIdB);

    /**
     * Persist both assistants concurrently.
     *
     * The transaction helper will transparently retry if
     * PostgreSQL reports a SERIALIZABLE 40001 conflict.
     */
    const [assistantA, assistantB] = await Promise.all([
      persistWorksheetAssistant({
        userId: testUserId,
        conversationId: conversationA.id,
        generationId: requestA.generation.id,
        requestId: requestIdA,
        parentMessageId: userMessageA.id,
      }),

      persistWorksheetAssistant({
        userId: testUserId,
        conversationId: conversationB.id,
        generationId: requestB.generation.id,
        requestId: requestIdB,
        parentMessageId: userMessageB.id,
      }),
    ]);

    /**
     * ====================================================
     * GENERATION ASSERTIONS
     * ====================================================
     */

    const generations = await prisma.aIGeneration.findMany({
      where: {
        userId: testUserId,
        requestId: {
          in: [requestIdA, requestIdB],
        },
      },
      select: {
        id: true,
        requestId: true,
        userId: true,
        type: true,
        status: true,
      },
      orderBy: {
        requestId: "asc",
      },
    });

    expect(generations).toHaveLength(2);

    /**
     * Two distinct generation IDs.
     */
    expect(new Set(generations.map((generation) => generation.id)).size).toBe(
      2,
    );

    /**
     * Both request IDs exist.
     */
    expect(generations.map((generation) => generation.requestId)).toEqual(
      expect.arrayContaining([requestIdA, requestIdB]),
    );

    for (const generation of generations) {
      expect(generation.userId).toBe(testUserId);

      expect(generation.type).toBe(AIGenerationType.WORKSHEET);

      expect(generation.status).toBe(AIGenerationStatus.COMPLETED);
    }

    /**
     * ====================================================
     * ASSISTANT ASSERTIONS
     * ====================================================
     */

    const assistantMessages = await prisma.aIMessage.findMany({
      where: {
        userId: testUserId,
        role: "ASSISTANT",
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

    const matchingAssistantMessages = assistantMessages.filter((message) => {
      const metadata = message.metadata;

      if (
        !metadata ||
        typeof metadata !== "object" ||
        Array.isArray(metadata)
      ) {
        return false;
      }

      const requestId = (metadata as { requestId?: unknown }).requestId;

      return (
        typeof requestId === "string" &&
        [requestIdA, requestIdB].includes(requestId)
      );
    });

    /**
     * Exactly two assistants — one per legitimate request.
     */
    expect(matchingAssistantMessages).toHaveLength(2);

    expect(
      new Set(matchingAssistantMessages.map((assistant) => assistant.id)).size,
    ).toBe(2);

    /**
     * Both generation IDs must have exactly one assistant.
     */
    expect(
      matchingAssistantMessages.map((assistant) => assistant.generationId),
    ).toEqual(
      expect.arrayContaining([requestA.generation.id, requestB.generation.id]),
    );

    /**
     * ====================================================
     * REQUEST A → ASSISTANT A
     * ====================================================
     */

    const persistedAssistantA = await prisma.aIMessage.findFirst({
      where: {
        id: assistantA.id,
        userId: testUserId,
        conversationId: conversationA.id,
        role: "ASSISTANT",
        generationId: requestA.generation.id,
        parentMessageId: userMessageA.id,
        metadata: {
          path: ["requestId"],
          equals: requestIdA,
        },
      },
      select: {
        id: true,
        conversationId: true,
        generationId: true,
        parentMessageId: true,
      },
    });

    expect(persistedAssistantA).not.toBeNull();

    expect(persistedAssistantA?.id).toBe(assistantA.id);

    expect(persistedAssistantA?.conversationId).toBe(conversationA.id);

    expect(persistedAssistantA?.generationId).toBe(requestA.generation.id);

    expect(persistedAssistantA?.parentMessageId).toBe(userMessageA.id);

    /**
     * ====================================================
     * REQUEST B → ASSISTANT B
     * ====================================================
     */

    const persistedAssistantB = await prisma.aIMessage.findFirst({
      where: {
        id: assistantB.id,
        userId: testUserId,
        conversationId: conversationB.id,
        role: "ASSISTANT",
        generationId: requestB.generation.id,
        parentMessageId: userMessageB.id,
        metadata: {
          path: ["requestId"],
          equals: requestIdB,
        },
      },
      select: {
        id: true,
        conversationId: true,
        generationId: true,
        parentMessageId: true,
      },
    });

    expect(persistedAssistantB).not.toBeNull();

    expect(persistedAssistantB?.id).toBe(assistantB.id);

    expect(persistedAssistantB?.conversationId).toBe(conversationB.id);

    expect(persistedAssistantB?.generationId).toBe(requestB.generation.id);

    expect(persistedAssistantB?.parentMessageId).toBe(userMessageB.id);

    /**
     * ====================================================
     * ACTIVE MESSAGE ASSERTIONS
     * ====================================================
     */

    const [persistedConversationA, persistedConversationB] = await Promise.all([
      prisma.aIConversation.findUnique({
        where: {
          id: conversationA.id,
        },
        select: {
          id: true,
          userId: true,
          status: true,
          activeMessageId: true,
        },
      }),

      prisma.aIConversation.findUnique({
        where: {
          id: conversationB.id,
        },
        select: {
          id: true,
          userId: true,
          status: true,
          activeMessageId: true,
        },
      }),
    ]);

    expect(persistedConversationA).not.toBeNull();
    expect(persistedConversationB).not.toBeNull();

    expect(persistedConversationA?.userId).toBe(testUserId);

    expect(persistedConversationB?.userId).toBe(testUserId);

    expect(persistedConversationA?.status).toBe("ACTIVE");

    expect(persistedConversationB?.status).toBe("ACTIVE");

    /**
     * Each conversation points to its own assistant.
     */
    expect(persistedConversationA?.activeMessageId).toBe(assistantA.id);

    expect(persistedConversationB?.activeMessageId).toBe(assistantB.id);

    /**
     * They must not accidentally point to the same message.
     */
    expect(persistedConversationA?.activeMessageId).not.toBe(
      persistedConversationB?.activeMessageId,
    );
  });
});
