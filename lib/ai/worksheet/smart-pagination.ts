import "server-only";

import { chromium, type Browser } from "playwright";

import type { WorksheetDesign } from "./worksheet-design";
import { renderClassicWorksheet } from "./templates/classic";
import { WorksheetDocument } from "./schema";

const LETTER_WIDTH_PX = 816;
const LETTER_HEIGHT_PX = 1056;

// The worksheet content starts after the page's top padding and must stay
// clear of the fixed footer near the bottom of the Letter page.
const CONTENT_TOP_PX = 0.63 * 96;
const CONTENT_BOTTOM_PX = 10.18 * 96;
const CONTINUATION_HEADER_PX = 34;
const OVERFLOW_TOLERANCE_PX = 2;

type CandidateMetrics = {
  valid: boolean;
  pageCount: number;
  pageFillRatios: number[];
  minPageFillRatio: number;
  averagePageFillRatio: number;
  maxOverflowPx: number;
  questionPages: number[][];
};

export type SmartPaginationResult = {
  design: WorksheetDesign;
  metrics: CandidateMetrics;
};

function resolvedCandidate(
  design: WorksheetDesign,
  density: WorksheetDesign["density"],
  answerSpace: WorksheetDesign["answerSpace"],
  questionLayout: WorksheetDesign["questionLayout"],
): WorksheetDesign {
  return {
    ...design,
    layoutMode: "manual",
    density,
    answerSpace,
    questionLayout,
  };
}

function candidateDesigns(design: WorksheetDesign): WorksheetDesign[] {
  if (design.layoutMode === "manual") {
    return [design];
  }

  const candidates: WorksheetDesign[] = [];

  const add = (
    density: WorksheetDesign["density"],
    answerSpace: WorksheetDesign["answerSpace"],
    questionLayout: WorksheetDesign["questionLayout"],
  ) => {
    const candidate = resolvedCandidate(
      design,
      density,
      answerSpace,
      questionLayout,
    );

    const key = JSON.stringify(candidate);

    if (!candidates.some((item) => JSON.stringify(item) === key)) {
      candidates.push(candidate);
    }
  };

  // Professional default first. Alternatives are tested against the actual
  // Chromium layout rather than a hand-written height estimate.
  add("comfortable", "medium", "single");
  add("comfortable", "medium", "two-column");
  add("compact", "small", "single");
  add("compact", "small", "two-column");
  add("spacious", "medium", "single");

  return candidates;
}

function renderCandidate(
  worksheet: WorksheetDocument,
  design: WorksheetDesign,
  questionPages?: WorksheetDocument["questions"][],
): string {
  return renderClassicWorksheet(worksheet, {
    template: design.template,
    design,
    questionPages,
    showAnswerKey: false,
    showBranding: true,
    showNameField: true,
    showDateField: true,
    showScoreField: true,
    showPageNumbers: true,
  });
}

async function measureNaturalFlow(html: string): Promise<CandidateMetrics> {
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({ headless: true });

    const page = await browser.newPage({
      viewport: {
        width: LETTER_WIDTH_PX,
        height: LETTER_HEIGHT_PX,
      },
      deviceScaleFactor: 1,
    });

    await page.emulateMedia({ media: "print" });

    await page.setContent(html, {
      waitUntil: "load",
    });

    await page.evaluate(async () => {
      if ("fonts" in document) {
        await document.fonts.ready;
      }

      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
    });

    return await page.evaluate(
      ({ contentTop, contentBottom, overflowTolerance }) => {
        const questions = Array.from(
          document.querySelectorAll<HTMLElement>(".worksheet-question"),
        );

        if (questions.length === 0) {
          return {
            valid: false,
            pageCount: 0,
            pageFillRatios: [],
            minPageFillRatio: 0,
            averagePageFillRatio: 0,
            maxOverflowPx: 0,
            questionPages: [],
          };
        }

        const pageHeight = 1056;
        const usableHeight = contentBottom - contentTop;

        /*
         * The browser gives us the real height of every question. We then
         * perform a deterministic greedy page packing pass using that actual
         * height. No question is allowed to cross the safe footer boundary.
         */
        const questionRects = questions.map((element, index) => {
          const rect = element.getBoundingClientRect();
          return {
            index,
            top: rect.top,
            bottom: rect.bottom,
          };
        });

        const questionPages: number[][] = [];
        let currentPage: number[] = [];
        let currentPageIndex = 0;
        let currentSafeBottom = contentBottom;

        for (const question of questionRects) {
          const wouldOverflow =
            currentPage.length > 0 &&
            question.bottom > currentSafeBottom + overflowTolerance;

          if (wouldOverflow) {
            questionPages.push(currentPage);
            currentPage = [];
            currentPageIndex += 1;
            currentSafeBottom = currentPageIndex * pageHeight + contentBottom;
          }

          currentPage.push(question.index);
        }

        if (currentPage.length > 0) {
          questionPages.push(currentPage);
        }

        /*
         * Calculate actual fill for each resulting page. For page 1, the
         * title/student/directions consume space before the first question,
         * so measure from the first question's real top. For continuation
         * pages, the continuation header is accounted for by the same DOM
         * positions when the final explicit render is validated.
         */
        const pageFillRatios = questionPages.map((indexes, pageIndex) => {
          const pageTop = pageIndex * pageHeight;
          const safeTop = pageTop + contentTop;
          const safeBottom = pageTop + contentBottom;

          const group = indexes.map((index) => questionRects[index]);
          const bottom = Math.max(...group.map((item) => item.bottom));
          const used = Math.max(0, Math.min(bottom, safeBottom) - safeTop);

          return Math.min(1, used / usableHeight);
        });

        /*
         * A candidate is valid if every question can be assigned to a page
         * without crossing the safe footer boundary. A single question that
         * is taller than a whole page remains invalid and will fall through
         * to the normal validation/error path.
         */
        let maxOverflowPx = 0;
        let valid = true;

        for (
          let pageIndex = 0;
          pageIndex < questionPages.length;
          pageIndex += 1
        ) {
          const safeBottom = pageIndex * pageHeight + contentBottom;

          const group = questionPages[pageIndex].map(
            (index) => questionRects[index],
          );

          const bottom = Math.max(...group.map((item) => item.bottom));
          const overflow = Math.max(0, bottom - safeBottom);

          maxOverflowPx = Math.max(maxOverflowPx, overflow);

          if (overflow > overflowTolerance) {
            valid = false;
          }
        }

        const averagePageFillRatio =
          pageFillRatios.length > 0
            ? pageFillRatios.reduce((sum, value) => sum + value, 0) /
              pageFillRatios.length
            : 0;

        return {
          valid,
          pageCount: questionPages.length,
          pageFillRatios,
          minPageFillRatio:
            pageFillRatios.length > 0 ? Math.min(...pageFillRatios) : 0,
          averagePageFillRatio,
          maxOverflowPx,
          questionPages,
        };
      },
      {
        contentTop: CONTENT_TOP_PX,
        contentBottom: CONTENT_BOTTOM_PX,
        overflowTolerance: OVERFLOW_TOLERANCE_PX,
      },
    );
  } finally {
    await browser?.close();
  }
}

async function validateExplicitRender(html: string): Promise<CandidateMetrics> {
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({ headless: true });

    const page = await browser.newPage({
      viewport: {
        width: LETTER_WIDTH_PX,
        height: LETTER_HEIGHT_PX,
      },
      deviceScaleFactor: 1,
    });

    await page.emulateMedia({ media: "print" });

    await page.setContent(html, {
      waitUntil: "load",
    });

    await page.evaluate(async () => {
      if ("fonts" in document) {
        await document.fonts.ready;
      }

      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
    });

    return await page.evaluate(
      ({ contentTop, contentBottom, continuationHeader, tolerance }) => {
        const pages = Array.from(
          document.querySelectorAll<HTMLElement>(".worksheet-page"),
        );

        const usableFirst = contentBottom - contentTop;
        const usableContinuation =
          contentBottom - contentTop - continuationHeader;
        const pageFillRatios: number[] = [];
        let maxOverflowPx = 0;
        let valid = pages.length > 0;

        for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
          const pageElement = pages[pageIndex];
          const pageRect = pageElement.getBoundingClientRect();
          const questions = Array.from(
            pageElement.querySelectorAll<HTMLElement>(".worksheet-question"),
          );

          if (questions.length === 0) {
            valid = false;
            continue;
          }

          const safeTop =
            pageIndex === 0 ? contentTop : contentTop + continuationHeader;
          const safeBottom = contentBottom;
          const usableHeight =
            pageIndex === 0 ? usableFirst : usableContinuation;

          let top = Number.POSITIVE_INFINITY;
          let bottom = Number.NEGATIVE_INFINITY;
          let right = Number.NEGATIVE_INFINITY;

          for (const question of questions) {
            const rect = question.getBoundingClientRect();
            top = Math.min(top, rect.top - pageRect.top);
            bottom = Math.max(bottom, rect.bottom - pageRect.top);
            right = Math.max(right, rect.right - pageRect.left);
          }

          const overflow = Math.max(0, bottom - safeBottom);

          const leftOverflow = Math.max(0, -top + safeTop);

          const widthOverflow = Math.max(
            0,
            right - (pageRect.width - 0.62 * 96),
          );

          maxOverflowPx = Math.max(
            maxOverflowPx,
            overflow,
            leftOverflow,
            widthOverflow,
          );

          if (
            overflow > tolerance ||
            leftOverflow > tolerance ||
            widthOverflow > tolerance
          ) {
            valid = false;
          }

          const used = Math.max(0, Math.min(bottom, safeBottom) - safeTop);

          pageFillRatios.push(Math.min(1, used / usableHeight));
        }

        const averagePageFillRatio =
          pageFillRatios.length > 0
            ? pageFillRatios.reduce((sum, value) => sum + value, 0) /
              pageFillRatios.length
            : 0;

        return {
          valid,
          pageCount: pages.length,
          pageFillRatios,
          minPageFillRatio:
            pageFillRatios.length > 0 ? Math.min(...pageFillRatios) : 0,
          averagePageFillRatio,
          maxOverflowPx,
          questionPages: pages.map((pageElement) =>
            Array.from(
              pageElement.querySelectorAll<HTMLElement>(".worksheet-question"),
            ).map((question) => {
              const number =
                question
                  .querySelector(".worksheet-question-number")
                  ?.textContent?.replace(/\\D/g, "") ?? "";
              return Math.max(0, Number(number) - 1);
            }),
          ),
        };
      },
      {
        contentTop: CONTENT_TOP_PX,
        contentBottom: CONTENT_BOTTOM_PX,
        continuationHeader: CONTINUATION_HEADER_PX,
        tolerance: OVERFLOW_TOLERANCE_PX,
      },
    );
  } finally {
    await browser?.close();
  }
}

function scoreCandidate(
  design: WorksheetDesign,
  metrics: CandidateMetrics,
): number {
  if (!metrics.valid) return Number.NEGATIVE_INFINITY;

  let score = -metrics.pageCount * 10000;
  score += metrics.averagePageFillRatio * 250;
  score += metrics.minPageFillRatio * 100;

  // Prefer comfortable professional spacing when page count is equal.
  if (design.density === "comfortable") score += 90;
  if (design.density === "spacious") score += 70;
  if (design.density === "compact") score += 20;

  if (design.answerSpace === "medium") score += 55;
  if (design.answerSpace === "large") score += 45;
  if (design.answerSpace === "small") score += 15;

  // Single column is the readability tie-breaker. Two-column can still win
  // whenever it genuinely reduces pages or improves utilization.
  if (design.questionLayout === "single") score += 15;

  return score;
}

function pagesToQuestions(
  worksheet: WorksheetDocument,
  pageIndexes: number[][],
): WorksheetDocument["questions"][] {
  return pageIndexes.map((indexes) =>
    indexes.map((index) => worksheet.questions[index]).filter(Boolean),
  );
}

/**
 * Smart Auto Pagination:
 *
 * 1. Render each reasonable layout candidate in Chromium.
 * 2. Measure the real DOM positions of every question.
 * 3. Determine the actual page boundary from those positions.
 * 4. Re-render using explicit question page groups.
 *
 * This removes the old hand-written question-height estimate from the final
 * pagination decision.
 */
export async function resolveSmartPagination(
  worksheet: WorksheetDocument,
  design: WorksheetDesign,
): Promise<SmartPaginationResult> {
  const candidates = candidateDesigns(design);

  let best: SmartPaginationResult | null = null;

  for (const candidate of candidates) {
    const naturalHtml = renderCandidate(worksheet, candidate);
    const metrics = await measureNaturalFlow(naturalHtml);

    if (!metrics.valid || metrics.questionPages.length === 0) {
      continue;
    }

    const questionPages = pagesToQuestions(worksheet, metrics.questionPages);

    const explicitHtml = renderCandidate(worksheet, candidate, questionPages);

    const explicitMetrics = await validateExplicitRender(explicitHtml);

    if (!explicitMetrics.valid) {
      continue;
    }

    const finalMetrics: CandidateMetrics = {
      ...explicitMetrics,
      questionPages: metrics.questionPages,
    };

    const score = scoreCandidate(candidate, finalMetrics);
    const bestScore = best
      ? scoreCandidate(best.design, best.metrics)
      : Number.NEGATIVE_INFINITY;

    if (score > bestScore) {
      best = {
        design: candidate,
        metrics: finalMetrics,
      };
    }
  }

  if (best) {
    return best;
  }

  return {
    design,
    metrics: {
      valid: false,
      pageCount: 0,
      pageFillRatios: [],
      minPageFillRatio: 0,
      averagePageFillRatio: 0,
      maxOverflowPx: 0,
      questionPages: [],
    },
  };
}

/**
 * Convert the measured result into explicit page groups for the final
 * renderer. This second render is what makes pagination deterministic in the
 * exported PDF instead of relying on accidental browser page flow.
 */
export function buildSmartPaginationPages(
  worksheet: WorksheetDocument,
  result: SmartPaginationResult,
): WorksheetDocument["questions"][] {
  return pagesToQuestions(worksheet, result.metrics.questionPages);
}
