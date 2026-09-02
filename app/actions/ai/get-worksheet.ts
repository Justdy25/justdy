"use server";

import "server-only";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";

import { WorksheetDocumentSchema } from "@/lib/ai/worksheet/schema";

import type { WorksheetDocument } from "@/lib/ai/worksheet/schema";

import {
  DEFAULT_WORKSHEET_DESIGN,
  type WorksheetDesign,
} from "@/lib/ai/worksheet/worksheet-design";

import prisma from "@/lib/prisma";

/*
 * =========================================================
 * RESULT TYPES
 * =========================================================
 */

export type GetWorksheetResult =
  | {
      success: true;

      worksheet: WorksheetDocument;

      projectId: string;

      generationId: string;

      savedAt: string;

      design: WorksheetDesign;
    }
  | {
      success: false;

      error: string;
    };

/*
 * =========================================================
 * DESIGN VALIDATION
 * =========================================================
 */

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

/*
 * =========================================================
 * GET WORKSHEET
 * =========================================================
 */

export async function GetWorksheet(
  projectId: string,
): Promise<GetWorksheetResult> {
  try {
    console.log("[GetWorksheet] Requested project:", projectId);

    /*
     * =========================================================
     * AUTH
     * =========================================================
     */

    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      console.error("[GetWorksheet] No authenticated user.");

      return {
        success: false,
        error: "You must be signed in.",
      };
    }

    console.log("[GetWorksheet] Authenticated user:", session.user.id);

    /*
     * =========================================================
     * INPUT VALIDATION
     * =========================================================
     */

    if (!projectId?.trim()) {
      return {
        success: false,
        error: "Worksheet project ID is required.",
      };
    }

    /*
     * =========================================================
     * FIND PROJECT
     * =========================================================
     */

    const project = await prisma.aIProject.findFirst({
      where: {
        id: projectId,

        userId: session.user.id,

        type: "WORKSHEET",

        status: "ACTIVE",
      },

      include: {
        generations: {
          where: {
            type: "WORKSHEET",

            status: "COMPLETED",
          },

          orderBy: {
            updatedAt: "desc",
          },

          take: 1,
        },
      },
    });

    /*
     * =========================================================
     * PROJECT NOT FOUND
     * =========================================================
     */

    if (!project) {
      console.error("[GetWorksheet] Project not found:", {
        projectId,
        userId: session.user.id,
      });

      return {
        success: false,
        error: "Worksheet not found.",
      };
    }

    console.log("[GetWorksheet] Project found:", project.id);

    /*
     * =========================================================
     * FIND GENERATION
     * =========================================================
     */

    const generation = project.generations[0];

    if (!generation || !generation.outputData) {
      console.error("[GetWorksheet] No completed generation/output:", {
        projectId: project.id,
        generationId: generation?.id ?? null,
      });

      return {
        success: false,
        error: "This worksheet does not contain saved content.",
      };
    }

    /*
     * =========================================================
     * VALIDATE SAVED WORKSHEET
     * =========================================================
     */

    const parsed = WorksheetDocumentSchema.safeParse(generation.outputData);

    if (!parsed.success) {
      console.error(
        "[GetWorksheet] Saved worksheet validation failed:",
        parsed.error,
      );

      return {
        success: false,
        error: "The saved worksheet contains invalid data.",
      };
    }

    /*
     * =========================================================
     * RESTORE SAVED DESIGN
     * =========================================================
     *
     * The worksheet content lives in outputData.
     *
     * The worksheet design is stored in inputData.design.
     *
     * Older worksheets may not have a design saved yet,
     * so we safely fall back to DEFAULT_WORKSHEET_DESIGN.
     */

    let design: WorksheetDesign = DEFAULT_WORKSHEET_DESIGN;

    const inputData = generation.inputData;

    if (
      inputData &&
      typeof inputData === "object" &&
      !Array.isArray(inputData)
    ) {
      const savedInputData = inputData as Record<string, unknown>;

      if (isValidWorksheetDesign(savedInputData.design)) {
        design = savedInputData.design;
      }
    }

    /*
     * =========================================================
     * SUCCESS
     * =========================================================
     */

    console.log("[GetWorksheet] Worksheet loaded successfully:", {
      projectId: project.id,

      generationId: generation.id,

      title: parsed.data.title,

      design,
    });

    return {
      success: true,

      worksheet: parsed.data,

      projectId: project.id,

      generationId: generation.id,

      savedAt: generation.updatedAt.toISOString(),

      design,
    };
  } catch (error) {
    console.error("[GetWorksheet] Unexpected error:", error);

    return {
      success: false,

      error:
        error instanceof Error ? error.message : "Unable to load worksheet.",
    };
  }
}
