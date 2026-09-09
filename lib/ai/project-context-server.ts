import "server-only";

import prisma from "@/lib/prisma";

import {
  normalizeProjectContext,
  type ProjectContext,
} from "@/lib/ai/project-context";

export async function getOwnedProjectContext(
  userId: string,
  projectId: string | null | undefined,
): Promise<{
  id: string;
  name: string;
  type: string;
  context: ProjectContext;
} | null> {
  const normalizedUserId = userId.trim();
  const normalizedProjectId = projectId?.trim();

  if (!normalizedUserId || !normalizedProjectId) {
    return null;
  }

  const project = await prisma.aIProject.findFirst({
    where: {
      id: normalizedProjectId,
      userId: normalizedUserId,
      status: "ACTIVE",
    },
    select: {
      id: true,
      name: true,
      type: true,
      context: true,
    },
  });

  if (!project) {
    return null;
  }

  return {
    id: project.id,
    name: project.name,
    type: project.type,
    context: normalizeProjectContext(project.context),
  };
}
