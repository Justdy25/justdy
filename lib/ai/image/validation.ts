import type {
  CreateImageInput,
  ImageBackground,
  ImageModel,
  ImageOutputFormat,
  ImageQuality,
  ImageSize,
} from "./types";

const MODELS: ImageModel[] = ["gpt-image-2"];

const SIZES: ImageSize[] = ["1024x1024", "1024x1536", "1536x1024", "auto"];

const QUALITIES: ImageQuality[] = ["low", "medium", "high", "auto"];

const FORMATS: ImageOutputFormat[] = ["png", "jpeg"];

const BACKGROUNDS: ImageBackground[] = ["auto", "opaque"];

export function validateCreateImageInput(
  input: CreateImageInput,
): CreateImageInput {
  if (!input.userId?.trim()) {
    throw new Error("User ID is required.");
  }

  if (!input.requestId?.trim()) {
    throw new Error("Request ID is required.");
  }

  if (!input.prompt?.trim()) {
    throw new Error("Image prompt cannot be empty.");
  }

  if (input.prompt.trim().length > 10000) {
    throw new Error(
      "Image prompt is too long. Maximum length is 10,000 characters.",
    );
  }

  if (input.model !== undefined && !MODELS.includes(input.model)) {
    throw new Error("Invalid image model.");
  }

  if (input.size !== undefined && !SIZES.includes(input.size)) {
    throw new Error("Invalid image size.");
  }

  if (input.quality !== undefined && !QUALITIES.includes(input.quality)) {
    throw new Error("Invalid image quality.");
  }

  if (
    input.outputFormat !== undefined &&
    !FORMATS.includes(input.outputFormat)
  ) {
    throw new Error("Invalid image output format.");
  }

  if (
    input.background !== undefined &&
    !BACKGROUNDS.includes(input.background)
  ) {
    throw new Error("Invalid image background.");
  }

  return {
    ...input,
    prompt: input.prompt.trim(),
    model: input.model ?? "gpt-image-2",
    size: input.size ?? "1024x1024",
    quality: input.quality ?? "auto",
    outputFormat: input.outputFormat ?? "png",
    background: input.background ?? "auto",
  };
}
