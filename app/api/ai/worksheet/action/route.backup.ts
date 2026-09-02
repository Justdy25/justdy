import { NextResponse } from "next/server";

import type { WorksheetDocument } from "@/lib/ai/worksheet/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.OPENAI_WORKSHEET_MODEL || "gpt-5.6-luna";
const MAX_QUESTIONS = 100;

const QUESTION_TYPES = [
  "multiple_choice",
  "short_answer",
  "true_false",
  "fill_in_blank",
  "matching",
  "open_response",
] as const;

type QuestionType = (typeof QUESTION_TYPES)[number];

type IncomingQuestion = WorksheetDocument["questions"][number];

type AiQuestion = {
  type: QuestionType;
  question: string;
  options: { text: string }[] | null;
  answer: string;
  explanation: string | null;
  points: number;
};

const QUESTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    type: {
      type: "string",
      enum: [...QUESTION_TYPES],
    },
    question: { type: "string" },
    options: {
      anyOf: [
        {
          type: "array",
          minItems: 4,
          maxItems: 4,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              text: { type: "string" },
            },
            required: ["text"],
          },
        },
        { type: "null" },
      ],
    },
    answer: { type: "string" },
    explanation: {
      anyOf: [{ type: "string" }, { type: "null" }],
    },
    points: { type: "number", minimum: 0 },
  },
  required: ["type", "question", "options", "answer", "explanation", "points"],
} as const;

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    questions: {
      type: "array",
      minItems: 1,
      maxItems: MAX_QUESTIONS,
      items: QUESTION_SCHEMA,
    },
  },
  required: ["questions"],
} as const;

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function normalizeAction(action: string): string {
  return action.trim().toLowerCase().replace(/[_-]+/g, " ");
}

function getActionInstructions(action: string, worksheet: WorksheetDocument) {
  const normalized = normalizeAction(action);

  if (
    normalized.includes("improve all") ||
    normalized.includes("improve questions")
  ) {
    return `
Improve every question in the worksheet.
Keep the same number of questions, question types, point values, and topic.
Make wording clearer, more precise, age-appropriate, and instructionally useful.
Do not make unnecessary changes to correct mathematics or factual content.
`;
  }

  if (normalized.includes("easier")) {
    return `
Make every question easier while preserving the same learning objective and question type.
Reduce unnecessary complexity, use clearer wording, and use simpler numbers/examples where appropriate.
Do not turn a question into a trivial question.
`;
  }

  if (normalized.includes("harder")) {
    return `
Make every question harder while preserving the same topic, learning objective, and question type.
Increase cognitive demand appropriately for ${worksheet.gradeLevel}.
Do not introduce concepts clearly beyond the intended grade level.
`;
  }

  if (
    normalized.includes("fix all answers") ||
    normalized.includes("fix answers")
  ) {
    return `
Audit every question and correct its answer.
For multiple choice, the answer MUST exactly match one of the option texts.
For true/false, answer MUST be exactly True or False.
For every question, ensure the explanation agrees with the corrected answer.
Do not change the question unless changing it is necessary to make the answer unambiguous.
`;
  }

  if (normalized.includes("distractor")) {
    return `
Improve the distractors of every multiple-choice question.
Keep the correct answer unchanged whenever it is already correct.
Create exactly four options for every multiple-choice question.
There must be exactly one correct option.
Distractors must be plausible but definitively incorrect.
For non-multiple-choice questions, preserve the question and answer unless a small correction is necessary.
`;
  }

  if (normalized.includes("explanation")) {
    return `
Improve the explanations for every question.
Keep questions and answers unchanged unless a factual or mathematical error is discovered.
Explanations should be concise, accurate, and useful to a teacher or learner.
`;
  }

  if (normalized.includes("varied") || normalized.includes("more variety")) {
    return `
Make the worksheet more varied without changing its learning objective.
Vary wording, contexts, examples, and reasoning approaches.
Preserve every question's existing question type.
Avoid repetitive templates and duplicate questions.
`;
  }

  if (
    normalized.includes("check entire") ||
    normalized.includes("check worksheet") ||
    normalized === "check"
  ) {
    return `
Perform a complete quality audit of the worksheet.
Correct mathematical, factual, logical, grammatical, answer-key, option, and age-appropriateness problems you find.
If a question is already correct, preserve it rather than rewriting it for cosmetic reasons.
For multiple choice, ensure exactly four options and exactly one correct option.
`;
  }

  return `
Follow this custom educator instruction exactly:
${action}

Apply the instruction to the entire worksheet while preserving the worksheet's topic, grade level, learning objective, question count, and overall educational purpose.
`;
}

function buildSystemPrompt(worksheet: WorksheetDocument, action: string) {
  return `You are Justdy AI, an expert educational worksheet editor.

You are editing an existing worksheet, not creating a new one from scratch.

WORKSHEET CONTEXT
- Grade level: ${worksheet.gradeLevel}
- Subject: ${worksheet.subject}
- Topic: ${worksheet.topic}
- Learning objective: ${worksheet.learningObjective || "Not specified"}
- Existing question count: ${worksheet.questions.length}

PRIMARY TASK
${getActionInstructions(action, worksheet)}

NON-NEGOTIABLE RULES
1. Return exactly ${worksheet.questions.length} questions.
2. Preserve the order of the existing questions.
3. Preserve every question's question type unless the custom instruction explicitly requires a type change.
4. Preserve point values unless changing them is explicitly requested.
5. Every question must have a non-empty question field.
6. Every question must have a non-empty answer.
7. Multiple-choice questions must have exactly four non-empty options.
8. For multiple-choice questions, the answer must exactly match one option's text.
9. True/false answers must be exactly "True" or "False".
10. Non-multiple-choice questions must have options set to null.
11. Explanations must agree with the answer.
12. Never invent an answer merely to fill a field. Solve the problem and verify it.
13. Preserve valid existing content when the requested action does not require changing it.
14. Do not add commentary outside the JSON response.

MATHEMATICAL ACCURACY
When mathematics is involved, solve every problem independently before selecting the answer.
Check arithmetic, fractions, decimals, percentages, equations, units, signs, and comparisons.
Never rely on a guessed answer.

GRADE APPROPRIATENESS
Use language, numbers, vocabulary, and reasoning appropriate for ${worksheet.gradeLevel}.

OUTPUT
Return only the structured worksheet question array requested by the schema.`;
}

function validateAndNormalizeQuestions(
  original: IncomingQuestion[],
  generated: AiQuestion[],
): IncomingQuestion[] {
  if (generated.length !== original.length) {
    throw new Error(
      `AI returned ${generated.length} questions, but exactly ${original.length} were required.`,
    );
  }

  return generated.map((generatedQuestion, index) => {
    const source = original[index];

    if (!QUESTION_TYPES.includes(generatedQuestion.type)) {
      throw new Error(`Question ${index + 1} has an invalid question type.`);
    }

    const text = generatedQuestion.question.trim();
    const answer = generatedQuestion.answer.trim();

    if (!text) {
      throw new Error(`Question ${index + 1} has empty question text.`);
    }

    if (!answer) {
      throw new Error(`Question ${index + 1} has an empty answer.`);
    }

    const points = Number.isFinite(generatedQuestion.points)
      ? Math.max(0, generatedQuestion.points)
      : Number(source.points) || 0;

    if (generatedQuestion.type === "multiple_choice") {
      if (
        !generatedQuestion.options ||
        generatedQuestion.options.length !== 4
      ) {
        throw new Error(
          `Question ${index + 1} must have exactly four options.`,
        );
      }

      const options = generatedQuestion.options.map((option) =>
        option.text.trim(),
      );
      if (options.some((option) => !option)) {
        throw new Error(`Question ${index + 1} contains an empty option.`);
      }

      const uniqueOptions = new Set(
        options.map((option) => option.toLowerCase()),
      );
      if (uniqueOptions.size !== 4) {
        throw new Error(`Question ${index + 1} contains duplicate options.`);
      }

      const answerMatches = options.filter(
        (option) => option.toLowerCase() === answer.toLowerCase(),
      );

      if (answerMatches.length !== 1) {
        throw new Error(
          `Question ${index + 1} has an answer that does not exactly match one option.`,
        );
      }

      return {
        ...source,
        type: "multiple_choice",
        question: text,
        options: options.map((optionText, optionIndex) => ({
          id: source.options?.[optionIndex]?.id || crypto.randomUUID(),
          text: optionText,
        })),
        answer: options.find(
          (option) => option.toLowerCase() === answer.toLowerCase(),
        )!,
        explanation: generatedQuestion.explanation?.trim() || null,
        points,
      } as IncomingQuestion;
    }

    if (generatedQuestion.type === "true_false") {
      const normalizedAnswer = answer.toLowerCase();
      if (normalizedAnswer !== "true" && normalizedAnswer !== "false") {
        throw new Error(
          `Question ${index + 1} must have a True or False answer.`,
        );
      }

      return {
        ...source,
        type: "true_false",
        question: text,
        options: null,
        answer: normalizedAnswer === "true" ? "True" : "False",
        explanation: generatedQuestion.explanation?.trim() || null,
        points,
      } as IncomingQuestion;
    }

    return {
      ...source,
      type: generatedQuestion.type,
      question: text,
      options: null,
      answer,
      explanation: generatedQuestion.explanation?.trim() || null,
      points,
    } as IncomingQuestion;
  });
}

function rebuildAnswerKey(questions: IncomingQuestion[]) {
  return questions.map((question, index) => ({
    questionNumber: index + 1,
    answer: question.answer,
    explanation: question.explanation,
  }));
}

async function callOpenAI(worksheet: WorksheetDocument, action: string) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured on the server.");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      input: [
        {
          role: "system",
          content: buildSystemPrompt(worksheet, action),
        },
        {
          role: "user",
          content: JSON.stringify({
            action,
            worksheet: {
              gradeLevel: worksheet.gradeLevel,
              subject: worksheet.subject,
              topic: worksheet.topic,
              title: worksheet.title,
              learningObjective: worksheet.learningObjective,
              questions: worksheet.questions.map((question) => ({
                number: question.number,
                type: question.type,
                question: question.question,
                options: question.options?.map((option) => option.text) ?? null,
                answer: question.answer,
                explanation: question.explanation,
                points: question.points,
              })),
            },
          }),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "worksheet_questions",
          strict: true,
          schema: RESPONSE_SCHEMA,
        },
      },
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const message =
      typeof data?.error?.message === "string"
        ? data.error.message
        : "OpenAI worksheet action failed.";
    throw new Error(message);
  }

  const outputText =
    typeof data?.output_text === "string"
      ? data.output_text
      : data?.output
          ?.flatMap((item: { content?: unknown[] }) => item.content ?? [])
          ?.map((content: { text?: string }) => content.text || "")
          ?.join("") || "";

  if (!outputText.trim()) {
    throw new Error("OpenAI returned an empty worksheet response.");
  }

  try {
    return JSON.parse(outputText) as { questions: AiQuestion[] };
  } catch {
    throw new Error("OpenAI returned invalid worksheet JSON.");
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const worksheet = body?.worksheet as WorksheetDocument | undefined;
    const action = typeof body?.action === "string" ? body.action.trim() : "";
    const scope = body?.scope;

    if (!worksheet || typeof worksheet !== "object") {
      return jsonError("A worksheet is required.");
    }

    if (
      !Array.isArray(worksheet.questions) ||
      worksheet.questions.length === 0
    ) {
      return jsonError("The worksheet must contain at least one question.");
    }

    if (worksheet.questions.length > MAX_QUESTIONS) {
      return jsonError(
        `Worksheets cannot contain more than ${MAX_QUESTIONS} questions.`,
      );
    }

    if (!action) {
      return jsonError("An AI action is required.");
    }

    if (scope && scope !== "worksheet") {
      return jsonError("Invalid worksheet action scope.");
    }

    const result = await callOpenAI(worksheet, action);
    const questions = validateAndNormalizeQuestions(
      worksheet.questions,
      result.questions,
    );

    const replacement: WorksheetDocument = {
      ...worksheet,
      questions: questions.map((question, index) => ({
        ...question,
        number: index + 1,
      })),
      answerKey: rebuildAnswerKey(questions),
      totalPoints: questions.reduce(
        (total, question) => total + (Number(question.points) || 0),
        0,
      ),
    };

    return NextResponse.json({
      success: true,
      worksheet: replacement,
    });
  } catch (error) {
    console.error("Worksheet AI action error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to complete the worksheet AI action.",
      },
      { status: 500 },
    );
  }
}
