import { beforeEach, afterAll, describe, expect, it } from "vitest";

import prisma from "@/lib/prisma";
import { enforceAIConcurrencyLimit } from "@/lib/ai/rate-limit";
import {
  AIGenerationStatus,
  AIGenerationType,
} from "@/lib/generated/prisma/enums";

const TEST_USER_EMAIL = `ai-concurrency-${Date.now()}@test.justdy.local`;

let testUserId: string;

async function createTestUser() {
  const user = await prisma.user.create({
    data: {
      name: "AI Concurrency Test User",
      email: TEST_USER_EMAIL,
    },
    select: {
      id: true,
    },
  });

  return user.id;
}

async function createGeneration(userId: string, status: AIGenerationStatus) {
  return prisma.aIGeneration.create({
    data: {
      userId,
      type: AIGenerationType.TEXT,
      status,
      prompt: "Concurrency integration test",
      creditsUsed: 0,
    },
    select: {
      id: true,
      status: true,
    },
  });
}

describe("AI concurrency protection", () => {
  beforeEach(async () => {
    if (!testUserId) {
      testUserId = await createTestUser();
    }

    await prisma.aIGeneration.deleteMany({
      where: {
        userId: testUserId,
      },
    });
  });

  afterAll(async () => {
    if (testUserId) {
      await prisma.aIGeneration.deleteMany({
        where: {
          userId: testUserId,
        },
      });

      await prisma.user.delete({
        where: {
          id: testUserId,
        },
      });
    }

    await prisma.$disconnect();
  });

  it("allows up to the configured active-generation limit", async () => {
    await createGeneration(testUserId, AIGenerationStatus.PROCESSING);
    await createGeneration(testUserId, AIGenerationStatus.PROCESSING);
    await createGeneration(testUserId, AIGenerationStatus.PROCESSING);

    await expect(
      prisma.$transaction(async (tx) => {
        await enforceAIConcurrencyLimit(tx, testUserId);
      }),
    ).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
  });

  it("counts both PENDING and PROCESSING generations as active", async () => {
    await createGeneration(testUserId, AIGenerationStatus.PENDING);
    await createGeneration(testUserId, AIGenerationStatus.PENDING);
    await createGeneration(testUserId, AIGenerationStatus.PROCESSING);

    await expect(
      prisma.$transaction(async (tx) => {
        await enforceAIConcurrencyLimit(tx, testUserId);
      }),
    ).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
  });

  it("does not count completed generations as active", async () => {
    await createGeneration(testUserId, AIGenerationStatus.COMPLETED);
    await createGeneration(testUserId, AIGenerationStatus.COMPLETED);
    await createGeneration(testUserId, AIGenerationStatus.COMPLETED);

    await expect(
      prisma.$transaction(async (tx) => {
        await enforceAIConcurrencyLimit(tx, testUserId);
      }),
    ).resolves.toBeUndefined();
  });

  it("does not count failed generations as active", async () => {
    await createGeneration(testUserId, AIGenerationStatus.FAILED);
    await createGeneration(testUserId, AIGenerationStatus.FAILED);
    await createGeneration(testUserId, AIGenerationStatus.FAILED);

    await expect(
      prisma.$transaction(async (tx) => {
        await enforceAIConcurrencyLimit(tx, testUserId);
      }),
    ).resolves.toBeUndefined();
  });

  it("allows a new generation after an active generation settles", async () => {
    const generations = await Promise.all([
      createGeneration(testUserId, AIGenerationStatus.PROCESSING),
      createGeneration(testUserId, AIGenerationStatus.PROCESSING),
      createGeneration(testUserId, AIGenerationStatus.PROCESSING),
    ]);

    await prisma.aIGeneration.update({
      where: {
        id: generations[0].id,
      },
      data: {
        status: AIGenerationStatus.COMPLETED,
        completedAt: new Date(),
      },
    });

    await expect(
      prisma.$transaction(async (tx) => {
        await enforceAIConcurrencyLimit(tx, testUserId);
      }),
    ).resolves.toBeUndefined();
  });

  it("isolates concurrency limits between different users", async () => {
    const otherUser = await prisma.user.create({
      data: {
        name: "AI Concurrency Other User",
        email: `ai-concurrency-other-${Date.now()}@test.justdy.local`,
      },
      select: {
        id: true,
      },
    });

    try {
      await createGeneration(testUserId, AIGenerationStatus.PROCESSING);
      await createGeneration(testUserId, AIGenerationStatus.PROCESSING);
      await createGeneration(testUserId, AIGenerationStatus.PROCESSING);

      await expect(
        prisma.$transaction(async (tx) => {
          await enforceAIConcurrencyLimit(tx, otherUser.id);
        }),
      ).resolves.toBeUndefined();
    } finally {
      await prisma.aIGeneration.deleteMany({
        where: {
          userId: otherUser.id,
        },
      });

      await prisma.user.delete({
        where: {
          id: otherUser.id,
        },
      });
    }
  });

  it("enforces the concurrency limit under a true concurrent race", async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 4 }, () =>
        prisma.$transaction(async (tx) => {
          await enforceAIConcurrencyLimit(tx, testUserId);

          return tx.aIGeneration.create({
            data: {
              userId: testUserId,
              type: AIGenerationType.TEXT,
              status: AIGenerationStatus.PROCESSING,
              prompt: "Concurrent race test",
              creditsUsed: 0,
            },
            select: {
              id: true,
            },
          });
        }),
      ),
    );

    const fulfilled = results.filter(
      (result): result is PromiseFulfilledResult<{ id: string }> =>
        result.status === "fulfilled",
    );

    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );

    expect(fulfilled).toHaveLength(3);
    expect(rejected).toHaveLength(1);

    expect(rejected[0].reason).toMatchObject({
      code: "RATE_LIMITED",
    });

    const activeGenerationCount = await prisma.aIGeneration.count({
      where: {
        userId: testUserId,
        status: {
          in: [AIGenerationStatus.PENDING, AIGenerationStatus.PROCESSING],
        },
      },
    });

    expect(activeGenerationCount).toBe(3);
  });
});
