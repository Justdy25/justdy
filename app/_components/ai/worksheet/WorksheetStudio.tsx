"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { GetWorksheet } from "@/app/actions/ai/get-worksheet";
import { CreateWorksheet } from "@/app/actions/ai/create-worksheet";
import { SaveWorksheet } from "@/app/actions/ai/save-worksheet";

import WorksheetEditor from "./WorksheetEditor";
import WorksheetPdfPreview from "./WorksheetPdfPreview";

import {
  ArrowLeft,
  Check,
  ChevronDown,
  Download,
  FileKey2,
  FileText,
  Loader2,
  Save,
  Settings2,
  Sparkles,
  WandSparkles,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import type { WorksheetQuestionType } from "@/lib/ai/worksheet/types";
import type { WorksheetDocument } from "@/lib/ai/worksheet/schema";
import {
  DEFAULT_WORKSHEET_DESIGN,
  type WorksheetDesign,
} from "@/lib/ai/worksheet/worksheet-design";

interface WorksheetStudioProps {
  subjects: {
    id: string;
    name: string;
  }[];
}

const LETTER_WIDTH_PX = 816;
const LETTER_HEIGHT_PX = 1056;

const design: WorksheetDesign = DEFAULT_WORKSHEET_DESIGN;

const QUESTION_TYPE_OPTIONS: {
  value: WorksheetQuestionType;
  label: string;
  description: string;
}[] = [
  {
    value: "multiple_choice",
    label: "Multiple Choice",
    description: "Select one correct answer.",
  },
  {
    value: "short_answer",
    label: "Short Answer",
    description: "Write a concise answer.",
  },
  {
    value: "true_false",
    label: "True / False",
    description: "Decide whether the statement is true or false.",
  },
  {
    value: "fill_in_blank",
    label: "Fill in the Blank",
    description: "Complete the missing word or value.",
  },
  {
    value: "matching",
    label: "Matching",
    description: "Match related items together.",
  },
  {
    value: "open_response",
    label: "Open Response",
    description: "Explain your thinking in your own words.",
  },
];

function FieldLabel({
  label,
  optional = false,
  children,
}: {
  label: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1 text-xs font-semibold">
        {label}
        {optional && (
          <span className="font-normal text-muted-foreground">(optional)</span>
        )}
      </label>
      {children}
    </div>
  );
}

export default function WorksheetStudio({ subjects }: WorksheetStudioProps) {
  /*
   * ============================================================
   * ROUTING
   * ============================================================
   */

  const searchParams = useSearchParams();
  const router = useRouter();

  const requestedProjectId = searchParams.get("projectId")?.trim() || null;

  /*
   * ============================================================
   * FORM STATE
   * ============================================================
   */

  const [gradeLevel, setGradeLevel] = useState("Grade 5");

  const [subject, setSubject] = useState(subjects[0]?.name || "Mathematics");

  const [topic, setTopic] = useState("");

  const [title, setTitle] = useState("");

  const [learningObjective, setLearningObjective] = useState("");

  const [questionCount, setQuestionCount] = useState(10);

  const [difficulty, setDifficulty] = useState<
    "easy" | "medium" | "hard" | "mixed"
  >("medium");

  /*
   * ============================================================
   * QUESTION TYPES
   * ============================================================
   */

  const [questionTypes, setQuestionTypes] = useState<WorksheetQuestionType[]>([
    "multiple_choice",
    "short_answer",
  ]);

  /*
   * ============================================================
   * WORKSHEET STATE
   * ============================================================
   */

  const [worksheet, setWorksheet] = useState<WorksheetDocument | null>(null);

  const [projectId, setProjectId] = useState<string | null>(null);

  const [generationId, setGenerationId] = useState<string | null>(null);

  /*
   * ============================================================
   * GENERATION
   * ============================================================
   */

  const [generating, setGenerating] = useState(false);

  /*
   * ============================================================
   * SAVED WORKSHEET LOADING
   * ============================================================
   */

  const [loadingWorksheet, setLoadingWorksheet] = useState(false);

  const [loadError, setLoadError] = useState<string | null>(null);

  /*
   * ============================================================
   * GENERAL ERRORS
   * ============================================================
   */

  const [error, setError] = useState<string | null>(null);

  /*
   * ============================================================
   * EDITING / SAVING
   * ============================================================
   */

  const [editing, setEditing] = useState(false);

  const [isDirty, setIsDirty] = useState(false);

  const [isSaving, setIsSaving] = useState(false);

  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const [saveError, setSaveError] = useState<string | null>(null);

  /*
   * ============================================================
   * DOWNLOADING
   * ============================================================
   */

  const [downloading, setDownloading] = useState<
    "worksheet" | "answer-key" | "both" | null
  >(null);

  /*
   * ============================================================
   * PREVIEW
   * ============================================================
   */

  const previewContainerRef = useRef<HTMLDivElement | null>(null);

  const [previewScale, setPreviewScale] = useState(1);
  const [manualZoom, setManualZoom] = useState<number | null>(null);

  /*
   * ============================================================
   * REQUEST TRACKING
   * ============================================================
   */

  const loadingProjectRef = useRef<string | null>(null);

  /*
   * ============================================================
   * TOGGLE QUESTION TYPE
   * ============================================================
   */

  function toggleQuestionType(type: WorksheetQuestionType) {
    setQuestionTypes((current) => {
      if (current.includes(type)) {
        if (current.length === 1) {
          return current;
        }

        return current.filter((item) => item !== type);
      }

      return [...current, type];
    });
  }

  /*
   * ============================================================
   * WORKSHEET CHANGE
   * ============================================================
   */

  function handleWorksheetChange(nextWorksheet: WorksheetDocument) {
    setWorksheet(nextWorksheet);

    setIsDirty(true);

    setSaveError(null);
  }

  /*
   * ============================================================
   * LOAD SAVED WORKSHEET
   * ============================================================
   */

  useEffect(() => {
    /*
     * If there is no projectId, this is the normal
     * "create new worksheet" mode.
     *
     * IMPORTANT:
     *
     * Do NOT call setState() synchronously here.
     * React 19 flags that as a cascading render.
     */

    if (!requestedProjectId) {
      loadingProjectRef.current = null;

      return;
    }

    const currentProjectId = requestedProjectId;

    loadingProjectRef.current = currentProjectId;

    let cancelled = false;

    async function loadWorksheet() {
      /*
       * State updates happen inside the asynchronous
       * operation rather than synchronously at the
       * beginning of the effect.
       */

      setLoadingWorksheet(true);

      setLoadError(null);

      setError(null);

      console.log("[WorksheetStudio] Loading project:", currentProjectId);

      try {
        /*
         * ======================================================
         * LOAD FROM SERVER
         * ======================================================
         */

        const result = await GetWorksheet(currentProjectId);

        console.log("[WorksheetStudio] GetWorksheet result:", result);

        if (cancelled) {
          return;
        }

        /*
         * Make sure this response still belongs
         * to the current project.
         */

        if (loadingProjectRef.current !== currentProjectId) {
          console.log(
            "[WorksheetStudio] Ignoring stale response:",
            currentProjectId,
          );

          return;
        }

        /*
         * ======================================================
         * ERROR
         * ======================================================
         */

        if (!result.success) {
          console.error(
            "[WorksheetStudio] Unable to load worksheet:",
            result.error,
          );

          setLoadError(result.error || "Unable to load worksheet.");

          return;
        }

        /*
         * ======================================================
         * RESTORE WORKSHEET
         * ======================================================
         */

        setWorksheet(result.worksheet);

        setProjectId(result.projectId);

        setGenerationId(result.generationId);

        /*
         * ======================================================
         * RESTORE FORM SETTINGS
         * ======================================================
         */

        setGradeLevel(result.worksheet.gradeLevel);

        setSubject(result.worksheet.subject);

        setTopic(result.worksheet.topic);

        setTitle(result.worksheet.title);

        setLearningObjective(result.worksheet.learningObjective);

        setQuestionCount(result.worksheet.questions.length);

        /*
         * ======================================================
         * RESTORE QUESTION TYPES
         * ======================================================
         */

        const loadedQuestionTypes = Array.from(
          new Set(result.worksheet.questions.map((question) => question.type)),
        );

        if (loadedQuestionTypes.length > 0) {
          setQuestionTypes(loadedQuestionTypes);
        }

        /*
         * ======================================================
         * RESTORE SAVE STATE
         * ======================================================
         */

        setIsDirty(false);

        setSavedAt(new Date(result.savedAt));

        setSaveError(null);

        setError(null);

        setEditing(false);

        console.log(
          "[WorksheetStudio] Worksheet loaded successfully:",
          result.worksheet.title,
        );
      } catch (loadErrorValue) {
        if (cancelled) {
          return;
        }

        if (loadingProjectRef.current !== currentProjectId) {
          return;
        }

        console.error(
          "[WorksheetStudio] Load worksheet error:",
          loadErrorValue,
        );

        setLoadError(
          loadErrorValue instanceof Error
            ? loadErrorValue.message
            : "Unable to load worksheet.",
        );
      } finally {
        if (!cancelled && loadingProjectRef.current === currentProjectId) {
          setLoadingWorksheet(false);
        }
      }
    }

    loadWorksheet();

    return () => {
      cancelled = true;
    };
  }, [requestedProjectId]);

  /*
   * ============================================================
   * SAVE WORKSHEET
   * ============================================================
   */

  async function handleSaveWorksheet() {
    if (!worksheet || !isDirty) {
      return;
    }

    setIsSaving(true);

    setSaveError(null);

    try {
      const result = await SaveWorksheet({
        worksheet,

        projectId,

        generationId,
      });

      if (!result.success) {
        setSaveError(result.error);

        return;
      }

      setProjectId(result.projectId);

      setGenerationId(result.generationId);

      setIsDirty(false);

      setSavedAt(new Date(result.savedAt));
    } catch (err) {
      console.error("Save worksheet error:", err);

      setSaveError(
        err instanceof Error ? err.message : "Unable to save worksheet.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  /*
   * ============================================================
   * GENERATE WORKSHEET
   * ============================================================
   */

  async function handleGenerate() {
    setError(null);

    setLoadError(null);

    if (!topic.trim()) {
      setError("Please enter a topic.");

      return;
    }

    if (questionTypes.length === 0) {
      setError("Please select at least one question type.");

      return;
    }

    setGenerating(true);

    try {
      const result = await Promise.race([
        CreateWorksheet({
          gradeLevel,

          subject,

          topic,

          title: title.trim() || undefined,

          learningObjective: learningObjective.trim() || undefined,

          questionCount,

          difficulty,

          questionTypes,

          instructions:
            "Solve each question carefully and show your work where appropriate.",
        }),

        new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(
              new Error(
                "Worksheet generation is taking too long. Please try again.",
              ),
            );
          }, 120000);
        }),
      ]);

      if (!result.success) {
        setError(result.error);

        return;
      }

      /*
       * ========================================================
       * RESTORE GENERATED WORKSHEET
       * ========================================================
       */

      setWorksheet(result.worksheet);

      setProjectId(null);

      setGenerationId(null);

      setIsDirty(true);

      setSavedAt(null);

      setSaveError(null);

      setLoadError(null);

      /*
       * If we were viewing a saved worksheet,
       * return to the clean create route.
       */

      if (requestedProjectId) {
        router.replace("/manage/ai/worksheet");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setGenerating(false);
    }
  }

  /*
   * ============================================================
   * DOWNLOAD PDF
   * ============================================================
   */

  async function downloadPdf(type: "worksheet" | "answer-key" | "both") {
    if (!worksheet) {
      return;
    }

    setError(null);

    setDownloading(type);

    try {
      const response = await fetch("/api/ai/worksheet/pdf", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          worksheet,
          type,
          design,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);

        throw new Error(data?.error || "Unable to generate PDF.");
      }

      const blob = await response.blob();

      const url = window.URL.createObjectURL(blob);

      const anchor = document.createElement("a");

      anchor.href = url;

      const filename =
        type === "answer-key"
          ? "answer-key.pdf"
          : type === "both"
            ? "worksheet-and-answer-key.pdf"
            : "worksheet.pdf";

      anchor.download = filename;

      document.body.appendChild(anchor);

      anchor.click();

      anchor.remove();

      window.URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "Unable to download PDF.",
      );
    } finally {
      setDownloading(null);
    }
  }

  /*
   * ============================================================
   * LIVE PDF PREVIEW
   * ============================================================
   * The preview uses the exact server-side PDF renderer.
   */
  /*
   * ============================================================
   * BEFORE UNLOAD
   * ============================================================
   */

  useEffect(() => {
    if (!isDirty) {
      return;
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();

      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDirty]);

  /*
   * ============================================================
   * LOADING SCREEN
   * ============================================================
   */

  if (loadingWorksheet) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 px-6">
        <div className="flex flex-col items-center text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />

          <h2 className="mt-4 text-lg font-semibold">Loading worksheet...</h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Restoring your saved worksheet.
          </p>

          {requestedProjectId && (
            <p className="mt-3 max-w-sm break-all text-[11px] text-muted-foreground/70">
              Project: {requestedProjectId}
            </p>
          )}
        </div>
      </div>
    );
  }

  /*
   * ============================================================
   * LOAD ERROR
   * ============================================================
   */

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 px-6">
        <div className="w-full max-w-md rounded-xl border bg-background p-6 text-center shadow-sm">
          <FileText className="mx-auto h-10 w-10 text-destructive" />

          <h2 className="mt-4 text-lg font-semibold">
            Unable to load worksheet
          </h2>

          <p className="mt-2 text-sm text-muted-foreground">{loadError}</p>

          {requestedProjectId && (
            <div className="mt-4 rounded-lg bg-muted p-3 text-left">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Project ID
              </div>

              <div className="mt-1 break-all font-mono text-xs">
                {requestedProjectId}
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-center gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg border px-4 py-2 text-sm font-semibold transition hover:bg-muted"
            >
              Try Again
            </button>

            <button
              type="button"
              onClick={() => router.push("/manage/ai/worksheet")}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              My Worksheets
            </button>
          </div>
        </div>
      </div>
    );
  }

  /*
   * ============================================================
   * MAIN UI
   * ============================================================
   */

  return (
    <div className="flex min-h-screen flex-col bg-[#f7f8fb] dark:bg-background">
      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex w-full max-w-[1500px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => router.push("/manage/ai/worksheet")}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-background transition hover:bg-muted"
              aria-label="Back to My Worksheets"
              title="My Worksheets"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>

            <div className="hidden h-6 w-px bg-border sm:block" />

            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="truncate text-sm font-bold sm:text-base">
                    Worksheet Studio
                  </h1>
                  <span className="hidden rounded-full border bg-muted/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:inline-flex">
                    Justdy AI
                  </span>
                </div>
                <p className="hidden truncate text-xs text-muted-foreground sm:block">
                  Build, edit, preview, and export classroom-ready worksheets.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => router.push("/manage/ai/worksheet")}
            className="inline-flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-xs font-semibold shadow-sm transition hover:bg-muted sm:text-sm"
          >
            <FileText className="h-4 w-4" />
            <span>My Worksheets</span>
          </button>
        </div>
      </div>

      {/* ======================================================
          MAIN STUDIO WORKSPACE
      ====================================================== */}
      <div className="mx-auto flex w-full max-w-[1600px] flex-1 min-h-0 flex-col px-3 pb-3 pt-3 sm:px-5 sm:pb-5 sm:pt-4">
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[350px_minmax(0,1fr)]">
          {/* ====================================================
              LEFT CREATION SIDEBAR
          ==================================================== */}
          <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border bg-background shadow-sm">
            <div className="border-b px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <WandSparkles className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold">Create worksheet</h2>
                  <p className="text-[11px] text-muted-foreground">
                    Tell AI what you want to teach.
                  </p>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <div className="space-y-6">
                {/* CONTENT */}
                <section>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-muted text-[10px] font-bold">
                      1
                    </span>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Content
                    </h3>
                  </div>

                  <div className="space-y-3">
                    <FieldLabel label="Grade Level">
                      <select
                        value={gradeLevel}
                        onChange={(event) => setGradeLevel(event.target.value)}
                        className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                      >
                        {Array.from({ length: 12 }, (_, index) => (
                          <option key={index + 1}>Grade {index + 1}</option>
                        ))}
                      </select>
                    </FieldLabel>

                    <FieldLabel label="Subject">
                      <select
                        value={subject}
                        onChange={(event) => setSubject(event.target.value)}
                        className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                      >
                        {subjects.map((item) => (
                          <option key={item.id} value={item.name}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </FieldLabel>

                    <FieldLabel label="Topic">
                      <input
                        value={topic}
                        onChange={(event) => setTopic(event.target.value)}
                        placeholder="e.g. Adding Fractions"
                        className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/15"
                      />
                    </FieldLabel>

                    <FieldLabel label="Worksheet Title" optional>
                      <input
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        placeholder="Optional"
                        className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/15"
                      />
                    </FieldLabel>

                    <FieldLabel label="Learning Objective" optional>
                      <textarea
                        value={learningObjective}
                        onChange={(event) =>
                          setLearningObjective(event.target.value)
                        }
                        placeholder="What should students learn or practice?"
                        rows={3}
                        className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/15"
                      />
                    </FieldLabel>
                  </div>
                </section>

                <div className="h-px bg-border" />

                {/* QUESTION SETTINGS */}
                <section>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-muted text-[10px] font-bold">
                      2
                    </span>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Questions
                    </h3>
                  </div>

                  <div className="space-y-4">
                    <FieldLabel label="Number of Questions">
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={1}
                          max={30}
                          value={Math.min(questionCount, 30)}
                          onChange={(event) =>
                            setQuestionCount(Number(event.target.value))
                          }
                          className="min-w-0 flex-1 accent-primary"
                        />
                        <div className="flex h-9 w-12 items-center justify-center rounded-lg border bg-muted/30 text-sm font-bold tabular-nums">
                          {questionCount}
                        </div>
                      </div>
                    </FieldLabel>

                    <FieldLabel label="Difficulty">
                      <div className="grid grid-cols-4 gap-1 rounded-lg border bg-muted/30 p-1">
                        {(["easy", "medium", "hard", "mixed"] as const).map(
                          (value) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => setDifficulty(value)}
                              className={`rounded-md px-1.5 py-1.5 text-[11px] font-semibold capitalize transition ${
                                difficulty === value
                                  ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                                  : "text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              {value}
                            </button>
                          ),
                        )}
                      </div>
                    </FieldLabel>

                    <FieldLabel label="Question Types">
                      <div className="grid grid-cols-2 gap-2">
                        {QUESTION_TYPE_OPTIONS.map((option) => {
                          const selected = questionTypes.includes(option.value);
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => toggleQuestionType(option.value)}
                              className={`rounded-lg border px-2.5 py-2 text-left transition ${
                                selected
                                  ? "border-primary bg-primary/5 text-primary ring-1 ring-primary/20"
                                  : "bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[9px] font-bold ${
                                    selected
                                      ? "border-primary bg-primary text-primary-foreground"
                                      : "border-muted-foreground/30"
                                  }`}
                                >
                                  {selected ? "✓" : ""}
                                </span>
                                <span className="truncate text-[11px] font-semibold">
                                  {option.label}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        {questionTypes.length}{" "}
                        {questionTypes.length === 1 ? "type" : "types"} selected
                      </p>
                    </FieldLabel>
                  </div>
                </section>

                {/* ERRORS */}
                {(error || saveError) && (
                  <div className="rounded-xl border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">
                    {error || saveError}
                  </div>
                )}

                {/* GENERATE */}
                <button
                  type="button"
                  disabled={generating || questionTypes.length === 0}
                  onClick={handleGenerate}
                  className="group flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-sm font-bold text-primary-foreground shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {generating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating worksheet...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 transition group-hover:rotate-12" />
                      Generate Worksheet
                    </>
                  )}
                </button>

                {generating && (
                  <div className="rounded-xl border bg-muted/30 p-3 text-center">
                    <p className="text-[11px] font-medium text-muted-foreground">
                      AI is writing questions, checking answers, and preparing
                      your worksheet.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </aside>

          {/* ====================================================
              CENTRAL CANVAS
          ==================================================== */}
          <section className="flex min-h-[720px] min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border bg-background shadow-sm">
            {worksheet ? (
              <div className="flex min-h-0 flex-1 flex-col">
                {/* CANVAS TOOLBAR */}
                <div className="flex min-h-[68px] flex-wrap items-center justify-between gap-3 border-b bg-background px-4 py-3 sm:px-5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="truncate text-sm font-bold">
                          {worksheet.title || "Untitled Worksheet"}
                        </h2>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span>{worksheet.questions.length} questions</span>
                          <span>•</span>
                          {isDirty ? (
                            <span className="font-medium text-amber-600">
                              Unsaved changes
                            </span>
                          ) : (
                            <span className="font-medium text-emerald-600">
                              Saved
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleSaveWorksheet}
                      disabled={!isDirty || isSaving || downloading !== null}
                      className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-2 text-xs font-semibold shadow-sm transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isSaving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save className="h-3.5 w-3.5" />
                      )}
                      {isSaving ? "Saving..." : isDirty ? "Save" : "Saved"}
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditing(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-2 text-xs font-semibold shadow-sm transition hover:bg-muted"
                    >
                      <Settings2 className="h-3.5 w-3.5" />
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() => downloadPdf("worksheet")}
                      disabled={downloading !== null}
                      className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-2 text-xs font-semibold shadow-sm transition hover:bg-muted disabled:opacity-50"
                    >
                      {downloading === "worksheet" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="h-3.5 w-3.5" />
                      )}
                      PDF
                    </button>

                    <button
                      type="button"
                      onClick={() => downloadPdf("answer-key")}
                      disabled={downloading !== null}
                      className="hidden items-center gap-1.5 rounded-lg border bg-background px-3 py-2 text-xs font-semibold shadow-sm transition hover:bg-muted disabled:opacity-50 sm:inline-flex"
                    >
                      <FileKey2 className="h-3.5 w-3.5" />
                      Key
                    </button>

                    <button
                      type="button"
                      onClick={() => downloadPdf("both")}
                      disabled={downloading !== null}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition hover:-translate-y-0.5 hover:opacity-95 disabled:opacity-50"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Export
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                {/* CANVAS */}
                <div
                  ref={previewContainerRef}
                  className="relative min-h-0 flex-1 overflow-hidden bg-[#e9ebef] dark:bg-slate-950/80"
                >
                  <WorksheetPdfPreview
                    worksheet={worksheet}
                    design={design}
                    containerRef={previewContainerRef}
                    manualZoom={manualZoom}
                    onFitZoom={setPreviewScale}
                    onZoomChange={setManualZoom}
                  />

                  {/* FLOATING ZOOM */}
                  <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center">
                    <div className="pointer-events-auto flex items-center gap-1 rounded-xl border bg-background/95 p-1 shadow-lg backdrop-blur">
                      <button
                        type="button"
                        onClick={() =>
                          setManualZoom((current) =>
                            Math.max(0.5, (current ?? previewScale) - 0.1),
                          )
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-muted"
                        aria-label="Zoom out"
                        title="Zoom out"
                      >
                        <ZoomOut className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setManualZoom(0.75)}
                        className="min-w-14 rounded-lg px-2 py-1.5 text-xs font-bold tabular-nums transition hover:bg-muted"
                        aria-label="Set zoom to 75%"
                        title="Set zoom to 75%"
                      >
                        {Math.round((manualZoom ?? previewScale) * 100)}%
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setManualZoom((current) =>
                            Math.min(1, (current ?? previewScale) + 0.1),
                          )
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-muted"
                        aria-label="Zoom in"
                        title="Zoom in"
                      >
                        <ZoomIn className="h-4 w-4" />
                      </button>

                      <div className="mx-1 h-5 w-px bg-border" />

                      <button
                        type="button"
                        onClick={() => setManualZoom(null)}
                        className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
                      >
                        Fit
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[720px] flex-1 items-center justify-center bg-gradient-to-b from-background to-muted/20 p-10 text-center">
                <div className="max-w-md">
                  <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border bg-primary/5 text-primary shadow-sm">
                    <WandSparkles className="h-7 w-7" />
                  </div>
                  <h2 className="text-xl font-bold tracking-tight">
                    Your worksheet canvas
                  </h2>
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                    Configure your worksheet on the left, then let Justdy AI
                    create a polished classroom-ready resource.
                  </p>
                  <div className="mx-auto mt-6 flex max-w-sm flex-wrap justify-center gap-2 text-[11px] text-muted-foreground">
                    <span className="rounded-full border bg-background px-3 py-1.5">
                      AI-generated questions
                    </span>
                    <span className="rounded-full border bg-background px-3 py-1.5">
                      Answer key
                    </span>
                    <span className="rounded-full border bg-background px-3 py-1.5">
                      PDF export
                    </span>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* ======================================================
          EDITOR
      ====================================================== */}

      {worksheet && editing && (
        <WorksheetEditor
          worksheet={worksheet}
          design={design}
          onChange={handleWorksheetChange}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}
