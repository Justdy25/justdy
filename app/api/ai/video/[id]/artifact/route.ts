import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import prisma from "@/lib/prisma";
import { persistVideoArtifact } from "@/lib/ai/video-artifact";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      projectId?: unknown;
    };

    const projectId =
      typeof body.projectId === "string" ? body.projectId : null;

    if (projectId) {
      const project = await prisma.aIProject.findFirst({
        where: { id: projectId, userId: user.id, status: "ACTIVE" },
        select: { id: true },
      });

      if (!project) {
        return NextResponse.json(
          { error: "Project not found." },
          { status: 404 },
        );
      }
    }

    const asset = await persistVideoArtifact({
      userId: user.id,
      videoGenerationId: id,
      projectId,
    });

    return NextResponse.json({ success: true, asset });
  } catch (error) {
    console.error("Persist video artifact error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to persist video artifact.",
      },
      { status: 500 },
    );
  }
}
