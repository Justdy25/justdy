export const AI_VIDEO_CREDIT_COSTS = {
  5: 10,
  10: 20,
  15: 30,
} as const;

export type AIVideoDuration = keyof typeof AI_VIDEO_CREDIT_COSTS;

export function getAIVideoCreditCost(duration: number): number {
  if (duration !== 5 && duration !== 10 && duration !== 15) {
    throw new Error("Invalid video duration.");
  }

  return AI_VIDEO_CREDIT_COSTS[duration as AIVideoDuration];
}
