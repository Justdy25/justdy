import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_QUESTIONS = 100;
const MODEL = process.env.OPENAI_WORKSHEET_MODEL || "gpt-5.6-luna";

const QUESTION_TYPES = [
  "multiple_choice",
  "short_answer",
  "true_false",
  "fill_in_blank",
  "matching",
  "open_response",
] as const;

type QuestionType = (typeof QUESTION_TYPES)[number];

type WorksheetOption = { id: string; text: string };

type WorksheetQuestion = {
  id: string;
  number: number;
  type: QuestionType;
  question: string;
  options: WorksheetOption[] | null;
  answer: string;
  explanation: string | null;
  points: number;
};

type WorksheetDocumentLocal = {
  gradeLevel: string;
  subject: string;
  topic: string;
  title: string;
  learningObjective?: string | null;
  questions: WorksheetQuestion[];
  answerKey?: unknown;
  totalPoints?: number;
  [key: string]: unknown;
};

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
    type: { type: "string", enum: [...QUESTION_TYPES] },
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
            properties: { text: { type: "string" } },
            required: ["text"],
          },
        },
        { type: "null" },
      ],
    },
    answer: { type: "string" },
    explanation: { anyOf: [{ type: "string" }, { type: "null" }] },
    points: { type: "number", minimum: 0 },
  },
  required: ["type", "question", "options", "answer", "explanation", "points"],
};

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
};

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function normalizeAction(value: string) {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ");
}

function instructionsFor(action: string, gradeLevel: string) {
  const normalized = normalizeAction(action);

  if (
    normalized.includes("improve all") ||
    normalized.includes("improve questions")
  ) {
    return "Improve every question. Keep question count, types, points, topic, and learning objective. Make wording clearer, precise, age-appropriate, and instructionally useful.";
  }
  if (normalized.includes("easier")) {
    return `Make every question easier while preserving its learning objective and type. Use simpler wording and appropriately simpler examples for ${gradeLevel}.`;
  }
  if (normalized.includes("harder")) {
    return `Make every question harder while preserving topic, learning objective, and type. Increase cognitive demand appropriately for ${gradeLevel} without introducing clearly advanced concepts.`;
  }
  if (
    normalized.includes("fix all answers") ||
    normalized.includes("fix answers")
  ) {
    return "Audit every answer. For multiple choice, the answer must exactly match one option. For true/false, use exactly True or False. Ensure explanations agree with corrected answers. Change questions only when necessary to make answers unambiguous.";
  }
  if (normalized.includes("distractor")) {
    return "Improve distractors for multiple-choice questions. Keep the correct answer when valid. Use exactly four unique, plausible, definitively incorrect options and exactly one correct answer. Preserve non-multiple-choice questions.";
  }
  if (normalized.includes("explanation")) {
    return "Improve explanations so they are concise, accurate, and useful to a learner or teacher. Preserve valid questions and answers.";
  }
  if (normalized.includes("varied") || normalized.includes("more variety")) {
    return "Make questions more varied by changing contexts, wording, examples, and reasoning approaches while preserving every question type, objective, and educational purpose. Avoid duplicates.";
  }
  if (
    normalized.includes("check entire") ||
    normalized.includes("check worksheet") ||
    normalized === "check"
  ) {
    return "Perform a complete quality audit. Correct mathematical, factual, logical, grammatical, answer-key, option, and grade-appropriateness problems. Preserve content that is already correct.";
  }

  return `Apply this custom educator instruction to the entire worksheet: ${action}`;
}

function buildPrompt(worksheet: WorksheetDocumentLocal, action: string) {
  return `You are Justdy AI, an expert educational worksheet editor.

Edit the existing worksheet. Do not create a different worksheet.

WORKSHEET
Grade: ${worksheet.gradeLevel}
Subject: ${worksheet.subject}
Topic: ${worksheet.topic}
Learning objective: ${worksheet.learningObjective || "Not specified"}
Question count: ${worksheet.questions.length}

TASK
${instructionsFor(action, worksheet.gradeLevel)}

NON-NEGOTIABLE RULES
1. Return exactly ${worksheet.questions.length} questions.
2. Preserve the original order.
3. Preserve each original question type unless the custom instruction explicitly requires a type change.
4. Preserve each original point value unless explicitly asked otherwise.
5. Every question and answer must be non-empty.
6. Multiple-choice questions must have exactly four unique, non-empty options.
7. Multiple-choice answers must exactly match one option.
8. True/false answers must be exactly True or False.
9. Non-multiple-choice questions must have options set to null.
10. Explanations must agree with answers.
11. Solve and verify every mathematical problem independently.
12. Keep language and reasoning appropriate for the stated grade.
13. Return only JSON matching the supplied schema.`;
}

type OpenAIResponseContentItem = {
  text?: unknown;
};

type OpenAIResponseOutputItem = {
  content?: unknown;
};

type OpenAIResponseData = {
  output_text?: unknown;
  output?: unknown;
};

function parseOutput(data: OpenAIResponseData): { questions: AiQuestion[] } {
  const outputText =
    typeof data.output_text === "string" ? data.output_text : "";

  const outputItems: OpenAIResponseOutputItem[] = Array.isArray(data.output)
    ? data.output.filter(
        (item): item is OpenAIResponseOutputItem =>
          typeof item === "object" && item !== null,
      )
    : [];

  const fallbackText = outputItems
    .flatMap((item) =>
      Array.isArray(item.content)
        ? item.content.filter(
            (content): content is OpenAIResponseContentItem =>
              typeof content === "object" && content !== null,
          )
        : [],
    )
    .map((content) => (typeof content.text === "string" ? content.text : ""))
    .join("");

  const text = outputText || fallbackText;

  if (!text.trim()) {
    throw new Error("OpenAI returned an empty worksheet response.");
  }

  try {
    const parsed: unknown = JSON.parse(text);

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("questions" in parsed) ||
      !Array.isArray(parsed.questions)
    ) {
      throw new Error("Missing questions array.");
    }

    return {
      questions: parsed.questions as AiQuestion[],
    };
  } catch {
    throw new Error("OpenAI returned invalid worksheet JSON.");
  }
}

function validateQuestions(
  original: WorksheetQuestion[],
  generated: AiQuestion[],
) {
  if (generated.length !== original.length) {
    throw new Error(
      `AI returned ${generated.length} questions, but exactly ${original.length} were required.`,
    );
  }

  return generated.map((item, index) => {
    const source = original[index];
    if (!QUESTION_TYPES.includes(item.type))
      throw new Error(`Question ${index + 1} has an invalid question type.`);

    const question = String(item.question ?? "").trim();
    const answer = String(item.answer ?? "").trim();
    if (!question)
      throw new Error(`Question ${index + 1} has empty question text.`);
    if (!answer) throw new Error(`Question ${index + 1} has an empty answer.`);

    const points = Number.isFinite(Number(item.points))
      ? Math.max(0, Number(item.points))
      : Number(source.points) || 0;
    const explanation =
      item.explanation == null ? null : String(item.explanation).trim() || null;

    if (item.type === "multiple_choice") {
      if (!Array.isArray(item.options) || item.options.length !== 4) {
        throw new Error(
          `Question ${index + 1} must have exactly four options.`,
        );
      }
      const texts = item.options.map((option) =>
        String(option?.text ?? "").trim(),
      );
      if (texts.some((text) => !text))
        throw new Error(`Question ${index + 1} contains an empty option.`);
      if (new Set(texts.map((text) => text.toLowerCase())).size !== 4) {
        throw new Error(`Question ${index + 1} contains duplicate options.`);
      }
      const matched = texts.find(
        (text) => text.toLowerCase() === answer.toLowerCase(),
      );
      if (!matched)
        throw new Error(
          `Question ${index + 1} has an answer that does not match an option.`,
        );

      return {
        ...source,
        type: "multiple_choice" as const,
        question,
        options: texts.map((text, optionIndex) => ({
          id: source.options?.[optionIndex]?.id || crypto.randomUUID(),
          text,
        })),
        answer: matched,
        explanation,
        points,
      };
    }

    if (item.type === "true_false") {
      const normalized = answer.toLowerCase();
      if (normalized !== "true" && normalized !== "false") {
        throw new Error(
          `Question ${index + 1} must have a True or False answer.`,
        );
      }
      return {
        ...source,
        type: "true_false" as const,
        question,
        options: null,
        answer: normalized === "true" ? "True" : "False",
        explanation,
        points,
      };
    }

    return {
      ...source,
      type: item.type,
      question,
      options: null,
      answer,
      explanation,
      points,
    };
  });
}

async function generate(worksheet: WorksheetDocumentLocal, action: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey)
    throw new Error("OPENAI_API_KEY is not configured on the server.");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      input: [
        { role: "system", content: buildPrompt(worksheet, action) },
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
              questions: worksheet.questions.map((q) => ({
                number: q.number,
                type: q.type,
                question: q.question,
                options: q.options?.map((o) => o.text) ?? null,
                answer: q.answer,
                explanation: q.explanation,
                points: q.points,
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
    throw new Error(
      typeof data?.error?.message === "string"
        ? data.error.message
        : "OpenAI worksheet action failed.",
    );
  }
  return parseOutput(data);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const worksheet = body?.worksheet as WorksheetDocumentLocal | undefined;
    const action = typeof body?.action === "string" ? body.action.trim() : "";

    if (!worksheet || typeof worksheet !== "object")
      return errorResponse("A worksheet is required.");
    if (!Array.isArray(worksheet.questions) || worksheet.questions.length === 0)
      return errorResponse("The worksheet must contain at least one question.");
    if (worksheet.questions.length > MAX_QUESTIONS)
      return errorResponse(
        `Worksheets cannot contain more than ${MAX_QUESTIONS} questions.`,
      );
    if (!action) return errorResponse("An AI action is required.");
    if (body?.scope && body.scope !== "worksheet")
      return errorResponse("Invalid worksheet action scope.");

    const result = await generate(worksheet, action);
    const questions = validateQuestions(
      worksheet.questions,
      result.questions,
    ).map((q, index) => ({ ...q, number: index + 1 }));

    const replacement: WorksheetDocumentLocal = {
      ...worksheet,
      questions,
      answerKey: questions.map((q) => ({
        questionNumber: q.number,
        answer: q.answer,
        explanation: q.explanation,
      })),
      totalPoints: questions.reduce(
        (sum, q) => sum + (Number(q.points) || 0),
        0,
      ),
    };

    return NextResponse.json({ success: true, worksheet: replacement });
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
