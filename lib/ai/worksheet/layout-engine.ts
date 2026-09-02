import { WorksheetDocument } from "./schema";
import type { WorksheetDesign } from "./worksheet-design";

type WorksheetQuestion = WorksheetDocument["questions"][number];

export type WorksheetLayoutDecision = {
  questionLayout: WorksheetDesign["questionLayout"];
  density: WorksheetDesign["density"];
  answerSpace: WorksheetDesign["answerSpace"];
  pages: WorksheetQuestion[][];
  estimatedPages: number;
  totalEstimatedHeight: number;
};

/*
 * These are logical printable-content capacities, not physical PDF sizes.
 * The previous values were intentionally conservative and caused large
 * unused areas on otherwise simple worksheets.
 *
 * Auto layout now uses a denser target and relies on the render validator
 * as the final safety gate.
 */
const FIRST_PAGE_CAPACITY = 720;
const CONTINUATION_PAGE_CAPACITY = 760;

function estimateWrappedLines(text: string, charsPerLine: number): number {
  return Math.max(1, Math.ceil(text.trim().length / charsPerLine));
}

function getQuestionComplexity(question: WorksheetQuestion): number {
  const text = question.question.trim().length;
  const optionText = (question.options ?? [])
    .map((option) => option.text.trim().length)
    .reduce((sum, value) => sum + value, 0);

  let score = text + optionText;

  switch (question.type) {
    case "open_response":
      score += 260;
      break;
    case "matching":
      score += 120;
      break;
    case "short_answer":
    case "fill_in_blank":
      score += 55;
      break;
    case "true_false":
      score += 20;
      break;
    case "multiple_choice":
      score += 35;
      break;
  }

  return score;
}

function isWritingHeavy(question: WorksheetQuestion): boolean {
  return (
    question.type === "open_response" ||
    question.type === "short_answer" ||
    question.type === "fill_in_blank"
  );
}

function estimateQuestionHeight(
  question: WorksheetQuestion,
  density: WorksheetDesign["density"],
  answerSpace: WorksheetDesign["answerSpace"],
): number {
  const questionLines = estimateWrappedLines(question.question, 78);
  const textHeight = questionLines * 15;

  const densityExtra = {
    compact: 0,
    comfortable: 8,
    spacious: 16,
  }[density];

  const answerExtra = {
    small: 0,
    medium: 8,
    large: 18,
  }[answerSpace];

  let bodyHeight = 0;

  if (question.type === "multiple_choice") {
    const options = question.options ?? [];
    const optionLines = options.map((option) =>
      Math.max(1, Math.ceil(option.text.trim().length / 20)),
    );
    const maxOptionLines = Math.max(1, ...optionLines);
    bodyHeight = 7 + Math.max(19, maxOptionLines * 13);
  } else if (question.type === "true_false") {
    bodyHeight = 30;
  } else if (
    question.type === "short_answer" ||
    question.type === "fill_in_blank"
  ) {
    bodyHeight = 52 + answerExtra;
  } else if (question.type === "matching") {
    bodyHeight = 68 + answerExtra;
  } else if (question.type === "open_response") {
    bodyHeight = 138 + answerExtra * 2;
  }

  return Math.ceil(textHeight + bodyHeight + 22 + densityExtra);
}

function calculateWritingRatio(questions: WorksheetQuestion[]): number {
  if (questions.length === 0) return 0;
  return questions.filter(isWritingHeavy).length / questions.length;
}

function calculateAverageComplexity(questions: WorksheetQuestion[]): number {
  if (questions.length === 0) return 0;
  return (
    questions.reduce(
      (sum, question) => sum + getQuestionComplexity(question),
      0,
    ) / questions.length
  );
}

function chooseQuestionLayout(
  questions: WorksheetQuestion[],
): WorksheetDesign["questionLayout"] {
  const writingRatio = calculateWritingRatio(questions);
  const hasOpenResponse = questions.some(
    (question) => question.type === "open_response",
  );
  const averageComplexity = calculateAverageComplexity(questions);

  if (hasOpenResponse) return "single";
  if (writingRatio >= 0.5) return "single";
  if (averageComplexity >= 220) return "single";
  if (questions.length < 8) return "single";

  return "two-column";
}

function chooseDensity(
  questions: WorksheetQuestion[],
): WorksheetDesign["density"] {
  const writingRatio = calculateWritingRatio(questions);
  const averageComplexity = calculateAverageComplexity(questions);

  if (
    questions.length <= 12 &&
    (writingRatio >= 0.35 || averageComplexity >= 220)
  ) {
    return "spacious";
  }

  if (questions.length >= 24 && writingRatio < 0.2 && averageComplexity < 150) {
    return "compact";
  }

  return "comfortable";
}

function chooseAnswerSpace(
  questions: WorksheetQuestion[],
): WorksheetDesign["answerSpace"] {
  const writingRatio = calculateWritingRatio(questions);
  const hasOpenResponse = questions.some(
    (question) => question.type === "open_response",
  );

  if (hasOpenResponse || writingRatio >= 0.65) return "large";
  if (questions.length >= 24 && writingRatio < 0.2) return "small";

  return "medium";
}

function paginate(
  questions: WorksheetQuestion[],
  design: Pick<WorksheetDesign, "density" | "answerSpace" | "questionLayout">,
): WorksheetQuestion[][] {
  if (questions.length === 0) return [[]];

  /*
   * Two-column pages can fit substantially more content, but we still
   * paginate conservatively. Questions are assigned to the shorter
   * column so one column does not become dramatically taller than the other.
   */
  if (design.questionLayout === "two-column") {
    const pages: WorksheetQuestion[][] = [];
    let current: WorksheetQuestion[] = [];
    let leftHeight = 0;
    let rightHeight = 0;

    const firstCapacity = FIRST_PAGE_CAPACITY;
    const continuationCapacity = CONTINUATION_PAGE_CAPACITY;

    for (const question of questions) {
      const height = estimateQuestionHeight(
        question,
        design.density,
        design.answerSpace,
      );

      const capacity =
        pages.length === 0 ? firstCapacity : continuationCapacity;

      const shorter = Math.min(leftHeight, rightHeight);
      const currentTotal = Math.max(leftHeight, rightHeight);

      if (
        current.length > 0 &&
        (shorter + height > capacity || currentTotal > capacity + 120)
      ) {
        pages.push(current);
        current = [];
        leftHeight = 0;
        rightHeight = 0;
      }

      if (leftHeight <= rightHeight) {
        leftHeight += height;
      } else {
        rightHeight += height;
      }

      current.push(question);
    }

    if (current.length > 0) pages.push(current);
    return pages;
  }

  const pages: WorksheetQuestion[][] = [];
  let current: WorksheetQuestion[] = [];
  let currentHeight = 0;
  let capacity = FIRST_PAGE_CAPACITY;

  for (const question of questions) {
    const height = estimateQuestionHeight(
      question,
      design.density,
      design.answerSpace,
    );

    if (current.length > 0 && currentHeight + height > capacity) {
      pages.push(current);
      current = [];
      currentHeight = 0;
      capacity = CONTINUATION_PAGE_CAPACITY;
    }

    current.push(question);
    currentHeight += height;
  }

  if (current.length > 0) pages.push(current);
  return pages;
}

function estimateTotalHeight(
  questions: WorksheetQuestion[],
  design: Pick<WorksheetDesign, "density" | "answerSpace">,
): number {
  return questions.reduce(
    (sum, question) =>
      sum +
      estimateQuestionHeight(question, design.density, design.answerSpace),
    0,
  );
}

/**
 * Resolves the physical worksheet layout.
 *
 * AUTO:
 *   The engine chooses columns, density and answer space from the actual
 *   question mix and then paginates conservatively.
 *
 * MANUAL:
 *   The user's selected layout values are used exactly. The engine only
 *   calculates the resulting pages; it does not override the choices.
 */
export function calculateWorksheetLayout(
  worksheet: WorksheetDocument,
  design: WorksheetDesign,
): WorksheetLayoutDecision {
  const questions = worksheet.questions ?? [];

  const resolved =
    design.layoutMode === "manual"
      ? {
          questionLayout: design.questionLayout,
          density: design.density,
          answerSpace: design.answerSpace,
        }
      : {
          questionLayout: chooseQuestionLayout(questions),
          density: chooseDensity(questions),
          answerSpace: chooseAnswerSpace(questions),
        };

  const pages = paginate(questions, resolved);

  return {
    ...resolved,
    pages,
    estimatedPages: pages.length,
    totalEstimatedHeight: estimateTotalHeight(questions, resolved),
  };
}
