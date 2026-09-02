import type { WorksheetDocument } from "./schema";

export type WorksheetCountValidation = {
  valid: boolean;
  expected: number;
  actual: number;
  message?: string;
};

/**
 * Hard guard for AI worksheet generation.
 * The UI request is authoritative: a worksheet must contain exactly the
 * requested number of questions.
 */
export function validateWorksheetQuestionCount(
  worksheet: WorksheetDocument,
  expectedCount: number,
): WorksheetCountValidation {
  const expected = Math.max(1, Math.floor(expectedCount));
  const actual = worksheet.questions.length;

  if (actual === expected) {
    return { valid: true, expected, actual };
  }

  return {
    valid: false,
    expected,
    actual,
    message:
      `The AI returned ${actual} question${actual === 1 ? "" : "s"}, ` +
      `but exactly ${expected} question${expected === 1 ? " was" : "s were"} requested. ` +
      "Please regenerate the worksheet.",
  };
}

/**
 * Use immediately after the worksheet has passed schema validation.
 */
export function assertWorksheetQuestionCount(
  worksheet: WorksheetDocument,
  expectedCount: number,
): void {
  const result = validateWorksheetQuestionCount(worksheet, expectedCount);

  if (!result.valid) {
    throw new Error(result.message);
  }
}
