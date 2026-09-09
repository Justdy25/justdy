import { AIGenerationStatus } from "@/lib/generated/prisma/enums";

const ALLOWED_TRANSITIONS: Record<
  AIGenerationStatus,
  readonly AIGenerationStatus[]
> = {
  [AIGenerationStatus.PENDING]: [
    AIGenerationStatus.PROCESSING,
    AIGenerationStatus.FAILED,
  ],
  [AIGenerationStatus.PROCESSING]: [
    AIGenerationStatus.COMPLETED,
    AIGenerationStatus.FAILED,
    AIGenerationStatus.CANCELLED,
  ],
  [AIGenerationStatus.COMPLETED]: [],
  [AIGenerationStatus.FAILED]: [],
  [AIGenerationStatus.CANCELLED]: [],
};

export function canTransitionAIGeneration(
  from: AIGenerationStatus,
  to: AIGenerationStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertAIGenerationTransition(
  from: AIGenerationStatus,
  to: AIGenerationStatus,
): void {
  if (from === to) {
    throw new Error(`AI generation is already ${to.toLowerCase()}.`);
  }

  if (!canTransitionAIGeneration(from, to)) {
    throw new Error(
      `Invalid AI generation state transition: ${from} -> ${to}.`,
    );
  }
}
