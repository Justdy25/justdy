import prisma from "@/lib/prisma";

import { CreditTransactionType } from "@/lib/generated/prisma/enums";

/* ============================================================
   AI CREDIT PRICING
============================================================ */

export const AI_CREDIT_COSTS = {
  CHAT: 1,
  RESEARCH: 5,
  IMAGE: 5,
  VIDEO: 20,
  AUDIO: 10,
  DOCUMENT: 3,
  WORKSHEET: 5,
  QUIZ: 3,
  LESSON_PLAN: 3,
  PRESENTATION: 8,
} as const;

export type AICreditOperation = keyof typeof AI_CREDIT_COSTS;

/* ============================================================
   ERRORS
============================================================ */

export class InsufficientAICreditsError extends Error {
  readonly required: number;
  readonly available: number;

  constructor(required: number, available: number) {
    super(
      `Insufficient AI credits. Required: ${required}. Available: ${available}.`,
    );
    this.name = "InsufficientAICreditsError";
    this.required = required;
    this.available = available;
  }
}

/* ============================================================
   HELPERS
============================================================ */

function getCreditCost(operation: AICreditOperation): number {
  const cost = AI_CREDIT_COSTS[operation];

  if (!cost) {
    throw new Error(
      `No credit cost configured for AI operation "${operation}".`,
    );
  }

  return cost;
}

function normalizeRequiredId(value: string, label: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${label} is required.`);
  }

  return normalized;
}

/* ============================================================
   CONSUME CREDITS
============================================================ */

/**
 * Race-safe atomic credit consumption.
 *
 * The balance decrement, generation billing metadata, and GENERATION
 * ledger entry all commit in the same database transaction.
 *
 * creditsUsed and creditChargedAt are written from the actual charge,
 * so future refunds never depend on today's pricing table.
 */
export async function consumeAICreditsAtomic({
  userId,
  operation,
  generationId,
}: {
  userId: string;
  operation: AICreditOperation;
  generationId?: string;
}): Promise<{
  cost: number;
  balance: number;
}> {
  const normalizedUserId = normalizeRequiredId(userId, "User ID");
  const normalizedGenerationId = generationId?.trim() || undefined;
  const cost = getCreditCost(operation);

  return prisma.$transaction(async (tx) => {
    const account = await tx.userCredit.findUnique({
      where: {
        userId: normalizedUserId,
      },
      select: {
        id: true,
        balance: true,
      },
    });

    if (!account) {
      throw new InsufficientAICreditsError(cost, 0);
    }

    /*
     * Conditional UPDATE makes the balance check and decrement atomic.
     * PostgreSQL locks the affected UserCredit row.
     */
    const updated = await tx.userCredit.updateMany({
      where: {
        id: account.id,
        balance: {
          gte: cost,
        },
      },
      data: {
        balance: {
          decrement: cost,
        },
      },
    });

    if (updated.count !== 1) {
      const current = await tx.userCredit.findUnique({
        where: {
          id: account.id,
        },
        select: {
          balance: true,
        },
      });

      throw new InsufficientAICreditsError(cost, current?.balance ?? 0);
    }

    const afterCharge = await tx.userCredit.findUnique({
      where: {
        id: account.id,
      },
      select: {
        balance: true,
      },
    });

    if (!afterCharge) {
      throw new Error("AI credit account disappeared during consumption.");
    }

    /*
     * If this charge belongs to an AIGeneration, persist the exact
     * charged amount and timestamp in the SAME transaction.
     *
     * The operation is already written by the generation creator.
     * creditOperation is also refreshed here so legacy PENDING
     * generations that enter this path become billing-aware.
     */
    if (normalizedGenerationId) {
      const generation = await tx.aIGeneration.findFirst({
        where: {
          id: normalizedGenerationId,
          userId: normalizedUserId,
        },
        select: {
          id: true,
          status: true,
        },
      });

      if (!generation) {
        throw new Error("AI generation not found.");
      }

      const billingUpdated = await tx.aIGeneration.updateMany({
        where: {
          id: normalizedGenerationId,
          userId: normalizedUserId,
          status: "PENDING",
        },
        data: {
          creditsUsed: cost,
          creditChargedAt: new Date(),
          creditOperation: operation,
        },
      });

      if (billingUpdated.count !== 1) {
        throw new Error(
          `AI generation is already ${generation.status.toLowerCase()}.`,
        );
      }
    }

    await tx.creditTransaction.create({
      data: {
        userId: normalizedUserId,
        userCreditId: account.id,
        amount: -cost,
        type: CreditTransactionType.GENERATION,
        description: `AI ${operation} generation`,
        ...(normalizedGenerationId
          ? {
              aiGenerationId: normalizedGenerationId,
            }
          : {}),
      },
    });

    return {
      cost,
      balance: afterCharge.balance,
    };
  });
}

/* ============================================================
   START STREAMING GENERATION
============================================================ */

/**
 * Atomically claims a PENDING generation and charges its credits.
 *
 * Generation state, billing metadata, UserCredit balance, and the
 * GENERATION ledger entry are committed together.
 *
 * Only one concurrent caller can successfully claim the generation.
 */
export async function startAIGenerationAtomic({
  userId,
  operation,
  generationId,
}: {
  userId: string;
  operation: AICreditOperation;
  generationId: string;
}): Promise<{
  cost: number;
  balance: number;
}> {
  const normalizedUserId = normalizeRequiredId(userId, "User ID");
  const normalizedGenerationId = normalizeRequiredId(
    generationId,
    "Generation ID",
  );
  const cost = getCreditCost(operation);
  const chargedAt = new Date();

  return prisma.$transaction(async (tx) => {
    /*
     * Claim the generation first. This establishes a consistent lock
     * order for the generation -> account workflow.
     */
    const generation = await tx.aIGeneration.findFirst({
      where: {
        id: normalizedGenerationId,
        userId: normalizedUserId,
      },
      select: {
        status: true,
        creditOperation: true,
        creditsUsed: true,
        creditChargedAt: true,
        creditRefundedAt: true,
      },
    });

    if (!generation) {
      throw new Error("AI generation not found.");
    }

    if (generation.status !== "PENDING") {
      throw new Error(
        `AI generation is already ${generation.status.toLowerCase()}.`,
      );
    }

    if (generation.creditOperation !== operation) {
      throw new Error(
        `AI generation billing operation mismatch: expected ${generation.creditOperation ?? "none"}, received ${operation}.`,
      );
    }

    if (generation.creditRefundedAt) {
      throw new Error("AI generation has already been refunded.");
    }

    if (generation.creditChargedAt || generation.creditsUsed !== 0) {
      throw new Error("AI generation already contains billing state.");
    }

    const claimed = await tx.aIGeneration.updateMany({
      where: {
        id: normalizedGenerationId,
        userId: normalizedUserId,
        status: "PENDING",
        creditOperation: operation,
        creditsUsed: 0,
        creditChargedAt: null,
        creditRefundedAt: null,
      },
      data: {
        status: "PROCESSING",
        creditsUsed: cost,
        creditOperation: operation,
        creditChargedAt: chargedAt,
        startedAt: chargedAt,
      },
    });

    if (claimed.count !== 1) {
      const current = await tx.aIGeneration.findFirst({
        where: {
          id: normalizedGenerationId,
          userId: normalizedUserId,
        },
        select: {
          status: true,
        },
      });

      if (!current) {
        throw new Error("AI generation not found.");
      }

      throw new Error(
        `AI generation is already ${current.status.toLowerCase()}.`,
      );
    }

    const account = await tx.userCredit.findUnique({
      where: {
        userId: normalizedUserId,
      },
      select: {
        id: true,
        balance: true,
      },
    });

    if (!account) {
      throw new InsufficientAICreditsError(cost, 0);
    }

    const updated = await tx.userCredit.updateMany({
      where: {
        id: account.id,
        balance: {
          gte: cost,
        },
      },
      data: {
        balance: {
          decrement: cost,
        },
      },
    });

    if (updated.count !== 1) {
      const current = await tx.userCredit.findUnique({
        where: {
          id: account.id,
        },
        select: {
          balance: true,
        },
      });

      throw new InsufficientAICreditsError(cost, current?.balance ?? 0);
    }

    const afterCharge = await tx.userCredit.findUnique({
      where: {
        id: account.id,
      },
      select: {
        balance: true,
      },
    });

    if (!afterCharge) {
      throw new Error("AI credit account disappeared during consumption.");
    }

    await tx.creditTransaction.create({
      data: {
        userId: normalizedUserId,
        userCreditId: account.id,
        amount: -cost,
        type: CreditTransactionType.GENERATION,
        description: `AI ${operation} generation`,
        aiGenerationId: normalizedGenerationId,
      },
    });

    return {
      cost,
      balance: afterCharge.balance,
    };
  });
}

/* ============================================================
   REFUND CREDITS
============================================================ */

/**
 * Atomically refunds the exact amount actually charged to a generation.
 *
 * The refund amount comes from AIGeneration.creditsUsed rather than the
 * current pricing table. This protects historical generations from
 * future pricing changes.
 *
 * The generation billing state, balance, and REFUND ledger entry are
 * protected by the same database transaction.
 *
 * The function is idempotent: a generation can only be refunded once.
 */
export async function refundAICreditsAtomic({
  userId,
  generationId,
}: {
  userId: string;
  generationId: string;
}): Promise<{
  refunded: boolean;
  amount: number;
  balance: number;
}> {
  const normalizedUserId = normalizeRequiredId(userId, "User ID");
  const normalizedGenerationId = normalizeRequiredId(
    generationId,
    "Generation ID",
  );

  return prisma.$transaction(async (tx) => {
    /*
     * Lock the generation first. All generation refunds use the same
     * generation -> UserCredit lock order, preventing two refund paths
     * from both paying the same generation.
     */
    const generation = await tx.aIGeneration.findFirst({
      where: {
        id: normalizedGenerationId,
        userId: normalizedUserId,
      },
      select: {
        id: true,
        creditsUsed: true,
        creditChargedAt: true,
        creditRefundedAt: true,
        creditOperation: true,
      },
    });

    if (!generation) {
      throw new Error("AI generation not found.");
    }

    if (generation.creditRefundedAt) {
      const account = await tx.userCredit.findUnique({
        where: {
          userId: normalizedUserId,
        },
        select: {
          balance: true,
        },
      });

      if (!account) {
        throw new Error("AI credit account not found.");
      }

      return {
        refunded: false,
        amount: 0,
        balance: account.balance,
      };
    }

    /*
     * A refund is only valid for a generation that has an explicit
     * recorded charge. Historical records without this metadata are
     * intentionally not refunded automatically.
     */
    if (
      !generation.creditChargedAt ||
      !generation.creditOperation ||
      generation.creditsUsed <= 0
    ) {
      throw new Error(
        "AI generation does not contain a refundable credit charge.",
      );
    }

    const account = await tx.userCredit.findUnique({
      where: {
        userId: normalizedUserId,
      },
      select: {
        id: true,
      },
    });

    if (!account) {
      throw new Error("AI credit account not found.");
    }

    /*
     * Lock the UserCredit row before checking the ledger. This prevents
     * another concurrent refund path from changing the balance between
     * the duplicate check and the increment.
     */
    const lockedAccount = await tx.userCredit.update({
      where: {
        id: account.id,
      },
      data: {
        balance: {
          increment: generation.creditsUsed,
        },
      },
      select: {
        balance: true,
      },
    });

    const existingRefund = await tx.creditTransaction.findFirst({
      where: {
        userId: normalizedUserId,
        aiGenerationId: normalizedGenerationId,
        type: CreditTransactionType.REFUND,
      },
      select: {
        id: true,
      },
    });

    if (existingRefund) {
      /*
       * A refund ledger already exists. Undo the provisional increment.
       */
      const restored = await tx.userCredit.update({
        where: {
          id: account.id,
        },
        data: {
          balance: {
            decrement: generation.creditsUsed,
          },
        },
        select: {
          balance: true,
        },
      });

      await tx.aIGeneration.update({
        where: {
          id: generation.id,
        },
        data: {
          creditRefundedAt: new Date(),
        },
      });

      return {
        refunded: false,
        amount: 0,
        balance: restored.balance,
      };
    }

    await tx.creditTransaction.create({
      data: {
        userId: normalizedUserId,
        userCreditId: account.id,
        amount: generation.creditsUsed,
        type: CreditTransactionType.REFUND,
        description: `Refund for failed AI ${generation.creditOperation} generation`,
        aiGenerationId: normalizedGenerationId,
      },
    });

    await tx.aIGeneration.update({
      where: {
        id: generation.id,
      },
      data: {
        creditRefundedAt: new Date(),
      },
    });

    return {
      refunded: true,
      amount: generation.creditsUsed,
      balance: lockedAccount.balance,
    };
  });
}
