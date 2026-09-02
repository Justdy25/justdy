"use server";

import "server-only";

import { headers } from "next/headers";
import { assertWorksheetQuestionCount } from "@/lib/ai/worksheet/worksheet-count-validation";
import { auth } from "@/lib/auth";

import { createWorksheet } from "@/lib/ai/worksheet";

import type { WorksheetDocument } from "@/lib/ai/worksheet/schema";
import { GenerateWorksheetInput } from "@/lib/ai/worksheet/generator";

export type CreateWorksheetResult =
  | {
      success: true;
      worksheet: WorksheetDocument;
      warnings: string[];
    }
  | {
      success: false;
      error: string;
    };

export async function CreateWorksheet(
  input: GenerateWorksheetInput,
): Promise<CreateWorksheetResult> {
  try {
    /*
     * ============================================================
     * AUTHENTICATE
     * ============================================================
     */

    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return {
        success: false,
        error: "You must be signed in to create a worksheet.",
      };
    }

    /*
     * ============================================================
     * BASIC VALIDATION
     * ============================================================
     */

    if (!input.gradeLevel?.trim()) {
      return {
        success: false,
        error: "Please select a grade level.",
      };
    }

    if (!input.subject?.trim()) {
      return {
        success: false,
        error: "Please select a subject.",
      };
    }

    if (!input.topic?.trim()) {
      return {
        success: false,
        error: "Please select a topic.",
      };
    }

    if (
      !Number.isInteger(input.questionCount) ||
      input.questionCount < 1 ||
      input.questionCount > 100
    ) {
      return {
        success: false,
        error: "Question count must be between 1 and 100.",
      };
    }

    if (!input.questionTypes?.length) {
      return {
        success: false,
        error: "Please select at least one question type.",
      };
    }

    /*
     * ============================================================
     * GENERATE WORKSHEET
     * ============================================================
     *
     * createWorksheet() currently returns the WorksheetDocument
     * directly.
     */

    const worksheet = await createWorksheet(input);

    /*
     * ============================================================
     * STRICT QUESTION COUNT VALIDATION
     * ============================================================
     *
     * The AI must return exactly the number of questions requested
     * by the user.
     *
     * Example:
     *
     *   Requested: 10
     *   Returned:  10  -> PASS
     *
     *   Requested: 10
     *   Returned: 20  -> FAIL
     *
     * We deliberately do NOT truncate the worksheet because doing
     * so could create inconsistencies between the questions and
     * answer key.
     */

    assertWorksheetQuestionCount(worksheet, input.questionCount);

    /*
     * ============================================================
     * RETURN WORKSHEET
     * ============================================================
     */

    return {
      success: true,
      worksheet,
      warnings: [],
    };
  } catch (error) {
    console.error("CreateWorksheet error:", error);

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to generate the worksheet.",
    };
  }
}
