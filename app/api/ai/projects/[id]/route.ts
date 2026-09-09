import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

const VALID_TYPES = [
  "GENERAL",
  "WORKSHEET",
  "WORKBOOK",
  "LESSON",
  "QUIZ",
  "PRESENTATION",
  "YOUTUBE",
  "JUSTDY_KIDZ",
] as const;

const VALID_STATUSES = ["ACTIVE", "ARCHIVED", "DELETED"] as const;

type ProjectType = (typeof VALID_TYPES)[number];
type ProjectStatus = (typeof VALID_STATUSES)[number];

function isProjectType(value: string): value is ProjectType {
  return VALID_TYPES.includes(value as ProjectType);
}

function isProjectStatus(value: string): value is ProjectStatus {
  return VALID_STATUSES.includes(value as ProjectStatus);
}

export async function GET(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { id } = await context.params;

    if (!id?.trim()) {
      return NextResponse.json(
        { error: "Project ID is required." },
        { status: 400 },
      );
    }

    const project = await prisma.aIProject.findFirst({
      where: {
        id,
        userId: user.id,
      },
      select: {
        id: true,
        name: true,
        description: true,
        type: true,
        status: true,
        createdAt: true,
        updatedAt: true,

        _count: {
          select: {
            assets: true,
            conversations: true,
            generations: true,
          },
        },

        conversations: {
          orderBy: {
            updatedAt: "desc",
          },
          take: 8,
          select: {
            id: true,
            title: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
        },

        generations: {
          orderBy: {
            createdAt: "desc",
          },
          take: 12,
          select: {
            id: true,
            type: true,
            operation: true,
            status: true,
            prompt: true,
            provider: true,
            model: true,
            creditsUsed: true,
            createdAt: true,
            completedAt: true,
            assets: {
              take: 4,
              orderBy: {
                createdAt: "desc",
              },
              select: {
                id: true,
                type: true,
                name: true,
                url: true,
                thumbnailUrl: true,
                mimeType: true,
                createdAt: true,
              },
            },
          },
        },

        assets: {
          orderBy: {
            createdAt: "desc",
          },
          take: 12,
          select: {
            id: true,
            type: true,
            name: true,
            url: true,
            thumbnailUrl: true,
            mimeType: true,
            fileSize: true,
            metadata: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found." },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        project,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("GET /api/ai/projects/[id] failed:", error);

    return NextResponse.json(
      { error: "Unable to load the project." },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { id } = await context.params;

    if (!id?.trim()) {
      return NextResponse.json(
        { error: "Project ID is required." },
        { status: 400 },
      );
    }

    const existing = await prisma.aIProject.findFirst({
      where: {
        id,
        userId: user.id,
      },
      select: {
        id: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Project not found." },
        { status: 404 },
      );
    }

    const body = await request.json();

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 },
      );
    }

    const updates: {
      name?: string;
      description?: string | null;
      type?: ProjectType;
      status?: ProjectStatus;
    } = {};

    if ("name" in body) {
      if (typeof body.name !== "string") {
        return NextResponse.json(
          { error: "Project name must be a string." },
          { status: 400 },
        );
      }

      const name = body.name.trim();

      if (!name) {
        return NextResponse.json(
          { error: "Project name is required." },
          { status: 400 },
        );
      }

      if (name.length > 200) {
        return NextResponse.json(
          {
            error: "Project name cannot exceed 200 characters.",
          },
          { status: 400 },
        );
      }

      updates.name = name;
    }

    if ("description" in body) {
      if (body.description !== null && typeof body.description !== "string") {
        return NextResponse.json(
          {
            error: "Project description must be a string or null.",
          },
          { status: 400 },
        );
      }

      const description =
        typeof body.description === "string" ? body.description.trim() : null;

      if (description && description.length > 2000) {
        return NextResponse.json(
          {
            error: "Project description cannot exceed 2000 characters.",
          },
          { status: 400 },
        );
      }

      updates.description = description || null;
    }

    if ("type" in body) {
      if (typeof body.type !== "string" || !isProjectType(body.type)) {
        return NextResponse.json(
          {
            error: "Invalid project type.",
            allowedTypes: VALID_TYPES,
          },
          { status: 400 },
        );
      }

      updates.type = body.type;
    }

    if ("status" in body) {
      if (typeof body.status !== "string" || !isProjectStatus(body.status)) {
        return NextResponse.json(
          {
            error: "Invalid project status.",
            allowedStatuses: VALID_STATUSES,
          },
          { status: 400 },
        );
      }

      updates.status = body.status;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No project changes supplied." },
        { status: 400 },
      );
    }

    const project = await prisma.aIProject.update({
      where: {
        id: existing.id,
      },
      data: updates,
      select: {
        id: true,
        name: true,
        description: true,
        type: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            assets: true,
            conversations: true,
            generations: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      project,
    });
  } catch (error) {
    console.error("PATCH /api/ai/projects/[id] failed:", error);

    return NextResponse.json(
      { error: "Unable to update the project." },
      { status: 500 },
    );
  }
}
