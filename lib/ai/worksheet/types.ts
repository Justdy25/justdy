export const WORKSHEET_VERSION = "1.0";

export type WorksheetQuestionType =
  | "multiple_choice"
  | "short_answer"
  | "true_false"
  | "fill_in_blank"
  | "matching"
  | "open_response";

export type WorksheetDifficulty = "easy" | "medium" | "hard" | "mixed";

export interface WorksheetOption {
  id: string;
  text: string;
}

export interface WorksheetQuestion {
  id: string;
  number: number;
  type: WorksheetQuestionType;
  question: string;
  options: WorksheetOption[] | null;
  answer: string;
  explanation: string | null;
  points: number;
}

export interface WorksheetAnswer {
  questionNumber: number;
  answer: string;
  explanation?: string;
}

export interface WorksheetDocument {
  version: string;
  title: string;
  subject: string;
  gradeLevel: string;
  topic: string;
  learningObjective: string;
  instructions: string;
  questions: WorksheetQuestion[];
  totalPoints: number;
  answerKey: WorksheetAnswer[];
}
