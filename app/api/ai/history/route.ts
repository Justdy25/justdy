import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 100;

const VALID_TYPES = ["DOCUMENT", "IMAGE", "VIDEO", "AUDIO", "OTHER"] as const;

type LibraryAssetType = (typeof VALID_TYPES)[number];

function isLibraryAssetType(value: string): value is LibraryAssetType {
  return VALID_TYPES.includes(value as LibraryAssetType);
}

function parseLimit(value: string | null): number {
  if (!value) {
    return DEFAULT_LIMIT;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_LIMIT;
  }

  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(parsed)));
}

/**
 * GET /api/ai/library
 *
 * Returns the authenticated user's AI assets.
 *
 * Examples:
 *
 *   /api/ai/library
 *   /api/ai/library?type=IMAGE
 *   /api/ai/library?type=VIDEO
 *   /api/ai/library?projectId=<project-id>
 *   /api/ai/library?limit=40
 *   /api/ai/library?cursor=<asset-id>
 */
export async function GET(request: Request) {
  try {
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

    const { searchParams } = new URL(request.url);

    const typeParam = searchParams.get("type")?.trim().toUpperCase() || null;

    const projectId = searchParams.get("projectId")?.trim() || null;

    const cursor = searchParams.get("cursor")?.trim() || null;

    const limit = parseLimit(searchParams.get("limit"));

    if (typeParam && !isLibraryAssetType(typeParam)) {
      return NextResponse.json(
        {
          error: "Invalid library asset type.",
          allowedTypes: VALID_TYPES,
        },
        {
          status: 400,
        },
      );
    }

    /*
     * A project filter must always be scoped to the authenticated user.
     *
     * Do not rely on the AIAsset.userId filter alone here: validating the
     * project first prevents a caller from using another user's project ID
     * as a filter and keeps project access rules centralized at the boundary.
     */
    if (projectId) {
      const project = await prisma.aIProject.findFirst({
        where: {
          id: projectId,
          userId: user.id,
          status: "ACTIVE",
        },
        select: {
          id: true,
        },
      });

      if (!project) {
        return NextResponse.json(
          {
            error: "Project not found.",
          },
          {
            status: 404,
          },
        );
      }
    }

    const assets = await prisma.aIAsset.findMany({
      where: {
        userId: user.id,

        ...(projectId
          ? {
              projectId,
            }
          : {}),

        ...(typeParam
          ? {
              type: typeParam as LibraryAssetType,
            }
          : {}),
      },

      orderBy: {
        createdAt: "desc",
      },

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
        projectId: true,
        generationId: true,
        type: true,
        name: true,
        fileKey: true,
        url: true,
        thumbnailUrl: true,
        mimeType: true,
        fileSize: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,

        generation: {
          select: {
            id: true,
            type: true,
            operation: true,
            status: true,
            prompt: true,
            provider: true,
            model: true,
            createdAt: true,
            completedAt: true,
          },
        },
      },
    });

    const hasMore = assets.length > limit;

    const pageAssets = hasMore ? assets.slice(0, limit) : assets;

    const nextCursor = hasMore
      ? (pageAssets[pageAssets.length - 1]?.id ?? null)
      : null;

    return NextResponse.json({
      success: true,
      assets: pageAssets,

      pagination: {
        limit,
        hasMore,
        nextCursor,
      },
    });
  } catch (error) {
    console.error("GET /api/ai/library failed:", error);

    return NextResponse.json(
      {
        error: "Unable to load your library.",
      },
      {
        status: 500,
      },
    );
  }
}
