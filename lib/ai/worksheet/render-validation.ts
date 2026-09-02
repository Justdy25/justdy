import "server-only";

import { chromium, type Browser } from "playwright";

export type WorksheetRenderValidation = {
  valid: boolean;
  pageCount: number;
  overflowPages: number[];
  horizontalOverflowPages: number[];
  emptyPages: number[];
  warnings: string[];
  maxOverflowPx: number;
};

type BrowserPageMetrics = {
  pageCount: number;
  overflowPages: number[];
  horizontalOverflowPages: number[];
  emptyPages: number[];
  maxOverflowPx: number;
};

const OVERFLOW_TOLERANCE_PX = 2;

const LETTER_WIDTH_PX = 816;
const LETTER_HEIGHT_PX = 1056;

/**
 * Render the worksheet HTML in Chromium and validate the
 * resulting logical worksheet pages.
 *
 * IMPORTANT:
 *
 * We intentionally do NOT require .worksheet-page to have an
 * exact width or exact height.
 *
 * The physical PDF dimensions are controlled by:
 *
 *   @page {
 *     size: Letter;
 *     margin: 0;
 *   }
 *
 * while .worksheet-page represents the printable content area
 * inside the Letter page.
 */
export async function validateWorksheetRender(
  html: string,
): Promise<WorksheetRenderValidation> {
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({
      headless: true,
    });

    const page = await browser.newPage({
      viewport: {
        width: LETTER_WIDTH_PX,
        height: LETTER_HEIGHT_PX,
      },
      deviceScaleFactor: 1,
    });

    /*
     * ============================================================
     * LOAD DOCUMENT
     * ============================================================
     */

    await page.setContent(html, {
      waitUntil: "load",
    });

    /*
     * Wait for fonts because font metrics can change line wrapping
     * and therefore affect page overflow.
     */

    await page.evaluate(async () => {
      if ("fonts" in document) {
        await document.fonts.ready;
      }
    });

    /*
     * Allow one browser layout frame to complete.
     */

    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => resolve());
        }),
    );

    /*
     * ============================================================
     * MEASURE RENDERED DOCUMENT
     * ============================================================
     */

    const metrics = await page.evaluate<
      BrowserPageMetrics,
      {
        overflowTolerance: number;
      }
    >(
      ({ overflowTolerance }) => {
        const pageElements = Array.from(
          document.querySelectorAll<HTMLElement>(".worksheet-page"),
        );

        const overflowPages: number[] = [];
        const horizontalOverflowPages: number[] = [];
        const emptyPages: number[] = [];

        let maxOverflowPx = 0;

        /*
         * --------------------------------------------------------
         * INSPECT EACH WORKSHEET PAGE
         * --------------------------------------------------------
         */

        pageElements.forEach((pageElement, index) => {
          const pageNumber = index + 1;

          const pageRect = pageElement.getBoundingClientRect();

          /*
           * ------------------------------------------------------
           * BASIC PAGE VALIDITY
           * ------------------------------------------------------
           */

          if (pageRect.width <= 0 || pageRect.height <= 0) {
            emptyPages.push(pageNumber);
            return;
          }

          /*
           * ------------------------------------------------------
           * FIND MAIN CONTENT
           * ------------------------------------------------------
           */

          const main =
            pageElement.querySelector<HTMLElement>(":scope > main") ??
            pageElement.querySelector<HTMLElement>("main");

          if (!main) {
            emptyPages.push(pageNumber);
            return;
          }

          /*
           * Ignore completely empty main elements.
           */

          const text = main.textContent?.replace(/\s+/g, " ").trim() ?? "";

          const hasVisualContent =
            main.querySelector("img, svg, canvas, table, input, textarea") !==
            null;

          if (!text && !hasVisualContent) {
            emptyPages.push(pageNumber);
            return;
          }

          /*
           * ------------------------------------------------------
           * CONTENT BOUNDS
           * ------------------------------------------------------
           *
           * Inspect the main element and descendants.
           */

          const elements = [
            main,
            ...Array.from(main.querySelectorAll<HTMLElement>("*")),
          ];

          let contentBottom = main.getBoundingClientRect().bottom;

          let contentRight = main.getBoundingClientRect().right;

          for (const element of elements) {
            /*
             * Hidden elements should not participate in
             * overflow validation.
             */

            const style = window.getComputedStyle(element);

            if (style.display === "none" || style.visibility === "hidden") {
              continue;
            }

            const rect = element.getBoundingClientRect();

            if (rect.width === 0 && rect.height === 0) {
              continue;
            }

            contentBottom = Math.max(contentBottom, rect.bottom);

            contentRight = Math.max(contentRight, rect.right);
          }

          /*
           * ------------------------------------------------------
           * VERTICAL OVERFLOW
           * ------------------------------------------------------
           */

          const verticalOverflow = Math.max(0, contentBottom - pageRect.bottom);

          maxOverflowPx = Math.max(maxOverflowPx, verticalOverflow);

          if (verticalOverflow > overflowTolerance) {
            overflowPages.push(pageNumber);
          }

          /*
           * ------------------------------------------------------
           * HORIZONTAL OVERFLOW
           * ------------------------------------------------------
           *
           * Content should remain inside the worksheet page.
           */

          const horizontalOverflow = Math.max(0, contentRight - pageRect.right);

          if (horizontalOverflow > overflowTolerance) {
            horizontalOverflowPages.push(pageNumber);
          }
        });

        return {
          pageCount: pageElements.length,
          overflowPages: Array.from(new Set(overflowPages)),
          horizontalOverflowPages: Array.from(new Set(horizontalOverflowPages)),
          emptyPages: Array.from(new Set(emptyPages)),
          maxOverflowPx,
        };
      },
      {
        overflowTolerance: OVERFLOW_TOLERANCE_PX,
      },
    );

    /*
     * ============================================================
     * BUILD WARNINGS
     * ============================================================
     */

    const warnings: string[] = [];

    if (metrics.pageCount === 0) {
      warnings.push("No worksheet pages were rendered.");
    }

    if (metrics.overflowPages.length > 0) {
      warnings.push(
        `Worksheet content overflows page(s): ${metrics.overflowPages.join(
          ", ",
        )}.`,
      );
    }

    if (metrics.horizontalOverflowPages.length > 0) {
      warnings.push(
        `Worksheet content extends beyond the page width on page(s): ${metrics.horizontalOverflowPages.join(
          ", ",
        )}.`,
      );
    }

    if (metrics.emptyPages.length > 0) {
      warnings.push(
        `Empty worksheet page(s): ${metrics.emptyPages.join(", ")}.`,
      );
    }

    /*
     * ============================================================
     * FINAL RESULT
     * ============================================================
     */

    return {
      ...metrics,

      valid:
        metrics.pageCount > 0 &&
        metrics.overflowPages.length === 0 &&
        metrics.horizontalOverflowPages.length === 0 &&
        metrics.emptyPages.length === 0,

      warnings,
    };
  } finally {
    await browser?.close();
  }
}

/**
 * Strict validation helper.
 */
export async function assertWorksheetRenderIsValid(
  html: string,
): Promise<WorksheetRenderValidation> {
  const result = await validateWorksheetRender(html);

  if (!result.valid) {
    throw new Error(
      ["Worksheet render validation failed.", ...result.warnings].join(" "),
    );
  }

  return result;
}
