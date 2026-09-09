import { NextResponse } from "next/server";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

import { refundVideoCreditsAtomic } from "@/lib/ai/video/credits";

import { getVideoJobStatus } from "@/lib/ai/video/provider";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

function serializeGeneration(generation: {
  id: string;
  userId: string;
  title: string | null;
  prompt: string;
  style: string | null;
  duration: number;
  aspectRatio: string;
  provider: string;
  model: string | null;
  providerTaskId: string | null;
  status: string;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  creditsUsed: number;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}) {
  return {
    id: generation.id,
    title: generation.title,
    prompt: generation.prompt,
    style: generation.style,
    duration: generation.duration,
    aspectRatio: generation.aspectRatio,
    provider: generation.provider,
    model: generation.model,
    providerTaskId: generation.providerTaskId,
    status: generation.status,
    videoUrl: generation.videoUrl,
    thumbnailUrl: generation.thumbnailUrl,
    creditsUsed: generation.creditsUsed,
    errorMessage: generation.errorMessage,
    createdAt: generation.createdAt,
    updatedAt: generation.updatedAt,
    completedAt: generation.completedAt,
  };
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    // ------------------------------------------------------------
    // 1. Authenticate
    // ------------------------------------------------------------

    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
        },
        { status: 401 },
      );
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "Video generation ID is required.",
        },
        { status: 400 },
      );
    }

    // ------------------------------------------------------------
    // 2. Load generation and enforce ownership
    // ------------------------------------------------------------

    let generation = await prisma.videoGeneration.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!generation) {
      return NextResponse.json(
        {
          success: false,
          error: "Video generation not found.",
        },
        { status: 404 },
      );
    }

    // ------------------------------------------------------------
    // 3. If already completed, return authoritative local state
    // ------------------------------------------------------------

    if (generation.status === "COMPLETED") {
      return NextResponse.json({
        success: true,
        generation: serializeGeneration(generation),
      });
    }

    // ------------------------------------------------------------
    // 4. If permanently cancelled, make sure refund has happened
    //    before treating it as terminal.
    // ------------------------------------------------------------

    if (generation.status === "CANCELLED") {
      if (generation.creditsUsed > 0 && !generation.creditRefundedAt) {
        await refundVideoCreditsAtomic({
          userId: session.user.id,
          generationId: generation.id,
        });

        generation = await prisma.videoGeneration.findFirstOrThrow({
          where: {
            id: generation.id,
            userId: session.user.id,
          },
        });
      }

      return NextResponse.json({
        success: true,
        generation: serializeGeneration(generation),
      });
    }

    // ------------------------------------------------------------
    // 5. Failed generations also need refund reconciliation.
    //
    // This protects against a process crash occurring after the
    // generation was marked FAILED but before the refund completed.
    // ------------------------------------------------------------

    if (generation.status === "FAILED") {
      if (generation.creditsUsed > 0 && !generation.creditRefundedAt) {
        await refundVideoCreditsAtomic({
          userId: session.user.id,
          generationId: generation.id,
        });

        generation = await prisma.videoGeneration.findFirstOrThrow({
          where: {
            id: generation.id,
            userId: session.user.id,
          },
        });
      }

      return NextResponse.json({
        success: true,
        generation: serializeGeneration(generation),
      });
    }

    // ------------------------------------------------------------
    // 6. Provider task must exist before polling
    // ------------------------------------------------------------

    if (!generation.providerTaskId) {
      return NextResponse.json(
        {
          success: false,
          error: "Video provider task is missing.",
        },
        { status: 500 },
      );
    }

    if (generation.provider !== "openai") {
      return NextResponse.json(
        {
          success: false,
          error: "Unsupported video provider.",
        },
        { status: 500 },
      );
    }

    // ------------------------------------------------------------
    // 7. Ask the provider for the current state
    // ------------------------------------------------------------

    const providerStatus = await getVideoJobStatus(generation.providerTaskId);

    // ------------------------------------------------------------
    // 8. Provider completed
    //
    // Only one concurrent poller should be allowed to transition the
    // local generation into COMPLETED.
    // ------------------------------------------------------------

    if (providerStatus.status === "COMPLETED") {
      await prisma.videoGeneration.updateMany({
        where: {
          id: generation.id,
          userId: session.user.id,
          status: {
            in: ["PENDING", "PROCESSING"],
          },
        },
        data: {
          status: "COMPLETED",
          videoUrl: `/api/ai/video/${generation.id}/content`,
          errorMessage: null,
          completedAt: new Date(),
        },
      });

      // Always re-read after the conditional update so the response
      // reflects the authoritative database state.
      generation = await prisma.videoGeneration.findFirstOrThrow({
        where: {
          id: generation.id,
          userId: session.user.id,
        },
      });

      return NextResponse.json({
        success: true,
        generation: serializeGeneration(generation),
      });
    }

    // ------------------------------------------------------------
    // 9. Provider failed
    //
    // Refund FIRST.
    //
    // This is intentional. If the process crashes after refunding but
    // before updating the generation, the refund operation is designed
    // to be idempotent and the next poll can reconcile the state.
    // ------------------------------------------------------------

    if (providerStatus.status === "FAILED") {
      if (generation.creditsUsed > 0 && !generation.creditRefundedAt) {
        await refundVideoCreditsAtomic({
          userId: session.user.id,
          generationId: generation.id,
        });
      }

      await prisma.videoGeneration.updateMany({
        where: {
          id: generation.id,
          userId: session.user.id,
          status: {
            in: ["PENDING", "PROCESSING"],
          },
        },
        data: {
          status: "FAILED",
          errorMessage: providerStatus.error ?? "Video generation failed.",
        },
      });

      generation = await prisma.videoGeneration.findFirstOrThrow({
        where: {
          id: generation.id,
          userId: session.user.id,
        },
      });

      return NextResponse.json({
        success: true,
        generation: serializeGeneration(generation),
      });
    }

    // ------------------------------------------------------------
    // 10. Provider cancelled
    // ------------------------------------------------------------

    if (providerStatus.status === "CANCELLED") {
      if (generation.creditsUsed > 0 && !generation.creditRefundedAt) {
        await refundVideoCreditsAtomic({
          userId: session.user.id,
          generationId: generation.id,
        });
      }

      await prisma.videoGeneration.updateMany({
        where: {
          id: generation.id,
          userId: session.user.id,
          status: {
            in: ["PENDING", "PROCESSING"],
          },
        },
        data: {
          status: "CANCELLED",
          errorMessage:
            providerStatus.error ?? "Video generation was cancelled.",
        },
      });

      generation = await prisma.videoGeneration.findFirstOrThrow({
        where: {
          id: generation.id,
          userId: session.user.id,
        },
      });

      return NextResponse.json({
        success: true,
        generation: serializeGeneration(generation),
      });
    }

    // ------------------------------------------------------------
    // 11. Provider is still processing
    //
    // Do not blindly overwrite a terminal local state that another
    // concurrent poller may already have committed.
    // ------------------------------------------------------------

    await prisma.videoGeneration.updateMany({
      where: {
        id: generation.id,
        userId: session.user.id,
        status: {
          in: ["PENDING", "PROCESSING"],
        },
      },
      data: {
        status: "PROCESSING",
      },
    });

    generation = await prisma.videoGeneration.findFirstOrThrow({
      where: {
        id: generation.id,
        userId: session.user.id,
      },
    });

    return NextResponse.json({
      success: true,
      generation: serializeGeneration(generation),
    });
  } catch (error) {
    console.error("[AI Video Status] Failed to process video status:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to retrieve video generation status.",
      },
      { status: 500 },
    );
  }
}
