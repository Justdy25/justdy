import { AI_CAPABILITIES, getAICapability } from "@/lib/ai/capabilities";

import type { AIOperation } from "@/lib/ai/operations";

import { AIError } from "@/lib/ai/errors";

export function assertAIOperation(operation: AIOperation): void {
  const capability = getAICapability(operation);

  if (!capability.implemented) {
    throw new AIError(
      "UNSUPPORTED_OPERATION",
      `AI operation "${operation}" is not implemented yet.`,
      {
        details: {
          operation,
        },
      },
    );
  }
}

export function assertAIStreamingSupported(operation: AIOperation): void {
  const capability = getAICapability(operation);

  if (capability.streaming !== "STREAM") {
    throw new AIError(
      "UNSUPPORTED_STREAMING",
      `AI operation "${operation}" does not support streaming.`,
      {
        details: {
          operation,
        },
      },
    );
  }
}

export function getAvailableAIOperations(): AIOperation[] {
  return Object.values(AI_CAPABILITIES)
    .filter((capability) => capability.implemented)
    .map((capability) => capability.operation);
}
