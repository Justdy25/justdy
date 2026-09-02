import "server-only";

import type { Prisma } from "@/lib/generated/prisma/client";
import prisma from "@/lib/prisma";
import { CreditTransactionType } from "@/lib/generated/prisma/client";

export type CreditTransactionDb = Prisma.TransactionClient;

export async function getCreditBalance(userId: string): Promise<number> {
  const account = await prisma.userCredit.findUnique({
    where: { userId },
    select: { balance: true },
  });

  return account?.balance ?? 0;
}

export async function ensureCreditAccount(userId: string) {
  return prisma.userCredit.upsert({
    where: { userId },
    update: {},
    create: { userId, balance: 0 },
  });
}

/**
 * Deduct AI credits and write the ledger entry inside an existing transaction.
 * Keep this function transaction-scoped so generation creation + billing remain atomic.
 */
export async function deductCreditsInTransaction(
  tx: CreditTransactionDb,
  {
    userId,
    amount,
    description,
    generationId,
    aiGenerationId,
  }: {
    userId: string;
    amount: number;
    description: string;
    generationId?: string;
    aiGenerationId?: string;
  },
) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("Credit amount must be a positive integer.");
  }

  const creditAccount = await tx.userCredit.findUnique({
    where: { userId },
    select: { id: true, balance: true },
  });

  if (!creditAccount) {
    throw new Error("You do not have a credit account.");
  }

  if (creditAccount.balance < amount) {
    throw new Error(
      `You need ${amount} credits. You currently have ${creditAccount.balance}.`,
    );
  }

  // Use a conditional update so concurrent generations cannot overspend
  // the same credit balance.
  const debit = await tx.userCredit.updateMany({
    where: {
      id: creditAccount.id,
      balance: { gte: amount },
    },
    data: { balance: { decrement: amount } },
  });

  if (debit.count !== 1) {
    throw new Error("Insufficient credits.");
  }

  const updatedAccount = await tx.userCredit.findUniqueOrThrow({
    where: { id: creditAccount.id },
  });

  await tx.creditTransaction.create({
    data: {
      userId,
      userCreditId: creditAccount.id,
      amount: -amount,
      type: CreditTransactionType.GENERATION,
      description,
      generationId,
      aiGenerationId,
    },
  });

  return updatedAccount;
}

export async function addCreditsInTransaction(
  tx: CreditTransactionDb,
  {
    userId,
    amount,
    type,
    description,
    generationId,
    aiGenerationId,
  }: {
    userId: string;
    amount: number;
    type: CreditTransactionType;
    description?: string;
    generationId?: string;
    aiGenerationId?: string;
  },
) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("Credit amount must be a positive integer.");
  }

  const creditAccount = await tx.userCredit.upsert({
    where: { userId },
    update: { balance: { increment: amount } },
    create: { userId, balance: amount },
  });

  await tx.creditTransaction.create({
    data: {
      userId,
      userCreditId: creditAccount.id,
      amount,
      type,
      description,
      generationId,
      aiGenerationId,
    },
  });

  return creditAccount;
}
