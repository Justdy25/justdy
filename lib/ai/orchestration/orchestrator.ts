import "server-only";

import { detectAIIntent } from "./intent";
import { parseVideoCommand } from "./video-command";
import type { OrchestrateAIInput, OrchestrateAIResult } from "./types";

import { generateVideo } from "@/lib/ai/video/generator";

export async function orchestrateAI(
  input: OrchestrateAIInput,
): Promise<OrchestrateAIResult> {
  const intent = detectAIIntent(input.prompt);

  switch (intent.intent) {
    case "VIDEO": {
      const command = parseVideoCommand(input.prompt);

      const generation = await generateVideo({
        userId: input.userId,
        prompt: command.prompt,
        duration: command.duration,
        aspectRatio: command.aspectRatio,
        model: command.model,
        requestId: input.requestId,
      });

      return {
        intent: "VIDEO",
        handled: true,
        result: generation,
      };
    }

    case "WORKSHEET":
    case "IMAGE":
    case "AUDIO":
    case "DOCUMENT":
    case "QUIZ":
    case "LESSON_PLAN":
      return {
        intent: intent.intent,
        handled: false,
      };

    case "CHAT":
    default:
      return {
        intent: "CHAT",
        handled: false,
      };
  }
}
