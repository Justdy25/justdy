"use server";

import "server-only";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export type DeleteWorksheetResult =
  | {
      success: true;
    }
  | {
      success: false;
      error: string;
    };

export async function DeleteWorksheet(
  projectId: string,
): Promise<DeleteWorksheetResult> {
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
      },

      select: {
        id: true,
      },
    });

    if (!project) {
      return {
        success: false,
        error: "Worksheet not found.",
      };
    }

    /*
     * AIGeneration and AIAsset records connected
     * to the project must be removed first if your
     * Prisma relations do not use cascading deletes.
     */

    await prisma.aIGeneration.deleteMany({
      where: {
        projectId: project.id,
        userId: session.user.id,
      },
    });

    await prisma.aIAsset.deleteMany({
      where: {
        projectId: project.id,
        userId: session.user.id,
      },
    });

    await prisma.aIProject.delete({
      where: {
        id: project.id,
      },
    });

    return {
      success: true,
    };
  } catch (error) {
    console.error("DeleteWorksheet error:", error);

    return {
      success: false,

      error:
        error instanceof Error ? error.message : "Unable to delete worksheet.",
    };
  }
}
