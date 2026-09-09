import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

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

function parseLimit(value: string | null): number {
  if (!value) return DEFAULT_LIMIT;

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_LIMIT;
  }

  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(parsed)));
}

function isProjectType(value: string): value is ProjectType {
  return VALID_TYPES.includes(value as ProjectType);
}

function isProjectStatus(value: string): value is ProjectStatus {
  return VALID_STATUSES.includes(value as ProjectStatus);
}

/**
 * GET /api/ai/projects
 *
 * Returns the authenticated user's projects.
 */
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search")?.trim() || null;

    const typeParam = searchParams.get("type")?.trim().toUpperCase() || null;

    const statusParam =
      searchParams.get("status")?.trim().toUpperCase() || "ACTIVE";

    const cursor = searchParams.get("cursor")?.trim() || null;

    const limit = parseLimit(searchParams.get("limit"));

    if (typeParam && !isProjectType(typeParam)) {
      return NextResponse.json(
        {
          error: "Invalid project type.",
          allowedTypes: VALID_TYPES,
        },
        { status: 400 },
      );
    }

    if (statusParam && !isProjectStatus(statusParam)) {
      return NextResponse.json(
        {
          error: "Invalid project status.",
          allowedStatuses: VALID_STATUSES,
        },
        { status: 400 },
      );
    }

    const projects = await prisma.aIProject.findMany({
      where: {
        userId: user.id,
        status: statusParam as ProjectStatus,

        ...(typeParam
          ? {
              type: typeParam as ProjectType,
            }
          : {}),

        ...(search
          ? {
              OR: [
                {
                  name: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
                {
                  description: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
              ],
            }
          : {}),
      },

      orderBy: [
        {
          updatedAt: "desc",
        },
        {
          id: "desc",
        },
      ],

      take: limit + 1,

      ...(cursor
        ? {
            cursor: {
              id: cursor,
            },
            skip: 1,
          }
        : {}),

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

    const hasMore = projects.length > limit;

    const pageProjects = hasMore ? projects.slice(0, limit) : projects;

    const nextCursor = hasMore
      ? (pageProjects[pageProjects.length - 1]?.id ?? null)
      : null;

    return NextResponse.json(
      {
        success: true,
        projects: pageProjects,
        pagination: {
          limit,
          hasMore,
          nextCursor,
        },
        filters: {
          search,
          type: typeParam,
          status: statusParam,
        },
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (error) {
    console.error("GET /api/ai/projects failed:", error);

    return NextResponse.json(
      {
        error: "Unable to load your projects.",
      },
      {
        status: 500,
      },
    );
  }
}

/**
 * POST /api/ai/projects
 *
 * Creates a new project for the authenticated user.
 */
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          error: "Invalid JSON body.",
        },
        {
          status: 400,
        },
      );
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        {
          error: "Request body must be an object.",
        },
        {
          status: 400,
        },
      );
    }

    const input = body as Record<string, unknown>;

    const name = typeof input.name === "string" ? input.name.trim() : "";

    const description =
      typeof input.description === "string" ? input.description.trim() : null;

    const typeValue =
      typeof input.type === "string"
        ? input.type.trim().toUpperCase()
        : "GENERAL";

    if (!name) {
      return NextResponse.json(
        {
          error: "Project name is required.",
        },
        {
          status: 400,
        },
      );
    }

    if (name.length > 200) {
      return NextResponse.json(
        {
          error: "Project name must be 200 characters or fewer.",
        },
        {
          status: 400,
        },
      );
    }

    if (description && description.length > 2000) {
      return NextResponse.json(
        {
          error: "Project description must be 2000 characters or fewer.",
        },
        {
          status: 400,
        },
      );
    }

    if (!isProjectType(typeValue)) {
      return NextResponse.json(
        {
          error: "Invalid project type.",
          allowedTypes: VALID_TYPES,
        },
        {
          status: 400,
        },
      );
    }

    const project = await prisma.aIProject.create({
      data: {
        userId: user.id,
        name,
        description: description || null,
        type: typeValue,
        status: "ACTIVE",
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
      },
    });

    return NextResponse.json(
      {
        success: true,
        project,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error("POST /api/ai/projects failed:", error);

    return NextResponse.json(
      {
        error: "Unable to create the project.",
      },
      {
        status: 500,
      },
    );
  }
}
