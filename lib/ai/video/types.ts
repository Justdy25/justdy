export type VideoModel = "sora-2" | "sora-2-pro";

export type VideoDuration = 4 | 8 | 12;

export type VideoAspectRatio = "16:9" | "9:16";

export type VideoResolution = "1280x720" | "720x1280";

export type VideoJobStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export interface CreateVideoInput {
  prompt: string;
  duration: VideoDuration;
  aspectRatio: VideoAspectRatio;
  model?: VideoModel;
  requestId?: string;
}

export interface VideoProviderJob {
  provider: "openai";
  providerTaskId: string;
  model: VideoModel;
  status: VideoJobStatus;
  duration: VideoDuration;
  resolution: VideoResolution;
}

export interface VideoProviderStatus {
  provider: "openai";
  providerTaskId: string;
  model: VideoModel;
  status: VideoJobStatus;
  videoUrl?: string;
  error?: string;
}
