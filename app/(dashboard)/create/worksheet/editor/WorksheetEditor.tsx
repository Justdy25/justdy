"use client";

import {
  ArrowLeft,
  Check,
  Download,
  FileText,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { WorksheetDocument } from "@/lib/ai/worksheet/schema";

interface WorksheetResponse {
  generationId: string;
  worksheet: WorksheetDocument;
  updatedAt: string;
  createdAt: string;
}

interface WorksheetEditorProps {
  generationId: string;
}

export default function WorksheetEditor({
  generationId,
}: WorksheetEditorProps) {
  const router = useRouter();

  const [worksheet, setWorksheet] = useState<WorksheetDocument | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState<
    "worksheet" | "answer-key" | null
  >(null);

  const [saved, setSaved] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadWorksheet() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/ai/worksheet/${encodeURIComponent(generationId)}`,
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          },
        );

        const data = (await response.json()) as
          | WorksheetResponse
          | { error?: string };

        if (!response.ok) {
          throw new Error(
            "error" in data && data.error
              ? data.error
              : "Unable to load worksheet.",
          );
        }

        if (cancelled) {
          return;
        }

        const result = data as WorksheetResponse;

        setWorksheet(result.worksheet);
        setUpdatedAt(result.updatedAt);
        setSaved(true);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Unable to load worksheet.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadWorksheet();

    return () => {
      cancelled = true;
    };
  }, [generationId]);

  const totalPoints = useMemo(() => {
    if (!worksheet) return 0;

    return worksheet.questions.reduce(
      (total, question) => total + (question.points ?? 0),
      0,
    );
  }, [worksheet]);

  function updateWorksheet(
    updater: (current: WorksheetDocument) => WorksheetDocument,
  ) {
    setWorksheet((current) => {
      if (!current) return current;

      setSaved(false);

      return updater(current);
    });
  }

  function updateQuestion(
    questionIndex: number,
    updater: (
      question: WorksheetDocument["questions"][number],
    ) => WorksheetDocument["questions"][number],
  ) {
    updateWorksheet((current) => ({
      ...current,
      questions: current.questions.map((question, index) =>
        index === questionIndex ? updater(question) : question,
      ),
    }));
  }

  function updateQuestionText(questionIndex: number, value: string) {
    updateQuestion(questionIndex, (question) => ({
      ...question,
      question: value,
    }));
  }

  function updateQuestionPoints(questionIndex: number, value: string) {
    const points = Math.max(0, Number(value) || 0);

    updateQuestion(questionIndex, (question) => ({
      ...question,
      points,
    }));
  }

  function addQuestion() {
    if (!worksheet) return;

    const nextNumber = worksheet.questions.length + 1;

    const question = {
      number: nextNumber,
      type: "short_answer",
      question: "Enter your question here.",
      answer: "",
      explanation: "",
      points: 1,
    } as WorksheetDocument["questions"][0];

    updateWorksheet((current) => ({
      ...current,
      questions: [...current.questions, question],
      answerKey: [
        ...current.answerKey,
        {
          questionNumber: nextNumber,
          answer: "",
          explanation: null,
        },
      ],
      totalPoints: totalPoints + 1,
    }));
  }

  function deleteQuestion(index: number) {
    updateWorksheet((current) => {
      const questions = current.questions
        .filter((_, questionIndex) => questionIndex !== index)
        .map((question, questionIndex) => ({
          ...question,
          number: questionIndex + 1,
        }));

      const answerKey = questions.map((question) => ({
        questionNumber: question.number,
        answer: question.answer,
        explanation: question.explanation ?? null,
      }));

      return {
        ...current,
        questions,
        answerKey,
        totalPoints: questions.reduce(
          (total, question) => total + (question.points ?? 0),
          0,
        ),
      };
    });
  }

  async function saveWorksheet() {
    if (!worksheet || !updatedAt || saving) return;

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/ai/worksheet/${encodeURIComponent(generationId)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          cache: "no-store",
          body: JSON.stringify({
            worksheet,
            updatedAt,
          }),
        },
      );

      const data = (await response.json()) as
        | WorksheetResponse
        | { error?: string; code?: string };

      if (!response.ok) {
        throw new Error(
          "error" in data && data.error
            ? data.error
            : "Unable to save worksheet.",
        );
      }

      const result = data as WorksheetResponse;

      setWorksheet(result.worksheet);
      setUpdatedAt(result.updatedAt);
      setSaved(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save worksheet.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function downloadWorksheet(type: "worksheet" | "answer-key") {
    if (!worksheet || downloading) return;

    setDownloading(type);
    setError(null);

    try {
      /*
       * Always save the latest edits first.
       */
      if (!saved) {
        await saveWorksheet();
      }

      const response = await fetch("/api/ai/worksheet/pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({
          worksheet,
          type,
        }),
      });

      if (!response.ok) {
        let message = "Unable to download worksheet.";

        try {
          const data = (await response.json()) as {
            error?: string;
          };

          if (data.error) {
            message = data.error;
          }
        } catch {
          // Ignore non-JSON error responses.
        }

        throw new Error(message);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      const safeTitle =
        worksheet.title
          .replace(/[^a-zA-Z0-9-_ ]/g, "")
          .trim()
          .replace(/\s+/g, "-") || "worksheet";

      const anchor = document.createElement("a");

      anchor.href = objectUrl;
      anchor.download =
        type === "answer-key"
          ? `${safeTitle}-answer-key.pdf`
          : `${safeTitle}.pdf`;

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      window.setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
      }, 1000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to download worksheet.",
      );
    } finally {
      setDownloading(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading worksheet…
        </div>
      </div>
    );
  }

  if (!worksheet) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-6">
        <div className="max-w-md rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm">
          <p className="font-semibold text-slate-950">
            Unable to open worksheet
          </p>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            {error ?? "The worksheet could not be loaded."}
          </p>

          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="mt-5 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white"
          >
            Back to AI
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-slate-100">
      {/* ========================================================
          TOP BAR
      ======================================================== */}

      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-950"
              aria-label="Back to AI"
              title="Back to AI"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>

            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <FileText className="h-4 w-4" />
              </div>

              <div className="min-w-0">
                <input
                  value={worksheet.title}
                  onChange={(event) =>
                    updateWorksheet((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  className="w-full min-w-0 max-w-[420px] truncate border-0 bg-transparent p-0 text-sm font-semibold text-slate-950 outline-none"
                  aria-label="Worksheet title"
                />

                <p className="text-[11px] text-slate-400">
                  {saved ? "Saved" : "Unsaved changes"}
                </p>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => void downloadWorksheet("answer-key")}
              disabled={downloading !== null}
              className="hidden h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 sm:inline-flex"
            >
              {downloading === "answer-key" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              Answer key
            </button>

            <button
              type="button"
              onClick={() => void downloadWorksheet("worksheet")}
              disabled={downloading !== null}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              {downloading === "worksheet" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              Download
            </button>

            <button
              type="button"
              onClick={() => void saveWorksheet()}
              disabled={saving || saved}
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-slate-950 px-3 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : saved ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}

              {saving ? "Saving…" : saved ? "Saved" : "Save"}
            </button>
          </div>
        </div>
      </header>

      {/* ========================================================
          ERROR
      ======================================================== */}

      {error && (
        <div className="mx-auto mt-4 w-full max-w-[1400px] px-4 sm:px-6">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span>{error}</span>

            <button
              type="button"
              onClick={() => setError(null)}
              className="text-xs font-medium hover:underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          EDITOR
      ======================================================== */}

      <main className="mx-auto grid w-full max-w-[1400px] flex-1 grid-cols-1 gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_330px]">
        {/* --------------------------------------------------------
            DOCUMENT
        -------------------------------------------------------- */}

        <section className="min-w-0">
          <div className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="p-6 sm:p-8 lg:p-10">
              {/* Worksheet header */}

              <div className="border-b border-slate-200 pb-7">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Name
                    </span>

                    <div className="mt-2 border-b border-slate-300 pb-2" />
                  </div>

                  <div>
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Date
                    </span>

                    <div className="mt-2 border-b border-slate-300 pb-2" />
                  </div>

                  <div>
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Score
                    </span>

                    <div className="mt-2 border-b border-slate-300 pb-2" />
                  </div>
                </div>

                <input
                  value={worksheet.title}
                  onChange={(event) =>
                    updateWorksheet((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  className="mt-8 w-full border-0 bg-transparent text-center text-2xl font-bold tracking-tight text-slate-950 outline-none sm:text-3xl"
                  aria-label="Worksheet title"
                />

                <p className="mt-2 text-center text-sm text-slate-500">
                  {worksheet.subject} · {worksheet.gradeLevel}
                </p>

                {worksheet.learningObjective && (
                  <input
                    value={worksheet.learningObjective}
                    onChange={(event) =>
                      updateWorksheet((current) => ({
                        ...current,
                        learningObjective: event.target.value,
                      }))
                    }
                    className="mx-auto mt-4 block w-full max-w-2xl border-0 bg-transparent text-center text-xs text-slate-400 outline-none"
                    aria-label="Learning objective"
                  />
                )}
              </div>

              {/* Questions */}

              <div className="mt-8 space-y-7">
                {worksheet.questions.map((question, index) => (
                  <article
                    key={`${question.number}-${index}`}
                    className="group rounded-xl border border-transparent p-3 transition hover:border-slate-200 hover:bg-slate-50/50"
                  >
                    <div className="flex gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-xs font-semibold text-white">
                        {index + 1}
                      </span>

                      <div className="min-w-0 flex-1">
                        <textarea
                          value={question.question}
                          onChange={(event) =>
                            updateQuestionText(index, event.target.value)
                          }
                          rows={2}
                          className="w-full resize-none border-0 bg-transparent p-0 text-sm font-medium leading-6 text-slate-900 outline-none"
                          aria-label={`Question ${index + 1}`}
                        />

                        {question.options && question.options.length > 0 && (
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {question.options.map((option, optionIndex) => (
                              <div
                                key={option.id ?? optionIndex}
                                className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2"
                              >
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-300 text-[10px] font-semibold text-slate-500">
                                  {String.fromCharCode(65 + optionIndex)}
                                </span>

                                <input
                                  value={option.text}
                                  onChange={(event) =>
                                    updateQuestion(
                                      index,
                                      (currentQuestion) => ({
                                        ...currentQuestion,
                                        options: currentQuestion.options
                                          ? currentQuestion.options.map(
                                              (
                                                currentOption,
                                                currentOptionIndex,
                                              ) =>
                                                currentOptionIndex ===
                                                optionIndex
                                                  ? {
                                                      ...currentOption,
                                                      text: event.target.value,
                                                    }
                                                  : currentOption,
                                            )
                                          : null,
                                      }),
                                    )
                                  }
                                  className="min-w-0 flex-1 border-0 bg-transparent text-sm text-slate-700 outline-none"
                                  aria-label={`Question ${
                                    index + 1
                                  } option ${optionIndex + 1}`}
                                />
                              </div>
                            ))}
                          </div>
                        )}

                        {!question.options?.length && (
                          <div className="mt-3 min-h-14 rounded-lg border border-dashed border-slate-200" />
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => deleteQuestion(index)}
                        className="mt-0.5 hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-300 transition hover:bg-red-50 hover:text-red-600 group-hover:flex"
                        aria-label={`Delete question ${index + 1}`}
                        title="Delete question"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="mt-3 flex items-center gap-3 pl-10">
                      <label className="flex items-center gap-2 text-[11px] text-slate-400">
                        Points
                        <input
                          type="number"
                          min={0}
                          value={question.points ?? 0}
                          onChange={(event) =>
                            updateQuestionPoints(index, event.target.value)
                          }
                          className="h-7 w-16 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none"
                        />
                      </label>

                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] text-slate-400">
                        {question.type}
                      </span>
                    </div>
                  </article>
                ))}
              </div>

              <button
                type="button"
                onClick={addQuestion}
                className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-3 text-sm font-medium text-slate-500 transition hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900"
              >
                <Plus className="h-4 w-4" />
                Add question
              </button>

              <div className="mt-8 border-t border-slate-200 pt-5 text-right">
                <span className="text-xs text-slate-400">
                  Total points:{" "}
                  <strong className="text-slate-700">{totalPoints}</strong>
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* --------------------------------------------------------
            INSPECTOR
        -------------------------------------------------------- */}

        <aside className="lg:sticky lg:top-[85px] lg:self-start">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-950">
                Worksheet details
              </h2>

              <p className="mt-1 text-xs text-slate-400">
                Edit the document without changing the AI conversation.
              </p>
            </div>

            <div className="space-y-5 p-5">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-600">
                  Grade level
                </span>

                <input
                  value={worksheet.gradeLevel}
                  onChange={(event) =>
                    updateWorksheet((current) => ({
                      ...current,
                      gradeLevel: event.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-slate-400"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-600">
                  Subject
                </span>

                <input
                  value={worksheet.subject}
                  onChange={(event) =>
                    updateWorksheet((current) => ({
                      ...current,
                      subject: event.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-slate-400"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-600">
                  Topic
                </span>

                <input
                  value={worksheet.topic}
                  onChange={(event) =>
                    updateWorksheet((current) => ({
                      ...current,
                      topic: event.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-slate-400"
                />
              </label>

              <div className="rounded-xl bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Questions</span>

                  <span className="text-sm font-semibold text-slate-900">
                    {worksheet.questions.length}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-slate-500">Total points</span>

                  <span className="text-sm font-semibold text-slate-900">
                    {totalPoints}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void downloadWorksheet("answer-key")}
                disabled={downloading !== null}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" />
                Download answer key
              </button>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
