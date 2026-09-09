import "server-only";

import prisma from "@/lib/prisma";
import { CreditTransactionType } from "@/lib/generated/prisma/enums";

import { getVideoCreditCost } from "./pricing";
import type { VideoDuration, VideoModel } from "./types";

export class InsufficientVideoCreditsError extends Error {
  readonly required: number;
  readonly available: number;

  constructor(required: number, available: number) {
    super(
      `Insufficient AI credits. Required: ${required}. Available: ${available}.`,
    );

    this.name = "InsufficientVideoCreditsError";
    this.required = required;
    this.available = available;
  }
}

export async function consumeVideoCreditsAtomic({
  userId,
  generationId,
  duration,
  model,
}: {
  userId: string;
  generationId: string;
  duration: VideoDuration;
  model: VideoModel;
}) {
  const cost = getVideoCreditCost(duration, model);
  const chargedAt = new Date();

  return prisma.$transaction(async (tx) => {
    const generation = await tx.videoGeneration.findFirst({
      where: {
        id: generationId,
        userId,
      },
      select: {
        id: true,
        status: true,
        creditsUsed: true,
        creditChargedAt: true,
        creditRefundedAt: true,
      },
    });

    if (!generation) {
      throw new Error("Video generation not found.");
    }

    if (generation.status !== "PENDING") {
      throw new Error(
        `Video generation is already ${generation.status.toLowerCase()}.`,
      );
    }

    if (generation.creditChargedAt || generation.creditsUsed !== 0) {
      throw new Error("Video generation already contains billing state.");
    }

    if (generation.creditRefundedAt) {
      throw new Error("Video generation has already been refunded.");
    }

    /*
     * Claim the generation.
     */
    const claimed = await tx.videoGeneration.updateMany({
      where: {
        id: generationId,
        userId,
        status: "PENDING",
        creditsUsed: 0,
        creditChargedAt: null,
        creditRefundedAt: null,
      },
      data: {
        status: "PROCESSING",
        creditsUsed: cost,
        creditChargedAt: chargedAt,
      },
    });

    if (claimed.count !== 1) {
      throw new Error("Video generation could not be claimed.");
    }

    const account = await tx.userCredit.findUnique({
      where: {
        userId,
      },
      select: {
        id: true,
        balance: true,
      },
    });

    if (!account) {
      throw new InsufficientVideoCreditsError(cost, 0);
    }

    /*
     * Atomic balance check + decrement.
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

      throw new InsufficientVideoCreditsError(cost, current?.balance ?? 0);
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
        userId,
        userCreditId: account.id,
        amount: -cost,
        type: CreditTransactionType.GENERATION,
        description: "AI VIDEO generation",
        generationId,
      },
    });

    return {
      cost,
      balance: afterCharge.balance,
      chargedAt,
    };
  });
}

export async function refundVideoCreditsAtomic({
  userId,
  generationId,
}: {
  userId: string;
  generationId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const generation = await tx.videoGeneration.findFirst({
      where: {
        id: generationId,
        userId,
      },
      select: {
        id: true,
        creditsUsed: true,
        creditChargedAt: true,
        creditRefundedAt: true,
      },
    });

    if (!generation) {
      throw new Error("Video generation not found.");
    }

    /*
     * Already refunded.
     */
    if (generation.creditRefundedAt) {
      const account = await tx.userCredit.findUnique({
        where: {
          userId,
        },
        select: {
          balance: true,
        },
      });

      return {
        refunded: false,
        amount: 0,
        balance: account?.balance ?? 0,
      };
    }

    /*
     * Nothing was charged.
     */
    if (!generation.creditChargedAt || generation.creditsUsed <= 0) {
      const account = await tx.userCredit.findUnique({
        where: {
          userId,
        },
        select: {
          balance: true,
        },
      });

      return {
        refunded: false,
        amount: 0,
        balance: account?.balance ?? 0,
      };
    }

    const account = await tx.userCredit.findUnique({
      where: {
        userId,
      },
      select: {
        id: true,
        balance: true,
      },
    });

    if (!account) {
      throw new Error("AI credit account not found.");
    }

    /*
     * Check for an existing refund ledger entry.
     */
    const existingRefund = await tx.creditTransaction.findFirst({
      where: {
        userId,
        generationId,
        type: CreditTransactionType.REFUND,
      },
      select: {
        id: true,
      },
    });

    if (existingRefund) {
      await tx.videoGeneration.update({
        where: {
          id: generationId,
        },
        data: {
          creditRefundedAt: new Date(),
          status: "FAILED",
        },
      });

      return {
        refunded: false,
        amount: 0,
        balance: account.balance,
      };
    }

    /*
     * Restore the exact historical amount charged.
     */
    const restored = await tx.userCredit.update({
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

    await tx.creditTransaction.create({
      data: {
        userId,
        userCreditId: account.id,
        amount: generation.creditsUsed,
        type: CreditTransactionType.REFUND,
        description: "Refund for failed AI VIDEO generation",
        generationId,
      },
    });

    await tx.videoGeneration.update({
      where: {
        id: generationId,
      },
      data: {
        creditRefundedAt: new Date(),
        status: "FAILED",
      },
    });

    return {
      refunded: true,
      amount: generation.creditsUsed,
      balance: restored.balance,
    };
  });
}
