"use server";

import "server-only";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";

import { WorksheetDocumentSchema } from "@/lib/ai/worksheet/schema";

import type { WorksheetDocument } from "@/lib/ai/worksheet/schema";
import prisma from "@/lib/prisma";

export type SavedWorksheet = {
  projectId: string;
  generationId: string;

  title: string;

  subject: string;

  gradeLevel: string;

  topic: string;

  questionCount: number;

  updatedAt: string;

  worksheet: WorksheetDocument;
};

export type GetWorksheetsResult =
  | {
      success: true;

      worksheets: SavedWorksheet[];
    }
  | {
      success: false;

      error: string;
    };

export async function GetWorksheets(): Promise<GetWorksheetsResult> {
  try {
    /*
     * ============================================================
     * AUTHENTICATION
     * ============================================================
     */

    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return {
        success: false,

        error: "You must be signed in.",
      };
    }

    /*
     * ============================================================
     * GET WORKSHEET PROJECTS
     * ============================================================
     */

    const projects = await prisma.aIProject.findMany({
      where: {
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

      orderBy: {
        updatedAt: "desc",
      },
    });

    /*
     * ============================================================
     * BUILD WORKSHEET LIST
     * ============================================================
     */

    const worksheets: SavedWorksheet[] = [];

    for (const project of projects) {
      const generation = project.generations[0];

      /*
       * No completed worksheet generation.
       */

      if (!generation || !generation.outputData) {
        continue;
      }

      /*
       * ==========================================================
       * VALIDATE DATABASE JSON
       * ==========================================================
       *
       * outputData is stored as Prisma Json.
       *
       * We validate it before sending it to the client.
       */

      const parsed = WorksheetDocumentSchema.safeParse(generation.outputData);

      /*
       * Ignore invalid/corrupted worksheet records
       * rather than crashing the entire library.
       */

      if (!parsed.success) {
        console.error(
          `Invalid worksheet data for project ${project.id}:`,
          parsed.error,
        );

        continue;
      }

      /*
       * This is now the validated WorksheetDocument.
       */

      const worksheet = parsed.data;

      /*
       * ==========================================================
       * ADD TO RESULT
       * ==========================================================
       */

      worksheets.push({
        projectId: project.id,

        generationId: generation.id,

        title: worksheet.title || project.name || "Untitled Worksheet",

        subject: worksheet.subject || "Unknown Subject",

        gradeLevel: worksheet.gradeLevel || "",

        topic: worksheet.topic || "",

        questionCount: worksheet.questions.length,

        updatedAt: generation.updatedAt.toISOString(),

        worksheet,
      });
    }

    /*
     * ============================================================
     * RETURN
     * ============================================================
     */

    return {
      success: true,

      worksheets,
    };
  } catch (error) {
    console.error("GetWorksheets error:", error);

    return {
      success: false,

      error:
        error instanceof Error ? error.message : "Unable to load worksheets.",
    };
  }
}
