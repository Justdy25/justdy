import { NextResponse } from "next/server";

import { generateWorksheetPdf } from "@/lib/ai/worksheet/pdf";
import {
  DEFAULT_WORKSHEET_DESIGN,
  type WorksheetDesign,
} from "@/lib/ai/worksheet/worksheet-design";

import { WorksheetDocumentSchema } from "@/lib/ai/worksheet/schema";

import { auth } from "@/lib/auth";

import { headers } from "next/headers";

function isWorksheetDesign(value: unknown): value is WorksheetDesign {
  if (!value || typeof value !== "object") {
    return false;
  }

  const design = value as Record<string, unknown>;

  const templates = ["classic", "modern", "playful", "assessment"];
  const densities = ["compact", "comfortable", "spacious"];
  const titleStyles = ["boxed", "underline", "plain"];
  const headerFields = ["all", "name-date", "name-date-score"];
  const answerSpaces = ["small", "medium", "large"];
  const questionLayouts = ["single", "two-column"];
  const decorations = ["none", "minimal", "playful"];

  return (
    templates.includes(String(design.template)) &&
    densities.includes(String(design.density)) &&
    titleStyles.includes(String(design.titleStyle)) &&
    typeof design.accentColor === "string" &&
    /^#[0-9a-fA-F]{6}$/.test(design.accentColor) &&
    typeof design.borderColor === "string" &&
    /^#[0-9a-fA-F]{6}$/.test(design.borderColor) &&
    headerFields.includes(String(design.headerFields)) &&
    answerSpaces.includes(String(design.answerSpace)) &&
    questionLayouts.includes(String(design.questionLayout)) &&
    decorations.includes(String(design.decorations))
  );
}

function resolveDesign(value: unknown): WorksheetDesign {
  /*
   * The renderer already has its own default fallback.
   * We normalize the API input here so malformed design
   * objects never reach the renderer.
   */
  return isWorksheetDesign(value) ? value : DEFAULT_WORKSHEET_DESIGN;
}

export async function POST(request: Request) {
  try {
    /*
     * Authenticate user
     */

    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: "You must be signed in.",
        },
        {
          status: 401,
        },
      );
    }

    /*
     * Read request
     */

    const body = await request.json();

    const parsed = WorksheetDocumentSchema.safeParse(body.worksheet);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid worksheet document.",
          details: parsed.error.flatten(),
        },
        {
          status: 400,
        },
      );
    }

    const type =
      body.type === "answer-key" || body.type === "both"
        ? body.type
        : "worksheet";

    const design =
      type === "answer-key" ? undefined : resolveDesign(body.design);

    /*
     * Generate PDF
     */

    const pdf = await generateWorksheetPdf({
      worksheet: parsed.data,

      type,

      design,
    });

    const safeTitle =
      parsed.data.title
        .replace(/[^a-zA-Z0-9-_ ]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .slice(0, 80) || "worksheet";

    const filename =
      type === "answer-key"
        ? `${safeTitle}-answer-key.pdf`
        : type === "both"
          ? `${safeTitle}-worksheet-and-answer-key.pdf`
          : `${safeTitle}.pdf`;

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,

      headers: {
        "Content-Type": "application/pdf",

        "Content-Disposition": `attachment; filename="${filename}"`,

        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Worksheet PDF error:", error);

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error ? error.message : "Unable to generate PDF.",
      },
      {
        status: 500,
      },
    );
  }
}
