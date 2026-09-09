import "server-only";

import { generateImage } from "@/lib/ai/image/generator";
import { parseImageCommand } from "./image-command";

export interface ImageChatGenerationInput {
  userId: string;
  prompt: string;
  requestId: string;
  projectId?: string;
}

export async function generateImageFromChat({
  userId,
  prompt,
  requestId,
  projectId,
}: ImageChatGenerationInput) {
  const command = parseImageCommand(prompt);

  const image = await generateImage({
    userId,
    prompt: command.prompt,
    model: command.model,
    size: command.size,
    quality: command.quality,
    outputFormat: command.outputFormat,
    background: command.background,
    requestId,
    projectId,
  });

  return {
    image,
    command,
  };
}
