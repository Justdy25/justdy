"use server";

import "server-only";

import OpenAI from "openai";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import type { WorksheetDesign } from "@/lib/ai/worksheet/worksheet-design";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const DESIGN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    template: {
      type: "string",
      enum: ["classic", "modern", "playful", "assessment"],
    },
    layoutMode: { type: "string", enum: ["auto", "manual"] },
    density: { type: "string", enum: ["compact", "comfortable", "spacious"] },
    titleStyle: { type: "string", enum: ["boxed", "underline", "plain"] },
    accentColor: { type: "string" },
    borderColor: { type: "string" },
    headerFields: {
      type: "string",
      enum: ["all", "name-date", "name-date-score"],
    },
    answerSpace: { type: "string", enum: ["small", "medium", "large"] },
    questionLayout: { type: "string", enum: ["single", "two-column"] },
    decorations: { type: "string", enum: ["none", "minimal", "playful"] },
  },
  required: [
    "template",
    "layoutMode",
    "density",
    "titleStyle",
    "accentColor",
    "borderColor",
    "headerFields",
    "answerSpace",
    "questionLayout",
    "decorations",
  ],
} as const;

const HEX = /^#[0-9a-fA-F]{6}$/;

function safeDesign(
  value: unknown,
  fallback: WorksheetDesign,
): WorksheetDesign {
  if (!value || typeof value !== "object") return fallback;
  const v = value as Record<string, unknown>;
  const is = (x: unknown, values: string[]) =>
    typeof x === "string" && values.includes(x);
  const accent =
    typeof v.accentColor === "string" && HEX.test(v.accentColor)
      ? v.accentColor
      : fallback.accentColor;
  const border =
    typeof v.borderColor === "string" && HEX.test(v.borderColor)
      ? v.borderColor
      : fallback.borderColor;
  return {
    template: is(v.template, ["classic", "modern", "playful", "assessment"])
      ? (v.template as WorksheetDesign["template"])
      : fallback.template,
    layoutMode: is(v.layoutMode, ["auto", "manual"])
      ? (v.layoutMode as WorksheetDesign["layoutMode"])
      : fallback.layoutMode,
    density: is(v.density, ["compact", "comfortable", "spacious"])
      ? (v.density as WorksheetDesign["density"])
      : fallback.density,
    titleStyle: is(v.titleStyle, ["boxed", "underline", "plain"])
      ? (v.titleStyle as WorksheetDesign["titleStyle"])
      : fallback.titleStyle,
    accentColor: accent,
    borderColor: border,
    headerFields: is(v.headerFields, ["all", "name-date", "name-date-score"])
      ? (v.headerFields as WorksheetDesign["headerFields"])
      : fallback.headerFields,
    answerSpace: is(v.answerSpace, ["small", "medium", "large"])
      ? (v.answerSpace as WorksheetDesign["answerSpace"])
      : fallback.answerSpace,
    questionLayout: is(v.questionLayout, ["single", "two-column"])
      ? (v.questionLayout as WorksheetDesign["questionLayout"])
      : fallback.questionLayout,
    decorations: is(v.decorations, ["none", "minimal", "playful"])
      ? (v.decorations as WorksheetDesign["decorations"])
      : fallback.decorations,
  };
}

export async function DesignWorksheet(input: {
  prompt: string;
  current: WorksheetDesign;
  gradeLevel?: string;
  subject?: string;
  topic?: string;
  questionCount?: number;
  difficulty?: "easy" | "medium" | "hard" | "mixed";
  questionTypes?: string[];
}) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id)
      return { success: false, error: "Unauthorized. Please log in." };

    const prompt = input.prompt?.trim();
    if (!prompt)
      return { success: false, error: "Describe the design you want." };
    if (prompt.length > 500)
      return {
        success: false,
        error: "Design instructions must be 500 characters or fewer.",
      };

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      input: [
        {
          role: "system",
          content: `You are Justdy AI's worksheet design director. Convert the teacher's natural-language request into ONLY the worksheet design configuration. Never change worksheet questions, answers, wording, question count, or question types.

You may choose visual personality, template, colors, title treatment, decorations, and layout strategy.

LAYOUT MODE:
- auto = the deterministic application layout engine decides physical density, columns, and answer-space from the actual worksheet content.
- manual = preserve the teacher's exact density, questionLayout, and answerSpace selections.
- Use auto when the teacher asks for automatic layout, smart fit, page optimization, or similar.
- Use manual when the teacher explicitly asks for exact spacing/columns/manual control.
- Otherwise preserve the current layoutMode.

Keep designs printable, readable, professional, and grade-appropriate. Use hex colors only. Avoid neon colors, gradients, very light text, or decoration that harms print readability. Do not estimate physical pagination; the application layout engine handles pagination deterministically.`,
        },
        {
          role: "user",
          content: `Grade: ${input.gradeLevel || "unspecified"}\nSubject: ${input.subject || "unspecified"}\nTopic: ${input.topic || "unspecified"}\nQuestion count: ${input.questionCount ?? "unspecified"}\nDifficulty: ${input.difficulty || "unspecified"}\nQuestion types: ${input.questionTypes?.join(", ") || "unspecified"}\nCurrent design: ${JSON.stringify(input.current)}\nTeacher request: ${prompt}`,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "worksheet_design",
          strict: true,
          schema: DESIGN_SCHEMA,
        },
      },
    });

    const parsed = JSON.parse(response.output_text || "{}");
    return { success: true, design: safeDesign(parsed, input.current) };
  } catch (error) {
    console.error("DesignWorksheet failed:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to generate the design.",
    };
  }
}
