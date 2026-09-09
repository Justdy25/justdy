import { afterAll, describe, expect, it } from "vitest";

import prisma from "@/lib/prisma";
import {
  AIGenerationStatus,
  AIGenerationType,
} from "@/lib/generated/prisma/enums";
import { Prisma } from "@/lib/generated/prisma/client";

const TEST_USER_EMAIL = `worksheet-race-${Date.now()}@example.test`;
const userId = `worksheet-race-user-${Date.now()}`;
const conversationId = `worksheet-race-conversation-${Date.now()}`;

async function runSerializableTransaction<T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await prisma.$transaction(callback, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      const isSerializationConflict =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034";

      if (!isSerializationConflict || attempt === 3) {
        throw error;
      }
    }
  }

  throw new Error("Serializable transaction failed unexpectedly.");
}

describe("Worksheet conversation race protection", () => {
  afterAll(async () => {
    // Clear the active-message FK before deleting messages.
    await prisma.aIConversation.updateMany({
      where: {
        id: conversationId,
        userId,
      },
      data: {
        activeMessageId: null,
      },
    });

    await prisma.aIMessage.deleteMany({
      where: {
        userId,
      },
    });

    await prisma.aIGeneration.deleteMany({
      where: {
        userId,
      },
    });

    await prisma.aIConversation.deleteMany({
      where: {
        userId,
      },
    });

    await prisma.user.deleteMany({
      where: {
        id: userId,
      },
    });

    await prisma.$disconnect();
  });

  it("rejects stale worksheet finalization and preserves the newer active message", async () => {
    await prisma.user.create({
      data: {
        id: userId,
        name: "Worksheet Race Test",
        email: TEST_USER_EMAIL,
      },
    });

    const conversation = await prisma.aIConversation.create({
      data: {
        id: conversationId,
        userId,
        title: "Worksheet Race Test",
        status: "ACTIVE",
      },
    });

    const initialMessage = await prisma.aIMessage.create({
      data: {
        conversationId: conversation.id,
        userId,
        role: "USER",
        content: "Create a Grade 1 math worksheet.",
      },
    });

    await prisma.aIConversation.update({
      where: {
        id: conversation.id,
      },
      data: {
        activeMessageId: initialMessage.id,
      },
    });

    const generation = await prisma.aIGeneration.create({
      data: {
        userId,
        type: AIGenerationType.WORKSHEET,
        operation: "WORKSHEET",
        status: AIGenerationStatus.PROCESSING,
        prompt: "Create a Grade 1 math worksheet.",
        startedAt: new Date(),
      },
    });

    const expectedActiveMessageId = initialMessage.id;

    /*
     * Barrier:
     *
     * The worksheet finalizer signals once its serializable transaction
     * has established its snapshot. The competing message mutation is
     * then committed before worksheet finalization continues.
     */
    let signalFinalizationStarted!: () => void;

    const finalizationStarted = new Promise<void>((resolve) => {
      signalFinalizationStarted = resolve;
    });

    let releaseWorksheetFinalization!: () => void;

    const finalizationGate = new Promise<void>((resolve) => {
      releaseWorksheetFinalization = resolve;
    });

    const worksheetFinalization = runSerializableTransaction(async (tx) => {
      /*
       * Match production behavior:
       * establish the transaction against the conversation first.
       */
      await tx.aIConversation.findUniqueOrThrow({
        where: {
          id: conversation.id,
        },
        select: {
          activeMessageId: true,
        },
      });

      signalFinalizationStarted();

      /*
       * Keep the worksheet transaction open while another request
       * changes the conversation.
       */
      await finalizationGate;

      /*
       * Match worksheet finalization:
       * create assistant + CAS conversation update in the same
       * serializable transaction.
       */
      const assistant = await tx.aIMessage.create({
        data: {
          conversationId: conversation.id,
          userId,
          role: "ASSISTANT",
          content: 'Your worksheet "Race Test Worksheet" is ready.',
          generationId: generation.id,
          parentMessageId: initialMessage.id,
          metadata: {
            type: "WORKSHEET",
            requestId: "worksheet-race-request",
          },
        },
      });

      const updated = await tx.aIConversation.updateMany({
        where: {
          id: conversation.id,
          userId,
          status: "ACTIVE",
          activeMessageId: expectedActiveMessageId,
        },
        data: {
          activeMessageId: assistant.id,
          updatedAt: new Date(),
        },
      });

      if (updated.count !== 1) {
        throw new Error("Conversation changed while finalizing.");
      }

      await tx.aIGeneration.update({
        where: {
          id: generation.id,
        },
        data: {
          status: AIGenerationStatus.COMPLETED,
          completedAt: new Date(),
        },
      });

      return assistant.id;
    });

    /*
     * Do not rely on timing.
     *
     * Wait until the worksheet transaction has definitely entered the
     * stale-conversation window.
     */
    await finalizationStarted;

    /*
     * Competing chat mutation.
     *
     * This represents another request changing the conversation while
     * worksheet generation is still in progress.
     */
    const newerMessage = await prisma.aIMessage.create({
      data: {
        conversationId: conversation.id,
        userId,
        role: "USER",
        content: "This is the newer chat message.",
        parentMessageId: initialMessage.id,
      },
    });

    await prisma.aIConversation.update({
      where: {
        id: conversation.id,
      },
      data: {
        activeMessageId: newerMessage.id,
        updatedAt: new Date(),
      },
    });

    /*
     * Let worksheet finalization continue.
     */
    releaseWorksheetFinalization();

    /*
     * The stale worksheet transaction must NOT become the new tail.
     */
    await expect(worksheetFinalization).rejects.toThrow(
      "Conversation changed while finalizing.",
    );

    /*
     * Verify the newer message still owns the conversation tail.
     */
    const finalConversation = await prisma.aIConversation.findUniqueOrThrow({
      where: {
        id: conversation.id,
      },
      select: {
        activeMessageId: true,
      },
    });

    expect(finalConversation.activeMessageId).toBe(newerMessage.id);

    /*
     * Because assistant creation and the CAS are inside the same
     * transaction, the failed worksheet finalization must not leave
     * an orphan assistant behind.
     */
    const worksheetAssistantCount = await prisma.aIMessage.count({
      where: {
        generationId: generation.id,
      },
    });

    expect(worksheetAssistantCount).toBe(0);

    /*
     * Match the production error settlement path.
     */
    await prisma.aIGeneration.updateMany({
      where: {
        id: generation.id,
        status: {
          in: [AIGenerationStatus.PENDING, AIGenerationStatus.PROCESSING],
        },
      },
      data: {
        status: AIGenerationStatus.FAILED,
        errorMessage: "Conversation changed while finalizing.",
        completedAt: new Date(),
      },
    });

    const failedGeneration = await prisma.aIGeneration.findUniqueOrThrow({
      where: {
        id: generation.id,
      },
      select: {
        status: true,
        errorMessage: true,
      },
    });

    expect(failedGeneration.status).toBe(AIGenerationStatus.FAILED);

    expect(failedGeneration.errorMessage).toBe(
      "Conversation changed while finalizing.",
    );
  });
});
