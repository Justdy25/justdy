import "server-only";

import prisma from "@/lib/prisma";
import { uploadThingStorage } from "@/lib/storage";

import { buildProjectAwarePrompt } from "@/lib/ai/project-context";
import { getOwnedProjectContext } from "@/lib/ai/project-context-server";

import { AIImageError } from "./errors";
import { generateImageWithOpenAI } from "./provider";
import { validateCreateImageInput } from "./validation";

import type { CreateImageInput, GeneratedImage } from "./types";

function base64ToBuffer(base64: string): Buffer {
  if (!base64?.trim()) {
    throw new AIImageError(
      "Image provider returned empty image data.",
      "PROVIDER_EMPTY_RESPONSE",
    );
  }

  try {
    return Buffer.from(base64, "base64");
  } catch {
    throw new AIImageError(
      "Unable to decode generated image.",
      "PROVIDER_INVALID_RESPONSE",
    );
  }
}

function getImageExtension(mimeType: string): string {
  switch (mimeType.toLowerCase()) {
    case "image/jpeg":
      return "jpg";

    case "image/webp":
      return "webp";

    case "image/png":
    default:
      return "png";
  }
}

function isPrismaUniqueConstraintError(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return false;
  }

  return error.code === "P2002";
}

function buildGeneratedImage({
  generationId,
  assetId,
  url,
  mimeType,
  model,
  size,
  quality,
  prompt,
  status,
}: {
  generationId: string;
  assetId: string;
  url: string;
  mimeType: string;
  model: CreateImageInput["model"];
  size: CreateImageInput["size"];
  quality: CreateImageInput["quality"];
  prompt: string;
  status: GeneratedImage["status"];
}): GeneratedImage {
  return {
    generationId,
    assetId,
    url,
    mimeType,
    model: model ?? "gpt-image-2",
    size: size ?? "1024x1024",
    quality: quality ?? "auto",
    prompt,
    status,
  };
}

export async function generateImage(
  input: CreateImageInput,
): Promise<GeneratedImage> {
  const validated = validateCreateImageInput(input);

  const project = await getOwnedProjectContext(
    validated.userId,
    validated.projectId,
  );

  const generationPrompt = project
    ? buildProjectAwarePrompt({
        project,
        prompt: validated.prompt,
      })
    : validated.prompt;

  const model = validated.model ?? "gpt-image-2";
  const size = validated.size ?? "1024x1024";
  const quality = validated.quality ?? "auto";
  const outputFormat = validated.outputFormat ?? "png";
  const background = validated.background ?? "auto";

  const existingGeneration = await prisma.aIGeneration.findUnique({
    where: {
      requestId: validated.requestId,
    },
    include: {
      assets: true,
    },
  });

  if (existingGeneration) {
    const existingAsset = existingGeneration.assets.find(
      (asset) => asset.type === "IMAGE",
    );

    /*
     * ----------------------------------------------------------
     * COMPLETED
     * ----------------------------------------------------------
     */

    if (existingGeneration.status === "COMPLETED") {
      if (existingAsset?.url) {
        return buildGeneratedImage({
          generationId: existingGeneration.id,
          assetId: existingAsset.id,
          url: existingAsset.url,
          mimeType: existingAsset.mimeType ?? "image/png",
          model,
          size,
          quality,
          prompt: validated.prompt,
          status: existingGeneration.status,
        });
      }

      /*
       * A completed generation without an image asset indicates
       * an inconsistent database state.
       */

      throw new AIImageError(
        "Image generation completed, but its image asset is missing.",
        "ASSET_MISSING",
      );
    }

    /*
     * ----------------------------------------------------------
     * PROCESSING / PENDING
     * ----------------------------------------------------------
     *
     * Another request is currently generating this image.
     */

    if (
      existingGeneration.status === "PROCESSING" ||
      existingGeneration.status === "PENDING"
    ) {
      throw new AIImageError(
        "An image generation with this request is already in progress.",
        "GENERATION_IN_PROGRESS",
      );
    }

    /*
     * ----------------------------------------------------------
     * FAILED / CANCELLED
     * ----------------------------------------------------------
     *
     * The existing generation record can be reused below.
     */
  }

  /*
   * ============================================================
   * CREATE / REUSE GENERATION
   * ============================================================
   */

  let generation;

  if (existingGeneration) {
    /*
     * Reuse a previous FAILED/CANCELLED generation.
     */

    generation = await prisma.aIGeneration.update({
      where: {
        id: existingGeneration.id,
      },
      data: {
        status: "PROCESSING",
        prompt: validated.prompt,
        provider: "openai",
        model,
        operation: "IMAGE",
        type: "IMAGE",
        projectId: validated.projectId,
        inputData: {
          prompt: validated.prompt,
          model,
          size,
          quality,
          outputFormat,
          background,
        },
        errorMessage: null,
        startedAt: new Date(),
        completedAt: null,
      },
    });
  } else {
    /*
     * ----------------------------------------------------------
     * FIRST CREATION
     * ----------------------------------------------------------
     *
     * requestId has a unique database constraint.
     *
     * Two simultaneous requests may both pass the initial
     * findUnique() check. Only one can successfully create the
     * generation.
     */

    try {
      generation = await prisma.aIGeneration.create({
        data: {
          userId: validated.userId,
          projectId: validated.projectId,
          type: "IMAGE",
          operation: "IMAGE",
          status: "PROCESSING",
          prompt: validated.prompt,
          provider: "openai",
          model,
          requestId: validated.requestId,
          inputData: {
            prompt: validated.prompt,
            model,
            size,
            quality,
            outputFormat,
            background,
          },
          startedAt: new Date(),
        },
      });
    } catch (error) {
      /*
       * ========================================================
       * REQUEST ID RACE
       * ========================================================
       *
       * Another request may have created this requestId between
       * our findUnique() and create().
       */

      if (!isPrismaUniqueConstraintError(error)) {
        throw error;
      }

      const racedGeneration = await prisma.aIGeneration.findUnique({
        where: {
          requestId: validated.requestId,
        },
        include: {
          assets: true,
        },
      });

      /*
       * Extremely unlikely, but if the row disappeared between
       * the unique-constraint error and this lookup, rethrow the
       * original error.
       */

      if (!racedGeneration) {
        throw error;
      }

      const racedAsset = racedGeneration.assets.find(
        (asset) => asset.type === "IMAGE",
      );

      /*
       * --------------------------------------------------------
       * RACE WINNER ALREADY COMPLETED
       * --------------------------------------------------------
       */

      if (racedGeneration.status === "COMPLETED" && racedAsset?.url) {
        return buildGeneratedImage({
          generationId: racedGeneration.id,
          assetId: racedAsset.id,
          url: racedAsset.url,
          mimeType: racedAsset.mimeType ?? "image/png",
          model,
          size,
          quality,
          prompt: validated.prompt,
          status: racedGeneration.status,
        });
      }

      /*
       * --------------------------------------------------------
       * RACE WINNER STILL PROCESSING
       * --------------------------------------------------------
       */

      if (
        racedGeneration.status === "PROCESSING" ||
        racedGeneration.status === "PENDING"
      ) {
        throw new AIImageError(
          "An image generation with this request is already in progress.",
          "GENERATION_IN_PROGRESS",
        );
      }

      /*
       * --------------------------------------------------------
       * RACE WINNER FAILED / CANCELLED
       * --------------------------------------------------------
       *
       * Reuse the existing generation record.
       */

      generation = await prisma.aIGeneration.update({
        where: {
          id: racedGeneration.id,
        },
        data: {
          status: "PROCESSING",
          prompt: validated.prompt,
          provider: "openai",
          model,
          operation: "IMAGE",
          type: "IMAGE",
          projectId: validated.projectId,
          inputData: {
            prompt: validated.prompt,
            model,
            size,
            quality,
            outputFormat,
            background,
          },
          errorMessage: null,
          startedAt: new Date(),
          completedAt: null,
        },
      });
    }
  }

  /*
   * ============================================================
   * STORAGE / ASSET TRACKING
   * ============================================================
   */

  let uploadedFileKey: string | null = null;
  let createdAssetId: string | null = null;

  try {
    /*
     * ============================================================
     * GENERATE IMAGE WITH OPENAI
     * ============================================================
     */

    const providerResult = await generateImageWithOpenAI({
      ...validated,
      prompt: generationPrompt,
      model,
      size,
      quality,
      outputFormat,
      background,
    });

    /*
     * ============================================================
     * DECODE BASE64 IMAGE
     * ============================================================
     */

    const imageBuffer = base64ToBuffer(providerResult.base64);

    if (!imageBuffer.length) {
      throw new AIImageError(
        "Generated image contains no data.",
        "PROVIDER_INVALID_RESPONSE",
      );
    }

    /*
     * ============================================================
     * DETERMINE FILE NAME
     * ============================================================
     */

    const extension = getImageExtension(providerResult.mimeType);

    const fileName = `justdy-ai-image-${generation.id}.${extension}`;

    /*
     * ============================================================
     * UPLOAD TO UPLOADTHING
     * ============================================================
     */

    const storedFile = await uploadThingStorage.uploadBuffer({
      buffer: imageBuffer,
      name: fileName,
      mimeType: providerResult.mimeType,
      customId: `justdy-ai-image-${generation.id}`,
    });

    uploadedFileKey = storedFile.key;

    /*
     * ============================================================
     * CREATE AI ASSET
     * ============================================================
     */

    const asset = await prisma.aIAsset.create({
      data: {
        userId: validated.userId,
        projectId: validated.projectId,
        generationId: generation.id,
        type: "IMAGE",
        name: storedFile.name,
        fileKey: storedFile.key,
        url: storedFile.url,
        mimeType: storedFile.mimeType,
        fileSize: storedFile.size,
        metadata: {
          model,
          size,
          quality,
          outputFormat,
          background,
          prompt: validated.prompt,
          storage: "uploadthing",
        },
      },
    });

    createdAssetId = asset.id;

    /*
     * ============================================================
     * COMPLETE GENERATION
     * ============================================================
     */

    const completedGeneration = await prisma.aIGeneration.update({
      where: {
        id: generation.id,
      },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        outputData: {
          assetId: asset.id,
          fileKey: storedFile.key,
          url: storedFile.url,
          mimeType: storedFile.mimeType,
          fileSize: storedFile.size,
          model,
          size,
          quality,
          outputFormat,
          background,
          storage: "uploadthing",
        },
      },
    });

    /*
     * ============================================================
     * RETURN GENERATED IMAGE
     * ============================================================
     */

    return buildGeneratedImage({
      generationId: completedGeneration.id,
      assetId: asset.id,
      url: storedFile.url,
      mimeType: storedFile.mimeType,
      model,
      size,
      quality,
      prompt: validated.prompt,
      status: completedGeneration.status,
    });
  } catch (error) {
    /*
     * ============================================================
     * CLEAN UP UPLOADTHING FILE
     * ============================================================
     */

    if (uploadedFileKey) {
      try {
        await uploadThingStorage.delete(uploadedFileKey);
      } catch (cleanupError) {
        console.error(
          "Failed to clean up uploaded image after generation failure:",
          cleanupError,
        );
      }
    }

    /*
     * ============================================================
     * CLEAN UP DATABASE ASSET
     * ============================================================
     */

    if (createdAssetId) {
      try {
        await prisma.aIAsset.delete({
          where: {
            id: createdAssetId,
          },
        });
      } catch (cleanupError) {
        console.error(
          "Failed to clean up image asset after generation failure:",
          cleanupError,
        );
      }
    }

    /*
     * ============================================================
     * ERROR MESSAGE
     * ============================================================
     */

    const message =
      error instanceof Error ? error.message : "Image generation failed.";

    /*
     * ============================================================
     * MARK GENERATION FAILED
     * ============================================================
     */

    try {
      await prisma.aIGeneration.update({
        where: {
          id: generation.id,
        },
        data: {
          status: "FAILED",
          errorMessage: message,
          completedAt: new Date(),
        },
      });
    } catch (updateError) {
      console.error("Failed to mark image generation as failed:", updateError);
    }

    /*
     * ============================================================
     * PRESERVE AI IMAGE ERRORS
     * ============================================================
     */

    if (error instanceof AIImageError) {
      throw error;
    }

    /*
     * ============================================================
     * NORMALIZE UNKNOWN ERRORS
     * ============================================================
     */

    throw new AIImageError(message, "GENERATION_FAILED");
  }
}
