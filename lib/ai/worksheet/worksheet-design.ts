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

/**
 * Resolve an incoming worksheet design into a complete,
 * type-safe WorksheetDesign object.
 *
 * Invalid, incomplete, or malformed values fall back
 * to DEFAULT_WORKSHEET_DESIGN values.
 */
export function resolveWorksheetDesign(value: unknown): WorksheetDesign {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_WORKSHEET_DESIGN };
  }

  const input = value as Partial<WorksheetDesign>;

  const isString = (v: unknown): v is string => typeof v === "string";

  const template =
    input.template === "classic" ||
    input.template === "modern" ||
    input.template === "playful" ||
    input.template === "assessment"
      ? input.template
      : DEFAULT_WORKSHEET_DESIGN.template;

  const layoutMode =
    input.layoutMode === "auto" || input.layoutMode === "manual"
      ? input.layoutMode
      : DEFAULT_WORKSHEET_DESIGN.layoutMode;

  const density =
    input.density === "compact" ||
    input.density === "comfortable" ||
    input.density === "spacious"
      ? input.density
      : DEFAULT_WORKSHEET_DESIGN.density;

  const titleStyle =
    input.titleStyle === "boxed" ||
    input.titleStyle === "underline" ||
    input.titleStyle === "plain"
      ? input.titleStyle
      : DEFAULT_WORKSHEET_DESIGN.titleStyle;

  const headerFields =
    input.headerFields === "all" ||
    input.headerFields === "name-date" ||
    input.headerFields === "name-date-score"
      ? input.headerFields
      : DEFAULT_WORKSHEET_DESIGN.headerFields;

  const answerSpace =
    input.answerSpace === "small" ||
    input.answerSpace === "medium" ||
    input.answerSpace === "large"
      ? input.answerSpace
      : DEFAULT_WORKSHEET_DESIGN.answerSpace;

  const questionLayout =
    input.questionLayout === "single" || input.questionLayout === "two-column"
      ? input.questionLayout
      : DEFAULT_WORKSHEET_DESIGN.questionLayout;

  const decorations =
    input.decorations === "none" ||
    input.decorations === "minimal" ||
    input.decorations === "playful"
      ? input.decorations
      : DEFAULT_WORKSHEET_DESIGN.decorations;

  return {
    template,

    layoutMode,

    density,

    titleStyle,

    accentColor:
      isString(input.accentColor) && input.accentColor.trim()
        ? input.accentColor
        : DEFAULT_WORKSHEET_DESIGN.accentColor,

    borderColor:
      isString(input.borderColor) && input.borderColor.trim()
        ? input.borderColor
        : DEFAULT_WORKSHEET_DESIGN.borderColor,

    headerFields,

    answerSpace,

    questionLayout,

    decorations,
  };
}
