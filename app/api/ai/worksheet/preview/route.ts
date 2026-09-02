import { NextResponse } from "next/server";
import { headers } from "next/headers";

import { generateWorksheetPdf } from "@/lib/ai/worksheet/pdf";
import { WorksheetDocumentSchema } from "@/lib/ai/worksheet/schema";
import { resolveWorksheetDesign } from "@/lib/ai/worksheet/worksheet-design";
import { auth } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    /*
     * ============================================================
     * AUTHENTICATION
     * ============================================================
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
     * ============================================================
     * PARSE REQUEST
     * ============================================================
     */

    const body = await request.json();

    /*
     * ============================================================
     * VALIDATE WORKSHEET
     * ============================================================
     */

    const worksheetResult = WorksheetDocumentSchema.safeParse(body.worksheet);

    if (!worksheetResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid worksheet document.",
          details: worksheetResult.error.flatten(),
        },
        {
          status: 400,
        },
      );
    }

    /*
     * ============================================================
     * RESOLVE DESIGN
     * ============================================================
     *
     * Design validation is centralized inside:
     *
     * lib/ai/worksheet/worksheet-design.ts
     *
     * If the browser sends an invalid, incomplete, or malformed
     * design, resolveWorksheetDesign() safely falls back to the
     * default worksheet design.
     * ============================================================
     */

    const design = resolveWorksheetDesign(body.design);

    /*
     * ============================================================
     * GENERATE PREVIEW PDF
     * ============================================================
     *
     * IMPORTANT:
     *
     * This endpoint generates ONLY the worksheet.
     *
     * It does not:
     *
     * - generate an answer key
     * - deduct credits
     * - save the worksheet
     *
     * It uses the exact same PDF generation pipeline as the
     * downloadable worksheet, which keeps the preview visually
     * synchronized with the final PDF.
     * ============================================================
     */

    const pdf = await generateWorksheetPdf({
      worksheet: worksheetResult.data,
      type: "worksheet",
      design,
    });

    /*
     * ============================================================
     * RETURN PDF INLINE
     * ============================================================
     *
     * The browser displays this PDF directly rather than forcing
     * a download.
     * ============================================================
     */

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline",
        "Cache-Control": "no-store, max-age=0",
        Pragma: "no-cache",
      },
    });
  } catch (error) {
    /*
     * ============================================================
     * ERROR HANDLING
     * ============================================================
     */

    console.error("Worksheet preview generation error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate worksheet preview.",
      },
      {
        status: 500,
      },
    );
  }
}
