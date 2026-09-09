import prisma from "@/lib/prisma";

import {
  AIGenerationStatus,
  AIGenerationType,
} from "@/lib/generated/prisma/enums";

import type { Prisma } from "@/lib/generated/prisma/client";
import { logAIError, logAIInfo, logAIWarn } from "@/lib/ai/logger";

import { createAITimer } from "@/lib/ai/timing";
import { assertAIGenerationTransition } from "@/lib/ai/generation-state";
import {
  startAIGenerationAtomic,
  refundAICreditsAtomic,
  AI_CREDIT_COSTS,
  type AICreditOperation,
} from "@/lib/ai/credits.atomic";

import {
  generateAIResponse,
  streamAIResponse,
  type AIOperation,
} from "@/lib/ai/orchestrator";

import type { AIChatMessage } from "@/lib/ai/types";

import { InputJsonValue } from "@prisma/client/runtime/client";

/* ============================================================
   TYPES
============================================================ */

export type GenerateAIRequest = {
  userId: string;

  operation: AIOperation;

  prompt: string;

  messages?: AIChatMessage[];

  projectId?: string | null;

  inputData?: InputJsonValue;

  /** Client-generated idempotency key for this generation request. */
  requestId?: string | null;
};

export type GenerateAIResult = {
  generationId: string;

  operation: AIOperation;

  text: string;

  provider: string;

  model: string;

  creditsUsed: number;

  creditsRemaining: number;

  projectId: string | null;
};

/* ============================================================
   GENERATION RECOVERY / RECONCILIATION
============================================================ */

export type ReconcileStaleAIGenerationsOptions = {
  /** Optional user scope. When omitted, reconciliation is global. */
  userId?: string;

  /** Generations older than this threshold are eligible for recovery. */
  staleAfterMs?: number;

  /** Maximum number of stale generations inspected per run. */
  limit?: number;
};

export type ReconciledAIGeneration = {
  generationId: string;
  userId: string;
  status: AIGenerationStatus;
  previousStatus: AIGenerationStatus;
  refunded: boolean;
};

export type ReconcileStaleAIGenerationsResult = {
  inspected: number;
  reconciled: number;
  refunded: number;
  refundPending: number;
  skipped: number;
  generations: ReconciledAIGeneration[];
};

const DEFAULT_STALE_GENERATION_MS = 15 * 60 * 1000;
const DEFAULT_RECONCILIATION_LIMIT = 100;
const RECONCILIATION_ERROR_MESSAGE =
  "AI generation was automatically reconciled because it remained processing beyond the allowed execution window.";
const RECONCILIATION_PENDING_ERROR_MESSAGE =
  "AI generation was automatically reconciled because it remained pending beyond the allowed execution window.";

/**
 * Repairs generations orphaned by a crashed/disconnected worker.
 *
 * Recovery is deliberately conservative:
 * - only stale PROCESSING/PENDING records are claimed;
 * - the database conditional update is the race-safe settlement guard;
 * - PROCESSING records are refunded after being atomically moved to FAILED;
 * - failed refunds remain retryable on the next reconciliation run;
 * - PENDING records are never refunded unless billing metadata proves a
 *   charge actually exists.
 */
export async function reconcileStaleAIGenerations({
  userId,
  staleAfterMs = DEFAULT_STALE_GENERATION_MS,
  limit = DEFAULT_RECONCILIATION_LIMIT,
}: ReconcileStaleAIGenerationsOptions = {}): Promise<ReconcileStaleAIGenerationsResult> {
  const normalizedStaleAfterMs =
    Number.isFinite(staleAfterMs) && staleAfterMs > 0
      ? Math.floor(staleAfterMs)
      : DEFAULT_STALE_GENERATION_MS;

  const normalizedLimit =
    Number.isFinite(limit) && limit > 0
      ? Math.min(Math.floor(limit), DEFAULT_RECONCILIATION_LIMIT)
      : DEFAULT_RECONCILIATION_LIMIT;

  const cutoff = new Date(Date.now() - normalizedStaleAfterMs);

  const staleGenerations = await prisma.aIGeneration.findMany({
    where: {
      ...(userId ? { userId } : {}),
      OR: [
        {
          status: AIGenerationStatus.PROCESSING,
          startedAt: { lt: cutoff },
        },
        {
          status: AIGenerationStatus.PENDING,
          createdAt: { lt: cutoff },
        },
        {
          status: AIGenerationStatus.FAILED,
          errorMessage: RECONCILIATION_ERROR_MESSAGE,
          creditRefundedAt: null,
        },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: normalizedLimit,
    select: {
      id: true,
      userId: true,
      status: true,
      type: true,
      creditChargedAt: true,
      creditRefundedAt: true,
      creditsUsed: true,
    },
  });

  const generations: ReconciledAIGeneration[] = [];
  let reconciled = 0;
  let refunded = 0;
  let refundPending = 0;
  let skipped = 0;

  for (const generation of staleGenerations) {
    let wasReconciled = false;

    if (
      generation.status === AIGenerationStatus.PROCESSING ||
      generation.status === AIGenerationStatus.PENDING
    ) {
      const previousStatus = generation.status;
      assertAIGenerationTransition(previousStatus, AIGenerationStatus.FAILED);

      const errorMessage =
        generation.status === AIGenerationStatus.PROCESSING
          ? RECONCILIATION_ERROR_MESSAGE
          : RECONCILIATION_PENDING_ERROR_MESSAGE;

      const result = await prisma.aIGeneration.updateMany({
        where: {
          id: generation.id,
          userId: generation.userId,
          status: generation.status,
          ...(generation.status === AIGenerationStatus.PROCESSING
            ? { startedAt: { lt: cutoff } }
            : { createdAt: { lt: cutoff } }),
        },
        data: {
          status: AIGenerationStatus.FAILED,
          errorMessage,
          completedAt: new Date(),
        },
      });

      if (result.count !== 1) {
        skipped += 1;
        logAIInfo("generation.reconciliation_skipped", {
          generationId: generation.id,
          userId: generation.userId,
          operation: generation.type,
          status: "already_settled",
        });
        continue;
      }

      wasReconciled = true;
      reconciled += 1;
    }

    if (!wasReconciled && generation.status !== AIGenerationStatus.FAILED) {
      skipped += 1;
      continue;
    }

    const charged =
      generation.creditChargedAt !== null || generation.creditsUsed > 0;

    let didRefund = false;

    if (charged && generation.creditRefundedAt === null) {
      try {
        await refundAICreditsAtomic({
          userId: generation.userId,
          generationId: generation.id,
        });
        didRefund = true;
        refunded += 1;
      } catch (error) {
        refundPending += 1;
        logAIError("credits.reconciliation_refund_failed", {
          generationId: generation.id,
          userId: generation.userId,
          operation: generation.type,
          errorCode:
            error instanceof Error && "code" in error
              ? String((error as { code?: unknown }).code ?? "REFUND_ERROR")
              : "REFUND_ERROR",
        });
      }
    }

    generations.push({
      generationId: generation.id,
      userId: generation.userId,
      status: AIGenerationStatus.FAILED,
      previousStatus: generation.status,
      refunded: didRefund,
    });

    logAIWarn("generation.reconciled", {
      generationId: generation.id,
      userId: generation.userId,
      operation: generation.type,
      status: "stale_generation_reconciled",
      metadata: {
        previousStatus: generation.status,
        refunded: didRefund,
        refundPending: charged && !didRefund,
        staleAfterMs: normalizedStaleAfterMs,
        cutoff: cutoff.toISOString(),
      },
    });
  }

  return {
    inspected: staleGenerations.length,
    reconciled,
    refunded,
    refundPending,
    skipped,
    generations,
  };
}

function getGenerationType(operation: AIOperation): AIGenerationType {
  switch (operation) {
    case "CHAT":
    case "RESEARCH":
    case "DOCUMENT":
      return AIGenerationType.TEXT;

    case "IMAGE":
      return AIGenerationType.IMAGE;

    case "VIDEO":
      return AIGenerationType.VIDEO;

    case "AUDIO":
      return AIGenerationType.AUDIO;

    case "WORKSHEET":
      return AIGenerationType.WORKSHEET;

    case "QUIZ":
      return AIGenerationType.QUIZ;

    case "LESSON_PLAN":
      return AIGenerationType.LESSON_PLAN;

    case "PRESENTATION":
      return AIGenerationType.PRESENTATION;

    default:
      throw new Error(
        `Unsupported AI generation type for operation "${operation}".`,
      );
  }
}

async function validateProjectOwnership({
  userId,
  projectId,
}: {
  userId: string;
  projectId?: string | null;
}) {
  if (!projectId) {
    return null;
  }

  const project = await prisma.aIProject.findFirst({
    where: {
      id: projectId,
      userId,
      status: "ACTIVE",
    },

    select: {
      id: true,
    },
  });

  if (!project) {
    throw new Error("AI project not found.");
  }

  return project.id;
}

export async function generateAI({
  userId,
  operation,
  prompt,
  messages,
  projectId,
  inputData,
  requestId,
}: GenerateAIRequest): Promise<GenerateAIResult> {
  /* ----------------------------------------------------------
     BASIC VALIDATION
  ---------------------------------------------------------- */
  const timer = createAITimer();

  if (!userId.trim()) {
    throw new Error("User ID is required.");
  }

  if (!prompt.trim()) {
    throw new Error("AI prompt is required.");
  }

  /* ----------------------------------------------------------
     CREDIT OPERATION
  ---------------------------------------------------------- */

  const creditOperation = operation as AICreditOperation;

  const creditCost = AI_CREDIT_COSTS[creditOperation];

  if (!creditCost) {
    throw new Error(
      `No credit cost configured for AI operation "${operation}".`,
    );
  }

  /* ----------------------------------------------------------
     PROJECT
  ---------------------------------------------------------- */

  const validatedProjectId = await validateProjectOwnership({
    userId,
    projectId,
  });

  /* ----------------------------------------------------------
     GENERATION TYPE
  ---------------------------------------------------------- */

  const generationType = getGenerationType(operation);
  const normalizedRequestId = requestId?.trim() || null;

  /* ----------------------------------------------------------
     CREATE GENERATION RECORD
  ---------------------------------------------------------- */

  const generation = await prisma.aIGeneration.create({
    data: {
      userId,

      projectId: validatedProjectId,

      type: generationType,

      operation,
      creditOperation,

      status: AIGenerationStatus.PENDING,

      prompt: prompt.trim(),

      ...(normalizedRequestId ? { requestId: normalizedRequestId } : {}),

      ...(inputData !== undefined ? { inputData } : {}),

      creditsUsed: 0,
    },

    select: {
      id: true,
      projectId: true,
    },
  });

  let creditsConsumed = false;

  try {
    /* --------------------------------------------------------
       CONSUME CREDITS
    -------------------------------------------------------- */

    const creditResult = await startAIGenerationAtomic({
      userId,
      operation: creditOperation,
      generationId: generation.id,
    });

    creditsConsumed = true;

    logAIInfo("generation.started", {
      generationId: generation.id,
      userId,
      operation,
    });

    /* --------------------------------------------------------
       BUILD CHAT MESSAGES
    -------------------------------------------------------- */

    const aiMessages: AIChatMessage[] = messages?.length
      ? messages
      : [
          {
            role: "user",
            content: prompt.trim(),
          },
        ];

    /* --------------------------------------------------------
       RUN ORCHESTRATOR
    -------------------------------------------------------- */
    const response = await generateAIResponse({
      userId,
      requestId: normalizedRequestId ?? generation.id,
      operation,
      messages: aiMessages,
    });

    /* --------------------------------------------------------
       SAVE SUCCESSFUL GENERATION
    -------------------------------------------------------- */

    const completedAt = new Date();

    assertAIGenerationTransition(
      AIGenerationStatus.PROCESSING,
      AIGenerationStatus.COMPLETED,
    );

    const completed = await prisma.aIGeneration.updateMany({
      where: {
        id: generation.id,
        userId,
        status: AIGenerationStatus.PROCESSING,
      },
      data: {
        status: AIGenerationStatus.COMPLETED,
        provider: response.provider,
        model: response.model,
        outputData: {
          text: response.text,
        },
        completedAt,
      },
    });

    if (completed.count !== 1) {
      throw new Error("AI generation was already settled.");
    }

    logAIInfo("generation.completed", {
      generationId: generation.id,
      userId,
      operation,
      provider: response.provider,
      model: response.model,
      durationMs: timer.elapsedMs(),
      creditsUsed: creditResult.cost,
      outputLength: response.text.length,
    });

    /* --------------------------------------------------------
       RETURN RESULT
    -------------------------------------------------------- */

    return {
      generationId: generation.id,

      operation,

      text: response.text,

      provider: response.provider,

      model: response.model,

      creditsUsed: creditResult.cost,

      creditsRemaining: creditResult.balance,

      projectId: generation.projectId,
    };
  } catch (error) {
    /* --------------------------------------------------------
       NORMALIZE ERROR
    -------------------------------------------------------- */

    const errorMessage =
      error instanceof Error ? error.message : "AI generation failed.";

    logAIError("generation.failed", {
      generationId: generation.id,
      userId,
      operation,
      durationMs: timer.elapsedMs(),
      errorCode:
        error instanceof Error && "code" in error
          ? String((error as { code?: unknown }).code ?? "GENERATION_ERROR")
          : "GENERATION_ERROR",
    });

    /* --------------------------------------------------------
       MARK GENERATION FAILED
    -------------------------------------------------------- */

    let generationMarkedFailed = false;

    const failed = await prisma.aIGeneration.updateMany({
      where: {
        id: generation.id,
        userId,
        status: {
          in: [AIGenerationStatus.PENDING, AIGenerationStatus.PROCESSING],
        },
      },
      data: {
        status: AIGenerationStatus.FAILED,
        errorMessage,
        completedAt: new Date(),
      },
    });

    generationMarkedFailed = failed.count === 1;

    assertAIGenerationTransition(
      AIGenerationStatus.PROCESSING,
      AIGenerationStatus.FAILED,
    );

    /* --------------------------------------------------------
       REFUND CREDITS
    -------------------------------------------------------- */

    if (creditsConsumed && generationMarkedFailed) {
      try {
        await refundAICreditsAtomic({
          userId,
          generationId: generation.id,
        });
      } catch {
        logAIError("credits.refund_failed", {
          generationId: generation.id,
          userId,
          operation,
          durationMs: timer.elapsedMs(),
        });
      }
    }

    throw error;
  }
}

export type StreamFinalizePersistence<T> = (
  tx: Prisma.TransactionClient,
) => Promise<T>;

export type StreamAIResult = {
  generationId: string;

  operation: AIOperation;

  stream: AsyncIterable<string>;

  provider: string;

  model: string;

  creditsUsed: number;

  creditsRemaining: number;

  projectId: string | null;

  finalize: <T>(
    text: string,
    persist: StreamFinalizePersistence<T>,
  ) => Promise<T>;

  fail: (error: unknown) => Promise<void>;
};

export async function streamAI({
  userId,
  operation,
  prompt,
  messages,
  projectId,
  inputData,
  requestId,
  generationId: existingGenerationId,
  signal,
}: GenerateAIRequest & {
  generationId?: string;
  signal?: AbortSignal;
}): Promise<StreamAIResult> {
  /* ----------------------------------------------------------
     BASIC VALIDATION
  ---------------------------------------------------------- */
  const timer = createAITimer();

  if (!userId.trim()) {
    throw new Error("User ID is required.");
  }

  if (!prompt.trim()) {
    throw new Error("AI prompt is required.");
  }

  /* ----------------------------------------------------------
     CREDIT OPERATION
  ---------------------------------------------------------- */

  const creditOperation = operation as AICreditOperation;

  const creditCost = AI_CREDIT_COSTS[creditOperation];

  if (!creditCost) {
    throw new Error(
      `No credit cost configured for AI operation "${operation}".`,
    );
  }

  /* ----------------------------------------------------------
     PROJECT
  ---------------------------------------------------------- */

  const validatedProjectId = await validateProjectOwnership({
    userId,
    projectId,
  });

  /* ----------------------------------------------------------
     GENERATION TYPE
  ---------------------------------------------------------- */

  const generationType = getGenerationType(operation);

  /* ----------------------------------------------------------
     GENERATION CLAIM / LOAD
  ---------------------------------------------------------- */

  const normalizedRequestId = requestId?.trim() || null;

  /*
   * Chat routes can create the generation record inside the same short
   * transaction that creates/updates the conversation and user message.
   * In that case we receive generationId and must reuse that record rather
   * than creating another one.
   *
   * Other callers may still use streamAI() directly; those calls retain the
   * original create-if-needed behavior and the database UNIQUE(requestId)
   * constraint remains the race-safe idempotency backstop.
   */
  const generation = existingGenerationId
    ? await prisma.aIGeneration.findFirst({
        where: {
          id: existingGenerationId,
          userId,
        },
        select: {
          id: true,
          userId: true,
          projectId: true,
          status: true,
          requestId: true,
        },
      })
    : normalizedRequestId
      ? await prisma.aIGeneration.findUnique({
          where: { requestId: normalizedRequestId },
          select: {
            id: true,
            userId: true,
            projectId: true,
            status: true,
            requestId: true,
          },
        })
      : null;

  if (existingGenerationId && !generation) {
    throw new Error("AI generation not found.");
  }

  if (generation && generation.userId !== userId) {
    throw new Error("AI generation not found.");
  }

  if (
    generation &&
    normalizedRequestId &&
    generation.requestId &&
    generation.requestId !== normalizedRequestId
  ) {
    throw new Error("AI generation request identity mismatch.");
  }

  if (generation && generation.status !== AIGenerationStatus.PENDING) {
    throw new Error(
      `AI generation is already ${generation.status.toLowerCase()}.`,
    );
  }

  const generationRecord =
    generation ??
    (await prisma.aIGeneration.create({
      data: {
        userId,
        projectId: validatedProjectId,
        type: generationType,
        status: AIGenerationStatus.PENDING,
        prompt: prompt.trim(),
        ...(normalizedRequestId ? { requestId: normalizedRequestId } : {}),
        ...(inputData !== undefined ? { inputData } : {}),
        creditsUsed: 0,
      },
      select: {
        id: true,
        userId: true,
        projectId: true,
        status: true,
        requestId: true,
      },
    }));

  const activeGeneration = generationRecord;

  let creditsConsumed = false;

  /*
   * Once a generation is settled, it cannot be failed or
   * finalized a second time.
   */
  let settled = false;

  /* ----------------------------------------------------------
     FAIL GENERATION
  ---------------------------------------------------------- */

  const fail = async (error: unknown) => {
    if (settled) {
      return;
    }

    const errorMessage =
      error instanceof Error ? error.message : "AI generation failed.";

    logAIError("generation.failed", {
      generationId: activeGeneration.id,
      userId,
      operation,
      durationMs: timer.elapsedMs(),
      errorCode:
        error instanceof Error && "code" in error
          ? String((error as { code?: unknown }).code ?? "GENERATION_ERROR")
          : "GENERATION_ERROR",
    });

    let generationMarkedFailed = false;

    assertAIGenerationTransition(
      AIGenerationStatus.PROCESSING,
      AIGenerationStatus.FAILED,
    );

    try {
      const failed = await prisma.aIGeneration.updateMany({
        where: {
          id: activeGeneration.id,
          userId,
          status: {
            in: [AIGenerationStatus.PENDING, AIGenerationStatus.PROCESSING],
          },
        },
        data: {
          status: AIGenerationStatus.FAILED,
          errorMessage,
          completedAt: new Date(),
        },
      });
      generationMarkedFailed = failed.count === 1;
    } catch {
      logAIError("generation.persistence_failed", {
        generationId: activeGeneration.id,
        userId,
        operation,
        durationMs: timer.elapsedMs(),
      });
    }

    if (creditsConsumed && generationMarkedFailed) {
      try {
        await refundAICreditsAtomic({
          userId,
          generationId: activeGeneration.id,
        });
      } catch {
        logAIError("credits.refund_failed", {
          generationId: activeGeneration.id,
          userId,
          operation,
          durationMs: timer.elapsedMs(),
        });
        return;
      }
    }

    if (generationMarkedFailed) {
      settled = true;
    }
  };

  try {
    /* --------------------------------------------------------
       CONSUME CREDITS
    -------------------------------------------------------- */

    const creditResult = await startAIGenerationAtomic({
      userId,
      operation: creditOperation,
      generationId: activeGeneration.id,
    });

    creditsConsumed = true;

    /* --------------------------------------------------------
       ABORT CHECK
    -------------------------------------------------------- */

    if (signal?.aborted) {
      throw new Error("Generation cancelled.");
    }

    logAIInfo("generation.started", {
      generationId: activeGeneration.id,
      userId,
      operation,
    });

    /* --------------------------------------------------------
       BUILD CHAT MESSAGES
    -------------------------------------------------------- */

    const aiMessages: AIChatMessage[] = messages?.length
      ? messages
      : [
          {
            role: "user",
            content: prompt.trim(),
          },
        ];

    /* --------------------------------------------------------
       START ORCHESTRATOR STREAM
    -------------------------------------------------------- */
    const response = await streamAIResponse({
      userId,
      requestId: normalizedRequestId ?? activeGeneration.id,
      operation,
      messages: aiMessages,
      signal,
    });

    /* --------------------------------------------------------
       WRAPPED STREAM
    -------------------------------------------------------- */

    async function* guardedStream(): AsyncIterable<string> {
      try {
        for await (const chunk of response.stream) {
          if (signal?.aborted) {
            throw new Error("Generation cancelled.");
          }

          if (!chunk) {
            continue;
          }

          yield chunk;
        }
      } catch (error) {
        // User cancellation is handled by the chat route so the
        // text accumulated before cancellation can still be finalized
        // and persisted. Do not mark the generation failed here.
        if (!signal?.aborted) {
          await fail(error);
        }

        throw error;
      }
    }

    /* --------------------------------------------------------
       FINALIZE GENERATION
    -------------------------------------------------------- */

    const finalize = async <T>(
      text: string,
      persist: StreamFinalizePersistence<T>,
    ): Promise<T> => {
      if (settled) {
        throw new Error("Generation has already been settled.");
      }

      if (!text.trim()) {
        const error = new Error("AI returned an empty response.");

        await fail(error);

        throw error;
      }

      /*
       * Once finalization starts, the generation is considered
       * reserved for this finalization attempt.
       *
       * If the transaction fails, settled is reset below so
       * fail() can mark the generation FAILED and refund credits.
       */
      settled = true;

      try {
        const result = await prisma.$transaction(async (tx) => {
          /*
           * Persist any related records first.
           *
           * For Chat this will create the assistant message and
           * update the conversation.
           */

          const persistedResult = await persist(tx);

          /*
           * Mark the generation COMPLETED inside the SAME
           * transaction.
           *
           * This guarantees that the generation cannot be
           * completed without its related output being saved.
           */

          assertAIGenerationTransition(
            AIGenerationStatus.PROCESSING,
            AIGenerationStatus.COMPLETED,
          );

          const completed = await tx.aIGeneration.updateMany({
            where: {
              id: activeGeneration.id,
              userId,
              status: AIGenerationStatus.PROCESSING,
            },
            data: {
              status: AIGenerationStatus.COMPLETED,
              provider: response.provider,
              model: response.model,
              outputData: { text },
              completedAt: new Date(),
            },
          });

          if (completed.count !== 1) {
            throw new Error("AI generation was already settled.");
          }

          return persistedResult;
        });

        logAIInfo("generation.completed", {
          generationId: activeGeneration.id,
          userId,
          operation,
          provider: response.provider,
          model: response.model,
          durationMs: timer.elapsedMs(),
          creditsUsed: creditResult.cost,
          outputLength: text.length,
        });

        return result;
      } catch (error) {
        /*
         * The transaction rolled back.
         *
         * Reset settled so fail() can safely:
         *
         * 1. mark the generation FAILED
         * 2. refund the consumed credit
         */

        settled = false;

        await fail(error);

        throw error;
      }
    };

    /* --------------------------------------------------------
       RETURN STREAM
    -------------------------------------------------------- */

    return {
      generationId: activeGeneration.id,

      operation,

      stream: guardedStream(),

      provider: response.provider,

      model: response.model,

      creditsUsed: creditResult.cost,

      creditsRemaining: creditResult.balance,

      projectId: activeGeneration.projectId,

      finalize,

      fail,
    };
  } catch (error) {
    /*
     * If this catch runs before streamAI() returns its StreamAIResult,
     * the chat route has not received the generation object and cannot
     * perform cancellation cleanup itself.
     *
     * This covers the immediate-Stop race where the provider request is
     * aborted before its stream is returned. There is no partial response
     * available to preserve, so the generation must be failed and the
     * consumed credit refunded.
     *
     * Once StreamAIResult has been returned, active-stream cancellation is
     * handled by the chat route so partial output can still be persisted.
     */
    await fail(error);

    throw error;
  }
}
