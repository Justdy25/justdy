import type { WorksheetDocument } from "./schema";

import { renderClassicWorksheet } from "./templates/classic";

import type {
  WorksheetRenderOptions,
  RenderedWorksheet,
} from "./renderer-types";

export function renderWorksheet(
  worksheet: WorksheetDocument,
  options?: Partial<WorksheetRenderOptions>,
): RenderedWorksheet {
  const resolvedOptions: WorksheetRenderOptions = {
    template: "classic",

    showAnswerKey: true,

    showBranding: true,

    showNameField: true,

    showDateField: true,

    showScoreField: true,

    showPageNumbers: true,

    ...options,
  };

  let html: string;

  switch (resolvedOptions.template) {
    case "classic":
      html = renderClassicWorksheet(worksheet, resolvedOptions);
      break;

    default:
      html = renderClassicWorksheet(worksheet, resolvedOptions);
  }

  return {
    html,

    worksheet,

    options: resolvedOptions,
  };
}
