import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";

import {
  generateAI,
  type GenerateAIRequest,
} from "@/lib/ai/generation/generate";

import type { AIOperation } from "@/lib/ai/orchestrator";
import type { AIChatMessage } from "@/lib/ai/types";

type GenerateRequestBody = {
  operation?: AIOperation;
  prompt?: string;
  messages?: AIChatMessage[];
  projectId?: string | null;
  inputData?: GenerateAIRequest["inputData"];
};

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        {
          error: "Authentication required.",
        },
        {
          status: 401,
        },
      );
    }

    let body: GenerateRequestBody;

    try {
      body = (await request.json()) as GenerateRequestBody;
    } catch {
      return NextResponse.json(
        {
          error: "Invalid JSON request body.",
        },
        {
          status: 400,
        },
      );
    }

    if (!body.operation || typeof body.operation !== "string") {
      return NextResponse.json(
        {
          error: "AI operation is required.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      !body.prompt ||
      typeof body.prompt !== "string" ||
      !body.prompt.trim()
    ) {
      return NextResponse.json(
        {
          error: "AI prompt is required.",
        },
        {
          status: 400,
        },
      );
    }

    if (body.messages !== undefined && !Array.isArray(body.messages)) {
      return NextResponse.json(
        {
          error: "Messages must be an array.",
        },
        {
          status: 400,
        },
      );
    }

    const result = await generateAI({
      userId: user.id,
      operation: body.operation,
      prompt: body.prompt,
      messages: body.messages,
      projectId: body.projectId ?? null,
      inputData: body.inputData,
    });

    return NextResponse.json(
      {
        success: true,
        generation: result,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error("POST /api/ai/generate failed:", error);

    const message =
      error instanceof Error ? error.message : "AI generation failed.";

    if (error instanceof Error && error.name === "InsufficientAICreditsError") {
      return NextResponse.json(
        {
          error: message,
          code: "INSUFFICIENT_AI_CREDITS",
        },
        {
          status: 402,
        },
      );
    }

    if (message === "AI project not found.") {
      return NextResponse.json(
        {
          error: message,
          code: "AI_PROJECT_NOT_FOUND",
        },
        {
          status: 404,
        },
      );
    }

    return NextResponse.json(
      {
        error: message,
        code: "AI_GENERATION_FAILED",
      },
      {
        status: 500,
      },
    );
  }
}
