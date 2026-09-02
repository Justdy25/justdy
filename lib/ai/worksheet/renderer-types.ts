import type { WorksheetDocument } from "./schema";
import type { WorksheetDesign } from "./worksheet-design";

export interface WorksheetRenderOptions {
  template: "classic" | "modern" | "playful" | "assessment";
  showAnswerKey: boolean;
  showBranding: boolean;
  showNameField: boolean;
  showDateField: boolean;
  showScoreField: boolean;
  showPageNumbers: boolean;
  design?: WorksheetDesign;
  /** Optional explicit question page groups used by advanced renderers. */
  questionPages?: WorksheetDocument["questions"][];
}
