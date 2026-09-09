"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
} from "react";
import dynamic from "next/dynamic";

import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  ChevronDown,
  Copy,
  GripVertical,
  Lightbulb,
  Loader2,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  WandSparkles,
  X,
  Zap,
} from "lucide-react";

import { CreateWorksheet } from "@/app/actions/ai/create-worksheet";
import type { WorksheetDocument } from "@/lib/ai/worksheet/schema";
import type { WorksheetQuestionType } from "@/lib/ai/worksheet/types";
import { WorksheetDesign } from "@/lib/ai/worksheet/worksheet-design";

const WorksheetPdfPreview = dynamic(() => import("./WorksheetPdfPreview"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-130 items-center justify-center text-xs text-muted-foreground">
      Loading preview…
    </div>
  ),
});

type WorksheetQuestion = WorksheetDocument["questions"][number];

type AiQuestionAction =
  | "regenerate"
  | "improve"
  | "similar"
  | "easier"
  | "harder"
  | "fix_answer"
  | "explain"
  | "simplify"
  | "polish"
  | "distractors";

interface WorksheetEditorProps {
  worksheet: WorksheetDocument;
  design: WorksheetDesign;
  onChange: (worksheet: WorksheetDocument) => void;
  onClose: () => void;
}

function calculateTotalPoints(questions: WorksheetQuestion[]) {
  return questions.reduce(
    (total, question) => total + (question.points || 0),
    0,
  );
}

function normalizeMultipleChoiceAnswer(
  answer: string,
  options: NonNullable<WorksheetQuestion["options"]>,
): string | null {
  const raw = answer.trim();
  if (!raw) return null;

  const normalized = raw.replace(/\s+/g, " ").trim().toLowerCase();

  // 1) Exact option text match.
  const exact = options.find(
    (option) =>
      option.text.trim().replace(/\s+/g, " ").toLowerCase() === normalized,
  );

  if (exact) {
    return exact.text;
  }

  // 2) Accept common model responses such as "A", "A.", "(A)",
  //    "Option A", "choice A", or "Answer: A".
  const letterMatch = normalized.match(
    /(?:answer|choice|option)?\s*[:\-]?\s*\(?([a-d])\)?\.?\s*$/i,
  );

  if (letterMatch) {
    const index = letterMatch[1].toUpperCase().charCodeAt(0) - 65;
    if (index >= 0 && index < options.length) {
      return options[index].text;
    }
  }

  // 3) Accept 1–4 / "option 1" style answers.
  const numberMatch = normalized.match(
    /(?:answer|choice|option)?\s*[:\-]?\s*([1-4])\.?\s*$/i,
  );

  if (numberMatch) {
    const index = Number(numberMatch[1]) - 1;
    if (index >= 0 && index < options.length) {
      return options[index].text;
    }
  }

  // 4) Sometimes the model returns "A. actual option text".
  //    Match the option text after removing a leading choice marker.
  const withoutChoicePrefix = normalized.replace(
    /^(?:answer|choice|option)?\s*[:\-]?\s*\(?[a-d1-4]\)?[.)\-:]\s*/i,
    "",
  );

  const prefixed = options.find((option) => {
    const optionText = option.text.trim().replace(/\s+/g, " ").toLowerCase();

    return (
      withoutChoicePrefix === optionText ||
      withoutChoicePrefix.includes(optionText)
    );
  });

  if (prefixed) {
    return prefixed.text;
  }

  return null;
}

export default function WorksheetEditor({
  worksheet,
  design,
  onChange,
  onClose,
}: WorksheetEditorProps) {
  const [regeneratingQuestionId, setRegeneratingQuestionId] = useState<
    string | null
  >(null);
  const [history, setHistory] = useState<WorksheetDocument[]>([]);
  const [future, setFuture] = useState<WorksheetDocument[]>([]);
  const [regenerationError, setRegenerationError] = useState<string | null>(
    null,
  );
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(
    worksheet.questions[0]?.id ?? null,
  );
  const [openAiMenuId, setOpenAiMenuId] = useState<string | null>(null);
  const [questionSearch, setQuestionSearch] = useState("");
  const [draggedQuestionId, setDraggedQuestionId] = useState<string | null>(
    null,
  );
  const [aiPreview, setAiPreview] = useState<{
    question: WorksheetQuestion;
    replacement: WorksheetQuestion;
    action: AiQuestionAction;
  } | null>(null);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotBusy, setCopilotBusy] = useState(false);
  const [copilotMessage, setCopilotMessage] = useState("");
  const [copilotPreview, setCopilotPreview] = useState<{
    original: WorksheetDocument;
    replacement: WorksheetDocument;
    action: string;
  } | null>(null);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const [previewZoom, setPreviewZoom] = useState<number | null>(null);

  /*
   * ============================================================
   * UPDATE QUESTION
   * ============================================================
   */

  function commitChange(nextWorksheet: WorksheetDocument) {
    setHistory((previous) => [...previous, worksheet]);

    setFuture([]);

    onChange(nextWorksheet);
  }

  const undo = useCallback(() => {
    if (history.length === 0) {
      return;
    }

    const previousWorksheet = history[history.length - 1];

    setHistory((previous) => previous.slice(0, -1));

    setFuture((previous) => [worksheet, ...previous]);

    onChange(previousWorksheet);
  }, [history, worksheet, onChange]);

  const redo = useCallback(() => {
    if (future.length === 0) {
      return;
    }

    const nextWorksheet = future[0];

    setFuture((previous) => previous.slice(1));

    setHistory((previous) => [...previous, worksheet]);

    onChange(nextWorksheet);
  }, [future, worksheet, onChange]);

  useEffect(() => {
    function handleEditorKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTyping =
        ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "") ||
        Boolean(target?.isContentEditable);
      const modifier = event.metaKey || event.ctrlKey;

      if (
        modifier &&
        event.key.toLowerCase() === "z" &&
        !event.shiftKey &&
        !isTyping
      ) {
        event.preventDefault();
        undo();
        return;
      }
      if (
        modifier &&
        ((event.key.toLowerCase() === "z" && event.shiftKey) ||
          event.key.toLowerCase() === "y") &&
        !isTyping
      ) {
        event.preventDefault();
        redo();
        return;
      }
      if (
        modifier &&
        (event.key === "ArrowUp" || event.key === "ArrowDown") &&
        !isTyping &&
        regeneratingQuestionId === null
      ) {
        const currentIndex = worksheet.questions.findIndex(
          (q) => q.id === selectedQuestionId,
        );
        const nextIndex =
          event.key === "ArrowUp" ? currentIndex - 1 : currentIndex + 1;
        if (nextIndex >= 0 && nextIndex < worksheet.questions.length) {
          event.preventDefault();
          setSelectedQuestionId(worksheet.questions[nextIndex].id);
          setOpenAiMenuId(null);
        }
      }
    }
    window.addEventListener("keydown", handleEditorKeyDown);
    return () => window.removeEventListener("keydown", handleEditorKeyDown);
  }, [
    worksheet.questions,
    selectedQuestionId,
    regeneratingQuestionId,
    history,
    future,
    redo,
    undo,
  ]);

  function updateQuestion(
    questionId: string,
    changes: Partial<WorksheetQuestion>,
  ) {
    const questions = worksheet.questions.map((question) =>
      question.id === questionId
        ? {
            ...question,
            ...changes,
          }
        : question,
    );

    commitChange({
      ...worksheet,
      questions,
      totalPoints: calculateTotalPoints(questions),
    });
  }

  /*
   * ============================================================
   * DELETE QUESTION
   * ============================================================
   */

  function deleteQuestion(questionId: string) {
    const questions = worksheet.questions
      .filter((question) => question.id !== questionId)
      .map((question, index) => ({
        ...question,
        number: index + 1,
      }));

    /*
     * Also rebuild the answer key so question
     * numbers continue matching the worksheet.
     */

    const answerKey = questions.map((question) => ({
      questionNumber: question.number,
      answer: question.answer,
      explanation: question.explanation,
    }));

    commitChange({
      ...worksheet,
      questions,
      totalPoints: calculateTotalPoints(questions),
      answerKey,
    });
  }

  /*
   * ============================================================
   * MOVE QUESTION
   * ============================================================
   */

  function moveQuestion(questionId: string, direction: "up" | "down") {
    const questions = [...worksheet.questions];

    const currentIndex = questions.findIndex(
      (question) => question.id === questionId,
    );

    if (currentIndex === -1) {
      return;
    }

    const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (newIndex < 0 || newIndex >= questions.length) {
      return;
    }

    const [question] = questions.splice(currentIndex, 1);

    questions.splice(newIndex, 0, question);

    const renumbered = questions.map((item, index) => ({
      ...item,
      number: index + 1,
    }));

    /*
     * Rebuild answer key in the new question order.
     */

    const answerKey = renumbered.map((question) => ({
      questionNumber: question.number,
      answer: question.answer,
      explanation: question.explanation,
    }));

    commitChange({
      ...worksheet,
      questions: renumbered,
      totalPoints: calculateTotalPoints(renumbered),
      answerKey,
    });
  }

  /*
   * ============================================================
   * DRAG / DROP REORDER
   * ============================================================
   */
  function moveQuestionTo(questionId: string, targetId: string) {
    if (questionId === targetId) return;

    const questions = [...worksheet.questions];
    const fromIndex = questions.findIndex((item) => item.id === questionId);
    const toIndex = questions.findIndex((item) => item.id === targetId);

    if (fromIndex < 0 || toIndex < 0) return;

    const [moved] = questions.splice(fromIndex, 1);
    questions.splice(toIndex, 0, moved);

    const renumbered = questions.map((item, index) => ({
      ...item,
      number: index + 1,
    }));

    const answerKey = renumbered.map((question) => ({
      questionNumber: question.number,
      answer: question.answer,
      explanation: question.explanation,
    }));

    commitChange({
      ...worksheet,
      questions: renumbered,
      answerKey,
      totalPoints: calculateTotalPoints(renumbered),
    });
  }

  /*
   * ============================================================
   * ADD QUESTION
   * ============================================================
   */

  function addQuestion() {
    const nextNumber = worksheet.questions.length + 1;

    const newQuestion = {
      id: crypto.randomUUID(),

      number: nextNumber,

      type: "short_answer",

      question: "Enter your question here.",

      options: null,

      answer: "",

      explanation: null,

      points: 1,
    } as WorksheetQuestion;

    const questions = [...worksheet.questions, newQuestion];

    const answerKey = [
      ...worksheet.answerKey,
      {
        questionNumber: nextNumber,
        answer: "",
        explanation: null,
      },
    ];

    commitChange({
      ...worksheet,
      questions,
      totalPoints: calculateTotalPoints(questions),
      answerKey,
    });

    setSelectedQuestionId(newQuestion.id);
  }

  /*
   * ============================================================
   * DUPLICATE QUESTION
   * ============================================================
   */

  function duplicateQuestion(questionId: string) {
    const sourceIndex = worksheet.questions.findIndex(
      (question) => question.id === questionId,
    );

    if (sourceIndex === -1) {
      return;
    }

    const source = worksheet.questions[sourceIndex];

    /*
     * Create a completely new question ID.
     */

    const duplicated: WorksheetQuestion = {
      ...source,

      id: crypto.randomUUID(),

      /*
       * Keep the same question content.
       */

      question: source.question,

      /*
       * If this is multiple choice, create new
       * option IDs so the duplicate is independent.
       */

      options: source.options
        ? source.options.map((option) => ({
            ...option,
            id: crypto.randomUUID(),
          }))
        : null,

      answer: source.answer,

      explanation: source.explanation,

      points: source.points,
    };

    /*
     * Insert the duplicate immediately after
     * the original question.
     */

    const questions = [
      ...worksheet.questions.slice(0, sourceIndex + 1),

      duplicated,

      ...worksheet.questions.slice(sourceIndex + 1),
    ].map((question, index) => ({
      ...question,
      number: index + 1,
    }));

    /*
     * Rebuild the answer key so every question
     * has the correct corresponding answer.
     */

    const answerKey = questions.map((question) => ({
      questionNumber: question.number,
      answer: question.answer,
      explanation: question.explanation,
    }));

    commitChange({
      ...worksheet,
      questions,
      answerKey,
      totalPoints: calculateTotalPoints(questions),
    });

    setSelectedQuestionId(duplicated.id);
  }

  /*
   * ============================================================
   * REGENERATE ONE QUESTION
   * ============================================================
   */

  /*
   * ============================================================
   * AI QUESTION ASSISTANT
   * ============================================================
   */

  async function runAiQuestionAction(
    question: WorksheetQuestion,
    action: AiQuestionAction,
  ) {
    if (regeneratingQuestionId !== null) {
      return;
    }

    if (action === "distractors" && question.type !== "multiple_choice") {
      setRegenerationError(
        "Improve distractors is only available for multiple-choice questions.",
      );
      return;
    }

    setRegenerationError(null);
    setOpenAiMenuId(null);
    setRegeneratingQuestionId(question.id);

    const actionInstructions: Record<AiQuestionAction, string> = {
      regenerate: `
Create a completely new replacement question.

The new question must:
- Be substantially different from the existing question.
- Test the same skill and learning objective.
- Be appropriate for the exact grade level.
- Stay directly related to the worksheet topic.
- Use the EXACT question type: ${question.type}.
- Have one clear, unambiguous correct answer.
- Include a concise explanation.

Do not simply change numbers or a few words. Create a genuinely fresh question.
`,
      improve: `
Improve the existing question while keeping the same core skill and intended learning objective.

The improved version must:
- Be clearer and more precise.
- Use age-appropriate language.
- Remove ambiguity or unnecessary wording.
- Preserve the intended mathematical/academic skill.
- Use the EXACT question type: ${question.type}.
- Preserve the correct answer whenever the existing answer is already correct.
- Include a concise explanation.

Do not make the question harder or easier unless necessary to fix clarity.
`,
      similar: `
Create a new question that is similar in skill, structure, and difficulty to the existing question, but is NOT a copy.

The new question must:
- Assess the same skill.
- Be appropriate for the exact grade level.
- Remain on the same worksheet topic.
- Use the EXACT question type: ${question.type}.
- Use different wording, values, examples, or context.
- Have a clear and unambiguous correct answer.
- Include a concise explanation.
`,
      easier: `
Rewrite this question to make it easier for a student at the exact grade level.

The easier version must:
- Test the same core skill.
- Keep the same question type: ${question.type}.
- Use simpler language and a more accessible structure.
- Reduce unnecessary cognitive load.
- Still provide meaningful practice rather than making the answer obvious.
- Have a clear and unambiguous correct answer.
- Include a concise explanation.
`,
      harder: `
Rewrite this question to make it more challenging for a strong student at the exact grade level.

The harder version must:
- Test the same core skill.
- Keep the same question type: ${question.type}.
- Increase reasoning, application, or complexity appropriately.
- Remain age-appropriate.
- Avoid introducing skills substantially beyond the worksheet objective.
- Have a clear and unambiguous correct answer.
- Include a concise explanation.
`,
      fix_answer: `
Do NOT change the question unnecessarily.

Analyze the existing question and determine the mathematically/academically correct answer.

Return the same question and, where applicable, the same multiple-choice options. Correct the answer if needed and provide a concise explanation that demonstrates why the answer is correct.

For multiple-choice:
- Keep exactly four options.
- Keep the existing option text unless an option itself must be corrected.
- The answer MUST exactly correspond to one of the existing option texts.
- Exactly one option must be correct.

The primary purpose of this action is to correct the answer and explanation.
`,
      explain: `
Do NOT change the question, options, or correct answer.

Generate a concise, accurate teacher-friendly explanation for the existing question and answer.

The explanation should:
- Explain why the answer is correct.
- Be appropriate for the exact grade level.
- Show the essential reasoning or steps.
- Be useful to a teacher reviewing the answer key.

Return the original question and answer unchanged, with only the explanation meaningfully improved.
`,
      simplify: `
Rewrite the question so it is easier to understand without changing the assessed skill.

- Keep the exact question type: ${question.type}.
- Keep the same learning objective and answer.
- Use shorter, clearer, age-appropriate language.
- Remove unnecessary wording.
- Do not lower the academic skill being assessed.
- For multiple choice, preserve the existing options whenever possible.
`,
      polish: `
Polish the question for professional educational quality.

- Improve grammar, clarity, wording, and consistency.
- Keep the exact question type: ${question.type}.
- Preserve the learning objective and intended difficulty.
- Do not introduce new facts or skills.
- Preserve the correct answer.
- Make it classroom-ready and concise.
`,
      distractors: `
Improve the multiple-choice distractors while preserving the question and correct answer.

- This action is only valid for multiple-choice questions.
- Keep exactly four choices.
- Keep the correct answer unchanged.
- Replace weak, repetitive, obviously wrong, or confusing distractors with plausible alternatives.
- Distractors must be wrong for a meaningful reason.
- Do not create more than one correct answer.
`,
    };

    try {
      const result = await CreateWorksheet({
        gradeLevel: worksheet.gradeLevel,
        subject: worksheet.subject,
        topic: worksheet.topic,
        title: worksheet.title,
        learningObjective: worksheet.learningObjective,
        questionCount: 1,
        difficulty:
          action === "easier"
            ? "easy"
            : action === "harder"
              ? "hard"
              : "medium",
        questionTypes: [question.type as WorksheetQuestionType],
        instructions: `
Create ONE question response for an existing worksheet.

WORKSHEET CONTEXT
- Grade level: ${worksheet.gradeLevel}
- Subject: ${worksheet.subject}
- Topic: ${worksheet.topic}
- Title: ${worksheet.title}
- Learning objective: ${worksheet.learningObjective}
- Exact question type: ${question.type}

EXISTING QUESTION
${question.question}

EXISTING OPTIONS
${
  question.options?.length
    ? question.options
        .map(
          (option, index) =>
            `${String.fromCharCode(65 + index)}. ${option.text}`,
        )
        .join("\n")
    : "None"
}

EXISTING ANSWER
${question.answer}

EXISTING EXPLANATION
${question.explanation ?? "None"}

REQUESTED AI ACTION
${actionInstructions[action]}

GENERAL QUALITY RULES
- Return exactly one question.
- Never invent unsupported facts.
- Keep the content educational and grade-appropriate.
- Verify the answer before returning it.
- For calculations, solve the problem independently before selecting the answer.
- Never return an answer that contradicts the question.
- For true/false, the answer must be exactly "True" or "False".
- For multiple-choice, create exactly four options only when the action requires a new/reworked question.
- For multiple-choice, set the answer to the EXACT TEXT of the correct option, not "A", "B", "C", or "D".
- Never return an answer label without the corresponding option text.
`,
      });

      if (!result.success) {
        throw new Error(result.error || "Unable to complete the AI action.");
      }

      const generated = result.worksheet.questions[0];

      if (!generated) {
        throw new Error("The AI did not return a question.");
      }

      let replacement: WorksheetQuestion;

      if (action === "fix_answer") {
        replacement = {
          ...question,
          answer: generated.answer,
          explanation: generated.explanation,
          options: question.options,
        };
      } else if (action === "explain") {
        replacement = {
          ...question,
          explanation: generated.explanation,
        };
      } else {
        replacement = {
          ...generated,
          id: question.id,
          number: question.number,
          points: question.points,
        };
      }

      // Normalize common AI answer formats for multiple-choice questions.
      // The model may return "A", "A.", "(A)", "Option A", "1", etc.
      // Internally we keep the answer equal to the actual option text.
      if (
        replacement.type === "multiple_choice" &&
        replacement.options &&
        replacement.options.length > 0
      ) {
        const normalizedAnswer = normalizeMultipleChoiceAnswer(
          replacement.answer,
          replacement.options,
        );

        if (!normalizedAnswer) {
          throw new Error(
            "The AI generated a multiple-choice answer that could not be matched to one of the choices. Please try the AI action again.",
          );
        }

        replacement = {
          ...replacement,
          answer: normalizedAnswer,
        };
      }

      setSelectedQuestionId(question.id);
      setAiPreview({
        question,
        replacement,
        action,
      });
    } catch (error) {
      console.error("AI question action error:", error);

      setRegenerationError(
        error instanceof Error
          ? error.message
          : "Unable to complete the AI question action.",
      );
    } finally {
      setRegeneratingQuestionId(null);
    }
  }

  async function runWorksheetCopilot(action: string) {
    if (copilotBusy || !worksheet.questions.length) return;

    setCopilotBusy(true);
    setCopilotMessage("");

    try {
      const response = await fetch("/api/ai/worksheet/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          worksheet,
          action,
          scope: "worksheet",
        }),
      });

      if (!response.ok) {
        throw new Error("AI could not update the worksheet.");
      }

      const data = await response.json();
      const replacement = data?.worksheet as WorksheetDocument | undefined;

      if (!replacement?.questions?.length) {
        throw new Error("AI returned an invalid worksheet.");
      }

      setCopilotPreview({
        original: worksheet,
        replacement,
        action,
      });
    } catch (error) {
      setCopilotMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setCopilotBusy(false);
    }
  }

  function acceptCopilotPreview() {
    if (!copilotPreview) return;

    const replacement = copilotPreview.replacement;
    const answerKey = replacement.questions.map((item) => ({
      questionNumber: item.number,
      answer: item.answer,
      explanation: item.explanation,
    }));

    commitChange({
      ...replacement,
      answerKey,
      totalPoints: calculateTotalPoints(replacement.questions),
    });

    setCopilotPreview(null);
    setCopilotMessage("");
  }

  function rejectCopilotPreview() {
    setCopilotPreview(null);
  }

  async function runWorksheetCopilotPrompt() {
    const prompt = copilotMessage.trim();
    if (!prompt) return;
    await runWorksheetCopilot(prompt);
  }

  function acceptAiPreview() {
    if (!aiPreview) return;

    const questions = worksheet.questions.map((item) =>
      item.id === aiPreview.question.id ? aiPreview.replacement : item,
    );

    const answerKey = questions.map((item) => ({
      questionNumber: item.number,
      answer: item.answer,
      explanation: item.explanation,
    }));

    commitChange({
      ...worksheet,
      questions,
      answerKey,
      totalPoints: calculateTotalPoints(questions),
    });

    setAiPreview(null);
  }

  function rejectAiPreview() {
    setAiPreview(null);
  }

  function regenerateQuestion(question: WorksheetQuestion) {
    return runAiQuestionAction(question, "regenerate");
  }

  function getQuestionValidation(question: WorksheetQuestion) {
    const issues: string[] = [];
    if (!question.question.trim()) issues.push("Question text is empty");
    if (question.points < 0) issues.push("Points cannot be negative");
    if (question.type === "multiple_choice") {
      const options = question.options ?? [];
      if (options.length < 2) issues.push("Needs at least 2 choices");
      if (options.some((option) => !option.text.trim()))
        issues.push("One or more choices are empty");
      if (!question.answer.trim())
        issues.push("Correct answer is not selected");
      else if (!options.some((option) => option.text === question.answer))
        issues.push("Correct answer does not match a choice");
    } else if (!question.answer.trim()) {
      issues.push("Answer is empty");
    }
    return issues;
  }

  return (
    <div className="fixed inset-0 z-50 flex bg-slate-950/55 p-2 backdrop-blur-sm sm:p-4">
      <div className="relative m-auto flex h-[96vh] w-full max-w-[1400px] flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl">
        {/* TOP BAR */}
        <div className="flex min-h-[68px] items-center justify-between gap-4 border-b bg-background px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition hover:bg-muted"
              aria-label="Close editor"
              title="Close editor"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>

            <div className="hidden h-6 w-px bg-border sm:block" />

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-sm font-bold sm:text-base">
                  Edit Worksheet
                </h2>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  {worksheet.questions.length} questions
                </span>
              </div>
              <p className="hidden truncate text-xs text-muted-foreground sm:block">
                Edit questions, answers, order, and AI-generated content.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCopilotOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-[11px] font-bold text-primary transition hover:bg-primary/10"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Justdy AI
            </button>

            <button
              type="button"
              onClick={undo}
              disabled={history.length === 0 || regeneratingQuestionId !== null}
              className="flex h-9 w-9 items-center justify-center rounded-lg border transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Undo"
              title="Undo"
            >
              <ArrowUp className="h-4 w-4 -rotate-90" />
            </button>

            <button
              type="button"
              onClick={redo}
              disabled={future.length === 0 || regeneratingQuestionId !== null}
              className="flex h-9 w-9 items-center justify-center rounded-lg border transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Redo"
              title="Redo"
            >
              <ArrowDown className="h-4 w-4 -rotate-90" />
            </button>

            <div className="mx-1 hidden h-6 w-px bg-border sm:block" />

            <button
              type="button"
              onClick={onClose}
              disabled={regeneratingQuestionId !== null}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50 sm:text-sm"
            >
              <Check className="h-4 w-4" />
              Done
            </button>
          </div>
        </div>

        {/* WORKSPACE */}
        <div className="flex min-h-0 flex-1 bg-[#f6f7f9] dark:bg-muted/10">
          {/* LEFT QUESTION NAVIGATOR */}
          <aside className="hidden w-[260px] shrink-0 flex-col border-r bg-background lg:flex">
            <div className="border-b px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Questions
                  </div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                    {worksheet.questions.length} total
                  </div>
                </div>
                <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-bold text-muted-foreground">
                  {worksheet.questions.length}
                </span>
              </div>

              <div className="relative mt-3">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={questionSearch}
                  onChange={(event) => setQuestionSearch(event.target.value)}
                  placeholder="Search questions..."
                  className="h-8 w-full rounded-lg border bg-muted/20 pl-8 pr-2.5 text-[11px] outline-none transition focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary/10"
                  aria-label="Search questions"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {worksheet.questions
                .map((question, index) => ({ question, index }))
                .filter(({ question }) => {
                  const query = questionSearch.trim().toLowerCase();
                  if (!query) return true;
                  return (
                    question.question.toLowerCase().includes(query) ||
                    question.type
                      .replace(/_/g, " ")
                      .toLowerCase()
                      .includes(query) ||
                    String(question.number).includes(query)
                  );
                })
                .map(({ question, index }) => (
                  <div
                    key={question.id}
                    draggable
                    onDragStart={() => setDraggedQuestionId(question.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (
                        draggedQuestionId &&
                        draggedQuestionId !== question.id
                      ) {
                        moveQuestionTo(draggedQuestionId, question.id);
                      }
                      setDraggedQuestionId(null);
                    }}
                    onDragEnd={() => setDraggedQuestionId(null)}
                    className={`group mb-1 rounded-xl border transition ${
                      selectedQuestionId === question.id
                        ? "border-primary/30 bg-primary/5 shadow-sm"
                        : "border-transparent hover:border-border hover:bg-muted/60"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedQuestionId(question.id)}
                      className="flex w-full min-w-0 items-center gap-2.5 px-2.5 py-2 text-left"
                    >
                      <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-muted-foreground/50" />
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${
                          selectedQuestionId === question.id
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11px] font-semibold text-foreground">
                          {question.question || "Untitled question"}
                        </span>
                        <span className="mt-0.5 flex min-w-0 items-center gap-1.5">
                          <span className="block min-w-0 flex-1 truncate text-[9px] capitalize text-muted-foreground">
                            {question.type.replace(/_/g, " ")}
                          </span>
                          {getQuestionValidation(question).length === 0 ? (
                            <span
                              className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"
                              title="Question is ready"
                            >
                              <Check className="h-2.5 w-2.5" />
                            </span>
                          ) : (
                            <span
                              className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[8px] font-extrabold text-amber-700"
                              title={getQuestionValidation(question).join(
                                " • ",
                              )}
                            >
                              !
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  </div>
                ))}

              {worksheet.questions.length > 0 &&
                worksheet.questions.filter((question) => {
                  const query = questionSearch.trim().toLowerCase();
                  return (
                    !query ||
                    question.question.toLowerCase().includes(query) ||
                    question.type
                      .replace(/_/g, " ")
                      .toLowerCase()
                      .includes(query) ||
                    String(question.number).includes(query)
                  );
                }).length === 0 && (
                  <div className="px-3 py-8 text-center text-[11px] text-muted-foreground">
                    No questions match your search.
                  </div>
                )}
            </div>

            <div className="border-t p-3">
              <button
                type="button"
                onClick={addQuestion}
                disabled={regeneratingQuestionId !== null}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed px-3 py-2.5 text-xs font-semibold text-primary transition hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Question
              </button>
            </div>
          </aside>

          {/* MAIN QUESTION EDITOR */}
          <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-3xl p-3 sm:p-5 lg:p-8">
              {regenerationError && (
                <div className="mb-4 flex items-start justify-between gap-4 rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-xs text-destructive">
                  <div>
                    <div className="font-semibold">AI action failed</div>
                    <div className="mt-1">{regenerationError}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRegenerationError(null)}
                    className="shrink-0 rounded-md p-1 hover:bg-destructive/10"
                    aria-label="Dismiss error"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {(() => {
                const selectedIndex = worksheet.questions.findIndex(
                  (question) => question.id === selectedQuestionId,
                );
                const selectedQuestion =
                  selectedIndex >= 0
                    ? worksheet.questions[selectedIndex]
                    : null;

                if (!selectedQuestion) {
                  return (
                    <div className="flex min-h-[520px] items-center justify-center rounded-2xl border border-dashed bg-background text-center">
                      <div>
                        <div className="text-sm font-bold">
                          No question selected
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Select a question from the navigator to begin editing.
                        </p>
                      </div>
                    </div>
                  );
                }

                const validationIssues =
                  getQuestionValidation(selectedQuestion);
                const previousQuestion =
                  worksheet.questions[selectedIndex - 1] ?? null;
                const nextQuestion =
                  worksheet.questions[selectedIndex + 1] ?? null;

                return (
                  <>
                    <div className="sticky top-0 z-20 mb-3 flex items-center justify-between gap-3 rounded-xl border bg-background/95 px-3 py-2 shadow-sm backdrop-blur">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Question {selectedIndex + 1} of{" "}
                          {worksheet.questions.length}
                        </span>
                        {validationIssues.length === 0 ? (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-bold text-emerald-700">
                            <Check className="h-2.5 w-2.5" /> Ready
                          </span>
                        ) : (
                          <span
                            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[9px] font-bold text-amber-700"
                            title={validationIssues.join(" • ")}
                          >
                            <span className="font-extrabold">!</span>{" "}
                            {validationIssues.length} issue
                            {validationIssues.length === 1 ? "" : "s"}
                          </span>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          disabled={
                            !previousQuestion || regeneratingQuestionId !== null
                          }
                          onClick={() => {
                            if (previousQuestion) {
                              setSelectedQuestionId(previousQuestion.id);
                              setOpenAiMenuId(null);
                            }
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border transition hover:bg-muted disabled:opacity-30"
                          aria-label="Previous question"
                          title="Previous question (⌘/Ctrl + ↑)"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={
                            !nextQuestion || regeneratingQuestionId !== null
                          }
                          onClick={() => {
                            if (nextQuestion) {
                              setSelectedQuestionId(nextQuestion.id);
                              setOpenAiMenuId(null);
                            }
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border transition hover:bg-muted disabled:opacity-30"
                          aria-label="Next question"
                          title="Next question (⌘/Ctrl + ↓)"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <QuestionEditor
                      key={selectedQuestion.id}
                      question={selectedQuestion}
                      index={selectedIndex}
                      total={worksheet.questions.length}
                      regenerating={
                        regeneratingQuestionId === selectedQuestion.id
                      }
                      selected
                      aiMenuOpen={openAiMenuId === selectedQuestion.id}
                      onSelect={() =>
                        setSelectedQuestionId(selectedQuestion.id)
                      }
                      onAiMenuToggle={() =>
                        setOpenAiMenuId((current) =>
                          current === selectedQuestion.id
                            ? null
                            : selectedQuestion.id,
                        )
                      }
                      onDragStart={() =>
                        setDraggedQuestionId(selectedQuestion.id)
                      }
                      onDragOver={(event: DragEvent<HTMLDivElement>) =>
                        event.preventDefault()
                      }
                      onDragEnd={() => setDraggedQuestionId(null)}
                      onAiAction={(action) =>
                        runAiQuestionAction(selectedQuestion, action)
                      }
                      onChange={(changes) =>
                        updateQuestion(selectedQuestion.id, changes)
                      }
                      onDelete={() => {
                        const currentIndex = worksheet.questions.findIndex(
                          (question) => question.id === selectedQuestion.id,
                        );
                        const nextQuestion =
                          worksheet.questions[currentIndex + 1] ??
                          worksheet.questions[currentIndex - 1];
                        deleteQuestion(selectedQuestion.id);
                        setSelectedQuestionId(nextQuestion?.id ?? null);
                      }}
                      onMoveUp={() => moveQuestion(selectedQuestion.id, "up")}
                      onMoveDown={() =>
                        moveQuestion(selectedQuestion.id, "down")
                      }
                      onRegenerate={() => regenerateQuestion(selectedQuestion)}
                      onDuplicate={() => duplicateQuestion(selectedQuestion.id)}
                    />

                    <div className="mt-3 rounded-xl border bg-background px-4 py-3">
                      <div className="flex items-start gap-2.5">
                        <div
                          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                            validationIssues.length === 0
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {validationIssues.length === 0 ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <span className="text-xs font-extrabold">!</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[11px] font-bold">
                            {validationIssues.length === 0
                              ? "Question looks ready"
                              : "Review before exporting"}
                          </div>
                          {validationIssues.length > 0 ? (
                            <ul className="mt-1 space-y-0.5 text-[10px] text-muted-foreground">
                              {validationIssues.map((issue) => (
                                <li key={issue}>• {issue}</li>
                              ))}
                            </ul>
                          ) : (
                            <div className="mt-0.5 text-[10px] text-muted-foreground">
                              Required question content and answer information
                              are present.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}

              <div className="mt-4 flex items-center justify-between rounded-xl border bg-background px-4 py-3">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Worksheet total
                  </div>
                  <div className="mt-0.5 text-sm font-bold">
                    {worksheet.questions.length} questions ·{" "}
                    {worksheet.totalPoints} points
                  </div>
                </div>
                <button
                  type="button"
                  onClick={addQuestion}
                  disabled={regeneratingQuestionId !== null}
                  className="hidden items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition hover:bg-muted disabled:opacity-50 sm:inline-flex"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Question
                </button>
              </div>
            </div>
          </main>

          {/* LIVE PDF PREVIEW */}
          <aside className="hidden w-[430px] shrink-0 flex-col border-l bg-slate-100 xl:flex">
            <div className="flex min-h-[52px] items-center justify-between border-b bg-background px-4">
              <div>
                <div className="text-xs font-bold">Live Preview</div>
                <div className="text-[10px] text-muted-foreground">
                  Updates as you edit
                </div>
              </div>
              <span className="rounded-full border bg-emerald-50 px-2 py-1 text-[9px] font-semibold text-emerald-700">
                PDF
              </span>
            </div>

            <div
              ref={previewContainerRef}
              className="min-h-0 flex-1 overflow-hidden"
            >
              <WorksheetPdfPreview
                worksheet={worksheet}
                design={design}
                containerRef={previewContainerRef}
                manualZoom={previewZoom}
                onFitZoom={setPreviewZoom}
                onZoomChange={setPreviewZoom}
              />
            </div>
          </aside>
        </div>

        {/* WORKSHEET AI COPILOT */}
        {copilotOpen && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[2px]">
            <div className="w-full max-w-2xl overflow-hidden rounded-2xl border bg-background shadow-2xl">
              <div className="flex items-center justify-between border-b px-5 py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
                      <Sparkles className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold">Justdy AI Copilot</h3>
                      <p className="text-[10px] text-muted-foreground">
                        Edit the entire worksheet with AI
                      </p>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCopilotOpen(false);
                    setCopilotMessage("");
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border transition hover:bg-muted"
                  aria-label="Close Justdy AI Copilot"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="max-h-[70vh] overflow-y-auto p-5">
                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    [
                      "Improve all questions",
                      "Improve wording, clarity, and classroom quality.",
                    ],
                    [
                      "Make all questions easier",
                      "Simplify language while preserving the skill.",
                    ],
                    [
                      "Make all questions harder",
                      "Increase cognitive challenge without changing the topic.",
                    ],
                    [
                      "Fix all answers",
                      "Check answers and correct obvious answer-key problems.",
                    ],
                    [
                      "Improve distractors",
                      "Make multiple-choice distractors more plausible.",
                    ],
                    [
                      "Improve explanations",
                      "Create concise teacher-friendly explanations.",
                    ],
                    [
                      "Make questions more varied",
                      "Reduce repetitive patterns and improve variety.",
                    ],
                    [
                      "Check entire worksheet",
                      "Review the worksheet for quality and consistency.",
                    ],
                  ].map(([label, description]) => (
                    <button
                      key={label}
                      type="button"
                      disabled={copilotBusy}
                      onClick={() => void runWorksheetCopilot(label)}
                      className="rounded-xl border p-3 text-left transition hover:border-primary/30 hover:bg-primary/[0.03] disabled:cursor-wait disabled:opacity-60"
                    >
                      <div className="text-xs font-bold">{label}</div>
                      <div className="mt-1 text-[10px] leading-4 text-muted-foreground">
                        {description}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="my-5 flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                    Or tell AI what to do
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                <textarea
                  value={copilotMessage}
                  onChange={(event) => setCopilotMessage(event.target.value)}
                  disabled={copilotBusy}
                  rows={3}
                  placeholder="Example: Make the worksheet more engaging for Grade 1 students while keeping the same learning objective..."
                  className="w-full resize-none rounded-xl border bg-background px-3.5 py-3 text-xs leading-5 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60"
                />

                {copilotMessage && !copilotBusy && (
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => void runWorksheetCopilotPrompt()}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[11px] font-bold text-primary-foreground"
                    >
                      <Sparkles className="h-3 w-3" />
                      Run AI
                    </button>
                  </div>
                )}

                {copilotBusy && (
                  <div className="mt-3 flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5 text-[10px] font-semibold text-primary">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Justdy AI is analyzing the entire worksheet...
                  </div>
                )}

                {copilotMessage && !copilotBusy && !copilotPreview && (
                  <div className="mt-3 text-[10px] text-muted-foreground">
                    Describe the change you want, then select{" "}
                    <strong>Run AI</strong>.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* WORKSHEET AI PREVIEW */}
        {copilotPreview && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
            <div className="w-full max-w-5xl overflow-hidden rounded-2xl border bg-background shadow-2xl">
              <div className="flex items-center justify-between gap-4 border-b px-5 py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-bold">
                      Review worksheet changes
                    </h3>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold text-primary">
                      {copilotPreview.action}
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    AI has prepared a complete worksheet revision. Your original
                    is still unchanged.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={rejectCopilotPreview}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border transition hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid max-h-[65vh] overflow-y-auto md:grid-cols-2">
                <div className="border-b p-5 md:border-b-0 md:border-r">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Original
                    </span>
                    <span className="text-[9px] text-muted-foreground">
                      {copilotPreview.original.questions.length} questions
                    </span>
                  </div>
                  <div className="space-y-2">
                    {copilotPreview.original.questions.map((q, index) => (
                      <div
                        key={q.id}
                        className="rounded-lg border bg-muted/20 p-2.5"
                      >
                        <div className="mb-1 text-[9px] font-bold text-muted-foreground">
                          Q{index + 1}
                        </div>
                        <div className="line-clamp-3 text-[11px] leading-4">
                          {q.question}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                      AI suggestion
                    </span>
                    <span className="text-[9px] font-semibold text-emerald-600">
                      Preview only
                    </span>
                  </div>
                  <div className="space-y-2">
                    {copilotPreview.replacement.questions.map((q, index) => (
                      <div
                        key={q.id}
                        className="rounded-lg border border-primary/20 bg-primary/[0.025] p-2.5"
                      >
                        <div className="mb-1 text-[9px] font-bold text-primary">
                          Q{index + 1}
                        </div>
                        <div className="line-clamp-3 text-[11px] leading-4">
                          {q.question}
                        </div>
                        {q.answer && (
                          <div className="mt-1.5 line-clamp-1 text-[9px] text-muted-foreground">
                            Answer: {q.answer}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-col-reverse justify-between gap-3 border-t bg-muted/20 px-5 py-4 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={rejectCopilotPreview}
                  className="rounded-lg border px-4 py-2 text-xs font-semibold transition hover:bg-background"
                >
                  Reject
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const action = copilotPreview.action;
                      rejectCopilotPreview();
                      void runWorksheetCopilot(action);
                    }}
                    className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-2 text-xs font-bold text-primary"
                  >
                    Try Again
                  </button>
                  <button
                    type="button"
                    onClick={acceptCopilotPreview}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Accept All Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AI CHANGE PREVIEW */}
        {aiPreview && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
            <div className="w-full max-w-4xl overflow-hidden rounded-2xl border bg-background shadow-2xl">
              <div className="flex items-center justify-between gap-4 border-b px-5 py-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-bold">Review AI change</h3>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold capitalize text-primary">
                      {aiPreview.action.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Nothing has changed yet. Accept the new version or reject
                    it.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={rejectAiPreview}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition hover:bg-muted"
                  aria-label="Close AI preview"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid max-h-[68vh] overflow-y-auto md:grid-cols-2">
                <div className="border-b p-5 md:border-b-0 md:border-r">
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Current
                  </div>
                  <div className="rounded-xl border bg-muted/20 p-4">
                    <div className="text-sm font-semibold leading-6">
                      {aiPreview.question.question}
                    </div>

                    {aiPreview.question.type === "multiple_choice" &&
                      aiPreview.question.options && (
                        <div className="mt-4 space-y-2">
                          {aiPreview.question.options.map((option, index) => (
                            <div
                              key={option.id}
                              className={`rounded-lg border px-3 py-2 text-xs ${
                                aiPreview.question.answer === option.text
                                  ? "border-primary/30 bg-primary/5 font-semibold"
                                  : "bg-background"
                              }`}
                            >
                              <span className="mr-2 font-bold">
                                {String.fromCharCode(65 + index)}.
                              </span>
                              {option.text}
                            </div>
                          ))}
                        </div>
                      )}

                    <div className="mt-4 rounded-lg bg-background px-3 py-2 text-[10px]">
                      <span className="font-bold">Answer:</span>{" "}
                      {aiPreview.question.answer || "Not set"}
                    </div>
                  </div>
                </div>

                <div className="p-5">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-primary">
                      AI suggestion
                    </div>
                    <span className="text-[9px] font-semibold text-emerald-600">
                      Preview only
                    </span>
                  </div>
                  <div className="rounded-xl border border-primary/20 bg-primary/[0.025] p-4">
                    <div className="text-sm font-semibold leading-6">
                      {aiPreview.replacement.question}
                    </div>

                    {aiPreview.replacement.type === "multiple_choice" &&
                      aiPreview.replacement.options && (
                        <div className="mt-4 space-y-2">
                          {aiPreview.replacement.options.map(
                            (option, index) => (
                              <div
                                key={option.id}
                                className={`rounded-lg border px-3 py-2 text-xs ${
                                  aiPreview.replacement.answer === option.text
                                    ? "border-primary/30 bg-primary/5 font-semibold"
                                    : "bg-background"
                                }`}
                              >
                                <span className="mr-2 font-bold">
                                  {String.fromCharCode(65 + index)}.
                                </span>
                                {option.text}
                              </div>
                            ),
                          )}
                        </div>
                      )}

                    <div className="mt-4 rounded-lg bg-background px-3 py-2 text-[10px]">
                      <span className="font-bold">Answer:</span>{" "}
                      {aiPreview.replacement.answer || "Not set"}
                    </div>

                    {aiPreview.replacement.explanation && (
                      <div className="mt-2 rounded-lg bg-background px-3 py-2 text-[10px] text-muted-foreground">
                        <span className="font-bold text-foreground">
                          Explanation:
                        </span>{" "}
                        {aiPreview.replacement.explanation}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col-reverse justify-between gap-3 border-t bg-muted/20 px-5 py-4 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={rejectAiPreview}
                  className="rounded-lg border px-4 py-2 text-xs font-semibold transition hover:bg-background"
                >
                  Reject
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      rejectAiPreview();
                      void runAiQuestionAction(
                        aiPreview.question,
                        aiPreview.action,
                      );
                    }}
                    className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-2 text-xs font-bold text-primary transition hover:bg-primary/10"
                  >
                    Try Again
                  </button>
                  <button
                    type="button"
                    onClick={acceptAiPreview}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Accept Change
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* FOOTER */}
        <div className="flex items-center justify-between border-t bg-background px-4 py-3 sm:px-6">
          <div className="text-[11px] text-muted-foreground">
            <span className="font-semibold text-foreground">
              {worksheet.questions.length}
            </span>{" "}
            questions
            <span className="mx-2">•</span>
            <span className="font-semibold text-foreground">
              {worksheet.totalPoints}
            </span>{" "}
            points
          </div>

          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            {history.length > 0
              ? "Changes available to undo"
              : "No unsaved editor history"}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   QUESTION EDITOR
================================================================ */

function QuestionEditor({
  question,
  index,
  total,
  regenerating,
  selected,
  aiMenuOpen,
  onSelect,
  onAiMenuToggle,
  onDragStart,
  onDragOver,
  onDragEnd,
  onAiAction,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  onRegenerate,
  onDuplicate,
}: {
  question: WorksheetQuestion;
  index: number;
  total: number;
  regenerating: boolean;

  selected: boolean;
  aiMenuOpen: boolean;

  onSelect: () => void;
  onAiMenuToggle: () => void;

  onDragStart: () => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onAiAction: (action: AiQuestionAction) => void;

  onChange: (changes: Partial<WorksheetQuestion>) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRegenerate: () => void;
  onDuplicate: () => void;
}) {
  /*
   * ============================================================
   * CHANGE QUESTION TYPE
   * ============================================================
   */

  function changeQuestionType(type: WorksheetQuestionType) {
    if (type === question.type) {
      return;
    }

    /*
     * Multiple choice
     */

    if (type === "multiple_choice") {
      onChange({
        type,

        options: [
          {
            id: crypto.randomUUID(),
            text: "Option A",
          },

          {
            id: crypto.randomUUID(),
            text: "Option B",
          },

          {
            id: crypto.randomUUID(),
            text: "Option C",
          },

          {
            id: crypto.randomUUID(),
            text: "Option D",
          },
        ],

        answer: "",

        explanation: null,
      });

      return;
    }

    /*
     * True / False
     */

    if (type === "true_false") {
      onChange({
        type,

        options: null,

        answer: "True",

        explanation: null,
      });

      return;
    }

    /*
     * All other non-multiple-choice
     * question types don't require options.
     */

    onChange({
      type,

      options: null,

      answer: "",

      explanation: null,
    });
  }

  /*
   * ============================================================
   * UPDATE OPTION
   * ============================================================
   */

  function updateOption(optionId: string, text: string) {
    if (!question.options) {
      return;
    }

    const options = question.options.map((option) =>
      option.id === optionId
        ? {
            ...option,
            text,
          }
        : option,
    );

    onChange({
      options,
    });
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onClick={onSelect}
      className={`group rounded-2xl border bg-background shadow-sm transition ${
        selected
          ? "border-primary/40 ring-2 ring-primary/10"
          : "border-border hover:border-border/80"
      } ${regenerating ? "bg-primary/[0.02]" : ""}`}
    >
      {/* QUESTION HEADER */}
      <div className="flex items-center justify-between gap-3 border-b px-3 py-2.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <button
            type="button"
            draggable
            onDragStart={(event: DragEvent<HTMLButtonElement>) => {
              event.stopPropagation();
              onDragStart();
            }}
            className="flex h-8 w-7 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground opacity-50 transition hover:bg-muted hover:opacity-100 active:cursor-grabbing"
            aria-label={`Drag question ${question.number}`}
            title="Drag to reorder"
          >
            <GripVertical className="h-4 w-4" />
          </button>

          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
            {question.number}
          </div>

          <div className="min-w-0">
            <div className="text-xs font-bold">Question {question.number}</div>
            <select
              value={question.type}
              disabled={regenerating}
              onChange={(event) =>
                changeQuestionType(event.target.value as WorksheetQuestionType)
              }
              onClick={(event) => event.stopPropagation()}
              className="mt-0.5 max-w-[150px] rounded-md border-0 bg-transparent px-0 py-0.5 text-[10px] font-medium capitalize text-muted-foreground outline-none focus:ring-0 disabled:opacity-50"
              aria-label={`Question ${question.number} type`}
            >
              <option value="multiple_choice">Multiple Choice</option>
              <option value="short_answer">Short Answer</option>
              <option value="true_false">True / False</option>
              <option value="fill_in_blank">Fill in the Blank</option>
              <option value="matching">Matching</option>
              <option value="open_response">Open Response</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* AI */}
          <div className="relative">
            <button
              type="button"
              disabled={regenerating}
              onClick={(event) => {
                event.stopPropagation();
                onAiMenuToggle();
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-2.5 text-[11px] font-bold text-primary transition hover:bg-primary/10 disabled:opacity-50"
              title="AI question tools"
            >
              <WandSparkles className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">AI</span>
              <ChevronDown className="h-3 w-3" />
            </button>

            {aiMenuOpen && (
              <div
                onClick={(event) => event.stopPropagation()}
                className="absolute right-0 top-10 z-30 w-52 overflow-hidden rounded-xl border bg-background p-1.5 shadow-xl"
              >
                <div className="px-2.5 pb-1 pt-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                  Rewrite
                </div>

                <button
                  type="button"
                  onClick={onRegenerate}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold transition hover:bg-muted"
                >
                  <RefreshCw className="h-3.5 w-3.5 text-primary" />
                  Regenerate question
                </button>

                <button
                  type="button"
                  onClick={() => onAiAction("improve")}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold transition hover:bg-muted"
                >
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Improve question
                </button>

                <button
                  type="button"
                  onClick={() => onAiAction("simplify")}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold transition hover:bg-muted"
                >
                  <Lightbulb className="h-3.5 w-3.5 text-primary" />
                  Simplify wording
                </button>

                <button
                  type="button"
                  onClick={() => onAiAction("polish")}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold transition hover:bg-muted"
                >
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Polish question
                </button>

                <button
                  type="button"
                  onClick={() => onAiAction("similar")}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold transition hover:bg-muted"
                >
                  <Zap className="h-3.5 w-3.5 text-primary" />
                  Create similar
                </button>

                <div className="my-1.5 border-t" />

                <div className="px-2.5 pb-1 pt-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                  Difficulty
                </div>

                <button
                  type="button"
                  onClick={() => onAiAction("easier")}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold transition hover:bg-muted"
                >
                  <ArrowDown className="h-3.5 w-3.5 text-primary" />
                  Make easier
                </button>

                <button
                  type="button"
                  onClick={() => onAiAction("harder")}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold transition hover:bg-muted"
                >
                  <ArrowUp className="h-3.5 w-3.5 text-primary" />
                  Make harder
                </button>

                <div className="my-1.5 border-t" />

                <div className="px-2.5 pb-1 pt-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                  Answer & Teacher Help
                </div>

                {question.type === "multiple_choice" && (
                  <button
                    type="button"
                    onClick={() => onAiAction("distractors")}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold transition hover:bg-muted"
                  >
                    <Zap className="h-3.5 w-3.5 text-primary" />
                    Improve distractors
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onAiAction("fix_answer")}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold transition hover:bg-muted"
                >
                  <Check className="h-3.5 w-3.5 text-primary" />
                  Fix answer
                </button>

                <button
                  type="button"
                  onClick={() => onAiAction("explain")}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold transition hover:bg-muted"
                >
                  <Lightbulb className="h-3.5 w-3.5 text-primary" />
                  Generate explanation
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={regenerating}
            onClick={(event) => {
              event.stopPropagation();
              onDuplicate();
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg border transition hover:bg-muted disabled:opacity-30"
            aria-label={`Duplicate question ${question.number}`}
            title="Duplicate question"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            disabled={index === 0 || regenerating}
            onClick={(event) => {
              event.stopPropagation();
              onMoveUp();
            }}
            className="hidden h-8 w-8 items-center justify-center rounded-lg border transition hover:bg-muted disabled:opacity-30 sm:flex"
            aria-label="Move question up"
            title="Move up"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            disabled={index === total - 1 || regenerating}
            onClick={(event) => {
              event.stopPropagation();
              onMoveDown();
            }}
            className="hidden h-8 w-8 items-center justify-center rounded-lg border transition hover:bg-muted disabled:opacity-30 sm:flex"
            aria-label="Move question down"
            title="Move down"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            disabled={regenerating}
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-destructive/20 text-destructive transition hover:bg-destructive/10 disabled:opacity-30"
            aria-label="Delete question"
            title="Delete question"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onAiMenuToggle();
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-muted sm:hidden"
            aria-label="More actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* BODY */}
      <div className="p-4 sm:p-5">
        {regenerating && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5 text-xs font-medium text-primary">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            AI is working on this question...
          </div>
        )}

        {/* QUESTION PROMPT */}
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Question
            </label>
            <span className="text-[10px] text-muted-foreground">
              {question.type === "multiple_choice"
                ? "Write the prompt students will see"
                : question.type === "true_false"
                  ? "Write a statement students can evaluate"
                  : "Write the student prompt"}
            </span>
          </div>

          <textarea
            value={question.question}
            onChange={(event) => onChange({ question: event.target.value })}
            disabled={regenerating}
            onClick={(event) => event.stopPropagation()}
            rows={3}
            className="w-full resize-y rounded-xl border bg-background px-3.5 py-3 text-sm leading-6 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60"
            placeholder="Enter the question..."
          />
        </div>

        {/* MULTIPLE CHOICE */}
        {question.type === "multiple_choice" && question.options && (
          <div className="mt-5 rounded-xl border bg-muted/[0.18] p-3.5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold">Answer choices</div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">
                  Click a choice to mark it correct.
                </div>
              </div>

              <span className="rounded-full border bg-background px-2 py-1 text-[9px] font-bold text-muted-foreground">
                {question.options.length} choices
              </span>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {question.options.map((option, optionIndex) => {
                const isCorrect = question.answer === option.text;

                return (
                  <div
                    key={option.id}
                    className={`flex items-center gap-2 rounded-xl border p-2 transition ${
                      isCorrect
                        ? "border-primary/40 bg-primary/5 ring-1 ring-primary/10"
                        : "bg-background hover:border-primary/20"
                    }`}
                  >
                    <button
                      type="button"
                      disabled={regenerating}
                      onClick={(event) => {
                        event.stopPropagation();
                        onChange({ answer: option.text });
                      }}
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-[11px] font-extrabold transition ${
                        isCorrect
                          ? "border-primary bg-primary text-primary-foreground"
                          : "bg-muted/30 text-muted-foreground hover:border-primary/30 hover:text-primary"
                      }`}
                      aria-label={`Set option ${String.fromCharCode(65 + optionIndex)} as correct answer`}
                      title={
                        isCorrect ? "Correct answer" : "Set as correct answer"
                      }
                    >
                      {isCorrect ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        String.fromCharCode(65 + optionIndex)
                      )}
                    </button>

                    <input
                      value={option.text}
                      onChange={(event) =>
                        updateOption(option.id, event.target.value)
                      }
                      disabled={regenerating}
                      onClick={(event) => event.stopPropagation()}
                      className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 text-xs outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:opacity-60"
                      placeholder={`Option ${String.fromCharCode(65 + optionIndex)}`}
                    />

                    {isCorrect && (
                      <span className="hidden shrink-0 text-[9px] font-bold text-primary sm:block">
                        Correct
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {!question.answer.trim() && (
              <div className="mt-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] font-medium text-amber-800">
                No correct answer selected yet.
              </div>
            )}
          </div>
        )}

        {/* TRUE / FALSE */}
        {question.type === "true_false" && (
          <div className="mt-5 rounded-xl border bg-muted/[0.18] p-3.5">
            <div className="mb-3">
              <div className="text-xs font-bold">Correct answer</div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">
                Choose the answer students should receive credit for.
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {["True", "False"].map((value) => {
                const active =
                  question.answer.trim().toLowerCase() === value.toLowerCase();

                return (
                  <button
                    key={value}
                    type="button"
                    disabled={regenerating}
                    onClick={(event) => {
                      event.stopPropagation();
                      onChange({ answer: value });
                    }}
                    className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition ${
                      active
                        ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/15"
                        : "bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground"
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full border text-[9px] ${
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "bg-background"
                      }`}
                    >
                      {active ? <Check className="h-3 w-3" /> : ""}
                    </span>
                    {value}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* FILL IN THE BLANK */}
        {question.type === "fill_in_blank" && (
          <div className="mt-5 rounded-xl border bg-muted/[0.18] p-3.5">
            <div className="mb-2">
              <div className="text-xs font-bold">Expected answer</div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">
                Enter the answer students should provide for the blank.
              </div>
            </div>

            <input
              value={question.answer}
              onChange={(event) => onChange({ answer: event.target.value })}
              disabled={regenerating}
              onClick={(event) => event.stopPropagation()}
              className="w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60"
              placeholder="Expected answer..."
            />
          </div>
        )}

        {/* SHORT ANSWER */}
        {question.type === "short_answer" && (
          <div className="mt-5 rounded-xl border bg-muted/[0.18] p-3.5">
            <div className="mb-2">
              <div className="text-xs font-bold">Expected answer</div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">
                Use a concise model answer or key phrase for grading.
              </div>
            </div>

            <textarea
              value={question.answer}
              onChange={(event) => onChange({ answer: event.target.value })}
              disabled={regenerating}
              onClick={(event) => event.stopPropagation()}
              rows={3}
              className="w-full resize-y rounded-xl border bg-background px-3.5 py-2.5 text-sm leading-6 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60"
              placeholder="Model answer..."
            />
          </div>
        )}

        {/* MATCHING */}
        {question.type === "matching" && (
          <div className="mt-5 rounded-xl border bg-muted/[0.18] p-3.5">
            <div className="mb-2">
              <div className="text-xs font-bold">Matching answer key</div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">
                Keep the matching pairs in a clear, one-per-line format.
              </div>
            </div>

            <textarea
              value={question.answer}
              onChange={(event) => onChange({ answer: event.target.value })}
              disabled={regenerating}
              onClick={(event) => event.stopPropagation()}
              rows={5}
              className="w-full resize-y rounded-xl border bg-background px-3.5 py-2.5 text-sm leading-6 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60"
              placeholder={"Example:\nA — Apple\nB — Banana\nC — Orange"}
            />
          </div>
        )}

        {/* OPEN RESPONSE */}
        {question.type === "open_response" && (
          <div className="mt-5 rounded-xl border bg-muted/[0.18] p-3.5">
            <div className="mb-2">
              <div className="text-xs font-bold">
                Model answer / rubric guidance
              </div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">
                Give the teacher the expected idea, criteria, or model response.
              </div>
            </div>

            <textarea
              value={question.answer}
              onChange={(event) => onChange({ answer: event.target.value })}
              disabled={regenerating}
              onClick={(event) => event.stopPropagation()}
              rows={4}
              className="w-full resize-y rounded-xl border bg-background px-3.5 py-2.5 text-sm leading-6 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60"
              placeholder="Model response or grading guidance..."
            />
          </div>
        )}

        {/* POINTS + EXPLANATION */}
        <div className="mt-5 grid gap-4 md:grid-cols-[120px_minmax(0,1fr)]">
          <div>
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Points
            </label>
            <input
              type="number"
              min={0}
              value={question.points}
              onChange={(event) =>
                onChange({
                  points: Math.max(0, Number(event.target.value) || 0),
                })
              }
              disabled={regenerating}
              onClick={(event) => event.stopPropagation()}
              className="w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60"
            />
          </div>

          <div>
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Explanation / teacher note
            </label>
            <textarea
              value={question.explanation ?? ""}
              onChange={(event) =>
                onChange({
                  explanation: event.target.value || null,
                })
              }
              disabled={regenerating}
              onClick={(event) => event.stopPropagation()}
              rows={2}
              placeholder="Optional explanation, solution note, or grading guidance..."
              className="w-full resize-y rounded-xl border bg-background px-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60"
            />
          </div>
        </div>

        {/* BOTTOM QUESTION ACTIONS */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <div className="text-[10px] text-muted-foreground">
            {selected ? "Selected question" : "Click to select"}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={regenerating}
              onClick={(event) => {
                event.stopPropagation();
                onRegenerate();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1.5 text-[11px] font-bold text-primary transition hover:bg-primary/10 disabled:opacity-50"
            >
              {regenerating ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              {regenerating ? "Generating..." : "Regenerate"}
            </button>

            <button
              type="button"
              disabled={regenerating}
              onClick={(event) => {
                event.stopPropagation();
                onDuplicate();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition hover:bg-muted disabled:opacity-50"
            >
              <Copy className="h-3 w-3" />
              Duplicate
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
