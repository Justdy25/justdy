"use server";

import "server-only";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

import {
  WorksheetDocumentSchema,
  type WorksheetDocument,
} from "@/lib/ai/worksheet/schema";

import {
  DEFAULT_WORKSHEET_DESIGN,
  type WorksheetDesign,
} from "@/lib/ai/worksheet/worksheet-design";

export type SaveWorksheetResult =
  | {
      success: true;
      projectId: string;
      generationId: string;
      savedAt: string;
    }
  | {
      success: false;
      error: string;
    };

/* =========================================================
   DESIGN VALIDATION
========================================================= */

function isValidHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9A-Fa-f]{6}$/.test(value);
}

function isValidWorksheetDesign(value: unknown): value is WorksheetDesign {
  if (!value || typeof value !== "object") {
    return false;
  }

  const design = value as Record<string, unknown>;

  return (
    (design.template === "classic" ||
      design.template === "modern" ||
      design.template === "playful" ||
      design.template === "assessment") &&
    (design.density === "compact" ||
      design.density === "comfortable" ||
      design.density === "spacious") &&
    (design.titleStyle === "boxed" ||
      design.titleStyle === "underline" ||
      design.titleStyle === "plain") &&
    isValidHexColor(design.accentColor) &&
    isValidHexColor(design.borderColor) &&
    (design.headerFields === "all" ||
      design.headerFields === "name-date" ||
      design.headerFields === "name-date-score") &&
    (design.answerSpace === "small" ||
      design.answerSpace === "medium" ||
      design.answerSpace === "large") &&
    (design.questionLayout === "single" ||
      design.questionLayout === "two-column") &&
    (design.decorations === "none" ||
      design.decorations === "minimal" ||
      design.decorations === "playful")
  );
}

/* =========================================================
   PUBLIC ACTION
========================================================= */

export async function SaveWorksheet({
  worksheet,
  projectId,
  generationId,
  design,
}: {
  worksheet: WorksheetDocument;
  projectId?: string | null;
  generationId?: string | null;
  design?: WorksheetDesign;
}): Promise<SaveWorksheetResult> {
  try {
    /* =======================================================
       AUTHENTICATION
    ======================================================= */

    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return {
        success: false,
        error: "You must be signed in to save a worksheet.",
      };
    }

    /* =======================================================
       VALIDATE WORKSHEET
    ======================================================= */

    const parsed = WorksheetDocumentSchema.safeParse(worksheet);

    if (!parsed.success) {
      return {
        success: false,
        error: "The worksheet contains invalid data and cannot be saved.",
      };
    }

    const validWorksheet = parsed.data;

    /* =======================================================
       RESOLVE DESIGN
    ======================================================= */

    const validDesign: WorksheetDesign =
      design && isValidWorksheetDesign(design)
        ? design
        : DEFAULT_WORKSHEET_DESIGN;

    /*
     * Store the design inside AIGeneration.inputData.
     *
     * outputData remains the WorksheetDocument so existing
     * worksheet loading continues to work.
     */

    const inputData = {
      gradeLevel: validWorksheet.gradeLevel,
      subject: validWorksheet.subject,
      topic: validWorksheet.topic,
      questionCount: validWorksheet.questions.length,
      design: validDesign,
    };

    /* =========================================================
       UPDATE EXISTING WORKSHEET
    ========================================================= */

    if (projectId && generationId) {
      const existingGeneration = await prisma.aIGeneration.findFirst({
        where: {
          id: generationId,
          projectId,
          userId: session.user.id,
          type: "WORKSHEET",
        },
      });

      if (!existingGeneration) {
        return {
          success: false,
          error:
            "The saved worksheet could not be found. Please save it as a new worksheet.",
        };
      }

      const generation = await prisma.aIGeneration.update({
        where: {
          id: generationId,
        },

        data: {
          status: "COMPLETED",

          /*
           * Keep the worksheet itself in outputData.
           */
          outputData: validWorksheet,

          /*
           * Store worksheet metadata + design separately.
           */
          inputData,

          completedAt: new Date(),
        },
      });

      /* =======================================================
         KEEP PROJECT METADATA SYNCHRONIZED
      ======================================================= */

      await prisma.aIProject.update({
        where: {
          id: projectId,
        },

        data: {
          name: validWorksheet.title,

          description:
            `${validWorksheet.subject} • ` +
            `${validWorksheet.gradeLevel} • ` +
            `${validWorksheet.topic}`,
        },
      });

      return {
        success: true,
        projectId,
        generationId: generation.id,
        savedAt: generation.updatedAt.toISOString(),
      };
    }

    /* =========================================================
       CREATE NEW WORKSHEET
    ========================================================= */

    const project = await prisma.aIProject.create({
      data: {
        userId: session.user.id,

        name: validWorksheet.title,

        description:
          `${validWorksheet.subject} • ` +
          `${validWorksheet.gradeLevel} • ` +
          `${validWorksheet.topic}`,

        type: "WORKSHEET",

        status: "ACTIVE",
      },
    });

    /* =========================================================
       CREATE GENERATION
    ========================================================= */

    const generation = await prisma.aIGeneration.create({
      data: {
        userId: session.user.id,

        projectId: project.id,

        type: "WORKSHEET",

        status: "COMPLETED",

        prompt: `Create worksheet: ${validWorksheet.title}`,

        /*
         * Metadata + saved design.
         */
        inputData,

        /*
         * Actual worksheet document.
         */
        outputData: validWorksheet,

        provider: "openai",

        model: "gpt-5",

        startedAt: new Date(),

        completedAt: new Date(),
      },
    });

    return {
      success: true,

      projectId: project.id,

      generationId: generation.id,

      savedAt: generation.updatedAt.toISOString(),
    };
  } catch (error) {
    console.error("SaveWorksheet error:", error);

    return {
      success: false,

      error:
        error instanceof Error ? error.message : "Unable to save worksheet.",
    };
  }
}
