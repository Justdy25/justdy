import { z } from "zod";

export const WorksheetQuestionTypeSchema = z.enum([
  "multiple_choice",
  "short_answer",
  "true_false",
  "fill_in_blank",
  "matching",
  "open_response",
]);

export const WorksheetOptionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
});

export const WorksheetQuestionSchema = z.object({
  id: z.string().min(1),

  number: z.number().int().positive(),

  type: WorksheetQuestionTypeSchema,

  question: z.string().min(1),

  options: z.array(WorksheetOptionSchema).nullable(),

  answer: z.string().min(1),

  explanation: z.string().nullable(),

  points: z.number().int().positive(),
});

export const WorksheetAnswerSchema = z.object({
  questionNumber: z.number().int().positive(),

  answer: z.string().min(1),

  explanation: z.string().nullable(),
});

export const WorksheetDocumentSchema = z.object({
  version: z.string().min(1),

  title: z.string().min(1),

  subject: z.string().min(1),

  gradeLevel: z.string().min(1),

  topic: z.string().min(1),

  learningObjective: z.string().min(1),

  instructions: z.string().min(1),

  questions: z.array(WorksheetQuestionSchema).min(1),

  totalPoints: z.number().int().nonnegative(),

  answerKey: z.array(WorksheetAnswerSchema).min(1),
});

export type WorksheetDocument = z.infer<typeof WorksheetDocumentSchema>;
