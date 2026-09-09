import { NextResponse } from "next/server";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  createTutoringSlot,
  getAvailableTutoringSlots,
} from "@/lib/tutoring/booking";

export const dynamic = "force-dynamic";

function parseDate(value: unknown, fieldName: string): Date {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${fieldName} is required.`);
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} is invalid.`);
  }

  return date;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const tutorId = searchParams.get("tutorId")?.trim();

    if (!tutorId) {
      return NextResponse.json(
        {
          error: "tutorId is required.",
        },
        {
          status: 400,
        },
      );
    }

    const now = new Date();

    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    const from = fromParam ? parseDate(fromParam, "from") : now;

    const defaultTo = new Date(from);
    defaultTo.setDate(defaultTo.getDate() + 14);

    const to = toParam ? parseDate(toParam, "to") : defaultTo;

    if (from >= to) {
      return NextResponse.json(
        {
          error: "The requested availability range is invalid.",
        },
        {
          status: 400,
        },
      );
    }

    const tutor = await prisma.user.findFirst({
      where: {
        id: tutorId,
        facilitatorProfile: {
          is: {
            verificationStatus: "Verified",
          },
        },
      },
      select: {
        id: true,
      },
    });

    if (!tutor) {
      return NextResponse.json(
        {
          error: "Tutor not found.",
        },
        {
          status: 404,
        },
      );
    }

    const slots = await getAvailableTutoringSlots({
      tutorId,
      from,
      to,
    });

    return NextResponse.json({
      tutorId,
      from: from.toISOString(),
      to: to.toISOString(),
      slots,
    });
  } catch (error) {
    console.error("Failed to load tutoring availability:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load tutoring availability.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          error: "Unauthorized.",
        },
        {
          status: 401,
        },
      );
    }

    const body = (await request.json()) as {
      startTime?: unknown;
      endTime?: unknown;
    };

    const startTime = parseDate(body.startTime, "startTime");
    const endTime = parseDate(body.endTime, "endTime");

    const slot = await createTutoringSlot({
      tutorId: session.user.id,
      startTime,
      endTime,
    });

    return NextResponse.json(
      {
        slot,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error("Failed to create tutoring slot:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Failed to create tutoring slot.";

    const status = message === "Unauthorized." ? 401 : 400;

    return NextResponse.json(
      {
        error: message,
      },
      {
        status,
      },
    );
  }
}
