import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    const conversations = await prisma.aIConversation.findMany({
      where: {
        userId: user.id,
        status: "ACTIVE",
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 50,
      select: {
        id: true,
        title: true,
        model: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      conversations,
    });
  } catch (error) {
    console.error("GET /api/ai/conversations:", error);

    return NextResponse.json(
      { error: "Unable to load conversations." },
      { status: 500 },
    );
  }
}
