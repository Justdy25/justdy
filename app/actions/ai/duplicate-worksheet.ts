"use server";

import "server-only";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";

import { WorksheetDocumentSchema } from "@/lib/ai/worksheet/schema";
import prisma from "@/lib/prisma";

export type DuplicateWorksheetResult =
  | {
      success: true;
      projectId: string;
      generationId: string;
    }
  | {
      success: false;
      error: string;
    };

export async function DuplicateWorksheet(
  projectId: string,
): Promise<DuplicateWorksheetResult> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return {
        success: false,
        error: "You must be signed in.",
      };
    }

    if (!projectId?.trim()) {
      return {
        success: false,
        error: "Worksheet project ID is required.",
      };
    }

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

    if (!project) {
      return {
        success: false,
        error: "Worksheet not found.",
      };
    }

    const generation = project.generations[0];

    if (!generation || !generation.outputData) {
      return {
        success: false,
        error: "The worksheet has no saved content.",
      };
    }

    const parsed = WorksheetDocumentSchema.safeParse(generation.outputData);

    if (!parsed.success) {
      return {
        success: false,
        error: "The saved worksheet contains invalid data.",
      };
    }

    const worksheet = parsed.data;

    const duplicatedWorksheet = {
      ...worksheet,

      title: `${worksheet.title} (Copy)`,
    };

    const newProject = await prisma.aIProject.create({
      data: {
        userId: session.user.id,

        name: duplicatedWorksheet.title,

        description:
          `${duplicatedWorksheet.subject} • ` +
          `${duplicatedWorksheet.gradeLevel} • ` +
          `${duplicatedWorksheet.topic}`,

        type: "WORKSHEET",

        status: "ACTIVE",
      },
    });

    const newGeneration = await prisma.aIGeneration.create({
      data: {
        userId: session.user.id,

        projectId: newProject.id,

        type: "WORKSHEET",

        status: "COMPLETED",

        prompt: generation.prompt || `Duplicate worksheet: ${worksheet.title}`,

        inputData: generation.inputData ?? {},

        outputData: duplicatedWorksheet,

        provider: generation.provider,

        model: generation.model,

        creditsUsed: 0,

        startedAt: new Date(),

        completedAt: new Date(),
      },
    });

    return {
      success: true,

      projectId: newProject.id,

      generationId: newGeneration.id,
    };
  } catch (error) {
    console.error("DuplicateWorksheet error:", error);

    return {
      success: false,

      error:
        error instanceof Error
          ? error.message
          : "Unable to duplicate worksheet.",
    };
  }
}
