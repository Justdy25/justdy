import prisma from "@/lib/prisma";
import { CreditTransactionType } from "@/lib/generated/prisma/enums";
/* ============================================================
   GENERAL JUSTDY AI CREDIT COSTS
============================================================ */

export const AI_CREDIT_COSTS = {
  CHAT: 1,
  RESEARCH: 5,
  IMAGE: 5,
  VIDEO: 20,
  AUDIO: 10,
  DOCUMENT: 3,
  WORKSHEET: 5,
  WORKBOOK: 10,
  QUIZ: 3,
  LESSON_PLAN: 3,
  PRESENTATION: 8,
} as const;

export type AICreditOperation = keyof typeof AI_CREDIT_COSTS;

/* ============================================================
   ERRORS
============================================================ */

export class InsufficientAICreditsError extends Error {
  required: number;
  available: number;

  constructor(required: number, available: number) {
    super("Insufficient AI credits.");

    this.name = "InsufficientAICreditsError";
    this.required = required;
    this.available = available;
  }
}

/* ============================================================
   ENSURE CREDIT ACCOUNT
============================================================ */

/**
 * Ensures that a UserCredit record exists for the user.
 *
 * IMPORTANT:
 * This does NOT grant credits.
 *
 * A newly-created account starts with the Prisma default
 * balance of 0.
 */
export async function ensureCreditAccount(userId: string) {
  return prisma.userCredit.upsert({
    where: {
      userId,
    },

    create: {
      userId,
      balance: 0,
    },

    update: {},

    select: {
      id: true,
      userId: true,
      balance: true,
    },
  });
}

/* ============================================================
   GET CREDIT BALANCE
============================================================ */

/**
 * Legacy/general credit balance helper.
 *
 * Existing AI Video Studio code uses this name.
 */
export async function getCreditBalance(userId: string) {
  const creditAccount = await prisma.userCredit.findUnique({
    where: {
      userId,
    },

    select: {
      id: true,
      balance: true,
    },
  });

  return creditAccount?.balance ?? 0;
}

/**
 * Generalized AI credit balance helper.
 *
 * Unlike ensureCreditAccount(), this function does not create
 * an account and does not grant credits.
 */
export async function getAICreditBalance(userId: string) {
  const userCredit = await prisma.userCredit.findUnique({
    where: {
      userId,
    },

    select: {
      id: true,
      balance: true,
    },
  });

  return {
    id: userCredit?.id ?? null,
    balance: userCredit?.balance ?? 0,
  };
}

/* ============================================================
   ADD CREDITS
============================================================ */

/**
 * Add credits inside an existing Prisma transaction.
 *
 * This preserves the existing AI Video credit system.
 *
 * `tx` should be the transaction client:
 *
 * const result = await prisma.$transaction(async (tx) => {
 *   return addCreditsInTransaction(tx, ...);
 * });
 */
export async function addCreditsInTransaction(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  {
    userId,
    amount,
    type,
    description,
    aiGenerationId,
    generationId,
  }: {
    userId: string;
    amount: number;
    type?: CreditTransactionType;
    description?: string;
    aiGenerationId?: string;
    generationId?: string;
  },
) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("Credit amount must be a positive integer.");
  }

  const userCredit = await tx.userCredit.upsert({
    where: { userId },
    create: {
      userId,
      balance: amount,
    },
    update: {
      balance: {
        increment: amount,
      },
    },
    select: {
      id: true,
      userId: true,
      balance: true,
    },
  });

  await tx.creditTransaction.create({
    data: {
      userId,
      userCreditId: userCredit.id,
      amount,
      type: type ?? CreditTransactionType.GRANT,
      description: description ?? "AI credits added",
      aiGenerationId: aiGenerationId ?? generationId,
    },
  });

  return userCredit;
}

/* ============================================================
   DEDUCT CREDITS
============================================================ */

/**
 * Deduct credits inside an existing Prisma transaction.
 *
 * This is the compatibility layer for the existing AI Video
 * Studio credit system.
 */
export async function deductCreditsInTransaction(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  {
    userId,
    amount,
    generationId,
    aiGenerationId,
    description,
  }: {
    userId: string;
    amount: number;
    generationId?: string;
    aiGenerationId?: string;
    description?: string;
  },
) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("Credit amount must be a positive integer.");
  }

  const userCredit = await tx.userCredit.findUnique({
    where: { userId },
    select: {
      id: true,
      userId: true,
      balance: true,
    },
  });

  if (!userCredit) {
    throw new InsufficientAICreditsError(amount, 0);
  }

  if (userCredit.balance < amount) {
    throw new InsufficientAICreditsError(amount, userCredit.balance);
  }

  const updatedCredit = await tx.userCredit.update({
    where: {
      id: userCredit.id,
    },
    data: {
      balance: {
        decrement: amount,
      },
    },
    select: {
      id: true,
      userId: true,
      balance: true,
    },
  });

  await tx.creditTransaction.create({
    data: {
      userId,
      userCreditId: userCredit.id,
      amount: -amount,
      type: CreditTransactionType.GENERATION,
      description: description ?? "AI credits used",
      aiGenerationId: aiGenerationId ?? generationId,
    },
  });

  return updatedCredit;
}

/* ============================================================
   CONSUME JUSTDY AI CREDITS
============================================================ */

/**
 * Atomically consume credits for a generalized Justdy AI
 * operation.
 *
 * The balance check and deduction occur inside one transaction.
 */
export async function consumeAICredits({
  userId,
  operation,
  generationId,
}: {
  userId: string;
  operation: AICreditOperation;
  generationId?: string;
}) {
  const cost = AI_CREDIT_COSTS[operation];

  if (cost <= 0) {
    throw new Error(`Invalid credit cost for ${operation}.`);
  }

  const result = await prisma.$transaction(async (tx) => {
    const userCredit = await tx.userCredit.findUnique({
      where: {
        userId,
      },

      select: {
        id: true,
        balance: true,
      },
    });

    if (!userCredit) {
      throw new InsufficientAICreditsError(cost, 0);
    }

    if (userCredit.balance < cost) {
      throw new InsufficientAICreditsError(cost, userCredit.balance);
    }

    const updatedCredit = await tx.userCredit.update({
      where: {
        id: userCredit.id,
      },

      data: {
        balance: {
          decrement: cost,
        },
      },

      select: {
        id: true,
        balance: true,
      },
    });

    await tx.creditTransaction.create({
      data: {
        userId,
        userCreditId: userCredit.id,
        amount: -cost,
        type: "GENERATION",
        description: `Justdy AI ${operation.toLowerCase()} generation`,
        aiGenerationId: generationId,
      },
    });

    return updatedCredit;
  });

  return {
    cost,
    balance: result.balance,
  };
}

/* ============================================================
   REFUND JUSTDY AI CREDITS
============================================================ */

/**
 * Refund credits after a failed AI generation.
 */
export async function refundAICredits({
  userId,
  operation,
  generationId,
}: {
  userId: string;
  operation: AICreditOperation;
  generationId?: string;
}) {
  const amount = AI_CREDIT_COSTS[operation];

  if (amount <= 0) {
    throw new Error(`Invalid credit cost for ${operation}.`);
  }

  return prisma.$transaction(async (tx) => {
    const userCredit = await tx.userCredit.upsert({
      where: {
        userId,
      },

      create: {
        userId,
        balance: amount,
      },

      update: {
        balance: {
          increment: amount,
        },
      },

      select: {
        id: true,
        balance: true,
      },
    });

    await tx.creditTransaction.create({
      data: {
        userId,
        userCreditId: userCredit.id,
        amount,
        type: "REFUND",
        description: `Refund for failed Justdy AI ${operation.toLowerCase()} generation`,
        aiGenerationId: generationId,
      },
    });

    return {
      refunded: amount,
      balance: userCredit.balance,
    };
  });
}
