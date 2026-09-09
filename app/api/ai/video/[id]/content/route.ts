import { NextResponse } from "next/server";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

import { downloadVideoContent } from "@/lib/ai/video/provider";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
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

    const generation = await prisma.videoGeneration.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
      select: {
        id: true,
        provider: true,
        providerTaskId: true,
        status: true,
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

    if (generation.status !== "COMPLETED") {
      return NextResponse.json(
        {
          success: false,
          error: "Video is not ready yet.",
        },
        { status: 409 },
      );
    }

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

    const providerResponse = await downloadVideoContent(
      generation.providerTaskId,
    );

    if (!providerResponse.ok || !providerResponse.body) {
      console.error(
        "[AI Video Content] Provider returned an error:",
        providerResponse.status,
      );

      return NextResponse.json(
        {
          success: false,
          error: "Unable to retrieve generated video.",
        },
        { status: 502 },
      );
    }

    const contentType =
      providerResponse.headers.get("content-type") ?? "video/mp4";

    const contentLength = providerResponse.headers.get("content-length");

    const responseHeaders = new Headers();

    responseHeaders.set("Content-Type", contentType);

    responseHeaders.set(
      "Content-Disposition",
      `inline; filename="justdy-video-${generation.id}.mp4"`,
    );

    responseHeaders.set("Cache-Control", "private, max-age=3600");

    responseHeaders.set("X-Content-Type-Options", "nosniff");

    if (contentLength) {
      responseHeaders.set("Content-Length", contentLength);
    }

    return new Response(providerResponse.body, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("[AI Video Content] Failed to serve video:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to retrieve generated video.",
      },
      { status: 500 },
    );
  }
}
