import type {
  CreateVideoInput,
  VideoDuration,
  VideoAspectRatio,
  VideoModel,
} from "./types";
import { AIVideoError } from "./errors";

const VALID_DURATIONS: readonly VideoDuration[] = [4, 8, 12];

const VALID_ASPECT_RATIOS: readonly VideoAspectRatio[] = ["16:9", "9:16"];

const VALID_MODELS: readonly VideoModel[] = ["sora-2", "sora-2-pro"];

export function validateVideoRequest(
  input: CreateVideoInput,
): CreateVideoInput {
  const prompt = input.prompt?.trim();

  if (!prompt) {
    throw new AIVideoError("A video prompt is required.", "INVALID_REQUEST");
  }

  if (prompt.length > 4000) {
    throw new AIVideoError(
      "Video prompts cannot exceed 4000 characters.",
      "INVALID_REQUEST",
    );
  }

  if (!VALID_DURATIONS.includes(input.duration)) {
    throw new AIVideoError(
      "Video duration must be 4, 8, or 12 seconds.",
      "INVALID_REQUEST",
    );
  }

  if (!VALID_ASPECT_RATIOS.includes(input.aspectRatio)) {
    throw new AIVideoError(
      "Video aspect ratio must be 16:9 or 9:16.",
      "INVALID_REQUEST",
    );
  }

  const model = input.model ?? "sora-2";

  if (!VALID_MODELS.includes(model)) {
    throw new AIVideoError("Unsupported video model.", "INVALID_REQUEST");
  }

  return {
    ...input,
    prompt,
    model,
  };
}
