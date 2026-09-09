import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import prisma from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    const { id } = await context.params;

    const conversation = await prisma.aIConversation.findFirst({
      where: {
        id,
        userId: user.id,
        status: "ACTIVE",
      },
      select: {
        id: true,
        title: true,
        model: true,
        createdAt: true,
        updatedAt: true,
        messages: {
          orderBy: {
            createdAt: "asc",
          },
          select: {
            id: true,
            role: true,
            content: true,
            createdAt: true,
          },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      conversation,
      messages: conversation.messages,
    });
  } catch (error) {
    console.error("GET /api/ai/conversations/[id]:", error);

    return NextResponse.json(
      { error: "Unable to load conversation." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    const { id } = await context.params;

    const conversation = await prisma.aIConversation.findFirst({
      where: {
        id,
        userId: user.id,
        status: "ACTIVE",
      },
      select: {
        id: true,
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found." },
        { status: 404 },
      );
    }

    await prisma.aIConversation.update({
      where: {
        id: conversation.id,
      },
      data: {
        status: "ARCHIVED",
      },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("DELETE /api/ai/conversations/[id]:", error);

    return NextResponse.json(
      { error: "Unable to delete conversation." },
      { status: 500 },
    );
  }
}
