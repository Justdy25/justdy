export const AI_OPERATIONS = [
  "CHAT",
  "RESEARCH",
  "IMAGE",
  "VIDEO",
  "AUDIO",
  "DOCUMENT",
  "WORKSHEET",
  "QUIZ",
  "LESSON_PLAN",
  "PRESENTATION",
] as const;

export type AIOperation = (typeof AI_OPERATIONS)[number];
