"use server";

import prisma from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";

export async function GetAIDashboardData() {
  const user = await getAuthenticatedUser();

  if (!user) {
    throw new Error("Authentication required.");
  }

  const [projects, generations] = await Promise.all([
    prisma.aIProject.findMany({
      where: {
        userId: user.id,
        status: "ACTIVE",
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 6,
      select: {
        id: true,
        name: true,
        description: true,
        type: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            generations: true,
            assets: true,
          },
        },
      },
    }),

    prisma.aIGeneration.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 8,
      select: {
        id: true,
        type: true,
        status: true,
        prompt: true,
        provider: true,
        model: true,
        creditsUsed: true,
        createdAt: true,
        completedAt: true,
        projectId: true,
        project: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        assets: {
          select: {
            id: true,
            type: true,
            name: true,
            url: true,
            thumbnailUrl: true,
            mimeType: true,
          },
          take: 4,
        },
      },
    }),
  ]);

  return {
    projects,
    generations,
  };
}
