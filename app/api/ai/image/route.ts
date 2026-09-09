import { NextResponse } from "next/server";

import { generateImage } from "@/lib/ai/image/generator";
import type {
  ImageBackground,
  ImageModel,
  ImageOutputFormat,
  ImageQuality,
  ImageSize,
} from "@/lib/ai/image/types";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";

export const runtime = "nodejs";

interface ImageRequestBody {
  prompt?: unknown;
  model?: unknown;
  size?: unknown;
  quality?: unknown;
  outputFormat?: unknown;
  background?: unknown;
  requestId?: unknown;
  projectId?: unknown;
}

const VALID_MODELS: ImageModel[] = ["gpt-image-2"];

const VALID_SIZES: ImageSize[] = [
  "1024x1024",
  "1024x1536",
  "1536x1024",
  "auto",
];

const VALID_QUALITIES: ImageQuality[] = ["low", "medium", "high", "auto"];

const VALID_FORMATS: ImageOutputFormat[] = ["png", "jpeg"];

const VALID_BACKGROUNDS: ImageBackground[] = ["auto", "opaque"];

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isValidModel(value: unknown): value is ImageModel {
  return isString(value) && VALID_MODELS.includes(value as ImageModel);
}

function isValidSize(value: unknown): value is ImageSize {
  return isString(value) && VALID_SIZES.includes(value as ImageSize);
}

function isValidQuality(value: unknown): value is ImageQuality {
  return isString(value) && VALID_QUALITIES.includes(value as ImageQuality);
}

function isValidFormat(value: unknown): value is ImageOutputFormat {
  return isString(value) && VALID_FORMATS.includes(value as ImageOutputFormat);
}

function isValidBackground(value: unknown): value is ImageBackground {
  return (
    isString(value) && VALID_BACKGROUNDS.includes(value as ImageBackground)
  );
}

function createRequestId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function POST(request: Request) {
  try {
    /*
     * ==========================================================
     * AUTHENTICATION
     * ==========================================================
     */

    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        {
          error: "Unauthorized.",
        },
        {
          status: 401,
        },
      );
    }

    /*
     * ==========================================================
     * REQUEST BODY
     * ==========================================================
     */

    let body: ImageRequestBody;

    try {
      body = (await request.json()) as ImageRequestBody;
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

    /*
     * ==========================================================
     * PROMPT
     * ==========================================================
     */

    if (!isString(body.prompt) || !body.prompt.trim()) {
      return NextResponse.json(
        {
          error: "Image prompt cannot be empty.",
        },
        {
          status: 400,
        },
      );
    }

    const prompt = body.prompt.trim();

    if (prompt.length > 10000) {
      return NextResponse.json(
        {
          error:
            "Image prompt is too long. Maximum length is 10,000 characters.",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * ==========================================================
     * REQUEST ID
     * ==========================================================
     *
     * The client normally supplies this so repeated requests
     * can be made idempotent.
     *
     * We also generate one server-side when it is missing.
     */

    const requestId =
      isString(body.requestId) && body.requestId.trim()
        ? body.requestId.trim()
        : createRequestId();

    if (requestId.length > 255) {
      return NextResponse.json(
        {
          error: "Request ID is too long.",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * ==========================================================
     * OPTIONAL PROJECT ID
     * ==========================================================
     */

    let projectId: string | undefined;

    if (body.projectId !== undefined) {
      if (!isString(body.projectId) || !body.projectId.trim()) {
        return NextResponse.json(
          {
            error: "Invalid project ID.",
          },
          {
            status: 400,
          },
        );
      }

      projectId = body.projectId.trim();

      if (projectId.length > 255) {
        return NextResponse.json(
          {
            error: "Project ID is too long.",
          },
          {
            status: 400,
          },
        );
      }
    }

    /*
     * ==========================================================
     * MODEL
     * ==========================================================
     */

    let model: ImageModel | undefined;

    if (body.model !== undefined) {
      if (!isValidModel(body.model)) {
        return NextResponse.json(
          {
            error: "Invalid image model.",
          },
          {
            status: 400,
          },
        );
      }

      model = body.model;
    }

    /*
     * ==========================================================
     * SIZE
     * ==========================================================
     */

    let size: ImageSize | undefined;

    if (body.size !== undefined) {
      if (!isValidSize(body.size)) {
        return NextResponse.json(
          {
            error: "Invalid image size.",
          },
          {
            status: 400,
          },
        );
      }

      size = body.size;
    }

    /*
     * ==========================================================
     * QUALITY
     * ==========================================================
     */

    let quality: ImageQuality | undefined;

    if (body.quality !== undefined) {
      if (!isValidQuality(body.quality)) {
        return NextResponse.json(
          {
            error: "Invalid image quality.",
          },
          {
            status: 400,
          },
        );
      }

      quality = body.quality;
    }

    /*
     * ==========================================================
     * OUTPUT FORMAT
     * ==========================================================
     */

    let outputFormat: ImageOutputFormat | undefined;

    if (body.outputFormat !== undefined) {
      if (!isValidFormat(body.outputFormat)) {
        return NextResponse.json(
          {
            error: "Invalid image output format.",
          },
          {
            status: 400,
          },
        );
      }

      outputFormat = body.outputFormat;
    }

    /*
     * ==========================================================
     * BACKGROUND
     * ==========================================================
     */

    let background: ImageBackground | undefined;

    if (body.background !== undefined) {
      if (!isValidBackground(body.background)) {
        return NextResponse.json(
          {
            error: "Invalid image background.",
          },
          {
            status: 400,
          },
        );
      }

      background = body.background;
    }

    /*
     * ==========================================================
     * GENERATE IMAGE
     * ==========================================================
     *
     * The API route does not contain generation logic.
     *
     * Everything goes through the centralized image service:
     *
     * POST /api/ai/image
     *       ↓
     * generateImage()
     *       ↓
     * OpenAI
     *       ↓
     * UploadThing
     *       ↓
     * AIAsset
     *       ↓
     * AIGeneration
     */

    const image = await generateImage({
      userId: user.id,
      prompt,
      model,
      size,
      quality,
      outputFormat,
      background,
      requestId,
      projectId,
    });

    /*
     * ==========================================================
     * RESPONSE
     * ==========================================================
     */

    return NextResponse.json(
      {
        success: true,
        image,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    /*
     * ==========================================================
     * ERROR HANDLING
     * ==========================================================
     */

    const message =
      error instanceof Error ? error.message : "Image generation failed.";

    /*
     * ----------------------------------------------------------
     * Known image-generation errors
     * ----------------------------------------------------------
     */

    const errorCode =
      error && typeof error === "object" && "code" in error
        ? String(
            (
              error as {
                code?: unknown;
              }
            ).code ?? "",
          )
        : "";

    if (errorCode === "GENERATION_IN_PROGRESS") {
      return NextResponse.json(
        {
          success: false,
          error: message,
          code: errorCode,
        },
        {
          status: 409,
        },
      );
    }

    if (errorCode === "ASSET_MISSING") {
      return NextResponse.json(
        {
          success: false,
          error: message,
          code: errorCode,
        },
        {
          status: 500,
        },
      );
    }

    if (
      errorCode === "PROVIDER_EMPTY_RESPONSE" ||
      errorCode === "PROVIDER_INVALID_RESPONSE"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: message,
          code: errorCode,
        },
        {
          status: 502,
        },
      );
    }

    /*
     * ----------------------------------------------------------
     * Validation / generation errors
     * ----------------------------------------------------------
     */

    if (
      error instanceof Error &&
      (message.includes("required") ||
        message.includes("cannot be empty") ||
        message.includes("Invalid") ||
        message.includes("too long"))
    ) {
      return NextResponse.json(
        {
          success: false,
          error: message,
          code: errorCode || "INVALID_REQUEST",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * ----------------------------------------------------------
     * Generic failure
     * ----------------------------------------------------------
     */

    console.error("POST /api/ai/image failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: message,
        code: errorCode || "IMAGE_GENERATION_FAILED",
      },
      {
        status: 500,
      },
    );
  }
}
