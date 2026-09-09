import prisma from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import { AIAssetType } from "@/lib/generated/prisma/enums";

export type PersistAIAssetInput = {
  userId: string;
  generationId: string;
  projectId?: string | null;
  type: AIAssetType;
  name: string;
  fileKey?: string | null;
  url?: string | null;
  thumbnailUrl?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  metadata?: Prisma.InputJsonValue | null;
};

export type PersistedAIAsset = {
  id: string;
  userId: string;
  projectId: string | null;
  generationId: string | null;
  type: AIAssetType;
  name: string;
  fileKey: string | null;
  url: string | null;
  thumbnailUrl: string | null;
  mimeType: string | null;
  fileSize: number | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Persist one first-class AI artifact for a completed generation.
 *
 * The generation is the idempotency boundary. A generation can own multiple
 * assets in the future (for example, image variants), so the caller's asset
 * type is part of the natural lookup key used here.
 *
 * Pass a transaction client when artifact creation is part of a generation
 * finalization transaction. That keeps message, conversation, generation and
 * asset persistence atomic.
 */
export async function persistAIAsset(
  input: PersistAIAssetInput,
  tx: Prisma.TransactionClient = prisma,
): Promise<PersistedAIAsset> {
  const userId = input.userId.trim();
  const generationId = input.generationId.trim();

  if (!userId) {
    throw new Error("User ID is required to persist an AI asset.");
  }

  if (!generationId) {
    throw new Error("Generation ID is required to persist an AI asset.");
  }

  const generation = await tx.aIGeneration.findFirst({
    where: {
      id: generationId,
      userId,
    },
    select: {
      id: true,
      userId: true,
      projectId: true,
    },
  });

  if (!generation) {
    throw new Error("AI generation not found or is not owned by the user.");
  }

  const projectId = input.projectId ?? generation.projectId ?? null;

  if (projectId && generation.projectId && projectId !== generation.projectId) {
    throw new Error("AI asset project does not match its generation project.");
  }

  if (projectId) {
    const project = await tx.aIProject.findFirst({
      where: {
        id: projectId,
        userId,
        status: "ACTIVE",
      },
      select: { id: true },
    });

    if (!project) {
      throw new Error("AI project not found or is no longer active.");
    }
  }

  const existing = await tx.aIAsset.findFirst({
    where: {
      userId,
      generationId,
      type: input.type,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (existing) {
    return existing;
  }

  return tx.aIAsset.create({
    data: {
      userId,
      generationId,
      projectId,
      type: input.type,
      name: input.name.trim() || "AI Creation",
      fileKey: input.fileKey ?? null,
      url: input.url ?? null,
      thumbnailUrl: input.thumbnailUrl ?? null,
      mimeType: input.mimeType ?? null,
      fileSize: input.fileSize ?? null,
      metadata: input.metadata ?? undefined,
    },
  });
}
