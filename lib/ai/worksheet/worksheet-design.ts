export type WorksheetLayoutMode = "auto" | "manual";

export type WorksheetDesign = {
  template: "classic" | "modern" | "playful" | "assessment";
  layoutMode: WorksheetLayoutMode;
  density: "compact" | "comfortable" | "spacious";
  titleStyle: "boxed" | "underline" | "plain";
  accentColor: string;
  borderColor: string;
  headerFields: "all" | "name-date" | "name-date-score";
  answerSpace: "small" | "medium" | "large";
  questionLayout: "single" | "two-column";
  decorations: "none" | "minimal" | "playful";
};

export const DEFAULT_WORKSHEET_DESIGN: WorksheetDesign = {
  template: "classic",
  layoutMode: "auto",
  density: "comfortable",
  titleStyle: "boxed",
  accentColor: "#334155",
  borderColor: "#cbd5e1",
  headerFields: "name-date-score",
  answerSpace: "medium",
  questionLayout: "single",
  decorations: "none",
};
