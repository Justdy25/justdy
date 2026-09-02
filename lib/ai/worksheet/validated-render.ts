import "server-only";

import type { WorksheetDocument } from "./schema";
import type { WorksheetDesign } from "./worksheet-design";
import { DEFAULT_WORKSHEET_DESIGN } from "./worksheet-design";
import {
  buildSmartPaginationPages,
  resolveSmartPagination,
} from "./smart-pagination";
import { renderClassicWorksheet } from "./templates/classic";
import {
  validateWorksheetRender,
  type WorksheetRenderValidation,
} from "./render-validation";

export type ValidatedWorksheetRender = {
  html: string;
  design: WorksheetDesign;
  validation: WorksheetRenderValidation;
};

export async function renderValidatedWorksheet(
  worksheet: WorksheetDocument,
  design?: WorksheetDesign,
): Promise<ValidatedWorksheetRender> {
  const requested = design ?? DEFAULT_WORKSHEET_DESIGN;

  /*
   * MANUAL MODE:
   * Render exactly what the user selected. Smart pagination is disabled.
   */
  if (requested.layoutMode === "manual") {
    const html = renderClassicWorksheet(worksheet, {
      template: requested.template,
      design: requested,
      showAnswerKey: false,
      showBranding: true,
      showNameField: true,
      showDateField: true,
      showScoreField: true,
      showPageNumbers: true,
    });

    const validation = await validateWorksheetRender(html);

    if (!validation.valid) {
      throw new Error(
        [
          "Unable to produce a print-safe worksheet layout.",
          ...validation.warnings,
          "Manual layout was preserved; reduce density, answer space, or use one column.",
        ].join(" "),
      );
    }

    return {
      html,
      design: requested,
      validation,
    };
  }

  /*
   * AUTO MODE:
   * Chromium measures the actual question positions and chooses the best
   * layout candidate before we perform the final deterministic render.
   */
  const smart = await resolveSmartPagination(worksheet, requested);

  if (!smart.metrics.valid) {
    throw new Error(
      "Automatic worksheet layout could not find a safe browser-measured layout.",
    );
  }

  const questionPages = buildSmartPaginationPages(worksheet, smart);

  const renderDesign: WorksheetDesign = {
    ...smart.design,
    layoutMode: "manual",
  };

  const html = renderClassicWorksheet(worksheet, {
    template: renderDesign.template,
    design: renderDesign,
    questionPages,
    showAnswerKey: false,
    showBranding: true,
    showNameField: true,
    showDateField: true,
    showScoreField: true,
    showPageNumbers: true,
  });

  const validation = await validateWorksheetRender(html);

  if (!validation.valid) {
    throw new Error(
      [
        "Automatic worksheet layout failed final validation.",
        ...validation.warnings,
      ].join(" "),
    );
  }

  /*
   * Preserve AUTO in the returned design so the saved worksheet still knows
   * that the user chose Automatic mode, even though the final render uses the
   * resolved values internally.
   */
  return {
    html,
    design: {
      ...smart.design,
      layoutMode: "auto",
    },
    validation,
  };
}
