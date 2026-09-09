import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function getAuthenticatedUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return session?.user ?? null;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await getAuthenticatedUser();

    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json(
        { error: "Session ID is required." },
        { status: 400 },
      );
    }

    const body = (await request.json().catch(() => null)) as {
      action?: unknown;
    } | null;

    const action = body?.action;
    if (action !== "start" && action !== "end") {
      return NextResponse.json(
        { error: "Action must be 'start' or 'end'." },
        { status: 400 },
      );
    }

    const booking = await prisma.tutoringBooking.findUnique({
      where: { id },
      select: {
        id: true,
        customerId: true,
        tutorId: true,
        status: true,
        appointmentId: true,
        tutoringSlot: {
          select: {
            startTime: true,
            endTime: true,
          },
        },
      },
    });

    if (!booking) {
      return NextResponse.json(
        { error: "Tutoring session not found." },
        { status: 404 },
      );
    }

    const isCustomer = booking.customerId === user.id;
    const isTutor = booking.tutorId === user.id;

    if (!isCustomer && !isTutor) {
      return NextResponse.json(
        { error: "You are not authorized to change this tutoring session." },
        { status: 403 },
      );
    }

    if (action === "start") {
      const now = Date.now();
      const joinStart =
        booking.tutoringSlot.startTime.getTime() - 30 * 60 * 1000;
      const end = booking.tutoringSlot.endTime.getTime();

      if (now < joinStart) {
        return NextResponse.json(
          { error: "The tutoring session has not opened yet." },
          { status: 403 },
        );
      }

      if (now > end) {
        return NextResponse.json(
          { error: "The tutoring session has already ended." },
          { status: 403 },
        );
      }

      if (
        booking.status === "COMPLETED" ||
        booking.status === "CANCELLED" ||
        booking.status === "REFUNDED"
      ) {
        return NextResponse.json(
          { error: "This tutoring session can no longer be started." },
          { status: 409 },
        );
      }

      const nextStatus =
        booking.status === "IN_PROGRESS"
          ? "IN_PROGRESS"
          : booking.status === "READY" || booking.status === "SCHEDULED"
            ? "IN_PROGRESS"
            : null;

      if (!nextStatus) {
        return NextResponse.json(
          { error: "This tutoring session is not ready to start." },
          { status: 409 },
        );
      }

      const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.tutoringBooking.updateMany({
          where: {
            id: booking.id,
            status: { in: ["SCHEDULED", "READY", "IN_PROGRESS"] },
          },
          data: { status: "IN_PROGRESS" },
        });

        if (result.count === 0) {
          const current = await tx.tutoringBooking.findUnique({
            where: { id: booking.id },
            select: { status: true },
          });

          if (current?.status === "IN_PROGRESS") {
            return current.status;
          }

          throw new Error("SESSION_STATE_CHANGED");
        }

        return "IN_PROGRESS" as const;
      });

      return NextResponse.json({
        success: true,
        action,
        status: updated,
      });
    }

    if (!isTutor) {
      return NextResponse.json(
        { error: "Only the tutor can end a tutoring session." },
        { status: 403 },
      );
    }

    if (booking.status === "COMPLETED") {
      return NextResponse.json({
        success: true,
        action,
        status: "COMPLETED",
        alreadyCompleted: true,
      });
    }

    // A lesson can only be completed after it has actually entered the live
    // state. This prevents a forged direct API request from completing a
    // future booking before either participant joins the classroom.
    if (booking.status !== "IN_PROGRESS") {
      return NextResponse.json(
        {
          error:
            "The tutoring session must be in progress before it can be ended.",
        },
        { status: 409 },
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.tutoringBooking.updateMany({
        where: {
          id: booking.id,
          status: "IN_PROGRESS",
        },
        data: { status: "COMPLETED" },
      });

      if (result.count === 0) {
        const current = await tx.tutoringBooking.findUnique({
          where: { id: booking.id },
          select: { status: true },
        });

        if (current?.status === "COMPLETED") {
          return { status: "COMPLETED" as const, alreadyCompleted: true };
        }

        throw new Error("SESSION_STATE_CHANGED");
      }

      if (booking.appointmentId) {
        await tx.appointment.updateMany({
          where: {
            id: booking.appointmentId,
            status: { not: "Completed" },
          },
          data: { status: "Completed" },
        });
      }

      return { status: "COMPLETED" as const, alreadyCompleted: false };
    });

    return NextResponse.json({
      success: true,
      action,
      status: updated.status,
      alreadyCompleted: updated.alreadyCompleted,
    });
  } catch (error) {
    console.error("POST /api/tutoring/sessions/[id]/lifecycle error:", error);

    return NextResponse.json(
      { error: "Failed to update tutoring session lifecycle." },
      { status: 500 },
    );
  }
}
