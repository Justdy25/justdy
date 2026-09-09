import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";

import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

type Context = {
  params: Promise<{
    whiteboardId: string;
  }>;
};

async function getAuthenticatedUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return session?.user ?? null;
}

async function getAuthorizedWhiteboard(whiteboardId: string, userId: string) {
  const whiteboard = await prisma.whiteboard.findUnique({
    where: {
      id: whiteboardId,
    },
    include: {
      appointment: {
        select: {
          id: true,
          learnerId: true,
          educatorId: true,
          status: true,
        },
      },
    },
  });

  if (!whiteboard) {
    return {
      whiteboard: null,
      authorized: false,
    };
  }

  /*
   * Standalone boards remain private.
   */
  if (whiteboard.isStandalone) {
    return {
      whiteboard,
      authorized: whiteboard.userId === userId,
    };
  }

  /*
   * Appointment boards are shared between
   * the two authorized tutoring participants.
   */
  if (!whiteboard.appointment) {
    return {
      whiteboard,
      authorized: whiteboard.userId === userId,
    };
  }

  const appointment = whiteboard.appointment;

  const authorized =
    appointment.learnerId === userId || appointment.educatorId === userId;

  return {
    whiteboard,
    authorized,
  };
}

export async function GET(_request: NextRequest, context: Context) {
  try {
    const user = await getAuthenticatedUser();

    if (!user?.id) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        },
      );
    }

    const { whiteboardId } = await context.params;

    const result = await getAuthorizedWhiteboard(whiteboardId, user.id);

    if (!result.whiteboard) {
      return NextResponse.json(
        {
          error: "Whiteboard not found.",
        },
        {
          status: 404,
        },
      );
    }

    if (!result.authorized) {
      return NextResponse.json(
        {
          error: "You are not authorized to access this whiteboard.",
        },
        {
          status: 403,
        },
      );
    }

    return NextResponse.json({
      whiteboard: result.whiteboard,
    });
  } catch (error) {
    console.error("GET /api/whiteboards/[whiteboardId] error:", error);

    return NextResponse.json(
      {
        error: "Failed to retrieve whiteboard.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function PUT(request: NextRequest, context: Context) {
  try {
    const user = await getAuthenticatedUser();

    if (!user?.id) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        },
      );
    }

    const { whiteboardId } = await context.params;

    const body = await request.json();

    const { name, data } = body;

    if (data === undefined || data === null) {
      return NextResponse.json(
        {
          error: "Whiteboard data is required.",
        },
        {
          status: 400,
        },
      );
    }

    const result = await getAuthorizedWhiteboard(whiteboardId, user.id);

    if (!result.whiteboard) {
      return NextResponse.json(
        {
          error: "Whiteboard not found.",
        },
        {
          status: 404,
        },
      );
    }

    if (!result.authorized) {
      return NextResponse.json(
        {
          error: "You are not authorized to modify this whiteboard.",
        },
        {
          status: 403,
        },
      );
    }

    const whiteboard = await prisma.whiteboard.update({
      where: {
        id: whiteboardId,
      },
      data: {
        name:
          typeof name === "string" && name.trim()
            ? name.trim()
            : result.whiteboard.name,

        data,
      },
    });

    return NextResponse.json({
      whiteboard,
    });
  } catch (error) {
    console.error("PUT /api/whiteboards/[whiteboardId] error:", error);

    return NextResponse.json(
      {
        error: "Failed to save whiteboard.",
      },
      {
        status: 500,
      },
    );
  }
}
