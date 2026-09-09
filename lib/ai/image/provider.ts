import "server-only";

import OpenAI from "openai";

import { getRequiredOpenAIAPIKey } from "@/lib/ai/config";
import { AIImageError } from "./errors";
import type { CreateImageInput, ImageProviderResult } from "./types";

const openai = new OpenAI({
  apiKey: getRequiredOpenAIAPIKey(),
});

export async function generateImageWithOpenAI(
  input: CreateImageInput,
): Promise<ImageProviderResult> {
  try {
    const result = await openai.images.generate({
      model: input.model ?? "gpt-image-2",
      prompt: input.prompt,
      size: input.size ?? "1024x1024",
      quality: input.quality ?? "auto",
      output_format: input.outputFormat ?? "png",
      background: input.background ?? "auto",
      n: 1,
    });

    const image = result.data?.[0];

    if (!image?.b64_json) {
      throw new AIImageError(
        "OpenAI did not return image data.",
        "PROVIDER_EMPTY_RESPONSE",
      );
    }

    return {
      base64: image.b64_json,
      mimeType: input.outputFormat === "jpeg" ? "image/jpeg" : "image/png",
    };
  } catch (error) {
    if (error instanceof AIImageError) {
      throw error;
    }

    throw new AIImageError(
      error instanceof Error ? error.message : "Image generation failed.",
      "PROVIDER_ERROR",
    );
  }
}
