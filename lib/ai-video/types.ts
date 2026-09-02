export type AIVideoProvider = "google-veo";

export type AIVideoProviderStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

export type CreateAIVideoRequest = {
  prompt: string;
  duration: number;
  aspectRatio: "16:9" | "9:16";
};

export type CreateAIVideoResponse = {
  provider: AIVideoProvider;
  providerTaskId: string;
  status: AIVideoProviderStatus;
};

export type AIVideoResult = {
  status: "COMPLETED";
  videoUrl: string;
};

export type AIVideoFailure = {
  status: "FAILED";
  error: string;
};
