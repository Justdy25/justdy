import "server-only";

import { generateWorksheet } from "@/lib/ai/worksheet/generator";
import { generateVideo } from "@/lib/ai/video/generator";

import { parseWorksheetCommand } from "./worksheet-command";
import { parseVideoCommand } from "./video-command";

import type { AIIntent, OrchestratorContext } from "./types";

export interface OrchestrationHandlerInput extends OrchestratorContext {
  prompt: string;
  requestId: string;
}

export async function handleAIIntent(
  intent: AIIntent,
  input: OrchestrationHandlerInput,
) {
  switch (intent) {
    case "VIDEO": {
      const command = parseVideoCommand(input.prompt);

      return generateVideo({
        userId: input.userId,
        prompt: command.prompt,
        duration: command.duration,
        aspectRatio: command.aspectRatio,
        model: command.model,
        requestId: input.requestId,
        projectId: input.projectId ?? null,
      });
    }

    case "WORKSHEET": {
      const command = parseWorksheetCommand(input.prompt);

      return generateWorksheet({
        gradeLevel: command.gradeLevel,
        subject: command.subject,
        topic: command.topic,
        title: command.title,
        learningObjective: command.learningObjective,
        questionCount: command.questionCount,
        difficulty: command.difficulty,
        questionTypes: command.questionTypes,
        instructions: command.instructions,
      });
    }

    case "CHAT":
      return null;

    case "IMAGE":
    case "AUDIO":
    case "DOCUMENT":
    case "QUIZ":
    case "LESSON_PLAN":
      return null;

    default:
      return null;
  }
}
