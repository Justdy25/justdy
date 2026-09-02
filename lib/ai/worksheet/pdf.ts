import "server-only";

import { chromium } from "playwright";
import { PDFDocument } from "pdf-lib";

import type { WorksheetDocument } from "./schema";
import type { WorksheetDesign } from "./worksheet-design";

import { renderValidatedWorksheet } from "./validated-render";
import { renderClassicAnswerKey } from "./templates/classic-answer-key";

export type WorksheetPdfType = "worksheet" | "answer-key" | "both";

async function getWorksheetHtml(
  worksheet: WorksheetDocument,
  design?: WorksheetDesign,
): Promise<string> {
  /*
   * IMPORTANT: worksheet PDF generation must use the same validated
   * Smart Pagination pipeline as the preview. Do not call
   * renderClassicWorksheet() directly here, because that bypasses the
   * browser-measured question page groups.
   */
  const validated = await renderValidatedWorksheet(worksheet, design);
  return validated.html;
}

/**
 * The answer-key renderer is intentionally kept separate from the worksheet
 * renderer. Older answer-key markup can contain a print break between its
 * title/header and the answer grid. That produces an otherwise empty page.
 *
 * The answer key should flow naturally from its header into its content, so
 * we normalize print break rules only for this document. This does not touch
 * worksheet pagination.
 */
function getAnswerKeyHtml(worksheet: WorksheetDocument): string {
  return renderClassicAnswerKey(worksheet);
}

async function renderHtmlToPdf(html: string): Promise<Buffer> {
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({
      viewport: { width: 816, height: 1056 },
      deviceScaleFactor: 1,
    });

    await page.setContent(html, { waitUntil: "networkidle" });
    await page.emulateMedia({ media: "print" });

    await page.evaluate(async () => {
      if (document.fonts) {
        await document.fonts.ready;
      }
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
    });

    const pdf = await page.pdf({
      format: "Letter",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

async function mergePdfs(firstPdf: Buffer, secondPdf: Buffer): Promise<Buffer> {
  const mergedPdf = await PDFDocument.create();
  const firstDocument = await PDFDocument.load(firstPdf);
  const secondDocument = await PDFDocument.load(secondPdf);

  const firstPages = await mergedPdf.copyPages(
    firstDocument,
    firstDocument.getPageIndices(),
  );
  for (const page of firstPages) mergedPdf.addPage(page);

  const secondPages = await mergedPdf.copyPages(
    secondDocument,
    secondDocument.getPageIndices(),
  );
  for (const page of secondPages) mergedPdf.addPage(page);

  return Buffer.from(await mergedPdf.save());
}

export async function generateWorksheetPdf({
  worksheet,
  type,
  design,
}: {
  worksheet: WorksheetDocument;
  type: WorksheetPdfType;
  design?: WorksheetDesign;
}): Promise<Buffer> {
  if (type === "worksheet") {
    return renderHtmlToPdf(await getWorksheetHtml(worksheet, design));
  }

  if (type === "answer-key") {
    return renderHtmlToPdf(getAnswerKeyHtml(worksheet));
  }

  const worksheetPdf = await renderHtmlToPdf(
    await getWorksheetHtml(worksheet, design),
  );

  const answerKeyPdf = await renderHtmlToPdf(getAnswerKeyHtml(worksheet));

  return mergePdfs(worksheetPdf, answerKeyPdf);
}
