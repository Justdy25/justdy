import { evaluate, simplify } from "mathjs";

import type { WorksheetDocument } from "./schema";
import { WorksheetQuestion } from "./types";

type ValidationIssue = {
  questionNumber?: number;
  field?: string;
  message: string;
};

export type WorksheetValidationResult = {
  valid: boolean;
  issues: ValidationIssue[];
  worksheet: WorksheetDocument;
};

/* ============================================================
   NORMALIZATION
============================================================ */

function normalizeAnswer(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[−–—]/g, "-")
    .replace(/,/g, "")
    .replace(/\s+/g, " ");
}

/* ============================================================
   MIXED NUMBER NORMALIZATION
============================================================ */

function normalizeMixedNumber(value: string): string {
  const normalized = normalizeAnswer(value);

  const mixedNumberMatch = normalized.match(/^(-?\d+)\s+(\d+)\s*\/\s*(\d+)$/);

  if (!mixedNumberMatch) {
    return normalized;
  }

  const [, whole, numerator, denominator] = mixedNumberMatch;

  const wholeNumber = Number(whole);

  if (wholeNumber < 0) {
    return `(${wholeNumber}) - (${numerator}/${denominator})`;
  }

  return `${wholeNumber} + (${numerator}/${denominator})`;
}

/* ============================================================
   MATHEMATICAL COMPARISON
============================================================ */

function mathematicallyEqual(first: string, second: string): boolean {
  const a = normalizeMixedNumber(first);
  const b = normalizeMixedNumber(second);

  if (a === b) {
    return true;
  }

  try {
    const firstValue = evaluate(a);
    const secondValue = evaluate(b);

    if (typeof firstValue === "number" && typeof secondValue === "number") {
      return Math.abs(firstValue - secondValue) < 1e-10;
    }

    const simplified = simplify(`${a} - (${b})`);

    return simplified.toString() === "0";
  } catch {
    return false;
  }
}

/* ============================================================
   MULTIPLE CHOICE HELPERS
============================================================ */

const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"] as const;

function normalizeOptionLetter(answer: string): string {
  return answer.trim().toUpperCase().replace(/[.)]/g, "");
}

function isOptionLetter(answer: string): boolean {
  return OPTION_LETTERS.includes(
    normalizeOptionLetter(answer) as (typeof OPTION_LETTERS)[number],
  );
}

/**
 * Resolve the answer supplied by the AI.
 *
 * For multiple-choice questions the AI normally returns:
 *
 *   "A"
 *   "B"
 *   "C"
 *   "D"
 *
 * We convert that to the actual option text.
 */
function getSelectedOptionText(question: WorksheetQuestion): string | null {
  if (question.type !== "multiple_choice" || !question.options) {
    return null;
  }

  const answer = normalizeOptionLetter(question.answer);

  if (!isOptionLetter(answer)) {
    return null;
  }

  const index = OPTION_LETTERS.indexOf(
    answer as (typeof OPTION_LETTERS)[number],
  );

  if (index < 0 || index >= question.options.length) {
    return null;
  }

  return question.options[index]?.text ?? null;
}

/**
 * Determine the actual answer text.
 *
 * For MC:
 *   answer = "B"
 *   → option B text
 *
 * For other question types:
 *   answer = actual answer
 */
function getActualAnswerText(question: WorksheetQuestion): string {
  const selectedOption = getSelectedOptionText(question);

  if (selectedOption !== null) {
    return selectedOption;
  }

  return question.answer;
}

/* ============================================================
   ARITHMETIC EXPRESSION EXTRACTION
============================================================ */

function extractArithmeticExpression(question: string): string | null {
  const match = question.match(
    /(?:compute|solve|calculate|evaluate)\s*:\s*(.+?)(?:\s*\(|$)/i,
  );

  if (!match) {
    return null;
  }

  let expression = match[1].trim();

  expression = expression.replace(/[?]/g, "").replace(/=/g, "").trim();

  /*
   * Convert mixed numbers:
   *
   * 3 1/2 + 2 1/4
   *
   * into:
   *
   * 3 + 1/2 + 2 + 1/4
   */
  expression = expression.replace(/(\d+)\s+(\d+\/\d+)/g, "$1 + $2");

  return expression;
}

/* ============================================================
   QUESTION VALIDATION
============================================================ */

function validateQuestion(
  question: WorksheetQuestion,
  issues: ValidationIssue[],
) {
  /* ----------------------------------------------------------
     BASIC STRUCTURE
  ---------------------------------------------------------- */

  if (question.number <= 0) {
    issues.push({
      questionNumber: question.number,
      field: "number",
      message: "Question number must be positive.",
    });
  }

  if (question.points <= 0) {
    issues.push({
      questionNumber: question.number,
      field: "points",
      message: "Question must have at least one point.",
    });
  }

  /* ----------------------------------------------------------
     MULTIPLE CHOICE
  ---------------------------------------------------------- */

  if (question.type === "multiple_choice") {
    if (!question.options || question.options.length < 2) {
      issues.push({
        questionNumber: question.number,
        field: "options",
        message: "Multiple-choice questions must contain at least two options.",
      });

      return;
    }

    const optionTexts = question.options.map((option) => option.text);

    /* Check duplicate options */

    const normalizedOptions = optionTexts.map((option) =>
      normalizeAnswer(option),
    );

    const uniqueOptions = new Set(normalizedOptions);

    if (uniqueOptions.size !== normalizedOptions.length) {
      issues.push({
        questionNumber: question.number,
        field: "options",
        message: "Multiple-choice options contain duplicates.",
      });
    }

    /* --------------------------------------------------------
       ANSWER MUST BE A VALID OPTION LETTER
    -------------------------------------------------------- */

    if (!isOptionLetter(question.answer)) {
      issues.push({
        questionNumber: question.number,
        field: "answer",
        message: `Multiple-choice answer "${question.answer}" must be an option letter such as A, B, C, or D.`,
      });

      return;
    }

    const selectedOption = getSelectedOptionText(question);

    if (!selectedOption) {
      issues.push({
        questionNumber: question.number,
        field: "answer",
        message: `Answer "${question.answer}" points to an option that does not exist.`,
      });

      return;
    }
  }

  /* ----------------------------------------------------------
     SIMPLE ARITHMETIC VALIDATION
  ---------------------------------------------------------- */

  const expression = extractArithmeticExpression(question.question);

  if (!expression) {
    return;
  }

  try {
    const calculated = evaluate(expression);

    const calculatedString =
      typeof calculated === "number"
        ? String(calculated)
        : calculated.toString();

    /*
     * For multiple choice, compare the calculated answer
     * with the TEXT of the selected option.
     *
     * Example:
     *
     * answer = "B"
     *
     * option B = "5/6"
     *
     * calculated = "0.833333..."
     *
     * Therefore compare:
     *
     * calculated ↔ "5/6"
     */
    const actualAnswer = getActualAnswerText(question);

    if (!mathematicallyEqual(calculatedString, actualAnswer)) {
      issues.push({
        questionNumber: question.number,
        field: "answer",
        message: `Incorrect answer. Calculated "${calculatedString}" but the selected answer is "${actualAnswer}".`,
      });
    }

    /*
     * For multiple-choice questions verify that
     * exactly ONE option is mathematically correct.
     */

    if (question.type === "multiple_choice" && question.options) {
      const correctOptions = question.options.filter((option) =>
        mathematicallyEqual(calculatedString, option.text),
      );

      if (correctOptions.length !== 1) {
        issues.push({
          questionNumber: question.number,
          field: "options",
          message: `Expected exactly one mathematically correct option, but found ${correctOptions.length}.`,
        });
      }

      /*
       * Make sure the AI selected the mathematically
       * correct option.
       */

      const selectedOption = getSelectedOptionText(question);

      if (
        selectedOption &&
        !mathematicallyEqual(calculatedString, selectedOption)
      ) {
        issues.push({
          questionNumber: question.number,
          field: "answer",
          message: `AI selected "${question.answer}", but that option contains "${selectedOption}" instead of the calculated answer "${calculatedString}".`,
        });
      }
    }
  } catch {
    /*
     * Our simple parser does not understand every
     * possible educational question.
     *
     * Do not reject a question simply because the
     * validator cannot safely calculate it.
     */
  }
}

/* ============================================================
   COMPLETE WORKSHEET VALIDATION
============================================================ */

export function validateWorksheet(
  worksheet: WorksheetDocument,
): WorksheetValidationResult {
  const issues: ValidationIssue[] = [];

  /* ----------------------------------------------------------
     QUESTION NUMBERS
  ---------------------------------------------------------- */

  const questionNumbers = worksheet.questions.map(
    (question) => question.number,
  );

  const uniqueNumbers = new Set(questionNumbers);

  if (uniqueNumbers.size !== questionNumbers.length) {
    issues.push({
      field: "questions",
      message: "Worksheet contains duplicate question numbers.",
    });
  }

  /* ----------------------------------------------------------
     QUESTIONS
  ---------------------------------------------------------- */

  for (const question of worksheet.questions) {
    validateQuestion(question, issues);
  }

  /* ----------------------------------------------------------
     TOTAL POINTS
  ---------------------------------------------------------- */

  const calculatedTotalPoints = worksheet.questions.reduce(
    (total, question) => total + question.points,
    0,
  );

  if (worksheet.totalPoints !== calculatedTotalPoints) {
    issues.push({
      field: "totalPoints",
      message: `Total points is ${worksheet.totalPoints}, but the questions total ${calculatedTotalPoints}.`,
    });
  }

  /* ----------------------------------------------------------
     ANSWER KEY
  ---------------------------------------------------------- */

  for (const question of worksheet.questions) {
    const answerKeyEntry = worksheet.answerKey.find(
      (entry) => entry.questionNumber === question.number,
    );

    if (!answerKeyEntry) {
      issues.push({
        questionNumber: question.number,
        field: "answerKey",
        message: "Question is missing from the answer key.",
      });

      continue;
    }

    /*
     * For multiple-choice:
     *
     * question.answer = "B"
     * answerKeyEntry.answer = "B"
     *
     * Compare the letters.
     */

    if (question.type === "multiple_choice") {
      if (
        normalizeOptionLetter(question.answer) !==
        normalizeOptionLetter(answerKeyEntry.answer)
      ) {
        issues.push({
          questionNumber: question.number,
          field: "answerKey",
          message: `Answer key mismatch. Question answer is "${question.answer}" but answer key contains "${answerKeyEntry.answer}".`,
        });
      }
    } else {
      /*
       * For non-MC questions compare the
       * actual answer values.
       */

      if (
        !mathematicallyEqual(question.answer, answerKeyEntry.answer) &&
        normalizeAnswer(question.answer) !==
          normalizeAnswer(answerKeyEntry.answer)
      ) {
        issues.push({
          questionNumber: question.number,
          field: "answerKey",
          message: `Answer key mismatch. Question answer is "${question.answer}" but answer key contains "${answerKeyEntry.answer}".`,
        });
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    worksheet,
  };
}
