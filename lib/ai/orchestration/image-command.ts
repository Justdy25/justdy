import "server-only";

import type { ImageModel, ImageQuality, ImageSize } from "@/lib/ai/image/types";

export interface ImageCommand {
  prompt: string;
  model: ImageModel;
  size: ImageSize;
  quality: ImageQuality;
  outputFormat: "png" | "jpeg";
  background: "auto" | "opaque";
}

function extractSize(prompt: string): ImageSize {
  const lower = prompt.toLowerCase();

  if (
    /\b(portrait|vertical|9:16|tall|phone|mobile|story|reel|tiktok)\b/.test(
      lower,
    )
  ) {
    return "1024x1536";
  }

  if (
    /\b(landscape|horizontal|16:9|wide|cinematic|youtube|banner)\b/.test(lower)
  ) {
    return "1536x1024";
  }

  if (/\b(square|1:1|profile picture|avatar|icon)\b/.test(lower)) {
    return "1024x1024";
  }

  return "1024x1024";
}

function extractQuality(prompt: string): ImageQuality {
  const lower = prompt.toLowerCase();

  if (/\b(low quality|draft|rough|quick)\b/.test(lower)) {
    return "low";
  }

  if (/\b(medium quality|medium)\b/.test(lower)) {
    return "medium";
  }

  if (
    /\b(high quality|high resolution|high-res|high res|ultra|detailed)\b/.test(
      lower,
    )
  ) {
    return "high";
  }

  return "auto";
}

function extractOutputFormat(prompt: string): "png" | "jpeg" {
  const lower = prompt.toLowerCase();

  if (/\b(jpeg|jpg)\b/.test(lower)) {
    return "jpeg";
  }

  return "png";
}

function cleanPrompt(prompt: string): string {
  return prompt
    .trim()
    .replace(/\s+/g, " ")
    .replace(
      /\b(generate|create|make|produce|draw|design)\s+(an?\s+)?(image|picture|photo|illustration)\s*(of|about)?\s*/i,
      "",
    )
    .trim();
}

export function parseImageCommand(prompt: string): ImageCommand {
  const text = prompt.trim();

  if (!text) {
    throw new Error("Image prompt cannot be empty.");
  }

  const imagePrompt = cleanPrompt(text);

  if (!imagePrompt) {
    throw new Error("Please describe the image you want to create.");
  }

  return {
    prompt: imagePrompt,
    model: "gpt-image-2",
    size: extractSize(text),
    quality: extractQuality(text),
    outputFormat: extractOutputFormat(text),
    background: "auto",
  };
}
