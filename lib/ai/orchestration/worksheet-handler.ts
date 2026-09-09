import "server-only";

import { getOwnedProjectContext } from "@/lib/ai/project-context-server";
import { generateWorksheet } from "@/lib/ai/worksheet/generator";

import { parseWorksheetCommand } from "./worksheet-command";

export interface WorksheetChatGenerationInput {
  userId: string;
  prompt: string;
  projectId?: string | null;
}

export async function generateWorksheetFromChat({
  userId,
  prompt,
  projectId,
}: WorksheetChatGenerationInput) {
  const command = parseWorksheetCommand(prompt);
  const project = await getOwnedProjectContext(userId, projectId);

  const worksheet = await generateWorksheet({
    prompt,

    gradeLevel: command.gradeLevel,
    subject: command.subject,
    topic: command.topic,
    title: command.title,
    learningObjective: command.learningObjective,
    questionCount: command.questionCount,
    difficulty: command.difficulty,
    questionTypes: command.questionTypes,
    instructions: command.instructions,

    projectContext: project?.context ?? null,
  });

  return {
    worksheet,
    command,
  };
}
