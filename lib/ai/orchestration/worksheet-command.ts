import "server-only";
import type { WorksheetQuestionType } from "@/lib/ai/worksheet/types";

export type WorksheetDifficulty = "easy" | "medium" | "hard" | "mixed";

export interface WorksheetCommand {
  gradeLevel: string;
  subject: string;
  topic: string;
  title?: string;
  learningObjective?: string;
  questionCount: number;
  difficulty: WorksheetDifficulty;
  questionTypes: WorksheetQuestionType[];
  instructions?: string;
}

function extractQuestionCount(prompt: string): number {
  const match = prompt.match(
    /\b(\d{1,3})\s*(?:questions?|problems?|items?|exercises?)\b/i,
  );

  if (!match) return 10;

  return Math.min(100, Math.max(1, Number(match[1])));
}

function extractGradeLevel(prompt: string): string {
  const match = prompt.match(/\b(?:grade|grader?)\s*(?:level\s*)?(\d{1,2})\b/i);

  if (match) {
    return `Grade ${match[1]}`;
  }

  const ordinalMatch = prompt.match(
    /\b(1st|2nd|3rd|4th|5th|6th|7th|8th|9th|10th|11th|12th)\s+grade\b/i,
  );

  if (ordinalMatch) {
    const number = ordinalMatch[1].replace(/\D/g, "");
    return `Grade ${number}`;
  }

  return "Grade 5";
}

function extractDifficulty(prompt: string): WorksheetDifficulty {
  const lower = prompt.toLowerCase();

  if (/\b(easy|beginner|basic)\b/.test(lower)) {
    return "easy";
  }

  if (/\b(hard|advanced|challenging|difficult)\b/.test(lower)) {
    return "hard";
  }

  if (/\b(mixed|varied|different levels)\b/.test(lower)) {
    return "mixed";
  }

  return "medium";
}

function extractSubject(prompt: string): string {
  const lower = prompt.toLowerCase();

  const subjects: Array<[RegExp, string]> = [
    [/\bmath(?:ematics)?\b/i, "Mathematics"],
    [/\balgebra\b/i, "Mathematics"],
    [/\bgeometry\b/i, "Mathematics"],
    [/\bcalculus\b/i, "Mathematics"],
    [/\bscience\b/i, "Science"],
    [/\bbiology\b/i, "Science"],
    [/\bphysics\b/i, "Science"],
    [/\bchemistry\b/i, "Science"],
    [/\benglish\b/i, "English"],
    [/\bgrammar\b/i, "English"],
    [/\breading\b/i, "English"],
    [/\blanguage arts\b/i, "English Language Arts"],
    [/\bsocial studies\b/i, "Social Studies"],
    [/\bhistory\b/i, "History"],
    [/\bgeography\b/i, "Geography"],
    [/\bcomputer science\b/i, "Computer Science"],
    [/\bcoding\b/i, "Computer Science"],
  ];

  for (const [pattern, subject] of subjects) {
    if (pattern.test(lower)) {
      return subject;
    }
  }

  return "Mathematics";
}

function extractTopic(prompt: string, subject: string): string {
  const patterns = [
    /\bon\s+(.+?)(?:\s+for\s+(?:grade|class)\b|\s+with\s+\d+\s+questions?\b|$)/i,
    /\babout\s+(.+?)(?:\s+for\s+(?:grade|class)\b|\s+with\s+\d+\s+questions?\b|$)/i,
    /\bcovering\s+(.+?)(?:\s+for\s+(?:grade|class)\b|\s+with\s+\d+\s+questions?\b|$)/i,
    /\btopic\s*(?:is|:)\s*(.+?)(?:\s+for\s+(?:grade|class)\b|\s+with\s+\d+\s+questions?\b|$)/i,
  ];

  for (const pattern of patterns) {
    const match = prompt.match(pattern);

    if (match?.[1]) {
      const topic = match[1]
        .replace(/\b(easy|medium|hard|mixed|beginner|advanced)\b/gi, "")
        .replace(/\s+/g, " ")
        .trim();

      if (topic.length >= 2) {
        return topic;
      }
    }
  }

  const subjectPattern = new RegExp(
    `\\b(?:${subject.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})\\s+(?:worksheet|practice)\\s*(?:on|about)?\\s*(.+)$`,
    "i",
  );

  const subjectMatch = prompt.match(subjectPattern);

  if (subjectMatch?.[1]) {
    return subjectMatch[1].trim();
  }

  return "General practice";
}

export function parseWorksheetCommand(prompt: string): WorksheetCommand {
  const text = prompt.trim();

  if (!text) {
    throw new Error("Worksheet prompt cannot be empty.");
  }

  const gradeLevel = extractGradeLevel(text);
  const subject = extractSubject(text);
  const topic = extractTopic(text, subject);
  const questionCount = extractQuestionCount(text);
  const difficulty = extractDifficulty(text);

  return {
    gradeLevel,
    subject,
    topic,
    questionCount,
    difficulty,
    questionTypes: ["multiple_choice", "short_answer"],
    instructions:
      "Solve each question carefully and show your work where appropriate.",
  };
}
