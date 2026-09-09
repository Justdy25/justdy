import type { VideoDuration, VideoModel } from "./types";

const VIDEO_CREDIT_COSTS: Record<VideoModel, Record<VideoDuration, number>> = {
  "sora-2": {
    4: 10,
    8: 20,
    12: 30,
  },

  "sora-2-pro": {
    4: 20,
    8: 40,
    12: 60,
  },
};

export function getVideoCreditCost(
  duration: VideoDuration,
  model: VideoModel = "sora-2",
): number {
  return VIDEO_CREDIT_COSTS[model][duration];
}
