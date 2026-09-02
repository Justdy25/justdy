"use server";

import "server-only";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { CreditTransactionType } from "@/lib/generated/prisma/client";
import {
  addCreditsInTransaction,
  deductCreditsInTransaction,
  ensureCreditAccount,
  getCreditBalance,
} from "@/lib/ai/credits";

export async function GetUserCreditBalance(userId: string): Promise<number> {
  return getCreditBalance(userId);
}

export async function EnsureUserCreditAccount(userId: string) {
  return ensureCreditAccount(userId);
}

export async function AddUserCredits({
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
}) {
  return prisma.$transaction((tx) =>
    addCreditsInTransaction(tx, {
      userId,
      amount,
      type,
      description,
      generationId,
      aiGenerationId,
    }),
  );
}

export async function DeductUserCredits({
  userId,
  amount,
  description,
  generationId,
  aiGenerationId,
}: {
  userId: string;
  amount: number;
  description?: string;
  generationId?: string;
  aiGenerationId?: string;
}) {
  return prisma.$transaction((tx) =>
    deductCreditsInTransaction(tx, {
      userId,
      amount,
      description: description || `AI generation (${amount} credits)`,
      generationId,
      aiGenerationId,
    }),
  );
}

export async function RefundUserCredits({
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
}) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("Credit amount must be a positive integer.");
  }

  return prisma.$transaction((tx) =>
    addCreditsInTransaction(tx, {
      userId,
      amount,
      type: CreditTransactionType.REFUND,
      description: description || `AI generation refund (${amount} credits)`,
      generationId,
      aiGenerationId,
    }),
  );
}

export async function GetMyAIVideoCreditBalance(): Promise<
  | { success: true; balance: number }
  | { success: false; balance: 0; error: string }
> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return {
        success: false,
        balance: 0,
        error: "You must be signed in.",
      };
    }

    return {
      success: true,
      balance: await getCreditBalance(session.user.id),
    };
  } catch (error) {
    console.error("GetMyAIVideoCreditBalance error:", error);

    return {
      success: false,
      balance: 0,
      error: "Unable to load your credit balance.",
    };
  }
}
