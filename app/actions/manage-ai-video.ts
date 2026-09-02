"use server";

import "server-only";

import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  GradeLevel,
  VideoGenerationStatus,
} from "@/lib/generated/prisma/enums";
import { getAIVideoCreditCost } from "@/lib/ai-video-pricing";
import { deductCreditsInTransaction } from "@/lib/ai/credits";

export type CreateVideoGenerationInput = {
  prompt: string;
  subjectId?: string;
  topicId?: string;
  gradeLevel?: GradeLevel;
  title?: string;
  style?: string;
  duration: number;
  aspectRatio: string;
};

type CreateVideoGenerationResult =
  | {
      success: true;
      generation: {
        id: string;
        status: VideoGenerationStatus;
        createdAt: Date;
      };
    }
  | {
      success: false;
      error: string;
    };

export async function CreateVideoGeneration(
  input: CreateVideoGenerationInput,
): Promise<CreateVideoGenerationResult> {
  try {
    /* ============================================================
       1. AUTHENTICATE USER
    ============================================================ */

    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return {
        success: false,
        error: "You must be signed in to generate a video.",
      };
    }

    const userId = session.user.id;

    /* ============================================================
       2. VALIDATE PROMPT
    ============================================================ */

    const prompt = input.prompt?.trim();

    if (!prompt) {
      return {
        success: false,
        error: "Please describe the video you want to create.",
      };
    }

    if (prompt.length > 1000) {
      return {
        success: false,
        error: "Your video description cannot exceed 1000 characters.",
      };
    }

    /* ============================================================
       3. VALIDATE DURATION
    ============================================================ */

    const allowedDurations = [5, 10, 15];

    if (!allowedDurations.includes(input.duration)) {
      return {
        success: false,
        error: "Invalid video duration.",
      };
    }

    /* ============================================================
       4. VALIDATE ASPECT RATIO
    ============================================================ */

    const allowedAspectRatios = ["16:9", "9:16", "1:1"];

    if (!allowedAspectRatios.includes(input.aspectRatio)) {
      return {
        success: false,
        error: "Invalid video format.",
      };
    }

    /* ============================================================
       5. VALIDATE SUBJECT
    ============================================================ */

    if (input.subjectId) {
      const subject = await prisma.subject.findUnique({
        where: {
          id: input.subjectId,
        },
        select: {
          id: true,
        },
      });

      if (!subject) {
        return {
          success: false,
          error: "The selected subject could not be found.",
        };
      }
    }

    /* ============================================================
       6. VALIDATE TOPIC
    ============================================================ */

    if (input.topicId) {
      const topic = await prisma.topic.findUnique({
        where: {
          id: input.topicId,
        },
        select: {
          id: true,
          subjectId: true,
        },
      });

      if (!topic) {
        return {
          success: false,
          error: "The selected topic could not be found.",
        };
      }

      if (input.subjectId && topic.subjectId !== input.subjectId) {
        return {
          success: false,
          error: "The selected topic does not belong to the selected subject.",
        };
      }
    }

    /* ============================================================
       7. CALCULATE CREDIT COST
    ============================================================ */

    const creditCost = getAIVideoCreditCost(input.duration);

    /* ============================================================
       8. DEDUCT CREDITS + CREATE GENERATION
          ATOMIC DATABASE TRANSACTION
    ============================================================ */

    const result = await prisma.$transaction(async (tx) => {
      /*
       * Create generation first inside the same transaction.
       * The shared AI credit engine below will deduct credits and
       * attach the ledger entry to this generation atomically.
       */
      const generation = await tx.videoGeneration.create({
        data: {
          userId,

          prompt,

          subjectId: input.subjectId || null,

          topicId: input.topicId || null,

          gradeLevel: input.gradeLevel || null,

          title: input.title?.trim() || null,

          style: input.style?.trim() || "Educational Animation",

          duration: input.duration,

          aspectRatio: input.aspectRatio,

          provider: "pending",

          model: null,

          providerTaskId: null,

          status: VideoGenerationStatus.PENDING,

          creditsUsed: creditCost,

          videoUrl: null,

          thumbnailUrl: null,

          errorMessage: null,
        },

        select: {
          id: true,
          status: true,
          createdAt: true,
        },
      });

      await deductCreditsInTransaction(tx, {
        userId,
        amount: creditCost,
        description: `AI video generation - ${input.duration} seconds`,
        generationId: generation.id,
      });

      return generation;
    });

    /* ============================================================
       9. RETURN GENERATION
    ============================================================ */

    return {
      success: true,
      generation: {
        id: result.id,
        status: result.status,
        createdAt: result.createdAt,
      },
    };
  } catch (error) {
    console.error("❌ CreateVideoGeneration error:", error);

    if (error instanceof Error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: false,
      error: "Unable to create the video generation request.",
    };
  }
}
