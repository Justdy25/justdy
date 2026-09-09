import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { normalizeProjectContext } from "@/lib/ai/project-context";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user)
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    const { id } = await params;
    const project = await prisma.aIProject.findFirst({
      where: { id, userId: user.id, status: "ACTIVE" },
      select: { id: true, context: true },
    });
    if (!project)
      return NextResponse.json(
        { error: "Project not found." },
        { status: 404 },
      );
    return NextResponse.json({
      success: true,
      projectId: project.id,
      context: normalizeProjectContext(project.context),
    });
  } catch (error) {
    console.error("GET project context:", error);
    return NextResponse.json(
      { error: "Unable to load project context." },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user)
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    const { id } = await params;
    const project = await prisma.aIProject.findFirst({
      where: { id, userId: user.id, status: "ACTIVE" },
      select: { id: true },
    });
    if (!project)
      return NextResponse.json(
        { error: "Project not found." },
        { status: 404 },
      );
    const body = (await request.json().catch(() => ({}))) as {
      context?: unknown;
    };
    if (!body.context || typeof body.context !== "object")
      return NextResponse.json(
        { error: "Project context is required." },
        { status: 400 },
      );
    const context = normalizeProjectContext(body.context);
    const saved = await prisma.aIProject.update({
      where: { id },
      data: { context },
      select: { id: true, context: true, updatedAt: true },
    });
    return NextResponse.json({
      success: true,
      projectId: saved.id,
      context: normalizeProjectContext(saved.context),
      updatedAt: saved.updatedAt,
    });
  } catch (error) {
    console.error("PATCH project context:", error);
    return NextResponse.json(
      { error: "Unable to save project context." },
      { status: 500 },
    );
  }
}
