import type { ProjectContext } from "@/lib/ai/project-context";

export type ImageModel = "gpt-image-2";

export type ImageSize = "1024x1024" | "1024x1536" | "1536x1024" | "auto";

export type ImageQuality = "low" | "medium" | "high" | "auto";

export type ImageOutputFormat = "png" | "jpeg";

export type ImageBackground = "auto" | "opaque";

export type ImageGenerationStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export interface CreateImageInput {
  userId: string;
  prompt: string;
  model?: ImageModel;
  size?: ImageSize;
  quality?: ImageQuality;
  outputFormat?: ImageOutputFormat;
  background?: ImageBackground;
  requestId: string;
  projectId?: string;

  /**
   * Optional project context used by the centralized
   * image generation service.
   */
  projectContext?: ProjectContext | null;
}

export interface ImageProviderResult {
  base64: string;
  mimeType: string;
}

export interface GeneratedImage {
  generationId: string;
  assetId: string;
  url: string;
  mimeType: string;
  model: ImageModel;
  size: ImageSize;
  quality: ImageQuality;
  prompt: string;
  status: ImageGenerationStatus;
}
