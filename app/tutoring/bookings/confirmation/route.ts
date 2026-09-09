import { NextResponse } from "next/server";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const stripeSessionId = searchParams.get("session_id")?.trim();

    if (!stripeSessionId) {
      return NextResponse.json(
        { error: "Missing checkout session." },
        { status: 400 },
      );
    }

    const booking = await prisma.tutoringBooking.findFirst({
      where: {
        stripeSessionId,
        customerId: session.user.id,
      },
      select: {
        id: true,
        status: true,
        appointmentId: true,
      },
    });

    if (!booking) {
      return NextResponse.json({
        booking: null,
        processing: true,
      });
    }

    return NextResponse.json({
      booking,
      processing:
        booking.status === "PENDING_PAYMENT" || booking.status === "PAID",
    });
  } catch (error) {
    console.error("TUTORING BOOKING CONFIRMATION ERROR:", error);

    return NextResponse.json(
      { error: "Unable to verify tutoring booking." },
      { status: 500 },
    );
  }
}
