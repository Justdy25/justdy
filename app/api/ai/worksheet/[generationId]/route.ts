import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  AIGenerationStatus,
  AIGenerationType,
} from "@/lib/generated/prisma/enums";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { WorksheetDocumentSchema } from "@/lib/ai/worksheet/schema";

interface RouteContext {
  params: Promise<{
    generationId: string;
  }>;
}

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

function readWorksheet(outputData: unknown) {
  if (
    !outputData ||
    typeof outputData !== "object" ||
    Array.isArray(outputData)
  ) {
    return null;
  }

  const data = outputData as {
    worksheet?: unknown;
  };

  if (!data.worksheet) {
    return null;
  }

  const parsed = WorksheetDocumentSchema.safeParse(data.worksheet);

  return parsed.success ? parsed.data : null;
}

/* ============================================================
   GET WORKSHEET
============================================================ */

export async function GET(_request: Request, { params }: RouteContext) {
  const user = await getAuthenticatedUser();

  if (!user) {
    return errorResponse("Authentication required.", 401);
  }

  const { generationId } = await params;
  const normalizedId = generationId.trim();

  if (!normalizedId) {
    return errorResponse("Generation ID is required.", 400);
  }

  const generation = await prisma.aIGeneration.findFirst({
    where: {
      id: normalizedId,
      userId: user.id,
      type: AIGenerationType.WORKSHEET,
    },
    select: {
      id: true,
      status: true,
      outputData: true,
      updatedAt: true,
      createdAt: true,
    },
  });

  if (!generation) {
    return errorResponse("Worksheet generation not found.", 404);
  }

  if (generation.status !== AIGenerationStatus.COMPLETED) {
    return errorResponse("This worksheet has not finished generating.", 409);
  }

  const worksheet = readWorksheet(generation.outputData);

  if (!worksheet) {
    return errorResponse(
      "The generated worksheet document is unavailable.",
      500,
    );
  }

  return NextResponse.json(
    {
      generationId: generation.id,
      worksheet,
      updatedAt: generation.updatedAt.toISOString(),
      createdAt: generation.createdAt.toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

/* ============================================================
   SAVE WORKSHEET
============================================================ */

export async function PATCH(request: Request, { params }: RouteContext) {
  const user = await getAuthenticatedUser();

  if (!user) {
    return errorResponse("Authentication required.", 401);
  }

  const { generationId } = await params;
  const normalizedId = generationId.trim();

  if (!normalizedId) {
    return errorResponse("Generation ID is required.", 400);
  }

  let body: {
    worksheet?: unknown;
    updatedAt?: unknown;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return errorResponse("Invalid JSON request.", 400);
  }

  const parsedWorksheet = WorksheetDocumentSchema.safeParse(body.worksheet);

  if (!parsedWorksheet.success) {
    return errorResponse("The worksheet document is invalid.", 400);
  }

  const expectedUpdatedAt =
    typeof body.updatedAt === "string" ? new Date(body.updatedAt) : null;

  if (!expectedUpdatedAt || !Number.isFinite(expectedUpdatedAt.getTime())) {
    return errorResponse("A valid worksheet version is required.", 400);
  }

  const generation = await prisma.aIGeneration.findFirst({
    where: {
      id: normalizedId,
      userId: user.id,
      type: AIGenerationType.WORKSHEET,
    },
    select: {
      id: true,
      status: true,
      updatedAt: true,
    },
  });

  if (!generation) {
    return errorResponse("Worksheet generation not found.", 404);
  }

  if (generation.status !== AIGenerationStatus.COMPLETED) {
    return errorResponse("Only completed worksheets can be edited.", 409);
  }

  /*
   * Optimistic concurrency protection.
   *
   * If another browser/tab has already saved the document,
   * this request must not silently overwrite it.
   */
  const updated = await prisma.aIGeneration.updateMany({
    where: {
      id: generation.id,
      userId: user.id,
      type: AIGenerationType.WORKSHEET,
      status: AIGenerationStatus.COMPLETED,
      updatedAt: expectedUpdatedAt,
    },
    data: {
      outputData: {
        worksheet: parsedWorksheet.data,
      },
    },
  });

  if (updated.count !== 1) {
    return NextResponse.json(
      {
        error:
          "This worksheet was changed elsewhere. Reload it before saving again.",
        code: "WORKSHEET_VERSION_CONFLICT",
      },
      {
        status: 409,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const saved = await prisma.aIGeneration.findUnique({
    where: {
      id: generation.id,
    },
    select: {
      id: true,
      updatedAt: true,
      outputData: true,
    },
  });

  if (!saved) {
    return errorResponse("Worksheet was saved but could not be reloaded.", 500);
  }

  return NextResponse.json(
    {
      generationId: saved.id,
      worksheet: readWorksheet(saved.outputData),
      updatedAt: saved.updatedAt.toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
