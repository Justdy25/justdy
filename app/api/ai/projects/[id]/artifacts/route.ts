import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import prisma from "@/lib/prisma";
import { AIAssetType } from "@/lib/generated/prisma/enums";

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 60;
const VALID_TYPES = new Set(Object.values(AIAssetType));

function parseLimit(value: string | null) {
  const parsed = Number(value ?? DEFAULT_LIMIT);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.floor(parsed), 1), MAX_LIMIT);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  const { id } = await params;
  const projectId = id;
  if (!projectId?.trim()) {
    return NextResponse.json(
      { error: "Project ID is required" },
      { status: 400 },
    );
  }

  const url = new URL(request.url);
  const limit = parseLimit(url.searchParams.get("limit"));
  const cursor = url.searchParams.get("cursor")?.trim() || null;
  const requestedType =
    url.searchParams.get("type")?.trim().toUpperCase() || null;

  if (requestedType && !VALID_TYPES.has(requestedType as AIAssetType)) {
    return NextResponse.json(
      { error: "Invalid artifact type" },
      { status: 400 },
    );
  }

  const project = await prisma.aIProject.findFirst({
    where: { id: projectId, userId: user.id, status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      description: true,
      type: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const assets = await prisma.aIAsset.findMany({
    where: {
      userId: user.id,
      projectId: project.id,
      ...(requestedType ? { type: requestedType as AIAssetType } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    take: limit + 1,
    select: {
      id: true,
      userId: true,
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
          status: true,
          prompt: true,
          model: true,
          createdAt: true,
          completedAt: true,
        },
      },
    },
  });

  const hasMore = assets.length > limit;
  const page = hasMore ? assets.slice(0, limit) : assets;
  const nextCursor = hasMore ? (page[page.length - 1]?.id ?? null) : null;

  return NextResponse.json({
    project,
    assets: page,
    pagination: { limit, hasMore, nextCursor },
  });
}
