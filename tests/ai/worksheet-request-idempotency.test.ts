import { afterAll, beforeAll, describe, expect, it } from "vitest";

import prisma from "@/lib/prisma";
import {
  AIGenerationStatus,
  AIGenerationType,
} from "@/lib/generated/prisma/enums";
import { Prisma } from "@/lib/generated/prisma/client";

const testUserId = `worksheet-idempotency-user-${Date.now()}`;
const testRequestId = `worksheet-idempotency-request-${Date.now()}`;

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

      await new Promise<void>((resolve) => {
        setTimeout(resolve, 25 * 2 ** (attempt - 1));
      });
    }
  }

  throw new Error("Serializable transaction failed unexpectedly.");
}

/**
 * Mirrors the production worksheet claim boundary:
 *
 * - requestId is unique in AIGeneration
 * - the create happens transactionally
 * - the winner owns the generation
 * - a concurrent duplicate resolves to the existing generation
 */
async function claimWorksheetGeneration({
  userId,
  requestId,
}: {
  userId: string;
  requestId: string;
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

describe("Worksheet request-id idempotency", () => {
  beforeAll(async () => {
    /*
     * The user must exist before either test attempts to create
     * an AIGeneration because AIGeneration.userId has a foreign key.
     */
    await prisma.user.create({
      data: {
        id: testUserId,
        name: "Worksheet Idempotency Test",
        email: `${testUserId}@example.test`,
      },
    });
  });

  afterAll(async () => {
    await prisma.aIGeneration.deleteMany({
      where: {
        userId: testUserId,
      },
    });

    await prisma.user.deleteMany({
      where: {
        id: testUserId,
      },
    });

    await prisma.$disconnect();
  });

  it("allows two legitimate concurrent worksheet requests with different requestIds", async () => {
    const requestIdA = `${testRequestId}-a`;
    const requestIdB = `${testRequestId}-b`;

    const [requestA, requestB] = await Promise.all([
      claimWorksheetGeneration({
        userId: testUserId,
        requestId: requestIdA,
      }),
      claimWorksheetGeneration({
        userId: testUserId,
        requestId: requestIdB,
      }),
    ]);

    /*
     * Both requests are legitimate and therefore both must win.
     */
    expect(requestA.claimed).toBe(true);
    expect(requestB.claimed).toBe(true);

    /*
     * Each request must receive its own generation record.
     */
    expect(requestA.generation.id).not.toBe(requestB.generation.id);

    expect(requestA.generation.requestId).toBe(requestIdA);
    expect(requestB.generation.requestId).toBe(requestIdB);

    expect(requestA.generation.userId).toBe(testUserId);
    expect(requestB.generation.userId).toBe(testUserId);

    expect(requestA.generation.type).toBe(AIGenerationType.WORKSHEET);

    expect(requestB.generation.type).toBe(AIGenerationType.WORKSHEET);

    /*
     * Both generations should remain independently claimable records.
     */
    expect(requestA.generation.status).toBe(AIGenerationStatus.PENDING);

    expect(requestB.generation.status).toBe(AIGenerationStatus.PENDING);

    /*
     * Verify both rows actually exist in the database.
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

    expect(generations.map((generation) => generation.requestId)).toEqual(
      expect.arrayContaining([requestIdA, requestIdB]),
    );

    expect(new Set(generations.map((generation) => generation.id)).size).toBe(
      2,
    );
  });

  it("allows exactly one winner for two concurrent requests with the same requestId", async () => {
    const [requestA, requestB] = await Promise.all([
      claimWorksheetGeneration({
        userId: testUserId,
        requestId: testRequestId,
      }),
      claimWorksheetGeneration({
        userId: testUserId,
        requestId: testRequestId,
      }),
    ]);

    /*
     * Exactly one request must win the durable claim.
     */
    const winners = [requestA, requestB].filter((result) => result.claimed);

    const duplicates = [requestA, requestB].filter((result) => !result.claimed);

    expect(winners).toHaveLength(1);
    expect(duplicates).toHaveLength(1);

    /*
     * Both callers must resolve to the exact same generation record.
     */
    expect(requestA.generation.id).toBe(requestB.generation.id);

    expect(requestA.generation.requestId).toBe(testRequestId);

    expect(requestB.generation.requestId).toBe(testRequestId);

    expect(requestA.generation.userId).toBe(testUserId);

    expect(requestB.generation.userId).toBe(testUserId);

    expect(requestA.generation.type).toBe(AIGenerationType.WORKSHEET);

    expect(requestB.generation.type).toBe(AIGenerationType.WORKSHEET);

    /*
     * There must be exactly one durable generation row.
     */
    const generations = await prisma.aIGeneration.findMany({
      where: {
        userId: testUserId,
        requestId: testRequestId,
      },
      select: {
        id: true,
        requestId: true,
        userId: true,
        type: true,
        status: true,
      },
    });

    expect(generations).toHaveLength(1);

    expect(generations[0].id).toBe(requestA.generation.id);

    expect(generations[0].requestId).toBe(testRequestId);

    expect(generations[0].type).toBe(AIGenerationType.WORKSHEET);

    expect(generations[0].status).toBe(AIGenerationStatus.PENDING);
  });
});
