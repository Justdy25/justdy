import "server-only";

import prisma from "@/lib/prisma";

import { buildProjectAwarePrompt } from "@/lib/ai/project-context";
import { getOwnedProjectContext } from "@/lib/ai/project-context-server";

import { AIVideoError } from "./errors";
import {
  InsufficientVideoCreditsError,
  consumeVideoCreditsAtomic,
  refundVideoCreditsAtomic,
} from "./credits";
import { createVideoJob } from "./provider";
import { getVideoCreditCost } from "./pricing";
import { validateVideoRequest } from "./validation";

import type { CreateVideoInput } from "./types";

export interface GenerateVideoOptions extends CreateVideoInput {
  userId: string;
  title?: string;
  style?: string;
  projectId?: string | null;
}

export async function generateVideo(options: GenerateVideoOptions) {
  /*
   * Validate only the actual video-generation parameters.
   *
   * projectId is intentionally not passed into validation because
   * project ownership/context is handled separately below.
   */
  const input = validateVideoRequest({
    prompt: options.prompt,
    duration: options.duration,
    aspectRatio: options.aspectRatio,
    model: options.model,
  });

  const model = input.model ?? "sora-2";

  /*
   * ------------------------------------------------------------
   * PROJECT CONTEXT
   * ------------------------------------------------------------
   *
   * Resolve the project only when a projectId was supplied.
   *
   * getOwnedProjectContext() verifies:
   * - the project belongs to the authenticated user
   * - the project is active
   *
   * The original user prompt remains unchanged for persistence.
   * Only generationPrompt is sent to the video provider.
   */
  const project = await getOwnedProjectContext(
    options.userId,
    options.projectId,
  );

  const generationPrompt = project
    ? buildProjectAwarePrompt({
        project,
        prompt: input.prompt,
      })
    : input.prompt;

  const projectContextIncluded = project !== null;

  const creditCost = getVideoCreditCost(input.duration, model);

  /*
   * ------------------------------------------------------------
   * REQUEST IDEMPOTENCY
   * ------------------------------------------------------------
   *
   * If the client sends a requestId and the same request was
   * already processed, return the existing generation instead
   * of creating another video or charging credits twice.
   */
  const requestId = options.requestId?.trim() || null;

  if (requestId) {
    const existing = await prisma.videoGeneration.findUnique({
      where: {
        requestId,
      },
    });

    if (existing) {
      if (existing.userId !== options.userId) {
        throw new AIVideoError(
          "The request ID is already in use.",
          "INVALID_REQUEST",
        );
      }

      return {
        success: true as const,
        generation: existing,
        creditsUsed: existing.creditsUsed,
      };
    }
  }

  /*
   * ------------------------------------------------------------
   * CREATE LOCAL GENERATION
   * ------------------------------------------------------------
   *
   * The generation is created before charging credits so the
   * credit transaction can atomically claim this generation.
   *
   * IMPORTANT:
   * Store the original user prompt, not the expanded project-aware
   * prompt. This keeps history, editing, regeneration, and
   * auditing clean.
   */
  const generation = await prisma.videoGeneration.create({
    data: {
      userId: options.userId,

      prompt: input.prompt,
      duration: input.duration,
      aspectRatio: input.aspectRatio,

      provider: "openai",
      model,

      providerTaskId: null,

      status: "PENDING",

      creditsUsed: 0,

      requestId,

      title: options.title?.trim() || null,
      style: options.style?.trim() || null,
    },
  });

  try {
    /*
     * ----------------------------------------------------------
     * CHARGE CREDITS
     * ----------------------------------------------------------
     *
     * This operation also claims the generation.
     */
    await consumeVideoCreditsAtomic({
      userId: options.userId,
      generationId: generation.id,
      duration: input.duration,
      model,
    });

    /*
     * ----------------------------------------------------------
     * START SORA GENERATION
     * ----------------------------------------------------------
     *
     * generationPrompt contains project context when the video
     * belongs to an active project owned by the current user.
     */
    const providerJob = await createVideoJob({
      prompt: generationPrompt,
      duration: input.duration,
      aspectRatio: input.aspectRatio,
      model,
    });

    /*
     * ----------------------------------------------------------
     * IMMEDIATE TERMINAL RESPONSE
     * ----------------------------------------------------------
     *
     * Normally Sora will return an asynchronous job, but
     * protect against an immediately failed/cancelled response.
     */
    if (providerJob.status === "FAILED" || providerJob.status === "CANCELLED") {
      const errorMessage =
        providerJob.status === "FAILED"
          ? "Video generation failed at the video provider."
          : "Video generation was cancelled by the video provider.";

      await prisma.videoGeneration.update({
        where: {
          id: generation.id,
        },
        data: {
          provider: providerJob.provider,
          model: providerJob.model,
          providerTaskId: providerJob.providerTaskId,
          status: providerJob.status,
          errorMessage,
        },
      });

      /*
       * Refund the exact amount that was charged.
       */
      await refundVideoCreditsAtomic({
        userId: options.userId,
        generationId: generation.id,
      });

      throw new AIVideoError(errorMessage, "PROVIDER_ERROR");
    }

    /*
     * ----------------------------------------------------------
     * NORMAL ASYNCHRONOUS PATH
     * ----------------------------------------------------------
     *
     * Sora accepted the generation request.
     */
    const updatedGeneration = await prisma.videoGeneration.update({
      where: {
        id: generation.id,
      },
      data: {
        provider: providerJob.provider,
        model: providerJob.model,
        providerTaskId: providerJob.providerTaskId,

        status: providerJob.status === "PENDING" ? "PENDING" : "PROCESSING",

        errorMessage: null,
      },
    });

    /*
     * The provider generation record intentionally continues to
     * store the original prompt. The project-aware prompt is
     * execution-only.
     *
     * projectContextIncluded is returned for observability but
     * does not alter the existing VideoGeneration schema.
     */
    return {
      success: true as const,
      generation: updatedGeneration,
      creditsUsed: creditCost,
      projectContextIncluded,
      projectId: project?.id ?? null,
    };
  } catch (error) {
    console.error("[AI Video] Generation failed:", error);

    /*
     * ----------------------------------------------------------
     * INSUFFICIENT CREDITS
     * ----------------------------------------------------------
     *
     * No refund is necessary because the credit transaction
     * never successfully charged the user.
     */
    if (error instanceof InsufficientVideoCreditsError) {
      throw error;
    }

    /*
     * ----------------------------------------------------------
     * REFUND AFTER FAILURE
     * ----------------------------------------------------------
     *
     * Any failure after the generation was charged should
     * refund the exact amount associated with this generation.
     *
     * refundVideoCreditsAtomic() is expected to be idempotent.
     */
    try {
      await refundVideoCreditsAtomic({
        userId: options.userId,
        generationId: generation.id,
      });
    } catch (refundError) {
      console.error(
        "[AI Video] CRITICAL: video credit refund failed:",
        refundError,
      );
    }

    /*
     * ----------------------------------------------------------
     * PRESERVE APPLICATION ERRORS
     * ----------------------------------------------------------
     */
    if (error instanceof AIVideoError) {
      throw error;
    }

    throw new AIVideoError(
      "Unable to start video generation.",
      "PROVIDER_ERROR",
    );
  }
}
