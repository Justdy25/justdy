import "server-only";

import OpenAI from "openai";

import { getRequiredOpenAIAPIKey } from "@/lib/ai/config";
import { AIVideoError } from "./errors";
import type {
  CreateVideoInput,
  VideoProviderJob,
  VideoProviderStatus,
  VideoResolution,
} from "./types";

const openai = new OpenAI({
  apiKey: getRequiredOpenAIAPIKey(),
});

function getResolution(
  aspectRatio: CreateVideoInput["aspectRatio"],
): VideoResolution {
  switch (aspectRatio) {
    case "9:16":
      return "720x1280";

    case "16:9":
    default:
      return "1280x720";
  }
}

function normalizeStatus(status: string): VideoProviderStatus["status"] {
  switch (status) {
    case "queued":
      return "PENDING";

    case "in_progress":
      return "PROCESSING";

    case "completed":
      return "COMPLETED";

    case "failed":
      return "FAILED";

    case "cancelled":
      return "CANCELLED";

    default:
      return "PROCESSING";
  }
}

export async function createVideoJob(
  input: CreateVideoInput,
): Promise<VideoProviderJob> {
  const model = input.model ?? "sora-2";
  const resolution = getResolution(input.aspectRatio);

  try {
    const video = await openai.videos.create({
      model,
      prompt: input.prompt,
      seconds: String(input.duration) as "4" | "8" | "12",
      size: resolution,
    });

    return {
      provider: "openai",
      providerTaskId: video.id,
      model,
      status: normalizeStatus(video.status),
      duration: input.duration,
      resolution,
    };
  } catch (error) {
    console.error("[AI Video] OpenAI video creation failed:", error);

    throw new AIVideoError(
      "Unable to start video generation.",
      "PROVIDER_ERROR",
    );
  }
}

export async function getVideoJobStatus(
  providerTaskId: string,
): Promise<VideoProviderStatus> {
  try {
    const video = await openai.videos.retrieve(providerTaskId);

    return {
      provider: "openai",
      providerTaskId: video.id,
      model: video.model as VideoProviderStatus["model"],
      status: normalizeStatus(video.status),
      error: video.error?.message ?? undefined,
    };
  } catch (error) {
    console.error("[AI Video] OpenAI video status retrieval failed:", error);

    throw new AIVideoError(
      "Unable to retrieve video generation status.",
      "PROVIDER_ERROR",
    );
  }
}

export async function downloadVideoContent(
  providerTaskId: string,
): Promise<Response> {
  try {
    return await openai.videos.downloadContent(providerTaskId, {
      variant: "video",
    });
  } catch (error) {
    console.error("[AI Video] OpenAI video download failed:", error);

    throw new AIVideoError(
      "Unable to download generated video.",
      "PROVIDER_ERROR",
    );
  }
}
