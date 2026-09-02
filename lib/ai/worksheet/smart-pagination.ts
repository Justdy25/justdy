import "server-only";

import { chromium, type Browser } from "playwright";

import type { WorksheetDesign } from "./worksheet-design";
import { renderClassicWorksheet } from "./templates/classic";
import { WorksheetDocument } from "./schema";

const LETTER_WIDTH_PX = 816;
const LETTER_HEIGHT_PX = 1056;

const CONTENT_TOP_PX = 0.63 * 96;
const CONTENT_BOTTOM_PX = 10.18 * 96;
const CONTINUATION_HEADER_PX = 34;
const OVERFLOW_TOLERANCE_PX = 2;

const TARGET_FILL = 0.82;
const FINAL_PAGE_MIN_FILL = 0.52;
const LOOKAHEAD_PENALTY = 120;

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

function emptyMetrics(): CandidateMetrics {
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
  if (design.layoutMode === "manual") return [design];

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

  // The first candidate is the preferred professional layout. The remaining
  // candidates are real alternatives, not arbitrary fallbacks.
  add("comfortable", "medium", "single");
  add("compact", "small", "single");
  add("comfortable", "small", "single");
  add("spacious", "medium", "single");
  add("comfortable", "medium", "two-column");
  add("compact", "small", "two-column");

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

function pageFill(used: number, available: number): number {
  if (available <= 0) return 0;
  return Math.max(0, Math.min(1, used / available));
}

/**
 * Build page groups from measured question block heights.
 *
 * The old implementation used the absolute bottom coordinate of the next
 * question. That can incorrectly move a question to the next page merely
 * because the natural-flow document has already passed the first page. Here
 * we measure each real question block and pack those blocks against the actual
 * first-page and continuation-page capacities.
 */
function packMeasuredQuestions(
  questions: Array<{
    index: number;
    top: number;
    height: number;
    marginBottom: number;
  }>,
  firstQuestionTop: number,
): { pages: number[][]; fills: number[]; maxOverflowPx: number } {
  const firstAvailable = Math.max(
    1,
    CONTENT_BOTTOM_PX - Math.max(CONTENT_TOP_PX, firstQuestionTop),
  );
  const continuationAvailable = Math.max(
    1,
    CONTENT_BOTTOM_PX - CONTENT_TOP_PX - CONTINUATION_HEADER_PX,
  );

  const pages: number[][] = [];
  const fills: number[] = [];

  let current: number[] = [];
  let used = 0;
  let capacity = firstAvailable;

  const flush = () => {
    if (!current.length) return;
    pages.push(current);
    fills.push(pageFill(used, capacity));
    current = [];
    used = 0;
    capacity = continuationAvailable;
  };

  for (const question of questions) {
    // getBoundingClientRect excludes margin. Include the actual bottom margin
    // because it is part of the vertical block occupied by the question.
    const blockHeight = Math.max(1, question.height + question.marginBottom);

    if (
      current.length > 0 &&
      used + blockHeight > capacity + OVERFLOW_TOLERANCE_PX
    ) {
      flush();
    }

    current.push(question.index);
    used += blockHeight;
  }

  flush();

  // If a page is extremely sparse and the previous page can donate its last
  // question without overflowing, rebalance once. This avoids ugly endings
  // such as 5 questions on page 1 and 1 tiny question on page 2.
  for (let i = pages.length - 1; i > 0; i -= 1) {
    if (fills[i] >= FINAL_PAGE_MIN_FILL || pages[i - 1].length <= 1) continue;

    const donor = pages[i - 1];
    const recipient = pages[i];
    const candidate = donor[donor.length - 1];
    const measured = questions.find((item) => item.index === candidate);

    if (!measured) continue;

    const blockHeight = measured.height + measured.marginBottom;
    const recipientUsed = fills[i] * continuationAvailable;

    if (
      recipientUsed + blockHeight <=
      continuationAvailable + OVERFLOW_TOLERANCE_PX
    ) {
      donor.pop();
      recipient.unshift(candidate);

      const donorUsed = Math.max(
        0,
        fills[i - 1] * (i - 1 === 0 ? firstAvailable : continuationAvailable) -
          blockHeight,
      );

      fills[i - 1] = pageFill(
        donorUsed,
        i - 1 === 0 ? firstAvailable : continuationAvailable,
      );
      fills[i] = pageFill(recipientUsed + blockHeight, continuationAvailable);
    }
  }

  return {
    pages,
    fills,
    maxOverflowPx: 0,
  };
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
    await page.setContent(html, { waitUntil: "load" });

    await page.evaluate(async () => {
      if ("fonts" in document) await document.fonts.ready;
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
    });

    return await page.evaluate(
      ({ contentTop, contentBottom }) => {
        const elements = Array.from(
          document.querySelectorAll<HTMLElement>(".worksheet-question"),
        );

        if (!elements.length) {
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

        const measured = elements.map((element, index) => {
          const rect = element.getBoundingClientRect();
          const styles = window.getComputedStyle(element);
          const marginBottom = Number.parseFloat(styles.marginBottom) || 0;

          return {
            index,
            top: rect.top,
            height: rect.height,
            marginBottom,
          };
        });

        const firstQuestionTop = measured[0].top;
        const firstAvailable = Math.max(
          1,
          contentBottom - Math.max(contentTop, firstQuestionTop),
        );
        const continuationAvailable = Math.max(
          1,
          contentBottom - contentTop - 34,
        );

        const pages: number[][] = [];
        const fills: number[] = [];
        let current: number[] = [];
        let used = 0;
        let capacity = firstAvailable;

        const flush = () => {
          if (!current.length) return;
          pages.push(current);
          fills.push(Math.max(0, Math.min(1, used / capacity)));
          current = [];
          used = 0;
          capacity = continuationAvailable;
        };

        for (const question of measured) {
          const blockHeight = Math.max(
            1,
            question.height + question.marginBottom,
          );

          if (current.length > 0 && used + blockHeight > capacity + 2) {
            flush();
          }

          current.push(question.index);
          used += blockHeight;
        }

        flush();

        return {
          valid: pages.length > 0,
          pageCount: pages.length,
          pageFillRatios: fills,
          minPageFillRatio: fills.length ? Math.min(...fills) : 0,
          averagePageFillRatio: fills.length
            ? fills.reduce((sum, value) => sum + value, 0) / fills.length
            : 0,
          maxOverflowPx: 0,
          questionPages: pages,
        };
      },
      {
        contentTop: CONTENT_TOP_PX,
        contentBottom: CONTENT_BOTTOM_PX,
      },
    );
  } finally {
    await browser?.close();
  }
}

async function measureQuestionBlocks(html: string): Promise<{
  valid: boolean;
  questions: Array<{
    index: number;
    top: number;
    height: number;
    marginBottom: number;
  }>;
  firstQuestionTop: number;
}> {
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
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(async () => {
      if ("fonts" in document) await document.fonts.ready;
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
    });

    return await page.evaluate(() => {
      const elements = Array.from(
        document.querySelectorAll<HTMLElement>(".worksheet-question"),
      );

      const questions = elements.map((element, index) => {
        const rect = element.getBoundingClientRect();
        const styles = window.getComputedStyle(element);
        return {
          index,
          top: rect.top,
          height: rect.height,
          marginBottom: Number.parseFloat(styles.marginBottom) || 0,
        };
      });

      return {
        valid: questions.length > 0,
        questions,
        firstQuestionTop: questions[0]?.top ?? 0,
      };
    });
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
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(async () => {
      if ("fonts" in document) await document.fonts.ready;
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
    });

    return await page.evaluate(
      ({ contentTop, contentBottom, continuationHeader, tolerance }) => {
        const pages = Array.from(
          document.querySelectorAll<HTMLElement>(".worksheet-page"),
        );

        if (!pages.length)
          return {
            valid: false,
            pageCount: 0,
            pageFillRatios: [],
            minPageFillRatio: 0,
            averagePageFillRatio: 0,
            maxOverflowPx: 0,
            questionPages: [],
          };

        const pageHeight = 1056;
        const fills: number[] = [];
        let maxOverflowPx = 0;
        let valid = true;

        const questionPages = pages.map((pageElement, pageIndex) => {
          const pageRect = pageElement.getBoundingClientRect();
          const questions = Array.from(
            pageElement.querySelectorAll<HTMLElement>(".worksheet-question"),
          );

          if (!questions.length) valid = false;

          let top = Number.POSITIVE_INFINITY;
          let bottom = Number.NEGATIVE_INFINITY;
          let right = Number.NEGATIVE_INFINITY;

          for (const question of questions) {
            const rect = question.getBoundingClientRect();
            top = Math.min(top, rect.top - pageRect.top);
            bottom = Math.max(bottom, rect.bottom - pageRect.top);
            right = Math.max(right, rect.right - pageRect.left);
          }

          const safeTop =
            pageIndex === 0 ? contentTop : contentTop + continuationHeader;
          const safeBottom = contentBottom;
          const usableHeight = safeBottom - safeTop;

          const overflow = Math.max(0, bottom - safeBottom);
          const leftOverflow = Math.max(0, safeTop - top);
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
          fills.push(Math.max(0, Math.min(1, used / usableHeight)));

          return questions.map((question) => {
            const number =
              question
                .querySelector(".worksheet-question-number")
                ?.textContent?.replace(/\D/g, "") ?? "";
            return Math.max(0, Number(number) - 1);
          });
        });

        return {
          valid,
          pageCount: pages.length,
          pageFillRatios: fills,
          minPageFillRatio: fills.length ? Math.min(...fills) : 0,
          averagePageFillRatio: fills.length
            ? fills.reduce((sum, value) => sum + value, 0) / fills.length
            : 0,
          maxOverflowPx,
          questionPages,
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

  // Fill is important, but not at the expense of a professional amount of
  // whitespace. The target is intentionally below 100%.
  score -= Math.abs(metrics.averagePageFillRatio - TARGET_FILL) * 450;
  score += metrics.averagePageFillRatio * 180;
  score += metrics.minPageFillRatio * 180;

  const finalFill = metrics.pageFillRatios.at(-1) ?? 0;
  if (metrics.pageCount > 1 && finalFill < FINAL_PAGE_MIN_FILL) {
    score -= (FINAL_PAGE_MIN_FILL - finalFill) * 700;
  }

  if (design.density === "comfortable") score += 90;
  if (design.density === "spacious") score += 65;
  if (design.density === "compact") score += 25;

  if (design.answerSpace === "medium") score += 55;
  if (design.answerSpace === "large") score += 45;
  if (design.answerSpace === "small") score += 20;

  if (design.questionLayout === "single") score += 20;

  return score;
}

export async function resolveSmartPagination(
  worksheet: WorksheetDocument,
  design: WorksheetDesign,
): Promise<SmartPaginationResult> {
  const candidates = candidateDesigns(design);
  let best: SmartPaginationResult | null = null;

  for (const candidate of candidates) {
    const naturalHtml = renderCandidate(worksheet, candidate);
    const natural = await measureNaturalFlow(naturalHtml);

    if (!natural.valid || natural.questionPages.length === 0) continue;

    const blocks = await measureQuestionBlocks(naturalHtml);
    if (!blocks.valid) continue;

    const packed = packMeasuredQuestions(
      blocks.questions,
      blocks.firstQuestionTop,
    );

    const questionPages = packed.pages.map((indexes) =>
      indexes.map((index) => worksheet.questions[index]).filter(Boolean),
    );

    const explicitHtml = renderCandidate(worksheet, candidate, questionPages);

    const explicitMetrics = await validateExplicitRender(explicitHtml);
    if (!explicitMetrics.valid) continue;

    const metrics: CandidateMetrics = {
      ...explicitMetrics,
      questionPages: packed.pages,
      pageFillRatios: explicitMetrics.pageFillRatios,
      minPageFillRatio: explicitMetrics.minPageFillRatio,
      averagePageFillRatio: explicitMetrics.averagePageFillRatio,
    };

    const score = scoreCandidate(candidate, metrics);
    const bestScore = best
      ? scoreCandidate(best.design, best.metrics)
      : Number.NEGATIVE_INFINITY;

    if (score > bestScore) {
      best = {
        design: candidate,
        metrics,
      };
    }
  }

  return (
    best ?? {
      design,
      metrics: emptyMetrics(),
    }
  );
}

export function buildSmartPaginationPages(
  worksheet: WorksheetDocument,
  result: SmartPaginationResult,
): WorksheetDocument["questions"][] {
  return result.metrics.questionPages.map((indexes) =>
    indexes.map((index) => worksheet.questions[index]).filter(Boolean),
  );
}
