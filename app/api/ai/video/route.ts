import { NextResponse } from "next/server";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";

import {
  generateVideo,
  InsufficientVideoCreditsError,
  type VideoAspectRatio,
  type VideoDuration,
  type VideoModel,
} from "@/lib/ai/video";
import { AIVideoError } from "@/lib/ai/video/errors";

const VALID_DURATIONS = [4, 8, 12] as const;
const VALID_ASPECT_RATIOS = ["16:9", "9:16"] as const;
const VALID_MODELS = ["sora-2", "sora-2-pro"] as const;

type CreateVideoBody = {
  prompt?: unknown;
  duration?: unknown;
  aspectRatio?: unknown;
  model?: unknown;
};

function isValidDuration(value: unknown): value is VideoDuration {
  return (
    typeof value === "number" &&
    VALID_DURATIONS.includes(value as (typeof VALID_DURATIONS)[number])
  );
}

function isValidAspectRatio(value: unknown): value is VideoAspectRatio {
  return (
    typeof value === "string" &&
    VALID_ASPECT_RATIOS.includes(value as (typeof VALID_ASPECT_RATIOS)[number])
  );
}

function isValidModel(value: unknown): value is VideoModel {
  return (
    typeof value === "string" &&
    VALID_MODELS.includes(value as (typeof VALID_MODELS)[number])
  );
}

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required.",
        },
        { status: 401 },
      );
    }

    const body = (await request.json()) as CreateVideoBody;

    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";

    if (!prompt) {
      return NextResponse.json(
        {
          success: false,
          error: "A video prompt is required.",
        },
        { status: 400 },
      );
    }

    if (prompt.length > 4000) {
      return NextResponse.json(
        {
          success: false,
          error: "Video prompts cannot exceed 4000 characters.",
        },
        { status: 400 },
      );
    }

    if (!isValidDuration(body.duration)) {
      return NextResponse.json(
        {
          success: false,
          error: "Video duration must be 4, 8, or 12 seconds.",
        },
        { status: 400 },
      );
    }

    if (!isValidAspectRatio(body.aspectRatio)) {
      return NextResponse.json(
        {
          success: false,
          error: "Video aspect ratio must be 16:9 or 9:16.",
        },
        { status: 400 },
      );
    }

    const model = body.model ?? "sora-2";

    if (!isValidModel(model)) {
      return NextResponse.json(
        {
          success: false,
          error: "Unsupported video model.",
        },
        { status: 400 },
      );
    }

    const result = await generateVideo({
      userId,
      prompt,
      duration: body.duration,
      aspectRatio: body.aspectRatio,
      model,
    });

    return NextResponse.json(
      {
        success: true,
        generation: {
          id: result.generation.id,
          status: result.generation.status,
          provider: result.generation.provider,
          model: result.generation.model,
          providerTaskId: result.generation.providerTaskId,
          prompt: result.generation.prompt,
          duration: result.generation.duration,
          aspectRatio: result.generation.aspectRatio,
          creditsUsed: result.creditsUsed,
          createdAt: result.generation.createdAt,
        },
      },
      { status: 202 },
    );
  } catch (error) {
    console.error("[POST /api/ai/video]", error);

    if (error instanceof InsufficientVideoCreditsError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: "INSUFFICIENT_CREDITS",
          required: error.required,
          available: error.available,
        },
        { status: 402 },
      );
    }

    if (error instanceof AIVideoError) {
      const status =
        error.code === "INVALID_REQUEST"
          ? 400
          : error.code === "UNSUPPORTED"
            ? 400
            : 500;

      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: error.code,
        },
        { status },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Unable to start video generation.",
      },
      { status: 500 },
    );
  }
}
