"use client";

import { useState, type ReactNode, type KeyboardEvent } from "react";
import {
  Check,
  Palette,
  RotateCcw,
  Sparkles,
  WandSparkles,
} from "lucide-react";

import { DesignWorksheet } from "@/app/actions/ai/design-worksheet";
import type { WorksheetQuestionType } from "@/lib/ai/worksheet/types";
import type { WorksheetDesign } from "@/lib/ai/worksheet/worksheet-design";

interface WorksheetDesignPanelProps {
  value: WorksheetDesign;
  onChange: (value: WorksheetDesign) => void;
  onReset: () => void;

  /*
   * These are optional so the panel remains compatible with an older
   * WorksheetStudio while still allowing the AI designer to understand
   * the worksheet it is styling.
   */
  gradeLevel?: string;
  subject?: string;
  topic?: string;
  questionCount?: number;
  difficulty?: "easy" | "medium" | "hard" | "mixed";
  questionTypes?: WorksheetQuestionType[];
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b pb-5 last:border-b-0 last:pb-0">
      <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-lg border bg-background px-2.5 text-xs outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-55"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

const AI_DESIGN_PRESETS = [
  {
    label: "Kindergarten Fun",
    prompt:
      "Create a friendly, playful, age-appropriate classroom worksheet design. Keep text highly readable, use gentle color accents, and avoid decorative clutter.",
  },
  {
    label: "Professional Test",
    prompt:
      "Create a polished assessment-style worksheet suitable for classroom testing. Prioritize clarity, alignment, printability, and efficient use of page space.",
  },
  {
    label: "Playful Learning",
    prompt:
      "Create an engaging educational worksheet with a cheerful visual personality. Keep decorations purposeful and make the questions easy to scan.",
  },
  {
    label: "Minimal & Clean",
    prompt:
      "Create a clean, modern, printer-friendly worksheet with restrained decoration, strong hierarchy, comfortable readability, and efficient page use.",
  },
  {
    label: "Standard Classroom",
    prompt:
      "Create a balanced everyday classroom worksheet: professional, readable, practical to print, and appropriate for the student's grade and question mix.",
  },
] as const;

export default function WorksheetDesignPanel({
  value,
  onChange,
  onReset,
  gradeLevel,
  subject,
  topic,
  questionCount,
  difficulty,
  questionTypes,
}: WorksheetDesignPanelProps) {
  const [prompt, setPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const isAuto = value.layoutMode === "auto";

  function update<K extends keyof WorksheetDesign>(
    key: K,
    next: WorksheetDesign[K],
  ) {
    onChange({
      ...value,
      [key]: next,
    });
  }

  async function handleAiDesign(request = prompt) {
    const text = request.trim();

    if (!text || aiLoading) return;

    setAiLoading(true);
    setAiError(null);

    try {
      const result = await DesignWorksheet({
        current: value,
        prompt: text,
        gradeLevel,
        subject,
        topic,
        questionCount,
        difficulty,
        questionTypes,
      });

      if (!result.success || !result.design) {
        throw new Error(result.error || "Unable to generate the design.");
      }

      onChange(result.design);
      setPrompt("");
    } catch (error) {
      console.error("[WorksheetDesignPanel] AI design error:", error);

      setAiError(
        error instanceof Error
          ? error.message
          : "Unable to generate the design.",
      );
    } finally {
      setAiLoading(false);
    }
  }

  function handlePromptKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void handleAiDesign();
    }
  }

  const contextItems = [
    gradeLevel,
    subject,
    topic,
    questionCount ? `${questionCount} questions` : undefined,
  ].filter(Boolean);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Palette className="h-4 w-4" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold">Design worksheet</h2>
              <span className="rounded-full border bg-primary/5 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary">
                AI
              </span>
            </div>

            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Style the page without changing your questions.
            </p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <div className="space-y-6">
          {contextItems.length > 0 && (
            <div className="rounded-xl border bg-muted/20 p-3.5">
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-background border">
                  <Check className="h-3.5 w-3.5 text-primary" />
                </div>

                <div className="min-w-0">
                  <p className="text-xs font-semibold">
                    AI understands this worksheet
                  </p>

                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {contextItems.map((item) => (
                      <span
                        key={item}
                        className="rounded-full border bg-background px-2 py-0.5 text-[9px] text-muted-foreground"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <Section title="Template">
            <SelectField
              label="Visual style"
              value={value.template}
              onChange={(next) =>
                update("template", next as WorksheetDesign["template"])
              }
              options={[
                {
                  value: "classic",
                  label: "Classic — clean classroom",
                },
                {
                  value: "modern",
                  label: "Modern — polished SaaS",
                },
                {
                  value: "playful",
                  label: "Playful — younger learners",
                },
                {
                  value: "assessment",
                  label: "Assessment — test-ready",
                },
              ]}
            />
          </Section>

          <Section title="Layout">
            <div className="rounded-xl border bg-background p-1">
              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => update("layoutMode", "auto")}
                  className={`rounded-lg px-3 py-2 text-left transition ${
                    isAuto
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "hover:bg-muted"
                  }`}
                >
                  <span className="block text-[11px] font-bold">Automatic</span>
                  <span
                    className={`mt-0.5 block text-[9px] leading-4 ${
                      isAuto
                        ? "text-primary-foreground/75"
                        : "text-muted-foreground"
                    }`}
                  >
                    Fit the worksheet intelligently
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => update("layoutMode", "manual")}
                  className={`rounded-lg px-3 py-2 text-left transition ${
                    !isAuto
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "hover:bg-muted"
                  }`}
                >
                  <span className="block text-[11px] font-bold">Manual</span>
                  <span
                    className={`mt-0.5 block text-[9px] leading-4 ${
                      !isAuto
                        ? "text-primary-foreground/75"
                        : "text-muted-foreground"
                    }`}
                  >
                    Control every layout choice
                  </span>
                </button>
              </div>
            </div>

            {isAuto && (
              <div className="rounded-lg border border-primary/15 bg-primary/[0.035] px-3 py-2.5">
                <p className="text-[10px] leading-4 text-muted-foreground">
                  Justdy AI and the layout engine will consider the question
                  mix, writing requirements, complexity, and available page
                  space before choosing density, columns, and answer space.
                </p>
              </div>
            )}

            <SelectField
              label="Question density"
              value={value.density}
              disabled={isAuto}
              onChange={(next) =>
                update("density", next as WorksheetDesign["density"])
              }
              options={[
                { value: "compact", label: "Compact" },
                { value: "comfortable", label: "Comfortable" },
                { value: "spacious", label: "Spacious" },
              ]}
            />

            <SelectField
              label="Question layout"
              value={value.questionLayout}
              disabled={isAuto}
              onChange={(next) =>
                update(
                  "questionLayout",
                  next as WorksheetDesign["questionLayout"],
                )
              }
              options={[
                { value: "single", label: "Single column" },
                { value: "two-column", label: "Two columns" },
              ]}
            />

            <SelectField
              label="Answer space"
              value={value.answerSpace}
              disabled={isAuto}
              onChange={(next) =>
                update("answerSpace", next as WorksheetDesign["answerSpace"])
              }
              options={[
                { value: "small", label: "Small" },
                { value: "medium", label: "Medium" },
                { value: "large", label: "Large" },
              ]}
            />
          </Section>

          <Section title="Header">
            <SelectField
              label="Title treatment"
              value={value.titleStyle}
              onChange={(next) =>
                update("titleStyle", next as WorksheetDesign["titleStyle"])
              }
              options={[
                { value: "boxed", label: "Designed box" },
                { value: "underline", label: "Underline" },
                { value: "plain", label: "Simple" },
              ]}
            />

            <SelectField
              label="Student fields"
              value={value.headerFields}
              onChange={(next) =>
                update("headerFields", next as WorksheetDesign["headerFields"])
              }
              options={[
                {
                  value: "name-date",
                  label: "Name + Date",
                },
                {
                  value: "name-date-score",
                  label: "Name + Date + Score",
                },
                {
                  value: "all",
                  label: "All available fields",
                },
              ]}
            />
          </Section>

          <Section title="Colors">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold">
                  Accent
                </span>

                <div className="flex h-9 items-center gap-2 rounded-lg border bg-background px-2">
                  <input
                    type="color"
                    value={value.accentColor}
                    onChange={(event) =>
                      update("accentColor", event.target.value)
                    }
                    className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
                  />

                  <span className="truncate text-[10px] font-mono text-muted-foreground">
                    {value.accentColor}
                  </span>
                </div>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold">
                  Border
                </span>

                <div className="flex h-9 items-center gap-2 rounded-lg border bg-background px-2">
                  <input
                    type="color"
                    value={value.borderColor}
                    onChange={(event) =>
                      update("borderColor", event.target.value)
                    }
                    className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
                  />

                  <span className="truncate text-[10px] font-mono text-muted-foreground">
                    {value.borderColor}
                  </span>
                </div>
              </label>
            </div>
          </Section>

          <Section title="Decorations">
            <SelectField
              label="Page decoration"
              value={value.decorations}
              onChange={(next) =>
                update("decorations", next as WorksheetDesign["decorations"])
              }
              options={[
                {
                  value: "none",
                  label: "None — printer friendly",
                },
                {
                  value: "minimal",
                  label: "Minimal",
                },
                {
                  value: "playful",
                  label: "Playful",
                },
              ]}
            />
          </Section>

          <Section title="AI Design Assistant">
            <div className="overflow-hidden rounded-xl border bg-primary/[0.04]">
              <div className="border-b bg-primary/[0.025] p-3.5">
                <div className="flex items-start gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Sparkles className="h-4 w-4" />
                  </div>

                  <div className="min-w-0">
                    <p className="text-xs font-semibold">
                      Describe the look you want
                    </p>

                    <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                      Justdy AI changes the visual design without changing your
                      questions, answers, or content.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-3.5">
                <textarea
                  value={prompt}
                  onChange={(event) => {
                    setPrompt(event.target.value);
                    setAiError(null);
                  }}
                  onKeyDown={handlePromptKeyDown}
                  placeholder="e.g. Make it polished and printer friendly for Grade 5"
                  maxLength={500}
                  rows={3}
                  disabled={aiLoading}
                  className="w-full resize-none rounded-lg border bg-background px-3 py-2.5 text-xs outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-70"
                />

                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-muted-foreground">
                    {prompt.length}/500
                  </span>

                  <span className="hidden text-[10px] text-muted-foreground sm:inline">
                    ⌘/Ctrl + Enter
                  </span>

                  <button
                    type="button"
                    onClick={() => void handleAiDesign()}
                    disabled={!prompt.trim() || aiLoading}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-[11px] font-semibold text-primary-foreground shadow-sm transition hover:-translate-y-0.5 hover:opacity-95 hover:shadow disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {aiLoading ? (
                      <>
                        <RotateCcw className="h-3 w-3 animate-spin" />
                        Designing...
                      </>
                    ) : (
                      <>
                        <WandSparkles className="h-3 w-3" />
                        Apply with AI
                      </>
                    )}
                  </button>
                </div>

                {aiError && (
                  <div className="mt-3 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2">
                    <p className="text-[11px] leading-4 text-destructive">
                      {aiError}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Quick styles
                </span>
                <span className="text-[10px] text-muted-foreground">
                  AI presets
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {AI_DESIGN_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => void handleAiDesign(preset.prompt)}
                    disabled={aiLoading}
                    className="rounded-full border bg-background px-2.5 py-1.5 text-[10px] font-semibold transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </Section>
        </div>
      </div>

      <div className="border-t bg-muted/20 p-4">
        <button
          type="button"
          onClick={onReset}
          disabled={aiLoading}
          className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border bg-background text-xs font-semibold transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset design
        </button>
      </div>
    </div>
  );
}
