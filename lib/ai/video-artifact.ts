import prisma from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import {
  AIAssetType,
  AIGenerationStatus,
  AIGenerationType,
} from "@/lib/generated/prisma/enums";
import { persistAIAsset } from "@/lib/ai/artifacts";

export async function persistVideoArtifact({
  userId,
  videoGenerationId,
  projectId,
}: {
  userId: string;
  videoGenerationId: string;
  projectId?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const video = await tx.videoGeneration.findFirst({
      where: { id: videoGenerationId, userId },
      select: {
        id: true,
        userId: true,
        status: true,
        prompt: true,
        provider: true,
        model: true,
        duration: true,
        aspectRatio: true,
        creditsUsed: true,
        thumbnailUrl: true,
        errorMessage: true,
        createdAt: true,
        updatedAt: true,
        completedAt: true,
      },
    });

    if (!video) {
      throw new Error(
        "Video generation not found or is not owned by the user.",
      );
    }

    const existing = await tx.aIAsset.findFirst({
      where: {
        userId,
        generation: { type: AIGenerationType.VIDEO },
        metadata: {
          path: ["videoGenerationId"],
          equals: video.id,
        },
      },
      select: { id: true },
    });

    if (existing) {
      return tx.aIAsset.findUniqueOrThrow({ where: { id: existing.id } });
    }

    const generation = await tx.aIGeneration.create({
      data: {
        userId,
        projectId: projectId ?? null,
        type: AIGenerationType.VIDEO,
        status:
          video.status === "COMPLETED"
            ? AIGenerationStatus.COMPLETED
            : video.status === "FAILED"
              ? AIGenerationStatus.FAILED
              : video.status === "CANCELLED"
                ? AIGenerationStatus.CANCELLED
                : AIGenerationStatus.PROCESSING,
        prompt: video.prompt,
        provider: video.provider,
        model: video.model,
        creditsUsed: video.creditsUsed,
        errorMessage: video.errorMessage,
        startedAt: video.createdAt,
        completedAt: video.completedAt,
        outputData: {
          videoGenerationId: video.id,
          videoUrl: `/api/ai/video/${video.id}/content`,
          thumbnailUrl: video.thumbnailUrl,
          duration: video.duration,
          aspectRatio: video.aspectRatio,
        } satisfies Prisma.InputJsonValue,
      },
    });

    return persistAIAsset(
      {
        userId,
        generationId: generation.id,
        projectId: projectId ?? null,
        type: AIAssetType.VIDEO,
        name:
          video.prompt.trim().length > 60
            ? `${video.prompt.trim().slice(0, 60)}...`
            : video.prompt.trim() || "AI Video",
        url: `/api/ai/video/${video.id}/content`,
        thumbnailUrl: video.thumbnailUrl,
        mimeType: "video/mp4",
        metadata: {
          artifactType: "VIDEO",
          editable: false,
          videoGenerationId: video.id,
          duration: video.duration,
          aspectRatio: video.aspectRatio,
          provider: video.provider,
          model: video.model,
        },
      },
      tx,
    );
  });
}
