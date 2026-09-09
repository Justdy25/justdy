import type { Prisma } from "@/lib/generated/prisma/client";

export type ProjectContext = {
  instructions: string;
  audience: string;
  gradeLevel: string;
  subject: string;
  preferences: string;
};

export const EMPTY_PROJECT_CONTEXT: ProjectContext = {
  instructions: "",
  audience: "",
  gradeLevel: "",
  subject: "",
  preferences: "",
};

function readString(
  source: Record<string, unknown>,
  key: keyof ProjectContext,
  maxLength: number,
): string {
  const value = source[key];

  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function normalizeProjectContext(value: unknown): ProjectContext {
  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  return {
    instructions: readString(source, "instructions", 4000),
    audience: readString(source, "audience", 500),
    gradeLevel: readString(source, "gradeLevel", 200),
    subject: readString(source, "subject", 200),
    preferences: readString(source, "preferences", 2000),
  };
}

export function buildProjectContextMessage(project: {
  name: string;
  type: string;
  context: Prisma.JsonValue | ProjectContext | null;
}): string {
  const context = normalizeProjectContext(project.context);

  const lines = [
    "PROJECT CONTEXT",
    `Project: ${project.name}`,
    `Project type: ${project.type}`,
  ];

  if (context.instructions) {
    lines.push(`Instructions: ${context.instructions}`);
  }

  if (context.audience) {
    lines.push(`Audience: ${context.audience}`);
  }

  if (context.gradeLevel) {
    lines.push(`Grade level: ${context.gradeLevel}`);
  }

  if (context.subject) {
    lines.push(`Subject: ${context.subject}`);
  }

  if (context.preferences) {
    lines.push(`Preferences: ${context.preferences}`);
  }

  lines.push(
    "Use this project context as standing guidance for the current generation. " +
      "Do not treat the project context itself as the user's request.",
  );

  return lines.join("\n");
}

export function buildProjectAwarePrompt({
  project,
  prompt,
}: {
  project: {
    name: string;
    type: string;
    context: Prisma.JsonValue | ProjectContext | null;
  };
  prompt: string;
}): string {
  const normalizedPrompt = prompt.trim();

  if (!normalizedPrompt) {
    return buildProjectContextMessage(project);
  }

  const contextMessage = buildProjectContextMessage(project);

  return [contextMessage, "", "CURRENT USER REQUEST", normalizedPrompt].join(
    "\n",
  );
}
