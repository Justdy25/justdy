import type { Prisma } from "@/lib/generated/prisma/client";
import { AIAssetType } from "@/lib/generated/prisma/enums";
import { persistAIAsset } from "@/lib/ai/artifacts";

export type GenericArtifactOperation =
  | "AUDIO"
  | "DOCUMENT"
  | "QUIZ"
  | "LESSON_PLAN";

function assetTypeForOperation(
  operation: GenericArtifactOperation,
): AIAssetType {
  switch (operation) {
    case "AUDIO":
      return AIAssetType.AUDIO;
    case "DOCUMENT":
    case "QUIZ":
    case "LESSON_PLAN":
      return AIAssetType.DOCUMENT;
  }
}

function artifactLabel(operation: GenericArtifactOperation): string {
  switch (operation) {
    case "AUDIO":
      return "Audio script";
    case "DOCUMENT":
      return "Document";
    case "QUIZ":
      return "Quiz";
    case "LESSON_PLAN":
      return "Lesson plan";
  }
}

/**
 * Persists the canonical artifact for generic text-stream operations.
 * The generation itself is finalized by streamAI.finalize() in the same
 * transaction, so the asset cannot exist independently of the generation.
 */
export async function persistGenericChatArtifact({
  tx,
  userId,
  generationId,
  projectId,
  operation,
  prompt,
  text,
}: {
  tx: Prisma.TransactionClient;
  userId: string;
  generationId: string;
  projectId: string | null;
  operation: GenericArtifactOperation;
  prompt: string;
  text: string;
}) {
  const label = artifactLabel(operation);
  const normalizedPrompt = prompt.trim();

  return persistAIAsset(
    {
      userId,
      generationId,
      projectId,
      type: assetTypeForOperation(operation),
      name:
        normalizedPrompt.length > 60
          ? `${normalizedPrompt.slice(0, 60)}...`
          : normalizedPrompt || label,
      mimeType: "text/plain",
      metadata: {
        artifactType: operation,
        editable: false,
        source: "AI_CHAT",
        operation,
        content: text,
      } satisfies Prisma.InputJsonValue,
    },
    tx,
  );
}
