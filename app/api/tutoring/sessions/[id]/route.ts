import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { Auth } from "@vonage/auth";
import { Vonage } from "@vonage/server-sdk";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

const JOIN_WINDOW_MINUTES = 30;
const TOKEN_BUFFER_SECONDS = 60 * 60;

const vonageApplicationId = process.env.NEXT_PUBLIC_VONAGE_APPLICATION_ID;

const vonagePrivateKey = process.env.VONAGE_PRIVATE_KEY;

function getVonageClient() {
  if (!vonageApplicationId || !vonagePrivateKey) {
    throw new Error(
      "NEXT_PUBLIC_VONAGE_APPLICATION_ID and VONAGE_PRIVATE_KEY are required.",
    );
  }

  return new Vonage(
    new Auth({
      applicationId: vonageApplicationId,
      privateKey: vonagePrivateKey,
    }),
    {},
  );
}

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

async function getAuthenticatedUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return session?.user ?? null;
}

async function getAuthorizedSession(bookingId: string, userId: string) {
  const booking = await prisma.tutoringBooking.findUnique({
    where: {
      id: bookingId,
    },
    include: {
      tutor: {
        select: {
          id: true,
          name: true,
          imageUrl: true,
        },
      },
      customer: {
        select: {
          id: true,
          name: true,
          imageUrl: true,
        },
      },
      tutoringSlot: {
        select: {
          id: true,
          startTime: true,
          endTime: true,
          status: true,
        },
      },
    },
  });

  if (!booking) {
    return {
      booking: null,
      appointment: null,
      role: null,
      unauthorized: false,
    };
  }

  let role: "customer" | "tutor" | null = null;

  if (booking.customerId === userId) {
    role = "customer";
  } else if (booking.tutorId === userId) {
    role = "tutor";
  }

  if (!role) {
    return {
      booking: null,
      appointment: null,
      role: null,
      unauthorized: true,
    };
  }

  let appointment = null;

  if (booking.appointmentId) {
    appointment = await prisma.appointment.findUnique({
      where: {
        id: booking.appointmentId,
      },
      select: {
        id: true,
        learnerId: true,
        educatorId: true,
        subject: true,
        gradeLevel: true,
        date: true,
        startTime: true,
        endTime: true,
        status: true,
        videoSessionId: true,
      },
    });
  }

  return {
    booking,
    appointment,
    role,
    unauthorized: false,
  };
}

function getJoinState(
  startTime: Date,
  endTime: Date,
  appointmentStatus: string | null,
  bookingStatus: string,
) {
  const now = Date.now();

  const start = startTime.getTime();
  const end = endTime.getTime();

  const joinWindowStart = start - JOIN_WINDOW_MINUTES * 60 * 1000;

  const beforeJoinWindow = now < joinWindowStart;

  const afterSession = now > end;

  const canJoin =
    !beforeJoinWindow &&
    !afterSession &&
    appointmentStatus === "Scheduled" &&
    (bookingStatus === "SCHEDULED" ||
      bookingStatus === "READY" ||
      bookingStatus === "IN_PROGRESS");

  return {
    canJoin,
    beforeJoinWindow,
    afterSession,
    joinWindowStart: new Date(joinWindowStart).toISOString(),
  };
}

export async function GET(_request: NextRequest, context: RouteContext) {
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

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        {
          error: "Session ID is required.",
        },
        {
          status: 400,
        },
      );
    }

    const result = await getAuthorizedSession(id, user.id);

    if (result.unauthorized) {
      return NextResponse.json(
        {
          error: "You are not authorized to access this tutoring session.",
        },
        {
          status: 403,
        },
      );
    }

    if (!result.booking) {
      return NextResponse.json(
        {
          error: "Tutoring session not found.",
        },
        {
          status: 404,
        },
      );
    }

    const { booking, appointment, role } = result;

    const startTime = appointment?.startTime ?? booking.tutoringSlot.startTime;

    const endTime = appointment?.endTime ?? booking.tutoringSlot.endTime;

    const joinState = getJoinState(
      startTime,
      endTime,
      appointment?.status ?? null,
      booking.status,
    );

    return NextResponse.json({
      session: {
        id: booking.id,
        bookingId: booking.id,
        appointmentId: booking.appointmentId,
        role,

        subject: booking.subject,
        gradeLevel: booking.gradeLevel,
        topic: booking.topic,
        description: booking.description,

        amount: booking.amount,
        currency: booking.currency,
        status: booking.status,

        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),

        appointmentStatus: appointment?.status ?? null,

        videoSessionAvailable: Boolean(appointment?.videoSessionId),

        canJoin: joinState.canJoin,
        beforeJoinWindow: joinState.beforeJoinWindow,
        afterSession: joinState.afterSession,
        joinWindowStart: joinState.joinWindowStart,

        tutor: {
          id: booking.tutor.id,
          name: booking.tutor.name,
          imageUrl: booking.tutor.imageUrl,
        },

        customer: {
          id: booking.customer.id,
          name: booking.customer.name,
          imageUrl: booking.customer.imageUrl,
        },
      },
    });
  } catch (error) {
    console.error("GET /api/tutoring/sessions/[id] error:", error);

    return NextResponse.json(
      {
        error: "Failed to load tutoring session.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
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

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        {
          error: "Session ID is required.",
        },
        {
          status: 400,
        },
      );
    }

    const result = await getAuthorizedSession(id, user.id);

    if (result.unauthorized) {
      return NextResponse.json(
        {
          error: "You are not authorized to join this tutoring session.",
        },
        {
          status: 403,
        },
      );
    }

    if (!result.booking) {
      return NextResponse.json(
        {
          error: "Tutoring session not found.",
        },
        {
          status: 404,
        },
      );
    }

    const { booking, appointment, role } = result;

    if (!appointment) {
      return NextResponse.json(
        {
          error: "The tutoring session has not been initialized yet.",
        },
        {
          status: 409,
        },
      );
    }

    if (!appointment.videoSessionId) {
      return NextResponse.json(
        {
          error: "The video classroom has not been initialized yet.",
        },
        {
          status: 409,
        },
      );
    }

    const joinState = getJoinState(
      appointment.startTime,
      appointment.endTime,
      appointment.status,
      booking.status,
    );

    if (!joinState.canJoin) {
      if (joinState.beforeJoinWindow) {
        return NextResponse.json(
          {
            error:
              "The video classroom opens 30 minutes before the scheduled start time.",
            code: "TOO_EARLY",
            joinWindowStart: joinState.joinWindowStart,
          },
          {
            status: 403,
          },
        );
      }

      if (joinState.afterSession) {
        return NextResponse.json(
          {
            error: "This tutoring session has ended.",
            code: "SESSION_ENDED",
          },
          {
            status: 403,
          },
        );
      }

      return NextResponse.json(
        {
          error: "This tutoring session is not currently available.",
          code: "SESSION_UNAVAILABLE",
        },
        {
          status: 403,
        },
      );
    }

    const vonage = getVonageClient();

    const expirationTime =
      Math.floor(appointment.endTime.getTime() / 1000) + TOKEN_BUFFER_SECONDS;

    const connectionData = JSON.stringify({
      name: user.name,
      userId: user.id,
      role,
      bookingId: booking.id,
      appointmentId: appointment.id,
    });

    const token = vonage.video.generateClientToken(appointment.videoSessionId, {
      role: "publisher",
      expireTime: expirationTime,
      data: connectionData,
    });

    return NextResponse.json({
      success: true,
      videoSessionId: appointment.videoSessionId,
      token,
      role,
      expiresAt: new Date(expirationTime * 1000).toISOString(),
      appointmentId: appointment.id,
    });
  } catch (error) {
    console.error("POST /api/tutoring/sessions/[id] error:", error);

    return NextResponse.json(
      {
        error: "Failed to initialize the tutoring video session.",
      },
      {
        status: 500,
      },
    );
  }
}
